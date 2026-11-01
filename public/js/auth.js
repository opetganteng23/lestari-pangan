// Halaman autentikasi: masuk, daftar, lupa kata sandi, reset. Semua punya tombol "Kembali ke beranda" (/).
const AUTH_ACCS = [['sa@lestari.id', 'Super Admin', 'Semua fitur semua peran'], ['admin@lestari.id', 'Admin Teknis', 'Verifikasi, referral, sengketa'], ['pengawas@lestari.id', 'Pengawas (Dinas)', 'Dashboard dan analitik, baca-saja'], ['pengepul1@lestari.id', 'Pengepul', 'CV Tani Makmur · catat setoran'], ['gudang1@lestari.id', 'Penggilingan', 'Sinar Jaya · terima, giling, kemas'], ['distributor@lestari.id', 'Distributor', 'Teruskan ke retailer'], ['logistik@lestari.id', 'Logistik', 'Pengangkut'], ['retailer@lestari.id', 'Retailer', 'Terima dan jual'], ['kelompok.sumber@lestari.id', 'Kelompok tani', 'KT Sumber Rejeki · portal']];
const AUTH_ICON = { back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>', eye: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>', eyeoff: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 6.1A10 10 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.9M6.4 6.5A17 17 0 002 12s4 7 10 7a9.7 9.7 0 004-.9"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>', ok: '<svg viewBox="0 0 52 52" width="72" height="72"><circle class="ok-c" cx="26" cy="26" r="24" fill="none" stroke="#2E9150" stroke-width="3"/><path class="ok-t" d="M15 27l8 8 14-16" fill="none" stroke="#2E9150" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>' };
const AUTH_VIEWS = ['masuk', 'daftar', 'lupa', 'reset'];

function authHashView() { const h = location.hash.replace(/^#\/?/, ''); const [v, ...p] = h.split('/'); return { view: AUTH_VIEWS.includes(v) ? v : 'masuk', param: p.join('/') }; }
function renderAuthFromHash() { const { view, param } = authHashView(); if (!location.hash.startsWith('#/' + view)) history.replaceState(null, '', '#/' + view); return renderAuth(view, param); }
function renderLogin() { return renderAuthFromHash(); }

function pwScore(p) { let s = 0; if (p.length >= 8) s++; if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++; if (p.length >= 12) s++; if (/[^A-Za-z0-9]/.test(p)) s++; return s; }
const pwField = (name, label, auto, extra = '') => `<div class="af" style="--i:var(--n)"><label for="f_${name}">${label}</label><div class="pw"><input id="f_${name}" class="inp" name="${name}" type="password" required autocomplete="${auto}" ${extra}><button type="button" class="eye" data-eye aria-label="Tampilkan kata sandi" aria-pressed="false">${AUTH_ICON.eye}</button></div></div>`;
const txtField = (name, label, o = {}) => `<div class="af"><label for="f_${name}">${label}</label><input id="f_${name}" class="inp" name="${name}" type="${o.type || 'text'}" ${o.required === false ? '' : 'required'} autocomplete="${o.auto || 'off'}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.attrs || ''}></div>`;

const AUTH_COPY = {
  masuk: ['Masuk', 'Selamat datang kembali. Masuk untuk melanjutkan pekerjaan Anda.'],
  daftar: ['Daftar akun', 'Pihak rantai pasok mendaftar dengan kode referral dari admin.'],
  lupa: ['Lupa kata sandi', 'Masukkan email akun Anda. Jika terdaftar, petunjuk reset akan dikirim.'],
  reset: ['Buat kata sandi baru', 'Pilih kata sandi baru untuk akun Anda.'],
};

async function renderAuth(view, param) {
  const [title, sub] = AUTH_COPY[view]; let demo = false;
  try { demo = view === 'masuk' && (await (await fetch('/api/health')).json()).demoAccounts !== false; } catch { demo = view === 'masuk'; }
  const aside = demo
    ? `<aside class="auth-side"><div class="orb o1"></div><div class="orb o2"></div><h3>Coba cepat dengan akun demo</h3><p class="small">Klik salah satu untuk langsung masuk. Kata sandi demo: <b>lestari123</b>. Semua data adalah simulasi.</p><div class="accs">${AUTH_ACCS.map((a, i) => `<button type="button" class="acc" style="--i:${i}" data-e="${a[0]}"><b>${esc(a[1])}</b><small>${esc(a[2])}</small></button>`).join('')}</div></aside>`
    : `<aside class="auth-side"><div class="orb o1"></div><div class="orb o2"></div><h3>Dari panen sampai meja makan</h3><ul class="pts"><li style="--i:0">Setiap serah terima dikonfirmasi dua pihak</li><li style="--i:1">Catatan berantai hash yang sulit diubah diam-diam</li><li style="--i:2">Konsumen memindai QR dan melihat asal berasnya</li></ul><p class="small">Prototipe · data adalah simulasi.</p></aside>`;
  $('#root').innerHTML = `<div class="auth"><header class="auth-top"><a class="back" href="/" id="back">${AUTH_ICON.back}<span>Kembali ke beranda</span></a><a class="auth-logo" href="/" aria-label="LestariPangan, beranda"><img src="/assets/img/emblem.png" alt=""><b>Lestari<span>Pangan</span></b></a></header>
  <main class="auth-card ${demo ? '' : 'solo'}"><section class="auth-main"><h1>${title}</h1><p class="sub">${sub}</p><div id="av"></div></section>${aside}</main></div>`;
  const av = $('#av');
  const errBox = () => `<div class="auth-err" id="err" role="alert" hidden></div>`;
  const busy = (f, on) => { const b = $('button.pri', f); if (b) { b.disabled = on; b.classList.toggle('busy', on); } };
  const fail = (f, msg) => { const e = $('#err'); e.textContent = msg; e.hidden = false; e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); busy(f, false); };
  const wireEye = () => av.querySelectorAll('[data-eye]').forEach((b) => (b.onclick = () => { const i = b.previousElementSibling, show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = show ? AUTH_ICON.eyeoff : AUTH_ICON.eye; b.setAttribute('aria-pressed', show); b.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'); }));
  const meter = (inp) => { const m = document.createElement('div'); m.className = 'meter'; m.innerHTML = '<i></i><i></i><i></i><i></i><span class="small">Minimal 8 karakter, huruf dan angka</span>'; inp.closest('.af').appendChild(m); const L = ['', 'Lemah', 'Cukup', 'Baik', 'Kuat']; inp.addEventListener('input', () => { const s = inp.value ? pwScore(inp.value) : 0; m.dataset.s = s; $('span', m).textContent = s ? 'Kekuatan: ' + L[s] : 'Minimal 8 karakter, huruf dan angka'; }); };
  const success = (icon, head, text, btn) => { av.innerHTML = `<div class="done">${icon}<h2>${head}</h2><p>${text}</p>${btn}</div>`; };

  if (view === 'masuk') {
    av.innerHTML = `<form id="lf" novalidate>${errBox()}${txtField('email', 'Email', { type: 'email', auto: 'username', ph: 'nama@contoh.id' })}${pwField('password', 'Kata sandi', 'current-password')}<div class="row2"><a href="#/lupa">Lupa kata sandi?</a></div><button class="btn pri big">Masuk</button></form><p class="alt">Belum punya akun? <a href="#/daftar">Daftar dengan kode referral</a></p><p class="alt small">Konsumen? Pindai QR di kemasan atau <a href="/t/LP-PKG-2026-0211">lihat contoh jejak produk</a>.</p>`;
    wireEye();
    const doLogin = guard(async (f, email, password) => { busy(f, true); try { const r = await api('/api/login', { method: 'POST', body: { email, password }, raw: true }); sd('lp_token', r.token); ss.set('lp_act', null); ss.set('lp_view', null); location.hash = '#/'; await loadMe(); renderApp(); if (window.OFF) OFF.sync(); } catch (e) { fail(f, e.message); } });
    $('#lf').onsubmit = (e) => { e.preventDefault(); const f = e.target; if (!f.email.value.trim() || !f.password.value) return fail(f, 'Isi email dan kata sandi'); doLogin(f, f.email.value, f.password.value); };
    av.parentElement.parentElement.querySelectorAll('.acc').forEach((b) => (b.onclick = () => { const f = $('#lf'); f.email.value = b.dataset.e; f.password.value = 'lestari123'; doLogin(f, b.dataset.e, 'lestari123'); }));
    setTimeout(() => $('#f_email') && $('#f_email').focus({ preventScroll: true }), 350);
  } else if (view === 'daftar') {
    av.innerHTML = `<form id="rf" novalidate>${errBox()}${txtField('code', 'Kode referral', { ph: 'mis. PENGEPUL-DEMO1', attrs: 'style="text-transform:uppercase" autocapitalize="characters"' })}${txtField('name', 'Nama usaha', { auto: 'organization' })}${txtField('district', 'Kabupaten / kecamatan (opsional)', { required: false })}${txtField('email', 'Email', { type: 'email', auto: 'email' })}${pwField('password', 'Kata sandi', 'new-password', 'minlength="8"')}<button class="btn pri big">Daftar</button></form><p class="alt">Sudah punya akun? <a href="#/masuk">Masuk</a></p>`;
    wireEye(); meter($('#f_password'));
    $('#rf').onsubmit = guard(async (e) => { e.preventDefault(); const f = e.target; const fd = Object.fromEntries(new FormData(f)); if (!fd.code.trim() || !fd.name.trim() || !fd.email.trim()) return fail(f, 'Kode referral, nama usaha, dan email wajib diisi'); if (pwScore(fd.password) < 2) return fail(f, 'Kata sandi minimal 8 karakter dan memuat huruf serta angka');
      busy(f, true); try { await api('/api/register', { method: 'POST', body: fd, raw: true }); success(AUTH_ICON.ok, 'Pendaftaran berhasil', 'Akun Anda sudah dibuat. Silakan masuk dengan email dan kata sandi tadi.', '<a class="btn pri big" href="#/masuk">Ke halaman masuk</a>'); } catch (er) { fail(f, er.message); } });
  } else if (view === 'lupa') {
    av.innerHTML = `<form id="ff" novalidate>${errBox()}${txtField('email', 'Email akun', { type: 'email', auto: 'email', ph: 'nama@contoh.id' })}<button class="btn pri big">Kirim petunjuk reset</button></form><p class="alt"><a href="#/masuk">← Kembali ke halaman masuk</a></p>`;
    $('#ff').onsubmit = guard(async (e) => { e.preventDefault(); const f = e.target; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return fail(f, 'Masukkan alamat email yang valid'); busy(f, true);
      try { const r = await api('/api/password/forgot', { method: 'POST', body: { email: f.email.value }, raw: true }); success(AUTH_ICON.ok, 'Permintaan diterima', esc(r.message), '<a class="btn big" href="#/masuk">Kembali ke halaman masuk</a>'); } catch (er) { fail(f, er.message); } });
  } else {
    av.innerHTML = '<div class="done"><div class="spin"></div><p>Memeriksa tautan…</p></div>';
    let valid = false; try { valid = param.length >= 20 && (await (await fetch('/api/password/check?token=' + encodeURIComponent(param))).json()).valid; } catch {}
    if (!valid) return success('<svg viewBox="0 0 52 52" width="72" height="72"><circle cx="26" cy="26" r="24" fill="none" stroke="#C62F2F" stroke-width="3"/><path d="M18 18l16 16M34 18L18 34" stroke="#C62F2F" stroke-width="4" stroke-linecap="round"/></svg>', 'Tautan tidak berlaku', 'Tautan reset sudah dipakai atau kedaluwarsa (berlaku 30 menit). Minta tautan baru.', '<a class="btn pri big" href="#/lupa">Minta tautan baru</a>');
    av.innerHTML = `<form id="sf" novalidate>${errBox()}${pwField('password', 'Kata sandi baru', 'new-password', 'minlength="8"')}${pwField('again', 'Ulangi kata sandi baru', 'new-password', 'minlength="8"')}<button class="btn pri big">Simpan kata sandi</button></form>`;
    wireEye(); meter($('#f_password'));
    $('#sf').onsubmit = guard(async (e) => { e.preventDefault(); const f = e.target; if (f.password.value !== f.again.value) return fail(f, 'Ulangi kata sandi dengan sama persis'); if (pwScore(f.password.value) < 2) return fail(f, 'Kata sandi minimal 8 karakter dan memuat huruf serta angka'); busy(f, true);
      try { const r = await api('/api/password/reset', { method: 'POST', body: { token: param, password: f.password.value }, raw: true }); success(AUTH_ICON.ok, 'Kata sandi diganti', esc(r.message), '<a class="btn pri big" href="#/masuk">Masuk sekarang</a>'); } catch (er) { fail(f, er.message); } });
  }
  window.scrollTo(0, 0); window.onhashchange = renderAuthFromHash;
}
