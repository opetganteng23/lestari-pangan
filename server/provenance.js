// Fase 2 — Verifiable Traceability: lineage hulu/hilir, pemeriksaan integritas per batch, Digital Product Passport.
const crypto = require('crypto');
const ledger = require('./ledger/index');

module.exports = function createProvenance(D) {
  const { col, round, notFound } = D;

  // Tingkat verifikasi per jenis event. Dinyatakan apa adanya; hash valid tidak menjamin fakta fisik.
  const LEVEL = {
    DEPOSIT_VERIFIED: ['verified_admin', 'Diverifikasi admin (foto timbangan & nota bertanda tangan)'],
    DEPOSIT_AUTO_ACCEPTED: ['sampling', 'Diterima otomatis lewat sampling, tidak diperiksa admin'],
    TRANSFER_CONFIRMED: ['two_party', 'Dikonfirmasi pengirim dan penerima'],
    TRANSFER_DISPUTED: ['disputed', 'Selisih berat menunggu keputusan admin'],
    LOT_MERGED: ['system', 'Dicatat sistem dari batch yang sudah tercatat'],
    STORED: ['self_reported', 'Dicatat sendiri oleh pelaku, belum ada pemeriksa independen'],
    PROCESSED: ['self_reported', 'Dicatat sendiri oleh penggilingan, belum ada pemeriksa independen'],
    PACKAGED: ['self_reported', 'Dicatat sendiri oleh pelaku, belum ada pemeriksa independen'],
    CARRIER_PICKUP: ['carrier_reported', 'Dicatat pengangkut'],
    CARRIER_DELIVERED: ['carrier_reported', 'Dicatat pengangkut'],
    DEPOSIT_REJECTED: ['rejected', 'Ditolak admin'],
    TRANSFER_RETURNED: ['system', 'Dicatat sistem'],
  };
  function levelOf(step) {
    if (step.gap) return { level: 'missing', label: 'Tahap tidak tercatat' };
    if (step.type === 'TRANSFER_CONFIRMED' && step.resolved) return { level: 'admin_resolved', label: 'Selisih diputuskan admin' };
    const l = LEVEL[step.type]; return l ? { level: l[0], label: l[1] } : { level: 'unknown', label: 'Belum dikategorikan' };
  }

  async function descendants(batch) {
    const out = new Map(); const q = [batch._id]; const all = await col.batches.find({});
    while (q.length) { const id = q.shift(); for (const b of all) if (!out.has(b._id) && b.parents.some((p) => p.batchId === id)) { out.set(b._id, b); q.push(b._id); } }
    return [...out.values()];
  }

  // Garis keturunan: ke hulu (induk) dan ke hilir (turunan + penerima yang tercatat).
  async function lineage(batchId) {
    const b = await D.batchById(batchId); const actors = Object.fromEntries((await col.actors.find({})).map((a) => [a._id, a]));
    const up = (await D.ancestors(b)).filter((x) => x._id !== b._id); const down = await descendants(b);
    const slim = (x) => ({ _id: x._id, code: x.code, kind: x.kind, commodity: x.commodity, weightKg: x.weightKg, status: x.status, owner: actors[x.ownerActorId]?.name || null, parents: x.parents.map((p) => p.batchId) });
    const ids = [b._id, ...down.map((d) => d._id)];
    const trs = (await col.transfers.find({})).filter((t) => ids.includes(t.batchId));
    const recipients = trs.map((t) => ({ transferCode: t.code, batchId: t.batchId, from: actors[t.fromActorId]?.name, to: actors[t.toActorId]?.name, toRole: actors[t.toActorId]?.role, status: t.status, sentKg: t.sentKg, receivedKg: t.receivedKg ?? null, sentAt: t.sentAt }));
    const holders = down.concat([b]).filter((x) => ['available', 'in_transit', 'disputed'].includes(x.status)).map((x) => ({ batch: x.code, holder: actors[x.ownerActorId]?.name, role: actors[x.ownerActorId]?.role, weightKg: x.weightKg, status: x.status }));
    return { batch: slim(b), upstream: up.map(slim), downstream: down.map(slim), recipients, holders, tainted: !!b.tainted || up.some((x) => x.tainted) };
  }

  // Periksa hash setiap event di sepanjang lineage (hulu + hilir) terhadap data tersimpan dan ledger.
  async function verifyBatch(batchId) {
    const b = await D.batchById(batchId); const rel = [b, ...(await D.ancestors(b)).filter((x) => x._id !== b._id), ...(await descendants(b))];
    const ids = [...new Set(rel.map((x) => x._id))]; const evs = await col.events.find({ batchId: { $in: ids } }, { sort: { at: 1 } });
    const items = []; const sum = { ok: 0, tampered: 0, ledger_mismatch: 0, not_in_ledger: 0, unanchored: 0, not_required: 0 };
    for (const e of evs) {
      let status;
      if (e.hash !== D.eventHash(e)) status = 'tampered';
      else if (e.anchorStatus === 'not_required') status = 'not_required';
      else if (e.anchorStatus !== 'confirmed') status = 'unanchored';
      else { const l = await ledger.lookup(e._id); status = !l ? 'not_in_ledger' : l.hash !== e.hash ? 'ledger_mismatch' : 'ok'; }
      sum[status]++; items.push({ eventId: e._id, type: e.type, batchCode: e.batchCode, at: e.at, status, txId: e.anchor?.txId || null, block: e.anchor?.block || null });
    }
    const chain = await ledger.verifyChain(); const ok = !sum.tampered && !sum.ledger_mismatch && !sum.not_in_ledger && chain.ok;
    return { batch: b.code, network: ledger.network, simulated: !!ledger.simulated, checked: items.length, summary: sum, chain, ok, items,
      note: 'Hash yang cocok hanya membuktikan catatan tidak berubah sejak dicatat, bukan bahwa kejadian fisiknya benar.' };
  }

  // Digital Product Passport: jejak publik + tingkat verifikasi per tahap + keterbatasan data.
  async function passport(code) {
    const t = await D.trace(code); const lim = [];
    const steps = t.steps.map((s) => ({ ...s, verification: levelOf(s) }));
    const self = steps.filter((s) => s.verification.level === 'self_reported').length;
    const samp = steps.filter((s) => s.verification.level === 'sampling').length;
    lim.push('Rantai tercatat dimulai dari serah terima di pengepul, bukan dari sawah. Asal di hulu didukung kode ketua kelompok, foto timbangan, dan nota.');
    if (samp) lim.push(`${samp} setoran diterima lewat sampling dan tidak diperiksa admin satu per satu.`);
    if (self) lim.push(`${self} tahap dicatat sendiri oleh pelaku tanpa pemeriksa independen (penyimpanan, penggilingan, pengemasan).`);
    if (t.gaps?.length) lim.push(`${t.gaps.length} tahap tidak tercatat dan ditampilkan sebagai celah, tidak disambung otomatis.`);
    if (t.tainted) lim.push('Sebagian rantai berasal dari setoran yang ditolak verifikasi.');
    if (ledger.simulated) lim.push('Pencatatan integritas memakai ledger simulasi lokal, bukan blockchain publik.');
    lim.push('Halaman ini tidak menyatakan sertifikasi mutu, keamanan pangan, atau klaim organik.');
    // info recall: hanya yang sudah dipublikasikan oleh keputusan manusia berwenang
    const rb = (await col.batches.findOne({ 'meta.lot': code })) || (await col.batches.findOne({ code })) || (await col.batches.findOne({ qrCode: code }));
    const ids = rb ? (await D.ancestors(rb)).map((x) => x._id) : []; let recall = null;
    const pub = (await col.cases.find({})).filter((c) => c.decisions.some((d) => d.action === 'recall' && d.scopeIds.some((i) => ids.includes(i))) && c.decisions.some((d) => d.action === 'publish_recall'));
    if (pub.length) { recall = { published: true, notes: pub.map((c) => { const d = c.decisions.filter((x) => x.action === 'publish_recall').pop(); return { text: d.publicNote, at: d.at }; }) }; lim.unshift('Ada pemberitahuan penarikan (recall) untuk produk ini. Baca pemberitahuan di bagian atas halaman.'); }
    const levels = {}; for (const s of steps) levels[s.verification.level] = (levels[s.verification.level] || 0) + 1;
    return { ...t, steps, verificationSummary: levels, limitations: lim, ledger: { network: ledger.network, simulated: !!ledger.simulated }, recall, generatedAt: D.now() };
  }

  // Catat pemindaian publik; tanda bila satu lot dipindai tak wajar. Sinyal risiko, bukan bukti pemalsuan.
  async function recordScan(code, ip) {
    let b; try { b = (await col.batches.findOne({ 'meta.lot': code })) || (await col.batches.findOne({ code })) || (await col.batches.findOne({ qrCode: code })); } catch { return; }
    if (!b) return; const day = D.now().slice(0, 10);
    const visitor = crypto.createHash('sha256').update(`${ip}|${day}`).digest('hex').slice(0, 12);
    await col.scans.insert({ batchId: b._id, code, day, visitor, at: D.now() });
    const c = await D.cfg(); const limit = c.scanAlertPerDay || 100;
    const today = await col.scans.count({ batchId: b._id, day });
    if (today > limit && !(await col.anomalies.findOne({ type: 'scan_berulang', batchId: b._id, day }))) {
      await D.anomaly('scan_berulang', 'rendah', `Kode ${code} dipindai ${today} kali hari ini (ambang ${limit}). Perlu ditinjau; bisa wajar (promo/pajangan) atau tanda penyalinan QR.`, { batchId: b._id, day });
    }
  }
  async function scanStats(batchId) { const all = await col.scans.find({ batchId }); return { total: all.length, visitors: new Set(all.map((s) => s.day + s.visitor)).size, lastAt: all.map((s) => s.at).sort().pop() || null }; }

  return { lineage, verifyBatch, passport, recordScan, scanStats, levelOf };
};
