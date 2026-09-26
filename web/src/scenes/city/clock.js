// CITY — the town hall, the clock tower, its dial / hands / split plates and the clockwork inside.
// Clock-face geometry lives in "clock units" (dial radius 800) mapped into the world by SIGMA.
import { C } from '../lib/palette.js';
import { PIVOT } from '../pivots.js';
import { lerp, clamp, hex, rng } from '../lib/kit.js';
import { ease, smoothstep, TAU } from '../../engine/math.js';
import { BAND, bw, TOWER, HALL, MAIN } from './layout.js';
import { CLOCK } from './camera.js';
import { DIAL, HANDS, TW, GEARS } from './paintClock.js';
import { facadeSize } from './paintFacade.js';
import { HALL_SPEC, SIDES } from './catalog.js';
import { hipRoof, faceTint, wall } from './world.js';

const AX = BAND.ax, AY = BAND.ay, NX = BAND.nx, NY = BAND.ny;
const SIG = CLOCK.sigma;                      // world units per clock unit
const T0 = 107.5;                             // segment start (global)
const P3 = (s, o, z) => [BAND.ox + s * AX + o * NX, BAND.oy + s * AY + o * NY, z];
const FRONT = TOWER.front;                    // s of the tower's front face
const OC = TOWER.o;

// ------------------------------------------------------------------------------------------------
// time: the minute hand (in minutes from XII) ticks on beats that accelerate until midnight
// ------------------------------------------------------------------------------------------------
const TICKS = [
  [112.5, 1], [113.125, 1],
  [113.75, 2], [114.375, 3], [115.0, 5],                 // quarter notes
  [115.3125, 8], [115.625, 12], [115.9375, 18],          // eighths
  [116.015625, 40], [116.09375, 50], [116.171875, 60],   // thirty-seconds: a blur of hours
  [116.25, 50],                                           // CLUNK: midnight
];
export const CLUNK = 116.25;
const M0 = 720 - TICKS.reduce((a, t) => a + t[1], 0);    // 7:50 pm
export function minuteAt(t) {
  let m = M0;
  for (let i = 0; i < TICKS.length; i++) {
    const [tk, d] = TICKS[i];
    if (t <= tk) break;
    const next = i + 1 < TICKS.length ? TICKS[i + 1][0] : tk + 0.5;
    const dur = Math.min(0.16, 0.72 * (next - tk));
    const u = clamp((t - tk) / dur);
    const e = i === TICKS.length - 1 ? ease.outBack(u, 2.6) : ease.outBack(u, 1.4);
    m += d * e;
  }
  return m;
}
export function tickTimes() { return TICKS.map((t) => t[0]); }

// plates: unlatch jolt at the clunk, then slide apart (clock units)
export function plateOpen(t) {
  if (t <= CLUNK) return 0;
  const jolt = 22 * ease.outBack(clamp((t - CLUNK - 0.02) / 0.1), 3) * (1 - smoothstep(CLUNK + 0.14, CLUNK + 0.3, t));
  const slide = 1900 * ease.inOutCubic(clamp((t - CLUNK - 0.16) / 0.95));
  return jolt + slide;
}

// ------------------------------------------------------------------------------------------------
// growth of the hall and the tower (stacking upwards like the rest of the town)
// ------------------------------------------------------------------------------------------------
const HSZ = facadeSize(HALL_SPEC);
export function hallHeight(lt) { return HSZ.th * ease.inOutSine(clamp((lt - 2.75) / 0.9)); }
export function towerHeight(lt) {
  const top = TW.H + TW.belfry + 120; // body + belfry + spire
  return top * ease.inOutSine(clamp((lt - 3.0) / 1.35));
}
// the dial grows into its frame once the clock stage of the tower has been built
const T_PANEL = (() => { let lt = 3; while (towerHeight(lt) < TW.panel.z1 && lt < 5) lt += 0.005; return lt; })();
export function dialScale(lt) { return ease.outBack(clamp((lt - T_PANEL) / 0.45), 1.5); }

