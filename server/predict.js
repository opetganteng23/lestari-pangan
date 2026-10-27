// Fase 5 — Predictive Intelligence: kesiapan data, forecasting dengan evaluasi temporal, monitoring kualitas model, Digital Twin.
// Semua keluaran berlabel PROYEKSI / SIMULASI HIPOTETIS. Forecast hanya aktif bila data memadai (kecuali pratinjau yang diberi peringatan).
module.exports = function createPredict(D) {
  const { col, round, bad, notFound } = D; const DAY = 864e5, WEEK = 7 * DAY;
  const weekStart = (t) => { const d = new Date(t); const dow = (d.getUTCDay() + 6) % 7; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10); };
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

  // ---------- deret mingguan ----------
  async function series(scope = 'total') {
    let deps = (await col.deposits.find({})).filter((d) => d.status !== 'rejected' && d.createdAt && !isNaN(Date.parse(d.createdAt)));
    if (scope.startsWith('district:')) { const gs = Object.fromEntries((await col.farmerGroups.find({})).map((g) => [g._id, g])); const dn = scope.slice(9); deps = deps.filter((d) => gs[d.farmerGroupId]?.district === dn); }
    if (!deps.length) return { weeks: [], values: [], deposits: 0 };
    const byW = {}; for (const d of deps) { const w = weekStart(d.createdAt); byW[w] = (byW[w] || 0) + d.weightKg; }
    const first = Date.parse(Object.keys(byW).sort()[0]); const thisW = Date.parse(weekStart(Date.now())); const weeks = [], values = [];
    for (let t = first; t < thisW; t += WEEK) { const k = new Date(t).toISOString().slice(0, 10); weeks.push(k); values.push(round(byW[k] || 0, 1)); } // minggu berjalan tidak dipakai (belum lengkap)
    return { weeks, values, deposits: deps.length };
  }

  // ---------- kesiapan data ----------
  async function readiness(scope = 'total') {
    const c = await D.cfg(); const s = await series(scope); const n = s.values.length; const nz = s.values.filter((v) => v > 0).length;
    const actors = (await col.actors.find({})).filter((a) => a.role === 'pengepul').length; const groups = (await col.farmerGroups.find({ active: true })).length;
    const allDeps = await col.deposits.find({}); const badTs = allDeps.filter((d) => !d.createdAt || isNaN(Date.parse(d.createdAt))).length; const coverage = n ? nz / n : 0;
    const checks = [
      { id: 'minggu', ok: n >= c.forecastMinWeeks, text: `Riwayat ${n} minggu lengkap (minimal ${c.forecastMinWeeks})` },
      { id: 'cakupan', ok: coverage >= 0.7, text: `${Math.round(coverage * 100)}% minggu memiliki setoran (minimal 70%)` },
      { id: 'pelaku', ok: actors >= 2 && groups >= 2, text: `${actors} pengepul dan ${groups} kelompok tani aktif (minimal 2 dan 2)` },
      { id: 'timestamp', ok: badTs === 0, text: badTs ? `${badTs} setoran dengan waktu tidak valid` : 'Semua waktu setoran valid' },
      { id: 'stok', ok: false, text: 'Definisi stok belum dibakukan: peramalan stok tidak tersedia, hanya volume setoran mingguan' },
    ];
    const gating = checks.filter((x) => x.id !== 'stok'); const ready = gating.every((x) => x.ok);
    return { scope, ready, weeks: n, checks, note: ready ? 'Data memenuhi syarat minimum untuk proyeksi volume setoran. Syarat minimum bukan jaminan akurasi; lihat evaluasi model.' : 'Data belum memadai. Proyeksi dinonaktifkan; pratinjau bertanda peringatan dapat diminta secara eksplisit.' };
  }

  // ---------- model: semuanya ramalan satu langkah ke depan dari riwayat ----------
  const MODELS = {
    naif: (h) => h[h.length - 1],
    rata4: (h) => mean(h.slice(-4)),
    rata8: (h) => mean(h.slice(-8)),
    ses: (h, a = 0.4) => { let l = h[0]; for (let i = 1; i < h.length; i++) l = a * h[i] + (1 - a) * l; return l; },
  };
  function rollingErrors(vals, model, start) { const e = []; for (let i = start; i < vals.length; i++) { const p = MODELS[model](vals.slice(0, i)); e.push({ i, actual: vals[i], pred: p, err: vals[i] - p }); } return e; }
  const mae = (es) => mean(es.map((x) => Math.abs(x.err)));
  const mape = (es) => { const z = es.filter((x) => x.actual > 0); return z.length ? mean(z.map((x) => Math.abs(x.err) / x.actual)) * 100 : null; };

  // Evaluasi dengan pemisahan temporal: model dipilih dari bagian awal (validasi), diuji pada bagian akhir (uji) yang tidak dipakai memilih.
  async function forecast(scope = 'total', { horizon = 4, preview = false, save = true } = {}) {
    const rd = await readiness(scope); const s = await series(scope); const vals = s.values; const n = vals.length;
    if (n < 6) return { ready: false, usable: false, readiness: rd, message: 'Riwayat kurang dari 6 minggu; proyeksi tidak dapat dibuat.' };
    if (!rd.ready && !preview) return { ready: false, usable: false, readiness: rd, message: 'Data belum memadai; proyeksi dinonaktifkan. Gunakan pratinjau hanya untuk melihat cara kerjanya.' };
    const testN = Math.max(2, Math.floor(n / 4)), valStart = Math.max(3, Math.floor(n / 2)), testStart = n - testN;
    const names = Object.keys(MODELS); const val = {}, test = {};
    for (const m of names) { val[m] = mae(rollingErrors(vals.slice(0, testStart), m, valStart)); }
    const best = names.slice().sort((a, b) => val[a] - val[b])[0];
    for (const m of names) { const es = rollingErrors(vals, m, testStart); test[m] = { mae: round(mae(es), 1), mape: mape(es) == null ? null : round(mape(es), 1) }; }
    const baseline = test.naif.mae; const chosenMae = test[best].mae; const beats = best === 'naif' ? false : chosenMae < baseline * 0.95;
    const model = beats ? best : 'naif'; // model kompleks hanya dipakai bila terbukti mengalahkan baseline naif pada data uji
    const resid = rollingErrors(vals, model, Math.max(3, valStart)).map((x) => x.err); const sigma = sd(resid), z80 = 1.2816;
    const lastW = Date.parse(s.weeks[n - 1]); const base = MODELS[model](vals); const pts = [];
    for (let k = 1; k <= horizon; k++) { const wk = new Date(lastW + k * WEEK).toISOString().slice(0, 10); const w = sigma * Math.sqrt(k); pts.push({ weekStart: wk, yhat: round(Math.max(0, base), 1), lo: round(Math.max(0, base - z80 * w), 1), hi: round(base + z80 * w, 1) }); }
    const out = { scope, ready: rd.ready, usable: true, preview: !rd.ready, label: 'PROYEKSI, bukan fakta', model, modelNote: model === 'naif' ? (best === 'naif' ? 'Baseline naif (nilai minggu terakhir) terbaik pada validasi.' : 'Model lain tidak mengalahkan baseline naif pada data uji, jadi baseline dipakai.') : `Model ${model} mengalahkan baseline naif pada data uji.`,
      evaluation: { method: 'Pemisahan temporal: validasi memilih model, uji (minggu terakhir) tidak dipakai memilih. Ramalan satu minggu ke depan dengan jendela berjalan.', weeksTotal: n, testWeeks: testN, validationMae: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, round(v, 1)])), test, baselineMae: baseline, chosenTestMae: chosenMae, beatsBaseline: beats, unit: 'kg per minggu' },
      interval: '80% (aproksimasi dari galat satu langkah; melebar mengikuti akar horizon). Bukan jaminan.', history: s.weeks.map((w, i) => ({ weekStart: w, kg: vals[i] })), forecast: pts, limitations: ['Hanya volume setoran terverifikasi/diterima, bukan stok atau permintaan.', 'Tanpa musiman tahunan (data belum cukup panjang).', 'Pola panen dan cuaca tidak dimodelkan.', 'Data prototipe bersifat simulasi.', ...(rd.ready ? [] : ['PRATINJAU: data belum memenuhi syarat kesiapan; jangan dipakai untuk keputusan.'])] };
    const lastRun = (await col.forecastRuns.find({ scope }, { sort: { at: -1 }, limit: 1 }))[0];
    if (save && (!lastRun || Date.now() - Date.parse(lastRun.at) > 12 * 3600e3)) await col.forecastRuns.insert({ at: D.now(), scope, model, preview: out.preview, horizon, forecast: pts, testMae: chosenMae });
    return out;
  }

  // ---------- pemantauan kualitas: bandingkan proyeksi lama dengan kenyataan ----------
  async function monitor(scope = 'total') {
    const s = await series(scope); const actual = Object.fromEntries(s.weeks.map((w, i) => [w, s.values[i]])); const runs = (await col.forecastRuns.find({ scope }, { sort: { at: 1 } }));
    const rows = []; for (const r of runs) for (const f of r.forecast) { if (!(f.weekStart in actual)) continue; rows.push({ runAt: r.at, model: r.model, preview: r.preview, weekStart: f.weekStart, yhat: f.yhat, lo: f.lo, hi: f.hi, actual: actual[f.weekStart], err: round(actual[f.weekStart] - f.yhat, 1), inInterval: actual[f.weekStart] >= f.lo && actual[f.weekStart] <= f.hi }); }
    const real = rows.filter((x) => !x.preview); const eval_ = real.length ? real : rows;
    const m = eval_.length ? mean(eval_.map((x) => Math.abs(x.err))) : null; const cov = eval_.length ? eval_.filter((x) => x.inInterval).length / eval_.length : null;
    const testRef = runs.length ? mean(runs.map((r) => r.testMae).filter((x) => x != null)) : null; const drift = m != null && testRef ? m > testRef * 1.5 : false;
    return { scope, runs: runs.length, comparisons: rows.length, mae: m == null ? null : round(m, 1), intervalCoverage: cov == null ? null : round(cov * 100, 0), expectedCoverage: 80, referenceTestMae: testRef == null ? null : round(testRef, 1), drift,
      status: m == null ? 'belum cukup data pembanding' : drift ? 'PERLU DITINJAU: galat nyata jauh di atas galat uji' : 'dalam batas', rows: rows.slice(-30), note: 'Perbandingan hanya untuk minggu proyeksi yang sudah lewat. Data pratinjau tidak dihitung bila ada proyeksi nyata.' };
  }

  // ---------- Digital Twin: jaringan + simulasi skenario ----------
  async function network(windowDays = 90) {
    const since = Date.now() - windowDays * DAY; const actors = (await col.actors.find({})).filter((a) => ['pengepul', 'gudang', 'distributor', 'retailer'].includes(a.role)); const A = Object.fromEntries(actors.map((a) => [a._id, a]));
    const gs = await col.farmerGroups.find({}); const G = Object.fromEntries(gs.map((g) => [g._id, g]));
    const deps = (await col.deposits.find({})).filter((d) => d.status !== 'rejected' && Date.parse(d.createdAt) >= since);
    const trs = (await col.transfers.find({})).filter((t) => Date.parse(t.sentAt) >= since && t.status !== 'returned');
    const edges = {}; const add = (from, to, kg, kind, hrs) => { const k = from + '>' + to; const e = (edges[k] ||= { from, to, kind, kg: 0, n: 0, hours: [] }); e.kg += kg; e.n++; if (hrs != null) e.hours.push(hrs); };
    for (const d of deps) add('g:' + d.farmerGroupId, d.actorId, d.weightKg, 'setoran');
    for (const t of trs) add(t.fromActorId, t.toActorId, t.receivedKg ?? t.sentKg, 'transfer', t.receivedAt ? (Date.parse(t.receivedAt) - Date.parse(t.sentAt)) / 3600e3 : null);
    const E = Object.values(edges).map((e) => ({ ...e, kg: round(e.kg, 1), avgHours: e.hours.length ? round(mean(e.hours), 1) : null, hours: undefined }));
    const nodeId = (id) => (id.startsWith('g:') ? { id, name: G[id.slice(2)]?.name, role: 'kelompok_tani', district: G[id.slice(2)]?.district } : { id, name: A[id]?.name, role: A[id]?.role, district: A[id]?.district });
    const ids = new Set(E.flatMap((e) => [e.from, e.to])); const nodes = [...ids].map((id) => { const inKg = E.filter((e) => e.to === id).reduce((s, e) => s + e.kg, 0), outKg = E.filter((e) => e.from === id).reduce((s, e) => s + e.kg, 0); return { ...nodeId(id), inKg: round(inKg, 1), outKg: round(outKg, 1) }; });
    const deps_ = []; for (const n of nodes) { const ins = E.filter((e) => e.to === n.id); const tot = ins.reduce((s, e) => s + e.kg, 0); if (!tot) continue; const top = ins.slice().sort((a, b) => b.kg - a.kg)[0]; const share = top.kg / tot; if (share >= 0.6 && ins.length >= 1) deps_.push({ node: n.name, role: n.role, mainSource: nodeId(top.from).name, sharePct: round(share * 100, 0), sources: ins.length }); }
    return { windowDays, nodes, edges: E, singleSource: deps_.sort((a, b) => b.sharePct - a.sharePct), sourceNote: `Dibangun dari ${deps.length} setoran dan ${trs.length} transfer ${windowDays} hari terakhir. Hubungan yang belum pernah terjadi tidak tampak di sini.`, generatedAt: D.now() };
  }

  const FRAME = { label: 'SIMULASI HIPOTETIS — bukan kondisi nyata dan bukan prediksi', };
  async function simulate(ctx, scenario, p = {}) {
    const net = await network(+p.windowDays || 90); const wks = (net.windowDays || 90) / 7; const byId = Object.fromEntries(net.nodes.map((n) => [n.id, n])); const weekly = (kg) => kg / wks;
    const asm = ['Aliran historis dianggap berulang pada laju rata-rata mingguan jendela data.', 'Penerusan dampak ke hilir dianggap linier (proporsional pada porsi pasokan).', 'Tidak memodelkan stok penyangga, harga, atau perubahan perilaku pelaku.'];
    let result, assumptions = asm.slice(), params = {};
    if (scenario === 'node_down') {
      const n = byId[p.nodeId]; if (!n) throw bad('Pelaku tidak ditemukan dalam jaringan'); const days = Math.min(90, Math.max(1, +p.days || 7)); const alt = Math.min(100, Math.max(0, p.altCapacityPct == null ? 20 : +p.altCapacityPct)); params = { nodeId: p.nodeId, nama: n.name, days, altCapacityPct: alt };
      const loss = weekly(n.inKg) / 7 * days; const peers = net.nodes.filter((x) => x.role === n.role && x.id !== n.id); const absorb = peers.reduce((s, x) => s + weekly(x.inKg) / 7 * days * (alt / 100), 0); const absorbed = Math.min(loss, absorb);
      const down = [...new Set(net.edges.filter((e) => e.from === n.id).map((e) => e.to))].map((id) => byId[id]).filter(Boolean);
      result = { lostKg: round(loss, 1), absorbedByPeersKg: round(absorbed, 1), unmetKg: round(loss - absorbed, 1), peers: peers.map((x) => x.name), downstreamAffected: down.map((x) => ({ name: x.name, role: x.role })), shareOfNetworkInflowPct: round(n.inKg / Math.max(1, net.nodes.filter((x) => x.role === n.role).reduce((s, x) => s + x.inKg, 0)) * 100, 0) };
      assumptions.push(`Pelaku sejenis lain dianggap mampu menyerap tambahan ${alt}% dari volumenya sendiri (parameter, bukan fakta).`);
    } else if (scenario === 'supply_drop') {
      const src = byId[p.sourceId]; if (!src) throw bad('Sumber tidak ditemukan dalam jaringan'); const drop = Math.min(100, Math.max(1, +p.dropPct || 30)); const weeks = Math.min(26, Math.max(1, +p.weeks || 4)); params = { sourceId: p.sourceId, nama: src.name, dropPct: drop, weeks };
      const out = net.edges.filter((e) => e.from === src.id); const effects = out.map((e) => { const to = byId[e.to]; const share = e.kg / Math.max(1, to.inKg); return { name: to.name, role: to.role, lostKg: round(weekly(e.kg) * drop / 100 * weeks, 1), shareOfTheirInflowPct: round(share * 100, 0), inflowDropPct: round(share * drop, 1) }; });
      result = { totalLostKg: round(effects.reduce((s, x) => s + x.lostKg, 0), 1), affected: effects.sort((a, b) => b.lostKg - a.lostKg) };
    } else if (scenario === 'delay') {
      const e = net.edges.find((x) => x.from === p.fromId && x.to === p.toId && x.kind === 'transfer'); if (!e) throw bad('Rute transfer tidak ditemukan dalam data'); const extra = Math.min(240, Math.max(1, +p.extraHours || 24)); const c = await D.cfg(); params = { dari: byId[e.from]?.name, ke: byId[e.to]?.name, extraHours: extra };
      const base = e.avgHours ?? null; const nw = base == null ? null : round(base + extra, 1);
      result = { baselineHours: base, newHours: nw, hangingThresholdHours: c.hangingHours, exceedsThreshold: nw != null && nw > c.hangingHours, extraKgInTransit: round(weekly(e.kg) / 168 * extra, 1), note: base == null ? 'Rute belum punya transfer terkonfirmasi; waktu dasar tidak diketahui.' : undefined };
    } else if (scenario === 'capacity') {
      const n = byId[p.nodeId]; if (!n) throw bad('Pelaku tidak ditemukan dalam jaringan'); const pct = Math.min(300, Math.max(0, +p.capacityPct)); if (isNaN(pct)) throw bad('capacityPct wajib'); params = { nodeId: p.nodeId, nama: n.name, capacityPct: pct };
      const wk = weekly(n.inKg); const cap = wk * pct / 100; result = { baselineWeeklyKg: round(wk, 1), capacityWeeklyKg: round(cap, 1), unmetWeeklyKg: round(Math.max(0, wk - cap), 1), headroomWeeklyKg: round(Math.max(0, cap - wk), 1) };
      assumptions.push('Kapasitas dinyatakan sebagai persen dari volume masuk historis, bukan kapasitas fisik terukur.');
    } else throw bad('Skenario tidak dikenal (node_down, supply_drop, delay, capacity)');
    const out = { scenario, ...FRAME, hypothetical: true, parameters: params, assumptions, sourceData: { windowDays: net.windowDays, nodes: net.nodes.length, edges: net.edges.length, note: net.sourceNote, generatedAt: net.generatedAt }, result };
    await col.simulations.insert({ at: D.now(), by: ctx.user?.name, scenario, parameters: params, result }); await D.audit(ctx, 'simulasi.jalankan', `${scenario} ${JSON.stringify(params)}`.slice(0, 200));
    return out;
  }
  return { series, readiness, forecast, monitor, network, simulate, weekStart };
};
