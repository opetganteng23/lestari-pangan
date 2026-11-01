// Menulis vercel.json: file statis dari public/, dan /api, /uploads, /qr diteruskan ke backend (VPS/tunnel).
// Pakai: node scripts/make-vercel-json.js https://lestari-api.contoh.id
const fs = require('fs'), path = require('path');
const origin = String(process.argv[2] || '').replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) { console.error('Beri alamat backend berbentuk https://host (tanpa path), mis. https://lestari-api.contoh.id'); process.exit(1); }
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const cfg = {
  framework: null, buildCommand: '', installCommand: '', outputDirectory: 'public', cleanUrls: false,
  rewrites: [
    { source: '/api/:path*', destination: `${origin}/api/:path*` },
    { source: '/uploads/:path*', destination: `${origin}/uploads/:path*` },
    { source: '/qr/:path*', destination: `${origin}/qr/:path*` },
    { source: '/t/:path*', destination: '/trace.html' },
  ],
  headers: [
    { source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' }, { key: 'Content-Security-Policy', value: csp },
      { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' }] },
    { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    { source: '/js/(.*)', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    { source: '/css/(.*)', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
  ],
};
fs.writeFileSync(path.join(__dirname, '..', 'vercel.json'), JSON.stringify(cfg, null, 2) + '\n');
console.log('vercel.json ditulis. Backend: ' + origin);
