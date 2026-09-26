// EARTH — under the wave (lt ~19.5 .. 22.5): the foam spiral breaks into bubbles that swirl, slow,
// thicken into membranes and fill with colour — living cells in the teal medium. The camera closes
// on one cell, which settles exactly into PIVOT.cell.
import { PIVOT } from '../pivots.js';
import { atlas, circlePts } from '../lib/kit.js';
import { C, M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, smoother, win, strokeBatch, hash, lerpLog, DUR } from './common.js';
import { diveView, W8, waveGeom, lipPt } from './wave.js';

const END = DUR;
// camera over the cell field: zoom towards the target cell at (960, 540); identity at the end
export function cellView(lt) {
  const u = smoother(20.35, END, lt);
  const z = lerpLog(0.3, 1, u);
  const rot = 0.12 * (1 - u) * (1 - u);
  return M.chain(M.translate(960, 540), M.rotate(rot), M.scale(z), M.translate(-960, -540));
}
const ap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

// cells in the world (target first)
const CELLS = [
  { x: 960, y: 540, s: 1, t0: 20.625, target: true },
  { x: -560, y: 280, s: 0.8, t0: 20.65, tint: [1, 0.85, 0.95] },
  { x: 380, y: -520, s: 0.65, t0: 20.8, tint: [0.9, 0.8, 1.05] },
  { x: 2350, y: 190, s: 0.9, t0: 20.7, tint: [1.05, 0.95, 0.85] },
  { x: 1650, y: 1500, s: 0.75, t0: 20.9, tint: [0.85, 0.75, 1.0] },
  { x: -300, y: 1350, s: 0.7, t0: 21.0, tint: [1, 0.9, 0.9] },
  { x: 2600, y: 1100, s: 0.6, t0: 20.85, tint: [0.95, 0.85, 1.05] },
  { x: 1200, y: -700, s: 0.55, t0: 21.05, tint: [1.05, 0.9, 0.8] },
];

const BUBBLES = (() => {
  const r = rng('earth-bubbles');
  const out = [];
  for (let i = 0; i < 300; i++) {
    const u = Math.pow(r(), 0.8);
    const arm = r() < 0.5 ? 0 : Math.PI;
    out.push({
      r0: 60 + 980 * u, th0: arm + u * 5.2 + r(-0.35, 0.35), size: Math.pow(r(), 2.4) * 34 + 2.5,
      born: 19.78 + u * 0.35 + r(0, 0.15), life: r(0.9, 2.6), w0: r(1.1, 1.8), rise: r(10, 45), sprite: r.int(0, 3), wob: r(0, TAU),
      rib: i < 190 ? r.int(0, 160) : undefined,
    });
    if (i < 190) out[i].born = 19.8 + r(0, 0.12);
  }
  // the crash: a burst of churned foam filling the frame, short-lived
  for (let i = 0; i < 220; i++) {
    const a = r(0, TAU), d = Math.sqrt(r()) * 1150;
    out.push({ r0: d, th0: a, size: Math.pow(r(), 1.8) * 30 + 3, born: 19.68 + r(0, 0.16), life: r(0.35, 1.1), w0: r(-2.5, 3.0), rise: r(40, 140), sprite: r.int(0, 3), wob: r(0, TAU), burst: r(80, 380) });
  }
  return out;
})();
// plankton in a parallax ring around the target cell (all leave the frame as we close in)
const PLANKTON = (() => {
  const r = rng('earth-plankton');
  const out = [];
  for (let i = 0; i < 70; i++) {
    const a = r(0, TAU), d = r(1550, 3600), p = r(0.75, 1.35);
    out.push({ x: 960 + Math.cos(a) * d, y: 540 + Math.sin(a) * d * 0.62, p, s: r(70, 150) * p, sprite: r.int(0, 11), rot: r(0, TAU), spin: r(-0.4, 0.4), born: 20.0 + r(0, 0.6) });
  }
  return out;
})();
const SPECKS = (() => {
  const r = rng('earth-specks');
  return Array.from({ length: 320 }, () => ({ x: r(-100, 2020), y: r(-100, 1180), s: r(0.8, 2.6), vx: r(-12, 12), vy: r(-18, -4), ph: r(0, TAU), c: r() }));
})();

