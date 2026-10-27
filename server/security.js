// Kontrol keamanan dasar (Fase 1): pembatas laju, validasi skema ringan, deteksi tipe gambar, header keamanan.
const crypto = require('crypto');

// ---------- pembatas laju (memori proses) ----------
function createLimiter({ max, windowMs }) {
  const hits = new Map();
  const sweep = setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (v.reset <= t) hits.delete(k); }, 60000); sweep.unref();
  return {
    // true = masih diizinkan. Menambah hitungan.
    hit(key) { const t = Date.now(); let v = hits.get(key); if (!v || v.reset <= t) { v = { n: 0, reset: t + windowMs }; hits.set(key, v); } v.n++; return v.n <= max; },
    blocked(key) { const v = hits.get(key); return !!v && v.reset > Date.now() && v.n >= max; },
    retryAfter(key) { const v = hits.get(key); return v ? Math.max(1, Math.ceil((v.reset - Date.now()) / 1000)) : 0; },
    clear(key) { hits.delete(key); },
  };
}

// ---------- validasi skema ----------
// schema: { field: { type:'string'|'number'|'boolean'|'array', required, min, max, enum, pattern, label } }
function validate(body, schema) {
  const out = {}; const errs = [];
  for (const [k, r] of Object.entries(schema)) {
    let v = body ? body[k] : undefined; const label = r.label || k;
    if (v === undefined || v === null || v === '') { if (r.required) errs.push(`${label} wajib diisi`); continue; }
    if (r.type === 'number') { v = Number(v); if (!Number.isFinite(v)) { errs.push(`${label} harus angka`); continue; } if (r.min != null && v < r.min) errs.push(`${label} minimal ${r.min}`); if (r.max != null && v > r.max) errs.push(`${label} maksimal ${r.max}`); }
    else if (r.type === 'boolean') v = !!v;
    else if (r.type === 'array') { if (!Array.isArray(v)) { errs.push(`${label} harus berupa daftar`); continue; } }
    else {
      if (typeof v !== 'string') { errs.push(`${label} harus teks`); continue; } v = v.trim();
      if (r.min != null && v.length < r.min) errs.push(`${label} minimal ${r.min} karakter`);
      if (r.max != null && v.length > r.max) errs.push(`${label} maksimal ${r.max} karakter`);
      if (r.pattern && !r.pattern.test(v)) errs.push(`${label} tidak valid`);
    }
    if (r.enum && !r.enum.includes(v)) errs.push(`${label} tidak valid`);
    out[k] = v;
  }
  return { ok: !errs.length, errors: errs, value: out };
}

// ---------- tipe gambar dari isi berkas ----------
function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

// ---------- kebijakan kata sandi ----------
function passwordIssue(pw) {
  pw = String(pw || '');
  if (pw.length < 8) return 'Kata sandi minimal 8 karakter';
  if (pw.length > 128) return 'Kata sandi terlalu panjang';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Kata sandi harus memuat huruf dan angka';
  return null;
}

// ---------- header keamanan ----------
function securityHeaders(req) {
  const h = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'same-origin',
    'permissions-policy': 'camera=(self), microphone=(), geolocation=(self)',
    'cross-origin-opener-policy': 'same-origin',
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  };
  if ((req.headers['x-forwarded-proto'] || '') === 'https') h['strict-transport-security'] = 'max-age=15552000; includeSubDomains';
  return h;
}

const reqId = () => crypto.randomBytes(6).toString('hex');
module.exports = { createLimiter, validate, sniffImage, passwordIssue, securityHeaders, reqId };
