// TETHER — 2:00, nine beats on generated plates, everything that moves drawn by the engine.
// See web/src/scenes/tether/index.js. The code-painted storyboard is web/src/tether_sketch.js.
import { Film } from './engine/film.js';
import { scene, overlay, PLATES, SPRITES, DUR, shots, transitions } from './scenes/tether/index.js';

// A sprite sheet laid out as a grid (sp.grid = [cols, rows]) becomes sp.frames: one canvas per
// cell, cropped to the cell's opaque pixels, so each frame can be its own texture.
function splitGrid(img, [cols, rows]) {
  const cw = img.width / cols, ch = img.height / rows, frames = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d');
    g.drawImage(img, c * cw, r * ch, cw, ch, 0, 0, cw, ch);
    const a = g.getImageData(0, 0, cw, ch).data;
    let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (a[(y * cw + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const pad = 6, w = Math.max(1, x1 - x0 + 2 * pad), h = Math.max(1, y1 - y0 + 2 * pad);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d').drawImage(cv, x0 - pad, y0 - pad, w, h, 0, 0, w, h);
    frames.push(out);
  }
  return frames;
}

// For a wing painted lying flat: its tip (the far end) and root (the thick end), found from the
// opaque pixels: whichever end is thinner is the tip. Body frames get the same treatment, unused.
function wingAnchors(cv) {
  const g = cv.getContext('2d'), { width: w, height: h } = cv, a = g.getImageData(0, 0, w, h).data;
  const col = (x) => { let n = 0, sy = 0; for (let y = 0; y < h; y++) if (a[(y * w + x) * 4 + 3] > 100) { n++; sy += y; } return { n, y: n ? sy / n : h / 2 }; };
  const band = (x0, x1) => { let n = 0, sy = 0; for (let x = x0; x < x1; x++) { const c = col(x); n += c.n; sy += c.y * c.n; } return { n, y: n ? sy / n : h / 2 }; };
  const k = Math.max(2, Math.round(w * 0.12)), L = band(0, k), R = band(w - k, w);
  const tipLeft = L.n < R.n;
  return tipLeft ? { tip: [k * 0.3, L.y], root: [w - k * 0.6, R.y] } : { tip: [w - k * 0.3, R.y], root: [k * 0.6, L.y] };
}

export async function buildFilm() {
  // plates that don't exist yet are skipped; their beat draws on grey
  await Promise.all([...PLATES, ...Object.values(SPRITES)].map(async (pl) => {
    const img = new Image();
    img.src = pl.src;
    try { await img.decode(); pl.img = img; } catch { console.warn('missing ' + pl.src); return; }
    if (pl.grid) pl.frames = splitGrid(img, pl.grid);
    if (pl.rig) pl.anchors = pl.frames.map(wingAnchors);
  }));
  return new Film({ fps: 30, duration: DUR, shots: shots(), transitions: transitions(), overlays: [overlay] });
}
