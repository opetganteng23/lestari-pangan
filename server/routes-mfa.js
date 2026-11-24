// Rute pengaturan MFA TOTP (khusus super admin): setup → enable (konfirmasi kode pertama) → disable.
const T = require('./totp'); const qr = require('./qr');
module.exports = function ({ D, add, bad, forbid, conflict, auth, MFA }) {
  const { col } = D;
  const sa = (c) => { if (c.user.role !== 'superadmin') throw forbid('MFA hanya untuk super admin'); if (c.act) throw forbid('Keluar dari Mode Tindak dulu'); };
  const needPassword = (c) => { if (!auth.checkPassword(String(c.body.password || ''), c.user.passwordHash)) throw forbid('Kata sandi salah'); };
  const token = (u, sv) => auth.sign({ uid: u._id, sv }, 12 * 3600);

  add('GET', '/api/me/mfa', async (c) => { sa(c); return { enabled: MFA.enabled(c.user), recoveryLeft: MFA.recoveryLeft(c.user) }; });

  add('POST', '/api/me/mfa/setup', async (c) => {
    sa(c); if (MFA.enabled(c.user)) throw conflict('MFA sudah aktif. Nonaktifkan dulu bila ingin mengganti perangkat.'); needPassword(c);
    const secret = T.newSecret(), uri = T.otpauth(c.user.email, secret);
    await col.users.update({ _id: c.user._id }, { mfa: { enabled: false, pending: T.seal(secret) } }); await D.audit(c, 'mfa.setup', c.user.email);
    return { secret, otpauth: uri, qr: qr.svg(uri, { size: 200 }) };
  });

  add('POST', '/api/me/mfa/enable', async (c) => {
    sa(c); const m = c.user.mfa; if (MFA.enabled(c.user)) throw conflict('MFA sudah aktif'); if (!m || !m.pending) throw bad('Mulai pengaturan MFA dulu');
    const key = 'mfa|' + c.user._id; if (MFA.limiter.blocked(key)) throw new D.HttpError(429, 'Terlalu banyak kode salah. Coba lagi nanti.');
    const step = T.verify(T.open(m.pending), c.body.code); if (step == null) { MFA.limiter.hit(key); throw bad('Kode salah. Pastikan jam ponsel tepat, lalu coba kode terbaru.'); }
    MFA.limiter.clear(key); const codes = T.recoveryCodes(), sv = (c.user.sv || 0) + 1;
    await col.users.update({ _id: c.user._id }, { mfa: { enabled: true, secret: m.pending, lastStep: step, recovery: codes.map(T.hashRecovery), enabledAt: D.now() }, sv });
    await D.audit(c, 'mfa.aktif', c.user.email); return { ok: true, token: token(c.user, sv), recoveryCodes: codes };
  });

  add('POST', '/api/me/mfa/disable', async (c) => {
    sa(c); if (!MFA.enabled(c.user)) throw bad('MFA belum aktif'); needPassword(c); await MFA.guard(c.user, c.body.code);
    const sv = (c.user.sv || 0) + 1; await col.users.update({ _id: c.user._id }, { mfa: null, sv }); await D.audit(c, 'mfa.nonaktif', c.user.email);
    return { ok: true, token: token(c.user, sv) };
  });
};
