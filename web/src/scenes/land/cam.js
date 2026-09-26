// LAND — 2.5D camera. Every layer is designed in "final frame" coordinates (how it looks with the
// camera at rest) and lives on a depth plane d (dino plane d = 1, sky d = Infinity).
// Camera: dolly cz (towards the dino plane), lateral cx/cy (in d=1 units), tilt ty (uniform
// screen shift, positive = camera looks up), roll, shake.
//   screen = C + shake + R(roll) * ( k (p - C) + (-cx, -cy)/(d - cz) + (0, ty) ),  k = d / (d - cz)
import { M, lerp, clamp, smoothstep, ease, noise1, invLerp, T, decay, rampInt } from './util.js';
import { EYE } from '../pivots.js';
import { restEye, bodyProg, walkThud, pose } from './dino.js';

export const TY_END = 1500;   // total tilt at the end (pivot sky sits this far above the forest)
// Walk: the dinosaur walks INTO its impact spot. The camera pans a little with it (parallax) and
// arrives exactly on the impact framing (camera x = CX_END when the walk ends).
const FOLLOW = 90, CX_END = 120.96;

// Pull-back progress in log-zoom: trapezoidal velocity (sine ramps), so the peak zoom rate (and
// with it the zoom blur) stays as low as possible. Starts and ends at zero speed (the sea segment's
// push-in also arrives at zero speed).
const RA0 = 0.24, RB0 = 0.34;
function pullZoom(u) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const a = RA0, b = RB0, n = 1 - a / 2 - b / 2;
  let s;
  if (u < a) s = a * (u / a - Math.sin(Math.PI * u / a) / Math.PI) / 2;
  else if (u < 1 - b) s = a / 2 + (u - a);
  else { const v = (u - (1 - b)) / b; s = a / 2 + (1 - a - b) + b * (v + Math.sin(Math.PI * v) / Math.PI) / 2; }
  return s / n;
}

export function camState(lt) {
  // anchor: the live eye while we are close (any head motion is compensated), then the rest pose
  const E0 = restEye();
  const w = smoothstep(0.4, 1.8, lt);
  const EL = w < 1 ? pose(lt).eye : E0;
  const E = { x: lerp(EL.x, E0.x, w), y: lerp(EL.y, E0.y, w), r: E0.r };
  const Z0 = EYE.R / E.r;
  // ---- 1. pull-back (dolly out from the eye)
  const u = clamp(lt / T.pullEnd);
  const e = pullZoom(u);
  const k = Math.exp(Math.log(Z0) * (1 - e));
  let cz = 1 - 1 / k;
  // eye glides from the frame centre to its place in the wide shot
  const g = ease.inOutSine(clamp((lt - 0.15) / (T.pullEnd - 0.15)));
  const sx = lerp(960, E0.x - (CX_END - FOLLOW), g), sy = lerp(540, E.y, g);
  let cx = E.x - 960 - (sx - 960) / k;
  let cy = E.y - 540 - (sy - 540) / k;
  // ---- 2. pan gently with the walk (the dinosaur itself crosses ~350 units of screen)
  cx += FOLLOW * bodyProg(lt);
  const thud = walkThud(lt);
  // slow lateral drift so the camera is never dead-still
  cx += 18 * smoothstep(1.5, 15, lt) * Math.sin(lt * 0.23);
  // ---- 3. anticipation: push in a little and tilt up with the dinosaur's gaze
  const look = ease.inOutSine(clamp((lt - T.look0) / (T.impact - 0.15 - T.look0)));
  cz += 0.04 * look;
  let ty = 105 * look;
  cx += 40 * look;
  // ---- 4. impact: blast recoil (camera pushed back), settles
  const ti = lt - T.impact;
  if (ti > 0) {
    const kick = 1 - Math.exp(-ti * 5);
    cz -= 0.07 * kick * Math.exp(-Math.max(0, ti - 1.2) * 0.5);
    cz += 0.035 * smoothstep(1.2, 5, ti);
  }
  // ---- 5. final tilt up into the smoke (ends exactly on the pivot sky)
  const tt = ease.inOutCubic(clamp((lt - T.tilt0) / (T.end - T.tilt0)));
  ty = lerp(ty, TY_END, tt);
  cy -= 120 * tt;           // slight crane up for parallax
  cz = lerp(cz, 0, smoothstep(T.tilt0, T.end, lt));
  // ---- shake
  let shAmp = 0;
  // footfalls: tiny thuds on the beat
  shAmp += thud * 1.6;
  if (ti > 0) shAmp += 14 * Math.exp(-ti * 3.2) + 9 * Math.exp(-Math.abs(lt - T.wavePass) * 4) * smoothstep(T.impact + 0.8, T.wavePass, lt);
  shAmp *= 1 - smoothstep(T.end - 1.2, T.end - 0.3, lt);
  const shx = shAmp * noise1(lt * 26, 11), shy = shAmp * noise1(lt * 26, 12) + thud * 2.2;
  const roll = 0.004 * shAmp * noise1(lt * 17, 13) + 0.006 * Math.sin(lt * 0.31) * smoothstep(1.5, 4, lt) * (1 - smoothstep(T.tilt0, T.end - 0.4, lt));
  return { cz, cx, cy, ty, roll, shx, shy, zoom: k };
}

// World (final-frame coords on plane d) -> screen matrix. null when the plane is behind the camera.
export function depthM(c, d) {
  let k = 1, ox = 0, oy = 0;
  if (d !== Infinity) {
    const dz = d - c.cz;
    if (dz <= 0.006) return null;
    k = d / dz;
    ox = -c.cx / dz;
    oy = -c.cy / dz;
  }
  return M.chain(M.translate(960 + c.shx, 540 + c.shy), M.rotate(c.roll), M.translate(ox, oy + c.ty), M.scale(k), M.translate(-960, -540));
}
// Scale of plane d on screen.
export function depthK(c, d) {
  if (d === Infinity) return 1;
  const dz = d - c.cz;
  return dz <= 0.006 ? Infinity : d / dz;
}
