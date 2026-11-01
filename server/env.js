// Memuat berkas .env di akar proyek (tanpa dependensi). Variabel yang sudah ada di lingkungan tidak ditimpa.
const fs = require('fs'), path = require('path');
function parse(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('='); if (i < 1) continue;
    const k = line.slice(0, i).trim(); let v = line.slice(i + 1).trim();
    const q = v[0];
    if ((q === '"' || q === "'") && v.indexOf(q, 1) > 0) v = v.slice(1, v.indexOf(q, 1)); // nilai berkutip: ambil isi di antara kutip, abaikan komentar sesudahnya
    else v = v.replace(/\s+#.*$/, '');
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) out[k] = v;
  }
  return out;
}
function load(file = path.join(__dirname, '..', '.env')) {
  if (!fs.existsSync(file)) return {};
  const vars = parse(fs.readFileSync(file, 'utf8'));
  for (const [k, v] of Object.entries(vars)) if (process.env[k] === undefined && v !== '') process.env[k] = v;
  return vars;
}
if (!process.env.LP_SKIP_DOTENV) load();
module.exports = { parse, load };
