# Status implementasi terhadap MTS v0.3

Dibandingkan dari [mts.md](mts.md) terhadap kode di repositori. Pembacaan kode berbasis inspeksi dan uji smoke, bukan audit penuh.

Legenda: **Ada** = berfungsi dan teruji smoke; **Sebagian** = ada versi dasar; **Belum** = tidak ada di kode.

## Ringkasan

| Status | Jumlah baris |
|---|---|
| Ada | 21 |
| Sebagian | 20 |
| Belum | 27 |

## Per bagian MTS

| # | Butir | Status | Catatan |
|---|---|---|---|
| 3 | Peran & akses: 8 peran, Mode Lihat/Tindak, CRUD pengguna | Ada | Mode Tindak minta sandi, alasan, 15 menit |
| 3 | Akses per objek: Pembatasan data per pelaku | Sebagian | Pelaku hanya melihat batch/transfer miliknya; belum diuji menyeluruh |
| 4 | Arsitektur modular monolith | Ada | Satu proyek Node, modul terpisah |
| 5 | Event, batch, lineage, status | Ada | Koleksi `events`, `batches.parents`; query lineage hulu/hilir dan verifikasi integritas per batch (`/api/batches/:id/lineage`, `/integrity`) |
| 5 | Entitas `cases`, `products`, `documents`, `processing-runs` | Belum | Proses penggilingan disimpan sebagai batch + event |
| 6.1–6.5 | Setoran, verifikasi, gabung, transfer 2 pihak, giling, kemas | Ada | Alur lengkap teruji |
| 6.5 | Produk samping dan susut pada penggilingan | Belum | Hanya input dan output utama |
| 6.6 | Recall / investigasi lot | Belum | Hanya `voided` pada batch/label |
| 6.7 | Halaman konsumen via QR | Ada | `/t/<kode>` |
| 7.1–7.2 | Event ledger + hash-chain | Ada |  |
| 7.3 | Anchoring blockchain testnet | Belum | Yang ada: hash-chain lokal simulasi |
| 7.4 | Adapter ledger | Sebagian | Pemilihan adapter lewat `LEDGER_ADAPTER` (`local` teruji; `evm` + `contracts/LPAnchor.sol` ditulis, **belum diuji di testnet**); ada uji kepatuhan antarmuka `test/ledger.js` |
| 8 | Digital Product Passport | Sebagian | Status verifikasi per tahap, keterbatasan data, dan label ledger simulasi sudah ada; dokumen publik yang disetujui dan info recall belum |
| 8.3 | Product Journey Replay (interaktif, peta) | Belum |  |
| 8.4 | QR: void, deteksi scan berulang, GS1 Digital Link | Sebagian | Void dan deteksi pemindaian berulang (anomali `scan_berulang`) ada; GS1 Digital Link belum |
| 9 | Mass Balance (rumus, produk samping, susut, koreksi, ekspor) | Sebagian | Hanya rendemen dan ambang `yieldAlertPct` |
| 10.2 | Rule-based anomaly | Ada | 6 jenis + transfer menggantung |
| 10.2 | AI Analytics Narrator | Sebagian | Ditulis, belum diuji dengan API asli |
| 10.2 | AI Investigation Copilot | Belum |  |
| 10.2 | Evidence OCR / Image Evidence | Belum |  |
| 10.5 | Evaluasi AI | Belum |  |
| 11.2 | Anomali perluasan (lineage tak lengkap, output > input, dokumen ganda, stok tanpa event, akun menyimpang) | Belum |  |
| 11.3 | Skor risiko | Belum |  |
| 11.4 | Risk dashboard (ID kasus, SLA, penanggung jawab, status) | Sebagian | Daftar anomali ada; tanpa kasus, PIC, SLA, tindak lanjut |
| 12 | Forecasting & Digital Twin | Belum | Ada tren pasokan 8 minggu, bukan forecasting |
| 13 | Portal kelompok tani | Belum | Kelompok tani hanya master data tanpa akun |
| 14 | Investigation Workspace & Smart Recall | Belum |  |
| 15.1–15.2 | Notifikasi dalam aplikasi | Ada | Lonceng + badge |
| 15.2 | Notifikasi email | Belum | SMTP hanya menandai antrean |
| 15.3 | Job idempotent, backoff, dead-letter, status kirim | Sebagian | Outbox anchor dengan retry; belum untuk notifikasi |
| 16.1 | Prefix `/api/v1` | Sebagian | `/api/v1/...` berfungsi sebagai alias; jalur resmi masih `/api` |
| 16.1 | Validasi skema request | Sebagian | Pustaka `validate()` di `server/security.js`; baru diuji unit, belum dipasang di semua endpoint |
| 16.1 | Pagination & filter daftar | Sebagian | Audit log mendukung `limit`/`offset`; daftar lain belum |
| 16.1 | Idempotency key | Belum |  |
| 16.1 | Rate limiting | Ada | Per-IP 600/menit; login 5 gagal/15 menit (bisa diatur lewat env) |
| 16.1 | OpenAPI | Belum |  |
| 16.1 | API client/partner dengan scope | Belum |  |
| 16.2 | Auth: logout, refresh, reset sandi | Sebagian | Logout, ganti sandi mandiri, pencabutan sesi ada; reset sandi mandiri (butuh email) belum |
| 16.2 | Endpoint `/cases`, `/exports`, `/ai`, `/integrations`, `/anchors`, `/products/:id/passport` | Belum |  |
| 17.1 | Hash sandi (scrypt) | Ada |  |
| 17.1 | Token sesi bertanda tangan, masa berlaku | Ada | 12 jam; pencabutan lewat versi sesi (`sv`) saat logout, ganti/reset sandi, nonaktif |
| 17.1 | Perlindungan brute-force | Ada | Penguncian per IP+email |
| 17.1 | Autentikasi ulang aksi sensitif | Sebagian | Hanya Mode Tindak |
| 17.1 | MFA akun istimewa | Belum |  |
| 17.1 | Batas ukuran request, nama file acak | Ada | 8 MB; foto maks 2,5 MB |
| 17.1 | Validasi MIME dari isi file | Ada | Tipe gambar ditentukan dari byte awal berkas |
| 17.1 | Penyimpanan bukti privat + signed URL | Sebagian | Foto bukti hanya lewat URL bertanda tangan berumur 15 menit; masih di disk lokal, belum object storage terenkripsi |
| 17.1 | CSRF / CORS ketat | Sebagian | Token di header Authorization (bukan cookie); tidak ada CORS lintas origin; CSP `frame-ancestors none` |
| 17.1 | Security headers (CSP, HSTS, dll.) | Ada | CSP, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS di balik https |
| 17.1 | Error tanpa stack trace | Ada |  |
| 17.1 | Scan dependensi, backup terenkripsi | Belum |  |
| 17.2 | Klasifikasi data, retensi, log akses dokumen | Belum |  |
| 17.3 | Mode Lihat baca-saja, Mode Tindak + banner + audit + notifikasi | Ada |  |
| 17.3 | Pencabutan sesi mode istimewa | Belum | Kedaluwarsa otomatis saja |
| 17.4 | Backup / restore / RPO-RTO | Sebagian | `npm run backup` / `npm run restore`; belum terenkripsi dan belum terjadwal |
| 18 | UI responsif, dashboard per peran | Ada | Admin, pengawas, 5 peran pelaku |
| 18 | Peta sebaran | Sebagian | SVG skematis, belum Leaflet |
| 18 | Design system terdokumentasi | Belum |  |
| 19.1 | Metrik operasional dasar | Sebagian | Tanpa persentil waktu verifikasi, usia kasus, kualitas data |
| 19.2–19.3 | Laporan & ekspor CSV/XLSX/PDF | Belum |  |
| 20 | Konfigurasi env + operasional | Ada | Tujuh kunci konfigurasi |
| 21 | Uji smoke end-to-end | Ada |  |
| 21 | Uji unit, integrasi terpisah, UI, beban, keamanan | Sebagian | `test/unit.js` untuk modul keamanan/auth; belum ada uji UI/beban/keamanan |
| 22 | Deployment, observability (log terstruktur, metrik, health check) | Sebagian | `/api/health` dan log JSON per permintaan (`x-request-id`) ada; metrik belum |
| – | Offline-first | Belum |  |
| – | Pemindaian QR kamera | Belum |  |
| – | Ganti sandi mandiri / profil pengguna | Ada | Halaman Profil & Keamanan untuk semua peran |
| – | Integrasi timbangan / logistik pihak ketiga | Belum |  |

## Prioritas yang disarankan (mengikuti roadmap v0.3)

| Fase | Pekerjaan | Alasan |
|---|---|---|
| 1 Secure Foundation | Rate limit login, ganti/reset sandi, logout/pencabutan sesi, security headers, `/health`, backup | Syarat sebelum pilot |
| 1 Secure Foundation | Validasi skema request, uji unit/integrasi | Menutup risiko regresi |
| 2 Verifiable Traceability | DPP lengkap (status verifikasi per tahap), lineage hulu/hilir, uji adapter testnet | Inti nilai produk |
| 3 Operational Intelligence | Mass balance penuh, kasus/investigasi, ekspor CSV, email, Copilot read-only | Nilai bagi admin/pengawas |
| 4–5 | Portal petani, API partner, offline, forecasting | Setelah data nyata ada |
