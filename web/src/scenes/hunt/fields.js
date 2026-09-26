// HUNT — cultivation: the first furrow, tilled soil spreading row by row, crop rows sprouting as
// billboard strips of painted plants, and the pivot's fields revealed behind them through
// procedural growth time-maps. Ends exactly on PIVOT.fields' painted land layer.
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep } from '../lib/kit.js';
import { fbm2, noise2, ease, invLerp } from '../../engine/math.js';
import { textureFromCanvas } from '../../engine/gl.js';
import * as K from './choreo.js';
import { inkEdge, tuft, dab } from './land.js';
import { dawnAt } from './sky.js';

// Fields-local coordinates (0..2600, 0..1800) = the pivot fields layer; ground = local + (-340, -360)
const FW = 2600, FH = 1800;
const toBand = (lx, ly) => K.worldToBand(lx - 340, ly - 360);
const bandToLocal = (u, o) => {
  const [x, y] = K.bandToWorld(u, o);
  return [x + 340, y + 360];
};
// cultivated region (band coords)
export const CULT = { u0: -1380, u1: 1380, o0: -1010, o1: 1010 };
const inCult = (u, o) => u > CULT.u0 && u < CULT.u1 && o > CULT.o0 && o < CULT.o1;

// ------------------------------------------------------------------------------------------------
// Growth timing (local seconds)
// ------------------------------------------------------------------------------------------------
export const GROW = { t0: 6.35, t1: 9.95, a0: 7.3, spread: 0.95, lagB: 0.24 };
// Furrow sources: the spear's first furrow, then bold furrows racing out along every band boundary
// (the furrow multiplies). Each source runs from a start point `us` along the row with eased speed.
const FIRST = { o: K.O1, t: K.T.furrow, us: K.U_L, dF: 2900, dB: 1700, durF: 1.0, durB: 0.9, first: true };
export const SOURCES = (() => {
  const r = rng('hunt-plough');
  const bs = K.BANDS.filter((b) => b.off > CULT.o0 - 40 && b.off < CULT.o1 + 40).map((b) => ({ o: b.off, d: Math.abs(b.off - K.O1) }));
  bs.sort((a, b) => a.d - b.d);
  // the furrow multiplies on the beat: the boundaries of the spear's band appear together on the
  // "multiply" cue, then the next pair outward on each following eighth note (1 -> 3 -> 5 -> 7 -> 9)
  const out = [FIRST];
  bs.forEach((b, i) => {
    const pair = Math.floor(i / 2);
    out.push({ o: b.o, t: K.T.multiply + pair * K.EIGHTH, us: K.U_L + r(-200, 200), dF: 2300, dB: 2300, durF: r(0.8, 0.95), durB: r(0.8, 0.95), first: false, pair });
  });
  return out.sort((a, b) => a.o - b.o);
})();
// eased front: position reached along the row after `dt` seconds, and its inverse
const invOutCubic = (y) => 1 - Math.cbrt(1 - y);
export function frontReach(S, dt) {
  if (dt <= 0) return [0, 0];
  return [S.dF * ease.outCubic(clamp(dt / S.durF)), S.dB * ease.outCubic(clamp(dt / S.durB))];
}
function frontTime(S, u) {
  const du = u - S.us;
  if (du >= 0) return du >= S.dF ? 1e3 : S.t + S.durF * invOutCubic(du / S.dF);
  return -du >= S.dB ? 1e3 : S.t + S.durB * invOutCubic(-du / S.dB);
}
function bracket(o) {
  // sources enclosing o (by offset)
  let lo = null, hi = null;
  for (const S of SOURCES) {
    if (S.o <= o) lo = S;
    else if (!hi) hi = S;
  }
  return [lo, hi];
}
const V_SPREAD = 430;
// tilling time: the soil turns from the nearest furrows outward across the band (organic edge)
export function timeA(u, o) {
  const [lo, hi] = bracket(o);
  let T = 1e3;
  const n1 = noise2(u * 0.012, o * 0.02, 21), n2 = noise2(u * 0.05, o * 0.08, 31);
  for (const S of [lo, hi]) {
    if (!S) continue;
    const d = Math.abs(o - S.o);
    const tt = frontTime(S, u) + (d / V_SPREAD) * (1 + 0.35 * n1) + 0.04 * n2 + (S.first ? 1.05 : 0);
    if (tt < T) T = tt;
  }
  return T;
}
// crops (colour) time: patches filling in behind the tilling
export function timeB(u, o) {
  const patch = 0.5 + 0.5 * fbm2(u * 0.0065 + 3.1, o * 0.009 - 1.7, 5, 3);
  const fine = 0.5 + 0.5 * noise2(u * 0.05, o * 0.08, 9);
  return timeA(u, o) + GROW.lagB + 0.24 * patch + 0.05 * fine;
}
// the source that tills a given row first, and when the tilling reaches the row's line
export function rowSource(o) {
  const [lo, hi] = bracket(o);
  const cand = [lo, hi].filter(Boolean).map((S) => ({ S, delay: Math.abs(o - S.o) / V_SPREAD + (S.first ? 1.05 : 0) }));
  cand.sort((a, b) => a.S.t + a.delay - (b.S.t + b.delay));
  return cand[0];
}
const tToV = (t) => 1 - (t - GROW.t0) / (GROW.t1 - GROW.t0);
export const thrAt = (lt) => tToV(lt); // mask threshold that reveals everything with T <= lt

