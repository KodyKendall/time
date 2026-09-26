// Small math toolkit shared by the engine and scenes.

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a0, a1, b0, b1) => lerp(b0, b1, invLerp(a0, a1, x));
export const smoothstep = (a, b, x) => {
  const t = invLerp(a, b, x);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, x) => {
  const t = invLerp(a, b, x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const fract = (x) => x - Math.floor(x);
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Easing
export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
};
// Eased progress of x through [a,b].
export const prog = (x, a, b, e = ease.inOutSine) => e(invLerp(a, b, x));

// Deterministic hashing / random
export function hash32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash32(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = (lo = 0, hi = 1) => lo + (hi - lo) * next();
  r.int = (lo, hi) => Math.floor(r(lo, hi + 1));
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  r.gauss = (mu = 0, sd = 1) => {
    const u = 1 - next(), v = next();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  r.chance = (p) => next() < p;
  r.next = next;
  return r;
}
// Hash of integer/float coordinates to [0,1).
export function h1(x, y = 0, z = 0) {
  let h = Math.imul((x * 73856093) ^ (y * 19349663) ^ (z * 83492791), 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
// Smooth 1D value noise (for camera drift, flicker, etc).
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(h1(i, seed), h1(i + 1, seed), u) * 2 - 1;
}
export function fbm1(x, seed = 0, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise1(x * f, seed + i * 17);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
// 2D value noise
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h1(ix, iy, seed), b = h1(ix + 1, iy, seed);
  const c = h1(ix, iy + 1, seed), d = h1(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
export function fbm2(x, y, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, y * f, seed + i * 31);
    n += a;
    a *= 0.5;
    f *= 2.07;
  }
  return s / n;
}

// ---------------------------------------------------------------------------
// 2D affine transforms, canvas-style [a, b, c, d, e, f]:
//   x' = a*x + c*y + e ;  y' = b*x + d*y + f
// ---------------------------------------------------------------------------
export const M = {
  id: () => [1, 0, 0, 1, 0, 0],
  mul(m, n) {
    // m ∘ n  (apply n first, then m)
    return [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  },
  translate: (x, y) => [1, 0, 0, 1, x, y],
  scale: (sx, sy = sx) => [sx, 0, 0, sy, 0, 0],
  rotate(r) {
    const c = Math.cos(r), s = Math.sin(r);
    return [c, s, -s, c, 0, 0];
  },
  inv(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    const ia = m[3] / det, ib = -m[1] / det, ic = -m[2] / det, id = m[0] / det;
    return [ia, ib, ic, id, -(ia * m[4] + ic * m[5]), -(ib * m[4] + id * m[5])];
  },
  apply(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  },
  // Chain helper: M.chain(A, B, C) = A ∘ B ∘ C
  chain(...ms) {
    return ms.reduce((acc, m) => M.mul(acc, m), M.id());
  },
  scaleOf: (m) => Math.hypot(m[0], m[1]),
  // Place an object: translate to (x,y), rotate r, scale s, around local pivot (px,py).
  place(x, y, s = 1, r = 0, px = 0, py = 0, sy = s) {
    const c = Math.cos(r), sn = Math.sin(r);
    // T(x,y) R(r) S(s,sy) T(-px,-py)
    const a = c * s, b = sn * s, cc = -sn * sy, d = c * sy;
    return [a, b, cc, d, x - (a * px + cc * py), y - (b * px + d * py)];
  },
};

// Similarity "view" parametrisation used by cameras and zoom transitions:
// world point p maps to screen point s, with uniform zoom z and rotation r.
//   V(x) = s + z * R(r) * (x - p)
export function viewMatrix(p, s, z, r = 0) {
  return M.mul(M.translate(s[0], s[1]), M.mul(M.rotate(r), M.mul(M.scale(z), M.translate(-p[0], -p[1]))));
}
// Decompose a similarity matrix into {z, r} and the image s of point p.
export function viewParams(m, p) {
  const z = Math.hypot(m[0], m[1]);
  const r = Math.atan2(m[1], m[0]);
  return { z, r, s: M.apply(m, p[0], p[1]) };
}
// Interpolate two similarity views around anchor p (log-zoom, linear screen pos, shortest rotation).
export function lerpView(m0, m1, p, t) {
  const a = viewParams(m0, p), b = viewParams(m1, p);
  let dr = b.r - a.r;
  while (dr > Math.PI) dr -= TAU;
  while (dr < -Math.PI) dr += TAU;
  const z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), t));
  // Screen position: blend so that the anchor path feels "zoom aware".
  const s = [lerp(a.s[0], b.s[0], t), lerp(a.s[1], b.s[1], t)];
  return viewMatrix(p, s, z, a.r + dr * t);
}

export function hex(c) {
  if (Array.isArray(c)) return c;
  const s = c.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((x) => x + x).join('') : s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function toHex(rgb) {
  return '#' + rgb.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
}
export function mixHex(a, b, t) {
  return toHex(mix3(hex(a), hex(b), t));
}
