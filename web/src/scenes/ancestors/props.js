// ANCESTORS — set dressing that makes each phase a lived-in painted world: flowering plants that
// bloom behind the green front, broad-leaf clumps that unfurl, butterflies, bird flocks (flip-book
// wing frames), and the night camp (a hide tent that unfolds at dusk, a spear, tools by the fire).
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, ellipsePts, circlePts, ribbon } from '../lib/kit.js';
import { ease, invLerp, noise1 } from '../../engine/math.js';
import { spreadArrival, FIRE } from './land.js';
import { dab, along, brokenLine } from './brushkit.js';

// ---------------------------------------------------------------------------------------------
// Atlas helper: n cells of size cell x cell, painted by fn(c, ox, oy, i)
// ---------------------------------------------------------------------------------------------
function mkAtlas(P, name, n, cell, fn, scale = 1.3) {
  const L = P.layer('props_' + name, { w: n * cell, h: cell, scale }, (c) => { for (let i = 0; i < n; i++) fn(c, i * cell, 0, i); });
  return { L, n, cell };
}
function spr(R, S, i, x, y, s, rot, px, py, sy = s, o = {}) {
  const w = S.n * S.cell;
  R.layer(S.L, M.place(x, y, s, rot, px, py, sy), { ...o, uv: [(i * S.cell) / w, 0, ((i + 1) * S.cell) / w, 1], w: S.cell, h: S.cell });
}

