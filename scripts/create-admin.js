// Membuat/memperbarui akun super admin. Kata sandi diketik di terminal (tidak ditampilkan, tidak disimpan di berkas).
// Pakai: node scripts/create-admin.js email@contoh.id [Nama]   (matikan backend dulu agar data tidak tertimpa)
require('../server/env');
const readline = require('readline');
const { openStore } = require('../server/store'), auth = require('../server/auth'), sec = require('../server/security'), createDomain = require('../server/domain');

const email = String(process.argv[2] || '').toLowerCase().trim(), name = process.argv[3] || 'Super Admin';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Pakai: node scripts/create-admin.js email@contoh.id [Nama]'); process.exit(1); }

function askHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}

(async () => {
  const pw = await askHidden('Kata sandi baru: '), again = await askHidden('Ulangi kata sandi: ');
  if (pw !== again) { console.error('Kata sandi tidak sama.'); process.exit(1); }
  const issue = sec.passwordIssue(pw); if (issue) { console.error('Kata sandi ditolak: ' + issue); process.exit(1); }
  const store = await openStore(require('../server/paths').DATA), D = createDomain(store);
  const ex = await D.col.users.findOne({ email });
  if (ex) { await D.col.users.update({ _id: ex._id }, { passwordHash: auth.hashPassword(pw), role: 'superadmin', active: true, sv: (ex.sv || 0) + 1 }); console.log('Akun ' + email + ' diperbarui menjadi super admin.'); }
  else { await D.col.users.insert({ email, name, role: 'superadmin', actorId: null, passwordHash: auth.hashPassword(pw), active: true }); console.log('Akun super admin ' + email + ' dibuat.'); }
  store.flush(); // penulisan berkas ditunda 150 ms; tanpa ini data hilang saat proses keluar
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
