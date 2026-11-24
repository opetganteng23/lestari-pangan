process.env.LP_SKIP_DOTENV = '1';
// Uji scripts/create-admin.js: idempoten, non-interaktif lewat ADMIN_EMAIL/ADMIN_PASSWORD, tidak membocorkan sandi, patuh kebijakan sandi.
// Sandi dibuat acak saat tes berjalan (tidak ada sandi nyata di berkas ini). Jalankan: node test/create-admin.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process'), crypto = require('crypto');
process.env.LOG = '0'; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-adm-')); process.env.LP_DATA_DIR = dir;
const { start } = require('../server/index.js');
const rnd = () => 'Uji' + crypto.randomBytes(9).toString('hex') + '7';
const run = (env) => cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'create-admin.js')], { env: { ...process.env, LP_SKIP_DOTENV: '1', LP_DATA_DIR: dir, ...env }, encoding: 'utf8', input: '' });
const read = () => JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
(async () => {
  let fails = 0; const t = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
  const EM = 'pemilik@contoh.id'; const p1 = rnd(), p2 = rnd();
  const login = async (base, password) => (await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EM, password }) })).status;
  const withServer = async (fn) => { const s = await start({ port: 0 }); try { await fn('http://localhost:' + s.server.address().port); } finally { await s.close(); } };
  await t('membuat super admin dari variabel lingkungan; sandi tidak tercetak maupun tertulis di data', () => {
    const r = run({ ADMIN_EMAIL: EM, ADMIN_PASSWORD: p1 }); assert.strictEqual(r.status, 0, r.stderr); assert.match(r.stdout, /dibuat/); assert.ok(!(r.stdout + r.stderr).includes(p1));
    const u = read().users.find((x) => x.email === EM); assert.ok(u && u.role === 'superadmin' && u.active === true); assert.ok(!JSON.stringify(read()).includes(p1)); assert.ok(read().auditLogs.some((a) => a.action === 'admin.buat'));
  });
  await t('akun hasilnya bisa login (jaminan ada super admin aktif sebelum akun lain dinonaktifkan)', () => withServer(async (base) => { assert.strictEqual(await login(base, p1), 200); assert.strictEqual(await login(base, p2), 401); }));
  await t('idempoten: menjalankan lagi memperbarui sandi, memastikan role+aktif, mencabut sesi lama, MFA tidak disentuh', () => {
    const d = read(); const u = d.users.find((x) => x.email === EM); u.role = 'admin'; u.active = false; u.mfa = { enabled: true, secret: 'x' }; const sv0 = u.sv || 0; fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(d));
    const r = run({ ADMIN_EMAIL: EM, ADMIN_PASSWORD: p2 }); assert.strictEqual(r.status, 0, r.stderr); assert.match(r.stdout, /diperbarui/);
    const n = read().users.filter((x) => x.email === EM); assert.strictEqual(n.length, 1); assert.ok(n[0].role === 'superadmin' && n[0].active === true && n[0].sv === sv0 + 1 && n[0].mfa && n[0].mfa.enabled === true);
  });
  await t('sandi baru berlaku, sandi lama tidak (login dengan MFA aktif meminta kode, bukan menolak sandi)', () => withServer(async (base) => {
    const r2 = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EM, password: p2 }) }); const j2 = await r2.json(); assert.strictEqual(r2.status, 401); assert.strictEqual(j2.mfaRequired, true);
    const r1 = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EM, password: p1 }) }); const j1 = await r1.json(); assert.strictEqual(r1.status, 401); assert.ok(!j1.mfaRequired);
  }));
  await t('sandi lemah ditolak (kebijakan tidak dilonggarkan) dan akun tidak berubah', () => {
    const before = JSON.stringify(read().users.find((x) => x.email === EM)); const r = run({ ADMIN_EMAIL: EM, ADMIN_PASSWORD: 'abc' }); assert.notStrictEqual(r.status, 0); assert.match(r.stderr, /ditolak/); assert.strictEqual(JSON.stringify(read().users.find((x) => x.email === EM)), before);
  });
  await t('email tidak valid ditolak', () => { const r = run({ ADMIN_EMAIL: 'bukan-email', ADMIN_PASSWORD: rnd() }); assert.notStrictEqual(r.status, 0); });
  console.log(fails ? fails + ' gagal' : 'Semua lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
