// LAND — living detail: pterosaurs, dragonflies, a small herd of ornithopods, light shafts,
// pollen, low mist, footfall dust. All pure functions of time.
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, ease, noise1, T, BEAT, crSpline, h01, rampInt } from './util.js';
import { fieldStrokes, contour, clipTo } from './paintkit.js';
import { defineLandBrushes } from './brushes.js';
import { groundV } from './forest.js';
import { FALLS } from './dino.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];

// ------------------------------------------------------------------------------------------------
export function paintLife(P) {
  defineLandBrushes(P.brush);
  const A = {};
  // pterosaur body (side view, flying right): shoulder at (80, 34) of a 200x60 layer
  A.pteroBody = P.layer('landPteroBody', { w: 200, h: 60, scale: 1.5 }, (c) => {
    const body = crSpline([[30, 36], [52, 30], [80, 28], [104, 30], [122, 31], [150, 32], [194, 34], [150, 37], [120, 40], [98, 42], [74, 42], [50, 40]], 6, true);
    const crest = [[104, 30], [86, 12], [74, 6], [94, 26]];
    c.washPoly(body, '#3e4a50', 255);
    c.washPoly(crest, '#a8483a', 255);
    fieldStrokes(c, body, () => 0.03, { n: 40, len: [10, 26], brush: 'land_comb', w: [0.22, 0.36], col: (x, y, rr) => (y < 35 ? pick(rr, ['#566468', '#4a585c']) : pick(rr, ['#b8906a', '#a88262'])) });
    c.washPoly(c.blob(116, 33, 2.2, 2.2), '#140c0c', 255);
    c.strokePath([[30, 36], [14, 38], [6, 37]], 'land_contour', '#2a3438', 0.6, 0.4);
    contour(c, body, { col: '#1a2226', w: 0.7, keep: 0.9, run: [5, 12] });
  });
  // wing: spans UP from the shoulder at (40, 196); leading edge in front (+x), scalloped trailing edge
  A.pteroWing = P.layer('landPteroWing', { w: 140, h: 210, scale: 1.5 }, (c) => {
    const wing = crSpline([[40, 196], [58, 150], [74, 104], [96, 60], [120, 14], [110, 30], [84, 64], [66, 96], [46, 128], [22, 160], [6, 196]], 8, false);
    const poly = wing.concat([[20, 204], [40, 204]]);
    c.washPoly(poly, '#56626a', 255);
    fieldStrokes(c, poly, (x, y) => -1.2, { trim: true, n: 70, len: [20, 50], brush: 'land_comb', w: [0.25, 0.45], col: (x, y, rr) => pick(rr, ['#66747a', '#4c585e', '#7a8686', '#9a8272']) });
    // arm bone along the leading edge + finger to the tip
    c.strokePath([[40, 196], [58, 150], [74, 104], [96, 60], [120, 14]], 'land_contour', '#262e32', 1.2, 0.5);
    for (let k = 0; k < 5; k++) c.strokePath([[62 + k * 8, 140 - k * 22], [30 + k * 12, 168 - k * 22]], 'wire', '#3a4448', 0.5, 0.4);
    clipTo(c, poly, [0, 0, 140, 210]);
    contour(c, wing.slice(40), { col: '#262e32', w: 0.6, keep: 0.75, run: [5, 10], closed: false });
  });
  // ornithopod (side view facing right), horizontal body balanced over the hips, stiff tail,
  // S-neck, small head. Hip at (100, 62) of a 260x120 layer.
  A.orniBody = P.layer('landOrniBody', { w: 260, h: 120, scale: 1.3 }, (c) => {
    const body = crSpline([[2, 58], [40, 54], [76, 48], [104, 44], [134, 44], [160, 50], [176, 42], [186, 26], [198, 16], [214, 12], [230, 14], [240, 20], [236, 26], [220, 28], [204, 30], [194, 44], [184, 62], [160, 78], [128, 84], [100, 82], [76, 72], [44, 64]], 5, true);
    c.washPoly(body, '#8a7a3e', 255);
    fieldStrokes(c, body, (x, y) => (x > 170 ? -0.9 : 0.02), { n: 110, len: [8, 22], brush: 'land_comb', w: [0.2, 0.34], col: (x, y, rr) => (y > 66 ? pick(rr, ['#d8c48a', '#c8b47a']) : pick(rr, ['#9a8a4a', '#7a6a32', '#a89854'])) });
    for (let k = 0; k < 7; k++) c.strokePath([[74 + k * 13, 50], [72 + k * 13, 66]], 'land_comb', '#5a4a22', 0.24, 0.4);
    c.washPoly(c.blob(222, 18, 2.2, 2.2), '#1a1008', 255);
    c.strokePath([[228, 24], [238, 23]], 'wire', '#3a3014', 0.5, 0.4);
    contour(c, body, { col: '#3a3014', w: 0.65, keep: 0.85, run: [5, 12] });
    // arm
    c.strokePath([[168, 66], [176, 80], [184, 86]], 'land_contour', '#5a4a22', 1.1, 0.4);
  });
  // ornithopod leg: thigh + shin + foot, hip at (20, 8), 50x80
  A.orniLeg = P.layer('landOrniLeg', { w: 50, h: 80, scale: 1.3 }, (c) => {
    const leg = crSpline([[10, 2], [32, 2], [34, 24], [26, 44], [28, 64], [42, 72], [18, 74], [16, 64], [12, 44], [8, 22]], 5, true);
    c.washPoly(leg, '#7a6a32', 255);
    fieldStrokes(c, leg, () => Math.PI / 2, { n: 24, len: [6, 14], brush: 'land_comb', w: [0.15, 0.25], col: (x, y, rr) => pick(rr, ['#8a7a3e', '#6a5a28']) });
    contour(c, leg, { col: '#3a3014', w: 0.55, keep: 0.9, run: [4, 8] });
  });
  // dragonfly body (tiny): 60x20, origin at the thorax (18, 10)
  A.dragon = P.layer('landDragonfly', { w: 60, h: 20, scale: 2 }, (c) => {
    c.strokePath([[18, 10], [34, 10.5], [50, 11], [58, 11.5]], 'land_leaf', '#1f7a8a', 0.55, 0.5);
    c.washPoly(c.blob(16, 10, 4, 3.4), '#2a4a6a', 255);
    c.washPoly(c.blob(10, 9.5, 3, 3), '#1a3a4a', 255);
    c.strokePath([[20, 9.3], [48, 9.8]], 'wire', '#8ae0e8', 0.5, 0.5);
  });
  // soft mist band (atmosphere)
  A.mist = P.layer('landMist', { w: 3000, h: 400, scale: 0.4 }, (c) => {
    const r = c.r;
    for (let i = 0; i < 28; i++) c.fillPoly(c.blob(r(0, 3000), r(150, 280), r(160, 380), r(30, 70), { wobble: 0.2 }), pick(r, ['#e4ecd8', '#d8e6d0', '#eef2e2']), { opacity: 45, bleed: 0.2, texture: 0.6, border: 0.03 });
    for (let i = 0; i < 90; i++) {
      const x = r(0, 3000), y = r(170, 260), l = r(80, 240);
      c.strokePath([[x, y], [x + l, y + r(-6, 6)]], 'land_glaze', pick(r, ['#eef2e2', '#e2ead6']), r(0.6, 1.0), 0.5);
    }
  });
  return A;
}

