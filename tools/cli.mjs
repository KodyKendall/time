// TIME render CLI: serves web/, drives headless Chrome (GPU) with puppeteer-core, and
// renders stills, contact sheets, benchmarks and the final video (raw RGBA -> ffmpeg).
//
//   node tools/cli.mjs still  --film film --w 1920 --t 3.5 --t 7 [--name foo]
//   node tools/cli.mjs sheet  --film film --w 1280 --from 0 --to 10 --n 12 [--cols 4 --tw 480 --name foo]
//   node tools/cli.mjs bench  --film film --w 3840 --t 1 --t 2
//   node tools/cli.mjs render --film film --w 3840 --fps 30 [--from 0 --to 150] [--audio a.wav] [--out out/time.mp4]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const WEB = path.join(ROOT, 'web');
const OUT = path.join(ROOT, 'out');
const CHROME = process.env.CHROME || {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
}[process.platform];

// ------------------------------------------------------------------ args
const [cmd, ...rest] = process.argv.slice(2);
const args = { t: [] };
for (let i = 0; i < rest.length; i++) {
  const k = rest[i].replace(/^--/, '');
  const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
  if (k === 't') args.t.push(+v);
  else args[k] = v;
}
const film = args.film || 'film';
const W = +(args.w || 1920);
const H = Math.round((W * 9) / 16);

// ------------------------------------------------------------------ server
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.css': 'text/css', '.txt': 'text/plain', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf' };
let frameSink = null; // (buffer) => Promise
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/frame') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const buf = Buffer.concat(chunks);
      if (frameSink) await frameSink(buf, url.searchParams);
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = path.join(WEB, p);
    if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ------------------------------------------------------------------ browser
const ANGLE = process.env.ANGLE || { win32: 'd3d11', darwin: 'metal' }[process.platform] || 'swiftshader';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: args.headful ? false : true,
  protocolTimeout: 0,
  args: [
    // ANGLE backend: d3d11 on Windows, metal on macOS, swiftshader (CPU WebGL; slow, fine for
    // previews) on a Linux box with no GPU. Override with ANGLE=vulkan|gl on a Linux GPU machine.
    // JS_HEAP_MB caps V8 memory.
    `--use-angle=${ANGLE}`,
    ...(ANGLE === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : []),
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu',
    '--disable-gpu-watchdog', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', `--js-flags=--max-old-space-size=${process.env.JS_HEAP_MB || 12288}`,
    '--enable-features=SharedArrayBuffer', `--window-size=1280,760`,
  ],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => {
  const s = `[page:${m.type()}] ${m.text()}`;
  logs.push(s);
  if (args.verbose || m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') console.log(s);
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText));
page.on('response', (r) => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()); });
const qs = new URLSearchParams({ w: String(W), film, ...(args.release ? { release: args.release } : {}), ...(args.only ? { only: args.only } : {}), ...(args.strict ? { strict: args.strict } : {}), ...(args.twopt ? { twopt: args.twopt } : {}), ...(args.blur ? { blur: args.blur } : {}) });
await page.goto(`http://127.0.0.1:${PORT}/render.html?${qs}`);
await page.waitForFunction('!!window.TIME', { timeout: 60000 });
await page.evaluate('TIME.ready.then(() => true, (e) => { throw new Error("TIME init failed: " + (window.TIME.error || e)); })');

const saveDataUrl = (dataUrl, file) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', path.relative(ROOT, file));
};

async function done(code = 0) {
  await browser.close();
  server.close();
  process.exit(code);
}

