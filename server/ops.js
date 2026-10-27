// Fase 3 — Operational Intelligence: kasus & recall, neraca massa, ekspor, antrean email.
const crypto = require('crypto');

module.exports = function createOps(D) {
  const { col, bad, forbid, notFound, conflict, round, now } = D;
  const SLA_H = { tinggi: 24, sedang: 72, rendah: 168 };
  const pad = (n, w = 4) => String(n).padStart(w, '0');

  // ================= KASUS (Investigation Workspace + Smart Recall) =================
  const ACTIONS = ['dismiss', 'monitor', 'hold', 'release', 'recall', 'publish_recall', 'close_no_action'];
  async function createCase(ctx, d, auto = false) {
    const title = String(d.title || '').trim(); if (title.length < 4) throw bad('Judul kasus minimal 4 karakter');
    const priority = ['rendah', 'sedang', 'tinggi'].includes(d.priority) ? d.priority : 'sedang';
    const type = ['anomali', 'sengketa', 'batch', 'recall', 'lainnya'].includes(d.type) ? d.type : 'lainnya';
    let batch = null; if (d.batchId) batch = await D.batchById(d.batchId);
    const n = await D.seq('case'); const t = now();
    const c = await col.cases.insert({ code: `CASE-2026-${pad(n)}`, title, type, priority, status: 'open', batchId: batch?._id || null, batchCode: batch?.code || null, anomalyId: d.anomalyId || null, transferId: d.transferId || null,
      assigneeUserId: null, assigneeName: null, createdAt: t, createdBy: auto ? 'sistem' : ctx.user?.name, auto, dueAt: new Date(Date.now() + SLA_H[priority] * 3600e3).toISOString(), closedAt: null, decisions: [], evidence: [],
      timeline: [{ at: t, by: auto ? 'sistem' : ctx.user?.name, kind: 'created', text: d.description || (auto ? 'Dibuat otomatis dari anomali/sengketa' : 'Kasus dibuat') }] });
    if (!auto) await D.audit(ctx, 'kasus.buat', c.code); await D.notify({ toRole: 'admin', text: `Kasus baru ${c.code}: ${title} (prioritas ${priority})`, link: '#/kasus/' + c._id });
    return c;
  }
  async function caseById(id) { const c = await col.cases.findOne({ _id: id }); if (!c) throw notFound('Kasus tidak ditemukan'); return c; }
  const push = async (c, ctx, kind, text, extra = {}) => { const tl = [...c.timeline, { at: now(), by: ctx.user?.name || 'sistem', kind, text, ...extra }]; await col.cases.update({ _id: c._id }, { timeline: tl }); c.timeline = tl; };

  async function addNote(ctx, id, text) { const c = await caseById(id); if (c.status === 'closed') throw conflict('Kasus sudah ditutup'); text = String(text || '').trim(); if (text.length < 3) throw bad('Catatan terlalu pendek'); await push(c, ctx, 'note', text); return caseById(id); }
  async function setStatus(ctx, id, status) {
    const c = await caseById(id); if (!['open', 'investigating', 'awaiting_decision'].includes(status)) throw bad('Status tidak valid'); if (c.status === 'closed') throw conflict('Kasus sudah ditutup');
    await col.cases.update({ _id: id }, { status }); await push(c, ctx, 'status', `Status: ${c.status} → ${status}`); await D.audit(ctx, 'kasus.status', `${c.code} ${status}`); return caseById(id);
  }
  async function assign(ctx, id, userId) {
    const c = await caseById(id); const u = await col.users.findOne({ _id: userId }); if (!u || !['admin', 'pengawas', 'superadmin'].includes(u.role)) throw bad('Penanggung jawab harus admin atau pengawas');
    await col.cases.update({ _id: id }, { assigneeUserId: u._id, assigneeName: u.name }); await push(c, ctx, 'assign', `Penanggung jawab: ${u.name}`); await D.audit(ctx, 'kasus.tugaskan', `${c.code} → ${u.email}`); return caseById(id);
  }
  async function addEvidence(ctx, id, label, ref) { const c = await caseById(id); label = String(label || '').trim(); if (!label) throw bad('Label bukti wajib'); const ev = [...c.evidence, { at: now(), by: ctx.user.name, label, ref: String(ref || '') }]; await col.cases.update({ _id: id }, { evidence: ev }); await push(c, ctx, 'evidence', label); return caseById(id); }

  // cakupan dampak: batch + hilir, penerima, bobot
  async function impact(id) {
    const c = await caseById(id); if (!c.batchId) return { scope: [], recipients: [], totalKg: 0, note: 'Kasus tidak terkait batch.' };
    const l = await D.prov.lineage(c.batchId); const scope = [l.batch, ...l.downstream];
    return { scope: scope.map((b) => ({ _id: b._id, code: b.code, kind: b.kind, weightKg: b.weightKg, status: b.status, owner: b.owner })), recipients: l.recipients, holders: l.holders, totalKg: round(scope.reduce((s, b) => s + b.weightKg, 0), 1),
      note: 'Cakupan dihitung dari lineage yang tercatat. Pihak yang tidak tercatat di sistem tidak termasuk.' };
  }
  // Keputusan hanya oleh manusia berwenang (admin/superadmin), butuh alasan, tidak bisa dihapus.
  async function decide(ctx, id, d) {
    const c = await caseById(id); if (c.status === 'closed') throw conflict('Kasus sudah ditutup');
    if (!ACTIONS.includes(d.action)) throw bad('Tindakan tidak valid'); const reason = String(d.reason || '').trim(); if (reason.length < 10) throw bad('Alasan keputusan minimal 10 karakter');
    let scopeIds = [];
    if (['hold', 'recall'].includes(d.action)) {
      if (!c.batchId) throw bad('Penahanan butuh kasus yang terkait batch'); const im = await impact(id); scopeIds = im.scope.map((b) => b._id);
      for (const bid of scopeIds) await col.batches.update({ _id: bid }, { hold: { caseId: c._id, caseCode: c.code, at: now(), reason, recall: d.action === 'recall' } });
    }
    if (d.action === 'release') { for (const b of await col.batches.find({})) if (b.hold && b.hold.caseId === c._id) { scopeIds.push(b._id); await col.batches.update({ _id: b._id }, { hold: null }); } }
    let publicNote = null;
    if (d.action === 'publish_recall') {
      if (!c.decisions.some((x) => x.action === 'recall')) throw conflict('Publikasi recall butuh keputusan recall lebih dulu'); publicNote = String(d.publicNote || '').trim(); if (publicNote.length < 10) throw bad('Teks publik minimal 10 karakter');
    }
    const dec = { id: 'dec_' + crypto.randomBytes(4).toString('hex'), at: now(), by: ctx.user.name, action: d.action, reason, scopeIds, publicNote, approvedBy: ctx.user.name, viaMode: ctx.act ? 'mode_tindak' : 'langsung' };
    const patch = { decisions: [...c.decisions, dec] }; if (d.action === 'dismiss' || d.action === 'close_no_action') { patch.status = 'closed'; patch.closedAt = now(); }
    await col.cases.update({ _id: id }, patch); await push(c, ctx, 'decision', `${d.action}: ${reason}`); await D.audit(ctx, 'kasus.keputusan', `${c.code} ${d.action}`);
    if (scopeIds.length) await D.notify({ toRole: 'admin', text: `Keputusan ${d.action} pada ${c.code} memengaruhi ${scopeIds.length} batch`, link: '#/kasus/' + c._id });
    return caseById(id);
  }
  async function closeCase(ctx, id, summary) {
    const c = await caseById(id); if (c.status === 'closed') throw conflict('Sudah ditutup'); if (!c.decisions.length) throw conflict('Kasus butuh minimal satu keputusan sebelum ditutup');
    if (await col.batches.findOne({ 'hold.caseId': c._id })) throw conflict('Masih ada batch yang ditahan oleh kasus ini; lepas dulu dengan keputusan "release"');
    await col.cases.update({ _id: id }, { status: 'closed', closedAt: now() }); await push(c, ctx, 'status', 'Kasus ditutup: ' + (summary || '-')); await D.audit(ctx, 'kasus.tutup', c.code); return caseById(id);
  }
  const sla = (c) => { if (c.status === 'closed') return 'selesai'; const left = new Date(c.dueAt) - Date.now(); return left < 0 ? 'terlambat' : left < 6 * 3600e3 ? 'mendekati' : 'aman'; };
  async function listCases(q = {}) {
    let all = await col.cases.find({}, { sort: { createdAt: -1 } }); if (q.status) all = all.filter((c) => c.status === q.status); if (q.priority) all = all.filter((c) => c.priority === q.priority);
    return all.map((c) => ({ ...c, sla: sla(c), ageHours: round((Date.now() - new Date(c.createdAt)) / 3600e3, 0) }));
  }
  // papan risiko: anomali + keterkaitan kasus. Urgensi operasional, bukan dugaan pelanggaran.
  async function risk() {
    const an = await col.anomalies.find({}, { sort: { at: -1 }, limit: 200 }); const cs = await col.cases.find({});
    const W = { tinggi: 3, sedang: 2, rendah: 1 };
    return an.map((a) => { const c = cs.find((x) => x.anomalyId === a._id || (x.auto && x.batchId && x.batchId === a.batchId && x.type === 'anomali')); const age = (Date.now() - new Date(a.at)) / 3600e3;
      return { ...a, caseId: c?._id || null, caseCode: c?.code || null, caseStatus: c?.status || null, assignee: c?.assigneeName || null, sla: c ? sla(c) : null, urgency: W[a.severity] * 10 + Math.min(20, Math.floor(age / 12)), why: `Tingkat ${a.severity}; ${a.resolved ? 'sudah selesai' : 'belum selesai'} ${round(age, 0)} jam. Skor menunjukkan urgensi operasional, bukan dugaan kecurangan.`, evidence: a.batchId ? 'batch ' + a.batchId : 'lihat log' }; }).sort((x, y) => (x.resolved - y.resolved) || y.urgency - x.urgency);
  }
  D.hooks.anomaly = async (a) => { if (a.severity === 'tinggi' && a.batchId) await createCase({}, { title: a.text.slice(0, 120), type: 'anomali', priority: 'tinggi', batchId: a.batchId, anomalyId: a._id }, true); };
  D.hooks.dispute = async (t, variance, b) => { await createCase({}, { title: `Sengketa transfer ${t.code}: selisih ${variance}%`, type: 'sengketa', priority: variance > 6 ? 'tinggi' : 'sedang', batchId: b._id, transferId: t._id }, true); };

  // ================= NERACA MASSA =================
  async function massBalanceList(ctx) {
    const as = Object.fromEntries((await col.actors.find({})).map((a) => [a._id, a]));
    let bs = (await col.batches.find({ kind: 'processed' })); if (ctx.actor && ctx.role === 'gudang') bs = bs.filter((b) => b.ownerActorId === ctx.actor._id);
    const cors = await col.corrections.find({});
    const rows = bs.map((b) => { const p = b.parents[0]; const mb = b.meta?.mb || { status: 'incomplete' };
      return { batchId: b._id, batchCode: b.code, owner: as[b.ownerActorId]?.name, inputKg: p?.weightKg, outputKg: b.weightKg, yieldPct: b.meta?.yieldPct, weightSource: b.meta?.weightSource || 'manual', ...mb, corrections: cors.filter((c) => c.batchId === b._id).length,
        formula: 'selisih = input − (output utama + produk samping + susut)', createdAt: b.createdAt }; });
    const c = await D.cfg();
    return { toleranceNote: `Ambang ${c.massBalanceTolerancePct}% dari input adalah konfigurasi operasional, bukan standar universal.`, rows, review: rows.filter((r) => r.status === 'review').length, incomplete: rows.filter((r) => r.status === 'incomplete').length };
  }
  async function correctMassBalance(ctx, batchId, d) {
    const b = await D.batchById(batchId); if (b.kind !== 'processed') throw bad('Bukan batch hasil giling');
    if (!(ctx.role === 'admin' || ctx.role === 'superadmin' || (ctx.role === 'gudang' && ctx.actor && b.ownerActorId === ctx.actor._id))) throw forbid('Tidak berhak mengoreksi batch ini');
    const reason = String(d.reason || '').trim(); if (reason.length < 10) throw bad('Alasan koreksi minimal 10 karakter');
    const old = b.meta?.mb || {}; const input = b.parents[0].weightKg; const c = await D.cfg();
    const mb = D.massBalance(input, b.weightKg, d.byproductKg, d.shrinkKg, c.massBalanceTolerancePct); if (mb.error) throw bad(mb.error);
    if (mb.status === 'incomplete') throw bad('Isi produk samping dan/atau susut');
    await col.corrections.insert({ batchId, batchCode: b.code, at: now(), by: ctx.user.name, reason, before: { byproductKg: old.byproductKg ?? null, shrinkKg: old.shrinkKg ?? null, status: old.status || 'incomplete' }, after: { byproductKg: mb.byproductKg, shrinkKg: mb.shrinkKg, status: mb.status } });
    await col.batches.update({ _id: batchId }, { meta: { ...b.meta, mb } });
    const owner = await col.actors.findOne({ _id: b.ownerActorId }); await D.emit(ctx, { type: 'MASSBALANCE_CORRECTED', batch: b, actor: owner, payload: { reason, byproductKg: mb.byproductKg, shrinkKg: mb.shrinkKg, unexplainedKg: mb.unexplainedKg, status: mb.status } });
    await D.audit(ctx, 'neraca.koreksi', `${b.code}: ${reason}`); return { ok: true, mb };
  }
  const corrections = (batchId) => col.corrections.find(batchId ? { batchId } : {}, { sort: { at: -1 } });

  // ================= EKSPOR CSV =================
  const cell = (v) => { if (v === null || v === undefined) return ''; let s = typeof v === 'object' ? JSON.stringify(v) : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCsv = (cols, rows) => '﻿' + [cols.map((c) => c[1]).join(','), ...rows.map((r) => cols.map((c) => cell(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(','))].join('\r\n') + '\r\n';
  const inRange = (t, q) => (!q.from || t >= q.from) && (!q.to || t <= q.to + 'T23:59:59.999Z');
  const EXPORTS = {
    setoran: { title: 'Rekap setoran', roles: ['admin', 'pengawas'], async rows(ctx, q) { const as = Object.fromEntries((await col.actors.find({})).map((a) => [a._id, a])), gs = Object.fromEntries((await col.farmerGroups.find({})).map((g) => [g._id, g])); return (await col.deposits.find({})).filter((d) => inRange(d.createdAt, q)).map((d) => ({ ...d, pengepul: as[d.actorId]?.name, kelompok: gs[d.farmerGroupId]?.name })); },
      cols: [['createdAt', 'Waktu'], ['kelompok', 'Kelompok tani'], ['pengepul', 'Pengepul'], ['weightKg', 'Berat (kg)'], ['notaNo', 'No. nota'], ['status', 'Status'], ['checkMode', 'Mode periksa'], ['checkReason', 'Alasan periksa']] },
    transfer: { title: 'Rekap transfer', roles: ['admin', 'pengawas'], async rows(ctx, q) { const as = Object.fromEntries((await col.actors.find({})).map((a) => [a._id, a])), bs = Object.fromEntries((await col.batches.find({})).map((b) => [b._id, b])); return (await col.transfers.find({})).filter((t) => inRange(t.sentAt, q)).map((t) => ({ ...t, dari: as[t.fromActorId]?.name, ke: as[t.toActorId]?.name, batch: bs[t.batchId]?.code })); },
      cols: [['code', 'Kode'], ['batch', 'Batch'], ['dari', 'Dari'], ['ke', 'Ke'], ['sentAt', 'Dikirim'], ['sentKg', 'Kirim (kg)'], ['receivedKg', 'Terima (kg)'], ['variancePct', 'Selisih (%)'], ['status', 'Status']] },
    batch: { title: 'Laporan batch & lineage', roles: ['admin', 'pengawas'], async rows(ctx, q) { const as = Object.fromEntries((await col.actors.find({})).map((a) => [a._id, a])), bs = Object.fromEntries((await col.batches.find({})).map((b) => [b._id, b])); return (await col.batches.find({})).filter((b) => inRange(b.createdAt, q)).map((b) => ({ ...b, pemilik: as[b.ownerActorId]?.name, induk: b.parents.map((p) => bs[p.batchId]?.code).join(' + '), ditahan: b.hold ? b.hold.caseCode : '' })); },
      cols: [['code', 'Kode'], ['kind', 'Jenis'], ['commodity', 'Komoditas'], ['weightKg', 'Berat (kg)'], ['status', 'Status'], ['pemilik', 'Pemilik'], ['induk', 'Induk'], ['tainted', 'Taint'], ['ditahan', 'Ditahan kasus'], ['createdAt', 'Dibuat']] },
    massbalance: { title: 'Laporan neraca massa', roles: ['admin', 'pengawas', 'gudang'], async rows(ctx) { return (await massBalanceList(ctx)).rows; },
      cols: [['batchCode', 'Batch'], ['owner', 'Penggilingan'], ['inputKg', 'Input (kg)'], ['outputKg', 'Output utama (kg)'], ['byproductKg', 'Produk samping (kg)'], ['shrinkKg', 'Susut (kg)'], ['unexplainedKg', 'Belum terjelaskan (kg)'], ['unexplainedPct', 'Belum terjelaskan (%)'], ['yieldPct', 'Rendemen (%)'], ['weightSource', 'Sumber berat'], ['status', 'Status']] },
    sengketa: { title: 'Laporan sengketa', roles: ['admin', 'pengawas'], async rows(ctx, q) { return (await listCases()).filter((c) => c.type === 'sengketa' && inRange(c.createdAt, q)); },
      cols: [['code', 'Kasus'], ['title', 'Judul'], ['priority', 'Prioritas'], ['status', 'Status'], ['sla', 'SLA'], ['createdAt', 'Dibuat'], ['closedAt', 'Ditutup']] },
    anomali: { title: 'Laporan anomali & tindak lanjut', roles: ['admin', 'pengawas'], async rows(ctx, q) { return (await risk()).filter((a) => inRange(a.at, q)); },
      cols: [['at', 'Waktu'], ['type', 'Jenis'], ['severity', 'Tingkat'], ['text', 'Uraian'], ['resolved', 'Selesai'], ['caseCode', 'Kasus'], ['assignee', 'PIC'], ['sla', 'SLA']] },
    kasus: { title: 'Laporan investigasi/recall', roles: ['admin', 'pengawas'], async rows(ctx, q) { return (await listCases()).filter((c) => inRange(c.createdAt, q)).map((c) => ({ ...c, keputusan: c.decisions.map((d) => d.action).join(' > ') })); },
      cols: [['code', 'Kasus'], ['title', 'Judul'], ['type', 'Jenis'], ['priority', 'Prioritas'], ['status', 'Status'], ['assigneeName', 'PIC'], ['keputusan', 'Keputusan'], ['createdAt', 'Dibuat'], ['closedAt', 'Ditutup']] },
    integritas: { title: 'Laporan integritas', roles: ['admin', 'pengawas'], async rows(ctx, q) { return (await col.events.find({})).filter((e) => inRange(e.at, q)).map((e) => ({ ...e, tx: e.anchor?.txId || '' })); },
      cols: [['at', 'Waktu'], ['type', 'Jenis'], ['batchCode', 'Batch'], ['anchorStatus', 'Status anchor'], ['tx', 'Tx'], ['hash', 'Hash']] },
    audit: { title: 'Audit log', roles: ['admin', 'pengawas'], async rows(ctx, q) { return (await col.auditLogs.find({}, { sort: { at: -1 }, limit: 5000 })).filter((a) => inRange(a.at, q)); }, cols: [['at', 'Waktu'], ['userName', 'Pengguna'], ['role', 'Peran'], ['action', 'Aksi'], ['detail', 'Detail']] },
  };
  async function exportCsv(ctx, kind, q = {}) {
    const ex = EXPORTS[kind]; if (!ex) throw notFound('Jenis laporan tidak dikenal'); if (!ex.roles.includes(ctx.role) && ctx.role !== 'superadmin') throw forbid('Peran Anda tidak boleh mengekspor laporan ini');
    const rows = await ex.rows(ctx, q); const filter = { from: q.from || null, to: q.to || null };
    await col.exportsLog.insert({ kind, by: ctx.user.name, role: ctx.role, at: now(), filter, rows: rows.length, version: '1.0' }); await D.audit(ctx, 'ekspor', `${kind} ${rows.length} baris`);
    return { filename: `lestaripangan-${kind}-${now().slice(0, 10)}.csv`, csv: toCsv(ex.cols, rows), rows: rows.length };
  }

  // ================= EMAIL (antrean, retry, status) =================
  const mailer = require('./mailer');
  async function recipientsOf(n) {
    const us = (await col.users.find({})).filter((u) => u.active !== false && u.email);
    if (n.toActorId) return us.filter((u) => u.actorId === n.toActorId);
    if (n.toGroupId) return us.filter((u) => u.groupId === n.toGroupId);
    if (n.toRole) return us.filter((u) => u.role === n.toRole || (n.toRole === 'admin' && u.role === 'superadmin'));
    return [];
  }
  async function enqueueEmails(n) {
    for (const u of await recipientsOf(n)) {
      const key = `${n._id}:${u.email}`; if (await col.emails.findOne({ key })) continue; // idempoten
      await col.emails.insert({ key, notificationId: n._id, to: u.email, toName: u.name, subject: '[LestariPangan] Pemberitahuan', text: `${n.text}\n\nBuka aplikasi untuk detail${n.link ? ' (' + n.link + ')' : ''}.`, status: 'pending', attempts: 0, nextAt: now(), createdAt: now(), lastError: null });
    }
  }
  D.hooks.email = enqueueEmails;
  async function processEmails(limit = 20) {
    let sent = 0; const due = (await col.emails.find({ status: 'pending' })).filter((e) => e.nextAt <= now()).slice(0, limit);
    for (const e of due) {
      try { await (D.mailer || mailer).send({ to: e.to, subject: e.subject, text: e.text }); await col.emails.update({ _id: e._id }, { status: 'sent', sentAt: now(), attempts: e.attempts + 1, lastError: null }); sent++; }
      catch (err) { const attempts = e.attempts + 1; await col.emails.update({ _id: e._id }, attempts >= 5 ? { status: 'dead', attempts, lastError: String(err.message).slice(0, 200) } : { attempts, lastError: String(err.message).slice(0, 200), nextAt: new Date(Date.now() + 2 ** attempts * 60000).toISOString() }); }
    }
    return { processed: due.length, sent };
  }
  async function retryEmail(id) { const e = await col.emails.findOne({ _id: id }); if (!e) throw notFound('Email tidak ditemukan'); if (e.status === 'sent') throw conflict('Sudah terkirim'); await col.emails.update({ _id: id }, { status: 'pending', attempts: 0, nextAt: now() }); return { ok: true }; }

  return { createCase, caseById, addNote, setStatus, assign, addEvidence, impact, decide, closeCase, listCases, risk, massBalanceList, correctMassBalance, corrections, exportCsv, EXPORTS, processEmails, retryEmail, enqueueEmails, sla };
};