// ------------------------------------------------------------------------------------------------
// pterosaurs
// ------------------------------------------------------------------------------------------------
const PTEROS = [
  { d: 3.0, t0: 2.6, t1: 7.0, x0: -260, x1: 2250, y: 220, s: 0.9, f: 1.5, ph: 0.3 },
  { d: 2.5, t0: 4.3, t1: 7.4, x0: 2260, x1: -300, y: 330, s: 1.05, f: 1.35, ph: 1.7 },
  { d: 4.2, t0: 3.4, t1: 7.6, x0: -200, x1: 2200, y: 150, s: 0.7, f: 1.7, ph: 2.9 },
];
export function drawPteros(R, A, lt, plane) {
  for (const p of PTEROS) {
    if (lt < p.t0 || lt > p.t1) continue;
    const u = (lt - p.t0) / (p.t1 - p.t0);
    // after the meteor appears they veer and climb away (panic)
    const panic = smoothstep(T.streak, T.streak + 0.8, lt);
    const x = lerp(p.x0, p.x1, u);
    const dir = p.x1 > p.x0 ? 1 : -1;
    const ph = lt * TAU * p.f * (1 + 0.5 * panic) + p.ph;
    const y = p.y + 16 * Math.sin(u * 7 + p.ph) - 6 * Math.cos(ph) - 260 * panic * panic;
    const flap = Math.cos(ph);                      // 1 = wings up, -1 = wings down
    const pitch = 0.05 * Math.sin(ph) - 0.2 * panic;
    plane(p.d, () => {
      const base = M.chain(M.translate(x, y), M.scale(p.s * dir, p.s), M.rotate(pitch));
      const wing = (far) => {
        const sy = (far ? 0.75 : 1) * (0.25 + 0.75 * Math.abs(flap)) * Math.sign(flap || 1);
        const bend = (far ? -0.1 : 0.1) + 0.25 * Math.sin(ph);   // wing sweeps back on the downstroke
        R.layer(A.pteroWing, M.chain(base, M.translate(far ? 8 : 0, far ? -2 : 0), M.rotate(bend * Math.sign(sy)), M.scale(0.72, 0.72 * sy), M.translate(-40, -196)), { grade: [1, far ? 0.7 : 1, 1] });
      };
      wing(true);
      R.layer(A.pteroBody, M.chain(base, M.translate(-80, -34)));
      wing(false);
    });
  }
}

