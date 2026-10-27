// Layar peran pelaku rantai pasok + detail batch
const EVT = { DEPOSIT_RECORDED: 'Setoran dicatat', DEPOSIT_VERIFIED: 'Setoran diverifikasi admin', DEPOSIT_AUTO_ACCEPTED: 'Setoran diterima otomatis (sampling)', DEPOSIT_REJECTED: 'Setoran ditolak', LOT_MERGED: 'Merge menjadi batch agregat', TRANSFER_SENT: 'Dikirim', TRANSFER_CONFIRMED: 'Serah terima dikonfirmasi', TRANSFER_DISPUTED: 'Selisih berat melewati toleransi', TRANSFER_RETURNED: 'Transfer dikembalikan', STORED: 'Disimpan di gudang', PROCESSED: 'Pengolahan gabah → beras', PACKAGED: 'Pengemasan · QR kemasan terbit', CARRIER_PICKUP: 'Diambil pengangkut', CARRIER_DELIVERED: 'Diantar pengangkut' };
function evText(e) {
  const p = e.payload || {}; const t = e.type;
  if (t === 'DEPOSIT_RECORDED') return `${kg(p.weightKg)} · nota ${p.notaNo} · QR ${p.qrCode}`;
  if (t.startsWith('DEPOSIT_V') || t === 'DEPOSIT_AUTO_ACCEPTED') return `${kg(p.weightKg)} · pemeriksaan ${p.checkMode === 'full' ? 'penuh' : 'sampling'}`;
  if (t === 'DEPOSIT_REJECTED') return p.reason;
  if (t === 'LOT_MERGED') return `${p.parents.length} batch induk · ${kg(p.weightKg)} · sub-lot tetap hidup`;
  if (t === 'TRANSFER_SENT') return `ke ${p.to} · ${kg(p.sentKg)}${p.viaException ? ' · pengecualian kirim langsung' : ''}`;
  if (t === 'TRANSFER_CONFIRMED') return `terima ${kg(p.receivedKg)} · selisih ${p.variancePct}%${p.resolved ? ' (putusan admin)' : ' (dalam toleransi)'}`;
  if (t === 'TRANSFER_DISPUTED') return `kirim ${kg(p.sentKg)} · terima ${kg(p.receivedKg)} · selisih ${p.variancePct}%`;
  if (t === 'PROCESSED') return `${kg(p.inputKg)} → ${kg(p.outputKg)} · rendemen ${p.yieldPct}% · dicatat sendiri oleh penggilingan`;
  if (t === 'PACKAGED') return `${p.qty} kemasan × ${p.packKg} kg · lot ${p.lot}`;
  if (t === 'STORED') return p.location;
  return e.actorName || '';
}
const short = (h, a = 6, b = 6) => (h ? h.slice(0, a + 2) + '…' + h.slice(-b) : '-');
const actorsOf = async (role) => api('/api/actors?role=' + role);
const SENDABLE = { pengepul: ['gudang'], gudang: ['distributor', 'retailer'], distributor: ['retailer'] };

async function sendModal(b) {
  const roles = SENDABLE[me.actor.role]; let to = []; for (const r of roles) to = to.concat(await actorsOf(r)); const car = await actorsOf('logistik');
  openModal({ title: `Kirim ${b.code}`, submit: 'Kirim', body: `<p class="small">${kg(b.weightKg)} · penerima harus mengonfirmasi berat terima (konfirmasi dua pihak).</p>${fld('toActorId', 'Penerima', { type: 'select', options: opts(to, '_id', (a) => `${a.name} (${ROLE[a.role]})`, 'Pilih penerima') })}${fld('carrierActorId', 'Pengangkut (opsional)', { type: 'select', required: false, options: opts(car, '_id', 'name', 'Tanpa pengangkut') })}${fld('note', 'Catatan', { required: false })}`, onSubmit: async (fd, close) => { await api('/api/transfers', { method: 'POST', body: { batchId: b._id, ...fd } }); close(); toast('Kiriman dibuat, menunggu konfirmasi penerima'); reload(); } });
}
const batchRows = (bs, actions) => bs.length ? `<div class="tw"><table><tr><th></th><th>Batch</th><th>Jenis</th><th>Komoditas</th><th>Berat</th><th>Status</th><th>QR</th><th></th></tr>${bs.map((b) => `<tr><td>${actions?.select && b.status === 'available' && ['deposit', 'merged'].includes(b.kind) ? `<input type="checkbox" class="sel" value="${b._id}">` : ''}</td><td class="mono"><a href="#/detail/${b._id}">${esc(b.code)}</a>${b.tainted ? ' <span class="chip bad">taint</span>' : ''}</td><td>${KIND[b.kind]}</td><td>${esc(b.commodity)}</td><td>${kg(b.weightKg)}</td><td>${chip(b.status)}</td><td class="mono">${esc(b.qrCode || b.meta?.lot || '-')}</td><td><div class="btns">${actions?.row ? actions.row(b) : ''}</div></td></tr>`).join('')}</table></div>` : '<div class="empty">Belum ada batch</div>';
const trfRows = (ts, o = {}) => ts.length ? `<div class="tw"><table><tr><th>Kode</th><th>Batch</th><th>Dari</th><th>Ke</th><th>Dikirim</th><th>Diterima</th><th>Selisih</th><th>Status</th><th></th></tr>${ts.map((t) => `<tr><td class="mono">${t.code}</td><td class="mono"><a href="#/detail/${t.batchId}">${esc(t.batchCode)}</a></td><td>${esc(t.from)}</td><td>${esc(t.to)}${t.carrier ? `<br><span class="small">via ${esc(t.carrier)}</span>` : ''}</td><td>${kg(t.sentKg)}<br><span class="small">${dt(t.sentAt)}</span></td><td>${t.receivedKg ? kg(t.receivedKg) : '-'}</td><td>${t.variancePct != null ? t.variancePct + '%' : '-'}</td><td>${chip(t.status)}${t.viaException ? '<br><span class="chip gray">kirim langsung</span>' : ''}</td><td>${o.row ? o.row(t) : ''}</td></tr>`).join('')}</table></div>` : '<div class="empty">Belum ada transfer</div>';

