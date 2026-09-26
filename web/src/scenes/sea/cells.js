// SEA — cells: the pivot cell and its descendants (1 -> 2 -> 4 -> 8 -> 16), drawn as transformed copies
// of the pivot's own painted cell layers. Everything is a pure function of local time.
import { CELL } from '../pivots.js';
import { M, TAU, lerp, clamp, invLerp, ease, rng, seg } from './lib.js';

export const R0 = CELL.r;            // 250
export const NUC_R = CELL.nucleusR;  // 96
export const C0 = [CELL.x, CELL.y];  // 960, 540
export const SCL = [1, 0.8, 0.65, 0.53, 0.44];
// Division L creates level L. st: parent starts stretching, s0: split starts, s1: split done (beat),
// set: settle (compaction) end.
export const DIV = [
  null,
  { st: 1.3, s0: 1.85, s1: 2.5, set: 3.3 },    // 55.000 first division (mitosis)
  { st: 3.0, s0: 3.3, s1: 3.75, set: 4.05 },   // 56.250
  { st: 3.9, s0: 4.05, s1: 4.375, set: 4.65 }, // 56.875
  { st: 4.5, s0: 4.65, s1: 5.0, set: 5.8 },    // 57.500
];
const GAP = 1.13; // children separate to GAP * r (a clear gap) before compacting

// ---------------------------------------------------------------- layouts (pure, precomputed)
function buildLayouts() {
  const r = rng('sea-cells-layout');
  const lv = [[{ x: 0, y: 0 }]];
  for (let L = 1; L <= 4; L++) {
    const prev = lv[L - 1], rc = R0 * SCL[L], out = [];
    prev.forEach((p, i) => {
      let axis;
      if (L === 1) axis = 0;
      else if (L === 2) axis = Math.PI / 2 + (i === 0 ? 0.3 : -0.24);
      else if (L === 3) axis = Math.atan2(p.y, p.x) + 0.15 + r(-0.2, 0.2);
      else axis = Math.atan2(p.y, p.x) + Math.PI / 2 + r(-0.3, 0.3);
      p.divAxis = axis;
      const d = rc * GAP, ca = Math.cos(axis), sa = Math.sin(axis);
      out.push({ x: p.x - ca * d, y: p.y - sa * d, parent: i, side: -1 });
      out.push({ x: p.x + ca * d, y: p.y + sa * d, parent: i, side: 1 });
    });
    const minD = rc * 1.66;
    for (let it = 0; it < 240; it++) {
      for (let a = 0; a < out.length; a++) for (let b = a + 1; b < out.length; b++) {
        const A = out[a], B = out[b];
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-3;
        if (d < minD) {
          const k = ((minD - d) / d) * 0.25;
          A.x -= dx * k; A.y -= dy * k; B.x += dx * k; B.y += dy * k;
        }
      }
      for (const A of out) { A.x *= 0.986; A.y *= 0.986; }
    }
    out.forEach((c) => { c.spin = r(-0.6, 0.6); c.ph = r(0, TAU); });
    lv.push(out);
  }
  return lv;
}
export const LAYOUT = buildLayouts();

