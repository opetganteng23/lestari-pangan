# Master Technical Specification (MTS) — LestariPangan

| | |
|---|---|
| Produk | LestariPangan — traceability pangan dari sawah sampai meja makan |
| Tim | TechTonic |
| Versi dokumen | 0.2 (sesuai kode di repositori) |
| Status | Prototipe. Semua data contoh adalah simulasi |
| Repositori | https://github.com/opetganteng23/lestari-pangan |

Dokumen ini menjelaskan apa yang **sudah ada di kode**. Hal yang belum ada ditandai **[Belum]** di bagian 15, supaya tidak tercampur dengan klaim fitur.

---

## 1. Tujuan dan ruang lingkup

**Masalah.** Konsumen dan pengawas pangan sulit memastikan asal beras dan gabah. Data setoran, penggabungan batch, dan perpindahan barang tersebar dan mudah diubah.

**Tujuan sistem.**
1. Mencatat setiap langkah rantai pasok sebagai event yang tidak bisa diubah diam-diam.
2. Menjaga keaslian data dengan verifikasi admin, konfirmasi dua pihak pada transfer, dan hash-chain.
3. Membuat asal pangan bisa ditelusuri konsumen lewat QR di kemasan, tanpa login.
4. Memberi pengawas dashboard, anomali, dan tren pasokan.

**Di luar lingkup versi ini.** Pembayaran, harga, sertifikasi mutu, aplikasi mobile native, integrasi IoT timbangan.

## 2. Pemangku kepentingan dan peran

| Peran | Kode | Akun | Ringkas |
|---|---|---|---|
| Pengepul | `pengepul` | Ya | Mencatat setoran petani, menggabung batch, mengirim ke gudang |
| Gudang/Penggilingan | `gudang` | Ya | Menerima, menyimpan, menggiling, mengemas, membuat QR konsumen |
| Distributor | `distributor` | Ya | Menerima dan meneruskan ke retailer |
| Logistik | `logistik` | Ya | Mencatat pengambilan dan pengantaran |
| Retailer | `retailer` | Ya | Menerima dan menampilkan asal produk |
| Admin teknis | `admin` | Ya | Verifikasi, pengguna, referral, kelompok tani, sengketa, konfigurasi |
| Pengawas (Dinas) | `pengawas` | Ya | Pemantauan baca-saja |
| Super admin | `superadmin` | Ya | Semua fitur admin dan pengawas, Mode Lihat, Mode Tindak |
| Ketua kelompok tani | – | **Tidak** | Hanya dikenali lewat kode ketua saat setoran |
| Konsumen | – | **Tidak** | Halaman publik `/t/<kode>` |

Matriks fitur per peran ada di [fitur-per-peran.md](fitur-per-peran.md).

## 3. Arsitektur

```
Browser (HTML/CSS/JS murni, SPA hash-router)
   │  HTTP + JSON, header Authorization: Bearer <token>
   ▼
server/index.js  ── server HTTP modul bawaan Node (tanpa framework)
   ├─ routes.js     daftar endpoint + pemeriksaan izin (need())
   ├─ domain.js     aturan bisnis, event, notifikasi, audit
   ├─ analytics.js  metrik + narasi (aturan atau Claude)
   ├─ ledger.js     anchor hash-chain (simulasi)
   ├─ store.js      FileStore (JSON) atau MongoStore
   ├─ auth.js       scrypt + token HMAC-SHA256
   └─ qr.js         pembuat QR SVG (vendor/qr)
```

**Keputusan utama.**
- Satu proyek Node.js untuk backend dan frontend. Tanpa `npm install` untuk jalan normal. Node 18 ke atas.
- Frontend tanpa framework. Layar didaftarkan di objek `S` (`js/screens-actor.js`, `js/screens-admin.js`), menu per peran di `NAV` (`js/core.js`).
- Penyimpanan lewat satu antarmuka (`insert`, `find`, `findOne`, `update`, `remove`, `count`) sehingga FileStore dan MongoStore bisa ditukar.
- Pekerjaan latar: pemroses outbox anchor berjalan tiap 30 detik.

## 4. Teknologi dan dependensi