// ---------------------------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------------------------
function paintStemPlant(c, ox, oy, i) {
  // stem + leaves, flower attaches at the top (cell 200: base at (100, 190), top at (100 + dx, 190 - h))
  const r = c.r;
  const h = [120, 90, 140][i], bx = ox + 100, by = oy + 192, dx = [8, -10, 14][i];
  const stem = [[bx, by], [bx + dx * 0.3, by - h * 0.4], [bx + dx * 0.8, by - h * 0.75], [bx + dx, by - h]];
  c.strokePath(stem, 'gouache', '#2f6a42', 0.55, 0.5);
  c.strokePath(stem.map((p) => [p[0] + 1.5, p[1]]), 'wire', '#7ab058', 0.6, 0.5);
  for (let k = 0; k < 5; k++) {
    const u = 0.15 + k * 0.15, p = [lerp(bx, bx + dx, u), by - h * u], side = k % 2 ? 1 : -1;
    const leaf = [];
    for (let j = 0; j <= 10; j++) {
      const t = j / 10, w = Math.sin(Math.PI * t) * 9;
      leaf.push([p[0] + side * (t * 38), p[1] - t * 16 - w]);
    }
    for (let j = 10; j >= 0; j--) {
      const t = j / 10, w = Math.sin(Math.PI * t) * 9;
      leaf.push([p[0] + side * (t * 38), p[1] - t * 16 + w * 0.6]);
    }
    c.washPoly(leaf, r.pick(['#3f8a4a', '#2f7a44', '#5aa050']), 255);
    c.strokePath([p, [p[0] + side * 34, p[1] - 15]], 'wire', '#1f4a30', 0.6, 0.3);
  }
}
function paintBloom(c, ox, oy, i) {
  // flower heads centred in a 100 cell
  const cx = ox + 50, cy = oy + 50, r = c.r;
  if (i === 0) { // red hibiscus
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU - Math.PI / 2;
      c.washPoly(ellipsePts(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17, 17, 12, a, 18), k % 2 ? '#d8452f' : '#e8563a', 255);
      c.strokePath([[cx, cy], [cx + Math.cos(a) * 26, cy + Math.sin(a) * 26]], 'wire', '#8a1f2a', 0.6, 0.3);
    }
    c.washPoly(circlePts(cx, cy, 7, 14), '#7a1a2a', 255);
    c.strokePath([[cx, cy], [cx + 16, cy - 20]], 'ink', '#f2d24c', 0.9, 0.3);
    c.washPoly(circlePts(cx + 16, cy - 20, 3.5, 10), '#ffe07a', 255);
  } else if (i === 1) { // yellow star cluster
    for (let k = 0; k < 6; k++) {
      const px = cx + r(-22, 22), py = cy + r(-18, 18);
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * TAU;
        c.washPoly(ellipsePts(px + Math.cos(a) * 5, py + Math.sin(a) * 5, 5.5, 2.6, a, 10), j % 2 ? '#f2d24c' : '#f6c24a', 255);
      }
      c.washPoly(circlePts(px, py, 2.6, 8), '#c9682e', 255);
    }
  } else { // magenta bells
    for (let k = 0; k < 5; k++) {
      const px = cx + (k - 2) * 12, py = cy - 10 + Math.abs(k - 2) * 8;
      c.washPoly([[px - 7, py - 8], [px + 7, py - 8], [px + 9, py + 10], [px + 3, py + 7], [px, py + 12], [px - 3, py + 7], [px - 9, py + 10]], k % 2 ? '#a33f6f' : '#c4507a', 255);
      c.strokePath([[px, py - 8], [px, py - 18]], 'wire', '#2f6a42', 0.6, 0.3);
    }
  }
}
function paintBigLeaf(c, ox, oy, i) {
  // heart-shaped leaf on a stalk, pointing up from (ox + 20, oy + 290) — cell 300
  const bx = ox + 150, by = oy + 292;
  const tip = [bx + (i ? 40 : -30), by - 260];
  const base = [bx + (i ? 10 : -6), by - 110];
  c.strokePath([[bx, by], [bx + (i ? 4 : -3), by - 60], base], 'gouache', '#2f6a42', 0.8, 0.5);
  const L = [], Rr = [];
  for (let j = 0; j <= 14; j++) {
    const t = j / 14;
    const x = lerp(base[0], tip[0], t), y = lerp(base[1], tip[1], t);
    const w = 70 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - 0.1 * t) + (t < 0.1 ? 20 * (1 - t / 0.1) : 0);
    const nx = (tip[1] - base[1]) / 160, ny = -(tip[0] - base[0]) / 160;
    L.push([x - w * 0.95, y + nx * 0 - (t < 0.12 ? 8 : 0)]);
    Rr.push([x + w, y]);
  }
  const leaf = L.concat(Rr.slice().reverse());
  const col = i ? '#2c7a5c' : '#1f6a58';
  c.washPoly(leaf, col, 255);
  c.fillPoly(leaf, mixHex(col, '#6ab080', 0.3), { opacity: 70, bleed: 0.02, texture: 0.8, border: 0.4 });
  c.washPoly(L.concat(Array.from({ length: 15 }, (_, j) => [lerp(base[0], tip[0], 1 - j / 14), lerp(base[1], tip[1], 1 - j / 14)])), mixHex(col, '#0c2a2a', 0.3), 200);
  c.flush();
  along(c, [base, [lerp(base[0], tip[0], 0.5), lerp(base[1], tip[1], 0.5)], tip], 'ink', '#a8d4a0', 0.9);
  for (let j = 1; j < 7; j++) {
    const t = j / 7, x = lerp(base[0], tip[0], t), y = lerp(base[1], tip[1], t), w = 60 * Math.sin(Math.PI * Math.pow(t, 0.75));
    c.strokePath([[x, y], [x - w * 0.8, y + 18]], 'wire', '#0f3a30', 0.7, 0.4);
    c.strokePath([[x, y], [x + w * 0.85, y + 16]], 'wire', '#0f3a30', 0.7, 0.4);
  }
  brokenLine(c, c.r, leaf, 'ink', '#0c2a28', 0.8, { keep: 0.8, seg: 5 });
}
function paintButterfly(c, ox, oy, i) {
  // one wing (right), pivot at the body (ox + 10, oy + 40); cell 80
  const cols = [['#f2903a', '#2a1a1a', '#ffe0a0'], ['#3cc7c6', '#16223a', '#dff6f4'], ['#f2d24c', '#3a2a1a', '#fff6d0']][i];
  const bx = ox + 10, by = oy + 40;
  const up = [[bx, by], [bx + 14, by - 30], [bx + 40, by - 34], [bx + 52, by - 22], [bx + 40, by - 6], [bx, by]];
  const lo = [[bx, by], [bx + 30, by + 4], [bx + 38, by + 20], [bx + 24, by + 30], [bx + 8, by + 18]];
  c.washPoly(up, cols[0], 255);
  c.washPoly(lo, mixHex(cols[0], cols[1], 0.2), 255);
  c.strokePath(up.slice(1, 5), 'ink', cols[1], 1.4, 0.4);
  c.washPoly(circlePts(bx + 36, by - 20, 5, 10), cols[2], 255);
  c.washPoly(circlePts(bx + 24, by + 16, 4, 10), cols[2], 255);
  c.strokePath(lo.slice(1), 'ink', cols[1], 1.0, 0.4);
}
function paintBird(c, ox, oy, i) {
  // flip-book frames: wings up / level / down (cell 80, body centred)
  const cx = ox + 40, cy = oy + 40;
  const wy = [-22, -2, 14][i];
  const pts = [[cx - 34, cy + wy], [cx - 16, cy + wy * 0.4 - 3], [cx - 4, cy], [cx, cy + 2], [cx + 4, cy], [cx + 16, cy + wy * 0.4 - 3], [cx + 34, cy + wy]];
  c.strokePath(pts, 'gouache', '#1e2a30', 0.9, 0.5);
  c.washPoly(ellipsePts(cx, cy + 1, 7, 3.2, 0, 12), '#1e2a30', 255);
}
function paintTent(c, ox, oy) {
  // hide lean-to: poles + stitched skins + entrance; base centre (ox + 200, oy + 380); cell 400
  const r = c.r, bx = ox + 200, by = oy + 382, apex = [bx + 6, by - 250];
  const skins = [
    { pts: [apex, [bx - 150, by], [bx - 40, by + 2], [bx - 10, by - 150]], col: '#b8864e' },
    { pts: [apex, [bx - 20, by - 160], [bx + 10, by + 2], [bx + 150, by]], col: '#a07040' },
    { pts: [[bx - 10, by - 150], [bx - 40, by + 2], [bx + 10, by + 2]], col: '#1c1418' }, // entrance
  ];
  for (const sk of skins) {
    c.washPoly(sk.pts, sk.col, 255);
    if (sk.col !== '#1c1418') c.fillPoly(sk.pts, mixHex(sk.col, '#e0b070', 0.3), { opacity: 70, bleed: 0.02, texture: 0.85, border: 0.5 });
  }
  c.flush();
  // hide texture: strokes running down the skins (fur direction), patches, stitched seams
  for (let k = 0; k < 150; k++) {
    const u = r(0.08, 0.98), side = r() < 0.5 ? -1 : 1;
    const x = lerp(apex[0], bx + side * r(10, 145), u), y = lerp(apex[1], by, u);
    const kind = r();
    dab(c, x, y, Math.atan2(by - apex[1], side * 90) + r(-0.25, 0.25), r(12, 30), kind < 0.5 ? 'gouache' : kind < 0.8 ? 'dry' : 'charcoal', side < 0 ? r.pick(['#c8945a', '#a87a48', '#d8a868', '#8a5a34']) : r.pick(['#9a6a40', '#7a5030', '#b07e4c', '#5a3a24']), kind < 0.5 ? 0.45 : 0.6);
  }
  for (let k = 0; k < 4; k++) {
    const u = r(0.3, 0.8), side = k % 2 ? -1 : 1;
    const p = [lerp(apex[0], bx + side * 90, u), lerp(apex[1], by, u)];
    c.washPoly(ellipsePts(p[0], p[1], r(12, 20), r(8, 14), r(-0.4, 0.4), 16), side < 0 ? '#a07040' : '#6a4a2e', 200);
    c.strokePath(ellipsePts(p[0], p[1], r(12, 20), r(8, 14), 0, 16).slice(0, 12), 'ink', '#3a2418', 0.5, 0.3);
  }
  for (let k = 0; k < 9; k++) {
    const u = 0.15 + k * 0.09, p = [lerp(apex[0], bx - 10, u), lerp(apex[1], by - 150 + 150 * u, u)];
    c.strokePath([[p[0] - 5, p[1] - 3], [p[0] + 5, p[1] + 3]], 'ink', '#3a2418', 0.7, 0.3);
  }
  c.washPoly([apex, [bx + 150, by], [bx + 80, by], [bx + 10, by - 200]], '#5a3a2a', 110);
  // a tied-back door flap and lashings at the apex
  c.washPoly([[bx - 10, by - 150], [bx - 44, by - 40], [bx - 70, by + 2], [bx - 40, by + 2]], '#d8a868', 255);
  c.strokePath([[bx - 10, by - 150], [bx - 44, by - 40], [bx - 70, by + 2]], 'ink', '#3a2418', 0.8, 0.4);
  for (let k = 0; k < 3; k++) c.strokePath([[apex[0] - 12, apex[1] + 8 + k * 6], [apex[0] + 12, apex[1] + 14 + k * 6]], 'gouache', '#2a1a14', 0.35, 0.3);
  // poles poking out of the top
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + (k - 1.5) * 0.28;
    const p0 = [apex[0] - Math.cos(a) * 30, apex[1] - Math.sin(a) * 30];
    const p1 = [apex[0] + Math.cos(a) * 44, apex[1] + Math.sin(a) * 44];
    c.strokePath([p0, p1], 'gouache', '#4a2e20', 0.55, 0.2);
  }
  // spear leaning on the right side, stone point
  const s0 = [bx + 170, by + 4], s1 = [bx + 60, by - 290];
  c.strokePath([s0, s1], 'gouache', '#6a4a2e', 0.5, 0.1);
  c.washPoly([[s1[0], s1[1]], [s1[0] + 10, s1[1] + 4], [s1[0] - 8, s1[1] - 30], [s1[0] - 2, s1[1] + 8]], '#8a8698', 255);
  brokenLine(c, r, [[bx - 150, by], apex, [bx + 150, by]], 'ink', '#2a1a14', 1.1, { keep: 0.85, seg: 3 });
}
function paintTools(c, ox, oy) {
  // by the fire: a stone hand-axe, a gourd, a bundle of sticks; base line at oy + 110 (cell 240)
  const r = c.r, by = oy + 110;
  c.washPoly([[ox + 30, by], [ox + 44, by - 30], [ox + 64, by - 36], [ox + 80, by - 22], [ox + 76, by - 2]], '#8a8698', 255);
  c.washPoly([[ox + 44, by - 30], [ox + 64, by - 36], [ox + 70, by - 24], [ox + 52, by - 20]], '#b8b4c4', 255);
  c.strokePath([[ox + 30, by], [ox + 44, by - 30], [ox + 64, by - 36], [ox + 80, by - 22]], 'ink', '#2a2634', 0.7, 0.3);
  c.washPoly(ellipsePts(ox + 130, by - 26, 26, 24, 0, 24), '#c99a4a', 255);
  c.washPoly(ellipsePts(ox + 130, by - 58, 10, 12, 0, 14), '#b8883c', 255);
  c.washPoly(ellipsePts(ox + 122, by - 34, 10, 8, 0, 12), '#e8c070', 220);
  c.strokePath(ellipsePts(ox + 130, by - 26, 26, 24, 0, 24).slice(6, 20), 'ink', '#5a3a1a', 0.7, 0.3);
  for (let k = 0; k < 5; k++) c.strokePath([[ox + 160 + k * 6, by], [ox + 210 + k * 3, by - 14 - k * 3]], 'gouache', r.pick(['#6a3a2a', '#8a5030']), 0.45, 0.2);
}

