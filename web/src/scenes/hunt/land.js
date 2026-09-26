// HUNT — landscape paintings: the teal ridge (side-view card), crest trees, grass tufts, the far
// mountain ranges (billboards at the horizon), the wild valley plain (ground card), and the herd.
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, circlePts } from '../lib/kit.js';
import * as K from './choreo.js';

// ------------------------------------------------------------------------------------------------
// brush helpers
// ------------------------------------------------------------------------------------------------
// Contour with pressure variation and lost-and-found edges.
export function inkEdge(c, pts, color, w = 1, { lost = 0.22, brushName = 'ink', seg = 7 } = {}) {
  const r = c.r;
  let i = 0;
  while (i < pts.length - 1) {
    const n = Math.max(2, Math.round(seg * r(0.6, 1.4)));
    const part = pts.slice(i, Math.min(pts.length, i + n + 1));
    if (part.length > 1 && r() > lost) c.strokePath(part.map((p, k) => [p[0], p[1], 0.45 + 0.75 * Math.sin((k / (part.length - 1)) * Math.PI)]), brushName, color, w * r(0.75, 1.25), 0.5);
    i += n;
  }
}
// A short tapered stroke from (x, y) in direction a.
export function dab(c, x, y, a, L, brushName, color, w, bend = 0) {
  const pts = [];
  for (let k = 0; k <= 3; k++) {
    const u = k / 3, aa = a + bend * u;
    pts.push([x + Math.cos(aa) * L * u, y + Math.sin(aa) * L * u, 0.5 + 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.2 + 0.1))]);
  }
  c.strokePath(pts, brushName, color, w, 0.6);
}
// A painted boulder: base, shadow side, lit planes, cracks, broken contour.
export function rock(c, x, y, rw, rh, { base = '#1d5a62', dark = '#0c3038', lit = '#5fb3aa', ink = '#082026', seed = 0 } = {}) {
  const r = c.r;
  const pts = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const k = 1 + 0.16 * Math.sin(a * 3 + seed) + r(-0.07, 0.07);
    pts.push([x + Math.cos(a) * rw * k, y + Math.sin(a) * rh * k * 1.2]);
  }
  pts.push([x + rw * 1.02, y + rh * 0.22], [x - rw * 1.02, y + rh * 0.22]);
  c.washPoly(pts, base, 255);
  const sh = pts.filter((p) => p[0] > x + rw * 0.05).concat([[x + rw * 0.05, y + rh * 0.2]]);
  c.fillPoly(sh, dark, { opacity: 150, bleed: 0.015, texture: 0.6, border: 0.3 });
  const top = [[x - rw * 0.75, y - rh * 0.45], [x - rw * 0.2, y - rh * 1.08], [x + rw * 0.3, y - rh * 0.9], [x - rw * 0.05, y - rh * 0.4]];
  c.fillPoly(top, lit, { opacity: 110, bleed: 0.02, texture: 0.5, border: 0.2 });
  for (let i = 0; i < 6; i++) {
    const px = x + r(-0.7, 0.2) * rw, py = y - r(0.2, 0.9) * rh;
    dab(c, px, py, r(-0.4, 0.3), rw * r(0.25, 0.5), 'dry', r() < 0.5 ? lit : mixHex(base, lit, 0.4), Math.max(0.5, rw / 30));
  }
  for (let i = 0; i < 2; i++) {
    const cx = x + r(-0.4, 0.4) * rw, cy = y - r(0.2, 0.8) * rh;
    c.strokePath([[cx, cy], [cx + r(-6, 6), cy + rh * 0.3], [cx + r(-6, 8), cy + rh * 0.55]], 'ink', ink, Math.max(0.5, rw / 50), 0.5);
  }
  inkEdge(c, pts.slice(0, n), ink, Math.max(0.7, rw / 36), { lost: 0.3 });
}
// Grass tuft of tapered blades rooted at (x, y).
export function tuft(c, x, y, h, tones, { n = 9, spread = 0.9, lean = 0.1, w = 1.2, brushName = 'ink' } = {}) {
  const r = c.r;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + lean + r(-spread, spread) * 0.6, L = h * r(0.45, 1.05);
    const bend = r(-0.45, 0.45) + lean * 0.8;
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const u = k / 4, aa = a + bend * u * u;
      pts.push([x + r(-1.5, 1.5) * (k === 0) + Math.cos(aa) * L * u, y + Math.sin(aa) * L * u, 1.2 - u * 0.95]);
    }
    c.strokePath(pts, brushName, r.pick(tones), w * r(0.7, 1.3), 0.6);
  }
}
function shrub(c, x, y, rw, rh, tones, ink, rim = null) {
  const r = c.r;
  for (let i = 0; i < 4; i++) c.fillPoly(c.blob(x + r(-0.4, 0.4) * rw, y - rh * r(0.35, 0.7), rw * r(0.45, 0.72), rh * r(0.4, 0.58), { wobble: 0.28, freq: 5 }), r.pick(tones), { opacity: 170, bleed: 0.02, texture: 0.7, border: 0.4 });
  for (let i = 0; i < 26; i++) {
    const a = r(-Math.PI, 0), d = r(0.35, 1.05);
    const px = x + Math.cos(a) * rw * d, py = y - rh * 0.5 + Math.sin(a) * rh * d;
    dab(c, px, py, a + r(-0.5, 0.5), r(5, 12), 'dry', r.pick(tones), r(0.6, 1.2));
  }
  if (rim) for (let i = 0; i < 7; i++) {
    const a = r(-1.6, -0.3), px = x + Math.cos(a) * rw * 0.9, py = y - rh * 0.5 + Math.sin(a) * rh * 0.9;
    dab(c, px, py, a + 1.4, r(6, 12), 'ink', rim, 0.7);
  }
  inkEdge(c, circlePts(x, y - rh * 0.5, rw, 18, Math.PI, TAU).map((p) => [p[0], p[1] + r(-3, 3)]), ink, 0.8, { lost: 0.45 });
}

