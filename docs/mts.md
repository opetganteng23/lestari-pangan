# Master Technical Specification (MTS) --- LestariPangan

## Intelligent Food Provenance & Supply Chain Platform

  -------------------------------------------------------------------------------------
  Metadata                            Nilai
  ----------------------------------- -------------------------------------------------
  Produk                              LestariPangan

  Positioning                         Intelligent Food Provenance & Supply Chain
                                      Platform

  Tagline                             Dari Asal Panen hingga Kepercayaan yang Dapat
                                      Dibuktikan

  Tim                                 TechTonic

  Versi dokumen                       0.3 --- pembaruan arah produk dan spesifikasi
                                      target

  Status implementasi                 Prototipe; bukan seluruh fitur dalam dokumen ini
                                      sudah tersedia

  Produk awal                         Traceability gabah dan beras dari kelompok tani
                                      hingga konsumen

  Prinsip utama                       Bukti sebelum klaim, manusia tetap mengendalikan
                                      keputusan berisiko, dan data simulasi harus
                                      diberi label

  Repositori awal                     https://github.com/opetganteng23/lestari-pangan
  -------------------------------------------------------------------------------------

> **Penting --- status fitur:** Dokumen ini memisahkan **Baseline Saat
> Ini** (fitur yang dijelaskan telah ada pada MTS versi 0.2), **Target
> Pengembangan** (fitur yang direncanakan), dan **Opsional/Fase
> Lanjutan**. Dokumen ini tidak menyatakan bahwa blockchain publik, AI
> produksi, integrasi perangkat, forecasting, maupun seluruh kontrol
> keamanan sudah diimplementasikan. Status kode harus diverifikasi
> melalui pengujian repositori sebelum setiap rilis.

------------------------------------------------------------------------

# 1. Ringkasan Eksekutif

LestariPangan adalah platform digital untuk mencatat, menelusuri,
memeriksa, dan menganalisis perjalanan pangan---dimulai dari gabah dan
beras---sepanjang rantai pasok. Sistem menghubungkan kelompok tani,
pengepul, penggilingan/gudang, distributor, penyedia logistik, retailer,
pengawas, administrator, dan konsumen.

LestariPangan dikembangkan dari prototipe pencatatan setoran, batch,
transfer, pengolahan, pengemasan, QR traceability, anomali, dashboard,
dan hash-chain lokal. Arah pengembangan berikutnya adalah menjadikan
fitur tersebut sebuah ekosistem **verifiable food provenance**: bukan
hanya menunjukkan asal-usul yang tercatat, tetapi juga memperlihatkan
status verifikasi, bukti pendukung, ketidaklengkapan data, dan
integritas catatan secara jujur.

## 1.1 Visi

Membantu rantai pasok pangan menjadi lebih transparan, dapat ditelusuri,
dapat diaudit, dan lebih responsif terhadap risiko operasional.

## 1.2 Misi

1.  Menghubungkan data perjalanan produk dari sumber hingga konsumen.
2.  Menyediakan pencatatan transaksi yang memiliki identitas pelaku,
    waktu, dan bukti pendukung.
3.  Menjaga integritas catatan melalui event ledger, hash, audit,
    dan---pada fase lanjutan---blockchain anchoring.
4.  Membantu pelaku mengidentifikasi selisih, keterlambatan, anomali,
    dan masalah neraca massa.
5.  Menyediakan AI yang menjelaskan data berdasarkan sumber yang
    diizinkan, bukan membuat fakta yang tidak tersedia.
6.  Meningkatkan akses kelompok tani terhadap riwayat transaksi dan
    kontribusinya.
7.  Menyediakan pengalaman konsumen yang sederhana melalui QR dan
    Digital Product Passport.
8.  Menyediakan alat pengawasan dan investigasi dengan keputusan akhir
    tetap berada pada pihak berwenang.

## 1.3 Prinsip desain

-   **Evidence-first:** setiap klaim penting harus menunjuk ke data atau
    bukti yang mendasarinya.
-   **No false assurance:** hash valid bukan bukti bahwa fakta fisik
    sejak awal benar.
-   **Human-in-the-loop:** AI boleh membantu analisis, tetapi tidak
    memutus sengketa atau menuduh pelaku secara otomatis.
-   **Privacy by design:** data internal, identitas pribadi, foto nota,
    dan lokasi rinci tidak otomatis dipublikasikan.
-   **Least privilege:** setiap peran hanya mengakses data dan tindakan
    yang diperlukan.
-   **Explainable risk:** setiap peringatan memiliki alasan, sumber,
    waktu, dan status tindak lanjut.
-   **Progressive architecture:** mulai dari modular monolith yang
    teruji; pisahkan layanan hanya jika kebutuhan nyata membenarkannya.
-   **Honest demo:** data simulasi, blockchain simulasi, AI mock, dan
    integrasi yang belum diuji harus diberi penanda.
-   **Interoperability:** identitas dan API dirancang agar dapat
    diintegrasikan dengan mitra pada fase lanjutan.
-   **Operational resilience:** kegagalan jaringan, layanan AI,
    blockchain, atau email tidak boleh merusak catatan transaksi inti.

------------------------------------------------------------------------

# 2. Tujuan, Ruang Lingkup, dan Batasan

## 2.1 Masalah yang ditangani

Data setoran, penggabungan batch, pemrosesan, perpindahan, dan
pengemasan pangan dapat tersebar di berbagai pihak. Ketika bukti tidak
terhubung, proses pemeriksaan asal-usul, selisih berat, keterlambatan,
atau penarikan produk menjadi sulit.

## 2.2 Tujuan bisnis

-   Memperpendek waktu pencarian riwayat produk.
-   Mengurangi kesalahan pencatatan dan pengiriman ke pihak yang keliru.
-   Meningkatkan visibilitas status setoran, batch, dan transfer.
-   Membantu menemukan inkonsistensi operasional lebih awal.
-   Meningkatkan transparansi kepada kelompok tani, mitra, pengawas, dan
    konsumen.
-   Mendukung investigasi batch dan penarikan produk dengan penelusuran
    lineage.

## 2.3 Ruang lingkup MVP

MVP berfokus pada rantai pasok gabah dan beras:

1.  Pengelolaan pengguna, peran, kelompok tani, dan pelaku rantai pasok.
2.  Pencatatan setoran gabah dan bukti pendukung.
3.  Verifikasi setoran.
4.  Pembentukan, penggabungan, dan penelusuran batch.
5.  Transfer dengan konfirmasi pengirim dan penerima.
6.  Pencatatan penyimpanan, penggilingan, hasil produksi, dan
    pengemasan.
7.  Pelacakan logistik.
8.  QR dan halaman publik traceability.
9.  Deteksi anomali berbasis aturan.
10. Audit log dan pemeriksaan integritas catatan.
11. Dashboard operasional dan pengawas.
12. Pengujian alur bisnis utama.

## 2.4 Target pengembangan

-   Digital Product Passport (DPP).
-   Product Journey Replay.
-   Mass Balance Intelligence.
-   Investigation Workspace.
-   AI Investigation Copilot yang dibatasi oleh backend.
-   Notifikasi yang dapat dipantau status pengirimannya.
-   Laporan CSV/XLSX/PDF.
-   Portal kelompok tani.
-   Peta jaringan pasokan.
-   Blockchain anchoring pada jaringan uji terlebih dahulu.
-   API integrasi mitra.
-   Offline-first untuk alur terpilih setelah kebutuhan lapangan
    divalidasi.
-   Forecasting dan Digital Twin hanya setelah data historis memadai.

## 2.5 Di luar ruang lingkup MVP

-   Pembayaran dan escrow.
-   Penentuan harga komoditas secara otomatis.
-   Sertifikasi mutu atau keamanan pangan otomatis.
-   Klaim organik, bebas pestisida, berkelanjutan, atau klaim gizi tanpa
    bukti dan proses verifikasi terpisah.
-   Pengendalian timbangan atau mesin produksi tanpa integrasi perangkat
    yang tervalidasi.
-   Keputusan penarikan pangan secara otomatis tanpa otorisasi manusia.
-   Prediksi pasokan/permintaan yang dipublikasikan tanpa evaluasi
    model.
-   Penyimpanan data pribadi atau dokumen sensitif di blockchain publik.
-   Aplikasi mobile native pada fase MVP.

------------------------------------------------------------------------

# 3. Pemangku Kepentingan dan Peran

