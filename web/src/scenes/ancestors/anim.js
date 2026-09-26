// ANCESTORS — the performance: where the creature is, what pose it strikes and how far it has
// evolved, as a pure function of local time (random access, no state).
import { lerp, clamp, smoothstep } from '../lib/kit.js';
import { ease, invLerp, noise1 } from '../../engine/math.js';
import { basePose, mixPose, morph, footDrop, scaled } from './creature.js';
import { BURROW, ROCK, FIRE, groundAt, rockTopY } from './land.js';

const B = basePose();
const pose = (o) => ({ ...B, ...o });

// Key poses ---------------------------------------------------------------------------------
const PEEK = pose({ spine: -1.25, neck: -0.9, head: -0.1, armN: [-0.1, 0.95, 0.4], armF: [0.05, 1.05, 0.4], legN: [1.3, 2.3, 0], legF: [1.4, 2.3, 0], tail: [0.2, 0.1, 0] });
const LOOKUP = pose({ ...PEEK, neck: -1.25, head: -0.55 });
const STAND = pose({ spine: -0.06, neck: -0.42, head: 0.3, armN: [1.75, 1.45, 0.25], armF: [1.7, 1.5, 0.25], legN: [1.0, 2.1, 0.05], legF: [1.12, 2.02, 0.05], tail: [0.3, 0.25, 0.5] });
const SNIFF = pose({ ...STAND, spine: 0.05, neck: 0.05, head: 0.85, armN: [1.55, 1.35, 0.3], armF: [1.5, 1.4, 0.3] });
const STARTLE = pose({ ...STAND, spine: -0.42, neck: -0.9, head: -0.05, armN: [1.2, 1.0, 0.4], armF: [1.3, 1.1, 0.4], earFlick: 1, brow: 1, legN: [1.25, 2.2, 0], legF: [1.35, 2.2, 0], tail: [0.9, 0.3, 0] });
const PRIMATE = pose({ spine: -0.3, neck: 0.42, head: 0.3, yaw: 0.65, armN: [1.78, 1.42, 0.12], armF: [1.7, 1.38, 0.12], legN: [0.92, 2.25, 0.04], legF: [0.82, 2.3, 0.04], grip: 0.5 });
const HUMAN = pose({ spine: -1.42, neck: -1.34, head: 0.12, yaw: 0, armN: [1.82, 1.52, 1.52], armF: [1.48, 1.3, 1.3], legN: [1.38, 1.78, 0.04], legF: [1.8, 1.5, 0.02], grip: 0.55 });
const CROUCH = pose({ spine: -0.95, neck: -0.7, head: 0.3, yaw: 0.2, armN: [1.55, 1.25, 1.2], armF: [1.45, 1.2, 1.1], legN: [0.95, 2.2, 0.03], legF: [1.05, 2.15, 0.03], grip: 0.5 });
const GAZE = pose({ ...HUMAN, spine: -1.5, neck: -1.62, head: -0.3, brow: 0.6, armN: [1.86, 1.6, 1.55], armF: [1.44, 1.2, 1.1] });
const SEAT = pose({ spine: -1.26, neck: -1.02, head: 0.4, armN: [1.22, 0.42, 0.05], armF: [1.34, 0.55, 0.15], legN: [-0.5, 1.62, 0.08], legF: [-0.38, 1.7, 0.08], grip: 0.35 });
const STRIKE = pose({ ...SEAT, spine: -1.14, neck: -0.86, head: 0.62, armN: [1.15, 0.62, 0.5], armF: [1.25, 0.5, 0.45] });
const RECOIL = pose({ ...SEAT, spine: -1.52, neck: -1.38, head: 0.08, armN: [1.4, -0.3, -0.6], armF: [1.45, -0.1, -0.4], brow: 1.2, jawOpen: 1 });
const TEND = pose({ ...SEAT, spine: -1.2, neck: -0.96, head: 0.5, armN: [1.08, 0.35, 0.1], armF: [1.55, 0.45, 0.4], grip: 0.3 });

