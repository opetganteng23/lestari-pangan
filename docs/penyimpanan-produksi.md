# Keputusan penyimpanan data untuk pilot dan produksi

Status: **keputusan sementara untuk pilot**, ditinjau ulang sebelum produksi. Ditulis agar keputusannya tercatat dan alasan serta batasnya tidak hilang.

## Keputusan
| Hal | Pilot (sekarang) | Produksi (sebelum dipakai mitra luas) |
|---|---|---|
| Basis data | Berkas JSON (`data/db.json`), satu proses backend, di PC/server milik sendiri | Pindah ke database sungguhan (MongoDB atau PostgreSQL) setelah adapter diuji; **belum diputuskan** |
| Ledger | `data/ledger.json` (rantai hash lokal) | Jaringan blockchain publik/konsorsium; **belum diputuskan** |
| Bukti foto | `data/uploads/`, diakses lewat URL bertanda tangan | Object storage (S3-compatible) dengan enkripsi dan kebijakan retensi |
| Backup | Harian terjadwal (Task Scheduler), simpan 14 terbaru | Backup terenkripsi ke lokasi berbeda mesin; uji pulih berkala |
| Retensi | Job harian (lihat di bawah) | Disepakati tertulis dengan mitra |

## Mengapa berkas JSON cukup untuk pilot
- Skala pilot kecil (1 penggilingan, beberapa pengepul dan kelompok tani, 4–8 minggu). `db.json` saat ini sekitar 0,3 MB dengan data simulasi lengkap.
- Tanpa dependensi dan tanpa layanan tambahan: mudah dipasang, dicadangkan (salin folder), dan dipulihkan.
- Penulisan atomik (tulis ke berkas sementara lalu rename) dan ditunda 150 ms; penutupan normal memanggil `flush()`.

## Batas yang harus diterima (dan kapan harus pindah)
1. **Satu proses saja.** Data dimuat ke memori dan seluruh berkas ditulis ulang saat ada perubahan. Dua proses backend pada data yang sama akan saling menimpa. Skrip perawatan di `scripts/` menolak jalan bila backend hidup karena alasan ini.
2. **Ukuran.** Setiap perubahan menulis ulang seluruh berkas. Pantau ukuran `db.json`; bila mendekati puluhan MB atau penyimpanan terasa lambat, pindah database. Retensi di bawah menahan pertumbuhan catatan operasional.
3. **Tidak ada transaksi lintas koleksi.** Mati listrik di tengah rangkaian penulisan bisa meninggalkan keadaan setengah jadi (mis. event tanpa catatan antrean). Ledger punya pemeriksaan integritas (menu Integritas Blockchain) untuk mendeteksi masalah rantai.
4. **Titik kegagalan tunggal.** Bila PC mati, aplikasi mati. Cadangan harian membatasi kehilangan data (RPO) sampai maksimal sekitar 24 jam; pemulihan (RTO) bergantung pada seberapa cepat PC/server pengganti disiapkan.
5. **MongoDB adapter belum teruji.** `MONGODB_URI` ada di kode tetapi belum dijalankan terhadap MongoDB sungguhan di lingkungan ini. Jangan dipakai sebagai jalur produksi sebelum diuji.

## Pemicu untuk berpindah ke database produksi
Pindah bila **salah satu** terpenuhi: lebih dari satu instansi/mitra memakai data yang sama; lebih dari satu server backend dibutuhkan; ukuran `db.json` di atas ~50 MB atau penulisan terasa lambat; mitra mensyaratkan RPO di bawah 24 jam; atau audit keamanan mensyaratkan enkripsi saat disimpan (data at rest).

## Backup (Windows)
- Daftarkan sekali: `deploy\windows\install-backup-task.ps1` (opsi `-Jam 02:00`). Tugas berjalan harian, `StartWhenAvailable` menjalankan cadangan yang terlewat saat PC menyala lagi. Hapus: `uninstall-backup-task.ps1`.
- Jumlah cadangan yang disimpan: `LP_BACKUP_KEEP` (bawaan 14). Lokasi: `LP_BACKUP_DIR` (bawaan `backups/`); **letakkan di drive/mesin lain** agar cadangan tidak ikut hilang bersama datanya.
- Hasil dicatat di `logs\backup.log`. `.secret` sengaja tidak ikut cadangan (kunci penandatangan) dan harus disimpan terpisah, aman, dan terenkripsi; tanpanya sesi dan tautan bukti lama tidak valid setelah pemulihan.
- Uji pulih (`npm run restore`) di mesin lain secara berkala. Cadangan yang belum pernah diuji pulih belum bisa dipercaya.

## Retensi
Job pembersih berjalan 60 detik setelah backend menyala lalu tiap 24 jam. Atur lewat `.env` (nilai 0 = jangan hapus jenis itu):

| Variabel | Bawaan | Yang dibuang |
|---|---|---|
| `RETAIN_AUDIT_DAYS` | 730 | audit log lebih tua dari batas |
| `RETAIN_NOTIF_DAYS` | 90 | notifikasi lebih tua dari batas |
| `RETAIN_IDEM_DAYS` | 7 | kunci idempotensi lama (klien tidak lagi mengulang permintaan sebulanan) |
| `RETAIN_OUTBOX_DAYS` | 30 | antrean anchor **selesai**, diukur dari umur event-nya |

Tidak pernah disentuh: event/ledger, batch, setoran, transfer, kasus, serta antrean anchor yang masih pending atau gagal. Setiap penghapusan menulis satu baris audit `retensi.bersih` berisi jumlahnya. **Masa retensi audit log perlu disepakati dengan mitra dan, bila ada, dengan ketentuan hukum yang berlaku**; angka bawaan hanyalah titik awal.

## Berkas upload
- `scripts/clean-uploads.js` (`npm run uploads:clean`) menampilkan berkas yatim (tidak dirujuk catatan mana pun, mis. foto contoh `seed-*.svg` dan foto uji). Dengan `--apply`, berkas **dipindahkan** ke `data/uploads-yatim/<waktu>/` (bukan dihapus). Jalankan dengan backend mati dan setelah `npm run backup`.