// spawn points on the foam ribbon (screen space) at the moment the water closes
let RIBBON = null;
function ribbon() {
  if (RIBBON) return RIBBON;
  const ts = 19.82;
  const G = waveGeom(ts), V = diveView(ts).m;
  RIBBON = [];
  for (let j = 0; j <= 160; j++) {
    const f = (G.curl * j) / 160;
    const p = ap(V, lipPt(G, f, 0.06 + 0.8 * hash(j, 88) * hash(j, 89)));
    RIBBON.push(p);
  }
  return RIBBON;
}
// vortex motion of a spawned bubble (screen space), decelerating
function vortex(b, lt) {
  if (b.rib !== undefined) {
    const R0 = ribbon();
    const p0 = R0[b.rib % R0.length];
    const dx = p0[0] - 960, dy = p0[1] - 540;
    b = { ...b, r0: Math.hypot(dx, dy / 0.8), th0: Math.atan2(dy / 0.8, dx) };
  }
  const t = Math.max(0, lt - 19.8);
  const w = b.w0 * (1 - Math.exp(-t * 1.6)) / 1.6;
  const rr = b.r0 * (1 + 0.18 * t) + 12 * Math.sin(lt * 2 + b.wob) + (b.burst ? b.burst * (1 - Math.exp(-Math.max(0, lt - b.born) * 3)) : 0);
  const th = b.th0 + w;
  return [960 + Math.cos(th) * rr, 540 + Math.sin(th) * rr * 0.8 - b.rise * t];
}