## 3.1 Peran target

  ------------------------------------------------------------------------------
  Peran                 Kode              Akses             Tanggung jawab utama
  --------------------- ----------------- ----------------- --------------------
  Pengepul              `pengepul`        Login             Mencatat setoran,
                                                            membuat batch,
                                                            menggabungkan batch
                                                            yang diizinkan,
                                                            mengirim barang

  Gudang/Penggilingan   `gudang`          Login             Menerima barang,
                                                            menyimpan,
                                                            menggiling,
                                                            merekonsiliasi
                                                            hasil, mengemas

  Distributor           `distributor`     Login             Menerima, menyimpan
                                                            jika relevan, dan
                                                            meneruskan barang

  Logistik              `logistik`        Login             Mencatat pickup,
                                                            perjalanan, dan
                                                            pengantaran

  Retailer              `retailer`        Login             Menerima barang,
                                                            mencatat status
                                                            penerimaan,
                                                            mengelola
                                                            visibilitas produk

  Kelompok tani         `farmer_group`    Login pada fase   Melihat setoran,
                        (target)          portal petani     transaksi,
                                                            kontribusi, dan
                                                            bukti yang menjadi
                                                            haknya

  Admin teknis          `admin`           Login             Verifikasi,
                                                            pengguna, kelompok,
                                                            konfigurasi,
                                                            sengketa, dan
                                                            dukungan operasional

  Pengawas              `pengawas`        Login, umumnya    Memantau metrik,
                                          baca-saja         anomali, dan laporan
                                                            sesuai
                                                            wilayah/kewenangan

  Super admin           `superadmin`      Login istimewa    Administrasi sistem,
                                                            konfigurasi global,
                                                            dan akses darurat
                                                            yang diaudit

  Konsumen              Publik            Tanpa login       Melihat informasi
                                                            produk yang telah
                                                            disetujui untuk
                                                            publik

  Auditor eksternal     Target fase       Terbatas          Memeriksa bukti yang
                        lanjutan                            diizinkan dan
                                                            laporan audit

  Integrasi mitra       API client        Kredensial        Pertukaran data
                        (target)          layanan           melalui API dengan
                                                            scope terbatas
  ------------------------------------------------------------------------------

**Baseline versi 0.2:** ketua kelompok tani belum memiliki akun mandiri
dan dikenali melalui kode saat setoran. Portal petani dan peran
`farmer_group` merupakan target pengembangan, bukan klaim fitur yang
telah tersedia.

## 3.2 Aturan akses

-   Akses dikendalikan berdasarkan peran dan cakupan data.
-   Pemeriksaan otorisasi harus dilakukan di backend pada setiap
    endpoint dan setiap objek, bukan hanya menyembunyikan menu di
    frontend.
-   Pengguna hanya dapat melihat bukti dan transaksi yang sesuai dengan
    kewenangannya.
-   Data konsumen publik harus dipisahkan dari data internal dan data
    pribadi.
-   Pengawas bersifat baca-saja kecuali kewenangan tambahan disetujui
    secara eksplisit.
-   Super admin tidak boleh menggunakan akses istimewa tanpa jejak
    audit.
-   Impersonation/Mode Lihat harus baca-saja.
-   Mode Tindak harus memiliki alasan, masa berlaku pendek, autentikasi
    ulang, notifikasi, dan audit.
-   Perubahan hak akses, akun istimewa, konfigurasi keamanan, dan
    keputusan sengketa harus memiliki audit khusus.

------------------------------------------------------------------------

# 4. Arsitektur Sistem

## 4.1 Arsitektur target

``` text
Farmer Portal     Business Portal     Consumer Product Page
      |                 |                       |
      +-----------------+-----------------------+
                        |
                  Web/API Layer
                        |
           Authentication & Authorization
                        |
       +----------------+------------------+
       |                |                  |
 Supply Chain       Trust & Audit      Intelligence
 Domain Engine      Domain Engine      Services
       |                |                  |
 Batch / Transfer  Event Ledger        Rule-based Risk
 Processing        Audit Log           AI Copilot
 Mass Balance      Evidence Registry   OCR / Vision (later)
 Recall Workflow   Integrity Checker   Forecasting (later)
       |                |                  |
       +----------------+------------------+
                        |
              Persistence & Integration
                        |
       +----------------+------------------+
       |                |                  |
 Operational DB     Private File Store   Job Queue/Outbox
       |                |                  |
       +----------------+------------------+
                        |
               External Trust Services
                        |
            Blockchain Anchor (later)
            Partner APIs / IoT (later)
```

## 4.2 Pendekatan implementasi

-   Pertahankan modular monolith selama masih sesuai kapasitas tim dan
    skala sistem.
-   Pisahkan domain bisnis dari lapisan HTTP dan penyimpanan.
-   Gunakan kontrak antarmodul yang jelas.
-   Pekerjaan latar menggunakan pola outbox/job queue agar kegagalan
    integrasi tidak menghilangkan transaksi inti.
-   Jangan membuat microservices sebelum kebutuhan deployment, skala,
    atau kepemilikan tim membenarkannya.
-   API harus berversi dan memiliki dokumentasi kontrak.
-   Perubahan skema harus memiliki strategi migrasi dan rollback.

## 4.3 Baseline teknologi yang tercatat pada MTS 0.2

  Lapisan                Kondisi yang tercatat
  ---------------------- ----------------------------------------------------------------
  Runtime                Node.js \>= 18
  Server                 Modul HTTP bawaan Node.js
  Frontend               HTML/CSS/JavaScript murni, SPA hash-router
  Penyimpanan awal       JSON file store
  Penyimpanan opsional   Adapter MongoDB, belum diuji pada MTS 0.2
  Autentikasi            scrypt dan token HMAC-SHA256
  Ledger                 Hash-chain lokal simulasi
  QR                     Generator QR SVG yang di-vendor
  AI                     Narasi agregat melalui Claude API, belum diuji dengan API asli
  Email                  Antrean/penandaan mode, pengiriman nyata belum tersedia

## 4.4 Target teknologi (keputusan harus divalidasi)

  -----------------------------------------------------------------------
  Komponen                Kandidat                Catatan
  ----------------------- ----------------------- -----------------------
  Frontend                React + TypeScript atau Migrasi hanya jika
                          melanjutkan frontend    manfaatnya jelas
                          yang ada                

  Backend                 Node.js + TypeScript    Menjaga kesinambungan
                                                  dengan baseline

  Database                MongoDB atau PostgreSQL Putuskan berdasarkan
                                                  kebutuhan relasi,
                                                  transaksi, query, dan
                                                  tim

  File storage            Object storage privat   Bukti transaksi tidak
                                                  boleh terbuka hanya
                                                  karena mengetahui URL

  Background jobs         Worker dan antrean      Retry, idempotency,
                                                  dead-letter, dan
                                                  observability

  Maps                    Leaflet atau MapLibre   Data lokasi harus
                                                  sesuai izin

  Blockchain              EVM-compatible testnet  Adapter independen dari
                          sebagai eksperimen awal domain bisnis

  AI                      Provider melalui        Tidak mengikat domain
                          lapisan abstraksi       pada satu provider

  Observability           Structured logs,        Hindari memasukkan
                          metrics, traces, alert  rahasia ke log
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 5. Domain Model dan Data

## 5.1 Prinsip data

-   Setiap entitas memiliki ID internal yang stabil.
-   Kode yang ditampilkan ke pengguna bukan satu-satunya dasar
    otorisasi.
-   Waktu disimpan dalam UTC dan ditampilkan sesuai zona waktu pengguna;
    timestamp penting menyertakan zona waktu.
-   Berat menggunakan satuan yang eksplisit dan konsisten.
-   Nilai pengukuran menyimpan nilai, satuan, sumber, waktu, dan pelaku.
-   Data transaksi yang telah dikonfirmasi tidak boleh diubah tanpa
    jejak koreksi.
-   Koreksi dilakukan melalui event koreksi yang merujuk ke data
    sebelumnya, bukan menghapus sejarah.
-   Dokumen menyimpan metadata, checksum, klasifikasi akses, dan
    referensi penyimpanan privat.
-   Data simulasi diberi penanda agar tidak tercampur dengan data
    produksi.

