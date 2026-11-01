process.env.LP_SKIP_DOTENV = '1';
// Uji lupa/reset kata sandi dan rute halaman. Jalankan: node test/auth.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert');
process.env.LOG = '0'; process.env.LP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-auth-')); process.env.PUBLIC_URL = 'https://contoh.vercel.app';
const { start } = require('../server/index.js');
(async () => {
  const s = await start({ port: 0 }); const base = 'http://localhost:' + s.server.address().port; let fails = 0;
  const call = async (p, { method = 'GET', body, token } = {}) => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
  const login = async (e, pw = 'lestari123') => (await call('/api/login', { method: 'POST', body: { email: e, password: pw } }));
  const t = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
  const admin = (await login('admin@lestari.id')).j.token; const sent = []; s.D.mailer = { send: async (m) => { sent.push(m); } };

  await t('halaman: / = landing, /app = aplikasi, /t/ = konsumen', async () => {
    const a = await (await fetch(base + '/')).text(), b = await (await fetch(base + '/app')).text();
    assert.ok(a.includes('id="landing"'), 'beranda adalah landing'); assert.ok(b.includes('id="root"') && !b.includes('id="landing"'), '/app adalah aplikasi');
    assert.strictEqual((await fetch(base + '/t/LP-PKG-2026-0211')).status, 200); assert.ok((await (await fetch(base + '/app/')).text()).includes('id="root"'));
  });
  await t('lupa sandi: jawaban sama untuk email terdaftar dan tidak, tanpa membocorkan token', async () => {
    const a = await call('/api/password/forgot', { method: 'POST', body: { email: 'pengepul1@lestari.id' } }), b = await call('/api/password/forgot', { method: 'POST', body: { email: 'tidakada@x.id' } });
    assert.strictEqual(a.status, 200); assert.deepStrictEqual(a.j, b.j); assert.ok(!JSON.stringify(a.j).includes('reset/'));
    assert.strictEqual((await call('/api/password/forgot', { method: 'POST', body: { email: 'bukan-email' } })).status, 400);
    const ns = (await call('/api/notifications', { token: admin })).j; assert.ok(ns.some((n) => n.text.includes('reset kata sandi untuk pengepul1@')) && !ns.some((n) => /reset\/[\w-]{20,}/.test(n.text)));
  });
  await t('tanpa SMTP tidak ada email terkirim; dengan SMTP tautan reset dikirim ke pemilik', async () => {
    assert.strictEqual((await s.D.col.emails.find({})).filter((e) => e.subject.includes('Reset')).length, 0);
    await call('/api/config', { method: 'PUT', token: admin, body: { notifierMode: 'smtp' } });
    await call('/api/password/forgot', { method: 'POST', body: { email: 'gudang1@lestari.id' } }); await s.D.ops.processEmails();
    const m = sent.find((x) => x.to === 'gudang1@lestari.id'); assert.ok(m, 'email reset terkirim'); assert.ok(/https:\/\/contoh\.vercel\.app\/app#\/reset\/[\w-]{40,}/.test(m.text));
    assert.ok(!sent.some((x) => x.to !== 'gudang1@lestari.id' && x.subject.includes('Reset')));
  });
  await t('reset: token sekali pakai, sandi kuat, sesi lama dicabut, login dengan sandi baru', async () => {
    const m = sent.find((x) => x.to === 'gudang1@lestari.id'); const tok = /reset\/([\w-]+)/.exec(m.text)[1]; const old = (await login('gudang1@lestari.id')).j.token;
    assert.strictEqual((await call('/api/password/check?token=' + tok)).j.valid, true); assert.strictEqual((await call('/api/password/check?token=ngawur')).j.valid, false);
    assert.strictEqual((await call('/api/password/reset', { method: 'POST', body: { token: tok, password: 'pendek' } })).status, 400);
    assert.strictEqual((await call('/api/password/reset', { method: 'POST', body: { token: 'x'.repeat(43), password: 'baru12345' } })).status, 400);
    assert.strictEqual((await call('/api/password/reset', { method: 'POST', body: { token: tok, password: 'baru12345' } })).status, 200);
    assert.strictEqual((await call('/api/password/reset', { method: 'POST', body: { token: tok, password: 'lain123456' } })).status, 400, 'token tidak bisa dipakai dua kali');
    assert.strictEqual((await call('/api/me', { token: old })).status, 401); assert.strictEqual((await login('gudang1@lestari.id')).status, 401); assert.strictEqual((await login('gudang1@lestari.id', 'baru12345')).status, 200);
    assert.strictEqual((await call('/api/password/check?token=' + tok)).j.valid, false);
  });
  await t('token kedaluwarsa ditolak; permintaan baru membatalkan token lama', async () => {
    await call('/api/password/forgot', { method: 'POST', body: { email: 'retailer@lestari.id' } }); const u = await s.D.col.users.findOne({ email: 'retailer@lestari.id' });
    const r = await s.D.col.resets.findOne({ userId: u._id }); await s.D.col.resets.update({ _id: r._id }, { exp: new Date(Date.now() - 1000).toISOString() });
    await s.D.ops.processEmails(); const tk1 = /reset\/([\w-]+)/.exec(sent.filter((x) => x.to === 'retailer@lestari.id').pop().text)[1];
    assert.strictEqual((await call('/api/password/reset', { method: 'POST', body: { token: tk1, password: 'baru12345' } })).status, 400);
    await call('/api/password/forgot', { method: 'POST', body: { email: 'retailer@lestari.id' } }); assert.strictEqual((await s.D.col.resets.find({ userId: u._id })).length, 1);
  });
  await t('saat layanan dijeda, lupa/reset sandi tetap bisa', async () => {
    await call('/api/server/gate', { method: 'PUT', token: admin, body: { enabled: false } });
    assert.strictEqual((await call('/api/password/forgot', { method: 'POST', body: { email: 'logistik@lestari.id' } })).status, 200); await call('/api/server/gate', { method: 'PUT', token: admin, body: { enabled: true } });
  });
  await t('batas permintaan: per email dibatasi', async () => {
    let last; for (let i = 0; i < 5; i++) last = await call('/api/password/forgot', { method: 'POST', body: { email: 'distributor@lestari.id' } }); assert.strictEqual(last.status, 429);
  });
  await s.close(); console.log(fails ? `\n${fails} uji gagal` : '\nSemua uji auth lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
