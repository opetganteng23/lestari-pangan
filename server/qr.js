// QR -> SVG memakai pustaka QRCode (Kazuhiko Arase, MIT) yang di-vendor di server/vendor/qr
const QRCode = require('./vendor/qr/index.js');
const ECL = require('./vendor/qr/QRErrorCorrectLevel.js');
function svg(text, { size = 220, margin = 2 } = {}) {
  const q = new QRCode(-1, ECL.M); q.addData(text); q.make();
  const n = q.getModuleCount(), t = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + margin},${r + margin}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#12472A"/></svg>`;
}
module.exports = { svg };