// ------------------------------------------------------------------------------------------------
// ornithopod herd in the meadow beyond the stream (d = 2.0): graze, look up, flee left
// ------------------------------------------------------------------------------------------------
const HERD = [
  { x: 700, s: 0.6, ph: 0.2, lag: 0.0 },
  { x: 820, s: 0.52, ph: 1.9, lag: 0.12 },
  { x: 930, s: 0.64, ph: 3.1, lag: 0.25 },
  { x: 1350, s: 0.5, ph: 4.4, lag: 0.05 },
];
export function drawHerd(R, A, lt, plane, look = {}) {
  const d = 2.0, gy = groundV(d) + 4;
  plane(d, () => {
    for (const h of HERD) {
      const flee = smoothstep(T.streak + 0.35 + h.lag, T.streak + 0.9 + h.lag, lt);
      // slow wander before, then accelerate into a sprint to the left and keep running out of frame
      const x = h.x + 18 * Math.sin(lt * 0.35 + h.ph) + 22 * lt * 0.2 - 820 * rampInt(lt - (T.streak + 0.35 + h.lag), 0.9);
      if (x < -300) continue;
      const cyc = lt * (1.6 + 4.5 * flee) + h.ph;
      const bob = Math.abs(Math.sin(cyc * Math.PI)) * (2 + 6 * flee);
      const graze = (1 - smoothstep(T.streak - 0.4, T.streak + 0.2, lt)) * (0.5 + 0.5 * Math.sin(lt * 0.9 + h.ph));
      const dir = flee > 0.5 ? -1 : 1;
      const base = M.chain(M.translate(x, gy - 74 * h.s - bob * h.s), M.scale(h.s * dir, h.s));
      const legA = Math.sin(cyc * Math.PI) * (0.35 + 0.45 * flee);
      R.particles([[x, gy + 1, 60 * h.s, 0, 0.12, 0.2, 0.16, 0.3]], { kind: 'soft' });
      R.layer(A.orniLeg, M.chain(base, M.rotate(-legA), M.translate(-20, -8)), { ...look, grade: [0.9, 0.78, 1] });
      // body pitches forward to graze, rears up a little when startled
      R.layer(A.orniBody, M.chain(base, M.rotate(0.28 * graze - 0.12 * flee), M.translate(-100, -62)), look);
      R.layer(A.orniLeg, M.chain(base, M.rotate(legA), M.translate(-20, -8)), look);
    }
  });
}

