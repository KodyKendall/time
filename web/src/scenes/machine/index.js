// MACHINE (117.5 - 130 s): gear -> industrial gear train -> platters -> server racks ->
// data-centre corridor -> rise & tilt -> the hall's grid IS the chip die.
import { C } from '../lib/palette.js';
import { PIVOT } from '../pivots.js';
import { M, lerp, clamp, hex, smoothstep, atlas, paintCanvas } from '../lib/kit.js';
import { ease, noise1 } from '../../engine/math.js';
import { makeCam } from './cam.js';
import { pchip } from './spline.js';
import { WORLD, wallToWorld } from './world.js';
import { defineMachBrushes } from './brushkit.js';
import { paintPillarCard, paintUpperWall, paintKeystone, PCARD, UPPER, archX } from './factory.js';
import { PLAT, BLADE, FRAME, RACKW, ARM, paintPlatter, paintPlatterGlint, paintPlatterRim, paintBlade, paintPost, paintTopPanel, paintPlinth, paintShutter, paintArm, paintRackFront, paintRackSide } from './datacenter.js';
import { drawMachinery, drawRackFrames, drawBladeLEDs, drawArms, drawArmsRW, drawGearShadows, drawTimber, masterAngle } from './machine.js';
import { paintGearVariant, paintArmBar, paintGearShade, paintGearLight, paintBeam, paintTimberPost, TIMBER } from './gears.js';
import { paintCylinder, paintRod, paintSpring, paintChain, paintNeedle, paintPuffs, paintShaft, paintPulley, paintBelt, BELT, drawPillarMachines, drawLampGlows, drawChains, drawShafts, drawSteam, drawBelts, drawMotes } from './factoryfx.js';
import { drawFloor, drawRacks, drawRibbons, drawTrays, drawHaze, paintAisleBlock, paintTray, paintDroop, paintHaze, AISLE, FOG_COL } from './corridor.js';

const ZE = WORLD.ZE, YG = WORLD.YG, K = WORLD.k, HR = WORLD.H;
const F0 = 1250; // corridor focal length (design units)
const CLOSE_T = 11.25; // 128.75: the two halves of the hall meet
export const spreadAt = (lt) => WORLD.spread * (1 - ease.inCubic(clamp((lt - 10.3) / (CLOSE_T - 10.3))));
const D0 = F0 * K; // camera distance to the end wall at the pivot frame (scale 1 in wall units)

// ------------------------------------------------------------------------------------ camera
const camZ = pchip([
  [0, ZE - D0], [1.25, ZE - 64], [2.5, ZE - 86], [3.75, ZE - 122], [5.0, ZE - 200], [6.0, ZE - 600],
  [7.0, ZE - 1080], [8.0, ZE - 1480], [8.75, ZE - 1600], [9.5, -190], [10.25, -150], [11.0, 20], [11.6, 300], [12.05, 505], [12.42, 540], [12.5, 540],
], { s0: 0, s1: 0 });
const camY = pchip([
  [0, YG], [1.0, YG + 1], [2.5, YG + 14], [3.75, YG + 16], [5, YG + 4], [6.2, 150], [7.4, 118], [8.5, 125], [9.25, 240], [10.0, 480], [10.75, 950], [11.5, 1900], [12.0, 4200], [12.5, 9000],
], { s0: 0 });
const camPitch = pchip([[0, 0], [8.6, 0], [9.5, 0.22], [10.25, 0.66], [11.0, 1.12], [11.6, 1.44], [12.15, Math.PI / 2], [12.5, Math.PI / 2]], { s0: 0, s1: 0 });
const floorScale = pchip([[0, 0], [10.6, 0], [11.4, 0.62], [12.0, 0.92], [12.42, 1.0], [12.5, 1.0]], { s1: 0 });