// ------------------------------------------------------------------------------------------------
// The ridge (SW coordinates; layer origin at x0, y0)
// ------------------------------------------------------------------------------------------------
export const RIDGE = { x0: -6500, y0: -120, w: 5200, h: 1900 };
const RT = {
  base: '#0c4148', surf: '#17706f',
  surfTones: ['#1f7f7c', '#2a8f88', '#166466', '#3a9a8a', '#1a7470', '#24847e', '#11595e'],
  lit: ['#5aaea4', '#6cc0b4', '#4a9e98', '#7fd0c4'],
  face: ['#0f4e57', '#0c4049', '#125a62', '#0a3a44', '#0e4852'],
  deep: ['#0a3040', '#0c2a3c', '#0e2c40', '#16223a'],
  ink: '#05202a',
};
function cliffEdge() {
  const pts = [];
  for (let x = RIDGE.x0 - 40; x <= K.XTOP + 700; x += 25) {
    const y = K.crestY(x);
    if (y > RIDGE.y0 + RIDGE.h + 40) break;
    pts.push([x, y]);
  }
  return pts;
}
const surfDepth = (x) => K.SURF * clamp((K.XTOP + 120 - x) / 260);
// polygon between two curves y0(x) and y1(x) over [xa, xb]
function bandPoly(fy0, fy1, xa, xb, step = 20) {
  const a = [], b = [];
  for (let x = xa; x <= xb + 0.01; x += step) {
    a.push([x, fy0(x)]);
    b.push([x, fy1(x)]);
  }
  return a.concat(b.reverse());
}
// angular boulder: lit top plane, shadow side, firm contour on the shadow side
export function boulder(c, x, y, s, { base = '#135a60', lit = '#3a948c', dark = '#082e36', ink = '#041a20', seed = 0 } = {}) {
  const r = rng(`boulder-${seed}`);
  const n = 7, pts = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const k = r(0.75, 1.1);
    pts.push([x + Math.cos(a) * s * 1.3 * k, y + Math.sin(a) * s * 0.9 * k]);
  }
  pts.push([x + s * 1.25, y + s * 0.15], [x - s * 1.25, y + s * 0.15]);
  c.washPoly(pts, base, 255);
  const top = [pts[1], pts[2], pts[3], [x + s * 0.1, y - s * 0.35], [x - s * 0.8, y - s * 0.2]];
  c.washPoly(top, lit, 255);
  const side = [pts[4], pts[5], pts[6], [x + s * 1.25, y + s * 0.15], [x + s * 0.15, y + s * 0.1], [x + s * 0.1, y - s * 0.35]];
  c.washPoly(side, dark, 255);
  for (let i = 0; i < 5; i++) dab(c, x + r(-1, 0.3) * s, y - r(0.2, 0.7) * s, r(-0.3, 0.2), s * r(0.3, 0.6), 'dry', mixHex(lit, '#ffffff', 0.12), Math.max(0.4, s / 40));
  c.strokePath([pts[3], pts[4], pts[5], pts[6]].map((p) => [p[0], p[1], 1]), 'ink', ink, Math.max(0.6, s / 30), 0.3);
  c.strokePath([[x + s * 0.1, y - s * 0.35], [x + s * 0.2, y + s * 0.1]], 'ink', ink, Math.max(0.4, s / 50), 0.3);
}
export function paintRidge(P) {
  const { x0, y0, w, h } = RIDGE;
  return P.layer('ridge', { w, h, scale: K.sc(P, 0.6) }, (c) => {
    const r = c.r;
    const LX = (x) => x - x0, LY = (y) => y - y0;
    const edge = cliffEdge().map((p) => [LX(p[0]), LY(p[1])]);
    const last = edge[edge.length - 1];
    const sil = edge.concat([[last[0] + 60, h + 20], [-20, h + 20]]);
    const xEnd = K.XTOP + 120;
    const crest = (x) => LY(K.crestY(x + x0));
    const front = (x) => crest(x) + surfDepth(x + x0) + 14 * Math.sin((x + x0) * 0.004) * (surfDepth(x + x0) / K.SURF);
    // 1. the face: stacked value bands, lighter under the lip, deepening toward the base
    c.washPoly(sil, '#0b3f47', 255);
    const bands = [['#0f525a', 0, 90], ['#0d4a53', 90, 230], ['#0b424c', 230, 420], ['#0a3a46', 420, 680], ['#0a3242', 680, 1100], ['#0c2a3c', 1100, 2000]];
    for (const [col, a, b] of bands) {
      const poly = bandPoly((x) => front(x) + a + 18 * Math.sin(x * 0.0021 + a), (x) => front(x) + b + 18 * Math.sin(x * 0.0021 + b), 0, LX(K.XTOP + 700), 30);
      c.washPoly(poly.map((p) => [p[0], Math.min(p[1], h + 20)]), col, 255);
    }
    // soften band steps with dry-brush strokes that follow the face's slope
    for (let i = 0; i < 700; i++) {
      const x = r(0, LX(K.XTOP + 560)), yf = front(x);
      if (!(yf < h)) continue;
      const y = yf + Math.pow(r(), 1.4) * (h - yf);
      const depth = (y - yf) / 700;
      const a = Math.atan(K.crestSlope(x + x0)) + r(-0.05, 0.05);
      const Ls = r(80, 260);
      const tone = depth < 0.2 ? r.pick(['#135c62', '#11565e', '#16626a']) : depth < 0.7 ? r.pick(['#0f4e57', '#0d4650', '#11525c']) : r.pick(['#0b3846', '#0c3244', '#0e2e40']);
      c.strokePath([[x, y, 0.5], [x + Math.cos(a) * Ls * 0.5, y + Math.sin(a) * Ls * 0.5, 1], [x + Math.cos(a) * Ls, y + Math.sin(a) * Ls, 0.4]], r() < 0.7 ? 'dry' : 'gouache', tone, r(0.8, 2.2), 0.4);
    }
    // fine contour lines (the storyboard's engraved texture), following the ridge
    for (let j = 0; j < 30; j++) {
      const off = 26 + j * j * 1.9 + r(-4, 4);
      const pts = [];
      for (let x = r(0, 200); x < LX(K.XTOP) - j * 6; x += 45) pts.push([x, front(x) + off + 6 * Math.sin(x * 0.004 + j)]);
      inkEdge(c, pts.filter((p) => p[1] < h - 4), j < 8 ? '#2a8a86' : j < 18 ? '#186a70' : '#10505c', 0.55, { lost: 0.45, brushName: 'wire', seg: 9 });
    }
    // 2. the lit top surface
    const surf = bandPoly(crest, front, 0, LX(xEnd), 20);
    c.washPoly(surf, '#1a7472', 255);
    c.washPoly(bandPoly((x) => crest(x) + 2, (x) => crest(x) + surfDepth(x + x0) * 0.38, 0, LX(xEnd), 20), '#1f7e7a', 255);
    for (let i = 0; i < 520; i++) {
      const x = r(0, LX(xEnd - 30)), d = surfDepth(x + x0);
      if (d < 12) continue;
      const f = r(), y = crest(x) + 4 + f * (d - 10);
      const a = Math.atan(K.crestSlope(x + x0)) + r(-0.04, 0.04), Ls = r(60, 220);
      const tone = f < 0.25 ? r.pick(['#3a9a90', '#48a89c', '#2e8e86']) : r.pick(['#17706e', '#1c7874', '#136664', '#22827c']);
      c.strokePath([[x, y, 0.5], [x + Math.cos(a) * Ls * 0.5, y + Math.sin(a) * Ls * 0.5, 1], [x + Math.cos(a) * Ls, y + Math.sin(a) * Ls, 0.4]], r() < 0.6 ? 'dry' : 'gouache', tone, r(0.6, 1.6), 0.4);
    }
    for (let j = 0; j < 7; j++) {
      const pts = [];
      for (let x = r(0, 300); x < LX(K.XTOP - 100); x += 45) pts.push([x, crest(x) + surfDepth(x + x0) * (0.18 + j * 0.12) + 3 * Math.sin(x * 0.01 + j)]);
      inkEdge(c, pts, '#3a9a92', 0.5, { lost: 0.5, brushName: 'wire', seg: 8 });
    }
    // lip of the surface: a darker line where the face breaks away
    const lip = [];
    for (let x = 0; x <= LX(xEnd - 40); x += 30) lip.push([x, front(x)]);
    inkEdge(c, lip, '#0a3a42', 1.1, { lost: 0.3, brushName: 'dry', seg: 8 });
    // 3. a few bold outcrops on the face, pebbles on the surface
    const rr = rng('hunt-ridge-rocks');
    for (let i = 0; i < 16; i++) {
      const x = rr(200, LX(K.XTOP + 380)), yf = front(x);
      const y = yf + rr(60, 700);
      if (y > h - 80) continue;
      boulder(c, x, y, rr(26, 64) * (1 + (y - yf) / 900), { seed: i });
    }
    for (let i = 0; i < 26; i++) {
      const x = rr(100, LX(K.XTOP - 80)), d = surfDepth(x + x0);
      boulder(c, x, crest(x) + rr(20, Math.max(22, d - 6)), rr(7, 16), { base: '#1d6a6a', lit: '#58aca2', dark: '#0e3e44', ink: '#062830', seed: 100 + i });
    }
    // 4. shrubs and grass along the crest and over the surface
    for (let i = 0; i < 26; i++) {
      const x = r(150, LX(K.XTOP - 40));
      shrub(c, x, crest(x) + r(0, 10), r(20, 42), r(16, 30), ['#0f4a4a', '#16585a', '#0c3c44', '#1d6a66'], RT.ink, '#4a9e98');
    }
    for (let i = 0; i < 280; i++) {
      const x = r(40, LX(K.XTOP + 40)), onEdge = r() < 0.55, d = surfDepth(x + x0);
      tuft(c, x, crest(x) + (onEdge ? r(-2, 6) : r(16, Math.max(18, d))), r(16, 40), ['#b8c28a', '#8fb89c', '#d0c490', '#6aa892', '#9fb890'], { n: 7, w: 0.8, lean: 0.22, brushName: r() < 0.5 ? 'ink' : 'HB' });
    }
    // 5. crest: starlit rim + lost-and-found contour; the cliff edge gets a firmer line
    const crestLine = edge.filter((p) => p[0] < LX(K.XTOP) + 60);
    inkEdge(c, crestLine.map((p) => [p[0], p[1] + 3]), '#6cc0b4', 1.0, { lost: 0.35, brushName: 'dry', seg: 10 });
    inkEdge(c, crestLine, RT.ink, 1.3, { lost: 0.25, seg: 9 });
    inkEdge(c, edge.filter((p) => p[0] > LX(K.XTOP) - 60), RT.ink, 1.6, { lost: 0.12, seg: 6 });
  });
}