// ------------------------------------------------------------------------------------------------
// dragonflies over the stream and ferns
// ------------------------------------------------------------------------------------------------
const FLIES = [
  { d: 1.15, cx: 1250, cy: 760, rx: 180, ry: 60, f: 0.23, ph: 0.4 },
  { d: 0.92, cx: 360, cy: 820, rx: 140, ry: 50, f: 0.31, ph: 2.2 },
  { d: 1.3, cx: 1500, cy: 700, rx: 120, ry: 40, f: 0.27, ph: 4.1 },
];
export function drawFlies(R, A, lt, plane, alive) {
  if (alive <= 0) return;
  for (const f of FLIES) {
    // darting: smooth wander with occasional quick hops (value-noise driven)
    const tt = lt * f.f * TAU;
    const hop = Math.floor(lt * 1.3 + f.ph), hf = (lt * 1.3 + f.ph) % 1;
    const jx = lerp(h01(hop, 3) - 0.5, h01(hop + 1, 3) - 0.5, ease.inOutCubic(clamp(hf * 4)));
    const jy = lerp(h01(hop, 7) - 0.5, h01(hop + 1, 7) - 0.5, ease.inOutCubic(clamp(hf * 4)));
    const x = f.cx + f.rx * (Math.sin(tt + f.ph) * 0.5 + jx * 1.4), y = f.cy + f.ry * (Math.sin(tt * 1.7 + f.ph) * 0.4 + jy * 1.2);
    const vx = Math.cos(tt + f.ph);
    plane(f.d, () => {
      R.layer(A.dragon, M.chain(M.translate(x, y), M.scale(vx > 0 ? -0.8 : 0.8, 0.8), M.translate(-18, -10)), { opacity: alive });
      // shimmering wings
      const fl = 0.5 + 0.5 * Math.sin(lt * 95 + f.ph);
      R.particles([
        [x - 3, y - 5, 9, 0.3, 0.8, 0.95, 1, 0.35 * alive * fl], [x + 3, y - 5, 9, -0.3, 0.8, 0.95, 1, 0.35 * alive * (1 - fl)],
        [x - 6, y - 3, 7, 0.6, 0.8, 0.95, 1, 0.3 * alive * (1 - fl)], [x + 6, y - 3, 7, -0.6, 0.8, 0.95, 1, 0.3 * alive * fl],
      ], { kind: 'soft', blend: 'add' });
    });
  }
}

// ------------------------------------------------------------------------------------------------
// light shafts + pollen (before the impact)
// ------------------------------------------------------------------------------------------------
const POLLEN = (() => {
  const r = rng('land-pollen');
  return Array.from({ length: 260 }, () => ({ x: r(-100, 2000), y: r(80, 900), s: r(1.2, 3.2), f: r(0.2, 0.6), ph: r(0, TAU), sh: r(0, 1) }));
})();
export function drawShafts(R, lt, plane, k) {
  if (k <= 0) return;
  plane(1.6, () => {
    const shafts = [[1450, 120, 0.42, 1.0], [1150, 90, 0.5, 0.75], [1720, 180, 0.38, 0.8], [880, 60, 0.55, 0.6]];
    for (const [x, y, rot, w] of shafts) {
      const br = 0.055 * w * k * (0.8 + 0.2 * Math.sin(lt * 0.7 + x));
      R.glow(x - 220, y + 380, 260, [1, 0.97, 0.82], br, { shape: [0.9, 0.3, 1.2], ext: 2.5, sx: 0.35, sy: 2.6, rot: rot });
    }
  });
  const out = [];
  for (const p of POLLEN) {
    const x = p.x + 30 * Math.sin(lt * p.f + p.ph) + 8 * lt;
    const y = p.y + 20 * Math.sin(lt * p.f * 1.3 + p.ph * 2) - 6 * lt;
    const tw = 0.5 + 0.5 * Math.sin(lt * (1 + p.sh * 2) + p.ph);
    out.push([x, y, p.s, 0, 1, 0.96, 0.8, 0.5 * tw * k]);
  }
  plane(1.4, () => R.particles(out, { kind: 'glow', blend: 'add' }));
}

// ------------------------------------------------------------------------------------------------
// footfall dust puffs at the dinosaur's feet (plane d = 1)
// ------------------------------------------------------------------------------------------------
const DUST = (() => { const r = rng('land-footdust'); return Array.from({ length: 22 }, () => ({ a: r(-0.6, 0.6) + (r() < 0.5 ? 0 : Math.PI), v: r(20, 70), up: r(8, 30), s: r(3, 8), life: r(0.5, 1.1), c: r() })); })();
export function footDust(lt, P) {
  const out = [];
  for (const s of FALLS) {
    const x = lt - s.t;
    if (x < 0 || x > 1.2) continue;
    for (const f of s.feet) {
      const L = P.legs[f];
      const fx = L.ankle[0] + 10, fy = L.ankle[1] + 20;
      for (const p of DUST) {
        if (x > p.life) continue;
        const k = x / p.life;
        const px = fx + Math.cos(p.a) * p.v * x * (1 - 0.5 * k), py = fy - p.up * Math.sin(Math.PI * Math.min(1, k * 1.2)) - 4;
        const col = hex(mixHex('#8a7a58', '#c8b890', p.c));
        out.push([px, py, p.s * (0.6 + 0.8 * k), 0, col[0], col[1], col[2], 0.55 * (1 - k) * (f < 2 ? 1 : 0.5)]);
      }
    }
  }
  return out;
}
