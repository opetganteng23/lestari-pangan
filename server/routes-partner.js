// Rute Fase 4: portal kelompok tani, kunci API mitra (scope terbatas), integrasi logistik & timbangan, OpenAPI.
const crypto = require('crypto');
module.exports = function ({ D, add, need, ACTOR_ROLES, bad, notFound, forbid, conflict, sec, names }) {
  const { col } = D; const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

  // ================= PORTAL KELOMPOK TANI =================
  // Hanya data kelompok sendiri. Tidak ada data pribadi anggota atau kelompok lain. Tidak ada nilai uang (pembayaran belum terintegrasi).
  add('GET', '/api/farmer/summary', async (c) => {
    need(c, ['kelompok_tani']); const g = c.group; if (!g) throw notFound('Akun belum terhubung ke kelompok tani');
    const deps = (await col.deposits.find({ farmerGroupId: g._id }, { sort: { createdAt: -1 } })); const as = await names(); const bs = Object.fromEntries((await col.batches.find({})).map((b) => [b._id, b]));
    const counted = deps.filter((d) => ['verified', 'auto_accepted'].includes(d.status)); const sum = (a) => D.round(a.reduce((s, d) => s + d.weightKg, 0), 1);
    const byMonth = {}; for (const d of counted) { const m = d.createdAt.slice(0, 7); byMonth[m] = D.round((byMonth[m] || 0) + d.weightKg, 1); }
    const rows = deps.slice(0, 100).map((d) => ({ _id: d._id, at: d.createdAt, capturedAt: d.capturedAt || null, weightKg: d.weightKg, notaNo: d.notaNo, status: d.status, pengepul: as[d.actorId]?.name, batchCode: bs[d.batchId]?.code, rejectReason: d.rejectReason || null, weightSource: d.weightSource || 'manual', notaPhoto: d.notaPhoto, scalePhoto: d.scalePhoto }));
    return { group: { name: g.name, ketua: g.ketua, village: g.village, district: g.district, hectares: g.hectares, active: g.active, pengepulTerhubung: (g.linkedActorIds || []).map((i) => as[i]?.name).filter(Boolean) },
      totals: { count: deps.length, countedKg: sum(counted), verifiedKg: sum(deps.filter((d) => d.status === 'verified')), autoKg: sum(deps.filter((d) => d.status === 'auto_accepted')), pendingKg: sum(deps.filter((d) => d.status === 'pending')), rejectedKg: sum(deps.filter((d) => d.status === 'rejected')) },
      byMonth: Object.entries(byMonth).sort().map(([month, kg]) => ({ month, kg })), deposits: rows, disputes: rows.filter((r) => r.status === 'rejected' || r.status === 'pending'),
      definitions: { contribution: 'Total kontribusi = jumlah berat setoran berstatus diverifikasi atau diterima otomatis, dikelompokkan menurut bulan pencatatan (UTC).', payment: 'Pembayaran belum terintegrasi. Halaman ini tidak menampilkan nilai uang.', dispute: 'Sengketa = setoran ditolak admin atau masih menunggu verifikasi.' } };
  });

  // ================= KUNCI API MITRA =================
  const SCOPES = { 'batches:read': ACTOR_ROLES, 'transfers:read': ACTOR_ROLES, 'logistics:update': ['logistik'], 'scale:write': ['pengepul', 'gudang'] };
  const pubKey = (k) => ({ _id: k._id, name: k.name, prefix: k.prefix, scopes: k.scopes, actorId: k.actorId, active: k.active, createdAt: k.createdAt, expiresAt: k.expiresAt, lastUsed: k.lastUsed || null });
  add('GET', '/api/integrations/keys', async (c) => { need(c, ['admin']); const as = await names(); return { scopes: Object.keys(SCOPES), keys: (await col.apiKeys.find({}, { sort: { createdAt: -1 } })).map((k) => ({ ...pubKey(k), actorName: as[k.actorId]?.name })) }; });
  add('POST', '/api/integrations/keys', async (c) => {
    need(c, ['admin'], true); const b = c.body; const name = String(b.name || '').trim(); if (name.length < 3) throw bad('Nama kunci minimal 3 karakter');
    const scopes = [...new Set(Array.isArray(b.scopes) ? b.scopes : [])]; if (!scopes.length || scopes.some((s) => !SCOPES[s])) throw bad('Scope tidak valid');
    const a = await col.actors.findOne({ _id: b.actorId }); if (!a) throw bad('Pilih pelaku yang diwakili kunci ini');
    for (const s of scopes) if (!SCOPES[s].includes(a.role)) throw bad(`Scope ${s} tidak cocok untuk peran ${a.role}`);
    const days = Math.min(365, Math.max(1, +b.expiresDays || 90)); const secret = 'lpk_' + crypto.randomBytes(24).toString('base64url');
    const k = await col.apiKeys.insert({ name, keyHash: sha(secret), prefix: secret.slice(0, 8), scopes, actorId: a._id, active: true, createdAt: D.now(), createdBy: c.user.name, expiresAt: new Date(Date.now() + days * 864e5).toISOString() });
    await D.audit(c, 'apikey.buat', `${name} (${scopes.join(',')}) → ${a.name}`); return { ...pubKey(k), secret, note: 'Simpan sekarang. Kunci tidak akan ditampilkan lagi.' };
  });
  add('PUT', '/api/integrations/keys/:id', async (c) => { need(c, ['admin'], true); const k = await col.apiKeys.findOne({ _id: c.params.id }); if (!k) throw notFound('Kunci tidak ditemukan'); await col.apiKeys.update({ _id: k._id }, { active: !!c.body.active }); await D.audit(c, 'apikey.ubah', `${k.name} aktif=${!!c.body.active}`); return { ok: true }; });
  add('DELETE', '/api/integrations/keys/:id', async (c) => { need(c, ['admin'], true); const k = await col.apiKeys.findOne({ _id: c.params.id }); if (!k) throw notFound('Kunci tidak ditemukan'); await col.apiKeys.remove({ _id: k._id }); await D.audit(c, 'apikey.hapus', k.name); return { ok: true }; });

  // ---- autentikasi kunci API (header x-api-key), batas laju per kunci ----
  const keyLimiter = sec.createLimiter({ max: +process.env.PARTNER_RATE_PER_MIN || 120, windowMs: 60000 });
  async function partner(c, scope) {
    const raw = String(c.headers?.['x-api-key'] || ''); if (!raw) throw new D.HttpError(401, 'x-api-key diperlukan');
    const k = await col.apiKeys.findOne({ keyHash: sha(raw) }); if (!k || !k.active || (k.expiresAt && k.expiresAt < D.now())) throw new D.HttpError(401, 'Kunci API tidak valid, nonaktif, atau kedaluwarsa');
    if (!keyLimiter.hit(k._id)) throw new D.HttpError(429, 'Batas permintaan kunci API terlampaui');
    if (!k.scopes.includes(scope)) throw forbid(`Kunci ini tidak memiliki scope ${scope}`);
    const actor = await col.actors.findOne({ _id: k.actorId }); if (!actor) throw forbid('Pelaku untuk kunci ini tidak ada'); await col.apiKeys.update({ _id: k._id }, { lastUsed: D.now() });
    return { key: k, actor, ctx: { user: { _id: 'key_' + k._id, name: 'API: ' + k.name, role: actor.role }, role: actor.role, actor } };
  }
  // idempotensi untuk POST mitra (header Idempotency-Key)
  async function idem(c, key, fn) {
    const h = String(c.headers?.['idempotency-key'] || '').slice(0, 100); if (!h) return fn(); const kk = `${key._id}:${h}`; const bh = sha(JSON.stringify(c.body || {}));
    const hit = await col.idem.findOne({ key: kk }); if (hit) { if (hit.bodyHash !== bh) throw conflict('Idempotency-Key sudah dipakai untuk permintaan berbeda'); return { ...hit.response, idempotentReplay: true }; }
    const out = await fn(); await col.idem.insert({ key: kk, bodyHash: bh, response: out, at: D.now() }); return out;
  }
  const slimBatch = (b) => ({ code: b.code, kind: b.kind, commodity: b.commodity, weightKg: b.weightKg, status: b.status, createdAt: b.createdAt, hold: !!b.hold });
  add('GET', '/api/partner/batches', async (c) => { const { actor } = await partner(c, 'batches:read'); return (await col.batches.find({ ownerActorId: actor._id }, { sort: { createdAt: -1 }, limit: 200 })).map(slimBatch); }, { public: true });
  add('GET', '/api/partner/transfers', async (c) => {
    const { actor } = await partner(c, 'transfers:read'); const bs = Object.fromEntries((await col.batches.find({})).map((b) => [b._id, b]));
    return (await col.transfers.find({}, { sort: { sentAt: -1 } })).filter((t) => [t.fromActorId, t.toActorId, t.carrierActorId].includes(actor._id)).slice(0, 200).map((t) => ({ code: t.code, batch: bs[t.batchId]?.code, status: t.status, sentKg: t.sentKg, receivedKg: t.receivedKg ?? null, sentAt: t.sentAt, pickedAt: t.pickedAt || null, deliveredAt: t.deliveredAt || null, role: t.fromActorId === actor._id ? 'pengirim' : t.toActorId === actor._id ? 'penerima' : 'pengangkut' }));
  }, { public: true });
  add('POST', '/api/partner/transfers/:code/carrier', async (c) => {
    const { key, actor, ctx } = await partner(c, 'logistics:update'); const step = c.body.step; if (!['pickup', 'deliver'].includes(step)) throw bad('step harus pickup atau deliver');
    return idem(c, key, async () => {
      const t = await col.transfers.findOne({ code: c.params.code }); if (!t || t.carrierActorId !== actor._id) throw notFound('Kiriman tidak ditemukan untuk kunci ini');
      if (t.status !== 'in_transit') throw conflict('Kiriman tidak sedang dalam perjalanan'); if (step === 'pickup' && t.pickedAt) throw conflict('Sudah diambil'); if (step === 'deliver' && (!t.pickedAt || t.deliveredAt)) throw conflict(t.pickedAt ? 'Sudah diantar' : 'Belum diambil');
      await D.carrierStep(ctx, t._id, step); await D.audit(ctx, 'partner.logistik', `${t.code} ${step}`); return { ok: true, transfer: t.code, step };
    });
  }, { public: true });
  add('POST', '/api/partner/scale-readings', async (c) => {
    const { key, actor, ctx } = await partner(c, 'scale:write'); const b = c.body; const kg = +b.weightKg; if (!(kg > 0) || kg > 100000) throw bad('weightKg tidak valid');
    const deviceId = String(b.deviceId || '').trim(); if (!deviceId || deviceId.length > 60) throw bad('deviceId wajib (maks 60 karakter)');
    const at = b.at ? Date.parse(b.at) : Date.now(); if (!at || at > Date.now() + 60000 || at < Date.now() - 48 * 3600e3) throw bad('at harus ISO-8601 dan dalam 48 jam terakhir');
    return idem(c, key, async () => { const r = await col.deviceReadings.insert({ actorId: actor._id, deviceId, weightKg: kg, at: new Date(at).toISOString(), receivedAt: D.now(), keyId: key._id, used: false }); await D.audit(ctx, 'partner.timbangan', `${deviceId} ${kg} kg`); return { id: r._id, weightKg: kg, deviceId, at: r.at, note: 'Gunakan id ini sebagai deviceReadingId saat mencatat setoran/giling. Berat harus cocok dalam 0,5%.' }; });
  }, { public: true });
  add('GET', '/api/scale-readings', async (c) => { need(c, ['pengepul', 'gudang']); return (await col.deviceReadings.find({ actorId: c.actor._id, used: false }, { sort: { at: -1 }, limit: 30 })).filter((r) => Date.now() - new Date(r.at) < 48 * 3600e3); });

  // ================= OPENAPI =================
  const sk = { ApiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } };
  const op = (summary, scope, extra = {}) => ({ summary, security: [{ ApiKey: [] }], 'x-required-scope': scope, responses: { 200: { description: 'OK' }, 401: { description: 'Kunci tidak valid' }, 403: { description: 'Scope kurang' }, 429: { description: 'Batas laju' } }, ...extra });
  const SPEC = {
    openapi: '3.0.3', info: { title: 'LestariPangan API', version: '1.0.0', description: 'API mitra dan publik. Prefix /api dan /api/v1 setara. Data prototipe adalah simulasi.' }, servers: [{ url: '/api' }], components: { securitySchemes: sk },
    paths: {
      '/health': { get: { summary: 'Cek kesehatan', responses: { 200: { description: 'OK' } } } },
      '/products/{code}/passport': { get: { summary: 'Digital Product Passport publik', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Paspor produk' }, 404: { description: 'Kode tidak ditemukan' } } } },
      '/partner/batches': { get: op('Daftar batch milik pelaku kunci', 'batches:read') },
      '/partner/transfers': { get: op('Transfer yang melibatkan pelaku kunci', 'transfers:read') },
      '/partner/transfers/{code}/carrier': { post: op('Catat pengambilan/pengantaran oleh pengangkut', 'logistics:update', { parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }, { name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['step'], properties: { step: { type: 'string', enum: ['pickup', 'deliver'] } } } } } } }) },
      '/partner/scale-readings': { post: op('Kirim pembacaan timbangan perangkat', 'scale:write', { parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['deviceId', 'weightKg'], properties: { deviceId: { type: 'string' }, weightKg: { type: 'number' }, at: { type: 'string', format: 'date-time' } } } } } } }) },
    },
  };
  add('GET', '/api/openapi.json', async () => SPEC, { public: true });
};
