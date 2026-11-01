// Inti aplikasi: util, API, sesi, layout, router.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kg = (n) => (Math.round(+n * 10) / 10).toLocaleString('id-ID') + ' kg';
const dt = (i) => (i ? new Date(i).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const ld = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const sd = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ss = { get: (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const S = {}; let me = null; let curRoute = '';

async function api(path, { method = 'GET', body, raw, headers, noLogout } = {}) {
  const h = { 'content-type': 'application/json', ...(headers || {}) }; const tok = ld('lp_token');
  if (tok) h.authorization = 'Bearer ' + tok;
  const act = ss.get('lp_act'), view = ss.get('lp_view');
  if (act) h['x-act-token'] = act.token; else if (view) h['x-view-as'] = view.actorId;
  const r = await fetch(path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && tok && !raw && !noLogout) { logout(true, 'sesi'); throw new Error(j.error || 'Sesi berakhir'); }
  if (!r.ok) throw new Error(j.error || 'Terjadi kesalahan');
  return j;
}
function toast(msg, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), err ? 5200 : 3200); }
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

const CH = { pending_verification: ['wait', 'Menunggu verifikasi'], available: ['ok', 'Tersedia'], in_transit: ['info', 'Dalam pengiriman'], merged: ['gray', 'Digabung'], processed: ['gray', 'Sudah diolah'], consumed: ['gray', 'Habis'], voided: ['bad', 'Dibatalkan'], disputed: ['bad', 'Sengketa'], pending: ['wait', 'Menunggu verifikasi'], verified: ['ok', 'Terverifikasi'], auto_accepted: ['info', 'Diterima otomatis'], rejected: ['bad', 'Ditolak'], received: ['ok', 'Diterima'], resolved_accepted: ['ok', 'Diterima (putusan admin)'], returned: ['gray', 'Dikembalikan'], tinggi: ['bad', 'Tinggi'], sedang: ['wait', 'Sedang'], rendah: ['gray', 'Rendah'] };
const chip = (s, label) => { const c = CH[s] || ['gray', s]; return `<span class="chip ${c[0]}">${esc(label || c[1])}</span>`; };
const KIND = { deposit: 'Setoran', merged: 'Gabungan', processed: 'Hasil giling', packaged: 'Kemasan' };
const ROLE = { kelompok_tani: 'Kelompok tani', superadmin: 'Super admin', admin: 'Admin teknis', pengawas: 'Pengawas', pengepul: 'Pengepul', gudang: 'Gudang/penggilingan', distributor: 'Distributor', logistik: 'Logistik', retailer: 'Retailer' };

// Dialog konfirmasi beranimasi. Mengembalikan Promise<boolean>. Fokus awal di "Batal" agar tidak terpencet tanpa sengaja.
function askConfirm(message, o = {}) {
  return new Promise((resolve) => {
    const danger = o.danger ?? /hapus|tolak|reset|nonaktif|keluar|tahan|recall|jeda|rotasi/i.test((o.title || '') + ' ' + (o.confirm || '') + ' ' + message);
    const bg = document.createElement('div'); bg.className = 'cf-bg'; bg.setAttribute('role', 'alertdialog'); bg.setAttribute('aria-modal', 'true');
    const icon = danger ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>' : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"/></svg>';
    bg.innerHTML = `<div class="cf ${danger ? 'danger' : ''}"><div class="ic">${icon}</div><h2>${esc(o.title || 'Yakin ingin melanjutkan?')}</h2><p>${esc(message)}</p><div class="btns"><button type="button" class="btn" data-no>${esc(o.cancel || 'Batal')}</button><button type="button" class="btn ${danger ? 'dan2' : 'pri'}" data-yes>${esc(o.confirm || 'Ya, lanjutkan')}</button></div></div>`;
    const prev = document.activeElement; document.body.appendChild(bg); document.body.style.overflow = 'hidden';
    const done = (v) => { document.removeEventListener('keydown', key, true); document.body.style.overflow = ''; bg.classList.add('out'); setTimeout(() => { bg.remove(); try { prev && prev.focus && prev.focus(); } catch {} }, 170); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } else if (e.key === 'Tab') { const f = [...bg.querySelectorAll('button')]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } };
    document.addEventListener('keydown', key, true);
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) done(false); });
    bg.querySelector('[data-no]').onclick = () => done(false); bg.querySelector('[data-yes]').onclick = () => done(true); bg.querySelector('[data-no]').focus();
  });
}