| Lapisan | Pilihan |
|---|---|
| Runtime | Node.js >= 18 |
| Server | `http` bawaan |
| Data bawaan | Berkas `data/db.json` (ditulis atomik, tunda 150 ms) |
| Data opsional | MongoDB (`mongodb` ^6, **belum diuji**) |
| Email opsional | `nodemailer` (hanya menandai antrean, pengiriman nyata **belum**) |
| AI opsional | Claude API lewat `ANTHROPIC_API_KEY` (**belum diuji dengan API asli**) |
| Frontend | HTML, CSS, JS murni; font Poppins lokal |
| QR | Pustaka QR yang di-vendor di `server/vendor/qr` |

## 5. Model data

Koleksi (`domain.js`):

| Koleksi | Isi utama |
|---|---|
| `users` | email, passwordHash, name, role, actorId, active |
| `actors` | Pelaku rantai pasok: name, role, district, lat, lng |
| `referralCodes` | code, role, maxUses, uses, expiresAt, active, note |
| `farmerGroups` | name, ketua, village, district, hectares, avgWeightKg, lat, lng, hash kode ketua, linkedActorIds, active |
| `qrLabels` | code, ownerActorId, status (`unassigned`/`assigned`/`voided`), period, batchId |
| `deposits` | batchId, actorId, farmerGroupId, weightKg, notaNo, notaPhoto, scalePhoto, status, checkMode, checkReason |
| `batches` | code, kind, commodity, weightKg, ownerActorId, status, parents, meta, tainted |
| `transfers` | code, batchId, fromActorId, toActorId, carrierActorId, sentKg, receivedKg, status, sentAt, pickedAt, deliveredAt |
| `events` | type, batchId, actor, payload, hash, prevHash, anchorStatus |
| `outbox` | Antrean anchor: status `pending`/`failed`/`done`, attempts |
| `anomalies` | type, severity, text, actorId, batchId, resolved |
| `notifications` | toActorId atau toRole, text, link, read |
| `auditLogs` | action, detail, userName, at |
| `appConfig` | Konfigurasi sistem (satu dokumen `cfg`) |
| `counters` | Urutan kode batch, QR, transfer |
| `analyticsReports` | Ringkasan mingguan: source, bullets, metrics |

**Status batch:** `pending_verification`, `available`, `in_transit`, `disputed`, `merged`, `processed`, `consumed`.
**Status transfer:** `in_transit`, `received`/`done`, `disputed`, `returned`.

## 6. Alur bisnis

```
Petani → [Ketua kelompok tani] → Pengepul → Gudang/Penggilingan → Distributor → Retailer → Konsumen
                kode ketua          setoran     giling, kemas, QR     transfer         stok       scan QR
```

1. **Setoran (pengepul).** Memasukkan kelompok tani, kode ketua, berat, nomor nota, foto timbangan, dan foto nota bertanda tangan. Satu label QR hulu terpakai.
   - Kode ketua salah menghasilkan anomali `kode_ketua_salah` dan penolakan.
   - Nomor nota ganda ditolak dan dicatat `nota_ganda`.
   - Pemeriksaan **penuh** jika pengepul baru, pasangan pengepul-kelompok baru, atau berat lebih dari 2× rata-rata kelompok. Selain itu **sampling** (default 30%). Yang tidak terpilih diterima otomatis (`DEPOSIT_AUTO_ACCEPTED`).
   - Batch baru berstatus `pending_verification`: tidak bisa digabung atau dikirim.
2. **Verifikasi (admin).** Setuju atau tolak. Setuju memberi status `available` dan men-anchor event.
3. **Gabung batch (pengepul).** Beberapa batch tersedia menjadi batch agregat (`LOT_MERGED`). Sub-lot tetap hidup untuk pelacakan komposisi.
4. **Transfer.** Pengirim memilih penerima dan opsional pengangkut. Penerima mengonfirmasi berat terima (konfirmasi dua pihak).
   - Selisih dalam toleransi (default 2%): selesai.
   - Selisih di atas toleransi: `disputed`, anomali `selisih_berat`, notifikasi admin. Admin memutuskan lewat Sengketa Transfer.
   - Pengirim langsung ke retailer tanpa lewat gudang dianggap pengecualian dan dicatat `kirim_langsung_retailer`.
