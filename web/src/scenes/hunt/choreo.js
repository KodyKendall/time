// HUNT — choreography: timeline, world geometry, ground projection, the hunters' rig kinematics,
// the spear's flight and the camera. Everything here is a pure function of local time `lt`.
//
// World model. The end pivot (PIVOT.fields) is a top-down view of the ground plane, so the ground
// plane's coordinates (gx, gy) ARE the pivot's world coordinates. The camera looks at that plane
// with an orthographic "elevation" e (e = 90° → straight down): a ground point with height h
// projects to the side-view world ("SW") as  (gx, GC + (gy − GC)·sin e − h·cos e)  — an affine map,
// so painted layers stay layers. During the hunt e = E0 (a low side view); after the spear lands
// the camera rises (e → 90°) and the SW space becomes the pivot's world exactly.
import { FIELDS } from '../pivots.js';
import { C } from '../lib/palette.js';
import { M, TAU, lerp, clamp, smoothstep, rng } from '../lib/kit.js';
import { ease, invLerp, hash32, noise1 } from '../../engine/math.js';

// Paint resolution guard: p5.brush drops strokes when a layer is painted below ~0.66 px per design
// unit (only happens at preview sizes). Keep every layer at >= 0.72 px/unit.
export const sc = (P, s) => Math.max(s, 0.72 / P.S);

export const T0 = 97.5;
export const DUR = 10;
export const EIGHTH = 0.3125;
export const T = {
  run: 1.25, // 98.75  first footfall in frame
  withdraw: 3.02, // javelin withdrawal starts
  plant: 3.4375, // 100.9375 block — front foot plants (eighth)
  release: 3.75, // 101.25 spear leaves the hand (whoosh)
  dawn: 5.0, // 102.5 dawn begins
  land: 6.25, // 103.75 the spear plunges into the soil (thud)
  furrow: 6.42, // the first furrow races out of the impact
  multiply: 7.5, // 105.0 furrows multiply
  crops: 7.95, // crops sprout
  rise0: 6.45, // camera starts rising
  rise1: 10.0, // top-down = PIVOT.fields
};

