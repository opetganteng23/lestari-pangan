// Pengirim email. Aktif bila SMTP_HOST diisi dan paket `nodemailer` terpasang. BELUM DIUJI dengan server SMTP nyata.
// Isi email hanya teks pemberitahuan singkat; tanpa dokumen, foto, atau kata sandi.
let tr;
function transport() {
  if (tr) return tr;
  if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST belum diatur');
  let nm; try { nm = require('nodemailer'); } catch { throw new Error('Paket "nodemailer" belum terpasang (npm i nodemailer)'); }
  tr = nm.createTransport({ host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587, secure: process.env.SMTP_SECURE === '1', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  return tr;
}
module.exports = {
  async send({ to, subject, text }) { await transport().sendMail({ from: process.env.SMTP_FROM || 'LestariPangan <no-reply@localhost>', to, subject, text }); },
};