export function paintProps(P) {
  return {
    stems: mkAtlas(P, 'stems', 3, 200, paintStemPlant),
    blooms: mkAtlas(P, 'blooms', 3, 100, paintBloom, 1.6),
    bigleaf: mkAtlas(P, 'bigleaf', 2, 300, paintBigLeaf),
    fly: mkAtlas(P, 'fly', 3, 80, paintButterfly, 2),
    bird: mkAtlas(P, 'bird', 3, 80, paintBird, 1.5),
    tent: mkAtlas(P, 'tent', 1, 400, paintTent, 1.4),
    tools: mkAtlas(P, 'tools', 1, 240, paintTools, 1.6),
  };
}

// ---------------------------------------------------------------------------------------------
// Placement + animation
// ---------------------------------------------------------------------------------------------
const pr = rng('anc-props');
export const FLOWERS = [];
for (let i = 0; i < 30; i++) {
  const x = pr(-120, 2150), y = pr(1640, 2080);
  if (Math.abs(x - 1215) < 200 && y < 1830) continue;                 // rock
  if (Math.hypot(x - FIRE.x, (y - FIRE.y) * 2.5) < 190) continue;      // fire place
  if (Math.hypot(x - 590, (y - 1804) * 2.5) < 120) continue;           // burrow
  FLOWERS.push({ x, y, v: pr.int(0, 2), s: pr(0.5, 0.95) * (0.55 + (y - 1600) / 800), t: 0, rot: pr(-0.15, 0.15), ph: pr(0, TAU) });
}
FLOWERS.sort((a, b) => a.y - b.y);
for (const f of FLOWERS) f.t = spreadArrival(f.x, f.y) + pr(0.35, 0.9);
export const BIGLEAVES = [
  { x: 700, y: 1700, s: 0.75, n: 3 }, { x: 1110, y: 1690, s: 0.6, n: 3 }, { x: 1990, y: 1760, s: 0.9, n: 4 }, { x: -40, y: 1860, s: 1.0, n: 4 },
  { x: 390, y: 1990, s: 1.05, n: 3 },
];
for (const b of BIGLEAVES) b.t = spreadArrival(b.x, b.y) + 0.3;

