// HUNT — the two hunters: painted cut-out parts (static painted fills) with contour/accent strokes
// painted in three variants that "boil" at 12 fps, plus the spear. Poses come from choreo.pose().
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep } from '../lib/kit.js';
import * as K from './choreo.js';
import { inkEdge } from './land.js';

const HR = K.H1; // reference height the atlas is painted at
const SK = { base: '#d65a2e', front: '#ee8440', lit: '#f08a3c', hi: '#f8b060', shade: '#a83c2a', deep: '#7a2a22', ink: '#4a1610', paint: '#f3e6c8', ochre: '#e9c98a' };
const HIDE = { base: '#7a4a2a', dark: '#4e2e1a', lit: '#b07a4a', fur: ['#8a5a3a', '#5a3620', '#c09060', '#6e4428'], ink: '#2a160c' };
const HAIR = { base: '#2a1a26', lit: '#4a3040', ink: '#140a12' };

// Part definitions (design units at HR). a/b = proximal/distal joints inside the cell.
const PARTS = {
  torso: { w: 170, h: 215, a: [78, 196], b: [78, 41] },
  head0: { w: 110, h: 125, a: [46, 112] },
  head1: { w: 110, h: 125, a: [46, 112] },
  hair: { w: 110, h: 80, a: [92, 14] },
  hide: { w: 140, h: 110, a: [68, 22] },
  thigh: { w: 160, h: 70, a: [24, 35], b: [24 + K.RIG.thigh * HR, 35] },
  shin: { w: 160, h: 60, a: [22, 30], b: [22 + K.RIG.shin * HR, 30] },
  foot: { w: 100, h: 50, a: [26, 18] },
  uarm: { w: 120, h: 46, a: [20, 23], b: [20 + K.RIG.uarm * HR, 23] },
  farm: { w: 140, h: 44, a: [17, 22], b: [17 + K.RIG.farm * HR, 22] },
};
const ORDER = Object.keys(PARTS);
// Atlas: each part gets 4 cells in a row: fill, line0, line1, line2
const ATLAS = (() => {
  let y = 0, W = 0;
  const cells = {};
  for (const k of ORDER) {
    const p = PARTS[k];
    cells[k] = [0, 1, 2, 3].map((v) => [v * (p.w + 8), y]);
    W = Math.max(W, 4 * (p.w + 8));
    y += p.h + 8;
  }
  return { cells, w: W, h: y };
})();

// ---- part outlines (local cell coordinates) ------------------------------------------------------
function limbPoly(a, len, w0, w1, bulge = 0.12, n = 16) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, hw = (lerp(w0, w1, u) / 2) * (1 + bulge * Math.sin(Math.PI * Math.pow(u, 0.8)));
    top.push([a[0] + u * len, a[1] - hw * (1 + 0.08 * Math.sin(u * 7))]);
    bot.push([a[0] + u * len, a[1] + hw]);
  }
  const cap = (cx, cy, r, a0, a1) => {
    const pts = [];
    for (let i = 1; i < 8; i++) {
      const t = a0 + ((a1 - a0) * i) / 8;
      pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
    return pts;
  };
  return top.concat(cap(a[0] + len, a[1], w1 / 2, -Math.PI / 2, Math.PI / 2), bot.reverse(), cap(a[0], a[1], w0 / 2, Math.PI / 2, (3 * Math.PI) / 2));
}
const OUTLINES = {
  torso: () => [[52, 200], [47, 170], [45, 132], [47, 98], [53, 66], [62, 46], [72, 34], [70, 24], [88, 22], [92, 36], [104, 50], [122, 70], [128, 94], [120, 120], [106, 140], [100, 166], [100, 196], [80, 208], [58, 206]],
  head: (v) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = Math.PI * 0.62 + (i / 24) * Math.PI * 1.55;
      pts.push([48 + Math.cos(t) * 33, 52 + Math.sin(t) * 38]);
    }
    // face profile (right): brow, nose, lips, chin, jaw, neck
    return pts.concat([[80, 40], [84, 48], [94, 62], [86, 66], [88, 74], [84, 78], [86, 84], [78, 92], [66, 96], [62, 112], [36, 114], [34, 92]]);
  },
  hair: () => [[92, 8], [70, 6], [44, 12], [22, 26], [8, 48], [10, 60], [26, 50], [44, 38], [64, 30], [92, 22]],
  hide: () => [[18, 10], [118, 8], [124, 30], [112, 58], [96, 72], [70, 64], [48, 96], [30, 104], [22, 70], [12, 40]],
  thigh: () => limbPoly(PARTS.thigh.a, K.RIG.thigh * HR, 44, 30, 0.14),
  shin: () => limbPoly(PARTS.shin.a, K.RIG.shin * HR, 30, 20, 0.2),
  foot: () => [[12, 8], [30, 4], [42, 12], [70, 20], [92, 28], [94, 36], [60, 38], [20, 38], [8, 30]],
  uarm: () => limbPoly(PARTS.uarm.a, K.RIG.uarm * HR, 30, 22, 0.16),
  farm: () => {
    const L = K.RIG.farm * HR, a = PARTS.farm.a;
    const arm = limbPoly(a, L, 22, 16, 0.12);
    // mitten hand at the end
    const hx = a[0] + L;
    return arm.concat([[hx + 2, a[1] + 10], [hx + 22, a[1] + 12], [hx + 34, a[1] + 4], [hx + 30, a[1] - 8], [hx + 10, a[1] - 10]]);
  },
};

