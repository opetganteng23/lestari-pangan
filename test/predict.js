// Uji Fase 5: kesiapan data, forecasting + evaluasi temporal, monitoring, Digital Twin. Jalankan: node test/predict.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert');
process.env.LOG = '0'; process.env.LP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-predict-'));
const { start } = require('../server/index.js');
(async () => {
  const s = await start({ port: 0 }); const base = 'http://localhost:' + s.server.address().port; let fails = 0;
  const call = async (p, { method = 'GET', body, token } = {}) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
  const login = async (e) => (await call('/api/login', { method: 'POST', body: { email: e, password: 'lestari123' } })).j.token;
  const t = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
  const T = { admin: await login('admin@lestari.id'), pengawas: await login('pengawas@lestari.id'), pengepul1: await login('pengepul1@lestari.id') };
  const D = s.D; const gs = await D.col.farmerGroups.find({}); const pe = (await D.col.actors.find({ role: 'pengepul' }));
  // data sintetis bertren naik dan bising, 30 minggu ke belakang (deterministik)
  let seedN = 7; const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
  const addWeeks = async (n, level) => { for (let w = n; w >= 1; w--) { const kg = level + (n - w) * 60 + (rnd() - 0.5) * 400; const at = new Date(Date.now() - w * 7 * 864e5 - 3 * 864e5).toISOString(); await D.col.deposits.insert({ status: 'verified', createdAt: at, weightKg: Math.round(kg), farmerGroupId: gs[w % gs.length]._id, actorId: pe[w % pe.length]._id, notaNo: 'SYN-' + w + '-' + Math.random() }); } };

  await t('kesiapan: data seed pendek → belum siap, proyeksi dinonaktifkan, pratinjau berperingatan', async () => {
    const rd = (await call('/api/predict/readiness', { token: T.pengawas })).j; assert.strictEqual(rd.ready, false); assert.ok(rd.checks.some((c) => c.id === 'minggu' && !c.ok)); assert.ok(rd.checks.some((c) => c.id === 'stok' && !c.ok));
    const f = (await call('/api/predict/forecast', { token: T.pengawas })).j; assert.strictEqual(f.usable, false); assert.ok(f.message);
    const pv = (await call('/api/predict/forecast?preview=1', { token: T.pengawas })).j; if (pv.usable) { assert.strictEqual(pv.preview, true); assert.ok(pv.limitations.some((x) => x.includes('PRATINJAU'))); assert.strictEqual(pv.label, 'PROYEKSI, bukan fakta'); }
    assert.strictEqual((await call('/api/predict/forecast', { token: T.pengepul1 })).status, 403);
  });
  await addWeeks(30, 2000);
  let fc;
  await t('forecast: siap, evaluasi temporal, interval, label proyeksi', async () => {
    const rd = (await call('/api/predict/readiness', { token: T.admin })).j; assert.strictEqual(rd.ready, true, JSON.stringify(rd.checks.filter((c) => !c.ok)));
    fc = (await call('/api/predict/forecast?horizon=4', { token: T.admin })).j; assert.strictEqual(fc.usable, true); assert.strictEqual(fc.preview, false); assert.strictEqual(fc.label, 'PROYEKSI, bukan fakta');
    assert.strictEqual(fc.forecast.length, 4); assert.ok(fc.forecast.every((p) => p.lo <= p.yhat && p.yhat <= p.hi)); assert.ok(fc.forecast[3].hi - fc.forecast[3].lo >= fc.forecast[0].hi - fc.forecast[0].lo, 'interval melebar');
    assert.ok(fc.evaluation.method.includes('temporal') && fc.evaluation.test.naif && fc.evaluation.baselineMae > 0); assert.ok(fc.limitations.length >= 3);
    assert.ok(fc.history.length >= 29); assert.ok(new Date(fc.forecast[0].weekStart) > new Date(fc.history[fc.history.length - 1].weekStart));
  });
  await t('forecast: model kompleks hanya dipakai bila mengalahkan baseline naif pada data uji', async () => {
    assert.ok(['naif', 'rata4', 'rata8', 'ses'].includes(fc.model)); if (fc.model !== 'naif') { assert.strictEqual(fc.evaluation.beatsBaseline, true); assert.ok(fc.evaluation.chosenTestMae < fc.evaluation.baselineMae); } else assert.strictEqual(fc.evaluation.beatsBaseline, false);
  });
  await t('forecast: rata-rata bergulir tidak bocor data uji (galat bukan nol)', async () => { assert.ok(fc.evaluation.chosenTestMae > 0); });
  await t('monitor: membandingkan proyeksi lama dengan kenyataan dan menandai drift', async () => {
    const m0 = (await call('/api/predict/monitor', { token: T.admin })).j; assert.ok(m0.status.includes('belum cukup') || m0.comparisons >= 0);
    const rows = fc.history.slice(-4); const mk = (mult) => rows.map((h) => ({ weekStart: h.weekStart, yhat: Math.round(h.kg * mult), lo: Math.round(h.kg * mult * 0.9), hi: Math.round(h.kg * mult * 1.1) }));
    await D.col.forecastRuns.insert({ at: new Date(Date.now() - 40 * 864e5).toISOString(), scope: 'total', model: 'rata4', preview: false, horizon: 4, forecast: mk(2.0), testMae: 1 });
    const ok = (await call('/api/predict/monitor', { token: T.admin })).j; assert.ok(ok.comparisons >= 4); assert.strictEqual(ok.drift, true, 'galat nyata >> galat uji harus ditandai');
    await D.col.forecastRuns.remove({}); await D.col.forecastRuns.insert({ at: new Date(Date.now() - 40 * 864e5).toISOString(), scope: 'total', model: 'rata4', preview: false, horizon: 4, forecast: mk(1.0), testMae: 1e9 });
    const ok2 = (await call('/api/predict/monitor', { token: T.admin })).j; assert.strictEqual(ok2.drift, false); assert.strictEqual(ok2.intervalCoverage, 100);
  });
  await t('forecast per kabupaten memakai deret sendiri', async () => { const ds = (await call('/api/predict/districts', { token: T.admin })).j; assert.ok(ds.length >= 2); const r = (await call('/api/predict/readiness?scope=district:' + encodeURIComponent(ds[0]), { token: T.admin })).j; assert.strictEqual(r.scope, 'district:' + ds[0]); });
  await t('digital twin: jaringan dari data, ketergantungan satu sumber', async () => {
    const n = (await call('/api/twin/network', { token: T.pengawas })).j; assert.ok(n.nodes.length > 5 && n.edges.length > 5); assert.ok(n.sourceNote.includes('setoran')); assert.ok(n.edges.every((e) => e.kg >= 0)); assert.ok(Array.isArray(n.singleSource));
    assert.strictEqual((await call('/api/twin/network', { token: T.pengepul1 })).status, 403);
  });
  await t('simulasi: berlabel hipotetis, memuat asumsi/parameter/sumber, dicatat', async () => {
    const n = (await call('/api/twin/network', { token: T.admin })).j; const gdg = n.nodes.filter((x) => x.role === 'gudang').sort((a, b) => b.inKg - a.inKg)[0];
    const r = (await call('/api/twin/simulate', { method: 'POST', token: T.admin, body: { scenario: 'node_down', nodeId: gdg.id, days: 14, altCapacityPct: 20 } })).j;
    assert.strictEqual(r.hypothetical, true); assert.ok(r.label.includes('HIPOTETIS')); assert.ok(r.assumptions.length >= 3); assert.strictEqual(r.parameters.days, 14); assert.ok(r.sourceData.edges > 0);
    assert.ok(r.result.lostKg > 0 && r.result.unmetKg >= 0 && r.result.unmetKg <= r.result.lostKg);
    const more = (await call('/api/twin/simulate', { method: 'POST', token: T.admin, body: { scenario: 'node_down', nodeId: gdg.id, days: 14, altCapacityPct: 100 } })).j; assert.ok(more.result.unmetKg <= r.result.unmetKg, 'kapasitas pengganti lebih besar → kekurangan lebih kecil');
    const kt = n.nodes.find((x) => x.role === 'kelompok_tani'); const sd = (await call('/api/twin/simulate', { method: 'POST', token: T.admin, body: { scenario: 'supply_drop', sourceId: kt.id, dropPct: 50, weeks: 4 } })).j; assert.ok(sd.result.totalLostKg > 0); assert.ok(sd.result.affected[0].inflowDropPct <= 50);
    const tr = n.edges.find((e) => e.kind === 'transfer'); const dl = (await call('/api/twin/simulate', { method: 'POST', token: T.admin, body: { scenario: 'delay', fromId: tr.from, toId: tr.to, extraHours: 72 } })).j; assert.ok('extraKgInTransit' in dl.result);
    const cp = (await call('/api/twin/simulate', { method: 'POST', token: T.admin, body: { scenario: 'capacity', nodeId: gdg.id, capacityPct: 50 } })).j; assert.ok(cp.result.unmetWeeklyKg > 0);
    assert.strictEqual((await call('/api/twin/simulate', { method: 'POST', token: T.admin, body: { scenario: 'ngawur' } })).status, 400); assert.strictEqual((await call('/api/twin/simulate', { method: 'POST', token: T.admin, body: { scenario: 'node_down', nodeId: 'x' } })).status, 400);
    assert.strictEqual((await call('/api/twin/simulate', { method: 'POST', token: T.pengepul1, body: { scenario: 'capacity' } })).status, 403);
    assert.ok((await call('/api/twin/simulations', { token: T.admin })).j.length >= 4); assert.ok((await call('/api/audit', { token: T.admin })).j.some((a) => a.action === 'simulasi.jalankan'));
  });
  await t('simulasi tidak mengubah data operasional', async () => { const before = (await D.col.batches.find({})).length + (await D.col.transfers.find({})).length; await call('/api/twin/simulate', { method: 'POST', token: T.admin, body: { scenario: 'capacity', nodeId: (await call('/api/twin/network', { token: T.admin })).j.nodes[0].id, capacityPct: 10 } }); assert.strictEqual((await D.col.batches.find({})).length + (await D.col.transfers.find({})).length, before); });
  await s.close(); console.log(fails ? `\n${fails} uji gagal` : '\nSemua uji prediksi lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
