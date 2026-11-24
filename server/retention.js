// Retensi data operasional: membuang catatan lama supaya db.json tidak membengkak tanpa batas.
// Batas (hari) diatur lewat .env; nilai 0 berarti jangan hapus apa pun untuk jenis itu.
//   RETAIN_AUDIT_DAYS   audit log            bawaan 730 (2 tahun)
//   RETAIN_NOTIF_DAYS   notifikasi           bawaan 90
//   RETAIN_IDEM_DAYS    kunci idempotensi    bawaan 7
//   RETAIN_OUTBOX_DAYS  antrean anchor SELESAI, diukur dari umur event-nya; bawaan 30
// Yang TIDAK pernah disentuh: event/ledger (rantai hash), batch, setoran, transfer, kasus, dan antrean anchor yang masih
// pending atau gagal. Setiap penghapusan dicatat satu baris audit "retensi.bersih" berisi jumlahnya.
const DAY = 864e5;
const days = (name, def) => { const v = process.env[name]; if (v === undefined || v === '') return def; const n = Math.floor(+v); return Number.isFinite(n) && n >= 0 ? n : def; };
const settings = () => ({ audit: days('RETAIN_AUDIT_DAYS', 730), notifications: days('RETAIN_NOTIF_DAYS', 90), idem: days('RETAIN_IDEM_DAYS', 7), outbox: days('RETAIN_OUTBOX_DAYS', 30) });

module.exports = (D) => {
  const col = D.col;
  // dry: hanya hitung. Mengembalikan jumlah catatan yang dihapus (atau akan dihapus) per jenis.
  async function run({ now = Date.now(), dry = false } = {}) {
    const cfg = settings(); const out = { audit: 0, notifications: 0, idem: 0, outbox: 0 };
    const old = (d, field, n) => n > 0 && new Date(d[field] || 0).getTime() < now - n * DAY && !!d[field];
    for (const [key, name, field] of [['audit', 'auditLogs', 'at'], ['notifications', 'notifications', 'at'], ['idem', 'idem', 'at']]) {
      if (!cfg[key]) continue; const ids = (await col[name].find({})).filter((d) => old(d, field, cfg[key])).map((d) => d._id);
      out[key] = ids.length; if (ids.length && !dry) await col[name].remove({ _id: { $in: ids } });
    }
    if (cfg.outbox) {
      const ev = Object.fromEntries((await col.events.find({})).map((e) => [e._id, e.at]));
      const ids = (await col.outbox.find({ status: 'done' })).filter((o) => ev[o.eventId] && new Date(ev[o.eventId]).getTime() < now - cfg.outbox * DAY).map((o) => o._id);
      out.outbox = ids.length; if (ids.length && !dry) await col.outbox.remove({ _id: { $in: ids } });
    }
    const total = out.audit + out.notifications + out.idem + out.outbox;
    if (total && !dry) await D.audit({ user: { _id: 'system', name: 'Retensi data', role: 'system' } }, 'retensi.bersih', `audit=${out.audit}, notifikasi=${out.notifications}, idem=${out.idem}, outbox=${out.outbox}`);
    return { ...out, total, settings: cfg, dry };
  }
  // Pertama kali 60 detik setelah menyala (supaya tidak mengganggu startup), lalu tiap 24 jam.
  function schedule() {
    const t1 = setTimeout(() => run().catch((e) => console.error('retensi:', e.message)), 60000); t1.unref();
    const t2 = setInterval(() => run().catch((e) => console.error('retensi:', e.message)), DAY); t2.unref();
    return () => { clearTimeout(t1); clearInterval(t2); };
  }
  return { run, schedule, settings };
};
