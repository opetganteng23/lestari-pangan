// Data SIMULASI: semua nama, angka, dan lokasi fiktif. Kata sandi semua akun demo: lestari123
const fs = require('fs'), path = require('path');
const { hashPassword, sha256 } = require('./auth');
const ledger = require('./ledger/index');
const H = 3600e3, ago = (h) => new Date(Date.now() - h * H).toISOString();
const svgPhoto = (label, sub, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="${color}"/><rect x="40" y="40" width="560" height="340" rx="18" fill="#fff" opacity=".85"/><text x="320" y="190" text-anchor="middle" font-family="Poppins,Arial" font-size="34" font-weight="700" fill="#12472A">${label}</text><text x="320" y="235" text-anchor="middle" font-family="Poppins,Arial" font-size="20" fill="#5F7066">${sub}</text><text x="320" y="350" text-anchor="middle" font-family="Poppins,Arial" font-size="16" fill="#9A6212">FOTO SIMULASI</text></svg>`;

module.exports = async function seed(D) {
  const { col } = D; ledger.reset();
  const up = path.join(require('./paths').DATA, 'uploads'); fs.mkdirSync(up, { recursive: true });
  fs.writeFileSync(path.join(up, 'seed-timbangan.svg'), svgPhoto('Timbangan', 'Foto timbangan (simulasi)', '#E1EDE5'));
  fs.writeFileSync(path.join(up, 'seed-nota.svg'), svgPhoto('Nota bertanda tangan', 'Tanda tangan ketua kelompok (simulasi)', '#FDF3D6'));
  const PH = { scalePhoto: '/uploads/seed-timbangan.svg', notaPhoto: '/uploads/seed-nota.svg' };
  await col.counters.insert({ _id: 'pkg', n: 210 }); await D.cfg();

  const A = async (name, role, district, lat, lng) => col.actors.insert({ name, role, district, lat, lng, createdAt: ago(900) });
  const U = async (email, name, role, actor) => col.users.insert({ email, name, role, actorId: actor?._id || null, passwordHash: hashPassword('lestari123'), active: true });
  const pe1 = await A('CV Tani Makmur', 'pengepul', 'Subang', -6.57, 107.76), pe2 = await A('UD Berkah Tani', 'pengepul', 'Karawang', -6.32, 107.34), pe3 = await A('Koperasi Padi Jaya', 'pengepul', 'Indramayu', -6.33, 108.32);
  const g1 = await A('Penggilingan Sinar Jaya', 'gudang', 'Subang', -6.55, 107.73), g2 = await A('Penggilingan Berkah Mulya', 'gudang', 'Cirebon', -6.71, 108.56);
  const di = await A('PT Distribusi Nusantara', 'distributor', 'Bandung', -6.93, 107.6), lo = await A('Logistik Cepat Tani', 'logistik', 'Bandung', -6.9, 107.62), re = await A('Toko Beras Sejahtera', 'retailer', 'Bandung', -6.91, 107.61);
  const sa = await U('sa@lestari.id', 'Super Admin', 'superadmin'), ad = await U('admin@lestari.id', 'Admin Teknis', 'admin'), pw = await U('pengawas@lestari.id', 'Dinas Pertanian', 'pengawas');
  const u = {}; for (const [k, name, a] of [['pengepul1', pe1.name, pe1], ['pengepul2', pe2.name, pe2], ['pengepul3', pe3.name, pe3], ['gudang1', g1.name, g1], ['gudang2', g2.name, g2], ['distributor', di.name, di], ['logistik', lo.name, lo], ['retailer', re.name, re]]) u[k] = await U(`${k}@lestari.id`, name, a.role, a);
  const ctx = (user, actor, at) => ({ user, role: user.role, actor, at });
  const adm = (at) => ({ user: ad, role: 'admin', actor: null, at });

  const G = async (name, village, district, lat, lng, code, ha, avg, link) => { const salt = 'seed' + name.length; return col.farmerGroups.insert({ name, ketua: 'Ketua ' + name.replace('KT ', ''), village, district, lat, lng, hectares: ha, avgWeightKg: avg, linkedActorIds: link.map((x) => x._id), codeSalt: salt, codeHash: sha256(salt + code), active: true, createdAt: ago(800) }); };
  const kt1 = await G('KT Sumber Rejeki', 'Pagaden', 'Pagaden, Subang', -6.49, 107.8, 'SUM-4821', 24, 1500, [pe1]), kt2 = await G('KT Harapan Jaya', 'Compreng', 'Compreng, Subang', -6.4, 107.9, 'HAR-3307', 18, 1400, [pe1, pe2]), kt3 = await G('KT Mekar Sari', 'Cikaum', 'Cikaum, Subang', -6.43, 107.62, 'MEK-5519', 15, 1100, [pe2, pe1]), kt4 = await G('KT Tani Subur', 'Kertasemaya', 'Kertasemaya, Indramayu', -6.46, 108.31, 'TAN-7742', 21, 1500, [pe3, pe2]);
  for (const [code, role, max, exp, note] of [['PENGEPUL-DEMO1', 'pengepul', 5, null, 'Undangan pengepul (demo)'], ['GUDANG-DEMO1', 'gudang', 3, null, 'Undangan gudang/penggilingan (demo)'], ['RETAILER-DEMO1', 'retailer', 10, null, 'Undangan retailer (demo)'], ['LAMA-0001', 'pengepul', 1, ago(48), 'Contoh kode kedaluwarsa']]) await col.referralCodes.insert({ code, role, maxUses: max, uses: 0, expiresAt: exp, note, active: true, createdAt: ago(700) });
  for (const [x, usr] of [[pe1, u.pengepul1], [pe2, u.pengepul2], [pe3, u.pengepul3]]) await D.issueLabels(ctx(usr, x, ago(300)), 60);

  const dep = (usr, a, g, code, kg, nota, hAgo) => D.createDeposit(ctx(usr, a, ago(hAgo)), { farmerGroupId: g._id, groupCode: code, weightKg: kg, notaNo: nota, ...PH, at: ago(hAgo) });
  const verify = async (d, hAgo) => { const cur = await col.deposits.findOne({ _id: d._id }); if (cur.status === 'pending') await D.decideDeposit(adm(ago(hAgo)), d._id, 'approve', {}); return col.deposits.findOne({ _id: d._id }); };
  const bOf = (d) => col.batches.findOne({ _id: d.batchId });

  // ===== Alur 1: lengkap sampai kemasan di retailer (lot LP-PKG-2026-0211) =====
  const d1 = await verify(await dep(u.pengepul1, pe1, kt1, 'SUM-4821', 2000, 'NT-0101/KT-SR/X/2026', 336), 334);
  const d2 = await verify(await dep(u.pengepul1, pe1, kt2, 'HAR-3307', 1480, 'NT-0102/KT-HJ/X/2026', 332), 330);
  const m1 = await D.mergeBatches(ctx(u.pengepul1, pe1, ago(320)), [d1.batchId, d2.batchId]);
  let t = await D.sendTransfer(ctx(u.pengepul1, pe1, ago(300)), { batchId: m1._id, toActorId: g1._id, note: 'Pengiriman gabah kering giling' });
  await D.confirmTransfer(ctx(u.gudang1, g1, ago(296)), t._id, 3452);
  const proc1 = await D.processBatch(ctx(u.gudang1, g1, ago(260)), m1._id, { outputKg: 2154, variety: 'Pulen' });
  const pk = await D.packBatch(ctx(u.gudang1, g1, ago(250)), proc1._id, { qty: 400, packKg: 5, product: 'Beras Premium Pulen 5 kg' });
  t = await D.sendTransfer(ctx(u.gudang1, g1, ago(200)), { batchId: pk._id, toActorId: di._id, carrierActorId: lo._id });
  await D.carrierStep(ctx(u.logistik, lo, ago(199)), t._id, 'pickup'); await D.carrierStep(ctx(u.logistik, lo, ago(196)), t._id, 'deliver');
  await D.confirmTransfer(ctx(u.distributor, di, ago(195)), t._id, 1998);
  t = await D.sendTransfer(ctx(u.distributor, di, ago(150)), { batchId: pk._id, toActorId: re._id });
  await D.confirmTransfer(ctx(u.retailer, re, ago(146)), t._id, 1998);

  // ===== Alur 2: selisih berat -> sengketa =====
  const d3 = await verify(await dep(u.pengepul2, pe2, kt3, 'MEK-5519', 1100, 'NT-0201/KT-MS/X/2026', 120), 118);
  const d4 = await verify(await dep(u.pengepul2, pe2, kt2, 'HAR-3307', 890, 'NT-0202/KT-HJ/X/2026', 117), 115);
  const m2 = await D.mergeBatches(ctx(u.pengepul2, pe2, ago(110)), [d3.batchId, d4.batchId]);
  t = await D.sendTransfer(ctx(u.pengepul2, pe2, ago(100)), { batchId: m2._id, toActorId: g1._id });
  await D.confirmTransfer(ctx(u.gudang1, g1, ago(96)), t._id, 1920);

  // ===== Alur 3: giling di penggilingan kedua (rendemen lebih rendah) + transfer menggantung =====
  const d5 = await verify(await dep(u.pengepul3, pe3, kt4, 'TAN-7742', 1900, 'NT-0301/KT-TS/X/2026', 200), 198);
  t = await D.sendTransfer(ctx(u.pengepul3, pe3, ago(190)), { batchId: d5.batchId, toActorId: g2._id });
  await D.confirmTransfer(ctx(u.gudang2, g2, ago(186)), t._id, 1893);
  await D.processBatch(ctx(u.gudang2, g2, ago(150)), d5.batchId, { outputKg: 1079 });
  const d6 = await verify(await dep(u.pengepul3, pe3, kt4, 'TAN-7742', 760, 'NT-0302/KT-TS/X/2026', 90), 88);
  const t2 = await D.sendTransfer(ctx(u.pengepul3, pe3, ago(60)), { batchId: d6.batchId, toActorId: g2._id });
  await col.transfers.update({ _id: t2._id }, { sentAt: ago(52) });

  // ===== Antrean verifikasi + percobaan janggal =====
  await dep(u.pengepul1, pe1, kt1, 'SUM-4821', 4800, 'NT-0192/KT-SR/X/2026', 26);
  await dep(u.pengepul1, pe1, kt3, 'MEK-5519', 890, 'NT-0193/KT-MS/X/2026', 14);
  await dep(u.pengepul2, pe2, kt4, 'TAN-7742', 1640, 'NT-0203/KT-TS/X/2026', 12);
  await dep(u.pengepul2, pe2, kt2, 'HAR-3307', 760, 'NT-0204/KT-HJ/X/2026', 8);
  await dep(u.pengepul3, pe3, kt4, 'TAN-7742', 1020, 'NT-0303/KT-TS/X/2026', 5);
  await dep(u.pengepul2, pe2, kt2, 'HAR-3307', 1210, 'NT-0205/KT-HJ/X/2026', 3);
  await dep(u.pengepul1, pe1, kt1, 'SUM-4821', 1320, 'NT-0194/KT-SR/X/2026', 2);
  for (const f of [() => dep(u.pengepul1, pe1, kt1, 'SUM-4821', 900, 'NT-0101/KT-SR/X/2026', 1), () => dep(u.pengepul2, pe2, kt3, 'SALAH-1', 500, 'NT-0299', 1)]) { try { await f(); } catch {} }
  await D.processOutbox();
  await D.analytics?.run?.();
};