// Inherited stretch after a split: 1 -> 0 with one soft squash overshoot, exactly 0 (and flat) at the end.
function relax(u) {
  if (u <= 0) return 1;
  if (u >= 1) return 0;
  return (1 - u) * (1 - u) * Math.cos(1.5 * Math.PI * u);
}
// Full recursive state of cell (L, i) at time t, relative to the cluster frame.
// Returns { x, y, s, spin, st: [[axis, amount], ...] }.
const _memo = new Map();
export function cellState(L, i, t) {
  const key = L * 100 + i;
  let m = _memo.get(key);
  if (m && m.t === t) return m.v;
  let v;
  if (L === 0) {
    const D1 = DIV[1];
    v = { x: 0, y: 0, s: 1, spin: 0, st: [[0, seg(t, D1.st, D1.s0, ease.inOutSine)]] };
  } else {
    const D = DIV[L], c = LAYOUT[L][i], par = LAYOUT[L - 1][c.parent];
    const P = cellState(L - 1, c.parent, Math.min(t, D.s0));
    const rc = R0 * SCL[L];
    const ca = Math.cos(par.divAxis), sa = Math.sin(par.divAxis);
    const u = seg(t, D.s0, D.s1, ease.inOutCubic);
    const sep = rc * GAP * u * c.side;
    const bx = P.x + ca * sep, by = P.y + sa * sep;
    const ex = P.x + ca * rc * GAP * c.side, ey = P.y + sa * rc * GAP * c.side;
    const w = seg(t, D.s1, D.set + 0.3, ease.inOutSine);
    const x = bx + (c.x - ex) * w, y = by + (c.y - ey) * w;
    const ks = clamp(invLerp(D.s0, D.s1 + 0.12, t));
    const s = lerp(SCL[L - 1], SCL[L], ks <= 0 ? 0 : ease.outBack(ks, 1.3));
    const spin = P.spin + c.side * 0.4 * u + c.spin * seg(t, D.s1 - 0.2, D.s1 + 1.2, ease.inOutSine);
    // stretch: the parent's (inherited) stretch relaxes during the split; own stretch before own division
    const st = [];
    const inh = relax(invLerp(D.s0, D.s1 + 0.12, t));
    for (const [a, k] of P.st) st.push([a, k * inh]);
    if (L < 4) {
      const Dn = DIV[L + 1];
      if (t > Dn.st) st.push([c.divAxis ?? par.divAxis, seg(t, Dn.st, Dn.s0, ease.inOutSine)]);
    }
    v = { x, y, s, spin, st };
  }
  _memo.set(key, { t, v });
  return v;
}
export function levelAt(t) {
  let L = 0;
  for (let k = 1; k <= 4; k++) if (t >= DIV[k].s0) L = k;
  return L;
}
// Cluster centre and slow rotation.
export function cluster(t) {
  const w = seg(t, 1.9, 6, ease.inOutSine);
  return { x: C0[0] + 26 * w * Math.sin(t * 0.35), y: C0[1] + 18 * w * Math.sin(t * 0.27 + 1), rot: 0.18 * seg(t, 2.4, 6.2, ease.inOutSine) };
}
// Stretch matrix (in world) from a list of [axis, amount]; amounts in 0..1 (+ overshoot).
export function stretchM(st, rot, kLong = 0.15, kShort = 0.1) {
  let m = M.id();
  for (const [a0, k] of st) {
    if (Math.abs(k) < 1e-5) continue;
    const a = a0 + rot;
    m = M.mul(m, M.chain(M.rotate(a), M.scale(1 + kLong * k, 1 - kShort * k), M.rotate(-a)));
  }
  return m;
}
// All live cells at time t in draw order, with world transforms.
export function cellsAt(t) {
  const cl = cluster(t);
  const L = levelAt(t);
  const cr = Math.cos(cl.rot), sr = Math.sin(cl.rot);
  const out = [];
  for (let i = 0; i < 1 << L; i++) {
    const S = cellState(L, i, t);
    const x = cl.x + S.x * cr - S.y * sr, y = cl.y + S.x * sr + S.y * cr;
    let split = null;
    if (L > 0) {
      const D = DIV[L], c = LAYOUT[L][i], par = LAYOUT[L - 1][c.parent];
      if (t < D.s1) {
        const P = cellState(L - 1, c.parent, D.s0);
        split = { axis: par.divAxis + cl.rot, side: c.side, mx: cl.x + P.x * cr - P.y * sr, my: cl.y + P.x * sr + P.y * cr };
      }
    }
    out.push({ L, i, x, y, s: S.s, spin: S.spin + cl.rot, st: S.st, rot: cl.rot, split });
  }
  return { cl, L, cells: out };
}
// World matrix for a pivot layer copy (pc = local centre) of a cell; `k` scales the stretch strength.
export function cellMatrix(c, pc, { scale = 1, breathe = 1, baseRot = 0, kLong = 0.15, kShort = 0.1 } = {}) {
  return M.chain(M.translate(c.x, c.y), stretchM(c.st, c.rot, kLong, kShort), M.rotate(c.spin + baseRot), M.scale(c.s * scale * breathe), M.translate(-pc, -pc));
}
// Screen-space half-plane mask for a splitting cell (first child overlaps the midline, second is soft).
export function splitMask(R, c) {
  if (!c.split) return null;
  const sp = c.split;
  const [mx, my] = R.toScreen(sp.mx, sp.my);
  const [ax, ay] = R.toScreen(sp.mx + Math.cos(sp.axis), sp.my + Math.sin(sp.axis));
  let nx = ax - mx, ny = ay - my;
  const l = Math.hypot(nx, ny) || 1;
  nx = (nx / l) * sp.side; ny = (ny / l) * sp.side;
  const d = mx * nx + my * ny;
  return sp.side < 0 ? { type: 'linear', nx, ny, d0: d - 5, d1: d - 2 } : { type: 'linear', nx, ny, d0: d - 1.5, d1: d + 1.5 };
}
