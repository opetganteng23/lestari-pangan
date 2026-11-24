# Tindakan manual (yang harus dilakukan pemilik sistem)

Daftar ini berisi hal yang sengaja **tidak** dikerjakan otomatis: mengubah `.env`, mendaftarkan verifikasi dua langkah, menggabungkan cabang, dan memeriksa situs live. Tidak ada kata sandi di berkas ini.

## 1. Ubah `.env` (lalu nyalakan ulang backend)
Ubah dua nilai ini di `.env` (berkas rahasia, tidak ikut git):

```
SEED_DEMO=0
DEMO_MODE=0
```

- `DEMO_MODE=0` mematikan alat "ubah data event". Selama nilainya bukan `0`, `/api/health` melaporkan `demoMode: true`.
- Badge "DATA SIMULASI" hilang hanya bila **kedua** nilai itu `0`.
- `SEED_DEMO=0` hanya berpengaruh saat data kosong. Akun demo di data Anda sudah dinonaktifkan lewat skrip, jadi mengubahnya aman.

Opsional (semua punya bawaan yang masuk akal; lihat `.env.example`):
```
# FEATURES=prediksi,copilot,email,integrasi   # bawaan kosong: menu lanjutan mati
# LP_BACKUP_DIR=D:\lestari-backup              # sebaiknya drive lain
# LP_BACKUP_KEEP=14
# RETAIN_AUDIT_DAYS=730   RETAIN_NOTIF_DAYS=90   RETAIN_IDEM_DAYS=7   RETAIN_OUTBOX_DAYS=30
```
Setelah mengubah `.env`: `Operasional\Matikan-LestariPangan.bat`, lalu `Operasional\Nyalakan-LestariPangan.bat`.

## 2. Ganti kata sandi akun Anda
Kata sandi super admin sempat tertulis di percakapan dan di keluaran terminal. Anggap sudah bocor: masuk, buka **Profil & Keamanan**, dan ganti. Jangan menempelkan isi `data/db.json` ke mana pun (berisi hash sandi).

## 3. Daftarkan verifikasi dua langkah (TOTP)
1. Masuk, buka **Profil & Keamanan → Verifikasi dua langkah → Aktifkan**.
2. Pindai QR dengan aplikasi autentikator (Google Authenticator, Microsoft Authenticator, Aegis, dll.) atau ketik kuncinya, lalu masukkan kode 6 digit.
3. **Simpan 8 kode pemulihan** yang tampil sekali (di pengelola kata sandi). Tiap kode berlaku sekali.

Masa tenggang agar Anda tidak terkunci: login **tidak** dipaksa memakai kode sampai Anda sendiri mengaktifkannya. Yang langsung berlaku: **Mode Tindak ditolak sebelum MFA aktif**. Setelah aktif, login dan Mode Tindak meminta kode.

Bila ponsel hilang dan kode pemulihan juga hilang: matikan backend, lalu `node scripts/reset-mfa.js email-anda`, nyalakan lagi, masuk dengan sandi, dan daftarkan ulang.

## 4. Gabungkan cabang `perbaikan-audit`
Semua pekerjaan ada di cabang `perbaikan-audit` (tidak ada yang di-push ke `main` sejak cabang dibuat). Buka pull request:
`https://github.com/opetganteng23/lestari-pangan/pull/new/perbaikan-audit`, tinjau, lalu gabungkan.

Catatan: satu commit awal Fase 1 (`f36a092`, wilayah resmi + migrasi) sudah terlanjur ada di `main` sebelum cabang dibuat; sisanya hanya di cabang.

**Backend saat ini berjalan dari kode cabang ini** (folder kerja berada di cabang `perbaikan-audit`). Bila ingin kembali ke kode `main` sebelum merge: `git checkout main`, lalu nyalakan ulang backend.

## 5. Cek deploy Vercel setelah merge
Vercel membangun ulang saat `main` berubah. Setelah selesai, periksa di browser sungguhan (saya hanya bisa memeriksa lewat Chrome headless):
- [ ] `https://lestari-pangan-gamma.vercel.app/app` memuat, masuk berhasil (dengan kode MFA bila sudah aktif).
- [ ] Dashboard: peta tampil dengan tile OpenStreetMap, cluster bisa diklik. Buka konsol browser: tidak boleh ada galat CSP. `vercel.json` kini mengizinkan gambar dari `https://tile.openstreetmap.org` saja.
- [ ] Tab Ringkasan / Anomali / Tren Pasokan / Trace Log, serta Mode Tindak & Lihat (super admin), berfungsi.
- [ ] Ikon menu dan lonceng tampil; layar ponsel memakai menu laci.
- [ ] `GET /api/health` lewat Vercel: `demoAccounts:false`; `demoMode:false` setelah langkah 1.
- [ ] Setelah deploy, muat ulang dengan Ctrl+F5 sekali (service worker memakai cache baru `lp-shell-v5`).

## 6. Jadwalkan cadangan harian (Windows)
Dari PowerShell di folder proyek: `deploy\windows\install-backup-task.ps1` (opsi `-Jam 02:00`). Hasil ada di `logs\backup.log`. Letakkan `LP_BACKUP_DIR` di drive lain. Simpan juga `data\.secret` secara terpisah dan aman (tidak ikut cadangan). Uji pulih (`npm run restore`) di mesin lain.

## 7. Sisa pembersihan data (keputusan Anda)
- **"Tes Pengepul"** dan akun `tespengepul@lestari.id` dilewati karena masih punya 1 kunci API. Nonaktifkan/hapus kunci API itu di menu Integrasi (butuh `FEATURES=integrasi`), lalu jalankan ulang `npm run purge:test` (dry-run, lalu `-- --apply`) dengan backend mati.
- **14 berkas foto yatim** di `data/uploads` (tidak dirujuk catatan mana pun) belum dipindahkan. Lihat daftarnya dengan `npm run uploads:clean`; terapkan dengan `-- --apply` bila setuju (berkas dipindah ke `data/uploads-yatim/`, bukan dihapus).
- Pelaku demo (CV Tani Makmur dkk.) dan datanya masih ada walau akun login-nya nonaktif. Bila ingin benar-benar mulai kosong untuk pilot, mulai dari `data/` baru dengan `SEED_DEMO=0` (lihat `docs/pilot.md`, jalur A).

## 8. Hal yang perlu diketahui
- Tailscale Funnel gratis kadang tidak stabil (relay publik berganti, DNS lambat). Bila tautan sering putus, pertimbangkan Cloudflare Tunnel (butuh domain sendiri).
- Layanan Tailscale bisa macet di `NoState` setelah reboot; pemulihannya `Restart-Service Tailscale` (butuh hak admin).
- Akun yang aktif saat ini hanya akun super admin Anda; semua `@lestari.id` nonaktif.
