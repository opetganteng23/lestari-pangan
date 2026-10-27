// Pulihkan data dari folder cadangan. HENTIKAN server dulu. Data saat ini dipindah ke data.sebelum-restore-<waktu>.
// Pakai: node scripts/restore.js <folder-cadangan> --yes
const fs = require('fs'), path = require('path');
const DATA = require('../server/paths').DATA;
const src = process.argv[2] && path.resolve(process.argv[2]);
if (!src || !fs.existsSync(path.join(src, 'MANIFEST.json'))) { console.error('Beri folder cadangan yang berisi MANIFEST.json'); process.exit(1); }
if (!process.argv.includes('--yes')) { console.error('Tambahkan --yes untuk memastikan. Server harus berhenti.'); process.exit(1); }
const keepSecret = path.join(DATA, '.secret'), secret = fs.existsSync(keepSecret) ? fs.readFileSync(keepSecret) : null;
if (fs.existsSync(DATA)) fs.renameSync(DATA, DATA + '.sebelum-restore-' + Date.now());
fs.mkdirSync(DATA, { recursive: true });
for (const f of fs.readdirSync(src)) if (f !== 'MANIFEST.json') fs.cpSync(path.join(src, f), path.join(DATA, f), { recursive: true });
if (secret) fs.writeFileSync(path.join(DATA, '.secret'), secret);
console.log('Pemulihan selesai dari ' + src);