// flowering plants: stems grow, then heads open with a twist
export function drawFlowers(R, lt, A, look, near = false) {
  const o = { grade: look.grade, tint: look.tint };
  for (const f of FLOWERS) {
    const g = ease.outCubic(clamp((lt - f.t) / 0.7));
    if (g <= 0.01) continue;
    const sway = 0.04 * Math.sin(R.t * 1.8 + f.ph);
    spr(R, A.stems, f.v, f.x, f.y, f.s, f.rot + sway, 100, 192, f.s * g, o);
    const b = ease.outBack(clamp((lt - f.t - 0.45) / 0.5), 2.2);
    if (b <= 0.01) continue;
    const h = [120, 90, 140][f.v], dx = [8, -10, 14][f.v];
    const tx = f.x + (dx * Math.cos(f.rot + sway) + h * Math.sin(f.rot + sway)) * f.s, ty = f.y - h * f.s * g * Math.cos(f.rot + sway);
    spr(R, A.blooms, f.v, tx, ty, f.s * 0.9 * b, (1 - b) * 1.2 + sway, 50, 50, f.s * 0.9 * b, o);
  }
}
// broad leaves unfurl from rolled spikes
export function drawBigLeaves(R, lt, A, look) {
  const o = { grade: look.grade, tint: look.tint };
  for (const b of BIGLEAVES) {
    const r = rng('anc-bl-' + b.x);
    for (let k = 0; k < b.n; k++) {
      const t0 = b.t + 0.15 * k;
      const u = clamp((lt - t0) / 1.0);
      if (u <= 0) continue;
      const fin = (k - (b.n - 1) / 2) * 0.42 + r(-0.1, 0.1);
      const ang = lerp(fin * 0.2, fin, ease.outBack(u, 1.2)) + 0.03 * Math.sin(R.t * 1.3 + k + b.x);
      const sx = b.s * lerp(0.25, 1, ease.outCubic(u)), sy = b.s * lerp(0.3, 1, ease.outCubic(u));
      spr(R, A.bigleaf, k % 2, b.x, b.y, sx, ang, 150, 292, sy, o);
    }
  }
}

