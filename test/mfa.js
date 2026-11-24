process.env.LP_SKIP_DOTENV = '1';
// Uji MFA TOTP super admin: pengaturan, login, Mode Tindak, pemulihan, pembatasan. Jalankan: node test/mfa.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert');
process.env.LOG = '0'; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-mfa-')); process.env.LP_DATA_DIR = dir;
const { start } = require('../server/index.js'); const TOTP = require('../server/totp');
(async () => {
  // hindari batas langkah 30 detik di tengah uji (kode memakai langkah cur-1, cur, cur+1 secara berurutan)
  const w = 30000 - (Date.now() % 30000); if (w < 8000) await new Promise((r) => setTimeout(r, w + 200));
  const s = await start({ port: 0 }); const base = 'http://localhost:' + s.server.address().port; let fails = 0;
  const call = async (p, { method = 'GET', body, token, h = {} } = {}) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...h }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
  const login = (email, password, otp) => call('/api/login', { method: 'POST', body: { email, password, ...(otp ? { otp } : {}) } });
  const t = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
  const SA = 'sa@lestari.id', PW = 'lestari123'; let tok = (await login(SA, PW)).j.token; const admin = (await login('admin@lestari.id', PW)).j.token;
  const pe = (await call('/api/sa/actors', { token: tok })).j.find((a) => a.name === 'CV Tani Makmur'); let secret, recovery; const REASON = 'Pengepul tidak dapat mengakses aplikasi';
  const at = (d) => TOTP.codeAt(secret, Date.now() + d * 30000);

  await t('belum ada MFA: login biasa jalan, tetapi Mode Tindak ditolak dengan petunjuk', async () => {
    const r = await call('/api/sa/act', { method: 'POST', token: tok, body: { actorId: pe._id, reason: REASON, password: PW, otp: '123456' } }); assert.strictEqual(r.status, 403); assert.match(r.j.error, /MFA/);
    assert.deepStrictEqual((await call('/api/me', { token: tok })).j.mfa, { enabled: false, recoveryLeft: 0 }); assert.strictEqual((await call('/api/me', { token: admin })).j.mfa, null);
  });
  await t('hanya super admin boleh mengatur MFA; setup butuh kata sandi', async () => {
    assert.strictEqual((await call('/api/me/mfa/setup', { method: 'POST', token: admin, body: { password: PW } })).status, 403);
    assert.strictEqual((await call('/api/me/mfa/setup', { method: 'POST', token: tok, body: { password: 'salah' } })).status, 403);
    assert.strictEqual((await call('/api/me/mfa/enable', { method: 'POST', token: tok, body: { code: '123456' } })).status, 400, 'enable tanpa setup');
  });
  await t('setup memberi rahasia + QR; enable menolak kode salah dan menerima kode benar', async () => {
    const r = await call('/api/me/mfa/setup', { method: 'POST', token: tok, body: { password: PW } }); assert.strictEqual(r.status, 200); secret = r.j.secret; assert.match(secret, /^[A-Z2-7]{32}$/); assert.ok(r.j.qr.startsWith('<svg') && r.j.otpauth.startsWith('otpauth://totp/'));
    assert.deepStrictEqual((await call('/api/me', { token: tok })).j.mfa, { enabled: false, recoveryLeft: 0 }, 'belum aktif sebelum kode dikonfirmasi');
    assert.strictEqual((await call('/api/me/mfa/enable', { method: 'POST', token: tok, body: { code: '000000' } })).status, 400);
    const en = await call('/api/me/mfa/enable', { method: 'POST', token: tok, body: { code: at(-1) } }); assert.strictEqual(en.status, 200); recovery = en.j.recoveryCodes; assert.strictEqual(recovery.length, 8);
    assert.strictEqual((await call('/api/me', { token: tok })).status, 401, 'token lama dicabut'); tok = en.j.token; assert.deepStrictEqual((await call('/api/me', { token: tok })).j.mfa, { enabled: true, recoveryLeft: 8 });
    assert.strictEqual((await call('/api/me/mfa/setup', { method: 'POST', token: tok, body: { password: PW } })).status, 409, 'tidak bisa setup ulang saat aktif');
  });
  await t('rahasia dan kode pemulihan tidak tersimpan polos dan tidak bocor lewat API', async () => {
    s.D.store.flush(); const raw = fs.readFileSync(path.join(dir, 'db.json'), 'utf8'); assert.ok(!raw.includes(secret), 'rahasia TOTP polos di berkas'); for (const c of recovery) assert.ok(!raw.includes(c), 'kode pemulihan polos');
    for (const p of ['/api/me', '/api/users']) assert.ok(!JSON.stringify((await call(p, { token: p === '/api/me' ? tok : admin })).j).match(/secret|pending|recovery"/), p);
  });
  await t('login: sandi benar tanpa kode → 401 mfaRequired; kode salah ditolak; kode benar masuk', async () => {
    const a = await login(SA, PW); assert.strictEqual(a.status, 401); assert.strictEqual(a.j.mfaRequired, true); assert.ok(!a.j.token);
    const b = await login(SA, PW, '000000'); assert.strictEqual(b.status, 401); assert.strictEqual(b.j.mfaRequired, true);
    const c = await login(SA, 'salah', at(0)); assert.strictEqual(c.status, 401); assert.ok(!c.j.mfaRequired, 'sandi salah tidak membocorkan status MFA');
    const d = await login(SA, PW, at(0)); assert.strictEqual(d.status, 200); assert.ok(d.j.token);
  });
  await t('kode TOTP yang sama tidak bisa dipakai dua kali (replay)', async () => { assert.strictEqual((await login(SA, PW, at(0))).status, 401); });
  await t('akun non-super admin tidak terpengaruh', async () => { assert.strictEqual((await login('admin@lestari.id', PW)).status, 200); });
  await t('Mode Tindak: tanpa kode / kode salah ditolak, kode benar berhasil', async () => {
    const act = (otp) => call('/api/sa/act', { method: 'POST', token: tok, body: { actorId: pe._id, reason: REASON, password: PW, ...(otp ? { otp } : {}) } });
    const a = await act(); assert.strictEqual(a.status, 403); assert.strictEqual(a.j.mfaRequired, true); assert.strictEqual((await act('111111')).status, 403);
    const ok = await act(at(1)); assert.strictEqual(ok.status, 200, JSON.stringify(ok.j)); assert.strictEqual((await call('/api/me', { token: tok, h: { 'x-act-token': ok.j.token } })).j.role, 'pengepul');
  });
  await t('kode pemulihan: berlaku sekali untuk login', async () => {
    const a = await login(SA, PW, recovery[0]); assert.strictEqual(a.status, 200); assert.strictEqual((await login(SA, PW, recovery[0])).status, 401, 'sekali pakai');
    const b = await login(SA, PW, recovery[1].toUpperCase().replace('-', '')); assert.strictEqual(b.status, 200, 'huruf besar/tanpa strip tetap diterima'); assert.strictEqual((await call('/api/me', { token: tok })).j.mfa.recoveryLeft, 6);
  });
  await t('salah kode berulang pada login mengunci sementara (429)', async () => {
    let last; for (let i = 0; i < 6; i++) last = await login(SA, PW, '999999'); assert.strictEqual(last.status, 429);
    assert.strictEqual((await login(SA, PW, recovery[2])).status, 429, 'bahkan kode benar ditolak selama terkunci');
  });
  await t('nonaktifkan MFA butuh sandi + kode; sesudahnya Mode Tindak kembali ditolak', async () => {
    assert.strictEqual((await call('/api/me/mfa/disable', { method: 'POST', token: tok, body: { password: 'salah', code: recovery[2] } })).status, 403);
    assert.strictEqual((await call('/api/me/mfa/disable', { method: 'POST', token: tok, body: { password: PW, code: '222222' } })).status, 403);
    const d = await call('/api/me/mfa/disable', { method: 'POST', token: tok, body: { password: PW, code: recovery[2] } }); assert.strictEqual(d.status, 200, JSON.stringify(d.j)); tok = d.j.token;
    assert.deepStrictEqual((await call('/api/me', { token: tok })).j.mfa, { enabled: false, recoveryLeft: 0 });
    assert.strictEqual((await call('/api/sa/act', { method: 'POST', token: tok, body: { actorId: pe._id, reason: REASON, password: PW, otp: at(0) } })).status, 403);
    assert.ok((await s.D.col.auditLogs.find({})).some((l) => l.action === 'mfa.nonaktif'));
  });
  console.log(fails ? `\n${fails} GAGAL` : '\nSemua lulus'); process.exit(fails ? 1 : 0);
})();
