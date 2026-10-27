// Layar yang dipakai semua peran: Profil & keamanan akun
S.profil = async (m) => {
  const u = me.user;
  m.innerHTML = `<div class="grid g2"><div class="card"><h2>Profil</h2>
    <div class="row"><div><label class="f">Nama</label><div>${esc(u.name)}</div></div><div><label class="f">Peran</label><div>${esc(ROLE[u.role])}</div></div></div>
    <label class="f">Email</label><div>${esc(u.email)}</div>
    ${me.actor ? `<label class="f">Pelaku rantai pasok</label><div>${esc(me.actor.name)}${me.actor.district ? ' · ' + esc(me.actor.district) : ''}</div>` : ''}
    <div class="btns" style="margin-top:18px"><button class="btn dan" id="lo">Keluar dari semua perangkat</button></div>
    <p class="small" style="margin-top:8px">Mencabut semua sesi aktif akun ini, termasuk di perangkat lain.</p></div>
  <div class="card"><h2>Ganti kata sandi</h2><form id="pw">
    <label class="f">Kata sandi saat ini</label><input class="inp" type="password" name="current" required autocomplete="current-password">
    <label class="f">Kata sandi baru</label><input class="inp" type="password" name="next" required minlength="8" autocomplete="new-password">
    <label class="f">Ulangi kata sandi baru</label><input class="inp" type="password" name="again" required minlength="8" autocomplete="new-password">
    <p class="small" style="margin-top:8px">Minimal 8 karakter, memuat huruf dan angka. Sesi di perangkat lain akan berakhir.</p>
    <div class="btns" style="margin-top:14px"><button class="btn pri">Simpan kata sandi</button></div></form></div></div>`;
  $('#pw').onsubmit = guard(async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    if (f.next !== f.again) throw new Error('Ulangi kata sandi baru dengan sama persis');
    const r = await api('/api/me/password', { method: 'POST', body: { current: f.current, next: f.next } });
    sd('lp_token', r.token); e.target.reset(); toast('Kata sandi diganti');
  });
  $('#lo').onclick = guard(async () => { if (confirm('Keluar dari semua perangkat?')) { await api('/api/logout', { method: 'POST' }); logout(true); } });
};
