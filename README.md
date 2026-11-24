# LestariPangan — prototipe traceability pangan

Satu proyek Node.js (backend + frontend jadi satu). Font Poppins dan pustaka peta (Leaflet) dilayani lokal dari proyek ini; hanya tile peta yang diambil dari OpenStreetMap. Data bawaan adalah **simulasi**; untuk pilot gunakan jalur tanpa data simulasi di [docs/pilot.md](docs/pilot.md).

## Menjalankan
```bash
node server/index.js        # Node 18+, tanpa npm install
# buka http://localhost:3000
```
Pertama kali jalan (data kosong), data simulasi otomatis dimuat kecuali `SEED_DEMO=0`. Reset data: hentikan server, hapus folder `data/`, jalankan ulang.
Uji otomatis: `npm test` (unit, ledger, alur end-to-end, operasional, mitra, prediksi, render layar, perawatan, TOTP/MFA, wilayah, retensi, create-admin).
Cadangan data: `npm run backup` · pulihkan: `npm run restore -- backups/<folder> --yes` (hentikan server dulu).
Cek kesehatan: `GET /api/health` (`demoAccounts` dan `demoMode` menunjukkan apakah akun demo / alat ubah-data masih hidup).

## Akun demo (hanya bila data simulasi dimuat; kata sandi semua: `lestari123`)
| Email | Peran |
|---|---|
| sa@lestari.id | Super admin (Mode Lihat + Mode Tindak; Mode Tindak butuh MFA) |
| admin@lestari.id | Admin teknis |
| pengawas@lestari.id | Pengawas (baca-saja) |
| kelompok.sumber@lestari.id · kelompok.harapan@ | Kelompok tani (portal) |
| pengepul1@lestari.id · pengepul2 · pengepul3 | Pengepul |
| gudang1@lestari.id · gudang2 | Gudang/penggilingan |
| distributor@ · logistik@ · retailer@lestari.id | Distributor, logistik, retailer |

**Jangan biarkan akun ini aktif di situs yang dapat diakses publik**: kata sandinya diketahui siapa pun yang membaca dokumen ini. Nonaktifkan dengan `npm run demo:disable`, atau mulai kosong dengan `SEED_DEMO=0` (lihat [docs/pilot.md](docs/pilot.md)). Badge "DATA SIMULASI" di antarmuka hanya tampil selama `SEED_DEMO` atau `DEMO_MODE` belum `0`.

Kode ketua kelompok tani (untuk Catat Setoran): `SUM-4821` (KT Sumber Rejeki), `HAR-3307` (KT Harapan Jaya), `MEK-5519` (KT Mekar Sari), `TAN-7742` (KT Tani Subur).
Kode referral demo: `PENGEPUL-DEMO1`, `GUDANG-DEMO1`, `RETAILER-DEMO1`.
Landing page di `/`, aplikasi di `/app`. Halaman konsumen (tanpa login): `/t/LP-PKG-2026-0211` (QR-nya ada di menu Pengemasan & QR gudang).

