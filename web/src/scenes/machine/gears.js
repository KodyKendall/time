// Painted gear variants with exactly the pivot gear's tooth geometry (r = 380, 24 teeth, in a
// 1000 x 1000 layer centred at 500,500) so they mesh with it and can be drawn with drawGear.
import { C } from '../lib/palette.js';
import { rng, lerp, mixHex, TAU, clamp } from '../../engine/math.js';
import { circlePts, crescentPts } from '../lib/kit.js';
import { gearOutline, GEAR } from '../pivots.js';
import { arcStrokes, contour, glints, rivets, rectPts, strokesIn, inkRect } from './brushkit.js';

const GOLDS = [C.amber, C.ochre, '#ffd98a', '#f7c55a', '#e8a93a', C.gold];

function goldBody(c, cx, cy, R0, seed) {
  const outer = gearOutline(cx, cy, R0, GEAR.teeth);
  c.washPoly(outer, C.gold, 255);
  c.fillPoly(outer, C.amber, { opacity: 90, bleed: 0.02, texture: 0.8, border: 0.5 });
  c.flush();
  // rim: strokes following the circle (form), teeth get short radial dabs
  arcStrokes(c, cx, cy, R0 * 0.8, R0 * 0.99, { n: 110, arc: [0.25, 0.9], colors: GOLDS, brush: 'mach_flat', weight: [0.35, 0.7], seed });
  for (let i = 0; i < GEAR.teeth; i++) {
    const a = ((i + 0.34) / GEAR.teeth) * TAU;
    c.strokePath([[cx + Math.cos(a) * R0 * 0.99, cy + Math.sin(a) * R0 * 0.99], [cx + Math.cos(a) * R0 * 1.1, cy + Math.sin(a) * R0 * 1.1]], 'mach_flat', mixHex(C.gold, '#fff0b0', 0.4), 0.45, 0);
  }
  return outer;
}
function holeFill(c, pts, seed) {
  c.washPoly(pts, C.night, 255);
  c.fillPoly(pts, C.navy2, { opacity: 110, bleed: 0.02, texture: 0.6 });
}
function hub(c, cx, cy, R0, seed) {
  c.fillPoly(circlePts(cx, cy, R0 * 0.2, 64), C.ochre, { opacity: 230, bleed: 0.02, texture: 0.6, border: 0.4 });
  arcStrokes(c, cx, cy, R0 * 0.1, R0 * 0.19, { n: 20, colors: ['#a86a1a', '#ffd98a', C.ochre], brush: 'mach_flat', weight: [0.3, 0.5], seed: seed + 5 });
  const b = [];
  for (let i = 0; i < 6; i++) b.push([cx + Math.cos((i / 6) * TAU + 0.3) * R0 * 0.145, cy + Math.sin((i / 6) * TAU + 0.3) * R0 * 0.145]);
  rivets(c, b, { r: 7, dark: '#4a2a08', light: '#fff0c0' });
  c.washPoly(circlePts(cx, cy, R0 * 0.07, 30), C.night, 255);
}

