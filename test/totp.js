process.env.LP_SKIP_DOTENV = '1';
// Uji TOTP dengan vektor resmi RFC 6238 (Lampiran B, SHA-1). Jalankan: node test/totp.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert');
process.env.LP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-totp-'));
const T = require('../server/totp'); let fails = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
const RFC = T.b32encode(Buffer.from('12345678901234567890'));

t('vektor RFC 6238 (6 digit)', () => {
  for (const [sec, code] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']]) assert.strictEqual(T.codeAt(RFC, sec * 1000), code, 'detik ' + sec);
});
t('base32 bolak-balik dan menolak karakter asing', () => {
  const b = Buffer.from([1, 2, 3, 250, 251, 252, 0, 99]); assert.deepStrictEqual(T.b32decode(T.b32encode(b)), b); assert.throws(() => T.b32decode('ABC1!'));
  assert.deepStrictEqual(T.b32decode('gezd gnbv-gy3t'), T.b32decode('GEZDGNBVGY3T'));
});
t('verify: toleransi ±1 langkah, di luar itu ditolak', () => {
  const now = 1234567890 * 1000, c = (d) => T.codeAt(RFC, now + d * 30000);
  assert.ok(T.verify(RFC, c(0), { now }) != null); assert.ok(T.verify(RFC, c(-1), { now }) != null); assert.ok(T.verify(RFC, c(1), { now }) != null);
  assert.strictEqual(T.verify(RFC, c(2), { now }), null); assert.strictEqual(T.verify(RFC, c(-2), { now }), null);
});
t('verify: format salah ditolak, spasi diabaikan', () => {
  const now = 59000; assert.strictEqual(T.verify(RFC, '12345', { now }), null); assert.strictEqual(T.verify(RFC, 'abcdef', { now }), null); assert.strictEqual(T.verify(RFC, '', { now }), null);
  assert.ok(T.verify(RFC, '287 082', { now }) != null);
});
t('verify: kode yang sama tidak bisa dipakai ulang (after)', () => {
  const now = 59000, s = T.verify(RFC, '287082', { now }); assert.ok(s != null); assert.strictEqual(T.verify(RFC, '287082', { now, after: s }), null);
});
t('rahasia dienkripsi: bolak-balik, tidak terbaca, dan diubah = ditolak', () => {
  const sec = T.newSecret(); assert.match(sec, /^[A-Z2-7]{32}$/); const s = T.seal(sec); assert.ok(!s.includes(sec)); assert.strictEqual(T.open(s), sec);
  assert.notStrictEqual(T.seal(sec), s, 'IV acak'); const parts = s.split('.'); parts[2] = Buffer.from('x' + Buffer.from(parts[2], 'base64url').toString('latin1').slice(1), 'latin1').toString('base64url'); assert.throws(() => T.open(parts.join('.')));
});
t('otpauth dan kode pemulihan', () => {
  const u = T.otpauth('a@b.id', 'ABCDEFGH'); assert.ok(u.startsWith('otpauth://totp/LestariPangan:a%40b.id?secret=ABCDEFGH') && u.includes('period=30'));
  const r = T.recoveryCodes(); assert.strictEqual(new Set(r).size, 8); assert.match(r[0], /^[0-9a-f]{5}-[0-9a-f]{5}$/); assert.strictEqual(T.hashRecovery(r[0]), T.hashRecovery(r[0].toUpperCase().replace('-', ' ')));
});
console.log(fails ? `\n${fails} GAGAL` : '\nSemua lulus'); process.exit(fails ? 1 : 0);
