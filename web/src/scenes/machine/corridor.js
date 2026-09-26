// The data-hall in 3D painted cards: floor (= the die, split at the aisle), racks, LEDs, lamps,
// data ribbons. World units (wu); see world.js.
import { C } from '../lib/palette.js';
import { PIVOT } from '../pivots.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep } from '../lib/kit.js';
import { ribbon } from '../lib/kit.js';
import { noise1 } from '../../engine/math.js';
import { clipNear, cardBounds } from './cam.js';
import { drawCard } from './quad.js';
import { WORLD, rackBox } from './world.js';
import { RACK_LEDS, RACKW } from './datacenter.js';
import { rectPts, strokesIn, paintSurface, inkRect } from './brushkit.js';

const ZE = WORLD.ZE, HR = WORLD.H;
export const FOG_COL = hex('#0e2836');

// ------------------------------------------------------------------------------------ cards
export function card(R, cam, L, P0, Eu, Ev, o = {}) {
  const d = cam.cardDepth(P0, Eu, Ev);
  let poly = o.poly || [[0, 0], [1, 0], [1, 1], [0, 1]];
  const near = 1.5;
  if (Math.min(d[0], d[0] + d[1], d[0] + d[2], d[0] + d[1] + d[2]) < near) {
    poly = clipNear(poly, d, near);
    if (poly.length < 3) return false;
  }
  const H = cam.cardH(P0, Eu, Ev);
  const b = cardBounds(H, poly);
  if (!b || b.x1 < -40 || b.x0 > 1960 || b.y1 < -40 || b.y0 > 1120) return false;
  drawCard(R, L, H, { fog: cam.fog, fogCol: FOG_COL, ...o, poly });
  return true;
}

// ------------------------------------------------------------------------------------ aisle floor
// A block of aisle floor: 300 x 480 wu, painted at 4 units per wu (1200 x 1920 units).
export const AISLE = { w: 300, h: 480, u: 4 };
export function paintAisleBlock(c, variant) {
  const r = rng('aisle' + variant);
  const U = AISLE.u, W = AISLE.w * U, H = AISLE.h * U;
  paintSurface(c, rectPts(0, 0, W, H), '#0c1e26', ['#12303a', '#081418', '#163a44'], { angle: Math.PI / 2, spacing: 30, len: [300, 900], weight: [4, 7], seed: variant, mix: [0.1, 0.3] });
  // tiles: 60 wu squares; perforated ones get dot grids
  for (let tz = 0; tz < AISLE.h / 60; tz++) for (let tx = 0; tx < AISLE.w / 60; tx++) {
    const x0 = tx * 60 * U, y0 = tz * 60 * U;
    if (tx === 2) continue; // the runner lane
    if (r() < 0.35) {
      for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) {
        const x = x0 + 30 + a * 30, y = y0 + 30 + b * 30;
        c.strokePath([[x, y], [x + 4, y + 1]], 'mach_flat', '#05101a', 0.3, 0);
      }
    }
    if (r() < 0.25) strokesIn(c, rectPts(x0 + 8, y0 + 8, 60 * U - 16, 60 * U - 16), { angle: Math.PI / 2, spacing: 26, len: [60, 200], colors: ['#1a4a55', '#0a2a33'], brush: 'mach_flat', weight: [0.5, 0.9], seed: tz * 13 + tx + variant * 101 });
  }
  // seams: every 60 wu along X, every 120 wu across (ochre, like the die), 60 wu fine dark ones
  for (let x = 0; x <= W; x += 60 * U) c.strokePath([[x, 0], [x + r(-2, 2), H / 2], [x, H]], 'mach_line', '#07161c', 1.2, 0.2);
  for (let y = 0; y <= H; y += 60 * U) {
    const ochre = Math.round(y / U) % 120 === 0;
    c.strokePath([[0, y], [W / 2, y + r(-2, 2)], [W, y]], ochre ? 'mach_line' : 'mach_line', ochre ? C.ochre : '#07161c', ochre ? 1.3 : 1.0, 0.2);
  }
  // the teal runner down the middle (120 wu wide)
  const rx0 = 120 * U, rx1 = 180 * U;
  const run = [[rx0 + r(-4, 4), 0], [rx1 + r(-4, 4), 0], [rx1 + r(-4, 4), H], [rx0 + r(-4, 4), H]];
  paintSurface(c, run, C.teal, [C.cyan, C.deepTeal, C.aqua, C.sea], { angle: Math.PI / 2, spacing: 14, len: [200, 700], weight: [3, 5], seed: 50 + variant, mix: [0.12, 0.4] });
  c.strokePath([[rx0 + 18, 0], [rx0 + 18, H]], 'mach_line', '#8fe8e0', 1.3, 0);
  c.strokePath([[rx1 - 14, 0], [rx1 - 14, H]], 'mach_flat', '#0a3a40', 0.5, 0);
  // painted reflections of the LED walls along both sides
  for (let i = 0; i < 40; i++) {
    const side = r() < 0.5 ? r(0, 70) * U : r(230, 300) * U;
    const y = r(0, H), L = r(80, 300);
    c.strokePath([[side, y], [side + r(-3, 3), y + L]], 'mach_flat', r.pick(['#1f6f78', '#2aa0a0', '#3a5a70', '#7a4060']), r(0.3, 0.7), 0);
  }
}