5. **Pengolahan (gudang).** Simpan (`STORED`), giling dengan berat keluaran (`PROCESSED`, hitung rendemen; di bawah ambang memicu `rendemen_rendah`), kemas (`PACKAGED`, jumlah × berat kemasan, membentuk kode lot `LP-PKG-…`).
6. **Logistik.** Pengangkut mencatat `CARRIER_PICKUP` lalu `CARRIER_DELIVERED`.
7. **Konsumen.** Memindai QR kemasan ke `/t/<kode>` dan melihat komposisi asal, langkah rantai, dan status integritas.

## 7. Event dan integritas

- Setiap langkah penting menghasilkan **event**: `DEPOSIT_RECORDED`, `DEPOSIT_VERIFIED`, `DEPOSIT_AUTO_ACCEPTED`, `DEPOSIT_REJECTED`, `LOT_MERGED`, `TRANSFER_SENT`, `TRANSFER_CONFIRMED`, `TRANSFER_DISPUTED`, `TRANSFER_RETURNED`, `STORED`, `PROCESSED`, `PACKAGED`, `CARRIER_PICKUP`, `CARRIER_DELIVERED`.
- Event menyimpan hash isi dan hash event sebelumnya (hash-chain per sistem). Event yang butuh anchor masuk **outbox** dan di-anchor ke `ledger.js` (status `confirmed`/`failed`; kegagalan dicoba ulang).
- `ledger.js` menyediakan `anchor`, `lookup`, `verifyChain`. Implementasi sekarang adalah **hash-chain lokal simulasi**, bukan blockchain publik.
- Halaman Integritas membandingkan hash yang tersimpan dengan hash yang dihitung ulang dan memverifikasi rantai blok.
- Alat demo `tamper`/`restore` mengubah angka event untuk memperlihatkan deteksi. Mati dengan `DEMO_MODE=0`.

## 8. Keamanan dan akses

| Aspek | Implementasi |
|---|---|
| Kata sandi | scrypt, salt acak 16 byte, perbandingan `timingSafeEqual` |
| Sesi | Token HMAC-SHA256 bertanda waktu, masa berlaku 12 jam. Kunci dari `APP_SECRET` atau dibuat otomatis di `data/.secret` |
| Otorisasi | Fungsi `need(ctx, roles, write)` di setiap endpoint; peran tidak berwenang menerima 403 |
| Super admin | **Mode Lihat**: melihat sebagai pelaku lain, baca-saja. **Mode Tindak**: butuh sandi dan alasan, token 15 menit, notifikasi ke pelaku, audit `mode_tindak.mulai` |
| Kode ketua tani | Statis, disimpan sebagai hash, bisa dirotasi, ditampilkan sekali |
| Referral | Pendaftaran mandiri hanya dengan kode valid (aktif, belum kedaluwarsa, belum habis) |
| Pengguna | Admin tidak bisa mengelola akun super admin atau akunnya sendiri; akun dengan transaksi tidak bisa dihapus, hanya dinonaktifkan |
| Audit | Login, registrasi, perubahan pengguna/referral/kelompok/konfigurasi, keputusan verifikasi dan sengketa, Mode Tindak |
| Unggah foto | JPEG/PNG/WebP, maksimum 2,5 MB, nama acak. Badan permintaan maksimum 8 MB |
| Berkas statis | Pemeriksaan jalur agar tidak keluar dari `public/` |

## 9. Spesifikasi API

Semua jalur di bawah `/api`, JSON. Kolom *Akses*: P = publik, A = login semua peran, selain itu daftar peran. Super admin ikut peran admin dan pengawas.

