// CITY — painted textures for the town (other than facades): roof sheets, chimneys, ink edge
// strokes, hatching, streets, river, land and the dusk sky. Painted once with p5.brush in the
// same vocabulary as the facades: wash -> massed tone -> directional marks -> accents.
import { C } from '../lib/palette.js';
import { TAU, lerp, clamp, mixHex, circlePts, rng } from '../lib/kit.js';
import { BANDS, edgeO, RIVER } from './layout.js';

// mass helper on a raw painting context (coordinates already in design units)
export function massPoly(c, pts, brush, col, o = {}) {
  const b = c.brush;
  if (c._lastOp === 'wash') b.flush();
  c._lastOp = 'mass';
  b.noStroke(); b.noFill(); b.noHatch();
  b.mass(brush, col, { precision: o.precision ?? 0.55, strength: o.strength ?? 0.8, gradient: o.gradient ?? 0.25, outline: !!o.outline });
  b.polygon(pts);
  b.noMass();
}
const rectP = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// ------------------------------------------------------------------------------------------------
// roof sheets: 256 x 256 world units at D = 4; each roof face samples its own sub-rectangle
// (u along the eave, v up the slope), so there is no visible repetition.
// ------------------------------------------------------------------------------------------------
export const ROOF = { S: 256, D: 2.5 };
export const ROOFS = [
  { base: '#c65a3c', dark: '#9a3f2a', light: '#e48a64', moss: '#7a7a4a' },  // terracotta
  { base: '#d9b47a', dark: '#b08a55', light: '#f0d4a0', moss: '#8a8a5a' },  // sand tiles (panel 17)
  { base: '#4a5674', dark: '#2e3852', light: '#6e7ea2', moss: '#5a6a6a' },  // slate
  { base: '#b04a3a', dark: '#823226', light: '#d06a52', moss: '#6a6a3a' },  // deep red
];
export function paintRoofs(P) {
  const { S, D } = ROOF;
  return ROOFS.map((rf, i) => P.layer('roof' + i, { w: S * D, h: S * D, scale: 1.6 }, (c) => {
    const r = c.r, W = S * D;
    c.washPoly(rectP(0, 0, W, W), rf.base, 255);
    massPoly(c, rectP(5, 5, W - 5, W - 5), 'city_mass_m', rf.dark, { precision: 0.45, strength: 0.55 });
    c.flush();
    for (let k = 0; k < 7; k++) c.fillPoly(c.blob(r(0, W), r(0, W), r(60, 140), r(40, 100), { wobble: 0.3 }), r.pick([rf.light, rf.dark, rf.light]), { opacity: 32, bleed: 0.2, texture: 0.9, border: 0.08 });
    c.flush();
    // tile courses: rows every 4.6 units, staggered joints, light top edges (sun from above-left)
    const rh = 4.6 * D;
    for (let y = rh; y < W; y += rh) {
      let x = r(-20, 0);
      while (x < W) {
        const len = r(25, 100), xe = Math.min(W + 6, x + len);
        c.strokePath([[x, y + r(-1, 1)], [(x + xe) / 2, y + r(-1.2, 1.2)], [xe, y + r(-1, 1)]], r() < 0.5 ? 'charcoal' : 'crayon', mixHex(rf.dark, '#1b0e14', 0.3), r(0.4, 0.65), 0.5);
        x = xe + r(3, 18);
      }
      const off = (Math.round(y / rh) % 2) * 0.5;
      for (let x2 = off * 6 * D; x2 < W; x2 += 6 * D) {
        if (r() < 0.25) continue;
        c.strokePath([[x2 + r(-1, 1), y - rh + 2], [x2 + r(-1, 1), y - 1.2]], 'HB', mixHex(rf.dark, '#1b0e14', 0.2), 0.6, 0.5);
      }
      for (let x2 = r(0, 20); x2 < W; x2 += r(12, 40)) c.strokePath([[x2, y - rh * 0.8], [x2 + r(5, 14), y - rh * 0.8 + r(-1, 1)]], 'crayon', rf.light, r(0.3, 0.5), 0.5);
    }
    // weathering stipple and a few broken / patched tiles
    for (let k = 0; k < 12; k++) { const x = r(0, W), y = r(0, W); c.strokePath([[x, y], [x + r(-30, 30), y + r(-30, 30)]], 'dust', r.pick([rf.dark, rf.light]), r(0.7, 1.1), 0.5); }
    for (let k = 0; k < 10; k++) {
      const x = r(0, W - 30), y = Math.floor(r(1, W / rh - 1)) * rh;
      c.washPoly(rectP(x, y - rh + 1.2, x + r(8, 15), y - 0.6), r.pick([rf.light, rf.dark]), 200);
    }
  }));
}

