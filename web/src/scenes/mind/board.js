// MIND · board — the die sits in a CPU package on a painted circuit board (storyboard panel 21).
// Board space = the die pivot's world (die = [0,1920] x [0,1080]).
import { C } from '../lib/palette.js';
import { PIVOT, DIE } from '../pivots.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, circlePts, crescentPts } from '../lib/kit.js';
import { ease, invLerp } from '../../engine/math.js';
import { T, LIFTMAP, LIFT_END, boardLight } from './layout.js';
import { roundRectPts, wobble, wobRect, inkContour, strokeFill, dab } from './paintkit.js';

export const PK = { x0: -330, y0: -330, x1: 2250, y1: 1410, r: 46 };     // package body
export const BD = { x0: -1790, y0: -1310, x1: 3710, y1: 2390 };         // board
const PIN = { w: 46, pitch: 98, out: 230, under: 60 };
const KEEP = { x0: PK.x0 - PIN.out - 170, y0: PK.y0 - PIN.out - 170, x1: PK.x1 + PIN.out + 170, y1: PK.y1 + PIN.out + 170 };

// ------------------------------------------------------------------------------------------------
// Geometry (deterministic): pins, traces, components
// ------------------------------------------------------------------------------------------------
export const PINS = [];
export const TRACES = [];
export const PARTS = [];
{
  const r = rng('mind-traces');
  const sides = [
    { o: [0, -1], s: [1, 0], a: PK.x0 + 80, b: PK.x1 - 80, edge: PK.y0, horiz: true },
    { o: [0, 1], s: [1, 0], a: PK.x0 + 80, b: PK.x1 - 80, edge: PK.y1, horiz: true },
    { o: [-1, 0], s: [0, 1], a: PK.y0 + 80, b: PK.y1 - 80, edge: PK.x0, horiz: false },
    { o: [1, 0], s: [0, 1], a: PK.y0 + 80, b: PK.y1 - 80, edge: PK.x1, horiz: false },
  ];
  for (const sd of sides) {
    const n = Math.floor((sd.b - sd.a) / PIN.pitch) + 1;
    const span = (n - 1) * PIN.pitch, start = (sd.a + sd.b) / 2 - span / 2;
    for (let i = 0; i < n; i++) {
      const along = start + i * PIN.pitch;
      const base = sd.horiz ? [along, sd.edge] : [sd.edge, along];
      const tip = [base[0] + sd.o[0] * PIN.out, base[1] + sd.o[1] * PIN.out];
      PINS.push({ base, tip, o: sd.o, s: sd.s });
      if (r() < 0.1) continue; // unrouted pin
      const u = (i - (n - 1) / 2) / ((n - 1) / 2);
      const L1 = 70 + 330 * (1 - Math.abs(u)) + r(-10, 10);
      const D = 640 * Math.abs(u);
      const sg = Math.sign(u) || 1;
      const p1 = [tip[0] + sd.o[0] * L1, tip[1] + sd.o[1] * L1];
      const p2 = [p1[0] + (sd.o[0] + sd.s[0] * sg) * D, p1[1] + (sd.o[1] + sd.s[1] * sg) * D];
      const L2 = r() < 0.35 ? 2600 : r(180, 1300);
      let p3 = [p2[0] + sd.o[0] * L2, p2[1] + sd.o[1] * L2];
      p3 = [clamp(p3[0], BD.x0 + 70, BD.x1 - 70), clamp(p3[1], BD.y0 + 70, BD.y1 - 70)];
      const w = r() < 0.16 ? r(15, 22) : r() < 0.4 ? r(9, 11) : r(5, 7.5);
      TRACES.push({ pts: [tip, p1, p2, p3], via: L2 < 2000, w, speed: r(1300, 2600), ph: r(0, 1), period: r(0.9, 2.2), col: r() < 0.3 ? 'c' : 'w' });
    }
  }
  // components in the outer ring
  const kinds = [['ecap', 16], ['soic', 10], ['qfp', 3], ['xtal', 4], ['ind', 5], ['hdr', 3], ['led', 6], ['ccap', 46], ['res', 46]];
  const boxes = [];
  const free = (x0, y0, x1, y1, m = 30) => {
    if (x1 > KEEP.x0 && x0 < KEEP.x1 && y1 > KEEP.y0 && y0 < KEEP.y1) return false;
    if (x0 < BD.x0 + 200 || y0 < BD.y0 + 200 || x1 > BD.x1 - 200 || y1 > BD.y1 - 260) return false;
    for (const b of boxes) if (x1 + m > b[0] && x0 - m < b[2] && y1 + m > b[1] && y0 - m < b[3]) return false;
    return true;
  };
  const size = { ecap: () => { const d = r(120, 210); return [d, d]; }, soic: () => (r() < 0.5 ? [150, 110] : [220, 110]), qfp: () => [260, 260], xtal: () => [140, 58], ind: () => [130, 130], hdr: () => [440, 100], led: () => [44, 26], ccap: () => [50, 28], res: () => [52, 26] };
  const cnt = {};
  for (const [kind, n] of kinds) {
    for (let q = 0; q < n; q++) {
      for (let tries = 0; tries < 60; tries++) {
        let [w, h] = size[kind]();
        if ((kind === 'ccap' || kind === 'res' || kind === 'soic' || kind === 'xtal' || kind === 'led') && r() < 0.5) [w, h] = [h, w];
        const x = r(BD.x0 + 220, BD.x1 - 220 - w), y = r(BD.y0 + 220, BD.y1 - 280 - h);
        if (!free(x, y, x + w, y + h, kind === 'ccap' || kind === 'res' ? 26 : 50)) continue;
        boxes.push([x, y, x + w, y + h]);
        cnt[kind] = (cnt[kind] || 0) + 1;
        const pre = { ecap: 'C', ccap: 'C', res: 'R', soic: 'U', qfp: 'U', xtal: 'Y', ind: 'L', hdr: 'J', led: 'D' }[kind];
        PARTS.push({ kind, x, y, w, h, label: `${pre}${cnt[kind] + (kind === 'ccap' ? 20 : kind === 'qfp' ? 12 : 0)}`, seed: r(), col: r.pick(['#46c66a', '#f2b544', '#e0553a', '#7fd8cf']) });
        break;
      }
    }
  }
  // short local traces from parts to nearby vias (Manhattan with 45° corners)
  for (const p of PARTS) {
    if (p.kind === 'led' || r() < 0.35) continue;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const dir = r.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const L1 = r(80, 260), L2 = r(60, 220), sg = r() < 0.5 ? 1 : -1;
    const a = [cx + dir[0] * (p.w / 2 + 10), cy + dir[1] * (p.h / 2 + 10)];
    const b = [a[0] + dir[0] * L1, a[1] + dir[1] * L1];
    const c2 = [b[0] + (dir[0] + dir[1] * sg) * L2 * 0.7, b[1] + (dir[1] + dir[0] * sg) * L2 * 0.7];
    const d = [c2[0] + dir[0] * L2, c2[1] + dir[1] * L2];
    if ([b, c2, d].some(([x, y]) => x > KEEP.x0 - 40 && x < KEEP.x1 + 40 && y > KEEP.y0 - 40 && y < KEEP.y1 + 40)) continue;
    TRACES.push({ pts: [a, b, c2, d], via: true, w: r() < 0.3 ? r(9, 12) : r(4.5, 6.5), speed: r(900, 1800), ph: r(0, 1), period: r(1.4, 3), col: 'w', local: true });
  }
  for (const tr of TRACES) {
    tr.len = 0;
    tr.cum = [0];
    for (let i = 1; i < tr.pts.length; i++) {
      tr.len += Math.hypot(tr.pts[i][0] - tr.pts[i - 1][0], tr.pts[i][1] - tr.pts[i - 1][1]);
      tr.cum.push(tr.len);
    }
  }
}
function traceAt(tr, d) {
  d = clamp(d, 0, tr.len);
  let i = 1;
  while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
  const seg = tr.cum[i] - tr.cum[i - 1] || 1, u = (d - tr.cum[i - 1]) / seg;
  return [lerp(tr.pts[i - 1][0], tr.pts[i][0], u), lerp(tr.pts[i - 1][1], tr.pts[i][1], u)];
}

