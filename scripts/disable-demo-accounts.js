// Menonaktifkan akun demo (@lestari.id): active:false dan sv dinaikkan agar sesi yang masih berlaku dicabut.
// Idempoten, hanya menyentuh email @lestari.id, tidak menghapus apa pun.
// Pakai: node scripts/disable-demo-accounts.js [--dry-run] [--force]
// Penjaga: menolak jalan bila setelahnya tidak ada super admin aktif di luar @lestari.id (agar tidak terkunci).
const { openOffline } = require('./_offline');
const DEMO = /@lestari\.id$/i;
const dry = process.argv.includes('--dry-run');

(async () => {
  const { store, D, col } = await openOffline({ force: process.argv.includes('--force') });
  const users = await col.users.find({});
  const keep = users.filter((u) => !DEMO.test(u.email) && u.role === 'superadmin' && u.active !== false);
  if (!keep.length) { console.error('Dibatalkan: tidak ada super admin aktif di luar @lestari.id. Buat dulu: node scripts/create-admin.js email@anda.id'); process.exit(1); }
  const todo = users.filter((u) => DEMO.test(u.email) && u.active !== false), already = users.filter((u) => DEMO.test(u.email) && u.active === false);
  console.log(`Super admin non-demo aktif: ${keep.length}. Akun demo aktif: ${todo.length}. Sudah nonaktif: ${already.length}.`);
  for (const u of todo) {
    console.log((dry ? '[dry-run] akan menonaktifkan ' : 'nonaktif: ') + u.email);
    if (!dry) { await col.users.update({ _id: u._id }, { active: false, sv: (u.sv || 0) + 1 }); await D.audit({ user: { _id: 'system', name: 'Skrip perawatan', role: 'system' } }, 'akun.demo.nonaktif', u.email); }
  }
  if (!dry) store.flush();
  console.log(dry ? 'Dry-run: tidak ada perubahan.' : todo.length ? 'Selesai. Nyalakan ulang backend.' : 'Tidak ada yang perlu diubah.');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