// ---------- Beranda (dashboard per peran pelaku) ----------
const sum = (a) => a.reduce((s, b) => s + (+b.weightKg || 0), 0);
const rowItem = (t) => `<div style="padding:8px 0;border-bottom:1px solid #EEF2EF">${t}</div>`;

S.beranda = async (m) => {
  if (me.role === 'admin') return S['admin-beranda'](m);
  const isCar = me.role === 'logistik';
  const [bs, ins, outs, car] = await Promise.all([
    isCar ? [] : api('/api/batches'), isCar ? [] : api('/api/transfers?box=in'),
    isCar ? [] : api('/api/transfers?box=out'), isCar ? api('/api/transfers?box=carrier') : [],
  ]);
  const avail = bs.filter((b) => b.status === 'available'), pend = bs.filter((b) => b.status === 'pending_verification');
  const inT = ins.filter((t) => t.status === 'in_transit'), outT = outs.filter((t) => t.status === 'in_transit');
  const disp = outs.concat(ins).filter((t) => t.status === 'disputed');
  let kp = '', left = '';
  if (me.role === 'pengepul') {
    const l = await api('/api/labels'); const dep = bs.filter((b) => b.kind === 'deposit');
    kp = kpi('Stok tersedia', kg(sum(avail)), `${avail.length} batch`, 'var(--g700)')
      + kpi('Menunggu verifikasi', pend.length, 'belum bisa digabung/dikirim', pend.length ? 'var(--amber)' : '')
      + kpi('Setoran tercatat', dep.length, 'seluruh waktu')
      + kpi('Kiriman keluar', outT.length, `${disp.length} sengketa`, disp.length ? 'var(--red)' : '')
      + kpi('Sisa label QR', l.labels.filter((x) => x.status === 'unassigned').length, `kuota ${l.used}/${l.quota} bulan ini`);
    left = '<div class="card"><h2>Tindakan cepat</h2><div class="btns"><a class="btn pri" href="#/setoran-baru">Catat setoran</a><a class="btn" href="#/batch">Gabung batch</a><a class="btn" href="#/kirim">Kirim ke gudang</a><a class="btn" href="#/label">Cetak label</a></div></div>';
  } else if (me.role === 'gudang') {
    const done = bs.filter((b) => b.status === 'processed');
    kp = kpi('Stok tersedia', kg(sum(avail)), `${avail.length} batch`, 'var(--g700)')
      + kpi('Kiriman masuk', inT.length, 'menunggu konfirmasi Anda', inT.length ? 'var(--amber)' : '')
      + kpi('Sudah diolah', done.length, 'batch hasil giling')
      + kpi('Kiriman keluar', outT.length, 'dalam perjalanan')
      + kpi('Sengketa', disp.length, 'selisih di luar toleransi', disp.length ? 'var(--red)' : '');
    left = '<div class="card"><h2>Tindakan cepat</h2><div class="btns"><a class="btn pri" href="#/terima">Terima barang</a><a class="btn" href="#/batch">Giling / simpan</a><a class="btn" href="#/kemasan">Kemas &amp; QR</a><a class="btn" href="#/kirim">Kirim</a></div></div>';
  } else if (me.role === 'distributor' || me.role === 'retailer') {
    const dist = me.role === 'distributor';
    kp = kpi('Stok tersedia', kg(sum(avail)), `${avail.length} batch`, 'var(--g700)')
      + kpi('Kiriman masuk', inT.length, 'menunggu konfirmasi Anda', inT.length ? 'var(--amber)' : '')
      + (dist ? kpi('Kiriman keluar', outT.length, 'dalam perjalanan') : kpi('Kiriman diterima', ins.filter((t) => t.status === 'done').length, 'selesai'))
      + kpi('Sengketa', disp.length, 'selisih di luar toleransi', disp.length ? 'var(--red)' : '');
    left = `<div class="card"><h2>Tindakan cepat</h2><div class="btns"><a class="btn pri" href="#/terima">Terima barang</a><a class="btn" href="#/batch">${dist ? 'Lihat batch' : 'Stok &amp; asal produk'}</a>${dist ? '<a class="btn" href="#/kirim">Kirim ke retailer</a>' : ''}</div></div>`;
  } else if (isCar) {
    const todo = car.filter((t) => t.status === 'in_transit' && !t.pickedAt);
    const going = car.filter((t) => t.status === 'in_transit' && t.pickedAt && !t.deliveredAt);
    const fin = car.filter((t) => t.deliveredAt || t.status === 'done');
    kp = kpi('Perlu diambil', todo.length, 'belum pickup', todo.length ? 'var(--amber)' : '')
      + kpi('Dalam perjalanan', going.length, 'belum diantar', 'var(--g700)')
      + kpi('Selesai diantar', fin.length, 'seluruh waktu')
      + kpi('Total ditugaskan', car.length, 'kiriman');
    const act = todo.concat(going).slice(0, 6);
    left = `<div class="card"><h2>Kiriman aktif</h2>${act.length ? act.map((t) => rowItem(`<span class="mono">${esc(t.code)}</span> ${t.pickedAt ? chip('info', 'Dalam perjalanan') : chip('wait', 'Perlu diambil')}<div class="small">${esc(t.from)} → ${esc(t.to)} · ${esc(t.commodity || '')}</div>`)).join('') : '<div class="empty">Tidak ada kiriman aktif</div>'}<div class="btns" style="margin-top:12px"><a class="btn pri" href="#/kiriman">Buka Kiriman Saya</a></div></div>`;
  }
  const inbox = isCar || me.role === 'pengepul' ? '' : `<div class="card"><h2>Kiriman masuk menunggu</h2>${inT.length ? trfRows(inT.slice(0, 5)) : '<div class="empty">Tidak ada</div>'}</div>`;
  const recent = isCar ? '' : `<div class="card"><h2>Batch terbaru</h2>${batchRows(bs.slice(0, 6))}</div>`;
  m.innerHTML = `<div class="grid g5" style="margin-bottom:16px">${kp}</div><div class="grid ${inbox ? 'g2' : ''}" style="margin-bottom:16px">${left}${inbox}</div>${recent}`;
};