// ------------------------------------------------------------------------------------------------
// Smooth monotone cubic (PCHIP) through keys [[t, v], ...]; zero slope at the ends.
// ------------------------------------------------------------------------------------------------
export function pchip(keys) {
  const n = keys.length, ts = keys.map((k) => k[0]), vs = keys.map((k) => k[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]));
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] > 0) {
      const h0 = ts[i] - ts[i - 1], h1 = ts[i + 1] - ts[i];
      const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return (t) => {
    if (t <= ts[0]) return vs[0];
    if (t >= ts[n - 1]) return vs[n - 1];
    let i = 0;
    while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

// Hermite spline through [[s, x, y], ...] (Catmull-Rom tangents, non-uniform knots).
function splineXY(keys, s) {
  const n = keys.length;
  if (s <= keys[0][0]) return [keys[0][1], keys[0][2]];
  if (s >= keys[n - 1][0]) return [keys[n - 1][1], keys[n - 1][2]];
  let i = 0;
  while (s > keys[i + 1][0]) i++;
  const tan = (j, c) => {
    const a = keys[Math.max(0, j - 1)], b = keys[Math.min(n - 1, j + 1)];
    return (b[c] - a[c]) / (b[0] - a[0] || 1);
  };
  const k0 = keys[i], k1 = keys[i + 1], h = k1[0] - k0[0], u = (s - k0[0]) / h, u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return [1, 2].map((c) => h00 * k0[c] + h10 * h * tan(i, c) + h01 * k1[c] + h11 * h * tan(i + 1, c));
}

// ------------------------------------------------------------------------------------------------
// The pivot's fields (exact replica of PIVOT.fields' band layout, same seeded RNG)
// ------------------------------------------------------------------------------------------------
export const FA = FIELDS.angle;
export const FU = [Math.cos(FA), Math.sin(FA)]; // along the furrows (up-right on screen)
export const FO = [-Math.sin(FA), Math.cos(FA)]; // across the furrows (down-right on screen)
export const bandToWorld = (u, o) => [960 + u * FU[0] + o * FO[0], 540 + u * FU[1] + o * FO[1]];
export const worldToBand = (x, y) => {
  const dx = x - 960, dy = y - 540;
  return [dx * FU[0] + dy * FU[1], dx * FO[0] + dy * FO[1]];
};
export const BAND_M = [FU[0], FU[1], FO[0], FO[1], 960, 540]; // (u, o) -> ground
export const FIELD_M = M.translate(-340, -360); // pivot fields layer local -> ground
export const BANDS = (() => {
  const r = rng(hash32('pivot-fields/fields') ^ 0x9e3779b9);
  const cols = [C.leaf, C.sand, C.green, C.ochre, '#8a5a3a', C.olive, C.gold, C.moss, C.sage];
  const out = [];
  let off = -1500;
  while (off < 1500) {
    const w = r(150, 320);
    out.push({ off, w, col: cols[out.length % cols.length], n: Math.floor(w / 14) });
    off += w;
  }
  return out;
})();
// wiggly band boundary offset at along-coordinate u (matches the pivot's 17-point polyline)
export function boundaryO(off, u) {
  const k = clamp((u + 1600) / 200, 0, 16), i = Math.min(15, Math.floor(k)), f = k - i;
  return off + lerp(10 * Math.sin(i * 0.9 + off), 10 * Math.sin((i + 1) * 0.9 + off), f);
}
export const LINES = BANDS.flatMap((b, bi) => {
  const a = [];
  for (let i = 1; i < b.n; i++) a.push({ o: b.off + (b.w * i) / b.n, band: bi });
  return a;
});
export const bandAt = (o) => BANDS.findIndex((b) => o >= b.off && o < b.off + b.w);
// first furrow = the pivot line nearest the frame centre
export const O1 = LINES.reduce((a, l) => (Math.abs(l.o) < Math.abs(a) ? l.o : a), 1e9);
export const U_L = -430; // where the spear lands along it
export const L = bandToWorld(U_L, O1); // landing point (ground = pivot world)

// ------------------------------------------------------------------------------------------------
// Ground projection
// ------------------------------------------------------------------------------------------------
export const E0 = (18 * Math.PI) / 180;
export const SE0 = Math.sin(E0), CE0 = Math.cos(E0);
export const GC = L[1];
export const GFAR = -760; // far edge of the plain (the horizon)
export const HALF_PI = Math.PI / 2;
export const horizonSW = (e) => GC + (GFAR - GC) * Math.sin(e);
export const proj3 = (gx, gy, h, e) => [gx, GC + (gy - GC) * Math.sin(e) - h * Math.cos(e)];
// ground plane (h = 0) -> SW
export const groundM = (e) => {
  const s = Math.sin(e);
  return [1, 0, 0, s, 0, GC * (1 - s)];
};
// vertical billboard standing at ground depth gy: local (x, y = −height) -> SW
export const boardM = (gy, e) => [1, 0, 0, Math.cos(e), 0, GC + (gy - GC) * Math.sin(e)];
export const swToGroundY = (y) => GC + (y - GC) / SE0; // valid at e = E0

// ------------------------------------------------------------------------------------------------
// The ridge (a side-view billboard in SW, far to the left of the fields)
// ------------------------------------------------------------------------------------------------
export const XTOP = -2150;
// far edge ("crest") of the ridge's top surface
export function crestY(x) {
  if (x <= XTOP) {
    const d = XTOP - x;
    return 150 + 0.19 * d * (1 - 0.4 * Math.exp(-d / 650)) + 16 * (Math.sin(d * 0.0029 + 1) - Math.sin(1)) + 9 * Math.sin(d * 0.0071);
  }
  const d = x - XTOP;
  return 150 + 0.1 * d + 0.0021 * d * d;
}
export const crestSlope = (x) => (crestY(x + 2) - crestY(x - 2)) / 4;
export const SURF = 175; // depth of the lit top surface (below the crest)

// ------------------------------------------------------------------------------------------------
// Hunters
// ------------------------------------------------------------------------------------------------
export const H1 = 470; // lead hunter height (design units)
function integratePath(vfn, tA, xA) {
  const dt = 1 / 600, t0 = -1.5, n = Math.ceil((7 - t0) / dt);
  const xs = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) xs[i] = xs[i - 1] + vfn(t0 + (i - 0.5) * dt) * dt;
  const at = (t) => {
    const f = (clamp(t, t0, t0 + n * dt) - t0) / dt, i = Math.min(n - 1, Math.floor(f));
    return lerp(xs[i], xs[i + 1], f - i);
  };
  const off = xA - at(tA);
  return (t) => at(t) + off;
}
const V1 = 1180, V2 = 1180;
const lead = {
  id: 0, H: H1, track: 132, dLand: 0.09,
  v: (t) => V1 * (1 - 0.72 * smoothstep(3.3, 3.78, t) - 0.28 * smoothstep(3.78, 4.55, t)),
};
lead.hipX = integratePath(lead.v, T.release, XTOP - 70);
const second = {
  id: 1, H: H1 * 0.74, track: 40, dLand: 0.09,
  v: (t) => V2 * (1 - smoothstep(3.2, 4.15, t)),
};
second.hipX = integratePath(second.v, T.run, lead.hipX(T.run) - 330);
export const HUNTERS = [lead, second];
for (const h of HUNTERS) h.trackY = (x) => crestY(x) + h.track;

// Step schedules (contact time, side 0 = near leg / 1 = far leg, contact x, stance time, style)
function buildSteps(h) {
  const steps = [];
  const kmax = h.id === 0 ? 7 : 11;
  for (let k = -9; k <= kmax; k++) {
    const t = T.run + k * EIGHTH;
    const side = ((k % 2) + 2) % 2;
    steps.push({ t, side, x: h.hipX(t) + h.dLand * h.H, stance: 0.125, style: 'run' });
  }
  if (h.id === 0) {
    // the plant (far foot) is a long block step, held through the throw
    const plant = steps[steps.length - 1];
    plant.x = h.hipX(plant.t) + 0.3 * h.H;
    plant.stance = 0.72;
    plant.style = 'plant';
    // rear (near) leg drags then swings through; a last small step to stand
    steps.push({ t: T.plant + 2 * EIGHTH, side: 0, x: h.hipX(T.plant + 2 * EIGHTH) + 0.2 * h.H, stance: 9, style: 'through' });
    steps.push({ t: T.plant + 3 * EIGHTH, side: 1, x: h.hipX(T.plant + 3 * EIGHTH) + 0.02 * h.H, stance: 9, style: 'settle' });
  } else {
    const last = steps[steps.length - 1];
    last.stance = 9;
    steps[steps.length - 2].stance = 9;
  }
  return steps;
}
for (const h of HUNTERS) {
  h.steps = buildSteps(h);
  h.bySide = [h.steps.filter((s) => s.side === 0), h.steps.filter((s) => s.side === 1)];
}

// Joint layout (fractions of height H)
export const RIG = {
  thigh: 0.245, shin: 0.245, ankle: 0.035, foot: 0.13, heel: 0.035,
  torso: 0.29, neck: 0.33, uarm: 0.165, farm: 0.15, grip: 0.035, hipRun: 0.468,
};

function ikKnee(hip, ank, a, b) {
  let dx = ank[0] - hip[0], dy = ank[1] - hip[1];
  let d = Math.hypot(dx, dy);
  const dmax = (a + b) * 0.9985;
  if (d > dmax) {
    dx *= dmax / d;
    dy *= dmax / d;
    d = dmax;
  }
  const phi = Math.atan2(dy, dx);
  const al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const th = phi - al; // knee bends forward (+x)
  return { knee: [hip[0] + a * Math.cos(th), hip[1] + a * Math.sin(th)], ank: [hip[0] + dx, hip[1] + dy] };
}

// smooth hip height (no bob) used by the camera
export function hipSmooth(h, t) {
  const x = h.hipX(t);
  return [x, h.trackY(x) - RIG.hipRun * h.H];
}

// Where is foot `side` of hunter h at time t? Returns { ank, footAng, planted, contact }
function footState(h, side, t, hip) {
  const H = h.H, list = h.bySide[side];
  let i = -1;
  for (let j = 0; j < list.length; j++) if (list[j].t <= t) i = j;
  const ankleOf = (st, lift = 0) => {
    const gy = h.trackY(st.x), g = Math.atan(crestSlope(st.x) * 0.6);
    if (lift <= 0) return { ank: [st.x, gy - RIG.ankle * H], ang: g };
    // heel lift: rotate the foot about the toe
    const toe = [st.x + (RIG.foot - RIG.heel) * H * Math.cos(g), gy + (RIG.foot - RIG.heel) * H * Math.sin(g)];
    const a = g + lift, back = (RIG.foot - RIG.heel) * H;
    return { ank: [toe[0] - back * Math.cos(a), toe[1] - back * Math.sin(a) - RIG.ankle * H * Math.cos(lift)], ang: a };
  };
  if (i < 0) i = 0;
  const cur = list[i];
  const next = list[i + 1];
  if (t < cur.t) {
    // before the first listed contact: extrapolate as a planted foot
    const a = ankleOf(cur);
    return { ank: a.ank, footAng: a.ang, planted: true };
  }
  const toe = cur.t + cur.stance;
  if (t < toe || !next) {
    const u = clamp((t - cur.t) / cur.stance);
    const lift = cur.style === 'run' ? 0.62 * smoothstep(0.45, 1, u) : 0;
    const a = ankleOf(cur, lift);
    return { ank: a.ank, footAng: a.ang, planted: true, contact: cur };
  }
  // swing from cur (toe-off) to next (contact)
  const s = clamp((t - toe) / (next.t - toe));
  const hipAt = (tt) => {
    const x = h.hipX(tt);
    return [x, h.trackY(x) - RIG.hipRun * H];
  };
  const a0 = ankleOf(cur, cur.style === 'run' ? 0.62 : 0), a1 = ankleOf(next);
  const h0 = hipAt(toe), h1 = hipAt(next.t);
  const r0 = [a0.ank[0] - h0[0], a0.ank[1] - h0[1]], r1 = [a1.ank[0] - h1[0], a1.ank[1] - h1[1]];
  const Lg = (RIG.thigh + RIG.shin) * H;
  let keys;
  if (next.style === 'through') {
    keys = [[0, r0[0], r0[1]], [0.45, -0.62 * Lg, 0.88 * Lg], [0.78, 0.05 * Lg, 0.62 * Lg], [1, r1[0], r1[1]]];
  } else if (next.style === 'settle') {
    keys = [[0, r0[0], r0[1]], [0.5, 0.0, 0.78 * Lg], [1, r1[0], r1[1]]];
  } else {
    keys = [[0, r0[0], r0[1]], [0.3, -0.44 * Lg, 0.5 * Lg], [0.62, 0.2 * Lg, 0.52 * Lg], [0.84, 0.44 * Lg, 0.8 * Lg], [1, r1[0], r1[1]]];
  }
  const rel = splineXY(keys, s);
  // foot pitch through the swing: toes down after push-off, level, then slightly up before strike
  const pitch = next.style === 'run' || next.style === 'plant'
    ? lerp(0.62, 0.95, smoothstep(0, 0.28, s)) * (1 - smoothstep(0.28, 0.8, s)) - 0.12 * smoothstep(0.75, 1, s)
    : 0.3 * Math.sin(Math.PI * s);
  return { ank: [hip[0] + rel[0], hip[1] + rel[1]], footAng: lerp(a0.ang, a1.ang, s) + pitch, planted: false };
}

// Full pose of hunter h at local time t.
export function pose(h, t) {
  const H = h.H;
  // hip: smooth path + running bob (lowest at mid-stance)
  const x = h.hipX(t);
  const run = 1 - smoothstep(3.9, 4.6, t);
  const tau = (((t - T.run) % EIGHTH) + EIGHTH) % EIGHTH;
  const bob = 0.02 * H * Math.cos((TAU * (tau - 0.062)) / EIGHTH) * run;
  let hipY = h.trackY(x) - RIG.hipRun * H + bob;
  const phase = ((((t - T.run) / (2 * EIGHTH)) % 1) + 1) % 1; // 0 = near-foot contact
  // torso lean (forward positive)
  let lean = 0.23 + 0.03 * Math.sin(TAU * 2 * phase + 0.6);
  let headAng = -0.1;
  const legs = [];
  const hip = [x, hipY];
  const armAng = [];
  let spear = null;
  const sw = Math.cos(TAU * phase); // +1 at near contact
  if (h.id === 0) {
    // ---- the lead: carry, withdrawal, delivery, follow-through
    const w = smoothstep(T.withdraw, T.plant, t); // withdrawal
    const d = clamp((t - T.plant) / (T.release - T.plant)); // delivery 0..1
    const f = smoothstep(T.release, T.release + 0.55, t); // follow-through
    lean = lerp(lean, -0.16, w);
    if (t > T.plant) lean = lerp(-0.16, 0.36, ease.inOutCubic(d));
    if (t > T.release) lean = lerp(0.36, 0.5, smoothstep(T.release, T.release + 0.25, t)) - 0.28 * smoothstep(T.release + 0.3, T.release + 1.1, t);
    hipY += 0.035 * H * smoothstep(T.plant - 0.05, T.plant + 0.12, t) * (1 - smoothstep(T.release + 0.2, T.release + 0.9, t));
    hip[1] = hipY;
    // near (throwing) arm, absolute angles (0 = down, + = forward)
    const carryU = -2.25 + 0.07 * Math.sin(TAU * 2 * phase), carryF = 2.2 + 0.08 * Math.sin(TAU * 2 * phase + 0.8);
    let u = lerp(carryU, -1.72, w), fa = lerp(carryF, -1.62, w);
    if (t > T.plant) {
      const e = ease.inCubic(d);
      u = lerp(-1.72, -3.62, e);
      fa = lerp(-1.62, -3.95, ease.inOutCubic(Math.min(1, d * 1.05)));
    }
    if (t > T.release) {
      u = lerp(-3.62, -5.55, ease.outCubic(f));
      fa = lerp(-3.95, -5.2, ease.outCubic(f));
    }
    armAng[0] = [u, fa];
    // far arm: swings while running, reaches toward the target, then pulls down hard
    let fu = 0.62 * sw - 0.12, ff = fu + 1.35 + 0.25 * Math.sin(TAU * phase);
    fu = lerp(fu, 1.45, w);
    ff = lerp(ff, 1.75, w);
    if (t > T.plant) {
      fu = lerp(1.45, -0.55, ease.inOutCubic(d));
      ff = lerp(1.75, 0.6, ease.inOutCubic(d));
    }
    if (t > T.release) {
      fu = lerp(-0.55, 0.1, f);
      ff = lerp(0.6, 0.9, f);
    }
    armAng[1] = [fu, ff];
    headAng = lerp(-0.1, -0.05, w) - 0.32 * smoothstep(T.release - 0.05, T.release + 0.35, t) * (1 - 0.4 * smoothstep(T.release + 0.8, T.release + 1.6, t));
  } else {
    // ---- the second: spear held low in the near hand, far arm pumping; slows and points
    const stop = smoothstep(3.7, 4.5, t);
    armAng[0] = [0.35 + 0.18 * sw * (1 - stop), 1.45 + 0.1 * Math.sin(TAU * phase) - 0.3 * stop];
    const pu = 0.62 * -sw - 0.1, pf = pu + 1.4;
    const point = smoothstep(3.95, 4.5, t);
    armAng[1] = [lerp(pu, 2.35, point), lerp(pf, 2.2, point)];
    lean = lerp(lean, 0.05, stop);
    headAng = -0.1 - 0.35 * point;
  }
  // legs (IK)
  const a = RIG.thigh * H, b = RIG.shin * H;
  const hipJ = [hip[0] + 0.01 * H, hip[1]];
  for (let side = 0; side < 2; side++) {
    const fs = footState(h, side, t, hipJ);
    const k = ikKnee(hipJ, fs.ank, a, b);
    legs.push({ hip: hipJ, knee: k.knee, ank: k.ank, footAng: fs.footAng, planted: fs.planted });
  }
  const up = [Math.sin(lean), -Math.cos(lean)];
  const shoulder = [hip[0] + up[0] * RIG.torso * H, hip[1] + up[1] * RIG.torso * H];
  const neck = [hip[0] + up[0] * RIG.neck * H, hip[1] + up[1] * RIG.neck * H];
  const arms = armAng.map(([u, fa], i) => {
    const sh = [shoulder[0] + (i ? -0.012 : 0.012) * H, shoulder[1]];
    const el = [sh[0] + Math.sin(u) * RIG.uarm * H, sh[1] + Math.cos(u) * RIG.uarm * H];
    const wr = [el[0] + Math.sin(fa) * RIG.farm * H, el[1] + Math.cos(fa) * RIG.farm * H];
    const gp = [wr[0] + Math.sin(fa) * RIG.grip * H, wr[1] + Math.cos(fa) * RIG.grip * H];
    return { sh, el, wr, gp, u, fa };
  });
  // spear in hand
  if (h.id === 0 && t < T.release) {
    const w = smoothstep(T.withdraw, T.plant, t);
    const d = clamp((t - T.plant) / (T.release - T.plant));
    let ang = lerp(-0.2 + 0.035 * Math.sin(TAU * 2 * phase), -0.5, w);
    if (t > T.plant) ang = lerp(-0.5, FLIGHT.a0, ease.inOutSine(d));
    spear = { grip: arms[0].gp, ang };
  } else if (h.id === 1) {
    spear = { grip: arms[0].gp, ang: -0.1 + 0.05 * Math.sin(TAU * phase) - 0.25 * smoothstep(3.9, 4.6, t) };
  }
  return { H, hip, lean, neck, shoulder, headAng, legs, arms, spear };
}

// ------------------------------------------------------------------------------------------------
// Spear (tip trajectory in SW, ballistic from the lead's hand to the landing point)
// ------------------------------------------------------------------------------------------------
export const SPEAR = { len: 600, grip: 0.42 }; // grip fraction from the tail
export const FLIGHT = { a0: -0.62, tip0: [0, 0], vx: 0, vy0: 0, g: 0, apex: 290, dur: T.land - T.release };
export const L_SW = proj3(L[0], L[1], 0, E0); // == L (GC = L.y)
(function solveFlight() {
  // the grip at release depends on the pose, which depends on the release angle: iterate
  let a = FLIGHT.a0;
  for (let it = 0; it < 8; it++) {
    FLIGHT.a0 = a;
    const p = pose(lead, T.release - 1e-6);
    const grip = p.arms[0].gp;
    const tip0 = [grip[0] + Math.cos(a) * SPEAR.len * (1 - SPEAR.grip), grip[1] + Math.sin(a) * SPEAR.len * (1 - SPEAR.grip)];
    const D = L_SW[1] - tip0[1], tt = FLIGHT.dur, A = FLIGHT.apex;
    const k = Math.sqrt(2 * A);
    const s = (tt * k + Math.sqrt(tt * tt * k * k + 4 * (tt * tt) / 2 * D)) / (tt * tt); // sqrt(g)
    const g = s * s, vy0 = -Math.sqrt(2 * g * A), vx = (L_SW[0] - tip0[0]) / tt;
    Object.assign(FLIGHT, { tip0, vx, vy0, g });
    a = Math.atan2(vy0, vx);
  }
  FLIGHT.a0 = a;
})();
export const LAND_DIR = (() => {
  const vy = FLIGHT.vy0 + FLIGHT.g * FLIGHT.dur, vx = FLIGHT.vx, n = Math.hypot(vx, vy);
  return [vx / n, vy / n];
})();
// 3D direction of the stuck spear (forward along the furrow, down into the ground)
export const SPEAR3 = (() => {
  const [dx, dy] = LAND_DIR;
  // SW(dir3) = (c·FU0, c·FU1·sinE0 + sh·cosE0) ∥ (dx, dy)
  const c1 = dx / FU[0], sh1 = (dy - c1 * FU[1] * SE0) / CE0;
  const n = Math.hypot(c1, sh1);
  const c = c1 / n, sh = sh1 / n;
  const projLen = Math.hypot(c * FU[0], c * FU[1] * SE0 + sh * CE0);
  return { c, sh, len3: SPEAR.len / projLen };
})();
// Spear state at time t: { tip:[x,y] (SW), ang, vis: visible length fraction, stuck, embed }
export function spearFlight(t) {
  const tt = clamp(t - T.release, 0, FLIGHT.dur);
  const tip = [FLIGHT.tip0[0] + FLIGHT.vx * tt, FLIGHT.tip0[1] + FLIGHT.vy0 * tt + 0.5 * FLIGHT.g * tt * tt];
  const ang = Math.atan2(FLIGHT.vy0 + FLIGHT.g * tt, FLIGHT.vx);
  return { tip, ang };
}

// ------------------------------------------------------------------------------------------------
// Camera. Parameters: look-at ground point (x, y), zoom z, roll, elevation e. The target is built
// from shot intentions (tilt, tracking the lead, tracking the spear, landing framing, the rise) and
// then Gaussian-smoothed in time (pure function of lt).
// ------------------------------------------------------------------------------------------------
const zKeys = pchip([[0, 1], [1.2, 1], [3.2, 1.02], [3.72, 1.1], [4.6, 0.76], [5.3, 0.79], [6.25, 0.9], [7.2, 0.92], [10, 1]]);
const rollKeys = pchip([[0, 0], [0.9, 0], [2.4, -0.018], [3.7, -0.04], [4.8, 0.035], [6.25, 0.05], [7.4, 0.035], [10, 0]]);
export const LAND_SCREEN = [790, 800];
const Y0 = -640; // SW y of the view centre at lt = 0 (only sky visible)

function leadScreen(lt) {
  const k = (lt - T.run) / 2.5;
  return [lerp(60, 860, k), lerp(712, 585, clamp(k))];
}
function runTarget(lt, z) {
  const [hx, hy] = hipSmooth(lead, lt);
  const [sx, sy] = leadScreen(lt);
  return [hx + (960 - sx) / z, hy - (sy - 540) / z];
}
function flightTarget(lt, z) {
  const s = spearFlight(lt);
  const k = clamp((lt - T.release) / FLIGHT.dur);
  const back = SPEAR.len * lerp(0.5, 0.0, ease.inOutSine(k));
  const px = s.tip[0] - Math.cos(s.ang) * back, py = s.tip[1] - Math.sin(s.ang) * back;
  const sx = lerp(1150, LAND_SCREEN[0], ease.inOutSine(k)), sy = lerp(470, LAND_SCREEN[1], ease.inOutQuad(k));
  const follow = py - (sy - 540) / z;
  // on the way up the camera holds the horizon low in frame (where the dawn will break) and lets the
  // spear climb across the stars; after the apex it tilts down with it
  const hold = horizonSW(E0) - (905 - 540) / z;
  const w = smoothstep(4.75, 6.05, lt);
  return [px + (960 - sx) / z, lerp(hold, follow, w)];
}
const Z_LAND = 0.9;
export const P_LAND = [L_SW[0] - (LAND_SCREEN[0] - 960) / Z_LAND, L_SW[1] - (LAND_SCREEN[1] - 540) / Z_LAND];
const P_LAND_G = [P_LAND[0], swToGroundY(P_LAND[1])];

function camTarget(lt) {
  const z = lt < T.land ? zKeys(lt) : lt < T.rise0 ? Z_LAND : lerp(Z_LAND, 1, ease.inOutSine(invLerp(T.rise0, T.rise1, lt)));
  const roll = rollKeys(lt);
  let x, y, e = E0;
  if (lt < T.rise0) {
    // phase A — SW targets at e = E0
    const p0 = runTarget(0, 1);
    const tr = runTarget(lt, z);
    const wt = ease.inOutCubic(clamp(lt / 1.95));
    let p = [lerp(p0[0], tr[0], wt), lerp(Y0, tr[1], wt)];
    const wf = smoothstep(3.52, 4.35, lt);
    if (wf > 0) {
      const fl = flightTarget(lt, z);
      p = [lerp(p[0], fl[0], wf), lerp(p[1], fl[1], wf)];
    }
    const wl = smoothstep(5.6, 6.35, lt);
    if (wl > 0) p = [lerp(p[0], P_LAND[0], wl), lerp(p[1], P_LAND[1], wl)];
    x = p[0];
    y = swToGroundY(p[1]);
  } else {
    const r = invLerp(T.rise0, T.rise1, lt);
    const k = ease.inOutSine(r);
    x = lerp(P_LAND_G[0], 960, k);
    y = lerp(P_LAND_G[1], 540, k);
    e = lerp(E0, HALF_PI, ease.inOutCubic(r));
  }
  return [x, y, z, roll, e];
}

const _cam = new Map();
export function camAt(lt) {
  const key = Math.round(lt * 1e5);
  const hit = _cam.get(key);
  if (hit) return hit;
  // smoothing width: tiny at the boundaries so the ends are exact, generous in between
  const sig = 0.17 * (0.08 + 0.92 * smoothstep(0.05, 1.0, lt)) * (1 - 0.92 * smoothstep(8.9, 9.85, lt));
  const K = 12, hstep = sig / 4;
  const acc = [0, 0, 0, 0, 0];
  let ws = 0;
  for (let k = -K; k <= K; k++) {
    const w = Math.exp(-0.5 * (k / 4) ** 2);
    const c = camTarget(lt + k * hstep);
    for (let j = 0; j < 5; j++) acc[j] += w * c[j];
    ws += w;
  }
  const c = { x: acc[0] / ws, y: acc[1] / ws, z: acc[2] / ws, roll: acc[3] / ws, e: acc[4] / ws };
  if (lt >= T.rise1 - 1e-9) Object.assign(c, { x: 960, y: 540, z: 1, roll: 0, e: HALF_PI });
  // impact jolt (screen space)
  const ti = lt - T.land;
  c.shake = ti > 0 ? [5 * Math.exp(-ti * 7) * noise1(ti * 38, 3), 9 * Math.exp(-ti * 8) * Math.sin(ti * 52)] : [0, 0];
  if (_cam.size > 4000) _cam.clear();
  _cam.set(key, c);
  return c;
}
// SW point at the centre of the screen
export const camCenterSW = (c) => proj3(c.x, c.y, 0, c.e);
// World(SW) -> screen
export function viewM(c) {
  const p = camCenterSW(c);
  return M.chain(M.translate(960 + c.shake[0], 540 + c.shake[1]), M.rotate(c.roll), M.scale(c.z), M.translate(-p[0], -p[1]));
}
// Sky view: same roll / zoom, tiny lateral parallax, anchored vertically to the horizon.
export const SKY_PAR = 0.06;
const C0 = camAt(0), P0SW = camCenterSW(C0);
export const SKY_H = 540 + C0.z * (horizonSW(C0.e) - P0SW[1]); // horizon in sky coords (below the frame at lt 0)
export function skyM(c) {
  const p = camCenterSW(c);
  const qx = 960 + SKY_PAR * (p[0] - P0SW[0]);
  const qy = SKY_H - (horizonSW(c.e) - p[1]);
  return M.chain(M.translate(960 + c.shake[0], 540 + c.shake[1]), M.rotate(c.roll), M.scale(c.z), M.translate(-qx, -qy));
}
// Parallax view for a far billboard: lateral factor k relative to the landing framing.
export function parallaxM(c, k, xref = P_LAND[0]) {
  const p = camCenterSW(c);
  return M.mul(viewM(c), M.translate((1 - k) * (p[0] - xref), 0));
}
