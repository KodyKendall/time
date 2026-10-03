// Stage profiler: where does a rendered frame's wall-clock time actually go?
//
// The final render pipeline is four stages deep, and only the last of them writes a file:
//
//   1 draw      renderFrame() + gl.finish()          — all the GPU work, motion blur included
//   2 read      + engine.post.read()                 — 8.3 MB synchronous GPU -> CPU readback
//   3 post      + fetch POST to the local sink       — the same 8.3 MB over loopback HTTP
//   4 encode    + ffmpeg stdin (libx264)             — the encoder, at whatever preset
//
// Each stage is measured as a superset of the one before it, so the marginal cost of a stage
// is its time minus the previous stage's. Run it with the GPU otherwise idle.
//
//   node tools/profile.mjs --film one --w 1920 --from 100 --n 40
//   node tools/profile.mjs --film one --w 1920 --n 40 --preset veryfast --crf 16
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const WEB = path.join(ROOT, 'web');
const CHROME = process.env.CHROME || {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
}[process.platform];

const rest = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  const k = rest[i].replace(/^--/, '');
  args[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
}
const film = args.film || 'film';
const W = +(args.w || 1920);
const H = Math.round((W * 9) / 16);
const fps = +(args.fps || 30);
const N = +(args.n || 30);
const FROM = +(args.from ?? 0);
const PRESET = args.preset || 'slow';
const CRF = args.crf || '15';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
let frameSink = null;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/frame') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (frameSink) await frameSink(Buffer.concat(chunks));
    res.writeHead(200).end('ok');
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(WEB, p);
  if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('nope');
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const ANGLE = process.env.ANGLE || { win32: 'd3d11', darwin: 'metal' }[process.platform] || 'swiftshader';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu',
    '--disable-gpu-watchdog', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--js-flags=--max-old-space-size=${process.env.JS_HEAP_MB || 12288}`, '--window-size=1280,760'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/render.html?${new URLSearchParams({ w: String(W), film })}`);
await page.waitForFunction('!!window.TIME', { timeout: 60000 });
await page.evaluate('TIME.ready.then(() => true, (e) => { throw new Error("TIME init failed: " + (window.TIME.error || e)); })');

const times = Array.from({ length: N }, (_, i) => FROM + i / fps);
// warm up: the first frame of a scene also paints every layer, which is a one-off cost
await page.evaluate((t) => TIME.frame(t), FROM);
await page.evaluate(() => TIME.frame(0.001));

const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const ms = (f) => async () => { const t0 = process.hrtime.bigint(); await f(); return Number(process.hrtime.bigint() - t0) / 1e6; };
async function stage(label, fn) {
  const out = [];
  for (const t of times) out.push(await ms(() => fn(t))());
  const mean = out.reduce((a, b) => a + b, 0) / out.length;
  return { label, mean, median: median(out) };
}

const results = [];
results.push(await stage('draw', (t) => page.evaluate((t) => TIME.frame(t), t)));
results.push(await stage('+read', (t) => page.evaluate((t) => {
  const i = TIME.frame(t);
  TIME.engine.post.read(TIME._pbuf || (TIME._pbuf = new Uint8Array(TIME.W * TIME.H * 4)));
  return i;
}, t)));
frameSink = async () => {};                              // discard: measures transport only
results.push(await stage('+post', (t, i) => page.evaluate((t, u) => TIME.send(t, u), t, '/frame')));

// full pipeline, straight into x264 exactly as the renderer configures it
const ff = ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
  '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-tune', 'film', '-profile:v', 'high',
  '-level:v', '4.2', '-maxrate', '50M', '-bufsize', '100M', '-pix_fmt', 'yuv420p',
  path.join(ROOT, 'out', 'profile_probe.mp4')];
const proc = spawn('ffmpeg', ff, { stdio: ['pipe', 'ignore', 'ignore'] });
frameSink = (buf) => new Promise((resolve) => { if (!proc.stdin.write(buf)) proc.stdin.once('drain', resolve); else resolve(); });
results.push(await stage(`+encode (x264 ${PRESET} crf${CRF})`, (t) => page.evaluate((t, u) => TIME.send(t, u), t, '/frame')));
proc.stdin.end();
await new Promise((r) => proc.on('close', r));

console.log(`\n${film} @ ${W}x${H}, ${N} frames from t=${FROM}\n`);
console.log('  stage                          median ms   marginal ms   share');
let prev = 0;
const total = results[results.length - 1].median;
for (const r of results) {
  const marg = r.median - prev;
  console.log(`  ${r.label.padEnd(28)} ${r.median.toFixed(1).padStart(9)} ${marg.toFixed(1).padStart(13)} ${((marg / total) * 100).toFixed(0).padStart(6)}%`);
  prev = r.median;
}
console.log(`\n  full pipeline: ${total.toFixed(1)} ms/frame = ${(1000 / total).toFixed(2)} fps per worker\n`);
fs.rmSync(path.join(ROOT, 'out', 'profile_probe.mp4'), { force: true });
await browser.close();
server.close();
process.exit(0);