// chimney: brick shaft 12 x 34 units with a stone cap (D = 5)
export function paintChimney(P) {
  const D = 5, w = 12 * D, h = 34 * D;
  return P.layer('chimney', { w, h }, (c) => {
    const r = c.r;
    c.washPoly(rectP(0, 0, w, h), '#9a3e2c', 255);
    massPoly(c, rectP(3, 12, w - 3, h - 3), 'city_mass_s', '#6e2a1e', { precision: 0.6, strength: 0.6 });
    c.flush();
    for (let y = 16; y < h; y += 11) c.strokePath([[0, y], [w, y + r(-1, 1)]], 'crayon', '#d9a07a', 0.45, 0.5);
    c.washPoly(rectP(0, 0, w, 14), '#d9c4a0', 255);
    c.strokePath([[0, 14], [w, 14]], 'ink', '#2a1418', 1.2, 0.3);
    c.strokePath([[1, 0], [1, h]], 'ink', '#2a1418', 1.0, 0.3);
  });
}

// ink edge strokes atlas: 4 cells (24 x 640 du) with pressure-varied strokes (u across, v along)
export function paintEdges(P) {
  const w = 24, h = 640;
  return P.layer('edges', { w: w * 4, h }, (c) => {
    const r = c.r;
    for (let k = 0; k < 4; k++) {
      const x = k * w + w / 2, pts = [];
      for (let i = 0; i <= 12; i++) pts.push([x + r(-1.4, 1.4), 4 + (i / 12) * (h - 8), 0.35 + 0.9 * Math.abs(Math.sin(i * 0.9 + k))]);
      if (k < 2) c.strokePath(pts, 'ink', '#1e1420', 2.2, 0.4);
      else c.strokePath(pts, 'charcoal', '#241828', 1.0, 0.4);
    }
  });
}

// tileable hatching (lines at 45 degrees, spacing divides the tile) for painted shade
export function paintHatch(P) {
  const S = 256, d = 8;
  return P.layer('hatch', { w: S, h: S }, (c) => {
    const r = c.r;
    for (let k = -S / d; k < (2 * S) / d; k++) {
      const x = k * d;
      c.strokePath([[x + r(-0.6, 0.6), -2], [x + S + 2 + r(-0.6, 0.6), S + 2]], 'charcoal', '#1d1a3a', r(0.35, 0.55), 0.5);
    }
  });
}

// soft grainy noise tile (painterly reveal fronts)
export function paintNoise(P) {
  const S = 256;
  return P.layer('noise', { w: S, h: S }, (c) => {
    const r = c.r;
    for (let i = 0; i < 90; i++) c.washPoly(c.blob(r(0, S), r(0, S), r(6, 26), r(5, 20), { n: 16, wobble: 0.3 }), '#ffffff', Math.round(r(40, 255)));
  });
}

