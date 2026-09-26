// LAND — shared timeline, easing and colour helpers.
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep } from '../lib/kit.js';
import { ease, invLerp, prog, noise1, fbm1, noise2, smootherstep } from '../../engine/math.js';

export { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, ease, invLerp, prog, noise1, fbm1, noise2, smootherstep };

export const START = 70; // global start of the segment
export const DUR = 15;
export const BEAT = 0.625;

// Local-time cue points (lt = t - 70).
export const T = {
  pullEnd: 3.3,      // 73.3  wide shot settled
  walk0: 2.5,        // 72.5  first foot lifts
  step0: 3.125,      // 73.125 first footfall (beats from here)
  nSteps: 6,         // last footfall 76.25
  streak: 6.25,      // 76.25 streak appears
  look0: 6.1,        // head starts lifting
  look1: 7.1,
  impact: 7.5,       // 77.5 IMPACT
  wavePass: 8.75,    // 78.75 shockwave passes camera
  roar: 10.0,        // 80.0 fire roar
  ash0: 12.5,        // 82.5 ash begins falling
  tilt0: 11.9,       // camera starts tilting up into the smoke
  end: 15.0,
};

// Smooth "bump": 0 outside [a, d], 1 inside [b, c], smooth ramps.
export function window4(x, a, b, c, d) {
  return smoothstep(a, b, x) * (1 - smoothstep(c, d, x));
}
// Exponential decay after t0 (0 before).
export function decay(x, t0, k) {
  return x < t0 ? 0 : Math.exp(-(x - t0) * k);
}
// Attack/decay pulse (fast rise over `a` seconds, exponential fall with rate k).
export function pulse(x, t0, a, k) {
  if (x < t0) return 0;
  const u = x - t0;
  return u < a ? ease.outSine(u / a) : Math.exp(-(u - a) * k);
}
export function rgb(c) {
  return typeof c === 'string' ? hex(c) : c;
}
export function mixRgb(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
// Integral of a smoothstep ramp (for smooth acceleration of positions).
export function rampInt(x, r) {
  if (x <= 0) return 0;
  if (x >= r) return r / 2 + (x - r);
  const u = x / r;
  return r * (u * u * u - (u * u * u * u) / 2);
}
// Closed (or open) Catmull-Rom curve through control points; k samples per span.
export function crSpline(ctrl, k = 8, closed = true) {
  const n = ctrl.length, out = [];
  const spans = closed ? n : n - 1;
  const P = (i) => closed ? ctrl[(i + n) % n] : ctrl[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < spans; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(ctrl[n - 1].slice());
  return out;
}
// Point-in-polygon (even-odd).
export function inPoly(pts, x, y) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
// Hash to [0,1)
export function h01(i, s = 0) {
  let h = Math.imul((i + 1) * 374761393 + s * 668265263, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