// butterflies (day): flutter along wavy paths through the midground
const FLIES = [
  { t0: 4.9, t1: 7.6, x0: 560, x1: 1500, y0: 1640, v: 0 },
  { t0: 5.3, t1: 7.9, x0: 1900, x1: 980, y0: 1600, v: 1 },
  { t0: 5.8, t1: 8.2, x0: 820, x1: 1760, y0: 1700, v: 2 },
];
// the butterfly that lands on the rock beside the primate (it looks at it), and lifts off as it rises
export const LANDER = { x: 1336, y: 1712, land: 6.9, lift: 7.55 };
function landerPos(lt) {
  const L = LANDER;
  if (lt < L.land) {
    const u = clamp((lt - 6.0) / (L.land - 6.0)), e = ease.inOutSine(u);
    return [lerp(1720, L.x, e) + 40 * Math.sin(u * 11) * (1 - u), lerp(1470, L.y, e) - 60 * Math.sin(u * 6) * (1 - u), Math.abs(Math.cos(lt * 22)), -1];
  }
  if (lt < L.lift) return [L.x, L.y, 0.35 + 0.35 * Math.abs(Math.sin(lt * 3.2)), -1];
  const u = clamp((lt - L.lift) / 1.4);
  return [L.x - 380 * u + 30 * Math.sin(u * 13), L.y - 420 * ease.outSine(u) - 20 * Math.sin(u * 9), Math.abs(Math.cos(lt * 22)), -1];
}
export function drawButterflies(R, lt, A, look) {
  if (lt > 6.0 && lt < 9.0) {
    const [x, y, flap, dir] = landerPos(lt);
    const s = 0.62, o = { grade: look.grade, tint: look.tint };
    spr(R, A.fly, 0, x, y, s * (0.2 + 0.8 * flap) * dir, 0, 10, 40, s, o);
    spr(R, A.fly, 0, x, y, -s * (0.2 + 0.8 * flap) * dir, 0, 10, 40, s, { ...o, grade: [1, 0.8, 1] });
  }
  for (const f of FLIES) {
    const u = (lt - f.t0) / (f.t1 - f.t0);
    if (u <= 0 || u >= 1) continue;
    const x = lerp(f.x0, f.x1, u) + 30 * Math.sin(u * 17 + f.v);
    const y = f.y0 - 90 * Math.sin(u * 6 + f.v * 2) - 40 * Math.abs(Math.sin(u * 31 + f.v));
    const flap = Math.abs(Math.cos(R.t * 22 + f.v * 1.7));
    const dir = f.x1 > f.x0 ? 1 : -1;
    const s = 0.75;
    const o = { grade: look.grade, tint: look.tint };
    spr(R, A.fly, f.v, x, y, s * (0.2 + 0.8 * flap) * dir, 0.3 * Math.sin(u * 9), 10, 40, s, o);
    spr(R, A.fly, f.v, x, y, -s * (0.2 + 0.8 * flap) * dir, 0.3 * Math.sin(u * 9), 10, 40, s, { ...o, grade: [1, 0.8, 1] });
  }
}

