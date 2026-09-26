// SEA — per-frame painting of the creature (fish -> tetrapod) in near-screen space.
// Painter's order: watercolour underpainting -> tonal masses -> strokes that follow the form (defined
// once in BODY space and mapped through the rig) -> scales/stripes -> head details -> lost-and-found
// contour -> near fins/limbs -> close-up skin around the eye.
import { C } from '../lib/palette.js';
import { M, TAU, lerp, clamp, ease, rng, mixHex, capsule, resampleClosed, lerpPoly } from './lib.js';
import { spine, bodyPt, outline, widths, frameAt, pecFin, legShape, limbOutline, S_NOSE } from './rig.js';
import { eyeOf } from './creature.js';
import { inPoly } from './paintkit.js';

export const COL = {
  body: '#e0553a', body2: '#e8622c', back: '#a63a2a', back2: '#7a2a2e', belly: '#f08a4a', belly2: '#f6b36a',
  stripe: '#f3e6c8', stripe2: '#f6d58e', fin: '#11606a', finRay: '#9be8de', dorsal: '#c23a2a', dorsalRay: '#f6d58e',
  tail: '#8a2f5f', tail2: '#c05a8a', tailRay: '#f3c8b0', contour: '#3a1022', scale: '#9a3424', scaleHi: '#f7a868',
  gill: '#6a1a22', leg: '#d24a30', leg2: '#8a2f2a', legHi: '#f59b5a', claw: '#f3e6c8', lid: '#b8402e', lid2: '#7a2426',
};
// ---------------------------------------------------------------- body-space stroke library
const LIB = (() => {
  const r = rng('sea-fish-strokes');
  const out = { comb: [], wrap: [], dry: [], hi: [], scales: [], specks: [] };
  const bandCol = (v, r) => {
    if (v < -0.55) return r.pick([COL.back, COL.back2, '#b8452e', '#8a3030', '#c24a30']);
    if (v < -0.1) return r.pick([COL.body, COL.body2, '#d0482e', '#f07a3a', '#c9402e']);
    if (v < 0.45) return r.pick([COL.body2, '#f07a3a', COL.belly, '#e06a30', '#f59b3d']);
    return r.pick([COL.belly, COL.belly2, '#f6b870', '#e88a50', '#fbd08a']);
  };
  for (let i = 0; i < 34; i++) {
    const v = r(-0.92, 0.92), s0 = r(0.04, 0.8), s1 = Math.min(0.99, s0 + r(0.12, 0.3));
    out.comb.push({ v, s0, s1, col: bandCol(v, r), w: r(0.8, 1.5), wob: r(-0.1, 0.1) });
  }
  // strokes that wrap around the body (across it), showing its roundness
  for (let i = 0; i < 36; i++) {
    const s = r(0.08, 0.92), v0 = r(-0.95, 0.2), v1 = Math.min(0.97, v0 + r(0.35, 0.8));
    out.wrap.push({ s, v0, v1, lean: r(0.01, 0.035), col: bandCol((v0 + v1) / 2, r), w: r(0.7, 1.25) });
  }
  for (let i = 0; i < 16; i++) {
    const v = r(-0.9, 0.9), s0 = r(0.05, 0.9), s1 = Math.min(0.99, s0 + r(0.05, 0.14));
    out.dry.push({ v, s0, s1, col: mixHex(bandCol(v, r), '#2a0a10', r(0.15, 0.4)), w: r(0.3, 0.55), wob: r(-0.05, 0.05) });
  }
  for (let i = 0; i < 12; i++) {
    const v = r(-0.97, -0.62), s0 = r(0.06, 0.62), s1 = Math.min(0.95, s0 + r(0.06, 0.2));
    out.hi.push({ v, s0, s1, col: r.pick(['#f6d58e', '#fbe7b0', '#f59b3d', '#ffd9a8']), w: r(0.3, 0.5), wob: 0 });
  }
  for (let j = 0; j < 16; j++) out.scales.push({ s: 0.2 + j * 0.043, n: 7, amp: 0.02 + 0.004 * Math.sin(j) });
  for (let i = 0; i < 70; i++) out.specks.push({ s: r(0.05, 0.9), v: r(-0.9, 0.9), sz: r(0.004, 0.009), col: r.pick(['#7a2a2e', '#f6d58e', '#a63a2a', '#fbe7b0']) });
  return out;
})();
// Close-up skin around the eye: rings of small scales (tubercles), in eye-radius units.
const EYE_SKIN = (() => {
  const r = rng('sea-eye-skin');
  const out = [];
  const rings = [[1.34, 0.19], [1.6, 0.22], [1.92, 0.26]];
  rings.forEach(([rad, sz], k) => {
    const n = Math.round((TAU * rad) / (sz * 1.05));
    const off = r(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU + r(-0.04, 0.04);
      out.push({ k, a, rad: rad + r(-0.04, 0.04), sz: sz * r(0.85, 1.1), rot: a + r(-0.3, 0.3), col: r(), hi: r() });
    }
  });
  return out;
})();

