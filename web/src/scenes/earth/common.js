// EARTH segment — shared helpers: timeline, easing, 3D camera / projection, painting utilities.
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep } from '../lib/kit.js';
import { ease, invLerp, prog, noise1, fbm1, noise2, fbm2 } from '../../engine/math.js';

export { C, M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, ease, invLerp, prog, noise1, fbm1, noise2, fbm2 };

// Segment timeline (local seconds; global = 30 + lt). One beat = 0.625 s, one bar = 2.5 s.
export const DUR = 22.5;
export const T = {
  swell: 0.0,       // 30.000  the star swells as we fall towards it (== PIVOT.star at lt 0)
  disk: 2.5,        // 32.500  the Sun's disc resolves; the disk spirals in
  clump: 5.0,       // 35.000  dust starts to clump; the camera swings out along the disk
  planet: 7.5,      // 37.500  the third planet is born (accretion flash)
  strike1: 8.75,    // 38.750  meteor strike
  strike2: 9.375,   // 39.375  meteor strike
  impact: 10.0,     // 40.000  the big impact
  descend: 10.6,    // 40.600  the 2D descent takes over from the 3D camera
  ocean: 14.4,      // 44.400  horizon flat: the night ocean
  moon: 15.0,       // 45.000  moonrise
  crest: 17.5,      // 47.500  wave crest (lip curls from 46.8)
  dive: 18.7,       // 48.700  the camera dives into the curl
  crash: 20.0,      // 50.000  the water closes over us
  cell: 20.625,     // 50.625  the first cell fills with colour
  end: 22.5,        // 52.500  PIVOT.cell
};

export const W = 1920, H = 1080, CX = 960, CY = 540;

// smooth window: 0 before a, ramps to 1 by b, back to 0 from c to d
export const win = (x, a, b, c, d) => smoothstep(a, b, x) * (1 - smoothstep(c, d, x));
export const smoother = (a, b, x) => {
  const t = invLerp(a, b, x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
// log-space interpolation (for zooms / distances)
export const lerpLog = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));
export const rgb = (c) => (typeof c === 'string' ? hex(c) : c);
export const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const hash = (i, s = 0) => {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((s | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};

// 3-vectors
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
};

// Pinhole camera: position P, looks at target G, roll (radians), lens shift (ox, oy) in design units.
// World: y up. Screen: design units, y down.
export function makeCam(P, G, { F = 1500, roll = 0, ox = 0, oy = 0, basis = null } = {}) {
  let f, r, u;
  if (basis) ({ f, r, u } = basis);
  else {
    f = v3.norm(v3.sub(G, P));
    // right vector chosen so that +x appears to the right when looking along +z
    r = v3.norm(v3.cross([0, 1, 0], f));
    u = v3.cross(f, r);
  }
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const cam = {
    P, G, f, r, u, F, roll, ox, oy,
    // camera-space coordinates of world point X
    cs(X) {
      const d = [X[0] - P[0], X[1] - P[1], X[2] - P[2]];
      return [d[0] * r[0] + d[1] * r[1] + d[2] * r[2], d[0] * u[0] + d[1] * u[1] + d[2] * u[2], d[0] * f[0] + d[1] * f[1] + d[2] * f[2]];
    },
    // screen projection: [x, y, depth, scale(px per world unit at that depth)]
    proj(X) {
      const c = cam.cs(X);
      const z = c[2];
      if (z <= 1e-4) return [NaN, NaN, z, 0];
      const k = F / z;
      const sx = c[0] * k, sy = -c[1] * k;
      return [CX + ox + sx * cr - sy * sr, CY + oy + sx * sr + sy * cr, z, k];
    },
    // project a direction (star at infinity)
    projDir(D) {
      const x = D[0] * r[0] + D[1] * r[1] + D[2] * r[2];
      const y = D[0] * u[0] + D[1] * u[1] + D[2] * u[2];
      const z = D[0] * f[0] + D[1] * f[1] + D[2] * f[2];
      if (z <= 1e-4) return null;
      const sx = (x / z) * F, sy = (-y / z) * F;
      return [CX + ox + sx * cr - sy * sr, CY + oy + sx * sr + sy * cr];
    },
    // apparent screen radius of a sphere of radius rad centred at X (exact limb for near spheres)
    sphere(X, rad) {
      const c = cam.cs(X);
      const d = Math.hypot(c[0], c[1], c[2]);
      const p = cam.proj(X);
      if (!(p[2] > 1e-4)) return null;
      const q = Math.sqrt(Math.max(d * d - rad * rad, 1e-6));
      return { x: p[0], y: p[1], z: p[2], d, r: (F * rad * d) / (p[2] * q), k: p[3] };
    },
  };
  return cam;
}

// Cubic Hermite interpolation through keyframes [{t, v:[...]}] with Catmull-Rom tangents (zero at the ends).
export function spline(keys, t) {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const h = k1.t - k0.t, s = (t - k0.t) / h;
  const tan = (j) => {
    if (j <= 0 || j >= n - 1) return keys[j].v.map(() => 0);
    const a = keys[j - 1], b = keys[j + 1];
    return keys[j].v.map((_, q) => (b.v[q] - a.v[q]) / (b.t - a.t));
  };
  const m0 = tan(i), m1 = tan(i + 1);
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  return k0.v.map((v0, q) => h00 * v0 + h10 * h * m0[q] + h01 * k1.v[q] + h11 * h * m1[q]);
}

// Screen-space polyline helpers
export function polyLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
export function onScreen(x, y, m = 0) {
  return x > -m && x < W + m && y > -m && y < H + m;
}
// Circle polygon
export function circ(cx, cy, r, n = 64, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Stroke helper for dynamic layers: stable per-stroke brush randomness (no boiling when a stroke
// moves rigidly), and grouping by brush+colour to limit spectral composite passes.
export function strokeBatch(c, list) {
  // list: [{ pts, brush, color, w, curv, seed }]
  list.sort((a, b) => (a.color === b.color ? (a.brush < b.brush ? -1 : a.brush > b.brush ? 1 : 0) : a.color < b.color ? -1 : 1));
  const { brush } = c;
  brush.noFill();
  brush.noHatch();
  for (const s of list) {
    if (!s.pts || s.pts.length < 2) continue;
    brush.seed(s.seed);
    brush.set(s.brush, s.color, s.w);
    brush.spline(s.pts, s.curv ?? 0.5);
  }
}

// Particle helper
export function part(x, y, size, col, a, rot = 0) {
  return [x, y, size, rot, col[0], col[1], col[2], a];
}

// Default post (engine defaults) — used at the segment boundaries.
export const POST0 = { exposure: 1, bloom: 0.9, threshold: 1.0, vignette: 0.32, sat: 1, contrast: 1, lift: [0, 0, 0], gain: [1, 1, 1] };
