// Uji unit modul keamanan dan auth. Jalankan: node test/unit.js
const assert = require('assert'), os = require('os'), fs = require('fs'), path = require('path');
process.env.LP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-unit-'));
const sec = require('../server/security'), auth = require('../server/auth');
let fails = 0; const t = (n, f) => { try { f(); console.log('  ok  ', n); } catch (e) { fails++; console.log('  GAGAL', n, '→', e.message); } };

t('limiter memblokir setelah max', () => { const l = sec.createLimiter({ max: 3, windowMs: 1000 }); for (let i = 0; i < 3; i++) l.hit('k'); assert.ok(l.blocked('k')); assert.ok(!l.hit('k')); l.clear('k'); assert.ok(!l.blocked('k')); });
t('limiter tidak lintas kunci', () => { const l = sec.createLimiter({ max: 1, windowMs: 1000 }); l.hit('a'); assert.ok(l.blocked('a')); assert.ok(!l.blocked('b')); });
t('validate: wajib, angka, enum, pola', () => {
  const sc = { name: { type: 'string', required: true, min: 2 }, qty: { type: 'number', min: 1 }, role: { enum: ['a', 'b'] }, code: { pattern: /^[A-Z]+$/ } };
  assert.ok(sec.validate({ name: 'Bu', qty: '3', role: 'a', code: 'ABC' }, sc).ok);
  const r = sec.validate({ name: '', qty: 0, role: 'z', code: 'abc' }, sc); assert.strictEqual(r.errors.length, 4);
  assert.strictEqual(sec.validate({ name: ' Budi ' }, sc).value.name, 'Budi');
});
t('sniffImage mengenali JPEG/PNG/WEBP dan menolak lainnya', () => {
  assert.strictEqual(sec.sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])), 'jpeg');
  assert.strictEqual(sec.sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'png');
  assert.strictEqual(sec.sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])), 'webp');
  assert.strictEqual(sec.sniffImage(Buffer.from('<?php ?>')), null);
});
t('kebijakan kata sandi', () => { assert.ok(sec.passwordIssue('pendek1')); assert.ok(sec.passwordIssue('hurufsajaaa')); assert.ok(sec.passwordIssue('12345678')); assert.strictEqual(sec.passwordIssue('abc12345'), null); });
t('header keamanan memuat CSP dan HSTS hanya di balik https', () => {
  assert.ok(sec.securityHeaders({ headers: {} })['content-security-policy']); assert.ok(!sec.securityHeaders({ headers: {} })['strict-transport-security']);
  assert.ok(sec.securityHeaders({ headers: { 'x-forwarded-proto': 'https' } })['strict-transport-security']);
});
t('hash sandi dan token', () => {
  const h = auth.hashPassword('rahasia123'); assert.ok(auth.checkPassword('rahasia123', h)); assert.ok(!auth.checkPassword('salah', h));
  const tk = auth.sign({ uid: 'u1', sv: 2 }, 60); assert.deepStrictEqual([auth.verify(tk).uid, auth.verify(tk).sv], ['u1', 2]);
  assert.strictEqual(auth.verify(tk.slice(0, -2) + 'xx'), null); assert.strictEqual(auth.verify(auth.sign({ uid: 'u1' }, -5)), null);
});
console.log(fails ? `\n${fails} uji gagal` : '\nSemua uji unit lulus'); process.exit(fails ? 1 : 0);