// Two-tone cut-out limb: outline, shadow plane (+y half), lit strip (-y edge).
function limbShapes(a, len, w0, w1, bulge = 0.12, n = 16) {
  const top = [], bot = [], mid = [], lit = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, hw = (lerp(w0, w1, u) / 2) * (1 + bulge * Math.sin(Math.PI * Math.pow(u, 0.8)));
    const x = a[0] + u * len;
    top.push([x, a[1] - hw * (1 + 0.08 * Math.sin(u * 7))]);
    bot.push([x, a[1] + hw]);
    mid.push([x, a[1] + hw * (0.12 + 0.1 * Math.sin(u * 5 + 1))]);
    lit.push([x, a[1] - hw * 0.45]);
  }
  const cap = (cx, cy, r, a0, a1, m = 8) => {
    const pts = [];
    for (let i = 1; i < m; i++) {
      const t = a0 + ((a1 - a0) * i) / m;
      pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
    return pts;
  };
  const r1 = w1 / 2, r0 = w0 / 2;
  const outline = top.concat(cap(a[0] + len, a[1], r1, -Math.PI / 2, Math.PI / 2), bot.slice().reverse(), cap(a[0], a[1], r0, Math.PI / 2, (3 * Math.PI) / 2));
  const lower = mid.concat(cap(a[0] + len, a[1], r1, 0.15, Math.PI / 2, 5), bot.slice().reverse(), cap(a[0], a[1], r0, Math.PI / 2, Math.PI - 0.15, 5));
  const upper = top.concat(lit.slice().reverse());
  return { outline, lower, upper };
}
const LIMB = {
  thigh: [44, 30, 0.14], shin: [30, 20, 0.22], uarm: [30, 22, 0.16], farm: [22, 16, 0.12],
};
function outlineOf(k) {
  if (k === 'head0' || k === 'head1') return OUTLINES.head();
  if (k === 'torso') return OUTLINES.torso();
  if (LIMB[k]) {
    const p = PARTS[k], len = p.b[0] - p.a[0], [w0, w1, bg] = LIMB[k];
    const o = limbShapes(p.a, len, w0, w1, bg).outline;
    if (k !== 'farm') return o;
    const hx = p.a[0] + len, ay = p.a[1];
    return o.concat([[hx + 2, ay + 10], [hx + 22, ay + 12], [hx + 34, ay + 4], [hx + 30, ay - 8], [hx + 10, ay - 10]]);
  }
  return OUTLINES[k]();
}
function strokesIn(c, O, x0, x1, y0, y1, n, tones, w = [0.8, 1.8], ang = 0) {
  const r = c.r;
  for (let i = 0; i < n; i++) {
    const x = r(x0, x1), y = r(y0, y1), L = r(10, 26);
    c.strokePath(O([[x, y, 0.5], [x + Math.cos(ang) * L * 0.5, y + Math.sin(ang) * L * 0.5, 1], [x + Math.cos(ang) * L, y + Math.sin(ang) * L, 0.4]]), r() < 0.6 ? 'dry' : 'gouache', r.pick(tones), r(w[0], w[1]), 0.5);
  }
}
function paintFill(c, k, ox, oy) {
  const r = c.r;
  const O = (pts) => pts.map((p) => [p[0] + ox, p[1] + oy, p[2]].filter((v) => v !== undefined));
  const p = PARTS[k];
  if (k === 'hair') {
    c.washPoly(O(OUTLINES.hair()), HAIR.base, 255);
    for (let i = 0; i < 26; i++) {
      const y = r(8, 28), x = 92;
      c.strokePath(O([[x, y, 1], [x - r(28, 46), y + r(4, 14), 0.9], [r(8, 30), r(36, 58), 0.3]]), r.pick(['dry', 'gouache', 'ink']), r.pick([HAIR.base, HAIR.lit, '#3a2230', '#5a4050']), r(0.5, 1.3), 0.6);
    }
    return;
  }
  if (k === 'hide') {
    const pts = O(OUTLINES.hide());
    c.washPoly(pts, HIDE.base, 255);
    c.washPoly(O([[18, 10], [118, 8], [122, 24], [70, 30], [16, 26]]), HIDE.lit, 255);
    c.washPoly(O([[30, 104], [48, 96], [70, 64], [96, 72], [60, 84]]), HIDE.dark, 255);
    for (let i = 0; i < 110; i++) {
      const x = r(20, 118), y = r(14, 68);
      c.strokePath(O([[x, y, 1], [x + r(-3, 4), y + r(8, 18), 0.3]]), r() < 0.7 ? 'dry' : 'ink', r.pick(HIDE.fur), r(0.5, 1.1), 0.5);
    }
    // ragged fur fringe at the hem
    for (let i = 0; i < 22; i++) {
      const x = r(26, 112), y = x < 60 ? lerp(98, 70, (x - 26) / 34) : lerp(64, 58, (x - 60) / 52);
      c.strokePath(O([[x, y - 4, 1], [x + r(-3, 3), y + r(6, 12), 0.3]]), 'ink', r.pick([HIDE.dark, HIDE.ink]), 0.8, 0.5);
    }
    c.strokePath(O([[14, 13], [70, 17], [124, 13]]), 'gouache', '#3a2016', 1.8, 0.5);
    c.strokePath(O([[96, 16], [102, 34], [98, 44]]), 'ink', '#3a2016', 0.9, 0.5);
    c.washPoly(O(c.blob(104, 26, 5, 7)), '#f3e6c8', 255);
    return;
  }
  if (k === 'head0' || k === 'head1') {
    const v = k === 'head1';
    c.washPoly(O(OUTLINES.head()), SK.base, 255);
    // lit face plane, shadowed back of the head and jaw
    c.washPoly(O([[62, 30], [80, 40], [84, 48], [94, 62], [86, 66], [88, 74], [84, 78], [86, 84], [78, 92], [66, 90], [60, 60]]), SK.front, 255);
    c.washPoly(O([[34, 40], [48, 58], [50, 96], [62, 112], [36, 114], [18, 80], [16, 52]]), SK.shade, 255);
    c.washPoly(O([[70, 48], [80, 44], [90, 60], [80, 64]]), SK.hi, 255);
    strokesIn(c, O, 56, 84, 40, 90, 8, [SK.front, SK.base, SK.hi], [0.5, 1], 1.4);
    // ear, brow, eye, lip, cheek paint
    c.washPoly(O(c.blob(50, 62, 6, 9)), SK.deep, 255);
    c.strokePath(O([[66, 50], [74, 48], [80, 50]]), 'ink', SK.ink, 1.1, 0.4);
    c.strokePath(O([[70, 55], [77, 56]]), 'ink', '#1a0a08', 1.4, 0.3);
    c.strokePath(O([[80, 82], [86, 82]]), 'ink', SK.deep, 0.9, 0.3);
    c.strokePath(O([[62, 70], [74, 68]]), 'dry', SK.paint, 1.0, 0.5);
    c.strokePath(O([[61, 76], [72, 75]]), 'dry', SK.ochre, 0.9, 0.5);
    // hair cap with strands; variant 1 has a tied topknot
    const cap = O(v
      ? [[18, 40], [26, 22], [44, 12], [66, 14], [78, 26], [72, 34], [56, 30], [44, 40], [36, 62], [26, 70], [16, 58]]
      : [[16, 50], [20, 28], [38, 14], [60, 12], [80, 24], [84, 38], [70, 32], [54, 34], [44, 50], [40, 76], [28, 86], [16, 70]]);
    c.washPoly(cap, HAIR.base, 255);
    for (let i = 0; i < 34; i++) {
      const x = r(22, 72), y = r(14, 36);
      c.strokePath(O([[x, y, 1], [x - r(8, 20), y + r(8, 24), 0.3]]), r() < 0.5 ? 'dry' : 'ink', r.pick([HAIR.lit, '#4a3040', '#5a4050', HAIR.base]), r(0.5, 1.1), 0.5);
    }
    if (v) {
      c.washPoly(O(c.blob(40, 12, 12, 10)), HAIR.base, 255);
      c.strokePath(O([[34, 16], [46, 14]]), 'ink', '#f3e6c8', 0.8, 0.3);
    }
    return;
  }
  if (k === 'torso') {
    c.washPoly(O(OUTLINES.torso()), SK.base, 255);
    // back plane in shadow, chest/front plane lit — crisp cut-out split
    c.washPoly(O([[52, 200], [47, 170], [45, 132], [47, 98], [53, 66], [62, 46], [72, 34], [70, 24], [76, 24], [70, 60], [66, 110], [68, 160], [74, 206], [58, 206]]), SK.shade, 255);
    c.washPoly(O([[88, 22], [92, 36], [104, 50], [122, 70], [128, 94], [120, 120], [106, 140], [100, 166], [100, 196], [92, 198], [94, 150], [104, 118], [110, 92], [98, 62], [86, 36]]), SK.front, 255);
    c.washPoly(O([[100, 54], [118, 70], [124, 92], [114, 108], [106, 86]]), SK.hi, 255);
    // form strokes: around the ribcage, down the belly
    strokesIn(c, O, 60, 100, 50, 190, 26, [SK.base, '#e0683a', SK.front, SK.shade], [0.7, 1.5], 0.5);
    strokesIn(c, O, 48, 64, 60, 190, 10, [SK.shade, SK.deep], [0.6, 1.2], 1.5);
    // anatomy accents
    c.strokePath(O([[96, 80], [110, 96], [104, 112]]), 'ink', SK.deep, 0.9, 0.5);
    c.strokePath(O([[92, 132], [96, 150], [94, 170]]), 'dry', SK.deep, 0.8, 0.5);
    // body paint: dotted line across the chest and an ochre band on the belly
    for (let i = 0; i < 6; i++) c.washPoly(O(c.blob(82 + i * 6.5, 100 + i * 2.2, 2.2, 2.2)), SK.paint, 255);
    c.strokePath(O([[72, 154], [88, 152], [100, 156]]), 'dry', SK.ochre, 1.1, 0.5);
    // necklace of teeth
    c.strokePath(O([[70, 40], [82, 52], [98, 52]]), 'wire', '#3a2016', 0.9, 0.5);
    for (let i = 0; i < 5; i++) c.washPoly(O(c.blob(78 + i * 4.4, 50 + (i % 2) * 2.4, 1.8, 3.6)), '#f3e6c8', 255);
    return;
  }
  if (k === 'foot') {
    const pts = O(OUTLINES.foot());
    c.washPoly(pts, SK.base, 255);
    c.washPoly(O([[8, 30], [20, 36], [60, 36], [94, 34], [92, 38], [60, 38], [20, 38]]), SK.deep, 255);
    c.washPoly(O([[30, 4], [42, 12], [70, 20], [66, 24], [36, 16]]), SK.front, 255);
    for (let i = 0; i < 3; i++) c.strokePath(O([[80 + i * 4, 28], [82 + i * 4, 35]]), 'ink', SK.deep, 0.6, 0.3);
    return;
  }
  // limbs
  const len = p.b[0] - p.a[0], [w0, w1, bg] = LIMB[k];
  const S = limbShapes(p.a, len, w0, w1, bg);
  c.washPoly(O(S.outline), SK.base, 255);
  c.washPoly(O(S.lower), SK.shade, 255);
  c.washPoly(O(S.upper), SK.front, 255);
  strokesIn(c, O, p.a[0] + 4, p.a[0] + len - 4, p.a[1] - w0 * 0.3, p.a[1] + w0 * 0.1, 10, [SK.base, SK.front, '#e0683a', SK.hi], [0.6, 1.3], 0);
  strokesIn(c, O, p.a[0] + 4, p.a[0] + len - 4, p.a[1] + w1 * 0.25, p.a[1] + w1 * 0.4, 6, [SK.shade, SK.deep], [0.5, 1.0], 0);
  if (k === 'farm') {
    const hx = p.a[0] + len, ay = p.a[1];
    c.washPoly(O([[hx - 4, ay - 9], [hx + 10, ay - 10], [hx + 30, ay - 8], [hx + 34, ay + 4], [hx + 22, ay + 12], [hx + 2, ay + 10]]), SK.base, 255);
    c.washPoly(O([[hx + 2, ay + 4], [hx + 22, ay + 6], [hx + 32, ay + 3], [hx + 22, ay + 12], [hx + 2, ay + 10]]), SK.shade, 255);
    for (let i = 0; i < 3; i++) c.strokePath(O([[hx + 18 + i * 5, ay - 6], [hx + 21 + i * 5, ay + 4]]), 'ink', SK.deep, 0.5, 0.3);
    c.strokePath(O([[hx - 6, ay - 10], [hx - 6, ay + 10]]), 'dry', '#5a3620', 1.4, 0.3); // leather wrist band
  }
  if (k === 'shin') {
    const x = p.a[0] + len * 0.66;
    c.washPoly(O([[x, p.a[1] - 12], [x + 34, p.a[1] - 10], [x + 36, p.a[1] + 10], [x, p.a[1] + 12]]), HIDE.base, 255);
    for (let i = 0; i < 4; i++) c.strokePath(O([[x + 4 + i * 8, p.a[1] - 11], [x + 7 + i * 8, p.a[1] + 10]]), 'wire', HIDE.ink, 0.8, 0.4);
    c.strokePath(O([[p.a[0] + len * 0.2, p.a[1] + 9], [p.a[0] + len * 0.42, p.a[1] + 12], [p.a[0] + len * 0.58, p.a[1] + 8]]), 'ink', SK.deep, 0.7, 0.5); // calf
  }
  if (k === 'thigh' || k === 'uarm') for (let i = 0; i < 3; i++) c.washPoly(O(c.blob(p.a[0] + len * (0.42 + i * 0.12), p.a[1] - 2 + (i % 2) * 5, 2.3, 2.3)), SK.paint, 255);
}
function paintLines(c, k, ox, oy, v) {
  const r = c.r;
  const O = (pts) => pts.map((p) => [p[0] + ox + r(-0.9, 0.9), p[1] + oy + r(-0.9, 0.9)]);
  const ink = k === 'hair' ? HAIR.ink : k === 'hide' ? HIDE.ink : SK.ink;
  const out = outlineOf(k);
  inkEdge(c, O(out.concat([out[0]])), ink, k === 'torso' || k === 'hide' ? 1.9 : 1.6, { lost: 0.16, seg: 6 });
  const p = PARTS[k];
  if (p.b && k !== 'torso') {
    const len = p.b[0] - p.a[0], u = r(0.3, 0.65);
    c.strokePath(O([[p.a[0] + u * len, p.a[1] + 7], [p.a[0] + (u + 0.14) * len, p.a[1] + 10]]), 'ink', SK.deep, 0.9, 0.5);
  }
  if (k === 'torso') c.strokePath(O([[58, 118 + r(-5, 5)], [60, 150 + r(-5, 5)], [57, 182]]), 'ink', SK.deep, 1.0, 0.5);
}

