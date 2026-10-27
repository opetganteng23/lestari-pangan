# LestariPangan — prototipe traceability pangan

Satu proyek Node.js (backend + frontend jadi satu). Font Poppins dilayani lokal. Semua data contoh adalah **simulasi**.

## Menjalankan
```bash
node server/index.js        # Node 18+, tanpa npm install
# buka http://localhost:3000
```
Pertama kali jalan, data simulasi otomatis dimuat. Reset data: hapus folder `data/` lalu jalankan ulang.
Uji otomatis: `node test/smoke.js` (21 uji alur end-to-end).

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
- `server/` — HTTP (modul bawaan Node), `domain.js` (aturan bisnis), `ledger.js` (anchor), `analytics.js`, `store.js` (data), `seed.js`
- `public/` — antarmuka (HTML/CSS/JS murni), `trace.html` halaman konsumen
- `test/smoke.js` — uji end-to-end

## Konfigurasi opsional (variabel lingkungan)
- `PORT` (3000) · `APP_SECRET` · `LP_DATA_DIR`
- `MONGODB_URI` (+ `npm i mongodb`) — pakai MongoDB, bukan berkas JSON. **Adapter ini ditulis tetapi belum diuji** (sandbox pengembangan tidak punya MongoDB).
- `ANTHROPIC_API_KEY` (+ opsional `ANTHROPIC_MODEL`) — ringkasan pengawas ditarasikan Claude; angka tetap dihitung kode. Tanpa kunci: narasi berbasis aturan (diberi label). Belum diuji dengan API asli.
- `DEMO_MODE=0` — matikan alat demo "ubah data event".
- Notifikasi: mode manual (pemberitahuan dalam aplikasi). Mode SMTP baru menandai antrean; pengiriman email nyata belum diimplementasikan.

## Yang sengaja disederhanakan / belum ada
- **Blockchain = simulasi hash-chain lokal** (`server/ledger.js`), bukan EVM testnet. Antarmukanya (`anchor`, `lookup`, `verifyChain`) dibuat agar bisa diganti adapter ethers.js + kontrak `LPAnchor`.
- Foto disimpan di `data/uploads` (URL tidak bisa ditebak, tanpa kontrol akses).
- Peta skematis SVG, belum Leaflet. Pemindaian QR lewat kamera belum ada (kode QR bisa dibuka sebagai tautan).
- Tidak ada pembatasan laju login, CSRF, atau pemulihan kata sandi.