// ------------------------------------------------------------------------------------------------
// streets: tiles repeat along u; each tile ends on a transverse paving joint that hides the seam
// ------------------------------------------------------------------------------------------------
export const AVE = { L: 300, W: 201, D: 4, side: 26 };
export function paintAvenue(P) {
  const { L, W, D, side } = AVE;
  return P.layer('avenue', { w: L * D, h: W * D, scale: 1.5 }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    const R = (x0, y0, x1, y1) => rectP(X(x0), X(y0), X(x1), X(y1));
    // carriageway: light teal stone (panel 18), massed, with cobble rows
    c.washPoly(R(0, side, L, W - side), '#a9bdb4', 255);
    for (let k = 0; k < 7; k++) c.fillPoly(c.blob(X(r(20, L - 20)), X(r(side + 20, W - side - 20)), X(r(25, 60)), X(r(14, 34))), r.pick(['#bccdc4', '#8ea49c', '#9fb4aa']), { opacity: 40, bleed: 0.2, texture: 0.9, border: 0.1 });
    c.flush();
    for (let y = side + 2.2; y < W - side - 1; y += 2.5) {
      // a course of cobbles: dark joint line, then broken light / dark dabs along it
      c.strokePath([[0, X(y + 1.15)], [X(L / 2), X(y + 1.15 + r(-0.2, 0.2))], [X(L), X(y + 1.15)]], 'charcoal', '#5f7068', 0.55, 0.5);
      for (let x2 = r(0, 3); x2 < L; x2 += r(2.2, 3.4)) if (r() < 0.55) c.strokePath([[X(x2), X(y - 0.9)], [X(x2 + r(-0.2, 0.2)), X(y + 0.9)]], 'HB', '#6a7c74', 0.5, 0.5);
      let x = r(-6, 0);
      while (x < L) {
        const x1 = Math.min(L + 2, x + r(8, 30));
        c.strokePath([[X(x), X(y + r(-0.2, 0.2))], [X(x1), X(y + r(-0.2, 0.2))]], r() < 0.5 ? 'crayon' : 'charcoal', r.pick(['#cfdcd2', '#8aa096', '#bfcdc2', '#7a8f86']), r(0.45, 0.8), 0.5);
        x = x1 + r(2, 10);
      }
    }
    c.flush();
    // tram rails: two tracks (ink with a polished highlight) and sleepers
    const mid = W / 2;
    for (const t of [mid - 22, mid + 22]) {
      for (let x = 3; x < L; x += 9) c.washPoly(R(x, t - 6.5, x + 2, t + 6.5), '#6f948c', 150);
      for (const dd of [-4.8, 4.8]) {
        c.strokePath([[0, X(t + dd)], [X(L / 2), X(t + dd + r(-0.05, 0.05))], [X(L), X(t + dd)]], 'ink', '#26323a', 1.9, 0.5);
        c.strokePath([[0, X(t + dd + 0.55)], [X(L), X(t + dd + 0.55)]], 'HB', '#f4fbf6', 0.9, 0.5);
      }
    }
    // manholes, puddles, horse-cart ruts
    for (let i = 0; i < 3; i++) {
      const x = r(30, L - 30), y = r(side + 14, W - side - 14);
      c.washPoly(circlePts(X(x), X(y), X(3.4), 24), '#4e6a68', 235);
      for (let q = -2; q <= 2; q++) c.strokePath([[X(x - 2.6), X(y + q * 1.1)], [X(x + 2.6), X(y + q * 1.1)]], 'wire', '#2a3a3c', 0.9, 0.5);
    }
    for (let i = 0; i < 4; i++) {
      const x = r(20, L - 40), y = r(side + 10, W - side - 10);
      c.washPoly(c.blob(X(x), X(y), X(r(6, 14)), X(r(2, 4)), { wobble: 0.3 }), '#c8e4ec', 150);
      c.strokePath([[X(x - 4), X(y)], [X(x + 5), X(y + 0.3)]], 'HB', '#ffffff', 0.8, 0.5);
    }
    // sidewalks: stone slabs, massed, with joints
    for (const [y0, y1] of [[0, side], [W - side, W]]) {
      c.washPoly(R(0, y0, L, y1), '#d9c49c', 255);
      massPoly(c, R(2, y0 + 2, L - 2, y1 - 2), 'city_mass_m', '#b89e72', { precision: 0.6, strength: 0.45 });
      c.flush();
      for (let x = 0; x <= L; x += 12) c.strokePath([[X(x), X(y0)], [X(x + r(-0.3, 0.3)), X(y1)]], 'charcoal', '#8e7a58', 0.5, 0.5);
      for (const yy of [y0 + (y1 - y0) / 3, y0 + (2 * (y1 - y0)) / 3]) c.strokePath([[0, X(yy)], [X(L), X(yy + r(-0.3, 0.3))]], 'charcoal', '#8e7a58', 0.5, 0.5);
      for (let k = 0; k < 10; k++) { const x = r(0, L), y = r(y0 + 2, y1 - 2); c.strokePath([[X(x), X(y)], [X(x + r(-8, 8)), X(y + r(-2, 2))]], 'dust', '#8a7450', 0.9, 0.5); }
    }
    // curbs: the long converging lines of the street
    for (const [y, dir] of [[side, 1], [W - side, -1]]) {
      c.washPoly(R(0, y - 1.3, L, y + 1.3), '#efe4cc', 255);
      c.strokePath([[0, X(y + dir * 1.4)], [X(L / 2), X(y + dir * 1.4 + r(-0.1, 0.1))], [X(L), X(y + dir * 1.4)]], 'ink', '#26282e', 1.8, 0.5);
      c.strokePath([[0, X(y - dir * 1.2)], [X(L), X(y - dir * 1.2)]], 'crayon', '#fff8e8', 0.5, 0.5);
    }
    // transverse joint at the tile seam (u = 0 / u = 1)
    for (const x of [0.6, L - 0.6]) c.strokePath([[X(x), X(side)], [X(x), X(W - side)]], 'charcoal', '#5e8a82', 0.8, 0.5);
  });
}
// footpath: worn earth with trampled grass edges, 80 x 9 world units (u along the path), transparent around
export function paintPath(P) {
  const L = 80, W = 9, D = 5;
  return P.layer('path', { w: L * D, h: W * D, scale: 1.2 }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    const top = [], bot = [];
    for (let x = -2; x <= L + 2; x += 3) {
      top.push([X(x), X(2.2 + r(-0.9, 0.9))]);
      bot.push([X(x), X(W - 2.2 + r(-0.9, 0.9))]);
    }
    const body = top.concat(bot.reverse());
    c.washPoly(body, '#c9a878', 255);
    massPoly(c, body, 'city_mass_s', '#a68256', { precision: 0.6, strength: 0.5 });
    c.flush();
    for (let i = 0; i < 40; i++) c.washPoly(c.blob(X(r(0, L)), X(r(3, W - 3)), X(r(0.25, 0.6)), X(r(0.2, 0.45)), { n: 8 }), r.pick(['#8a6a44', '#e2c89a', '#6a5236', '#b09070']), 230);
    for (let i = 0; i < 70; i++) {
      const x = r(0, L), y = r() < 0.5 ? r(0.5, 2.6) : r(W - 2.6, W - 0.5);
      c.strokePath([[X(x), X(y)], [X(x + r(-0.8, 0.8)), X(y + r(-1.8, 1.8))]], 'HB', r.pick(['#4f7a3a', '#6a8a3e', '#3f6a34', '#8aa04a']), 0.9, 0.5);
    }
  });
}

