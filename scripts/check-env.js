// Memeriksa .env backend. Tidak pernah mencetak nilai rahasia. Gunakan --ping untuk menguji kunci Anthropic (1 permintaan kecil).
require('../server/env');
const ok = [], warn = [], bad = [];
const v = (k) => process.env[k] || '';
const secret = v('APP_SECRET');
if (!secret) bad.push('APP_SECRET belum diisi (jalankan npm run init:env)');
else if (secret.length < 32) bad.push('APP_SECRET kurang dari 32 karakter');
else ok.push('APP_SECRET terisi (' + secret.length + ' karakter)');
const pu = v('PUBLIC_URL');
if (!pu || /NAMA-PROYEK/.test(pu)) bad.push('PUBLIC_URL belum diisi dengan alamat situs Vercel Anda (QR kemasan akan salah)');
else if (!/^https:\/\/[^/\s]+$/.test(pu)) bad.push('PUBLIC_URL harus berbentuk https://host tanpa garis miring akhir');
else ok.push('PUBLIC_URL = ' + pu);
const tun = (v('LP_TUNNEL') || 'none').toLowerCase();
if (tun === 'none') warn.push('LP_TUNNEL=none: Vercel tidak akan bisa menjangkau backend ini (pilih cloudflared atau tailscale)');
else if (tun === 'cloudflared') { if (!v('LP_CF_TUNNEL_TOKEN')) bad.push('LP_TUNNEL=cloudflared butuh LP_CF_TUNNEL_TOKEN'); else ok.push('Tunnel cloudflared dikonfigurasi'); }
else if (tun === 'tailscale') ok.push('Tunnel Tailscale Funnel dipilih (pastikan Funnel aktif di konsol Tailscale)');
else if (tun === 'ssh') { if (!v('LP_VPS_HOST') || !v('LP_SSH_KEY')) bad.push('LP_TUNNEL=ssh butuh LP_VPS_HOST dan LP_SSH_KEY'); else ok.push('Tunnel SSH dikonfigurasi'); }
else bad.push('LP_TUNNEL tidak dikenal: ' + tun);
if (v('HOST') !== '127.0.0.1') warn.push('HOST bukan 127.0.0.1: backend bisa terjangkau dari jaringan lokal, tidak hanya lewat tunnel');
if (v('TRUST_PROXY') !== '1') warn.push('TRUST_PROXY bukan 1: semua pengguna akan tampak satu IP di balik proxy');
if (v('SEED_DEMO') === '0') {
  if (!v('ADMIN_EMAIL') || !v('ADMIN_PASSWORD')) bad.push('SEED_DEMO=0 butuh ADMIN_EMAIL dan ADMIN_PASSWORD'); else ok.push('Mulai kosong dengan satu super admin');
} else warn.push('SEED_DEMO aktif: akun demo (kata sandi lestari123) bisa dipakai siapa pun yang tahu URL. Aman hanya untuk demo data simulasi.');
if (v('DEMO_MODE') !== '0') warn.push('DEMO_MODE aktif: alat ubah-data-event tersedia bagi admin; matikan di situs publik');
const key = v('ANTHROPIC_API_KEY');
if (!key) warn.push('ANTHROPIC_API_KEY kosong: asisten dan ringkasan memakai jawaban berbasis aturan');
else if (!key.startsWith('sk-ant-')) bad.push('ANTHROPIC_API_KEY tidak berawalan sk-ant-');
else ok.push('ANTHROPIC_API_KEY terisi');
(async () => {
  if (process.argv.includes('--ping') && key && key.startsWith('sk-ant-')) {
    const model = v('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'Balas: ok' }] }) });
      if (r.ok) ok.push('Kunci Anthropic diterima API (model ' + model + ')');
      else bad.push('Anthropic menjawab HTTP ' + r.status + (r.status === 401 ? ' (kunci ditolak)' : r.status === 404 ? ' (model tidak dikenal)' : ''));
    } catch (e) { bad.push('Gagal menghubungi Anthropic: ' + e.message); }
  } else if (process.argv.includes('--ping')) warn.push('--ping dilewati: kunci belum terisi/valid');
  for (const [t, a] of [['OK', ok], ['PERHATIAN', warn], ['GAGAL', bad]]) for (const m of a) console.log('  ' + t.padEnd(9) + ' ' + m);
  console.log(bad.length ? `\n${bad.length} masalah harus diperbaiki.` : '\nTidak ada masalah yang menghalangi.');
  process.exit(bad.length ? 1 : 0);
})();
