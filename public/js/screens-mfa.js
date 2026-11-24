// Verifikasi dua langkah (TOTP), khusus super admin: wajib untuk Mode Tindak dan diminta saat masuk bila aktif.
// Kartu ini dipasang di layar Profil oleh S.profil (screens-common.js).
function mfaCard(grid) {
  const card = document.createElement('div'); card.className = 'card'; grid.appendChild(card); const on = !!(me.mfa && me.mfa.enabled);
  card.innerHTML = `<h2>Verifikasi dua langkah</h2><p class="small">Super admin dapat bertindak atas nama pelaku, jadi akun ini dilindungi kode dari aplikasi autentikator (Google Authenticator, Authy, 1Password, dan sejenisnya).</p>
    <div style="margin:12px 0">${on ? chip('verified', 'Aktif') + ' <span class="small">' + me.mfa.recoveryLeft + ' kode pemulihan tersisa</span>' : chip('wait', 'Belum aktif') + ' <span class="small">Mode Tindak belum bisa dipakai</span>'}</div>
    <div class="btns">${on ? '<button class="btn dan" id="mfa-off">Nonaktifkan</button>' : '<button class="btn pri" id="mfa-on">Aktifkan verifikasi dua langkah</button>'}</div>`;

  const turnOn = card.querySelector('#mfa-on');
  if (turnOn) turnOn.onclick = () => openModal({
    title: 'Aktifkan verifikasi dua langkah', submit: 'Lanjut', confirmMsg: false,
    body: `<p class="small">Masukkan kata sandi Anda untuk memulai.</p>${fld('password', 'Kata sandi', { type: 'password' })}`,
    onSubmit: async (fd, close) => {
      const r = await api('/api/me/mfa/setup', { method: 'POST', body: { password: fd.password } }); close();
      openModal({
        title: 'Pindai lalu masukkan kode', submit: 'Aktifkan', confirmMsg: false,
        body: `<p class="small">1. Buka aplikasi autentikator, pilih tambah akun, lalu pindai kode ini.</p><div style="display:flex;justify-content:center;margin:10px 0">${r.qr}</div><p class="small">Tidak bisa memindai? Ketik kunci ini: <b class="mono" style="word-break:break-all">${esc(r.secret)}</b></p><p class="small" style="margin-top:10px">2. Masukkan kode 6 digit yang tampil di aplikasi.</p>${fld('code', 'Kode 6 digit', { ph: '123456' })}`,
        onSubmit: async (fd2, close2) => {
          const e = await api('/api/me/mfa/enable', { method: 'POST', body: { code: fd2.code } }); close2(); sd('lp_token', e.token);
          openModal({
            title: 'Simpan kode pemulihan', hideSubmit: true, cancel: 'Saya sudah menyimpannya', confirmMsg: false,
            body: `<p>Kode ini satu-satunya jalan masuk bila ponsel hilang. <b>Hanya ditampilkan sekali.</b> Simpan di tempat aman (pengelola kata sandi atau dicetak).</p><div class="mono" style="columns:2;font-size:14px;background:var(--g50);padding:12px;border-radius:10px;margin:10px 0;line-height:1.9">${e.recoveryCodes.map(esc).join('<br>')}</div>`,
          });
          setTimeout(reload, 300);
        },
      });
    },
  });

  const turnOff = card.querySelector('#mfa-off');
  if (turnOff) turnOff.onclick = () => openModal({
    title: 'Nonaktifkan verifikasi dua langkah?', submit: 'Nonaktifkan',
    body: `<p class="small">Mode Tindak tidak bisa dipakai lagi sampai Anda mengaktifkannya kembali. Sesi di perangkat lain berakhir.</p>${fld('password', 'Kata sandi', { type: 'password' })}${fld('code', 'Kode 6 digit atau kode pemulihan')}`,
    onSubmit: async (fd, close) => { const r = await api('/api/me/mfa/disable', { method: 'POST', body: { password: fd.password, code: fd.code } }); close(); sd('lp_token', r.token); reload(); },
  });
}