// cobblestone overlay: seamless 40 x 40 world-unit tile (transparent between stones' joints)
export const COB = { S: 40, D: 6 };
export function paintCobbles(P) {
  const { S, D } = COB;
  return P.layer('cobbles', { w: S * D, h: S * D, scale: 1.5 }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    const rows = 16, rh = S / rows;
    const stones = [];
    for (let j = 0; j < rows; j++) {
      let x = r(0, 3);
      const x0 = x;
      while (x < x0 + S - 1.2) {
        const w = Math.min(r(2.0, 3.4), x0 + S - x - 0.3);
        stones.push([x, j * rh, w]);
        x += w + 0.35;
      }
    }
    const each = (fn) => { for (const [x, y, w] of stones) for (const dx of [-S, 0, S]) if (x + dx < S + 1 && x + w + dx > -1) fn(x + dx, y, w); };
    // stones: soft washes of stone tones
    each((x, y, w) => {
      const col = r.pick(['#b8ccc2', '#9db4aa', '#c6d6cc', '#8fa69c', '#aebfb4', '#a2b0a8']);
      c.washPoly([[X(x + 0.2), X(y + 0.35)], [X(x + w - 0.15), X(y + 0.3)], [X(x + w - 0.2), X(y + rh - 0.35)], [X(x + 0.15), X(y + rh - 0.3)]], col, 170);
    });
    c.flush();
    // joints (dark, below and right of each stone) and highlights (top left)
    each((x, y, w) => {
      c.strokePath([[X(x + 0.3), X(y + rh - 0.15)], [X(x + w * 0.5), X(y + rh - 0.1 + r(-0.08, 0.08))], [X(x + w), X(y + rh - 0.15)]], 'charcoal', '#4f625c', 0.45, 0.5);
    });
    each((x, y, w) => {
      if (r() < 0.45) c.strokePath([[X(x + 0.5), X(y + 0.7)], [X(x + w * r(0.4, 0.8)), X(y + 0.65)]], 'HB', '#e6f0ea', 0.5, 0.5);
    });
  });
}
// bridge parapet: stone balustrade with end piers, 100 x 10 world units (u along, v down)
export const PARAPET = { L: 100, H: 10, D: 5 };
export function paintParapet(P) {
  const { L, H, D } = PARAPET;
  return P.layer('parapet', { w: L * D, h: H * D, scale: 1.2 }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    const R = (x0, y0, x1, y1) => rectP(X(x0), X(y0), X(x1), X(y1));
    const stone = '#d8c49e', dark = '#8e7a5a', light = '#f4e6c6';
    // plinth and coping
    c.washPoly(R(0, H - 2.6, L, H), stone, 255);
    c.washPoly(R(0, 1.2, L, 3.2), stone, 255);
    c.washPoly(R(0, 0.4, L, 1.4), light, 255);
    // balusters between
    for (let x = 7; x < L - 7; x += 2.3) {
      const b = [[X(x), X(3.2)], [X(x + 1.4), X(3.2)], [X(x + 1.7), X(4.6)], [X(x + 1.1), X(6.2)], [X(x + 1.6), X(7.4)], [X(x + 1.3), X(H - 2.6)], [X(x + 0.1), X(H - 2.6)], [X(x - 0.2), X(7.4)], [X(x + 0.3), X(6.2)], [X(x - 0.3), X(4.6)]];
      c.washPoly(b, r() < 0.5 ? stone : '#cdb892', 255);
    }
    // end piers
    for (const x0 of [0, L - 7]) {
      c.washPoly(R(x0, 0, x0 + 7, H), '#e2cfa8', 255);
      massPoly(c, R(x0 + 0.5, 0.5, x0 + 6.5, H - 0.5), 'city_mass_s', dark, { precision: 0.8, strength: 0.4 });
    }
    c.flush();
    massPoly(c, R(0.5, H - 2.4, L - 0.5, H - 0.2), 'city_mass_s', dark, { precision: 0.8, strength: 0.4 });
    massPoly(c, R(0.5, 1.4, L - 0.5, 3), 'city_mass_s', dark, { precision: 0.8, strength: 0.3 });
    c.flush();
    c.strokePath([[0, X(3.3)], [X(L), X(3.3)]], 'ink', '#4a3a2a', 1.1, 0.3);
    c.strokePath([[0, X(H - 2.6)], [X(L), X(H - 2.6)]], 'ink', '#4a3a2a', 1.0, 0.3);
    c.strokePath([[0, X(0.5)], [X(L), X(0.5)]], 'HB', '#fff4dc', 0.8, 0.3);
    for (let x = 7; x < L - 7; x += 2.3) c.strokePath([[X(x + 1.45), X(3.4)], [X(x + 1.35), X(H - 2.7)]], 'charcoal', '#6a5a44', 0.45, 0.4);
    for (const x0 of [0, L - 7]) {
      c.strokePath([[X(x0 + 0.3), 0], [X(x0 + 0.3), X(H)]], 'ink', '#3a2a1e', 1.1, 0.3);
      c.strokePath([[X(x0 + 6.7), 0], [X(x0 + 6.7), X(H)]], 'ink', '#3a2a1e', 1.1, 0.3);
    }
  });
}
export const LANE = { L: 150, W: 44, D: 4 };
export function paintLane(P) {
  const { L, W, D } = LANE;
  return P.layer('lane', { w: L * D, h: W * D }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    c.washPoly(rectP(0, 0, X(L), X(W)), '#bdae8e', 255);
    massPoly(c, rectP(X(3), X(3), X(L - 3), X(W - 3)), 'city_mass_m', '#9c8c6c', { precision: 0.5, strength: 0.55 });
    c.flush();
    for (let y = 3; y < W - 2; y += 2.6) {
      let x = r(-3, 0);
      while (x < L) {
        const x1 = Math.min(L + 2, x + r(1.8, 3.4));
        c.washPoly([[X(x), X(y - 0.95)], [X(x1), X(y - 0.95 + r(-0.2, 0.2))], [X(x1 - 0.2), X(y + 0.95)], [X(x + 0.2), X(y + 0.95)]], r.pick(['#c9bb9a', '#b09f7e', '#d4c6a6', '#a8977a']), r(150, 230));
        x = x1 + r(0.3, 0.7);
      }
    }
    for (const y of [1.4, W - 1.4]) c.strokePath([[0, X(y)], [X(L), X(y)]], 'ink', '#4a3c2a', 1.5, 0.5);
    c.strokePath([[0, X(W / 2)], [X(L), X(W / 2)]], 'charcoal', '#6a5c42', 0.8, 0.5);
    for (const x of [0.5, L - 0.5]) c.strokePath([[X(x), X(1.4)], [X(x), X(W - 1.4)]], 'charcoal', '#6a5c42', 0.7, 0.5);
  });
}