export function camAt(lt) {
  const pitch = camPitch(lt), y = camY(lt), z = camZ(lt);
  // hand-held drift (zero at both hand-offs) + a slow sideways drift down the corridor
  const dr = smoothstep(0, 1.2, lt) * (1 - smoothstep(10.5, 12.0, lt)) * lerp(0.5, 3, smoothstep(4.5, 6.0, lt));
  const side = 34 * Math.sin(Math.PI * smoothstep(5.0, 9.4, lt)) * (1 - smoothstep(9.4, 11.0, lt)) * smoothstep(5.0, 7.2, lt);
  const x = dr * (1.2 * noise1(lt * 0.35, 11) + 0.6 * noise1(lt * 0.9, 12)) + side;
  const roll = 0.035 * Math.sin(Math.PI * clamp((lt - 5.0) / 4.6)) * (1 - smoothstep(9.0, 10.5, lt))
    - 0.05 * Math.sin(Math.PI * clamp((lt - 8.7) / 3.0)) * (1 - smoothstep(11.2, 12.0, lt));
  let F = F0;
  const fs = floorScale(lt);
  if (fs > 0) {
    const h = Math.max(1, y);
    F = lerp(F0, Math.max(F0, fs * h), smoothstep(10.6, 11.4, lt));
  }
  const ortho = smoothstep(11.95, 12.42, lt);
  // the aisle slams shut on 128.75: a short damped jolt of the camera
  const jt = lt - CLOSE_T;
  const jolt = jt > 0 ? Math.exp(-jt * 14) * Math.sin(jt * 70) * 5 : 0;
  const cam = makeCam({ x, y, z, pitch, roll, F, ppx: 960, ppy: 540 + jolt, ortho, oref: Math.max(1, y) });
  cam.fog = [260, 2300, 0.82 * (1 - smoothstep(9.6, 11.0, lt))];
  return cam;
}

// frontal plane affine (valid while pitch == 0): wall units -> screen
function wallAffine(cam) {
  const zc = ZE - cam.z;
  const s = (cam.F * K) / zc;
  return M.chain(M.translate(cam.ppx, cam.ppy), M.rotate(-cam.roll), M.scale(s), M.translate(-(960 + cam.x / K), -(540 + (YG - cam.y) / K)));
}
// best affine for the (slightly projective) end wall when the camera pitches: fit 3 points
function wallAffineTilted(cam) {
  const P = (wx, wy) => { const w = wallToWorld(wx, wy); return cam.project(w[0], w[1], w[2]); };
  const a = P(960, 2000), b = P(960 + 3000, 2000), c = P(960, -1000);
  if (!(a[2] > 0 && b[2] > 0 && c[2] > 0)) return null;
  const ex = [(b[0] - a[0]) / 3000, (b[1] - a[1]) / 3000], ey = [(c[0] - a[0]) / -3000, (c[1] - a[1]) / -3000];
  return [ex[0], ex[1], ey[0], ey[1], a[0] - ex[0] * 960 - ey[0] * 2000, a[1] - ex[1] * 960 - ey[1] * 2000];
}

