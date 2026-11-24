// Membersihkan data/uploads dari berkas yatim: berkas yang tidak dirujuk catatan mana pun di db.json, misalnya foto contoh
// dari data simulasi (seed-*.svg) dan foto uji yang tersisa setelah catatannya dihapus. Berguna untuk instance pilot yang
// dimulai dengan SEED_DEMO=0. Berkas identik (isi sama) yang MASIH dirujuk hanya dilaporkan, tidak diubah.
// Default hanya MENAMPILKAN rencana (dry-run). Dengan --apply berkas yatim DIPINDAHKAN (bukan dihapus) ke
// data/uploads-yatim/<waktu>/ sehingga bisa dikembalikan; hapus folder itu sendiri bila sudah yakin.
// Backend harus mati (agar unggahan yang baru masuk tidak keliru dianggap yatim). Pakai: node scripts/clean-uploads.js [--apply] [--force]
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { openOffline } = require('./_offline'); const DATA = require('../server/paths').DATA;
const apply = process.argv.includes('--apply');

(async () => {
  const { store } = await openOffline({ force: process.argv.includes('--force') }); store.flush();
  const up = path.join(DATA, 'uploads'); if (!fs.existsSync(up)) { console.log('Folder uploads tidak ada, tidak ada yang dibersihkan.'); process.exit(0); }
  const db = fs.readFileSync(path.join(DATA, 'db.json'), 'utf8'); const refs = new Set([...db.matchAll(/\/uploads\/([^"\\?\s]+)/g)].map((m) => m[1]));
  const files = fs.readdirSync(up, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  const orphans = files.filter((f) => !refs.has(f)); const kept = files.filter((f) => refs.has(f));
  const bySum = {}; for (const f of kept) { const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(up, f))).digest('hex'); (bySum[h] ||= []).push(f); }
  const dups = Object.values(bySum).filter((g) => g.length > 1);
  console.log(apply ? 'MODE TERAPKAN (--apply)' : 'DRY-RUN (tambah --apply untuk memindahkan berkas yatim)');
  console.log(`Berkas: ${files.length} · dirujuk: ${kept.length} · yatim: ${orphans.length}`);
  for (const f of orphans) console.log(`  ${apply ? 'pindah' : 'akan dipindah'} ${f} (${fs.statSync(path.join(up, f)).size} byte)`);
  for (const g of dups) console.log(`  INFO isi identik dan keduanya dirujuk (dibiarkan): ${g.join(', ')}`);
  if (apply && orphans.length) {
    const dest = path.join(DATA, 'uploads-yatim', new Date().toISOString().replace(/[:.]/g, '-')); fs.mkdirSync(dest, { recursive: true });
    for (const f of orphans) fs.renameSync(path.join(up, f), path.join(dest, f));
    console.log(`Selesai: ${orphans.length} berkas dipindah ke ${dest}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