## Struktur
```
lestari-pangan/
├─ server/                 backend (modul bawaan Node)
│  ├─ index.js             server HTTP + sesi + job retensi
│  ├─ routes.js            endpoint inti + izin per peran
│  ├─ routes-auth.js       lupa/reset kata sandi
│  ├─ routes-mfa.js        pengaturan verifikasi dua langkah (super admin)
│  ├─ routes-ops.js · routes-partner.js · routes-server.js   kasus/neraca/ekspor/prediksi, portal petani + API mitra, dashboard Server
│  ├─ domain.js            aturan bisnis
│  ├─ regions.js           daftar kabupaten/kota resmi + koordinat (satu-satunya sumber titik peta)
│  ├─ ledger/              folder adapter ledger: index.js (pemilih), local.js (simulasi hash-chain), evm.js (belum diuji)
│  ├─ provenance.js        lineage, verifikasi integritas, Digital Product Passport
│  ├─ security.js          pembatas laju, validasi, header keamanan (CSP)
│  ├─ auth.js              sandi (scrypt), token sesi, URL bukti bertanda tangan
│  ├─ totp.js · mfa.js     TOTP RFC 6238 buatan sendiri, rahasia terenkripsi, kode pemulihan, anti-replay
│  ├─ retention.js         pembersihan terjadwal audit/notifikasi/idem/outbox
│  ├─ ops.js · copilot.js  kasus/recall, neraca massa, ekspor, email · AI Copilot baca-saja
│  ├─ predict.js           forecasting, pemantauan model, Digital Twin
│  ├─ serverctl.js · backup.js · env.js   gerbang layanan, pemantauan, cadangan + rotasi, pemuat .env
│  ├─ mailer.js            pengirim email (SMTP, belum diuji)
│  ├─ analytics.js · store.js · qr.js · seed.js · paths.js
│  └─ vendor/qr/           pustaka QR
├─ public/                 frontend (HTML/CSS/JS murni)
│  ├─ index.html · app.html · trace.html   landing (/), aplikasi SPA (/app), halaman konsumen
│  ├─ css/app.css · landing.css · auth.css
│  ├─ js/core.js           util, API, sesi, layout, menu per peran + seksi, ikon, FEATURES
│  ├─ js/auth.js           masuk (termasuk kode MFA), daftar, lupa/reset
│  ├─ js/map.js            peta sebaran (Leaflet + cluster + rekap tabel cadangan)
│  ├─ js/screens-*.js      layar per kelompok: actor, admin (dashboard bertab, pengguna, mode), ops, farmer, predict, server, mfa, common (profil)
│  ├─ js/offline.js · sw.js antrean offline & service worker
│  ├─ vendor/leaflet · markercluster   pustaka peta (disalin lokal, berlisensi BSD-2 / MIT)
│  └─ assets/icons.svg · fonts · img   sprite ikon lokal, font, gambar
├─ contracts/LPAnchor.sol  kontrak anchor (belum diaudit/dideploy)
├─ scripts/                backup/restore, init-env, check-env, make-vercel-json, create-admin, disable-demo-accounts,
│                          purge-test-data, reset-mfa, fix-region-coords, clean-uploads
├─ Operasional/            tombol .bat: nyalakan/matikan/status/cadangkan (lihat BACA-SAYA.txt)
├─ deploy/windows/         start/stop/status/autostart, tunnel (cloudflared/tailscale/ssh), cadangan harian terjadwal
├─ vercel.json             konfigurasi frontend Vercel (dibuat oleh npm run vercel:config)
├─ test/                   unit · ledger · smoke · ops · partner · predict · server · auth · ui-render · maintenance · totp · mfa · regions · retention · create-admin
├─ docs/                   mts.md (target v0.3) · mts-v0.2-baseline.md · gap-v0.3.md · fitur-per-peran.md · pilot.md · deploy-vercel.md · penyimpanan-produksi.md
└─ data/                   data runtime (di-ignore git)
```

## Dokumen
- [Deploy: Vercel + backend on-prem](docs/deploy-vercel.md) · [Status implementasi vs v0.3](docs/gap-v0.3.md) · [Panduan pilot](docs/pilot.md) · [Keputusan penyimpanan produksi](docs/penyimpanan-produksi.md) · [MTS v0.3 (target)](docs/mts.md) · [Baseline v0.2 (sesuai kode)](docs/mts-v0.2-baseline.md) · [Fitur per peran](docs/fitur-per-peran.md)

## Perintah perawatan
Skrip yang mengubah data **menolak berjalan saat backend hidup** (data dimuat di memori dan akan menimpa). Matikan backend dulu, jalankan `npm run backup`, dan untuk skrip yang punya mode uji, lihat rencananya sebelum menambah `--apply`.

| Perintah | Fungsi |
|---|---|
| `node scripts/create-admin.js [email]` | Buat/perbarui super admin (idempoten). Sandi diketik tersembunyi atau lewat `ADMIN_EMAIL`/`ADMIN_PASSWORD` untuk satu proses; tidak pernah ditulis ke berkas |
| `npm run demo:disable` | Nonaktifkan semua akun `@lestari.id` (tidak dihapus, sesi dicabut) |
| `npm run purge:test` | Hapus data uji (dry-run bawaan, `--apply` untuk menerapkan; entri bercatatan terkait dilewati) |
| `npm run regions:fix` | Pindahkan titik default lama ke wilayahnya (dry-run bawaan) |
| `npm run uploads:clean` | Pindahkan berkas upload yatim ke `data/uploads-yatim/` (dry-run bawaan) |
| `npm run mfa:reset -- email` | Reset MFA super admin yang kehilangan ponsel |
| `deploy\windows\install-backup-task.ps1` | Daftarkan cadangan harian (Task Scheduler, tanpa hak admin) |

