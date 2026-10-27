const fs = require('fs'), path = require('path'), crypto = require('crypto');
const auth = require('./auth'); const qr = require('./qr'); const sec = require('./security');
const UP = path.join(require('./paths').DATA, 'uploads'); fs.mkdirSync(UP, { recursive: true });

module.exports = function build(D, A) {
  const { col, bad, forbid, notFound, conflict } = D; const R = [];
  const add = (method, p, fn, o = {}) => R.push({ method, re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, ...o });
  const ACTOR_ROLES = ['pengepul', 'gudang', 'distributor', 'logistik', 'retailer'];
  // izin: superadmin asli (tanpa act/view) memiliki fitur admin + pengawas
  function need(ctx, roles, write) {
    if (write && ctx.readOnly) throw forbid('Mode Lihat: hanya baca. Masuk Mode Tindak untuk bertindak.');
    const r = ctx.role; if (roles.includes(r)) return;
    if (r === 'superadmin' && roles.some((x) => ['admin', 'pengawas', 'superadmin'].includes(x))) return;
    throw forbid('Peran Anda tidak memiliki akses');
  }
  const names = async () => Object.fromEntries((await col.actors.find({})).map((a) => [a._id, a]));
  async function savePhoto(d) {
    if (!d) return null; const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(d); if (!m) throw bad('Format foto tidak valid');
    const buf = Buffer.from(m[2], 'base64'); if (buf.length > 2.5e6) throw bad('Foto terlalu besar (maks 2,5 MB)'); const real = sec.sniffImage(buf); if (!real) throw bad('Isi berkas bukan gambar yang valid'); m[1] = real;
    const id = crypto.randomBytes(10).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]); fs.writeFileSync(path.join(UP, id), buf); return '/uploads/' + id;
  }

  // ----- publik -----
  add('GET', '/api/public/trace/:code', async (c) => D.trace(decodeURIComponent(c.params.code)), { public: true });
  const loginLimiter = sec.createLimiter({ max: +process.env.LOGIN_MAX_FAILS || 5, windowMs: (+process.env.LOGIN_LOCK_MIN || 15) * 60000 });
  add('POST', '/api/login', async (c) => {
    const email = String(c.body.email || '').toLowerCase().trim(); const key = (c.ip || '?') + '|' + email;
    if (loginLimiter.blocked(key)) throw new D.HttpError(429, `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(loginLimiter.retryAfter(key) / 60)} menit.`);
    const u = await col.users.findOne({ email });
    if (!u || !u.active || !auth.checkPassword(String(c.body.password || ''), u.passwordHash)) { loginLimiter.hit(key); throw new D.HttpError(401, 'Email atau kata sandi salah'); }
    loginLimiter.clear(key); await col.users.update({ _id: u._id }, { lastLogin: D.now() });
    await D.audit({ user: u }, 'login', u.email); return { token: auth.sign({ uid: u._id, sv: u.sv || 0 }, 12 * 3600), user: pubUser(u) };
  }, { public: true });
  add('GET', '/api/health', async () => ({ ok: true, store: A.storeKind, uptimeSec: Math.round(process.uptime()), time: D.now() }), { public: true });
  add('POST', '/api/logout', async (c) => { await col.users.update({ _id: c.user._id }, { sv: (c.user.sv || 0) + 1 }); await D.audit(c, 'logout', c.user.email); return { ok: true }; });
  add('POST', '/api/me/password', async (c) => {
    const b = c.body; if (!auth.checkPassword(String(b.current || ''), c.user.passwordHash)) throw bad('Kata sandi saat ini salah');
    const issue = sec.passwordIssue(b.next); if (issue) throw bad(issue); if (b.next === b.current) throw bad('Kata sandi baru harus berbeda');
    const sv = (c.user.sv || 0) + 1; await col.users.update({ _id: c.user._id }, { passwordHash: auth.hashPassword(String(b.next)), sv });
    await D.audit(c, 'sandi.ganti', c.user.email); return { token: auth.sign({ uid: c.user._id, sv }, 12 * 3600) };
  });
  add('POST', '/api/register', async (c) => {
    const b = c.body; const code = await col.referralCodes.findOne({ code: String(b.code || '').trim().toUpperCase() });
    if (!code || !code.active || (code.expiresAt && code.expiresAt < D.now()) || code.uses >= code.maxUses) throw bad('Kode referral tidak valid, kedaluwarsa, atau sudah habis dipakai');
    if (!b.email || !b.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email))) throw bad('Nama dan email yang valid wajib'); { const issue = sec.passwordIssue(b.password); if (issue) throw bad(issue); }
    if (await col.users.findOne({ email: b.email.toLowerCase() })) throw conflict('Email sudah terdaftar');
    const actor = await col.actors.insert({ name: b.name, role: code.role, district: b.district || '', lat: +b.lat || -6.6, lng: +b.lng || 107.6, createdAt: D.now() });
    const u = await col.users.insert({ email: b.email.toLowerCase(), passwordHash: auth.hashPassword(b.password), name: b.name, role: code.role, actorId: actor._id, active: true });
    await col.referralCodes.update({ _id: code._id }, { uses: code.uses + 1 });
    await D.audit({ user: u }, 'registrasi', `${u.email} (${code.code})`);
    await D.notify({ toRole: 'admin', text: `Akun baru ${u.name} (${u.role}) mendaftar dengan kode ${code.code}. Hubungkan ke kelompok tani bila pengepul.` });
    return { ok: true };
  }, { public: true });
  const pubUser = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, actorId: u.actorId });

  // ----- sesi -----
  add('GET', '/api/me', async (c) => ({ user: pubUser(c.user), role: c.role, actor: c.actor, act: c.act ? { role: c.act.role, actorId: c.act.actorId, reason: c.act.reason, exp: c.act.exp } : null, readOnly: !!c.readOnly, config: await D.cfg(), store: A.storeKind, network: require('./ledger').network, ai: process.env.ANTHROPIC_API_KEY ? 'claude' : 'rules' }));
  add('GET', '/api/actors', async (c) => { const f = c.query.role ? { role: c.query.role } : {}; return (await col.actors.find(f)).map((a) => ({ _id: a._id, name: a.name, role: a.role, district: a.district, lat: a.lat, lng: a.lng })); });

  // ----- super admin -----
  add('GET', '/api/sa/actors', async (c) => { if (c.user.role !== 'superadmin') throw forbid('Khusus super admin'); return col.actors.find({}); });
  add('POST', '/api/sa/view', async (c) => { if (c.user.role !== 'superadmin') throw forbid('Khusus super admin'); const a = await col.actors.findOne({ _id: c.body.actorId }); if (!a) throw notFound('Pelaku tidak ditemukan'); await D.audit(c, 'mode_lihat', `${a.name} (${a.role})`); return { ok: true }; });
  add('POST', '/api/sa/act', async (c) => {
    if (c.user.role !== 'superadmin') throw forbid('Khusus super admin'); const b = c.body;
    const a = await col.actors.findOne({ _id: b.actorId }); if (!a) throw notFound('Pelaku sasaran tidak ditemukan');
    if (!b.reason || String(b.reason).trim().length < 10) throw bad('Alasan wajib diisi (min. 10 karakter)');
    if (!auth.checkPassword(String(b.password || ''), c.user.passwordHash)) throw forbid('Konfirmasi kata sandi salah');
    const ttl = 15 * 60; const token = auth.sign({ uid: c.user._id, act: { role: a.role, actorId: a._id, reason: String(b.reason).trim() } }, ttl);
    await D.audit(c, 'mode_tindak.mulai', `${a.name} (${a.role}) — ${b.reason}`); await D.notify({ toActorId: a._id, text: `Administrator (${c.user.name}) bertindak atas nama Anda: ${b.reason}` });
    return { token, expiresInSec: ttl, actor: a };
  });

  // ----- master: kelompok tani & referral -----
  add('GET', '/api/groups', async (c) => { let g = await col.farmerGroups.find({}); if (ACTOR_ROLES.includes(c.role)) g = g.filter((x) => x.active && (x.linkedActorIds || []).includes(c.actor?._id)); return g.map(D.publicGroup); });
  add('POST', '/api/groups', async (c) => { need(c, ['admin'], true); return D.createGroup(c, c.body); });
  add('PUT', '/api/groups/:id', async (c) => { need(c, ['admin'], true); const b = c.body, p = {}; for (const k of ['name', 'ketua', 'district', 'village', 'hectares', 'avgWeightKg', 'lat', 'lng']) if (k in b) p[k] = ['hectares', 'avgWeightKg', 'lat', 'lng'].includes(k) ? +b[k] : b[k]; if ('active' in b) p.active = !!b.active; if (Array.isArray(b.linkedActorIds)) p.linkedActorIds = b.linkedActorIds; await col.farmerGroups.update({ _id: c.params.id }, p); await D.audit(c, 'kelompok_tani.ubah', c.params.id); return { ok: true }; });
  add('POST', '/api/groups/:id/rotate', async (c) => { need(c, ['admin'], true); return D.rotateGroupCode(c, c.params.id); });
  add('GET', '/api/referrals', async (c) => { need(c, ['admin']); return col.referralCodes.find({}, { sort: { createdAt: -1 } }); });
  add('POST', '/api/referrals', async (c) => { need(c, ['admin'], true); const b = c.body; if (![...ACTOR_ROLES].includes(b.role)) throw bad('Peran tidak valid'); const code = (b.code || `${b.role.slice(0, 3)}-${crypto.randomInt(10000, 99999)}`).toUpperCase(); if (await col.referralCodes.findOne({ code })) throw conflict('Kode sudah ada'); const r = await col.referralCodes.insert({ code, role: b.role, note: b.note || '', maxUses: +b.maxUses || 1, uses: 0, expiresAt: b.expiresAt || null, active: true, createdAt: D.now() }); await D.audit(c, 'referral.buat', code); return r; });
  add('PUT', '/api/referrals/:id', async (c) => { need(c, ['admin'], true); const p = {}; for (const k of ['note', 'maxUses', 'expiresAt', 'active']) if (k in c.body) p[k] = c.body[k]; await col.referralCodes.update({ _id: c.params.id }, p); await D.audit(c, 'referral.ubah', c.params.id); return { ok: true }; });
  add('DELETE', '/api/referrals/:id', async (c) => { need(c, ['admin'], true); await col.referralCodes.remove({ _id: c.params.id }); await D.audit(c, 'referral.hapus', c.params.id); return { ok: true }; });

  // ----- QR label & setoran -----
  add('GET', '/api/labels', async (c) => { need(c, ['pengepul']); const l = await col.qrLabels.find({ ownerActorId: c.actor._id }, { sort: { createdAt: -1 } }); const cf = await D.cfg(); return { labels: l, quota: cf.qrQuotaPerPeriod, used: l.filter((x) => x.period === D.now().slice(0, 7)).length }; });
  add('POST', '/api/labels', async (c) => { need(c, ['pengepul'], true); return D.issueLabels(c, c.body.n); });
  add('POST', '/api/deposits', async (c) => { need(c, ['pengepul'], true); const b = { ...c.body }; b.notaPhoto = await savePhoto(b.notaPhoto); b.scalePhoto = await savePhoto(b.scalePhoto); return D.createDeposit(c, b); });
  add('GET', '/api/deposits', async (c) => {
    need(c, [...ACTOR_ROLES, 'admin', 'pengawas']); const f = c.role === 'pengepul' ? { actorId: c.actor._id } : {}; if (c.query.status) f.status = c.query.status;
    const [ds, gs, as, bs] = [await col.deposits.find(f, { sort: { createdAt: -1 } }), await col.farmerGroups.find({}), await names(), await col.batches.find({})];
    return ds.map((d) => ({ ...d, groupName: gs.find((g) => g._id === d.farmerGroupId)?.name, pengepulName: as[d.actorId]?.name, batchCode: bs.find((b) => b._id === d.batchId)?.code, qrCode: bs.find((b) => b._id === d.batchId)?.qrCode }));
  });
  add('GET', '/api/verifications', async (c) => {
    need(c, ['admin', 'pengawas']); const cf = await D.cfg(); const [ds, gs, as, bs] = [await col.deposits.find({ status: 'pending' }, { sort: { createdAt: 1 } }), await col.farmerGroups.find({}), await names(), await col.batches.find({})];
    const out = []; for (const d of ds) { const g = gs.find((x) => x._id === d.farmerGroupId); const b = bs.find((x) => x._id === d.batchId); const age = (Date.now() - new Date(d.createdAt)) / 3600e3;
      out.push({ ...d, groupName: g?.name, pengepulName: as[d.actorId]?.name, batchCode: b?.code, avgWeightKg: g?.avgWeightKg, ageHours: D.round(age), slaLeftHours: D.round(cf.depositSlaHours - age), overdue: age > cf.depositSlaHours, checks: [{ ok: true, text: 'Kode ketua valid, pengepul terhubung' }, { ok: true, text: `Nomor nota unik (${d.notaNo})` }, { ok: !!(d.notaPhoto && d.scalePhoto), text: 'Foto timbangan dan nota lengkap' }, { ok: d.weightKg <= 2 * (g?.avgWeightKg || 1e9), text: d.weightKg <= 2 * (g?.avgWeightKg || 1e9) ? `Berat ${d.weightKg} kg wajar terhadap rata-rata kelompok (${g?.avgWeightKg} kg)` : `Berat ${d.weightKg} kg di atas 2× rata-rata kelompok (${g?.avgWeightKg} kg)` }] }); }
    return out;
  });
  add('POST', '/api/deposits/:id/decide', async (c) => { need(c, ['admin'], true); return D.decideDeposit(c, c.params.id, c.body.decision, c.body); });

  // ----- batch -----
  add('GET', '/api/batches', async (c) => {
    need(c, [...ACTOR_ROLES, 'admin', 'pengawas']); const f = ACTOR_ROLES.includes(c.role) ? { ownerActorId: c.actor._id } : {}; if (c.query.status) f.status = c.query.status; if (c.query.kind) f.kind = c.query.kind;
    const as = await names(); const gs = await col.farmerGroups.find({}); return (await col.batches.find(f, { sort: { createdAt: -1 } })).map((b) => ({ ...b, ownerName: as[b.ownerActorId]?.name, groupName: gs.find((g) => g._id === b.farmerGroupId)?.name }));
  });
  add('GET', '/api/batches/:id', async (c) => { need(c, [...ACTOR_ROLES, 'admin', 'pengawas']); const d = await D.batchDetail(c, c.params.id); d.owner = (await names())[d.batch.ownerActorId]?.name; return d; });
  add('POST', '/api/batches/merge', async (c) => { need(c, ['pengepul'], true); return D.mergeBatches(c, c.body.ids); });
  add('POST', '/api/batches/:id/store', async (c) => { need(c, ['gudang'], true); return D.storeBatch(c, c.params.id, c.body); });
  add('POST', '/api/batches/:id/process', async (c) => { need(c, ['gudang'], true); return D.processBatch(c, c.params.id, c.body); });
  add('POST', '/api/batches/:id/pack', async (c) => { need(c, ['gudang'], true); return D.packBatch(c, c.params.id, c.body); });

  // ----- transfer -----
  add('GET', '/api/transfers', async (c) => {
    need(c, [...ACTOR_ROLES, 'admin', 'pengawas']); let f = {}; const me = c.actor?._id; const box = c.query.box;
    if (box === 'in') f = { toActorId: me }; else if (box === 'out') f = { fromActorId: me }; else if (box === 'carrier') f = { carrierActorId: me }; else if (box === 'disputed') f = { status: 'disputed' };
    const as = await names(), bs = await col.batches.find({}); return (await col.transfers.find(f, { sort: { sentAt: -1 } })).map((t) => ({ ...t, from: as[t.fromActorId]?.name, to: as[t.toActorId]?.name, carrier: as[t.carrierActorId]?.name, batchCode: bs.find((b) => b._id === t.batchId)?.code, commodity: bs.find((b) => b._id === t.batchId)?.commodity, hours: D.round((Date.now() - new Date(t.sentAt)) / 3600e3) }));
  });
  add('POST', '/api/transfers', async (c) => { need(c, ['pengepul', 'gudang', 'distributor'], true); return D.sendTransfer(c, c.body); });
  add('POST', '/api/transfers/:id/confirm', async (c) => { need(c, ['gudang', 'distributor', 'retailer'], true); return D.confirmTransfer(c, c.params.id, c.body.receivedKg); });
  add('POST', '/api/transfers/:id/resolve', async (c) => { need(c, ['admin'], true); return D.resolveDispute(c, c.params.id, c.body.decision, c.body.note); });
  add('POST', '/api/transfers/:id/carrier', async (c) => { need(c, ['logistik'], true); return D.carrierStep(c, c.params.id, c.body.step); });

  // ----- pengawasan -----
  add('GET', '/api/dashboard', async (c) => {
    need(c, ['admin', 'pengawas']); const m = await A.metrics(); const gs = await col.farmerGroups.find({ active: true }); const as = (await col.actors.find({})).filter((a) => ['pengepul', 'gudang', 'distributor', 'retailer'].includes(a.role));
    const an = await col.anomalies.find({}, { sort: { at: -1 } }); const bad = new Set(an.filter((x) => !x.resolved && x.actorId).map((x) => x.actorId));
    const points = [...gs.map((g) => ({ name: g.name, type: 'kelompok_tani', lat: g.lat, lng: g.lng, district: g.district })), ...as.map((a) => ({ name: a.name, type: a.role, lat: a.lat, lng: a.lng, district: a.district, flagged: bad.has(a._id) }))];
    const trfs = (await col.transfers.find({ status: 'in_transit' })).filter((t) => Date.now() - new Date(t.sentAt) > 48 * 3600e3);
    const names2 = await names(); const virtual = trfs.map((t) => ({ type: 'transfer_menggantung', severity: 'sedang', text: `Transfer ${t.code} menggantung ${D.round((Date.now() - new Date(t.sentAt)) / 3600e3, 0)} jam (${names2[t.fromActorId]?.name} → ${names2[t.toActorId]?.name})`, at: t.sentAt }));
    return { metrics: m, points, anomalies: [...virtual, ...an].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12), report: await A.latest() };
  });
  add('POST', '/api/analytics/run', async (c) => { need(c, ['admin', 'pengawas'], true); return A.run(); });
  add('GET', '/api/audit', async (c) => { need(c, ['admin', 'pengawas']); const lim = Math.min(500, Math.max(1, +c.query.limit || 200)), off = Math.max(0, +c.query.offset || 0); const all = await col.auditLogs.find({}, { sort: { at: -1 }, limit: off + lim }); return all.slice(off); });
  add('GET', '/api/events', async (c) => { need(c, ['admin', 'pengawas']); const f = c.query.batchId ? { batchId: c.query.batchId } : {}; return (await col.events.find(f, { sort: { at: -1 }, limit: 100 })); });
  add('GET', '/api/config', async (c) => { need(c, ['admin', 'pengawas']); return D.cfg(); });
  add('PUT', '/api/config', async (c) => { need(c, ['admin'], true); const p = {}; for (const k of ['tolerancePct', 'depositSlaHours', 'samplingRate', 'qrQuotaPerPeriod', 'yieldAlertPct', 'hangingHours']) if (k in c.body) { const v = +c.body[k]; if (!(v >= 0)) throw bad(`${k} tidak valid`); p[k] = v; } if (['manual', 'smtp'].includes(c.body.notifierMode)) p.notifierMode = c.body.notifierMode; await D.cfg(); await col.appConfig.update({ _id: 'cfg' }, p); await D.audit(c, 'konfigurasi.ubah', JSON.stringify(p)); return D.cfg(); });
  add('GET', '/api/notifications', async (c) => { const f = []; const all = await col.notifications.find({}, { sort: { at: -1 }, limit: 200 }); return all.filter((n) => (n.toActorId && n.toActorId === c.actor?._id) || (n.toRole && (n.toRole === c.role || (c.role === 'superadmin' && n.toRole === 'admin')))).slice(0, 30); });
  add('POST', '/api/notifications/read', async (c) => { for (const n of await col.notifications.find({ read: false })) if ((n.toActorId && n.toActorId === c.actor?._id) || (n.toRole && n.toRole === c.role)) await col.notifications.update({ _id: n._id }, { read: true }); return { ok: true }; });

  // ----- integritas -----
  add('GET', '/api/integrity', async (c) => { need(c, ['admin', 'pengawas']); const i = await D.integrity(); const ob = await col.outbox.find({}); return { ...i, outbox: { pending: ob.filter((o) => o.status === 'pending').length, failed: ob.filter((o) => o.status === 'failed').length, done: ob.filter((o) => o.status === 'done').length }, demo: process.env.DEMO_MODE !== '0' }; });
  add('POST', '/api/outbox/run', async (c) => { need(c, ['admin'], true); for (const o of await col.outbox.find({ status: 'failed' })) await col.outbox.update({ _id: o._id }, { status: 'pending', attempts: 0 }); return { processed: await D.processOutbox() }; });
  add('POST', '/api/integrity/tamper', async (c) => { need(c, ['admin'], true); if (process.env.DEMO_MODE === '0') throw forbid('Dinonaktifkan'); const e = await col.events.findOne({ _id: c.body.eventId }); if (!e || !e.payload) throw notFound('Event tidak ada'); const k = Object.keys(e.payload).find((x) => typeof e.payload[x] === 'number'); if (!k) throw bad('Event tanpa angka'); const orig = e.__orig || JSON.parse(JSON.stringify(e.payload)); const p = { ...e.payload, [k]: e.payload[k] + 100 }; await col.events.update({ _id: e._id }, { payload: p, __orig: orig }); await D.audit(c, 'demo.tamper', e._id); return { ok: true, field: k }; });
  add('POST', '/api/integrity/restore', async (c) => { need(c, ['admin'], true); for (const e of await col.events.find({})) if (e.__orig) await col.events.update({ _id: e._id }, { payload: e.__orig, __orig: null }); return { ok: true }; });

  // ----- manajemen pengguna (admin) -----
  const USER_ROLES = [...ACTOR_ROLES, 'admin', 'pengawas'];
  const pubU = (u, a) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, active: u.active !== false, actorId: u.actorId, district: a?.district || '', lastLogin: u.lastLogin || null });
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  async function userGuard(c, id) {
    const u = await col.users.findOne({ _id: id }); if (!u) throw notFound('Pengguna tidak ditemukan');
    if (u.role === 'superadmin') throw forbid('Akun super admin tidak bisa dikelola dari sini');
    if (c.user && c.user._id === u._id) throw forbid('Tidak bisa mengubah akun Anda sendiri dari sini');
    return u;
  }
  add('GET', '/api/users', async (c) => {
    need(c, ['admin']); const as = await names();
    return (await col.users.find({}, { sort: { name: 1 } })).filter((u) => u.role !== 'superadmin').map((u) => pubU(u, as[u.actorId]));
  });
  add('POST', '/api/users', async (c) => {
    need(c, ['admin'], true); const b = c.body;
    if (!USER_ROLES.includes(b.role)) throw bad('Peran tidak valid');
    const email = String(b.email || '').toLowerCase().trim();
    if (!b.name || !emailOk(email)) throw bad('Nama dan email yang valid wajib diisi');
    { const issue = sec.passwordIssue(b.password); if (issue) throw bad(issue); }
    if (await col.users.findOne({ email })) throw conflict('Email sudah terdaftar');
    let actor = null;
    if (ACTOR_ROLES.includes(b.role)) actor = await col.actors.insert({ name: b.name, role: b.role, district: b.district || '', lat: +b.lat || -6.6, lng: +b.lng || 107.6, createdAt: D.now() });
    const u = await col.users.insert({ email, passwordHash: auth.hashPassword(String(b.password)), name: b.name, role: b.role, actorId: actor?._id || null, active: true });
    await D.audit(c, 'pengguna.buat', `${email} (${b.role})`); return pubU(u, actor);
  });
  add('PUT', '/api/users/:id', async (c) => {
    need(c, ['admin'], true); const u = await userGuard(c, c.params.id); const b = c.body, p = {};
    if ('name' in b) { if (!String(b.name).trim()) throw bad('Nama wajib'); p.name = String(b.name).trim(); }
    if ('email' in b) { const e = String(b.email).toLowerCase().trim(); if (!emailOk(e)) throw bad('Email tidak valid'); const x = await col.users.findOne({ email: e }); if (x && x._id !== u._id) throw conflict('Email sudah terdaftar'); p.email = e; }
    if ('active' in b) p.active = !!b.active;
    if (b.password) { const issue = sec.passwordIssue(b.password); if (issue) throw bad(issue); p.passwordHash = auth.hashPassword(String(b.password)); p.sv = (u.sv || 0) + 1; }
    if ('active' in b && !b.active) p.sv = (u.sv || 0) + 1;
    if ('role' in b && b.role !== u.role) {
      if (!USER_ROLES.includes(b.role)) throw bad('Peran tidak valid');
      if (u.actorId) throw bad('Peran pelaku rantai pasok tidak bisa diubah karena sudah punya riwayat; nonaktifkan lalu buat akun baru');
      if (ACTOR_ROLES.includes(b.role)) throw bad('Peran internal tidak bisa diubah menjadi pelaku rantai pasok; buat akun baru');
      p.role = b.role;
    }
    if (u.actorId && ('name' in p || 'district' in b)) { const ap = {}; if (p.name) ap.name = p.name; if ('district' in b) ap.district = String(b.district || ''); await col.actors.update({ _id: u.actorId }, ap); }
    await col.users.update({ _id: u._id }, p);
    await D.audit(c, 'pengguna.ubah', `${u.email}: ${Object.keys(p).map((k) => (k === 'passwordHash' ? 'password' : k)).join(', ') || 'wilayah'}`);
    return { ok: true };
  });
  add('DELETE', '/api/users/:id', async (c) => {
    need(c, ['admin'], true); const u = await userGuard(c, c.params.id);
    if (u.actorId) {
      const used = (await col.batches.count({ ownerActorId: u.actorId })) + (await col.transfers.count({ fromActorId: u.actorId })) + (await col.transfers.count({ toActorId: u.actorId })) + (await col.deposits.count({ actorId: u.actorId }));
      if (used) throw conflict('Pengguna punya riwayat transaksi, jadi tidak bisa dihapus. Nonaktifkan saja agar jejak audit tetap utuh.');
      await col.actors.remove({ _id: u.actorId });
    }
    await col.users.remove({ _id: u._id }); await D.audit(c, 'pengguna.hapus', u.email); return { ok: true };
  });
  add('DELETE', '/api/groups/:id', async (c) => {
    need(c, ['admin'], true); const g = await col.farmerGroups.findOne({ _id: c.params.id }); if (!g) throw notFound('Kelompok tani tidak ditemukan');
    const dep = (await col.deposits.find({})).some((d) => d.farmerGroupId === g._id); if (dep) throw conflict('Kelompok tani sudah punya setoran. Nonaktifkan saja.');
    await col.farmerGroups.remove({ _id: g._id }); await D.audit(c, 'kelompok_tani.hapus', g.name); return { ok: true };
  });

  // ----- QR -----
  add('GET', '/api/qr', async (c) => ({ svg: qr.svg(c.query.text || '') }), { public: true });
  return R;
};
