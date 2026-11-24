process.env.LP_SKIP_DOTENV = '1';
// Uji retensi data, rotasi cadangan, dan pembersih uploads. Jalankan: node test/retention.js
const os = require('os'), fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
process.env.LOG = '0'; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-ret-')); process.env.LP_DATA_DIR = dir;
const { start } = require('../server/index.js'); const backup = require('../server/backup');
const run = (script, ...args) => cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', script), ...args], { env: { ...process.env, LP_SKIP_DOTENV: '1', LP_DATA_DIR: dir }, encoding: 'utf8' });
const DAY = 864e5, ago = (d) => new Date(Date.now() - d * DAY).toISOString();
(async () => {
  const s = await start({ port: 0 }); let fails = 0; const col = s.D.col, R = s.D.retention;
  const t = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  GAGAL', name, '→', e.message); } };
  for (const k of ['RETAIN_AUDIT_DAYS', 'RETAIN_NOTIF_DAYS', 'RETAIN_IDEM_DAYS', 'RETAIN_OUTBOX_DAYS']) delete process.env[k];
  const cnt = async () => ({ audit: (await col.auditLogs.find({})).length, notif: (await col.notifications.find({})).length, idem: (await col.idem.find({})).length, outbox: (await col.outbox.find({})).length, events: (await col.events.find({})).length });

  await t('bawaan: 730 hari audit, 90 notifikasi, 7 idem, 30 outbox', () => { assert.deepStrictEqual(R.settings(), { audit: 730, notifications: 90, idem: 7, outbox: 30 }); });
  const oldAudit = await col.auditLogs.insert({ at: ago(800), action: 'uji.lama', detail: 'x' }), newAudit = await col.auditLogs.insert({ at: ago(5), action: 'uji.baru', detail: 'x' });
  const oldN = await col.notifications.insert({ at: ago(120), text: 'lama' }), newN = await col.notifications.insert({ at: ago(1), text: 'baru' });
  const oldI = await col.idem.insert({ key: 'k-lama', bodyHash: 'h', response: {}, at: ago(20) }), newI = await col.idem.insert({ key: 'k-baru', bodyHash: 'h', response: {}, at: ago(1) });
  const evOld = await col.events.insert({ type: 'UJI', at: ago(90) }), evNew = await col.events.insert({ type: 'UJI', at: ago(2) });
  const oDoneOld = await col.outbox.insert({ eventId: evOld._id, status: 'done', attempts: 1 }), oDoneNew = await col.outbox.insert({ eventId: evNew._id, status: 'done', attempts: 1 }), oPendOld = await col.outbox.insert({ eventId: evOld._id, status: 'pending', attempts: 0 }), oFailOld = await col.outbox.insert({ eventId: evOld._id, status: 'failed', attempts: 5 });
  await t('dry-run menghitung tanpa menghapus', async () => {
    const before = await cnt(); const r = await R.run({ dry: true }); assert.ok(r.dry && r.audit >= 1 && r.notifications >= 1 && r.idem >= 1 && r.outbox >= 1); assert.deepStrictEqual(await cnt(), before);
  });
  await t('menghapus yang melewati batas; yang baru, pending, dan gagal tetap; event/ledger tak disentuh', async () => {
    const before = await cnt(); const r = await R.run(); assert.ok(r.total >= 4);
    const has = async (c, id) => !!(await col[c].findOne({ _id: id }));
    assert.ok(!(await has('auditLogs', oldAudit._id)) && (await has('auditLogs', newAudit._id))); assert.ok(!(await has('notifications', oldN._id)) && (await has('notifications', newN._id))); assert.ok(!(await has('idem', oldI._id)) && (await has('idem', newI._id)));
    assert.ok(!(await has('outbox', oDoneOld._id)) && (await has('outbox', oDoneNew._id)) && (await has('outbox', oPendOld._id)) && (await has('outbox', oFailOld._id)));
    assert.strictEqual((await cnt()).events, before.events); const log = (await col.auditLogs.find({})).find((a) => a.action === 'retensi.bersih'); assert.ok(log && /audit=/.test(log.detail));
  });
  await t('berjalan ulang tidak menghapus apa pun lagi', async () => { const r = await R.run(); assert.strictEqual(r.total, 0); });
  await t('nilai 0 mematikan retensi jenis itu; nilai ngawur memakai bawaan', async () => {
    const old = await col.notifications.insert({ at: ago(500), text: 'tua' }); process.env.RETAIN_NOTIF_DAYS = '0'; assert.strictEqual((await R.run()).notifications, 0); assert.ok(await col.notifications.findOne({ _id: old._id }));
    process.env.RETAIN_NOTIF_DAYS = 'abc'; assert.strictEqual(R.settings().notifications, 90); process.env.RETAIN_NOTIF_DAYS = '30'; assert.ok((await R.run()).notifications >= 1); assert.ok(!(await col.notifications.findOne({ _id: old._id }))); delete process.env.RETAIN_NOTIF_DAYS;
  });

  await t('rotasi cadangan: hanya N terbaru yang bertahan, folder tanpa MANIFEST tidak disentuh', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-bkp-')); const mk = (n, manifest = true) => { const d = path.join(root, n); fs.mkdirSync(d); if (manifest) fs.writeFileSync(path.join(d, 'MANIFEST.json'), '{}'); };
    ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].forEach((n) => mk(n)); mk('catatan-pribadi', false);
    const r = backup.prune(root, 2); assert.deepStrictEqual(r.removed, ['2026-01-01', '2026-01-02']); assert.deepStrictEqual(fs.readdirSync(root).sort(), ['2026-01-03', '2026-01-04', 'catatan-pribadi']);
    assert.deepStrictEqual(backup.prune(root, 0).removed, []); assert.deepStrictEqual(backup.prune(path.join(root, 'tidak-ada'), 2).removed, []);
  });
  await t('scripts/backup.js --keep membuat cadangan lalu memangkas', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-bkc-')); for (const n of ['2020-01-01', '2020-01-02', '2020-01-03']) { fs.mkdirSync(path.join(root, n)); fs.writeFileSync(path.join(root, n, 'MANIFEST.json'), '{}'); }
    s.store.flush(); const r = run('backup.js', root, '--keep', '2'); assert.strictEqual(r.status, 0, r.stderr); assert.strictEqual(fs.readdirSync(root).length, 2); const left = fs.readdirSync(root); assert.ok(left.includes('2020-01-03') && !left.includes('2020-01-01') && !left.includes('2020-01-02'));
  });

  const up = path.join(dir, 'uploads'); fs.mkdirSync(up, { recursive: true });
  await t('clean-uploads: dry-run mendaftar yatim; --apply memindahkan (bukan menghapus); yang dirujuk tetap', async () => {
    fs.writeFileSync(path.join(up, 'dipakai.jpg'), 'AAA'); fs.writeFileSync(path.join(up, 'yatim1.jpg'), 'BBB'); fs.writeFileSync(path.join(up, 'seed-contoh.svg'), 'CCC');
    await col.deposits.insert({ scalePhoto: '/uploads/dipakai.jpg', notaPhoto: '/uploads/dipakai.jpg' }); s.store.flush();
    const d = run('clean-uploads.js'); assert.strictEqual(d.status, 0, d.stderr); assert.match(d.stdout, /DRY-RUN/); assert.ok(fs.existsSync(path.join(up, 'yatim1.jpg')) && d.stdout.includes('yatim1.jpg') && d.stdout.includes('seed-contoh.svg') && !/pindah dipakai\.jpg|dipindah dipakai\.jpg/.test(d.stdout));
    const a = run('clean-uploads.js', '--apply'); assert.strictEqual(a.status, 0, a.stderr); assert.ok(!fs.existsSync(path.join(up, 'yatim1.jpg')) && !fs.existsSync(path.join(up, 'seed-contoh.svg')) && fs.existsSync(path.join(up, 'dipakai.jpg')));
    const moved = fs.readdirSync(path.join(dir, 'uploads-yatim')); assert.strictEqual(moved.length, 1); assert.ok(fs.existsSync(path.join(dir, 'uploads-yatim', moved[0], 'yatim1.jpg')));
    assert.match(run('clean-uploads.js', '--apply').stdout, /yatim: 0/);
  });
  await s.close(); console.log(fails ? fails + ' gagal' : 'Semua lulus'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
