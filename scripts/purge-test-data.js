// Membersihkan data uji: pelaku "Tes Pengepul" / "Tes Kode", kelompok "KT QA" / "KT Tes", akun tespengepul@ dan teskode@.
// Default hanya MENAMPILKAN rencana (dry-run). Hapus sungguhan dengan --apply, setelah `npm run backup`.
// Entri yang sudah punya catatan terkait (batch, event, setoran, QR, transfer, kunci API, kasus) DILEWATI, bukan dihapus,
// karena event adalah rantai hash dan tidak boleh dipotong. Pakai: node scripts/purge-test-data.js [--apply] [--force]
const { openOffline } = require('./_offline');
const apply = process.argv.includes('--apply');
const ACTOR_NAMES = ['Tes Pengepul', 'Tes Kode'], GROUP_NAMES = ['KT QA', 'KT Tes'], USER_EMAILS = ['tespengepul@lestari.id', 'teskode@lestari.id'];

(async () => {
  const { store, D, col } = await openOffline({ force: process.argv.includes('--force') });
  const [actors, groups, users, batches, events, deposits, qrs, transfers, keys, cases, devs] = await Promise.all(['actors', 'farmerGroups', 'users', 'batches', 'events', 'deposits', 'qrLabels', 'transfers', 'apiKeys', 'cases', 'deviceReadings'].map((k) => col[k].find({})));
  const links = (actorId) => ({
    batch: batches.filter((x) => x.ownerActorId === actorId).length, event: events.filter((x) => x.actorId === actorId).length, setoran: deposits.filter((x) => x.actorId === actorId).length,
    qr: qrs.filter((x) => x.ownerActorId === actorId).length, transfer: transfers.filter((x) => [x.fromActorId, x.toActorId, x.carrierActorId].includes(actorId)).length,
    kunciApi: keys.filter((x) => x.actorId === actorId).length, pembacaan: devs.filter((x) => x.actorId === actorId).length,
  });
  const groupLinks = (id) => ({ setoran: deposits.filter((x) => x.farmerGroupId === id).length, batch: batches.filter((x) => x.farmerGroupId === id).length, akun: users.filter((x) => x.groupId === id).length });
  const fmt = (o) => Object.entries(o).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(', ');
  const plan = { actors: [], groups: [], users: [] }; let skipped = 0;
  const decide = (kind, name, id, lk, into) => { const f = fmt(lk); if (f) { skipped++; console.log(`  LEWATI ${kind} "${name}" (${id}): punya catatan terkait [${f}]`); } else { into.push(id); console.log(`  ${apply ? 'hapus' : 'akan dihapus'} ${kind} "${name}" (${id})`); } };

  console.log(apply ? 'MODE HAPUS (--apply)' : 'DRY-RUN (tambah --apply untuk menghapus)');
  for (const a of actors.filter((x) => ACTOR_NAMES.includes(x.name))) decide('pelaku', a.name, a._id, links(a._id), plan.actors);
  for (const g of groups.filter((x) => GROUP_NAMES.includes(x.name))) decide('kelompok', g.name, g._id, groupLinks(g._id), plan.groups);
  for (const u of users.filter((x) => USER_EMAILS.includes(String(x.email).toLowerCase()))) {
    const bound = u.actorId && !plan.actors.includes(u.actorId) && actors.some((a) => a._id === u.actorId);
    if (bound) { skipped++; console.log(`  LEWATI akun ${u.email}: pelakunya tidak ikut dihapus`); } else decide('akun', u.email, u._id, {}, plan.users);
  }
  const total = plan.actors.length + plan.groups.length + plan.users.length;
  console.log(`Ringkasan: ${plan.actors.length} pelaku, ${plan.groups.length} kelompok, ${plan.users.length} akun${skipped ? `, ${skipped} dilewati` : ''}.`);
  if (apply && total) {
    for (const id of plan.users) await col.users.remove({ _id: id });
    for (const id of plan.actors) { await col.actors.remove({ _id: id }); for (const g of groups) if ((g.linkedActorIds || []).includes(id)) await col.farmerGroups.update({ _id: g._id }, { linkedActorIds: g.linkedActorIds.filter((x) => x !== id) }); }
    for (const id of plan.groups) await col.farmerGroups.remove({ _id: id });
    await D.audit({ user: { _id: 'system', name: 'Skrip perawatan', role: 'system' } }, 'data.uji.hapus', `${plan.actors.length} pelaku, ${plan.groups.length} kelompok, ${plan.users.length} akun`); store.flush();
    console.log('Selesai. Nyalakan ulang backend.');
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