export function paintUnder(P) {
  const A = {};
  A.bubbles = atlas(P, 'bubbles', 4, 220, (c, cx, cy, i) => {
    const r = c.r, R0 = 80;
    const disc = circlePts(cx, cy, R0, 90);
    c.fillPoly(disc, mixHex(C.aqua, '#ffffff', 0.3), { opacity: 18 + i * 4, bleed: 0.02, texture: 0.6, border: 0.8 });
    const list = [];
    // ring, heavier at the lower right (lost at the top-left)
    for (let k = 0; k < 3; k++) {
      const a0 = -0.3 + k * 0.9 + r(-0.1, 0.1), pts = [];
      for (let j = 0; j <= 14; j++) { const a = a0 + (1.6 * j) / 14; pts.push([cx + Math.cos(a) * R0, cy + Math.sin(a) * R0, 0.3 + Math.sin((Math.PI * j) / 14)]); }
      list.push({ pts, brush: k === 1 ? 'earth_body' : 'ink', color: k === 1 ? '#dff4ee' : '#f6f2e6', w: k === 1 ? 0.55 : 1.4, curv: 0.5, seed: `bb${i}_${k}` });
    }
    // highlight crescent upper-left + a tiny window
    const hl = [];
    for (let j = 0; j <= 8; j++) { const a = Math.PI * 1.05 + (1.0 * j) / 8; hl.push([cx + Math.cos(a) * R0 * 0.72, cy + Math.sin(a) * R0 * 0.72, Math.sin((Math.PI * j) / 8)]); }
    list.push({ pts: hl, brush: 'pastel', color: '#ffffff', w: 1.2, curv: 0.5, seed: `bh${i}` });
    list.push({ pts: [[cx - 30, cy - 38], [cx - 18, cy - 44]], brush: 'earth_dab', color: '#ffffff', w: 0.6, curv: 0, seed: `bw${i}` });
    strokeBatch(c, list);
  }, { cols: 4, scale: 1 });
  // plankton & microbial mats: diatoms, bead chains, round cells, filaments (painted sprites)
  A.plankton = atlas(P, 'plankton', 12, 200, (c, cx, cy, i) => {
    const r = c.r;
    const kind = i % 6;
    const list = [];
    if (kind === 0) {
      // centric diatom: disc with radial ribs
      c.washPoly(circlePts(cx, cy, 60, 60), '#c9b86a', 200);
      c.fillPoly(circlePts(cx, cy, 58, 60), '#e0d08a', { opacity: 90, bleed: 0.02, texture: 0.6, border: 0.6 });
      for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU; list.push({ pts: [[cx + Math.cos(a) * 14, cy + Math.sin(a) * 14], [cx + Math.cos(a) * 56, cy + Math.sin(a) * 56]], brush: 'earth_hair', color: '#8a7a3a', w: 0.9, curv: 0, seed: 'dr' + i + '_' + k }); }
      list.push({ pts: circlePts(cx, cy, 60, 40).concat([[cx + 60, cy]]), brush: 'ink', color: '#6a5a2a', w: 1.1, curv: 0.4, seed: 'dc' + i });
    } else if (kind === 1) {
      // pennate diatom: long boat shape with transverse striae
      const pts = [];
      for (let k = 0; k <= 30; k++) { const t = (k / 30) * TAU; pts.push([cx + Math.cos(t) * 80, cy + Math.sin(t) * 18 * (0.6 + 0.4 * Math.abs(Math.cos(t)))]); }
      c.washPoly(pts, '#b8c070', 230);
      c.washPoly(pts.map(([x, y]) => [cx + (x - cx) * 0.8, cy + (y - cy) * 0.55]), '#d8d890', 200);
      for (let k = -12; k <= 12; k++) list.push({ pts: [[cx + k * 6, cy - 14], [cx + k * 6, cy + 14]], brush: 'earth_hair', color: '#7a8040', w: 0.7, curv: 0, seed: 'pn' + i + '_' + k });
      list.push({ pts: [[cx - 70, cy], [cx + 70, cy]], brush: 'ink', color: '#5a6030', w: 0.8, curv: 0, seed: 'pr' + i });
    } else if (kind === 2) {
      // bead chain (cyanobacteria filament)
      let x = cx - 80, y = cy, a = r(-0.3, 0.3);
      for (let k = 0; k < 11; k++) {
        c.washPoly(circlePts(x, y, 8, 18), k % 4 === 3 ? '#e0b060' : '#5a9a6a', 235);
        list.push({ pts: circlePts(x, y, 8, 12).concat([[x + 8, y]]), brush: 'earth_hair', color: '#2a5a3a', w: 0.7, curv: 0.4, seed: 'bc' + i + '_' + k });
        a += r(-0.5, 0.5); x += Math.cos(a) * 15; y += Math.sin(a) * 15;
      }
    } else if (kind === 3) {
      // round green cell with a darker nucleus
      c.washPoly(circlePts(cx, cy, 44, 50), '#4a8a6a', 230);
      c.fillPoly(circlePts(cx, cy, 42, 50), '#6aa37a', { opacity: 110, bleed: 0.02, texture: 0.6, border: 0.6 });
      c.washPoly(circlePts(cx + 8, cy - 6, 14, 30), '#2a4a3a', 230);
      list.push({ pts: circlePts(cx, cy, 44, 40).concat([[cx + 44, cy]]), brush: 'ink', color: '#c8e0b0', w: 1.0, curv: 0.4, seed: 'rc' + i });
    } else if (kind === 4) {
      // amber cyst with spikes
      c.washPoly(circlePts(cx, cy, 34, 40), '#d08a3a', 235);
      c.fillPoly(circlePts(cx, cy, 32, 40), C.amber, { opacity: 110, bleed: 0.02, texture: 0.5, border: 0.6 });
      for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; list.push({ pts: [[cx + Math.cos(a) * 34, cy + Math.sin(a) * 34], [cx + Math.cos(a) * 52, cy + Math.sin(a) * 52]], brush: 'earth_hair', color: '#f0c070', w: 0.9, curv: 0, seed: 'cy' + i + '_' + k }); }
    } else {
      // drifting organic filament tuft
      for (let k = 0; k < 7; k++) {
        const pts = [];
        let x = cx - 60 + r(-10, 10), y = cy + r(-20, 20), a = r(-0.4, 0.4);
        for (let j = 0; j < 8; j++) { pts.push([x, y, 1 - j * 0.1]); a += r(-0.35, 0.35); x += Math.cos(a) * 16; y += Math.sin(a) * 16; }
        list.push({ pts, brush: k % 2 ? 'earth_hair' : 'ink', color: r.pick(['#a8d8c0', '#e0d0a0', '#7fbfa8']), w: r(0.7, 1.2), curv: 0.6, seed: 'ft' + i + '_' + k });
      }
    }
    strokeBatch(c, list);
  }, { cols: 6, scale: 1 });
  // the moonlit underside of the surface, seen from just below: wavy, luminous, ragged lower edge
  A.surface = P.layer('underSurface', { w: 2400, h: 900, scale: 0.8 }, (c) => {
    const r = c.r;
    const edge = (x, k) => 380 + 40 * Math.sin(x * 0.004 + k) + 22 * Math.sin(x * 0.011 + 2 * k) + 10 * Math.sin(x * 0.03 + k);
    const band = (k, op, col) => {
      const pts = [[-20, 0], [2420, 0]];
      for (let x = 2420; x >= -20; x -= 40) pts.push([x, edge(x, k) - 60 + k * 30]);
      c.washPoly(pts, col, op);
    };
    band(0, 70, '#2f7f86');
    band(1, 80, '#3a9096');
    band(2, 90, '#4aa4a4');
    c.flush();
    const list = [];
    for (let k = 0; k < 44; k++) {
      const y0 = 20 + k * 8, pts = [];
      for (let x = -40; x <= 2440; x += 60) pts.push([x, Math.min(edge(x, 0) + 30, y0 + 16 * Math.sin(x * 0.006 + k * 0.7) + 7 * Math.sin(x * 0.017 + k))]);
      list.push({ pts, brush: k % 3 ? 'wire' : 'earth_hair', color: r.pick(['#9fe0d8', '#cfeee8', C.aqua, '#6ac0bc']), w: r(0.8, 1.4), curv: 0.5, seed: 'us' + k });
    }
    // caustic scribbles of moonlight
    for (let k = 0; k < 90; k++) {
      let x = r(0, 2400), y = r(10, 300), a = r(0, TAU);
      const pts = [];
      for (let j = 0; j < 5; j++) { pts.push([x, y, 1 - j * 0.15]); a += r(-1.2, 1.2); x += Math.cos(a) * 14; y += Math.sin(a) * 8; }
      list.push({ pts, brush: 'earth_hair', color: r.pick(['#e8fff8', '#bff0e6']), w: r(0.6, 1.0), curv: 0.6, seed: 'uc' + k });
    }
    // ragged lower edge: foam lace and hanging drips
    for (let k = 0; k < 110; k++) {
      const x = r(0, 2400), y = edge(x, 2) + 10 + r(-14, 16);
      list.push({ pts: [[x, y], [x + r(20, 60), y + r(-5, 5)]], brush: r.pick(['dry', 'earth_body', 'earth_dab']), color: r.pick(['#dff4ee', '#aee0d8', '#f4fff8']), w: r(0.35, 0.7), curv: 0.4, seed: 'uf' + k });
    }
    strokeBatch(c, list);
  });
  // underwater light shafts (painted, used additively)
  A.shafts = P.layer('shafts', { w: 1600, h: 1400, scale: 0.5 }, (c) => {
    const r = c.r;
    const list = [];
    for (let k = 0; k < 16; k++) {
      const x = 100 + k * 90 + r(-30, 30), w = r(0.8, 2.2), pts = [];
      for (let j = 0; j <= 6; j++) pts.push([x + j * 40 * r(0.8, 1.2), (j / 6) * 1300 + 40, 1.1 - j * 0.14]);
      list.push({ pts, brush: 'marker', color: r.pick([C.aqua, '#bfeee6', C.cyan]), w, curv: 0.4, seed: 'sh' + k });
    }
    strokeBatch(c, list);
  });
  return A;
}

