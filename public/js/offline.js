// Offline-first untuk Catat Setoran: antrean di IndexedDB, sinkron saat online, dengan Idempotency-Key agar tidak ganda.
const OFF = (() => {
  const DB = 'lp-offline', ST = 'deposits'; let dbp;
  const open = () => (dbp ||= new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(ST, mode); const out = fn(t.objectStore(ST)); t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error); }); };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(16).slice(2));
  let syncing = false;
  const api_ = {
    supported: () => typeof indexedDB !== 'undefined',
    key: uid,
    async add(payload, idem) { const rec = { id: idem || uid(), userId: me?.user?._id, capturedAt: new Date().toISOString(), payload, status: 'menunggu', error: null, tries: 0 }; rec.payload = { ...payload, capturedAt: rec.capturedAt }; await tx('readwrite', (s) => s.put(rec)); return rec; },
    async list() { if (!api_.supported()) return []; return (await tx('readonly', (s) => s.getAll())).filter((r) => r.userId === me?.user?._id).sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : 1)); },
    async remove(id) { await tx('readwrite', (s) => s.delete(id)); },
    async patch(id, p) { const all = await tx('readonly', (s) => s.get(id)); if (all) await tx('readwrite', (s) => s.put({ ...all, ...p })); },
    // Kirim semua antrean berurutan. 4xx (mis. nota ganda) ditandai "gagal" dengan alasan dan menunggu keputusan pengguna.
    async sync() {
      if (syncing || !navigator.onLine || !me || !api_.supported()) return { sent: 0, failed: 0 }; syncing = true; let sent = 0, failed = 0;
      try {
        for (const r of await api_.list()) {
          if (r.status === 'gagal') continue;
          try { await api('/api/deposits', { method: 'POST', body: r.payload, headers: { 'idempotency-key': r.id }, noLogout: true }); await api_.remove(r.id); sent++; }
          catch (e) { if (e instanceof TypeError) break; /* jaringan putus lagi */ failed++; await api_.patch(r.id, { status: 'gagal', error: e.message, tries: r.tries + 1 }); }
        }
      } finally { syncing = false; }
      if (sent) toast(`${sent} setoran offline berhasil dikirim`); if (failed) toast(`${failed} setoran offline ditolak server; periksa di Setoran Saya`, true);
      return { sent, failed };
    },
  };
  window.addEventListener('online', () => api_.sync().then(() => { if (curRoute === 'setoran') reload(); }));
  return api_;
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// Setoran Saya: tambahkan kartu antrean offline di atas daftar
S._setoranBase = S.setoran;
S.setoran = async (m) => {
  await S._setoranBase(m); const q = await OFF.list(); if (!q.length) return;
  m.insertAdjacentHTML('afterbegin', `<div class="card" style="margin-bottom:16px;background:var(--amber100)"><div class="row" style="align-items:center"><h2 style="margin:0">Antrean offline (${q.length})</h2><div class="btns" style="flex:none"><button class="btn sm pri" id="os">Kirim sekarang</button></div></div>
  <div class="tw"><table><tr><th>Diambil</th><th>Nota</th><th>Berat</th><th>Status</th><th></th></tr>${q.map((r) => `<tr><td>${dt(r.capturedAt)}</td><td class="mono">${esc(r.payload.notaNo)}</td><td>${kg(r.payload.weightKg)}</td><td>${r.status === 'gagal' ? `<span class="chip bad">Ditolak</span> <span class="small">${esc(r.error)}</span>` : '<span class="chip wait">Menunggu jaringan</span>'}</td><td><button class="btn sm dan" data-oq="${esc(r.id)}">Hapus</button></td></tr>`).join('')}</table></div><p class="small">Setoran yang ditolak server tidak hilang otomatis; hapus lalu catat ulang dengan data yang benar.</p></div>`);
  $('#os').onclick = guard(async () => { for (const r of q) if (r.status === 'gagal') await OFF.patch(r.id, { status: 'menunggu', error: null }); const x = await OFF.sync(); if (!x.sent && !x.failed) toast('Belum ada jaringan', true); reload(); });
  m.querySelectorAll('[data-oq]').forEach((b) => (b.onclick = guard(async () => { if (confirm('Hapus setoran offline ini?')) { await OFF.remove(b.dataset.oq); reload(); } })));
};
