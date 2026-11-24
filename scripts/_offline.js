// Pembuka data untuk skrip perawatan. Backend yang sedang berjalan menyimpan data di memori dan akan menimpa
// perubahan skrip, jadi skrip menolak jalan selama backend hidup (kecuali --force, atau LP_DATA_DIR bukan data aktif).
require('./../server/env');
const net = require('net');
const { openStore } = require('../server/store'), createDomain = require('../server/domain');

const listening = (port, host = '127.0.0.1') => new Promise((resolve) => {
  const s = net.connect({ port, host }); const done = (v) => { s.destroy(); resolve(v); };
  s.setTimeout(700, () => done(false)); s.once('connect', () => done(true)); s.once('error', () => done(false));
});

async function openOffline({ force = false } = {}) {
  const port = +process.env.PORT || 3000;
  if (!force && !process.env.LP_DATA_DIR && (await listening(port))) {
    console.error(`Backend masih berjalan di port ${port}. Matikan dulu (Operasional\\Matikan-LestariPangan.bat) agar data tidak tertimpa, lalu jalankan ulang skrip ini. (--force untuk melewati, tidak disarankan)`);
    process.exit(2);
  }
  const store = await openStore(require('../server/paths').DATA);
  const D = createDomain(store); return { store, D, col: D.col };
}

module.exports = { openOffline, listening };
