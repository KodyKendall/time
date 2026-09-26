// CITY — camera path (pure function of local time).
// Orbit parametrisation: look-at target T, distance D, yaw, pitch, focal f. Every parameter is a sum
// of overlapping eased ramps, so the motion is C1-smooth everywhere and starts / ends at rest.
import { makeCam } from './gl3d.js';
import { ease, clamp, lerp } from '../../engine/math.js';
import { BAND, bw, MAIN, TOWER, VILLAGE, BUILDINGS } from './layout.js';

// centroid of the village cottages (the camera frames them while they pop up)
const VILLAGE_C = (() => {
  const hs = BUILDINGS.filter((b) => b.house);
  let s = 0, o = 0;
  for (const b of hs) { s += (b.s0 + b.s1) / 2; o += (b.o0 + b.o1) / 2; }
  return bw(s / hs.length, o / hs.length + 20, 0);
})();

export const H0 = 1304; // camera height (= focal) that reproduces the pivot at lt = 0

const ramp = (lt, a, b, e = ease.inOutSine) => e(clamp((lt - a) / (b - a)));
// C1 ramp that starts slowly and leaves with velocity (for handing momentum to the next ramp)
const inRamp = (lt, a, b) => ease.inOutSine(clamp((lt - a) / (b - a)));

// Clock geometry shared with the clock module (world units)
export const CLOCK = (() => {
  const s = TOWER.front, o = MAIN.oc, z = TOWER.dialZ;
  const sigma = TOWER.dialR / 800; // clock-units (dial radius 800) -> world units
  const gearDepth = 1800 * sigma;  // main gear deep behind the dial: the camera flies in through the opened dial
  const dEnd = 1500 * sigma;       // final camera distance to the main gear (f = 1500 -> scale 1)
  return { s, o, z, sigma, gearDepth, dEnd, dial: bw(s, o, z), gear: bw(s + gearDepth, o, z) };
})();

export function camParams(lt) {
  // ---- target
  const t0 = [960, 540, 0];
  const v = VILLAGE_C;
  const city = bw(140, MAIN.oc + 40, 0);
  const street = bw(260, MAIN.oc, 64);
  const dial = CLOCK.dial, gear = CLOCK.gear;
  const kV = ramp(lt, 0.0, 2.15);
  const kC = ramp(lt, 1.95, 4.0);
  const kS = ramp(lt, 3.55, 5.2);
  const kD = ramp(lt, 5.0, 7.35);
  const kG = ramp(lt, 8.8, 10, ease.inOutSine);
  const T = [0, 1, 2].map((i) => {
    let x = t0[i];
    x += (v[i] - t0[i]) * kV;
    x += (city[i] - v[i]) * kC;
    x += (street[i] - city[i]) * kS;
    x += (dial[i] - street[i]) * kD;
    x += (gear[i] - dial[i]) * kG;
    return x;
  });
  // ---- distance (log space): push in on the village, pull out over the growing city, swoop down
  const L = Math.log;
  let lD = L(H0);
  lD += (L(700) - L(H0)) * ramp(lt, 0.0, 2.2);
  lD += (L(1850) - L(700)) * ramp(lt, 2.05, 4.0);
  lD += (L(430) - L(1850)) * ramp(lt, 3.65, 5.25);
  lD += (L(118) - L(430)) * ramp(lt, 5.05, 7.35);
  lD += (L(104) - L(118)) * ramp(lt, 7.2, 8.75, ease.inOutSine);
  lD += (L(CLOCK.dEnd) - L(104)) * kG;
  // ---- yaw / pitch / focal
  let yaw = 0.34 * ramp(lt, 0.05, 2.9);
  yaw += (BAND.yaw - 0.34) * ramp(lt, 2.5, 4.8);
  let pitch = -Math.PI / 2;
  pitch += (Math.PI / 2 - 1.06) * ramp(lt, 0.15, 2.3);   // gentle pre-tilt: the village seen obliquely
  pitch += (1.06 - 1.0) * ramp(lt, 2.1, 3.9);
  pitch += (1.0 + 0.07) * ramp(lt, 3.6, 5.15);          // the swoop down into the street
  pitch += (0 - 0.07) * ramp(lt, 5.1, 7.3);
  let f = H0;
  f += (1080 - H0) * ramp(lt, 3.6, 5.1);
  f += (1500 - 1080) * ramp(lt, 5.1, 7.4);
  return { T, D: Math.exp(lD), yaw, pitch, f };
}

export function camAt(lt) {
  const { T, D, yaw, pitch, f } = camParams(lt);
  const hx = Math.sin(yaw), hy = -Math.cos(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const fwd = [cp * hx, cp * hy, sp];
  const pos = [T[0] - fwd[0] * D, T[1] - fwd[1] * D, T[2] - fwd[2] * D];
  return makeCam(pos, yaw, pitch, f);
}