// ------------------------------------------------------------------------------------------------
// Painting
// ------------------------------------------------------------------------------------------------
function paintPart(c, p, T_) {
  const r = c.r;
  const [x, y] = T_([p.x, p.y]);
  const w = p.w, h = p.h, cx = x + w / 2, cy = y + h / 2;
  // cast shadow (light from the upper left)
  c.fillPoly(wobRect(r, x + 8, y + 12, x + w + 16, y + h + 20, Math.min(w, h) * 0.2, 2), '#04181c', { opacity: 110, bleed: 0.05, texture: 0.4, border: 0.1 });
  if (p.kind === 'ecap') {
    const R = w / 2;
    c.washPoly(circlePts(cx, cy, R, 40), '#233f73', 255);
    c.fillPoly(circlePts(cx, cy, R, 40), '#2f5a9a', { opacity: 90, bleed: 0.02, texture: 0.7, border: 0.4 });
    c.fillPoly(crescentPts(cx, cy, R * 0.98, -2.3, 0.36), '#0f1f3d', { opacity: 150, bleed: 0.02, texture: 0.5, border: 0.2 });
    c.fillPoly(crescentPts(cx, cy, R * 0.96, 0.6, 0.18), '#c8d2e0', { opacity: 170, bleed: 0.02, texture: 0.4, border: 0.3 }); // polarity stripe
    c.washPoly(circlePts(cx, cy, R * 0.78, 36), '#aeb4bf', 255);
    c.fillPoly(circlePts(cx, cy, R * 0.78, 36), '#dfe3ea', { opacity: 110, bleed: 0.02, texture: 0.7, border: 0.4 });
    c.strokePath([[cx - R * 0.5, cy], [cx + R * 0.5, cy]], 'mind_contour', '#6b717d', 1.4, 0);
    c.strokePath([[cx, cy - R * 0.5], [cx, cy + R * 0.5]], 'mind_contour', '#6b717d', 1.4, 0);
    dab(c, cx - R * 0.35, cy - R * 0.35, R * 0.16, R * 0.11, '#ffffff', { rot: -0.7 });
    inkContour(c, circlePts(cx, cy, R, 48), '#0a1426', 1.4, { gap: 0.2, runs: [2, 3] });
  } else if (p.kind === 'soic' || p.kind === 'qfp') {
    const pins = p.kind === 'qfp' ? 4 : 2, np = p.kind === 'qfp' ? 9 : Math.round(Math.max(w, h) / 32);
    const vert = h > w;
    const pinAt = (side, k, n) => {
      const t = (k + 0.5) / n;
      if (side === 0) return [x + t * w, y - 10, 9, 16];
      if (side === 1) return [x + t * w, y + h + 10, 9, 16];
      if (side === 2) return [x - 10, y + t * h, 16, 9];
      return [x + w + 10, y + t * h, 16, 9];
    };
    const sidesUsed = pins === 4 ? [0, 1, 2, 3] : vert ? [2, 3] : [0, 1];
    for (const sd of sidesUsed) for (let k = 0; k < np; k++) { const [px, py, rx, ry] = pinAt(sd, k, np); dab(c, px, py, rx * 0.5, ry * 0.5, '#c9c2b0', { hi: '#f4efe2', wobble: 0.05 }); }
    const body = wobRect(r, x, y, x + w, y + h, 6, 0.8);
    c.washPoly(body, '#17191f', 255);
    c.fillPoly(body, '#2a2d38', { opacity: 80, bleed: 0.02, texture: 0.8, border: 0.4 });
    strokeFill(c, x + 3, y + 3, x + w - 3, y + h - 3, { brushName: 'mind_dry', colors: ['#23262f', '#1b1d24', '#2e313c'], weight: 0.9, spacing: 7, len: [30, 90] });
    dab(c, x + 16, y + 16, 6, 6, '#50535e');
    for (let k = 0; k < 2; k++) c.strokePath([[x + w * 0.25, y + h * (0.42 + k * 0.2)], [x + w * (0.6 + 0.15 * r()), y + h * (0.42 + k * 0.2)]], 'mind_ui', '#8d909a', 0.9, 0);
    inkContour(c, body, '#07080c', 1.2, { gap: 0.18 });
    c.strokePath([[x + 6, y + 2], [x + w - 8, y + 2]], 'mind_contour', '#4a4e5c', 0.6, 0);
  } else if (p.kind === 'xtal') {
    const rr = Math.min(w, h) / 2;
    const body = wobRect(r, x, y, x + w, y + h, rr, 0.6);
    c.washPoly(body, '#9aa1ad', 255);
    c.fillPoly(body, '#d6dbe3', { opacity: 110, bleed: 0.02, texture: 0.7, border: 0.4 });
    c.strokePath(w > h ? [[x + rr, y + h * 0.3], [x + w - rr, y + h * 0.3]] : [[x + w * 0.3, y + rr], [x + w * 0.3, y + h - rr]], 'mind_contour', '#ffffff', 1.2, 0);
    inkContour(c, body, '#3d434f', 1.1, { gap: 0.15 });
  } else if (p.kind === 'ind') {
    const body = wobRect(r, x, y, x + w, y + h, 12, 0.8);
    c.washPoly(body, '#3a3d45', 255);
    c.fillPoly(body, '#555a66', { opacity: 90, bleed: 0.02, texture: 0.8, border: 0.4 });
    c.washPoly(circlePts(cx, cy, w * 0.34, 30), '#b87333', 255);
    c.fillPoly(circlePts(cx, cy, w * 0.34, 30), '#d99a5b', { opacity: 100, bleed: 0.02, texture: 0.6, border: 0.3 });
    for (let k = 0; k < 5; k++) { const rr = w * (0.08 + k * 0.055); c.strokePath(circlePts(cx, cy, rr, 20, 0.3, 0.3 + TAU * 0.85), 'mind_ui', '#7a4a1e', 0.8, 0.4); }
    inkContour(c, body, '#15171c', 1.2);
  } else if (p.kind === 'hdr') {
    const body = wobRect(r, x, y, x + w, y + h, 6, 0.8);
    c.washPoly(body, '#15161b', 255);
    c.fillPoly(body, '#23252c', { opacity: 80, bleed: 0.02, texture: 0.8, border: 0.4 });
    const vert = h > w, n = 8;
    for (let k = 0; k < n; k++) for (let q = 0; q < 2; q++) {
      const px = vert ? x + w * (0.27 + 0.46 * q) : x + w * ((k + 0.5) / n), py = vert ? y + h * ((k + 0.5) / n) : y + h * (0.27 + 0.46 * q);
      c.washPoly(wobRect(r, px - 12, py - 12, px + 12, py + 12, 2, 0.4), C.gold, 255);
      dab(c, px, py, 5, 5, '#3a2a0a');
      dab(c, px - 6, py - 6, 3, 2, '#fff0c0');
    }
    inkContour(c, body, '#050507', 1.2);
  } else if (p.kind === 'led') {
    const body = wobRect(r, x, y, x + w, y + h, 4, 0.4);
    c.washPoly(body, '#e8e2d0', 255);
    dab(c, cx, cy, Math.min(w, h) * 0.36, Math.min(w, h) * 0.3, p.col, { hi: '#ffffff' });
    inkContour(c, body, '#2a2a2a', 0.8, { runs: [2, 3] });
  } else {
    // ceramic cap (tan) / resistor (black) with tinned ends
    const cap = p.kind === 'ccap';
    const body = wobRect(r, x, y, x + w, y + h, 3, 0.4);
    c.washPoly(body, cap ? '#b89a6a' : '#16171b', 255);
    c.fillPoly(body, cap ? '#d2b584' : '#2a2b31', { opacity: 90, bleed: 0.02, texture: 0.7, border: 0.4 });
    const vert = h > w, e = (vert ? h : w) * 0.22;
    const ends = vert ? [[x, y, x + w, y + e], [x, y + h - e, x + w, y + h]] : [[x, y, x + e, y + h], [x + w - e, y, x + w, y + h]];
    for (const [a0, b0, a1, b1] of ends) { c.washPoly(wobRect(r, a0, b0, a1, b1, 2, 0.3), '#c9c6bd', 255); c.strokePath([[a0 + 2, b0 + 2], [a1 - 2, b0 + 2]], 'mind_ui', '#ffffff', 0.6, 0); }
    if (!cap) for (let k = 0; k < 3; k++) { const tx = vert ? cx : x + w * (0.36 + k * 0.12), ty = vert ? y + h * (0.36 + k * 0.12) : cy; dab(c, tx, ty, 2.2, 3, '#e8e4d8'); }
  }
  // silkscreen outline
  const m = 14;
  inkContour(c, roundRectPts(x - m, y - m, x + w + m, y + h + m, 6, 20), '#cfe6df', 0.7, { brushName: 'mind_ui', gap: 0.25, runs: [3, 5] });
}

