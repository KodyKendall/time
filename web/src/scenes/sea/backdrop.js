// SEA — the water world (subject plane): continues the pivot's medium seamlessly around the cell, then
// becomes the open sea: depth gradient, current strokes, hatched lines parallel to the surface band,
// the cyan surface band itself, spray, and the night sky above. One big layer in a frame rotated along
// the swim path (to save pixels).
import { C } from '../lib/palette.js';
import { M, TAU, lerp, clamp, rng, mixHex, smoothstep, layerRng, track } from './lib.js';
import { fieldStrokes } from './paintkit.js';

// Surface band centre line (world).
// the surface rises to the right, flattening towards the shore
const BT = track([[-3300, 560], [960, -610], [3760, -1350], [4660, -1550], [5160, -1620], [5400, -1650], [6500, -1790], [9600, -2150]]);
export const bandY = (x) => BT(x) + 26 * Math.sin(x / 430) + 12 * Math.sin(x / 150 + 1.3);
export const BAND_W = (x) => 92 + 22 * Math.sin(x / 610 + 0.5);
// rotated layer frame
const BETA = -0.35, O = [960, 540];
const EU = [Math.cos(BETA), Math.sin(BETA)], EV = [-Math.sin(BETA), Math.cos(BETA)];
export const SEA = { u0: -2300, v0: -2500, len: 9400, wid: 4100, scale: 0.5 };
export const seaMatrix = () => M.chain(M.translate(O[0], O[1]), M.rotate(BETA), M.translate(SEA.u0, SEA.v0));
const toLocal = (x, y) => {
  const dx = x - O[0], dy = y - O[1];
  return [dx * EU[0] + dy * EU[1] - SEA.u0, dx * EV[0] + dy * EV[1] - SEA.v0];
};
const toWorld = (lx, ly) => {
  const u = lx + SEA.u0, v = ly + SEA.v0;
  return [O[0] + u * EU[0] + v * EV[0], O[1] + u * EU[1] + v * EV[1]];
};
// The pivot medium's line family, reproduced exactly (same seeded rng as its painting).
export const MED_Y0 = (() => {
  const r = layerRng('pivot-cell/medium');
  for (let i = 0; i < 14 * 9; i++) r();
  return Array.from({ length: 70 }, (_, i) => (i / 70) * 1400 + r(-6, 6));
})();
export function medLineY(i, x) {
  const y0 = i >= 0 && i < 70 ? MED_Y0[i] : (i / 70) * 1400;
  const xl = x + 240;
  return y0 - 160 + 18 * Math.sin(xl * 0.004 + i * 0.37) + 7 * Math.sin(xl * 0.011 + i);
}
// How "open sea" a world point is (0 = pivot medium look, 1 = storyboard sea).
export const seaK = (x, y) => smoothstep(1900, 4200, x + 0.35 * (540 - y));