// the medium (the wave's water, then the living broth): graded from night to the pivot's teal
export function mediumParams(lt) {
  const day = smoother(19.9, 21.2, lt);
  const s = smoother(19.6, END, lt);
  const dv = diveView(Math.min(lt, 20.1));
  const eye = dv.eye ? ap(dv.m, dv.eye) : [960, 540];
  const tw = lt < 20 ? 2.6 * smoother(18.4, 19.9, lt) : 2.6 * (1 - smoother(20.0, 22.1, lt));
  const cx = lerp(eye[0], 960, smoother(19.9, 20.8, lt)), cy = lerp(eye[1], 540, smoother(19.9, 20.8, lt));
  const big = lerp(1.07, 1, s) * (1 + 0.32 * (tw / 2.6));
  const m = M.place(960 + 36 * (1 - s), 540 + 24 * (1 - s), big, 0.04 * (1 - s), 1200, 700);
  const grade = [lerp(0.75, 1, day), lerp(0.26, 1, day), lerp(1.35, 1, day)];
  const tint = [lerp(0.5, 1, day), lerp(0.75, 1, day), lerp(1.12, 1, day)];
  const warp = tw > 0.002 ? { type: 'twirl', cx, cy, radius: lerp(500, 1500, smoother(18.6, 20.2, lt)), angle: tw } : undefined;
  return { m, grade, tint, warp, day };
}