// Close-up micro texture around the eye: wrinkle arcs, radial creases, speckles (eye-radius units).
const EYE_MICRO = (() => {
  const r = rng('sea-eye-micro');
  const arcs = [], creases = [], specks = [];
  for (let i = 0; i < 70; i++) {
    const rad = r(1.12, 1.75), a0 = r(0, TAU), len = r(0.25, 0.8);
    arcs.push({ rad, a0, a1: a0 + len, col: r.pick(['#8a2a26', '#f7a868', '#b8402e', '#fbd08a', '#6a1e22']), w: r(0.5, 1.1) });
  }
  for (let i = 0; i < 60; i++) {
    const a = r(0, TAU), r0 = r(1.35, 2.2), r1 = r0 + r(0.3, 0.9), bend = r(-0.12, 0.12);
    creases.push({ a, r0, r1, bend, col: r.pick(['#8a2a26', '#a63a2a', '#f59b5a', '#6a1e22']), w: r(0.4, 0.9) });
  }
  for (let i = 0; i < 160; i++) specks.push({ a: r(0, TAU), rad: r(1.3, 4.6), sz: r(0.02, 0.06), col: r.pick(['#7a2a2e', '#fbd08a', '#a63a2a', '#f6d58e', '#5a1a1e']) });
  return { arcs, creases, specks };
})();

const wz = (z) => (z < 2 ? z : Math.min(3, 2 * Math.sqrt(z / 2)));

// Static watercolour granulation for the skin (multiplied over the base pass through its silhouette).
// Local frame: x along the body from the snout (x = 60) to the tail, y across (centre 360).
export const SKIN = { w: 1500, h: 720, sx: 60, sy: 360 };
export function paintSkin(P) {
  return P.layer('skin', { w: SKIN.w, h: SKIN.h, scale: 0.75 }, (c) => {
    const r = c.r;
    c.washPoly([[-10, -10], [SKIN.w + 10, -10], [SKIN.w + 10, SKIN.h + 10], [-10, SKIN.h + 10]], '#ffffff', 255);
    for (let i = 0; i < 46; i++) {
      c.fillPoly(c.blob(r(40, SKIN.w - 40), r(40, SKIN.h - 40), r(50, 200), r(30, 110), { rot: r(-0.3, 0.3), wobble: 0.25 }), r.pick(['#ecc8b6', '#dcae9c', '#f3dccd', '#cf9a88', '#e7b8a4', '#f6e2d0']), { opacity: r(50, 110), bleed: 0.08, texture: 0.9, border: 0.2 });
    }
    for (let i = 0; i < 150; i++) {
      const x = r(0, SKIN.w), y = r(0, SKIN.h), len = r(60, 260), a = r(-0.12, 0.12);
      c.strokePath([[x, y], [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 + r(-6, 6)], [x + Math.cos(a) * len, y + Math.sin(a) * len]], r() < 0.5 ? 'sea_dry' : 'sea_comb', r.pick(['#e2bfae', '#d4a592', '#efd3c2', '#c8907e']), r(0.3, 0.7), 0.5);
    }
    for (let i = 0; i < 40; i++) {
      const x = r(0, SKIN.w), y = r(0, SKIN.h);
      c.strokePath([[x, y], [x + r(40, 120), y + r(-20, 20)]], 'sea_speck', r.pick(['#b8806e', '#c8907e']), r(0.5, 1), 0.5);
    }
  });
}