// variant 0: five curved spokes; 1: solid web with round lightening holes; 2: eight slim spokes
export function paintGearVariant(c, v) {
  const cx = 500, cy = 500, R0 = GEAR.r, r = rng('gearv' + v);
  const outer = goldBody(c, cx, cy, R0, v * 11);
  if (v === 0) {
    const n = 5;
    for (let s = 0; s < n; s++) {
      const a0 = (s / n) * TAU, a1 = ((s + 1) / n) * TAU;
      const hole = [];
      for (let k = 0; k <= 20; k++) { const a = lerp(a0 + 0.22, a1 - 0.08, k / 20); hole.push([cx + Math.cos(a) * R0 * 0.8, cy + Math.sin(a) * R0 * 0.8]); }
      for (let k = 20; k >= 0; k--) { const a = lerp(a0 + 0.55, a1 + 0.05, k / 20); hole.push([cx + Math.cos(a) * R0 * 0.27, cy + Math.sin(a) * R0 * 0.27]); }
      holeFill(c, hole, s);
    }
  } else if (v === 1) {
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * TAU + 0.26;
      holeFill(c, circlePts(cx + Math.cos(a) * R0 * 0.55, cy + Math.sin(a) * R0 * 0.55, R0 * 0.17, 40), s);
    }
    // engraved concentric rings
    for (const rr of [0.33, 0.76]) { const ring = circlePts(cx, cy, R0 * rr, 90); c.strokePath(ring.concat([ring[0]]), 'mach_line', '#8a5a1a', 0.9, 0.3); }
  } else {
    for (let s = 0; s < 8; s++) {
      const a0 = (s / 8) * TAU + 0.11, a1 = ((s + 1) / 8) * TAU - 0.11;
      const hole = [];
      for (let k = 0; k <= 12; k++) hole.push([cx + Math.cos(lerp(a0, a1, k / 12)) * R0 * 0.82, cy + Math.sin(lerp(a0, a1, k / 12)) * R0 * 0.82]);
      for (let k = 12; k >= 0; k--) hole.push([cx + Math.cos(lerp(a0 + 0.12, a1 - 0.12, k / 12)) * R0 * 0.3, cy + Math.sin(lerp(a0 + 0.12, a1 - 0.12, k / 12)) * R0 * 0.3]);
      holeFill(c, hole, s);
    }
  }
  // the pivot gear's signature hatching, lighter
  c.hatchPoly(circlePts(cx, cy, R0 * 0.97, 96), { dist: 11, angle: 0.6, brushName: 'wire', color: C.ochre, weight: 0.8, rand: 0.2 });
  // rim rivets
  const rv = [];
  for (let i = 0; i < 24; i++) rv.push([cx + Math.cos((i / 24) * TAU) * R0 * 0.9, cy + Math.sin((i / 24) * TAU) * R0 * 0.9]);
  rivets(c, rv, { r: 5, dark: '#6a3a0a', light: '#fff4c8' });
  hub(c, cx, cy, R0, v);
  // oil sheen: a few dark glossy strokes + bright glints on the upper-left
  arcStrokes(c, cx, cy, R0 * 0.84, R0 * 0.95, { n: 6, arc: [0.3, 0.6], colors: ['#7a4a10'], brush: 'mach_flat', weight: [0.25, 0.4], a0: 0.4, a1: 1.6, seed: v + 40 });
  glints(c, [[cx - R0 * 0.62, cy - R0 * 0.55], [cx - R0 * 0.72, cy - R0 * 0.4], [cx - R0 * 0.5, cy - R0 * 0.68]], { angle: -0.8, weight: [0.8, 1.3], len: [14, 34] });
  contour(c, circlePts(cx, cy, R0 * 0.99, 140), { color: '#6a4a1a', weight: 1.5, lost: 0.1 });
  contour(c, outer, { color: '#6a4a1a', weight: 0.9, lost: 0.3, seed: 9 });
}

// Iron arm (riveted bar) used as the lattice frame: 700 x 70, pivot at the left end centre.
export function paintArmBar(c) {
  const pts = rectPts(0, 8, 740, 54);
  c.washPoly(pts, '#2e2436', 255);
  strokesIn(c, pts, { angle: 0, spacing: 7, len: [120, 400], colors: ['#4a3a56', '#1c1424', '#5a4a66'], brush: 'mach_flat', weight: [0.5, 0.9], seed: 1 });
  c.strokePath([[6, 14], [734, 14]], 'mach_line', '#9a88aa', 0.9, 0);
  const rv = [];
  for (let x = 30; x < 740; x += 60) rv.push([x, 35]);
  rivets(c, rv, { r: 6, dark: '#0e0a12', light: '#c8b8d8' });
  contour(c, pts, { color: '#08060c', weight: 1.0, lost: 0.2 });
}