// Canvas time-map layers (alpha = normalised reveal value). Created lazily with the GL context.
export function makeTimeMaps(gl) {
  const pxu = 0.62, cw = Math.ceil(FW * pxu), ch = Math.ceil(FH * pxu);
  const mk = (fn) => {
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const g = cv.getContext('2d');
    const img = g.createImageData(cw, ch);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const [u, o] = toBand((i + 0.5) / pxu, (j + 0.5) / pxu);
      const v = inCult(u, o) ? clamp(tToV(fn(u, o)), 0.004, 1) : 0;
      const k = (j * cw + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(v * 255);
    }
    g.putImageData(img, 0, 0);
    const tex = textureFromCanvas(gl, cv, { mip: true });
    return { tex, w: FW, h: FH, flipY: false, dispose: () => gl.deleteTexture(tex) };
  };
  return { A: mk(timeA), B: mk(timeB) };
}

// ------------------------------------------------------------------------------------------------
// Paintings
// ------------------------------------------------------------------------------------------------
const SOIL = { base: '#6a4a30', tones: ['#74523a', '#62422c', '#7e5c3c', '#6c4a32', '#86623e'], groove: '#4a2c18', ridge: '#92684a', clod: ['#553520', '#7a5436', '#8e6642'] };
export function paintTilled(P) {
  return P.layer('tilled', { w: FW, h: FH, scale: K.sc(P, 0.7) }, (c) => {
    const r = c.r;
    c.washPoly([[-10, -10], [FW + 10, -10], [FW + 10, FH + 10], [-10, FH + 10]], SOIL.base, 255);
    for (let i = 0; i < 20; i++) c.fillPoly(c.blob(r(0, FW), r(0, FH), r(300, 700), r(160, 340), { rot: K.FA }), r.pick(SOIL.tones), { opacity: 60, bleed: 0.1, texture: 0.9, border: 0.2 });
    // furrows: along every pivot line + band boundaries — dragged dry-brush groove + lit ridge
    const lines = K.LINES.map((l) => l.o).concat(K.BANDS.map((b) => b.off));
    for (const o of lines) {
      if (o < CULT.o0 - 40 || o > CULT.o1 + 40) continue;
      for (let s = 0; s < 3; s++) {
        const u0 = -1650 + s * 1100 + r(-60, 60), u1 = u0 + 1200 + r(0, 100);
        const pts = [];
        for (let k = 0; k <= 10; k++) {
          const u = lerp(u0, u1, k / 10);
          pts.push([...bandToLocal(u, o + r(-0.8, 0.8)), 0.7 + 0.4 * Math.sin((k / 10) * Math.PI)]);
        }
        c.strokePath(pts, r() < 0.7 ? 'dry' : 'charcoal', SOIL.groove, r(1.6, 2.4), 0.3);
        c.strokePath(pts.map((p) => [p[0] + K.FO[0] * 4, p[1] + K.FO[1] * 4, p[2]]), r.pick(['dry', 'pastel']), SOIL.ridge, r(0.8, 1.3), 0.3);
      }
    }
    // clods and stones along the rows
    for (let i = 0; i < 1400; i++) {
      const u = r(-1600, 1600), o = r(CULT.o0, CULT.o1);
      const [x, y] = bandToLocal(u, o);
      const s = r(2, 6);
      c.washPoly(c.blob(x, y, s * 1.3, s * 0.8, { rot: K.FA, wobble: 0.3 }), r.pick(SOIL.clod), 255);
    }
    for (let i = 0; i < 90; i++) {
      const u = r(-1600, 1600), o = r(CULT.o0, CULT.o1), [x, y] = bandToLocal(u, o), s = r(5, 12);
      c.washPoly(c.blob(x, y, s, s * 0.7), r.pick(['#8a8478', '#6a665e', '#a09a88']), 255);
      c.strokePath([[x - s, y + s * 0.3], [x + s * 0.8, y + s * 0.5]], 'ink', '#2a2420', 0.6, 0.5);
    }
    for (let i = 0; i < 40; i++) {
      const x = r(0, FW), y = r(0, FH);
      c.line(x, y, x + K.FU[0] * r(100, 300), y + K.FU[1] * r(100, 300), 'dust', r.pick(['#2a170c', '#9a6a44']), 0.7);
    }
  });
}
// The first furrow: a strip along the line O1 (local x = u + 1700, y = o-offset + 40)
export const FF = { u0: -1700, len: 3400, h: 110 };
export function paintFirstFurrow(P) {
  return P.layer('firstFurrow', { w: FF.len, h: FF.h, scale: K.sc(P, 0.9) }, (c) => {
    const r = c.r, cy = FF.h / 2;
    for (let s = 0; s < 4; s++) {
      const x0 = s * 850 - 20, pts = [];
      for (let k = 0; k <= 12; k++) pts.push([x0 + (k / 12) * 900, cy + r(-1, 1), 0.8 + 0.3 * Math.sin((k / 12) * Math.PI)]);
      // thrown soil on both lips, the dark cut, a lit edge
      c.strokePath(pts.map((p) => [p[0], p[1] - 14, p[2]]), 'dry', '#7a5436', 5.2, 0.3);
      c.strokePath(pts.map((p) => [p[0], p[1] + 14, p[2]]), 'dry', '#5a3a26', 4.6, 0.3);
      c.strokePath(pts, 'gouache', '#342010', 3.6, 0.3);
      c.strokePath(pts.map((p) => [p[0], p[1] + 3, p[2]]), 'dry', '#48301a', 2.2, 0.3);
      c.strokePath(pts.map((p) => [p[0], p[1] - 20, p[2] * 0.7]), 'dry', '#b0804a', 1.6, 0.3);
    }
    for (let i = 0; i < 520; i++) {
      const x = r(0, FF.len), y = cy + (r() < 0.5 ? -1 : 1) * r(12, 40), s = r(2.5, 7);
      c.washPoly(c.blob(x, y, s * 1.4, s), r.pick(SOIL.clod), 255);
    }
  });
}

