# Panduan pilot terkontrol

Pilot dengan mitra nyata **belum dilakukan**. Dokumen ini adalah prasyarat dan rencana, bukan laporan hasil.

## Prasyarat sebelum pilot
| Syarat | Status saat ini |
|---|---|
| `APP_SECRET` diset, HTTPS lewat reverse proxy, `TRUST_PROXY=1`, `DEMO_MODE=0` | Perlu dikonfigurasi |
| Data dimulai dari kosong (hapus `data/`, tanpa seed simulasi) dan akun admin dibuat manual | Perlu dibuat skrip inisialisasi produksi |
| Backup terjadwal + uji restore + RPO/RTO disepakati | Skrip dasar ada, belum terjadwal |
| Persetujuan mitra tentang data yang dicatat (nama, lokasi kecamatan, foto nota) dan masa retensi | Belum |
| Uji keamanan pihak ketiga / OWASP ASVS | Belum |
| SMTP diuji dengan penyedia nyata bila email dipakai | Belum |
| Uji lapangan offline-first di perangkat dan jaringan nyata | Belum |

## Ruang lingkup yang disarankan
1. 1 penggilingan, 2 pengepul, 3–4 kelompok tani, 1 retailer; 4–8 minggu.
2. Aktifkan: setoran, verifikasi, transfer, giling (dengan produk samping/susut), kemas, QR, portal kelompok tani.
3. Nonaktifkan atau tandai eksperimen: Forecasting dan Digital Twin sampai kriteria kesiapan data terpenuhi (≥ 12 minggu, ≥ 70% minggu berisi), AI Copilot jalur Claude, adapter blockchain.

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
Lihat bagian 26 pada [mts.md](mts.md): pilihan database produksi, jaringan blockchain, penyedia AI dan kebijakan privasinya, kebijakan retensi data.
