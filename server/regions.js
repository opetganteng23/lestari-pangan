// Daftar wilayah resmi (kabupaten/kota) beserta titik pusat. Satu-satunya sumber koordinat pelaku dan kelompok tani:
// koordinat diturunkan dari wilayah yang dipilih, tidak pernah diisi default diam-diam dan tidak diterima dari klien.
// Cakupan saat ini: Jawa Barat dan Banten (wilayah pilot). Tambah wilayah baru cukup dengan menambah baris di REGIONS.
// Titik pusat berupa pendekatan (sekitar pusat wilayah), cukup untuk peta tingkat kabupaten, bukan lokasi bangunan.
const REGIONS = [
  // [nama, provinsi, lat, lng]
  ['Kabupaten Bogor', 'Jawa Barat', -6.55, 106.8], ['Kabupaten Sukabumi', 'Jawa Barat', -7.0, 106.75], ['Kabupaten Cianjur', 'Jawa Barat', -6.82, 107.14],
  ['Kabupaten Bandung', 'Jawa Barat', -7.02, 107.55], ['Kabupaten Garut', 'Jawa Barat', -7.21, 107.9], ['Kabupaten Tasikmalaya', 'Jawa Barat', -7.35, 108.1],
  ['Kabupaten Ciamis', 'Jawa Barat', -7.33, 108.35], ['Kabupaten Kuningan', 'Jawa Barat', -6.98, 108.48], ['Kabupaten Cirebon', 'Jawa Barat', -6.75, 108.55],
  ['Kabupaten Majalengka', 'Jawa Barat', -6.84, 108.23], ['Kabupaten Sumedang', 'Jawa Barat', -6.86, 107.92], ['Kabupaten Indramayu', 'Jawa Barat', -6.33, 108.32],
  ['Kabupaten Subang', 'Jawa Barat', -6.57, 107.76], ['Kabupaten Purwakarta', 'Jawa Barat', -6.55, 107.44], ['Kabupaten Karawang', 'Jawa Barat', -6.32, 107.34],
  ['Kabupaten Bekasi', 'Jawa Barat', -6.24, 107.15], ['Kabupaten Bandung Barat', 'Jawa Barat', -6.84, 107.49], ['Kabupaten Pangandaran', 'Jawa Barat', -7.68, 108.65],
  ['Kota Bogor', 'Jawa Barat', -6.6, 106.8], ['Kota Sukabumi', 'Jawa Barat', -6.92, 106.93], ['Kota Bandung', 'Jawa Barat', -6.92, 107.61],
  ['Kota Cirebon', 'Jawa Barat', -6.71, 108.56], ['Kota Bekasi', 'Jawa Barat', -6.24, 106.99], ['Kota Depok', 'Jawa Barat', -6.4, 106.82],
  ['Kota Cimahi', 'Jawa Barat', -6.87, 107.54], ['Kota Tasikmalaya', 'Jawa Barat', -7.33, 108.22], ['Kota Banjar', 'Jawa Barat', -7.37, 108.54],
  ['Kabupaten Pandeglang', 'Banten', -6.31, 106.1], ['Kabupaten Lebak', 'Banten', -6.56, 106.25], ['Kabupaten Tangerang', 'Banten', -6.18, 106.49],
  ['Kabupaten Serang', 'Banten', -6.12, 106.15], ['Kota Tangerang', 'Banten', -6.18, 106.63], ['Kota Cilegon', 'Banten', -6.0, 106.05],
  ['Kota Serang', 'Banten', -6.12, 106.15], ['Kota Tangerang Selatan', 'Banten', -6.29, 106.71],
].map(([name, province, lat, lng]) => Object.freeze({ id: name.toLowerCase().replace(/\s+/g, '-'), name, province, kind: name.startsWith('Kota ') ? 'kota' : 'kabupaten', lat, lng }));

const norm = (s) => String(s || '').toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
const INDEX = new Map();
for (const r of REGIONS) { INDEX.set(norm(r.name), r); INDEX.set(r.id, r); }
// Penulisan lama/singkat: "Kab. X" dan "X" saja. Nama tanpa awalan dianggap kabupaten, kecuali "Bandung"
// (data lama memakai "Bandung" untuk kota) dan wilayah yang hanya ada sebagai kota.
for (const r of REGIONS) {
  const bare = norm(r.name.replace(/^(Kabupaten|Kota) /, ''));
  if (r.kind === 'kabupaten') { INDEX.set(norm('Kab ' + r.name.slice(10)), r); if (!INDEX.has(bare)) INDEX.set(bare, r); }
  else if (!INDEX.has(bare) && !REGIONS.some((x) => x.kind === 'kabupaten' && x.name === 'Kabupaten ' + r.name.slice(5))) INDEX.set(bare, r);
}
INDEX.set('bandung', REGIONS.find((r) => r.name === 'Kota Bandung'));

// Mengurai masukan seperti "Subang", "Kab. Subang", atau "Pagaden, Subang" (kecamatan, wilayah). Mengembalikan null bila tak dikenal.
function parse(input) {
  const parts = String(input || '').split(',').map((x) => x.trim()).filter(Boolean); if (!parts.length) return null;
  const region = INDEX.get(norm(parts[parts.length - 1])); if (!region) return null;
  return { region, kecamatan: parts.length > 1 ? parts.slice(0, -1).join(', ') : '' };
}
// Hasil siap simpan untuk pelaku: nama wilayah baku + koordinat dari wilayah. Opsi keepKecamatan menyimpan "Kecamatan, Wilayah".
function locate(input, { keepKecamatan = false, kecamatan = '' } = {}) {
  const p = parse(input); if (!p) return null; const kec = String(kecamatan || p.kecamatan || '').trim();
  return { district: keepKecamatan && kec ? `${kec}, ${p.region.name}` : p.region.name, kecamatan: kec, lat: p.region.lat, lng: p.region.lng, regionId: p.region.id, region: p.region };
}
const list = () => REGIONS.map(({ id, name, province, kind, lat, lng }) => ({ id, name, province, kind, lat, lng }));
// Titik lama yang pernah diisi default diam-diam (sebelum wilayah wajib) dan perlu dimigrasi.
const isLegacyDefault = (lat, lng) => (+lat === -6.6 && +lng === 107.6) || (+lat === -6.55 && +lng === 107.7);

module.exports = { REGIONS, list, parse, locate, isLegacyDefault };