## 5.2 Entitas inti

  -----------------------------------------------------------------------
  Entitas                             Isi utama
  ----------------------------------- -----------------------------------
  `users`                             Email, password hash, nama, role,
                                      actorId, status aktif, waktu
                                      autentikasi

  `actors`                            Pelaku rantai pasok, tipe
                                      organisasi, wilayah, status
                                      verifikasi

  `farmerGroups`                      Nama kelompok, desa, kecamatan,
                                      area jika tersedia, ketua,
                                      anggota/relasi pelaku

  `referralCodes`                     Kode, role yang diizinkan, batas
                                      penggunaan, masa berlaku, status

  `qrLabels`                          Kode, status, periode,
                                      batch/kemasan terkait

  `deposits`                          Kelompok asal, berat, nomor nota,
                                      bukti, status verifikasi, sumber
                                      pengukuran

  `batches`                           Kode, komoditas, jenis, berat,
                                      pemilik, status, parent/child
                                      lineage, metadata

  `transfers`                         Batch, pengirim, penerima,
                                      pengangkut, berat kirim/terima,
                                      timestamp, status

  `processingRuns` (target)           Batch input, fasilitas, waktu
                                      proses, input/output, produk
                                      samping, susut, operator

  `packagingRuns` (target)            Lot hasil, jenis kemasan, jumlah,
                                      berat satuan, rentang serial/QR

  `events`                            Jenis event, entitas, aktor,
                                      payload, timestamp, hash, prevHash,
                                      status anchor

  `outbox`                            Pesan pekerjaan, status, percobaan,
                                      error terakhir, waktu retry

  `evidenceFiles` (target)            File privat, checksum, MIME type,
                                      pemilik, klasifikasi, status
                                      pemindaian

  `anomalies`                         Jenis, tingkat prioritas, alasan,
                                      entitas terkait, status, aturan
                                      pemicu

  `cases` (target)                    Kasus investigasi, penanggung
                                      jawab, bukti, keputusan, SLA,
                                      status

  `notifications`                     Penerima, kanal, template, status
                                      pengiriman, percobaan

  `auditLogs`                         Aktor, aksi, objek, hasil, alasan,
                                      metadata relevan

  `appConfig`                         Konfigurasi tervalidasi

  `counters`                          Urutan kode yang memerlukan alokasi
                                      aman

  `analyticsReports`                  Periode, sumber, metrik, ringkasan,
                                      versi metode

  `anchorBatches` (target)            Merkle root, jaringan, transaksi,
                                      status finalitas, bukti inklusi

  `productPassports` (target)         Identitas produk publik, batch,
                                      konten publik, versi

  `apiClients` (target)               Identitas integrasi, scope, status,
                                      rotasi kredensial
  -----------------------------------------------------------------------

## 5.3 Relasi batch dan lineage

Sistem harus mendukung: - Satu batch menjadi input untuk satu atau lebih
batch turunan. - Beberapa batch input digabung menjadi satu batch. -
Batch input diproses menjadi beberapa output, termasuk produk samping. -
Setiap proses memiliki kuantitas input dan output yang dapat
direkonsiliasi. - Relasi lineage tidak boleh membentuk siklus. - Batch
induk tidak dihapus ketika digabung atau diproses. - Setiap perubahan
komposisi menghasilkan event. - Query lineage harus mendukung
penelusuran ke hulu dan ke hilir. - Ketika suatu input ditandai
bermasalah, sistem dapat menemukan output dan tujuan distribusi yang
terkait.

## 5.4 Status yang disarankan

Status batch harus ditetapkan sebagai state machine resmi dan divalidasi
di backend. Status yang tercatat pada baseline antara lain
`pending_verification`, `available`, `in_transit`, `disputed`, `merged`,
`processed`, dan `consumed`.

Target state tambahan dapat mencakup `quarantined`, `recalled`, dan
`closed`, setelah aturan transisinya ditetapkan. Jangan menambahkan
status baru hanya untuk tampilan UI tanpa definisi transisi, pemilik
tindakan, dan dampak terhadap stok.

Status transfer baseline mencakup `in_transit`, `received`/`done`,
`disputed`, dan `returned`. Status target perlu membedakan `draft`,
`sent`, `picked_up`, `delivered_pending_confirmation`, `confirmed`,
`disputed`, `returned`, dan `cancelled` jika alur bisnis membutuhkan
pembedaan tersebut.

------------------------------------------------------------------------

# 6. Alur Bisnis Utama

## 6.1 Setoran gabah

1.  Pengepul memilih kelompok tani yang terdaftar.
2.  Pengepul memasukkan berat, nomor nota, waktu, dan informasi setoran.
3.  Bukti nota dan timbangan diunggah ke penyimpanan privat.
4.  Sistem memeriksa duplikasi nomor nota, validitas kelompok, kuota
    label, dan anomali aturan.
5.  Sistem menetapkan apakah setoran membutuhkan pemeriksaan penuh atau
    dapat masuk sampling sesuai konfigurasi.
6.  Setoran menunggu verifikasi sesuai aturan yang berlaku.
7.  Petugas berwenang menyetujui atau menolak disertai alasan.
8.  Keputusan dicatat sebagai event dan audit log.
9.  Setelah disetujui, batch dapat digunakan pada proses berikutnya
    sesuai state machine.

**Kontrol penting:** auto-accept berbasis sampling harus dapat
dinonaktifkan, dipantau, dan diaudit. Setiap transaksi yang diterima
otomatis harus tetap menyimpan alasan pemilihan kebijakan tersebut.

## 6.2 Verifikasi setoran

-   Antrean diurutkan berdasarkan SLA dan prioritas.
-   Petugas dapat melihat data dan bukti sesuai kewenangan.
-   Keputusan harus menyimpan aktor, waktu, alasan, dan versi data yang
    diputuskan.
-   Penolakan tidak menghapus bukti atau riwayat.
-   Perubahan keputusan setelah final harus melalui proses
    koreksi/peninjauan yang tercatat.

## 6.3 Penggabungan batch

-   Hanya batch yang memenuhi status dan hak akses yang boleh digabung.
-   Sistem memvalidasi kepemilikan, komoditas, status sengketa, dan
    kuantitas.
-   Batch input tetap tersimpan sebagai sumber lineage.
-   Batch hasil gabungan memiliki kode unik dan relasi ke seluruh input.
-   Kuantitas gabungan dihitung dari input dan penyesuaian yang sah.
-   Penggabungan harus bersifat atomik dari sisi data agar kegagalan
    tidak menghasilkan batch setengah jadi.

## 6.4 Transfer dua pihak

1.  Pengirim membuat transfer dengan batch, penerima, pengangkut
    opsional, berat kirim, dan bukti.
2.  Sistem memvalidasi kepemilikan dan ketersediaan batch.
3.  Pengangkut dapat mencatat pickup dan pengantaran.
4.  Penerima memasukkan berat diterima dan bukti penerimaan.
5.  Sistem menghitung selisih berdasarkan rumus dan satuan yang jelas.
6.  Jika selisih berada dalam toleransi konfigurasi, transfer dapat
    diselesaikan.
7.  Jika melewati toleransi, sistem membuka sengketa dan membuat
    anomali.
8.  Penyelesaian sengketa memerlukan alasan dan aktor berwenang.
9.  Semua perubahan stok dan status harus konsisten serta tercatat
    sebagai event.

## 6.5 Penyimpanan, penggilingan, dan pengemasan

-   Pencatatan penerimaan ke gudang.
-   Catatan stok dan lokasi penyimpanan jika dibutuhkan.
-   Pencatatan proses penggilingan dengan batch input.
-   Pencatatan hasil utama, produk samping, dan susut yang diketahui.
-   Perhitungan rendemen dengan definisi yang konsisten.
-   Pemeriksaan neraca massa.
-   Pembuatan lot hasil dan lot kemasan.
-   Pembuatan QR/identitas produk yang terhubung ke batch yang benar.
-   Validasi bahwa kuantitas kemasan tidak melebihi kuantitas hasil yang
    tersedia.

## 6.6 Recall dan investigasi lot (target)

1.  Petugas berwenang membuka kasus berdasarkan batch atau produk.
2.  Sistem menelusuri semua parent dan descendant batch.
3.  Sistem mengidentifikasi transfer, lokasi, dan penerima yang
    tercatat.
4.  Sistem membuat daftar dampak dan data yang belum lengkap.
5.  Petugas meninjau bukti dan menentukan tindakan.
6.  Sistem menyiapkan draf pemberitahuan dan daftar tugas.
7.  Keputusan penahanan atau penarikan dikonfirmasi manusia yang
    berwenang.
8.  Status tindakan dan hasil tindak lanjut dicatat.
9.  Laporan investigasi dapat diekspor.

## 6.7 Konsumen dan QR

-   QR membuka halaman publik tanpa login.
-   Halaman hanya menampilkan field yang disetujui untuk publik.
-   Informasi yang belum diverifikasi diberi label yang jelas.
-   Halaman menunjukkan komposisi asal, tahapan perjalanan, dan status
    integritas sesuai data yang tersedia.
-   Tidak menampilkan nama, kontak, dokumen, atau koordinat sensitif
    petani tanpa dasar dan persetujuan yang sesuai.
-   Jika data tidak tersedia, halaman menampilkan "belum tersedia"
    alih-alih mengarang informasi.
-   Pemindaian QR bukan bukti tunggal bahwa kemasan fisik asli; fitur
    anti-pemalsuan memerlukan mekanisme tambahan dan evaluasi risiko.

------------------------------------------------------------------------

# 7. Event Ledger, Integritas, dan Blockchain

## 7.1 Event ledger

Event penting dicatat secara append-oriented. Koreksi dibuat sebagai
event baru yang merujuk pada event atau objek sebelumnya, bukan mengubah
sejarah tanpa jejak.