export function paintBoard(P) {
  const bw = BD.x1 - BD.x0, bh = BD.y1 - BD.y0;
  const T_ = (p) => [p[0] - BD.x0, p[1] - BD.y0];
  // ---- the board
  const board = P.layer('board', { w: bw, h: bh, scale: 0.55 }, (c) => {
    const r = c.r;
    const outline = roundRectPts(0, 0, bw, bh, 120, 60);
    c.washPoly(outline, '#11535b', 255);
    // underpainting: mottled teal, warmer green and cool blue masses
    for (let i = 0; i < 26; i++) {
      c.fillPoly(c.blob(r(0, bw), r(0, bh), r(500, 1300), r(300, 800), { rot: r(0, 3), wobble: 0.22 }), r.pick([C.deepTeal, C.sea, '#1d6a5e', '#134358', C.teal, '#0c3c46']), { opacity: 38, bleed: 0.15, texture: 0.85, border: 0.2 });
    }
    // light pool around the chip (painted), darker edges
    const [pcx, pcy] = T_([960, 540]);
    c.fillPoly(c.blob(pcx, pcy, 2100, 1450, { wobble: 0.12 }), '#2a8f86', { opacity: 34, bleed: 0.2, texture: 0.7, border: 0.1 });
    c.fillPoly(c.blob(pcx, pcy, 1500, 1050, { wobble: 0.14 }), '#3aa39a', { opacity: 26, bleed: 0.2, texture: 0.7, border: 0.1 });
    // directional brushwork of the board surface (follows the board's long axis)
    strokeFill(c, 20, 20, bw - 20, bh - 20, { extent: (v) => { const k = Math.max(0, Math.max(140 - v, v - (bh - 140))); const cut = 140 - Math.sqrt(Math.max(0, 140 * 140 - k * k)); return [20 + cut, bw - 20 - cut]; }, brushName: 'mind_comb', colors: ['#1a6a6c', '#0c3e47', '#15585f', '#1f7a74', '#0f4450', '#237f7a'], weight: 2.3, spacing: 22, len: [300, 900], wav: 6 });
    c.flush();
    // copper pours: hatched islands
    for (let k = 0; k < 9; k++) {
      let x, y;
      do { x = r(300, bw - 300); y = r(300, bh - 300); } while (x > KEEP.x0 - BD.x0 - 200 && x < KEEP.x1 - BD.x0 + 200 && y > KEEP.y0 - BD.y0 - 200 && y < KEEP.y1 - BD.y0 + 200);
      const poly = c.blob(x, y, r(220, 420), r(160, 300), { n: 10, wobble: 0.25, rot: r(0, 3) });
      c.fillPoly(poly, '#1c7a70', { opacity: 45, bleed: 0.04, texture: 0.6, border: 0.3 });
      c.hatchPoly(poly, { dist: 14, angle: r.pick([0.785, -0.785]), brushName: 'wire', color: '#3aa597', weight: 0.9, rand: 0.1 });
      inkContour(c, poly, '#56b8aa', 1.0, { brushName: 'mind_ui', gap: 0.2 });
    }
    // traces: shadow bed, copper body, lit edge
    for (const tr of TRACES) c.strokePath(tr.pts.map((p) => T_([p[0] + tr.w * 0.25 + 2, p[1] + tr.w * 0.35 + 3])), 'mind_trace', '#062a30', (tr.w + 6) * 1.0, 0);
    c.flush();
    for (const tr of TRACES) c.strokePath(tr.pts.map(T_), 'mind_trace', tr.col === 'c' ? '#d9a44a' : r.pick([C.ochre, '#c78a3c', '#b8813a']), tr.w, 0);
    for (const tr of TRACES) {
      const hi = tr.pts.map((p) => T_([p[0] - tr.w * 0.18, p[1] - tr.w * 0.22]));
      c.strokePath(hi, 'mind_contour', '#ffe3a3', Math.max(0.5, tr.w * 0.09), 0);
    }
    c.flush();
    for (const tr of TRACES) {
      const end = T_(tr.pts[tr.pts.length - 1]);
      if (tr.via) {
        dab(c, end[0], end[1], tr.w * 1.9 + 6, tr.w * 1.9 + 6, C.gold, { wobble: 0.08 });
        dab(c, end[0], end[1], tr.w * 0.75 + 2, tr.w * 0.75 + 2, '#062026', { wobble: 0.1 });
        dab(c, end[0] - tr.w, end[1] - tr.w, tr.w * 0.5, tr.w * 0.35, '#fff3c8', { wobble: 0.1 });
      }
      if (tr.local) { const a = T_(tr.pts[0]); dab(c, a[0], a[1], tr.w * 1.4 + 4, tr.w * 1.4 + 4, '#c9c2b0', { hi: '#f7f2e4' }); }
    }
    // stray vias + test points
    for (let k = 0; k < 140; k++) {
      const x = r(200, bw - 200), y = r(200, bh - 200);
      const wx = x + BD.x0, wy = y + BD.y0;
      if (wx > KEEP.x0 && wx < KEEP.x1 && wy > KEEP.y0 && wy < KEEP.y1) continue;
      const s = r(8, 15);
      dab(c, x, y, s, s, r() < 0.8 ? C.gold : '#c9c2b0', { wobble: 0.08 });
      dab(c, x, y, s * 0.42, s * 0.42, '#062026');
    }
    c.flush();
    // components
    for (const p of PARTS) paintPart(c, p, T_);
    c.flush();
    // gold edge fingers along the bottom edge
    for (let k = 0; k < 34; k++) {
      const x = 1400 + k * 58, y = bh - 150;
      const f = wobRect(r, x, y, x + 38, y + 140, 5, 0.4);
      c.washPoly(f, '#c99a3a', 255);
      c.fillPoly(f, C.gold, { opacity: 120, bleed: 0.01, texture: 0.6, border: 0.4 });
      c.strokePath([[x + 8, y + 12], [x + 8, y + 128]], 'mind_contour', '#fff0c0', 1.0, 0);
    }
    // mounting holes
    for (const [x, y] of [[170, 170], [bw - 170, 170], [170, bh - 170], [bw - 170, bh - 170]]) {
      dab(c, x, y, 78, 78, C.gold, { wobble: 0.04 });
      c.fillPoly(circlePts(x, y, 76, 40), C.amber, { opacity: 80, bleed: 0.01, texture: 0.6, border: 0.4 });
      dab(c, x, y, 46, 46, '#051418', { wobble: 0.04 });
      inkContour(c, circlePts(x, y, 80, 48), '#6a4a12', 1.6, { gap: 0.2 });
    }
    // painted falloff towards the board edges (the chip is spot-lit)
    for (let k = 0; k < 40; k++) {
      const a = r(0, TAU), rr = r(0.82, 1.05);
      const x = bw / 2 + Math.cos(a) * bw * 0.5 * rr, y = bh / 2 + Math.sin(a) * bh * 0.5 * rr;
      c.fillPoly(c.blob(x, y, r(500, 900), r(400, 700), { rot: r(0, 3) }), r.pick(['#04121a', '#061822', '#0a1426']), { opacity: 70, bleed: 0.2, texture: 0.8, border: 0.1 });
    }
    // board edge: lit bevel + dark lip
    const o = wobble(roundRectPts(8, 8, bw - 8, bh - 8, 112, 40), r, 2);
    inkContour(c, o, '#6fcabb', 2.6, { gap: 0.08, runs: [5, 8] });
    const o2 = wobble(roundRectPts(2, 2, bw - 2, bh - 2, 118, 40), r, 2);
    inkContour(c, o2, '#031015', 3.2, { gap: 0.05, runs: [4, 6] });
  });

  // ---- the package (near, crisp)
  const pad = PIN.out + 110;
  const px0 = PK.x0 - pad, py0 = PK.y0 - pad;
  const pw = PK.x1 - PK.x0 + 2 * pad, ph = PK.y1 - PK.y0 + 2 * pad;
  const pkg = P.layer('package', { w: pw, h: ph, scale: 0.72 }, (c) => {
    const r = c.r;
    const Tp = (p) => [p[0] - px0, p[1] - py0];
    const rrP = (x0, y0, x1, y1, rad, amp = 1.5) => wobRect(r, x0 - px0, y0 - py0, x1 - px0, y1 - py0, rad, amp);
    // cast shadow
    c.fillPoly(rrP(PK.x0 + 10, PK.y0 + 40, PK.x1 + 70, PK.y1 + 90, 60, 4), '#03141a', { opacity: 150, bleed: 0.06, texture: 0.4, border: 0.1 });
    // pins: solder fillets on the board, gold bodies with light and shade
    for (const pin of PINS) {
      const [bx, by] = pin.base, [tx, ty] = pin.tip;
      const hw = PIN.w / 2;
      const q = (a, b, s0, s1) => [[a[0] + pin.s[0] * s0, a[1] + pin.s[1] * s0], [b[0] + pin.s[0] * s0, b[1] + pin.s[1] * s0], [b[0] + pin.s[0] * s1, b[1] + pin.s[1] * s1], [a[0] + pin.s[0] * s1, a[1] + pin.s[1] * s1]].map(Tp);
      const inner = [bx - pin.o[0] * PIN.under, by - pin.o[1] * PIN.under];
      const foot = [tx - pin.o[0] * 70, ty - pin.o[1] * 70];
      // solder pad + fillet
      const [fx, fy] = Tp([tx - pin.o[0] * 30, ty - pin.o[1] * 30]);
      dab(c, fx, fy, pin.o[0] ? 62 : 34, pin.o[0] ? 34 : 62, '#b9b3a5', { hi: '#efe9da', wobble: 0.1 });
      c.washPoly(q(inner, [tx, ty], -hw, hw), '#b8801f', 255);
      c.fillPoly(q(inner, [tx, ty], -hw, hw), C.gold, { opacity: 110, bleed: 0.01, texture: 0.6, border: 0.3 });
      // lit side and shaded side (strokes follow the pin)
      const L = (a, b, s) => [[a[0] + pin.s[0] * s, a[1] + pin.s[1] * s], [b[0] + pin.s[0] * s, b[1] + pin.s[1] * s]].map(Tp);
      c.strokePath(L([bx + pin.o[0] * 10, by + pin.o[1] * 10], [tx - pin.o[0] * 12, ty - pin.o[1] * 12], -hw * 0.45), 'mind_dry', '#fff0bf', 0.9, 0);
      c.strokePath(L([bx + pin.o[0] * 10, by + pin.o[1] * 10], [tx - pin.o[0] * 12, ty - pin.o[1] * 12], hw * 0.55), 'mind_dry', '#8a5a14', 0.8, 0);
      // knee of the gull-wing bend
      c.strokePath(L(foot, foot, 0).map((p, k) => [p[0] + (k ? pin.s[0] : -pin.s[0]) * hw * 0.9, p[1] + (k ? pin.s[1] : -pin.s[1]) * hw * 0.9]), 'mind_contour', '#7a4c10', 1.1, 0);
      inkContour(c, q([bx, by], [tx, ty], -hw, hw), '#4a2e08', 0.8, { gap: 0.2, runs: [2, 3] });
    }
    c.flush();
    // side walls (thickness towards bottom-right), brushed
    c.washPoly(rrP(PK.x0 + 8, PK.y0 + 16, PK.x1 + 32, PK.y1 + 44, PK.r, 1.2), '#2a0d25', 255);
    strokeFill(c, PK.x0 - px0 + 20, PK.y1 - py0 - 20, PK.x1 - px0 + 32, PK.y1 - py0 + 44, { brushName: 'mind_dry', colors: ['#3a1433', '#200a1d', '#4a1a40'], weight: 1.2, spacing: 8, len: [60, 200] });
    strokeFill(c, PK.x1 - px0 - 10, PK.y0 - py0 + 20, PK.x1 - px0 + 32, PK.y1 - py0 + 30, { brushName: 'mind_dry', colors: ['#3a1433', '#200a1d', '#4a1a40'], weight: 1.2, spacing: 8, len: [60, 200], dir: 'v' });
    // lid
    const lid = rrP(PK.x0, PK.y0, PK.x1, PK.y1, PK.r, 1.4);
    c.washPoly(lid, '#6e2556', 255);
    c.fillPoly(lid, C.plum, { opacity: 110, bleed: 0.02, texture: 0.8, border: 0.4 });
    for (let i = 0; i < 12; i++) c.fillPoly(c.blob(r(PK.x0 + 200, PK.x1 - 200) - px0, r(PK.y0 + 150, PK.y1 - 150) - py0, r(300, 700), r(200, 420), { rot: r(0, 3) }), r.pick([C.magenta, C.purple, '#8a2f62', '#5a1d4c']), { opacity: 34, bleed: 0.1, texture: 0.8, border: 0.2 });
    strokeFill(c, PK.x0 - px0 + 6, PK.y0 - py0 + 6, PK.x1 - px0 - 6, PK.y1 - py0 - 6, { brushName: 'mind_comb', colors: ['#7d2a60', '#5e2050', '#8a3468', '#6a2a5e', '#743a70', '#56204a'], weight: 1.4, spacing: 11, len: [120, 420], wav: 2 });
    // bevel: lit rims (top, left) and shaded rims (bottom, right) as strokes along the edges
    const bev = 30;
    const edgeStrokes = (a, b, colors, w, n) => { for (let k = 0; k < n; k++) { const off = (k / n) * bev; c.strokePath([[a[0] + (b[1] === a[1] ? 0 : off), a[1] + (b[1] === a[1] ? off : 0)], [b[0] + (b[1] === a[1] ? 0 : off), b[1] + (b[1] === a[1] ? off : 0)]].map(Tp), 'mind_dry', r.pick(colors), w, 0); } };
    edgeStrokes([PK.x0 + 40, PK.y0 + 4], [PK.x1 - 40, PK.y0 + 4], ['#e8622c', '#d8452f', '#f07a4a'], 1.6, 6);
    edgeStrokes([PK.x0 + 4, PK.y0 + 40], [PK.x0 + 4, PK.y1 - 40], ['#e8622c', '#f08a50', '#d8452f'], 1.6, 6);
    edgeStrokes([PK.x0 + 40, PK.y1 - bev - 2], [PK.x1 - 40, PK.y1 - bev - 2], ['#3d1233', '#2c0c26', '#4a1640'], 1.6, 6);
    edgeStrokes([PK.x1 - bev - 2, PK.y0 + 40], [PK.x1 - bev - 2, PK.y1 - 40], ['#3d1233', '#2c0c26', '#4a1640'], 1.6, 6);
    c.strokePath([[PK.x0 + 50, PK.y0 + 2], [PK.x1 - 60, PK.y0 + 2]].map(Tp), 'mind_contour', '#ffb08a', 1.1, 0);
    // raised inner step
    const st = 150;
    inkContour(c, rrP(PK.x0 + st, PK.y0 + st, PK.x1 - st, PK.y1 - st, 30, 1), '#c05a8a', 1.3, { gap: 0.12 });
    inkContour(c, rrP(PK.x0 + st + 4, PK.y0 + st + 5, PK.x1 - st + 4, PK.y1 - st + 5, 30, 1), '#3a1030', 1.0, { gap: 0.2 });
    // cavity + bond pads + bond wires around the die
    const cav = rrP(-80, -80, 2000, 1160, 10, 0.8);
    c.washPoly(cav, '#081318', 255);
    c.fillPoly(cav, '#10222a', { opacity: 70, bleed: 0.02, texture: 0.8, border: 0.4 });
    const bond = (x0, y0, x1, y1, n, nx, ny) => {
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t);
        const [ax, ay] = Tp([x + nx * 6, y + ny * 6]), [bx2, by2] = Tp([x + nx * 62, y + ny * 62]);
        dab(c, bx2, by2, 7, 7, C.gold);
        c.strokePath([[ax, ay], [(ax + bx2) / 2 + ny * 5, (ay + by2) / 2 + nx * 5], [bx2, by2]], 'mind_ui', '#f5cf7a', 0.55, 0.6);
      }
    };
    bond(30, 0, 1890, 0, 58, 0, -1); bond(30, 1080, 1890, 1080, 58, 0, 1);
    bond(0, 30, 0, 1050, 32, -1, 0); bond(1920, 30, 1920, 1050, 32, 1, 0);
    // gold seal rings (hand-inked)
    inkContour(c, rrP(-96, -96, 2016, 1176, 14, 1.2), C.gold, 2.4, { gap: 0.06, runs: [4, 6] });
    inkContour(c, rrP(-110, -110, 2030, 1190, 16, 1.2), '#8a5a1a', 1.1, { gap: 0.12 });
    // printed logo: an hourglass mark + data-matrix
    const [lx, ly] = Tp([60, 1290]);
    const hg = [[lx - 34, ly - 48], [lx + 34, ly - 48], [lx + 5, ly], [lx + 34, ly + 48], [lx - 34, ly + 48], [lx - 5, ly]];
    c.fillPoly(hg, '#e9c98a', { opacity: 60, bleed: 0.02, texture: 0.6, border: 0.3 });
    c.fillPoly([[lx - 20, ly + 44], [lx + 20, ly + 44], [lx, ly + 18]], '#f2b544', { opacity: 160, bleed: 0.01, texture: 0.5, border: 0.3 });
    inkContour(c, hg, '#f3e6c8', 1.6, { gap: 0.08, runs: [2, 3] });
    c.strokePath([[lx - 42, ly - 52], [lx + 42, ly - 52]], 'mind_contour', '#f3e6c8', 1.8, 0);
    c.strokePath([[lx - 42, ly + 52], [lx + 42, ly + 52]], 'mind_contour', '#f3e6c8', 1.8, 0);
    const [mx, my] = Tp([1960, -260]);
    for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) if (a === 0 || b === 9 || r() < 0.45) dab(c, mx + a * 13, my + b * 13, 5, 5, '#e6c3d8', { wobble: 0.05 });
    // pin-1 mark
    dab(c, PK.x0 + 100 - px0, PK.y0 + 100 - py0, 26, 26, '#f3c9a0', { hi: '#fff4e0' });
    // package contour (lost and found)
    inkContour(c, lid, '#22081c', 1.8, { gap: 0.12, runs: [5, 8] });
  });

  // silkscreen labels + package print (crisp printed text, drawn in board space)
  const labelFont = "600 34px Consolas, 'Courier New', monospace";
  const labels = PARTS.filter((p, i) => p.kind !== 'ccap' || i % 3 === 0).map((p) => ({ p, L: P.text([p.label], { font: labelFont, color: '#d7ece6', pad: 4 }) }));
  const logoText = P.text(['TIME'], { font: "800 78px 'Segoe UI', Arial, sans-serif", color: '#f3e6c8', pad: 4, letterSpacing: 10 });
  const logoSub = P.text(['MIND-145 · 13.8 GYR · 96 BPM'], { font: "600 26px Consolas, monospace", color: '#e2c2d6', pad: 4, letterSpacing: 2 });
  const boardTitle = P.text(['TIME · MAINBOARD  rev 145', 'made of stardust'], { font: "600 52px Consolas, monospace", color: '#d7ece6', pad: 6 });
  return { board, pkg, pkgOrigin: [px0, py0], boardOrigin: [BD.x0, BD.y0], labels, logoText, logoSub, boardTitle };
}

