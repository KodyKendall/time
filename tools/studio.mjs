// Studio: watch and scrub a film live in Chrome, with its music, instead of rendering an MP4.
//
//   node tools/studio.mjs [--film tether] [--w 960] [--audio audio/build/tether.wav] [--port 8777] [--no-open]
//
// Serves the repo root (with HTTP range requests, so the music can seek) and opens
// web/studio.html. Frames are drawn by the same engine the renderer uses, straight to the page.
// Saving any file under web/ or audio/build/ reloads open studio pages (server-sent events on
// /__reload); the page comes back at the same time, loop and speed.
//
// Notes: the studio pins timecoded notes to the timeline and stores them in
// studio-notes/<film>.json (GET/POST/DELETE /__notes?film=). Editing that file (e.g. marking a
// note "resolved" with a "resolution") updates open pages live, without a reload.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const film = arg('film', 'tether');
const w = arg('w', '960');
const audio = arg('audio', `audio/build/${film}.wav`);
const port = +arg('port', 8777);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.css': 'text/css', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf' };

// live reload: one event stream per open page
const clients = new Set();
let pending = null;
const changed = (dir) => (ev, name) => {
  if (!name || /(^|\/)\.|manifest\.json$|\/gen\//.test(name)) return;
  clearTimeout(pending);
  pending = setTimeout(() => { console.log('reload:', path.join(dir, name)); for (const c of clients) c.write('data: reload\n\n'); }, 150);
};
for (const dir of ['web', 'audio/build']) {
  if (fs.existsSync(path.join(ROOT, dir))) fs.watch(path.join(ROOT, dir), { recursive: true }, changed(dir));
}

// notes
const NOTES = path.join(ROOT, 'studio-notes');
fs.mkdirSync(NOTES, { recursive: true });
const notesFile = (f) => path.join(NOTES, `${String(f).replace(/[^\w-]/g, '')}.json`);
const readNotes = (f) => { try { return JSON.parse(fs.readFileSync(notesFile(f), 'utf8')); } catch { return []; } };
const writeNotes = (f, list) => fs.writeFileSync(notesFile(f), JSON.stringify(list, null, 2) + '\n');
let notesPending = null;
fs.watch(NOTES, () => {
  clearTimeout(notesPending);
  notesPending = setTimeout(() => { for (const c of clients) c.write('data: notes\n\n'); }, 100);
});
async function notesApi(req, res, url) {
  const f = url.searchParams.get('film') || film;
  let list = readNotes(f);
  if (req.method === 'POST') {
    let body = '';
    for await (const c of req) body += c;
    const n = JSON.parse(body || '{}');
    list.push({ id: Date.now().toString(36), t: +(+n.t).toFixed(3), shot: n.shot || '', cut: n.cut || '', text: String(n.text || '').trim(),
      ...(n.layers ? { layers: n.layers } : {}), status: 'open', created: new Date().toISOString() });
    writeNotes(f, list);
    console.log(`note @ ${(+n.t).toFixed(2)}s: ${n.text}`);
  } else if (req.method === 'DELETE') {
    list = list.filter((n) => n.id !== url.searchParams.get('id'));
    writeNotes(f, list);
  }
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(list));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__gallery') {
    // every generated image for a film (from its manifest) and the picks in plates/
    const f = String(url.searchParams.get('film') || film).replace(/[^\w-]/g, '');
    const dir = path.join(ROOT, 'web', 'assets', f);
    let items = [];
    try { items = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).items; } catch {}
    const plates = fs.existsSync(path.join(dir, 'plates')) ? fs.readdirSync(path.join(dir, 'plates')).filter((n) => n.endsWith('.png')).sort() : [];
    const gen = new Set(fs.existsSync(path.join(dir, 'gen')) ? fs.readdirSync(path.join(dir, 'gen')) : []);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ film: f, base: `/web/assets/${f}/`, plates, items: items.map((it) => ({ ...it, keyed: it.files.map((x) => x.replace(/\.png$/, '_keyed.png')).filter((x) => gen.has(path.basename(x))) })) }));
    return;
  }
  if (url.pathname === '/__notes') { notesApi(req, res, url).catch((e) => { res.writeHead(500); res.end(String(e)); }); return; }
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': ok\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1, 'cache-control': 'no-store' });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size, 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }
});

server.listen(port, '127.0.0.1', () => {
  const q = new URLSearchParams({ film, w, ...(fs.existsSync(path.join(ROOT, audio)) ? { audio: '../' + audio } : {}) });
  const link = `http://127.0.0.1:${port}/web/studio.html?${q}`;
  console.log(`studio: ${link}\n(ctrl-c to stop)`);
  if (!argv.includes('--no-open')) {
    if (process.platform === 'darwin') spawn('open', ['-a', 'Google Chrome', link], { stdio: 'ignore' });
    else if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', link], { stdio: 'ignore' });
    else spawn('xdg-open', [link], { stdio: 'ignore' });
  }
});