// ---------- Pengepul: catat setoran ----------
const readPhoto = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, 900 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.75)); }; img.onerror = rej; img.src = fr.result; }; fr.onerror = rej; fr.readAsDataURL(file); });
S['setoran-baru'] = async (m) => {
  const [groups, lab, deps] = await Promise.all([api('/api/groups'), api('/api/labels'), api('/api/deposits')]); const photos = {};
  const free = lab.labels.filter((l) => l.status === 'unassigned');
  m.innerHTML = `<div class="grid g21"><div class="card"><h2>Catat setoran dari kelompok tani</h2><form id="df"><div class="row"><div>${fld('farmerGroupId', 'Kelompok tani', { type: 'select', options: opts(groups, '_id', (g) => `${g.name} — ${g.district}`, 'Pilih kelompok tani') })}</div><div>${fld('groupCode', 'Kode ketua (statis)', { type: 'password', ph: 'mis. SUM-4821' })}</div></div>
  <div class="row"><div>${fld('weightKg', 'Berat (kg)', { type: 'number', step: '0.1', min: '1' })}</div><div>${fld('notaNo', 'Nomor nota (unik)', { ph: 'NT-0192/KT-SR/X/2026' })}</div><div>${fld('commodity', 'Komoditas', { type: 'select', options: '<option value="gabah">Gabah</option>' })}</div></div>
  <label class="f">Label QR yang dipakai</label><div class="inp" style="background:var(--g50)">${free.length ? `<b class="mono">${esc(free[0].code)}</b> <span class="small">(otomatis, tersisa ${free.length})</span>` : 'Tidak ada label. <a href="#/label">Terbitkan label</a>'}</div>
  <div class="row"><div><label class="f">Foto timbangan</label><label class="photo" id="p1"><span>Ketuk untuk ambil/unggah foto</span><input type="file" accept="image/*" capture="environment"></label></div><div><label class="f">Foto nota bertanda tangan</label><label class="photo" id="p2"><span>Ketuk untuk ambil/unggah foto</span><input type="file" accept="image/*" capture="environment"></label></div></div>
  ${fld('note', 'Catatan', { required: false })}<div class="btns" style="margin-top:16px"><button class="btn pri" id="sub">Kirim untuk diverifikasi</button><span class="small" style="align-self:center">Boleh dicatat dulu, tetapi batch tidak bisa dikirim sebelum disetujui.</span></div><div id="res"></div></form></div>
  <div class="grid" style="align-content:start"><div class="card"><h2>Setelah dikirim</h2><div class="checks"><div><span class="ck">1</span>Sistem memeriksa kode ketua, nomor nota unik, kelengkapan foto, dan kewajaran jumlah.</div><div><span class="ck">2</span>Admin memverifikasi dalam 1×24 jam (penuh atau sampling).</div><div><span class="ck">3</span>Setelah disetujui, hash event dicatat ke blockchain dan batch bisa digabung atau dikirim.</div></div></div>
  <div class="card"><h2>Setoran terbaru</h2>${deps.slice(0, 5).map((d) => `<div style="padding:7px 0;border-bottom:1px solid #EEF2EF"><span class="mono">${esc(d.batchCode)}</span> ${chip(d.status)}<div class="small">${esc(d.groupName)} · ${kg(d.weightKg)}</div></div>`).join('') || '<div class="empty">Belum ada</div>'}</div></div></div>`;
  [['p1', 'scalePhoto'], ['p2', 'notaPhoto']].forEach(([id, k]) => { const el = $('#' + id); $('input', el).onchange = guard(async (e) => { const f = e.target.files[0]; if (!f) return; photos[k] = await readPhoto(f); el.innerHTML = `<img src="${photos[k]}" alt=""><input type="file" accept="image/*" style="display:none">`; $('input', el).onchange = null; }); });
  $('#df').onsubmit = guard(async (e) => { e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); if (!photos.scalePhoto || !photos.notaPhoto) return toast('Foto timbangan dan nota wajib', true); $('#sub').disabled = true; try { const d = await api('/api/deposits', { method: 'POST', body: { ...fd, ...photos } }); $('#res').innerHTML = `<div class="card" style="margin-top:14px;background:var(--g50)"><b>Setoran tercatat: ${chip(d.status)}</b><p class="small" style="margin-top:6px">${d.status === 'auto_accepted' ? 'Diterima otomatis (rutin, sampling tidak terpilih). Batch sudah tersedia.' : `Menunggu verifikasi admin · pemeriksaan ${d.checkMode === 'full' ? 'penuh' : 'sampling'} (${esc(d.checkReason)}).`}</p><a class="btn sm" href="#/detail/${d.batchId}">Lihat batch</a> <a class="btn sm" href="#/setoran-baru" onclick="setTimeout(reload,0)">Catat setoran lain</a></div>`; toast('Setoran tercatat'); } finally { $('#sub').disabled = false; } });
};
S.setoran = async (m) => { const ds = await api('/api/deposits'); m.innerHTML = `<div class="card"><h2>Setoran saya</h2>${ds.length ? `<div class="tw"><table><tr><th>Batch</th><th>Kelompok tani</th><th>Berat</th><th>Nota</th><th>Pemeriksaan</th><th>Status</th><th>Dicatat</th></tr>${ds.map((d) => `<tr><td class="mono"><a href="#/detail/${d.batchId}">${esc(d.batchCode)}</a></td><td>${esc(d.groupName)}</td><td>${kg(d.weightKg)}</td><td class="mono">${esc(d.notaNo)}</td><td>${d.checkMode === 'full' ? 'Penuh' : 'Sampling'} <span class="small">· ${esc(d.checkReason)}</span></td><td>${chip(d.status)}${d.rejectReason ? `<div class="small">${esc(d.rejectReason)}</div>` : ''}</td><td>${dt(d.createdAt)}</td></tr>`).join('')}</table></div>` : '<div class="empty">Belum ada setoran</div>'}</div>`; };

