// LAND — the sauropod: painted cut-out parts + a small rig.
//   torso (rigid, bobs/pitches) · neck & tail painted STRAIGHT and drawn as thin slices along a
//   bending spine · head (rigid, carries the SAME painted eye as PIVOT.eye) · 4 legs with 2-bone IK.
// All coordinates are final-frame design units on the dino plane (d = 1).
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, ease, invLerp, noise1, T, BEAT, rampInt, h01 } from './util.js';
import { C } from '../lib/palette.js';
import { circlePts, ellipsePts, ribbon } from '../lib/kit.js';
import { PIVOT } from '../pivots.js';

// ------------------------------------------------------------------------------------------------
// geometry
// ------------------------------------------------------------------------------------------------
export const D = {
  bodyEnd: [1073, 628],               // where the walk ends (== the impact framing)
  travel: 500,                        // distance walked (dino-plane design units)
  hip: [-140, 38], shoulder: [168, 44],
  neckBase: [196, -44], tailBase: [-236, -38],
  neckL: 350, neckW0: 64, neckW1: 25,
  tailL: 470, tailW0: 54,
  groundY: 902,
  legU: 128, legL: 104, footH: 21,
  eye: [30, -15], eyeR: 9.5,           // in head-local coords
};
D.body0 = [D.bodyEnd[0] - D.travel, D.bodyEnd[1]];
// colours
export const DC = {
  orange: '#e8622c', orange2: '#f07a34', rust: '#b8452c', stripe: '#c9482a',
  cream: '#f6dc9a', gold: '#f2b544', belly: '#c4303c', belly2: '#a82638',
  leg: '#b92d3c', legDark: '#8c2034', legLight: '#d8454a', nail: '#f3e2b8',
  head: '#ef8a38', headTop: '#f2b544', jaw: '#f8dfa0',
};

// ------------------------------------------------------------------------------------------------
// gait: diagonal-pair walk. Each footfall (on the beat) plants one near foot and the diagonally
// opposite far foot, so the six beats 73.125 ... 76.25 give every leg three steps. Feet are fixed in
// the world while planted (no sliding); each landing is placed where the hip will be at mid-stance.
// feet: 0 near-hind, 1 near-fore, 2 far-hind, 3 far-fore
// ------------------------------------------------------------------------------------------------
export const FALLS = [0, 1, 2, 3, 4, 5].map((k) => ({ t: T.step0 + BEAT * k, feet: k % 2 ? [1, 2] : [0, 3] }));
const SWING = 0.46;
export const WALK_A = T.step0 - SWING - 0.1;        // body starts moving (weight shift)
export const WALK_B = FALLS[5].t + 0.3;             // body comes to rest
const JX = [D.hip[0], D.shoulder[0], D.hip[0] + 10, D.shoulder[0] + 10];
const STANCE0 = [-44, -26, 14, 30];      // standing pose before the walk (foot x rel. to its joint)
const STANCE1 = [12, 30, -42, -26];      // standing pose after the walk (== impact framing)

// Body progress 0..1: trapezoidal speed profile with sine ramps (smooth start / stop).
const RA = 0.25, RB = 0.3;
export function bodyProg(lt) {
  const u = clamp((lt - WALK_A) / (WALK_B - WALK_A));
  const n = 1 - RA / 2 - RB / 2;
  let s;
  if (u < RA) s = RA * (u / RA - Math.sin(Math.PI * u / RA) / Math.PI) / 2;
  else if (u < 1 - RB) s = RA / 2 + (u - RA);
  else { const v = (u - (1 - RB)) / RB; s = RA / 2 + (1 - RA - RB) + RB * (v + Math.sin(Math.PI * v) / Math.PI) / 2; }
  return s / n;
}
// small surge on each push-off (the body lunges a little after every plant)
function surge(lt) {
  const env = smoothstep(WALK_A, WALK_A + 0.6, lt) * (1 - smoothstep(WALK_B - 0.7, WALK_B, lt));
  return 3.5 * env * Math.sin(TAU * (lt - T.step0) / BEAT - 0.4);
}
export function bodyX(lt) { return D.body0[0] + D.travel * bodyProg(lt) + surge(lt); }

