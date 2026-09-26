// The end wall's machinery, in wall units (drawn with the wall affine while the camera is level).
// Gear lattice per arch: columns a = 0..2 (x = archX + (a-1)*700), rows m = -1..5 (y = 540 + 700m).
// The master gear (a=1, m=0) of the central arch IS the pivot gear. On beat clicks the lattice
// unfolds (each gear slides out from behind its parent and meshes), then silver plating grows
// from every hub into a hard-disk platter, platters spin up, tilt back and fan out into stacks of
// blades, and magenta rack frames assemble around each arch.
import { C } from '../lib/palette.js';
import { PIVOT } from '../pivots.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep } from '../lib/kit.js';
import { ease, invLerp, noise1 } from '../../engine/math.js';
import { archX, ARCH, PCARD, UPPER } from './factory.js';
import { PLAT, BLADE, BLADE_LED, FRAME, RACKW, ARM } from './datacenter.js';

export const TM = {
  gen: [0, 1.25, 1.875, 2.1875, 2.3125, 2.375, 2.4375], // unfold start per generation
  slide: 0.34,
  shrink: [0.3, 1.2],
  plate: [2.5, 2.9],    // plating spreads (staggered per gear)
  settle: [2.95, 3.35], // platters equalise to their final radius
  arms: [2.95, 3.3],
  armsOut: [3.45, 3.72],
  tilt: [3.75, 4.5],
  frame: [3.3, 4.35],
  shutter: [3.55, 4.2],
  leds: 4.375,
};
const PITCH = 700, GS = 0.875; // lattice pitch, lattice gear scale (r = 332.5)
const P24 = TAU / 24;
const ARCHES = [-3, -2, -1, 0, 1, 2, 3];
// is a wall-space disc (x, y, r) on screen under the current transform?
function onScreen(R, x, y, r) {
  const [sx, sy] = R.toScreen(x, y);
  const sr = r * R.scale();
  return sx > -sr && sx < 1920 + sr && sy > -sr && sy < 1080 + sr;
}

// ---------------------------------------------------------------------------- master rotation
function rampInt(x, d) {
  if (x <= 0) return 0;
  if (x >= d) return d / 2 + (x - d);
  const u = x / d;
  return d * (u * u * u - (u * u * u * u) / 2);
}
const BOOST = [[1.25, 0.35, 0.15], [1.875, 0.45, 0.15], [2.1875, 0.5, 0.15], [2.5, 2.5, 0.5], [2.95, 11, 0.9]];
const CLICKS = [1.25, 1.875, 2.1875];
export function masterAngle(lt) {
  let a = 0.55 * lt;
  for (const [t, A, d] of BOOST) a += A * rampInt(lt - t, d);
  for (const t of CLICKS) a += (TAU / 96) * smoothstep(t, t + 0.07, lt); // ratchet jolt
  return a;
}
export function masterSpeed(lt) {
  const h = 1 / 240;
  return (masterAngle(lt + h) - masterAngle(lt - h)) / (2 * h);
}

// ---------------------------------------------------------------------------- lattice
const CELLS = [];
for (let m = -1; m <= 5; m++) for (let a = 0; a <= 2; a++) {
  const g = Math.abs(a - 1) + Math.abs(m);
  // parent: step towards the master (vertical first)
  let pa = a, pm = m;
  if (m !== 0) pm = m - Math.sign(m); else pa = a - Math.sign(a - 1);
  CELLS.push({ a, m, g, pa, pm, parity: g % 2 });
}
const cellAt = (a, m) => CELLS.find((c) => c.a === a && c.m === m);
const genStart = (g) => TM.gen[Math.min(g, TM.gen.length - 1)];

function cellHome(k, a, m) { return [archX(k) + (a - 1) * PITCH, 540 + PITCH * m]; }
// current centre of a lattice gear (slides out from behind its parent)
function cellPos(k, cell, lt) {
  const home = cellHome(k, cell.a, cell.m);
  if (cell.g === 0) return home;
  const parent = cellAt(cell.pa, cell.pm);
  const pp = cellPos(k, parent, lt);
  const t0 = genStart(cell.g) + stagger(k, cell);
  const u = clamp((lt - t0) / TM.slide);
  if (u <= 0) return pp;
  const e = ease.outBack(u, 1.15);
  const ph = cellHome(k, parent.a, parent.m);
  return [lerp(ph[0], home[0], e) + (pp[0] - ph[0]) * (1 - u), lerp(ph[1], home[1], e) + (pp[1] - ph[1]) * (1 - u)];
}
function stagger(k, cell) { return cell.g >= 3 ? 0.02 * ((cell.a * 3 + cell.m + 5 + k * 7) % 5) : 0; }
function meshAngle(cell, lt) {
  const th = masterAngle(lt);
  return cell.parity === 0 ? th : -th - 0.18 * P24;
}
// A child starts hidden exactly behind its parent (same angle); while it slides out it turns into
// its meshing angle, so no teeth ever peek out before the gear emerges.
function slideU(k, cell, lt) {
  if (cell.g === 0) return 1;
  return clamp((lt - genStart(cell.g) - stagger(k, cell)) / TM.slide);
}
function cellAngle(cell, lt, k = 0) {
  if (cell.g === 0) return meshAngle(cell, lt);
  const e = ease.inOutSine(slideU(k, cell, lt));
  if (e >= 1) return meshAngle(cell, lt);
  const pa = cellAngle(cellAt(cell.pa, cell.pm), lt, k);
  return lerp(pa, meshAngle(cell, lt), e);
}

