// Inti aplikasi: util, API, sesi, layout, router.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kg = (n) => (Math.round(+n * 10) / 10).toLocaleString('id-ID') + ' kg';
const dt = (i) => (i ? new Date(i).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const ld = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const sd = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ss = { get: (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const S = {}; let me = null; let curRoute = '';

async function api(path, { method = 'GET', body, raw } = {}) {
  const h = { 'content-type': 'application/json' }; const tok = ld('lp_token');
  if (tok) h.authorization = 'Bearer ' + tok;
  const act = ss.get('lp_act'), view = ss.get('lp_view');
  if (act) h['x-act-token'] = act.token; else if (view) h['x-view-as'] = view.actorId;
  const r = await fetch(path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && tok && !raw) { logout(); throw new Error(j.error || 'Sesi berakhir'); }
  if (!r.ok) throw new Error(j.error || 'Terjadi kesalahan');
  return j;
}
function toast(msg, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), err ? 5200 : 3200); }
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

const CH = { pending_verification: ['wait', 'Menunggu verifikasi'], available: ['ok', 'Tersedia'], in_transit: ['info', 'Dalam pengiriman'], merged: ['gray', 'Digabung'], processed: ['gray', 'Sudah diolah'], consumed: ['gray', 'Habis'], voided: ['bad', 'Dibatalkan'], disputed: ['bad', 'Sengketa'], pending: ['wait', 'Menunggu verifikasi'], verified: ['ok', 'Terverifikasi'], auto_accepted: ['info', 'Diterima otomatis'], rejected: ['bad', 'Ditolak'], received: ['ok', 'Diterima'], resolved_accepted: ['ok', 'Diterima (putusan admin)'], returned: ['gray', 'Dikembalikan'], tinggi: ['bad', 'Tinggi'], sedang: ['wait', 'Sedang'], rendah: ['gray', 'Rendah'] };
const chip = (s, label) => { const c = CH[s] || ['gray', s]; return `<span class="chip ${c[0]}">${esc(label || c[1])}</span>`; };
const KIND = { deposit: 'Setoran', merged: 'Gabungan', processed: 'Hasil giling', packaged: 'Kemasan' };
const ROLE = { superadmin: 'Super admin', admin: 'Admin teknis', pengawas: 'Pengawas', pengepul: 'Pengepul', gudang: 'Gudang/penggilingan', distributor: 'Distributor', logistik: 'Logistik', retailer: 'Retailer' };

function openModal({ title, body, submit = 'Simpan', onSubmit, cancel = 'Batal', hideSubmit }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<form class="modal"><h2>${esc(title)}</h2>${body}<div class="btns" style="margin-top:16px;justify-content:flex-end"><button type="button" class="btn" data-x>${cancel}</button>${hideSubmit ? '' : `<button class="btn pri">${esc(submit)}</button>`}</div></form>`;
  document.body.appendChild(bg); const close = () => bg.remove();
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  $('[data-x]', bg).onclick = close;
  $('form', bg).onsubmit = guard(async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); const btn = $('.pri', bg); if (btn) btn.disabled = true; try { await onSubmit?.(fd, close); } catch (er) { toast(er.message, true); if (btn) btn.disabled = false; } });
  return { close, el: bg };
}
const fld = (name, label, o = {}) => `<label class="f">${label}</label>${o.type === 'select' ? `<select class="inp" name="${name}" ${o.required === false ? '' : 'required'}>${o.options}</select>` : o.type === 'textarea' ? `<textarea class="inp" name="${name}" rows="3" ${o.required === false ? '' : 'required'} placeholder="${esc(o.ph || '')}"></textarea>` : `<input class="inp" name="${name}" type="${o.type || 'text'}" ${o.step ? `step="${o.step}"` : ''} ${o.required === false ? '' : 'required'} value="${esc(o.value ?? '')}" placeholder="${esc(o.ph || '')}" ${o.min ? `min="${o.min}"` : ''}>`}`;
const opts = (arr, v, l, ph) => (ph ? `<option value="">${esc(ph)}</option>` : '') + arr.map((x) => `<option value="${esc(x[v])}">${esc(typeof l === 'function' ? l(x) : x[l])}</option>`).join('');

// ---------- navigasi per peran ----------
const NAV = {
  pengepul: [['beranda', 'Beranda'], ['setoran-baru', 'Catat Setoran'], ['setoran', 'Setoran Saya'], ['batch', 'Batch & Gabung'], ['kirim', 'Kirim & Transfer'], ['label', 'QR Label']],
  gudang: [['beranda', 'Beranda'], ['terima', 'Terima Barang'], ['batch', 'Batch & Lineage'], ['kemasan', 'Pengemasan & QR'], ['kirim', 'Kirim']],
  distributor: [['beranda', 'Beranda'], ['terima', 'Terima Barang'], ['batch', 'Batch'], ['kirim', 'Kirim ke Retailer']],
  logistik: [['beranda', 'Beranda'], ['kiriman', 'Kiriman Saya']],
  retailer: [['beranda', 'Beranda'], ['terima', 'Terima Barang'], ['batch', 'Stok & Asal Produk']],
  admin: [['beranda', 'Beranda'], ['verifikasi', 'Antrean Verifikasi', 'pending'], ['pengguna', 'Pengguna'], ['pelaku', 'Pelaku & Kode Referral'], ['kelompok', 'Kelompok Tani'], ['sengketa', 'Sengketa Transfer', 'disputed'], ['integritas', 'Integritas Blockchain'], ['konfigurasi', 'Konfigurasi'], ['audit', 'Audit Log']],
  pengawas: [['dashboard', 'Dashboard'], ['tracelog', 'Trace Log'], ['anomali', 'Anomali'], ['tren', 'Tren Pasokan'], ['integritas', 'Integritas Blockchain'], ['audit', 'Audit Log']],
  superadmin: [['mode-tindak', 'Mode Tindak'], ['mode-lihat', 'Mode Lihat'], ['dashboard', 'Dashboard Pengawasan'], ['verifikasi', 'Antrean Verifikasi', 'pending'], ['pengguna', 'Pengguna'], ['pelaku', 'Pelaku & Kode Referral'], ['kelompok', 'Kelompok Tani'], ['sengketa', 'Sengketa Transfer', 'disputed'], ['tracelog', 'Trace Log'], ['anomali', 'Anomali'], ['tren', 'Tren Pasokan'], ['integritas', 'Integritas Blockchain'], ['konfigurasi', 'Konfigurasi'], ['audit', 'Audit Log']],
};

// ---------- sesi ----------
function logout() { sd('lp_token', null); ss.set('lp_act', null); ss.set('lp_view', null); me = null; location.hash = ''; renderLogin(); }
async function loadMe() { me = await api('/api/me'); return me; }
async function boot() {
  const m = location.hash.match(/^#\/t\/(.+)/); if (m) { location.href = '/t/' + m[1]; return; }
  if (!ld('lp_token')) return renderLogin();
  try { await loadMe(); renderApp(); } catch { renderLogin(); }
}
function leaveMode() { ss.set('lp_act', null); ss.set('lp_view', null); location.hash = '#/'; location.reload(); }

function renderLogin() {
  const accs = [['sa@lestari.id', 'Super Admin', 'Semua fitur semua peran'], ['admin@lestari.id', 'Admin Teknis', 'Verifikasi, referral, sengketa'], ['pengawas@lestari.id', 'Pengawas (Dinas)', 'Dashboard dan analitik, baca-saja'], ['pengepul1@lestari.id', 'Pengepul · CV Tani Makmur', 'Catat setoran, QR hulu'], ['gudang1@lestari.id', 'Penggilingan Sinar Jaya', 'Terima, giling, kemas'], ['distributor@lestari.id', 'Distributor', 'Teruskan ke retailer'], ['logistik@lestari.id', 'Logistik', 'Pengangkut'], ['retailer@lestari.id', 'Retailer', 'Terima dan jual']];
  $('#root').innerHTML = `<div class="login"><div class="box"><div class="l"><div class="brand" style="padding:0 0 18px"><img src="/assets/img/emblem.png" alt=""><div><b>Lestari<span>Pangan</span></b><small>Traceability pangan dari sawah sampai meja makan</small></div></div>
  <h2 style="font-size:20px;color:var(--g900);margin-bottom:4px">Masuk</h2><p class="small">Prototipe · semua data adalah <b>simulasi</b></p>
  <form id="lf"><label class="f">Email</label><input class="inp" name="email" type="email" required autocomplete="username" value=""><label class="f">Kata sandi</label><input class="inp" name="password" type="password" required autocomplete="current-password"><div class="btns" style="margin-top:16px"><button class="btn pri" style="flex:1">Masuk</button></div></form>
  <p class="small" style="margin-top:16px">Pengepul atau pihak baru? <a href="#" id="reg">Daftar dengan kode referral</a></p>
  <p class="small" style="margin-top:8px">Konsumen? Pindai QR di kemasan. <a href="/t/LP-PKG-2026-0211">Lihat contoh</a></p></div>
  <div class="r"><h3>Akun demo (kata sandi: lestari123)</h3>${accs.map((a) => `<button class="acc" data-e="${a[0]}">${esc(a[1])}<small>${esc(a[2])}</small></button>`).join('')}</div></div></div>`;
  document.querySelectorAll('.acc').forEach((b) => (b.onclick = () => { const f = $('#lf'); f.email.value = b.dataset.e; f.password.value = 'lestari123'; f.requestSubmit(); }));
  $('#lf').onsubmit = guard(async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); const r = await api('/api/login', { method: 'POST', body: fd, raw: true }); sd('lp_token', r.token); ss.set('lp_act', null); ss.set('lp_view', null); location.hash = '#/'; await loadMe(); renderApp(); });
  $('#reg').onclick = (e) => { e.preventDefault(); openModal({ title: 'Daftar dengan kode referral', submit: 'Daftar', body: `<p class="small">Pengepul dan pihak rantai pasok lain hanya bisa mendaftar dengan kode dari admin. Contoh demo: <b>PENGEPUL-DEMO1</b>.</p>${fld('code', 'Kode referral')}${fld('name', 'Nama usaha')}${fld('district', 'Kabupaten/kecamatan', { required: false })}${fld('email', 'Email', { type: 'email' })}${fld('password', 'Kata sandi (min. 8 karakter)', { type: 'password' })}`, onSubmit: async (fd, close) => { await api('/api/register', { method: 'POST', body: fd, raw: true }); close(); toast('Pendaftaran berhasil. Silakan masuk.'); } }); };
}

// ---------- layout ----------
async function renderApp() {
  const role = me.role, nav = NAV[role] || []; const act = ss.get('lp_act'), view = ss.get('lp_view');
  if (act && me.act === null && me.user.role === 'superadmin') { ss.set('lp_act', null); }
  let counts = {};
  if (['admin', 'superadmin'].includes(role)) { try { counts = { pending: (await api('/api/verifications')).length, disputed: (await api('/api/transfers?box=disputed')).filter((t) => t.status === 'disputed').length }; } catch {} }
  const banner = me.act ? `<div class="ban">Mode Tindak aktif · bertindak sebagai ${esc(ROLE[me.act.role])} · ${esc(me.actor?.name)} · berakhir <b id="cd"></b><span class="small" style="color:#5a4300">Alasan: ${esc(me.act.reason)}</span><button class="btn sm" onclick="leaveMode()">Keluar Mode Tindak</button></div>` : me.readOnly ? `<div class="ban view">Mode Lihat · melihat sebagai ${esc(ROLE[me.role])} · ${esc(me.actor?.name)} · baca-saja, tercatat di audit log<button class="btn sm" onclick="leaveMode()">Keluar Mode Lihat</button></div>` : '';
  $('#root').innerHTML = `<div class="app"><div class="side"><div class="brand"><img src="/assets/img/emblem.png" alt=""><div><b>Lestari<span>Pangan</span></b><small>Traceability pangan</small></div></div><div class="sec">${esc(ROLE[role])}</div>
  ${nav.map((n) => `<a class="nav" href="#/${n[0]}" data-r="${n[0]}"><i></i>${esc(n[1])}${n[2] && counts[n[2]] ? `<span class="badge">${counts[n[2]]}</span>` : ''}</a>`).join('')}
  <div class="foot">${esc(me.store)}<br>Ledger: ${esc(me.network)}<br>Analitik: ${me.ai === 'claude' ? 'Claude' : 'berbasis aturan'}</div></div>
  <div class="col"><div class="top"><h1 id="ttl"></h1><span class="demo">DATA SIMULASI</span><div class="sp"></div><div style="position:relative"><button class="bell" id="bell" title="Notifikasi">&#128276;<b id="bn" style="display:none"></b></button><div class="pop" id="pop" style="display:none"></div></div>
  <div class="user"><div class="av">${esc(me.user.name.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</div><div>${esc(me.actor?.name || me.user.name)}<small>${esc(me.act ? 'Mode Tindak (' + me.user.name + ')' : ROLE[me.user.role])}</small></div></div><button class="btn sm" onclick="logout()">Keluar</button></div>
  ${banner}<div class="main" id="main"></div></div></div>`;
  if (me.act) { const tick = () => { const s = me.act.exp - Math.floor(Date.now() / 1000); if (s <= 0) { toast('Mode Tindak berakhir', true); leaveMode(); return; } const el = $('#cd'); if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }; tick(); setInterval(tick, 1000); }
  $('#bell').onclick = guard(async () => { const p = $('#pop'); if (p.style.display === 'block') { p.style.display = 'none'; return; } const ns = await api('/api/notifications'); p.innerHTML = ns.length ? ns.map((n) => `<div class="n">${esc(n.text)}<small>${dt(n.at)} · ${n.delivery === 'manual' ? 'pemberitahuan manual (dalam aplikasi)' : 'antrean email'}</small></div>`).join('') : '<div class="empty">Belum ada notifikasi</div>'; p.style.display = 'block'; await api('/api/notifications/read', { method: 'POST' }); $('#bn').style.display = 'none'; });
  api('/api/notifications').then((ns) => { const u = ns.filter((n) => !n.read).length; if (u) { const b = $('#bn'); b.textContent = u; b.style.display = 'block'; } }).catch(() => {});
  window.onhashchange = route; route();
}
async function route() {
  const parts = location.hash.replace(/^#\//, '').split('/'); const nav = NAV[me.role] || []; let id = parts[0] || nav[0][0]; const param = parts.slice(1).join('/');
  if (id !== 'batch-detail' && !nav.find((n) => n[0] === id) && id !== 'detail') id = nav[0][0];
  curRoute = id; document.querySelectorAll('.nav').forEach((a) => a.classList.toggle('on', a.dataset.r === (id === 'detail' ? 'batch' : id)));
  const label = (nav.find((n) => n[0] === id) || [0, id === 'detail' ? 'Detail Batch' : ''])[1]; $('#ttl').textContent = label;
  const main = $('#main'); main.innerHTML = '<div class="empty">Memuat…</div>';
  try { await (S[(me.role === 'superadmin' ? 'sa:' : '') + id] || S[id] || S.__no)(main, param); } catch (e) { main.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; }
}
const go = (h) => { location.hash = h; };
const reload = () => route();
