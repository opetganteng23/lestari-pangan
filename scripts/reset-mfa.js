// Mereset MFA seorang pengguna (mis. ponsel hilang dan kode pemulihan habis). Hanya bisa dijalankan di PC server saat backend mati.
// Sesi akun dicabut; setelah masuk, aktifkan MFA lagi di Profil. Pakai: node scripts/reset-mfa.js email@contoh.id [--force]
const { openOffline } = require('./_offline');
const email = String(process.argv[2] || '').toLowerCase().trim();
if (!email || email.startsWith('--')) { console.error('Pakai: node scripts/reset-mfa.js email@contoh.id'); process.exit(1); }
(async () => {
  const { store, D, col } = await openOffline({ force: process.argv.includes('--force') });
  const u = await col.users.findOne({ email }); if (!u) { console.error('Akun tidak ditemukan: ' + email); process.exit(1); }
  if (!u.mfa) { console.log('MFA akun ini memang belum aktif. Tidak ada yang diubah.'); process.exit(0); }
  await col.users.update({ _id: u._id }, { mfa: null, sv: (u.sv || 0) + 1 });
  await D.audit({ user: { _id: 'system', name: 'Skrip perawatan', role: 'system' } }, 'mfa.reset', email); store.flush();
  console.log('MFA ' + email + ' direset dan sesinya dicabut. Nyalakan ulang backend, masuk dengan sandi, lalu aktifkan MFA lagi di Profil.');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