// Gait: quadruped cycle blended from a shrew's bound (m = 0) to a primate's walk (m = 1).
function gait(phase, m, amp = 1) {
  const s = Math.sin, bound = 1 - smoothstep(0.1, 0.8, m);
  // bound: fore pair together, hind pair together (opposite); walk: diagonal pairs
  const off = lerp(0.35, Math.PI, 1 - bound);
  const fN = phase, fF = phase + off, bN = phase + Math.PI, bF = bN + off;
  const arm = (f) => [lerp(1.55, 1.55, m) + amp * lerp(0.75, 0.38, m) * s(f), lerp(1.4, 1.55, m) + amp * lerp(0.55, 0.35, m) * Math.max(0, s(f + 1.1)), lerp(0.2, 0.08, m)];
  const leg = (f) => [lerp(1.12, 1.1, m) - amp * lerp(0.8, 0.4, m) * s(f), lerp(2.05, 2.0, m) + amp * lerp(0.55, 0.45, m) * Math.max(0, s(f - 0.6)), 0.05];
  return {
    armN: arm(fN), armF: arm(fF), legN: leg(bN), legF: leg(bF),
    spineBend: amp * bound * 0.9 * s(phase + Math.PI / 2),
    bob: amp * lerp(10, 7, m) * Math.abs(s(phase)),
    tail: [0.3 + 0.3 * s(phase * 0.5), 0.35 * s(phase), phase],
  };
}
// integral of the gait frequency (cycles) from t0 to t (numerical, deterministic)
function phaseAt(t, t0, f) {
  if (t <= t0) return 0;
  let ph = 0;
  const n = Math.ceil((t - t0) * 240), dt = (t - t0) / n;
  for (let i = 0; i < n; i++) ph += f(t0 + (i + 0.5) * dt) * dt;
  return ph * Math.PI * 2;
}

// Main creature ----------------------------------------------------------------------------
function settle(lt, S) {
  const P = pose({ ...PRIMATE });
  P.head += 0.12 * Math.sin((lt - 6.35) * 1.6) * smoothstep(6.3, 6.6, lt);
  // notices the butterfly landing by its hand: head dips and tilts towards it, brows up
  const look = smoothstep(6.75, 7.05, lt) * (1 - smoothstep(7.25, 7.55, lt));
  P.head += 0.45 * look;
  P.neck += 0.18 * look + 0.08 * Math.sin((lt - 6.35) * 1.3) * smoothstep(6.3, 6.6, lt);
  P.brow = 0.8 * look;
  P.yaw = lerp(0.65, 0.3, smoothstep(6.8, 7.3, lt));
  P.breath = breathAt(lt);
  P.blink = [6.9, 7.35].reduce((b, t0) => Math.max(b, 1 - Math.abs(lt - t0) / 0.07), 0);
  const x = RUN.x1 + 6 * smoothstep(6.3, 7.5, lt);
  return { P, x, y: rockTopY(x) - footDrop(P, S) };
}
export const RUN = { t0: 3.95, t1: 6.05, x0: 742, x1: 1150 };
export function morphAt(lt) {
  const m1 = ease.inOutSine(invLerp(4.15, 6.1, lt));
  const m2 = ease.inOutSine(invLerp(7.55, 8.8, lt));
  return m1 + m2;
}
export function nightAt(lt) { return smoothstep(8.6, 10.2, lt); }
const breathAt = (lt) => Math.sin(lt * 2.9) * smoothstep(6.1, 6.7, lt);
const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

