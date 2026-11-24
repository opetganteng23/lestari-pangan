// Migrasi koordinat: pelaku dan kelompok tani yang koordinatnya masih titik default lama (-6.6/107.6 untuk pelaku, -6.55/107.7
// untuk kelompok, hasil isian diam-diam sebelum wilayah wajib) dipindahkan ke titik wilayahnya. Bila wilayahnya tidak dikenal,
// koordinat DIKOSONGKAN (null) supaya tidak muncul di tempat palsu di peta; admin lalu mengisi wilayahnya.
// Titik selain default tidak disentuh. Default hanya MENAMPILKAN rencana (dry-run); terapkan dengan --apply setelah `npm run backup`.
// Pakai: node scripts/fix-region-coords.js [--apply] [--force]
const { openOffline } = require('./_offline'); const REG = require('../server/regions');
const apply = process.argv.includes('--apply');

(async () => {
  const { store, D, col } = await openOffline({ force: process.argv.includes('--force') });
  const [actors, groups] = await Promise.all([col.actors.find({}), col.farmerGroups.find({})]);
  let moved = 0, cleared = 0, unknown = 0;
  console.log(apply ? 'MODE TERAPKAN (--apply)' : 'DRY-RUN (tambah --apply untuk menerapkan)');
  for (const [kind, rows, table] of [['pelaku', actors, col.actors], ['kelompok', groups, col.farmerGroups]]) {
    for (const x of rows) {
      const p = REG.locate(x.district, { keepKecamatan: kind === 'kelompok' });
      if (!REG.isLegacyDefault(x.lat, x.lng)) { if (!p && x.district) { unknown++; console.log(`  PERIKSA ${kind} "${x.name}": wilayah "${x.district}" tidak ada di daftar resmi (koordinat dibiarkan)`); } continue; }
      if (p) { moved++; console.log(`  ${apply ? 'pindah' : 'akan dipindah'} ${kind} "${x.name}": titik default → ${p.region.name}`); if (apply) await table.update({ _id: x._id }, { lat: p.lat, lng: p.lng }); }
      else { cleared++; console.log(`  ${apply ? 'kosongkan' : 'akan dikosongkan'} koordinat ${kind} "${x.name}" (wilayah "${x.district || ''}" tidak dikenal, admin perlu mengisi wilayah)`); if (apply) await table.update({ _id: x._id }, { lat: null, lng: null }); }
    }
  }
  console.log(`Ringkasan: ${moved} dipindah ke titik wilayah, ${cleared} dikosongkan, ${unknown} perlu diperiksa.`);
  if (apply && (moved || cleared)) { await D.audit({ user: { _id: 'system', name: 'Skrip perawatan', role: 'system' } }, 'koordinat.migrasi', `${moved} dipindah, ${cleared} dikosongkan`); store.flush(); console.log('Selesai. Nyalakan ulang backend.'); }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