export function paintFigures(P) {
  const atlas = P.layer('hunters', { w: ATLAS.w, h: ATLAS.h, scale: K.sc(P, 1.25) }, (c) => {
    for (const k of ORDER) {
      const [fx, fy] = ATLAS.cells[k][0];
      paintFill(c, k, fx, fy);
      c.flush();
      for (let v = 0; v < 3; v++) {
        const [lx, ly] = ATLAS.cells[k][v + 1];
        paintLines(c, k, lx, ly, v);
      }
    }
  });
  // spear: shaft with bindings, a knapped flint point and a tuft (drawn along +x, grip at SPEAR.grip)
  const SW = K.SPEAR.len, SH = 44;
  const spear = P.layer('spear', { w: SW + 20, h: SH, scale: K.sc(P, 1.4) }, (c) => {
    const r = c.r, cy = SH / 2, tipL = 70;
    const shaft = [];
    for (let i = 0; i <= 12; i++) shaft.push([4 + (i / 12) * (SW - tipL), cy + 0.8 * Math.sin(i * 1.3)]);
    c.strokePath(shaft.map((p) => [p[0], p[1], 1]), 'gouache', '#b98a4a', 1.5, 0.3);
    c.strokePath(shaft.map((p) => [p[0], p[1] - 1.8, 1]), 'pastel', '#e9c98a', 0.7, 0.3);
    c.strokePath(shaft.map((p) => [p[0], p[1] + 2.2, 1]), 'ink', '#5a3a1a', 0.7, 0.3);
    // knots in the wood
    for (let i = 0; i < 6; i++) { const x = r(30, SW - 120); c.strokePath([[x, cy - 2], [x + 4, cy + 2]], 'ink', '#6a4a2a', 0.8, 0.3); }
    // flint point: leaf shape with facets
    const bx = SW - tipL;
    const pt = [[bx - 6, cy - 7], [bx + 24, cy - 11], [bx + tipL, cy], [bx + 24, cy + 11], [bx - 6, cy + 7]];
    c.washPoly(pt, '#d8d2c0', 255);
    c.fillPoly(pt, '#a8a090', { opacity: 90, bleed: 0.01, texture: 0.6, border: 0.4 });
    for (let i = 0; i < 5; i++) c.strokePath([[bx + 4 + i * 12, cy - 8 + i], [bx + 12 + i * 12, cy + 1]], 'wire', '#6a6458', 0.8, 0.3);
    c.fillPoly([[bx + 20, cy - 9], [bx + 50, cy - 4], [bx + 30, cy - 1]], '#f3eee0', { opacity: 160, bleed: 0.01, texture: 0.3 });
    inkEdge(c, pt.concat([pt[0]]), '#3a3630', 1.0, { lost: 0.1, seg: 3 });
    // sinew binding
    for (let i = 0; i < 9; i++) c.strokePath([[bx - 34 + i * 4, cy - 5], [bx - 30 + i * 4, cy + 5]], 'ink', '#3a2016', 1.1, 0.2);
    // tuft of fur/feathers below the binding
    for (let i = 0; i < 7; i++) c.strokePath([[bx - 40, cy + 2], [bx - 56 - r(0, 16), cy + 8 + r(0, 10)]], 'dry', r.pick(['#d9707a', '#f3e6c8', '#a33f6f']), 1.0, 0.5);
    // grip wrap
    const gx = SW * K.SPEAR.grip;
    for (let i = 0; i < 7; i++) c.strokePath([[gx - 14 + i * 4, cy - 4], [gx - 10 + i * 4, cy + 4]], 'ink', '#4a2a16', 1, 0.2);
  });
  return { atlas, spear };
}

