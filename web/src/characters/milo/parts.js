// Milo the fox — painted rig parts (side view, facing right, +x right, +y down).
//
// Each part is a small p5.brush layer painted once; the rig (rig.js) poses them with
// joint pivots. Anchors below are the contract between parts and rig.
import { lerp, rng } from '../../engine/math.js';

export const RUST = '#c9722f';
export const DARK = '#8a4a1e';
export const CREAM = '#f3e6c8';
export const INK = '#14100c';
export const PAW = '#3a2418';
export const RIM = '#9fb6cc';

// [layerW, layerH, pivotX, pivotY]
export const PART = {
  torso: [340, 220, 170, 110],
  head: [240, 220, 70, 160],
  ear: [70, 90, 35, 80],
  tail1: [220, 150, 40, 75],
  tail2: [240, 170, 35, 85],
  legF: [100, 200, 50, 25],
  legB: [150, 220, 70, 35],
  pupil: [40, 40, 20, 20],
};
// Joint anchors in parent-part local coords.
export const A = {
  neck: [285, 75],    // on torso -> head pivot
  rump: [55, 95],     // on torso -> tail1 pivot
  shoulder: [255, 140],
  hip: [95, 135],
  earB: [80, 45],     // on head -> rear ear pivot
  earF: [130, 38],    // on head -> front ear pivot
  eye: [140, 95],     // on head -> pupil center
  tailMid: [185, 45], // on tail1 -> tail2 pivot
};

function solid(c, pts, color, texture = 0.18) {
  c.washPoly(pts, color, 255);
  c.fillPoly(pts, color, { opacity: 110, bleed: 0.01, texture, border: 0.15 });
}

// Short dry strokes along pts, fanning toward `side` (+1 = left normal, -1 = right).
function furEdge(c, pts, color, len, seed, side = 1, step = 9) {
  const r = rng(seed);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
    const nx = (-dy / d) * side, ny = (dx / d) * side;
    const n = Math.max(1, Math.round(d / step));
    for (let k = 0; k < n; k++) {
      const t = (k + r(0, 1)) / n;
      const x = lerp(x1, x2, t), y = lerp(y1, y2, t);
      const L = len * r(0.6, 1.3);
      c.strokePath([[x - nx * L * 0.35, y - ny * L * 0.35], [x + nx * L * 0.45, y + ny * L * 0.45],
        [x + nx * L, y + ny * L]], 'dry', color, r(0.5, 0.9));
    }
  }
}

function arcPts(cx, cy, rx, ry, a0, a1, n = 14) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

function paintTorso(c) {
  solid(c, c.blob(170, 115, 150, 80, { n: 48, wobble: 0.07, seed: 1 }), RUST);
  c.fillPoly(c.blob(170, 68, 130, 38, { n: 40, wobble: 0.1, seed: 2 }), DARK,
    { opacity: 150, bleed: 0.02, texture: 0.45, border: 0.2 });
  solid(c, c.blob(275, 150, 55, 45, { n: 32, wobble: 0.12, seed: 3 }), CREAM, 0.22);
  // belly fur + rump fur + rim along the back
  furEdge(c, arcPts(170, 115, 150, 80, 0.5, 2.6), RUST, 16, 'm-belly', 1);
  furEdge(c, arcPts(170, 115, 150, 80, 2.4, 3.6), RUST, 14, 'm-rump', 1);
  furEdge(c, arcPts(170, 112, 148, 76, 3.7, 5.8), RIM, 9, 'm-rim', 1);
  c.flush();
}

function paintHead(c) {
  solid(c, c.blob(120, 100, 64, 70, { n: 44, wobble: 0.07, seed: 11 }), RUST);
  c.fillPoly(c.blob(85, 78, 40, 50, { n: 32, wobble: 0.12, seed: 12 }), DARK,
    { opacity: 130, bleed: 0.02, texture: 0.45, border: 0.2 });
  solid(c, c.blob(112, 150, 42, 30, { n: 32, wobble: 0.12, seed: 13 }), CREAM, 0.22);
  // muzzle tapering to the nose
  solid(c, [[145, 103], [220, 120], [220, 148], [145, 153]], CREAM, 0.15);
  solid(c, c.blob(223, 125, 11, 9, { n: 20, wobble: 0.06, seed: 14 }), INK, 0.08);
  c.strokePath([[220, 140], [200, 149], [178, 145]], 'wire', INK, 1.0);
  // eye (almond) + brow; catchlight is a separate layer for look direction
  solid(c, c.blob(140, 95, 12, 14, { n: 20, wobble: 0.05, seed: 15 }), INK, 0.08);
  c.strokePath([[126, 80], [140, 74], [154, 80]], 'dry', DARK, 1.1);
  furEdge(c, [[120, 168], [95, 178], [70, 176]], CREAM, 12, 'm-chin', -1);
  furEdge(c, arcPts(120, 98, 64, 68, 3.8, 5.6), RIM, 8, 'm-hrim', 1);
  c.flush();
}