// Planned world x of each foot: start, then after each of its landings.
const PLAN = [0, 1, 2, 3].map((f) => {
  const lands = FALLS.filter((s) => s.feet.includes(f)).map((s) => s.t);
  const pos = [D.body0[0] + JX[f] + STANCE0[f]];
  lands.forEach((t, k) => {
    if (k === lands.length - 1) { pos.push(D.bodyEnd[0] + JX[f] + STANCE1[f]); return; }
    const tm = (t + lands[k + 1] - SWING) / 2;          // mid-stance of this plant: centred under the joint
    pos.push(D.body0[0] + D.travel * bodyProg(tm) + JX[f]);
  });
  return { lands, pos };
});
// Foot state at lt: world x, lift height, swing progress.
function footAt(f, lt) {
  const { lands, pos } = PLAN[f];
  let x = pos[0], lift = 0, sw = 0;
  for (let k = 0; k < lands.length; k++) {
    const u = clamp((lt - (lands[k] - SWING)) / SWING);
    if (u <= 0) break;
    // lift quickly, reach forward, plant heavily
    x = lerp(pos[k], pos[k + 1], ease.inOutSine(Math.pow(u, 0.85)));
    const len = Math.abs(pos[k + 1] - pos[k]);
    if (u < 1) { lift = (14 + 0.1 * len) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 1.2); sw = u; }
  }
  return { x, lift, sw };
}
// Camera thud envelope for the footfalls.
export function walkThud(lt) {
  let thud = 0;
  for (const s of FALLS) {
    const u = lt - s.t;
    if (u > 0 && u < 1.2) thud += Math.exp(-u * 9) * Math.sin(Math.min(u * 60, Math.PI));
  }
  return thud;
}

// ------------------------------------------------------------------------------------------------
// pose
// ------------------------------------------------------------------------------------------------
const deg = Math.PI / 180;
function spine(base, angFn, L, n) {
  const pts = [[base[0], base[1]]], angs = [];
  let x = base[0], y = base[1];
  const ds = L / n;
  for (let i = 0; i < n; i++) {
    const a = angFn((i + 0.5) / n);
    angs.push(a);
    x += Math.cos(a) * ds;
    y += Math.sin(a) * ds;
    pts.push([x, y]);
  }
  return { pts, angs, ds };
}
function ik(hx, hy, ax, ay, a, b, bendSign) {
  let dx = ax - hx, dy = ay - hy;
  let d = Math.hypot(dx, dy);
  const dmax = (a + b) * 0.9995;
  if (d > dmax) { dx *= dmax / d; dy *= dmax / d; d = dmax; }
  const base = Math.atan2(dy, dx);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const A = Math.acos(cosA);
  const upper = base + bendSign * A;
  const kx = hx + Math.cos(upper) * a, ky = hy + Math.sin(upper) * a;
  const lower = Math.atan2(hy + dy - ky, hx + dx - kx);
  return { upper, lower, knee: [kx, ky], ankle: [hx + dx, hy + dy] };
}