| Metode | Jalur | Akses | Fungsi |
|---|---|---|---|
| GET | `/public/trace/:code` | P | Data telusur konsumen |
| POST | `/login` | P | Masuk, mengembalikan token |
| POST | `/register` | P | Daftar dengan kode referral |
| GET | `/me` | A | Profil, peran, status mode |
| GET | `/actors` | A | Daftar pelaku (filter peran) |
| GET | `/sa/actors` | superadmin | Semua pelaku |
| POST | `/sa/view` | superadmin | Mulai Mode Lihat |
| POST | `/sa/act` | superadmin | Mulai Mode Tindak |
| GET | `/users` | admin | Daftar pengguna |
| POST | `/users` | admin | Buat pengguna |
| PUT | `/users/:id` | admin | Ubah nama/email/wilayah/peran, reset sandi, aktif/nonaktif |
| DELETE | `/users/:id` | admin | Hapus pengguna (jika tanpa riwayat) |
| GET/POST | `/groups` | A / admin | Kelompok tani |
| PUT/DELETE | `/groups/:id` | admin | Ubah / hapus kelompok |
| POST | `/groups/:id/rotate` | admin | Rotasi kode ketua |
| GET/POST | `/referrals` | admin | Kode referral |
| PUT/DELETE | `/referrals/:id` | admin | Ubah / hapus kode |
| GET/POST | `/labels` | pengepul | Label QR dan kuota |
| GET/POST | `/deposits` | pengepul (POST), admin/pengawas/aktor (GET) | Setoran |
| GET | `/verifications` | admin | Antrean verifikasi |
| POST | `/deposits/:id/decide` | admin | Setuju / tolak |
| GET | `/batches`, `/batches/:id` | aktor, admin, pengawas | Batch dan lineage |
| POST | `/batches/merge` | pengepul | Gabung batch |
| POST | `/batches/:id/store`, `/process`, `/pack` | gudang | Simpan, giling, kemas |
| GET | `/transfers` | aktor, admin, pengawas | Daftar (`box=in/out/carrier/disputed`) |
| POST | `/transfers` | pengepul, gudang, distributor | Kirim |
| POST | `/transfers/:id/confirm` | gudang, distributor, retailer | Konfirmasi terima |
| POST | `/transfers/:id/resolve` | admin | Putusan sengketa |
| POST | `/transfers/:id/carrier` | logistik | Langkah `pickup` / `deliver` |
| GET | `/dashboard` | admin, pengawas | Metrik, titik peta, anomali, ringkasan |
| POST | `/analytics/run` | admin, pengawas | Hasilkan ringkasan baru |
| GET | `/audit`, `/events` | admin, pengawas | Audit log, daftar event |
| GET/PUT | `/config` | admin, pengawas (GET), admin (PUT) | Konfigurasi |
| GET/POST | `/notifications`, `/notifications/read` | A | Notifikasi |
| GET | `/integrity` | admin, pengawas | Status integritas dan outbox |
| POST | `/outbox/run` | admin | Ulangi anchor gagal |
| POST | `/integrity/tamper`, `/restore` | admin | Alat demo |
| GET | `/qr?text=` | P | QR SVG |

Galat memakai bentuk `{ "error": "pesan" }` dengan kode 400, 401, 403, 404, 409, 413, 500.

## 10. Antarmuka pengguna

- SPA satu halaman dengan sidebar menu per peran, bilah atas (judul, penanda demo, lonceng notifikasi, pengguna), dan banner mode super admin.
- Halaman konsumen `trace.html` terpisah dan tanpa login.
- Dashboard tiap peran:

| Peran | Dashboard |
|---|---|
| Pengepul | Stok, menunggu verifikasi, setoran, kiriman keluar, sisa label QR |
| Gudang | Stok, kiriman masuk, batch diolah, kiriman keluar, sengketa |
| Distributor / Retailer | Stok, kiriman masuk dan keluar atau diterima, sengketa |
| Logistik | Perlu diambil, dalam perjalanan, selesai, kiriman aktif |
| Admin | Antrean verifikasi, sengketa, integritas, outbox, aktivitas terbaru |
| Pengawas / Super admin | Metrik, peta sebaran skematis, anomali, ringkasan mingguan, tren |

- **Responsif.** Tiga titik putus (1100 px, 760 px, 380 px) plus pembatas lebar di atas 1600 px. Di layar kecil menu menjadi bar yang bisa digeser, grid menjadi satu kolom, tabel dibungkus area gulir, popup dan toast selebar layar. Perlu diuji di perangkat nyata.
- Bahasa antarmuka: Indonesia. Font Poppins dilayani lokal.

## 11. Analitik dan AI

- Semua angka dihitung kode (`analytics.js`): batch aktif, pengepul aktif, kecamatan, verifikasi tertunda dan terlambat, transfer menggantung, persentase anchor, rendemen rata-rata dan penggilingan di bawah rata-rata, tren pasokan 8 minggu.
- Ringkasan mingguan: jika `ANTHROPIC_API_KEY` ada, Claude **hanya menarasikan** data agregat; jawaban divalidasi (harus JSON berisi `bullets`). Jika gagal atau tanpa kunci, dipakai narasi berbasis aturan dan diberi label.
- Anomali yang dicatat: `kode_ketua_salah`, `nota_ganda`, `setoran_janggal`, `selisih_berat`, `rendemen_rendah`, `kirim_langsung_retailer`, ditambah anomali virtual `transfer_menggantung`.