Setiap event idealnya memuat: - ID event unik. - Jenis event dan versi
skema. - Jenis serta ID entitas. - Aktor dan perannya. - Timestamp
server. - Timestamp sumber jika berbeda. - Payload minimum yang
diperlukan. - Referensi bukti. - Hash event. - Referensi hash sebelumnya
atau urutan ledger. - Status verifikasi. - Status anchoring jika
relevan.

## 7.2 Hash-chain

Baseline menggunakan hash-chain lokal simulasi. Hash-chain dapat
mendeteksi perubahan jika nilai pembanding yang tepercaya tetap
tersedia, tetapi tidak dengan sendirinya mencegah administrator yang
berkuasa menulis ulang seluruh data dan seluruh rantai.

Persyaratan target: - Algoritma dan canonical serialization
ditetapkan. - Versi skema payload disimpan. - Perubahan skema tidak
merusak verifikasi historis. - Pengujian mencakup perubahan payload,
penghapusan event, pengurutan ulang, dan rantai terputus. - Kunci
rahasia tidak disimpan di repositori. - Kegagalan verifikasi membuat
insiden yang dapat ditindaklanjuti.

## 7.3 Blockchain anchoring (target fase lanjutan)

Blockchain digunakan untuk menambatkan hash event atau Merkle root,
bukan menyimpan foto nota, data pribadi, atau seluruh payload transaksi.

Rancangan: 1. Event yang memenuhi kebijakan integritas masuk ke outbox.
2. Worker mengelompokkan event dalam anchor batch. 3. Sistem membuat
Merkle tree dan menghitung root. 4. Root dikirim ke jaringan yang
dipilih. 5. Sistem menyimpan chain ID, alamat kontrak, transaction hash,
block number, status finalitas, dan waktu. 6. Sistem memverifikasi
transaksi dan menyediakan proof of inclusion bila didukung. 7. Kegagalan
jaringan atau biaya tidak boleh menghilangkan event operasional. 8.
Status harus dibedakan: `pending`, `submitted`, `confirmed`, `failed`,
dan `verification_failed` sesuai desain adapter.

**Klaim yang diizinkan:** "Bukti hash untuk kumpulan event ini tercatat
pada jaringan X dan dapat diverifikasi."

**Klaim yang tidak diizinkan tanpa bukti tambahan:** "Blockchain
membuktikan bahwa produk secara fisik berasal dari lahan tertentu" atau
"produk pasti asli."

## 7.4 Adapter ledger

Antarmuka target: - `anchor(payloadOrRoot)` - `lookup(reference)` -
`verifyChain(eventRange)` - `verifyInclusion(eventId, proof)` -
`getNetworkStatus()`

Implementasi lokal, testnet, dan produksi harus menjadi adapter yang
berbeda dan diberi label. Testnet bukan bukti transaksi produksi.

------------------------------------------------------------------------

# 8. Digital Product Passport dan QR

## 8.1 Tujuan

Digital Product Passport (DPP) adalah halaman digital produk yang
menyajikan informasi asal-usul dan perjalanan yang relevan bagi konsumen
atau mitra.

## 8.2 Isi halaman publik

-   Nama/jenis produk.
-   Identitas produk dan kode lot.
-   Tanggal produksi/pengemasan jika tersedia.
-   Asal geografis pada tingkat yang disetujui.
-   Komposisi batch bila tersedia.
-   Tahapan perjalanan dan timestamp yang layak dipublikasikan.
-   Status verifikasi tiap tahapan.
-   Status integritas catatan.
-   Dokumen publik yang telah disetujui.
-   Catatan keterbatasan atau data yang belum tersedia.
-   Informasi recall jika ada dan sudah disahkan untuk publik.

## 8.3 Product Journey Replay

Target UI: - Garis waktu interaktif dari sumber hingga retailer. - Peta
hanya menampilkan lokasi sesuai izin. - Setiap tahapan dapat membuka
ringkasan event dan bukti yang boleh dilihat. - Penggabungan batch
divisualisasikan sebagai beberapa sumber yang bertemu. - Pemrosesan
divisualisasikan sebagai transformasi input ke output. - Tahapan yang
hilang atau belum diverifikasi ditandai dengan jelas. - UI tidak
menggunakan warna/status yang menyiratkan sertifikasi mutu tanpa proses
sertifikasi.

## 8.4 Identitas QR

Baseline menggunakan kode QR internal yang mengarah ke halaman publik.
Target fase lanjutan dapat mengevaluasi penggunaan **GS1 Digital Link**
jika identitas GS1 yang sesuai tersedia dan biaya/ketentuan
implementasinya diterima. GS1 Digital Link menghubungkan identifier
produk GS1 dengan informasi daring; ini bukan pengganti proses validasi
asal-usul. Lihat standar resmi GS1:
https://www.gs1.org/standards/gs1-digital-link

Ketentuan: - QR internal tetap didukung untuk prototipe. - Jangan
mengklaim kesesuaian GS1 sebelum identifier, URI, dan implementasinya
diuji. - QR harus menggunakan HTTPS pada produksi. - Kode publik tidak
boleh mengandung data rahasia. - Sistem harus memiliki mekanisme
pencabutan/void untuk kode yang tidak berlaku. - Sistem harus mencegah
satu kode dipakai untuk batch/kemasan yang tidak terkait. - Fitur
deteksi pemindaian berulang dapat menjadi sinyal risiko, bukan bukti
pasti pemalsuan.

------------------------------------------------------------------------

# 9. Mass Balance Intelligence

## 9.1 Tujuan

Membantu merekonsiliasi berat input, hasil utama, produk samping, susut,
dan stok agar perbedaan yang belum terjelaskan dapat diperiksa.

## 9.2 Formula dasar

Untuk suatu proses dalam satuan massa yang konsisten:

`Input total = Output utama + Output samping + Susut terukur + Selisih belum terjelaskan`

Sistem menghitung:

`Selisih belum terjelaskan = Input total - (Output utama + Output samping + Susut terukur)`

Rendemen produk utama:

`Rendemen (%) = (Output utama / Input yang didefinisikan) × 100`

Definisi input, kadar air, dan jenis output harus konsisten. Sistem
tidak boleh membandingkan proses yang berbeda tanpa konteks atau
menafsirkan semua selisih sebagai kecurangan.

## 9.3 Fitur target

-   Pencatatan proses penggilingan.
-   Input batch dan kuantitas.
-   Output utama dan produk samping.
-   Susut dan alasan penyesuaian.
-   Perhitungan rendemen.
-   Perbandingan terhadap ambang yang dapat dikonfigurasi.
-   Riwayat koreksi.
-   Daftar proses yang perlu ditinjau.
-   Penjelasan sumber nilai dan rumus.
-   Ekspor laporan rekonsiliasi.

## 9.4 Kontrol

-   Ambang awal adalah konfigurasi operasional, bukan standar universal.
-   Perubahan konfigurasi memiliki audit.
-   Sistem tidak membuat tuduhan otomatis.
-   Nilai yang diinput manual dibedakan dari nilai yang berasal dari
    perangkat.
-   Penggunaan perangkat timbang terintegrasi membutuhkan validasi,
    identitas perangkat, dan proses kalibrasi.

------------------------------------------------------------------------

# 10. Lestari Intelligence Engine

## 10.1 Prinsip

AI merupakan lapisan pendukung analisis, bukan sumber kebenaran
transaksi. Angka operasional dihitung oleh kode/domain service atau
query yang tervalidasi. AI digunakan untuk menjelaskan, merangkum, dan
membantu investigasi berdasarkan data tersebut.

## 10.2 Modul

  -----------------------------------------------------------------------
  Modul                   Tujuan                  Status
  ----------------------- ----------------------- -----------------------
  Rule-based Anomaly      Menemukan pelanggaran   Sebagian sudah ada pada
  Detection               aturan dan pola dasar   baseline

  AI Analytics Narrator   Menarasikan metrik      Ada sebagai integrasi
                          agregat yang sudah      opsional yang belum
                          dihitung                diuji pada baseline

  AI Investigation        Membantu menelusuri     Target
  Copilot                 kasus dan merangkum     
                          bukti                   

  Evidence OCR            Membaca teks pada       Target
                          nota/dokumen            

  Image Evidence          Membantu pemeriksaan    Target; hasil harus
  Assistance              relevansi/duplikasi     ditinjau manusia
                          foto                    

  Supply Forecasting      Memproyeksikan          Target setelah data
                          pasokan/permintaan      memadai

  Food Network Digital    Simulasi skenario       Target fase lanjut
  Twin                    gangguan jaringan       
  -----------------------------------------------------------------------

## 10.3 AI Copilot: alur

