// SEA — the creature: pose over time (embryo -> fish -> tetrapod) and its per-frame painting.
import { C } from '../lib/palette.js';
import { M, TAU, lerp, clamp, invLerp, ease, seg, bump, rng, track, mixHex, capsule, smoothPath, resampleClosed, lerpPoly } from './lib.js';
import { spine, bodyPt, outline, widths, frameAt, pecFin, legShape, NS } from './rig.js';
import { cluster } from './cells.js';
import { headAt } from './path.js';

export const CT = {
  form0: 5.0, form1: 5.95,   // the morula elongates into the embryo
  unf0: 6.15, unf1: 6.95,    // the embryo unfurls into a fish
  eye0: 6.0, eye1: 6.6,      // 58.75: the eye opens
  fin0: 6.2, fin1: 7.0,
  cstart: 7.2, dart: 7.5,    // 60.0 the fish darts off
  slow: 12.5,                // 65.0 shallows
  leg0: 13.1, leg1: 14.4,    // 66.25 fins -> legs
  land: 15.0,                // 67.5 first step on land
  lift0: 16.2,               // head rises for the close-up
};
// head (snout) travels along the swim path (arc length + speed profile); before 6.9 it is held
const HEAD = (t) => { const h = headAt(t); return [h.x, h.y]; };
export const EYE_K = 0.032; // eye radius / L

export function pose(t) {
  const cl = cluster(Math.min(t, 7));
  const formU = seg(t, CT.form0, CT.form1, ease.inOutSine);
  const unf = seg(t, CT.unf0, CT.unf1, ease.inOutCubic);
  const grow = seg(t, 5.0, 9.0, ease.inOutSine);
  const m = seg(t, CT.leg0, CT.leg1, ease.inOutSine);
  const L = lerp(760, 1000, grow) * lerp(1, 1.1, m);
  let x, y, th;
  // swim wave: amplitude / frequency by phase
  const swim = seg(t, CT.dart - 0.05, CT.dart + 0.25, ease.outCubic) * (1 - 0.55 * seg(t, CT.slow, CT.leg1, ease.inOutSine));
  const hover = seg(t, CT.unf1 - 0.3, CT.dart, ease.inOutSine);
  const freq = lerp(1.6, 2.4, swim) * (t < 8.2 ? lerp(1.6, 1, seg(t, 7.5, 8.2)) : 1);
  // integrate phase approximately (freq changes slowly except at the dart burst)
  const ph = TAU * (t * 1.9 + 0.9 * seg(t, 7.35, 8.3, ease.inOutSine));
  let A = 0.05 * hover + 0.2 * swim;
  A *= 1 - 0.6 * m;
  let curl = lerp(2.5 * formU, 0, unf);
  // C-start before the dart: bend, then snap straight
  const cs = bump(t, CT.cstart, CT.dart + 0.18);
  curl += 0.85 * cs * (t < CT.dart ? 1 : -0.6);
  if (t < 6.9) {
    th = lerp(-0.25, -0.05, unf);
    // centre the curled body on the cluster
    const hx = cl.x + Math.cos(th) * L * 0.5, hy = cl.y + Math.sin(th) * L * 0.5;
    x = hx; y = hy;
    const p = { x, y, th, L, curl, A, k: 1.1, ph, m, emb: 1 - unf, breath: 0 };
    const sp = spine(p);
    let mx = 0, my = 0;
    for (const q of sp) { mx += q.x; my += q.y; }
    mx /= sp.length; my /= sp.length;
    // blend from "centred on cluster" (embryo) to "head on the path" (fish)
    const h0 = HEAD(6.9);
    const w = seg(t, 6.3, 6.9, ease.inOutSine);
    x = lerp(x + cl.x - mx, h0[0], w);
    y = lerp(y + cl.y - my, h0[1], w);
    th = lerp(th, pathAngle(6.9), w);
  } else {
    const h = HEAD(t);
    x = h[0]; y = h[1];
    th = pathAngle(t);
  }
  // everything comes to rest for the final close-up (the eye must be perfectly still at 70.0)
  const still = 1 - seg(t, 16.7, 17.35, ease.inOutSine);
  A *= still;
  // head wobble (recoil) and head lift at the end
  const wob = A * 0.28 * Math.sin(-ph + 0.4);
  const lift = seg(t, CT.lift0, 17.3, ease.inOutSine);
  th += wob - 0.22 * lift;
  // walking gait
  const walk = seg(t, CT.leg0 + 0.6, CT.land, ease.inOutSine) * (1 - seg(t, 16.5, 17.2, ease.inOutSine));
  const gait = TAU * (t - CT.land) / 1.25; // one full cycle = 2 beats per leg pair
  const bend = (s) => walk * 0.12 * Math.sin(gait + s * 2.2) * s;
  return {
    t, x, y, th, L, curl, A, k: 1.1, ph, m, emb: 1 - unf, breath: 0.015 * Math.sin(t * 2.3) * still,
    formU, unf, walk, gait, lift, bend,
    fins: seg(t, CT.fin0, CT.fin1, ease.outCubic),
    eye: ease.outBack(clamp(invLerp(CT.eye0, CT.eye1, t)), 1.6),
    paintU: seg(t, 6.05, 7.1, ease.inOutSine),
  };
}
export { HEAD };
export function pathAngle(t) {
  return headAt(t).a;
}
// Eye position / radius in world at pose p.
export function eyeOf(p, sp = spine(p)) {
  const s = lerp(0.075, 0.07, p.m), v = lerp(-0.42, -0.62, p.m);
  const [x, y] = bodyPt(p, sp, s, v);
  return { x, y, r: EYE_K * p.L / lerp(1, 1.1, p.m) * p.eye };
}
