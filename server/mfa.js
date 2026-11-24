// MFA TOTP untuk super admin: pemeriksaan kode (TOTP atau kode pemulihan sekali pakai) dengan pembatas percobaan.
// Data di users[].mfa = { enabled, secret (terenkripsi), pending (terenkripsi, saat pengaturan), lastStep, recovery: [hash] }.
const T = require('./totp'); const sec = require('./security');
module.exports = function (D) {
  const { col } = D; const limiter = sec.createLimiter({ max: 5, windowMs: 15 * 60e3 });
  const enabled = (u) => !!(u && u.mfa && u.mfa.enabled);
  const recoveryLeft = (u) => (u && u.mfa && u.mfa.recovery ? u.mfa.recovery.length : 0);

  // true bila kode sah. Kode TOTP hanya berlaku sekali (langkah terakhir dicatat); kode pemulihan dihapus setelah dipakai.
  async function check(user, code) {
    const fresh = await col.users.findOne({ _id: user._id }); if (!enabled(fresh)) return false; const m = fresh.mfa; code = String(code || '').trim();
    if (/^\d{3}\s?\d{3}$/.test(code)) {
      const s = T.verify(T.open(m.secret), code, { after: m.lastStep ?? -1 }); if (s == null) return false;
      col.users.update({ _id: user._id }, { mfa: { ...m, lastStep: s } }); user.mfa = { ...m, lastStep: s }; return true;
    }
    if (/^[0-9a-f]{5}-?[0-9a-f]{5}$/i.test(code)) {
      const h = T.hashRecovery(code); if (!(m.recovery || []).includes(h)) return false;
      col.users.update({ _id: user._id }, { mfa: { ...m, recovery: m.recovery.filter((x) => x !== h) } }); await D.audit({ user }, 'mfa.pemulihan.dipakai', user.email); return true;
    }
    return false;
  }
  // untuk tindakan sensitif: batasi percobaan salah per akun; melempar 429 / 403 bila gagal
  async function guard(user, code) {
    const key = 'mfa|' + user._id;
    if (limiter.blocked(key)) throw new D.HttpError(429, `Terlalu banyak kode salah. Coba lagi dalam ${Math.ceil(limiter.retryAfter(key) / 60)} menit.`);
    if (!String(code || '').trim()) throw new D.HttpError(403, 'Masukkan kode verifikasi 6 digit dari aplikasi autentikator', { mfaRequired: true });
    if (!(await check(user, code))) { limiter.hit(key); throw new D.HttpError(403, 'Kode verifikasi salah atau sudah dipakai', { mfaRequired: true }); }
    limiter.clear(key);
  }
  return { enabled, recoveryLeft, check, guard, limiter };
};