1.  Pengguna mengajukan pertanyaan.
2.  Backend memeriksa identitas, peran, dan cakupan data.
3.  Backend memilih fungsi/query yang diizinkan.
4.  Data diambil dari sumber resmi aplikasi.
5.  Data dinormalisasi dan disertai metadata sumber.
6.  Model menghasilkan jawaban dengan format terstruktur.
7.  Validator memeriksa skema, referensi, dan batasan.
8.  UI menampilkan ringkasan, bukti, periode, dan keterbatasan.
9.  Penggunaan tool dan hasil penting dicatat tanpa merekam rahasia.

AI tidak boleh memiliki akses database bebas atau menghasilkan SQL
arbitrer yang dieksekusi langsung tanpa lapisan validasi.

## 10.4 Aturan AI

-   Jangan membuat angka, identitas, transaksi, sertifikasi, atau lokasi
    yang tidak tersedia.
-   Pisahkan fakta, inferensi, dan rekomendasi.
-   Sertakan referensi ke event/batch/kasus yang mendukung jawaban.
-   Jika data tidak cukup, katakan tidak cukup.
-   Jangan menyimpulkan kecurangan hanya dari anomali.
-   Jangan mengubah status transaksi, menyelesaikan sengketa, membekukan
    batch, atau memulai recall tanpa persetujuan manusia yang berwenang.
-   Jangan mengirim data sensitif ke provider AI tanpa penilaian
    privasi, kontrak, dan konfigurasi yang sesuai.
-   Terapkan batas token, timeout, rate limit, retry, dan fallback.
-   Simpan versi model, prompt, dan metode bila diperlukan untuk
    reproduksibilitas.
-   Sediakan fallback berbasis aturan jika layanan AI tidak tersedia.

## 10.5 Evaluasi AI

Sebelum dipakai untuk keputusan operasional: - Buat dataset evaluasi
yang representatif. - Ukur kualitas output sesuai tugas. - Evaluasi
kesalahan faktual dan referensi yang tidak valid. - Uji prompt injection
pada dokumen dan input pengguna. - Uji kontrol akses melalui pertanyaan
lintas organisasi. - Catat latensi, biaya, dan tingkat kegagalan. -
Sediakan proses pelaporan dan peninjauan jawaban bermasalah.

------------------------------------------------------------------------

# 11. Anomaly Detection dan Risk Intelligence

## 11.1 Baseline anomali

MTS 0.2 mencatat anomali seperti: - `kode_ketua_salah` - `nota_ganda` -
`setoran_janggal` - `selisih_berat` - `rendemen_rendah` -
`kirim_langsung_retailer` - `transfer_menggantung`

## 11.2 Perluasan target

-   Batch lineage tidak lengkap.
-   Kuantitas output melebihi input yang tersedia.
-   Kode QR dipakai pada relasi batch yang tidak sesuai.
-   Dokumen yang sama muncul di beberapa transaksi.
-   Perubahan stok tidak memiliki event pendukung.
-   Transfer berulang kali terlambat.
-   Aktivitas akun menyimpang dari pola operasional yang ditetapkan.
-   Anchor gagal atau bukti integritas tidak cocok.
-   Data perangkat timbang tidak konsisten dengan catatan transaksi.

## 11.3 Skor risiko

Skor risiko dapat dibuat setelah definisi indikator dan evaluasi
disepakati. Skor harus: - Memiliki penjelasan indikator penyusunnya. -
Memiliki versi aturan/model. - Tidak disajikan sebagai probabilitas
kecurangan tanpa kalibrasi statistik. - Tidak menjadi dasar tunggal
tindakan merugikan. - Bisa ditinjau dan dikoreksi petugas. - Memisahkan
tingkat urgensi operasional dari dugaan pelanggaran.

## 11.4 Risk dashboard

Setiap item risiko menampilkan: - ID kasus/anomali. - Prioritas. -
Entitas terkait. - Waktu terdeteksi. - Alasan pemicu. - Bukti yang
tersedia. - Data yang belum tersedia. - Penanggung jawab. - SLA. -
Status dan tindakan terakhir.

------------------------------------------------------------------------

# 12. Food Network Digital Twin dan Forecasting

Fitur ini bukan bagian dari MVP. Fitur hanya diaktifkan jika data
historis, cakupan pelaku, kualitas timestamp, dan definisi stok memadai.

## 12.1 Forecasting

Target analisis: - Tren volume setoran. - Volume pengolahan. - Waktu
transfer. - Stok yang tercatat. - Perubahan pasokan berdasarkan
wilayah. - Proyeksi dengan rentang ketidakpastian.

Persyaratan: - Baseline sederhana dibandingkan dengan model yang lebih
kompleks. - Evaluasi menggunakan data historis yang dipisahkan secara
temporal. - Metrik dan periode evaluasi didokumentasikan. - Hasil diberi
label proyeksi, bukan fakta. - Data yang tidak representatif harus
disebutkan. - Model tidak diluncurkan hanya berdasarkan tampilan visual
yang meyakinkan.

## 12.2 Digital Twin

Sistem dapat mensimulasikan: - Gangguan pada penggilingan atau gudang. -
Penurunan pasokan. - Keterlambatan jalur distribusi. - Perubahan
kapasitas. - Ketergantungan pada satu sumber.

Setiap simulasi menampilkan asumsi, parameter, data sumber, dan hasil.
Simulasi hipotetis harus diberi label agar tidak dianggap sebagai
kondisi nyata.

------------------------------------------------------------------------

# 13. Farmer Intelligence Portal

Portal kelompok tani merupakan target pengembangan, bukan fitur
baseline.

## 13.1 Fitur

-   Profil kelompok tani.
-   Riwayat setoran dan status verifikasi.
-   Salinan bukti transaksi yang menjadi hak kelompok.
-   Total kontribusi berdasarkan periode.
-   Status sengketa.
-   Notifikasi perubahan transaksi.
-   Ekspor ringkasan transaksi.
-   Informasi edukasi yang bersumber jelas.
-   Pengelolaan anggota dan kewenangan kelompok jika kebutuhan bisnis
    tervalidasi.

## 13.2 Privasi

-   Kelompok hanya dapat melihat data yang berhak diaksesnya.
-   Data pribadi anggota tidak otomatis ditampilkan ke pihak lain.
-   Lokasi lahan rinci memerlukan pengaturan akses.
-   Data kontribusi harus menyertakan periode dan definisi perhitungan.
-   Fitur pembayaran tidak boleh ditampilkan seolah tersedia jika belum
    terintegrasi.

------------------------------------------------------------------------

# 14. Investigation Workspace dan Smart Recall

## 14.1 Tujuan

Mempercepat investigasi atas anomali, sengketa, atau masalah pada lot
produk.

## 14.2 Fitur

-   Pembuatan kasus dari anomali atau batch.
-   Penelusuran lineage ke hulu dan hilir.
-   Timeline event.
-   Bukti yang relevan.
-   Daftar pihak penerima yang tercatat.
-   Penanggung jawab dan SLA.
-   Catatan pemeriksaan.
-   Keputusan, alasan, dan persetujuan.
-   Riwayat status.
-   Draf laporan dan ekspor.
-   Status penarikan/penahanan bila diputuskan pihak berwenang.

## 14.3 Prinsip keputusan

-   Sistem membantu menyusun bukti dan cakupan dampak.
-   Sistem tidak menyatakan produk tidak aman tanpa proses penilaian
    yang relevan.
-   Keputusan recall memerlukan manusia yang berwenang.
-   Setiap komunikasi eksternal harus ditinjau sebelum dikirim.
-   Catatan keputusan tidak boleh dihapus diam-diam.

------------------------------------------------------------------------

# 15. Notifikasi dan Background Jobs

## 15.1 Event notifikasi

-   Setoran menunggu verifikasi.
-   Setoran disetujui/ditolak.
-   Transfer menunggu konfirmasi.
-   Transfer bersengketa.
-   SLA mendekati batas.
-   Anomali prioritas tinggi.
-   Anchor gagal atau belum terkonfirmasi.
-   Kasus investigasi membutuhkan tindakan.
-   Sinkronisasi offline gagal atau konflik.
-   Laporan selesai dibuat.

## 15.2 Kanal

-   Notifikasi dalam aplikasi.
-   Email setelah SMTP/provider dikonfigurasi dan diuji.
-   Kanal pesan pihak ketiga hanya setelah integrasi, biaya,
    persetujuan, dan kebijakan privasi ditetapkan.

## 15.3 Keandalan

-   Setiap job memiliki ID unik.
-   Proses harus idempotent.
-   Retry memiliki batas dan backoff.
-   Job gagal permanen masuk dead-letter atau antrean pemeriksaan.
-   Status pengiriman disimpan.
-   Kegagalan notifikasi tidak membatalkan transaksi bisnis yang sudah
    sah.
-   Rahasia dan isi dokumen sensitif tidak dicatat ke log.

------------------------------------------------------------------------

