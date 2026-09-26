// Small helpers for the 'sea' segment (pure functions only).
import { M, TAU, lerp, clamp, invLerp, ease, smoothstep, rng, hash32, hex, mixHex, noise1, fbm1 } from '../../engine/math.js';

export const T0 = 52.5;       // segment start (global seconds)
export const DUR = 17.5;      // segment duration
export const BEAT = 0.625;    // 96 BPM

// Eased progress of x through [a, b].
export const seg = (x, a, b, e = ease.inOutSine) => e(invLerp(a, b, x));
export const sstep = (a, b, x) => smoothstep(a, b, x);
// Smooth "bump": 0 at a, 1 at the middle, 0 at b.
export const bump = (x, a, b) => {
  const u = invLerp(a, b, x);
  return Math.sin(Math.PI * u) ** 2;
};
// Overshooting ease (elastic-ish settle) for pops / bounces.
export const outBack = (t, s = 1.4) => (t <= 0 ? 0 : t >= 1 ? 1 : ease.outBack(t, s));
export function settle(t, freq = 2.2, damp = 5) {
  // 0 -> 1 with a damped overshoot (spring)
  if (t <= 0) return 0;
  return 1 - Math.exp(-damp * t) * Math.cos(freq * TAU * t);
}

// Rng exactly as a painted layer's `c.r` (so we can reproduce pivot paintings' geometry).
export function layerRng(name) {
  return rng(hash32(name) ^ 0x9e3779b9);
}

// Cubic Hermite through keyframes [[t, v], ...] with Catmull-Rom tangents (C1, pure).
// Values may be numbers or arrays of numbers.
export function track(keys) {
  const n = keys.length;
  const tan = keys.map((k, i) => {
    if (k[2] !== undefined) return k[2]; // explicit tangent
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)];
    if (i === 0 || i === n - 1) return Array.isArray(k[1]) ? k[1].map(() => 0) : 0; // ease at ends
    const dt = b[0] - a[0];
    return Array.isArray(k[1]) ? k[1].map((_, j) => (b[1][j] - a[1][j]) / dt) : (b[1] - a[1]) / dt;
  });
  const herm = (p0, m0, p1, m1, u, h) => {
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m1;
  };
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1], h = b[0] - a[0], u = (t - a[0]) / h;
    if (Array.isArray(a[1])) return a[1].map((v, j) => herm(v, tan[i][j], b[1][j], tan[i + 1][j], u, h));
    return herm(a[1], tan[i], b[1], tan[i + 1], u, h);
  };
}

// ------------------------------------------------------------------ polygons
export function ellipse(cx, cy, rx, ry, rot = 0, n = 48) {
  const c = Math.cos(rot), s = Math.sin(rot), pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}
export function xform(pts, m) {
  return pts.map((p) => {
    const q = M.apply(m, p[0], p[1]);
    return p.length > 2 ? [q[0], q[1], p[2]] : q;
  });
}
// Resample a CLOSED polygon to n points by arc length.
export function resampleClosed(pts, n) {
  const P = pts.concat([pts[0]]);
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = L[L.length - 1] || 1, out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (tot * i) / n;
    while (j < L.length - 2 && L[j + 1] < d) j++;
    const u = (d - L[j]) / (L[j + 1] - L[j] || 1);
    out.push([lerp(P[j][0], P[j + 1][0], u), lerp(P[j][1], P[j + 1][1], u)]);
  }
  return out;
}
export const lerpPoly = (a, b, t) => a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]);

// Thick smooth stroke outline (capsule along a polyline) with per-point half-width w (pts[i][2]).
export function capsule(pts, w = 1, capN = 8) {
  const n = pts.length;
  if (n < 2) return [];
  const Lp = [], Rp = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const hw = (pts[i][2] ?? 1) * w;
    Lp.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]);
    Rp.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
  }
  const cap = (p, q, hw, dir) => {
    // semicircle around p, starting from the left side, bulging in direction dir
    const out = [];
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    for (let k = 1; k < capN; k++) {
      const a = ang + Math.PI / 2 - (Math.PI * k) / capN;
      out.push([p[0] + Math.cos(a) * hw * dir, p[1] + Math.sin(a) * hw * dir]);
    }
    return out;
  };
  const pe = pts[n - 1], pe1 = pts[n - 2], ps = pts[0], ps1 = pts[1];
  const endCap = [];
  {
    const ang = Math.atan2(pe[1] - pe1[1], pe[0] - pe1[0]), hw = (pe[2] ?? 1) * w;
    for (let k = 1; k < capN; k++) {
      const a = ang + Math.PI / 2 - (Math.PI * k) / capN;
      endCap.push([pe[0] + Math.cos(a) * hw, pe[1] + Math.sin(a) * hw]);
    }
  }
  const startCap = [];
  {
    const ang = Math.atan2(ps[1] - ps1[1], ps[0] - ps1[0]), hw = (ps[2] ?? 1) * w;
    for (let k = 1; k < capN; k++) {
      const a = ang + Math.PI / 2 - (Math.PI * k) / capN;
      startCap.push([ps[0] + Math.cos(a) * hw, ps[1] + Math.sin(a) * hw]);
    }
  }
  void cap;
  return Lp.concat(endCap, Rp.reverse(), startCap);
}

// Point + tangent on an open polyline at fraction f of its length.
export function along(pts, f) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const d = clamp(f) * L[L.length - 1];
  let j = 0;
  while (j < L.length - 2 && L[j + 1] < d) j++;
  const u = (d - L[j]) / (L[j + 1] - L[j] || 1);
  const a = pts[j], b = pts[j + 1];
  return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

// Catmull-Rom smoothing of an open polyline (returns a denser polyline).
export function smoothPath(pts, sub = 4) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const q = [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
      if (p1.length > 2) q.push(lerp(p1[2], p2[2], t));
      out.push(q);
    }
  }
  out.push(pts[n - 1]);
  return out;
}

export { M, TAU, lerp, clamp, invLerp, ease, smoothstep, rng, hash32, hex, mixHex, noise1, fbm1 };
