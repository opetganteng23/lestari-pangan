process.env.LP_SKIP_DOTENV = '1'; // tes tidak boleh membaca .env pengguna
// Uji render layar: menjalankan SEMUA layar tiap peran terhadap server nyata dengan DOM tiruan.
// Menangkap galat runtime/templat (variabel tak terdefinisi, data tak terduga). Bukan pengganti uji visual di browser.
const os = require('os'), fs = require('fs'), path = require('path'), vm = require('vm');
process.env.LOG = '0'; process.env.LP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-ui-'));
const { start } = require('../server/index.js');
const dummy = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'value' ? '' : k === 'style' || k === 'dataset' ? {} : k === 'files' ? [] : k === 'length' ? 0 : k === 'forEach' ? () => {} : k === 'then' ? undefined : dummy()), set: () => true, apply: () => dummy() });
(async () => {
  const s = await start({ port: 0 }); const base = 'http://localhost:' + s.server.address().port; let fails = 0, ran = 0;
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const ctx = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, FormData, URL, URLSearchParams, crypto: require('crypto').webcrypto, Blob, TextEncoder, confirm: () => false, prompt: () => null, alert() {},
    fetch: (u, o) => fetch(String(u).startsWith('/') ? base + u : u, o), localStorage: store(), sessionStorage: store(), location: { hash: '', origin: base, pathname: '/', reload() {}, href: '' }, history: { back() {} }, navigator: { onLine: true }, indexedDB: undefined,
    document: { querySelector: () => dummy(), querySelectorAll: () => [], createElement: () => dummy(), body: dummy(), addEventListener() {} }, Image: function () {}, FileReader: function () {} };
  ctx.window = ctx; ctx.addEventListener = () => {}; vm.createContext(ctx);
  const files = ['core', 'auth', 'screens-actor', 'map', 'screens-admin', 'screens-ops', 'screens-server', 'screens-farmer', 'screens-predict', 'offline', 'screens-mfa', 'screens-common'];
  vm.runInContext(files.map((f) => fs.readFileSync(path.join(__dirname, '../public/js', f + '.js'), 'utf8')).join('\n;\n') + '\n;globalThis.__x = { S, NAV, navFor, NAV_IC, SEC_ORDER, secOf, ic, navHtml, api, ld, sd, ss, get me() { return me; }, set me(v) { me = v; } };', ctx, { filename: 'public/js/*.js' });
  const X = ctx.__x; const main = () => ({ innerHTML: '', querySelector: () => dummy(), querySelectorAll: () => [], insertAdjacentHTML() {} });
  const ACCTS = ['sa', 'admin', 'pengawas', 'pengepul1', 'gudang1', 'distributor', 'logistik', 'retailer', 'kelompok.sumber'];
  const caseId = async (tok) => { const r = await fetch(base + '/api/cases', { headers: { authorization: 'Bearer ' + tok } }); return (await r.json())[0]?._id; };
  for (const a of ACCTS) {
    const j = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: a + '@lestari.id', password: 'lestari123' }) })).json();
    ctx.localStorage.setItem('lp_token', JSON.stringify(j.token)); ctx.sessionStorage.removeItem('lp_act'); X.me = await X.api('/api/me'); const role = X.me.role;
    const routes = (X.NAV[role] || []).map((n) => [n[0], '']);
    if (['admin', 'sa'].includes(a)) { await fetch(base + '/api/cases', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + j.token }, body: JSON.stringify({ title: 'Kasus uji render', priority: 'tinggi' }) }); const cid = await caseId(j.token); if (cid) routes.push(['kasus', cid]); }
    if (['pengawas', 'sa', 'admin'].includes(a)) for (const tb of ['anomali', 'tren', 'tracelog']) routes.push(['dashboard', tb]);
    if (a === 'sa') routes.push(['mode-tindak', ''], ['mode-lihat', ''], ['mode', 'lihat']);
    if (a === 'gudang1' || a === 'sa') { const bs = await X.api('/api/batches').catch(() => []); if (bs[0]) routes.push(['detail', bs[0]._id]); }
    for (const [id, param] of routes) {
      const key = (role === 'superadmin' ? 'sa:' : '') + id; const fn = X.S[key] || X.S[id]; ran++;
      try { if (!fn) throw new Error('layar tidak terdaftar'); const m = main(); await fn(m, param); if (!m.innerHTML || /undefined|\[object Object\]|NaN/.test(m.innerHTML.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\bundefined\b(?=[^<]*<\/option>)/g, ''))) throw new Error('keluaran mencurigakan (kosong/undefined/NaN): ' + m.innerHTML.match(/.{0,50}(undefined|\[object Object\]|NaN).{0,40}/)?.[0]); }
      catch (e) { fails++; console.log(`  GAGAL ${a} (${role}) #/${id}${param ? '/…' : ''} → ${e.message}`); }
    }
    if (a === 'admin') for (const tab of ['monitor', 'twin']) { ran++; ctx.sessionStorage.setItem('lp_pf', JSON.stringify({ tab, scope: 'total' })); try { const m = main(); await X.S.prediksi(m); await new Promise((r) => setTimeout(r, 50)); if (!m.innerHTML) throw new Error('kosong'); } catch (e) { fails++; console.log('  GAGAL admin prediksi/' + tab + ' → ' + e.message); } }
    console.log(`  ok   ${a} (${role}): ${routes.length} layar`);
  }
  await (async () => { // gabungan menu + FEATURES
    ran++; try {
      const ids = (r) => (X.NAV[r] || []).map((n) => n[0]);
      for (const r of ['pengawas', 'superadmin']) for (const old of ['tracelog', 'anomali', 'tren']) if (ids(r).includes(old)) throw new Error(r + ' masih punya menu ' + old);
      if (!ids('superadmin').includes('mode') || ids('superadmin').includes('mode-tindak') || ids('superadmin').includes('mode-lihat')) throw new Error('Mode Tindak/Lihat belum digabung');
      X.me = { ...X.me, features: [] }; const off = X.navFor('admin').map((n) => n[0]); for (const f of ['prediksi', 'copilot', 'email', 'integrasi']) if (off.includes(f)) throw new Error('fitur ' + f + ' harus mati secara bawaan');
      for (const keep of ['server', 'kasus', 'risiko', 'neraca', 'laporan', 'verifikasi']) if (!off.includes(keep)) throw new Error('menu inti ' + keep + ' ikut tersaring');
      X.me = { ...X.me, features: ['prediksi', 'email'] }; const on = X.navFor('admin').map((n) => n[0]); if (!on.includes('prediksi') || !on.includes('email') || on.includes('copilot') || on.includes('integrasi')) throw new Error('penyaringan FEATURES tidak sesuai');
      if (X.navFor('pengepul').length !== X.NAV.pengepul.length) throw new Error('peran pelaku tidak boleh tersaring');
    } catch (e) { fails++; console.log('  GAGAL menu gabungan/FEATURES → ' + e.message); }
  })();
  { // ikon dan seksi menu: setiap menu punya ikon yang ada di sprite dan masuk satu seksi dikenal
    const sprite = fs.readFileSync(path.join(__dirname, '../public/assets/icons.svg'), 'utf8'); ran++;
    try {
      for (const [role, items] of Object.entries(X.NAV)) for (const n of items) { const ico = X.NAV_IC[n[0]]; if (!ico) throw new Error(role + '/' + n[0] + ': tanpa ikon'); if (!sprite.includes('id="i-' + ico + '"')) throw new Error(n[0] + ': ikon ' + ico + ' tidak ada di sprite'); if (!X.SEC_ORDER.includes(X.secOf(n[0], role))) throw new Error(n[0] + ': seksi tak dikenal'); }
      const h = X.navHtml(X.NAV.admin, 'admin', { pending: 3 }); if (!h.includes('<div class="nsec">Pengawasan</div>') || !h.includes('badge">3<')) throw new Error('navHtml tidak memuat seksi/badge'); if (h.includes('<i></i>')) throw new Error('masih ada kotak abu-abu');
      const pe = X.navHtml(X.NAV.pengepul, 'pengepul', {}); if (/nsec">(Pengawasan|Administrasi|Lanjutan)/.test(pe)) throw new Error('peran pelaku tidak boleh punya seksi pengawasan');
    } catch (e) { fails++; console.log('  GAGAL ikon/seksi menu → ' + e.message); }
  }
  await s.close(); console.log(fails ? `\n${fails} dari ${ran} layar gagal` : `\nSemua ${ran} layar terender tanpa galat`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