// Wind-bent trees on the crest (sprites; base at the bottom centre of each cell).
export const TREE_CELL = { w: 460, h: 560 };
export function paintTrees(P) {
  return P.layer('trees', { w: TREE_CELL.w * 3, h: TREE_CELL.h, scale: K.sc(P, 0.9) }, (c) => {
    const r = c.r;
    const bark = ['#0a2630', '#0d2e38', '#08202a'], leaf = ['#0c3038', '#0f3a40', '#11443e', '#0a2a30', '#14483f'];
    for (let t = 0; t < 3; t++) {
      const bx = TREE_CELL.w * t + TREE_CELL.w / 2, by = TREE_CELL.h - 14;
      const H = [470, 400, 330][t], lean = [0.32, -0.16, 0.22][t];
      const spine = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        spine.push([bx + lean * H * 0.55 * u * u + 6 * Math.sin(u * 5 + t), by - u * H * 0.66]);
      }
      const wid = (u) => lerp(15, 4.5, u);
      const left = spine.map((p, k) => [p[0] - wid(k / 10), p[1]]), right = spine.map((p, k) => [p[0] + wid(k / 10), p[1]]);
      c.washPoly(left.concat(right.reverse()), bark[0], 255);
      for (let j = 0; j < 7; j++) c.strokePath(spine.map((p, k) => [p[0] + r(-0.6, 0.6) * wid(k / 10), p[1], 0.8]), r.pick(['dry', '2B', 'ink']), r.pick(bark.concat(['#1a4048'])), 0.7, 0.5);
      const top = spine[10];
      const nb = 6;
      for (let b = 0; b < nb; b++) {
        const from = spine[r.int(5, 10)];
        const a = -Math.PI / 2 + (b / (nb - 1) - 0.5) * 2.2 + lean * 0.9 + r(-0.15, 0.15), Lb = H * r(0.2, 0.34);
        const mid = [from[0] + Math.cos(a) * Lb * 0.55, from[1] + Math.sin(a) * Lb * 0.45 - 10];
        const end = [from[0] + Math.cos(a) * Lb, from[1] + Math.sin(a) * Lb * 0.55];
        c.strokePath([[from[0], from[1], 1.3], [mid[0], mid[1], 1], [end[0], end[1], 0.45]], 'ink', bark[0], 3.2, 0.5);
        c.strokePath([[mid[0], mid[1], 0.8], [mid[0] + Math.cos(a - 0.6) * Lb * 0.3, mid[1] - Lb * 0.18, 0.4]], 'ink', bark[0], 2, 0.5);
        const fw = r(60, 100), fh = r(16, 26);
        c.fillPoly(c.blob(end[0], end[1] - fh * 0.4, fw, fh, { wobble: 0.3, freq: 6 }), r.pick(leaf), { opacity: 190, bleed: 0.02, texture: 0.7, border: 0.45 });
        for (let m = 0; m < 70; m++) {
          const px = end[0] + r(-fw, fw) * 1.05, py = end[1] - fh * 0.4 + r(-fh, fh) * 0.9;
          dab(c, px, py, r(-2.6, -0.5), r(6, 14), 'dry', r.pick(leaf.concat(['#1d5a52'])), r(0.6, 1.1));
        }
        for (let m = 0; m < 10; m++) {
          const px = end[0] + r(-fw * 0.2, fw), py = end[1] - fh * r(0.6, 1.3);
          dab(c, px, py, r(-0.3, 0.2), r(8, 18), 'ink', '#3a8a84', 0.55);
        }
      }
      c.strokePath([[top[0], top[1] + 10], [top[0] + lean * 30, top[1] - 12]], 'ink', bark[0], 2.2, 0.5);
      tuft(c, bx, by, 36, ['#6aa892', '#9fb890', '#3a6a5a'], { n: 10, w: 0.9 });
    }
  });
}
// Grass tuft atlas: 12 variants, cell 140x170, root at (70, 160).
export const GRASS_CELL = { w: 140, h: 170, rx: 70, ry: 160, n: 12 };
export function paintGrass(P) {
  return P.layer('grass', { w: GRASS_CELL.w * GRASS_CELL.n, h: GRASS_CELL.h, scale: K.sc(P, 1.1) }, (c) => {
    const r = c.r;
    for (let i = 0; i < GRASS_CELL.n; i++) {
      const x = i * GRASS_CELL.w + GRASS_CELL.rx, y = GRASS_CELL.ry;
      const dry = i % 3 !== 2;
      const tones = dry ? ['#d9c890', '#e9d9a0', '#bfae78', '#c9b884', '#f0e0b0'] : ['#8fbfa0', '#a8bf96', '#6fae96', '#bfd0a0'];
      tuft(c, x + r(-6, 6), y, r(50, 80), dry ? ['#6a6040', '#8a7a50', '#4a5a40'] : ['#2a5a4a', '#3a6a5a'], { n: 7, spread: 0.8, w: 1.2, brushName: 'HB' });
      tuft(c, x, y, r(90, 150), tones, { n: r.int(10, 16), spread: 1.1, lean: r(-0.12, 0.3), w: 1.15, brushName: r() < 0.5 ? 'ink' : '2B' });
      if (dry) for (let k = 0; k < 5; k++) {
        const px = x + r(-38, 38), py = y - r(95, 145);
        dab(c, px, py, -Math.PI / 2 + r(-0.3, 0.4), r(7, 14), 'ink', '#f3e6c8', 1.1);
      }
    }
  });
}