export function creatureAt(lt) {
  if (lt < 1.25) return null;
  const m = morphAt(lt);
  const S = morph(m, nightAt(lt));
  let P, x, y, surface;
  const blinkAt = (ts) => ts.reduce((b, t0) => Math.max(b, 1 - Math.abs(lt - t0) / 0.07), 0);
  if (lt < 2.5) {
    // pop out of the burrow (overshoot), sniff, look up at the falling ash
    const pop = ease.outBack(clamp((lt - 1.25) / 0.32), 2.2);
    const look = smoothstep(1.85, 2.15, lt) * (1 - smoothstep(2.3, 2.48, lt));
    P = mixPose(PEEK, LOOKUP, look);
    P.sniff = lt * 9;
    P.head += 0.07 * Math.sin(lt * 23) * smoothstep(1.5, 1.6, lt) * (1 - look) * (1 - smoothstep(2.3, 2.46, lt));
    P.earFlick = Math.max(0, Math.sin(lt * 7)) * 0.6 * (1 - smoothstep(2.3, 2.46, lt));
    x = BURROW.x - 26;
    y = BURROW.y + lerp(150, 58, pop);
    surface = 'burrow';
  } else if (lt < 2.88) {
    // hop out: arc from the hole onto the path
    const u = ease.inOutSine(invLerp(2.5, 2.88, lt));
    P = mixPose(PEEK, STAND, smoothstep(0.1, 0.8, u));
    const tuck = Math.sin(Math.PI * u);
    P.legN = lerpArr(lerpArr(PEEK.legN, STAND.legN, u), [0.6, 1.2, 0.2], tuck * 0.8);
    P.legF = lerpArr(lerpArr(PEEK.legF, STAND.legF, u), [0.7, 1.25, 0.2], tuck * 0.8);
    x = lerp(BURROW.x - 26, 690, u);
    const yEnd = groundAt(690) - footDrop(STAND, S);
    y = lerp(BURROW.y + 58, yEnd, u) - 70 * Math.sin(Math.PI * u);
    surface = u < 0.5 ? 'burrow' : 'ground';
  } else if (lt < 3.95) {
    // scurry to the sprout, stop, sniff it, then startle as it bursts
    const run = invLerp(2.88, 3.42, lt);
    const ph = phaseAt(lt, 2.88, (t) => 6.5 * (1 - smoothstep(3.25, 3.45, t)));
    const amp = smoothstep(2.88, 3.02, lt) * (1 - smoothstep(3.3, 3.45, lt));
    const g = gait(ph, 0, amp);
    x = lerp(690, RUN.x0, ease.inOutSine(run));
    P = mixPose(STAND, SNIFF, smoothstep(3.42, 3.6, lt));
    const gk = smoothstep(2.88, 2.98, lt) * (1 - smoothstep(3.36, 3.46, lt));
    for (const key of ['armN', 'armF', 'legN', 'legF', 'tail']) P[key] = lerpArr(P[key], g[key], gk);
    P.spineBend = g.spineBend * gk;
    P.sniff = lt * 9;
    const st = smoothstep(3.74, 3.84, lt);
    P = mixPose(P, STARTLE, st);
    y = groundAt(x) - footDrop(P, S) - g.bob * gk - 26 * Math.sin(Math.PI * clamp((lt - 3.74) / 0.2));
    x -= 14 * ease.outCubic(clamp((lt - 3.74) / 0.2));
    surface = 'ground';
  } else if (lt < 6.35) {
    // run to the rock, growing and evolving on the way; climb onto the rock
    const u = invLerp(RUN.t0, RUN.t1, lt);
    x = lerp(RUN.x0 - 14, RUN.x1, ease.inOutSine(u));
    const ph = phaseAt(lt, RUN.t0, (t) => lerp(6.2, 1.9, smoothstep(4.2, 6.0, t)) * (1 - smoothstep(5.85, 6.15, t)));
    const amp = smoothstep(3.95, 4.1, lt) * (1 - smoothstep(5.9, 6.2, lt));
    const g = gait(ph, clamp(m), amp);
    const from = mixPose(STARTLE, STAND, smoothstep(3.95, 4.15, lt));
    P = mixPose(from, PRIMATE, smoothstep(4.2, 6.2, lt));
    const k = amp;
    P.armN = P.armN.map((v, i) => lerp(v, g.armN[i], k));
    P.armF = P.armF.map((v, i) => lerp(v, g.armF[i], k));
    P.legN = P.legN.map((v, i) => lerp(v, g.legN[i], k));
    P.legF = P.legF.map((v, i) => lerp(v, g.legF[i], k));
    P.spineBend = g.spineBend * k;
    P.tail = lerpArr(P.tail, g.tail, k);
    P.yaw = PRIMATE.yaw * smoothstep(6.0, 6.35, lt);
    P.breath = breathAt(lt);
    const climb = smoothstep(5.55, 6.05, lt);
    const yG = groundAt(x) - footDrop(P, S), yR = rockTopY(x) - footDrop(P, S);
    y = lerp(yG, yR, climb) - g.bob - 34 * Math.sin(Math.PI * clamp((lt - 5.55) / 0.5)) * S.spine / 176;
    surface = climb > 0.5 ? 'rock' : 'ground';
  } else if (lt < 7.55) {
    // primate settles on the rock: breathes, looks around, notices the butterfly (panel 14)
    ({ P, x, y } = settle(lt, S));
    surface = 'rock';
  } else if (lt < 9.3) {
    // rises onto two legs -> early human; stands, gazes at the dusk sky
    const rise = ease.inOutSine(invLerp(7.55, 8.75, lt));
    // primate -> crouch -> upright (the spine swings up about the hips, knees straighten last)
    const from = settle(7.55, morph(1, 0)).P;
    P = rise < 0.5 ? mixPose(from, CROUCH, ease.inOutSine(rise * 2)) : mixPose(CROUCH, HUMAN, ease.inOutSine(rise * 2 - 1));
    P = mixPose(P, GAZE, smoothstep(8.7, 9.1, lt));
    P.breath = breathAt(lt);
    P.blink = blinkAt([8.95]);
    x = lerp(RUN.x1 + 6, 1185, rise);
    y = rockTopY(x) - footDrop(P, S);
    surface = 'rock';
  } else {
    // sits at the rock's edge, strikes flint, recoils from the flame, tends the fire
    const sit = ease.inOutSine(invLerp(9.3, 9.72, lt));
    P = mixPose(GAZE, SEAT, sit);
    // two strikes: 9.75 and 10.0 (beat)
    const strike = (t0) => Math.exp(-Math.pow((lt - t0) / 0.05, 2));
    const s1 = smoothstep(9.62, 9.72, lt) * (1 - smoothstep(10.02, 10.12, lt));
    P = mixPose(P, STRIKE, s1);
    const hit = strike(9.75) + strike(10.0);
    P.armN = P.armN.map((v, i) => v + [0.25, 0.4, 0.3][i] * hit);
    P.armF = P.armF.map((v, i) => v - [0.15, 0.3, 0.2][i] * hit);
    const rec = smoothstep(10.02, 10.16, lt) * (1 - smoothstep(10.35, 10.9, lt));
    P = mixPose(P, RECOIL, rec);
    const tend = smoothstep(10.45, 11.0, lt);
    P = mixPose(P, TEND, tend);
    P.armN[0] += 0.12 * Math.sin((lt - 10.4) * 3.1) * tend;
    P.armN[1] += 0.1 * Math.sin((lt - 10.4) * 3.1 + 0.8) * tend;
    P.head += 0.05 * Math.sin(lt * 1.7) * tend;
    P.breath = breathAt(lt);
    P.blink = blinkAt([9.5, 11.3]);
    P.stick = smoothstep(10.4, 10.8, lt);
    x = lerp(1185, 1318, sit);
    const seatY = rockTopY(x) + 12;
    y = lerp(rockTopY(x) - footDrop(GAZE, S), seatY, sit);
    surface = 'rock';
  }
  P.x = x;
  P.y = y;
  P.face = 1;
  return { P, S, m, surface };
}