## 12. Konfigurasi

Variabel lingkungan:

| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | 3000 | Port HTTP |
| `APP_SECRET` | acak, disimpan di `data/.secret` | Kunci tanda tangan token |
| `LP_DATA_DIR` | `data/` | Lokasi data |
| `MONGODB_URI` | – | Pakai MongoDB |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | – | Narasi AI |
| `LEDGER_NETWORK` | label simulasi | Nama jaringan di UI |
| `DEMO_MODE` | aktif | `0` mematikan alat tamper |

Konfigurasi aplikasi (menu Konfigurasi, disimpan di `appConfig`):

| Kunci | Default | Arti |
|---|---|---|
| `tolerancePct` | 2 | Toleransi selisih berat transfer (%) |
| `depositSlaHours` | 24 | SLA verifikasi setoran (jam) |
| `samplingRate` | 30 | Persentase setoran rutin yang diperiksa |
| `qrQuotaPerPeriod` | 200 | Kuota label QR per bulan per pengepul |
| `yieldAlertPct` | 55 | Ambang rendemen rendah (%) |
| `hangingHours` | 48 | Batas transfer dianggap menggantung (jam) |
| `notifierMode` | manual | `manual` atau `smtp` |

## 13. Pengujian

`node test/smoke.js` menjalankan server pada port acak dengan data sementara dan menguji lewat HTTP, antara lain: login salah, akses tanpa token, halaman konsumen, integritas ledger, kode ketua salah, nota ganda, verifikasi penuh, pembatasan peran, anchor, alur lengkap setoran sampai konsumen, Mode Lihat dan Mode Tindak, dashboard, QR, referral, dan CRUD pengguna. Hasil terakhir: semua lulus.

**Belum ada:** uji unit, uji antarmuka otomatis, uji beban, uji MongoDB, uji API Claude asli.

## 14. Penerapan

```bash
node server/index.js        # http://localhost:3000
npm test                    # uji smoke
npm run reseed              # hapus data/ lalu muat ulang data simulasi
```

Untuk produksi sebaiknya: set `APP_SECRET`, aktifkan HTTPS lewat reverse proxy, simpan `data/` atau MongoDB pada penyimpanan yang dicadangkan, dan matikan `DEMO_MODE`.

## 15. Batasan dan rencana

**[Belum] / disederhanakan di versi ini**
- Blockchain adalah simulasi hash-chain lokal. Rencana: adapter ethers.js + kontrak `LPAnchor` pada EVM testnet dengan antarmuka `anchor`/`lookup`/`verifyChain` yang sama.
- Pengiriman email nyata (SMTP) belum diimplementasikan; hanya pemberitahuan dalam aplikasi.
- Foto di `data/uploads` tanpa kontrol akses (URL acak).
- Peta skematis SVG, belum Leaflet. Pemindaian QR lewat kamera belum ada.
- Tidak ada pembatasan laju login, CSRF, pemulihan kata sandi, ganti sandi mandiri, atau autentikasi dua faktor.
- Tidak ada ekspor laporan (CSV/PDF).
- Peran akun pelaku tidak bisa diubah setelah dibuat.
- Adapter MongoDB dan narasi Claude belum diuji.

**Rencana prioritas yang disarankan**
1. Keamanan dasar: pembatasan laju login, ganti dan pulihkan kata sandi, HTTPS, CSRF.
2. Adapter blockchain testnet.
3. Pemindaian QR kamera dan peta Leaflet.
4. Ekspor laporan dan notifikasi email.
5. Uji otomatis antarmuka dan uji pada MongoDB.

## 16. Glosarium

| Istilah | Arti |
|---|---|
| Batch | Satu lot barang yang dilacak, punya kode `LP-BATCH-…` |
| Lineage | Garis keturunan batch (induk, gabungan, sub-lot) |
| Anchor | Menautkan hash event ke ledger |
| Outbox | Antrean pengiriman anchor yang bisa dicoba ulang |
| Rendemen | Persentase beras keluaran terhadap gabah masukan |
| Sengketa | Transfer dengan selisih berat di atas toleransi |
| Mode Lihat / Tindak | Fitur super admin untuk melihat atau bertindak sebagai pelaku lain |