// ------------------------------------------------------------------------------------ floor
function floorDie(R, cam, L, dx0, dx1, dy0, dy1, sh) {
  const xs = [dx0], ys = [dy0];
  for (let x = Math.ceil(dx0 / 1920) * 1920; x < dx1; x += 1920) if (x > dx0) xs.push(x);
  xs.push(dx1);
  for (let y = Math.ceil(dy0 / 1080) * 1080; y < dy1; y += 1080) if (y > dy0) ys.push(y);
  ys.push(dy1);
  for (let a = 0; a < xs.length - 1; a++) for (let b = 0; b < ys.length - 1; b++) {
    const x0 = xs[a], x1 = xs[a + 1], y0 = ys[b], y1 = ys[b + 1];
    const ox = Math.floor(x0 / 1920) * 1920, oy = Math.floor(y0 / 1080) * 1080;
    const uv = [(x0 - ox) / 1920, (y0 - oy) / 1080, (x1 - ox) / 1920, (y1 - oy) / 1080];
    card(R, cam, L, [x0 - 960 + sh, 0, 1080 - y0], [x1 - x0, 0, 0], [0, 0, -(y1 - y0)], { uv });
  }
}
export function drawFloor(R, cam, A, AD, s) {
  const L = AD.grid;
  const dyWall = 1080 - ZE;
  floorDie(R, cam, L, -1920 * 1.5, 960, dyWall, 1080 * 2.5, -s / 2);
  floorDie(R, cam, L, 960, 1920 * 2.5, dyWall, 1080 * 2.5, s / 2);
  if (s > 0.5) {
    // aisle blocks between the halves (stationary in the world; the racks slide over them)
    const u0 = 0.5 - s / 600, u1 = 0.5 + s / 600;
    for (let z = 1440; z > -1700; z -= AISLE.h) {
      const vb = ((Math.round(z / AISLE.h) % 3) + 3) % 3;
      const zb = Math.max(z - AISLE.h, -1700);
      card(R, cam, A.aisle[vb], [-s / 2, 0, z], [s, 0, 0], [0, 0, zb - z], { uv: [u0, 0, u1, (z - zb) / AISLE.h] });
    }
  }
}

