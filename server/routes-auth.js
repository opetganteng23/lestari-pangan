// Rute lupa/reset kata sandi (publik). Token acak sekali pakai, disimpan sebagai hash, berlaku 30 menit.
// Tidak membocorkan apakah email terdaftar. Tautan reset hanya dikirim lewat email (butuh SMTP); tanpa SMTP, admin diberi tahu dan mereset manual.
const crypto = require('crypto');
module.exports = function ({ D, add, bad, sec, auth }) {
  const { col } = D; const sha = (s) => crypto.createHash('sha256').update(s).digest('hex'); const TTL = 30 * 60e3;
  const byIp = sec.createLimiter({ max: 8, windowMs: 3600e3 }), byEmail = sec.createLimiter({ max: 3, windowMs: 3600e3 }), badToken = sec.createLimiter({ max: 10, windowMs: 3600e3 });
  const SAME = { ok: true, message: 'Jika email itu terdaftar, petunjuk reset kata sandi akan dikirim. Bila tidak ada email masuk, hubungi admin Anda.' };

  add('POST', '/api/password/forgot', async (c) => {
    const email = String(c.body.email || '').toLowerCase().trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw bad('Masukkan alamat email yang valid');
    if (!byIp.hit(c.ip || '?') || !byEmail.hit(email)) throw new D.HttpError(429, 'Terlalu banyak permintaan reset. Coba lagi dalam satu jam.');
    const u = await col.users.findOne({ email });
    if (u && u.active !== false) {
      await col.resets.remove({ userId: u._id }); // hanya satu token aktif per pengguna
      const token = crypto.randomBytes(32).toString('base64url');
      await col.resets.insert({ userId: u._id, tokenHash: sha(token), exp: new Date(Date.now() + TTL).toISOString(), used: false, createdAt: D.now() });
      const cfg = await D.cfg(); const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
      if (cfg.notifierMode === 'smtp' && base) {
        await col.emails.insert({ key: 'reset:' + sha(token).slice(0, 16), notificationId: null, to: u.email, toName: u.name, subject: '[LestariPangan] Reset kata sandi',
          text: `Halo ${u.name},\n\nAda permintaan reset kata sandi untuk akun ini. Buka tautan berikut (berlaku 30 menit, sekali pakai):\n${base}/app#/reset/${token}\n\nJika bukan Anda yang meminta, abaikan email ini; kata sandi Anda tidak berubah.`, status: 'pending', attempts: 0, nextAt: D.now(), createdAt: D.now(), lastError: null });
      }
      await D.notify({ toRole: 'admin', text: `Permintaan reset kata sandi untuk ${u.email}${cfg.notifierMode === 'smtp' ? ' (tautan dikirim ke emailnya)' : ' — email belum aktif, reset manual lewat menu Pengguna'}`, link: '#/pengguna' });
      await D.audit({ user: u }, 'sandi.lupa', u.email);
    }
    return SAME;
  }, { public: true });

  add('POST', '/api/password/reset', async (c) => {
    if (badToken.blocked(c.ip || '?')) throw new D.HttpError(429, 'Terlalu banyak percobaan. Coba lagi nanti.');
    const token = String(c.body.token || ''); const issue = sec.passwordIssue(c.body.password); if (issue) throw bad(issue);
    const r = token.length >= 20 ? await col.resets.findOne({ tokenHash: sha(token) }) : null;
    if (!r || r.used || r.exp < D.now()) { badToken.hit(c.ip || '?'); throw bad('Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.'); }
    const u = await col.users.findOne({ _id: r.userId }); if (!u || u.active === false) throw bad('Akun tidak aktif');
    await col.users.update({ _id: u._id }, { passwordHash: auth.hashPassword(String(c.body.password)), sv: (u.sv || 0) + 1 });
    await col.resets.update({ _id: r._id }, { used: true, usedAt: D.now() }); await D.audit({ user: u }, 'sandi.reset', u.email);
    return { ok: true, message: 'Kata sandi diganti. Silakan masuk dengan kata sandi baru.' };
  }, { public: true });
  add('GET', '/api/password/check', async (c) => { const t = String(c.query.token || ''); const r = t.length >= 20 ? await col.resets.findOne({ tokenHash: sha(t) }) : null; return { valid: !!(r && !r.used && r.exp >= D.now()) }; }, { public: true });
};
