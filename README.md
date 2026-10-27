# LestariPangan — prototipe traceability pangan

Satu proyek Node.js (backend + frontend jadi satu). Font Poppins dilayani lokal. Semua data contoh adalah **simulasi**.

## Menjalankan
```bash
node server/index.js        # Node 18+, tanpa npm install
# buka http://localhost:3000
```
Pertama kali jalan, data simulasi otomatis dimuat. Reset data: hapus folder `data/` lalu jalankan ulang.
Uji otomatis: `npm test` (uji unit keamanan + uji alur end-to-end).
Cadangan data: `npm run backup` · pulihkan: `npm run restore -- backups/<folder> --yes` (hentikan server dulu).
Cek kesehatan: `GET /api/health`.

## Akun demo (kata sandi semua: `lestari123`)
| Email | Peran |
|---|---|
| sa@lestari.id | Super admin (Mode Lihat + Mode Tindak) |
| admin@lestari.id | Admin teknis |
| pengawas@lestari.id | Pengawas (baca-saja) |
| pengepul1@lestari.id · pengepul2 · pengepul3 | Pengepul |
| gudang1@lestari.id · gudang2 | Gudang/penggilingan |
| distributor@ · logistik@ · retailer@lestari.id | Distributor, logistik, retailer |

Kode ketua kelompok tani (untuk Catat Setoran): `SUM-4821` (KT Sumber Rejeki), `HAR-3307` (KT Harapan Jaya), `MEK-5519` (KT Mekar Sari), `TAN-7742` (KT Tani Subur).
Kode referral demo: `PENGEPUL-DEMO1`, `GUDANG-DEMO1`, `RETAILER-DEMO1`.
Halaman konsumen (tanpa login): `/t/LP-PKG-2026-0211` (QR-nya ada di menu Pengemasan & QR gudang).

## Struktur
```
lestari-pangan/
├─ server/                 backend (modul bawaan Node)
│  ├─ index.js             server HTTP + sesi
│  ├─ routes.js            endpoint + izin per peran
│  ├─ domain.js            aturan bisnis
│  ├─ ledger/              adapter ledger: index.js (pemilih), local.js (simulasi), evm.js (belum diuji)
│  ├─ provenance.js        lineage, verifikasi integritas, Digital Product Passport
│  ├─ security.js          pembatas laju, validasi, header keamanan
│  ├─ analytics.js         metrik + ringkasan
│  ├─ store.js             penyimpanan JSON / MongoDB
│  ├─ auth.js · qr.js · seed.js · paths.js
│  └─ vendor/qr/           pustaka QR
├─ public/                 frontend (HTML/CSS/JS murni)
│  ├─ index.html           aplikasi (SPA)
│  ├─ trace.html           halaman konsumen
│  ├─ css/app.css
│  ├─ js/core.js           util, API, sesi, layout, menu per peran
│  ├─ js/screens-actor.js  layar pelaku rantai pasok + detail batch
│  ├─ js/screens-admin.js  layar admin, pengawas, super admin, pengguna
│  └─ assets/fonts · img
├─ contracts/LPAnchor.sol  kontrak anchor (belum diaudit/dideploy)
├─ scripts/                backup & restore data
├─ test/                   unit.js · ledger.js · smoke.js
├─ docs/mts.md             MTS v0.3 (spesifikasi target)
├─ docs/mts-v0.2-baseline.md  baseline sesuai kode saat ini
├─ docs/fitur-per-peran.md
└─ data/                   data runtime (di-ignore git)
```

## Dokumen
- [MTS v0.3 (target)](docs/mts.md) · [Baseline v0.2 (sesuai kode)](docs/mts-v0.2-baseline.md) · [Fitur per peran](docs/fitur-per-peran.md)

## Konfigurasi opsional (variabel lingkungan)
- `PORT` (3000) · `APP_SECRET` · `LP_DATA_DIR`
- `MONGODB_URI` (+ `npm i mongodb`) — pakai MongoDB, bukan berkas JSON. **Adapter ini ditulis tetapi belum diuji** (sandbox pengembangan tidak punya MongoDB).
- `ANTHROPIC_API_KEY` (+ opsional `ANTHROPIC_MODEL`) — ringkasan pengawas ditarasikan Claude; angka tetap dihitung kode. Tanpa kunci: narasi berbasis aturan (diberi label). Belum diuji dengan API asli.
- `LOGIN_MAX_FAILS` (5) · `LOGIN_LOCK_MIN` (15) · `RATE_LIMIT_PER_MIN` (600) · `TRUST_PROXY=1` (percaya `X-Forwarded-For` di balik proxy) · `LOG=0` (matikan log permintaan)
- `LEDGER_ADAPTER` (`local` bawaan | `evm`, belum diuji; butuh `npm i ethers` + `EVM_RPC_URL`, `EVM_PRIVATE_KEY`, `EVM_CONTRACT_ADDRESS`; kontrak di `contracts/LPAnchor.sol`)
- `DEMO_MODE=0` — matikan alat demo "ubah data event".
- Notifikasi: mode manual (pemberitahuan dalam aplikasi). Mode SMTP baru menandai antrean; pengiriman email nyata belum diimplementasikan.

## Yang sengaja disederhanakan / belum ada
- **Blockchain = simulasi hash-chain lokal** (`server/ledger.js`), bukan EVM testnet. Antarmukanya (`anchor`, `lookup`, `verifyChain`) dibuat agar bisa diganti adapter ethers.js + kontrak `LPAnchor`.
- Foto disimpan di `data/uploads` (URL tidak bisa ditebak, tanpa kontrol akses).
- Peta skematis SVG, belum Leaflet. Pemindaian QR lewat kamera belum ada (kode QR bisa dibuka sebagai tautan).
- Pemulihan kata sandi mandiri (butuh email) belum ada; admin bisa mereset. Backup belum terenkripsi/terjadwal.
