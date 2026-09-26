// EARTH — 3D camera for the space part (lt 0 .. ~11): approach the star, frame the young Sun and its
// disk, pull back to watch the disk clump, then push in on the third planet. Pure functions of lt.
import { v3, makeCam, lerp, clamp, smoothstep, smoother, lerpLog, invLerp, spline, TAU } from './common.js';

// Solar system model (world units, y up, disk in the x-z plane, Sun at the origin)
export const SYS = {
  sunR: 1,
  earthA: 11,            // orbit radius of the third planet
  earthR: 0.058,         // (stylised) planet radius
  earthW: 0.02,          // orbital angular speed (rad/s) (= disk speed at its orbit)
  earthPh5: -0.02,       // orbital angle at lt = 5 (angle from -z towards +x)
};
// Kepler-ish angular speed of the disk at radius a (rad/s)
export const omega = (a) => 0.02 * Math.pow(a / 11, -1.5);

export function orbitPos(a, th, y = 0) {
  return [a * Math.sin(th), y, -a * Math.cos(th)];
}
export function earthPos(lt) {
  return orbitPos(SYS.earthA, SYS.earthPh5 + SYS.earthW * (lt - 5), 0);
}

const dirOf = (az, el) => [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];

// Phase A: approach the star along -z, rise above the disk plane
const A = { D0: 4000, D1: 8.2, az: -0.26, el: 0.36 };
function poseA(lt) {
  const drift = 0.012 * lt; // never dead-still
  // fast early swell (the disc resolves by ~32.5 s), soft landing by ~34.7 s
  const sa = clamp(lt / 4.7), f = 1 - Math.pow(1 - Math.pow(sa, 1.6), 3);
  const D = lerpLog(A.D0, A.D1, f);
  const az = A.az * smoother(0.8, 5.2, lt) - drift;
  const el = A.el * smoother(0.6, 5.0, lt);
  return v3.mul(dirOf(az, el), D);
}

// Phase B: camera relative to the (moving) planet: [az, el, log d] keys, solved offline so that the
// Sun / planet land on designed screen positions. The lt 5 key equals the phase-A pose.
const KEY5 = (() => {
  const u = v3.norm(v3.sub(poseA(5), earthPos(5)));
  return [Math.atan2(u[0], -u[2]), Math.asin(u[1]), Math.log(v3.len(v3.sub(poseA(5), earthPos(5))))];
})();
const KEYS = [
  { t: 5.0, v: KEY5 },
  { t: 7.5, v: [-0.8866, 0.32, Math.log(7.2502)] },
  { t: 9.0, v: [-0.4966, 0.2, Math.log(0.793)] },
  { t: 10.0, v: [-0.3816, 0.235, Math.log(0.2151)] },
  { t: 10.8, v: [-0.3216, 0.255, Math.log(0.134)] },
];
// Designed screen paths (after roll) of the Sun and of the planet; the camera orientation is solved
// from them every frame (so both glide smoothly), the position comes from KEYS.
const SUNPATH = [
  { t: 5.0, v: [560, 485] },
  { t: 6.3, v: [480, 455] },
  { t: 7.5, v: [385, 410] },
  { t: 9.0, v: [305, 320] },
  { t: 10.0, v: [290, 250] },
  { t: 10.8, v: [280, 215] },
];
const EARTHPATH = [
  { t: 6.0, v: [1900, 900] },
  { t: 7.5, v: [1350, 640] },
  { t: 9.0, v: [1180, 600] },
  { t: 10.0, v: [1040, 600] },
  { t: 10.8, v: [960, 600] },
];

// rotation (rows r,u,f = camera axes in world coords) mapping world dirs a1->b1 exactly, a2->b2 in-plane
function triad(a1, a2, b1, b2) {
  const t2 = v3.norm(v3.cross(a1, a2)), t3 = v3.cross(a1, t2);
  const s2 = v3.norm(v3.cross(b1, b2)), s3 = v3.cross(b1, s2);
  return basisFrom([a1, t2, t3], [b1, s2, s3]);
}
// symmetric two-vector fit
function fit2(a1, a2, b1, b2) {
  const m = v3.norm(v3.add(a1, a2)), n = v3.norm(v3.cross(a1, a2)), k = v3.cross(m, n);
  const mb = v3.norm(v3.add(b1, b2)), nb = v3.norm(v3.cross(b1, b2)), kb = v3.cross(mb, nb);
  return basisFrom([m, n, k], [mb, nb, kb]);
}
// Q = B * A^T; rows of Q are the camera axes (world coords)
function basisFrom(Af, Bf) {
  const row = (i) => v3.add(v3.add(v3.mul(Af[0], Bf[0][i]), v3.mul(Af[1], Bf[1][i])), v3.mul(Af[2], Bf[2][i]));
  return { r: row(0), u: row(1), f: row(2) };
}
function orthoBlend(A, B, t) {
  const f = v3.norm(v3.lerp(A.f, B.f, t));
  let u = v3.lerp(A.u, B.u, t);
  u = v3.norm(v3.sub(u, v3.mul(f, v3.dot(u, f))));
  return { f, u, r: v3.cross(u, f) };
}

export function camAt(lt) {
  const shift = smoother(1.0, 4.9, lt);
  let ox = -400 * shift, oy = -55 * shift;
  let roll = -0.045 * shift + 0.006 * Math.sin(lt * 0.7);
  if (lt <= 5.0) return makeCam(poseA(lt), [0, 0, 0], { F: 1500, roll, ox, oy });
  const F = 1500;
  const E = earthPos(lt);
  const [az, el, ld] = spline(KEYS, Math.min(lt, 10.8));
  // beyond 10.8 keep creeping in slowly (the 2D descent takes over)
  const d = Math.exp(ld) * (lt > 10.8 ? Math.exp(-(lt - 10.8) * 0.25) : 1);
  const P = v3.add(E, v3.mul(dirOf(az, el), d));
  // lens shift relaxes to the centre, roll leans into the approach
  const rel = smoother(5.0, 8.5, lt);
  ox *= 1 - rel;
  oy *= 1 - rel;
  roll = lerp(roll, 0.08, smoother(7.0, 10.8, lt));
  const cr = Math.cos(-roll), sr = Math.sin(-roll);
  const ray = ([x, y]) => {
    const dx = x - (960 + ox), dy = y - (540 + oy);
    const ux = dx * cr - dy * sr, uy = dx * sr + dy * cr;
    return v3.norm([ux / F, -uy / F, 1]);
  };
  const toSun = v3.norm(v3.mul(P, -1)), toEarth = v3.norm(v3.sub(E, P));
  // camera->world: we need rows = axes. triad works in world<-camera terms: map camera rays to world dirs
  const QA = triad(toSun, [0, 1, 0], ray(spline(SUNPATH, lt)), [0, 1, 0]);
  const h = smoother(6.4, 8.0, lt);
  let basis = QA;
  if (h > 0) {
    const QB = fit2(toSun, toEarth, ray(spline(SUNPATH, lt)), ray(spline(EARTHPATH, lt)));
    basis = orthoBlend(QA, QB, h);
  }
  return makeCam(P, null, { F, roll, ox, oy, basis });
}