// ------------------------------------------------------------------------------------ racks
const LIT = (i, j, t) => PIVOT.die.lit(i, j, t);
export function drawRacks(R, cam, A, AD, s, lt, t, { leds = 1, lamps = 1, surge = 0, surgeZ = -1e9 } = {}) {
  const list = [];
  for (let i = WORLD.cols[0]; i <= WORLD.cols[1]; i++) {
    for (let j = WORLD.rows[0]; j <= WORLD.rows[1]; j++) {
      const b = rackBox(i, j, s);
      const c = cam.toCam((b.x0 + b.x1) / 2, HR / 2, (b.z0 + b.z1) / 2);
      if (c[2] < -150) continue;
      list.push({ i, j, b, d: c[2] });
    }
  }
  list.sort((a, b) => b.d - a.d);
  const ledParts = [], lampQuads = [];
  const topsVisible = cam.y > HR;
  for (const it of list) {
    const { i, j, b } = it;
    const di = ((i % 16) + 16) % 16, dj = ((j % 9) + 9) % 9;
    const x0 = di * 120 + 5, y0 = dj * 120 + 5;
    const topUV = [x0 / 1920, y0 / 1080, (x0 + 110) / 1920, (y0 + 110) / 1080];
    const vf = ((i * 7 + j * 3) % 3 + 3) % 3, vs = ((i + j) % 2 + 2) % 2;
    const front = A.rackFront[vf], side = A.rackSide[vs];
    let fr = null;
    if (i <= 7) { if (cam.x > b.x1) fr = [[b.x1, HR, b.z1], [0, 0, -100], [0, -HR, 0]]; }
    else if (cam.x < b.x0) fr = [[b.x0, HR, b.z0], [0, 0, 100], [0, -HR, 0]];
    let drawnFront = false;
    const sides = cam.ortho < 0.5; // looking straight down the sides are edge-on: skip them
    if (fr && sides) drawnFront = card(R, cam, front, fr[0], fr[1], fr[2]);
    if (sides) {
      if (i <= 7 && cam.x < b.x0) card(R, cam, side, [b.x0, HR, b.z0], [0, 0, 100], [0, -HR, 0]);
      if (i > 7 && cam.x > b.x1) card(R, cam, side, [b.x1, HR, b.z1], [0, 0, -100], [0, -HR, 0]);
      if (cam.z < b.z0) card(R, cam, side, [b.x0, HR, b.z0], [100, 0, 0], [0, -HR, 0]);
      if (cam.z > b.z1) card(R, cam, side, [b.x1, HR, b.z1], [-100, 0, 0], [0, -HR, 0]);
    }
    const lit = LIT(i, j, t);
    if (topsVisible) {
      card(R, cam, AD.grid, [b.x0 - 5, HR, b.z1 + 5], [110, 0, 0], [0, 0, -110], { uv: topUV });
      if (lit && lamps > 0) lampQuads.push(b);
    }
    // LEDs on the visible front
    if (drawnFront && leds > 0) collectLEDs(cam, fr, i, j, t, lit, leds, surge, surgeZ, ledParts);
  }
  if (ledParts.length) R.particles(ledParts, { kind: 'glow', blend: 'add' });
  // lit rack-top lamps: exactly the die's lights at the end (cream plates + warm glow)
  for (const b of lampQuads) {
    const X0 = b.x0 + 8, Z1 = b.z1 - 8;
    card(R, cam, null, [X0, HR, Z1], [84, 0, 0], [0, 0, -84], { solid: [...hex(C.cream), 0.92 * lamps], fog: [0, 1, 0] });
    // the lamp's glow, foreshortened like the plate (a circle once we look straight down)
    const mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
    const cc = cam.project(mx, HR, mz);
    const pa = cam.project(mx - 50, HR, mz), pb = cam.project(mx + 50, HR, mz);
    const pc = cam.project(mx, HR, mz - 50), pd = cam.project(mx, HR, mz + 50);
    if (cc[2] > 0 && pa[2] > 0 && pb[2] > 0 && pc[2] > 0 && pd[2] > 0) {
      const wx = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), wz = Math.hypot(pd[0] - pc[0], pd[1] - pc[1]);
      const rot = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
      const fs = clamp(wz / Math.max(1e-3, wx), 0.05, 1);
      R.glow(cc[0], cc[1], 0.45 * wx, [1, 0.8, 0.45], 0.35 * lamps * smoothstep(0.1, 0.6, fs), { ext: 2.2, sx: 1, sy: fs, rot });
    }
  }
}