export function paintSea(P) {
  return P.layer('sea', { w: SEA.len, h: SEA.wid, scale: SEA.scale }, (c) => {
    const r = c.r;
    const Lp = (pts) => pts.map((p) => toLocal(p[0], p[1]));
    const W = SEA.len, H = SEA.wid;
    const full = [[-50, -50], [W + 50, -50], [W + 50, H + 50], [-50, H + 50]];
    // world x-range covered by the layer (generous)
    const X0 = -3300, X1 = 9600;
    const xs = [];
    for (let x = X0; x <= X1; x += 50) xs.push(x);
    // ---------------- water base: the medium's teal around the cell, depth colours in the open sea
    c.washPoly(full, C.teal, 255);
    // open sea: light under the surface, deeper tones below (soft watercolour glazes, no hard edges)
    for (let i = 0; i < 44; i++) {
      const x = r(1200, 8200), depth = r(0, 1);
      const y = bandY(x) + 120 + depth * 2400;
      const col = depth < 0.18 ? r.pick(['#2aa0a0', '#3cb8b4', C.cyan]) : depth < 0.5 ? r.pick([C.sea, '#1a7a82', '#2a8f96']) : r.pick([C.deepTeal, '#12506a', '#0e3a52', C.sea]);
      const k = smoothstep(1200, 3000, x);
      c.fillPoly(Lp(c.blob(x, y, r(500, 1200), r(180, 420), { rot: -0.3 + r(-0.15, 0.15), wobble: 0.2 })), col, { opacity: Math.round(lerp(18, 55, k)), bleed: 0.16, texture: 0.85, border: 0.1 });
    }
    // medium-like blotches around the cell
    for (let i = 0; i < 26; i++) {
      const x = r(-2400, 3600), y = r(-700, 1900);
      c.fillPoly(Lp(c.blob(x, y, r(250, 600), r(160, 360), { rot: r(0, 3) })), r.pick([C.cyan, C.deepTeal, C.sea, C.aqua]), { opacity: 36, bleed: 0.12, texture: 0.8, border: 0.15 });
    }
    // ---------------- lines: the medium's horizontal family near the cell bends into lines parallel to the band
    const lineY = (i, x) => {
      const w = smoothstep(1500, 3600, x);
      const yh = medLineY(i, x);
      if (w <= 0) return yh;
      const yb = bandY(x) + (medLineY(i, 1500) - bandY(1500)) + 9 * Math.sin(x / 160 + i * 0.7);
      return lerp(yh, yb, w);
    };
    for (let i = -80; i < 160; i++) {
      const pts = [];
      for (let x = X0; x <= X1; x += 70) {
        const y = lineY(i, x);
        if (y < bandY(x) + 30) { if (pts.length > 2) break; pts.length = 0; continue; }
        pts.push([x, y]);
      }
      if (pts.length < 3) continue;
      // break into painterly runs (skip the part the pivot medium already covers)
      let run = [];
      const flushRun = () => {
        if (run.length > 2) {
          const k = seaK(run[0][0], run[0][1]);
          c.strokePath(Lp(run), 'wire', i % 3 ? mixHex(C.aqua, '#bff0e6', k * 0.3) : C.cyan, lerp(1.9, 2.6, k), 0.6);
        }
        run = [];
      };
      for (const p of pts) {
        const inMed = p[0] > -150 && p[0] < 2070 && p[1] > -70 && p[1] < 1150;
        const gap = seaK(p[0], p[1]) > 0.2 && r() < 0.035;
        if (inMed || gap) flushRun();
        else run.push(p);
      }
      flushRun();
    }
    // ---------------- current strokes (painterly body of the open water)
    const dirAt = (x, y) => {
      const [wx, wy] = toWorld(x, y);
      const k = smoothstep(1500, 3600, wx);
      return lerp(0.05 * Math.sin(wx / 300 + wy / 500), Math.atan(-0.3), k) - BETA; // world angle -> layer angle
    };
    fieldStrokes(c, full, dirAt, {
      n: 700, len: [260, 900], w: [1.2, 3.2], steps: 8, brush: (rr) => (rr() < 0.8 ? 'sea_comb' : 'sea_dry'),
      where: (x, y) => {
        const [wx, wy] = toWorld(x, y);
        if (wy < bandY(wx) + 40) return false;
        if (wx > -200 && wx < 2100 && wy > -100 && wy < 1180) return false; // under the pivot medium
        return r() < 0.25 + seaK(wx, wy);
      },
      col: (x, y, rr) => {
        const [wx, wy] = toWorld(x, y);
        const depth = clamp((wy - bandY(wx)) / 2600);
        const k = seaK(wx, wy);
        const near = rr.pick([C.teal, '#2a9a9a', '#1a7a82', '#3cb8b4', C.sea]);
        const open = depth < 0.15 ? rr.pick(['#3cb8b4', '#2aa0a0', '#5fd0c8']) : depth < 0.5 ? rr.pick([C.teal, '#1a7a82', '#2a8f96', C.sea]) : rr.pick([C.deepTeal, '#12506a', '#0e3a52', C.navy2]);
        return mixHex(mixHex(near, open, k), rr.pick(['#7fd8cf', '#15505e', '#3cc7c6', '#9be8de']), rr(0, 0.3));
      },
    });
    // ---------------- sky above the band
    const skyPoly = xs.map((x) => [x, bandY(x) - 10]).concat([[X1, -9000], [X0, -9000]]);
    c.washPoly(Lp(skyPoly), C.night, 255);
    for (let i = 0; i < 24; i++) {
      const x = r(-2000, 8000), y = bandY(x) - r(250, 1400);
      c.fillPoly(Lp(c.blob(x, y, r(400, 1000), r(140, 360), { rot: -0.3 + r(-0.2, 0.2), wobble: 0.2 })), r.pick([C.navy2, '#1b2a48', C.purple, '#221c3a', C.navy]), { opacity: 42, bleed: 0.16, texture: 0.9, border: 0.1 });
    }
    const skyLocal = Lp(skyPoly);
    fieldStrokes(c, skyLocal, () => -0.3 - BETA + r(-0.08, 0.08), {
      n: 260, len: [300, 1000], w: [2, 5], steps: 7, brush: (rr) => (rr() < 0.5 ? 'sea_comb' : 'sea_dry'),
      col: (x, y, rr) => mixHex(C.night, rr.pick(['#1b2a48', '#16223a', '#23305a', '#2a2450', '#0a1120']), rr(0.3, 0.9)),
    });
    // ---------------- the surface band
    const top = xs.map((x) => [x, bandY(x) - BAND_W(x) * 0.5]);
    const bot = xs.map((x) => [x, bandY(x) + BAND_W(x) * 0.5 + 8 * Math.sin(x / 80)]);
    const band = Lp(top.concat(bot.slice().reverse()));
    c.washPoly(band, C.cyan, 255);
    c.fillPoly(Lp(top.concat(xs.map((x) => [x, bandY(x) - BAND_W(x) * 0.1]).reverse())), C.aqua, { opacity: 90, bleed: 0.03, texture: 0.8, border: 0.3 });
    c.fillPoly(Lp(xs.map((x) => [x, bandY(x) + BAND_W(x) * 0.18]).concat(bot.slice().reverse())), '#2aa0a0', { opacity: 85, bleed: 0.03, texture: 0.8, border: 0.3 });
    fieldStrokes(c, band, () => -0.3 - BETA + r(-0.03, 0.03), {
      n: 420, len: [120, 460], w: [0.9, 2.2], steps: 6, brush: (rr) => (rr() < 0.6 ? 'sea_comb' : 'sea_dry'),
      col: (x, y, rr) => rr.pick([C.cyan, C.aqua, '#5fd0c8', '#9be8de', '#2aa0a0', '#bff0e6']),
    });
    c.strokePath(Lp(top.filter((_, i) => i % 2 === 0)), 'sea_contour', '#dff8f0', 2.2, 0.5);
    c.strokePath(Lp(bot.filter((_, i) => i % 2 === 0)), 'sea_contour', '#12606a', 1.8, 0.5);
    // fine stipple of spray along the crest (the drifting motes are particles, drawn live)
    for (let i = 0; i < 90; i++) {
      const x = r(-2000, 8600), y = bandY(x) - BAND_W(x) * 0.5 - r(10, 60);
      c.strokePath(Lp([[x - 120, y + 36], [x, y], [x + 120, y - 36]]), 'sea_speck', r.pick(['#dff8f0', '#bff0e6', C.aqua]), r(0.5, 1), 0.5);
    }
  });
}

export function drawSea(R, A) {
  R.layer(A.sea, seaMatrix());
}