export const TRACK = { L: 120, W: 34, D: 4 };
export function paintTrack(P) {
  const { L, W, D } = TRACK;
  return P.layer('track', { w: L * D, h: W * D }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    // worn earth with grassy verges and two wheel ruts
    const edge = (y0, dir) => { const pts = []; for (let x = -2; x <= L + 2; x += 4) pts.push([X(x), X(y0 + dir * r(0, 2.5))]); return pts; };
    const top = edge(4, 1), bot = edge(W - 4, -1);
    const body = top.concat(bot.reverse());
    c.washPoly(body, '#b89868', 255);
    massPoly(c, body, 'city_mass_m', '#9a7a4e', { precision: 0.5, strength: 0.55 });
    c.flush();
    for (const y of [W * 0.36, W * 0.64]) {
      c.strokePath([[0, X(y)], [X(L / 2), X(y + r(-0.4, 0.4))], [X(L), X(y)]], 'charcoal', '#6e5234', 1.4, 0.5);
      c.strokePath([[0, X(y + 1.2)], [X(L), X(y + 1.2)]], 'crayon', '#d8bc8a', 0.6, 0.5);
    }
    for (let i = 0; i < 26; i++) c.washPoly(c.blob(X(r(0, L)), X(r(6, W - 6)), X(r(0.4, 1.1)), X(r(0.3, 0.8)), { n: 8 }), r.pick(['#8a6a44', '#d2b484', '#6a5236']), 230);
    // grass tufts on the verges
    for (let i = 0; i < 60; i++) {
      const x = r(0, L), y = r() < 0.5 ? r(2, 6) : r(W - 6, W - 2);
      c.strokePath([[X(x), X(y)], [X(x + r(-1, 1)), X(y + r(-2.5, 2.5))]], 'HB', r.pick(['#4f7a3a', '#6a8a3e', '#3f6a34']), 0.9, 0.5);
    }
  });
}