// bird flocks (sky plane): day flock, and a dusk flock of dark silhouettes
const FLOCKS = [
  { t0: 5.4, t1: 8.0, x0: 2300, x1: -400, y0: 1150, n: 7, s: 0.55 },
  { t0: 8.2, t1: 10.2, x0: -300, x1: 2200, y0: 1230, n: 5, s: 0.5 },
];
export function drawBirds(R, lt, A, look) {
  for (const [fi, F] of FLOCKS.entries()) {
    const u = (lt - F.t0) / (F.t1 - F.t0);
    if (u <= 0 || u >= 1) continue;
    const r = rng('anc-flock-' + fi);
    for (let i = 0; i < F.n; i++) {
      const off = [(i % 2 ? 1 : -1) * Math.ceil(i / 2) * 46 + r(-8, 8), Math.ceil(i / 2) * 22 + r(-6, 6)];
      const x = lerp(F.x0, F.x1, u) + off[0] * Math.sign(F.x1 - F.x0) * -1 + 10 * Math.sin(lt * 2 + i);
      const y = F.y0 + off[1] + 14 * Math.sin(lt * 1.5 + i * 0.7) - 60 * Math.sin(Math.PI * u);
      const frame = Math.floor(((R.t * 7 + r(0, 3)) % 3 + 3) % 3);
      spr(R, A.bird, frame, x, y, F.s, 0, 40, 40, F.s, { tint: look.tint, grade: [1, fi ? 0.6 : 1, 1] });
    }
  }
}