// Pose parameters over time (everything the rig needs, before collapse/char are applied).
export function pose(lt, fx = {}) {
  const P = {};
  const walkEnv = smoothstep(T.walk0 - 0.2, T.walk0 + 0.4, lt) * (1 - smoothstep(FALLS[5].t - 0.1, FALLS[5].t + 0.5, lt));
  // body bob: lowest just after each footfall; slight pitch towards the planted near foot
  let bob = 0, pitch = 0;
  FALLS.forEach((s, k) => {
    const u = lt - s.t - 0.08;
    const w = Math.exp(-(u * u) / (2 * 0.16 * 0.16));
    bob += 4.5 * w;
    pitch += (k % 2 ? 1 : -1) * 0.009 * w;
  });
  // idle breathing (faded in during the pull-back so the eye starts perfectly still)
  const idle = smoothstep(0.35, 2.2, lt);
  const breath = Math.sin(lt * 1.9) * idle;
  let bx = bodyX(lt);
  let by = D.body0[1] + bob + 1.2 * breath;
  let brot = pitch + 0.004 * Math.sin(lt * 0.9) * idle;
  // --- collapse (after the blast) : body sinks to the ground, pitches forward
  const col = fx.collapse || 0;
  const recoil = fx.recoil || 0;
  by += 175 * ease.inQuad(col) - 10 * recoil;
  brot += -0.05 * recoil + 0.07 * ease.inOutSine(col);
  bx += -14 * recoil;
  P.body = { x: bx, y: by, rot: brot };
  const B = M.chain(M.translate(bx, by), M.rotate(brot));
  P.B = B;
  const toW = (p) => M.apply(B, p[0], p[1]);

  // --- neck: angle profile
  const look = ease.inOutSine(clamp((lt - T.look0) / (T.look1 - T.look0)));
  const sway = walkEnv * Math.sin((lt - T.walk0) * TAU / (2 * BEAT) + 0.6);
  let th0 = -36 * deg - 5 * deg * look - 0.03 * sway - 0.025 * Math.sin(lt * 0.7) * idle;
  let bend = -42 * deg + 10 * deg * look + 0.035 * sway;
  // recoil: rear back; collapse: neck droops to the ground
  th0 += -14 * deg * recoil + 58 * deg * ease.inOutSine(clamp(col * 1.15));
  bend += 18 * deg * recoil + 95 * deg * ease.inOutSine(clamp(col * 1.05 - 0.05));
  const neckBaseW = toW(D.neckBase);
  const neck = spine(neckBaseW, (s) => brot + th0 + bend * Math.pow(s, 1.45), D.neckL, 22);
  P.neck = neck;
  // head: attached at the neck end, points forward (down a little); lifts when looking up
  const nEnd = neck.pts[neck.pts.length - 1];
  const nAng = neck.angs[neck.angs.length - 1];
  let hang = nAng + 88 * deg - 34 * deg * look + 0.03 * (Math.sin(lt * 1.3 + 0.4) - Math.sin(0.4)) * (1 - look) * idle;
  hang += -24 * deg * recoil + 30 * deg * ease.inOutSine(col);
  P.head = { x: nEnd[0], y: nEnd[1], rot: hang };
  P.H = M.chain(M.translate(nEnd[0], nEnd[1]), M.rotate(hang));
  const e = M.apply(P.H, D.eye[0], D.eye[1]);
  P.eye = { x: e[0], y: e[1], r: D.eyeR, rot: hang };

  // --- tail
  const tsw = walkEnv * Math.sin((lt - T.walk0) * TAU / (2 * BEAT) - 0.9);
  let t0 = (174 * deg) + 0.03 * tsw + 0.02 * Math.sin(lt * 0.8) * idle + brot;
  let tb = 24 * deg + 0.06 * tsw;
  tb += -30 * deg * recoil * 0.5 - 35 * deg * ease.inOutSine(col);
  t0 += 12 * deg * ease.inOutSine(col);
  P.tail = spine(toW(D.tailBase), (s) => t0 + tb * Math.pow(s, 1.3) + 0.04 * Math.sin(lt * 1.1 - s * 2.5) * idle, D.tailL, 20);

  // --- legs
  const joints = [D.hip, D.shoulder, [D.hip[0] + 10, D.hip[1] - 6], [D.shoulder[0] + 10, D.shoulder[1] - 6]];
  P.legs = [];
  for (let f = 0; f < 4; f++) {
    const j = toW(joints[f]);
    const ft = footAt(f, lt);
    let fx0 = ft.x;
    const lift = ft.lift;
    let fy = D.groundY - lift;
    // collapse: feet splay outward a little
    fx0 += (f % 2 === 0 ? -1 : 1) * 30 * ease.inOutSine(col);
    const ax = fx0, ay = fy - D.footH;
    const bendSign = f % 2 === 0 ? -1 : 1; // hind knee forward, fore knee back
    const L = ik(j[0], j[1], ax, ay, D.legU, D.legL, bendSign);
    const footRot = ft.sw > 0 ? -0.28 * Math.sin(Math.PI * ft.sw) * (f % 2 ? 1 : 0.8) : 0;
    P.legs.push({ f, hip: j, ...L, footRot, lift });
  }
  return P;
}
// strip geometry shared with the painter
export const NECK_PAD = 26;   // strip extends beyond both ends (overlaps torso / head)
export const TAIL_PAD = 22;
export function neckHalfW(s) { // s: 0..1 along the neck
  return lerp(D.neckW0, D.neckW1, Math.pow(clamp(s), 0.75));
}
export function tailHalfW(s) {
  return D.tailW0 * Math.pow(1 - clamp(s), 0.9) + 1.5;
}