// ------------------------------------------------------------------------------------------------
// river: band-aligned layer. local x = s - RV.s0, local y = o - RV.o0 (world units, D = 1)
// ------------------------------------------------------------------------------------------------
export const RV = { s0: -640, s1: -150, o0: -1760, o1: 1760 };
export function paintRiver(P) {
  const w = RV.s1 - RV.s0, h = RV.o1 - RV.o0;
  return P.layer('river', { w, h, scale: 1.2 }, (c) => {
    const r = c.r;
    const pts = [];
    for (let o = RV.o0 - 20; o <= RV.o1 + 20; o += 16) pts.push([RIVER.sAt(o) - RV.s0, o - RV.o0]);
    const normal = (i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
      return [-dy / d, dx / d];
    };
    const rib = (hw, jit = 0, seed = 0) => {
      const L = [], R = [];
      for (let i = 0; i < pts.length; i++) {
        const [nx, ny] = normal(i);
        const w1 = hw * (1 + jit * Math.sin(i * 0.37 + seed)), w2 = hw * (1 + jit * Math.sin(i * 0.29 + seed * 2));
        L.push([pts[i][0] + nx * w1, pts[i][1] + ny * w1]);
        R.push([pts[i][0] - nx * w2, pts[i][1] - ny * w2]);
      }
      return L.concat(R.reverse());
    };
    // grassy banks, muddy margin
    c.washPoly(rib(40, 0.15, 1), '#58804a', 235);
    massPoly(c, rib(38, 0.15, 1), 'city_mass_m', '#3f6a3e', { precision: 0.5, strength: 0.6 });
    c.flush();
    c.washPoly(rib(29, 0.1, 2), '#c8b286', 255);
    massPoly(c, rib(28, 0.1, 2), 'city_mass_s', '#9c865e', { precision: 0.6, strength: 0.5 });
    c.flush();
    // water: teal, darker along the banks, bright current in the middle
    c.washPoly(rib(23, 0.05, 3), C.teal, 255);
    massPoly(c, rib(22, 0.05, 3), 'city_mass_m', C.sea, { precision: 0.55, strength: 0.7 });
    c.flush();
    massPoly(c, rib(9, 0.25, 4), 'city_mass_s', C.cyan, { precision: 0.6, strength: 0.5 });
    c.flush();
    // flowing strokes along the current
    for (let k = 0; k < 34; k++) {
      const off = r(-18, 18);
      let i = Math.floor(r(0, pts.length - 8));
      while (i < pts.length - 3) {
        const n = Math.floor(r(3, 9)), seg = [];
        for (let j = i; j < Math.min(pts.length, i + n); j++) {
          const [nx, ny] = normal(j);
          seg.push([pts[j][0] + nx * off, pts[j][1] + ny * off]);
        }
        if (seg.length > 1) c.strokePath(seg, r() < 0.6 ? 'crayon' : 'HB', r.pick([C.aqua, '#c6f2e8', C.cyan, '#0f5a64']), r(0.4, 0.8), 0.5);
        i += n + Math.floor(r(2, 10));
      }
    }
    // reeds along the banks
    for (let i = 2; i < pts.length - 2; i += 1) {
      if (r() < 0.55) continue;
      const [nx, ny] = normal(i);
      const side = r() < 0.5 ? 1 : -1, d = r(24, 31) * side;
      const bx = pts[i][0] + nx * d, by = pts[i][1] + ny * d;
      for (let q = 0; q < 3; q++) c.strokePath([[bx, by], [bx + nx * side * r(3, 7) + r(-2, 2), by + ny * side * r(3, 7) + r(-2, 2)]], 'HB', r.pick(['#2f5a32', '#6a8a3a', '#c9b06a']), 0.8, 0.5);
    }
    // bank contours
    const e1 = [], e2 = [];
    for (let i = 0; i < pts.length; i++) {
      const [nx, ny] = normal(i);
      e1.push([pts[i][0] + nx * 23, pts[i][1] + ny * 23, 0.5 + 0.7 * Math.abs(Math.sin(i * 0.4))]);
      e2.push([pts[i][0] - nx * 23, pts[i][1] - ny * 23, 0.5 + 0.7 * Math.abs(Math.sin(i * 0.33 + 1))]);
    }
    c.strokePath(e1, 'ink', '#0c3438', 1.5, 0.4);
    c.strokePath(e2, 'ink', '#0c3438', 1.5, 0.4);
    c.strokePath(e1.map((p) => [p[0] - 1.8, p[1], p[2]]), 'HB', '#c6f2e8', 0.8, 0.4);
  });
}

