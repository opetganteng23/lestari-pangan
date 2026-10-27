const crypto = require('crypto'), fs = require('fs'), path = require('path');
const DATA = require('./paths').DATA;
fs.mkdirSync(DATA, { recursive: true });
const secretFile = path.join(DATA, '.secret');
const SECRET = process.env.APP_SECRET || (fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8') : (() => { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(secretFile, s); return s; })());
const b64 = (b) => Buffer.from(b).toString('base64url');
function hashPassword(pw) { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`; }
function checkPassword(pw, stored) {
  const [salt, h] = String(stored).split(':'); if (!salt || !h) return false;
  const x = crypto.scryptSync(pw, salt, 32); const y = Buffer.from(h, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function sign(payload, ttlSec) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  return `${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}
function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const exp = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.exp > Date.now() / 1000 ? p : null;
}
// URL bertanda tangan berumur pendek untuk berkas bukti (foto nota/timbangan)
function signUrl(p, ttlSec = 900) { const e = Math.floor(Date.now() / 1000) + ttlSec; const s = crypto.createHmac('sha256', SECRET).update(p + '|' + e).digest('base64url'); return p + '?e=' + e + '&s=' + s; }
function verifyUrl(p, e, s) { if (!e || !s || +e < Date.now() / 1000) return false; const x = crypto.createHmac('sha256', SECRET).update(p + '|' + e).digest('base64url'); return s.length === x.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(x)); }
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
module.exports = { signUrl, verifyUrl, hashPassword, checkPassword, sign, verify, sha256 };