# 16. API dan Integrasi

## 16.1 Prinsip API

-   Prefix versi, misalnya `/api/v1`.
-   Validasi schema untuk semua request.
-   Otorisasi di setiap endpoint dan objek.
-   Pagination dan filter untuk daftar besar.
-   Idempotency key untuk operasi yang berisiko duplikasi.
-   Error response konsisten.
-   Rate limiting berdasarkan risiko endpoint.
-   Dokumentasi OpenAPI pada fase penguatan.
-   Audit untuk tindakan sensitif.
-   API client memiliki scope terbatas dan kredensial yang dapat
    dirotasi.

## 16.2 Kelompok endpoint target

Endpoint di bawah adalah rancangan target. Nama dan kontrak final harus
diselaraskan dengan kode yang benar-benar tersedia.

  --------------------------------------------------------------------------------------
  Kelompok                Contoh endpoint target                 Fungsi
  ----------------------- -------------------------------------- -----------------------
  Auth                    `/api/v1/auth/login`, `/logout`,       Autentikasi dan
                          `/refresh`, `/password/reset`          pemulihan akun

  Actors                  `/api/v1/actors`                       Pengelolaan pelaku

  Farmer groups           `/api/v1/farmer-groups`                Kelompok tani

  Deposits                `/api/v1/deposits`                     Setoran dan bukti

  Verifications           `/api/v1/verifications/:id/decision`   Keputusan verifikasi

  Batches                 `/api/v1/batches`,                     Batch dan penelusuran
                          `/batches/:id/lineage`                 

  Processing              `/api/v1/processing-runs`              Proses pengolahan dan
                                                                 neraca massa

  Transfers               `/api/v1/transfers`                    Pengiriman dan
                                                                 konfirmasi

  Cases                   `/api/v1/cases`                        Sengketa dan
                                                                 investigasi

  Products                `/api/v1/products/:id/passport`        Digital Product
                                                                 Passport

  Public trace            `/api/v1/public/trace/:code`           Halaman konsumen

  Integrity               `/api/v1/integrity/verify`             Pemeriksaan hash dan
                                                                 bukti

  Anchoring               `/api/v1/anchors`                      Status anchoring

  Analytics               `/api/v1/analytics/reports`            Analitik dan laporan

  AI                      `/api/v1/ai/copilot/query`             Tanya jawab berbasis
                                                                 data yang diizinkan

  Notifications           `/api/v1/notifications`                Status notifikasi

  Exports                 `/api/v1/exports`                      Ekspor laporan

  Integrations            `/api/v1/integrations`                 Konfigurasi integrasi
                                                                 terkontrol
  --------------------------------------------------------------------------------------

Endpoint publik harus meminimalkan data yang diekspos. Endpoint AI tidak
boleh menerima query database bebas dari pengguna.

------------------------------------------------------------------------

# 17. Keamanan, Privasi, dan Tata Kelola

## 17.1 Kontrol keamanan minimum sebelum produksi

-   HTTPS pada seluruh akses eksternal.
-   Rahasia disediakan melalui environment/secret manager dan tidak
    di-commit.
-   Rate limiting dan perlindungan brute-force.
-   Kebijakan sesi, masa berlaku, pencabutan, dan autentikasi ulang
    untuk tindakan sensitif.
-   MFA untuk akun istimewa bila tersedia.
-   Pemeriksaan otorisasi per objek.
-   Validasi input dan pembatasan ukuran request.
-   Validasi MIME dan isi file; nama file acak.
-   Penyimpanan bukti secara privat dengan signed URL berumur pendek
    bila sesuai.
-   Proteksi CSRF bila menggunakan cookie yang dikirim otomatis oleh
    browser.
-   Kebijakan CORS yang ketat.
-   Security headers.
-   Error response tidak membocorkan stack trace atau rahasia.
-   Dependensi dipindai dan diperbarui.
-   Backup terenkripsi dan uji restore.
-   Audit log dilindungi dari akses dan perubahan tidak sah.
-   Monitoring keamanan dan prosedur respons insiden.
-   Pengujian keamanan sebelum rilis.

Baseline keamanan harus dievaluasi terhadap kerangka verifikasi aplikasi
yang relevan seperti OWASP ASVS:
https://owasp.org/www-project-application-security-verification-standard/

## 17.2 Perlindungan dokumen dan data pribadi

-   Klasifikasikan data menjadi publik, internal, sensitif, dan rahasia.
-   Data pribadi hanya dikumpulkan bila diperlukan.
-   Tetapkan tujuan penggunaan, masa retensi, dan akses.
-   Hindari menyimpan data pribadi atau dokumen asli di blockchain
    publik.
-   Dukung penghapusan atau pembatasan akses sesuai kebijakan dan
    kewajiban yang berlaku, tanpa merusak kebutuhan audit yang sah.
-   Publikasi lokasi kelompok tani harus mengikuti izin dan kebutuhan.
-   Jangan memasukkan token, password, atau API key ke audit log.
-   Akses dokumen sensitif harus dicatat.
-   Tentukan kebijakan retensi dan pemusnahan data.

## 17.3 Mode administrasi istimewa

-   Mode Lihat selalu baca-saja.
-   Mode Tindak memerlukan autentikasi ulang, alasan, dan waktu
    kedaluwarsa singkat.
-   Tampilkan banner yang jelas ketika mode aktif.
-   Catat setiap tindakan sebagai aktor asli dan konteks akses istimewa.
-   Kirim notifikasi ke pihak yang relevan bila sesuai.
-   Sediakan pencabutan sesi dan audit.
-   Tidak boleh ada mekanisme untuk menghapus jejak penggunaan mode.

## 17.4 Backup dan pemulihan

-   Tentukan RPO dan RTO berdasarkan kebutuhan bisnis.
-   Backup database dan file secara konsisten.
-   Uji pemulihan secara berkala.
-   Lindungi backup dari kredensial produksi yang sama jika
    memungkinkan.
-   Dokumentasikan prosedur pemulihan dan penanggung jawab.
-   Pastikan event, file bukti, dan relasi batch dapat dipulihkan secara
    konsisten.

------------------------------------------------------------------------

# 18. UX/UI dan Design System

## 18.1 Prinsip

-   Bahasa utama: Indonesia.
-   Responsif untuk desktop, tablet, dan ponsel.
-   Navigasi menyesuaikan peran.
-   Fokus pada tugas utama, bukan banyaknya kartu statistik.
-   Setiap tabel memiliki pencarian, filter, pagination, dan empty state
    yang jelas.
-   Setiap tindakan destruktif atau sensitif memiliki konfirmasi.
-   Status selalu memiliki label teks, tidak mengandalkan warna saja.
-   Aksesibilitas keyboard dan kontras harus diuji.
-   Data simulasi memiliki banner yang terlihat.
-   Loading, error, retry, dan offline state harus dirancang.
-   Halaman publik harus ringan dan dapat digunakan tanpa login.

## 18.2 Dashboard berdasarkan peran

  -----------------------------------------------------------------------
  Peran                               Isi dashboard target
  ----------------------------------- -----------------------------------
  Pengepul                            Setoran, batch tersedia,
                                      verifikasi, kiriman, label QR

  Gudang/Penggilingan                 Stok, penerimaan, proses, rendemen,
                                      neraca massa, sengketa

  Distributor                         Kiriman masuk/keluar, stok,
                                      keterlambatan, sengketa

  Logistik                            Pickup, pengantaran, rute/penugasan
                                      jika tersedia, bukti serah terima

  Retailer                            Penerimaan, batch tersedia, produk
                                      yang dipublikasikan

  Kelompok tani                       Riwayat setoran, kontribusi, status
                                      verifikasi, sengketa

  Admin                               Antrean verifikasi, kasus,
                                      konfigurasi, integritas, audit

  Pengawas                            Metrik wilayah, tren, anomali,
                                      status tindak lanjut

  Super admin                         Kesehatan sistem, akses istimewa,
                                      konfigurasi global, audit keamanan

  Konsumen                            Identitas produk, perjalanan, bukti
                                      publik, status verifikasi
  -----------------------------------------------------------------------

## 18.3 Halaman prioritas

1.  Login dan pemulihan akses.
2.  Dashboard per peran.
3.  Pencatatan setoran.
4.  Antrean verifikasi.
5.  Detail batch dan lineage.
6.  Transfer dan sengketa.
7.  Proses penggilingan dan neraca massa.
8.  Digital Product Passport.
9.  Risk Intelligence Center.
10. Investigation Workspace.
11. Integritas dan status anchor.
12. Laporan dan ekspor.
13. Portal kelompok tani.
14. Konfigurasi dan audit.

------------------------------------------------------------------------

# 19. Analytics dan Laporan

## 19.1 Metrik operasional