function collectLEDs(cam, fr, i, j, t, lit, amt, surge, surgeZ, out) {
  const [P0, Eu, Ev] = fr;
  const k = (i * 131 + j * 71) | 0;
  for (let n = 0; n < RACK_LEDS.length; n++) {
    const ld = RACK_LEDS[n];
    const u = ld.x / RACKW.w, v = ld.y / RACKW.h;
    const X = P0[0] + Eu[0] * u, Y = P0[1] + Ev[1] * v, Z = P0[2] + Eu[2] * u;
    const p = cam.project(X, Y, Z);
    if (!(p[2] > 1) || p[0] < -20 || p[0] > 1940 || p[1] < -20 || p[1] > 1100) continue;
    const id = k + n * 17;
    const rate = 1.5 + (id % 7) * 0.6;
    const on = Math.sin(t * rate + id * 1.7) > -0.2 ? 1 : 0.12;
    const hot = lit ? 1.5 : 1;
    const wave = surge > 0 ? surge * 3 * Math.exp(-(((Z - surgeZ) / 110) ** 2)) : 0;
    const col = ld.k === 3 ? [1, 0.62, 0.22] : ld.k === 0 ? [0.55, 1, 0.75] : [0.4, 0.95, 1];
    const size = Math.max(1.1, 0.75 * cam.scaleAt(p[2]));
    out.push([p[0], p[1], size, 0, col[0], col[1], col[2], amt * (on * 0.85 * hot + wave)]);
  }
}