// point on the tower front plane: o offset (right), z, and depth behind the front face
const onFront = (du, z, depth = 0) => P3(FRONT + depth, OC + du, z);
// clock-plane point (clock units u right, v down, from the dial centre), depth behind the dial plane
const onDial = (u, v, depth = 0) => onFront(u * SIG, TOWER.dialZ - v * SIG, depth);

function dialQuad(r3, tex, o, depth, offV = 0, extra = {}, ds = 1) {
  const h = (DIAL.S / 2) * ds;
  const pts = [onDial(-h, -h + offV, depth), onDial(h, -h + offV, depth), onDial(h, h + offV, depth), onDial(-h, h + offV, depth)];
  r3.poly(tex, pts, [[0, 0], [1, 0], [1, 1], [0, 1]], { ...o, ...extra });
}

function handQuad(r3, A, which, ang, depth, offV, tint, ds = 1) {
  const H = HANDS[which];
  const [c0, c1] = H.cell;
  const corners = [[c0, 0], [c1, 0], [c1, HANDS.h], [c0, HANDS.h]];
  const pts = corners.map(([x, y]) => {
    const lx = x - H.x, ly = y - H.y; // relative to the pivot (y down)
    const u = lx * Math.cos(ang) - ly * Math.sin(ang), v = lx * Math.sin(ang) + ly * Math.cos(ang);
    return onDial(u * ds, v * ds + offV, depth);
  });
  r3.poly(A.hands, pts, corners.map(([x, y]) => [x / HANDS.w, y / HANDS.h]), { tint });
}

