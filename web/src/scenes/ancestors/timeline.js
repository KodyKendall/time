// ANCESTORS — timeline, camera and parallax planes.
// Local time lt: 0 (= 85.0 s, PIVOT.ash) … 12.5 (= 97.5 s, PIVOT.night). One beat = 0.625 s.
import { M, lerp, clamp, invLerp, smoothstep, ease } from '../../engine/math.js';

export const T0 = 85;
export const DUR = 12.5;

// Cue points (local seconds). Most sit on beats (multiples of 0.625 s from 0).
export const CUE = {
  craneDown: 0,      // 85.00 tilt down from the ash sky
  pop: 1.25,         // 86.25 shrew pops out of its burrow
  scurry: 2.5,       // 87.50 shrew scurries out
  sprouts: 3.125,    // 88.13 sprouts poke up
  burst: 3.75,       // 88.75 first sprout bursts — green spreads
  swell: 5.0,        // 90.00 growth swell (palms / jungle)
  primate: 6.25,     // 91.25 primate settles on the rock
  dusk: 7.5,         // 92.50 dusk falls
  stand: 8.75,       // 93.75 stands up — human
  strike: 9.375,     // 94.38 first flint strike
  ignite: 10.0,      // 95.00 fire ignites
  sparks: 11.25,     // 96.25 sparks rise, camera tilts up
  end: 12.5,         // 97.50 PIVOT.night
};

// Regularised incomplete beta ease: velocity ~ u^a (1-u)^b (a, b integers >= 1).
// betaEase(u, 1, 2): peak speed at 1/3 (quick start, long landing).
function binom(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }
export function betaEase(u, a = 2, b = 2) {
  u = clamp(u);
  const n = a + b + 1;
  let s = 0;
  for (let j = a + 1; j <= n; j++) s += binom(n, j) * Math.pow(u, j) * Math.pow(1 - u, n - j);
  return s;
}

// Hermite keyframe track: keys [{t, v, d?}] (d = slope; default Catmull-Rom, 0 at the ends).
export function track(keys) {
  const n = keys.length;
  const d = keys.map((k, i) => {
    if (k.d !== undefined) return k.d;
    if (i === 0 || i === n - 1) return 0;
    return (keys[i + 1].v - keys[i - 1].v) / (keys[i + 1].t - keys[i - 1].t);
  });
  return (t) => {
    if (t <= keys[0].t) return keys[0].v;
    if (t >= keys[n - 1].t) return keys[n - 1].v;
    let i = 0;
    while (t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1], h = b.t - a.t, u = (t - a.t) / h;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * a.v + (u3 - 2 * u2 + u) * h * d[i] + (-2 * u3 + 3 * u2) * b.v + (u3 - u2) * h * d[i + 1];
  };
}

// ------------------------------------------------------------------------------------------------
// Camera. Stage camera (after the crane down) drifts / pushes in on the rock; the segment starts and
// ends on the identity view (the pivots). cam(lt) -> { x, y, z }: world point at screen centre + zoom.
// ------------------------------------------------------------------------------------------------
export const STAGE_Y = 1540; // camera centre y once we are down on the burnt land
const stage = {
  x: track([{ t: 1.2, v: 965 }, { t: 2.5, v: 948 }, { t: 3.75, v: 915 }, { t: 6.25, v: 1150 }, { t: 8.75, v: 1228 }, { t: 10.2, v: 1296, d: 12 }, { t: 12.5, v: 1320 }]),
  y: track([{ t: 1.2, v: STAGE_Y - 12 }, { t: 2.5, v: STAGE_Y + 6 }, { t: 3.75, v: 1586 }, { t: 6.25, v: 1628 }, { t: 8.75, v: 1596 }, { t: 10.2, v: 1566, d: -4 }, { t: 12.5, v: 1560 }]),
  lz: track([{ t: 1.2, v: 0 }, { t: 2.5, v: Math.log(1.04) }, { t: 3.75, v: Math.log(1.12) }, { t: 6.25, v: Math.log(1.27) }, { t: 8.75, v: Math.log(1.3) }, { t: 10.2, v: Math.log(1.27), d: 0 }, { t: 12.5, v: Math.log(1.28) }]),
};
export const CRANE_DOWN = [0, 2.0];
export const CRANE_UP = [10.3, 12.5];

export function cam(lt) {
  // stage camera (defined for all lt; the cranes blend into / out of it)
  let x = stage.x(lt), y = stage.y(lt), lz = stage.lz(lt);
  // crane down: identity -> stage (velocity peaks early, long soft landing)
  const d = betaEase(invLerp(CRANE_DOWN[0], CRANE_DOWN[1], lt), 2, 3);
  x = lerp(960, x, d);
  y = lerp(540, y, d);
  lz = lerp(0, lz, d);
  // crane up: stage -> identity (slow lift-off following the sparks, strong middle, soft landing)
  const u = betaEase(invLerp(CRANE_UP[0], CRANE_UP[1], lt), 2, 2);
  x = lerp(x, 960, u);
  y = lerp(y, 540, u);
  lz = lerp(lz, 0, u);
  return { x, y, z: Math.exp(lz) };
}

// View matrix for a camera state.
export function viewOf(c) {
  return [c.z, 0, 0, c.z, 960 - c.z * c.x, 540 - c.z * c.y];
}
// Parallax plane: k = 1 ground plane, k < 1 farther, k > 1 nearer. At the pivots (identity camera)
// every plane is identity.
export function planeCam(lt, k) {
  const c = cam(lt);
  return { x: 960 + (c.x - 960) * k, y: 540 + (c.y - 540) * k, z: Math.pow(c.z, k) };
}
export function planeView(lt, k) {
  return viewOf(planeCam(lt, k));
}
export const K = { sky: 0.9, far: 0.95, mid: 0.98, ground: 1, near: 1.1 };

export { M, lerp, clamp, invLerp, smoothstep, ease };