-   Total berat setoran per periode.
-   Jumlah setoran menunggu verifikasi.
-   Waktu rata-rata dan persentil waktu verifikasi.
-   Jumlah transfer terbuka.
-   Waktu penyelesaian transfer.
-   Jumlah dan nilai selisih berat.
-   Jumlah batch aktif menurut status.
-   Rendemen menurut proses yang sebanding.
-   Neraca massa yang belum terjelaskan.
-   Persentase event dengan bukti integritas terverifikasi.
-   Jumlah kasus dan usia kasus.
-   Status pengiriman notifikasi.
-   Kualitas dan kelengkapan data.

## 19.2 Laporan

-   Rekap setoran per kelompok tani.
-   Rekap penerimaan dan transfer.
-   Laporan batch dan lineage.
-   Laporan proses penggilingan.
-   Laporan mass balance.
-   Laporan sengketa.
-   Laporan anomali dan tindak lanjut.
-   Laporan integritas.
-   Laporan investigasi/recall.
-   Ringkasan operasional mingguan/bulanan.

## 19.3 Ekspor

Format target: - CSV untuk pertukaran data. - XLSX untuk analisis
operasional. - PDF untuk laporan formal.

Setiap ekspor harus menyimpan waktu, pembuat, periode, filter, dan versi
laporan. Ekspor data sensitif harus tunduk pada otorisasi dan audit.

------------------------------------------------------------------------

# 20. Konfigurasi

## 20.1 Variabel lingkungan baseline

  -----------------------------------------------------------------------
  Variabel                            Fungsi
  ----------------------------------- -----------------------------------
  `PORT`                              Port HTTP

  `APP_SECRET`                        Kunci tanda tangan token

  `LP_DATA_DIR`                       Lokasi data

  `MONGODB_URI`                       Koneksi MongoDB opsional

  `ANTHROPIC_API_KEY` /               Integrasi narasi AI opsional
  `ANTHROPIC_MODEL`                   

  `LEDGER_NETWORK`                    Label jaringan ledger

  `DEMO_MODE`                         Mengontrol alat demo
  -----------------------------------------------------------------------

Nama, default, dan perilaku harus diverifikasi terhadap kode sebelum
rilis.

## 20.2 Konfigurasi operasional

  Kunci                Fungsi
  -------------------- --------------------------------------------------
  `tolerancePct`       Toleransi selisih berat transfer
  `depositSlaHours`    SLA verifikasi setoran
  `samplingRate`       Persentase sampling jika kebijakan ini digunakan
  `qrQuotaPerPeriod`   Kuota label QR
  `yieldAlertPct`      Ambang peringatan rendemen
  `hangingHours`       Batas transfer menggantung
  `notifierMode`       Mode notifikasi

Semua nilai harus memiliki validasi rentang, audit perubahan, dan
dokumentasi dampak. Ambang bisnis bukan standar universal dan harus
disesuaikan berdasarkan komoditas, proses, serta hasil evaluasi.

## 20.3 Konfigurasi target

-   Environment terpisah: development, test, staging, production.
-   Provider AI dan model yang diizinkan.
-   Timeout, batas biaya, dan rate limit AI.
-   Jaringan blockchain dan kontrak yang digunakan.
-   Retensi event dan file.
-   Kebijakan publikasi field DPP.
-   Aturan risk engine.
-   Masa berlaku signed URL.
-   Kebijakan backup.
-   Feature flags untuk modul yang belum siap.

------------------------------------------------------------------------

# 21. Pengujian dan Kriteria Penerimaan

## 21.1 Jenis pengujian

-   Unit test domain dan perhitungan.
-   Integration test API dan database.
-   Smoke test alur utama.
-   Pengujian otorisasi per role dan per objek.
-   Pengujian state machine.
-   Pengujian idempotency dan konkurensi.
-   Pengujian lineage dan pencegahan siklus.
-   Pengujian neraca massa.
-   Pengujian hash-chain dan proof verification.
-   Pengujian unggahan file.
-   Pengujian backup/restore.
-   Pengujian performa.
-   Pengujian aksesibilitas dan responsivitas.
-   Pengujian keamanan.
-   Pengujian kegagalan provider AI, email, dan blockchain.
-   Uji penerimaan bersama pengguna lapangan sebelum pilot.

## 21.2 Kriteria penerimaan MVP

1.  Setoran valid dapat dibuat dan ditinjau sesuai peran.
2.  Nomor nota duplikat ditolak atau ditandai sesuai kebijakan.
3.  Batch yang belum memenuhi status tidak dapat dikirim atau digabung.
4.  Transfer membutuhkan konfirmasi penerima sesuai alur.
5.  Selisih berat menghasilkan status dan kasus yang benar.
6.  Penggabungan dan pemrosesan menjaga lineage.
7.  Kuantitas stok tidak menjadi negatif akibat transaksi bersamaan.
8.  Pengguna tidak dapat membaca atau mengubah objek di luar
    kewenangannya.
9.  Halaman publik hanya mengeluarkan field yang disetujui.
10. Perubahan data penting memiliki event dan audit.
11. Kegagalan notifikasi atau anchor tidak menghilangkan transaksi inti.
12. Backup dapat dipulihkan dalam uji terkontrol.
13. Data demo diberi label.
14. Alur utama lolos pengujian otomatis yang tercatat.

## 21.3 Kriteria penerimaan fitur AI

-   Jawaban hanya berdasarkan data yang diizinkan.
-   Referensi batch/event yang diberikan benar-benar ada.
-   AI mengakui data yang tidak tersedia.
-   Pertanyaan lintas organisasi tidak membocorkan data.
-   Prompt injection tidak dapat melewati kontrol backend.
-   Tidak ada tindakan berisiko yang berjalan tanpa persetujuan.
-   Timeout dan kegagalan provider ditangani.
-   Biaya dan latensi dapat dipantau.

## 21.4 Kriteria penerimaan blockchain

-   Root yang dikirim dapat diverifikasi kembali.
-   Status transaksi tidak dianggap final sebelum memenuhi aturan
    jaringan.
-   Proof of inclusion berhasil diverifikasi untuk event yang didukung.
-   Kegagalan RPC tidak merusak ledger operasional.
-   Konfigurasi jaringan dan alamat kontrak terlihat pada halaman
    integritas.
-   UI membedakan simulasi, testnet, dan produksi.

------------------------------------------------------------------------

# 22. Deployment dan Operasional

## 22.1 Lingkungan

-   Development: data lokal dan layanan simulasi.
-   Test: data sintetis untuk pengujian otomatis.
-   Staging: konfigurasi mendekati produksi, data non-sensitif.
-   Production: rahasia, backup, monitoring, dan kontrol akses produksi.

## 22.2 Checklist sebelum produksi

-   [ ] `APP_SECRET` ditetapkan secara aman dan tidak berubah acak pada
    setiap restart.
-   [ ] HTTPS aktif.
-   [ ] Akun demo dan alat tamper dinonaktifkan.
-   [ ] Database produksi telah diuji.
-   [ ] File storage memiliki kontrol akses.
-   [ ] Backup dan restore telah diuji.
-   [ ] Rate limiting aktif.
-   [ ] Error dan audit log tidak membocorkan rahasia.
-   [ ] Pengujian otorisasi lulus.
-   [ ] Monitoring dan alert tersedia.
-   [ ] Integrasi email/AI/blockchain diberi status nyata sesuai
    pengujian.
-   [ ] Prosedur insiden dan pemulihan terdokumentasi.
-   [ ] Kebijakan retensi dan privasi ditetapkan.
-   [ ] Data simulasi tidak tercampur dengan data nyata.

## 22.3 Observability

Sistem target mencatat: - Error rate dan latency API. - Status
database. - Kegagalan job/outbox. - Waktu respons AI dan estimasi
biaya. - Status email. - Status RPC/anchor. - Kegagalan autentikasi dan
otorisasi. - Pertumbuhan storage. - Kegagalan backup. - Status health
check.

Log tidak boleh menyimpan password, token mentah, API key, atau dokumen
sensitif.

------------------------------------------------------------------------

# 23. Roadmap Pengembangan

Roadmap ini adalah estimasi perencanaan awal, bukan komitmen tanggal.
Durasi harus diperbarui setelah audit repositori, kapasitas tim, dan
prioritas proyek ditentukan.

## Fase 0 --- Audit dan Baseline

-   Verifikasi seluruh fitur versi 0.2 terhadap kode.
-   Jalankan smoke test dan dokumentasikan hasil.
-   Buat daftar bug, risiko, dan ketergantungan.
-   Definisikan model status, invariants transaksi, dan hak akses.
-   Pisahkan data demo dari data uji.
-   Buat backlog dan acceptance criteria.

**Keluaran:** baseline yang dapat direproduksi dan backlog terprioritas.

## Fase 1 --- Secure Foundation

