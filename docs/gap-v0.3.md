# Status implementasi terhadap MTS v0.3

Dibandingkan dari [mts.md](mts.md) terhadap kode di repositori, setelah Fase 1–5 selesai dikerjakan. Berbasis inspeksi kode dan uji otomatis (`npm test`), bukan audit keamanan independen.

Ringkasan di bawah dihitung ulang dari isi tabel.

Legenda: **Ada** = berfungsi dan teruji otomatis; **Sebagian** = ada, dengan batasan yang tertulis di catatan; **Belum** = tidak ada di kode.

## Ringkasan

| Status | Jumlah butir |
|---|---|
| Ada | 29 |
| Sebagian | 31 |
| Belum | 8 |
| **Total** | **68** |

## Per bagian MTS

| # | Butir | Status | Catatan |
|---|---|---|---|
| 3 | Peran & akses: 9 peran (termasuk kelompok tani), Mode Lihat/Tindak, CRUD pengguna | Ada | Mode Tindak minta sandi, alasan, 15 menit |
| 3 | Akses per objek | Sebagian | Pelaku hanya melihat data miliknya; belum diaudit menyeluruh per endpoint |
| 4 | Arsitektur modular monolith | Ada | Satu proyek Node, modul terpisah |
| 5 | Event, batch, lineage, status | Ada | Lineage hulu/hilir + verifikasi integritas per batch |
| 5 | Entitas kasus, koreksi, kunci API, pembacaan timbangan, proyeksi, simulasi | Ada | Koleksi terpisah dengan jejak waktu |
| 6.1–6.5 | Setoran, verifikasi, gabung, transfer 2 pihak, giling, kemas | Ada | |
| 6.5 | Produk samping dan susut penggilingan | Ada | Opsional; tanpa rincian berstatus "belum diisi" |
| 6.6 | Recall / investigasi lot | Ada | Cakupan dampak, penahanan batch, publikasi hanya lewat keputusan manusia |
| 6.7 | Halaman konsumen via QR | Ada | |
| 7.1–7.2 | Event ledger + hash-chain | Ada | |
| 7.3 | Anchoring blockchain testnet | Belum | Hanya hash-chain lokal simulasi; kontrak dan adapter ditulis tetapi tidak pernah dijalankan di jaringan |
| 7.4 | Adapter ledger | Sebagian | `LEDGER_ADAPTER=local` teruji; `evm` + `contracts/LPAnchor.sol` belum diuji/diaudit |
| 8 | Digital Product Passport | Sebagian | Status verifikasi per tahap, keterbatasan, recall terpublikasi; belum ada dokumen publik yang disetujui |
| 8.3 | Product Journey Replay interaktif + peta | Belum | Garis waktu statis di halaman konsumen. (Peta sebaran untuk pengawas sudah ada, lihat butir 18; ini bukan replay perjalanan per produk)|
| 8.4 | QR: void, deteksi pemindaian berulang | Ada | Sinyal risiko, bukan bukti pemalsuan |
| 8.4 | GS1 Digital Link | Belum | |
| 9 | Mass Balance | Ada | Rumus, produk samping, susut, riwayat koreksi, sumber berat manual vs perangkat, ekspor |
| 10.2 | Rule-based anomaly | Ada | 8 jenis + transfer menggantung |
| 10.2 | AI Analytics Narrator | Sebagian | Ditulis, belum diuji dengan API asli |
| 10.2 | AI Investigation Copilot | Sebagian | Baca-saja, tool dibatasi server, validator rujukan, log; jalur Claude belum diuji dengan API asli (jalur aturan teruji) |
| 10.2 | Evidence OCR / Image Evidence | Belum | |
| 10.5 | Evaluasi AI (dataset, injeksi prompt, biaya) | Sebagian | Ada uji injeksi sederhana dan validator; belum ada dataset evaluasi |
| 11.2 | Anomali perluasan | Sebagian | Ditambah `neraca_massa`, `scan_berulang`; lineage tak lengkap, dokumen ganda, akun menyimpang belum |
| 11.3 | Skor risiko | Sebagian | Skor urgensi operasional dengan alasan; bukan probabilitas kecurangan, belum berversi/terkalibrasi |
| 11.4 | Risk dashboard | Ada | Anomali, kasus, PIC, SLA, status |
| 12.1 | Forecasting | Sebagian | Volume setoran mingguan dengan evaluasi temporal vs baseline naif, interval, gerbang kesiapan, pemantauan; tanpa stok/permintaan/musiman |
| 12.2 | Digital Twin | Sebagian | 4 skenario hipotetis berlabel dengan asumsi; model sederhana linier, tanpa penyangga/harga |
| 13 | Portal kelompok tani | Sebagian | Riwayat, kontribusi, sengketa, notifikasi, ekspor; belum ada pengelolaan anggota, edukasi, atau pembayaran |
| 14 | Investigation Workspace & Smart Recall | Ada | |
| 15.1 | Notifikasi dalam aplikasi | Ada | |
| 15.2 | Notifikasi email | Sebagian | Antrean, retry/backoff, dead-letter, status; pengiriman SMTP nyata belum diuji |
| 15.3 | Job idempotent, backoff, dead-letter, status kirim | Ada | Email dan anchor outbox |
| 16.1 | Prefix `/api/v1` | Sebagian | Alias berfungsi |
| 16.1 | Validasi skema request | Sebagian | Pustaka `validate()` ada; belum dipasang di semua endpoint |
| 16.1 | Pagination | Sebagian | Audit log; daftar lain belum |
| 16.1 | Idempotency key | Ada | Semua POST terautentikasi dan API mitra |
| 16.1 | Rate limiting | Ada | Per IP, login, per kunci API, AI |
| 16.1 | OpenAPI | Sebagian | Spesifikasi jalur publik dan mitra; endpoint internal belum |
| 16.1 | API client dengan scope + rotasi | Sebagian | Scope, kedaluwarsa, nonaktif/hapus; rotasi otomatis belum |
| 16.2 | Auth: logout, ganti sandi, pencabutan sesi | Ada | |
| 16.2 | Reset sandi mandiri | Sebagian | Token sekali pakai 30 menit, tidak membocorkan email terdaftar, dibatasi laju; tautan dikirim lewat email sehingga butuh SMTP (belum diuji dengan server nyata) |
| 17.1 | Hash sandi, token sesi, pencabutan | Ada | scrypt; versi sesi |
| 17.1 | Perlindungan brute-force, security headers, validasi isi gambar | Ada | |
| 17.1 | MFA akun istimewa | Sebagian | TOTP RFC 6238 (diuji dengan vektor resmi) untuk super admin: wajib di Mode Tindak, wajib di login begitu diaktifkan, kode pemulihan sekali pakai, anti-replay, pembatasan percobaan. Belum untuk admin teknis/pengawas; belum dicoba dengan aplikasi autentikator sungguhan; pendaftaran bersifat sukarela (tidak memaksa agar tidak mengunci pemilik) |
| 17.1 | Penyimpanan bukti privat | Sebagian | URL bertanda tangan 15 menit; masih disk lokal tanpa enkripsi |
| 17.1 | CSRF / CORS | Sebagian | Bearer di header; tidak ada CORS lintas origin |
| 17.1 | Scan dependensi, backup terenkripsi | Belum | Tanpa dependensi npm wajib sehingga permukaan scan kecil, tetapi belum ada scan otomatis. Cadangan terjadwal + rotasi ada (Windows), tidak terenkripsi |
| 17.2 | Klasifikasi data, retensi, log akses dokumen | Sebagian | Retensi terkonfigurasi untuk audit log, notifikasi, kunci idempotensi, antrean anchor selesai (job harian, tercatat di audit). Klasifikasi data dan log akses dokumen belum; masa retensi belum disepakati dengan mitra |
| 17.3 | Mode Lihat/Tindak | Ada | Pencabutan sesi istimewa manual belum ada (kedaluwarsa otomatis) |
| 17.4 | Backup / restore | Sebagian | `npm run backup/restore`; cadangan harian terjadwal dan rotasi (`deploy/windows`); RPO/RTO belum ditetapkan, uji pulih terjadwal belum ada, tidak terenkripsi |
| 18 | UI responsif, dashboard per peran | Ada | Diperiksa di Chrome pada 320/375/768/1024/1440 px tanpa gulir horizontal; menu laci di layar sempit |
| 18 | Landing page, konfirmasi sebelum tindakan, logout ke beranda | Ada | Animasi menghormati prefers-reduced-motion |
| 18 | Peta interaktif (Leaflet) | Sebagian | Leaflet lokal + tile OpenStreetMap, cluster, tooltip, tanda anomali, rekap tabel bila tile gagal; wilayah dari daftar resmi (Jawa Barat dan Banten). Aset dan CSP diuji otomatis, tampilan diperiksa di Chrome headless; interaksi peta belum punya uji otomatis. Titik di pusat kabupaten/kota, bukan lokasi bangunan |
| 19.1 | Metrik operasional | Sebagian | Tanpa persentil waktu verifikasi dan kualitas data |
| 19.2–19.3 | Laporan & ekspor | Sebagian | CSV berlog (9 jenis); XLSX/PDF asli belum (PDF via cetak browser) |
| 20 | Konfigurasi env + operasional | Ada | |
| 21 | Uji otomatis | Sebagian | 15 suite: unit, ledger, e2e, ops, mitra, prediksi, server, auth, render ~99 layar, perawatan, TOTP/MFA, wilayah, retensi, create-admin; belum ada uji browser otomatis, beban, keamanan eksternal |
| 22 | `/api/health`, log JSON | Ada | |
| 22 | Dashboard Server (status, lalu lintas p50/p95, gerbang layanan, AI, cadangan) | Ada | Menu Server (admin); tombol .bat di folder Operasional |
| 22 | Deployment terdokumentasi (Vercel + on-prem) | Sebagian | docs/deploy-vercel.md; belum diuji di Vercel dan tunnel nyata |
| 22 | Metrik ekspor (Prometheus) dan tracing terdistribusi | Belum | |
| – | Offline-first Catat Setoran | Sebagian | IndexedDB + service worker + sinkron idempoten; belum diuji di perangkat/jaringan nyata |
| – | Integrasi timbangan | Sebagian | API pembacaan + pencocokan 0,5%; tanpa validasi/kalibrasi perangkat sungguhan |
| – | Integrasi logistik pihak ketiga | Sebagian | API pickup/antar ber-scope; belum diuji dengan sistem kurir nyata |
| – | Pemindaian QR kamera | Belum | |
| – | Wilayah resmi (kabupaten/kota) + koordinat turunan, tanpa titik default diam-diam | Ada | `server/regions.js`; wilayah wajib dan harus dikenal; migrasi titik lama `npm run regions:fix`. Cakupan baru Jawa Barat dan Banten |
| – | Mode pilot: FEATURES (menu lanjutan mati bawaan), jalur SEED_DEMO=0, nonaktifkan akun demo, bersihkan data uji | Ada | Menyaring menu dan rute di antarmuka; endpoint tetap dilindungi izin peran |
| – | Pilot mitra nyata | Belum | Lihat [pilot.md](pilot.md) |

## Catatan jujur

- Jalur yang bergantung layanan eksternal (Claude API, SMTP, EVM testnet, MongoDB) **belum pernah dijalankan** terhadap layanan sungguhan. Begitu pula MFA dengan aplikasi autentikator di ponsel dan tile peta di jaringan pengguna.
- Tampilan diperiksa lewat tangkapan layar Chrome headless (desktop 1280 px dan ponsel 375 px) dan uji render otomatis (`test/ui-render.js`, DOM tiruan). Belum diperiksa manual di perangkat dan browser pengguna nyata.
- Forecast dan Digital Twin bernilai hanya bila data nyata sudah cukup; pada data simulasi bawaan gerbang kesiapan menolak proyeksi.
