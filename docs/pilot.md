# Panduan pilot terkontrol

Pilot dengan mitra nyata **belum dilakukan**. Dokumen ini adalah prasyarat dan rencana, bukan laporan hasil.

## Prasyarat sebelum pilot
| Syarat | Status saat ini |
|---|---|
| `APP_SECRET` diset, HTTPS lewat reverse proxy/tunnel, `TRUST_PROXY=1`, `DEMO_MODE=0` | Perlu dikonfigurasi di `.env` (periksa dengan `npm run check:env`) |
| Data dimulai dari kosong tanpa akun demo, dengan satu super admin | **Ada**: lihat "Jalur pilot" di bawah |
| Akun demo (`@lestari.id`) dinonaktifkan bila data lama sudah terlanjur dimuat | **Ada**: `npm run demo:disable` |
| Data uji dibersihkan | **Ada**: `npm run purge:test` (dry-run dulu) |
| Super admin memakai verifikasi dua langkah (MFA) | **Ada**: aktifkan di Profil; Mode Tindak wajib MFA |
| Wilayah pelaku dan kelompok tani dipilih dari daftar resmi (titik peta tidak palsu) | **Ada**: `server/regions.js`; migrasi data lama `npm run regions:fix` |
| Backup terjadwal | **Ada**: `deploy\windows\install-backup-task.ps1` (harian, simpan 14). Uji pulih dan RPO/RTO belum disepakati |
| Retensi data | **Ada** job harian yang bisa diatur (`RETAIN_*`); masa retensi belum disepakati dengan mitra |
| Persetujuan mitra tentang data yang dicatat (nama, wilayah kabupaten/kota, foto nota) dan masa retensi | Belum |
| Uji keamanan pihak ketiga / OWASP ASVS | Belum |
| SMTP diuji dengan penyedia nyata bila email dipakai | Belum |
| Uji lapangan offline-first di perangkat dan jaringan nyata | Belum |
| Keputusan database dan ledger produksi | Belum; lihat [penyimpanan-produksi.md](penyimpanan-produksi.md) |

## Jalur pilot (mulai kosong, tanpa akun demo)
Ada dua cara memperoleh akun super admin; keduanya **tidak menyimpan sandi di berkas mana pun**.

**A. Data baru dari nol** (folder `data/` kosong atau dihapus). Di `.env` set:
```
SEED_DEMO=0
DEMO_MODE=0
ADMIN_EMAIL=nama@contoh.id
ADMIN_PASSWORD=<sandi kuat>
```
Saat backend menyala pada data kosong, hanya satu akun super admin dibuat dari nilai itu (tanpa data simulasi). Setelah akun terbentuk, **hapus `ADMIN_PASSWORD` dari `.env`**. Backend menolak menyala bila `SEED_DEMO=0` tetapi email/sandi tidak valid atau lemah.

**B. Data sudah ada** (mis. data simulasi terlanjur dimuat). Matikan backend, lalu:
1. `npm run backup`
2. Buat atau perbarui super admin: `node scripts/create-admin.js` (sandi diketik tersembunyi), atau non-interaktif untuk satu proses saja: `$env:ADMIN_EMAIL='nama@contoh.id'; $env:ADMIN_PASSWORD='...'; node scripts/create-admin.js; Remove-Item Env:ADMIN_PASSWORD`. Skrip idempoten: bila akun sudah ada, role dipastikan super admin, akun diaktifkan, sandi diganti, sesi lama dicabut.
3. **Pastikan akun itu bisa login** sebelum menonaktifkan akun lain.
4. `npm run demo:disable -- --dry-run`, lalu `npm run demo:disable` (menonaktifkan semua `@lestari.id`, tidak menghapus; menolak jalan bila tidak ada super admin aktif lain).
5. `npm run purge:test` (dry-run), lalu `npm run purge:test -- --apply` bila daftarnya benar. Entri yang punya catatan terkait dilewati, bukan dihapus.
6. `npm run regions:fix` (dry-run), lalu `-- --apply`, untuk memindahkan titik default lama ke wilayahnya.
7. `npm run uploads:clean` (dry-run) untuk merapikan foto contoh/uji yang yatim.
8. Ubah `.env`: `SEED_DEMO=0`, `DEMO_MODE=0`; nyalakan ulang backend. Badge "DATA SIMULASI" di antarmuka hilang saat kedua nilai itu `0`.
9. Login, buka Profil → Verifikasi dua langkah, aktifkan, dan simpan kode pemulihan. Jika ponsel hilang: `node scripts/reset-mfa.js email` (backend mati).

## Ruang lingkup yang disarankan
1. 1 penggilingan, 2 pengepul, 3–4 kelompok tani, 1 retailer; 4–8 minggu.
2. Aktifkan: setoran, verifikasi, transfer, giling (dengan produk samping/susut), kemas, QR, portal kelompok tani.
3. Biarkan **mati** (bawaan `FEATURES` kosong): Prediksi & Simulasi (Forecasting dan Digital Twin) sampai kriteria kesiapan data terpenuhi (≥ 12 minggu, ≥ 70% minggu berisi), Asisten Analisis (AI Copilot jalur Claude), Pengiriman Email, dan Integrasi & API. Nyalakan satu per satu lewat `FEATURES=prediksi,copilot,email,integrasi` bila memang dibutuhkan. Adapter blockchain EVM tetap tidak dipakai.

## Indikator yang dipantau
- Waktu verifikasi setoran (median dan p90), persentase melewati SLA.
- Jumlah dan penyebab setoran ditolak; nota ganda; kode ketua salah.
- Selisih berat transfer dan jumlah sengketa; waktu penyelesaian kasus.
- Persentase proses giling dengan rincian neraca massa terisi.
- Persentase event ter-anchor dan hasil verifikasi integritas.
- Adopsi: setoran offline yang berhasil disinkronkan; pembukaan halaman konsumen.
- Kualitas model (bila diaktifkan): menu Prediksi → Pemantauan model; tindak lanjut bila status "PERLU DITINJAU".

## Kriteria berhenti / ulang
- Kebocoran data atau akses lintas organisasi yang tidak semestinya.
- Hash tidak cocok tanpa penjelasan, atau kehilangan catatan saat sinkron offline.
- Mitra tidak dapat menyelesaikan alur inti tanpa pendampingan setelah pelatihan.

## Keputusan yang masih terbuka
Lihat bagian 26 pada [mts.md](mts.md) dan [penyimpanan-produksi.md](penyimpanan-produksi.md): pilihan database produksi, jaringan blockchain, penyedia AI dan kebijakan privasinya, kebijakan retensi data.