// ------------------------------------------------------------------------------------------------
// Far mountain ranges (billboards standing on the horizon; local y = −height, x in parallax space)
// ------------------------------------------------------------------------------------------------
export const RANGE = { x0: -3000, w: 7000, top: -560, bottom: 700 };
function ridgeLine(seed, amp, base, x0, w, step = 18) {
  const r = rng(seed), pts = [];
  const f = [r(0.0006, 0.001), r(0.0016, 0.0026), r(0.0045, 0.008), r(0.011, 0.018)], ph = f.map(() => r(0, TAU));
  for (let x = x0; x <= x0 + w; x += step) {
    let y = 0.5 + 0.5 * Math.sin(x * f[0] + ph[0]);
    y += 0.6 * Math.pow(Math.abs(Math.sin(x * f[1] + ph[1])), 1.4);
    y += 0.16 * Math.sin(x * f[2] + ph[2]) + 0.06 * Math.sin(x * f[3] + ph[3]);
    pts.push([x, base - amp * Math.max(0, y)]);
  }
  return pts;
}
export function paintRanges(P) {
  const { x0, w, top, bottom } = RANGE, h = bottom - top;
  const mk = (name, seed, amp, base, T, trees) =>
    P.layer(name, { w, h, scale: K.sc(P, 0.5) }, (c) => {
      const r = c.r;
      const line = ridgeLine(seed, amp, base, x0, w).map((p) => [p[0] - x0, p[1] - top]);
      const hz = -top; // horizon in layer coords
      const sil = line.concat([[w + 20, h + 20], [-20, h + 20]]);
      c.washPoly(sil, T.base, 255);
      // atmospheric bands: lighter toward the base (haze), crisp silhouette on top
      for (let k = 1; k <= 4; k++) {
        const y0 = hz - (5 - k) * amp * 0.28;
        const poly = line.map((p) => [p[0], Math.max(p[1], y0 + 8 * Math.sin(p[0] * 0.003 + k))]).concat([[w + 20, h + 20], [-20, h + 20]]);
        c.washPoly(poly, mixHex(T.base, T.haze, k * 0.16), 255);
      }
      // slope strokes follow the fall lines; east-facing slopes take the lighter tones
      for (let i = 0; i < 1300; i++) {
        const k = r.int(0, line.length - 2), p = line[k], q = line[k + 1];
        const slope = (q[1] - p[1]) / (q[0] - p[0]);
        const depth = Math.pow(r(), 1.5) * (hz - p[1] + 40);
        const x = p[0] + r(-8, 8), y = p[1] + depth + 5;
        const a = Math.PI / 2 + Math.atan(slope) * 0.85 + r(-0.15, 0.15);
        const Ls = r(24, 90);
        const kb = clamp(5 - (hz - y) / (amp * 0.28), 0, 4) | 0; // which haze band we are in
        const local = mixHex(T.base, T.haze, kb * 0.16);
        const tone = mixHex(local, slope < 0 ? r.pick(T.lights) : T.base, r(0.1, 0.24));
        c.strokePath([[x, y, 0.5], [x + Math.cos(a) * Ls * 0.5, y + Math.sin(a) * Ls * 0.5, 1], [x + Math.cos(a) * Ls, y + Math.sin(a) * Ls, 0.4]], 'dry', tone, r(0.4, 0.9), 0.5);
      }
      // fine slope grain and ravines
      for (let i = 0; i < 2600; i++) {
        const k = r.int(0, line.length - 2), p = line[k], q = line[k + 1];
        const slope = (q[1] - p[1]) / (q[0] - p[0]);
        const y = p[1] + Math.pow(r(), 1.2) * (hz - p[1] + 30) + 4, x = p[0] + r(-12, 12);
        const kb = clamp(5 - (hz - y) / (amp * 0.28), 0, 4) | 0;
        const local = mixHex(T.base, T.haze, kb * 0.16);
        const a = Math.PI / 2 + Math.atan(slope) * 0.85 + r(-0.2, 0.2), Ls = r(8, 26);
        c.strokePath([[x, y, 0.5], [x + Math.cos(a) * Ls, y + Math.sin(a) * Ls, 0.4]], r() < 0.7 ? 'dry' : 'HB', mixHex(local, r() < 0.5 ? r.pick(T.lights) : T.edge, r(0.1, 0.22)), r(0.25, 0.6), 0.5);
      }
      for (let i = 0; i < 70; i++) {
        const k = r.int(2, line.length - 3), p = line[k];
        const pts = [];
        let x = p[0], y = p[1] + 6;
        for (let j = 0; j < 6; j++) {
          pts.push([x, y]);
          x += r(-10, 10);
          y += r(16, 34);
          if (y > hz) break;
        }
        if (pts.length > 2) inkEdge(c, pts, mixHex(T.base, T.edge, 0.5), 0.6, { lost: 0.3, brushName: 'dry', seg: 3 });
      }
      // fine ridge lines (engraved texture)
      for (let j = 0; j < 8; j++) {
        const off = 14 + j * j * 5;
        inkEdge(c, line.map((p) => [p[0], p[1] + off + 4 * Math.sin(p[0] * 0.006 + j)]).filter((p) => p[1] < hz + 20), T.line, 0.5, { lost: 0.5, brushName: 'wire', seg: 10 });
      }
      // mist bands along the base
      for (let i = 0; i < 40; i++) {
        const y = hz - r(-10, amp * 0.5), x = r(-300, w);
        c.strokePath([[x, y, 0.5], [x + r(250, 600), y + r(-4, 4), 1], [x + r(650, 1200), y + r(-6, 6), 0.4]], 'dry', T.mist, r(1, 2.2), 0.6);
      }
      inkEdge(c, line, T.edge, 1.0, { lost: 0.35, seg: 12 });
      if (trees) for (let i = 0; i < 240; i++) {
        const k = r.int(0, line.length - 1), p = line[k];
        const th = r(9, 26);
        c.strokePath([[p[0], p[1] + 4], [p[0] + r(-1.5, 1.5), p[1] - th]], 'ink', T.base, 0.9, 0.5);
        c.washPoly(c.blob(p[0], p[1] - th * 0.9, th * 0.26, th * 0.5, { wobble: 0.25 }), T.base, 255);
      }
    });
  const FAR = ['hunt-range-far', 210, -8], NEAR = ['hunt-range-near', 92, 34];
  const far = mk('rangeFar', FAR[0], FAR[1], FAR[2], { base: '#2a3462', haze: '#5a6aa0', tones: ['#303c6c', '#384476', '#2c3866', '#3e4a7c'], lights: ['#56609a', '#5e68a0', '#4c5690'], line: '#46528a', mist: '#6a78aa', edge: '#1c2650' }, false);
  const near = mk('rangeNear', NEAR[0], NEAR[1], NEAR[2], { base: '#141f38', haze: '#2c3a60', tones: ['#1a2844', '#20304e', '#18243e'], lights: ['#2c3c62', '#304268'], line: '#26345a', mist: '#34446a', edge: '#0a1224' }, true);
  const rim = P.layer('rangeRim', { w, h, scale: K.sc(P, 0.5) }, (c) => {
    const r = c.r;
    for (const [seed, amp, base, wgt] of [[FAR[0], FAR[1], FAR[2], 1.1], [NEAR[0], NEAR[1], NEAR[2], 0.9]]) {
      const line = ridgeLine(seed, amp, base, x0, w).map((p) => [p[0] - x0, p[1] - top]);
      for (let i = 0; i < line.length - 8; i += r.int(3, 8)) {
        const part = line.slice(i, i + r.int(4, 10));
        if (r() < 0.25) continue;
        c.strokePath(part.map((p) => [p[0], p[1] + 2.5, 1]), r.pick(['gouache', 'dry']), r.pick(['#ffd49a', '#ffc27a', '#f6a07a', '#ffe0b0']), wgt * r(0.7, 1.3), 0.5);
      }
    }
  });
  return { far, near, rim };
}

