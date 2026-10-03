// Bootstrap: p5 (instance mode, WEBGL2) + p5.brush + engine. Exposes window.TIME for the
// headless renderer (tools/cli.mjs) and the interactive preview (index.html).
import { Engine } from './engine/engine.js';
import { brush, TWO_PT } from './engine/paint.js';
import { defineBrushes } from './brushes.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1920);
const H = Math.round((W * 9) / 16);
const filmName = q.get('film') || 'film';

let engine = null;
let resolveReady, rejectReady;
const ready = new Promise((r, j) => ((resolveReady = r), (rejectReady = j)));

window.TIME = {
  ready,
  W, H,
  get engine() { return engine; },

  async frame(t, opts = {}) {
    await ready;
    const t0 = performance.now();
    const info = engine.renderFrame(t, opts);
    const gl = engine.gl;
    if (opts.sync !== false) gl.finish();
    info.ms = performance.now() - t0;
    return info;
  },

  // Render and return a PNG data URL (for stills / QA).
  async png(t, opts = {}) {
    await TIME.frame(t, opts);
    return TIME.snapshot(opts.scale || 1);
  },

  snapshot(scale = 1) {
    const px = engine.post.read();
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.putImageData(new ImageData(new Uint8ClampedArray(px.buffer), W, H), 0, 0);
    if (scale === 1) return c.toDataURL('image/png');
    const d = document.createElement('canvas');
    d.width = Math.round(W * scale);
    d.height = Math.round(H * scale);
    const dg = d.getContext('2d');
    dg.imageSmoothingQuality = 'high';
    dg.drawImage(c, 0, 0, d.width, d.height);
    return d.toDataURL('image/png');
  },

  // Contact sheet of several times.
  async sheet(times, { cols = 4, tw = 480, label = true } = {}) {
    await ready;
    const th = Math.round((tw * 9) / 16);
    const rows = Math.ceil(times.length / cols);
    const pad = 6, lh = label ? 22 : 0;
    const c = document.createElement('canvas');
    c.width = cols * (tw + pad) + pad;
    c.height = rows * (th + pad + lh) + pad;
    const g = c.getContext('2d');
    g.fillStyle = '#222';
    g.fillRect(0, 0, c.width, c.height);
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    const tg = tmp.getContext('2d');
    for (let i = 0; i < times.length; i++) {
      await TIME.frame(times[i]);
      const px = engine.post.read();
      tg.putImageData(new ImageData(new Uint8ClampedArray(px.buffer), W, H), 0, 0);
      const x = pad + (i % cols) * (tw + pad), y = pad + Math.floor(i / cols) * (th + pad + lh);
      g.imageSmoothingQuality = 'high';
      g.drawImage(tmp, x, y + lh, tw, th);
      if (label) {
        g.fillStyle = '#ddd';
        g.font = '14px monospace';
        g.fillText(`t=${times[i].toFixed(2)}s`, x + 2, y + 16);
      }
    }
    return c.toDataURL('image/png');
  },

  // Render frame t and POST raw RGBA (top-down) to the local frame sink.
  async send(t, url) {
    const info = await TIME.frame(t, { sync: false });
    const px = engine.post.read(TIME._buf || (TIME._buf = new Uint8Array(W * H * 4)));
    const r = await fetch(url, { method: 'POST', body: px });
    if (!r.ok) throw new Error('frame sink error ' + r.status);
    return info;
  },

  // Pipelined variant: renders frame t into one of two buffers and starts the upload without
  // waiting for it; waits only for the upload that used the same buffer two frames ago.
  async sendAsync(t, url, idx) {
    TIME._bufs ||= [new Uint8Array(W * H * 4), new Uint8Array(W * H * 4)];
    TIME._pending ||= [null, null];
    const slot = idx % 2;
    if (TIME._pending[slot]) await TIME._pending[slot];
    const info = await TIME.frame(t, { sync: false });
    const px = engine.post.read(TIME._bufs[slot]);
    TIME._pending[slot] = fetch(url, { method: 'POST', body: px }).then((r) => { if (!r.ok) throw new Error('frame sink error ' + r.status); });
    return info;
  },
  async flushSends() {
    await Promise.all((TIME._pending || []).filter(Boolean));
  },

  stats() {
    const p = engine.painter.stats;
    return { painter: { ...p }, scenes: [...engine.assets.keys()], draws: engine.comp.stats.draws, twoPt: { ...TWO_PT } };
  },
};

new p5((p) => {
  brush.instance(p);
  p.setup = async () => {
    try { await setup(); } catch (e) { console.error('setup failed: ' + (e.stack || e)); window.TIME.error = String(e.stack || e); rejectReady(e); }
  };
  const setup = async () => {
    p.pixelDensity(1);
    p.createCanvas(W, H, p.WEBGL);
    p.noLoop();
    brush.scaleBrushes(5);
    defineBrushes(brush);
    const mod = await import(`./${filmName}.js`);
    const film = await mod.buildFilm();
    engine = new Engine(p, W, H, film);
    // ?blur=N caps motion-blur samples. Full quality is 12; previews want 1-2.
    if (q.get('blur')) engine.maxShutterSamples = Math.max(1, +q.get('blur'));
    engine.autoRelease = q.get('release') !== '0';
    engine.strict = q.get('strict') === '1';
    window.TIME.film = film;
    resolveReady(true);
  };
  p.draw = () => {};
});
