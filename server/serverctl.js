// Kontrol & pemantauan server (dashboard "Server" untuk admin): gerbang layanan, batas AI, lalu lintas, kesehatan.
// Gerbang layanan hanya memblokir TULIS (POST/PUT/DELETE) oleh peran non-staf; baca tetap jalan. Staf (admin, super admin, pengawas) tidak terblokir.
const os = require('os');
const backup = require('./backup');

const WINDOW = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT = { enabled: true, message: '', window: '', aiEnabled: true, aiDailyLimit: 0 };
const STAFF = ['admin', 'superadmin', 'pengawas'];
const EXEMPT = [/^\/api\/login$/, /^\/api\/logout$/, /^\/api\/me\/password$/, /^\/api\/notifications\/read$/, /^\/api\/server\//];

module.exports = function createServerCtl(D, store) {
  const { col, bad } = D; const started = Date.now();
  let cache = null, cacheAt = 0;

  async function getGate() {
    if (cache && Date.now() - cacheAt < 5000) return cache;
    const d = await col.appConfig.findOne({ _id: 'gate' }); const { _id, ...rest } = d || {};
    cache = { ...DEFAULT, ...rest }; cacheAt = Date.now(); return cache;
  }
  const aiEnabledSync = () => (cache ? cache.aiEnabled !== false : true);

  function parse(b, prev) {
    const g = { ...prev };
    if ('enabled' in b) g.enabled = !!b.enabled;
    if ('aiEnabled' in b) g.aiEnabled = !!b.aiEnabled;
    if ('message' in b) { g.message = String(b.message || '').trim(); if (g.message.length > 200) throw bad('Pesan maksimal 200 karakter'); }
    if ('window' in b) {
      const w = String(b.window || '').trim(); const m = w ? WINDOW.exec(w) : null;
      if (w && !m) throw bad('Jam layanan harus berformat HH:MM-HH:MM, mis. 08:00-17:00'); if (m && m[1] + m[2] === m[3] + m[4]) throw bad('Jam mulai dan selesai tidak boleh sama'); g.window = w;
    }
    if ('aiDailyLimit' in b) { const n = Number(b.aiDailyLimit); if (!Number.isInteger(n) || n < 0 || n > 1000) throw bad('Batas AI harian harus bilangan bulat 0-1000 (0 = tanpa batas)'); g.aiDailyLimit = n; }
    return g;
  }
  async function setGate(ctx, b) {
    const prev = await getGate(); const g = parse(b || {}, prev);
    const row = await col.appConfig.findOne({ _id: 'gate' }); if (row) await col.appConfig.update({ _id: 'gate' }, g); else await col.appConfig.insert({ _id: 'gate', ...g });
    cache = null; await D.audit(ctx, 'server.gerbang', JSON.stringify(g)); return getGate();
  }
  function gateState(g, now = new Date()) {
    if (!g.enabled) return { open: false, reason: g.message || 'Pencatatan baru sedang dijeda oleh admin' };
    const m = WINDOW.exec(g.window || '');
    if (m) {
      const s = +m[1] * 60 + +m[2], e = +m[3] * 60 + +m[4], cur = now.getHours() * 60 + now.getMinutes(); const inside = s < e ? cur >= s && cur < e : cur >= s || cur < e;
      if (!inside) return { open: false, reason: g.message || `Pencatatan hanya tersedia pada ${g.window} (jam server)` };
    }
    return { open: true, reason: '' };
  }
  // Mengembalikan pesan bila permintaan harus ditolak, selain itu null.
  async function blockReason(method, p, userRole) {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return null; if (STAFF.includes(userRole)) return null; if (EXEMPT.some((r) => r.test(p))) return null;
    const st = gateState(await getGate()); return st.open ? null : st.reason;
  }

  // ---------- lalu lintas (memori proses) ----------
  const ring = []; let lastProxied = null; const errors = [];
  function record(e) {
    if (e.p === '/api/server/status') return; ring.push(e); const cut = Date.now() - 3600e3; while (ring.length && ring[0].t < cut) ring.shift(); if (ring.length > 20000) ring.shift();
    if (e.viaProxy) lastProxied = e.t;
    if (e.s >= 500) { errors.unshift({ at: new Date(e.t).toISOString(), rid: e.rid, m: e.m, p: e.p, s: e.s }); errors.length = Math.min(errors.length, 20); }
  }
  function traffic(minutes = 15) {
    const now = Date.now(), from = now - minutes * 60e3; const rs = ring.filter((r) => r.t >= from); const bins = Array.from({ length: minutes }, (_, i) => ({ t: new Date(from + i * 60e3).toISOString(), n: 0, err: 0 }));
    for (const r of rs) { const i = Math.min(minutes - 1, Math.floor((r.t - from) / 60e3)); bins[i].n++; if (r.s >= 500) bins[i].err++; }
    const ms = rs.map((r) => r.ms).sort((a, b) => a - b); const q = (p) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] : null);
    return { minutes, total: rs.length, c4xx: rs.filter((r) => r.s >= 400 && r.s < 500 && r.s !== 429).length, c5xx: rs.filter((r) => r.s >= 500).length, c429: rs.filter((r) => r.s === 429).length, blocked: rs.filter((r) => r.s === 503).length, p50: q(0.5), p95: q(0.95), bins };
  }

  // ---------- pemakaian AI ----------
  const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };
  async function aiUsage() {
    const since = midnight(); const logs = (await col.aiLogs.find({})).filter((l) => l.at >= since); const us = Object.fromEntries((await col.users.find({})).map((u) => [u._id, u]));
    const by = {}; for (const l of logs) { const k = l.userId; (by[k] ||= { name: us[k]?.name || '?', queries: 0, claude: 0 }); by[k].queries++; if (l.source === 'claude') by[k].claude++; }
    const rep = (await col.analyticsReports.find({})).filter((r) => r.at >= since && r.source === 'claude').length;
    const last = [...(await col.aiLogs.find({}, { sort: { at: -1 }, limit: 20 }))].find((l) => l.error);
    return { queriesToday: logs.length, claudeToday: logs.filter((l) => l.source === 'claude').length + rep, narratorToday: rep, byUser: Object.values(by).sort((a, b) => b.queries - a.queries).slice(0, 10), lastError: last ? { at: last.at, text: last.error } : null };
  }
  async function claudeCallsByUserToday(userId) { const since = midnight(); return (await col.aiLogs.find({ userId })).filter((l) => l.at >= since && l.source === 'claude').length; }
  // Dipakai Copilot: bolehkah memanggil Claude untuk pengguna ini sekarang? Bila tidak, jawaban aturan dipakai.
  async function aiAllowed(userId) {
    const g = await getGate(); if (g.aiEnabled === false) return { ok: false, why: 'AI dijeda oleh admin' };
    if (g.aiDailyLimit > 0 && (await claudeCallsByUserToday(userId)) >= g.aiDailyLimit) return { ok: false, why: `batas AI harian (${g.aiDailyLimit}) tercapai` };
    return { ok: true };
  }
  async function pingAi() {
    const key = process.env.ANTHROPIC_API_KEY; const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'; if (!key) return { ok: false, configured: false, text: 'ANTHROPIC_API_KEY belum diisi di .env backend' };
    const t0 = Date.now();
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'Balas: ok' }] }) });
      return { ok: r.ok, configured: true, model, status: r.status, ms: Date.now() - t0, text: r.ok ? 'Kunci diterima API' : r.status === 401 ? 'Kunci ditolak (401)' : r.status === 404 ? 'Model tidak dikenal (404)' : r.status === 429 ? 'Kena batas laju/kuota (429)' : `HTTP ${r.status}` };
    } catch (e) { return { ok: false, configured: true, model, ms: Date.now() - t0, text: 'Gagal menghubungi Anthropic: ' + e.message }; }
  }

  // ---------- status ----------
  let sizeCache = { at: 0, v: 0 };
  async function status() {
    const g = await getGate(); const gs = gateState(g); const mu = process.memoryUsage();
    if (Date.now() - sizeCache.at > 60000) sizeCache = { at: Date.now(), v: store.kind === 'MongoDB' ? null : backup.dirSize(require('./paths').DATA) };
    const ob = await col.outbox.find({}); const em = await col.emails.find({}); const led = require('./ledger/index'); const chain = await led.verifyChain();
    const bk = backup.list(); const cf = await D.cfg(); const key = process.env.ANTHROPIC_API_KEY;
    const checks = [
      { id: 'secret', ok: !!process.env.APP_SECRET && process.env.APP_SECRET.length >= 32, text: 'APP_SECRET terisi (>= 32 karakter)' },
      { id: 'publicUrl', ok: /^https:\/\/[^/\s]+$/.test(process.env.PUBLIC_URL || '') && !/NAMA-PROYEK/.test(process.env.PUBLIC_URL || ''), text: 'PUBLIC_URL berisi alamat situs publik (untuk QR kemasan)' },
      { id: 'host', ok: process.env.HOST === '127.0.0.1', text: 'HOST = 127.0.0.1 (hanya terjangkau lewat tunnel)' },
      { id: 'proxy', ok: process.env.TRUST_PROXY === '1', text: 'TRUST_PROXY = 1' },
      { id: 'demo', ok: process.env.SEED_DEMO === '0', text: 'Akun demo tidak aktif (SEED_DEMO=0)', soft: true },
      { id: 'tamper', ok: process.env.DEMO_MODE === '0', text: 'Alat ubah-data-event mati (DEMO_MODE=0)', soft: true },
      { id: 'backup', ok: !!bk.items[0] && Date.now() - Date.parse(bk.items[0].at) < 7 * 864e5, text: 'Ada cadangan dalam 7 hari terakhir', soft: true },
    ];
    return {
      time: D.now(), uptimeSec: Math.round((Date.now() - started) / 1000), node: process.version, pid: process.pid, host: process.env.HOST || 'semua antarmuka', port: process.env.PORT || null, publicUrl: process.env.PUBLIC_URL || null,
      store: { kind: store.kind, dataBytes: sizeCache.v }, memory: { rssMB: Math.round(mu.rss / 1048576), heapMB: Math.round(mu.heapUsed / 1048576), osFreeMB: Math.round(os.freemem() / 1048576), osTotalMB: Math.round(os.totalmem() / 1048576) },
      gate: { ...g, ...gs, now: new Date().toTimeString().slice(0, 5) },
      ai: { configured: !!key, model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', enabled: g.aiEnabled !== false, dailyLimit: g.aiDailyLimit || 0, perMinuteLimit: +process.env.AI_RATE_PER_MIN || 20, ...(await aiUsage()) },
      email: { mode: cf.notifierMode, pending: em.filter((e) => e.status === 'pending').length, sent: em.filter((e) => e.status === 'sent').length, dead: em.filter((e) => e.status === 'dead').length },
      outbox: { pending: ob.filter((o) => o.status === 'pending').length, failed: ob.filter((o) => o.status === 'failed').length, done: ob.filter((o) => o.status === 'done').length },
      ledger: { network: led.network, simulated: !!led.simulated, chainOk: !!chain.ok, blocks: chain.blocks ?? null },
      traffic: traffic(15), proxy: { lastAt: lastProxied ? new Date(lastProxied).toISOString() : null, secondsAgo: lastProxied ? Math.round((Date.now() - lastProxied) / 1000) : null },
      recentErrors: errors.slice(0, 8), backups: { dir: bk.dir, latest: bk.items[0] || null, items: bk.items, note: store.kind === 'MongoDB' ? 'Cadangan ini hanya berkas; basis data MongoDB perlu mongodump' : null },
      counts: { users: await col.users.count({}), batches: await col.batches.count({}), deposits: await col.deposits.count({}), events: await col.events.count({}), cases: await col.cases.count({}) }, checks,
    };
  }
  return { getGate, setGate, gateState, blockReason, aiAllowed, aiEnabledSync, pingAi, status, record, traffic, backup };
};