// ------------------------------------------------------------------------------------ ribbons
// Three broad twisting ribbons of data (orange / rose / cream) + bundles of fine strands.
const BANDS = [
  { x: -55, y: 305, w: 16, col: C.orange, ax: 36, ay: 16, fx: 0.0032, fy: 0.0047, ph: 0.4, sp: 0.9, ft: 0.006, st: 3.1 },
  { x: 35, y: 330, w: 13, col: C.rose, ax: 30, ay: 12, fx: 0.0027, fy: 0.0052, ph: 2.1, sp: 1.1, ft: 0.0072, st: 3.6 },
  { x: 5, y: 285, w: 10, col: C.cream, ax: 42, ay: 18, fx: 0.0036, fy: 0.0041, ph: 4.2, sp: 0.8, ft: 0.0055, st: 2.7 },
];
// Four bundles of fine strands flowing along the ceiling of the aisle (orange / rose / cream).
const RIB = (() => {
  const r = rng('ribbons');
  const bundles = [
    { x: -70, y: 300, col: [C.orange, C.amber, '#e0503a', C.gold], n: 6 },
    { x: 40, y: 330, col: [C.rose, C.cream, '#f0a0a8', C.magenta], n: 7 },
    { x: -20, y: 285, col: [C.cream, C.gold, '#fff0d0', C.amber], n: 5 },
    { x: 95, y: 290, col: [C.orange, C.rose, C.cream, '#ffb070'], n: 6 },
  ];
  const out = [];
  bundles.forEach((b, bi) => {
    const ph = r(0, TAU), ax = r(18, 40), ay = r(8, 20), fx = r(0.0025, 0.004), fy = r(0.003, 0.006), sp = r(0.7, 1.2);
    for (let i = 0; i < b.n; i++) {
      out.push({ bundle: bi, x: b.x + (i - b.n / 2) * r(2.2, 3.6), y: b.y + (i - b.n / 2) * r(1.2, 2.4), w: r(0.35, 1.1),
        col: b.col[i % b.col.length], ax, ay, fx, fy, ph: ph + i * 0.05, sp, speed: r(200, 330), dph: r(0, 1) });
    }
  });
  return out;
})();
function ribbonSpine(rb, lt, zNear, zFar, grow, drain) {
  const pts = [];
  const n = 48;
  const zStart = lerp(zFar, zNear, grow * (1 - drain));
  for (let q = 0; q <= n; q++) {
    const u = q / n, z = lerp(zStart, zFar, 1 - (1 - u) * (1 - u));
    const k = clamp((zFar - z) / 1400);
    const x = rb.x + rb.ax * Math.sin(z * rb.fx + rb.ph + lt * rb.sp) * (0.25 + 0.75 * k);
    const y = rb.y + rb.ay * Math.sin(z * rb.fy + rb.ph * 1.3 + lt * rb.sp * 1.3) * (0.25 + 0.75 * k) - 10 * (1 - k);
    pts.push([x, y, z]);
  }
  return pts;
}
export function drawRibbons(R, cam, lt, { amount = 1, grow = 1, drain = 0, surge = 0, surgeZ = -1e9, camN = cam, ltN = lt, floorHalf = 0 } = {}) {
  if (amount <= 0 || drain >= 1 || grow <= 0) return;
  const zNear = cam.z - 40, zFar = ZE - 30;
  const zNearN = camN.z - 40;
  const proj = RIB.map((rb) => {
    const spineN = ribbonSpine(rb, ltN, zNearN, zFar, grow, drain);
    const out = [];
    for (const [x, y, z] of spineN) {
      const p = camN.project(x, y, z);
      if (p[2] > 6 && p[1] > -400) out.push([p[0], p[1], camN.scaleAt(p[2]) * rb.w * (1 - drain)]);
    }
    return { rb, pts: out, spine: ribbonSpine(rb, lt, zNear, zFar, grow, drain) };
  }).filter((q) => q.pts.length > 3);
  // three broad calligraphic ribbons (twisting bands) + the fine strands around them
  const bands = BANDS.map((bd) => {
    const out = [];
    const zStart = lerp(zFar, zNearN, grow * (1 - drain));
    const n = 56;
    for (let q = 0; q <= n; q++) {
      const u = q / n, z = lerp(zStart, zFar, 1 - (1 - u) * (1 - u));
      const k = clamp((zFar - z) / 1400);
      const x = bd.x + bd.ax * Math.sin(z * bd.fx + bd.ph + ltN * bd.sp) * (0.3 + 0.7 * k);
      const y = bd.y + bd.ay * Math.sin(z * bd.fy + bd.ph * 1.7 + ltN * bd.sp * 1.2) * (0.3 + 0.7 * k);
      const tw = Math.cos(z * bd.ft - ltN * bd.st + bd.ph);
      const p = camN.project(x, y, z);
      if (p[2] > 6 && p[1] > -600) out.push([p[0], p[1], camN.scaleAt(p[2]) * bd.w * (1 - drain) * (0.18 + 0.82 * Math.abs(tw)), tw]);
    }
    return { bd, pts: out };
  }).filter((b) => b.pts.length > 3);
  const L = R.dyn('ribbons', R.key(30), (c) => {
    for (const { bd, pts } of bands) {
      const col = mixHex(bd.col, '#fff4d8', 0.3 * surge);
      const body = pts.map((p) => [p[0], p[1], Math.min(140, p[2])]);
      // underpaint: the band's silhouette in a deeper tone
      c.washPoly(ribbon(body, 1, 1), mixHex(col, '#3a1020', 0.3), 225);
      c.flush();
      // body: five flat strokes along the flow, each following its own lane across the band,
      // pressure = local band width (the brush swells towards the camera); lanes shade from the
      // lit upper edge to the shadowed lower edge
      const n = pts.length;
      const lanes = [[-0.36, 0.55, '#fffaf0'], [-0.18, 0.3, '#ffffff'], [0, 0.12, null], [0.18, -0.12, '#2a0818'], [0.36, -0.3, '#2a0818']];
      // tangent normals
      const nrm = pts.map((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
        return [-dy / d, dx / d];
      });
      const segs = [[0, 0.34], [0.34, 0.67], [0.67, 1]];
      for (const [off, k, mixc] of lanes) {
        const lc = mixc ? mixHex(col, mixc, Math.abs(k)) : col;
        for (const [a, b] of segs) {
          const i0 = Math.floor(a * (n - 1)), i1 = Math.floor(b * (n - 1));
          if (i1 - i0 < 1) continue;
          let wref = 0;
          for (let i = i0; i <= i1; i++) wref = Math.max(wref, pts[i][2]);
          if (wref < 0.3) continue;
          const lane = [];
          for (let i = i0; i <= i1; i++) {
            const w = pts[i][2];
            lane.push([pts[i][0] + nrm[i][0] * off * w, pts[i][1] + nrm[i][1] * off * w, clamp(w / wref, 0.08, 1)]);
          }
          c.strokePath(lane, 'mach_flat', lc, Math.max(0.06, (wref * 0.24) / 5), 0.5);
        }
      }
      // a dry-brush sparkle along the lit edge
      const edge = pts.map((p, i) => [p[0] - nrm[i][0] * p[2] * 0.42, p[1] - nrm[i][1] * p[2] * 0.42, 1]);
      c.strokePath(edge, 'dry', mixHex(col, '#ffffff', 0.7), 0.25, 0.5);
    }
    for (const { rb, pts } of proj) {
      const col = mixHex(rb.col, '#fff4d8', 0.3 * surge);
      // split by depth so the brush weight follows perspective
      const segs = [[0, 0.3], [0.28, 0.55], [0.52, 0.78], [0.76, 1]];
      for (const [a, b] of segs) {
        const i0 = Math.floor(a * (pts.length - 1)), i1 = Math.ceil(b * (pts.length - 1));
        const sg = pts.slice(i0, i1 + 1);
        if (sg.length < 2) continue;
        const wmid = sg[Math.floor(sg.length / 2)][2];
        const wb = clamp(wmid / 5, 0.12, 2.2);
        c.strokePath(sg.map((p) => [p[0], p[1], 1]), 'mach_flat', col, wb, 0.5);
        if (wb > 0.3) c.strokePath(sg.map((p) => [p[0], p[1] - wb * 1.0, 1]), 'mach_line', mixHex(col, '#fffaf0', 0.6), Math.max(0.25, wb * 0.3), 0.5);
      }
    }
  });
  R.layer(L, M.id(), { opacity: amount });
  // data packets travelling along the strands (towards the camera)
  const parts = [];
  for (const { rb, spine } of proj) {
    for (let m = 0; m < 3; m++) {
      const u = ((lt * rb.speed * (1 + surge * 2) / 1600 + m / 3 + rb.dph) % 1 + 1) % 1;
      const idx = Math.floor((1 - u) * (spine.length - 1));
      const [x, y, z] = spine[idx];
      const p = cam.project(x, y, z);
      if (!(p[2] > 6)) continue;
      const sz = Math.min(26, cam.scaleAt(p[2]) * 2.2);
      const cc = hex(rb.col);
      parts.push([p[0], p[1], sz, 0, cc[0], cc[1], cc[2], (0.8 + 1.2 * surge) * amount]);
      // its reflection in the glossy aisle floor (mirror image below the floor plane)
      if (Math.abs(x) < floorHalf) {
        const q = cam.project(x, -y, z);
        if (q[2] > 6) parts.push([q[0], q[1], sz * 1.6, 0, cc[0], cc[1], cc[2], 0.22 * (0.8 + 1.2 * surge) * amount]);
      }
    }
    // the surge front racing along each strand
    if (surge > 0) {
      for (let q = 0; q < spine.length; q += 2) {
        const [x, y, z] = spine[q];
        const w = Math.exp(-(((z - surgeZ) / 70) ** 2));
        if (w < 0.05) continue;
        const p = cam.project(x, y, z);
        if (!(p[2] > 6)) continue;
        const cc = hex(rb.col);
        parts.push([p[0], p[1], Math.min(30, cam.scaleAt(p[2]) * 3), 0, 1, 0.5 + cc[1] * 0.5, 0.4 + cc[2] * 0.6, 1.6 * w * surge * amount]);
      }
    }
  }
  if (parts.length) R.particles(parts, { kind: 'glow', blend: 'add' });
}

