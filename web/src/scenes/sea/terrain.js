// SEA — terrain: the seabed / reef along the swim, rising into the shore bank. Static painted layers.
import { C } from '../lib/palette.js';
import { M, TAU, lerp, clamp, rng, mixHex, smoothstep, track } from './lib.js';
import { fieldStrokes, dabs, clipTo, eraseIn, crClosed } from './paintkit.js';

// Ground surface line (world): seabed under the swim, rising steeply into the bank near the shore.
const GT = track([
  [-3500, 2100], [-1500, 1800], [960, 1500], [1900, 1470], [2150, 1180], [2450, 390], [2900, 120], [3400, -150],
  [3900, -600], [4300, -920], [4600, -1100], [4800, -1290], [5030, -1480], [5160, -1610], [5400, -1790],
  [5800, -2000], [6500, -2250], [8000, -2600],
]);
export const groundY = (x) => GT(x) + 14 * Math.sin(x / 90) + 22 * Math.sin(x / 260 + 1.1);

// Reef strip: rotated layer frame following the ground.
const RB = -0.42;
const RO = [1200, 1350];
const REU = [Math.cos(RB), Math.sin(RB)], REV = [-Math.sin(RB), Math.cos(RB)];
export const REEF = { u0: -1800, v0: -1650, len: 7000, wid: 2700, scale: 0.62 };
export const reefMatrix = () => M.chain(M.translate(RO[0], RO[1]), M.rotate(RB), M.translate(REEF.u0, REEF.v0));
const rLocal = (x, y) => {
  const dx = x - RO[0], dy = y - RO[1];
  return [dx * REU[0] + dy * REU[1] - REEF.u0, dx * REV[0] + dy * REV[1] - REEF.v0];
};