// ------------------------------------------------------------------------------------ paint
function paintAll(P) {
  defineMachBrushes(P.brush);
  const pillars = {};
  for (let k = -3; k <= 2; k++) {
    const hi = k === -1 || k === 0;
    pillars[k] = P.layer('pillar' + k, { w: PCARD.w, h: PCARD.h, scale: hi ? 0.55 : 0.36 }, (c) => paintPillarCard(c, k));
  }
  const upper = P.layer('upper', { w: UPPER.W, h: UPPER.H, scale: 0.3 }, (c) => paintUpperWall(c));
  const keystone = P.layer('keystone', { w: 240, h: 260, scale: 0.8 }, (c) => paintKeystone(c));
  const platter = P.layer('platter', { w: PLAT.size, h: PLAT.size, scale: 0.6 }, (c) => paintPlatter(c));
  const glint = P.layer('glint', { w: PLAT.size, h: PLAT.size, scale: 0.4 }, (c) => paintPlatterGlint(c));
  const platterRim = P.layer('platterRim', { w: PLAT.size, h: PLAT.size, scale: 0.4 }, (c) => paintPlatterRim(c));
  const blades = [0, 1, 2].map((v) => P.layer('blade' + v, { w: BLADE.w + 16, h: BLADE.h + 16, scale: 0.6 }, (c) => paintBlade(c, v)));
  const post = P.layer('post', { w: FRAME.post, h: RACKW.h, scale: 0.4 }, (c) => paintPost(c, RACKW.h));
  const topPanel = P.layer('topPanel', { w: RACKW.w, h: FRAME.top, scale: 0.4 }, (c) => paintTopPanel(c, RACKW.w));
  const plinth = P.layer('plinth', { w: RACKW.w, h: FRAME.plinth, scale: 0.4 }, (c) => paintPlinth(c, RACKW.w));
  const shW = RACKW.w - 2 * FRAME.post + 20, shH = RACKW.h - FRAME.top - FRAME.plinth + 20;
  const shutter = P.layer('shutter', { w: shW + 20, h: shH + 20, scale: 0.3 }, (c) => paintShutter(c, shW, shH));
  const arm = P.layer('arm', { w: ARM.w, h: ARM.h, scale: 0.6 }, (c) => paintArm(c));
  const rackFront = [0, 1, 2].map((v) => P.layer('rackFront' + v, { w: RACKW.w, h: RACKW.h, scale: 0.27 }, (c) => paintRackFront(c, v)));
  const rackSide = [0, 1].map((v) => P.layer('rackSide' + v, { w: RACKW.w, h: RACKW.h, scale: 0.12 }, (c) => paintRackSide(c, v)));
  const aisle = [0, 1, 2].map((v) => P.layer('aisle' + v, { w: AISLE.w * AISLE.u, h: AISLE.h * AISLE.u, scale: 0.6 }, (c) => paintAisleBlock(c, v)));
  const sky = P.layer('sky', { w: 1920, h: 1080, scale: 0.5 }, (c) => paintCanvas(c, C.night, ['#16223a', '#1b2a48', '#0a1120', '#221c3a', '#10243a', '#0f2e3a'], { strokes: 240, angle: -0.08, curl: 0.3 }));
  const tray = P.layer('tray', { w: 1200, h: 120, scale: 0.6 }, (c) => paintTray(c));
  const droop = P.layer('droop', { w: 1200, h: 400, scale: 0.5 }, (c) => paintDroop(c));
  const haze = P.layer('haze', { w: 2400, h: 1000, scale: 0.25 }, (c) => paintHaze(c, 2400, 1000));
  const tBeam = P.layer('tBeam', { w: TIMBER.beamW, h: TIMBER.beamH, scale: 0.6 }, (c) => paintBeam(c));
  const tPost = P.layer('tPost', { w: TIMBER.postW, h: TIMBER.postH, scale: 0.6 }, (c) => paintTimberPost(c));
  const gearShade = P.layer('gearShade', { w: 1000, h: 1000, scale: 0.6 }, (c) => paintGearShade(c));
  const gearLight = P.layer('gearLight', { w: 1000, h: 1000, scale: 0.5 }, (c) => paintGearLight(c));
  const gearV = [0, 1, 2].map((v) => P.layer('gearV' + v, { w: 1000, h: 1000, scale: 0.9 }, (c) => paintGearVariant(c, v)));
  const armBar = P.layer('armBar', { w: 740, h: 70, scale: 0.7 }, (c) => paintArmBar(c));
  const pulley = P.layer('pulley', { w: 200, h: 200, scale: 0.7 }, (c) => paintPulley(c));
  const belt = P.layer('belt', { w: BELT.w + 4, h: BELT.len, scale: 0.6 }, (c) => paintBelt(c));
  const cylinder = P.layer('cylinder', { w: 320, h: 680, scale: 0.7 }, (c) => paintCylinder(c));
  const rod = P.layer('rod', { w: 160, h: 560, scale: 0.7 }, (c) => paintRod(c));
  const spring = P.layer('spring', { w: 120, h: 520, scale: 0.7 }, (c) => paintSpring(c));
  const chain = P.layer('chain', { w: 80, h: 2600, scale: 0.5 }, (c) => paintChain(c));
  const needle = P.layer('needle', { w: 110, h: 40, scale: 0.8 }, (c) => paintNeedle(c));
  const puffs = atlas(P, 'puffs', 6, 300, (c, cx, cy, i) => paintPuffs(c, cx, cy, 300, i), { cols: 3, scale: 0.5 });
  const shaft = P.layer('shaft', { w: 900, h: 2600, scale: 0.15 }, (c) => paintShaft(c, 900, 2600));
  return { pulley, belt, sky, tBeam, tPost, gearShade, gearLight, tray, droop, haze, gearV, armBar, cylinder, rod, spring, chain, needle, puffs, shaft, pillars, upper, keystone, platter, glint, platterRim, blades, post, topPanel, plinth, shutter, arm, rackFront, rackSide, aisle };
}

