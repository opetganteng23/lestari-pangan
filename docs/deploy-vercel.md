# Deploy: frontend di Vercel, backend di PC on-prem

```
Browser ──HTTPS──> Vercel (situs statis dari public/)
                     ├─ /            file statis
                     ├─ /app         → app.html (aplikasi)
                     ├─ /t/KODE      → trace.html (halaman konsumen)
                     └─ /api  /uploads  /qr   (rewrite eksternal)
                              │  HTTPS
                              ▼
                  https://lestari-api.<domain>   ← Cloudflare Tunnel atau Tailscale Funnel
                              │  (PC yang menyambung keluar; port PC tidak dibuka)
PC on-prem:  backend 127.0.0.1:3000  ──> data/ (JSON + ledger + unggahan)
                                     ──> api.anthropic.com (kunci hanya di PC)
```

Browser hanya melihat satu asal (`https://proyek.vercel.app`): tanpa CORS dan tanpa perubahan frontend. Tanpa VPS.

**Keuntungan:** kunci Anthropic, kunci sesi, dan data tidak pernah ada di Vercel; Vercel tidak butuh environment variable. **Konsekuensi:** bila PC mati atau tunnel putus, `/api` gagal (halaman statis tetap tampil).

## Pilih tunnel (isi `LP_TUNNEL` di `.env`)
| Pilihan | Cocok bila | Alamat | Catatan |
|---|---|---|---|
| `cloudflared` | Punya domain yang DNS-nya di Cloudflare | `https://lestari-api.<domain-anda>` tetap | `cloudflared` sudah terpasang di PC ini. Butuh akun Cloudflare gratis |
| `tailscale` | Tidak punya domain | `https://<nama-pc>.<tailnet>.ts.net` tetap | Perlu pasang Tailscale dan aktifkan Funnel di konsol. Bandwidth Funnel dibatasi (cukup untuk demo) |
| `ssh` | Ada server perantara sendiri | sesuai server | Mode lama; butuh Caddy/nginx di server itu |
| ngrok | Tidak disarankan | | Domain gratis tetap ada, tetapi halaman peringatan browser milik ngrok dapat mengganggu panggilan lewat Vercel; belum diuji |
| Cloudflare "quick tunnel" | Jangan untuk ini | acak tiap start | Alamat berubah setiap dinyalakan, sehingga `vercel.json` harus diganti dan dideploy ulang |

### A. Cloudflare Tunnel (`LP_TUNNEL=cloudflared`)
1. dash.cloudflare.com → Zero Trust → Networks → Tunnels → **Create a tunnel** → Cloudflared → beri nama `lestari`.
2. Salin **token** dari perintah yang ditampilkan (bagian setelah `--token`) ke `.env`: `LP_CF_TUNNEL_TOKEN=...`. Token ini rahasia.
3. Tab **Public Hostname** → Add: subdomain `lestari-api`, domain Anda, Service: `HTTP` → `127.0.0.1:3000`.
4. Di `.env`: `LP_TUNNEL=cloudflared` dan `LP_API_PUBLIC_URL=https://lestari-api.<domain-anda>`.

### B. Tailscale Funnel (`LP_TUNNEL=tailscale`)
1. Pasang Tailscale di PC dan login. Di konsol admin Tailscale → DNS: aktifkan HTTPS; Access controls: izinkan atribut `funnel` untuk perangkat ini.
2. Di `.env`: `LP_TUNNEL=tailscale`. Skrip menjalankan `tailscale funnel --bg 3000`.
3. Alamat publik muncul di `tailscale funnel status`; isi ke `LP_API_PUBLIC_URL`.

## Langkah
### 1. PC on-prem
```
npm run init:env          # membuat .env dengan APP_SECRET acak (sudah dibuat bila Anda memakai berkas dari saya)
npm run check:env         # periksa; tambah -- --ping untuk menguji kunci Anthropic
```
Isi `.env`: `PUBLIC_URL` (alamat Vercel), `ANTHROPIC_API_KEY`, pengaturan tunnel di atas. Lalu klik dua kali `Operasional\Nyalakan-LestariPangan.bat`. `Aktifkan-Otomatis.bat` membuatnya menyala sendiri saat Anda masuk Windows; pastikan PC tidak Sleep.

### 2. Vercel
1. `npm run vercel:config -- https://lestari-api.<domain-anda>` lalu commit dan push `vercel.json`.
2. Vercel → Add New Project → pilih repo → Framework "Other" → Deploy. Tidak ada environment variable.
3. Salin alamat proyek ke `PUBLIC_URL` di `.env`, nyalakan ulang backend (agar QR kemasan menunjuk ke alamat Vercel).

## Verifikasi
| Cek | Perintah / tempat |
|---|---|
| Backend + tunnel | `Operasional\Status-LestariPangan.bat` |
| API lewat tunnel | `curl https://lestari-api.<domain>/api/health` |
| Lewat Vercel | `curl https://proyek.vercel.app/api/health` |
| Halaman konsumen | `https://proyek.vercel.app/t/LP-PKG-2026-0211` |
| QR benar | harus mengarah ke `https://proyek.vercel.app/t/...` |
| Kunci AI | menu Server → "Uji koneksi AI" |

## Dashboard Server (menu Server, admin)
Status komponen, lalu lintas 15 menit (p50/p95, 5xx), kapan terakhir ada permintaan lewat proxy, ledger, outbox, email, pemakaian AI per pengguna, kesiapan konfigurasi, cadangan. Kontrol: jeda/buka pencatatan baru (pesan + jam layanan), AI aktif/mati, batas panggilan Claude per pengguna per hari, cadangkan sekarang, uji koneksi AI, proses outbox dan email.

## Biaya dan keamanan AI
- Kunci Anthropic hanya di `.env` PC. Pasang batas pengeluaran di Anthropic Console.
- `SEED_DEMO=1` membuat akun demo (kata sandi `lestari123`) bisa dipakai siapa pun yang tahu URL, termasuk menanyai asisten. Kurangi risiko dengan `AI_RATE_PER_MIN` kecil, batas harian di dashboard, atau matikan AI di luar presentasi. Untuk pemakaian nyata: `SEED_DEMO=0` dengan `ADMIN_EMAIL` dan `ADMIN_PASSWORD`.
- Matikan alat ubah-data-event di situs publik (`DEMO_MODE=0`).
- Siapa pun yang tahu alamat tunnel bisa mengakses backend langsung (tanpa Vercel); isinya sama dengan situs publik, tetapi header `X-Forwarded-For` dari sana bisa dipalsukan untuk menghindari batas per-IP. Penguncian login (IP + email) dan batas AI per pengguna tetap berlaku.

## Belum terverifikasi
- Konfigurasi Vercel (rewrite eksternal, header) dan batas waktu rewrite untuk jawaban AI yang lama **belum diuji di Vercel**.
- Skrip tunnel `cloudflared`, `tailscale`, dan `ssh` hanya diuji sampai logika pemilihan dan pelaporan status; koneksi sungguhan belum dijalankan.
- Di balik Vercel dan tunnel, backend bisa melihat banyak pengunjung sebagai satu IP; batas per-IP dinaikkan (`RATE_LIMIT_PER_MIN`).
