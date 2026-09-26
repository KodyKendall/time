// SEA — mitosis of the first cell (lt 0 .. 2.7): chromatin condenses into X chromosomes, the nuclear
// envelope unravels, the spindle draws itself, sister chromatids are pulled to the poles.
import { C } from '../lib/palette.js';
import { M, TAU, lerp, clamp, invLerp, ease, rng, seg, bump, capsule, smoothPath, mixHex } from './lib.js';
import { C0, NUC_R, cellsAt, DIV } from './cells.js';

export const MT = {
  wind0: 0.04, gone: 1.0,           // parent nucleus winds up and condenses away
  unr0: 0.3, unr1: 1.45,            // envelope thread unravels
  xs0: 0.42, xs1: 0.95,             // X chromosomes appear
  al0: 0.85, al1: 1.25,             // align on the plate
  split: 1.25,                      // 53.75 sisters separate
  pole1: 1.95,                      // at the poles
  sp0: 0.55, sp1: 1.2,              // spindle draws itself
  retr0: 1.95, retr1: 2.45,         // spindle retracts
  nuc0: 2.0, nuc1: 2.6,             // daughter nuclei form
};
const CHR = (() => {
  const r = rng('sea-chromosomes');
  const cols = ['#f6e7c6', '#f8d68e', '#f3dcb0', '#f7cf9a'];
  return [0, 1, 2, 3].map((k) => ({
    k, col: cols[k], line: r.pick([C.ochre, C.rust, '#b8742a']),
    a0: r(0, TAU), d0: r(8, 42), psi0: r(0, TAU), len: r(19, 25), delay: k * 0.07 + r(0, 0.05),
    yPlate: (k - 1.5) * 42 + r(-4, 4), tilt: r(-0.25, 0.25),
  }));
})();

// Sister chromatid shapes (centromere at origin; dir = -1 for the left sister, +1 for the right one).
function chromatidShape(dir, len, v) {
  // v: 0 = X-sister ")", 1 = anaphase V trailing behind its centromere
  const X = [[-0.34, -1], [-0.08, -0.5], [0.02, 0], [-0.08, 0.5], [-0.34, 1]];
  const V = [[0.55, -0.8], [0.25, -0.4], [0, 0], [0.25, 0.4], [0.55, 0.8]];
  return X.map((p, i) => [dir * lerp(p[0], V[i][0], v) * len, lerp(p[1], V[i][1], v) * len]);
}

// Pole positions (world) at time t.
export function poles(t) {
  const ang = seg(t, 0.5, 1.15, ease.inOutCubic);
  const el = seg(t, 1.25, 1.95, ease.inOutSine);
  const dist = lerp(118, 190, el);
  const a1 = lerp(-Math.PI / 2, -Math.PI, ang), a2 = lerp(-Math.PI / 2, 0, ang);
  let L = [C0[0] + Math.cos(a1) * dist, C0[1] + Math.sin(a1) * dist * lerp(0.95, 1, ang)];
  let Rr = [C0[0] + Math.cos(a2) * dist, C0[1] + Math.sin(a2) * dist * lerp(0.95, 1, ang)];
  if (t > DIV[1].s0) {
    // follow the daughter cells
    const cs = cellsAt(t).cells;
    if (cs.length === 2) {
      const f = seg(t, DIV[1].s0, DIV[1].s1, ease.inOutSine);
      L = [lerp(L[0], cs[0].x - 60, f), lerp(L[1], cs[0].y, f)];
      Rr = [lerp(Rr[0], cs[1].x + 60, f), lerp(Rr[1], cs[1].y, f)];
    }
  }
  return [L, Rr];
}

