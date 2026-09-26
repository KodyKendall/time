// SEA — creature rig: spine curve + width profile + fins/limbs, morphing embryo -> fish -> tetrapod.
// All geometry in world units; pure functions of a pose object.
import { TAU, lerp, clamp, ease, smoothPath, resampleClosed } from './lib.js';

// Width profiles (units of L): [s, dorsal, ventral]
const FISH = [[0, 0, 0], [0.015, 0.06, 0.05], [0.05, 0.12, 0.095], [0.11, 0.165, 0.13], [0.2, 0.198, 0.158], [0.3, 0.208, 0.165], [0.42, 0.198, 0.157], [0.56, 0.165, 0.125], [0.7, 0.11, 0.085], [0.82, 0.062, 0.05], [0.91, 0.04, 0.035], [1, 0.036, 0.032]];
const TET = [[0, 0, 0], [0.012, 0.035, 0.032], [0.05, 0.07, 0.058], [0.1, 0.088, 0.074], [0.16, 0.084, 0.07], [0.24, 0.1, 0.09], [0.4, 0.108, 0.1], [0.55, 0.1, 0.092], [0.7, 0.072, 0.064], [0.84, 0.042, 0.038], [0.94, 0.02, 0.018], [1, 0.006, 0.006]];
const EMB = [[0, 0, 0], [0.02, 0.09, 0.08], [0.07, 0.17, 0.15], [0.14, 0.21, 0.19], [0.25, 0.23, 0.21], [0.4, 0.22, 0.2], [0.55, 0.19, 0.17], [0.7, 0.14, 0.12], [0.82, 0.09, 0.08], [0.92, 0.05, 0.045], [1, 0.03, 0.028]];
function prof(tab, s) {
  if (s <= 0) return [tab[0][1], tab[0][2]];
  for (let i = 1; i < tab.length; i++) {
    if (s <= tab[i][0]) {
      const a = tab[i - 1], b = tab[i], u = (s - a[0]) / (b[0] - a[0]);
      const e = u * u * (3 - 2 * u);
      // snout: round the first segment
      const f = i === 1 ? Math.sqrt(u) : e;
      return [lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
    }
  }
  const z = tab[tab.length - 1];
  return [z[1], z[2]];
}
export function widths(pose, s) {
  const f = prof(FISH, s), t = prof(TET, s), e = prof(EMB, s);
  const m = pose.m, em = pose.emb;
  let wd = lerp(lerp(f[0], t[0], m), e[0], em), wv = lerp(lerp(f[1], t[1], m), e[1], em);
  // breathing / gulping
  const br = 1 + (pose.breath || 0) * Math.sin(s * 3);
  return [wd * pose.L * br, wv * pose.L * br];
}

export const NS = 56; // spine samples
// Spine: [{x, y, a (tangent angle, pointing to the head), s}]
export function spine(pose) {
  const out = [];
  const ds = pose.L / (NS - 1);
  let x = pose.x, y = pose.y;
  for (let i = 0; i < NS; i++) {
    const s = i / (NS - 1);
    const env = 0.1 + 0.9 * s * s;
    const wave = pose.A * env * Math.sin(TAU * pose.k * s - pose.ph);
    const a = pose.th + pose.curl * s + wave + (pose.bend ? pose.bend(s) : 0);
    out.push({ x, y, a, s });
    x -= Math.cos(a) * ds;
    y -= Math.sin(a) * ds;
  }
  return out;
}
// Body point at (s, v): v in [-1, 1] (-1 = dorsal edge, +1 = ventral edge).
export function bodyPt(pose, sp, s, v) {
  const f = clamp(s) * (NS - 1);
  const i = Math.min(NS - 2, Math.floor(f)), u = f - i;
  const A = sp[i], B = sp[i + 1];
  const x = lerp(A.x, B.x, u), y = lerp(A.y, B.y, u);
  const a = lerp(A.a, B.a, u);
  const [wd, wv] = widths(pose, s);
  const w = v < 0 ? wd * v : wv * v;
  return [x - Math.sin(a) * w, y + Math.cos(a) * w, a];
}
// Closed body outline (dorsal from snout to tail, ventral back to snout).
export const S_NOSE = 0.03;
export function outline(pose, sp, n = 48) {
  const top = [], bot = [];
  for (let k = 0; k <= n; k++) {
    const s = S_NOSE + (1 - S_NOSE) * Math.pow(k / n, 1.15);
    top.push(bodyPt(pose, sp, s, -1));
    bot.push(bodyPt(pose, sp, s, 1));
  }
  // rounded nose: half-ellipse from the ventral to the dorsal edge, bulging forwards
  const [x0, y0, a0] = bodyPt(pose, sp, S_NOSE, 0);
  const [wd0, wv0] = widths(pose, S_NOSE);
  const bulge = pose.L * lerp(0.035, 0.03, pose.m);
  const cap = [];
  for (let k = 1; k < 10; k++) {
    const ph = Math.PI / 2 - (k / 10) * Math.PI; // +90 (ventral) .. -90 (dorsal)
    const w = ph > 0 ? wv0 : wd0;
    const f = Math.cos(ph) * bulge, v = Math.sin(ph) * w;
    cap.push([x0 + Math.cos(a0) * f - Math.sin(a0) * v, y0 + Math.sin(a0) * f + Math.cos(a0) * v]);
  }
  return top.map((p) => [p[0], p[1]]).concat(bot.reverse().map((p) => [p[0], p[1]]), cap);
}

// Frame at body point: returns function mapping local (fx, fy) (units of L; fx backwards along body,
// fy ventral) to world.
export function frameAt(pose, sp, s, v) {
  const [x, y, a] = bodyPt(pose, sp, s, v);
  const ca = Math.cos(a), sa = Math.sin(a), L = pose.L;
  return (fx, fy) => [x - ca * fx * L - sa * fy * L, y - sa * fx * L + ca * fy * L];
}

// ---------------------------------------------------------------- fins & limbs (local shapes)
// Local coords: x backwards along the body, y ventral (units of L). Returned as closed polygons.
function rot(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
// Pectoral fin: fan-shaped paddle hinged at the base, flap angle f.
export function pecFin(size, flap) {
  const pts = [];
  const base = [[-0.012, -0.012], [0.012, 0.012]];
  const M = 22;
  for (let k = 0; k <= M; k++) {
    const u = k / M;
    const a = lerp(-0.25, 1.15, u) + flap;
    const r = size * (0.62 + 0.38 * Math.sin(Math.PI * u)) * (1 - 0.18 * u);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return [base[0], ...pts, base[1]];
}
// Leg (local coords, units of L): shoulder at origin; angles in local frame (x back, y ventral).
// sh: swing (+ = backwards), el: elbow bend, ft: foot pitch. Returns bones + a closed outline.
export function legShape(len, sh, el, ft, thick) {
  const a1 = Math.PI / 2 - 0.55 - sh; // upper arm points down and forwards
  const e = [Math.cos(a1) * len * 0.5, Math.sin(a1) * len * 0.5];
  const a2 = a1 + 0.75 + el;          // forearm bends back down
  const w = [e[0] + Math.cos(a2) * len * 0.42, e[1] + Math.sin(a2) * len * 0.42];
  const a3 = a2 - 1.35 + ft;          // foot points forwards along the ground
  const toe = [w[0] + Math.cos(a3) * len * 0.3, w[1] + Math.sin(a3) * len * 0.3];
  const bones = [[0, 0, 1], [e[0], e[1], 0.78], [w[0], w[1], 0.62], [toe[0], toe[1], 0.5]];
  const sm = smoothPath(bones, 5);
  return { bones, e, w, toe, a3, sm };
}
// Stubby limb outline with a paddle foot and toes (local coords, units of L).
export function limbOutline(lg, w0 = 0.05, w1 = 0.034, w2 = 0.027, foot = 0.07) {
  const S = [0, 0], E = lg.e, W = lg.w;
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; return [-dy / d, dx / d]; };
  const n1 = nrm(S, E), n2 = nrm(E, W);
  const nE = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
  const fa = lg.a3; // foot direction
  const front = [[S[0] + n1[0] * w0, S[1] + n1[1] * w0], [E[0] + nE[0] * w1, E[1] + nE[1] * w1], [W[0] + n2[0] * w2, W[1] + n2[1] * w2]];
  const back = [[W[0] - n2[0] * w2, W[1] - n2[1] * w2], [E[0] - nE[0] * w1, E[1] - nE[1] * w1], [S[0] - n1[0] * w0, S[1] - n1[1] * w0]];
  // toes fan: ordered from the front edge side around to the back edge side
  const toes = [];
  const side = Math.cos(fa) * n2[1] - Math.sin(fa) * n2[0] > 0 ? 1 : -1; // is the front edge ccw of the foot?
  const spread = [-0.55, -0.2, 0.15, 0.5].map((k) => k * side);
  spread.forEach((k, i) => {
    const a = fa - k;
    toes.push([W[0] + Math.cos(a) * foot, W[1] + Math.sin(a) * foot]);
    if (i < 3) { const an = fa - (k + spread[i + 1]) / 2; toes.push([W[0] + Math.cos(an) * foot * 0.72, W[1] + Math.sin(an) * foot * 0.72]); }
  });
  return front.concat(toes, back);
}
// Resample a closed local shape to n points starting nearest to angle `a0` from its centroid.
export function normShape(pts, n = 24) {
  return resampleClosed(pts, n);
}
// Map a local shape through a frame function.
export const mapShape = (pts, F) => pts.map((p) => F(p[0], p[1]));
export { rot };