// ------------------------------------------------------------------------------------------------
// The wild valley plain, painted on a ground card compressed in depth (gy = gy0 + ly / kw)
// ------------------------------------------------------------------------------------------------
export const PLAIN = { x0: -2600, x1: 3300, gy0: K.GFAR - 20, gy1: 2500, kw: 0.5 };
export function plainM(e) {
  return M.mul(K.groundM(e), [1, 0, 0, 1 / PLAIN.kw, PLAIN.x0, PLAIN.gy0]);
}
export function paintPlain(P) {
  const w = PLAIN.x1 - PLAIN.x0, h = (PLAIN.gy1 - PLAIN.gy0) * PLAIN.kw;
  return P.layer('plain', { w, h, scale: K.sc(P, 0.55) }, (c) => {
    const r = c.r;
    const Y = (gy) => (gy - PLAIN.gy0) * PLAIN.kw;
    // vegetation zones as wavy horizontal bands (far = hazier / cooler, near = richer / warmer)
    const zones = ['#4a6458', '#46644e', '#42664a', '#4c6c48', '#48684c', '#53704a', '#406246', '#4e6e46', '#58744a', '#4a6c48', '#50704a', '#44664a', '#4e6e48', '#5a764c', '#46683e'];
    c.washPoly([[-10, -10], [w + 10, -10], [w + 10, h + 10], [-10, h + 10]], zones[0], 255);
    let yb = 0, zi = 1;
    const edges = [];
    while (yb < h) {
      const th = r(60, 170) * (0.6 + 0.8 * (yb / h));
      const ph = r(0, TAU), am = r(6, 18), fr = r(0.001, 0.003);
      const fy = (x) => yb + am * Math.sin(x * fr + ph) + 6 * Math.sin(x * 0.011 + ph * 2);
      const pts = [];
      for (let x = -20; x <= w + 20; x += 40) pts.push([x, fy(x)]);
      edges.push(pts);
      c.washPoly(pts.concat([[w + 20, h + 20], [-20, h + 20]]), zones[zi % zones.length], 255);
      yb += th;
      zi++;
    }
    c.fillPoly([[-10, -10], [w + 10, -10], [w + 10, h + 10], [-10, h + 10]], '#3a5a44', { opacity: 40, bleed: 0.003, texture: 0.9, border: 0.05 });
    for (let i = 0; i < 46; i++) c.fillPoly(c.blob(r(-100, w + 100), r(0, h), r(140, 520), r(22, 70), { rot: r(-0.05, 0.05), wobble: 0.3, freq: 4 }), r.pick(['#7a8a4a', '#8a8a50', '#6a6a3e', '#5d7a3e', '#7a6a44']), { opacity: r(60, 110), bleed: 0.02, texture: 0.8, border: 0.3 });
    // soften the zone edges with dry-brush along them
    for (const pts of edges) for (let i = 0; i < pts.length - 6; i += r.int(3, 7)) {
      const part = pts.slice(i, i + r.int(4, 9));
      c.strokePath(part.map((p) => [p[0], p[1] + r(-3, 3), 1]), 'dry', r.pick(zones), r(1, 2.4), 0.5);
    }
    // directional grass strokes along the plane
    for (let i = 0; i < 3400; i++) {
      const y = r(0, h), near = y / h;
      const x = r(-150, w), Ls = r(50, 200) * (0.5 + near);
      const tone = r.pick(['#3f6a44', '#4f7a48', '#2e4c3a', '#5d7a3e', '#6a8a4a', '#35583e', '#7a8a4a', '#8a8a50', '#a09a5a', '#2a4436']);
      c.strokePath([[x, y, 0.5], [x + Ls * 0.5, y + r(-1.5, 1.5), 1.1], [x + Ls, y + r(-2, 2), 0.4]], r.pick(['dry', 'dry', 'gouache', 'HB']), tone, r(0.35, 1.1) * (0.5 + near * 0.9), 0.5);
    }
    // dense grass grain: short strokes in near-tones (lighter tops, darker roots), everywhere
    const zoneAt = (y) => zones[Math.min(zones.length - 1, Math.max(0, Math.floor(y / 110)))];
    for (let i = 0; i < 9000; i++) {
      const y = r(0, h), x = r(-40, w), near = y / h;
      const base = zoneAt(y + r(-60, 60));
      const tone = mixHex(base, r() < 0.5 ? r.pick(['#8aa860', '#a8b870', '#c9b884', '#7a9a58']) : r.pick(['#24382c', '#2e4630', '#1e3226']), r(0.18, 0.45));
      const Ls = r(14, 46) * (0.6 + near * 0.8);
      c.strokePath([[x, y, 0.5], [x + Ls * 0.5, y + r(-1, 1), 1], [x + Ls, y + r(-1.5, 1.5), 0.4]], r() < 0.75 ? 'dry' : 'HB', tone, r(0.25, 0.7) * (0.6 + near * 0.7), 0.5);
    }
    for (let i = 0; i < 2600; i++) {
      const y = r(0, h), x = r(0, w), s = 0.3 + 0.8 * (y / h);
      dab(c, x, y, -Math.PI / 2 + r(-0.35, 0.35), r(4, 11) * s, 'ink', mixHex(zoneAt(y), r.pick(['#a8b870', '#c9c090', '#2a4030']), r(0.3, 0.6)), r(0.3, 0.6));
    }
    for (let i = 0; i < 220; i++) {
      const x = r(0, w), y = r(0, h);
      c.line(x, y, x + r(80, 260), y + r(-6, 6), 'dust', r.pick(['#2a4030', '#8aa060', '#b0a070']), 0.6);
    }
    // fine horizontal texture lines (engraved look)
    for (let i = 0; i < 140; i++) {
      const y = r(0, h), x = r(-200, w), Ls = r(300, 900);
      inkEdge(c, [[x, y], [x + Ls * 0.33, y + r(-2, 2)], [x + Ls * 0.66, y + r(-2, 2)], [x + Ls, y + r(-2, 2)]], r.pick(['#6a8a5a', '#2e4c3a', '#8a9a60']), 0.5, { lost: 0.3, brushName: 'wire', seg: 2 });
    }
    // tufts and flowers
    for (let i = 0; i < 1400; i++) {
      const y = r(0, h), x = r(0, w), s = 0.35 + 0.9 * (y / h);
      tuft(c, x, y, r(10, 28) * s, ['#6a8a4a', '#8a9a5a', '#a8bf96', '#4f7a48', '#c9b884', '#3a5a3a'], { n: 4, w: 0.6 * s + 0.2, spread: 0.7 });
    }
    for (let i = 0; i < 600; i++) {
      const x = r(0, w), y = r(0, h);
      dab(c, x, y, -Math.PI / 2 + r(-0.4, 0.4), r(3, 7), 'ink', r.pick(['#e9c98a', '#f3e6c8', '#d9707a', '#b3a9c4', '#f2b544']), r(0.6, 1.2));
    }
    // game trails
    for (let k = 0; k < 5; k++) {
      let x = r(0, w), y = r(h * 0.2, h), a = r(-0.3, 0.3);
      const pts = [];
      for (let j = 0; j < 30; j++) {
        pts.push([x, y, 1]);
        a += r(-0.15, 0.15);
        x += Math.cos(a) * 70;
        y += Math.sin(a) * 18;
      }
      c.strokePath(pts, 'dry', '#9a8a5a', 1.1, 0.6);
    }
    // a meandering stream across the far plain (segments, never one huge stroke)
    const sy = Y(-560), st = [];
    for (let x = -100; x <= w + 100; x += 40) st.push([x, sy + 24 * Math.sin(x * 0.0021) + 11 * Math.sin(x * 0.0063 + 1)]);
    for (let i = 0; i < st.length - 1; i += 14) {
      const part = st.slice(i, i + 16);
      c.strokePath(part.map((p) => [p[0], p[1] + 4, 1]), 'gouache', '#1e3a30', 3.6, 0.5);
      c.strokePath(part.map((p) => [p[0], p[1], 1]), 'gouache', '#2f6f86', 2.6, 0.5);
      c.strokePath(part.map((p) => [p[0], p[1] - 1.8, 1]), 'dry', '#8fc8d8', 0.8, 0.5);
    }
    for (let i = 0; i < 160; i++) {
      const k = r.int(0, st.length - 1), [x, y] = st[k];
      tuft(c, x + r(-20, 20), y + r(-8, 10), r(12, 24), ['#3f6a44', '#6a8a4a', '#2e4c3a'], { n: 5, w: 0.8 });
    }
    // bushes and boulders (clumps with a dark shadow on the far side, lit from the east)
    for (let i = 0; i < 130; i++) {
      const x = r(0, w), y = r(0, h), s = r(10, 34) * (0.5 + y / h);
      c.washPoly(c.blob(x + s * 0.3, y + s * 0.12, s * 1.1, s * 0.3, { wobble: 0.2 }), '#1a2a22', 255);
      c.washPoly(c.blob(x, y, s, s * 0.35, { wobble: 0.3, freq: 5 }), r.pick(['#1f3a2e', '#243e30', '#2a4a34', '#34503a']), 255);
      for (let k = 0; k < 7; k++) dab(c, x + r(-s, s) * 0.8, y + r(-s, s) * 0.25, r(-2.8, -0.4), r(4, 9), 'dry', r.pick(['#4a6a4e', '#5d7a3e', '#2e4c3a', '#6a8a4a']), 0.7);
    }
    for (let i = 0; i < 80; i++) {
      const x = r(0, w), y = r(0, h), s = r(5, 15) * (0.5 + y / h);
      c.washPoly(c.blob(x, y, s, s * 0.42), r.pick(['#6a7066', '#5a5f58', '#7a7a6a']), 255);
      dab(c, x - s * 0.6, y - s * 0.2, 0, s * 0.9, 'dry', '#a8a490', 0.6);
      c.strokePath([[x - s, y + s * 0.2], [x + s, y + s * 0.25]], 'ink', '#1a2420', 0.6, 0.5);
    }
  });
}

