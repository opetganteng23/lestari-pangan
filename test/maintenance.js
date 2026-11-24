process.env.LP_SKIP_DOTENV = '1';
// Uji skrip perawatan: disable-demo-accounts dan purge-test-data. Jalankan: node test/maintenance.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
process.env.LOG = '0'; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-maint-')); process.env.LP_DATA_DIR = dir;
const { start } = require('../server/index.js'); const auth = require('../server/auth');
const run = (script, ...args) => cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', script), ...args], { env: { ...process.env, LP_SKIP_DOTENV: '1', LP_DATA_DIR: dir }, encoding: 'utf8' });
const read = () => JSON.parse(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'));
(async () => {
  const s = await start({ port: 0 }); let fails = 0; const col = s.D.col;
  const t = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
  const tp = await col.actors.insert({ name: 'Tes Pengepul', role: 'pengepul', district: 'x', lat: -6.6, lng: 107.6 }); const tk = await col.actors.insert({ name: 'Tes Kode', role: 'pengepul', district: 'x', lat: -6.6, lng: 107.6 });
  await col.users.insert({ email: 'tespengepul@lestari.id', name: 'Tes Pengepul', role: 'pengepul', actorId: tp._id, passwordHash: auth.hashPassword('lestari123'), active: true });
  await col.users.insert({ email: 'teskode@lestari.id', name: 'Tes Kode', role: 'pengepul', actorId: tk._id, passwordHash: auth.hashPassword('lestari123'), active: true });
  await col.farmerGroups.insert({ name: 'KT QA', ketua: 'x', village: 'x', district: 'x', lat: 0, lng: 0, hectares: 1, linkedActorIds: [tp._id], active: true });
  await col.farmerGroups.insert({ name: 'KT Tes', ketua: 'x', village: 'x', district: 'x', lat: 0, lng: 0, hectares: 1, linkedActorIds: [], active: true });
  s.D.store.flush(); s.server.close();

  await t('nonaktifkan akun demo: ditolak bila tidak ada super admin non-demo', async () => {
    const r = run('disable-demo-accounts.js'); assert.strictEqual(r.status, 1, r.stdout + r.stderr); assert.ok(/tidak ada super admin aktif/.test(r.stderr));
    assert.ok(read().users.filter((u) => /@lestari\.id$/.test(u.email)).every((u) => u.active !== false), 'tidak ada yang berubah');
  });
  const st = await start({ port: 0 }); await st.D.col.users.insert({ email: 'owner@contoh.id', name: 'Pemilik', role: 'superadmin', passwordHash: auth.hashPassword('Rahasia123'), active: true, sv: 4 }); st.D.store.flush(); st.server.close();
  await t('dry-run tidak mengubah apa pun', async () => {
    const before = fs.readFileSync(path.join(dir, 'db.json'), 'utf8'); const r = run('disable-demo-accounts.js', '--dry-run'); assert.strictEqual(r.status, 0, r.stderr); assert.ok(r.stdout.includes('[dry-run]'));
    assert.strictEqual(fs.readFileSync(path.join(dir, 'db.json'), 'utf8'), before);
  });
  await t('nonaktifkan: semua @lestari.id mati dan sv naik; akun lain utuh', async () => {
    const before = read().users; const r = run('disable-demo-accounts.js'); assert.strictEqual(r.status, 0, r.stdout + r.stderr); const after = read().users;
    for (const u of after) {
      const b = before.find((x) => x._id === u._id);
      if (/@lestari\.id$/.test(u.email)) { assert.strictEqual(u.active, false, u.email); assert.strictEqual(u.sv || 0, (b.sv || 0) + 1, 'sv naik ' + u.email); }
      else { assert.strictEqual(u.active, true); assert.strictEqual(u.sv, 4); assert.strictEqual(u.passwordHash, b.passwordHash); }
    }
    assert.strictEqual(after.length, before.length, 'tidak ada akun dihapus'); assert.ok(read().auditLogs.some((l) => l.action === 'akun.demo.nonaktif'));
  });
  await t('idempoten: jalan kedua tidak mengubah sv lagi', async () => {
    const before = JSON.stringify(read().users); const r = run('disable-demo-accounts.js'); assert.strictEqual(r.status, 0); assert.ok(r.stdout.includes('Tidak ada yang perlu diubah')); assert.strictEqual(JSON.stringify(read().users), before);
  });
  await t('purge: dry-run default menampilkan rencana tanpa menghapus', async () => {
    const n = read(); const r = run('purge-test-data.js'); assert.strictEqual(r.status, 0, r.stderr); assert.ok(r.stdout.includes('DRY-RUN') && r.stdout.includes('akan dihapus pelaku "Tes Pengepul"'));
    assert.strictEqual(JSON.stringify(read().actors), JSON.stringify(n.actors));
  });
  await t('purge: melewati pelaku yang sudah punya batch', async () => {
    const s2 = await start({ port: 0 }); const a = (await s2.D.col.actors.find({})).find((x) => x.name === 'Tes Kode'); await s2.D.col.batches.insert({ code: 'B-X', kind: 'deposit', commodity: 'gabah', weightKg: 10, ownerActorId: a._id, status: 'available', parents: [] }); s2.D.store.flush(); s2.server.close();
    const r = run('purge-test-data.js', '--apply'); assert.strictEqual(r.status, 0, r.stderr); assert.ok(/LEWATI pelaku "Tes Kode".*batch=1/.test(r.stdout), r.stdout);
    const d = read(); assert.ok(d.actors.some((x) => x.name === 'Tes Kode'), 'Tes Kode tetap ada'); assert.ok(!d.actors.some((x) => x.name === 'Tes Pengepul'), 'Tes Pengepul terhapus');
    assert.ok(!d.farmerGroups.some((g) => ['KT QA', 'KT Tes'].includes(g.name))); assert.ok(!d.users.some((u) => u.email === 'tespengepul@lestari.id')); assert.ok(d.users.some((u) => u.email === 'teskode@lestari.id'), 'akun yang pelakunya dilewati ikut tetap');
    assert.ok(d.actors.length >= 8, 'pelaku demo utuh'); assert.ok(d.users.some((u) => u.email === 'owner@contoh.id'));
  });
  await t('health jujur: demoAccounts=false setelah akun demo dinonaktifkan, dan login demo ditolak', async () => {
    const s3 = await start({ port: 0 }); const base = 'http://localhost:' + s3.server.address().port;
    try {
      const h = await (await fetch(base + '/api/health')).json(); assert.strictEqual(h.demoAccounts, false); assert.strictEqual(typeof h.demoMode, 'boolean');
      const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'sa@lestari.id', password: 'lestari123' }) }); assert.strictEqual(r.status, 401);
      const ok = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@contoh.id', password: 'Rahasia123' }) }); assert.strictEqual(ok.status, 200, 'akun non-demo tetap bisa masuk');
    } finally { s3.server.close(); }
  });
  console.log(fails ? `\n${fails} GAGAL` : '\nSemua lulus'); process.exit(fails ? 1 : 0);
})();
