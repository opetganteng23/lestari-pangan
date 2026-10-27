const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const { openStore } = require('./store'); const auth = require('./auth'); const qr = require('./qr');
const sec = require('./security'); const createDomain = require('./domain'); const createAnalytics = require('./analytics'); const buildRoutes = require('./routes');
const PUB = path.join(__dirname, '..', 'public'), DATA = require('./paths').DATA;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };

async function start({ port = +process.env.PORT || 3000, dataDir = DATA, seed = true } = {}) {
  const store = await openStore(dataDir); const D = createDomain(store); const A = createAnalytics(D); A.storeKind = store.kind;
  if (seed && (await store.isEmpty())) { await require('./seed')(D); console.log('Data simulasi dimuat.'); }
  D.prov = require('./provenance')(D); const routes = buildRoutes(D, A);
  const signDeep = (v) => (typeof v === 'string' ? (v.startsWith('/uploads/') && !v.includes('?') ? auth.signUrl(v) : v) : Array.isArray(v) ? v.map(signDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, signDeep(x)])) : v); const apiLimiter = sec.createLimiter({ max: +process.env.RATE_LIMIT_PER_MIN || 600, windowMs: 60000 }); const TRUST = process.env.TRUST_PROXY === '1';
  const clientIp = (req) => (TRUST && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
  const send = (res, code, body, headers = {}) => { const b = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body); res.writeHead(code, { 'content-type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain', ...headers }); res.end(b); };
  async function readBody(req) { const ch = []; let n = 0; for await (const c of req) { n += c.length; if (n > 8e6) throw new D.HttpError(413, 'Permintaan terlalu besar'); ch.push(c); } const s = Buffer.concat(ch).toString(); return s ? JSON.parse(s) : {}; }
  async function buildCtx(req) {
    const h = req.headers; const tok = (h.authorization || '').replace(/^Bearer /, ''); const p = auth.verify(tok); if (!p) throw new D.HttpError(401, 'Sesi berakhir, silakan masuk lagi');
    const user = await D.col.users.findOne({ _id: p.uid }); if (!user || !user.active) throw new D.HttpError(401, 'Akun tidak aktif');
    if ((p.sv || 0) !== (user.sv || 0)) throw new D.HttpError(401, 'Sesi sudah dicabut, silakan masuk lagi');
    const ctx = { user, role: user.role, actor: user.actorId ? await D.col.actors.findOne({ _id: user.actorId }) : null };
    if (user.role === 'superadmin') {
      const at = h['x-act-token'] && auth.verify(h['x-act-token']); const view = h['x-view-as'];
      if (at && at.uid === user._id) { ctx.act = { ...at.act, exp: at.exp }; ctx.actor = await D.col.actors.findOne({ _id: at.act.actorId }); ctx.role = ctx.actor.role; }
      else if (view) { ctx.actor = await D.col.actors.findOne({ _id: view }); if (ctx.actor) { ctx.role = ctx.actor.role; ctx.readOnly = true; } }
    }
    return ctx;
  }
  const server = http.createServer(async (req, res) => {
    const u = url.parse(req.url, true); let p = decodeURIComponent(u.pathname).replace('/api/v1/', '/api/'); const rid = sec.reqId(), t0 = Date.now(), ip = clientIp(req);
    for (const [k, v] of Object.entries(sec.securityHeaders(req))) res.setHeader(k, v); res.setHeader('x-request-id', rid);
    if (process.env.LOG !== '0') res.on('finish', () => console.log(JSON.stringify({ t: new Date().toISOString(), rid, ip, m: req.method, p, s: res.statusCode, ms: Date.now() - t0 })));
    try {
      if (p.startsWith('/api/')) {
        if (!apiLimiter.hit(ip)) return send(res, 429, { error: 'Terlalu banyak permintaan, coba lagi sebentar' }, { 'retry-after': String(apiLimiter.retryAfter(ip)) });
        for (const r of routes) {
          if (r.method !== req.method) continue; const m = r.re.exec(p); if (!m) continue;
          const ctx = r.public ? {} : await buildCtx(req); ctx.ip = ip; ctx.params = m.groups || {}; ctx.query = u.query; ctx.body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
          const out = (await r.fn(ctx)) ?? { ok: true }; return send(res, 200, r.public ? out : signDeep(out));
        }
        return send(res, 404, { error: 'Endpoint tidak ditemukan' });
      }
      const mq = /^\/qr\/(.+)\.svg$/.exec(p); if (mq) { const base = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`; const t = decodeURIComponent(mq[1]); return send(res, 200, qr.svg(t.startsWith('LP-PKG') || t.startsWith('LP-BATCH') || t.startsWith('LP-QR') ? `${base}/t/${t}` : t), { 'content-type': 'image/svg+xml', 'cache-control': 'public,max-age=3600' }); }
      if (p.startsWith('/uploads/')) { if (!auth.verifyUrl(p, u.query.e, u.query.s)) return send(res, 403, { error: 'Tautan bukti tidak valid atau kedaluwarsa' }); const f = path.join(DATA, 'uploads', path.basename(p)); if (fs.existsSync(f)) return send(res, 200, fs.readFileSync(f), { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); return send(res, 404, 'Tidak ada'); }
      if (p.startsWith('/t/')) return send(res, 200, fs.readFileSync(path.join(PUB, 'trace.html')), { 'content-type': MIME['.html'] });
      let f = path.join(PUB, p === '/' ? 'index.html' : p); if (!f.startsWith(PUB)) return send(res, 403, 'Dilarang');
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUB, 'index.html');
      return send(res, 200, fs.readFileSync(f), { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': f.includes('fonts') || f.includes('img') ? 'public,max-age=86400' : 'no-cache' });
    } catch (e) {
      const code = e.status || (e instanceof SyntaxError ? 400 : 500); if (code === 500) console.error(e);
      send(res, code, { error: code === 500 ? 'Terjadi kesalahan di server' : e.message });
    }
  });
  await new Promise((r) => server.listen(port, r));
  const timer = setInterval(() => D.processOutbox().catch(() => {}), 30000); timer.unref();
  console.log(`LestariPangan berjalan di http://localhost:${server.address().port}  · data: ${store.kind}`);
  return { server, D, store, close: () => new Promise((r) => { clearInterval(timer); store.flush(); server.close(r); }) };
}
module.exports = { start };
if (require.main === module) start().catch((e) => { console.error(e); process.exit(1); });