// ------------------------------------------------------------------------------------------------
// The herd: woolly mammoths built from painted shapes. Row 0: 4-frame walk; row 1: 4-frame gallop.
// ------------------------------------------------------------------------------------------------
export const MAMMOTH = { cw: 340, ch: 280, rx: 150, ry: 268 };
const MM = { far: '#2c190f', base: '#4e2e1c', mid: '#6a3e24', lit: '#9a6038', rim: '#d49a5e', skirt: '#3a2215', ink: '#160c06', tusk: '#efe4c8', tuskDark: '#b8a888' };
function ribbonPoly(pts, w0, w1) {
  const n = pts.length, Lp = [], Rp = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const wd = lerp(w0, w1, i / (n - 1)) / 2;
    Lp.push([pts[i][0] - dy * wd, pts[i][1] + dx * wd]);
    Rp.push([pts[i][0] + dy * wd, pts[i][1] - dx * wd]);
  }
  return Lp.concat(Rp.reverse());
}
function mammothFrame(c, ox, oy, ph, run) {
  const r = c.r;
  const bob = run ? -10 * Math.abs(Math.sin(ph)) : -2 * Math.sin(ph * 2);
  const P = (x, y) => [ox + x, oy + y + bob];
  const leg = (hx, off, far) => {
    const A = run ? 0.5 : 0.2;
    const th = A * Math.sin(ph + off);
    const lift = (run ? 22 : 8) * Math.max(0, Math.cos(ph + off));
    const hip = P(hx, -112);
    const foot = [hip[0] + Math.sin(th) * 112, oy - lift + (run ? 0 : 0)];
    const knee = [lerp(hip[0], foot[0], 0.55) - 4, lerp(hip[1], foot[1], 0.55)];
    const poly = ribbonPoly([hip, knee, foot], 40, 32);
    const col = far ? MM.far : MM.base;
    c.washPoly(poly, col, 255);
    c.washPoly(c.blob(foot[0], foot[1] - 5, 18, 8), far ? '#1e1008' : '#2e1a0e', 255);
    for (let k = 0; k < 7; k++) dab(c, lerp(hip[0], foot[0], r(0.1, 0.7)) + r(-12, 12), lerp(hip[1], foot[1], r(0.1, 0.6)), Math.PI / 2 + r(-0.15, 0.15), r(14, 30), 'dry', far ? '#3a2214' : MM.mid, 0.8);
    for (let k = 0; k < 3; k++) c.strokePath([[foot[0] - 10 + k * 8, foot[1] - 3], [foot[0] - 8 + k * 8, foot[1] - 1]], 'ink', '#d8c8a0', 0.5, 0.3);
  };
  // far legs
  leg(-80, 0, true);
  leg(88, Math.PI, true);
  // tail
  const tailUp = run ? -0.6 : 0;
  c.strokePath([P(-116, -150), P(-132 + tailUp * 10, -130 + tailUp * 30), P(-136 + tailUp * 20, -108 + tailUp * 40)].map((p) => [p[0], p[1], 0.9]), 'gouache', MM.far, 1.8, 0.5);
  // body
  const body = [
    P(-118, -150), P(-112, -170), P(-96, -184), P(-70, -195), P(-36, -205), P(0, -213), P(32, -223), P(60, -229), P(84, -225), P(102, -212),
    P(116, -218), P(130, -234), P(150, -241), P(170, -233), P(182, -214), P(186, -190), P(180, -168), P(170, -150),
    P(150, -130), P(140, -110), P(128, -94), P(100, -86), P(60, -82), P(20, -82), P(-20, -84), P(-60, -88), P(-96, -98), P(-114, -116), P(-120, -134),
  ];
  c.washPoly(body, MM.base, 255);
  c.fillPoly(body, MM.mid, { opacity: 70, bleed: 0.004, texture: 0.8, border: 0.4 });
  // shadowed underside and the shaggy skirt
  const skirt = [];
  for (let i = 0; i <= 26; i++) { const u = i / 26; skirt.push(P(lerp(-116, 136, u), -112 + 10 * Math.sin(Math.PI * u))); }
  for (let i = 26; i >= 0; i--) { const u = i / 26; skirt.push(P(lerp(-116, 136, u) + r(-3, 3), -58 - 12 * Math.sin(Math.PI * u) + (i % 2 ? 9 : -5))); }
  c.washPoly(skirt, MM.skirt, 255);
  // fur: long downward strokes following the form, curving back
  for (let i = 0; i < 170; i++) {
    const x = r(-112, 170);
    const topY = x > 105 ? -225 : x > 60 ? -222 : -210 + (60 - x) * 0.25;
    const y = r(topY + 10, -64);
    const [px, py] = P(x, y);
    dab(c, px, py, Math.PI / 2 + 0.3 + r(-0.2, 0.2), r(14, 34), r.pick(['dry', 'dry', 'gouache', '2B']), r.pick([MM.mid, '#5a321e', '#7a4a2a', MM.base, '#3e2416']), r(0.6, 1.3));
  }
  // lit back and head (dawn from the right)
  for (let i = 0; i < 30; i++) {
    const idx = r.int(3, 15), p = body[idx];
    dab(c, p[0] + r(-4, 4), p[1] + r(3, 10), 0.3 + r(-0.3, 0.3), r(12, 26), 'dry', r.pick([MM.lit, MM.rim, '#b07840']), 0.8);
  }
  // ear, eye
  c.washPoly(c.blob(...P(142, -196), 12, 16, { wobble: 0.2 }), '#3a2214', 255);
  c.strokePath([P(160, -204), P(165, -202)], 'ink', '#0a0604', 1.2, 0.3);
  // trunk (tapered, curling at the tip)
  const tr = run ? 1 : 0.3 * Math.sin(ph);
  const trunkPts = [P(172, -166), P(182, -140), P(186, -112), P(184 + 10 * tr, -86), P(178 + 24 * tr, -66 - 10 * tr), P(186 + 32 * tr, -56 - 22 * tr), P(196 + 30 * tr, -62 - 30 * tr)];
  c.washPoly(ribbonPoly(trunkPts, 30, 10), MM.base, 255);
  for (let k = 1; k < 6; k++) { const p = trunkPts[k]; c.strokePath([[p[0] - 8, p[1]], [p[0] + 6, p[1] + 2]], 'ink', MM.ink, 0.5, 0.3); }
  c.strokePath(trunkPts.map((p, k) => [p[0] + 5, p[1], 1 - k * 0.1]), 'dry', MM.lit, 0.7, 0.5);
  // tusks: long, curving out and up
  const tusk = [P(166, -150), P(184, -128), P(210, -118), P(236, -126), P(252, -148), P(256, -172)];
  c.washPoly(ribbonPoly(tusk, 13, 3), MM.tusk, 255);
  c.strokePath(tusk.slice(0, 4).map((p) => [p[0], p[1] + 3, 0.8]), 'ink', MM.tuskDark, 0.6, 0.5);
  // contour, lost and found
  inkEdge(c, body.slice(0, 18), MM.ink, 1.0, { lost: 0.3 });
  // near legs
  leg(-62, Math.PI, false);
  leg(104, 0, false);
}
export function paintMammoths(P) {
  return P.layer('mammoth', { w: MAMMOTH.cw * 4, h: MAMMOTH.ch * 2, scale: K.sc(P, 0.8) }, (c) => {
    for (let row = 0; row < 2; row++) for (let f = 0; f < 4; f++) {
      mammothFrame(c, f * MAMMOTH.cw + MAMMOTH.rx, row * MAMMOTH.ch + MAMMOTH.ry, (f / 4) * TAU, row === 1);
    }
  });
}