// Crop row strips: 6 types x 2 variants; each strip 1600 long, plants rooted at y = 64.
export const ROW = { len: 1600, h: 72, base: 64 };
const ROW_TYPES = {
  wheat: ['#f2b544', '#e9c98a', '#c98f3a', '#f7d27a'],
  green: ['#6aa36b', '#3f7d5a', '#5d7a3e', '#8fbf7a'],
  sage: ['#a8bf96', '#c8d8b0', '#8aa878', '#d0dcb8'],
  olive: ['#7a8a3a', '#9aa048', '#5e6a2a', '#b0b060'],
  ochre: ['#c98f3a', '#e0a850', '#a86a2a', '#f0c070'],
  clods: ['#6a4028', '#4e3020', '#8a5a3a', '#3a2416'],
};
export const ROW_KEYS = Object.keys(ROW_TYPES);
const BAND_ROW = { '#6aa36b': 'green', '#e9c98a': 'wheat', '#3f7d5a': 'green', '#c98f3a': 'ochre', '#8a5a3a': 'clods', '#7a8a3a': 'olive', '#f2b544': 'wheat', '#5d7a3e': 'green', '#a8bf96': 'sage' };
export const rowTypeOf = (bandIdx) => ROW_KEYS.indexOf(BAND_ROW[K.BANDS[bandIdx].col] || 'green');
export function paintRows(P) {
  const n = ROW_KEYS.length * 2;
  return P.layer('rows', { w: ROW.len, h: ROW.h * n, scale: K.sc(P, 0.8) }, (c) => {
    const r = c.r;
    ROW_KEYS.forEach((key, ti) => {
      const tones = ROW_TYPES[key];
      for (let v = 0; v < 2; v++) {
        const y0 = (ti * 2 + v) * ROW.h, gy = y0 + ROW.base;
        let x = r(0, 8);
        while (x < ROW.len) {
          const hgt = key === 'clods' ? r(5, 10) : r(26, 50);
          if (key === 'clods') {
            c.washPoly(c.blob(x, gy - hgt * 0.4, r(4, 8), hgt * 0.5, { wobble: 0.3 }), r.pick(tones), 255);
          } else {
            // stems/leaves: 3-5 upward strokes; a head dab for grain crops
            const m = r.int(3, 5);
            for (let k = 0; k < m; k++) {
              const a = -Math.PI / 2 + r(-0.35, 0.35), L = hgt * r(0.6, 1);
              c.strokePath([[x, gy, 1.1], [x + Math.cos(a) * L * 0.5, gy + Math.sin(a) * L * 0.5, 0.9], [x + Math.cos(a + r(-0.2, 0.2)) * L, gy + Math.sin(a) * L, 0.3]], r.pick(['ink', 'dry', 'pastel']), r.pick(tones), r(0.9, 1.5), 0.6);
            }
            if (key === 'wheat' || key === 'ochre') {
              const hx = x + r(-3, 3), hy = gy - hgt;
              c.fillPoly(c.blob(hx, hy, 2.6, 6.5, { rot: r(-0.2, 0.2), wobble: 0.2 }), r.pick(tones), { opacity: 220, bleed: 0.01, texture: 0.4 });
              c.strokePath([[hx, hy - 6], [hx + r(-1, 2), hy - 12]], 'wire', tones[1], 0.7, 0.4);
            } else {
              c.fillPoly(c.blob(x + r(-4, 4), gy - hgt * 0.75, r(4, 7), r(3, 5), { wobble: 0.3 }), r.pick(tones), { opacity: 170, bleed: 0.01, texture: 0.5 });
            }
            // dark base shadow
            c.strokePath([[x - 5, gy + 1], [x + 5, gy + 1]], 'dry', '#2a1a0e', 0.9, 0.3);
          }
          x += r(9, 17);
        }
      }
    });
  });
}
// Periphery along the far edge of the fields: a footpath and an irrigation channel fed by the
// stream, with stone piles and a digging stick. Band-aligned strip: x = u + 1800, y = o - PERI.o0.
export const PERI = { u0: -1800, o0: -1190, w: 2150, h: 240, oPath: -1135, oChan: -1062, uSrc: 300 };
export function paintPeriphery(P) {
  return P.layer('periphery', { w: PERI.w, h: PERI.h, scale: K.sc(P, 0.8) }, (c) => {
    const r = c.r;
    const Lc = (u, o) => [u - PERI.u0, o - PERI.o0];
    const run = (o, amp, fn) => {
      const pts = [];
      for (let u = -1790; u <= PERI.u0 + PERI.w + 30; u += 40) pts.push(Lc(u, o + amp * Math.sin(u * 0.0037) + fn(u)));
      return pts;
    };
    // footpath: worn earth with strokes and footprints
    const pc = run(PERI.oPath, 6, () => 0);
    const pPoly = pc.map((p) => [p[0], p[1] - 17]).concat(pc.map((p) => [p[0], p[1] + 17]).reverse());
    c.washPoly(pPoly, '#9a8258', 255);
    for (let i = 0; i < 700; i++) {
      const k = r.int(0, pc.length - 1), [x, y] = pc[k];
      c.strokePath([[x + r(-20, 20), y + r(-14, 14), 0.7], [x + r(10, 40), y + r(-14, 14), 0.4]], 'dry', r.pick(['#8a6a44', '#c9a878', '#6a5030', '#b8966a']), r(0.5, 1.1), 0.5);
    }
    for (let i = 0; i < 80; i++) {
      const k = r.int(0, pc.length - 1), [x, y] = pc[k];
      c.washPoly(c.blob(x + r(-10, 10), y + (i % 2 ? -5 : 5), 3.5, 2, { rot: 0 }), '#6a5030', 255);
    }
    inkEdge(c, pc.map((p) => [p[0], p[1] - 17]), '#6a5030', 0.5, { lost: 0.5, brushName: 'wire', seg: 8 });
    // irrigation channel: earth banks, water, glints
    const cc = run(PERI.oChan, 5, (u) => 2 * Math.sin(u * 0.03));
    const bank = cc.map((p) => [p[0], p[1] - 26]).concat(cc.map((p) => [p[0], p[1] + 26]).reverse());
    c.washPoly(bank, '#6e5a3a', 255);
    for (let i = 0; i < 520; i++) {
      const k = r.int(0, cc.length - 1), [x, y] = cc[k];
      const side = r() < 0.5 ? -1 : 1;
      c.strokePath([[x, y + side * r(13, 25), 0.6], [x + r(30, 70), y + side * r(13, 25), 0.4]], 'dry', r.pick(['#8a7048', '#5e4a30', '#9a8058', '#4e3c26']), r(0.6, 1.3), 0.5);
    }
    const water = cc.map((p) => [p[0], p[1] - 11]).concat(cc.map((p) => [p[0], p[1] + 11]).reverse());
    c.washPoly(water, '#2f6f86', 255);
    for (let i = 0; i < 260; i++) {
      const k = r.int(0, cc.length - 1), [x, y] = cc[k];
      c.strokePath([[x, y + r(-8, 8), 0.6], [x + r(40, 110), y + r(-8, 8), 1], [x + r(110, 170), y + r(-8, 8), 0.4]], r.pick(['gouache', 'dry']), r.pick(['#3a8aa0', '#28607a', '#4aa8b8', '#5ab8c8']), r(0.5, 1.0), 0.5);
    }
    for (let i = 0; i < 90; i++) {
      const k = r.int(0, cc.length - 1), [x, y] = cc[k];
      dab(c, x, y + r(-6, 6), r(-0.05, 0.05), r(12, 34), 'ink', r.pick(['#bfe8ee', '#e6f6f6', '#9fd8e0']), r(0.5, 0.9));
    }
    inkEdge(c, cc.map((p) => [p[0], p[1] - 11]), '#1a3a40', 0.8, { lost: 0.3, seg: 10 });
    inkEdge(c, cc.map((p) => [p[0], p[1] + 11]), '#1a3a40', 0.8, { lost: 0.3, seg: 10 });
    for (let i = 0; i < 160; i++) {
      const k = r.int(0, cc.length - 1), [x, y] = cc[k];
      tuft(c, x + r(-10, 10), y + (r() < 0.5 ? -27 : 28), r(10, 24), ['#6aa36b', '#8fbf7a', '#3f7d5a', '#c9b884'], { n: 5, w: 0.8 });
    }
    // stone piles beside the path, and a digging stick left by it
    for (const u of [-1500, -1000, -520, 40]) {
      const [x0, y0] = Lc(u, PERI.oPath - 30);
      for (let i = 0; i < 8; i++) {
        const x = x0 + r(-26, 26), y = y0 + r(-10, 8), s = r(6, 12);
        c.washPoly(c.blob(x, y, s, s * 0.7), r.pick(['#8a8478', '#6a665e', '#a09a88', '#7a7468']), 255);
        dab(c, x - s * 0.5, y - s * 0.3, 0, s * 0.8, 'dry', '#c8c2b0', 0.5);
        inkEdge(c, c.blob(x, y, s, s * 0.7, { n: 12 }), '#2a2622', 0.6, { lost: 0.4 });
      }
    }
    const [sx, sy] = Lc(-260, PERI.oPath + 26);
    c.strokePath([[sx, sy, 1], [sx + 90, sy + 6, 1], [sx + 170, sy + 16, 0.7]], 'gouache', '#7a4e24', 1.8, 0.3);
    c.strokePath([[sx + 2, sy - 2, 1], [sx + 90, sy + 3, 1]], 'ink', '#d9a860', 0.5, 0.3);
    c.strokePath([[sx + 168, sy + 14], [sx + 186, sy + 22]], 'ink', '#3a2612', 1.2, 0.3);
  });
}
const periM = () => M.mul(K.BAND_M, M.translate(PERI.u0, PERI.o0));