// ------------------------------------------------------------------------------------------------
// land beyond the pivot's field layer: band-aligned, local x = s + half, y = o + half (D = 1)
// ------------------------------------------------------------------------------------------------
export function paintLand(P, name, half, scale, furrow) {
  const far = half > 3000;
  const K = far ? 16 : 6; // world units per design unit (keeps brush stamp counts sane)
  const Wd = (half * 2) / K;
  return P.layer(name, { w: Wd, h: Wd, scale: scale * K }, (c) => {
    const r = c.r;
    const X = (s, o) => [(s + half) / K, (o + half) / K];
    const step = far ? 400 : 200;
    const polys = [];
    for (const b of BANDS) {
      if (b.off > half || b.off + b.w < -half) continue;
      const top = [], bot = [];
      for (let s = -half - step; s <= half + step; s += step) {
        top.push(X(s, edgeO(b.off, s)));
        bot.push(X(s, edgeO(b.off + b.w, s)));
      }
      const poly = top.concat(bot.reverse());
      polys.push({ b, poly });
      c.washPoly(poly, b.col, 255);
    }
    c.flush();
    for (const { b, poly } of polys) c.fillPoly(poly, mixHex(b.col, '#3a2a1a', 0.18), { opacity: 70, bleed: 0.03, texture: 0.8, border: 0.3 });
    c.flush();
    for (const { b, poly } of polys) massPoly(c, poly, far ? 'city_mass_s' : 'city_mass_m', mixHex(b.col, '#2a1a0a', 0.22), { precision: 0.5, strength: 0.45 });
    c.flush();
    for (const b of BANDS) {
      if (b.off > half || b.off + b.w < -half) continue;
      const n = Math.floor(b.w / furrow);
      const col = mixHex(b.col, '#2a1a0a', 0.35);
      for (let i = 1; i < n; i++) {
        const o = b.off + (b.w * i) / n;
        c.strokePath([X(-half, o), X(0, o + r(-2, 2)), X(half, o)], 'HB', col, far ? 0.5 : 0.7, 0.5);
      }
    }
    // hedgerows / copses along some band edges
    for (const b of BANDS) {
      if (b.off > half || b.off < -half || r() < 0.45) continue;
      for (let s = -half; s < half; s += r(30, 90) * (far ? 3 : 1)) {
        const [x, y] = X(s, edgeO(b.off, s));
        const R = ((far ? 22 : 9) * r(0.7, 1.3)) / K;
        c.washPoly(c.blob(x, y, R, R, { n: 10, wobble: 0.2 }), r.pick(['#2f5a3a', '#3f6e45', '#28503a']), 230);
      }
    }
  });
}

