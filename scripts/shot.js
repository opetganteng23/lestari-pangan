// Alat uji tampilan: membuka halaman di Chrome/Edge headless, menjalankan langkah JS, mengambil screenshot, dan melaporkan galat konsol.
// Pakai: node scripts/shot.js <url> <lebar> <tinggi> <berkas.png> [--steps "js1;;js2"] [--full]
// Langkah JS dijalankan berurutan di halaman (await didukung); hasil ekspresi terakhir dicetak. Hanya untuk pengembangan.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const CANDIDATES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
const [url, w, h, out] = process.argv.slice(2); const flag = (n) => process.argv.includes(n); const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const exe = CANDIDATES.find((c) => fs.existsSync(c)); if (!exe) throw new Error('Chrome/Edge tidak ditemukan');
  const port = 9300 + Math.floor(Math.random() * 500), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-'));
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let ws; for (let i = 0; i < 50; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find((x) => x.type === 'page'); if (p) { ws = p.webSocketDebuggerUrl; break; } } catch {} await sleep(200); }
    if (!ws) throw new Error('Tidak bisa menyambung ke browser'); const sock = new WebSocket(ws); await new Promise((r) => (sock.onopen = r));
    let id = 0; const pending = new Map(); const logs = [];
    sock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' ')); else if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || '')); };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 700 });
    if (flag('--reduced')) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await send('Page.navigate', { url }); await sleep(2500);
    for (const step of (arg('--steps') || '').split(';;').filter(Boolean)) {
      const r = await send('Runtime.evaluate', { expression: `(async()=>{${step}})()`, awaitPromise: true, returnByValue: true }); const v = r.result?.result; if (r.result?.exceptionDetails) logs.push('LANGKAH GAGAL: ' + r.result.exceptionDetails.exception?.description); else if (v && v.value !== undefined) console.log('=>', JSON.stringify(v.value)); await sleep(700);
    }
    const m = await send('Runtime.evaluate', { expression: 'JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight})', returnByValue: true }); const dims = JSON.parse(m.result.result.value);
    console.log(`lebar viewport ${dims.cw}px · lebar isi ${dims.sw}px · ${dims.sw > dims.cw + 1 ? 'ADA GULIR HORIZONTAL' : 'tanpa gulir horizontal'} · tinggi ${dims.sh}px`);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: flag('--full'), ...(flag('--full') ? { clip: { x: 0, y: 0, width: +w, height: Math.min(dims.sh, 12000), scale: 1 } } : {}) });
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64')); console.log('screenshot:', out);
    console.log(logs.length ? 'KONSOL:\n  ' + [...new Set(logs)].join('\n  ') : 'konsol bersih');
    sock.close();
  } finally { proc.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
})().catch((e) => { console.error(e.message); process.exit(1); });