// ------------------------------------------------------------------------------------------------
// Drawing (ground system). G = K.groundM(e); V = current view (for screen-space masks).
// ------------------------------------------------------------------------------------------------
export function drawCultivation(R, lt, A, AF, c, maps) {
  const G = K.groundM(c.e);
  const V = R.view;
  const fieldsM = M.mul(G, K.FIELD_M);
  const maskFor = (map, thr, soft) => ({ type: 'texture', layer: map, m: M.mul(V, fieldsM), threshold: thr, softness: soft });
  const light = groundLight(lt);
  // periphery (channel, path) — dug as the ploughing spreads
  const pt = lt - 8.0;
  if (pt > 0) {
    const reach = 2300 * ease.outCubic(clamp(pt / 1.3));
    const VGp = M.mul(V, G);
    const pa = M.apply(VGp, ...K.bandToWorld(0, PERI.oChan)), pb = M.apply(VGp, ...K.bandToWorld(100, PERI.oChan));
    const pl = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1, pd = [(pb[0] - pa[0]) / pl, (pb[1] - pa[1]) / pl];
    for (const sgn of [-1]) {
      const uTo = PERI.uSrc + sgn * reach;
      const f = M.apply(VGp, ...K.bandToWorld(uTo, PERI.oChan)), d1 = sgn * -(f[0] * pd[0] + f[1] * pd[1]);
      const x0 = clamp(Math.min(PERI.uSrc, uTo) - PERI.u0 - (sgn < 0 ? 30 : 0), 0, PERI.w), x1 = clamp(Math.max(PERI.uSrc, uTo) - PERI.u0 + (sgn > 0 ? 30 : 0), 0, PERI.w);
      if (x1 - x0 < 1) continue;
      R.layer(A.peri, M.mul(M.mul(G, periM()), M.translate(x0, 0)), { ...light, uv: [x0 / PERI.w, 0, x1 / PERI.w, 1], w: x1 - x0, h: PERI.h, mask: { type: 'linear', nx: -sgn * pd[0], ny: -sgn * pd[1], d0: d1 - 24, d1 } });
    }
  }
  // tilled soil spreading outward from the first furrow
  if (lt > GROW.a0 - 0.05) R.layer(A.tilled, fieldsM, { ...light, mask: maskFor(maps.A, thrAt(lt), 0.006) });
  // the first furrow racing out of the impact, then bold furrows racing along the band boundaries
  // (the furrow multiplies); each is a painted strip revealed up to its running front
  const VG = M.mul(V, G);
  const scr = (u, o) => M.apply(VG, ...K.bandToWorld(u, o));
  for (const S of SOURCES) {
    const dt = lt - S.t;
    if (dt <= 0) continue;
    const [rf, rb] = frontReach(S, dt);
    const a = scr(0, S.o), b = scr(100, S.o);
    const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dirS = [(b[0] - a[0]) / dl, (b[1] - a[1]) / dl];
    const hs = S.first ? 1 : 0.62;
    const FM = M.mul(G, M.mul(K.BAND_M, M.chain(M.translate(FF.u0, S.o), M.scale(1, hs), M.translate(0, -FF.h / 2))));
    const half = (uFrom, uTo, sgn) => {
      const f = scr(uTo, S.o), d1 = sgn * -(f[0] * dirS[0] + f[1] * dirS[1]);
      const x0 = Math.min(uFrom, uTo) - FF.u0, x1 = Math.max(uFrom, uTo) - FF.u0;
      const cx0 = clamp(x0 - (sgn < 0 ? 40 : 0), 0, FF.len), cx1 = clamp(x1 + (sgn > 0 ? 40 : 0), 0, FF.len);
      if (cx1 - cx0 < 1) return;
      R.layer(A.firstFurrow, M.mul(FM, M.translate(cx0, 0)), { ...light, uv: [cx0 / FF.len, 0, cx1 / FF.len, 1], w: cx1 - cx0, h: FF.h, mask: { type: 'linear', nx: -sgn * dirS[0], ny: -sgn * dirS[1], d0: d1 - 18, d1 } });
    };
    const uMax = (540 + S.o * K.FO[1] - (K.GFAR + 40)) / -K.FU[1]; // beyond this the row would pass the horizon
    half(S.us - 20, Math.min(S.us + rf, uMax), 1);
    half(S.us - rb, S.us + 20, -1);
  }
  // the pivot's fields: crops colouring the rows
  if (lt > GROW.a0 + GROW.lagB - 0.1) {
    const done = lt >= GROW.t1 - 0.3;
    if (done) R.layer(AF.land, fieldsM);
    else {
      // crops come up young and green, then ripen into the band colours in a following wave; the
      // ripening lag shrinks to zero before the end so the last frames are exactly the pivot
      const lag = 0.55 * (1 - smoothstep(8.9, 9.55, lt));
      const lf = lightFinal(lt);
      if (lag > 0.005) R.layer(AF.land, fieldsM, { ...lf, color: [0.46, 0.6, 0.3, 0.5 * (lag / 0.55)], mask: maskFor(maps.B, thrAt(lt), 0.012) });
      R.layer(AF.land, fieldsM, { ...lf, mask: maskFor(maps.B, thrAt(lt - lag), 0.012) });
    }
  }
}

