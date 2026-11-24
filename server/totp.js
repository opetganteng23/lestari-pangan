// TOTP (RFC 6238) tanpa dependensi: SHA-1, 6 digit, langkah 30 detik, kompatibel dengan Google Authenticator/Authy/1Password.
// Rahasia disimpan terenkripsi (AES-256-GCM, kunci diturunkan dari APP_SECRET) sehingga berkas data saja tidak cukup untuk menirunya.
const crypto = require('crypto'); const auth = require('./auth');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', STEP = 30;

function b32encode(buf) { let bits = 0, v = 0, out = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(v << (5 - bits)) & 31]; return out; }
function b32decode(s) { s = String(s).toUpperCase().replace(/[\s=-]/g, ''); let bits = 0, v = 0; const out = []; for (const ch of s) { const i = B32.indexOf(ch); if (i < 0) throw new Error('Rahasia TOTP tidak valid'); v = (v << 5) | i; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }

function hotp(key, counter, digits = 6) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter)); const h = crypto.createHmac('sha1', key).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
}
const stepAt = (ms) => Math.floor(ms / 1000 / STEP);
const codeAt = (secret, ms = Date.now()) => hotp(b32decode(secret), stepAt(ms));

// Mengembalikan nomor langkah yang cocok (untuk mencegah kode yang sama dipakai dua kali) atau null. Toleransi ±1 langkah.
function verify(secret, code, { now = Date.now(), window = 1, after = -1 } = {}) {
  code = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(code)) return null;
  const key = b32decode(secret), cur = stepAt(now); let hit = null;
  for (let s = cur - window; s <= cur + window; s++) { const ok = crypto.timingSafeEqual(Buffer.from(hotp(key, s)), Buffer.from(code)); if (ok && s > after) hit = s; }
  return hit;
}
const newSecret = () => b32encode(crypto.randomBytes(20));
const otpauth = (label, secret, issuer = 'LestariPangan') => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;

const key = () => auth.derive('mfa-secret-v1');
function seal(secret) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(), iv), ct = Buffer.concat([c.update(secret, 'utf8'), c.final()]); return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.'); }
function open(sealed) { const [iv, tag, ct] = String(sealed).split('.').map((x) => Buffer.from(x, 'base64url')); const d = crypto.createDecipheriv('aes-256-gcm', key(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(ct), d.final()]).toString('utf8'); }

// kode pemulihan: 8 kode sekali pakai, disimpan sebagai hash
const recoveryCodes = (n = 8) => Array.from({ length: n }, () => { const r = crypto.randomBytes(5).toString('hex'); return r.slice(0, 5) + '-' + r.slice(5); });
const hashRecovery = (c) => auth.sha256('rec|' + String(c).toLowerCase().replace(/[^a-z0-9]/g, ''));

module.exports = { b32encode, b32decode, hotp, codeAt, verify, newSecret, otpauth, seal, open, recoveryCodes, hashRecovery, STEP };