// ---------------------------------------------------------------------------- per-gear phases
function plateU(k, cell, lt) {
  const d = 0.05 * (Math.abs(cell.m) + Math.abs(cell.a - 1)) + 0.03 * Math.abs(k);
  return ease.inOutCubic(clamp((lt - TM.plate[0] - d) / (TM.plate[1] - TM.plate[0])));
}
function tiltU(k, cell, lt) {
  const d = 0.06 * (cell.m + 1) + 0.04 * Math.abs(k);
  return ease.inOutCubic(clamp((lt - TM.tilt[0] - d) / (TM.tilt[1] - TM.tilt[0] - 0.36)));
}
const STACK = 4, DELTA = 175, THICK = BLADE.h;

// ---------------------------------------------------------------------------- drawing
// A: machine assets, AG: pivot-gear assets. Everything in wall units (current transform).
// Timber frame of the gear train: beams slide in from the jambs and posts drop from the crown
// with the first ratchet clicks; visible in the gaps between the gears.
export function drawTimber(R, A, lt) {
  const R0 = 1080;
  for (const k of ARCHES) {
    const cx = archX(k);
    if (!onScreen(R, cx, 2000, 3600)) continue;
    const d = 0.06 * Math.abs(k);
    const eb = ease.outCubic(clamp((lt - 1.25 - d) / 0.55));
    const ep = ease.outCubic(clamp((lt - 1.5 - d) / 0.6));
    // posts at x = cx +- 350 dropping from the arch soffit to the floor
    if (ep > 0) for (const px of [cx - 350, cx + 350]) {
      const top = 380 - Math.sqrt(R0 * R0 - 350 * 350);
      const len = (5020 - top) * ep;
      R.layer(A.tPost, M.translate(px - 42, top), { uv: [0, 1 - len / 5200, 1, 1], h: len });
    }
    // beams at y = 890 + 700 m, from both jambs towards the centre
    if (eb > 0) for (let m = -2; m <= 5; m++) {
      const y = 890 + 700 * m;
      const hw = y < 380 ? Math.sqrt(Math.max(0, R0 * R0 - (380 - y) ** 2)) : R0;
      if (hw < 100) continue;
      const w = hw * eb;
      R.layer(A.tBeam, M.translate(cx - hw, y - 42), { uv: [0.5 - hw / 2240, 0, 0.5 - hw / 2240 + w / 2240, 1], w });
      R.layer(A.tBeam, M.translate(cx + hw - w, y - 42), { uv: [0.5 + hw / 2240 - w / 2240, 0, 0.5 + hw / 2240, 1], w });
    }
  }
}

// Iron arms of the lattice frame: each gear slides out along an arm from its parent's hub.
export function drawArms(R, A, lt) {
  for (const k of ARCHES) {
    for (const cell of CELLS) {
      if (cell.g === 0) continue;
      const parent = cellAt(cell.pa, cell.pm);
      const [x0, y0] = cellPos(k, parent, lt), [x1, y1] = cellPos(k, cell, lt);
      if (!onScreen(R, (x0 + x1) / 2, (y0 + y1) / 2, 500)) continue;
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 2) continue;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const w = Math.min(740, L + 20);
      R.layer(A.armBar, M.chain(M.translate(x0, y0), M.rotate(ang), M.translate(-10, -35)), { uv: [0, 0, w / 740, 1], w });
    }
  }
}

const hash3 = (k, a, m) => (((k + 7) * 31 + a * 17 + (m + 3) * 13) % 3 + 3) % 3;

// Soft drop shadows of the gears / platters on the wall (light: fades in as the lamps warm up)
export function drawGearShadows(R, A, AG, lt) {
  const k0 = smoothstep(0.25, 1.4, lt) * (1 - smoothstep(3.6, 4.2, lt));
  if (k0 <= 0) return;
  for (const k of ARCHES) for (const cell of CELLS) {
    if (slideU(k, cell, lt) <= 0) continue;
    const [x, y] = cellPos(k, cell, lt);
    if (!onScreen(R, x, y, 500)) continue;
    const gs = cell.g === 0 ? lerp(1, GS, ease.inOutSine(clamp((lt - TM.shrink[0]) / (TM.shrink[1] - TM.shrink[0])))) : GS;
    const L = cell.g === 0 ? AG.g : A.gearV[hash3(k, cell.a, cell.m)];
    R.layer(L, M.place(x + 34, y + 52, gs * 1.02, cellAngle(cell, lt, k), 500, 500), { color: [0.05, 0.02, 0.08, 1], opacity: 0.5 * k0, lod: 4.5 });
  }
}