let _rest = null;
export function restEye() {
  if (!_rest) {
    const p = pose(0);
    _rest = { x: p.eye.x, y: p.eye.y, r: p.eye.r, rot: p.eye.rot };
  }
  return _rest;
}

// ------------------------------------------------------------------------------------------------
// drawing
// ------------------------------------------------------------------------------------------------
// Draw a straight painted strip along a spine polyline as thin rotated slices.
function drawStrip(R, L, meta, sp, baseLen, o) {
  const n = sp.angs.length, ds = sp.ds;
  const scale = baseLen / (meta.L - 2 * meta.pad);
  for (let i = 0; i < n; i++) {
    // slice covers strip x range [x0, x1] (with overlap)
    const first = i === 0, last = i === n - 1;
    const x0 = meta.pad + i * ds / scale - (first ? meta.pad : 1.6);
    const x1 = meta.pad + (i + 1) * ds / scale + (last ? meta.pad : 1.6);
    const p = sp.pts[i];
    const m = M.chain(M.translate(p[0], p[1]), M.rotate(sp.angs[i]), M.scale(scale), M.translate(-(meta.pad + i * ds / scale), -meta.H / 2), M.translate(x0, 0));
    R.layer(L, m, { ...o, uv: [x0 / meta.L, 0, x1 / meta.L, 1], w: x1 - x0, h: meta.H });
  }
}

// o: { grade, color, tint } applied to all parts; far legs darker automatically.
export function drawDino(R, A, P, o = {}, eyeA = null, extra = {}) {
  const partO = (k) => ({ ...o, ...(extra[k] || {}) });
  const leg = (i) => {
    const Lg = P.legs[i];
    const dark = i >= 2 ? 1 : 0;
    const lo = partO('legs');
    const [ox, oy] = A.legO, [fx, fy] = A.footO;
    R.layer(A.legL[dark], M.chain(M.translate(Lg.knee[0], Lg.knee[1]), M.rotate(Lg.lower - Math.PI / 2), M.translate(-ox, -oy)), lo);
    R.layer(A.foot[dark], M.chain(M.translate(Lg.ankle[0], Lg.ankle[1]), M.rotate(Lg.footRot), M.translate(-fx, -fy)), lo);
    R.layer(A.legU[dark], M.chain(M.translate(Lg.hip[0], Lg.hip[1]), M.rotate(Lg.upper - Math.PI / 2), M.translate(-ox, -oy)), lo);
  };
  // legs (far, then near) — all tucked under the torso
  leg(3);
  leg(2);
  leg(1);
  leg(0);
  // tail + neck behind the torso
  drawStrip(R, A.tail, A.tailMeta, P.tail, D.tailL, partO('tail'));
  drawStrip(R, A.neck, A.neckMeta, P.neck, D.neckL, partO('neck'));
  // torso
  R.layer(A.torso, M.mul(P.B, M.translate(-A.torsoO[0], -A.torsoO[1])), partO('torso'));
  // head + eye + socket
  R.layer(A.head, M.mul(P.H, M.translate(-A.headO[0], -A.headO[1])), partO('head'));
  if (eyeA) {
    const E = P.eye;
    PIVOT.eye.drawEye(R, eyeA, E.x, E.y, E.r, 0);
    const S = A.socketMeta;
    R.layer(A.socket, M.chain(M.translate(E.x, E.y), M.rotate(E.rot * 0), M.scale(E.r / S.ER), M.translate(-S.SS, -S.SS)), partO('head'));
  }
}
