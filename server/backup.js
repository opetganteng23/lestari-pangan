// Cadangan data runtime (db.json, ledger.json, uploads). .secret sengaja tidak ikut. Dipakai skrip CLI dan tombol di dashboard Server.
const fs = require('fs'), path = require('path');
const DATA = require('./paths').DATA;
const defaultRoot = () => path.resolve(process.env.LP_BACKUP_DIR || path.join(__dirname, '..', 'backups'));

function run(destRoot = defaultRoot()) {
  if (!fs.existsSync(DATA)) throw new Error('Folder data tidak ada: ' + DATA);
  const dest = path.join(destRoot, new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(DATA)) {
    if (f === '.secret' || f.endsWith('.tmp')) continue;
    fs.cpSync(path.join(DATA, f), path.join(dest, f), { recursive: true }); n++;
  }
  fs.writeFileSync(path.join(dest, 'MANIFEST.json'), JSON.stringify({ at: new Date().toISOString(), source: DATA, entries: fs.readdirSync(dest) }, null, 2));
  return { dest, entries: n, name: path.basename(dest) };
}
function list(destRoot = defaultRoot(), limit = 5) {
  if (!fs.existsSync(destRoot)) return { dir: destRoot, items: [] };
  const items = fs.readdirSync(destRoot).filter((d) => fs.existsSync(path.join(destRoot, d, 'MANIFEST.json'))).sort().reverse().slice(0, limit)
    .map((d) => { try { return { name: d, at: JSON.parse(fs.readFileSync(path.join(destRoot, d, 'MANIFEST.json'), 'utf8')).at }; } catch { return { name: d, at: null }; } });
  return { dir: destRoot, items };
}
function dirSize(p, depth = 0) {
  let t = 0; if (!fs.existsSync(p) || depth > 4) return 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); try { t += e.isDirectory() ? dirSize(f, depth + 1) : fs.statSync(f).size; } catch {} }
  return t;
}
module.exports = { run, list, dirSize, defaultRoot };