// ---------- Batch (dispatch per peran) ----------
S.batch = async (m) => {
  const bs = await api('/api/batches'); const r = me.actor.role; const acts = {};
  if (r === 'pengepul') { acts.select = true; acts.row = (b) => (b.status === 'available' ? `<button class="btn sm" data-send="${b._id}">Kirim</button>` : ''); }
  if (r === 'gudang') acts.row = (b) => (b.status !== 'available' ? '' : b.kind === 'packaged' ? `<button class="btn sm" data-send="${b._id}">Kirim</button>` : b.kind === 'processed' ? `<button class="btn sm" data-pack="${b._id}">Kemas</button>` : `<button class="btn sm" data-store="${b._id}">Simpan</button><button class="btn sm pri" data-proc="${b._id}">Giling</button>`);
  if (r === 'distributor') acts.row = (b) => (b.status === 'available' ? `<button class="btn sm" data-send="${b._id}">Kirim</button>` : '');
  if (r === 'retailer') acts.row = (b) => (b.meta?.lot ? `<a class="btn sm" href="/t/${esc(b.meta.lot)}" target="_blank">Halaman konsumen</a>` : '');
  m.innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">${r === 'retailer' ? 'Stok dan asal produk' : 'Batch dan lineage'}</h2>${r === 'pengepul' ? '<div class="btns" style="justify-content:flex-end;flex:none"><button class="btn pri sm" id="merge">Gabungkan terpilih</button></div>' : ''}</div>${r === 'pengepul' ? '<p class="small" style="margin:6px 0 10px">Batch yang masih menunggu verifikasi tidak bisa digabung atau dikirim. Sub-lot tetap tercatat di graf lineage setelah digabung.</p>' : ''}${batchRows(bs, acts)}</div>`;
  const byId = Object.fromEntries(bs.map((b) => [b._id, b]));
  m.querySelectorAll('[data-send]').forEach((b) => (b.onclick = guard(() => sendModal(byId[b.dataset.send]))));
  m.querySelectorAll('[data-store]').forEach((b) => (b.onclick = () => openModal({ title: 'Catat penyimpanan gudang', body: fld('location', 'Lokasi/gudang', { value: 'Gudang utama' }) + fld('note', 'Catatan', { required: false }), onSubmit: async (fd, c) => { await api(`/api/batches/${b.dataset.store}/store`, { method: 'POST', body: fd }); c(); toast('Penyimpanan tercatat'); reload(); } })));
  m.querySelectorAll('[data-proc]').forEach((b) => (b.onclick = () => { const x = byId[b.dataset.proc]; openModal({ title: `Giling ${x.code}`, submit: 'Catat hasil giling', body: `<p class="small">Input gabah ${kg(x.weightKg)}. Rendemen dicatat sendiri oleh penggilingan dan diberi label itu.</p>${fld('outputKg', 'Berat beras hasil (kg)', { type: 'number', step: '0.1', min: '1' })}${fld('variety', 'Varietas', { value: 'Pulen', required: false })}`, onSubmit: async (fd, c) => { await api(`/api/batches/${x._id}/process`, { method: 'POST', body: fd }); c(); toast('Hasil giling tercatat'); reload(); } }); }));
  m.querySelectorAll('[data-pack]').forEach((b) => (b.onclick = () => { const x = byId[b.dataset.pack]; openModal({ title: `Kemas ${x.code}`, submit: 'Terbitkan QR kemasan', body: `<p class="small">Stok beras ${kg(x.weightKg)}. Setiap lot kemasan mendapat QR baru untuk konsumen.</p>${fld('product', 'Nama produk', { value: 'Beras Premium Pulen 5 kg' })}${fld('packKg', 'Isi per kemasan (kg)', { type: 'number', value: 5 })}${fld('qty', 'Jumlah kemasan', { type: 'number', min: '1' })}`, onSubmit: async (fd, c) => { const nb = await api(`/api/batches/${x._id}/pack`, { method: 'POST', body: fd }); c(); toast('Lot ' + nb.meta.lot + ' terbit'); go('#/kemasan'); } }); }));
  const mg = $('#merge'); if (mg) mg.onclick = guard(async () => { const ids = [...m.querySelectorAll('.sel:checked')].map((x) => x.value); if (ids.length < 2) return toast('Pilih minimal 2 batch tersedia', true); await api('/api/batches/merge', { method: 'POST', body: { ids } }); toast('Batch digabung'); reload(); });
};
S.kemasan = async (m) => { const bs = await api('/api/batches'); const pk = bs.filter((b) => b.kind === 'packaged'), pr = bs.filter((b) => b.kind === 'processed' && b.status === 'available');
  m.innerHTML = `<div class="grid g2"><div class="card"><h2>Siap dikemas</h2>${pr.length ? pr.map((b) => `<div style="padding:8px 0;border-bottom:1px solid #EEF2EF"><span class="mono">${esc(b.code)}</span> · ${kg(b.weightKg)} <span class="small">rendemen ${b.meta?.yieldPct}%</span> <a class="btn sm" style="float:right" href="#/batch">Kemas</a></div>`).join('') : '<div class="empty">Tidak ada beras hasil giling yang tersedia</div>'}</div>
  <div class="card"><h2>Lot kemasan &amp; QR konsumen</h2>${pk.length ? `<div class="qrgrid">${pk.map((b) => `<div class="qrc"><img src="/qr/${encodeURIComponent(b.meta.lot)}.svg" alt="QR"><div class="mono">${esc(b.meta.lot)}</div><div>${b.meta.qty} × ${b.meta.packKg} kg</div>${chip(b.status)}<br><a href="/t/${esc(b.meta.lot)}" target="_blank">Buka halaman konsumen</a></div>`).join('')}</div>` : '<div class="empty">Belum ada lot kemasan</div>'}</div></div>`; };