-   Penguatan auth dan session.
-   Rate limiting.
-   Otorisasi per objek.
-   File storage privat.
-   Audit log yang konsisten.
-   Backup/restore.
-   Unit dan integration tests.
-   Konfigurasi environment dan deployment.

**Keluaran:** fondasi yang lebih siap untuk pilot terkontrol.

## Fase 2 --- Verifiable Traceability

-   Perbaikan event ledger.
-   Lineage query hulu/hilir.
-   Verifikasi integritas.
-   DPP dan Product Journey.
-   Pengelolaan bukti.
-   Uji blockchain testnet melalui adapter.

**Keluaran:** perjalanan produk dan bukti integritas yang dapat
diperiksa.

## Fase 3 --- Operational Intelligence

-   Mass Balance Intelligence.
-   Risk dashboard.
-   Investigation Workspace.
-   Laporan CSV/XLSX/PDF.
-   Notifikasi dengan status pengiriman.
-   AI Copilot read-only berbasis tool yang diizinkan.

**Keluaran:** analisis operasional dan investigasi yang lebih efisien.

## Fase 4 --- Farmer & Partner Ecosystem

-   Portal kelompok tani.
-   API partner.
-   Integrasi logistik/perangkat yang diprioritaskan.
-   Sinkronisasi offline-first pada alur terpilih.
-   Penguatan proses sengketa dan recall.

**Keluaran:** kolaborasi antarpelaku yang lebih baik.

## Fase 5 --- Predictive Intelligence

-   Evaluasi kesiapan data historis.
-   Forecasting baseline dan model lanjutan.
-   Digital Twin.
-   Simulasi gangguan.
-   Pilot dengan mitra nyata.
-   Monitoring kualitas model.

**Keluaran:** dukungan keputusan prediktif yang terukur.

------------------------------------------------------------------------

# 24. Risiko Proyek dan Mitigasi

  -----------------------------------------------------------------------
  Risiko                  Dampak                  Mitigasi
  ----------------------- ----------------------- -----------------------
  Data awal tidak benar   Riwayat digital         Verifikasi sumber,
                          menyesatkan             bukti, sampling, dan
                                                  audit lapangan

  Blockchain dianggap     Klaim produk berlebihan Jelaskan batas bukti
  jaminan keaslian                                on-chain dan verifikasi
                                                  fisik

  AI mengarang penjelasan Keputusan salah         Tool-grounded
                                                  responses, validasi,
                                                  referensi sumber, human
                                                  review

  Data tidak lengkap      Forecasting tidak dapat Tampilkan coverage dan
                          diandalkan              jangan aktifkan model
                                                  tanpa evaluasi

  Foto/dokumen bocor      Risiko privasi dan      Storage privat, signed
                          keamanan                URL, audit akses

  Koneksi internet tidak  Transaksi               Idempotency, antrean
  stabil                  tertunda/ganda          lokal, status
                                                  sinkronisasi

  Ketidaksesuaian stok    Gangguan transaksi      Invariants, transaksi
                                                  atomik, rekonsiliasi

  Kegagalan layanan       Fungsi tambahan tidak   Retry, timeout, circuit
  eksternal               tersedia                breaker/fallback

  Penggunaan data demo    Hilangnya kepercayaan   Banner simulasi dan
  sebagai data nyata                              pemisahan lingkungan

  Integrasi terlalu       Keterlambatan dan beban Modular monolith dan
  kompleks                pemeliharaan            roadmap bertahap

  Ketergantungan provider Biaya atau perubahan    Adapter provider dan
                          layanan                 fallback

  QR disalin ke produk    Konsumen tertipu        Analisis pola scan
  palsu                                           sebagai sinyal,
                                                  proteksi label
                                                  tambahan, verifikasi
                                                  rantai fisik
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 25. Indikator Keberhasilan Produk

Target angka harus ditentukan setelah baseline diukur. MTS tidak
menetapkan angka performa yang belum didukung pengukuran.

Indikator yang perlu dipantau: - Waktu rata-rata untuk menelusuri asal
batch. - Persentase batch dengan lineage lengkap. - Persentase transaksi
dengan bukti pendukung. - Waktu penyelesaian verifikasi. - Waktu
penyelesaian sengketa. - Persentase rekonsiliasi massa yang selesai. -
Jumlah anomali yang ditinjau dan ditutup dengan alasan. - Tingkat
keberhasilan pemulihan backup. - Ketersediaan sistem. - Tingkat
keberhasilan pemindaian QR. - Tingkat jawaban AI yang didukung referensi
valid. - Jumlah insiden akses tidak sah. - Adopsi aktif oleh pelaku
rantai pasok.

Setiap KPI harus memiliki definisi, sumber data, periode pengukuran,
pemilik, dan cara perhitungan.

------------------------------------------------------------------------

# 26. Keputusan Arsitektur yang Masih Harus Ditentukan

Keputusan berikut tidak boleh diasumsikan telah final:

1.  MongoDB atau PostgreSQL untuk produksi.
2.  Provider object storage.
3.  Provider email dan kanal notifikasi.
4.  Provider AI, model, kebijakan privasi, dan batas biaya.
5.  Jaringan blockchain dan model biaya anchoring.
6.  Apakah identitas GS1 tersedia atau QR internal cukup untuk pilot.
7.  Peran dan alur autentikasi kelompok tani.
8.  Kebijakan data publik dan lokasi.
9.  SLA, RPO, RTO, dan retensi data.
10. Apakah offline-first benar-benar dibutuhkan oleh pengguna lapangan.
11. Data historis apa yang tersedia untuk forecasting.
12. Siapa yang berwenang memutuskan recall dan sengketa.
13. Ambang neraca massa/rendemen untuk tiap proses.
14. Kebutuhan audit dan kepatuhan yang berlaku untuk mitra sasaran.

------------------------------------------------------------------------

# 27. Glosarium

  -----------------------------------------------------------------------
  Istilah                             Arti
  ----------------------------------- -----------------------------------
  Batch/Lot                           Unit barang yang dapat ditelusuri

  Lineage                             Hubungan asal dan turunan
                                      antarbatch

  Event ledger                        Catatan kronologis peristiwa bisnis

  Hash-chain                          Rangkaian hash yang menghubungkan
                                      catatan

  Anchor                              Menambatkan hash atau Merkle root
                                      ke ledger/jaringan eksternal

  Merkle tree                         Struktur hash yang mendukung bukti
                                      keanggotaan data

  Digital Product Passport            Halaman identitas dan informasi
                                      digital produk

  Mass balance                        Rekonsiliasi input, output, produk
                                      samping, dan susut

  Anomali                             Kondisi yang menyimpang dari aturan
                                      atau pola; bukan otomatis bukti
                                      kecurangan

  Human-in-the-loop                   Keputusan penting tetap melibatkan
                                      manusia

  Outbox                              Antrean pekerjaan yang memastikan
                                      event/integrasi dapat dicoba ulang

  Idempotency                         Sifat operasi yang aman ketika
                                      permintaan yang sama diproses lebih
                                      dari sekali

  Digital twin                        Representasi digital untuk analisis
                                      atau simulasi sistem nyata

  Recall                              Proses penarikan produk yang
                                      diputuskan oleh pihak berwenang

  RPO                                 Batas kehilangan data yang dapat
                                      diterima saat pemulihan

  RTO                                 Target waktu pemulihan layanan
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 28. Referensi Teknis Awal

Referensi berikut merupakan titik awal untuk pengembangan dan perlu
diperiksa kembali saat implementasi:

-   GS1 Digital Link: https://www.gs1.org/standards/gs1-digital-link
-   OWASP Application Security Verification Standard:
    https://owasp.org/www-project-application-security-verification-standard/

------------------------------------------------------------------------

# 29. Ringkasan Arah Produk

LestariPangan dikembangkan secara bertahap dari prototipe traceability
menjadi platform yang menyatukan:

1.  **Supply Chain Traceability** --- pencatatan dan penelusuran barang.
2.  **Verifiable Trust** --- pemeriksaan integritas dan bukti transaksi.
3.  **Digital Product Passport** --- pengalaman konsumen berbasis QR.
4.  **Mass Balance Intelligence** --- rekonsiliasi input dan output.
5.  **AI Investigation Copilot** --- bantuan analisis berbasis data dan
    bukti.
6.  **Governance & Audit** --- keputusan, kasus, dan perubahan yang
    dapat ditinjau.
7.  **Farmer Intelligence** --- transparansi transaksi bagi kelompok
    tani.
8.  **Predictive Supply Chain** --- proyeksi dan simulasi setelah data
    memadai.

**Prinsip akhir:** LestariPangan harus spektakuler karena sistemnya
saling terhubung, dapat menjelaskan dasar setiap klaim, dan membantu
pengguna bertindak dengan lebih baik---bukan karena menampilkan
teknologi yang belum benar-benar bekerja.
