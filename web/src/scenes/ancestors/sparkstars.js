// ANCESTORS — sparks become stars. A subset of PIVOT.night's stars is born as embers from the
// campfire: each rises, drifts, cools and settles exactly into its star (position, size, colour,
// twinkle) before 97.5 s, so the last frame is exactly the pivot.
import { M, TAU, rng, lerp, clamp, smoothstep } from '../lib/kit.js';
import { ease, invLerp, noise1 } from '../../engine/math.js';
import { FIRE } from './land.js';
import { K, planeView, cam } from './timeline.js';

let PLAN = null;
function plan(stars) {
  if (PLAN) return PLAN;
  const r = rng('anc-sparkstars');
  const pick = [];
  stars.forEach((s, i) => {
    if (s.x < 60 || s.x > 1860 || s.y < 40 || s.y > 1060) return;
    const low = s.y > 380 ? 1 : 0.35;               // favour stars low in the final frame (seen settling)
    const bright = 0.35 + 0.65 * s.b;
    if (r() < 0.36 * low * bright) pick.push(i);
  });
  const list = pick.map((i) => {
    const s = stars[i];
    // stars nearer the horizon are reached later by the rising camera: launch them later
    const hy = clamp((s.y - 40) / 1020);
    const launch = Math.max(10.36, lerp(10.45, 11.6, 0.3 * r() + 0.7 * hy) + r(-0.12, 0.12));
    const dur = r(0.8, 1.05);
    return { i, launch, arrive: Math.min(12.3, launch + dur), ox: r(-50, 50), wob: r(18, 46), f: r(1.2, 2.6), ph: r(0, TAU), heat: r(0.7, 1) };
  });
  PLAN = { list, set: new Set(list.map((p) => p.i)) };
  return PLAN;
}
export function sparkStarSet(stars) { return plan(stars).set; }

// Ember position (screen) for spark p at local time lt: it rises out of the fire faster than the
// camera climbs, so on screen the sparks lead the tilt up into the sky.
function ember(p, lt, Vg) {
  const tau = lt - p.launch;
  const camRise = cam(p.launch).y - cam(lt).y;
  const wx = FIRE.x + p.ox * (1 + 5 * tau) + p.wob * Math.sin(tau * p.f * 3 + p.ph) * Math.min(1, tau * 3);
  const wy = FIRE.y - 90 - 1.3 * camRise - 240 * tau - 90 * tau * tau;
  return M.apply(Vg, wx, wy);
}
// Particles in SCREEN space (draw under the inverse view). t = global time.
export function sparkStarParticles(lt, t, stars) {
  const P = plan(stars);
  if (lt < 10.3) return [];
  const Vs = planeView(lt, K.sky), Vg = planeView(lt, K.ground), zs = Vs[0];
  const lt2 = lt - 0.035, Vs2 = planeView(lt2, K.sky), Vg2 = planeView(lt2, K.ground);
  const out = [];
  const pos = (p, s, l, V_s, V_g) => {
    const [sx, sy] = M.apply(V_s, s.x, s.y);
    const u = clamp((l - p.launch) / (p.arrive - p.launch));
    const [ex, ey] = ember(p, l, V_g);
    const e = ease.inOutCubic(smoothstep(0.12, 1, u));
    return [lerp(ex, sx, e), lerp(ey, sy, e), u];
  };
  for (const p of P.list) {
    if (lt < p.launch) continue;
    const s = stars[p.i];
    const tw = 1 - 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.f * 2.1 + s.ph));
    const starA = s.b * tw * 0.9;
    if (lt >= p.arrive) {
      const [sx, sy] = M.apply(Vs, s.x, s.y);
      out.push([sx, sy, s.s * 2.2 * zs, 0, s.col[0], s.col[1], s.col[2], starA]);
      continue;
    }
    const [x, y, u] = pos(p, s, lt, Vs, Vg);
    const tau = lt - p.launch;
    // cool: white-gold -> orange -> the star's own colour; size and brightness converge too
    const hot = [1, lerp(0.62, 0.9, p.heat), lerp(0.25, 0.55, p.heat)];
    const cu = smoothstep(0.4, 1, u);
    const col = [lerp(hot[0], s.col[0], cu), lerp(hot[1], s.col[1], cu), lerp(hot[2], s.col[2], cu)];
    const size = lerp(5.2 * p.heat, s.s * 2.2 * zs, cu);
    const a = lerp(2.0 * Math.min(1, tau * 6), starA, cu);
    out.push([x, y, size, 0, col[0], col[1], col[2], a]);
    // soft warm halo while the ember is hot
    if (cu < 0.999) out.push([x, y, size * 3.2, 0, 1, 0.55, 0.22, 0.22 * (1 - cu) * Math.min(1, tau * 6)]);
    // a short glowing trail behind the ember (fades as it settles)
    if (u < 0.85 && lt2 > p.launch) {
      const [x2, y2] = pos(p, s, lt2, Vs2, Vg2);
      for (let j = 1; j <= 3; j++) {
        const f = j / 4;
        out.push([lerp(x, x2, f * 1.6), lerp(y, y2, f * 1.6), size * (1 - 0.2 * j), 0, col[0], col[1] * 0.8, col[2] * 0.6, a * 0.45 * (1 - f) * (1 - cu)]);
      }
    }
  }
  return out;
}