export function drawMachinery(R, A, AG, lt) {
  const settleS = lerp(1, 0.892, ease.inOutSine(clamp((lt - TM.settle[0]) / (TM.settle[1] - TM.settle[0]))));
  const spin = masterAngle(lt);
  const light = smoothstep(0.25, 1.4, lt);
  for (const k of ARCHES) {
    // back-to-front: deeper generations first (children hide behind parents while unfolding)
    const order = CELLS.slice().sort((p, q) => q.g - p.g);
    for (const cell of order) {
      if (slideU(k, cell, lt) <= 0) continue; // still hidden behind its parent
      const [x, y] = cellPos(k, cell, lt);
      if (!onScreen(R, x, y, 800)) continue;
      const th = cellAngle(cell, lt, k);
      const gs = cell.g === 0 ? lerp(1, GS, ease.inOutSine(clamp((lt - TM.shrink[0]) / (TM.shrink[1] - TM.shrink[0])))) : GS;
      const pu = plateU(k, cell, lt);
      const tu = tiltU(k, cell, lt);
      if (tu <= 0) {
        if (pu < 1) {
          const GL = cell.g === 0 ? AG.g : A.gearV[hash3(k, cell.a, cell.m)];
          const mg = M.place(x, y, gs, th, 500, 500);
          if (cell.g === 0) PIVOT.gear.drawGear(R, AG, x, y, gs, th);
          else R.layer(GL, mg);
          // fixed lighting (does not rotate), clipped to the rotating gear's silhouette
          if (light > 0) {
            const mask = { type: 'texture', layer: GL, m: M.mul(R.view, mg), threshold: 0.5, softness: 0.25 };
            R.layer(A.gearShade, M.place(x, y, gs, 0, 500, 500), { blend: 'multiply', opacity: 0.8 * light * (1 - pu), mask });
            R.layer(A.gearLight, M.place(x, y, gs, 0, 500, 500), { blend: 'screen', opacity: 0.6 * light * (1 - pu), mask });
          }
        }
        if (pu > 0) drawPlatter(R, A, x, y, pu * settleS, th, lt);
      } else {
        drawStack(R, A, x, y, settleS, th, tu, k, cell, lt);
      }
    }
  }
}

function drawPlatter(R, A, x, y, s, th, lt) {
  const L = A.platter;
  R.layer(L, M.place(x, y, s, th, PLAT.size / 2, PLAT.size / 2));
  // screen-fixed specular cross (does not spin with the disc)
  const sheen = smoothstep(0.6, 1, s);
  if (sheen > 0) R.layer(A.glint, M.place(x, y, s, 0, PLAT.size / 2, PLAT.size / 2), { blend: 'screen', opacity: 0.95 * sheen });
}

// actuator arms: grow and swing in over each platter, seek on the beats, swing out before the tilt
export function drawArmsRW(R, A, lt) {
  const inU = ease.outBack(clamp((lt - TM.arms[0]) / (TM.arms[1] - TM.arms[0])), 1.3);
  const outU = ease.inCubic(clamp((lt - TM.armsOut[0]) / (TM.armsOut[1] - TM.armsOut[0])));
  const g = clamp(inU) * (1 - outU);
  if (g <= 0.001) return;
  for (const k of ARCHES) for (const cell of CELLS) {
    const [x, y] = cellHome(k, cell.a, cell.m);
    if (!onScreen(R, x, y, 700)) continue;
    const px = x + 360, py = y + 330;
    const beat = Math.floor((lt - 2.5) / 0.3125);
    const seek = 0.18 * Math.sin(beat * 2.3 + cell.a * 1.7 + cell.m * 0.9 + k) ;
    const ang = Math.atan2(y - py, x - px) + seek + (1 - inU) * 1.2 + outU * 1.0;
    R.layer(A.arm, M.place(px, py, 0.55 * g, ang, ARM.px, ARM.py));
  }
}

