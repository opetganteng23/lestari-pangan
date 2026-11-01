// Rute dashboard Server (admin): status, gerbang layanan, batas AI, cadangan, uji koneksi AI.
const sec = require('./security');
module.exports = function ({ D, add, need }) {
  const S = D.serverctl; const pingLimiter = sec.createLimiter({ max: 3, windowMs: 60000 });
  add('GET', '/api/server/status', async (c) => { need(c, ['admin']); return S.status(); });
  add('PUT', '/api/server/gate', async (c) => { need(c, ['admin'], true); return S.setGate(c, c.body); });
  add('POST', '/api/server/backup', async (c) => {
    need(c, ['admin'], true); D.store.flush(); const r = S.backup.run(); await D.audit(c, 'server.cadangan', r.name);
    return { ...r, note: D.store.kind === 'MongoDB' ? 'Hanya berkas. Cadangkan MongoDB dengan mongodump.' : 'Berkas data, ledger, dan unggahan tersalin.' };
  });
  add('POST', '/api/server/ai/test', async (c) => { need(c, ['admin'], true); if (!pingLimiter.hit('t')) throw new D.HttpError(429, 'Uji AI maksimal 3 kali per menit'); const r = await S.pingAi(); await D.audit(c, 'server.uji_ai', `${r.ok ? 'ok' : 'gagal'}: ${r.text}`); return r; });
};
