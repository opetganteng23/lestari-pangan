// Membuat atau memperbarui akun super admin. Idempoten: bila akun sudah ada, role dipastikan superadmin, akun diaktifkan,
// kata sandi diganti, dan sesi lama dicabut (sv dinaikkan). MFA akun tidak diubah. Kebijakan kata sandi (passwordIssue) tidak dilonggarkan.
// Kata sandi TIDAK ditulis ke berkas dan tidak dicetak. Dua cara memberikannya:
//   1) Non-interaktif lewat variabel lingkungan untuk proses ini saja (tanpa meninggalkan jejak di berkas):
//        PowerShell:  $env:ADMIN_EMAIL='a@contoh.id'; $env:ADMIN_PASSWORD='...'; node scripts/create-admin.js; Remove-Item Env:ADMIN_PASSWORD
//   2) Interaktif: node scripts/create-admin.js email@contoh.id [Nama]   (diketik di terminal, tidak ditampilkan)
// Backend harus mati agar data tidak tertimpa (--force untuk melewati, tidak disarankan).
const readline = require('readline');
const { openOffline } = require('./_offline'); const auth = require('../server/auth'), sec = require('../server/security');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const email = String(args[0] || process.env.ADMIN_EMAIL || '').toLowerCase().trim(), name = args[1] || process.env.ADMIN_NAME || 'Super Admin';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Pakai: node scripts/create-admin.js email@contoh.id [Nama]  (atau set ADMIN_EMAIL dan ADMIN_PASSWORD)'); process.exit(1); }

function askHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

(async () => {
  let pw = process.env.ADMIN_PASSWORD;
  if (pw === undefined || pw === '') { pw = await askHidden('Kata sandi baru: '); const again = await askHidden('Ulangi kata sandi: '); if (pw !== again) { console.error('Kata sandi tidak sama.'); process.exit(1); } }
  const issue = sec.passwordIssue(pw); if (issue) { console.error('Kata sandi ditolak: ' + issue); process.exit(1); }
  const { store, D } = await openOffline({ force: process.argv.includes('--force') });
  const ex = await D.col.users.findOne({ email }); const sys = { user: { _id: 'system', name: 'Skrip create-admin', role: 'system' } };
  if (ex) { await D.col.users.update({ _id: ex._id }, { passwordHash: auth.hashPassword(pw), role: 'superadmin', active: true, sv: (ex.sv || 0) + 1 }); await D.audit(sys, 'admin.perbarui', email); console.log('Akun ' + email + ' diperbarui menjadi super admin.'); }
  else { await D.col.users.insert({ email, name, role: 'superadmin', actorId: null, passwordHash: auth.hashPassword(pw), active: true }); await D.audit(sys, 'admin.buat', email); console.log('Akun super admin ' + email + ' dibuat.'); }
  store.flush(); // penulisan berkas ditunda 150 ms; tanpa ini data hilang saat proses keluar
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