// ---- drawing ------------------------------------------------------------------------------------
function part(R, A, k, v, x, y, rot, s, o, pivot) {
  const [cx, cy] = ATLAS.cells[k][v];
  const p = PARTS[k];
  const pv = pivot || p.a;
  const uv = [cx / ATLAS.w, cy / ATLAS.h, (cx + p.w) / ATLAS.w, (cy + p.h) / ATLAS.h];
  R.layer(A.atlas, M.place(x, y, s, rot, pv[0], pv[1]), { ...o, uv, w: p.w, h: p.h });
}
function partBoth(R, A, k, boil, x, y, rot, s, o) {
  part(R, A, k, 0, x, y, rot, s, o);
  part(R, A, k, 1 + boil, x, y, rot, s, o);
}
const angOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);

export function drawSpear(R, A, tail, ang, len = K.SPEAR.len, o = {}, frac = [0, 1]) {
  // sprite drawn from tail along ang; frac selects the visible part (0 = tail, 1 = tip)
  const W = K.SPEAR.len + 20, H = 44;
  const f0 = frac[0], f1 = frac[1];
  if (f1 - f0 <= 0.002) return;
  const sx = (len / K.SPEAR.len);
  const u0 = (4 + f0 * K.SPEAR.len) / W, u1 = Math.min(1, (4 + f1 * K.SPEAR.len) / W);
  const m = M.chain(M.translate(tail[0], tail[1]), M.rotate(ang), M.scale(sx, 1), M.translate(4 + f0 * K.SPEAR.len - 4, -H / 2));
  R.layer(A.spear, M.mul(m, M.translate(0, 0)), { ...o, uv: [u0, 0, u1, 1], w: (u1 - u0) * W, h: H });
}