// ---------- Terima / Kirim / Kiriman ----------
S.terima = async (m) => { const ts = await api('/api/transfers?box=in'); const open = ts.filter((t) => t.status === 'in_transit'), done = ts.filter((t) => t.status !== 'in_transit');
  m.innerHTML = `<div class="card" style="margin-bottom:16px"><h2>Menunggu konfirmasi Anda</h2>${trfRows(open, { row: (t) => `<button class="btn pri sm" data-c="${t._id}">Konfirmasi terima</button>` })}</div><div class="card"><h2>Riwayat</h2>${trfRows(done)}</div>`;
  const byId = Object.fromEntries(ts.map((t) => [t._id, t])); m.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { const t = byId[b.dataset.c]; openModal({ title: `Terima ${t.batchCode}`, submit: 'Konfirmasi', body: `<p class="small">Dikirim ${kg(t.sentKg)} oleh ${esc(t.from)}. Selisih di atas toleransi (${me.config.tolerancePct}%) otomatis menjadi sengketa untuk admin.</p>${fld('receivedKg', 'Berat terima aktual (kg)', { type: 'number', step: '0.1', value: t.sentKg })}`, onSubmit: async (fd, c) => { const r = await api(`/api/transfers/${t._id}/confirm`, { method: 'POST', body: fd }); c(); toast(r.status === 'disputed' ? `Selisih ${r.variancePct}%: masuk sengketa admin` : 'Serah terima dikonfirmasi'); reload(); } }); })); };
