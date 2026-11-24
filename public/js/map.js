// Peta sebaran: Leaflet dari /vendor (disalin lokal) + tile OpenStreetMap. Titik berdekatan dikelompokkan (cluster),
// titik beranomali diberi cincin merah. Bila Leaflet atau tile gagal dimuat, rekap tabel per wilayah dibuka otomatis.
// Titik ditempatkan di pusat kabupaten/kota (bukan lokasi bangunan); pelaku tanpa koordinat tidak digambar tetapi tetap ada di tabel.
let _leaf = null;
function loadLeaflet() {
  if (typeof L !== 'undefined' && L.markerClusterGroup) return Promise.resolve();
  return (_leaf ||= new Promise((ok, no) => {
    const css = (h) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.appendChild(l); };
    const js = (s) => new Promise((res, rej) => { const e = document.createElement('script'); e.src = s; e.onload = res; e.onerror = () => rej(new Error('gagal memuat ' + s)); document.head.appendChild(e); });
    css('/vendor/leaflet/leaflet.css'); css('/vendor/markercluster/MarkerCluster.css'); css('/vendor/markercluster/MarkerCluster.Default.css');
    js('/vendor/leaflet/leaflet.js').then(() => js('/vendor/markercluster/leaflet.markercluster.js')).then(ok, (e) => { _leaf = null; no(e); });
  }));
}
const regionOf = (p) => String(p.district || '').split(',').pop().trim() || '(tanpa wilayah)';
const hasLoc = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat !== null && p.lng !== null;
// Rekap per wilayah: jumlah titik per jenis dan jumlah yang beranomali.
function regionTable(pts) {
  const by = {}; pts.forEach((p) => { const r = (by[regionOf(p)] ||= { n: {}, flag: 0, noLoc: 0 }); r.n[p.type] = (r.n[p.type] || 0) + 1; if (p.flagged) r.flag++; if (!hasLoc(p)) r.noLoc++; });
  const types = Object.keys(TCOL), rows = Object.entries(by).sort((a, b) => a[0].localeCompare(b[0], 'id'));
  if (!rows.length) return '<div class="empty">Belum ada pelaku atau kelompok tani terdaftar</div>';
  return `<div class="tw"><table><tr><th>Wilayah</th>${types.map((t) => `<th>${esc(TCOL[t][1])}</th>`).join('')}<th>Anomali</th></tr>${rows.map(([r, v]) => `<tr><td>${esc(r)}${v.noLoc ? ` <span class="chip gray">${v.noLoc} tanpa lokasi</span>` : ''}</td>${types.map((t) => `<td>${v.n[t] || '-'}</td>`).join('')}<td>${v.flag ? `<span class="chip bad">${v.flag}</span>` : '-'}</td></tr>`).join('')}</table></div>`;
}
const mapBox = (pts) => `<div class="map"><div id="lmap" class="lmap" role="group" aria-label="Peta sebaran kelompok tani dan pelaku rantai pasok. Gunakan tombol plus dan minus atau tombol panah untuk zoom dan geser."></div><div id="mhint" class="map-hint" role="status" aria-live="polite"></div></div><div class="legend">${Object.values(TCOL).map((c) => `<span><i style="background:${c[0]}"></i>${c[1]}</span>`).join('')}<span><i style="background:#fff;border:3px solid #C62F2F;width:6px;height:6px"></i>ada anomali</span></div><p class="small">Titik berada di pusat kabupaten / kota; titik berdekatan dikelompokkan, klik atau perbesar untuk memisahkan.</p><details id="mtab" style="margin-top:8px"><summary class="small" style="cursor:pointer">Rekap per wilayah</summary>${regionTable(pts)}</details>`;
async function drawMap(root, pts) {
  const open = (why) => { const d = root.querySelector && root.querySelector('#mtab'); if (d) d.open = true; const b = root.querySelector && root.querySelector('#lmap'); if (b && why) b.innerHTML = `<div class="empty" style="padding:28px 12px">${esc(why)}</div>`; };
  try {
    const el = root.querySelector('#lmap'); if (!el) return; await loadLeaflet();
    // Layar sentuh: satu jari menggulir halaman (dragging/tap mati => Leaflet memakai touch-action: pan-x pan-y), dua jari = zoom dan geser (touchZoom).
    // Mouse: zoom scroll baru aktif setelah peta diklik/difokus agar gulir halaman tidak terjebak.
    const touch = !!((L.Browser && L.Browser.mobile) || (window.matchMedia && matchMedia('(pointer: coarse)').matches));
    const map = L.map(el, { scrollWheelZoom: false, zoomControl: true, dragging: !touch, tap: !touch, touchZoom: true, keyboard: true }).setView([-6.7, 107.9], 8); let bad = 0, ok = 0;
    const hint = root.querySelector('#mhint'); let ht = 0; const seen = (k) => { try { return sessionStorage.getItem(k) === '1'; } catch { return false; } }; const mark = (k) => { try { sessionStorage.setItem(k, '1'); } catch { /* tanpa sessionStorage: petunjuk bisa muncul lagi */ } };
    const say = (key, text) => { if (!hint || seen(key)) return; mark(key); hint.textContent = text; hint.classList.add('show'); clearTimeout(ht); ht = setTimeout(() => { hint.classList.remove('show'); }, 2600); };
    if (touch) { el.addEventListener('touchstart', (e) => { if (e.touches && e.touches.length === 1) say('lp_mh_t', 'Gunakan dua jari untuk menggeser dan zoom peta'); }, { passive: true }); }
    else {
      let on = false; const set = (v) => { on = v; if (v) map.scrollWheelZoom.enable(); else map.scrollWheelZoom.disable(); if (v && hint) hint.classList.remove('show'); };
      map.on('click', () => set(true)); el.addEventListener('focus', () => set(true)); el.addEventListener('blur', () => set(false)); el.addEventListener('mouseleave', () => { if (document.activeElement !== el) set(false); });
      el.addEventListener('mouseenter', () => { if (!on) say('lp_mh_d', 'Klik peta lalu scroll untuk zoom'); });
      el.addEventListener('wheel', () => { if (!on) say('lp_mh_d', 'Klik peta lalu scroll untuk zoom'); }, { passive: true });
    }
    // Ukuran mengikuti kontainer tanpa membuat ulang peta atau mereset posisi/zoom pengguna.
    let raf = 0; const fit = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (!el.isConnected) return; map.invalidateSize({ pan: false }); }); };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(el); window.addEventListener('resize', fit); window.addEventListener('orientationchange', fit);
    const tl = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, referrerPolicy: 'origin', attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
    tl.on('tileload', () => { ok++; }); tl.on('tileerror', () => { if (++bad >= 4 && !ok) open(); });
    const cl = L.markerClusterGroup({ maxClusterRadius: 38, spiderfyOnMaxZoom: true, showCoverageOnHover: false, iconCreateFunction: (c) => { const n = c.getChildCount(), f = c.getAllChildMarkers().some((m) => m.options.flagged); return L.divIcon({ html: `<div><span>${n}</span></div>`, className: `marker-cluster marker-cluster-${n < 10 ? 'small' : n < 50 ? 'medium' : 'large'}${f ? ' lp-flag' : ''}`, iconSize: [40, 40] }); } });
    const placed = pts.filter(hasLoc);
    placed.forEach((p) => { const col = (TCOL[p.type] || ['#888'])[0]; cl.addLayer(L.circleMarker([p.lat, p.lng], { radius: p.type === 'kelompok_tani' ? 7 : 9, fillColor: col, fillOpacity: 0.95, color: p.flagged ? '#C62F2F' : '#fff', weight: p.flagged ? 3 : 2, flagged: !!p.flagged }).bindTooltip(`${esc(p.name)} · ${esc(p.district || '-')}${p.flagged ? ' · ada anomali' : ''}`)); });
    map.addLayer(cl); if (placed.length) map.fitBounds(cl.getBounds().pad(0.2), { maxZoom: 11 });
    if (placed.length < pts.length) { const d = root.querySelector('#mtab'); if (d) d.open = true; }
  } catch (e) { open('Peta tidak dapat dimuat (periksa koneksi). Rekap per wilayah ditampilkan di bawah.'); }
}