// Chromatid instances at time t: [{pts (world polyline with widths), col, line, side}]
export function chromatids(t) {
  if (t < MT.xs0 || t > MT.nuc1 + 0.2) return [];
  const [PL, PR] = poles(t);
  const out = [];
  const cs = t > DIV[1].s0 ? cellsAt(t).cells : null;
  for (const c of CHR) {
    const g = ease.outBack(clamp(invLerp(MT.xs0 + c.delay, MT.xs1 + c.delay, t)), 1.6);
    if (g <= 0) continue;
    const al = seg(t, MT.al0 + c.delay * 0.5, MT.al1, ease.inOutCubic);
    // emergence position (inside the old nucleus) -> plate
    const ex = C0[0] + Math.cos(c.a0) * c.d0 * (1 - al), ey = C0[1] + Math.sin(c.a0) * c.d0 * (1 - al);
    const px = lerp(ex, C0[0], al), py = lerp(ey, C0[1] + c.yPlate, al);
    const psi = lerp(c.psi0, c.tilt * 0.3, al) + 0.15 * Math.sin(t * 2 + c.k) * (1 - al);
    const sp = seg(t, MT.split, MT.pole1, ease.inOutQuad);
    const shrink = 1 - 0.35 * seg(t, MT.nuc0, MT.nuc1, ease.inOutSine);
    for (const dir of [-1, 1]) {
      const pole = dir < 0 ? PL : PR;
      // centromere: at the plate (+-2), pulled to the pole along the fibre
      let cx = px + dir * 2.2 * g, cy = py;
      if (sp > 0) {
        const tx = pole[0] - dir * 30, ty = C0[1] + c.yPlate * 0.45;
        cx = lerp(cx, tx, sp);
        cy = lerp(cy, ty, sp);
      }
      if (cs && cs.length === 2) {
        // ride inside the daughter cell towards its centre
        const ch = cs[dir < 0 ? 0 : 1];
        const f = seg(t, MT.pole1 - 0.1, MT.nuc1, ease.inOutSine);
        cx = lerp(cx, ch.x + dir * 10 + c.yPlate * 0.1, f);
        cy = lerp(cy, ch.y + c.yPlate * 0.35, f);
      }
      const v = seg(t, MT.split - 0.05, MT.split + 0.35, ease.outCubic);
      const shape = chromatidShape(dir, c.len * g * shrink, v);
      const a = psi + (sp > 0 ? 0 : 0);
      const ca = Math.cos(a), sa = Math.sin(a);
      const pts = shape.map((p, i) => [cx + p[0] * ca - p[1] * sa, cy + p[0] * sa + p[1] * ca, [1, 1.05, 0.8, 1.05, 1][i]]);
      out.push({ pts, col: c.col, line: c.line, side: dir, g, k: c.k });
    }
  }
  return out;
}