S.kirim = async (m) => { const ts = await api('/api/transfers?box=out'); m.innerHTML = `<div class="card"><h2>Kiriman keluar</h2><p class="small" style="margin-bottom:8px">Buat kiriman baru dari halaman <a href="#/batch">Batch</a>.</p>${trfRows(ts)}</div>`; };
S.kiriman = async (m) => { const ts = await api('/api/transfers?box=carrier'); m.innerHTML = `<div class="card"><h2>Kiriman yang saya angkut</h2>${trfRows(ts, { row: (t) => (t.status === 'in_transit' ? `${t.pickedAt ? '' : `<button class="btn sm" data-s="pickup" data-i="${t._id}">Ambil</button>`}${t.pickedAt && !t.deliveredAt ? `<button class="btn sm pri" data-s="deliver" data-i="${t._id}">Antar</button>` : ''}${t.deliveredAt ? '<span class="small">diantar</span>' : ''}` : '') })}</div>`;
  m.querySelectorAll('[data-s]').forEach((b) => (b.onclick = guard(async () => { await api(`/api/transfers/${b.dataset.i}/carrier`, { method: 'POST', body: { step: b.dataset.s } }); toast('Tercatat'); reload(); }))); };

// ---------- Label QR ----------
S.label = async (m) => { const r = await api('/api/labels');
  m.innerHTML = `<div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">Label QR hulu (dibuat sistem)</h2><div class="btns noprint" style="flex:none"><button class="btn pri sm" id="iss">Terbitkan 10 label</button><button class="btn sm" onclick="print()">Cetak</button></div></div><p class="small" style="margin:6px 0 12px">Kuota periode ini: ${r.used}/${r.quota}. Label ditempel petugas di karung saat barang masuk.</p>${r.labels.length ? `<div class="qrgrid">${r.labels.map((l) => `<div class="qrc"><img src="/qr/${encodeURIComponent(l.code)}.svg" alt="QR"><div class="mono">${esc(l.code)}</div>${chip(l.status === 'unassigned' ? 'pending' : l.status === 'assigned' ? 'verified' : 'voided', { unassigned: 'Belum dipakai', assigned: 'Terpasang', voided: 'Dibatalkan' }[l.status])}</div>`).join('')}</div>` : '<div class="empty">Belum ada label</div>'}</div>`;
  $('#iss').onclick = guard(async () => { await api('/api/labels', { method: 'POST', body: { n: 10 } }); toast('10 label diterbitkan'); reload(); }); };

