// Ledger anchor. Antarmuka: anchor(eventId, hash) -> {txId, block, blockHash, network}; lookup(eventId); verifyChain().
// Implementasi bawaan: SIMULASI hash-chain lokal (append-only, tiap blok menautkan hash blok sebelumnya).
// Untuk produksi/uji: ganti dengan adapter EVM testnet (ethers.js) yang memanggil kontrak LPAnchor dengan antarmuka sama.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FILE = path.join(require('./paths').DATA, 'ledger.json'); fs.mkdirSync(path.dirname(FILE), { recursive: true });
const NETWORK = process.env.LEDGER_NETWORK || 'Ledger simulasi lokal (hash-chain)';
const h = (s) => crypto.createHash('sha256').update(s).digest('hex');
let blocks = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : [];
const save = () => fs.writeFileSync(FILE, JSON.stringify(blocks));
module.exports = {
  network: NETWORK,
  reset() { blocks = []; save(); },
  async anchor(eventId, hash) {
    const prev = blocks.length ? blocks[blocks.length - 1].blockHash : '0'.repeat(64);
    const number = 4218300 + blocks.length + 1;
    const blockHash = h(`${prev}|${number}|${eventId}|${hash}`);
    const b = { number, txId: '0x' + h(`tx|${eventId}|${hash}|${number}`).slice(0, 40), eventId, hash, prev, blockHash, ts: new Date().toISOString() };
    blocks.push(b); save();
    return { txId: b.txId, block: b.number, blockHash, network: NETWORK };
  },
  async lookup(eventId) { return blocks.find((b) => b.eventId === eventId) || null; },
  verifyChain() {
    let prev = '0'.repeat(64);
    for (const b of blocks) {
      if (b.prev !== prev || b.blockHash !== h(`${prev}|${b.number}|${b.eventId}|${b.hash}`)) return { ok: false, brokenAt: b.number };
      prev = b.blockHash;
    }
    return { ok: true, blocks: blocks.length };
  },
};
