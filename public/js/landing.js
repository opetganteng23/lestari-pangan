// Landing page: animasi gulir, alur 7 tahap (detail + ilustrasi beranimasi), peran, demo ubah-hash, penghitung, FAQ, navigasi.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let loggedIn = false; try { loggedIn = !!JSON.parse(localStorage.getItem('lp_token')); } catch {}

  // ---------- tombol sesuai status masuk ----------
  if (loggedIn) {
    $$('a[href="/app#/masuk"]').forEach((a) => { a.href = '/app'; if (a.textContent.trim() === 'Masuk') a.textContent = 'Buka aplikasi'; else if (/Coba aplikasi|Masuk ke aplikasi/.test(a.textContent)) a.firstChild.textContent = 'Buka aplikasi '; });
    $$('.cta a[href="/app#/daftar"], .final a[href="/app#/daftar"]').forEach((a) => a.remove());
  }

  // ---------- pemberitahuan setelah keluar ----------
  const q = new URLSearchParams(location.search); const msg = q.get('keluar') ? 'Anda sudah keluar. Sampai jumpa!' : q.get('sesi') ? 'Sesi berakhir. Silakan masuk lagi.' : null;
  if (msg) { const n = $('#notice'); n.textContent = msg; n.hidden = false; requestAnimationFrame(() => n.classList.add('show')); setTimeout(() => { n.classList.remove('show'); setTimeout(() => (n.hidden = true), 500); }, 4200); history.replaceState(null, '', location.pathname + location.hash); }

  // ---------- butir padi jatuh di hero ----------
  const g = $('.grains'); if (g && !reduce) { let h = ''; for (let i = 0; i < 18; i++) { const r = (a, b) => (a + Math.random() * (b - a)).toFixed(2); h += `<i style="--s:${r(8, 18)}px;--o:${r(.18, .5)};--x:${r(2, 98)}%;--t:${r(11, 22)}s;--dl:-${r(0, 20)}s;--r:${Math.round(r(0, 180))}deg;--dx:${Math.round(r(-90, 90))}px"></i>`; } g.innerHTML = h; }

  // ---------- reveal saat gulir ----------
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); if (e.target.dataset.count !== undefined || $('[data-count]', e.target)) countUp(e.target); io.unobserve(e.target); } }), { threshold: 0.14, rootMargin: '0px 0px -6% 0px' }) : null;
  $$('.rv').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

  // ---------- penghitung ----------
  function countUp(root) {
    $$('[data-count]', root).concat(root.dataset && root.dataset.count !== undefined ? [root] : []).forEach((el) => {
      if (el._done) return; el._done = true; const to = +el.dataset.count, suf = el.dataset.suffix || '', dur = reduce ? 1 : 1100; const t0 = performance.now();
      const fmt = (v) => Math.round(v).toLocaleString('id-ID') + suf; (function tick(t) { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(tick); })(t0);
    });
  }

  // ---------- navigasi ----------
  const nav = $('#nav'), sb = $('#sb'), links = $('#links'), burger = $('#burger');
  const m = document.createElement('div'); m.className = 'mcta'; m.innerHTML = loggedIn ? '<a class="btn pri" href="/app">Buka aplikasi</a>' : '<a class="btn" href="/app#/masuk">Masuk</a><a class="btn pri" href="/app#/daftar">Daftar</a>'; links.appendChild(m);
  const onScroll = () => { const y = scrollY, h = document.documentElement.scrollHeight - innerHeight; nav.classList.toggle('solid', y > 24); sb.style.width = (h > 0 ? (y / h) * 100 : 0) + '%'; };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const setMenu = (o) => { links.classList.toggle('open', o); burger.setAttribute('aria-expanded', o); burger.setAttribute('aria-label', o ? 'Tutup menu' : 'Buka menu'); };
  burger.onclick = () => setMenu(!links.classList.contains('open'));
  $$('a', links).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); }); document.addEventListener('click', (e) => { if (!links.contains(e.target) && !burger.contains(e.target)) setMenu(false); });
  const secs = $$('main section[id]'); const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) $$('a', links).forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' }); secs.forEach((s) => so.observe(s));

  // ---------- ilustrasi tahap ----------
  const S = (inner) => `<svg viewBox="0 0 400 340" role="img" aria-hidden="true">${inner}</svg>`;
  const qrCells = () => { let s = ''; const pat = [1,1,1,0,1,1,1, 1,0,1,1,1,0,1, 1,1,1,0,1,1,1, 0,1,0,1,0,0,1, 1,0,1,1,1,0,0, 1,0,1,0,1,1,1, 1,1,1,0,1,0,1]; pat.forEach((v, i) => { if (v) s += `<rect class="a-pop" style="--dl:${(0.3 + i * 0.035).toFixed(2)}s" x="${130 + (i % 7) * 20}" y="${70 + Math.floor(i / 7) * 20}" width="17" height="17" rx="3" fill="#12472A"/>`; }); return s; };
  const ART = [
    // 1 setoran
    S(`<rect x="50" y="262" width="300" height="22" rx="9" fill="#BFE0CA"/><g class="a-rise" style="--dl:.1s"><path d="M130 262c-12-70 0-122 70-122s82 52 70 122z" fill="#F2B21B"/><path d="M168 142c12-18 52-18 64 0" stroke="#9A6212" fill="none" stroke-width="6" stroke-linecap="round"/><path d="M172 190h56M168 215h64" stroke="#E0A010" stroke-width="4" stroke-linecap="round"/></g>
      <g class="a-pop" style="--dl:.55s"><rect x="140" y="292" width="120" height="38" rx="10" fill="#12472A"/><text x="200" y="318" fill="#fff" text-anchor="middle" font-size="19" font-weight="700" data-count="1480" data-suffix=" kg">0 kg</text></g>
      <g class="a-pop" style="--dl:.9s"><rect x="14" y="20" width="118" height="86" rx="14" fill="#fff" stroke="#BFE0CA" stroke-width="2"/><circle cx="73" cy="56" r="17" fill="none" stroke="#237A41" stroke-width="3.4"/><circle cx="73" cy="56" r="6" fill="#237A41"/><path d="M52 40h10l3-6h16l3 6h10" fill="none" stroke="#237A41" stroke-width="3.4" stroke-linejoin="round"/><text x="73" y="96" text-anchor="middle" font-size="11.5" fill="#5F7066" font-weight="600">Foto timbangan</text><circle class="a-flash" style="--dl:1.6s" cx="73" cy="56" r="30" fill="#F2B21B"/></g>
      <g class="a-pop" style="--dl:1.2s"><rect x="268" y="20" width="118" height="86" rx="14" fill="#fff" stroke="#BFE0CA" stroke-width="2"/><path d="M290 44h74M290 60h54" stroke="#D3DDD6" stroke-width="4" stroke-linecap="round"/><path class="a-tick" style="--dl:1.9s;stroke-dasharray:90;stroke-dashoffset:90" d="M296 82c10-14 14 8 22-4s12 6 20-2 12-8 26-2" fill="none" stroke="#237A41" stroke-width="3" stroke-linecap="round"/><text x="327" y="102" text-anchor="middle" font-size="11.5" fill="#5F7066" font-weight="600">Foto nota</text></g>
      <g class="a-pop" style="--dl:1.5s"><rect x="152" y="34" width="96" height="30" rx="15" fill="#FDF3D6" stroke="#F0D58A"/><text x="200" y="54" text-anchor="middle" font-size="12" font-weight="700" fill="#7a5600">Label QR hulu</text></g>`),
    // 2 verifikasi
    S(`<rect x="40" y="24" width="320" height="230" rx="20" fill="#fff" stroke="#BFE0CA" stroke-width="2"/>${['Kode ketua cocok', 'Nomor nota unik', 'Foto timbangan & nota lengkap', 'Berat wajar (≤ 2× rata-rata)'].map((t, i) => `<g class="a-rise" style="--dl:${0.2 + i * 0.5}s"><circle cx="76" cy="${68 + i * 48}" r="15" fill="#E6F2EA"/><path class="a-tick" style="--dl:${0.45 + i * 0.5}s" d="M68 ${68 + i * 48}l6 6 11-12" fill="none" stroke="#237A41" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><text x="104" y="${73 + i * 48}" font-size="14.5" fill="#1C2B22" font-weight="500">${t}</text></g>`).join('')}
      <g class="a-pop" style="--dl:2.3s"><g transform="rotate(-8 290 290)"><rect x="205" y="262" width="170" height="54" rx="12" fill="none" stroke="#237A41" stroke-width="4"/><text x="290" y="298" text-anchor="middle" font-size="22" font-weight="800" fill="#237A41" letter-spacing="2">DISETUJUI</text></g></g>
      <g class="a-rise" style="--dl:.1s"><rect x="40" y="272" width="150" height="46" rx="23" fill="#FDF3D6"/><text x="115" y="300" text-anchor="middle" font-size="12.5" font-weight="600" fill="#7a5600">Penuh · atau sampling 30%</text></g>`),
    // 3 gabung
    S(`${[['#237A41', 60, 62], ['#F2B21B', 112, 40], ['#2E9150', 164, 54]].map(([c, y, w], i) => `<g><rect class="a-grow" style="--dl:${i * 0.35}s" x="30" y="${y - 20}" width="${w * 2.2}" height="34" rx="10" fill="${c}"/><text class="a-rise" style="--dl:${0.5 + i * 0.35}s" x="${30 + w * 2.2 + 12}" y="${y + 2}" font-size="12" fill="#5F7066" font-weight="600">sub-lot ${i + 1}</text><path class="a-tick" style="--dl:${1.2 + i * 0.2}s;stroke-dasharray:60;stroke-dashoffset:60" d="M${30 + w * 1.1} ${y + 16}C${30 + w * 1.1} 230 200 210 200 252" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="6 6"/></g>`).join('')}
      <g class="a-rise" style="--dl:1.8s"><rect x="40" y="252" width="320" height="42" rx="14" fill="#EDF1EE"/><rect class="a-grow" style="--dl:2s" x="40" y="252" width="134" height="42" rx="14" fill="#237A41"/><rect class="a-grow" style="--dl:2.2s" x="174" y="252" width="86" height="42" fill="#F2B21B"/><rect class="a-grow" style="--dl:2.4s" x="260" y="252" width="100" height="42" rx="0 14 14 0" fill="#2E9150"/></g>
      <text class="a-rise" style="--dl:2.7s" x="200" y="322" text-anchor="middle" font-size="13" font-weight="600" fill="#1B5E34">Batch gabungan · komposisi dihitung proporsional</text>`),
    // 4 serah terima
    S(`<g class="a-pop" style="--dl:.1s"><rect x="14" y="40" width="130" height="110" rx="18" fill="#fff" stroke="#BFE0CA" stroke-width="2"/><text x="79" y="72" text-anchor="middle" font-size="12" fill="#5F7066" font-weight="600">PENGIRIM</text><text x="79" y="108" text-anchor="middle" font-size="22" font-weight="800" fill="#12472A" data-count="1990" data-suffix=" kg">0</text><text x="79" y="134" text-anchor="middle" font-size="11.5" fill="#5F7066">berat kirim</text></g>
      <g class="a-pop" style="--dl:.5s"><rect x="256" y="40" width="130" height="110" rx="18" fill="#fff" stroke="#BFE0CA" stroke-width="2"/><text x="321" y="72" text-anchor="middle" font-size="12" fill="#5F7066" font-weight="600">PENERIMA</text><text x="321" y="108" text-anchor="middle" font-size="22" font-weight="800" fill="#12472A" data-count="1980" data-suffix=" kg">0</text><text x="321" y="134" text-anchor="middle" font-size="11.5" fill="#5F7066">berat terima</text></g>
      <path d="M150 96h100" stroke="#D3DDD6" stroke-width="4" stroke-dasharray="6 8"/><g class="a-travel" style="--dl:.4s;--tx:64px"><rect x="152" y="80" width="30" height="20" rx="4" fill="#F2B21B"/><rect x="182" y="86" width="12" height="14" rx="3" fill="#9A6212"/><circle cx="162" cy="102" r="4.5" fill="#1C2B22"/><circle cx="186" cy="102" r="4.5" fill="#1C2B22"/></g>
      <g class="a-rise" style="--dl:1.6s"><rect x="60" y="190" width="280" height="118" rx="20" fill="#E6F2EA"/><text x="200" y="224" text-anchor="middle" font-size="12.5" fill="#1B5E34" font-weight="600">SELISIH</text><text x="200" y="262" text-anchor="middle" font-size="30" font-weight="800" fill="#237A41">0,5%</text><rect x="90" y="276" width="220" height="10" rx="5" fill="#fff"/><rect class="a-grow" style="--dl:2s" x="90" y="276" width="22" height="10" rx="5" fill="#237A41"/><text x="200" y="302" text-anchor="middle" font-size="12" fill="#44574b">dalam toleransi 2% · selesai</text></g>`),
    // 5 giling
    S(`<text class="a-rise" style="--dl:.1s" x="40" y="42" font-size="13" font-weight="600" fill="#5F7066">Gabah masuk 1.893 kg</text><rect class="a-grow" style="--dl:.2s" x="40" y="52" width="320" height="36" rx="12" fill="#F2B21B"/>
      <g class="a-spin" style="--dl:0s"><circle cx="200" cy="130" r="19" fill="none" stroke="#237A41" stroke-width="5" stroke-dasharray="7 6"/><circle cx="200" cy="130" r="5" fill="#237A41"/></g>
      <text class="a-rise" style="--dl:.9s" x="40" y="186" font-size="13" font-weight="600" fill="#5F7066">Hasil giling</text>
      <rect class="a-grow" style="--dl:1s" x="40" y="196" width="190" height="36" rx="12" fill="#237A41"/><text class="a-rise" style="--dl:1.6s" x="135" y="219" text-anchor="middle" font-size="12.5" fill="#fff" font-weight="700">Beras 57%</text>
      <rect class="a-grow" style="--dl:1.3s" x="230" y="196" width="82" height="36" fill="#2E9150"/><text class="a-rise" style="--dl:1.8s" x="271" y="219" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="700">Dedak</text>
      <rect class="a-grow" style="--dl:1.6s" x="312" y="196" width="48" height="36" rx="0 12 12 0" fill="#9A6212"/>
      <g class="a-rise" style="--dl:2.1s"><circle cx="48" cy="268" r="6" fill="#237A41"/><text x="62" y="272" font-size="12" fill="#44574b">Output utama</text><circle cx="168" cy="268" r="6" fill="#2E9150"/><text x="182" y="272" font-size="12" fill="#44574b">Produk samping</text><circle cx="298" cy="268" r="6" fill="#9A6212"/><text x="312" y="272" font-size="12" fill="#44574b">Susut</text></g>
      <g class="a-pop" style="--dl:2.5s"><rect x="40" y="290" width="320" height="36" rx="12" fill="#FDF3D6" stroke="#F0D58A"/><text x="200" y="313" text-anchor="middle" font-size="12.5" font-weight="600" fill="#7a5600">Selisih belum terjelaskan ditandai, bukan dituduh</text></g>`),
    // 6 kemas & QR
    S(`<rect class="a-pop" style="--dl:0s" x="110" y="50" width="180" height="180" rx="22" fill="#fff" stroke="#BFE0CA" stroke-width="2.5"/>${qrCells()}
      <g class="a-rise" style="--dl:1.6s"><rect x="70" y="252" width="260" height="46" rx="14" fill="#12472A"/><text x="200" y="281" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" letter-spacing=".5">LP-PKG-2026-0211</text></g>
      <g class="a-rise" style="--dl:2s"><text x="200" y="324" text-anchor="middle" font-size="12.5" fill="#44574b">200 kemasan × 5 kg · satu kode per lot</text></g>
      <g class="a-pop" style="--dl:1.9s"><circle cx="318" cy="64" r="22" fill="#F2B21B"/><path class="a-tick" style="--dl:2.3s" d="M308 64l7 8 14-16" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`),
    // 7 konsumen
    S(`<g class="a-pop" style="--dl:0s"><rect x="112" y="14" width="176" height="312" rx="28" fill="#1C2B22"/><rect x="122" y="28" width="156" height="284" rx="20" fill="#F5F8F6"/></g>
      <g class="a-rise" style="--dl:.4s"><rect x="132" y="42" width="136" height="26" rx="13" fill="#E6F2EA"/><circle cx="148" cy="55" r="5" fill="#2E9150"/><text x="160" y="59" font-size="10" fill="#1B5E34" font-weight="600">Hash cocok</text></g>
      ${['Kelompok tani → pengepul', 'Serah terima di gudang', 'Digiling · rendemen', 'Dikemas · lot LP-PKG'].map((t, i) => `<g class="a-rise" style="--dl:${0.9 + i * 0.45}s"><rect x="132" y="${80 + i * 52}" width="136" height="42" rx="10" fill="#fff" stroke="#E2E9E4"/><circle cx="146" cy="${101 + i * 52}" r="6" fill="#2E9150"/><text x="158" y="${105 + i * 52}" font-size="9.5" fill="#1C2B22" font-weight="500">${t}</text></g>`).join('')}
      <rect class="a-scan" style="--sy:260px" x="116" y="30" width="168" height="4" rx="2" fill="#F2B21B"/><circle class="a-blink" cx="340" cy="70" r="6" fill="#F2B21B"/><path d="M322 70h-14M358 70h14" stroke="#F2B21B" stroke-width="3" stroke-linecap="round"/>`),
  ];
  const STEPS = [
    { r: 'Setoran', t: 'Petani menyetor, pengepul mencatat', who: 'Pengepul', what: 'Gabah dari kelompok tani ditimbang dan dicatat saat itu juga, lengkap dengan bukti. Sejak saat ini setiap kilogram punya identitas.', rec: ['Kelompok tani, kode ketua, dan berat', 'Nomor nota unik dan foto nota bertanda tangan', 'Foto timbangan dan satu label QR hulu'], guard: ['Kode ketua statis, disimpan sebagai hash, bisa diganti kapan saja', 'Nota ganda ditolak otomatis dan dicatat sebagai anomali', 'Berat lebih dari 2× rata-rata kelompok memicu pemeriksaan penuh', ['Rantai tercatat dimulai dari pengepul, bukan dari sawah', 1]] },
    { r: 'Verifikasi', t: 'Admin memeriksa sebelum gabah bisa dipakai', who: 'Admin teknis', what: 'Setoran baru berstatus menunggu. Selama belum disetujui, batch tidak bisa digabung maupun dikirim.', rec: ['Keputusan setuju atau tolak, beserta alasan', 'Siapa yang memutuskan dan kapan', 'Mode periksa: penuh atau sampling'], guard: ['Pengepul baru dan pasangan baru selalu diperiksa penuh', 'Sisanya diperiksa sampling 30%; yang tidak terpilih diterima otomatis dan diberi label itu', 'Admin tidak bisa menyetujui setoran yang ia catat sendiri', 'Batas waktu verifikasi 24 jam, keterlambatan terpantau']},
    { r: 'Gabung', t: 'Beberapa setoran digabung, asalnya tetap terlacak', who: 'Pengepul', what: 'Batch tersedia boleh digabung menjadi satu batch agregat untuk dikirim. Sub-lot asalnya tidak hilang.', rec: ['Daftar batch induk beserta bobotnya', 'Batch baru dengan kode sendiri', 'Event penggabungan di ledger'], guard: ['Batch yang belum diverifikasi tidak bisa digabung', 'Komposisi asal dihitung proporsional dari bobot setoran', 'Jika satu setoran induk ditolak, turunannya ditandai (taint)']},
    { r: 'Serah terima', t: 'Dikirim satu pihak, dikonfirmasi pihak lain', who: 'Pengirim, penerima, pengangkut', what: 'Perpindahan barang baru sah bila kedua pihak sepakat. Pengirim mengisi berat kirim, penerima mengisi berat terima.', rec: ['Berat kirim dan berat terima', 'Selisih dalam persen', 'Waktu ambil dan antar oleh pengangkut'], guard: ['Selisih dalam toleransi 2% langsung selesai', 'Di atas toleransi: berstatus sengketa dan diputuskan admin, otomatis dibuat kasus', 'Transfer yang menggantung lebih dari 48 jam ditandai', ['Pengirim langsung ke retailer tanpa gudang dicatat sebagai pengecualian', 1]]},
    { r: 'Giling', t: 'Gabah menjadi beras, neracanya dicatat', who: 'Penggilingan', what: 'Penggilingan mencatat berat gabah masuk, beras yang keluar, serta produk samping dan susut bila diukur.', rec: ['Berat input dan output utama', 'Dedak, sekam, menir, dan susut', 'Rendemen dan sumber berat: manual atau perangkat timbang'], guard: ['Input = output + produk samping + susut + selisih belum terjelaskan', 'Selisih di atas ambang ditandai untuk ditinjau, bukan dituduh', 'Koreksi disimpan dengan alasan dan riwayat, tidak menimpa diam-diam', ['Dicatat sendiri oleh penggilingan; belum ada pemeriksa independen', 1]]},
    { r: 'Kemas', t: 'Dikemas, diberi satu kode untuk satu lot', who: 'Gudang atau penggilingan', what: 'Beras dikemas menjadi lot. Setiap lot memiliki kode dan QR yang membuka seluruh jejaknya ke hulu.', rec: ['Jumlah kemasan dan berat per kemasan', 'Kode lot dan QR', 'Tanggal kemas dan produk'], guard: ['Satu kode hanya untuk satu lot; kode yang tidak berlaku bisa dicabut', 'Jumlah kemasan tidak boleh melebihi stok', 'Batch yang ditahan karena kasus tidak bisa dikirim', 'Pemindaian yang tidak wajar ditandai sebagai sinyal, bukan bukti pemalsuan']},
    { r: 'Konsumen', t: 'Konsumen memindai dan melihat sendiri', who: 'Konsumen (tanpa akun)', what: 'QR di kemasan membuka halaman publik: asal bahan, urutan perjalanan, dan seberapa kuat tiap tahap diverifikasi.', rec: ['Komposisi asal per kelompok tani (tingkat kecamatan)', 'Perjalanan beserta label verifikasi tiap tahap', 'Status hash terhadap ledger'], guard: ['Pemberitahuan penarikan tampil di atas halaman bila sudah disahkan', 'Tahap yang tidak ada datanya tampil sebagai celah', 'Halaman ini bukan sertifikasi mutu, keamanan pangan, atau organik', ['Ledger yang dipakai saat ini adalah simulasi', 1]]},
  ];
  const rail = $('#rail'), stage = $('#stage'), prog = $('#prog'), count = $('#count'), play = $('#play');
  let cur = 0, playing = !reduce, timer = null, visible = false; const DUR = 11000;
  rail.innerHTML = STEPS.map((s, i) => `<li><button type="button" role="tab" id="tab${i}" aria-controls="stage" aria-selected="false" data-i="${i}"><span class="n">${i + 1}</span><span class="t">${esc(s.r)}</span></button></li>`).join('');
  const li = (a) => a.map((x, i) => `<li style="--i:${i}"${Array.isArray(x) ? ' class="warn"' : ''}>${esc(Array.isArray(x) ? x[0] : x)}</li>`).join('');
  function show(i, user) {
    cur = (i + STEPS.length) % STEPS.length; const s = STEPS[cur];
    $$('button', rail).forEach((b, k) => { b.classList.toggle('on', k === cur); b.classList.toggle('done', k < cur); b.setAttribute('aria-selected', k === cur); b.tabIndex = k === cur ? 0 : -1; });
    stage.setAttribute('role', 'tabpanel'); stage.setAttribute('aria-labelledby', 'tab' + cur);
    stage.innerHTML = `<div><span class="who">Tahap ${cur + 1} · ${esc(s.who)}</span><h3>${esc(s.t)}</h3><p class="what">${esc(s.what)}</p><div class="sblk"><h4>Yang dicatat</h4><ul>${li(s.rec)}</ul></div><div class="sblk"><h4>Pengaman</h4><ul>${li(s.guard)}</ul></div></div><div class="art">${ART[cur]}</div>`;
    count.textContent = `${cur + 1} / ${STEPS.length}`; countUp(stage);
    const act = $('button.on', rail); if (act && user !== 'auto' && rail.scrollTo) rail.scrollTo({ left: act.parentElement.offsetLeft - rail.clientWidth / 2 + act.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    schedule();
  }
  function schedule() {
    clearTimeout(timer); prog.style.transition = 'none'; prog.style.width = '0'; if (!playing || !visible) return;
    void prog.offsetWidth; prog.style.transition = `width ${DUR}ms linear`; prog.style.width = '100%'; timer = setTimeout(() => show(cur + 1, 'auto'), DUR);
  }
  function setPlaying(p) { playing = p; play.textContent = p ? 'Jeda' : 'Putar'; play.setAttribute('aria-pressed', p); schedule(); }
  rail.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) { setPlaying(false); show(+b.dataset.i, 'user'); } });
  rail.addEventListener('keydown', (e) => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); setPlaying(false); show(cur + d, 'user'); $('button.on', rail).focus(); } });
  $('#prev').onclick = () => { setPlaying(false); show(cur - 1, 'user'); }; $('#next').onclick = () => { setPlaying(false); show(cur + 1, 'user'); }; play.onclick = () => setPlaying(!playing);
  play.textContent = playing ? 'Jeda' : 'Putar'; play.setAttribute('aria-pressed', playing);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; schedule(); }, { threshold: 0.35 }).observe($('.flow-wrap'));
  show(0, 'auto');

  // ---------- peran ----------
  const IC = { person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>', home: '<path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>', truck: '<path d="M2 16V6h11v10M13 10h5l3 3v3h-8"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>', shop: '<path d="M4 9l1-5h14l1 5M4 9v11h16V9M4 9c0 2 4 2 4 0 0 2 4 2 4 0 0 2 4 2 4 0 0 2 4 2 4 0"/>', leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-15 14zM5 19l8-8"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>' };
  const ROLES = [
    ['leaf', 'Kelompok tani', 'Melihat riwayat setoran dan kontribusinya sendiri.', ['Melihat setoran, status verifikasi, dan alasan penolakan', 'Unduh ringkasan CSV', 'Tidak bisa melihat data kelompok lain']],
    ['person', 'Pengepul', 'Mencatat setoran, menggabung batch, dan mengirim.', ['Catat setoran dengan foto timbangan dan nota', 'Gabung batch yang sudah terverifikasi', 'Kirim ke gudang; bisa mencatat tanpa sinyal']],
    ['home', 'Gudang / Penggilingan', 'Menerima, menggiling, dan mengemas.', ['Konfirmasi berat terima', 'Catat giling dengan neraca massa', 'Buat lot kemasan dan QR konsumen']],
    ['gear', 'Distributor', 'Menerima dari gudang dan meneruskan ke retailer.', ['Konfirmasi berat terima', 'Kirim ke retailer', 'Melihat stok dan sengketa']],
    ['truck', 'Logistik', 'Mencatat pengambilan dan pengantaran.', ['Catat ambil dan antar tiap kiriman', 'Bisa lewat API dengan kunci terbatas', 'Hanya melihat kiriman miliknya']],
    ['shop', 'Retailer', 'Menerima barang dan menampilkan asal produk.', ['Konfirmasi berat terima', 'Melihat stok dan asal produk', 'Halaman jejak bisa dibuka pembeli']],
    ['shield', 'Admin teknis', 'Verifikasi, pengguna, dan penyelesaian sengketa.', ['Verifikasi setoran dan putus sengketa', 'Kelola pengguna, referral, kelompok tani', 'Kasus, recall, dashboard Server']],
    ['eye', 'Pengawas (Dinas)', 'Memantau dengan akses baca-saja.', ['Dashboard, anomali, tren, dan papan risiko', 'Ekspor laporan CSV', 'Tidak bisa mengubah data']],
    ['key', 'Super admin', 'Mode Lihat dan Mode Tindak dengan jejak audit.', ['Mode Lihat: menjelajah sebagai pelaku, baca-saja', 'Mode Tindak: butuh sandi dan alasan, 15 menit', 'Semua tindakan tercatat sebagai aktor asli']],
  ];
  $('#roles').innerHTML = ROLES.map(([ic, n, sum, items], i) => `<button type="button" class="role rv" style="--d:${(i % 3) * 0.08}s" aria-expanded="false"><span class="ic"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[ic]}</svg></span><h3>${esc(n)}</h3><span class="sum">${esc(sum)}</span><span class="more"><div><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></span><span class="hint">Lihat kemampuan →</span></button>`).join('');
  $$('.role').forEach((b) => { if (io) io.observe(b); b.addEventListener('click', () => { const o = b.getAttribute('aria-expanded') === 'true'; $$('.role').forEach((x) => { x.setAttribute('aria-expanded', 'false'); x.querySelector('.hint').textContent = 'Lihat kemampuan →'; }); b.setAttribute('aria-expanded', !o); b.querySelector('.hint').textContent = o ? 'Lihat kemampuan →' : 'Tutup'; }); });

  // ---------- demo ubah satu angka ----------
  const led = $('#ledger'), tb = $('#tamper'), vd = $('#verdict'); if (led) {
    led.innerHTML = `<div class="blk b1"><span>Blok #4218301</span><code>a3f9…c21b</code><small>Setoran dicatat · 1.480 kg</small></div><div class="lnk"></div><div class="blk b2"><span>Blok #4218302</span><code class="h2">7be0…91d4</code><small class="s2">Diverifikasi admin · 1.480 kg</small></div><div class="lnk l2"></div><div class="blk b3"><span>Blok #4218303</span><code>0c5a…e7f8</code><small>Diterima gudang · 1.480 kg</small></div><button class="btn sm dan tamper" id="tamper" type="button" aria-pressed="false">Coba ubah satu angka</button><div class="verdict" id="verdict" role="status">Semua hash cocok</div>`;
    led.removeAttribute('aria-hidden'); const hs = ['7be0…91d4', 'e14c…5a07'], rnd = '0123456789abcdef'; let bad = false, anim;
    const set = (b) => { bad = b; led.classList.toggle('bad', b); $('#tamper').textContent = b ? 'Pulihkan data' : 'Coba ubah satu angka'; $('#tamper').setAttribute('aria-pressed', b); $('.s2', led).textContent = b ? 'Diverifikasi admin · 1.580 kg (diubah)' : 'Diverifikasi admin · 1.480 kg'; $('#verdict').textContent = b ? 'Hash tidak cocok: blok #4218302 berubah sejak dicatat, blok sesudahnya tidak lagi bisa dipercaya' : 'Semua hash cocok'; };
    led.addEventListener('click', (e) => { if (!e.target.closest('#tamper')) return; const h = $('.h2', led), to = hs[bad ? 0 : 1]; clearInterval(anim); let n = 0; anim = setInterval(() => { n++; h.textContent = n > 9 ? to : [...to].map((c) => (c === '…' ? c : rnd[Math.floor(Math.random() * 16)])).join(''); if (n > 9) clearInterval(anim); }, reduce ? 1 : 45); set(!bad); });
  }

  // ---------- FAQ: satu terbuka ----------
  $$('#faq details').forEach((d) => { if (io) io.observe(d); d.addEventListener('toggle', () => { if (d.open) $$('#faq details').forEach((o) => { if (o !== d) o.open = false; }); }); });
})();