// ---------------------------------------------------------------- reef element painters (world coords)
function rock(c, L, x, y, s, r) {
  const pts = c.blob(x, y - s * 0.35, s, s * 0.62, { n: 36, wobble: 0.18, rot: r(-0.3, 0.3) });
  c.washPoly(L(pts), r.pick(['#1f4a55', '#24505a', '#1b3f4a', '#2a5560']), 255);
  c.washPoly(L(c.blob(x - s * 0.15, y - s * 0.5, s * 0.7, s * 0.4, { n: 24, wobble: 0.2 })), r.pick(['#2f6068', '#335c62', '#3d6a6a']), 200);
  // light from above: strokes on the upper side
  for (let k = 0; k < Math.round(s / 14); k++) {
    const a = r(-2.6, -0.5), rr = s * r(0.3, 0.9);
    const px = x + Math.cos(a) * rr, py = y - s * 0.35 + Math.sin(a) * rr * 0.55;
    c.strokePath(L([[px - s * 0.18, py + r(-3, 3)], [px, py - s * 0.03], [px + s * 0.18, py + r(-3, 3)]]), r() < 0.6 ? 'sea_comb' : 'sea_dry', r.pick(['#4f8a8a', '#5fa39c', '#3d7a7a', '#7fbfb0']), r(0.25, 0.5) * s / 60, 0.5);
  }
}
function fanCoral(c, L, x, y, s, r, col) {
  // a magenta sea fan: branching ribs + fine mesh lines
  const lean = r(-0.35, 0.35);
  const ribs = [];
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + lean + (k - 4) * 0.19 + r(-0.05, 0.05);
    const len = s * r(0.75, 1.05) * (1 - Math.abs(k - 4) * 0.06);
    const pts = [];
    for (let j = 0; j <= 6; j++) {
      const u = j / 6;
      pts.push([x + Math.cos(a + 0.12 * Math.sin(u * 3 + k)) * len * u, y + Math.sin(a + 0.12 * Math.sin(u * 3 + k)) * len * u]);
    }
    ribs.push(pts);
  }
  const outline = [ribs[0][0]].concat(ribs.map((p) => p[p.length - 1]), [ribs[ribs.length - 1][0]]);
  c.washPoly(L(crClosed(outline, 4)), col, 150);
  for (const rb of ribs) c.strokePath(L(rb), 'sea_contour', mixHex(col, '#2a0a1a', 0.35), s / 110, 0.5);
  for (let j = 1; j < 12; j++) {
    const u = j / 12;
    const pts = ribs.map((rb) => rb[Math.min(6, Math.round(u * 6))]);
    c.strokePath(L(pts), 'wire', mixHex(col, '#f3c8d8', 0.35), s / 160, 0.5);
  }
}
function branchCoral(c, L, x, y, s, r, col) {
  const grow = (px, py, a, len, w, depth) => {
    const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len;
    c.strokePath(L([[px, py], [lerp(px, ex, 0.5) + r(-4, 4), lerp(py, ey, 0.5)], [ex, ey]]), 'sea_leaf', col, w, 0.5);
    if (depth > 0) {
      grow(ex, ey, a - r(0.3, 0.6), len * r(0.6, 0.8), w * 0.75, depth - 1);
      grow(ex, ey, a + r(0.3, 0.6), len * r(0.6, 0.8), w * 0.75, depth - 1);
    } else {
      const d = [];
      for (let k = 0; k < 6; k++) { const aa = (k / 6) * TAU; d.push([ex + Math.cos(aa) * s * 0.03, ey + Math.sin(aa) * s * 0.03]); }
      c.washPoly(L(d), mixHex(col, '#fff0d8', 0.4), 230);
    }
  };
  for (let k = 0; k < 3; k++) grow(x + r(-s * 0.1, s * 0.1), y, -Math.PI / 2 + r(-0.5, 0.5), s * 0.38, s / 55, 3);
}
function brainCoral(c, L, x, y, s, r, col) {
  const pts = c.blob(x, y - s * 0.4, s, s * 0.55, { n: 40, wobble: 0.06 });
  c.washPoly(L(pts), col, 255);
  c.washPoly(L(c.blob(x - s * 0.2, y - s * 0.55, s * 0.6, s * 0.3, { n: 20, wobble: 0.1 })), mixHex(col, '#fff0d0', 0.25), 170);
  for (let k = 0; k < 9; k++) {
    const yy = y - s * 0.4 + (k - 4) * s * 0.11;
    const w = Math.sqrt(Math.max(0, 1 - ((k - 4) / 4.6) ** 2)) * s * 0.9;
    const line = [];
    for (let j = 0; j <= 12; j++) line.push([x - w + (2 * w * j) / 12, yy + s * 0.04 * Math.sin(j * 1.9 + k * 2.3)]);
    c.strokePath(L(line), 'wire', mixHex(col, '#3a1a10', 0.45), s / 90, 0.6);
  }
  c.strokePath(L(pts.slice(18, 40)), 'sea_contour', mixHex(col, '#1a0a10', 0.5), s / 70, 0.5);
}
function anemone(c, L, x, y, s, r, col) {
  const stalk = [[x - s * 0.18, y], [x - s * 0.14, y - s * 0.5], [x + s * 0.14, y - s * 0.5], [x + s * 0.18, y]];
  c.washPoly(L(stalk), mixHex(col, '#2a1030', 0.3), 250);
  for (let k = 0; k < 16; k++) {
    const a = -Math.PI / 2 + (k - 7.5) * 0.17;
    const len = s * r(0.45, 0.7);
    const bx = x + (k - 7.5) * s * 0.02, by = y - s * 0.5;
    c.strokePath(L([[bx, by], [bx + Math.cos(a) * len * 0.5, by + Math.sin(a) * len * 0.5 - s * 0.05], [bx + Math.cos(a + 0.35) * len, by + Math.sin(a + 0.35) * len]]), 'sea_leaf', k % 3 ? col : mixHex(col, '#fff0e8', 0.4), s / 70, 0.5);
  }
}
function sponge(c, L, x, y, s, r, col) {
  for (let k = 0; k < 3; k++) {
    const h = s * r(0.6, 1.1), w = s * r(0.14, 0.2), ox = (k - 1) * s * 0.26;
    const tube = [[x + ox - w, y], [x + ox - w * 0.8, y - h], [x + ox + w * 0.8, y - h], [x + ox + w, y]];
    c.washPoly(L(tube), col, 250);
    c.strokePath(L([[x + ox - w * 0.4, y], [x + ox - w * 0.35, y - h * 0.95]]), 'sea_dry', mixHex(col, '#fff0d0', 0.3), s / 70, 0.5);
    const rim = [];
    for (let j = 0; j <= 10; j++) { const a = Math.PI + (j / 10) * Math.PI; rim.push([x + ox + Math.cos(a) * w * 0.8, y - h + Math.sin(a) * w * 0.25]); }
    c.strokePath(L(rim), 'sea_contour', mixHex(col, '#1a0a20', 0.5), s / 90, 0.5);
  }
}
function seagrass(c, L, x, y, s, r) {
  for (let k = 0; k < 7; k++) {
    const bx = x + r(-s * 0.2, s * 0.2), h = s * r(0.6, 1.2), bend = r(-0.4, 0.4);
    c.strokePath(L([[bx, y], [bx + bend * h * 0.3, y - h * 0.5], [bx + bend * h * 0.8, y - h]]), 'sea_leaf', r.pick(['#2f7058', '#3f8a5a', '#5d7a3e', '#1a5a4c']), s / 60, 0.5);
  }
}
function shell(c, L, x, y, s, r) {
  const pts = [];
  for (let k = 0; k <= 30; k++) { const a = (k / 30) * TAU * 2.2; const rr = s * (0.1 + 0.9 * k / 30); pts.push([x + Math.cos(a) * rr * 0.9, y - s * 0.5 + Math.sin(a) * rr * 0.6]); }
  c.washPoly(L(c.blob(x, y - s * 0.45, s, s * 0.6, { n: 20, wobble: 0.05 })), r.pick(['#f3e6c8', '#e9c98a', '#d9a0a0']), 250);
  c.strokePath(L(pts), 'wire', '#8a5a4a', s / 25, 0.6);
}