// ---------- Detail batch ----------
S.detail = async (m, id) => {
  const d = await api('/api/batches/' + id); const b = d.batch; const anchored = d.events.filter((e) => e.anchorStatus === 'confirmed'); const last = anchored[anchored.length - 1];
  const gap = b.kind !== 'deposit' && d.events.some((e) => e.type === 'PROCESSED') && !d.events.some((e) => e.type === 'STORED');
  m.innerHTML = `<div class="btns" style="margin-bottom:12px"><a class="btn sm" href="javascript:history.back()">← Kembali</a></div><div class="grid g12"><div class="card"><div class="row" style="align-items:center"><h2 style="margin:0">Trace log · ${esc(b.code)}</h2>${chip(b.status)} <span class="chip ok">${d.events.length} event · ${anchored.length} tercatat di ledger</span></div>
  <p class="small" style="margin:8px 0 12px">${KIND[b.kind]} · ${esc(b.commodity)} · ${kg(b.weightKg)} · pemilik: ${esc(d.owner)}${b.tainted ? ' · <span class="chip bad">taint: turunan setoran yang ditolak</span>' : ''}</p>
  <div class="tl">${d.events.map((e) => `${gap && e.type === 'PROCESSED' ? '<div class="ev gap"><b style="color:var(--amber)">Penyimpanan gudang belum tercatat</b><div class="m">Celah ditampilkan apa adanya, tidak disambung otomatis.</div></div>' : ''}<div class="ev"><b>${esc(EVT[e.type] || e.type)}${e.batchCode !== b.code ? ` <span class="small">(${esc(e.batchCode)})</span>` : ''}</b><div class="m">${dt(e.at)} · ${esc(e.actorName)} · ${esc(evText(e))}</div><div class="m">${e.anchorStatus === 'confirmed' ? `<span class="mono">hash ${short(e.hash)}</span> · tx ${short(e.anchor.txId, 4, 4)} · blok #${e.anchor.block.toLocaleString('id-ID')}` : e.anchorStatus === 'not_required' ? 'tidak di-anchor (menunggu verifikasi)' : chip('pending', e.anchorStatus === 'failed' ? 'Anchor gagal' : 'Antre anchor')}${e.origin === 'superadmin' ? ` <span class="chip wait">dicatat administrator atas nama pelaku · ${esc(e.reason || '')}</span>` : ''}</div></div>`).join('')}</div></div>
  <div class="grid" style="align-content:start"><div class="chain"><h2>Blockchain · jejak integritas</h2><div class="row" style="gap:6px"><span class="chip ok">${last ? 'CONFIRMED' : 'BELUM ADA'}</span>${last ? '<span class="chip ok">HASH TERSIMPAN</span>' : ''}</div><div class="k">Jaringan</div><div class="v">${esc(me.network)}</div>${last ? `<div class="k">Hash payload event terakhir</div><div class="v">${esc(short(last.hash, 10, 10))}</div><div class="k">Transaction ID · blok</div><div class="v">${esc(short(last.anchor.txId, 8, 6))} · #${last.anchor.block.toLocaleString('id-ID')}</div>` : ''}<p class="small" style="color:#BFE0CA;margin-top:8px">Hanya hash dan referensi di ledger. Foto dan data rinci di database.</p>${b.meta?.lot ? `<a class="btn sm gold" style="margin-top:10px" href="/t/${esc(b.meta.lot)}" target="_blank">Buka halaman konsumen</a>` : ''}</div>
  <div class="card"><h2>Komposisi asal (dihitung proporsional)</h2>${compBar(d.composition)}<p class="small">Dihitung proporsional dari bobot setoran induk. Rendemen dan pengolahan dicatat sendiri oleh penggilingan.</p></div>
  ${d.parents.length ? `<div class="card"><h2>Batch induk (lineage)</h2>${d.parents.map((p) => `<div style="padding:6px 0;border-bottom:1px solid #EEF2EF"><a class="mono" href="#/detail/${p._id}">${esc(p.code)}</a> · ${KIND[p.kind]} · ${kg(p.weightKg)} ${chip(p.status)}</div>`).join('')}</div>` : ''}<div id="lin"></div></div></div>`;
  renderLineage($('#lin'), id);
};

const INT_LABEL = { ok: ['ok', 'Cocok dengan ledger'], tampered: ['bad', 'Data berubah sejak dicatat'], ledger_mismatch: ['bad', 'Tidak cocok dengan ledger'], not_in_ledger: ['bad', 'Tidak ada di ledger'], unanchored: ['wait', 'Belum di-anchor'], not_required: ['gray', 'Tidak perlu anchor'] };
async function renderLineage(el, id) {
  if (!el) return; el.innerHTML = '<div class="card" style="margin-top:16px"><div class="empty">Memuat garis keturunan…</div></div>';
  try {
    const l = await api('/api/batches/' + id + '/lineage'); const row = (x) => `<div style="padding:6px 0;border-bottom:1px solid #EEF2EF"><a class="mono" href="#/detail/${x._id}">${esc(x.code)}</a> · ${KIND[x.kind]} · ${kg(x.weightKg)} ${chip(x.status)}${x.owner ? ` <span class="small">${esc(x.owner)}</span>` : ''}</div>`;
    el.innerHTML = `<div class="card" style="margin-top:16px"><div class="row" style="align-items:center"><h2 style="margin:0">Garis keturunan</h2><div class="btns" style="flex:none"><button class="btn sm" id="vi">Periksa integritas</button></div></div>
    <h3>Hulu (${l.upstream.length})</h3>${l.upstream.length ? l.upstream.map(row).join('') : '<div class="small">Batch ini titik awal (setoran).</div>'}
    <h3>Hilir (${l.downstream.length})</h3>${l.downstream.length ? l.downstream.map(row).join('') : '<div class="small">Belum ada turunan.</div>'}
    <h3>Penerima tercatat (${l.recipients.length})</h3>${l.recipients.length ? l.recipients.map((r) => `<div class="small" style="padding:4px 0">${esc(r.transferCode)}: ${esc(r.from)} → ${esc(r.to)} · ${kg(r.sentKg)}${r.receivedKg != null ? ' (diterima ' + kg(r.receivedKg) + ')' : ''} ${chip(r.status)}</div>`).join('') : '<div class="small">Belum ada.</div>'}
    <h3>Posisi saat ini</h3>${l.holders.length ? l.holders.map((h) => `<div class="small" style="padding:4px 0">${esc(h.batch)} di ${esc(h.holder || '-')} · ${kg(h.weightKg)}</div>`).join('') : '<div class="small">Tidak ada stok aktif.</div>'}
    ${l.scans.total ? `<p class="small" style="margin-top:10px">Halaman konsumen dibuka ${l.scans.total}× (${l.scans.visitors} pengunjung unik-harian). Angka tinggi hanya sinyal untuk ditinjau.</p>` : ''}<div id="vres"></div></div>`;
    $('#vi').onclick = guard(async () => {
      const v = await api('/api/batches/' + id + '/integrity'); const s = v.summary;
      $('#vres').innerHTML = `<div style="margin-top:12px;padding:12px;border-radius:12px;background:${v.ok ? 'var(--g50)' : 'var(--red100)'}"><b>${v.ok ? 'Semua catatan cocok' : 'Ada ketidakcocokan'}</b> · ${v.checked} event diperiksa, rantai ${v.chain.ok ? 'utuh' : 'rusak'}${v.simulated ? ' (ledger simulasi)' : ''}
      <div class="small" style="margin-top:6px">${Object.entries(s).filter(([, n]) => n).map(([k, n]) => `${n} ${(INT_LABEL[k] || [0, k])[1].toLowerCase()}`).join(' · ')}</div>
      <p class="small" style="margin-top:6px">${esc(v.note)}</p></div>`;
    });
  } catch (e) { el.innerHTML = `<div class="card" style="margin-top:16px"><div class="empty">${esc(e.message)}</div></div>`; }
}

const PAL = ['#237A41', '#F2B21B', '#2E9150', '#245FA3', '#9A6212', '#C62F2F'];
function compBar(comp) { return `<div class="bar">${comp.map((c, i) => `<div title="${esc(c.name)}" style="width:${c.pct}%;background:${PAL[i % PAL.length]}"></div>`).join('')}</div><div class="small">${comp.map((c, i) => `<div><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${PAL[i % PAL.length]};margin-right:6px"></i><b>${c.pct}%</b> ${esc(c.name)} · ${esc(c.district)} <span class="chip ${c.rejected ? 'bad' : c.auto ? 'info' : 'ok'}">${c.rejected ? 'ditolak' : c.auto ? 'sebagian otomatis' : 'terverifikasi'}</span></div>`).join('')}</div>`; }
S.__no = async (m) => { m.innerHTML = '<div class="card"><div class="empty">Halaman belum tersedia</div></div>'; };