// ------------------------------------------------------------------------------------ end wall
function drawEndWall(R, A, AG, lt) {
  const t = R.t;
  const cool = smoothstep(2.6, 4.4, lt);
  const spin = masterAngle(lt);
  for (let k = -3; k <= 2; k++) R.layer(A.pillars[k], M.translate(archX(k), PCARD.oy));
  R.layer(A.upper, M.translate(UPPER.x0, UPPER.y0));
  for (let k = -2; k <= 2; k++) R.layer(A.keystone, M.translate(archX(k) - 120, -950));
  R.glow(960, 540, 700, hex(C.navy2), 0.35, { ext: 2 }); // the pivot's halo (additive light)
  drawLampGlows(R, lt, t, cool);
  drawShafts(R, A, lt, t, cool);
  drawPillarMachines(R, A, lt, spin, t);
  drawBelts(R, A, lt, masterAngle);
  drawTimber(R, A, lt);
  drawGearShadows(R, A, AG, lt);
  drawArms(R, A, lt);
  drawRackFrames(R, A, lt, 'back');
  drawMachinery(R, A, AG, lt);
  drawArmsRW(R, A, lt);
  drawRackFrames(R, A, lt, 'front');
  drawBladeLEDs(R, lt, t);
  drawSteam(R, A, lt, cool);
  drawChains(R, A, lt, t);
  drawMotes(R, lt);
}

// A pulse of light racing outward along the die's traces when the hall closes (light only).
function drawTracePulse(R, cam, lt) {
  const u = lt - CLOSE_T;
  if (u < 0 || u > 1.0) return;
  const front = u * 1500, fade = (1 - smoothstep(0.55, 1.0, u)) * smoothstep(0, 0.04, u);
  const parts = [];
  const add = (X, Z, d) => {
    const w = Math.exp(-(((d - front) / 60) ** 2)) * fade;
    if (w < 0.03) return;
    const p = cam.project(X, 0, Z);
    if (!(p[2] > 0)) return;
    parts.push([p[0], p[1], 4.5 * cam.scaleAt(p[2]), 0, 1, 0.78, 0.4, 0.55 * w]);
  };
  const dist = (X, Z) => Math.abs(X) + Math.abs(Z - 540) * 0.35;
  for (let i = 0; i <= 16; i++) { const X = 120 * i - 960; for (let Z = 0; Z <= 1080; Z += 4) add(X, Z, dist(X, Z)); }
  for (let j = 0; j <= 9; j++) { const Z = 120 * j; for (let X = -960; X <= 960; X += 4) add(X, Z, dist(X, Z)); }
  if (parts.length) R.particles(parts, { kind: 'glow', blend: 'add' });
}

