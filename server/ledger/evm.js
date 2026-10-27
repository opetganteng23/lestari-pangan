// Adapter EVM testnet untuk kontrak contracts/LPAnchor.sol. STATUS: DITULIS TETAPI BELUM DIUJI pada jaringan nyata.
// Syarat: `npm i ethers`, kontrak sudah dideploy, dan variabel lingkungan:
//   EVM_RPC_URL, EVM_PRIVATE_KEY (akun uji, bukan akun berisi dana nyata), EVM_CONTRACT_ADDRESS, EVM_NETWORK_NAME (opsional)
// Hanya hash yang dikirim ke rantai; tidak ada data pribadi atau dokumen.
const crypto = require('crypto');
const ABI = [
  'function anchor(bytes32 eventKey, bytes32 dataHash) external',
  'function anchors(bytes32 eventKey) view returns (bytes32 dataHash, uint64 ts)',
  'event Anchored(bytes32 indexed eventKey, bytes32 dataHash, uint64 ts)',
];
const need = (k) => { if (!process.env[k]) throw new Error(`Adapter EVM butuh variabel lingkungan ${k}`); return process.env[k]; };
let ctx;
function init() {
  if (ctx) return ctx;
  let ethers; try { ethers = require('ethers'); } catch { throw new Error('Paket "ethers" belum terpasang (npm i ethers)'); }
  const provider = new ethers.JsonRpcProvider(need('EVM_RPC_URL'));
  const wallet = new ethers.Wallet(need('EVM_PRIVATE_KEY'), provider);
  ctx = { ethers, provider, contract: new ethers.Contract(need('EVM_CONTRACT_ADDRESS'), ABI, wallet) };
  return ctx;
}
const key = (id) => '0x' + crypto.createHash('sha256').update(String(id)).digest('hex');
const hex = (h) => '0x' + String(h).replace(/^0x/, '');
module.exports = {
  simulated: false,
  network: process.env.EVM_NETWORK_NAME || 'EVM testnet (belum diuji)',
  async anchor(eventId, hash) {
    const { contract } = init(); const tx = await contract.anchor(key(eventId), hex(hash)); const rc = await tx.wait();
    return { txId: tx.hash, block: rc.blockNumber, blockHash: rc.blockHash, network: this.network };
  },
  async lookup(eventId) {
    const { contract } = init(); const [h, ts] = await contract.anchors(key(eventId));
    if (/^0x0+$/.test(h)) return null; return { hash: h.replace(/^0x/, ''), ts: Number(ts) };
  },
  async verifyChain() { const { provider } = init(); const n = await provider.getBlockNumber(); return { ok: true, head: n, note: 'Integritas rantai dijamin jaringan; tidak diperiksa ulang secara lokal' }; },
};
