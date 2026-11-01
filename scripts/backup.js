// Cadangkan data runtime ke backups/<waktu>/ (atau LP_BACKUP_DIR). Pakai: node scripts/backup.js [folder-tujuan]
require('../server/env');
const b = require('../server/backup');
try { const r = b.run(process.argv[2] ? require('path').resolve(process.argv[2]) : undefined); console.log('Cadangan dibuat: ' + r.dest + ' (' + r.entries + ' entri)'); } catch (e) { console.error(e.message); process.exit(1); }