// ------------------------------------------------------------------------------------ trays
// Ladder cable trays spanning the aisle at the height of the rack tops, with drooping cables.
export const TRAYS = [1150, 915, 675, 435, 195];
export function paintTray(c) {
  // 1200 x 120 (a 300 wu wide tray, 4 units per wu): rails + rungs + cables
  const r = rng('tray');
  c.washPoly(rectPts(0, 8, 1200, 26), C.orange, 255);
  c.washPoly(rectPts(0, 86, 1200, 26), C.orange, 255);
  strokesIn(c, rectPts(0, 8, 1200, 26), { angle: 0, spacing: 6, len: [100, 400], colors: [C.amber, C.rust, '#ff9a50'], brush: 'mach_flat', weight: [0.3, 0.6], seed: 1 });
  strokesIn(c, rectPts(0, 86, 1200, 26), { angle: 0, spacing: 6, len: [100, 400], colors: [C.amber, C.rust, '#ff9a50'], brush: 'mach_flat', weight: [0.3, 0.6], seed: 2 });
  for (let x = 20; x < 1200; x += 60) c.washPoly(rectPts(x, 30, 12, 60), '#8a3a1a', 255);
  for (let i = 0; i < 14; i++) {
    const y = r(38, 80), col = r.pick([C.cyan, C.rose, C.cream, C.gold, '#3a6ae0', C.teal]);
    c.strokePath([[0, y], [300, y + r(-6, 6)], [600, y + r(-6, 6)], [900, y + r(-6, 6)], [1200, y]], 'mach_flat', col, r(0.4, 0.8), 0.5);
  }
  inkRect(c, rectPts(0, 8, 1200, 104), { color: '#2a0e06', weight: 1 });
}
export function paintDroop(c) {
  // cables drooping from a tray: 1200 x 400 card, catenaries
  const r = rng('droop');
  for (let i = 0; i < 9; i++) {
    const x0 = r(40, 500), x1 = x0 + r(200, 600), sag = r(80, 330), col = r.pick([C.cyan, C.rose, C.cream, C.gold, C.orange, '#3a6ae0']);
    const pts = [];
    for (let q = 0; q <= 16; q++) { const u = q / 16; pts.push([lerp(x0, x1, u), 20 + sag * 4 * u * (1 - u)]); }
    c.strokePath(pts, 'mach_flat', col, r(0.35, 0.7), 0.5);
  }
}
export function drawTrays(R, cam, A, s, lt) {
  // trays span exactly the aisle, so they are squeezed away together with it when the hall closes
  if (s < 2) return;
  const u0 = 0.5 - s / 600, u1 = 0.5 + s / 600;
  for (const z of TRAYS) {
    card(R, cam, A.tray, [-s / 2, HR + 6, z + 12], [s, 0, 0], [0, 0, -24], { uv: [u0, 0, u1, 1] });
    card(R, cam, A.tray, [-s / 2, HR + 12, z - 12], [s, 0, 0], [0, -10, 0], { uv: [u0, 0, u1, 1] });
    card(R, cam, A.droop, [-s / 2, HR + 4, z], [s, 0, 0], [0, -34, 0], { uv: [u0, 0, u1, 1] });
  }
}

