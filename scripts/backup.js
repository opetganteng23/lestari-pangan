// Cadangkan data runtime ke backups/<waktu>/ (db.json, ledger.json, uploads). .secret sengaja tidak ikut.
// Pakai: node scripts/backup.js [folder-tujuan]
const fs = require('fs'), path = require('path');
const DATA = require('../server/paths').DATA;
const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'backups'));
const dest = path.join(root, new Date().toISOString().replace(/[:.]/g, '-'));
if (!fs.existsSync(DATA)) { console.error('Folder data tidak ada: ' + DATA); process.exit(1); }
fs.mkdirSync(dest, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(DATA)) {
  if (f === '.secret' || f.endsWith('.tmp')) continue;
  fs.cpSync(path.join(DATA, f), path.join(dest, f), { recursive: true }); n++;
}
fs.writeFileSync(path.join(dest, 'MANIFEST.json'), JSON.stringify({ at: new Date().toISOString(), source: DATA, entries: fs.readdirSync(dest) }, null, 2));
console.log(`Cadangan dibuat: ${dest} (${n} entri)`);