// Paint the mitosis overlay into a dyn layer. P: world -> layer transform.
export function paintMitosis(c, t, P) {
  if (t <= 0 || t > 2.75) return;
  const z = M.scaleOf(P);
  const W = (p) => { const q = M.apply(P, p[0], p[1]); return p.length > 2 ? [q[0], q[1], p[2]] : q; };
  const path = (pts) => pts.map(W);
  const [PL, PR] = poles(t);
  const chs = chromatids(t);

  // ---- nuclear envelope vesicles (fragments flung out as the nucleus condenses)
  const r = rng('sea-vesicles');
  for (let i = 0; i < 14; i++) {
    const t0 = r(0.38, 0.8), life = r(0.55, 0.9), a = r(0, TAU), d1 = r(40, 110), sz = r(5, 11);
    const u = invLerp(t0, t0 + life, t);
    if (u <= 0 || u >= 1) continue;
    const nucS = 1 - seg(t0, 0.35, MT.gone, ease.inCubic);
    const d = NUC_R * nucS * 0.95 + d1 * ease.outCubic(u);
    const x = C0[0] + Math.cos(a + u * 0.6) * d, y = C0[1] + Math.sin(a + u * 0.6) * d;
    const s = sz * Math.sin(Math.PI * Math.min(1, u * 1.6 + 0.0)) * (1 - u);
    if (s < 0.6) continue;
    const blob = [];
    for (let k = 0; k < 10; k++) {
      const aa = (k / 10) * TAU;
      blob.push(W([x + Math.cos(aa) * s * (1 + 0.25 * Math.sin(aa * 2 + i)), y + Math.sin(aa) * s * 0.75]));
    }
    c.washPoly(blob, i % 3 ? '#16223a' : '#2a3558', 235);
  }

  // ---- unravelling envelope thread
  {
    const u = seg(t, MT.unr0, MT.unr1, ease.inOutSine);
    if (u > 0 && u < 1) {
      const nucS = 1 - seg(t, 0.35, MT.gone, ease.inCubic);
      const tw = 3.2 * seg(t, MT.wind0, MT.gone, ease.inOutSine);
      const a0 = -0.05 * (t + 52.5) + 0.3 * tw + 1.1;
      const pts = [];
      const N = 46;
      for (let k = 0; k <= N; k++) {
        const s = k / N;
        // circle -> loosening spiral that drifts out and away
        const ang = a0 + TAU * s * lerp(1, 0.55, u) + u * 1.2;
        const rad = NUC_R * lerp(1, nucS, 0.35) * (1 + u * s * 1.6) + 9 * u * Math.sin(s * 18 + t * 5);
        pts.push([C0[0] + Math.cos(ang) * rad + 40 * u * u, C0[1] + Math.sin(ang) * rad - 25 * u * u]);
      }
      // the thread is pulled away: it shortens from its anchored end
      const f0 = seg(t, MT.unr0 + 0.45, MT.unr1, ease.inQuad);
      const sub = pts.slice(Math.floor(f0 * N));
      if (sub.length > 2) c.strokePath(path(sub), 'ink', C.lavender, 1.0 * z, 0.5);
    }
  }

  // ---- spindle: astral rays, polar fibres, kinetochore fibres
  const grow = (a, b) => seg(t, a, b, ease.outCubic);
  const retract = seg(t, MT.retr0, MT.retr1, ease.inOutSine);
  const gSp = grow(MT.sp0, MT.sp1);
  if (gSp > 0 && retract < 1) {
    const fib = mixHex(C.cream, C.gold, 0.35);
    // asters
    for (const [pi, P0] of [[0, PL], [1, PR]]) {
      const out = pi === 0 ? Math.PI : 0;
      for (let k = 0; k < 9; k++) {
        const a = out + (k - 4) * 0.3 + 0.08 * Math.sin(t * 3 + k);
        const len = (46 + 18 * Math.sin(k * 2.3)) * gSp * (1 - retract);
        if (len < 2) continue;
        c.strokePath(path([P0, [P0[0] + Math.cos(a) * len * 0.5, P0[1] + Math.sin(a) * len * 0.5], [P0[0] + Math.cos(a) * len, P0[1] + Math.sin(a) * len]]), 'wire', fib, 0.8 * z, 0.5);
      }
    }
    // polar fibres (bowed arcs between the poles), retract into the midzone
    const gP = grow(MT.sp0 + 0.2, MT.sp1 + 0.05);
    for (let k = 0; k < 6; k++) {
      const off = (k - 2.5) * 22;
      const pts = [];
      for (let j = 0; j <= 12; j++) {
        const s = j / 12;
        const x = lerp(PL[0], PR[0], s), y = lerp(PL[1], PR[1], s) + off * Math.sin(Math.PI * s) * 1.1;
        pts.push([x, y]);
      }
      const a = 0.5 - 0.5 * gP * (1 - retract), b = 0.5 + 0.5 * gP * (1 - retract);
      const lo = Math.floor(a * 12), hi = Math.ceil(b * 12);
      const sub = pts.slice(lo, hi + 1);
      if (sub.length > 1 && b - a > 0.02) c.strokePath(path(sub), 'wire', k % 2 ? fib : C.sand, 0.7 * z, 0.5);
    }
    // kinetochore fibres: pole -> centromere of each chromatid
    for (const ch of chs) {
      const P0 = ch.side < 0 ? PL : PR;
      const cen = ch.pts[2];
      const gk = grow(MT.sp0 + 0.25 + ch.k * 0.04, MT.al1) * (1 - retract);
      if (gk <= 0.02) continue;
      const e = [lerp(P0[0], cen[0], gk), lerp(P0[1], cen[1], gk)];
      c.strokePath(path([P0, [lerp(P0[0], e[0], 0.5), lerp(P0[1], e[1], 0.5) + 3], e]), 'wire', fib, 0.9 * z, 0.4);
    }
  }

  // ---- chromatids (thick painted strands with an inner strand line and a dark contour)
  for (const ch of chs) {
    const sm = smoothPath(ch.pts, 4);
    const outline = capsule(sm, 5.2 * ch.g, 6);
    c.washPoly(path(outline), ch.col, 245);
  }
  for (const ch of chs) {
    const sm = smoothPath(ch.pts, 4);
    c.strokePath(path(sm), 'sea_dry', ch.line, 0.32 * z, 0.5);
    const outline = capsule(sm, 5.4 * ch.g, 6);
    c.strokePath(path(outline.concat([outline[0]])), 'ink', '#6a2a2a', 0.7 * z, 0.4);
    const cen = ch.pts[2];
    const q = W(cen);
    const rr = 2.6 * ch.g * z;
    const dot = [];
    for (let k = 0; k < 8; k++) dot.push([q[0] + Math.cos((k / 8) * TAU) * rr, q[1] + Math.sin((k / 8) * TAU) * rr]);
    c.washPoly(dot, '#8a3a2a', 230);
  }
}
