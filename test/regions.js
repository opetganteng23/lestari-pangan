process.env.LP_SKIP_DOTENV = '1';
// Uji wilayah: daftar resmi, penolakan wilayah tak dikenal, koordinat diturunkan dari wilayah (bukan default/klien), migrasi. Jalankan: node test/regions.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
process.env.LOG = '0'; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-reg-')); process.env.LP_DATA_DIR = dir;
const R = require('../server/regions'); const { start } = require('../server/index.js');
(async () => {
  const s = await start({ port: 0 }); const base = 'http://localhost:' + s.server.address().port; let fails = 0;
  const call = async (p, { method = 'GET', body, token } = {}) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, j }; };
  const login = async (e) => (await call('/api/login', { method: 'POST', body: { email: e, password: 'lestari123' } })).j.token;
  const t = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
  const admin = await login('admin@lestari.id'); const sub = R.REGIONS.find((r) => r.name === 'Kabupaten Subang');

  await t('daftar wilayah: nama unik, koordinat masuk akal, id unik', () => {
    assert.ok(R.REGIONS.length >= 30); assert.strictEqual(new Set(R.REGIONS.map((r) => r.id)).size, R.REGIONS.length); assert.strictEqual(new Set(R.REGIONS.map((r) => r.name)).size, R.REGIONS.length);
    for (const r of R.REGIONS) assert.ok(r.lat < -5.5 && r.lat > -8 && r.lng > 105.9 && r.lng < 109.1, r.name);
  });
  await t('penguraian: penulisan lama dikenali, wilayah asing ditolak', () => {
    assert.strictEqual(R.locate('Subang').district, 'Kabupaten Subang'); assert.strictEqual(R.locate('kab. subang').district, 'Kabupaten Subang');
    assert.strictEqual(R.locate('Bandung').district, 'Kota Bandung'); assert.strictEqual(R.locate('Kabupaten Bandung').district, 'Kabupaten Bandung');
    assert.strictEqual(R.locate('Pagaden, Subang', { keepKecamatan: true }).district, 'Pagaden, Kabupaten Subang'); assert.strictEqual(R.locate('Pagaden, Subang').district, 'Kabupaten Subang');
    assert.strictEqual(R.locate('Atlantis'), null); assert.strictEqual(R.locate(''), null); assert.strictEqual(R.locate(null), null);
  });
  await t('GET /api/regions terbuka (dipakai form daftar) dan berisi koordinat', async () => {
    const r = await call('/api/regions'); assert.strictEqual(r.status, 200); const x = r.j.find((q) => q.name === 'Kabupaten Subang'); assert.ok(x && x.lat === sub.lat && x.lng === sub.lng && x.province === 'Jawa Barat');
  });
  await t('daftar: wilayah wajib, wilayah asing ditolak, koordinat dari wilayah (bukan masukan klien)', async () => {
    const code = (await call('/api/referrals', { method: 'POST', token: admin, body: { role: 'pengepul', maxUses: 5 } })).j.code; const b = { code, name: 'CV Wilayah', email: 'wil@x.id', password: 'sandi12345' };
    assert.strictEqual((await call('/api/register', { method: 'POST', body: b })).status, 400);
    const bad = await call('/api/register', { method: 'POST', body: { ...b, district: 'Atlantis' } }); assert.strictEqual(bad.status, 400); assert.match(bad.j.error, /tidak dikenal/);
    assert.strictEqual((await call('/api/register', { method: 'POST', body: { ...b, district: 'Subang', lat: 10, lng: 10 } })).status, 200);
    const a = (await call('/api/actors', { token: admin })).j.find((x) => x.name === 'CV Wilayah'); assert.deepStrictEqual([a.district, a.lat, a.lng], ['Kabupaten Subang', sub.lat, sub.lng]);
  });
  await t('buat pengguna & ubah wilayah: koordinat ikut wilayah, wilayah asing ditolak', async () => {
    const b = { role: 'gudang', name: 'Gudang Wil', email: 'gw@x.id', password: 'sandi12345' };
    assert.strictEqual((await call('/api/users', { method: 'POST', token: admin, body: b })).status, 400); assert.strictEqual((await call('/api/users', { method: 'POST', token: admin, body: { ...b, district: 'Nowhere' } })).status, 400);
    const c = await call('/api/users', { method: 'POST', token: admin, body: { ...b, district: 'Karawang' } }); assert.strictEqual(c.status, 200);
    assert.strictEqual((await call('/api/users/' + c.j._id, { method: 'PUT', token: admin, body: { district: 'Nowhere' } })).status, 400);
    assert.strictEqual((await call('/api/users/' + c.j._id, { method: 'PUT', token: admin, body: { district: 'Indramayu' } })).status, 200);
    const a = (await call('/api/actors', { token: admin })).j.find((x) => x.name === 'Gudang Wil'); const ind = R.REGIONS.find((r) => r.name === 'Kabupaten Indramayu'); assert.deepStrictEqual([a.district, a.lat, a.lng], [ind.name, ind.lat, ind.lng]);
  });
  await t('kelompok tani: wilayah wajib & dikenal, kecamatan dipertahankan, lat/lng masukan diabaikan, ubah wilayah memindahkan titik', async () => {
    const b = { name: 'KT Wilayah', ketua: 'K', village: 'Desa', hectares: 5 };
    assert.strictEqual((await call('/api/groups', { method: 'POST', token: admin, body: b })).status, 400); assert.strictEqual((await call('/api/groups', { method: 'POST', token: admin, body: { ...b, district: 'Atlantis' } })).status, 400);
    const r = await call('/api/groups', { method: 'POST', token: admin, body: { ...b, district: 'Subang', kecamatan: 'Pagaden', lat: 1, lng: 1 } }); assert.strictEqual(r.status, 200);
    const dash = (await call('/api/dashboard', { token: admin })).j; const p = dash.points.find((x) => x.name === 'KT Wilayah'); assert.deepStrictEqual([p.district, p.lat, p.lng], ['Pagaden, Kabupaten Subang', sub.lat, sub.lng]);
    const id = r.j.group._id; assert.strictEqual((await call('/api/groups/' + id, { method: 'PUT', token: admin, body: { lat: 5, lng: 5 } })).status, 200);
    const p2 = (await call('/api/dashboard', { token: admin })).j.points.find((x) => x.name === 'KT Wilayah'); assert.deepStrictEqual([p2.lat, p2.lng], [sub.lat, sub.lng]);
    assert.strictEqual((await call('/api/groups/' + id, { method: 'PUT', token: admin, body: { district: 'Karawang' } })).status, 200);
    const kr = R.REGIONS.find((q) => q.name === 'Kabupaten Karawang'); const p3 = (await call('/api/dashboard', { token: admin })).j.points.find((x) => x.name === 'KT Wilayah'); assert.deepStrictEqual([p3.district, p3.lat, p3.lng], ['Kabupaten Karawang', kr.lat, kr.lng]);
  });
  const col = s.D.col;
  const mk = (name, district, lat, lng) => col.actors.insert({ name, role: 'pengepul', district, lat, lng });
  const a1 = await mk('Mig Default Dikenal', 'Subang', -6.6, 107.6), a2 = await mk('Mig Default Asing', 'Atlantis', -6.6, 107.6), a3 = await mk('Mig Titik Sendiri', 'Subang', -6.1, 107.1);
  const g1 = await col.farmerGroups.insert({ name: 'Mig KT', district: 'Pagaden, Subang', lat: -6.55, lng: 107.7, active: true });
  await s.close();
  const run = (...args) => cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'fix-region-coords.js'), ...args], { env: { ...process.env, LP_SKIP_DOTENV: '1', LP_DATA_DIR: dir }, encoding: 'utf8' });
  const read = () => JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
  await t('migrasi: dry-run tidak mengubah apa pun', () => {
    const r = run(); assert.strictEqual(r.status, 0, r.stderr); assert.match(r.stdout, /DRY-RUN/); const d = read(); assert.strictEqual(d.actors.find((x) => x._id === a1._id).lat, -6.6); assert.strictEqual(d.actors.find((x) => x._id === a2._id).lat, -6.6);
  });
  await t('migrasi: default dikenal → titik wilayah; asing → dikosongkan; titik sendiri tak disentuh; kelompok ikut; idempoten', () => {
    const r = run('--apply'); assert.strictEqual(r.status, 0, r.stderr); const d = read(); const A = (id) => d.actors.find((x) => x._id === id);
    assert.deepStrictEqual([A(a1._id).lat, A(a1._id).lng], [sub.lat, sub.lng]); assert.strictEqual(A(a2._id).lat, null); assert.strictEqual(A(a2._id).lng, null); assert.deepStrictEqual([A(a3._id).lat, A(a3._id).lng], [-6.1, 107.1]);
    const G = d.farmerGroups.find((x) => x._id === g1._id); assert.deepStrictEqual([G.lat, G.lng], [sub.lat, sub.lng]); assert.ok(d.auditLogs.some((x) => x.action === 'koordinat.migrasi'));
    assert.match(run('--apply').stdout, /0 dipindah ke titik wilayah, 0 dikosongkan/);
  });
  console.log(fails ? fails + ' gagal' : 'Semua lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