// night camp: the tent unfolds from the ground at dusk; tools pop up by the fire
export const TENT = { x: 1745, y: 1712, s: 0.72 };
export function drawCamp(R, lt, A, look) {
  const o = { grade: look.grade, tint: look.tint };
  const g = ease.outBack(clamp((lt - 8.95) / 0.75), 1.6);
  if (g > 0.01) spr(R, A.tent, 0, TENT.x, TENT.y, TENT.s * lerp(0.6, 1, g), 0, 200, 382, TENT.s * g, o);
  const t = ease.outBack(clamp((lt - 9.25) / 0.5), 2);
  if (t > 0.01) spr(R, A.tools, 0, FIRE.x + 150, FIRE.y + 34, 0.62 * t, 0, 120, 110, 0.62 * t, o);
}

// dust puffs (particles): the shrew bursting out of the burrow, landing, scampering
const PUFFS = [
  { t: 1.3, x: 564, y: 1800, n: 14, s: 1 }, { t: 2.84, x: 690, y: 1796, n: 12, s: 1 }, { t: 3.05, x: 700, y: 1798, n: 6, s: 0.7 },
  { t: 3.25, x: 725, y: 1798, n: 6, s: 0.7 }, { t: 3.44, x: 742, y: 1798, n: 8, s: 0.8 }, { t: 3.95, x: 740, y: 1798, n: 12, s: 1 },
];
export function dustPuffs(lt) {
  const out = [];
  for (const [pi, p] of PUFFS.entries()) {
    const tt = lt - p.t;
    if (tt < 0 || tt > 0.9) continue;
    const r = rng('anc-puff-' + pi);
    for (let i = 0; i < p.n; i++) {
      const a = r(-Math.PI, 0), v = r(40, 130) * p.s;
      const k = 1 - tt / 0.9;
      out.push([p.x + Math.cos(a) * v * tt * 1.4, p.y + Math.sin(a) * v * tt * 0.55 - 12 * tt, r(5, 12) * p.s * (1 + tt * 2.2), 0, 0.72, 0.68, 0.76, 0.5 * k * k]);
    }
  }
  return out;
}

// fireflies blinking in the dusk jungle (light)
const FIREFLIES = (() => {
  const r = rng('anc-fireflies');
  return Array.from({ length: 16 }, () => ({ x: r(420, 2000), y: r(1560, 1860), ph: r(0, TAU), f: r(1.2, 2.4), dx: r(-30, 30), dy: r(-20, 20), t0: r(8.8, 9.6) }));
})();
export function fireflies(lt) {
  const out = [];
  for (const f of FIREFLIES) {
    const a = smoothstep(f.t0, f.t0 + 0.4, lt) * (1 - smoothstep(10.9, 11.5, lt));
    if (a <= 0) continue;
    const blink = Math.pow(Math.max(0, Math.sin(lt * f.f * 3 + f.ph)), 3);
    out.push([f.x + f.dx * Math.sin(lt * 0.9 + f.ph), f.y + f.dy * Math.sin(lt * 1.3 + f.ph), 3.2, 0, 0.85, 1, 0.45, 1.4 * a * blink]);
  }
  return out;
}
