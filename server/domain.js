// Logika domain LestariPangan: setoran, verifikasi, batch/lineage, transfer, anchor, jejak publik.
const crypto = require('crypto');
const ledger = require('./ledger/index');
const { sha256, hashPassword, checkPassword } = require('./auth');
const { uid } = require('./store');

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (m) => new HttpError(400, m), forbid = (m) => new HttpError(403, m), notFound = (m) => new HttpError(404, m), conflict = (m) => new HttpError(409, m);
const now = () => new Date().toISOString();
const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

module.exports = function createDomain(store) {
  const C = (n) => store.col(n);
  const col = Object.fromEntries(['users', 'actors', 'referralCodes', 'farmerGroups', 'qrLabels', 'deposits', 'batches', 'transfers', 'events', 'outbox', 'anomalies', 'notifications', 'auditLogs', 'appConfig', 'counters', 'analyticsReports', 'scans'].map((n) => [n, C(n)]));

  const DEFAULT_CFG = { _id: 'cfg', tolerancePct: 2, depositSlaHours: 24, samplingRate: 30, qrQuotaPerPeriod: 200, yieldAlertPct: 55, hangingHours: 48, scanAlertPerDay: 100, notifierMode: 'manual' };
  async function cfg() { let c = await col.appConfig.findOne({ _id: 'cfg' }); if (!c) c = await col.appConfig.insert({ ...DEFAULT_CFG }); return c; }
  async function seq(name) { let c = await col.counters.findOne({ _id: name }); if (!c) await col.counters.insert({ _id: name, n: 0 }); const n = (c ? c.n : 0) + 1; await col.counters.update({ _id: name }, { n }); return n; }
  const pad = (n, w = 6) => String(n).padStart(w, '0');

  // ---------- audit & notifikasi ----------
  async function audit(ctx, action, detail) {
    await col.auditLogs.insert({ at: now(), userId: ctx?.user?._id, userName: ctx?.user?.name, role: ctx?.user?.role, action, detail: detail || '', act: ctx?.act ? { role: ctx.act.role, actorId: ctx.act.actorId, reason: ctx.act.reason } : undefined });
  }
  async function notify({ toRole, toActorId, text, link }) {
    const c = await cfg();
    await col.notifications.insert({ toRole, toActorId, text, link, channel: c.notifierMode, at: now(), read: false, delivery: c.notifierMode === 'smtp' ? 'antri-smtp' : 'manual' });
  }

  // ---------- event + outbox + anchor ----------
  function eventHash(e) {
    return sha256(stable({ id: e._id, type: e.type, batchId: e.batchId, actorId: e.actorId, payload: e.payload, origin: e.origin, actedAsRole: e.actedAsRole || null, onBehalfOfActorId: e.onBehalfOfActorId || null, at: e.at }));
  }
  async function emit(ctx, { type, batch, actor, payload = {}, anchor = true, at }) {
    const e = { _id: uid('evt'), type, batchId: batch._id, batchCode: batch.code, actorId: actor?._id || null, actorName: actor?.name || ctx?.user?.name, actorRole: actor?.role || ctx?.role, payload, at: at || ctx?.at || now(), origin: ctx?.act ? 'superadmin' : 'actor', actedAsRole: ctx?.act?.role, onBehalfOfActorId: ctx?.act?.actorId, reason: ctx?.act?.reason, createdByUser: ctx?.user?._id };
    e.hash = eventHash(e);
    e.anchorStatus = anchor ? 'pending' : 'not_required';
    await col.events.insert(e);
    if (anchor) { await col.outbox.insert({ eventId: e._id, status: 'pending', attempts: 0 }); await processOutbox(); }
    return e;
  }
  async function processOutbox() {
    const items = await col.outbox.find({ status: 'pending' });
    for (const o of items) {
      const e = await col.events.findOne({ _id: o.eventId });
      try {
        const res = await ledger.anchor(e._id, e.hash);
        await col.events.update({ _id: e._id }, { anchorStatus: 'confirmed', anchor: res });
        await col.outbox.update({ _id: o._id }, { status: 'done' });
      } catch (err) {
        const attempts = o.attempts + 1;
        await col.outbox.update({ _id: o._id }, { attempts, lastError: String(err.message), status: attempts >= 5 ? 'failed' : 'pending' });
        await col.events.update({ _id: e._id }, { anchorStatus: attempts >= 5 ? 'failed' : 'pending' });
      }
    }
    return items.length;
  }
  async function integrity() {
    const events = await col.events.find({ anchorStatus: 'confirmed' });
    const bad = [];
    for (const e of events) {
      const recomputed = eventHash(e), onchain = await ledger.lookup(e._id);
      if (!onchain) bad.push({ eventId: e._id, reason: 'tidak ada di ledger' });
      else if (onchain.hash !== recomputed) bad.push({ eventId: e._id, batchCode: e.batchCode, type: e.type, reason: 'hash data tidak cocok dengan ledger' });
    }
    const chain = await ledger.verifyChain();
    return { network: ledger.network, checked: events.length, mismatches: bad, chain, ok: bad.length === 0 && chain.ok };
  }

  // ---------- anomali ----------
  async function anomaly(type, severity, text, extra = {}) { return col.anomalies.insert({ type, severity, text, at: now(), resolved: false, ...extra }); }

  // ---------- master ----------
  async function pengepulGroups(actorId) { return (await col.farmerGroups.find({ active: true })).filter((g) => (g.linkedActorIds || []).includes(actorId)); }
  function publicGroup(g) { const { codeHash, codeSalt, ...r } = g; return r; }
  const codeOk = (g, code) => g.codeHash === sha256(g.codeSalt + String(code || '').trim().toUpperCase());
  function newGroupCode(prefix) { return `${prefix.toUpperCase().slice(0, 3)}-${crypto.randomInt(1000, 9999)}`; }
  async function createGroup(ctx, d) {
    if (!d.name || !d.district) throw bad('Nama dan kecamatan wajib');
    const code = newGroupCode((d.name.replace(/^KT\s+/i, '').replace(/[^A-Za-z]/g, '') + 'XXX'));
    const salt = crypto.randomBytes(6).toString('hex');
    const g = await col.farmerGroups.insert({ name: d.name, ketua: d.ketua || '', district: d.district, village: d.village || '', lat: +d.lat || -6.55, lng: +d.lng || 107.7, hectares: +d.hectares || 0, avgWeightKg: +d.avgWeightKg || 1500, linkedActorIds: d.linkedActorIds || [], codeSalt: salt, codeHash: sha256(salt + code), active: true, createdAt: now() });
    await audit(ctx, 'kelompok_tani.buat', g.name);
    return { group: publicGroup(g), code };
  }
  async function rotateGroupCode(ctx, id) {
    const g = await col.farmerGroups.findOne({ _id: id }); if (!g) throw notFound('Kelompok tani tidak ditemukan');
    const code = newGroupCode(g.name.replace(/^KT\s+/i, '').replace(/[^A-Za-z]/g, '') + 'XXX'); const salt = crypto.randomBytes(6).toString('hex');
    await col.farmerGroups.update({ _id: id }, { codeSalt: salt, codeHash: sha256(salt + code) });
    await audit(ctx, 'kelompok_tani.rotasi_kode', g.name); return { code };
  }

  // ---------- QR label ----------
  async function issueLabels(ctx, n) {
    const a = ctx.actor; if (!a) throw bad('Aksi ini memerlukan pelaku');
    n = Math.max(1, Math.min(100, +n || 10));
    const c = await cfg(), period = now().slice(0, 7);
    const used = await col.qrLabels.count({ ownerActorId: a._id, period });
    if (used + n > c.qrQuotaPerPeriod) throw conflict(`Kuota QR periode ${period} tersisa ${c.qrQuotaPerPeriod - used}`);
    const out = [];
    for (let i = 0; i < n; i++) { const s = await seq('qr'); out.push(await col.qrLabels.insert({ code: `LP-QR-${a._id.slice(-4).toUpperCase()}-${pad(s, 5)}`, ownerActorId: a._id, status: 'unassigned', period, createdAt: now() })); }
    return out;
  }

  // ---------- setoran ----------
  async function createDeposit(ctx, d) {
    const a = ctx.actor; if (!a || a.role !== 'pengepul') throw forbid('Hanya pengepul yang mencatat setoran');
    const group = await col.farmerGroups.findOne({ _id: d.farmerGroupId });
    if (!group || !group.active) throw bad('Kelompok tani tidak ditemukan');
    if (!(group.linkedActorIds || []).includes(a._id)) throw forbid('Kelompok tani ini belum terhubung dengan pengepul Anda');
    if (!codeOk(group, d.groupCode)) { await anomaly('kode_ketua_salah', 'sedang', `Kode ketua salah untuk ${group.name}`, { actorId: a._id }); throw forbid('Kode ketua tidak valid'); }
    const kg = +d.weightKg; if (!(kg > 0)) throw bad('Berat harus lebih dari 0');
    const nota = String(d.notaNo || '').trim().toUpperCase(); if (!nota) throw bad('Nomor nota wajib');
    if (await col.deposits.findOne({ notaNo: nota, status: { $ne: 'rejected' } })) { await anomaly('nota_ganda', 'sedang', `Nomor nota ganda ditolak (${nota})`, { actorId: a._id }); throw conflict('Nomor nota sudah dipakai'); }
    if (!d.notaPhoto || !d.scalePhoto) throw bad('Foto timbangan dan foto nota bertanda tangan wajib');
    // label QR
    let label = d.qrLabelId ? await col.qrLabels.findOne({ _id: d.qrLabelId, ownerActorId: a._id }) : (await col.qrLabels.find({ ownerActorId: a._id, status: 'unassigned' }, { sort: { createdAt: 1 }, limit: 1 }))[0];
    if (!label || label.status !== 'unassigned') throw conflict('Tidak ada label QR tersedia. Terbitkan label terlebih dahulu.');
    // mode pemeriksaan
    const c = await cfg(); const reasons = [];
    const myDeps = (await col.deposits.find({ actorId: a._id })).filter((x) => x.status !== 'rejected');
    if (!myDeps.length) reasons.push('pengepul baru'); else if (!myDeps.some((x) => x.farmerGroupId === group._id)) reasons.push('pasangan baru');
    if (kg > 2 * group.avgWeightKg) { reasons.push('janggal'); await anomaly('setoran_janggal', 'sedang', `Setoran ${kg} kg, di atas 2x rata-rata ${group.name}`, { actorId: a._id }); }
    const full = reasons.length > 0; const sampled = parseInt(sha256(nota).slice(0, 4), 16) % 100 < c.samplingRate;
    const mode = full ? 'full' : 'sampling';
    const auto = !full && !sampled;
    const seqN = await seq('batch');
    const batch = await col.batches.insert({ code: `LP-BATCH-2026-${pad(seqN)}`, kind: 'deposit', commodity: d.commodity || 'gabah', weightKg: kg, ownerActorId: a._id, status: 'pending_verification', parents: [], farmerGroupId: group._id, qrCode: label.code, tainted: false, createdAt: d.at || now() });
    await col.qrLabels.update({ _id: label._id }, { status: 'assigned', batchId: batch._id });
    const dep = await col.deposits.insert({ batchId: batch._id, actorId: a._id, farmerGroupId: group._id, weightKg: kg, notaNo: nota, notaPhoto: d.notaPhoto, scalePhoto: d.scalePhoto, note: d.note || '', status: 'pending', checkMode: mode, checkReason: reasons.join(', ') || (sampled ? 'sampling' : 'rutin'), createdAt: d.at || now(), createdByUser: ctx.user._id });
    const ev = await emit(ctx, { type: 'DEPOSIT_RECORDED', batch, actor: a, payload: { depositId: dep._id, farmerGroupId: group._id, weightKg: kg, notaNo: nota, qrCode: label.code }, anchor: false, at: d.at });
    await col.deposits.update({ _id: dep._id }, { recordedEventId: ev._id });
    if (auto) await decideDeposit({ ...ctx, role: 'system', user: ctx.user }, dep._id, 'auto_accept', {}, true);
    else await notify({ toRole: 'admin', text: `Setoran ${batch.code} dari ${a.name} menunggu verifikasi (${mode === 'full' ? 'penuh · ' + reasons.join(', ') : 'sampling'})`, link: '#/verifikasi' });
    return col.deposits.findOne({ _id: dep._id });
  }

  async function decideDeposit(ctx, depId, decision, d = {}, system = false) {
    const dep = await col.deposits.findOne({ _id: depId }); if (!dep) throw notFound('Setoran tidak ditemukan');
    if (dep.status !== 'pending') throw conflict('Setoran sudah diputuskan');
    if (!system && dep.createdByUser === ctx.user._id) throw conflict('Tidak dapat memverifikasi setoran yang Anda catat sendiri');
    const batch = await col.batches.findOne({ _id: dep.batchId }); const a = await col.actors.findOne({ _id: dep.actorId });
    const adminActor = system ? { _id: 'system', name: 'Sistem (sampling)', role: 'system' } : { _id: ctx.user._id, name: ctx.user.name, role: ctx.user.role === 'superadmin' ? 'superadmin' : 'admin' };
    if (decision === 'reject') {
      if (!d.reason) throw bad('Alasan penolakan wajib');
      await col.deposits.update({ _id: dep._id }, { status: 'rejected', decidedAt: now(), decidedBy: adminActor.name, rejectReason: d.reason });
      await col.batches.update({ _id: batch._id }, { status: 'voided' });
      await col.qrLabels.update({ batchId: batch._id }, { status: 'voided' });
      await taintDescendants(batch._id);
      await emit(ctx, { type: 'DEPOSIT_REJECTED', batch, actor: adminActor, payload: { depositId: dep._id, reason: d.reason }, anchor: true });
      await audit(ctx, 'setoran.tolak', `${batch.code}: ${d.reason}`);
      await notify({ toActorId: dep.actorId, text: `Setoran ${batch.code} ditolak: ${d.reason}`, link: '#/setoran' });
      return col.deposits.findOne({ _id: dep._id });
    }
    const status = system ? 'auto_accepted' : 'verified';
    await col.deposits.update({ _id: dep._id }, { status, decidedAt: now(), decidedBy: adminActor.name });
    await col.batches.update({ _id: batch._id }, { status: 'available' });
    await emit(ctx, { type: status === 'verified' ? 'DEPOSIT_VERIFIED' : 'DEPOSIT_AUTO_ACCEPTED', batch, actor: adminActor, payload: { depositId: dep._id, recordedEventId: dep.recordedEventId, weightKg: dep.weightKg, checkMode: dep.checkMode, farmerGroupId: dep.farmerGroupId, pengepulId: dep.actorId }, anchor: true });
    if (!system) await audit(ctx, 'setoran.setujui', batch.code);
    await notify({ toActorId: dep.actorId, text: `Setoran ${batch.code} ${status === 'verified' ? 'disetujui' : 'diterima otomatis'}`, link: '#/batch' });
    return col.deposits.findOne({ _id: dep._id });
  }
  async function taintDescendants(rootId) {
    let frontier = [rootId], seen = new Set([rootId]);
    const all = await col.batches.find({});
    while (frontier.length) {
      const next = [];
      for (const b of all) if (!seen.has(b._id) && b.parents.some((p) => frontier.includes(p.batchId))) { seen.add(b._id); next.push(b._id); await col.batches.update({ _id: b._id }, { tainted: true }); }
      frontier = next;
    }
  }

  // ---------- batch / lineage ----------
  async function batchById(id) { const b = await col.batches.findOne({ _id: id }); if (!b) throw notFound('Batch tidak ditemukan'); return b; }
  async function ancestors(batch) {
    const out = new Map([[batch._id, batch]]); const q = [batch];
    while (q.length) { const b = q.shift(); for (const p of b.parents) if (!out.has(p.batchId)) { const pb = await col.batches.findOne({ _id: p.batchId }); if (pb) { out.set(pb._id, pb); q.push(pb); } } }
    return [...out.values()];
  }
  async function leaves(batch, factor = 1, acc = {}) {
    if (batch.kind === 'deposit') { acc[batch._id] = (acc[batch._id] || 0) + factor; return acc; }
    const total = batch.parents.reduce((s, p) => s + p.weightKg, 0) || 1;
    for (const p of batch.parents) { const pb = await col.batches.findOne({ _id: p.batchId }); if (pb) await leaves(pb, factor * (p.weightKg / total), acc); }
    return acc;
  }
  async function composition(batch) {
    const lv = await leaves(batch); const out = {};
    for (const [bid, share] of Object.entries(lv)) {
      const db = await col.batches.findOne({ _id: bid }); const dep = await col.deposits.findOne({ batchId: bid }); const g = await col.farmerGroups.findOne({ _id: db.farmerGroupId });
      const o = (out[g._id] ||= { groupId: g._id, name: g.name, district: g.district, village: g.village, lat: g.lat, lng: g.lng, share: 0, verified: 0, auto: 0, rejected: 0 });
      o.share += share; if (dep.status === 'verified') o.verified += share; else if (dep.status === 'auto_accepted') o.auto += share; else o.rejected += share;
    }
    return Object.values(out).map((o) => ({ ...o, pct: round(o.share * 100) })).sort((a, b) => b.pct - a.pct);
  }
  async function mergeBatches(ctx, ids) {
    const a = ctx.actor; if (!a) throw bad('Memerlukan pelaku'); if (!Array.isArray(ids) || ids.length < 2) throw bad('Pilih minimal 2 batch');
    const bs = []; for (const id of ids) bs.push(await batchById(id));
    for (const b of bs) { if (b.ownerActorId !== a._id) throw forbid('Batch bukan milik Anda'); if (b.status === 'pending_verification') throw conflict(`${b.code} belum diverifikasi; tidak bisa digabung`); if (b.status !== 'available') throw conflict(`${b.code} tidak tersedia`); if (b.commodity !== bs[0].commodity) throw bad('Komoditas harus sama'); }
    const seqN = await seq('batch');
    const nb = await col.batches.insert({ code: `LP-BATCH-2026-${pad(seqN)}`, kind: 'merged', commodity: bs[0].commodity, weightKg: bs.reduce((s, b) => s + b.weightKg, 0), ownerActorId: a._id, status: 'available', parents: bs.map((b) => ({ batchId: b._id, weightKg: b.weightKg })), tainted: bs.some((b) => b.tainted), createdAt: now() });
    for (const b of bs) await col.batches.update({ _id: b._id }, { status: 'merged' });
    await emit(ctx, { type: 'LOT_MERGED', batch: nb, actor: a, payload: { parents: bs.map((b) => ({ code: b.code, weightKg: b.weightKg })), weightKg: nb.weightKg } });
    return nb;
  }

  // ---------- transfer ----------
  async function sendTransfer(ctx, d) {
    const a = ctx.actor; if (!a) throw bad('Memerlukan pelaku');
    const b = await batchById(d.batchId); if (b.ownerActorId !== a._id) throw forbid('Batch bukan milik Anda');
    if (b.status === 'pending_verification') throw conflict('Batch belum diverifikasi admin; tidak boleh dikirim');
    if (b.status !== 'available') throw conflict('Batch tidak tersedia untuk dikirim');
    if (b.tainted) throw conflict('Batch ditandai taint (turunan setoran yang ditolak); hubungi admin');
    const to = await col.actors.findOne({ _id: d.toActorId }); if (!to) throw bad('Penerima tidak ditemukan');
    const allowed = { pengepul: ['gudang'], gudang: ['distributor', 'retailer'], distributor: ['retailer'], retailer: [] }[a.role] || [];
    if (!allowed.includes(to.role)) throw bad(`${a.role} tidak dapat mengirim ke ${to.role}`);
    if (b.kind === 'deposit' || b.kind === 'merged') { if (a.role !== 'pengepul') throw bad('Gabah hanya bergerak dari pengepul ke gudang'); }
    if (a.role === 'gudang' && b.kind !== 'packaged') throw bad('Gudang/penggilingan hanya mengirim produk jadi (kemasan)');
    const viaException = a.role === 'gudang' && to.role === 'retailer';
    const s = await seq('transfer');
    const t = await col.transfers.insert({ code: `LP-TRF-${pad(s, 5)}`, batchId: b._id, fromActorId: a._id, toActorId: to._id, carrierActorId: d.carrierActorId || null, sentKg: b.weightKg, status: 'in_transit', sentAt: now(), sentByUser: ctx.user._id, note: d.note || '', viaException });
    await col.batches.update({ _id: b._id }, { status: 'in_transit' });
    await emit(ctx, { type: 'TRANSFER_SENT', batch: b, actor: a, payload: { transferId: t._id, to: to.name, sentKg: b.weightKg, viaException } });
    if (viaException) await anomaly('kirim_langsung_retailer', 'rendah', `${a.name} mengirim langsung ke retailer ${to.name} (pengecualian dicatat)`, { actorId: a._id, batchId: b._id });
    await notify({ toActorId: to._id, text: `Kiriman ${t.code} (${b.code}, ${b.weightKg} kg) dari ${a.name} menunggu konfirmasi Anda`, link: '#/terima' });
    return t;
  }
  async function confirmTransfer(ctx, id, receivedKg) {
    const a = ctx.actor; const t = await col.transfers.findOne({ _id: id }); if (!t) throw notFound('Transfer tidak ditemukan');
    if (t.toActorId !== a?._id) throw forbid('Bukan penerima transfer ini'); if (t.status !== 'in_transit') throw conflict('Transfer sudah diproses');
    if (t.sentByUser === ctx.user._id) throw conflict('Pengirim dan penerima tidak boleh pelaku yang sama (konfirmasi dua pihak)');
    const kg = +receivedKg; if (!(kg > 0)) throw bad('Berat terima wajib');
    const c = await cfg(); const variance = round(Math.abs(kg - t.sentKg) / t.sentKg * 100, 2); const b = await batchById(t.batchId); const from = await col.actors.findOne({ _id: t.fromActorId });
    const patch = { receivedKg: kg, variancePct: variance, receivedAt: now(), receivedByUser: ctx.user._id };
    if (variance > c.tolerancePct) {
      await col.transfers.update({ _id: id }, { ...patch, status: 'disputed' }); await col.batches.update({ _id: b._id }, { status: 'disputed' });
      await anomaly('selisih_berat', variance > 2 * c.tolerancePct ? 'tinggi' : 'sedang', `Selisih berat ${variance}% (${t.sentKg} → ${kg} kg) ${from.name} → ${a.name}`, { actorId: a._id, batchId: b._id });
      await emit(ctx, { type: 'TRANSFER_DISPUTED', batch: b, actor: a, payload: { transferId: id, sentKg: t.sentKg, receivedKg: kg, variancePct: variance }, anchor: true });
      await notify({ toRole: 'admin', text: `Sengketa transfer ${t.code}: selisih ${variance}% (toleransi ${c.tolerancePct}%)`, link: '#/sengketa' });
    } else await completeTransfer(ctx, t, b, a, kg, variance, 'received');
    return col.transfers.findOne({ _id: id });
  }
  async function completeTransfer(ctx, t, b, toActor, kg, variance, status) {
    await col.transfers.update({ _id: t._id }, { status, receivedKg: kg, variancePct: variance, receivedAt: t.receivedAt || now() });
    await col.batches.update({ _id: b._id }, { status: 'available', ownerActorId: toActor._id, weightKg: kg });
    await emit(ctx, { type: 'TRANSFER_CONFIRMED', batch: b, actor: toActor, payload: { transferId: t._id, fromActorId: t.fromActorId, toActorId: toActor._id, sentKg: t.sentKg, receivedKg: kg, variancePct: variance, resolved: status !== 'received' } });
  }
  async function resolveDispute(ctx, id, decision, note) {
    const t = await col.transfers.findOne({ _id: id }); if (!t || t.status !== 'disputed') throw conflict('Tidak ada sengketa terbuka');
    const b = await batchById(t.batchId); const to = await col.actors.findOne({ _id: t.toActorId });
    if (decision === 'accept') await completeTransfer(ctx, t, b, to, t.receivedKg, t.variancePct, 'resolved_accepted');
    else { await col.transfers.update({ _id: id }, { status: 'returned' }); await col.batches.update({ _id: b._id }, { status: 'available' }); await emit(ctx, { type: 'TRANSFER_RETURNED', batch: b, actor: { name: ctx.user.name, role: 'admin' }, payload: { transferId: id, note } }); }
    await audit(ctx, 'sengketa.' + decision, `${t.code} ${note || ''}`); return col.transfers.findOne({ _id: id });
  }
  async function carrierStep(ctx, id, step) {
    const t = await col.transfers.findOne({ _id: id }); if (!t) throw notFound('Transfer tidak ditemukan'); if (t.carrierActorId !== ctx.actor?._id) throw forbid('Bukan kiriman Anda');
    const b = await batchById(t.batchId);
    await emit(ctx, { type: step === 'pickup' ? 'CARRIER_PICKUP' : 'CARRIER_DELIVERED', batch: b, actor: ctx.actor, payload: { transferId: id } });
    await col.transfers.update({ _id: id }, { [step === 'pickup' ? 'pickedAt' : 'deliveredAt']: now() });
  }

  // ---------- gudang/penggilingan ----------
  async function ownBatch(ctx, id, roleReq) {
    const a = ctx.actor; if (!a || (roleReq && a.role !== roleReq)) throw forbid('Aksi tidak sesuai peran'); const b = await batchById(id);
    if (b.ownerActorId !== a._id) throw forbid('Batch bukan milik Anda'); return [a, b];
  }
  async function storeBatch(ctx, id, d) { const [a, b] = await ownBatch(ctx, id, 'gudang'); if (b.status !== 'available') throw conflict('Batch tidak tersedia'); await emit(ctx, { type: 'STORED', batch: b, actor: a, payload: { location: d.location || 'Gudang utama', note: d.note || '' } }); return b; }
  async function processBatch(ctx, id, d) {
    const [a, b] = await ownBatch(ctx, id, 'gudang'); if (b.status !== 'available') throw conflict('Batch tidak tersedia'); if (b.commodity !== 'gabah') throw bad('Hanya gabah yang bisa digiling');
    const out = +d.outputKg; if (!(out > 0) || out > b.weightKg) throw bad('Berat beras tidak valid'); const yieldPct = round(out / b.weightKg * 100);
    const s = await seq('batch'); const c = await cfg();
    const nb = await col.batches.insert({ code: `LP-BATCH-2026-${pad(s)}`, kind: 'processed', commodity: 'beras', weightKg: out, ownerActorId: a._id, status: 'available', parents: [{ batchId: b._id, weightKg: b.weightKg }], tainted: b.tainted, createdAt: now(), meta: { yieldPct, variety: d.variety || 'Pulen', selfReported: true } });
    await col.batches.update({ _id: b._id }, { status: 'processed' });
    await emit(ctx, { type: 'PROCESSED', batch: nb, actor: a, payload: { inputKg: b.weightKg, outputKg: out, yieldPct, selfReported: true, fromBatch: b.code } });
    if (yieldPct < c.yieldAlertPct) await anomaly('rendemen_rendah', 'tinggi', `Rendemen ${yieldPct}% di bawah batas ${c.yieldAlertPct}% (${a.name})`, { actorId: a._id, batchId: nb._id });
    return nb;
  }
  async function packBatch(ctx, id, d) {
    const [a, b] = await ownBatch(ctx, id, 'gudang'); if (b.status !== 'available' || b.kind !== 'processed') throw conflict('Pilih batch beras hasil giling yang tersedia');
    const size = +d.packKg || 5, qty = +d.qty; if (!(qty > 0) || qty * size > b.weightKg) throw bad(`Jumlah kemasan melebihi stok (${b.weightKg} kg)`);
    const s = await seq('batch'), p = await seq('pkg');
    const lot = `LP-PKG-2026-${pad(p, 4)}`;
    const nb = await col.batches.insert({ code: `LP-BATCH-2026-${pad(s)}`, kind: 'packaged', commodity: 'beras', weightKg: qty * size, ownerActorId: a._id, status: 'available', parents: [{ batchId: b._id, weightKg: qty * size }], tainted: b.tainted, createdAt: now(), meta: { lot, packKg: size, qty, product: d.product || 'Beras Premium Pulen', packedAt: ctx.at || now(), qrCode: lot } });
    const left = round(b.weightKg - qty * size, 2);
    await col.batches.update({ _id: b._id }, left > 0 ? { weightKg: left } : { weightKg: 0, status: 'consumed' });
    await emit(ctx, { type: 'PACKAGED', batch: nb, actor: a, payload: { lot, qty, packKg: size, product: nb.meta.product } });
    return nb;
  }

  // ---------- jejak publik ----------
  const EV_LABEL = { DEPOSIT_VERIFIED: 'Kelompok tani → pengepul', DEPOSIT_AUTO_ACCEPTED: 'Kelompok tani → pengepul', LOT_MERGED: 'Penggabungan batch', TRANSFER_CONFIRMED: 'Serah terima', STORED: 'Disimpan di gudang', PROCESSED: 'Digiling', PACKAGED: 'Dikemas', CARRIER_PICKUP: 'Diambil pengangkut', CARRIER_DELIVERED: 'Diantar pengangkut', TRANSFER_DISPUTED: 'Selisih berat dicatat', TRANSFER_RETURNED: 'Transfer dikembalikan' };
  async function trace(code) {
    code = String(code).trim();
    let b = await col.batches.findOne({ 'meta.lot': code }) || await col.batches.findOne({ code }) || await col.batches.findOne({ qrCode: code });
    if (!b) throw notFound('Kode tidak ditemukan');
    const anc = await ancestors(b); const ids = anc.map((x) => x._id);
    const evs = (await col.events.find({ batchId: { $in: ids } }, { sort: { at: 1 } })).filter((e) => EV_LABEL[e.type] || e.type === 'DEPOSIT_REJECTED');
    const comp = await composition(b); const actors = Object.fromEntries((await col.actors.find({})).map((x) => [x._id, x]));
    const steps = []; const hasStored = evs.some((e) => e.type === 'STORED'); const hasProc = evs.some((e) => e.type === 'PROCESSED');
    for (const e of evs) {
      const p = e.payload; let title = EV_LABEL[e.type] || e.type, detail = '', place = '';
      if (e.type.startsWith('DEPOSIT_')) { const g = await col.farmerGroups.findOne({ _id: p.farmerGroupId }); title = `${g?.name || 'Kelompok tani'} → pengepul`; detail = `${actors[p.pengepulId]?.name || e.actorName} · ${p.weightKg} kg · ${e.type === 'DEPOSIT_VERIFIED' ? 'diverifikasi admin, bukti tanda tangan terlampir' : 'diterima otomatis (sampling)'}`; place = g?.district || ''; }
      else if (e.type === 'LOT_MERGED') detail = `${p.parents.length} batch digabung · ${p.weightKg} kg`;
      else if (e.type === 'TRANSFER_CONFIRMED') { title = `${actors[p.fromActorId]?.name || '?'} → ${actors[p.toActorId]?.name || '?'}`; detail = `terima ${p.receivedKg} kg · selisih ${p.variancePct}%${p.resolved ? ' (diputuskan admin)' : ' (dalam toleransi), dikonfirmasi dua pihak'}`; place = actors[p.toActorId]?.district || ''; }
      else if (e.type === 'PROCESSED') { detail = `${e.actorName} · rendemen ${p.yieldPct}% · dicatat sendiri oleh penggilingan`; place = actors[e.actorId]?.district || ''; }
      else if (e.type === 'PACKAGED') detail = `${p.qty} kemasan × ${p.packKg} kg · lot ${p.lot}`;
      else if (e.type === 'STORED') detail = `${e.actorName} · ${p.location}`;
      else if (e.type === 'DEPOSIT_REJECTED') { title = 'Setoran ditolak admin'; detail = p.reason; }
      else detail = e.actorName;
      steps.push({ resolved: !!p.resolved, at: e.at, title, detail, place, type: e.type, anchored: e.anchorStatus === 'confirmed', onBehalf: e.origin === 'superadmin' ? `dicatat administrator atas nama ${actors[e.onBehalfOfActorId]?.name || 'pelaku'}` : null });
    }
    const gaps = []; if (hasProc && !hasStored) { const g = { title: 'Penyimpanan gudang belum tercatat', detail: 'Tahap ini tidak ada datanya; celah ditampilkan, tidak disambung otomatis.' }; gaps.push(g); const i = steps.findIndex((x) => x.type === 'PROCESSED'); steps.splice(i < 0 ? steps.length : i, 0, { ...g, gap: true, at: steps[Math.max(0, i - 1)]?.at }); }
    const anchored = await col.events.find({ batchId: { $in: ids }, anchorStatus: 'confirmed' }); let ok = 0;
    for (const e of anchored) { const l = await ledger.lookup(e._id); if (l && l.hash === eventHash(e)) ok++; }
    const holder = actors[b.ownerActorId]; const top = (await col.events.find({ batchId: b._id, anchorStatus: 'confirmed' }, { sort: { at: -1 }, limit: 1 }))[0];
    return { product: b.meta?.product || (b.commodity === 'beras' ? 'Beras' : 'Gabah'), lot: b.meta?.lot || b.code, batchCode: b.code, kind: b.kind, packedAt: b.meta?.packedAt, packKg: b.meta?.packKg, qty: b.meta?.qty, holder: holder ? { name: holder.name, role: holder.role, district: holder.district } : null, status: b.status, tainted: b.tainted, composition: comp.map((c) => ({ name: c.name, district: c.district, pct: c.pct, lat: +c.lat.toFixed(2), lng: +c.lng.toFixed(2), verifiedPct: round(c.verified / c.share * 100, 0), autoPct: round(c.auto / c.share * 100, 0) })), steps, gaps, integrity: { network: ledger.network, events: anchored.length, verified: ok, chainOk: (await ledger.verifyChain()).ok, lastTx: top?.anchor?.txId, lastBlock: top?.anchor?.block } };
  }

  // ---------- batch detail ----------
  async function batchDetail(ctx, id) {
    const b = await batchById(id); const anc = await ancestors(b);
    const events = await col.events.find({ batchId: { $in: anc.map((x) => x._id) } }, { sort: { at: 1 } });
    return { batch: b, composition: await composition(b), parents: anc.filter((x) => x._id !== b._id).map((x) => ({ _id: x._id, code: x.code, kind: x.kind, weightKg: x.weightKg, status: x.status })), events, hasStored: events.some((e) => e.type === 'STORED' && e.batchId === b._id) };
  }
  const _ = { checkPassword, hashPassword };
  return { col, cfg, seq, audit, notify, emit, processOutbox, integrity, anomaly, createGroup, rotateGroupCode, publicGroup, pengepulGroups, issueLabels, createDeposit, decideDeposit, mergeBatches, sendTransfer, confirmTransfer, resolveDispute, carrierStep, storeBatch, processBatch, packBatch, trace, batchDetail, composition, ancestors, batchById, eventHash, HttpError, bad, forbid, notFound, conflict, round, now, _ };
};
