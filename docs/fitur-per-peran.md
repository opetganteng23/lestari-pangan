# Fitur per peran

Sumber: menu navigasi (`NAV` dan `ADD` di `public/js/core.js`) dan endpoint di `server/routes*.js`. Menu dikelompokkan per seksi (Operasional, Pengawasan, Administrasi, Lanjutan, Akun); peran pelaku rantai pasok hanya punya Operasional dan Akun.

## Menu per peran

| Peran | Menu | Fungsi utama |
|---|---|---|
| Pengepul | Beranda · Catat Setoran · Setoran Saya · Batch & Gabung · Kirim & Transfer · QR Label · Profil & Keamanan | Mencatat setoran petani lewat kode ketua kelompok tani, menggabung batch, mengirim ke gudang, mencetak label QR hulu |
| Gudang/Penggilingan | Beranda · Terima Barang · Batch & Lineage · Pengemasan & QR · Kirim · Neraca Massa · Laporan · Profil & Keamanan | Menerima kiriman, menyimpan, menggiling (dengan produk samping/susut), mengemas dan membuat QR konsumen, mengirim ke distributor; melihat neraca massa dan laporan sesuai izin perannya |
| Distributor | Beranda · Terima Barang · Batch · Kirim ke Retailer · Profil & Keamanan | Menerima dari gudang, meneruskan ke retailer |
| Logistik | Beranda · Kiriman Saya · Profil & Keamanan | Mengonfirmasi pengangkutan kiriman |
| Retailer | Beranda · Terima Barang · Stok & Asal Produk · Profil & Keamanan | Menerima barang, melihat stok dan asal produk |
| Kelompok tani | Beranda Kelompok · Laporan · Profil & Keamanan | Portal baca-saja: riwayat setoran, kontribusi, sengketa, notifikasi, ekspor |
| Admin teknis | **Operasional/Pengawasan:** Beranda · Antrean Verifikasi · Sengketa Transfer · Integritas Blockchain · Kasus & Investigasi · Papan Risiko · Neraca Massa · Laporan & Ekspor<br>**Administrasi:** Pengguna · Pelaku & Kode Referral · Kelompok Tani · Konfigurasi · Audit Log<br>**Lanjutan:** Server (selalu) · Prediksi & Simulasi · Integrasi & API · Pengiriman Email · Asisten Analisis (empat terakhir hanya bila `FEATURES` menyalakannya)<br>**Akun:** Profil & Keamanan | Verifikasi setoran, kelola referral, pengguna dan kelompok tani (wilayah dipilih dari daftar), selesaikan sengketa, cek rantai hash, atur konfigurasi, pantau server |
| Pengawas (Dinas) | Dashboard (tab Ringkasan · Anomali · Tren Pasokan · Trace Log) · Integritas Blockchain · Kasus & Investigasi · Papan Risiko · Neraca Massa · Laporan & Ekspor · Audit Log · Profil & Keamanan; Prediksi & Simulasi dan Asisten Analisis bila `FEATURES` menyalakannya | Pemantauan baca-saja, peta sebaran, analitik, ringkasan naratif |
| Super admin | Mode Tindak & Lihat (satu halaman bertab) · Dashboard Pengawasan (bertab) + semua menu Admin dan Pengawas | Melihat atau bertindak atas nama pelaku lain. Mode Tindak butuh sandi, alasan, **kode verifikasi dua langkah (MFA)**, berlaku 15 menit, tercatat di audit |
| Konsumen (tanpa login) | `/t/<kode kemasan>` | Menelusuri asal pangan dari QR kemasan |

Alamat lama `#/anomali`, `#/tren`, `#/tracelog`, `#/mode-tindak`, `#/mode-lihat` otomatis dialihkan ke tab yang sesuai.

## Fitur lanjutan (`FEATURES`)
Menu Prediksi & Simulasi, Asisten Analisis, Pengiriman Email, dan Integrasi & API **mati bawaan** (mode pilot). Nyalakan di `.env`: `FEATURES=prediksi,copilot,email,integrasi` (pilih yang perlu). Pengaturan ini menyaring menu dan rute di antarmuka; endpoint API tetap dilindungi izin peran seperti biasa.

## Matriks fitur

Y = bisa, – = tidak.

| Fitur | Pengepul | Gudang | Distrib. | Logistik | Retailer | Admin | Pengawas | Super admin |
|---|---|---|---|---|---|---|---|---|
| Daftar dengan kode referral (pilih wilayah dari daftar) | Y | Y | Y | Y | Y | – | – | – |
| Catat setoran petani | Y | – | – | – | – | – | – | Y (Mode Tindak) |
| Verifikasi setoran | – | – | – | – | – | Y | – | Y |
| Cetak label QR hulu | Y | – | – | – | – | – | – | Y (Mode Tindak) |
| Gabung batch | Y | – | – | – | – | – | – | Y (Mode Tindak) |
| Terima barang | – | Y | Y | – | Y | – | – | Y (Mode Tindak) |
| Simpan / giling / kemas | – | Y | – | – | – | – | – | Y (Mode Tindak) |
| Buat QR kemasan konsumen | – | Y | – | – | – | – | – | Y (Mode Tindak) |
| Kirim / transfer batch | Y | Y | Y | – | – | – | – | Y (Mode Tindak) |
| Konfirmasi angkut | – | – | – | Y | – | – | – | Y (Mode Tindak) |
| Lihat batch dan lineage | Y | Y | Y | – | Y | Y | Y | Y |
| Selesaikan sengketa transfer | – | – | – | – | – | Y | – | Y |
| Kelola kode referral | – | – | – | – | – | Y | – | Y |
| Kelola pengguna (tambah/ubah/reset sandi/nonaktif/hapus) | – | – | – | – | – | Y | – | Y |
| Kelola kelompok tani (termasuk hapus) | – | – | – | – | – | Y | – | Y |
| Konfigurasi sistem | – | – | – | – | – | Y | – | Y |
| Menu Server (status, cadangan, gerbang layanan) | – | – | – | – | – | Y | – | Y |
| Cek integritas blockchain | – | – | – | – | – | Y | Y | Y |
| Audit log | – | – | – | – | – | Y | Y | Y |
| Dashboard bertab (ringkasan + peta, anomali, tren, trace log) | – | – | – | – | – | Y (Beranda) | Y | Y |
| Jalankan analitik / ringkasan | – | – | – | – | – | Y | Y | Y |
| Kasus & investigasi, papan risiko | – | – | – | – | – | Y | Y | Y |
| Neraca massa, laporan & ekspor | – | Y (sesuai izin peran) | – | – | – | Y | Y | Y |
| Mode Lihat (jelajah sebagai pelaku lain) | – | – | – | – | – | – | – | Y |
| Profil, ganti kata sandi | Y | Y | Y | Y | Y | Y | Y | Y |
| Verifikasi dua langkah (MFA TOTP) | – | – | – | – | – | – | – | Y (wajib untuk Mode Tindak) |
| Reset sandi mandiri lewat email (butuh SMTP) | Y | Y | Y | Y | Y | Y | Y | Y |
| Notifikasi dalam aplikasi | Y | Y | Y | Y | Y | Y | Y | Y |

## Celah yang masih terlihat

- Distributor tidak punya QR Label atau Pengemasan, dan pengepul tidak punya halaman Terima.
- Pemindaian QR lewat kamera belum ada (kode QR bisa dibuka sebagai tautan).
- MFA baru untuk super admin; akun admin teknis dan pengawas belum wajib MFA.
- Reset sandi mandiri butuh SMTP yang belum diuji dengan server nyata; admin tetap bisa mereset dari menu Pengguna.