export function paintCreature(c, p, P, { rect = [-120, -120, 2232, 1308], pass = 'all' } = {}) {
  const BASE = pass !== 'top', TOP = pass !== 'base';
  const z = M.scaleOf(P), zw = wz(z), Lk = p.L / 1000;
  const K = zw * Lk; // stroke weight factor
  const sp = spine(p);
  const Wp = (pts) => pts.map((q) => { const a = M.apply(P, q[0], q[1]); return q.length > 2 ? [a[0], a[1], q[2]] : a; });
  const vis = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return x1 > rect[0] && x0 < rect[2] && y1 > rect[1] && y0 < rect[3];
  };
  const B = (s, v) => bodyPt(p, sp, s, v);
  const L = p.L, fu = p.fins, m = p.m, pu = p.paintU;
  const me = ease.inOutSine(m);
  const stroke = (pts, brush, col, w, curv = 0.5) => { const q = Wp(pts); if (vis(q)) c.strokePath(q, brush, col, w, curv); };

  // ---------------- limbs: fin (fish) morphing into a stubby paddle-footed leg (tetrapod)
  const gait = p.gait, walk = p.walk;
  const flap = (ph) => 0.3 * Math.sin(p.ph * 0.5 + ph) * (1 - m);
  const legAngles = (ph) => ({
    sh: 0.5 * Math.sin(gait + ph) * walk - 0.15 * (1 - walk),
    el: 0.2 + 0.45 * Math.max(0, -Math.cos(gait + ph)) * walk,
    ft: 0.25 * Math.sin(gait + ph + 0.6) * walk,
  });
  const limb = (s, v, size, ph, far, legLen) => {
    const F = frameAt(p, sp, s, v);
    const fin = resampleClosed(pecFin(size * fu, flap(ph) + (far ? -0.2 : 0)), 34);
    let loc = fin, lg = null;
    if (m > 0.001) {
      const la = legAngles(ph + (far ? Math.PI : 0));
      lg = legShape(legLen, la.sh, la.el, la.ft, 1);
      const leg = resampleClosed(limbOutline(lg, 0.052 * legLen / 0.17, 0.036 * legLen / 0.17, 0.028 * legLen / 0.17, 0.068 * legLen / 0.17), 34);
      loc = lerpPoly(fin, leg, me);
    }
    return { poly: loc.map((q) => F(q[0], q[1])), F, lg };
  };
  const limbCol = (far) => mixHex(mixHex(COL.fin, COL.leg, me), '#101828', far ? 0.38 : 0);
  const paintLimb = (L0, far, size, ph) => {
    const q = Wp(L0.poly);
    if (!vis(q)) return;
    c.washPoly(q, limbCol(far), 250);
    const F = L0.F;
    if (m < 0.75) {
      // fin rays fanning from the base
      for (let k = 0; k < 7; k++) {
        const ang = lerp(-0.2, 1.1, k / 6) + flap(ph) + (far ? -0.2 : 0);
        const rr = size * fu * 0.95 * (0.7 + 0.3 * Math.sin((k / 6) * Math.PI)) * (1 - me);
        if (rr < 0.005) continue;
        stroke([F(0, 0), F(Math.cos(ang) * rr * 0.5, Math.sin(ang) * rr * 0.5), F(Math.cos(ang) * rr, Math.sin(ang) * rr)], 'sea_leaf', mixHex(far ? '#5a9a98' : COL.finRay, COL.legHi, me), 0.22 * K, 0.5);
      }
    }
    if (L0.lg && m > 0.25) {
      const lg = L0.lg;
      // form shading along the limb + a lit edge, then toes/claws
      stroke(lg.sm.map((b) => F(b[0] + 0.01, b[1] + 0.012)), 'sea_comb', far ? '#4a1a22' : COL.leg2, 0.3 * K * m, 0.5);
      if (!far) stroke(lg.sm.map((b) => F(b[0] - 0.014, b[1] - 0.006)), 'sea_dry', COL.legHi, 0.22 * K * m, 0.5);
      for (let k = 0; k < 4; k++) {
        const a = lg.a3 + (k - 1.5) * 0.35;
        const b0 = [lg.w[0] + Math.cos(a) * 0.045, lg.w[1] + Math.sin(a) * 0.045];
        const b1 = [lg.w[0] + Math.cos(a) * 0.072, lg.w[1] + Math.sin(a) * 0.072];
        stroke([F(b0[0], b0[1]), F(b1[0], b1[1])], 'sea_contour', far ? '#6a5a4a' : COL.claw, 0.5 * K * m, 0.4);
      }
    }
    c.strokePath(q.concat([q[0]]), 'sea_contour', COL.contour, (far ? 0.5 : 0.75) * K, 0.4);
  };
  const legLen = 0.17;
  if (fu > 0 && BASE) {
    paintLimb(limb(0.24, 0.3, 0.13, 1.2, true, legLen), true, 0.13, 1.2);
    paintLimb(limb(0.56, 0.5, 0.08, 2.4, true, legLen * 0.9), true, 0.08, 2.4);
  }
  // ---------------- tail fin (caudal) -> a small fringe on the tetrapod's tail
  const tailK = fu * (1 - 0.85 * me);
  if (tailK > 0.01 && BASE) {
    const F = frameAt(p, sp, 0.985, 0);
    const lag = 0.35 * p.A * Math.sin(TAU * p.k - p.ph - 0.9);
    const fl = 0.04 * Math.sin(p.ph * 1.3);
    const loc = [[0, -0.036], [0.07, -0.1 - fl], [0.165, -0.2], [0.13, -0.1], [0.085, -0.01], [0.13, 0.09], [0.165, 0.18 + fl], [0.07, 0.09], [0, 0.034]];
    const cs = Math.cos(lag), sn = Math.sin(lag);
    const pts = loc.map(([x, y]) => F((x * cs - y * sn) * tailK, (x * sn + y * cs) * tailK));
    const sm = resampleClosed(pts, 44);
    const q = Wp(sm);
    if (vis(q)) {
      c.washPoly(q, COL.tail, 250);
      const base = F(0, 0);
      for (let k = 0; k < 11; k++) {
        const tip = sm[Math.round(4 + (k / 10) * 36)];
        stroke([base, [lerp(base[0], tip[0], 0.5), lerp(base[1], tip[1], 0.5)], [lerp(base[0], tip[0], 0.96), lerp(base[1], tip[1], 0.96)]], 'sea_leaf', k % 2 ? COL.tailRay : '#e890b0', 0.38 * K, 0.5);
      }
      c.strokePath(q.concat([q[0]]), 'sea_contour', COL.contour, 0.7 * K, 0.4);
    }
  }
  // ---------------- dorsal fin (lowers into a ridge on land)
  const dK = fu * (1 - 0.85 * me);
  if (dK > 0.01 && BASE) {
    const n = 14, base = [], top = [];
    for (let k = 0; k <= n; k++) base.push(B(lerp(0.28, 0.58, k / n), -0.95));
    for (let k = n; k >= 0; k--) {
      const u = k / n, s = lerp(0.3, 0.62, u);
      const [x, y, a] = B(s, -1);
      const h = L * 0.13 * dK * Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 - 0.35 * u) * (1 + 0.08 * Math.sin(p.ph + u * 3));
      const back = L * 0.03 * u * dK;
      top.push([x + Math.sin(a) * h - Math.cos(a) * back, y - Math.cos(a) * h - Math.sin(a) * back]);
    }
    const poly = base.map((q) => [q[0], q[1]]).concat(top);
    const q = Wp(poly);
    if (vis(q)) {
      c.washPoly(q, COL.dorsal, 245);
      for (let k = 1; k < n; k++) stroke([base[k], top[n - k]], 'sea_leaf', k % 2 ? COL.dorsalRay : '#f59b5a', 0.4 * K, 0.5);
      c.strokePath(Wp(top), 'sea_contour', COL.contour, 0.75 * K, 0.4);
    }
  }

  // ---------------- body: underpainting, masses
  const ol = outline(p, sp, 56);
  const olS = Wp(ol);
  if (BASE) c.washPoly(olS, COL.body, 255);
  const band = (v0, v1, s0, s1, n = 26, wob = 0.05) => {
    const a = [], b = [];
    for (let k = 0; k <= n; k++) {
      const s = lerp(s0, s1, k / n);
      a.push(B(s, v0));
      b.push(B(s, v1 + wob * Math.sin(s * 17)));
    }
    return Wp(a.concat(b.reverse()).map((q) => [q[0], q[1]]));
  };
  if (BASE) {
    c.washPoly(band(-1, -0.45, S_NOSE, 0.99), COL.back, 225);
    c.washPoly(band(1, 0.38, S_NOSE + 0.02, 0.9), COL.belly, 215);
    if (pu > 0) {
      const n = 28, s0 = 0.12, s1 = lerp(0.12, 0.93, pu);
      const a = [], b = [];
      for (let k = 0; k <= n; k++) {
        const u = k / n, s = lerp(s0, s1, u);
        const taper = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.6;
        a.push(B(s, -0.36 - 0.1 * taper));
        b.push(B(s, -0.36 + 0.09 * taper + 0.03 * Math.sin(s * 20)));
      }
      c.washPoly(Wp(a.concat(b.reverse()).map((q) => [q[0], q[1]])), COL.stripe, 240);
      if (pu > 0.05) {
        const n2 = 14, a2 = [], b2 = [];
        for (let k = 0; k <= n2; k++) {
          const u = k / n2, s = lerp(0.3, lerp(0.3, 0.7, pu), u);
          const taper = Math.sin(Math.PI * u) ** 0.7;
          a2.push(B(s, 0.12 - 0.05 * taper));
          b2.push(B(s, 0.12 + 0.05 * taper));
        }
        c.washPoly(Wp(a2.concat(b2.reverse()).map((q) => [q[0], q[1]])), COL.stripe2, 225);
      }
    }
  }
  if (!TOP) return { sp, olS };
  // form-following strokes
  const along = (st) => {
    const pts = [];
    for (let k = 0; k <= 7; k++) {
      const s = lerp(st.s0, st.s1, k / 7);
      const v = clamp(st.v + st.wob * Math.sin((k / 7) * Math.PI), -0.97, 0.97);
      const q = B(s, v);
      pts.push([q[0], q[1]]);
    }
    return pts;
  };
  for (const st of LIB.wrap) {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const v = lerp(st.v0, st.v1, k / 6);
      const q = B(st.s + st.lean * Math.sin((k / 6) * Math.PI), v);
      pts.push([q[0], q[1]]);
    }
    stroke(pts, 'sea_comb', st.col, st.w * K, 0.6);
  }
  for (const st of LIB.comb) stroke(along(st), 'sea_comb', st.col, st.w * K, 0.5);
  // cream stripe strokes (the stripe washes are in the base pass)
  if (pu > 0) {
    const s0 = 0.12, s1 = lerp(0.12, 0.93, pu);
    for (let k = 0; k < 6; k++) stroke(along({ v: -0.36 + (k - 2.5) * 0.032, s0: s0 + 0.02 * k, s1: s1 - 0.03 * k, wob: 0.01 }), k % 2 ? 'sea_dry' : 'sea_comb', k % 2 ? '#fff4d8' : COL.stripe2, 0.3 * K, 0.5);
  }
  for (const st of LIB.dry) stroke(along(st), 'sea_dry', st.col, st.w * K, 0.5);
  // scale rows: scalloped columns, each with a warm highlight
  if (pu > 0) {
    const nCol = Math.round(LIB.scales.length * pu);
    for (let j = 0; j < nCol; j++) {
      const col = LIB.scales[j];
      const pts = [], hi = [];
      for (let k = 0; k <= 36; k++) {
        const v = lerp(-0.84, 0.82, k / 36);
        const bumpv = Math.abs(Math.sin((Math.PI * col.n * (v + 0.84)) / 1.66 + (j % 2) * Math.PI / 2));
        const q = B(col.s + col.amp * bumpv, v);
        pts.push([q[0], q[1]]);
        const h = B(col.s + col.amp * bumpv - 0.008, v);
        hi.push([h[0], h[1]]);
      }
      stroke(pts, 'wire', COL.scale, 1.1 * K, 0.5);
      if (j % 2 === 0) stroke(hi.slice(4, 30), 'wire', COL.scaleHi, 0.7 * K, 0.5);
    }
  }
  for (const st of LIB.hi) stroke(along(st), 'sea_dry', st.col, st.w * K, 0.5);
  for (const sk of LIB.specks) {
    const q = B(sk.s, sk.v), rr = sk.sz * L;
    if (rr * z > 9) continue; // speckles only: at close range they would become flat blobs
    const d = [];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; d.push([q[0] + Math.cos(a) * rr, q[1] + Math.sin(a) * rr * 0.8]); }
    const dq = Wp(d);
    if (vis(dq)) c.washPoly(dq, sk.col, 200);
  }
  // ---------------- head: gill cover, mouth, nostril, cheek
  const gl = (1 - me) * pu;
  if (gl > 0.02) {
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const v = lerp(-0.75, 0.8, j / 10) * gl;
        const s = 0.15 + k * 0.018 + 0.035 * (1 - (v * v) / 0.64);
        const q = B(s, v);
        pts.push([q[0], q[1]]);
      }
      stroke(pts, k ? 'wire' : 'sea_contour', k ? '#a8402e' : COL.gill, (k ? 0.7 : 1.0) * K, 0.5);
    }
  }
  {
    const pts = [];
    for (let j = 0; j <= 8; j++) {
      const u = j / 8, s = lerp(S_NOSE - 0.02, lerp(0.07, 0.13, me), u);
      const q = B(s, lerp(0.3, 0.12, me) + 0.07 * Math.sin(u * Math.PI) * (1 - u));
      pts.push([q[0], q[1]]);
    }
    stroke(pts, 'sea_contour', COL.contour, 1.0 * K, 0.5);
    const n = B(0.035, -0.35);
    const nd = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; nd.push([n[0] + Math.cos(a) * L * 0.004, n[1] + Math.sin(a) * L * 0.003]); }
    const ndq = Wp(nd);
    if (vis(ndq)) c.washPoly(ndq, COL.contour, 220);
  }
  // ---------------- broken contour (lost-and-found edges)
  {
    const r = rng('sea-fish-contour');
    const n = olS.length;
    let i = 0;
    while (i < n) {
      const len = r.int(6, 14);
      const segp = [];
      for (let k = 0; k <= len && i + k <= n; k++) segp.push(olS[(i + k) % n]);
      if (segp.length > 2 && r() < 0.8 && vis(segp)) c.strokePath(segp, 'sea_contour', COL.contour, 1.1 * K * r(0.8, 1.2), 0.4);
      i += len;
    }
  }
  // ---------------- near limbs (anal fin, pelvic, pectoral / front leg)
  if (fu > 0) {
    const aK = fu * (1 - me);
    if (aK > 0.02) {
      const a = [], b = [];
      for (let k = 0; k <= 8; k++) a.push(B(lerp(0.7, 0.84, k / 8), 0.97));
      for (let k = 8; k >= 0; k--) {
        const u = k / 8, [x, y, an] = B(lerp(0.72, 0.88, u), 1);
        const h = L * 0.06 * aK * Math.sin(Math.PI * u);
        b.push([x - Math.sin(an) * h, y + Math.cos(an) * h]);
      }
      const q = Wp(a.map((w) => [w[0], w[1]]).concat(b));
      if (vis(q)) { c.washPoly(q, COL.fin, 240); c.strokePath(q.concat([q[0]]), 'sea_contour', COL.contour, 0.6 * K, 0.4); }
    }
    paintLimb(limb(0.56, 0.78, 0.08, 0.3, false, legLen * 0.9), false, 0.08, 0.3);
    paintLimb(limb(0.22, 0.45, 0.14, 0, false, legLen), false, 0.14, 0);
  }

  // ---------------- the eye's surroundings (the painted iris itself is the pivot layer, drawn on top)
  const E = eyeOf(p, sp);
  if (E.r > 0.3) {
    const q = M.apply(P, E.x, E.y);
    const rs = E.r * z;
    const circ = (rad, n = 44, sx = 1, sy = 1, a0 = 0, a1 = TAU) => {
      const o = [];
      for (let k = 0; k <= n; k++) { const a = lerp(a0, a1, k / n); o.push([q[0] + Math.cos(a) * rad * sx, q[1] + Math.sin(a) * rad * sy]); }
      return o;
    };
    // organic (wobbly) rings
    const wob = (rad, n, a0, a1, amp, seed) => {
      const o = [];
      for (let k = 0; k <= n; k++) {
        const a = lerp(a0, a1, k / n);
        const rr = rad * (1 + amp * (0.6 * Math.sin(a * 3 + seed) + 0.4 * Math.sin(a * 7 + seed * 2)));
        o.push([q[0] + Math.cos(a) * rr, q[1] + Math.sin(a) * rr]);
      }
      return o;
    };
    // orbit: a lighter ring (fish) that swells into lids and a brow (tetrapod)
    c.washPoly(wob(rs * lerp(1.22, 1.32, me), 48, 0, TAU, 0.025, 1), mixHex('#f6c890', COL.lid, me), 250);
    c.washPoly(wob(rs * 1.075, 48, 0, TAU, 0.01, 2), '#3a1a14', 255);
    if (me > 0.01) {
      // brow ridge above, shaded lower lid below (irregular skin folds)
      const brow = wob(rs * 1.46, 30, -Math.PI * 0.97, -Math.PI * 0.03, 0.05, 3).concat(wob(rs * 1.1, 30, -Math.PI * 0.03, -Math.PI * 0.97, 0.01, 4));
      c.washPoly(brow, mixHex(COL.body, '#f7a868', 0.45), Math.round(255 * me));
      const lower = wob(rs * 1.38, 30, Math.PI * 0.08, Math.PI * 0.92, 0.05, 5).concat(wob(rs * 1.1, 30, Math.PI * 0.92, Math.PI * 0.08, 0.01, 6));
      c.washPoly(lower, COL.lid2, Math.round(220 * me));
      for (let k = 0; k < 5; k++) c.strokePath(wob(rs * (1.18 + k * 0.055), 18, -2.9 + k * 0.1, -0.3 - k * 0.12, 0.03, 7 + k), k % 2 ? 'sea_dry' : 'sea_comb', k % 2 ? '#fbd08a' : '#f59b5a', (0.3 + 0.05 * k) * K * me, 0.5);
      for (let k = 0; k < 4; k++) c.strokePath(wob(rs * (1.16 + k * 0.05), 16, 0.4 + k * 0.1, 2.7 - k * 0.1, 0.03, 12 + k), 'sea_comb', k % 2 ? '#5a1a1e' : '#8a2a26', 0.3 * K * me, 0.5);
    }
    c.strokePath(wob(rs * 1.1, 40, -2.9, -0.2, 0.012, 9), 'sea_contour', '#fbe7b0', 0.6 * K, 0.4);
    c.strokePath(wob(rs * lerp(1.24, 1.44, me), 40, 0.3, 2.9, 0.03, 10), 'sea_contour', COL.contour, 0.8 * K, 0.4);
    // close-up micro texture (only when the eye is large on screen)
    const dm = clamp((rs - 30) / 70);
    if (dm > 0) {
      const inHead = (x, y) => inPoly(olS, x, y);
      const P2 = (a, rad) => [q[0] + Math.cos(a) * rad * rs, q[1] + Math.sin(a) * rad * rs];
      const onScreen = (pts) => vis(pts) && pts.every((pt) => inHead(pt[0], pt[1]));
      for (const a of EYE_MICRO.arcs) {
        const pts = [];
        for (let k = 0; k <= 8; k++) pts.push(P2(lerp(a.a0, a.a1, k / 8), a.rad));
        if (onScreen(pts)) c.strokePath(pts, 'sea_dry', a.col, Math.max(0.25, rs / 260) * a.w * dm, 0.5);
      }
      for (const cr of EYE_MICRO.creases) {
        const pts = [];
        for (let k = 0; k <= 5; k++) { const u = k / 5; pts.push(P2(cr.a + cr.bend * Math.sin(u * Math.PI), lerp(cr.r0, cr.r1, u))); }
        if (onScreen(pts)) c.strokePath(pts, 'sea_comb', cr.col, Math.max(0.2, rs / 300) * cr.w * dm, 0.5);
      }
      for (const sk of EYE_MICRO.specks) {
        const [x, y] = P2(sk.a, sk.rad);
        const sz = sk.sz * rs;
        if (sz < 1.2 || !vis([[x, y]]) || !inHead(x, y)) continue;
        const d = [];
        for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; d.push([x + Math.cos(a) * sz, y + Math.sin(a) * sz * 0.8]); }
        c.washPoly(d, sk.col, Math.round(200 * dm));
      }
    }
    // close-up: rings of little tubercle scales around the eye, only inside the head's silhouette and
    // only once the eye is big on screen (the close-up reveals finer detail rather than fatter strokes)
    const d = clamp((rs - 45) / 90);
    if (d > 0) {
      const inside = (x, y, pad) => {
        if (!inPoly(olS, x, y)) return false;
        for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; if (!inPoly(olS, x + Math.cos(a) * pad, y + Math.sin(a) * pad)) return false; }
        return true;
      };
      for (const sc of EYE_SKIN) {
        const cx = q[0] + Math.cos(sc.a) * sc.rad * rs, cy = q[1] + Math.sin(sc.a) * sc.rad * rs * 0.98;
        const sz = sc.sz * rs * 0.52;
        if (sz < 2 || cx < rect[0] - sz || cx > rect[2] + sz || cy < rect[1] - sz || cy > rect[3] + sz) continue;
        if (!inside(cx, cy, sz * 1.1)) continue;
        const pts = [];
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU;
          const rr = sz * (1 + 0.1 * Math.sin(a * 3 + sc.hi * 5));
          pts.push([cx + Math.cos(a + sc.rot) * rr, cy + Math.sin(a + sc.rot) * rr * 0.84]);
        }
        const skin = sc.k < 2 ? mixHex(COL.lid, COL.body2, 0.3 + sc.col * 0.4) : mixHex(COL.body, sc.col < 0.5 ? '#c9402e' : COL.body2, 0.5);
        c.washPoly(pts, skin, Math.round(70 * d));
        const lit = [];
        for (let k = 0; k <= 5; k++) { const a = -2.5 + (k / 5) * 1.5; lit.push([cx + Math.cos(a) * sz * 0.66, cy + Math.sin(a) * sz * 0.56]); }
        if (sc.hi < 0.45) c.strokePath(lit, 'sea_dry', '#f7b878', Math.max(0.2, sz / 40) * d, 0.5);
        const sh = [];
        for (let k = 0; k <= 6; k++) { const a = 0.25 + (k / 6) * 2.5; sh.push([cx + Math.cos(a) * sz * 0.98, cy + Math.sin(a) * sz * 0.86]); }
        c.strokePath(sh, 'sea_contour', '#6a1e22', Math.max(0.25, sz / 34) * d, 0.4);
      }
    }
  }
  return { sp, E };
}