// Background figures at the camp (panel 15): they come walking in from the right, then dance.
function walk(ph, amp = 1) {
  const s = Math.sin(ph), s2 = Math.sin(ph + Math.PI);
  const leg = (sn, cs) => [1.57 - 0.45 * sn * amp, 1.57 - 0.45 * sn * amp + 0.8 * Math.max(0, cs) * amp, 0.05];
  return pose({
    ...HUMAN, spine: -1.4, neck: -1.3, head: 0.15,
    legN: leg(s, Math.cos(ph)), legF: leg(s2, Math.cos(ph + Math.PI)),
    armN: [1.6 + 0.4 * s * amp, 1.35 + 0.3 * s * amp, 1.4], armF: [1.6 - 0.4 * s * amp, 1.35 - 0.3 * s * amp, 1.4],
  });
}
const FIGS = [
  { t0: 10.15, t1: 11.05, x0: 2120, x1: 1868, s: 0.56, seed: 1 },
  { t0: 10.45, t1: 11.35, x0: 2230, x1: 1990, s: 0.52, seed: 2 },
];
export function figuresAt(lt) {
  const out = [];
  const night = nightAt(lt);
  for (const f of FIGS) {
    if (lt < f.t0) continue;
    const S = scaled(morph(2, night), f.s);
    const u = invLerp(f.t0, f.t1, lt);
    const x = lerp(f.x0, f.x1, ease.outSine(u));
    const ph = phaseAt(lt, f.t0, (t) => 1.9 * (1 - smoothstep(f.t1 - 0.25, f.t1 + 0.1, t)));
    let P = walk(ph, 1 - smoothstep(f.t1 - 0.3, f.t1, lt));
    // dance: arms up and down, knees bouncing
    const d = smoothstep(f.t1 - 0.1, f.t1 + 0.3, lt), dp = (lt - f.t1) * 7 + f.seed * 2;
    const DANCE = pose({ ...HUMAN, spine: -1.5 + 0.08 * Math.sin(dp), neck: -1.5, head: -0.1, armN: [-1.2 + 0.5 * Math.sin(dp), -1.5 + 0.6 * Math.sin(dp + 0.8), -1.4], armF: [-1.9 + 0.5 * Math.sin(dp + 2), -1.7 + 0.5 * Math.sin(dp + 2.6), -1.6], legN: [1.35 + 0.15 * Math.sin(dp), 1.85, 0.05], legF: [1.75, 1.6 + 0.2 * Math.sin(dp + 1), 0.05] });
    P = mixPose(P, DANCE, d);
    P.x = x;
    P.y = 1712 - footDrop(P, S) - 12 * Math.abs(Math.sin(dp)) * d;
    P.face = -1;
    out.push({ P, S });
  }
  return out;
}