// Tilted platter stack: 4 discs rotate back by phi and fan out vertically into blades.
function drawStack(R, A, x, y, s, th, tu, k, cell, lt) {
  const phi = tu * Math.PI / 2;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const r = PLAT.R * s;
  const half = PLAT.size / 2;
  for (let q = STACK - 1; q >= 0; q--) {
    const cy = y + (q - (STACK - 1) / 2) * DELTA * sp;
    const band = THICK * sp;
    // underside rim disc (the lower edge of the coin)
    if (cp > 0.02) R.layer(A.platterRim, M.place(x, cy + band, s, 0, half, half, s * cp));
    // the blade face = the coin's rim band
    if (band > 0.5) {
      const mB = M.chain(M.translate(x - r, cy), M.scale((2 * r) / BLADE.w, band / BLADE.h), M.translate(-8, -8));
      R.layer(A.blades[(cell.a + q + cell.m * 2 + 8) % A.blades.length], mB, { w: BLADE.w + 16, h: BLADE.h + 16 });
    }
    // the top face (spinning platter, foreshortened)
    if (cp > 0.02) {
      R.layer(A.platter, M.chain(M.translate(x, cy), M.scale(1, cp), M.place(0, 0, s, th, half, half)));
      R.layer(A.glint, M.place(x, cy, s, 0, half, half, s * cp), { blend: 'screen', opacity: 0.5 * cp });
    }
  }
}

// LEDs of the assembled blades (glows) — light only.
export function drawBladeLEDs(R, lt, t) {
  const on = smoothstep(TM.leds - 0.1, TM.leds + 0.3, lt);
  if (on <= 0) return;
  const parts = [];
  for (const k of ARCHES) for (const cell of CELLS) {
    const [x, y] = cellHome(k, cell.a, cell.m);
    if (!onScreen(R, x, y, 700)) continue;
    for (let q = 0; q < STACK; q++) {
      const cy = y + (q - (STACK - 1) / 2) * DELTA;
      const r = PLAT.R * 0.892;
      const ex = x - r + 2 * r * BLADE_LED[0], ey = cy + THICK * BLADE_LED[1];
      const id = (k + 5) * 1000 + cell.a * 100 + (cell.m + 2) * 10 + q;
      // LEDs wake up in a cascade from the top row down (on the beat at 121.875)
      const cascade = smoothstep(TM.leds + 0.035 * (cell.m + 1), TM.leds + 0.035 * (cell.m + 1) + 0.08, lt);
      const rate = 2.2 + (id % 7) * 0.9;
      const blink = Math.sin(t * rate + id * 1.3) > -0.3 ? 1 : 0.1;
      const col = id % 5 === 0 ? [1, 0.6, 0.2] : id % 3 === 0 ? [0.5, 1, 0.8] : [0.35, 0.95, 1];
      parts.push([ex, ey, 44, 0, col[0], col[1], col[2], 1.2 * cascade * blink * on]);
    }
  }
  R.particles(parts, { kind: 'glow', blend: 'add' });
}

// Rack frames assembling around each arch (posts grow up, top panel spreads, shutter unrolls).
export function drawRackFrames(R, A, lt, part = 'all') {
  const fu = clamp((lt - TM.frame[0]) / (TM.frame[1] - TM.frame[0]));
  if (fu <= 0) return;
  const top = -813, bottom = ARCH.floor;
  const H = bottom - top;
  for (const k of ARCHES) {
    const cx = archX(k);
    if (!onScreen(R, cx, 2000, 3600)) continue;
    const x0 = cx - RACKW.w / 2, x1 = cx + RACKW.w / 2;
    const d = 0.05 * Math.abs(k);
    const pu = ease.outCubic(clamp((fu * (TM.frame[1] - TM.frame[0]) - d) / 0.55));
    const tu = ease.inOutCubic(clamp((fu * (TM.frame[1] - TM.frame[0]) - d - 0.3) / 0.5));
    const su = ease.inOutSine(clamp((lt - TM.shutter[0] - d) / (TM.shutter[1] - TM.shutter[0])));
    // shutter (dark back panel) unrolls from the top behind the blades
    if (su > 0 && part !== 'front') R.layer(A.shutter, M.translate(x0 + FRAME.post - 10, top + FRAME.top - 10), { uv: [0, 0, 1, su], h: A.shutter.h * su });
    if (part === 'back') continue;
    // plinth rises from the floor
    if (pu > 0) R.layer(A.plinth, M.chain(M.translate(x0, bottom - FRAME.plinth * pu)), { uv: [0, 0, 1, pu], h: FRAME.plinth * pu });
    // posts grow upward from the floor
    if (pu > 0) {
      const hh = H * pu;
      for (const px of [x0, x1 - FRAME.post]) R.layer(A.post, M.translate(px, bottom - hh), { uv: [0, 0, 1, pu], h: hh });
    }
    // top panel spreads from the centre outward
    if (tu > 0) {
      const w = RACKW.w * tu;
      R.layer(A.topPanel, M.translate(cx - w / 2, top), { uv: [0.5 - tu / 2, 0, 0.5 + tu / 2, 1], w });
    }
  }
}

export { CELLS, cellHome, ARCHES, STACK, DELTA, THICK };
