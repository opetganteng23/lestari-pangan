// Uji kepatuhan antarmuka adapter ledger. Jalankan: node test/ledger.js  (LEDGER_ADAPTER=local bawaan)
const assert = require('assert'), os = require('os'), fs = require('fs'), path = require('path');
process.env.LP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-ledger-'));
const ledger = require('../server/ledger/index');
(async () => {
  let fails = 0; const t = async (n, f) => { try { await f(); console.log('  ok  ', n); } catch (e) { fails++; console.log('  GAGAL', n, '→', e.message); } };
  const H1 = 'a'.repeat(64), H2 = 'b'.repeat(64);
  await t('antarmuka lengkap', () => { for (const k of ['anchor', 'lookup', 'verifyChain']) assert.strictEqual(typeof ledger[k], 'function', k); assert.ok(ledger.network); assert.strictEqual(typeof ledger.simulated, 'boolean'); });
  await t('anchor mengembalikan bukti transaksi', async () => { const r = await ledger.anchor('evt_1', H1); assert.ok(r.txId && r.block && r.blockHash && r.network); });
  await t('lookup mengembalikan hash yang di-anchor, null bila tak ada', async () => { assert.strictEqual((await ledger.lookup('evt_1')).hash, H1); assert.strictEqual(await ledger.lookup('tidak_ada'), null); });
  await t('rantai valid setelah beberapa anchor', async () => { await ledger.anchor('evt_2', H2); assert.strictEqual((await ledger.verifyChain()).ok, true); });
  await t('hash berbeda terdeteksi pada pembandingan', async () => { assert.notStrictEqual((await ledger.lookup('evt_2')).hash, H1); });
  if (ledger.simulated) await t('adapter lokal mendeteksi blok yang diubah', async () => { const f = path.join(process.env.LP_DATA_DIR, 'ledger.json'); const b = JSON.parse(fs.readFileSync(f, 'utf8')); b[0].hash = 'c'.repeat(64); fs.writeFileSync(f, JSON.stringify(b)); delete require.cache[require.resolve('../server/ledger/local')]; delete require.cache[require.resolve('../server/ledger/index')]; assert.strictEqual((await require('../server/ledger/index').verifyChain()).ok, false); });
  console.log(fails ? `\n${fails} uji gagal` : '\nSemua uji ledger lulus'); process.exit(fails ? 1 : 0);
})();
