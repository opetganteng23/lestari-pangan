// Cadangkan data runtime ke backups/<waktu>/ (atau LP_BACKUP_DIR).
// Pakai: node scripts/backup.js [folder-tujuan] [--keep N]
//   --keep N (atau LP_BACKUP_KEEP=N): setelah mencadangkan, simpan hanya N cadangan terbaru dan hapus yang lebih lama. 0/kosong = simpan semua.
require('../server/env');
const path = require('path'), b = require('../server/backup');
const args = process.argv.slice(2); const ki = args.indexOf('--keep'); const keep = Math.floor(+(ki >= 0 ? args[ki + 1] : process.env.LP_BACKUP_KEEP) || 0);
const dir = args.find((a, i) => !a.startsWith('--') && (ki < 0 || i !== ki + 1));
try {
  const root = dir ? path.resolve(dir) : undefined; const r = b.run(root); console.log('Cadangan dibuat: ' + r.dest + ' (' + r.entries + ' entri)');
  if (keep > 0) { const p = b.prune(root, keep); console.log(p.removed.length ? `Cadangan lama dihapus (simpan ${keep} terbaru): ${p.removed.join(', ')}` : `Tidak ada cadangan lama untuk dihapus (batas ${keep}).`); }
} catch (e) { console.error(e.message); process.exit(1); }