// ------------------------------------------------------------------------------------ haze
// Painterly haze veils standing across the aisle at depth (atmosphere; drawn with low opacity).
export function drawHaze(R, cam, A, s, lt, amt) {
  if (amt <= 0) return;
  for (let i = 0; i < 6; i++) {
    const z = 1300 - i * 260;
    const w = Math.max(40, s + 40);
    const dz = z - cam.z;
    const near = smoothstep(120, 500, dz);
    if (near <= 0) continue;
    card(R, cam, A.haze, [-w / 2, HR + 60, z], [w, 0, 0], [0, -HR - 60, 0], { opacity: 0.1 * amt * near, blend: 'screen', uv: [(i * 0.13) % 0.5, 0, (i * 0.13) % 0.5 + 0.5, 1] });
  }
}
export function paintHaze(c, w, h) {
  const r = rng('haze');
  for (let i = 0; i < 26; i++) {
    const blob = c.blob(r(0, w), r(h * 0.1, h), r(w * 0.08, w * 0.2), r(h * 0.06, h * 0.16), { wobble: 0.3 });
    c.fillPoly(blob, r.pick(['#2a6a78', '#1f4e5a', '#3a7a88', '#5a4a70']), { opacity: 40, bleed: 0.15, texture: 0.8, border: 0.1 });
  }
}