// Crop rows (billboards) — drawn after the ground, back to front.
export function drawRows(R, lt, A, c) {
  if (lt < GROW.a0 + 0.15) return;
  const ce = Math.cos(c.e);
  if (ce < 0.004) return;
  const G = K.groundM(c.e);
  const B = [K.FU[0], K.FU[1] * Math.sin(c.e)];
  const light = groundLight(lt);
  const flat = 1 - smoothstep(8.6, 9.75, lt); // plants merge into the colour as the view goes top-down
  for (let li = 0; li < K.LINES.length; li++) {
    const ln = K.LINES[li];
    const o = ln.o;
    if (o < CULT.o0 + 20 || o > CULT.o1 - 20) continue;
    const src = rowSource(o);
    if (!src) continue;
    const S = src.S;
    const type = rowTypeOf(ln.band);
    const tRow = S.t + src.delay + 0.25;
    const age = lt - tRow;
    if (age <= 0) continue;
    const grow = ease.outCubic(clamp(age / 0.9)) * flat;
    if (grow <= 0.01) continue;
    // plants follow the tilling along the row
    const [rf, rb] = frontReach(S, age);
    const ua = Math.max(CULT.u0 + 30, S.us - rb), ub = Math.min(CULT.u1 - 30, S.us + rf);
    for (const [s0, s1, v] of [[-1600, 0, (li * 7) % 2], [0, 1600, (li * 3 + 1) % 2]]) {
      const a0 = Math.max(s0, ua), a1 = Math.min(s1, ub);
      if (a1 - a0 < 4) continue;
      const cell = type * 2 + v;
      const base = M.apply(G, ...K.bandToWorld(a0, o));
      const hs = grow * ce * (0.85 + 0.15 * Math.sin(li * 1.7));
      const m = [B[0], B[1], 0, hs, base[0], base[1]];
      const x0 = a0 - s0;
      R.layer(A.rows, M.mul(m, M.translate(0, -ROW.base)), { ...light, uv: [x0 / ROW.len, (cell * ROW.h) / (ROW.h * 12), (x0 + a1 - a0) / ROW.len, ((cell + 1) * ROW.h) / (ROW.h * 12)], w: a1 - a0, h: ROW.h });
    }
  }
}

// Light on the ground: pre-dawn blue → warm sunrise → neutral daylight at the end.
export function groundLight(lt) {
  const d = dawnAt(lt);
  const k = smoothstep(8.3, 9.6, lt);
  const night = [0.42, 0.5, 0.72], warm = [1.07, 0.96, 0.86];
  const t = d < 1 ? night.map((v, i) => lerp(v, warm[i], d)) : warm;
  return { tint: t.map((v) => lerp(v, 1, k)) };
}
function lightFinal(lt) {
  const g = groundLight(lt);
  return g;
}
