// Parallel final render: splits the film into chunks aligned to the segment table (long segments are
// split further), renders them with a pool of headless-Chrome workers (tools/cli.mjs render), then
// concatenates the chunks losslessly and muxes the soundtrack.
//
// Resumable: a chunk that finished is recorded in <chunk>.done (with the render settings); re-running the
// same command skips it. Delete out/chunks (or pass --fresh) to start over.
//
//   node tools/render_parallel.mjs --w 3840 --fps 30 --workers 4 --audio audio/build/time_final.wav --out out/TIME_4k.mp4
//   (optional: --from 0 --to 145 --crf 15 --preset slow --maxchunk 8 --fresh)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const args = {};
const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) {
  const k = av[i].replace(/^--/, '');
  args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : 'true';
}
const W = +(args.w || 3840), fps = +(args.fps || 30), workers = +(args.workers || 4);
const from = +(args.from ?? 0), to = +(args.to ?? 145);
const maxChunk = +(args.maxchunk || 8); // seconds
const crf = args.crf || '15', preset = args.preset || 'slow', film = args.film || 'film';
const out = path.resolve(ROOT, args.out || `out/TIME_${W}.mp4`);
const tmp = path.join(ROOT, 'out', 'chunks');
if (args.fresh === 'true') fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

// ---- chunk plan: cut at segment boundaries, then split anything longer than maxChunk evenly
// (parsed from the source text: film.js imports browser-only modules)
let cuts = [0, 30];
const filmSrc = path.join(ROOT, `web/src/${film}.js`);
const table = fs.readFileSync(fs.existsSync(filmSrc) ? filmSrc : path.join(ROOT, 'web/src/film.js'), 'utf8').match(/SEGMENT_TABLE\s*=\s*\[([\s\S]*?)\];/);
for (const m of (table ? table[1] : '').matchAll(/start:\s*([\d.]+),\s*end:\s*([\d.]+)/g)) cuts.push(+m[1], +m[2]);
if (cuts.length < 4) for (let t = 0; t <= 145; t += 10) cuts.push(t);
cuts = [...new Set([from, to, ...cuts.filter((t) => t > from && t < to)])].sort((a, b) => a - b);
const frames = [];
for (let i = 0; i < cuts.length - 1; i++) {
  const a = Math.round(cuts[i] * fps), b = Math.round(cuts[i + 1] * fps);
  const n = Math.max(1, Math.ceil((b - a) / (maxChunk * fps)));
  for (let k = 0; k < n; k++) frames.push([a + Math.round(((b - a) * k) / n), a + Math.round(((b - a) * (k + 1)) / n)]);
}
// Fingerprint every source the film is built from. Without it the resume signature says
// nothing about CONTENT: edit a scene, re-render at the same width, and any chunk whose frame
// range still lines up is skipped and the OLD footage is spliced into the new film. Frame N is
// t = N/fps whatever the duration, so the ranges line up easily.
function srcHash(dir) {
  let h = 0x811c9dc5;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(js|mjs)$/.test(e.name)) {
        const buf = fs.readFileSync(full);
        for (let i = 0; i < buf.length; i++) { h ^= buf[i]; h = Math.imul(h, 16777619); }
      }
    }
  };
  walk(dir);
  return (h >>> 0).toString(16);
}
const sig = JSON.stringify({ W, fps, crf, preset, film, blur: args.blur || '', src: srcHash(path.join(ROOT, 'web/src')) });
const chunks = frames.map(([a, b], i) => {
  // the film is part of the name: two films at the same width share frame ranges, and without
  // it one film's chunks overwrite the other's files while its .done stamps survive
  const file = path.join(tmp, `chunk_${film}_${W}_${String(a).padStart(5, '0')}_${String(b).padStart(5, '0')}.mp4`);
  return { i, a, b, file, done: file.replace(/\.mp4$/, '.done'), log: file.replace(/\.mp4$/, '.log') };
});
const isDone = (c) => fs.existsSync(c.file) && fs.existsSync(c.done) && fs.readFileSync(c.done, 'utf8') === sig;
const todo = chunks.filter((c) => !isDone(c));
console.log(`${f(to - from)} s = ${Math.round((to - from) * fps)} frames in ${chunks.length} chunks; ${chunks.length - todo.length} already done, ${todo.length} to render with ${workers} workers`);
function f(x) { return x.toFixed(2).replace(/\.?0+$/, ''); }

// ---- worker pool
const t0 = Date.now();
let doneFrames = 0, failed = null;
const totalFrames = todo.reduce((s, c) => s + c.b - c.a, 0);
async function runChunk(c) {
  const cliArgs = ['tools/cli.mjs', 'render', '--film', film, '--w', String(W), '--fps', String(fps),
    '--from', String(c.a / fps), '--to', String(c.b / fps), '--out', c.file,
    ...(args.blur ? ['--blur', args.blur] : []),
    '--crf', crf, '--preset', preset, '--strict', '1', '--release', '1'];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const code = await new Promise((resolve) => {
      const log = fs.createWriteStream(c.log, { flags: attempt === 1 ? 'w' : 'a' });
      const p = spawn('node', cliArgs, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
      p.stdout.pipe(log);
      p.stderr.pipe(log);
      let last = 0;
      p.stdout.on('data', (d) => {
        const line = String(d).trim().split('\n').pop();
        const m = line.match(/frame (\d+)\/(\d+)/);
        if (m && Date.now() - last > 30000) {
          last = Date.now();
          console.log(`[${c.a / fps}s–${c.b / fps}s] ${line}`);
        }
      });
      p.on('close', resolve);
    });
    if (code === 0 && fs.existsSync(c.file)) {
      fs.writeFileSync(c.done, sig);
      doneFrames += c.b - c.a;
      const el = (Date.now() - t0) / 1000, rate = doneFrames / el;
      console.log(`chunk ${f(c.a / fps)}–${f(c.b / fps)} s done (attempt ${attempt}); ${doneFrames}/${totalFrames} frames, ` +
        `${(el / 60).toFixed(1)} min elapsed, eta ${((totalFrames - doneFrames) / rate / 60).toFixed(1)} min`);
      return;
    }
    console.log(`chunk ${f(c.a / fps)}–${f(c.b / fps)} s failed (code ${code}, attempt ${attempt}); see ${c.log}`);
  }
  throw new Error(`chunk ${c.a / fps}–${c.b / fps} failed twice`);
}
const queue = [...todo];
await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, async () => {
  while (queue.length && !failed) {
    const c = queue.shift();
    try { await runChunk(c); } catch (e) { failed = e; }
  }
}));
if (failed) { console.error(String(failed)); process.exit(1); }
console.log(`all chunks rendered in ${((Date.now() - t0) / 60000).toFixed(1)} min`);

// ---- concat (stream copy) + mux audio
const list = path.join(tmp, `list_${W}.txt`);
fs.writeFileSync(list, chunks.map((c) => `file '${c.file.replace(/\\/g, '/')}'`).join('\n'));
const ff = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list];
if (args.audio) ff.push('-ss', String(from), '-t', String(to - from), '-i', path.resolve(ROOT, args.audio));
ff.push('-map', '0:v', '-c:v', 'copy');
if (args.audio) ff.push('-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000');
ff.push('-movflags', '+faststart', out.replace(/\.mp4$/, '.partial.mp4'));
await new Promise((resolve, reject) => {
  const p = spawn('ffmpeg', ff, { stdio: 'inherit' });
  p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg concat failed'))));
});
fs.renameSync(out.replace(/\.mp4$/, '.partial.mp4'), out);
console.log(`wrote ${path.relative(ROOT, out)}`);