function paintEar(c, shade) {
  const rust = shade < 1 ? '#a35f28' : RUST;
  const dark = shade < 1 ? '#74411c' : DARK;
  solid(c, [[6, 80], [64, 80], [35, 6]], rust, 0.15);
  solid(c, [[20, 72], [50, 72], [35, 26]], dark, 0.2);
  c.strokePath([[35, 8], [33, -2], [36, -10]], 'dry', rust, 0.9);
  c.strokePath([[30, 10], [26, 0], [27, -8]], 'dry', rust, 0.7);
  c.flush();
}

function paintTail1(c) {
  solid(c, c.blob(115, 65, 80, 58, { n: 40, wobble: 0.1, seed: 21 }), RUST);
  c.fillPoly(c.blob(55, 75, 30, 40, { n: 28, wobble: 0.14, seed: 22 }), DARK,
    { opacity: 130, bleed: 0.02, texture: 0.45, border: 0.2 });
  furEdge(c, arcPts(115, 63, 80, 56, 3.6, 5.9), RUST, 15, 'm-t1t', 1);
  furEdge(c, arcPts(115, 65, 80, 58, 0.4, 2.7), RUST, 15, 'm-t1b', 1);
  c.flush();
}

function paintTail2(c) {
  solid(c, c.blob(115, 85, 85, 62, { n: 40, wobble: 0.1, seed: 25 }), RUST);
  solid(c, c.blob(185, 80, 58, 53, { n: 36, wobble: 0.14, seed: 26 }), CREAM, 0.22);
  furEdge(c, arcPts(115, 83, 85, 60, 3.6, 5.9), RUST, 16, 'm-t2t', 1);
  furEdge(c, arcPts(115, 85, 85, 62, 0.4, 2.9), CREAM, 16, 'm-t2b', 1);
  c.flush();
}

function paintLegF(c) {
  solid(c, [[34, 22], [66, 22], [60, 155], [40, 155]], RUST, 0.15);
  solid(c, [[40, 155], [60, 155], [64, 196], [36, 196]], PAW, 0.12);
  furEdge(c, [[66, 40], [63, 100], [60, 150]], RUST, 10, 'm-lf', 1);
  c.flush();
}

function paintLegB(c) {
  solid(c, c.blob(65, 95, 58, 72, { n: 36, wobble: 0.09, seed: 31 }), RUST);
  solid(c, [[58, 140], [100, 140], [112, 200], [72, 200]], RUST, 0.15);
  solid(c, [[72, 200], [112, 200], [114, 216], [70, 216]], PAW, 0.12);
  furEdge(c, arcPts(65, 93, 58, 70, 2.2, 3.8), RUST, 12, 'm-lb', 1);
  c.flush();
}

export function paintMiloParts(P) {
  const L = (name, key, fn, scale = 2) => P.layer(`milo-${name}`, { w: PART[key][0], h: PART[key][1], scale }, fn);
  return {
    torso: L('torso', 'torso', paintTorso),
    head: L('head', 'head', paintHead),
    earB: L('earB', 'ear', (c) => paintEar(c, 0.85)),
    earF: L('earF', 'ear', (c) => paintEar(c, 1.0)),
    tail1: L('tail1', 'tail1', paintTail1),
    tail2: L('tail2', 'tail2', paintTail2),
    legF: L('legF', 'legF', paintLegF),
    legB: L('legB', 'legB', paintLegB),
    pupil: P.layer('milo-pupil', { w: 40, h: 40 }, (c) => {
      solid(c, c.blob(20, 20, 4.2, 4.2, { n: 14, wobble: 0.04, seed: 41 }), '#ffffff', 0.05);
      c.flush();
    }),
  };
}