export function paintReef(P) {
  return P.layer('reef', { w: REEF.len, h: REEF.wid, scale: REEF.scale }, (c) => {
    const r = c.r;
    const L = (pts) => pts.map((p) => rLocal(p[0], p[1]));
    const xs = [];
    for (let x = -900; x <= 5600; x += 40) xs.push(x);
    const surf = xs.map((x) => [x, groundY(x)]);
    const ground = L(surf.concat([[5600, 4000], [-900, 4000]]));
    // nothing may reach into the opening frame (the pivot picture)
    const clear = (x, top) => !(x > -120 && x < 2020 && top < 1120);
    // seabed
    c.washPoly(ground, '#1f5a58', 255);
    c.fillPoly(ground, '#2f6a60', { opacity: 90, bleed: 0.03, texture: 0.9, border: 0.3 });
    const band = L(surf.concat(xs.slice().reverse().map((x) => [x, groundY(x) + 140])));
    c.fillPoly(band, '#4f8a78', { opacity: 110, bleed: 0.04, texture: 0.9, border: 0.3 });
    fieldStrokes(c, ground, () => -RB + RB + r(-0.06, 0.06), {
      n: 1500, len: [50, 220], w: [0.5, 1.3], steps: 5, brush: (rr) => (rr() < 0.6 ? 'sea_comb' : 'sea_dry'),
      col: (x, y, rr) => rr.pick(['#3a7a6a', '#2a6058', '#5f9a84', '#7fae94', '#24504c', '#e9c98a', '#4f8a78', '#9fc0a8']),
    });
    // sand ripples
    for (let i = 0; i < 420; i++) {
      const x = r(-800, 5400), y = groundY(x) + r(10, 300);
      const pts = [];
      for (let k = 0; k <= 5; k++) pts.push([x + k * 22, y + 5 * Math.sin(k * 1.2 + i)]);
      c.strokePath(L(pts), 'wire', r.pick(['#8fc2a8', '#a8d0b0', '#5f9a84']), r(1, 1.8), 0.6);
    }
    // big watercolour fills leave a faint wash over their whole bounding box: keep the seabed paint
    // strictly below its (slightly raised) surface line
    clipTo(c, L(xs.map((x) => [x, groundY(x) - 14]).concat([[5600, 4000], [-900, 4000]])), [-20, -20, REEF.len + 20, REEF.wid + 20]);
    c.strokePath(L(surf.filter((_, i) => i % 2 === 0)), 'sea_contour', '#9fd0bc', 1.6, 0.5);
    // back row: hazy distant reef silhouettes (atmospheric teal)
    for (let i = 0; i < 60; i++) {
      const x = r(-700, 4600), y = groundY(x) - r(20, 120);
      const s = r(120, 320);
      if (!clear(x, y - s * 1.6)) continue;
      const col = r.pick(['#1d6a72', '#1a6068', '#227478', '#185a64']);
      if (r() < 0.5) c.washPoly(L(c.blob(x, y - s * 0.4, s, s * 0.7, { wobble: 0.25 })), col, 150);
      else for (let k = 0; k < 5; k++) c.strokePath(L([[x + k * 20, y], [x + k * 20 + r(-40, 40), y - s * 0.6], [x + k * 22 + r(-60, 60), y - s]]), 'sea_leaf', col, s / 40, 0.5);
    }
    // reef elements along the ground
    const kinds = ['rock', 'rock', 'fan', 'branch', 'brain', 'anemone', 'sponge', 'grass', 'grass', 'shell'];
    for (let i = 0; i < 460; i++) {
      const x = r(-700, 5150), y = groundY(x) + r(-6, 60);
      if (x > 4640) continue; // the shore bank starts here: keep corals under water
      const k = r.pick(kinds);
      const s = r(60, 180);
      if (!clear(x, y - s * 2)) continue;
      if (k === 'rock') rock(c, L, x, y, s * 1.2, r);
      else if (k === 'fan') fanCoral(c, L, x, y, s * 1.8, r, r.pick([C.magenta, '#b84a82', C.plum, '#c05a8a']));
      else if (k === 'branch') branchCoral(c, L, x, y, s * 1.4, r, r.pick(['#e86a5a', C.rose, '#f08a6a', C.amber]));
      else if (k === 'brain') brainCoral(c, L, x, y, s * 0.8, r, r.pick([C.ochre, '#d9a060', '#c98a5a', C.gold]));
      else if (k === 'anemone') anemone(c, L, x, y, s * 0.9, r, r.pick([C.rose, C.lavender, '#f3a0b0', C.violet]));
      else if (k === 'sponge') sponge(c, L, x, y, s * 0.9, r, r.pick([C.violet, C.purple, C.ochre, '#8a4a7a']));
      else if (k === 'grass') seagrass(c, L, x, y, s * 1.6, r);
      else shell(c, L, x, y, s * 0.2, r);
    }
    // pebbles and specks on the seabed
    for (let i = 0; i < 600; i++) {
      const x = r(-800, 5400), y = groundY(x) + r(0, 280);
      const s = r(3, 11);
      c.washPoly(L(c.blob(x, y, s, s * 0.7, { n: 10, wobble: 0.2 })), r.pick(['#2a5a58', '#6f9a88', '#e9c98a', '#a8c0a0', '#1b3f4a']), r(160, 250));
    }
    // guarantee: nothing of this layer inside the opening frame (the pivot picture)
    eraseIn(c, L([[-12, -12], [1932, -12], [1932, 1092], [-12, 1092]]));
  });
}