// ------------------------------------------------------------------------------------------------
// Drawing (called with R.view = boardView(lt))
// ------------------------------------------------------------------------------------------------
const CREAM = hex(C.cream);
export function drawBoard(R, lt, A, DA) {
  const light = boardLight(lt);
  const g = { grade: [1, light, 1] };
  R.layer(A.board, M.translate(A.boardOrigin[0], A.boardOrigin[1]), g);
  for (const { p, L } of A.labels) {
    const vert = p.h > p.w * 1.2;
    const x = vert ? p.x + p.w + 22 : p.x, y = vert ? p.y + p.h / 2 : p.y - 22 - L.h / 2;
    R.layer(L, vert ? M.place(x + L.h / 2, y, 1, -Math.PI / 2, L.w / 2, L.h / 2) : M.translate(x, y - L.h / 2 + 4), { opacity: 0.78, grade: [1, light, 1] });
  }
  R.layer(A.boardTitle, M.translate(BD.x0 + 330, BD.y1 - 330), { opacity: 0.7, grade: [1, light, 1] });
  // status LEDs (light)
  for (const p of TRACES_LED) {
    const on = 0.55 + 0.45 * Math.sin(R.t * p.f + p.ph);
    R.glow(p.x + p.w / 2, p.y + p.h / 2, 26, hex(p.col), 0.9 * on * light, { ext: 3, shape: [2, 0.5, 2] });
  }
  // pulses racing along the traces (towards the chip)
  if (lt > 0.35) {
    const vis = smoothstep(0.35, 1.2, lt) * light;
    const parts = [];
    for (const tr of TRACES) {
      if (tr.local) continue;
      const cyc = (R.t / tr.period + tr.ph) % 1;
      const d = tr.len * (1 - cyc * 1.25);
      if (d < 0 || d > tr.len) continue;
      const [x, y] = traceAt(tr, d);
      const warm = tr.col === 'c';
      R.glow(x, y, tr.w * 2 + 6, warm ? [1, 0.75, 0.4] : [0.55, 1, 0.95], 0.85 * vis, { ext: 3, shape: [2.4, 0.4, 2.5] });
      for (let k = 1; k <= 10; k++) {
        const [px, py] = traceAt(tr, d + k * (tr.w + 8) * 2.4);
        const a = (1 - k / 11) * 0.5 * vis;
        parts.push([px, py, tr.w * 0.8 + 4, 0, warm ? 1 : 0.6, warm ? 0.8 : 1, warm ? 0.5 : 0.95, a]);
      }
    }
    R.particles(parts, { kind: 'glow', blend: 'add' });
  }
  R.layer(A.pkg, M.translate(A.pkgOrigin[0], A.pkgOrigin[1]), g);
  R.layer(A.logoText, M.translate(118, 1240), { opacity: 0.88, grade: [1, light, 1] });
  R.layer(A.logoSub, M.translate(122, 1318), { opacity: 0.8, grade: [1, light, 1] });
  // the die itself (pivot art) + its lights
  R.layer(DA.grid, M.id(), g);
  drawDieLights(R, lt, light);
}
const TRACES_LED = PARTS.filter((p) => p.kind === 'led').map((p, i) => ({ ...p, f: 1.3 + i * 0.7, ph: i * 1.9 }));