// Draw one hunter at local time t (SW coordinates under the current view).
export function drawHunter(R, A, h, t) {
  const p = K.pose(h, t);
  const s = h.H / HR;
  const boil = Math.floor((K.T0 + t) * 12) % 3;
  const far = { tint: [0.6, 0.52, 0.66] };
  const near = h.id ? { tint: [0.9, 0.86, 0.9] } : {};
  const tintOf = (base) => (h.id ? { tint: base.tint ? base.tint.map((v, i) => v * near.tint[i]) : near.tint } : base);
  const limb = (k, a, b, o) => partBoth(R, A, k, boil, a[0], a[1], angOf(a, b), s, o);
  const drawArm = (arm, o) => {
    limb('uarm', arm.sh, arm.el, o);
    limb('farm', arm.el, arm.wr, o);
  };
  const drawLeg = (lg, o) => {
    limb('thigh', lg.hip, lg.knee, o);
    limb('shin', lg.knee, lg.ank, o);
    partBoth(R, A, 'foot', boil, lg.ank[0], lg.ank[1], lg.footAng, s, o);
  };
  // far arm, far leg
  drawArm(p.arms[1], tintOf(far));
  drawLeg(p.legs[1], tintOf(far));
  // hair lock (secondary motion: lags the run bob)
  const up = [Math.sin(p.lean), -Math.cos(p.lean)];
  const headA = p.lean + p.headAng;
  const hb = [p.neck[0] + up[0] * 0.07 * h.H - Math.cos(headA) * 0.035 * h.H, p.neck[1] + up[1] * 0.07 * h.H - Math.sin(headA) * 0.035 * h.H];
  const sway = 0.28 * Math.sin((K.T0 + t) * 2 * Math.PI * 1.6 - 1.2) + 0.25 * smoothstep(3.3, 3.8, t) * (h.id ? 0 : 1);
  part(R, A, 'hair', 0, hb[0], hb[1], headA * 0.6 + sway - 0.1, s, tintOf({}));
  part(R, A, 'hair', 1 + boil, hb[0], hb[1], headA * 0.6 + sway - 0.1, s, tintOf({}));
  // torso and head
  partBoth(R, A, 'torso', boil, p.hip[0], p.hip[1], p.lean, s, tintOf({}));
  const hk = h.id ? 'head1' : 'head0';
  partBoth(R, A, hk, boil, p.neck[0], p.neck[1], headA, s, tintOf({}));
  // hide wrap
  partBoth(R, A, 'hide', boil, p.hip[0], p.hip[1] - 0.012 * h.H, p.lean * 0.5 + 0.06 * Math.sin((K.T0 + t) * TAU * 1.6), s, tintOf({}));
  // near leg
  drawLeg(p.legs[0], tintOf({}));
  // spear in hand (behind the near hand)
  if (p.spear) {
    const g = p.spear.grip, an = p.spear.ang, Ls = K.SPEAR.len * (h.id ? 0.86 : 1);
    const tail = [g[0] - Math.cos(an) * Ls * K.SPEAR.grip, g[1] - Math.sin(an) * Ls * K.SPEAR.grip];
    drawSpear(R, A, tail, an, Ls, tintOf({}));
  }
  drawArm(p.arms[0], tintOf({}));
  return p;
}