// ------------------------------------------------------------------------------------ scene
export const scene = {
  id: 'machine',
  bg: C.night,
  deps: [PIVOT.gear, PIVOT.die],
  paint(P) { return paintAll(P); },
  post(lt) { return {}; },
  blur(lt) {
    // camera-driven motion blur (the engine only sees an identity view for this scene)
    const h = 0.5 / 30 / 2;
    const a = camAt(lt - h), b = camAt(lt + h);
    const pts = [];
    for (const zz of [150, 300, 600, 1200]) for (const xx of [-150, 150]) for (const yy of [0, 250]) pts.push([xx, yy, a.z + zz]);
    for (const [wx, wy] of [[-2000, -1000], [3920, -1000], [-2000, 2500], [3920, 2500], [960, 540]]) pts.push(wallToWorld(wx, wy));
    for (const xx of [-900, 0, 900]) for (const zz of [0, 540, 1080]) pts.push([xx, HR, zz]);
    let mx = 0;
    for (const [x, y, z] of pts) {
      const p = a.project(x, y, z), q = b.project(x, y, z);
      if (!(p[2] > 20 && q[2] > 20)) continue;
      if (p[0] < -100 || p[0] > 2020 || p[1] < -100 || p[1] > 1180) continue;
      mx = Math.max(mx, Math.hypot(q[0] - p[0], q[1] - p[1]) * 2);
    }
    // the closing halves move fast just before the impact
    const cl = lt > CLOSE_T - 0.35 && lt < CLOSE_T + 0.02 ? 6 : 1;
    return Math.min(12, Math.max(cl, Math.ceil(mx / 4)));
  },
  draw(R, lt, A) {
    if (lt <= 0) { R.drawScene(PIVOT.gear, 0); return; }
    const AG = R.engine.ensure(PIVOT.gear), AD = R.engine.ensure(PIVOT.die);
    const cam = camAt(lt);
    const s = spreadAt(lt);
    R.fill(hex(C.night));
    // painted night canvas: infinitely far, so it only rolls and slides with the pitch
    R.layer(A.sky, M.chain(M.translate(960, 540 - cam.F * Math.tan(Math.min(1.2, cam.pitch)) * 0.25), M.rotate(-cam.roll), M.scale(1.08), M.translate(-960, -540)));
    const Mw = cam.pitch < 1e-4 ? wallAffine(cam) : wallAffineTilted(cam);
    if (Mw) R.with(Mw, () => drawEndWall(R, A, AG, lt));
    // atmospheric haze over the (distant) end wall
    const D = ZE - cam.z;
    const fw = smoothstep(0, 1, (D - cam.fog[0]) / (cam.fog[1] - cam.fog[0])) * cam.fog[2];
    if (fw > 0.002) R.fill([...FOG_COL, fw]);
    if (lt > 4.2) {
      // 125.0: a surge of data races down the hall from the end wall
      const surge = smoothstep(7.47, 7.57, lt) * (1 - smoothstep(7.95, 8.85, lt));
      const surgeZ = ZE - (lt - 7.5) * 1500;
      // light at the far end of the hall
      const eg = cam.project(0, 150, ZE - 40);
      if (eg[2] > 0) {
        const sc = cam.scaleAt(eg[2]);
        const flash = lt > 7.5 ? Math.exp(-(lt - 7.5) * 5) : 0;
        const k = smoothstep(4.8, 6.0, lt) * (1 - smoothstep(9.5, 10.6, lt)) * (1 + 4 * flash);
        R.glow(eg[0], eg[1], 300 * sc, [0.3, 0.7, 0.8], 0.12 * k, { shape: [0.8, 0.5, 1.2], ext: 3 });
        R.glow(eg[0], eg[1] + 40 * sc, 140 * sc, [1, 0.75, 0.5], 0.1 * k, { shape: [1.2, 0.4, 2], ext: 3 });
      }
      drawFloor(R, cam, A, AD, s);
      // rack-top lamps switch on (row by row, see corridor.js) as the camera rises over the hall
      drawRacks(R, cam, A, AD, s, lt, R.t, { surge, surgeZ, lamps: smoothstep(9.3, 10.2, lt) });
      // the surge front sliding along the floor runner
      if (surge > 0 && surgeZ > cam.z + 20) {
        const p = cam.project(0, 2, surgeZ);
        if (p[2] > 0) { const sc = cam.scaleAt(p[2]); R.glow(p[0], p[1], 90 * sc, [0.5, 1, 0.95], 0.9 * surge, { sx: 1.6, sy: 0.5, ext: 3 }); }
        // and its reflection streaking along the glossy floor towards the camera
        const p2 = cam.project(0, 0, surgeZ - 120);
        if (p[2] > 0 && p2[2] > 0) R.glow((p[0] + p2[0]) / 2, (p[1] + p2[1]) / 2, 40 * cam.scaleAt(p2[2]), [0.4, 0.9, 1], 0.35 * surge, { sx: 0.6, sy: 2.4, ext: 3 });
      }
      drawTrays(R, cam, A, s, lt);
      drawHaze(R, cam, A, s, lt, smoothstep(4.8, 6.0, lt) * (1 - smoothstep(9.2, 10.2, lt)));
      drawTracePulse(R, cam, lt);
      const grow = smoothstep(4.55, 5.9, lt), drain = smoothstep(8.7, 9.6, lt);
      // the painted ribbons are one brush painting per frame: paint them for the mid-shutter camera
      const ltN = R.frameT - (R.t - lt);
      drawRibbons(R, cam, lt, { amount: grow > 0 ? 1 : 0, grow, drain, surge, surgeZ, camN: camAt(ltN), ltN, floorHalf: s / 2 });
    }
  },
};