try {
  if (cmd === 'still') {
    const times = args.t.length ? args.t : [0];
    for (const t of times) {
      const t0 = Date.now();
      const url = await page.evaluate((t, s) => TIME.png(t, { scale: s }), t, +(args.scale || 1));
      const name = args.name ? `${args.name}_${t.toFixed(2)}` : `${film}_${t.toFixed(2)}`;
      saveDataUrl(url, path.join(OUT, 'stills', `${name}.png`));
      console.log(`  t=${t} ${Date.now() - t0}ms`);
    }
    console.log(JSON.stringify(await page.evaluate(() => TIME.stats())));
  } else if (cmd === 'sheet') {
    const from = +(args.from ?? 0), to = +(args.to ?? 10), n = +(args.n ?? 12);
    const times = args.t.length ? args.t : Array.from({ length: n }, (_, i) => from + ((to - from) * i) / Math.max(1, n - 1));
    const t0 = Date.now();
    const url = await page.evaluate((times, o) => TIME.sheet(times, o), times, { cols: +(args.cols || 4), tw: +(args.tw || 480) });
    saveDataUrl(url, path.join(OUT, 'sheets', `${args.name || film}.png`));
    console.log(`  ${times.length} frames in ${Date.now() - t0}ms`);
  } else if (cmd === 'bench') {
    const times = args.t.length ? args.t : [0, 1, 2];
    for (const t of times) {
      const a = await page.evaluate((t) => TIME.frame(t), t);
      const b = await page.evaluate((t) => TIME.frame(t), t + 1 / 30);
      console.log(`t=${t}: first ${a.ms.toFixed(0)}ms (${a.samples} samples), next ${b.ms.toFixed(0)}ms`);
    }
    console.log(JSON.stringify(await page.evaluate(() => TIME.stats())));
  } else if (cmd === 'render') {
    const fps = +(args.fps || 30);
    const duration = await page.evaluate(() => TIME.film.duration);
    const from = +(args.from ?? 0), to = +(args.to ?? duration);
    const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
    const out = path.resolve(ROOT, args.out || `out/${film}_${W}.mp4`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const vcodec = args.codec || 'libx264';
    const ff = [
      '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
      ...(args.audio ? ['-ss', String(from), '-i', path.resolve(ROOT, args.audio)] : []),
      '-map', '0:v', ...(args.audio ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-shortest'] : []),
      '-c:v', vcodec,
      // player-compatible H.264: High profile, level 5.1 (4K30) / 4.2 (1080p) with matching VBV limits
      ...(vcodec === 'libx264' ? ['-preset', args.preset || 'slow', '-crf', args.crf || '15', '-tune', 'film', '-profile:v', 'high',
        ...(W > 1920 ? ['-level:v', '5.1', '-maxrate', '135M', '-bufsize', '270M'] : ['-level:v', '4.2', '-maxrate', '50M', '-bufsize', '100M'])] : []),
      ...(vcodec === 'libx265' ? ['-preset', args.preset || 'slow', '-crf', args.crf || '16', '-tag:v', 'hvc1'] : []),
      '-pix_fmt', args.pixfmt || 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-movflags', '+faststart', out.replace(/\.mp4$/, '.partial.mp4'),
    ];
    const proc = spawn('ffmpeg', ff, { stdio: ['pipe', 'ignore', 'pipe'] });
    let fferr = '';
    proc.stderr.on('data', (d) => { fferr = (fferr + d).slice(-4000); });
    const procDone = new Promise((r) => proc.on('close', r));
    frameSink = (buf) => new Promise((resolve, reject) => {
      if (buf.length !== W * H * 4) return reject(new Error(`bad frame size ${buf.length}`));
      if (!proc.stdin.write(buf)) proc.stdin.once('drain', resolve);
      else resolve();
    });
    const tStart = Date.now();
    let lastLog = 0;
    // frames may arrive out of order (parallel uploads): write them to ffmpeg strictly in order
    const pendingFrames = new Map();
    let nextToWrite = f0;
    const writeInOrder = async () => {
      while (pendingFrames.has(nextToWrite)) {
        const buf = pendingFrames.get(nextToWrite);
        pendingFrames.delete(nextToWrite);
        if (!proc.stdin.write(buf)) await new Promise((r) => proc.stdin.once('drain', r));
        nextToWrite++;
      }
    };
    let writing = Promise.resolve();
    frameSink = (buf, params) => {
      if (buf.length !== W * H * 4) return Promise.reject(new Error(`bad frame size ${buf.length}`));
      pendingFrames.set(+params.get('i'), buf);
      writing = writing.then(writeInOrder);
      return writing;
    };
    for (let f = f0; f < f1; f++) {
      const t = f / fps;
      const info = await page.evaluate((t, u, i) => TIME.sendAsync(t, u, i), t, `/frame?i=${f}`, f);
      const now = Date.now();
      if (now - lastLog > 5000 || f === f1 - 1) {
        lastLog = now;
        const done = f - f0 + 1, el = (now - tStart) / 1000;
        const eta = (el / done) * (f1 - f0 - done);
        console.log(`frame ${f}/${f1} t=${t.toFixed(2)} samples=${info.samples} [${info.scenes.join(',')}] avg ${(el / done).toFixed(2)}s/f eta ${(eta / 60).toFixed(1)}min`);
      }
    }
    await page.evaluate(() => TIME.flushSends());
    await writing;
    if (nextToWrite !== f1) console.log(`WARNING: wrote ${nextToWrite - f0} of ${f1 - f0} frames`);
    proc.stdin.end();
    const code = await procDone;
    if (code !== 0) console.log(fferr);
    else fs.renameSync(out.replace(/\.mp4$/, '.partial.mp4'), out);
    console.log(`wrote ${path.relative(ROOT, out)} in ${((Date.now() - tStart) / 60000).toFixed(1)} min (ffmpeg exit ${code})`);
  } else if (cmd === 'eval') {
    console.log(await page.evaluate(args.js));
  } else {
    console.log('unknown command', cmd);
  }
  await done(0);
} catch (e) {
  console.error(e);
  console.log(logs.slice(-30).join('\n'));
  await done(1);
}
