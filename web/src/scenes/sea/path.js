// SEA — the creature's travel: a smooth curve through waypoints + an explicit speed profile
// (hover, dart burst at 60.0, cruise, slow into the shallows, walk, stop). Pure & precomputed.
import { lerp, clamp, invLerp, ease, smoothPath } from './lib.js';

const WP = [
  [1420, 548], [1500, 515], [1700, 330], [1960, 70], [2250, -200], [2560, -420], [3150, -750], [3760, -1030],
  [4300, -1280], [4660, -1385], [4880, -1480], [5010, -1560], [5230, -1730], [5360, -1830], [5400, -1860],
];
const CURVE = (() => {
  const pts = smoothPath(WP, 16);
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  // smooth, unwrapped tangent angles per sample
  const ang = [];
  for (let i = 0; i < pts.length; i++) {
    const i0 = Math.max(0, i - 4), i1 = Math.min(pts.length - 1, i + 4);
    let a = Math.atan2(pts[i1][1] - pts[i0][1], pts[i1][0] - pts[i0][0]);
    if (i > 0) { while (a - ang[i - 1] > Math.PI) a -= 2 * Math.PI; while (a - ang[i - 1] < -Math.PI) a += 2 * Math.PI; }
    ang.push(a);
  }
  return { pts, L, ang, total: L[L.length - 1] };
})();
export const T_START = 6.9, T_STOP = 17.3;
// raw speed profile (units/s), later scaled so the integral equals the curve length
function vRaw(t) {
  if (t < T_START) return 0;
  if (t < 7.45) return 25 * ease.inOutSine(invLerp(T_START, 7.1, t));
  if (t < 7.75) return lerp(25, 980, ease.outCubic(invLerp(7.45, 7.75, t)));
  if (t < 8.6) return lerp(980, 620, ease.inOutSine(invLerp(7.75, 8.6, t)));
  if (t < 12.2) return lerp(620, 560, invLerp(8.6, 12.2, t));
  if (t < 13.9) return lerp(560, 200, ease.inOutSine(invLerp(12.2, 13.9, t)));
  if (t < 16.4) {
    // walking: little surges on every step (2 per 1.25 s gait cycle)
    const base = lerp(200, 150, invLerp(13.9, 16.4, t));
    const walk = clamp(invLerp(14.2, 14.9, t));
    return base * (1 + 0.35 * walk * Math.sin((2 * Math.PI * (t - 15.0)) / 0.625));
  }
  if (t < T_STOP) return lerp(150, 0, ease.inOutSine(invLerp(16.4, T_STOP, t)));
  return 0;
}
const DT = 1 / 600;
const TABLE = (() => {
  const n = Math.ceil((17.6 - T_START) / DT) + 2;
  const s = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const t = T_START + (i - 0.5) * DT;
    s[i] = s[i - 1] + vRaw(t) * DT;
  }
  const k = CURVE.total / s[n - 1];
  for (let i = 0; i < n; i++) s[i] *= k;
  return { s, n };
})();
// distance travelled along the curve at time t
export function distAt(t) {
  if (t <= T_START) return 0;
  const f = (t - T_START) / DT;
  const i = Math.min(TABLE.n - 2, Math.floor(f));
  return lerp(TABLE.s[i], TABLE.s[i + 1], clamp(f - i));
}
// point + tangent angle on the curve at arc length d
export function curveAt(d) {
  const { pts, L } = CURVE;
  d = clamp(d, 0, CURVE.total);
  let lo = 0, hi = L.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < d) lo = m; else hi = m; }
  const u = (d - L[lo]) / (L[hi] - L[lo] || 1);
  const a = pts[lo], b = pts[hi];
  return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), a: lerp(CURVE.ang[lo], CURVE.ang[hi], u) };
}
export function headAt(t) {
  return curveAt(distAt(t));
}
export const START = WP[0];
