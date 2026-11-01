# Deploy: frontend di Vercel, backend di PC on-prem

Pola yang sama dengan NOTAM (PC tidak dibuka ke internet; PC yang menyambung keluar), tetapi file statis dilayani Vercel.

```
Browser ──HTTPS──> Vercel (situs statis dari public/)
                     ├─ /            file statis
                     ├─ /t/KODE      → trace.html (halaman konsumen)
                     └─ /api  /uploads  /qr   (rewrite eksternal)
                              │
                              ▼  HTTPS
                       Caddy di VPS  lestari-api.<domain>
                              └─> nginx 172.19.0.1:13401 ──> 127.0.0.1:13400 (VPS)
                                                                  ▲  tunnel balik SSH (PC yang memulai)
PC on-prem:  backend :3000 (127.0.0.1)  ◄─────────────────────────┘
             data/ (JSON + ledger + unggahan)      → api.anthropic.com (kunci hanya di PC)
```

Karena Vercel meneruskan `/api` sebagai rewrite, browser hanya melihat satu asal (`https://proyek.vercel.app`): tanpa CORS dan tanpa perubahan kode frontend.

**Keuntungan:** kunci Anthropic, kunci sesi, dan data tidak pernah ada di Vercel. **Konsekuensi:** bila PC mati atau tunnel putus, `/api` mengembalikan galat (halaman statis tetap tampil).

## Yang perlu Anda siapkan sendiri
| Hal | Catatan |
|---|---|
| VPS dengan Caddy/nginx + akses SSH | Sama seperti NOTAM; atau gunakan Cloudflare Tunnel (lihat bawah) |
| Subdomain untuk API, mis. `lestari-api.<domain-anda>` | A record ke IP VPS |
| Akun Vercel yang tersambung ke repo GitHub | Framework "Other"; `vercel.json` sudah mengatur output |
| Kunci Anthropic (opsional) | Isi `ANTHROPIC_API_KEY` di `.env` PC |

## Langkah

### 1. PC on-prem
```
npm run init:env          # membuat .env dengan APP_SECRET acak (sudah dibuat bila Anda memakai berkas dari saya)
```
Edit `.env`: isi `PUBLIC_URL` (alamat Vercel), `ANTHROPIC_API_KEY`, dan `LP_VPS_HOST`, `LP_SSH_KEY`, `LP_API_PUBLIC_URL` (bagian "Tombol operasional"). Lalu:
```
npm run check:env         # periksa; tambahkan -- --ping untuk menguji kunci Anthropic
```
Klik dua kali `Operasional\Nyalakan-LestariPangan.bat` (menyalakan backend + tunnel, lalu menampilkan status). `Aktifkan-Otomatis.bat` membuatnya menyala sendiri saat Anda masuk Windows. Pastikan Windows tidak Sleep.

### 2. VPS
1. Salin `deploy/vps/nginx-lestari.conf` ke `/etc/nginx/sites-available/lestari`, symlink ke `sites-enabled`, `nginx -t && systemctl reload nginx`.
2. Tambahkan blok dari `deploy/vps/Caddyfile.lestari.snippet` ke Caddyfile (ganti domain), reload Caddy.
3. Tes dari luar setelah tunnel hidup: `curl https://lestari-api.<domain>/api/health` harus menjawab `{"ok":true,...}`.

### 3. Vercel
1. Dari akar repo: `npm run vercel:config -- https://lestari-api.<domain>` lalu commit dan push `vercel.json`.
2. Vercel → Add New Project → pilih repo → Framework "Other" → Deploy. Tidak ada environment variable yang diperlukan di Vercel.
3. Salin alamat proyek ke `PUBLIC_URL` di `.env` PC, lalu nyalakan ulang backend (agar QR kemasan menunjuk ke alamat Vercel).
4. Buka `https://proyek.vercel.app`, login, dan buka menu **Server** (admin).

## Verifikasi
| Cek | Perintah / tempat |
|---|---|
| Backend lokal | `Operasional\Status-LestariPangan.bat` |
| Lewat Vercel | `curl https://proyek.vercel.app/api/health` |
| Halaman konsumen | `https://proyek.vercel.app/t/LP-PKG-2026-0211` |
| QR menunjuk alamat benar | buka kemasan → pindai; harus `https://proyek.vercel.app/t/...` |
| Kunci AI | menu Server → "Uji koneksi AI" |

## Dashboard Server (menu Server, admin)
Status komponen (HIDUP/MATI), lalu lintas 15 menit (p50/p95, 5xx), jalur publik (kapan terakhir ada permintaan lewat proxy), ledger, outbox, email, pemakaian AI per pengguna, kesiapan konfigurasi, dan cadangan. Kontrol: **jeda/buka pencatatan baru** (dengan pesan dan jam layanan), **AI aktif/mati** dan **batas panggilan Claude per pengguna per hari**, **cadangkan sekarang**, **uji koneksi AI**, **proses outbox & email**.

## Biaya dan keamanan AI
- Kunci Anthropic hanya di `.env` PC. Pasang batas pengeluaran di Anthropic Console.
- Bila `SEED_DEMO=1`, akun demo (kata sandi `lestari123`) bisa dipakai siapa pun yang tahu URL, termasuk menanyai asisten. Kurangi risiko dengan `AI_RATE_PER_MIN` kecil, batas harian di dashboard, atau matikan AI saat tidak presentasi. Untuk penggunaan nyata: `SEED_DEMO=0` dengan `ADMIN_EMAIL` dan `ADMIN_PASSWORD`.
- Matikan alat ubah-data-event di situs publik (`DEMO_MODE=0`).

## Batasan yang belum terverifikasi
- Konfigurasi Vercel (rewrite eksternal, header) dan batas waktu rewrite untuk jawaban AI yang lama **belum diuji di Vercel**; saya tidak punya akses ke akun Anda. Uji `curl` di atas sebelum acara.
- Di balik Vercel dan Caddy, backend bisa melihat semua pengunjung sebagai satu IP; karena itu batas per-IP dinaikkan (`RATE_LIMIT_PER_MIN`). Penguncian login tetap per IP + email.
- Tunnel SSH dan skrip VPS mengikuti pola NOTAM tetapi belum dijalankan terhadap VPS Anda.
- Alternatif tanpa VPS: Cloudflare Tunnel (`cloudflared`) dengan hostname tetap; gunakan hostname itu pada `npm run vercel:config`.
