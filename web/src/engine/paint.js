// Painted layers: p5.brush artwork rendered once into (transparent) framebuffers, mipmapped,
// and then composited every frame by the compositor. Painting happens in design units.
import * as brush from '../../vendor/p5.brush.esm.js';
import { setSampling, restoreP5 } from './gl.js';
import { hash32, rng, hex, TAU } from './math.js';

export { brush };

export class Painter {
  constructor(p, S) {
    this.p = p;
    this.gl = p.drawingContext;
    this.S = S; // output pixels per design unit
    this.live = new Set();
    this.stats = { layers: 0, ms: 0, px: 0 };
    this.maxPx = 12288;
  }

  // w,h: layer size in design units. scale: extra resolution multiplier (for zoom targets).
  layer(name, opts, paintFn) {
    const p = this.p;
    const { w = 1920, h = 1080, scale = 1, mip = true } = opts;
    const seed = hash32(opts.seed ?? name);
    let res = this.S * scale;
    let pw = Math.ceil(w * res), ph = Math.ceil(h * res);
    const k = Math.min(1, this.maxPx / pw, this.maxPx / ph);
    if (k < 1) {
      pw = Math.floor(pw * k);
      ph = Math.floor(ph * k);
    }
    res = Math.min(pw / w, ph / h);
    const t0 = performance.now();
    restoreP5(p, this.gl); // never let p5 touch the compositor's VAOs / state
    const fb = p.createFramebuffer({ width: pw, height: ph, density: 1, depth: false, antialias: false });
    const ctx = makeCtx(p, w, h, res, seed, name);
    fb.draw(() => {
      p.clear();
      brush.load(fb);
      p.push();
      p.translate(-pw / 2, -ph / 2);
      p.scale(res);
      p.randomSeed(seed);
      p.noiseSeed(seed);
      brush.noField();
      paintFn(ctx);
      brush.flush();
      p.pop();
    });
    brush.load();
    if (mip) setSampling(this.gl, fb.colorTexture, true);
    const ms = performance.now() - t0;
    this.stats.layers++;
    this.stats.ms += ms;
    this.stats.px += pw * ph;
    const L = {
      name, fb, tex: fb.colorTexture, w, h, pw, ph, res, flipY: false, ms,
      dispose: () => {
        fb.remove();
        this.live.delete(L);
      },
    };
    this.live.add(L);
    return L;
  }

  // Paint into an existing layer (clears first). Used by dynamic layers.
  repaint(L, paintFn, seedKey) {
    const p = this.p;
    const t0 = performance.now();
    restoreP5(p, this.gl);
    const seed = hash32(seedKey ?? L.name);
    const ctx = makeCtx(p, L.w, L.h, L.res, seed, L.name);
    L.fb.draw(() => {
      p.clear();
      brush.load(L.fb);
      p.push();
      p.translate(-L.pw / 2, -L.ph / 2);
      p.scale(L.res);
      p.randomSeed(seed);
      p.noiseSeed(seed);
      brush.noField();
      paintFn(ctx);
      brush.flush();
      p.pop();
    });
    brush.load();
    setSampling(this.gl, L.tex, L.mip !== false);
    L.ms = performance.now() - t0;
    this.stats.dynMs = (this.stats.dynMs || 0) + L.ms;
    return L;
  }

  // A layer that is repainted (in place) whenever `key` changes, e.g. per animation frame.
  dynamic(name, opts) {
    const self = this;
    let L = null, lastKey;
    return {
      get(key, paintFn, seedKey) {
        if (L && key === lastKey) return L;
        if (!L) L = self.layer(name, opts, () => {});
        self.repaint(L, paintFn, seedKey ?? opts.seed ?? name);
        lastKey = key;
        return L;
      },
      dispose() {
        if (L) L.dispose();
        L = null;
      },
    };
  }
}

// Painting context handed to scene paint functions.
// diagnostics: 2-point strokePath calls per layer (these drew nothing before the 2-point fix)
export const TWO_PT = {};
// ?twopt=none restores the old behaviour (2-point paths draw nothing) for before/after comparisons
const TWO_PT_MODE = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('twopt') || 'line' : 'line';
function makeCtx(p, w, h, res, seed, name) {
  const r = rng(seed ^ 0x9e3779b9);
  const ctx = {
    p, brush, w, h, res, r, name,
    hex,
    // Organic closed blob around (cx,cy) with radius rx/ry and noisy edge.
    blob(cx, cy, rx, ry = rx, { n = 48, wobble = 0.12, rot = 0, seed: s = 0, freq = 3 } = {}) {
      const pts = [];
      const ph1 = r(0, TAU), ph2 = r(0, TAU), ph3 = r(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const k = 1 + wobble * (0.6 * Math.sin(a * freq + ph1 + s) + 0.3 * Math.sin(a * (freq * 2 + 1) + ph2) + 0.2 * Math.sin(a * (freq * 3 + 2) + ph3));
        const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
        pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
      }
      return pts;
    },
    // Watercolor-ish fill of a polygon (array of [x,y]).
    fillPoly(pts, color, { opacity = 180, bleed = 0.06, texture = 0.5, border = 0.3, dir = 'out', stroke = null } = {}) {
      // a preceding wash must be committed first, or the fill's texture erosion eats into it
      if (ctx._lastOp === 'wash') brush.flush();
      ctx._lastOp = 'fill';
      brush.noHatch();
      if (stroke) brush.set(stroke.brush || 'HB', stroke.color, stroke.weight || 1);
      else brush.noStroke();
      brush.fill(color, opacity);
      brush.fillBleed(bleed, dir);
      brush.fillTexture(texture, border);
      brush.polygon(pts);
      brush.noFill();
    },
    // Flat solid wash of a polygon (fast; no watercolor).
    washPoly(pts, color, opacity = 255) {
      ctx._lastOp = 'wash';
      brush.noHatch();
      brush.noStroke();
      brush.noFill();
      brush.wash(color, opacity);
      brush.polygon(pts);
      brush.noWash();
    },
    hatchPoly(pts, { dist = 6, angle = 0, brushName = 'pen', color = '#000', weight = 1, rand = 0.1, continuous = false, gradient = false } = {}) {
      brush.noFill();
      brush.noStroke();
      brush.hatchStyle(brushName, color, weight);
      brush.hatch(dist, angle, { rand, continuous, gradient });
      brush.polygon(pts);
      brush.noHatch();
    },
    strokePath(pts, brushName, color, weight = 1, curvature = 0.5) {
      brush.noFill();
      brush.noHatch();
      brush.set(brushName, color, weight);
      // brush.spline draws nothing for a 2-point path; draw it as a line instead
      if (pts.length === 2) {
        TWO_PT[name] = (TWO_PT[name] || 0) + 1;
        if (TWO_PT_MODE !== 'none') brush.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      }
      else if (pts.length > 2) brush.spline(pts, curvature);
    },
    line(x1, y1, x2, y2, brushName, color, weight = 1) {
      brush.set(brushName, color, weight);
      brush.line(x1, y1, x2, y2);
    },
    // Commit pending brush work to the layer now.
    flush() {
      brush.flush();
      ctx._lastOp = null;
    },
    // Native p5 drawing helpers (no brush): gradients / soft shapes are sometimes needed.
    native(fn) {
      brush.flush();
      fn(p);
    },
  };
  return ctx;
}
