# Fitur per peran

Sumber: menu navigasi (`NAV` di `public/js/core.js`) dan endpoint di `server/routes.js`.

## Menu per peran

| Peran | Menu | Fungsi utama |
|---|---|---|
| Pengepul | Beranda · Catat Setoran · Setoran Saya · Batch & Gabung · Kirim & Transfer · QR Label | Mencatat setoran petani lewat kode ketua kelompok tani, menggabung batch, mengirim ke gudang, mencetak label QR hulu |
| Gudang/Penggilingan | Beranda · Terima Barang · Batch & Lineage · Pengemasan & QR · Kirim | Menerima kiriman, menyimpan, menggiling, mengemas dan membuat QR konsumen, mengirim ke distributor |
| Distributor | Beranda · Terima Barang · Batch · Kirim ke Retailer | Menerima dari gudang, meneruskan ke retailer |
| Logistik | Beranda · Kiriman Saya | Mengonfirmasi pengangkutan kiriman |
| Retailer | Beranda · Terima Barang · Stok & Asal Produk | Menerima barang, melihat stok dan asal produk |
| Admin teknis | Beranda · Antrean Verifikasi · Pengguna · Pelaku & Kode Referral · Kelompok Tani · Sengketa Transfer · Integritas Blockchain · Konfigurasi · Audit Log | Verifikasi setoran, kelola referral dan kelompok tani, selesaikan sengketa, cek rantai hash, atur konfigurasi |
| Pengawas (Dinas) | Dashboard · Trace Log · Anomali · Tren Pasokan · Integritas Blockchain · Audit Log | Pemantauan baca-saja, analitik, ringkasan naratif |
| Super admin | Mode Tindak · Mode Lihat · Dashboard Pengawasan + semua menu Admin dan Pengawas | Melihat atau bertindak atas nama pelaku lain (Mode Tindak butuh sandi dan alasan, 15 menit, tercatat di audit) |
| Konsumen (tanpa login) | `/t/<kode kemasan>` | Menelusuri asal pangan dari QR kemasan |

## Matriks fitur

Y = bisa, – = tidak.

| Fitur | Pengepul | Gudang | Distrib. | Logistik | Retailer | Admin | Pengawas | Super admin |
|---|---|---|---|---|---|---|---|---|
| Daftar dengan kode referral | Y | Y | Y | Y | Y | – | – | – |
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
| Cek integritas blockchain | – | – | – | – | – | Y | Y | Y |
| Audit log | – | – | – | – | – | Y | Y | Y |
| Dashboard, tren, anomali, trace log | – | – | – | – | – | Y (Beranda) | Y | Y |
| Jalankan analitik / ringkasan | – | – | – | – | – | Y | Y | Y |
| Mode Lihat (jelajah sebagai pelaku lain) | – | – | – | – | – | – | – | Y |
| Notifikasi dalam aplikasi | Y | Y | Y | Y | Y | Y | Y | Y |

## Celah yang terlihat

- Distributor tidak punya QR Label atau Pengemasan, dan pengepul tidak punya halaman Terima.
- Tidak ada ekspor laporan (CSV/PDF).
- Tidak ada halaman Profil/Ganti kata sandi mandiri untuk semua peran (admin bisa reset).
- Tidak ada pemulihan kata sandi dan pembatasan laju login.
- Pemindaian QR lewat kamera belum ada.