// PIVOT.die.drawLights, except that cells whose light has lifted off stay dark, and the die goes
// dark once the last volley has left.
export function drawDieLights(R, lt, light = 1) {
  const t = R.t;
  const dark = lt >= LIFT_END;
  if (lt >= LIFT_END + 0.3) return;
  for (let j = 0; j < DIE.rows; j++) for (let i = 0; i < DIE.cols; i++) {
    const cell = LIFTMAP.get(i * 100 + j);
    const x = i * DIE.cell + 10, y = j * DIE.cell + 10, w = DIE.cell - 20;
    if (cell && lt >= cell.tl) {
      // condensing: the lit square shrinks into a hot point as the light lifts off
      const c = invLerp(cell.tl, cell.tl + 0.24, lt);
      if (c >= 1) continue;
      const s = (w - 16) * (1 - ease.inCubic(c));
      R.rect(x + w / 2 - s / 2, y + w / 2 - s / 2, s, s, [...CREAM, 0.92 * light]);
      R.glow(x + w / 2, y + w / 2, w * 0.45, [1, 0.8, 0.45], (0.35 + 1.1 * Math.sin(c * Math.PI)) * light, { ext: 2.2 });
      continue;
    }
    if (dark || !PIVOT.die.lit(i, j, t)) continue;
    R.rect(x + 8, y + 8, w - 16, w - 16, [...CREAM, 0.92 * light]);
    R.glow(x + w / 2, y + w / 2, w * 0.45, [1, 0.8, 0.45], 0.35 * light, { ext: 2.2 });
  }
}
