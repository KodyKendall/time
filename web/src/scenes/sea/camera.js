// SEA — camera: world point at screen centre (x, y) + zoom z (no roll). Pure function of time.
// 0-5 s: on the cell(s), push in for mitosis, pull back as the cells divide; 5-7.5: frame the embryo;
// 7.5-13: track the fish; 13-17.5: eye-anchored exponential push-in ending exactly on PIVOT.eye.
import { EYE } from '../pivots.js';
import { M, lerp, clamp, invLerp, ease, seg, track, DUR } from './lib.js';
import { HEAD, pathAngle, pose, eyeOf } from './creature.js';

const CELLCAM = track([
  [0, [960, 540, Math.log(1)]],
  [1.6, [960, 540, Math.log(1.2)]],
  [2.7, [960, 545, Math.log(1.02)]],
  [5.0, [990, 560, Math.log(0.66)]],
  [6.4, [1080, 560, Math.log(0.6)]],
  [7.6, [1250, 520, Math.log(0.58)]],
]);
const ZTRACK = track([
  [7.0, Math.log(0.58)],
  [9.0, Math.log(0.6)],
  [11.5, Math.log(0.66)],
  [13.0, Math.log(0.74)],
  [15.0, Math.log(0.9)],
]);
export const PUSH0 = 13.0;
export const Z_REF = 0.7; // zoom at which depth-plane factors are defined

function trackCam(lt) {
  const lag = 0.3;
  const t = Math.max(6.9, lt - lag);
  const h = HEAD(t), a = pathAngle(t);
  // (the lag makes the dart outrun the camera for a moment, then it catches up)
  const L = lerp(760, 1000, seg(lt, 5.0, 9.0, ease.inOutSine));
  const lead = 170;
  return { x: h[0] - Math.cos(a) * (L * 0.46 - lead), y: h[1] - Math.sin(a) * (L * 0.46 - lead) + 40, z: Math.exp(ZTRACK(lt)) };
}
function baseCam(lt) {
  const k = CELLCAM(lt);
  let c = { x: k[0], y: k[1], z: Math.exp(k[2]) };
  const w = seg(lt, 6.6, 7.9, ease.inOutSine);
  if (w > 0) {
    const tr = trackCam(lt);
    c = { x: lerp(c.x, tr.x, w), y: lerp(c.y, tr.y, w), z: Math.exp(lerp(Math.log(c.z), Math.log(tr.z), w)) };
  }
  // gentle hand-held drift (zero at the start)
  const d = seg(lt, 0, 1.5, ease.inOutSine) * (1 - seg(lt, 15.5, 17, ease.inOutSine));
  c.x += d * (7 * Math.sin(lt * 0.71) + 3 * Math.sin(lt * 1.9 + 1)) / c.z;
  c.y += d * (5 * Math.sin(lt * 0.53 + 1) + 2 * Math.sin(lt * 1.7)) / c.z;
  return c;
}
// Push-in progress curves.
const Fz0 = (u) => (1 - Math.cos(Math.PI * Math.pow(clamp(u), 1.9))) / 2;
const Fz = (u) => 1 - Math.pow(1 - Fz0(u), 1.6); // settles very softly onto the pivot framing
const Gs = (u) => ease.inOutSine(clamp(u / 0.86));

export function cam(lt) {
  lt = clamp(lt, 0, DUR);
  const b = baseCam(lt);
  if (lt <= PUSH0) return b;
  const P = pose(lt);
  const E = eyeOf(P);
  const u = invLerp(PUSH0, DUR, lt);
  const zEnd = EYE.R / E.r;
  const z = Math.exp(lerp(Math.log(b.z), Math.log(zEnd), Fz(u)));
  const sx0 = 960 + b.z * (E.x - b.x), sy0 = 540 + b.z * (E.y - b.y);
  const g = Gs(u);
  const sx = lerp(sx0, 960, g), sy = lerp(sy0, 540, g);
  return { x: E.x - (sx - 960) / z, y: E.y - (sy - 540) / z, z };
}
export const viewOf = (c) => M.chain(M.translate(960, 540), M.scale(c.z), M.translate(-c.x, -c.y));
// View for a depth plane d (1 = subject plane; >1 farther): pinhole-consistent zoom and parallax.
export function viewDepth(c, d) {
  if (d === 1) return viewOf(c);
  const zd = c.z / (1 + (d - 1) * c.z / Z_REF);
  return M.chain(M.translate(960, 540), M.scale(zd), M.translate(-c.x, -c.y));
}
