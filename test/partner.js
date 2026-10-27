// Uji Fase 4: portal kelompok tani, kunci API mitra, timbangan perangkat, idempotensi. Jalankan: node test/partner.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert');
process.env.LOG = '0'; process.env.LP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-partner-'));
const { start } = require('../server/index.js');
(async () => {
  const s = await start({ port: 0 }); const base = 'http://localhost:' + s.server.address().port; let fails = 0;
  const call = async (p, { method = 'GET', body, token, h = {}, raw } = {}) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...h }, body: body ? JSON.stringify(body) : undefined }); return raw ? { status: r.status, text: await r.text(), headers: r.headers } : { status: r.status, headers: r.headers, j: await r.json().catch(() => ({})) }; };
  const login = async (e) => (await call('/api/login', { method: 'POST', body: { email: e, password: 'lestari123' } })).j.token;
  const t = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
  const T = {}; for (const k of ['admin', 'pengepul1', 'pengepul2', 'logistik', 'retailer', 'gudang1']) T[k] = await login(k + '@lestari.id');
  T.kt1 = await login('kelompok.sumber@lestari.id'); T.kt2 = await login('kelompok.harapan@lestari.id');
  const PHOTO = (await call('/api/groups', { token: T.pengepul1 })).j && 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  await t('portal kelompok: hanya data kelompok sendiri, tanpa nilai uang', async () => {
    const a = (await call('/api/farmer/summary', { token: T.kt1 })).j, b = (await call('/api/farmer/summary', { token: T.kt2 })).j;
    assert.strictEqual(a.group.name, 'KT Sumber Rejeki'); assert.strictEqual(b.group.name, 'KT Harapan Jaya'); assert.ok(a.totals.count > 0); assert.ok(a.byMonth.length >= 1);
    assert.ok(a.definitions.payment.includes('belum terintegrasi')); assert.ok(!JSON.stringify(a).match(/harga|rupiah|Rp/i));
    const own = new Set(a.deposits.map((d) => d._id)); assert.ok(!b.deposits.some((d) => own.has(d._id)));
    assert.ok(a.deposits.every((d) => !d.notaPhoto || d.notaPhoto.includes('?e=')));
    assert.strictEqual((await call('/api/farmer/summary', { token: T.pengepul1 })).status, 403); assert.strictEqual((await call('/api/batches', { token: T.kt1 })).status, 403); assert.strictEqual((await call('/api/verifications', { token: T.kt1 })).status, 403);
  });
  await t('portal kelompok: ekspor CSV hanya setoran kelompok sendiri', async () => {
    const r = await call('/api/exports/setoran-kelompok', { token: T.kt1, raw: true }); assert.strictEqual(r.status, 200); assert.ok(r.text.includes('No. nota'));
    const r2 = await call('/api/exports/setoran-kelompok', { token: T.kt2, raw: true }); assert.notStrictEqual(r.text, r2.text);
    assert.strictEqual((await call('/api/exports/audit', { token: T.kt1, raw: true })).status, 403);
  });
  await t('kelompok tani diberi notifikasi saat setoran diputuskan', async () => {
    const g = (await call('/api/groups', { token: T.pengepul1 })).j.find((x) => x.name === 'KT Sumber Rejeki');
    const d = await call('/api/deposits', { method: 'POST', token: T.pengepul1, body: { farmerGroupId: g._id, groupCode: 'SUM-4821', weightKg: 5200, notaNo: 'KT-NOTIF-1', scalePhoto: PHOTO, notaPhoto: PHOTO } }); assert.strictEqual(d.status, 200);
    if (d.j.status === 'pending') await call(`/api/deposits/${d.j._id}/decide`, { method: 'POST', token: T.admin, body: { decision: 'approve' } });
    const ns = (await call('/api/notifications', { token: T.kt1 })).j; assert.ok(ns.some((n) => n.text.includes('KT-NOTIF-1')));
    assert.ok(!(await call('/api/notifications', { token: T.kt2 })).j.some((n) => n.text.includes('KT-NOTIF-1')));
  });
  await t('setoran dari klien tidak bisa dimundurkan waktunya; capturedAt dibatasi', async () => {
    const g = (await call('/api/groups', { token: T.pengepul1 })).j.find((x) => x.name === 'KT Harapan Jaya');
    const r = await call('/api/deposits', { method: 'POST', token: T.pengepul1, body: { farmerGroupId: g._id, groupCode: 'HAR-3307', weightKg: 1400, notaNo: 'KT-AT-1', at: '2020-01-01T00:00:00Z', capturedAt: '2020-01-01T00:00:00Z', scalePhoto: PHOTO, notaPhoto: PHOTO } });
    assert.strictEqual(r.status, 200); assert.ok(r.j.createdAt.startsWith(new Date().getFullYear().toString())); assert.strictEqual(r.j.capturedAt, null);
    const r2 = await call('/api/deposits', { method: 'POST', token: T.pengepul1, body: { farmerGroupId: g._id, groupCode: 'HAR-3307', weightKg: 1400, notaNo: 'KT-AT-2', capturedAt: new Date(Date.now() - 3600e3).toISOString(), scalePhoto: PHOTO, notaPhoto: PHOTO } }); assert.ok(r2.j.capturedAt);
  });
  await t('Idempotency-Key: kirim ulang tidak membuat setoran ganda', async () => {
    const g = (await call('/api/groups', { token: T.pengepul1 })).j.find((x) => x.name === 'KT Harapan Jaya'); const body = { farmerGroupId: g._id, groupCode: 'HAR-3307', weightKg: 1300, notaNo: 'KT-IDEM-1', scalePhoto: PHOTO, notaPhoto: PHOTO };
    const a = await call('/api/deposits', { method: 'POST', token: T.pengepul1, body, h: { 'idempotency-key': 'k-1' } }); const b = await call('/api/deposits', { method: 'POST', token: T.pengepul1, body, h: { 'idempotency-key': 'k-1' } });
    assert.strictEqual(a.status, 200); assert.strictEqual(b.status, 200); assert.strictEqual(a.j._id, b.j._id); assert.strictEqual(b.headers.get('idempotent-replay'), 'true');
    assert.strictEqual((await call('/api/deposits', { method: 'POST', token: T.pengepul1, body: { ...body, weightKg: 1 }, h: { 'idempotency-key': 'k-1' } })).status, 409);
    assert.strictEqual((await call('/api/deposits', { method: 'POST', token: T.pengepul1, body })).status, 409); // tanpa kunci: nota ganda ditolak
  });
  let kLog, kScale;
  await t('admin membuat kunci API: secret hanya sekali, scope sesuai peran, hash disimpan', async () => {
    const lg = (await call('/api/actors?role=logistik', { token: T.admin })).j[0]; const p1 = (await call('/api/actors?role=pengepul', { token: T.admin })).j.find((a) => a.name.includes('Tani Makmur'));
    assert.strictEqual((await call('/api/integrations/keys', { method: 'POST', token: T.pengepul1, body: {} })).status, 403);
    assert.strictEqual((await call('/api/integrations/keys', { method: 'POST', token: T.admin, body: { name: 'Bad', scopes: ['logistics:update'], actorId: p1._id } })).status, 400);
    kLog = (await call('/api/integrations/keys', { method: 'POST', token: T.admin, body: { name: 'Aplikasi kurir', scopes: ['logistics:update', 'transfers:read'], actorId: lg._id } })).j; assert.ok(kLog.secret.startsWith('lpk_'));
    kScale = (await call('/api/integrations/keys', { method: 'POST', token: T.admin, body: { name: 'Timbangan gudang CV', scopes: ['scale:write', 'batches:read'], actorId: p1._id } })).j;
    const list = (await call('/api/integrations/keys', { token: T.admin })).j; assert.ok(list.keys.length === 2 && !JSON.stringify(list).includes(kLog.secret) && !JSON.stringify(list).includes('keyHash'));
    s.store.flush(); const dbTxt = fs.readFileSync(path.join(process.env.LP_DATA_DIR, 'db.json'), 'utf8'); assert.ok(!dbTxt.includes(kLog.secret) && !dbTxt.includes(kScale.secret));
  });
  await t('API mitra: butuh kunci, scope dihormati, data dibatasi ke pelaku', async () => {
    const H = (k) => ({ 'x-api-key': k.secret });
    assert.strictEqual((await call('/api/partner/batches')).status, 401); assert.strictEqual((await call('/api/partner/batches', { h: { 'x-api-key': 'lpk_palsu' } })).status, 401);
    assert.strictEqual((await call('/api/partner/batches', { h: H(kLog) })).status, 403); // tidak punya batches:read
    const bs = (await call('/api/partner/batches', { h: H(kScale) })).j; assert.ok(bs.length && bs.every((b) => !('_id' in b) && !('ownerActorId' in b)));
    const mine = new Set((await call('/api/batches', { token: T.pengepul1 })).j.map((b) => b.code)); assert.ok(bs.every((b) => mine.has(b.code)));
    assert.ok(Array.isArray((await call('/api/partner/transfers', { h: H(kLog) })).j));
  });
  await t('kunci nonaktif/dihapus ditolak', async () => {
    const k = (await call('/api/integrations/keys', { method: 'POST', token: T.admin, body: { name: 'Sementara', scopes: ['batches:read'], actorId: (await call('/api/actors?role=pengepul', { token: T.admin })).j[0]._id } })).j;
    assert.strictEqual((await call('/api/partner/batches', { h: { 'x-api-key': k.secret } })).status, 200);
    await call('/api/integrations/keys/' + k._id, { method: 'PUT', token: T.admin, body: { active: false } }); assert.strictEqual((await call('/api/partner/batches', { h: { 'x-api-key': k.secret } })).status, 401);
    await call('/api/integrations/keys/' + k._id, { method: 'DELETE', token: T.admin }); assert.ok(!(await call('/api/integrations/keys', { token: T.admin })).j.keys.some((x) => x._id === k._id));
  });
  await t('timbangan perangkat: pembacaan dipakai untuk setoran, berat harus cocok, tak bisa dipakai dua kali', async () => {
    const H = { 'x-api-key': kScale.secret }; const g = (await call('/api/groups', { token: T.pengepul1 })).j.find((x) => x.name === 'KT Sumber Rejeki');
    assert.strictEqual((await call('/api/partner/scale-readings', { method: 'POST', h: H, body: { deviceId: 'TMB-01', weightKg: -3 } })).status, 400);
    const rd = (await call('/api/partner/scale-readings', { method: 'POST', h: { ...H, 'idempotency-key': 'r1' }, body: { deviceId: 'TMB-01', weightKg: 1480 } })).j; assert.ok(rd.id);
    const rd2 = (await call('/api/partner/scale-readings', { method: 'POST', h: { ...H, 'idempotency-key': 'r1' }, body: { deviceId: 'TMB-01', weightKg: 1480 } })).j; assert.strictEqual(rd2.id, rd.id);
    assert.ok((await call('/api/scale-readings', { token: T.pengepul1 })).j.some((r) => r.id === rd.id || r._id === rd.id));
    const mk = (w, n) => ({ farmerGroupId: g._id, groupCode: 'SUM-4821', weightKg: w, notaNo: n, deviceReadingId: rd.id, scalePhoto: PHOTO, notaPhoto: PHOTO });
    assert.strictEqual((await call('/api/deposits', { method: 'POST', token: T.pengepul1, body: mk(1700, 'TMB-N1') })).status, 400);
    assert.strictEqual((await call('/api/deposits', { method: 'POST', token: T.pengepul2, body: mk(1480, 'TMB-N2') })).status, 403);
    const ok = await call('/api/deposits', { method: 'POST', token: T.pengepul1, body: mk(1482, 'TMB-N3') }); assert.strictEqual(ok.status, 200); assert.strictEqual(ok.j.weightSource, 'device');
    assert.strictEqual((await call('/api/deposits', { method: 'POST', token: T.pengepul1, body: mk(1480, 'TMB-N4') })).status, 409);
  });
  await t('logistik via API: pickup lalu deliver, urutan dijaga, idempoten', async () => {
    const H = { 'x-api-key': kLog.secret }; const lg = (await call('/api/actors?role=logistik', { token: T.admin })).j[0];
    const src = (await call('/api/batches', { token: T.pengepul2 })).j.find((b) => b.status === 'available'); const gd = (await call('/api/actors?role=gudang', { token: T.pengepul2 })).j[0];
    const tr = (await call('/api/transfers', { method: 'POST', token: T.pengepul2, body: { batchId: src._id, toActorId: gd._id, carrierActorId: lg._id } })).j; assert.ok(tr.code);
    assert.strictEqual((await call(`/api/partner/transfers/${tr.code}/carrier`, { method: 'POST', h: H, body: { step: 'deliver' } })).status, 409);
    assert.strictEqual((await call(`/api/partner/transfers/${tr.code}/carrier`, { method: 'POST', h: H, body: { step: 'terbang' } })).status, 400);
    assert.strictEqual((await call(`/api/partner/transfers/${tr.code}/carrier`, { method: 'POST', h: { ...H, 'idempotency-key': 'p1' }, body: { step: 'pickup' } })).status, 200);
    assert.strictEqual((await call(`/api/partner/transfers/${tr.code}/carrier`, { method: 'POST', h: { ...H, 'idempotency-key': 'p1' }, body: { step: 'pickup' } })).j.idempotentReplay, true);
    assert.strictEqual((await call(`/api/partner/transfers/${tr.code}/carrier`, { method: 'POST', h: H, body: { step: 'deliver' } })).status, 200);
    const evs = (await call('/api/events?batchId=' + src._id, { token: T.admin })).j; assert.ok(evs.some((e) => e.type === 'CARRIER_PICKUP') && evs.some((e) => e.type === 'CARRIER_DELIVERED'));
  });
  await t('OpenAPI publik memuat jalur mitra', async () => { const sp = (await call('/api/openapi.json')).j; assert.strictEqual(sp.openapi, '3.0.3'); assert.ok(sp.paths['/partner/scale-readings'] && sp.paths['/products/{code}/passport']); });
  await t('pengguna peran kelompok tani dibuat admin, wajib kelompok', async () => {
    assert.strictEqual((await call('/api/users', { method: 'POST', token: T.admin, body: { role: 'kelompok_tani', name: 'X', email: 'xk@lestari.id', password: 'rahasia123' } })).status, 400);
    const g = (await call('/api/groups', { token: T.admin })).j[0]; const r = await call('/api/users', { method: 'POST', token: T.admin, body: { role: 'kelompok_tani', name: 'Ketua Baru', email: 'xk@lestari.id', password: 'rahasia123', groupId: g._id } }); assert.strictEqual(r.status, 200);
    const tk = await call('/api/login', { method: 'POST', body: { email: 'xk@lestari.id', password: 'rahasia123' } }); assert.strictEqual((await call('/api/farmer/summary', { token: tk.j.token })).j.group.name, g.name);
  });
  await s.close(); console.log(fails ? `\n${fails} uji gagal` : '\nSemua uji partner lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
