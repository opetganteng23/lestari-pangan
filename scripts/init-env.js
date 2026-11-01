// Membuat .env dari .env.example dengan APP_SECRET acak. Tidak menimpa .env yang sudah ada. Nilai rahasia tidak dicetak.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..'), target = path.join(root, '.env');
if (fs.existsSync(target)) { console.log('.env sudah ada, tidak diubah. Jalankan "npm run check:env" untuk memeriksanya.'); process.exit(0); }
let t = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
t = t.replace(/^APP_SECRET=.*$/m, 'APP_SECRET=' + crypto.randomBytes(48).toString('hex'));
fs.writeFileSync(target, t, { mode: 0o600 });
console.log('.env dibuat dengan APP_SECRET acak. Yang masih perlu Anda isi: PUBLIC_URL dan ANTHROPIC_API_KEY (opsional).');
