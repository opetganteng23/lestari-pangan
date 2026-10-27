// Analitik: angka dihitung KODE. Claude (jika ANTHROPIC_API_KEY ada) hanya menarasikan data agregat. Jika gagal -> narasi berbasis aturan.
module.exports = function createAnalytics(D) {
  const { col } = D; const pct = (a, b) => (b ? D.round((a / b) * 100) : 0);
  async function metrics() {
    const c = await D.cfg(), t = Date.now(), H = 3600e3;
    const batches = await col.batches.find({}), deps = await col.deposits.find({}), trfs = await col.transfers.find({}), evs = await col.events.find({}), actors = await col.actors.find({}), groups = await col.farmerGroups.find({ active: true });
    const pending = deps.filter((d) => d.status === 'pending'); const overdue = pending.filter((d) => t - new Date(d.createdAt) > c.depositSlaHours * H);
    const hanging = trfs.filter((x) => (x.status === 'in_transit' && t - new Date(x.sentAt) > c.hangingHours * H) || x.status === 'disputed');
    const anchorable = evs.filter((e) => e.anchorStatus !== 'not_required'); const confirmed = anchorable.filter((e) => e.anchorStatus === 'confirmed').length; const failed = anchorable.filter((e) => e.anchorStatus === 'failed').length;
    const yields = batches.filter((b) => b.meta?.yieldPct).map((b) => b.meta.yieldPct);
    const byProc = {}; batches.filter((b) => b.meta?.yieldPct).forEach((b) => { (byProc[b.ownerActorId] ||= []).push(b.meta.yieldPct); });
    const procLow = []; const avg = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : 0;
    for (const [id, ys] of Object.entries(byProc)) { const m = ys.reduce((a, b) => a + b, 0) / ys.length; const a = actors.find((x) => x._id === id); if (a && m < avg - 2) procLow.push({ name: a.name, yieldPct: D.round(m) }); }
    const weeks = []; for (let i = 7; i >= 0; i--) { const from = t - (i + 1) * 7 * 24 * H, to = t - i * 7 * 24 * H; weeks.push({ label: new Date(to).toISOString().slice(5, 10), kg: deps.filter((d) => d.status !== 'rejected' && new Date(d.createdAt) >= from && new Date(d.createdAt) < to).reduce((s, d) => s + d.weightKg, 0) }); }
    const anomalies = await col.anomalies.find({}, { sort: { at: -1 } });
    return { batchActive: batches.filter((b) => ['available', 'in_transit', 'pending_verification', 'disputed'].includes(b.status)).length, pengepulActive: actors.filter((a) => a.role === 'pengepul').length, districts: new Set([...groups.map((g) => g.district)]).size, pending: pending.length, overdue: overdue.length, hanging: hanging.length, hangingList: hanging.map((x) => x.code), anchorPct: anchorable.length ? D.round((confirmed / anchorable.length) * 100, 1) : 100, anchorFailed: failed, anchorPending: anchorable.length - confirmed - failed, yieldAvg: D.round(avg), procLow, weeks, anomalyOpen: anomalies.filter((a) => !a.resolved).length, anomalyTypes: anomalies.reduce((o, a) => ((o[a.type] = (o[a.type] || 0) + 1), o), {}), autoAccepted: deps.filter((d) => d.status === 'auto_accepted').length, verified: deps.filter((d) => d.status === 'verified').length, rejected: deps.filter((d) => d.status === 'rejected').length, coverageNote: `${actors.filter((a) => a.role === 'pengepul').length} pengepul aktif, belum mewakili seluruh pasokan` };
  }
  function rules(m) {
    const b = [];
    if (m.hanging) b.push(`${m.hanging} transfer menggantung atau bersengketa (${m.hangingList.join(', ')}).`);
    if (m.procLow.length) b.push(`Rendemen ${m.procLow.map((p) => `${p.name} ${p.yieldPct}%`).join(', ')} di bawah rata-rata ${m.yieldAvg}%.`);
    if (m.overdue) b.push(`${m.overdue} setoran melewati SLA verifikasi.`);
    if (m.anchorFailed) b.push(`${m.anchorFailed} commit blockchain gagal; retry berjalan lewat outbox.`);
    b.push(`Setoran: ${m.verified} diverifikasi, ${m.autoAccepted} diterima otomatis (sampling), ${m.rejected} ditolak.`);
    b.push(`Cakupan data: ${m.coverageNote}.`);
    return b;
  }
  async function claude(m) {
    const key = process.env.ANTHROPIC_API_KEY; if (!key) return null;
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 600, system: 'Anda analis pengawasan rantai pasok pangan. Gunakan HANYA angka pada data JSON yang diberikan; jangan menghitung ulang atau mengarang angka. Jawab hanya JSON: {"bullets":["..."]} berisi 3-5 butir ringkasan bahasa Indonesia, singkat, netral, dan sebutkan keterbatasan cakupan data.', messages: [{ role: 'user', content: JSON.stringify(m) }] }) });
    if (!res.ok) throw new Error('Claude API ' + res.status);
    const j = await res.json(); const txt = j.content?.[0]?.text || ''; const o = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    if (!Array.isArray(o.bullets) || !o.bullets.length || o.bullets.some((x) => typeof x !== 'string')) throw new Error('Format tidak valid');
    return o.bullets.slice(0, 5);
  }
  async function run() {
    const m = await metrics(); let bullets, source = 'rules', note;
    try { const c = await claude(m); if (c) { bullets = c; source = 'claude'; } } catch (e) { note = 'Claude gagal: ' + e.message; }
    if (!bullets) bullets = rules(m);
    return col.analyticsReports.insert({ at: D.now(), source, bullets, note, metrics: { hanging: m.hanging, overdue: m.overdue, anchorPct: m.anchorPct } });
  }
  async function latest() { const r = await col.analyticsReports.find({}, { sort: { at: -1 }, limit: 1 }); return r[0] || (await run()); }
  return { metrics, run, latest };
};