function openModal({ title, body, submit = 'Simpan', onSubmit, cancel = 'Batal', hideSubmit, confirmMsg }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<form class="modal"><h2>${esc(title)}</h2>${body}<div class="btns" style="margin-top:16px;justify-content:flex-end"><button type="button" class="btn" data-x>${cancel}</button>${hideSubmit ? '' : `<button class="btn pri">${esc(submit)}</button>`}</div></form>`;
  document.body.appendChild(bg); const close = () => bg.remove();
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  $('[data-x]', bg).onclick = close;
  $('form', bg).onsubmit = guard(async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); if (onSubmit && confirmMsg !== false && !(await askConfirm(confirmMsg || `Lanjutkan "${submit}"? Periksa kembali isian Anda sebelum melanjutkan.`, { title: submit + '?', confirm: 'Ya, ' + submit.toLowerCase() }))) return; const btn = $('.pri', bg); if (btn) btn.disabled = true; try { await onSubmit?.(fd, close); } catch (er) { toast(er.message, true); if (btn) btn.disabled = false; } });
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

NAV.kelompok_tani = [['portal', 'Beranda Kelompok'], ['laporan', 'Laporan']];
const ADD = {
  admin: [['server', 'Server'], ['prediksi', 'Prediksi & Simulasi'], ['integrasi', 'Integrasi & API'], ['kasus', 'Kasus & Investigasi'], ['risiko', 'Papan Risiko'], ['neraca', 'Neraca Massa'], ['laporan', 'Laporan & Ekspor'], ['email', 'Pengiriman Email'], ['copilot', 'Asisten Analisis']],
  pengawas: [['prediksi', 'Prediksi & Simulasi'], ['kasus', 'Kasus & Investigasi'], ['risiko', 'Papan Risiko'], ['neraca', 'Neraca Massa'], ['laporan', 'Laporan & Ekspor'], ['copilot', 'Asisten Analisis']],
  superadmin: [['server', 'Server'], ['prediksi', 'Prediksi & Simulasi'], ['integrasi', 'Integrasi & API'], ['kasus', 'Kasus & Investigasi'], ['risiko', 'Papan Risiko'], ['neraca', 'Neraca Massa'], ['laporan', 'Laporan & Ekspor'], ['email', 'Pengiriman Email'], ['copilot', 'Asisten Analisis']],
  gudang: [['neraca', 'Neraca Massa'], ['laporan', 'Laporan']],
};
for (const [k, v] of Object.entries(ADD)) NAV[k].push(...v);
for (const k of Object.keys(NAV)) NAV[k].push(['profil', 'Profil & Keamanan']);

// ---------- sesi ----------
function logout(done, why) {
  sd('lp_me', null); if (!done && ld('lp_token')) { try { fetch('/api/logout', { method: 'POST', headers: { authorization: 'Bearer ' + ld('lp_token'), 'content-type': 'application/json' }, body: '{}', keepalive: true }).catch(() => {}); } catch {} }
  sd('lp_token', null); ss.set('lp_act', null); ss.set('lp_view', null); me = null;
  location.replace('/?' + (why === 'sesi' ? 'sesi=1' : 'keluar=1')); // keluar selalu kembali ke beranda (landing)
}
// Keluar dengan konfirmasi agar tidak salah tekan
async function requestLogout() { if (await askConfirm('Anda akan keluar dari aplikasi dan kembali ke beranda.', { title: 'Keluar dari LestariPangan?', confirm: 'Ya, keluar', cancel: 'Tetap di sini' })) logout(); }
async function loadMe() { me = await api('/api/me'); sd('lp_me', me); return me; }
async function boot() {
  const m = location.hash.match(/^#\/t\/(.+)/); if (m) { location.href = '/t/' + m[1]; return; }
  const authView = authHashView().view, onAuthHash = /^#\/(masuk|daftar|lupa|reset)/.test(location.hash);
  if (/^#\/reset\//.test(location.hash)) return renderAuthFromHash(); // tautan reset dibuka walau sedang masuk
  if (!ld('lp_token')) { window.onhashchange = renderAuthFromHash; return renderAuthFromHash(); }
  if (onAuthHash) location.hash = '#/';
  try { await loadMe(); renderApp(); if (window.OFF) OFF.sync(); }
  catch (e) { const cached = ld('lp_me'); if (e instanceof TypeError && cached) { me = cached; renderApp(); toast('Mode offline: beberapa data mungkin tidak terbaru', true); } else { sd('lp_token', null); renderAuthFromHash(); } }
}
async function leaveMode(force) {
  if (!force && !(await askConfirm('Semua tindakan berikutnya kembali atas nama Anda sendiri.', { title: 'Keluar dari Mode Tindak?', confirm: 'Ya, keluar mode' }))) return;
  ss.set('lp_act', null); ss.set('lp_view', null); location.hash = '#/'; location.reload();
}

// ---------- layout ----------
async function renderApp() {
  const role = me.role, nav = NAV[role] || []; const act = ss.get('lp_act'), view = ss.get('lp_view');
  if (act && me.act === null && me.user.role === 'superadmin') { ss.set('lp_act', null); }
  let counts = {};
  if (['admin', 'superadmin'].includes(role)) { try { counts = { pending: (await api('/api/verifications')).length, disputed: (await api('/api/transfers?box=disputed')).filter((t) => t.status === 'disputed').length }; } catch {} }
  const svcBan = (me.service && !me.service.open && !['admin', 'superadmin', 'pengawas'].includes(me.user.role)) ? `<div class="ban">Pencatatan baru sedang dijeda: ${esc(me.service.reason)} Anda tetap bisa melihat data.</div>` : '';
  const banner = me.act ? `<div class="ban">Mode Tindak aktif · bertindak sebagai ${esc(ROLE[me.act.role])} · ${esc(me.actor?.name)} · berakhir <b id="cd"></b><span class="small" style="color:#5a4300">Alasan: ${esc(me.act.reason)}</span><button class="btn sm" onclick="leaveMode()">Keluar Mode Tindak</button></div>` : me.readOnly ? `<div class="ban view">Mode Lihat · melihat sebagai ${esc(ROLE[me.role])} · ${esc(me.actor?.name)} · baca-saja, tercatat di audit log<button class="btn sm" onclick="leaveMode()">Keluar Mode Lihat</button></div>` : '';
  $('#root').innerHTML = `<div class="app" id="app"><div class="side" id="side"><div class="brand"><img src="/assets/img/emblem.png" alt=""><div><b>Lestari<span>Pangan</span></b><small>Traceability pangan</small></div></div><div class="sec">${esc(ROLE[role])}</div>
  ${nav.map((n) => `<a class="nav" href="#/${n[0]}" data-r="${n[0]}"><i></i>${esc(n[1])}${n[2] && counts[n[2]] ? `<span class="badge">${counts[n[2]]}</span>` : ''}</a>`).join('')}
  <div class="foot">${esc(me.store)}<br>Ledger: ${esc(me.network)}<br>Analitik: ${me.ai === 'claude' ? 'Claude' : 'berbasis aturan'}</div></div>
  <div class="scrim" id="scrim"></div><div class="col"><div class="top"><button class="menu-btn" id="menu" type="button" aria-label="Buka menu" aria-expanded="false" aria-controls="side"><i></i><i></i><i></i></button><h1 id="ttl"></h1><span class="demo">DATA SIMULASI</span><div class="sp"></div><div style="position:relative"><button class="bell" id="bell" title="Notifikasi">&#128276;<b id="bn" style="display:none"></b></button><div class="pop" id="pop" style="display:none"></div></div>
  <div class="user"><div class="av">${esc(me.user.name.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</div><div>${esc(me.actor?.name || me.user.name)}<small>${esc(me.act ? 'Mode Tindak (' + me.user.name + ')' : ROLE[me.user.role])}</small></div></div><button class="btn sm" id="lo" type="button">Keluar</button></div>
  ${svcBan}${banner}<div class="main" id="main"></div></div></div>`;
  const appEl = $('#app'), setNav = (o) => { appEl.classList.toggle('nav-open', o); $('#menu').setAttribute('aria-expanded', o); $('#menu').setAttribute('aria-label', o ? 'Tutup menu' : 'Buka menu'); };
  $('#menu').onclick = () => setNav(!appEl.classList.contains('nav-open')); $('#scrim').onclick = () => setNav(false); $('#lo').onclick = requestLogout;
  $('#side').addEventListener('click', (e) => { if (e.target.closest('.nav')) setNav(false); }); document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });
  if (me.act) { const tick = () => { const s = me.act.exp - Math.floor(Date.now() / 1000); if (s <= 0) { toast('Mode Tindak berakhir', true); leaveMode(true); return; } const el = $('#cd'); if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }; tick(); setInterval(tick, 1000); }
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
