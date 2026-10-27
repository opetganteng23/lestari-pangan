// Rute Fase 3 (kasus, neraca massa, ekspor, email, risiko). Dipanggil dari routes.js.
const sec = require('./security');
module.exports = function ({ D, add, need, ACTOR_ROLES, bad, notFound }) {
  const aiLimiter = sec.createLimiter({ max: +process.env.AI_RATE_PER_MIN || 20, windowMs: 60000 });
  const O = D.ops;
  const STAFF = ['admin', 'pengawas'];
  // kasus
  add('GET', '/api/cases', async (c) => { need(c, STAFF); return O.listCases(c.query); });
  add('POST', '/api/cases', async (c) => { need(c, ['admin'], true); return O.createCase(c, c.body); });
  add('GET', '/api/cases/:id', async (c) => { need(c, STAFF); const k = await O.caseById(c.params.id); return { ...k, sla: O.sla(k) }; });
  add('GET', '/api/cases/:id/impact', async (c) => { need(c, STAFF); return O.impact(c.params.id); });
  add('POST', '/api/cases/:id/notes', async (c) => { need(c, ['admin'], true); return O.addNote(c, c.params.id, c.body.text); });
  add('POST', '/api/cases/:id/status', async (c) => { need(c, ['admin'], true); return O.setStatus(c, c.params.id, c.body.status); });
  add('POST', '/api/cases/:id/assign', async (c) => { need(c, ['admin'], true); return O.assign(c, c.params.id, c.body.userId); });
  add('POST', '/api/cases/:id/evidence', async (c) => { need(c, ['admin'], true); return O.addEvidence(c, c.params.id, c.body.label, c.body.ref); });
  add('POST', '/api/cases/:id/decision', async (c) => { need(c, ['admin'], true); return O.decide(c, c.params.id, c.body); });
  add('POST', '/api/cases/:id/close', async (c) => { need(c, ['admin'], true); return O.closeCase(c, c.params.id, c.body.summary); });
  add('GET', '/api/risk', async (c) => { need(c, STAFF); return O.risk(); });
  add('GET', '/api/staff', async (c) => { need(c, STAFF); return (await D.col.users.find({})).filter((u) => ['admin', 'pengawas'].includes(u.role) && u.active !== false).map((u) => ({ _id: u._id, name: u.name, role: u.role })); });
  // neraca massa
  add('GET', '/api/massbalance', async (c) => { need(c, [...STAFF, 'gudang']); return O.massBalanceList(c); });
  add('GET', '/api/massbalance/:batchId/corrections', async (c) => { need(c, [...STAFF, 'gudang']); return O.corrections(c.params.batchId); });
  add('POST', '/api/massbalance/:batchId/correction', async (c) => { need(c, ['admin', 'gudang'], true); return O.correctMassBalance(c, c.params.batchId, c.body); });
  // ekspor
  add('GET', '/api/exports', async (c) => { need(c, [...STAFF, 'gudang', 'kelompok_tani']); const list = Object.entries(O.EXPORTS).filter(([, e]) => e.roles.includes(c.role) || c.role === 'superadmin').map(([k, e]) => ({ kind: k, title: e.title })); return { kinds: list, formats: ['csv'], note: 'CSV dibuka langsung di Excel. Untuk PDF gunakan tombol Cetak pada halaman laporan. XLSX/PDF asli belum tersedia.' }; });
  add('GET', '/api/exports/log', async (c) => { need(c, STAFF); return D.col.exportsLog.find({}, { sort: { at: -1 }, limit: 100 }); });
  add('GET', '/api/exports/:kind', async (c) => { need(c, [...STAFF, 'gudang', 'kelompok_tani']); return { __csv: await O.exportCsv(c, c.params.kind, c.query) }; });
  // AI Copilot (baca-saja)
  add('POST', '/api/ai/copilot/query', async (c) => { need(c, STAFF); if (!aiLimiter.hit(c.user._id)) throw new D.HttpError(429, 'Terlalu banyak pertanyaan AI, coba lagi sebentar'); return D.copilot.query(c, c.body.question); });
  add('GET', '/api/ai/logs', async (c) => { need(c, ['admin']); return D.col.aiLogs.find({}, { sort: { at: -1 }, limit: 100 }); });
  // email
  add('GET', '/api/emails', async (c) => { need(c, ['admin']); const f = c.query.status ? { status: c.query.status } : {}; return D.col.emails.find(f, { sort: { createdAt: -1 }, limit: 200 }); });
  add('POST', '/api/emails/run', async (c) => { need(c, ['admin'], true); return O.processEmails(); });
  add('POST', '/api/emails/:id/retry', async (c) => { need(c, ['admin'], true); return O.retryEmail(c.params.id); });
};