## Konfigurasi (variabel lingkungan / berkas .env)
Salin `.env.example` ke `.env` (`npm run init:env`) lalu periksa dengan `npm run check:env`. Variabel penting untuk deploy: `APP_SECRET`, `PUBLIC_URL`, `HOST`, `TRUST_PROXY`, `SEED_DEMO`, `DEMO_MODE`, `ANTHROPIC_API_KEY`.

- `PORT` (3000) · `APP_SECRET` · `LP_DATA_DIR`
- `SEED_DEMO=0` — mulai kosong tanpa data simulasi, dengan satu super admin dari `ADMIN_EMAIL` + `ADMIN_PASSWORD` (+ opsional `ADMIN_NAME`). Hapus `ADMIN_PASSWORD` dari `.env` setelah akun terbentuk.
- `DEMO_MODE=0` — matikan alat demo "ubah data event".
- `FEATURES` — menu lanjutan yang dinyalakan, pisahkan koma: `prediksi,copilot,email,integrasi`. Bawaan kosong (semua mati, mode pilot).
- `LP_BACKUP_DIR` · `LP_BACKUP_KEEP` (14) — lokasi dan jumlah cadangan yang disimpan.
- `RETAIN_AUDIT_DAYS` (730) · `RETAIN_NOTIF_DAYS` (90) · `RETAIN_IDEM_DAYS` (7) · `RETAIN_OUTBOX_DAYS` (30) — retensi; 0 = jangan hapus. Lihat [penyimpanan-produksi.md](docs/penyimpanan-produksi.md).
- `MONGODB_URI` (+ `npm i mongodb`) — pakai MongoDB, bukan berkas JSON. **Adapter ini ditulis tetapi belum diuji** (sandbox pengembangan tidak punya MongoDB).
- `ANTHROPIC_API_KEY` (+ opsional `ANTHROPIC_MODEL`) — ringkasan pengawas ditarasikan Claude; angka tetap dihitung kode. Tanpa kunci: narasi berbasis aturan (diberi label). Belum diuji dengan API asli.
- `LOGIN_MAX_FAILS` (5) · `LOGIN_LOCK_MIN` (15) · `RATE_LIMIT_PER_MIN` (600) · `PARTNER_RATE_PER_MIN` · `AI_RATE_PER_MIN` · `TRUST_PROXY=1` (percaya `X-Forwarded-For` di balik proxy) · `LOG=0` (matikan log permintaan)
- `LEDGER_ADAPTER` (`local` bawaan | `evm`, belum diuji; butuh `npm i ethers` + `EVM_RPC_URL`, `EVM_PRIVATE_KEY`, `EVM_CONTRACT_ADDRESS`; kontrak di `contracts/LPAnchor.sol`)
- `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` `SMTP_SECURE` (+ `npm i nodemailer`, notifierMode `smtp`) — email; belum diuji dengan server nyata
- Notifikasi: mode manual (pemberitahuan dalam aplikasi). Mode SMTP baru menandai antrean; pengiriman email nyata belum diuji.

## Yang sengaja disederhanakan / belum ada
- **Blockchain = simulasi hash-chain lokal** (`server/ledger/local.js`), bukan EVM testnet. Antarmukanya (`anchor`, `lookup`, `verifyChain`) dibuat agar bisa diganti adapter ethers.js + kontrak `LPAnchor` (`server/ledger/evm.js`, belum diuji).
- Foto bukti disimpan di `data/uploads` di disk lokal (tanpa enkripsi). Aksesnya lewat **URL bertanda tangan** yang kedaluwarsa dalam 15 menit; tautan tanpa tanda tangan yang sah ditolak (403).
- Peta sebaran memakai Leaflet lokal + tile OpenStreetMap (butuh koneksi untuk tile; ada rekap tabel per wilayah sebagai cadangan). Titik berada di pusat kabupaten/kota, bukan lokasi bangunan; cakupan wilayah saat ini Jawa Barat dan Banten. Pemindaian QR lewat kamera belum ada (kode QR bisa dibuka sebagai tautan).
- **Reset kata sandi mandiri sudah ada** (token sekali pakai, tautan lewat email sehingga butuh SMTP; admin tetap bisa mereset dari menu Pengguna). MFA TOTP baru untuk super admin.
- Cadangan harian terjadwal tersedia untuk Windows (Task Scheduler) dengan rotasi, tetapi **belum terenkripsi** dan belum diuji pulih terjadwal.
- Penyimpanan berkas JSON satu proses: cukup untuk pilot, bukan produksi luas (lihat [penyimpanan-produksi.md](docs/penyimpanan-produksi.md)).