// ------------------------------------------------------------------------------------------------
// dusk sky, anchored to the horizon line. Layer SKY.w x SKY.h (D = 1), horizon at y = SKY.hy
// ------------------------------------------------------------------------------------------------
export const SKY = { w: 3000, h: 1500, hy: 1150, K: 2.5 };
export function paintSky(P) {
  const K = SKY.K;
  const w = SKY.w / K, h = SKY.h / K, hy = SKY.hy / K;
  return P.layer('sky', { w, h, scale: 0.5 * K }, (c) => {
    const r = c.r;
    const stops = [[0, '#0f1830'], [0.35, '#1b2646'], [0.58, '#393562'], [0.74, '#784e78'], [0.86, '#c4737a'], [0.95, '#eca07c'], [1, '#f6c08a']];
    const col = (t) => {
      for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return mixHex(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
      return stops[stops.length - 1][1];
    };
    const N = 36;
    for (let i = 0; i < N; i++) {
      const y0 = (i / N) * hy, y1 = ((i + 1) / N) * hy + 1;
      c.washPoly(rectP(0, y0, w, y1), col((i + 0.5) / N), 255);
    }
    c.washPoly(rectP(0, hy, w, h), '#f6c08a', 255);
    c.flush();
    for (let i = 0; i < 9; i++) {
      const y = (i / 9) * hy + r(0, hy / 9);
      massPoly(c, rectP(-10, y - 24, w + 10, y + 24), 'city_mass_l', col(y / hy + r(-0.05, 0.05)), { precision: 0.35, strength: 0.5 });
    }
    c.flush();
    for (let i = 0; i < 18; i++) {
      const y = r(0.25, 0.88) * hy, x = r(-40, w);
      const t = y / hy;
      const cc = t > 0.7 ? r.pick(['#e8907c', '#b8637a', '#f2a47e']) : r.pick(['#3a3f6e', '#56487a', '#2a3358']);
      c.fillPoly(c.blob(x, y, r(64, 176), r(10, 23), { wobble: 0.3, freq: 4 }), cc, { opacity: 46, bleed: 0.2, texture: 0.9, border: 0.08 });
      massPoly(c, c.blob(x, y + 4, r(48, 120), r(6, 12), { wobble: 0.3 }), 'city_mass_m', t > 0.6 ? '#ffc39a' : '#6a5a90', { precision: 0.4, strength: 0.4 });
    }
    c.flush();
    for (let i = 0; i < 70; i++) {
      const y = r(0.18, 0.9) * hy, x = r(-40, w);
      const len = r(32, 144), t = y / hy;
      c.strokePath([[x, y], [x + len * 0.5, y + r(-2.4, 2.4)], [x + len, y + r(-3, 3)]], r() < 0.5 ? 'crayon' : 'HB', t > 0.7 ? '#ffd6aa' : '#8a82b8', r(0.4, 0.8), 0.5);
    }
    const hill = (yb, amp, cc, seed, fr = 0.004) => {
      const pts = [[0, h], [0, yb]];
      for (let x = 0; x <= w; x += 12) pts.push([x, yb - amp * (0.55 + 0.45 * Math.sin(x * K * fr + seed) * Math.sin(x * K * fr * 0.31 + seed * 2))]);
      pts.push([w, h]);
      c.washPoly(pts, cc, 255);
      massPoly(c, pts, 'city_mass_m', mixHex(cc, '#0a1a2a', 0.25), { precision: 0.5, strength: 0.5 });
      c.flush();
      const top = pts.slice(2, -1).map((p, i) => [p[0], p[1], 0.5 + 0.6 * Math.abs(Math.sin(i * 0.2))]);
      c.strokePath(top, 'crayon', mixHex(cc, '#f6c08a', 0.45), 0.4, 0.5);
    };
    hill(hy - 3, 28, '#4a6f86', 0.4, 0.003);
    hill(hy + 2.4, 38, '#2a6f73', 1.3);
    hill(hy + 6.4, 21, '#1f5560', 4.1, 0.006);
  });
}
