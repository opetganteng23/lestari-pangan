process.env.LP_SKIP_DOTENV = '1';
// Uji dashboard Server: gerbang layanan, batas AI, lalu lintas, cadangan, izin. Jalankan: node test/server.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert');
process.env.LOG = '0'; process.env.LP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-server-')); process.env.LP_BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-bk-'));
delete process.env.ANTHROPIC_API_KEY;
const { start } = require('../server/index.js');
(async () => {
  const s = await start({ port: 0 }); const base = 'http://localhost:' + s.server.address().port; let fails = 0;
  const call = async (p, { method = 'GET', body, token, h = {} } = {}) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...h }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, headers: r.headers, j: await r.json().catch(() => ({})) }; };
  const login = async (e) => (await call('/api/login', { method: 'POST', body: { email: e, password: 'lestari123' } })).j.token;
  const t = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
  const T = {}; for (const k of ['admin', 'pengawas', 'pengepul1', 'gudang1', 'sa']) T[k] = await login(k + '@lestari.id');

  await t('status server: hanya admin, memuat kesehatan, lalu lintas, AI, cadangan, cek konfigurasi', async () => {
    assert.strictEqual((await call('/api/server/status', { token: T.pengepul1 })).status, 403); assert.strictEqual((await call('/api/server/status', { token: T.pengawas })).status, 403); assert.strictEqual((await call('/api/server/status')).status, 401);
    const st = (await call('/api/server/status', { token: T.admin })).j;
    assert.ok(st.uptimeSec >= 0 && st.node && st.memory.rssMB > 0 && st.store.kind); assert.strictEqual(st.gate.open, true); assert.strictEqual(st.ai.configured, false); assert.strictEqual(st.ai.enabled, true);
    assert.ok(st.traffic.total > 0 && st.traffic.bins.length === 15 && st.traffic.p50 != null); assert.ok(st.ledger.chainOk); assert.ok(st.checks.some((c) => c.id === 'secret') && st.counts.users > 5);
    assert.ok(!JSON.stringify(st).includes(process.env.APP_SECRET || '\u0000nope'));
    assert.strictEqual((await call('/api/server/status', { token: T.sa })).status, 200);
  });
  await t('gerbang: validasi jam layanan, batas AI, pesan', async () => {
    const put = (b) => call('/api/server/gate', { method: 'PUT', token: T.admin, body: b });
    assert.strictEqual((await put({ window: '8-17' })).status, 400); assert.strictEqual((await put({ window: '08:00-08:00' })).status, 400); assert.strictEqual((await put({ aiDailyLimit: -1 })).status, 400); assert.strictEqual((await put({ aiDailyLimit: 1.5 })).status, 400); assert.strictEqual((await put({ message: 'x'.repeat(201) })).status, 400);
    assert.strictEqual((await call('/api/server/gate', { method: 'PUT', token: T.pengepul1, body: { enabled: false } })).status, 403);
    assert.strictEqual((await put({ window: '08:00-17:00', aiDailyLimit: 5 })).status, 200); assert.strictEqual((await put({ window: '' })).status, 200);
  });
  await t('jeda: pelaku tidak bisa menulis (503 + pesan), tetap bisa membaca & login; staf tetap bisa; dibuka lagi', async () => {
    assert.strictEqual((await call('/api/server/gate', { method: 'PUT', token: T.admin, body: { enabled: false, message: 'Pemeliharaan 10 menit' } })).status, 200);
    const w = await call('/api/labels', { method: 'POST', token: T.pengepul1, body: { count: 1 } }); assert.strictEqual(w.status, 503); assert.strictEqual(w.j.error, 'Pemeliharaan 10 menit'); assert.strictEqual(w.j.gate, true); assert.ok(w.headers.get('retry-after'));
    assert.strictEqual((await call('/api/batches', { token: T.pengepul1 })).status, 200); assert.strictEqual((await call('/api/login', { method: 'POST', body: { email: 'pengepul1@lestari.id', password: 'lestari123' } })).status, 200);
    const me = (await call('/api/me', { token: T.pengepul1 })).j; assert.strictEqual(me.service.open, false); assert.strictEqual(me.service.reason, 'Pemeliharaan 10 menit');
    assert.notStrictEqual((await call('/api/cases', { method: 'POST', token: T.admin, body: { title: 'Kasus saat jeda' } })).status, 503);
    assert.notStrictEqual((await call('/api/labels', { method: 'POST', token: T.sa, body: { count: 1 } })).status, 503);
    assert.strictEqual((await call('/api/partner/transfers/X/carrier', { method: 'POST', h: { 'x-api-key': 'lpk_x' }, body: { step: 'pickup' } })).status, 503);
    assert.strictEqual((await call('/api/server/gate', { method: 'PUT', token: T.admin, body: { enabled: true } })).status, 200);
    assert.notStrictEqual((await call('/api/labels', { method: 'POST', token: T.pengepul1, body: { count: 1 } })).status, 503);
  });
  await t('jam layanan di luar jendela memblokir tulis; di dalam jendela lolos', async () => {
    const h = new Date(); const two = (n) => String((n + 24) % 24).padStart(2, '0'); const outside = `${two(h.getHours() + 3)}:00-${two(h.getHours() + 4)}:00`; const inside = `${two(h.getHours() - 1)}:00-${two(h.getHours() + 1)}:59`.replace(/:59$/, ':30');
    await call('/api/server/gate', { method: 'PUT', token: T.admin, body: { window: outside, message: '' } }); const st = (await call('/api/server/status', { token: T.admin })).j; assert.strictEqual(st.gate.open, false); assert.ok(st.gate.reason.includes(outside));
    assert.strictEqual((await call('/api/labels', { method: 'POST', token: T.pengepul1, body: { count: 1 } })).status, 503);
    await call('/api/server/gate', { method: 'PUT', token: T.admin, body: { window: '00:00-23:59' } }); assert.strictEqual((await call('/api/server/status', { token: T.admin })).j.gate.open, true);
    await call('/api/server/gate', { method: 'PUT', token: T.admin, body: { window: '' } });
  });
  await t('AI dijeda / batas harian: asisten memakai jawaban aturan dengan alasan', async () => {
    await call('/api/server/gate', { method: 'PUT', token: T.admin, body: { aiEnabled: false } });
    const r = (await call('/api/ai/copilot/query', { method: 'POST', token: T.admin, body: { question: 'Ringkas kondisi minggu ini' } })).j; assert.strictEqual(r.source, 'rules'); assert.ok(r.note.includes('dijeda'));
    await call('/api/server/gate', { method: 'PUT', token: T.admin, body: { aiEnabled: true, aiDailyLimit: 1 } });
    await s.D.col.aiLogs.insert({ at: new Date().toISOString(), userId: (await s.D.col.users.findOne({ email: 'admin@lestari.id' }))._id, source: 'claude', tools: [], ok: true });
    const r2 = (await call('/api/ai/copilot/query', { method: 'POST', token: T.admin, body: { question: 'Ringkas kondisi minggu ini' } })).j; assert.ok(r2.note.includes('batas AI harian'));
    await call('/api/server/gate', { method: 'PUT', token: T.admin, body: { aiDailyLimit: 0 } });
    const st = (await call('/api/server/status', { token: T.admin })).j; assert.ok(st.ai.queriesToday >= 2 && st.ai.byUser.length >= 1);
  });
  await t('uji AI: tanpa kunci dijawab jelas, hanya admin', async () => {
    const r = await call('/api/server/ai/test', { method: 'POST', token: T.admin }); assert.strictEqual(r.status, 200); assert.strictEqual(r.j.ok, false); assert.strictEqual(r.j.configured, false);
    assert.strictEqual((await call('/api/server/ai/test', { method: 'POST', token: T.pengawas })).status, 403);
  });
  await t('cadangan dari dashboard: tersalin, muncul di status, tercatat audit', async () => {
    assert.strictEqual((await call('/api/server/backup', { method: 'POST', token: T.pengepul1 })).status, 403);
    const r = (await call('/api/server/backup', { method: 'POST', token: T.admin })).j; assert.ok(r.name && r.entries >= 1); assert.ok(fs.existsSync(path.join(process.env.LP_BACKUP_DIR, r.name, 'MANIFEST.json')));
    assert.ok(!fs.existsSync(path.join(process.env.LP_BACKUP_DIR, r.name, '.secret')));
    const st = (await call('/api/server/status', { token: T.admin })).j; assert.strictEqual(st.backups.latest.name, r.name); assert.ok((await call('/api/audit', { token: T.admin })).j.some((a) => a.action === 'server.cadangan'));
  });
  await t('lalu lintas mencatat 5xx/429 dan permintaan lewat proxy', async () => {
    await call('/api/health', { h: { 'x-forwarded-for': '203.0.113.9' } }); const st = (await call('/api/server/status', { token: T.admin })).j; assert.ok(st.proxy.secondsAgo != null && st.proxy.secondsAgo < 30); assert.ok(st.traffic.c4xx >= 1);
  });
  await s.close(); console.log(fails ? `\n${fails} uji gagal` : '\nSemua uji server lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