// Fixed lighting overlays (do not rotate with the gear): a shaded lower-right crescent (multiply)
// and a warm upper-left rim light (screen). Kept inside the root circle.
export function paintGearShade(c) {
  // soft painted form shadow (drawn with multiply, clipped to the gear): watercolour crescents
  // away from the upper-left light, plus a few arcs that follow the rim
  const cx = 500, cy = 500, R0 = GEAR.r * 1.14;
  c.fillPoly(crescentPts(cx, cy, R0, -2.3, 0.34, 60), '#e0c0c4', { opacity: 150, bleed: 0.12, texture: 0.5, border: 0.2 });
  c.fillPoly(crescentPts(cx, cy, R0, -2.3, 0.2, 60), '#c09aa8', { opacity: 120, bleed: 0.1, texture: 0.6, border: 0.25 });
  c.fillPoly(crescentPts(cx, cy, R0, -2.3, 0.08, 60), '#a07a90', { opacity: 110, bleed: 0.08, texture: 0.6, border: 0.3 });
  arcStrokes(c, cx, cy, GEAR.r * 0.8, GEAR.r * 1.05, { n: 26, arc: [0.3, 0.8], colors: ['#b08898', '#c8a0a8'], brush: 'mach_flat', weight: [0.3, 0.6], a0: 0.0, a1: 1.8, seed: 21 });
}
export function paintGearLight(c) {
  const cx = 500, cy = 500, R0 = GEAR.r;
  const r = rng('glight');
  for (let i = 0; i < 40; i++) {
    const a = lerp(-2.9, -1.3, r()), rr = R0 * r(0.84, 1.08);
    const len = r(0.15, 0.45);
    const pts = [];
    for (let q = 0; q <= 8; q++) { const t = a - len / 2 + (len * q) / 8; pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr, 0.4 + Math.sin((q / 8) * Math.PI)]); }
    c.strokePath(pts, 'mach_flat', r.pick(['#fff4c8', '#ffe29a', '#ffffff']), r(0.25, 0.6), 0.4);
  }
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ------------------------------------------------------------------------------------ timber
// Heavy timber beams / posts of the frame the gear train is mounted on (wall units).
export const TIMBER = { beamW: 2240, beamH: 84, postW: 84, postH: 5200 };
function woodGrain(c, x, y, w, h, horizontal, seed) {
  const r = rng('wood' + seed);
  const base = '#6e4326';
  c.washPoly(rectPts(x, y, w, h), base, 255);
  c.flush();
  const along = horizontal ? w : h, across = horizontal ? h : w;
  // long grain strokes in near tones
  for (let i = 0; i < across / 5; i++) {
    const o = (i + r(0, 1)) * 5;
    let t = r(-60, 0);
    while (t < along) {
      const L = r(along * 0.08, along * 0.3);
      const a = [t, o + r(-1.5, 1.5)], b = [t + L, o + r(-2, 2)];
      const pts = horizontal ? [[x + a[0], y + a[1], 0.8], [x + (a[0] + b[0]) / 2, y + (a[1] + b[1]) / 2 + r(-1.5, 1.5), 1.1], [x + b[0], y + b[1], 0.8]]
        : [[x + a[1], y + a[0], 0.8], [x + (a[1] + b[1]) / 2 + r(-1.5, 1.5), y + (a[0] + b[0]) / 2, 1.1], [x + b[1], y + b[0], 0.8]];
      c.strokePath(pts, 'mach_flat', mixHex(base, r.pick(['#a8703e', '#4a2a16', '#8a5a30', '#c08050', '#3a200e']), r(0.25, 0.6)), r(0.25, 0.5), 0.3);
      t += L + r(10, 80);
    }
  }
  // knots
  for (let i = 0; i < along / 500; i++) {
    const t = r(40, along - 40), o = r(across * 0.25, across * 0.75);
    const [kx, ky] = horizontal ? [x + t, y + o] : [x + o, y + t];
    const ring = circlePts(kx, ky, r(6, 11), 14).map(([px, py]) => horizontal ? [kx + (px - kx) * 2.2, py] : [px, ky + (py - ky) * 2.2]);
    c.strokePath(ring.concat([ring[0]]), 'mach_line', '#2a160a', 0.7, 0.4);
  }
  // lit top edge, shaded bottom edge
  if (horizontal) {
    c.strokePath([[x + 4, y + 5], [x + w - 4, y + 5]], 'mach_flat', '#d8a068', 0.35, 0);
    c.strokePath([[x + 4, y + h - 6], [x + w - 4, y + h - 6]], 'mach_flat', '#241208', 0.5, 0);
  } else {
    c.strokePath([[x + 5, y + 4], [x + 5, y + h - 4]], 'mach_flat', '#d8a068', 0.35, 0);
    c.strokePath([[x + w - 6, y + 4], [x + w - 6, y + h - 4]], 'mach_flat', '#241208', 0.5, 0);
  }
  inkRect(c, rectPts(x, y, w, h), { color: '#1e0e06', weight: 1.0, lost: 0.2, seed });
}
export function paintBeam(c) {
  woodGrain(c, 0, 8, TIMBER.beamW, TIMBER.beamH - 16, true, 1);
  // iron straps with bolts every 350
  for (let x = 175; x < TIMBER.beamW; x += 350) {
    c.washPoly(rectPts(x - 16, 4, 32, TIMBER.beamH - 8), '#2a2230', 255);
    rivets(c, [[x, 20], [x, TIMBER.beamH - 20]], { r: 6, dark: '#0e0a12', light: '#c8b8d8' });
  }
}
export function paintTimberPost(c) {
  woodGrain(c, 8, 0, TIMBER.postW - 16, TIMBER.postH, false, 2);
  for (let y = 350; y < TIMBER.postH; y += 700) {
    c.washPoly(rectPts(4, y - 16, TIMBER.postW - 8, 32), '#2a2230', 255);
    rivets(c, [[22, y], [TIMBER.postW - 22, y]], { r: 6, dark: '#0e0a12', light: '#c8b8d8' });
  }
}