export function drawMedium(R, AC, lt, mask, bright = 1) {
  const p = mediumParams(lt);
  const g = [p.grade[0], p.grade[1] * lerp(0.35, 1, bright), p.grade[2]];
  R.layer(AC.medium, p.m, { grade: g, tint: p.tint, warp: p.warp, mask });
}

// the moonlit underside of the surface (seen once the water has closed over us); `mask` = the water
export function drawSurfaceBand(R, A, lt, mask) {
  const day = smoother(20.0, 21.4, lt);
  const sink = smoother(20.02, 21.3, lt);
  if (sink >= 1) return;
  // the churned surface is shoved down into view as the lip lands, then recedes as we sink
  const y = lt < 20.02 ? lerp(-470, -150, smoother(19.6, 20.02, lt)) : lerp(-150, -760, sink);
  R.layer(A.surface, M.place(960 + 30 * Math.sin(R.t * 0.4), y, 1.0, 0.02 * Math.sin(R.t * 0.3), 1200, 0), { grade: [1, lerp(0.7, 1.1, day), 1], mask });
}

export function drawUnder(R, A, AC, lt) {
  const view = cellView(lt);
  const day = smoother(20.0, 21.4, lt);
  const fade = 1 - smoother(21.6, 22.35, lt); // transient light / particles leave before the pivot
  // the underside of the surface recedes upwards out of frame as we sink
  if (lt >= 20.02) drawSurfaceBand(R, A, lt);
  // deep water below (atmosphere): darker at the bottom, clears as the broth lights up
  const deep = 1 - smoother(20.4, 22.0, lt);
  if (deep > 0) R.rect(-20, 500, 1960, 600, [...hex('#082a34'), 0], { c1: [...hex('#062028'), 0.6 * deep], grad: 'vertical' });
  // light shafts from the surface
  if (fade > 0) {
    const sw = 0.05 * Math.sin(R.t * 0.6);
    R.layer(A.shafts, M.place(900, -120, 1.2, 0.25 + sw, 800, 0), { blend: 'add', opacity: 0.22 * day * fade, grade: [1, 1.2, 1] });
  }
  // drifting specks
  if (fade > 0) {
    const t = R.t, out = [];
    const a0 = smoothstep(19.9, 20.4, lt) * fade;
    for (const s of SPECKS) {
      const x = ((s.x + s.vx * t) % 2120 + 2120) % 2120 - 100;
      const y = ((s.y + s.vy * t) % 1280 + 1280) % 1280 - 100;
      const col = s.c < 0.5 ? [0.75, 0.95, 0.9] : [0.95, 0.9, 0.75];
      out.push([x, y, s.s, 0, col[0], col[1], col[2], 0.55 * a0 * (0.6 + 0.4 * Math.sin(t * 2 + s.ph))]);
    }
    R.particles(out, { kind: 'soft' });
  }
  // plankton drift in the broth (parallax ring; everything leaves the frame by the pivot)
  const zc = Math.hypot(view[0], view[1]);
  for (const pk of PLANKTON) {
    const g = smoothstep(pk.born, pk.born + 0.5, lt);
    if (g <= 0) continue;
    const wx = 960 + (pk.x - 960) * pk.p, wy = 540 + (pk.y - 540) * pk.p;
    const sp = ap(view, [wx + 18 * Math.sin(R.t * 0.5 + pk.rot), wy - 10 * R.t % 40]);
    const size = pk.s * zc * g;
    if (sp[0] < -200 || sp[0] > 2120 || sp[1] < -200 || sp[1] > 1280) continue;
    A.plankton.draw(R, pk.sprite, sp[0], sp[1], size * 200 / 120, pk.rot + pk.spin * R.t);
  }
  // cells grow inside the larger bubbles; bubble rings tighten onto the membranes and vanish
  const AC_ = AC;
  CELLS.forEach((c, i) => {
    const g = smoother(c.t0, c.t0 + 1.0, lt);
    const settle = smoother(20.2, 21.2, lt);
    const wp = ap(view, [c.x, c.y]);
    // before settling the bubble swirls with the vortex
    const b = { r0: 150 + i * 70, th0: i * 2.2 + 0.6, w0: 1.4, rise: 10, wob: i };
    const vp = vortex(b, lt);
    const x = lerp(vp[0], wp[0], settle), y = lerp(vp[1], wp[1], settle);
    const z = Math.hypot(view[0], view[1]);
    const cellR = 250 * c.s * z;
    const bubR = lerp(46 + 10 * (i % 3), cellR * 1.04, smoother(20.2, c.t0 + 1.0, lt));
    // bubble ring
    const ringA = smoothstep(19.85, 20.1, lt) * (1 - smoother(c.t0 + 0.7, c.t0 + 1.15, lt));
    const mem = smoother(20.2, c.t0 + 0.9, lt);
    const rim = hex(C.amber);
    if (ringA > 0.01 && bubR > 2) A.bubbles.draw(R, i % 4, x, y, bubR * 2 * 110 / 80, i, { opacity: ringA, color: [rim[0], rim[1], rim[2], 0.85 * mem], grade: [1, lerp(1, 1.2, mem), 1] });
    if (g <= 0) return;
    if (c.target) {
      // the target: exactly the pivot's cell (drawn through the camera view)
      R.push(view);
      const wx = (x - view[4]) / z, wy = (y - view[5]) / z; // back to world (rotation is ~0 near the end)
      const inv = M.inv(view);
      const w = ap(inv, [x, y]);
      PIVOT.cell.drawCell(R, AC_, w[0], w[1], c.s * easeBack(g));
      R.pop();
    } else {
      const s = c.s * easeBack(g) * z;
      const t = R.t + i * 1.3;
      const br = 1 + 0.012 * Math.sin(t * 1.7);
      R.layer(AC_.body, M.place(x, y, s * br, 0.03 * Math.sin(t * 0.5) + i, 320, 320), { tint: c.tint });
      R.layer(AC_.nucleus, M.place(x, y, s * br, -0.05 * t, 130, 130), { tint: c.tint });
    }
  });
  // free bubbles: swirl, slow, rise; the small ones pop
  const tiny = [];
  for (const b of BUBBLES) {
    if (lt < b.born) continue;
    const age = lt - b.born;
    const grow = smoothstep(0, 0.25, age), pop = 1 - smoothstep(b.life * 0.8, b.life, age);
    const k = grow * pop * fade;
    if (k <= 0.01) continue;
    const [x, y] = vortex(b, lt);
    const rr = b.size * k * lerp(1, 0.7, smoother(20.5, 22, lt));
    if (x < -60 || x > 1980 || y < -60 || y > 1140) continue;
    if (rr < 5) tiny.push([x, y, rr, 0, 0.92, 0.98, 0.96, 0.6 * k]);
    else A.bubbles.draw(R, b.sprite, x, y, rr * 2 * 110 / 80, b.wob);
  }
  if (tiny.length) R.particles(tiny, { kind: 'soft' });
}
function easeBack(t) {
  const s = 0.6;
  return t <= 0 ? 0 : t >= 1 ? 1 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
}