// ------------------------------------------------------------------------------------------------
// the tower as a painter's-sort item
// ------------------------------------------------------------------------------------------------
export function towerItem(R, r3, A, cam, lt, L) {
  const c = bw(TOWER.s, TOWER.o);
  return { d2: (c[0] - cam.pos[0]) ** 2 + (c[1] - cam.pos[1]) ** 2 - 1e4, draw: () => drawTower(R, r3, A, cam, lt, L) };
}
export function hallItem(r3, A, cam, lt, L) {
  const c = bw((HALL.s0 + HALL.s1) / 2, (HALL.o0 + HALL.o1) / 2);
  return { d2: (c[0] - cam.pos[0]) ** 2 + (c[1] - cam.pos[1]) ** 2, draw: () => drawHall(r3, A, cam, lt, L) };
}
const SSZ1 = facadeSize(SIDES[1]);
function drawHall(r3, A, cam, lt, L) {
  const h = hallHeight(lt);
  if (h <= 0.5) return;
  const hb = Math.min(h, HSZ.Hb);
  const { s0, s1, o0, o1 } = HALL;
  const lamOf = (m) => Math.max(0, m[0] * -0.62 + m[1] * -0.78);
  const vis = (s, o, m) => { const p = P3(s, o, 0); return (cam.pos[0] - p[0]) * m[0] + (cam.pos[1] - p[1]) * m[1] > 0; };
  const side = A.sides[1];
  const litThr = 1 - 0.8 * smoothstep(3.4, 4.8, lt);
  // sides and back
  const sides = [[[s0, o0], [s1, o0], [-NX, -NY], s1 - s0], [[s0, o1], [s1, o1], [NX, NY], s1 - s0], [[s1, o0], [s1, o1], [AX, AY], o1 - o0]];
  for (const [p, q, m, len] of sides) {
    if (!vis((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, m)) continue;
    const reps = Math.max(1, Math.round(len / 140));
    for (let i = 0; i < reps; i++) {
      const a = [lerp(p[0], q[0], i / reps), lerp(p[1], q[1], i / reps)], b = [lerp(p[0], q[0], (i + 1) / reps), lerp(p[1], q[1], (i + 1) / reps)];
      wall(r3, side.tex, a, b, m, 0, hb, [0.02, 0.02 + len / reps / SSZ1.tw, 1 - hb / SSZ1.th, 1], { tint: faceTint(L, lamOf(m)) });
    }
  }
  // front facade (faces the street, -s)
  if (vis(s0, (o0 + o1) / 2, [-AX, -AY])) {
    const uv = [0, 1, 1 - h / HSZ.th, 1];
    const half = HSZ.tw / 2, oc = (o0 + o1) / 2;
    wall(r3, A.hall.tex, [s0, oc - half], [s0, oc + half], [-AX, -AY], 0, h, uv, { tint: faceTint(L, lamOf([-AX, -AY])) });
    if (L.night > 0.01) wall(r3, A.hall.lit, [s0, oc - half], [s0, oc + half], [-AX, -AY], 0, h, uv, { tint: [1.08, 0.96, 0.8, 1], mask: A.hall.mask, thr: litThr, soft: 0.02 });
  }
  hipRoof(r3, A.roofs[2], s0, s1, o0, o1, hb, 28 * Math.min(1, hb / HSZ.Hb), [0.1, 0.2], (lam) => faceTint(L, lam, true), cam, 3);
}

function drawTower(R, r3, A, cam, lt, L) {
  const h = towerHeight(lt);
  if (h <= 0.5) return;
  const t = T0 + lt;
  const half = TOWER.half;
  const s0 = FRONT, s1 = FRONT + 2 * half, o0 = OC - half, o1 = OC + half;
  const tint = (lam) => { const k = lerp(0.55, lam, L.contrast); return [lerp(L.shade[0], L.sun[0], k), lerp(L.shade[1], L.sun[1], k), lerp(L.shade[2], L.sun[2], k), 1]; };
  const hb = Math.min(h, TW.H);
  const vis = (px, py, mx, my) => (cam.pos[0] - px) * mx + (cam.pos[1] - py) * my > 0;
  // --- side and back faces of the body
  const faces = [
    [[s1, o0], [s1, o1], [AX, AY]], [[s0, o1], [s0, o0], [-AX, -AY]],
    [[s1, o1], [s0, o1], [NX, NY]], [[s0, o0], [s1, o0], [-NX, -NY]],
  ];
  for (const [p, q, m] of faces) {
    if (m[0] === -AX) continue; // the front is drawn separately (with its hole)
    const pw = P3((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0);
    if (!vis(pw[0], pw[1], m[0], m[1])) continue;
    const lam = Math.max(0, m[0] * -0.62 + m[1] * -0.78);
    r3.poly(A.towerSide, [P3(p[0], p[1], 0), P3(q[0], q[1], 0), P3(q[0], q[1], hb), P3(p[0], p[1], hb)], [[0, 1], [1, 1], [1, 1 - hb / TW.H], [0, 1 - hb / TW.H]], { tint: tint(lam) });
  }
  // --- a stone cap on the rising top (until the spire covers it)
  if (h < TW.H + TW.belfry + 1 && cam.pos[2] > Math.min(h, TW.H + TW.belfry)) {
    const zc = h < TW.H ? hb : Math.min(h, TW.H + TW.belfry);
    r3.poly(A.belfry, [P3(s0, o0, zc), P3(s1, o0, zc), P3(s1, o1, zc), P3(s0, o1, zc)], [[0.1, 0.15], [0.9, 0.15], [0.9, 0.55], [0.1, 0.55]], { tint: tint(0.55) });
  }
  // --- belfry and spire
  if (h > TW.H) {
    const hbf = Math.min(h, TW.H + TW.belfry);
    for (const [p, q, m] of faces) {
      const pw = P3((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0);
      if (!vis(pw[0], pw[1], m[0], m[1])) continue;
      const lam = Math.max(0, m[0] * -0.62 + m[1] * -0.78);
      const fr = (hbf - TW.H) / TW.belfry;
      r3.poly(A.belfry, [P3(p[0], p[1], TW.H), P3(q[0], q[1], TW.H), P3(q[0], q[1], hbf), P3(p[0], p[1], hbf)], [[0, 1], [1, 1], [1, 1 - fr], [0, 1 - fr]], { tint: tint(lam) });
    }
  }
  if (h > TW.H + TW.belfry) {
    const zb = TW.H + TW.belfry, zt = h;
    const e = 4;
    const cs = [[s0 - e, o0 - e], [s1 + e, o0 - e], [s1 + e, o1 + e], [s0 - e, o1 + e]];
    const apex = P3(TOWER.s, OC, zt);
    const norms = [[-NX, -NY], [AX, AY], [NX, NY], [-AX, -AY]];
    for (let k = 0; k < 4; k++) {
      const p = cs[k], q = cs[(k + 1) % 4], m = norms[k];
      const nx = m[0] * (zt - zb), ny = m[1] * (zt - zb), nz = half + e;
      const cp = P3((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, zb);
      if ((cam.pos[0] - cp[0]) * nx + (cam.pos[1] - cp[1]) * ny + (cam.pos[2] - zb) * nz <= 0) continue;
      const lam = Math.max(0, m[0] * -0.62 + m[1] * -0.78);
      r3.poly(A.copper, [P3(p[0], p[1], zb), P3(q[0], q[1], zb), apex], [[0.1, 0.9], [0.7, 0.9], [0.4, 0.3]], { tint: tint(0.3 + 0.7 * lam) });
    }
  }
  // --- front face: the clockwork interior (only once the dial opens), plates / dial, hands, panel
  const open = plateOpen(t);
  const frontVis = vis(P3(FRONT, OC, 0)[0], P3(FRONT, OC, 0)[1], -AX, -AY);
  if (!frontVis) {
    // the camera has flown in through the dial: only the movement is in view
    if (open > 0) drawInterior(R, r3, A, cam, lt, t, open);
    return;
  }
  const ds = dialScale(lt);
  const dialUp = ds > 0.001;
  if (open > 0) drawInterior(R, r3, A, cam, lt, t, open);
  if (dialUp) {
    // backlit enamel at dusk, calmer as it fills the frame
    const glowK = smoothstep(3.8, 5.2, lt) * (1 - 0.75 * smoothstep(6.0, 7.4, lt));
    const dt = [1 + 0.55 * glowK, 0.97 + 0.42 * glowK, 0.9 + 0.2 * glowK, 1];
    const dialTint = [lerp(L.sun[0] * 0.9, 1, 0.6) * dt[0], lerp(L.sun[1] * 0.9, 1, 0.6) * dt[1], lerp(L.sun[2] * 0.9, 1, 0.6) * dt[2], 1];
    if (open <= 0) dialQuad(r3, A.dial, { tint: dialTint }, 0.4, 0, {}, ds);
    else {
      dialQuad(r3, A.dial, { tint: dialTint }, 0.4, -open, { mask: A.plates.top, mode: 1, thr: 0.5, soft: 0.02, uv2: [[0, 0], [1, 0], [1, 1], [0, 1]] });
      dialQuad(r3, A.dial, { tint: dialTint }, 0.4, open, { mask: A.plates.bot, mode: 1, thr: 0.5, soft: 0.02, uv2: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    }
    // hands (ride on the top plate once it opens)
    const m = minuteAt(t);
    const ht = [dialTint[0] * 0.9, dialTint[1] * 0.9, dialTint[2] * 0.9, 1];
    handQuad(r3, A, 'hour', (m / 720) * Math.PI * 2, -0.5, -open, ht, ds);
    handQuad(r3, A, 'min', (m / 60) * Math.PI * 2, -1.0, -open, ht, ds);
  }
  // front face: body below and above the clock panel, and the panel (with the hole)
  const lamF = Math.max(0, -AX * -0.62 + -AY * -0.78);
  const tf = tint(lamF);
  const warmK = smoothstep(4.5, 6.5, lt);
  const tp = [lerp(tf[0], 1.02, warmK), lerp(tf[1], 0.9, warmK), lerp(tf[2], 0.78, warmK), 1];
  const fz0 = TW.panel.z0, fz1 = TW.panel.z1;
  const quadF = (tex, z0, z1, v0, v1) => r3.poly(tex, [onFront(-half, z0, -0.2), onFront(half, z0, -0.2), onFront(half, z1, -0.2), onFront(-half, z1, -0.2)], [[0, v1], [1, v1], [1, v0], [0, v0]], { tint: tf });
  quadF(A.towerFront, 0, Math.min(hb, fz0), 1 - Math.min(hb, fz0) / TW.H, 1);
  if (hb > fz0) {
    const zt = Math.min(hb, fz1);
    const pv = (zt - fz0) / (fz1 - fz0);
    r3.poly(A.clockPanel, [onFront(-half, fz0, -0.3), onFront(half, fz0, -0.3), onFront(half, zt, -0.3), onFront(-half, zt, -0.3)], [[0, 1], [1, 1], [1, 1 - pv], [0, 1 - pv]], { tint: tp });
  }
  if (hb > fz1) quadF(A.towerFront, fz1, hb, 1 - hb / TW.H, 1 - fz1 / TW.H);
}

// ------------------------------------------------------------------------------------------------
// the clockwork: dark interior, surrounding gears (fly past), the main gear = PIVOT.gear
// ------------------------------------------------------------------------------------------------
const ORBIT = [
  // clock units: offset (u right, v down) from the dial centre, depth behind the dial (world), radius (clock units), gear, speed
  // near ones pass the lens as the camera flies in; the deep ones slide out of frame
  { u: -640, v: 380, depth: 8, r: 330, g: 0, spin: 0.35 },
  { u: 700, v: -330, depth: 14, r: 250, g: 1, spin: -0.9 },
  { u: 540, v: 500, depth: 20, r: 210, g: 2, spin: 0, escape: true },
  { u: -440, v: -560, depth: 5, r: 170, g: 3, spin: 1.6 },
  { u: 80, v: 860, depth: 26, r: 260, g: 0, spin: -0.5 },
  { u: -380, v: 720, depth: 34, r: 150, g: 3, spin: -2.2 },
  { u: -940, v: 180, depth: 58, r: 300, g: 1, spin: 0.6 },
  { u: 960, v: 380, depth: 66, r: 240, g: 0, spin: -0.45 },
];
const ESC = { u: 540, v: 500, depth: 20 };
// escapement: the escape wheel steps on 16th notes after the clunk; the anchor rocks with it
const escStep = (t) => Math.max(0, (t - CLUNK) / 0.15625);
function escAngle(t) {
  const s = escStep(t), i = Math.floor(s), f = s - i;
  return (i + ease.outBack(Math.min(1, f * 2.2), 2)) * (Math.PI * 2 / 28);
}
function anchorAngle(t) {
  const s = escStep(t), i = Math.floor(s), f = Math.min(1, (s - i) * 2.2);
  const side = (k) => (k % 2 ? 1 : -1) * 0.13;
  return lerp(side(i + 1), side(i), 1 - ease.outBack(f, 1.6));
}
const DUST = (() => {
  const r = rng('city-clock-dust');
  return Array.from({ length: 180 }, () => ({ u: r(-800, 800), v: r(-700, 700), d: r(4, 80), s: r(1.2, 3.2), ph: r(0, TAU), f: r(0.3, 0.9), b: r(0.3, 1) }));
})();

function quadAt(r3, tex, u, v, depth, hw, hh, ang, pu = 0.5, pv = 0.5, tint = [1, 1, 1, 1]) {
  // layer quad with its pivot (pu, pv in 0..1) at clock point (u, v), rotated by ang
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const pts = corners.map(([x, y]) => {
    const lx = (x - pu) * 2 * hw, ly = (y - pv) * 2 * hh;
    const uu = lx * Math.cos(ang) - ly * Math.sin(ang), vv = lx * Math.sin(ang) + ly * Math.cos(ang);
    return onDial(u + uu, v + vv, depth);
  });
  r3.poly(tex, pts, corners, { tint });
}

function drawInterior(R, r3, A, cam, lt, t, open) {
  const gd = CLOCK.gearDepth;
  // backdrop just behind the main gear (only seen through the hole)
  const bh = 130;
  r3.poly(A.flatTex, [onFront(-bh, TOWER.dialZ + bh, gd + 3), onFront(bh, TOWER.dialZ + bh, gd + 3), onFront(bh, TOWER.dialZ - bh, gd + 3), onFront(-bh, TOWER.dialZ - bh, gd + 3)], [[0, 0], [1, 0], [1, 1], [0, 1]], { tint: [...hex(C.night), 1] });
  r3.flush();
  // main gear: exactly the pivot's painting, projected
  const G = CLOCK.gear;
  const sp = cam.toScreen(G[0], G[1], G[2]);
  const k = (cam.f / sp[2]) * SIG;
  const openK = smoothstep(CLUNK, CLUNK + 1.0, t);
  R.glow(sp[0], sp[1], 700 * k, hex(C.navy2), 0.35 * openK, { ext: 2 });
  // warm light spilling in as the plates part (decays before the hand-off)
  const spill = smoothstep(CLUNK + 0.05, CLUNK + 0.35, t) * (1 - smoothstep(116.7, 117.35, t));
  if (spill > 0) {
    const lp = cam.toScreen(...onDial(-250, -420, gd - 6));
    R.glow(lp[0], lp[1], 900 * k, [1, 0.72, 0.42], 0.22 * spill, { ext: 2.2, shape: [1, 0.4, 1.5] });
  }
  const GA = R.engine.ensure(PIVOT.gear);
  PIVOT.gear.drawGear(R, GA, sp[0], sp[1], k, PIVOT.gear.angle(t));
  // escapement anchor rocking over the escape wheel (behind the other furniture)
  const ga = [1.05, 0.98, 0.9, 1];
  quadAt(r3, A.move.anchor, ESC.u, ESC.v - 210 - 70, ESC.depth - 0.5, 0.5 * 700 * 0.62, 0.5 * 520 * 0.62, anchorAngle(t), 350 / 700, 90 / 520, ga);
  // surrounding gears (in front of the main gear): parallax carries them out of frame
  const items = ORBIT.map((o) => ({ o, d: o.depth })).sort((a, b) => b.d - a.d);
  for (const { o } of items) {
    const ang = o.escape ? escAngle(t) : o.spin * (t - 117.5);
    const half = 500 * (o.r / 380);
    quadAt(r3, A.gears[o.g], o.u, o.v, o.depth, half, half, ang, 0.5, 0.5, ga);
  }
  // brass pillars framing the movement
  for (const u of [-720, 720]) quadAt(r3, A.move.pillar, u, 0, 1.2, 70, 800, 0, 0.5, 0.5, [1, 0.95, 0.88, 1]);
  r3.flush();
  // dust motes turning in the light
  const dk = smoothstep(CLUNK + 0.1, CLUNK + 0.5, t) * (1 - smoothstep(116.95, 117.4, t));
  if (dk > 0) {
    const out = [];
    for (const d of DUST) {
      const u = d.u + 40 * Math.sin(t * d.f + d.ph), v = d.v - 30 * (t - CLUNK) + 25 * Math.cos(t * d.f * 0.7 + d.ph);
      const w = onDial(u, v, d.d);
      const s = cam.toScreen(w[0], w[1], w[2]);
      if (s[2] < 2) continue;
      const size = Math.min(70, (0.35 * d.s * cam.f) / s[2]);
      const near = smoothstep(2, 10, s[2]);
      out.push([s[0], s[1], size, 0, 1, 0.86, 0.6, 0.55 * dk * d.b * near]);
    }
    R.particles(out, { kind: 'glow', blend: 'add' });
  }
}
