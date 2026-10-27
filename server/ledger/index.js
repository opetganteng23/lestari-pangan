// Memilih adapter ledger. LEDGER_ADAPTER=local (bawaan, simulasi hash-chain) | evm (EVM testnet, BELUM DIUJI).
// Kontrak antarmuka adapter:
//   network: string
//   anchor(eventId, hash) -> Promise<{ txId, block, blockHash, network }>
//   lookup(eventId)       -> Promise<{ hash, ... } | null>
//   verifyChain()         -> { ok, ... } | Promise<{ ok, ... }>
//   reset()               -> (opsional, hanya adapter lokal; dipakai seed)
//   simulated             -> true bila bukan jaringan blockchain sungguhan
const name = (process.env.LEDGER_ADAPTER || 'local').toLowerCase();
let adapter;
if (name === 'evm') adapter = require('./evm');
else if (name === 'local') adapter = require('./local');
else throw new Error(`LEDGER_ADAPTER tidak dikenal: ${name}`);
if (adapter.simulated === undefined) adapter.simulated = name === 'local';
module.exports = adapter;
