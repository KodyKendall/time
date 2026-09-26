// Factory set dressing (wall units): steam cylinders with pistons and teal springs on every
// pillar, gas lamps, gauge needles, hanging chains, steam puffs, moonlight shafts with dust.
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, circlePts } from '../lib/kit.js';
import { ease, noise1 } from '../../engine/math.js';
import { strokesIn, arcStrokes, contour, glints, rivets, rectPts, paintSurface, inkRect, paintCylinderV } from './brushkit.js';
import { archX } from './factory.js';

export const PILLARS = [-3, -2, -1, 0, 1, 2]; // pillar k sits between arch k and k+1
export const pillarX = (k) => archX(k) + 1400;
// layout on a pillar (relative to its centre x; wall y absolute)
export const PL = { cylY0: 820, cylY1: 1400, cylW: 250, rodW: 56, crossY: 520, stroke: 230, lampY: 200, springX: 185, gaugeX: 150, gaugeY: 640 };

// ------------------------------------------------------------------------------------ paint
export function paintCylinder(c) {
  // steam cylinder, painted in a 320 x 680 card, cylinder occupies x 35..285, y 40..640
  const x = 35, y = 40, w = PL.cylW, h = PL.cylY1 - PL.cylY0;
  paintCylinderV(c, x, y, w, h, '#4a3a52', { light: '#b8a0c8', dark: '#120a18', seed: 1 });
  // brass bands
  for (const by of [y + 30, y + h / 2 - 20, y + h - 70]) {
    const band = rectPts(x - 12, by, w + 24, 44);
    paintSurface(c, band, '#c89a3a', ['#ffe08a', '#8a5a1a', '#e8b850'], { angle: 0, spacing: 6, len: [40, 120], weight: [1, 1.6], seed: by });
    c.strokePath([[x - 8, by + 8], [x + w + 8, by + 8]], 'mach_line', '#fff0b0', 0.9, 0);
    inkRect(c, band, { color: '#2a1a08', weight: 0.9 });
    const rv = [];
    for (let i = 0; i < 6; i++) rv.push([x + 10 + i * (w - 20) / 5, by + 22]);
    rivets(c, rv, { r: 5, dark: '#3a2208', light: '#fff0c0' });
  }
  // top cap + gland
  const cap = [[x - 20, y - 10], [x + w + 20, y - 10], [x + w + 8, y + 26], [x - 8, y + 26]];
  paintSurface(c, cap, '#2a2030', ['#5a4a60', '#0e0a12'], { angle: 0, spacing: 6, len: [30, 100], weight: [1, 1.6], seed: 7 });
  inkRect(c, cap, { color: '#08060a', weight: 1 });
  // exhaust elbow on the left
  c.strokePath([[x + 10, y + 60], [x - 20, y + 60], [x - 26, y + 20], [x - 26, y - 20]], 'mach_flat', '#6a3a22', 1.3, 0.5);
  c.strokePath([[x + 6, y + 52], [x - 16, y + 52], [x - 20, y + 16]], 'mach_line', '#e09050', 0.7, 0.5);
  contour(c, rectPts(x, y, w, h), { color: '#08060a', weight: 1.2, lost: 0.2 });
}
export function paintRod(c) {
  // piston rod + crosshead in a 160 x 560 card: crosshead block on top, rod down
  paintCylinderV(c, 52, 90, PL.rodW, 460, '#b8c0c8', { light: '#ffffff', dark: '#3a4048', seed: 2 });
  const ch = rectPts(14, 20, 132, 90);
  paintSurface(c, ch, '#3a2a40', ['#6a5a70', '#140c18'], { angle: 0, spacing: 6, len: [30, 100], weight: [1, 1.6], seed: 3 });
  rivets(c, [[34, 40], [126, 40], [34, 92], [126, 92]], { r: 6 });
  inkRect(c, ch, { color: '#08060a', weight: 1 });
}
export function paintSpring(c) {
  // teal coil spring, vertical, 120 x 520 card: 11 coils
  const cx = 60, y0 = 20, y1 = 500, n = 11, R0 = 44;
  // back halves (darker) then front halves
  for (const front of [false, true]) {
    for (let i = 0; i < n; i++) {
      const pts = [];
      for (let q = 0; q <= 16; q++) {
        const a = (q / 16) * Math.PI + (front ? 0 : Math.PI);
        const yy = lerp(y0, y1, (i + (front ? q / 16 : 1 - q / 16) * 0.5 + (front ? 0 : 0.5)) / n);
        pts.push([cx + Math.cos(a) * R0, yy + Math.sin(a) * 10]);
      }
      c.strokePath(pts, 'mach_flat', front ? C.cyan : '#0e4a50', front ? 1.1 : 0.9, 0.5);
      if (front) c.strokePath(pts.slice(3, 9).map(([x, y]) => [x, y - 4]), 'mach_line', '#d8fff8', 0.6, 0.5);
    }
  }
  c.washPoly(rectPts(8, 4, 104, 18), '#2a2030', 255);
  c.washPoly(rectPts(8, 498, 104, 18), '#2a2030', 255);
}
export function paintChain(c) {
  // a hanging chain 80 x 2600 with a hook at the bottom
  const cx = 40;
  for (let y = 0, i = 0; y < 2440; y += 46, i++) {
    const link = i % 2 === 0 ? circlePts(cx, y + 26, 16, 16).map(([x, yy]) => [cx + (x - cx) * 1.0, y + 26 + (yy - y - 26) * 1.7]) : circlePts(cx, y + 26, 5, 8).map(([x, yy]) => [x, y + 26 + (yy - y - 26) * 5]);
    c.strokePath(link.concat([link[0]]), 'mach_flat', i % 2 ? '#3a3040' : '#6a5a70', 0.9, 0.4);
    if (i % 2 === 0) c.strokePath(link.slice(9, 13), 'mach_line', '#c8b8d0', 0.5, 0.4);
  }
  const hook = [[cx, 2440], [cx, 2500], [cx + 26, 2530], [cx + 18, 2575], [cx - 12, 2580], [cx - 26, 2555]];
  c.strokePath(hook, 'mach_flat', '#2a2230', 2.0, 0.5);
  c.strokePath(hook.slice(1, 4).map(([x, y]) => [x - 4, y - 3]), 'mach_line', '#b8a8c0', 0.6, 0.5);
}
export function paintNeedle(c) {
  // gauge needle pointing right from (20, 20) in a 110 x 40 card
  c.washPoly([[14, 16], [100, 19], [100, 21], [14, 24]], '#1a0e08', 255);
  c.washPoly(circlePts(20, 20, 9, 12), '#8a1a10', 255);
}
export function paintPuffs(c, cx, cy, cell, i) {
  // steam puff sprites: soft billowing clusters of pale watercolour + a few swirling strokes
  const r = rng('puff' + i);
  for (let k = 0; k < 9; k++) {
    const a = r(0, TAU), d = r(0, cell * 0.22);
    const blob = c.blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r(cell * 0.12, cell * 0.24), r(cell * 0.1, cell * 0.2), { wobble: 0.25 });
    c.fillPoly(blob, r.pick(['#f3e6c8', '#e0d6d0', '#fffaf0', '#c8c0c8']), { opacity: 90, bleed: 0.1, texture: 0.6, border: 0.3 });
  }
  arcStrokes(c, cx, cy, cell * 0.08, cell * 0.24, { n: 5, arc: [0.5, 1.2], colors: ['#f3ece6', '#d8d0d8'], brush: 'mach_flat', weight: [0.4, 0.8], seed: i });
}
export function paintShaft(c, w, h) {
  // a moonlight shaft: soft watercolour wedges (wide at the floor), a brighter core, and a few
  // broad soft wash strokes along the beam; drawn additively at low opacity
  const r = rng('shaft');
  const wedge = (a, b, k) => [[w * (0.5 - a), 0], [w * (0.5 + a), 0], [w * (0.5 + b), h * k], [w * (0.5 - b), h * k]];
  c.fillPoly(wedge(0.14, 0.46, 1), '#6a90c0', { opacity: 55, bleed: 0.2, texture: 0.7, border: 0.05 });
  c.fillPoly(wedge(0.08, 0.3, 0.85), '#8ab0e0', { opacity: 60, bleed: 0.18, texture: 0.6, border: 0.05 });
  c.fillPoly(wedge(0.03, 0.14, 0.7), '#c0d8ff', { opacity: 55, bleed: 0.15, texture: 0.5, border: 0.05 });
  for (let i = 0; i < 7; i++) {
    const u = r(0.3, 0.7);
    c.strokePath([[w * u, 0, 0.5], [lerp(w * u, w * (u - 0.5) * 1.6 + w * 0.5, 0.5), h * 0.45, 1], [w * (u - 0.5) * 1.8 + w * 0.5, h * 0.85, 0.3]], 'wash', '#a8c8f0', r(0.8, 1.4), 0.5);
  }
}

// ------------------------------------------------------------------------------------ anim
// piston phase: one full stroke every 2 beats, speeding up as the machine runs faster
export function pistonPhase(lt, spin) { return spin * 0.5; }

// fold/retract factor for the factory dressing as the data centre takes over (1 = present)
export const FOLD = { chainsUp: [2.9, 3.6], pistonsIn: [3.2, 3.75], cool: [2.6, 4.2] };

export function drawPillarMachines(R, A, lt, spin, t) {
  const retract = ease.inOutCubic(clamp((lt - FOLD.pistonsIn[0]) / (FOLD.pistonsIn[1] - FOLD.pistonsIn[0])));
  for (const k of PILLARS) {
    const pc = pillarX(k);
    const ph = pistonPhase(lt, spin) + k * 0.9;
    const lift = (0.5 - 0.5 * Math.cos(ph)) * (1 - retract);
    // piston rod + crosshead (behind the cylinder cap), then the cylinder
    const rodTop = PL.crossY - PL.stroke * lift + retract * 380;
    R.layer(A.rod, M.translate(pc - 80, rodTop - 20));
    // cylinder folds against the pillar (hinge on its right edge) when retracting
    const fw = 1 - retract;
    if (fw > 0.01) R.layer(A.cylinder, M.chain(M.translate(pc + PL.cylW / 2 + 35 - (320) * fw, PL.cylY0 - 40), M.scale(fw, 1)));
    // teal spring: compresses as the piston rises
    if (fw > 0.01) {
      const sq = 0.72 + 0.28 * (1 - lift);
      R.layer(A.spring, M.chain(M.translate(pc + PL.springX - 60 * fw, PL.cylY0 + 40 + 520 * (1 - sq)), M.scale(fw, sq)));
    }
    // gauge needle: pressure rises with the machine speed, twitching
    const press = clamp(0.15 + spin * 0.0 + 0.06 * noise1(t * 3 + k, 3) + 0.5 * smoothstep(1.2, 2.6, lt) + 0.25 * smoothstep(2.5, 3.2, lt), 0, 1);
    const ang = lerp(Math.PI * 0.75, Math.PI * 2.25, press);
    R.layer(A.needle, M.place(pc + PL.gaugeX, PL.gaugeY, 1, ang, 20, 20));
  }
}

export function drawLampGlows(R, lt, t, cool) {
  const warmUp = smoothstep(0.05, 1.3, lt); // gas lamps brighten after the hand-off
  if (warmUp <= 0) return;
  for (const k of PILLARS) {
    const pc = pillarX(k);
    const fl = 0.85 + 0.1 * noise1(t * 7 + k * 3, 21) + 0.05 * noise1(t * 19 + k, 22);
    const warm = [1, 0.62, 0.28], teal = [0.3, 0.9, 1];
    const col = [lerp(warm[0], teal[0], cool), lerp(warm[1], teal[1], cool), lerp(warm[2], teal[2], cool)];
    R.glow(pc, PL.lampY - 4, 40, [1, 0.92, 0.7], 1.6 * fl * (1 - 0.6 * cool) * warmUp, { shape: [2.5, 0.4, 2], ext: 4 });
    R.glow(pc, PL.lampY + 120, 520, col, 0.22 * fl * warmUp, { shape: [1, 0.4, 1.4], ext: 3 });
  }
}

// chains hanging from the girder in front of the pillars, swaying; reeled up later
export function drawChains(R, A, lt, t) {
  const up = ease.inCubic(clamp((lt - FOLD.chainsUp[0]) / (FOLD.chainsUp[1] - FOLD.chainsUp[0])));
  for (const k of PILLARS) {
    for (const [dx, len, ph] of [[-260, 1900, 0.3], [300, 1500, 1.7]]) {
      const x = pillarX(k) + dx, top = -1240;
      const sw = 0.018 * Math.sin(t * 1.3 + ph + k) + 0.008 * Math.sin(t * 2.9 + ph * 2);
      const y = top - up * (len + 400);
      R.layer(A.chain, M.chain(M.translate(x, y), M.rotate(sw), M.translate(-40, 0)), { uv: [0, (2600 - len) / 2600, 1, 1], h: len });
    }
  }
}

// moonlight shafts from the oculi (light only) + drifting dust motes in them
export function drawShafts(R, A, lt, t, cool) {
  const inten = 0.16 * smoothstep(0.5, 2.0, lt);
  for (const k of [-2, -1, 0, 1]) {
    const x = pillarX(k) - 150, y = -1800;
    R.layer(A.shaft, M.chain(M.translate(x, y), M.rotate(-0.42), M.translate(-450, 0)), { blend: 'add', opacity: inten * 0.7, tint: [0.7 + 0.2 * cool, 0.85, 1] });
  }
  const r = rng('dust');
  const parts = [];
  for (let i = 0; i < 260; i++) {
    const k = [-2, -1, 0, 1][i % 4];
    const u = r(), v = r();
    const x0 = pillarX(k) - 150 + lerp(-200, 200, u) + v * 2400 * Math.sin(0.42);
    const y0 = -1800 + v * 2400 * Math.cos(0.42);
    const x = x0 + 40 * Math.sin(t * 0.3 + i), y = y0 + ((t * 25 + i * 37) % 300) - 150;
    parts.push([x, y, r(2, 5), 0, 0.85, 0.9, 1, 0.5 * inten * 4 * (0.5 + 0.5 * Math.sin(t * 2 + i))]);
  }
  R.particles(parts, { kind: 'glow', blend: 'add' });
}

// steam puffs from each cylinder's exhaust: one per beat, rising, growing and thinning
export function drawSteam(R, A, lt, cool) {
  const B = 0.625;
  const stop = 1 - smoothstep(3.3, 4.0, lt);
  if (stop <= 0) return;
  for (const k of PILLARS) {
    const ex = pillarX(k) - 160 + 35 - 26, ey = PL.cylY0 - 40 - 20;
    const off = ((k + 6) % 3) * 0.21;
    const n1 = Math.floor((lt - off) / B);
    for (let n = n1 - 4; n <= n1; n++) {
      const age = lt - off - n * B;
      if (age < 0 || age > 2.4 || n < 0) continue;
      const u = age / 2.4;
      const s = 110 + age * 330;
      const a = Math.sin(Math.min(1, age * 6) * Math.PI / 2) * (1 - u) * (1 - u) * 0.8 * stop;
      const i = ((n % 6) + 6) % 6;
      // billows up and drifts over the pillar (in front of everything on the wall)
      A.puffs.draw(R, i, ex + age * 70 + 30 * Math.sin(age * 2 + n), ey - age * 300, s, n * 0.7 + age * 0.4, { opacity: a, tint: [1 - 0.25 * cool, 1, 1 + 0.1 * cool] });
    }
  }
}

// ------------------------------------------------------------------------------------ belt drive
// A line shaft on the girder drives a pulley on every pillar through a leather belt. The factory
// machinery winds down (coasts to a stop) while the platters spin up.
export const BELT = { top: -1350, bot: -560, r: 70, w: 16, len: 3000, stitch: 50 };
export function paintPulley(c) {
  const cx = 100, cy = 100, R0 = 80;
  const r = rng('pulley');
  c.washPoly(circlePts(cx, cy, R0, 48), '#2a2230', 255);
  arcStrokes(c, cx, cy, R0 * 0.8, R0 * 0.98, { n: 18, colors: ['#4a3a56', '#1a1420', '#6a5a76'], brush: 'mach_flat', weight: [0.3, 0.5], seed: 1 });
  for (let s = 0; s < 6; s++) {
    const a0 = (s / 6) * TAU + 0.18, a1 = ((s + 1) / 6) * TAU - 0.18;
    const hole = [];
    for (let k = 0; k <= 8; k++) hole.push([cx + Math.cos(lerp(a0, a1, k / 8)) * R0 * 0.74, cy + Math.sin(lerp(a0, a1, k / 8)) * R0 * 0.74]);
    for (let k = 8; k >= 0; k--) hole.push([cx + Math.cos(lerp(a0 + 0.2, a1 - 0.2, k / 8)) * R0 * 0.3, cy + Math.sin(lerp(a0 + 0.2, a1 - 0.2, k / 8)) * R0 * 0.3]);
    c.washPoly(hole, '#140e1c', 255);
  }
  c.washPoly(circlePts(cx, cy, R0 * 0.24, 20), '#8a7a96', 255);
  c.washPoly(circlePts(cx, cy, R0 * 0.1, 12), '#140e1c', 255);
  arcStrokes(c, cx, cy, R0 * 0.86, R0 * 0.95, { n: 4, arc: [0.4, 0.8], colors: ['#d8c8e8'], brush: 'mach_line', weight: [0.6, 0.9], a0: 3.6, a1: 5.0, seed: 3 });
  contour(c, circlePts(cx, cy, R0, 48), { color: '#08060c', weight: 1, lost: 0.2 });
}
export function paintBelt(c) {
  const { w, len, stitch } = BELT;
  const r = rng('belt');
  c.washPoly(rectPts(2, 0, w, len), '#6a3a1e', 255);
  for (let y = 0; y < len; y += 180) c.strokePath([[5, y, 0.6], [5, y + 90, 1], [5, y + 170, 0.6]], 'mach_flat', '#a0643a', 0.25, 0);
  for (let y = 0; y < len; y += 180) c.strokePath([[w - 3, y + 40, 0.6], [w - 3, y + 130, 1], [w - 3, y + 175, 0.6]], 'mach_flat', '#3a1e0e', 0.25, 0);
  // stitches / splice marks (make the belt's travel readable); period = BELT.stitch
  for (let y = 0; y < len; y += stitch) c.strokePath([[5, y + 10], [w - 2, y + 13]], 'mach_line', '#e8c090', 0.5, 0);
}
export function paintToolBoard(c, ox, oy) {
  // wooden tool board with a spanner, a hammer and an oil can (local coords offset ox, oy)
  const r = rng('tools' + ox);
  const board = rectPts(ox, oy, 190, 420);
  paintSurface(c, board, '#6e4326', ['#a8703e', '#4a2a16', '#8a5a30'], { angle: Math.PI / 2, spacing: 8, len: [80, 260], weight: [1.4, 2.2], seed: 91 });
  inkRect(c, board, { color: '#1e0e06', weight: 1 });
  rivets(c, [[ox + 16, oy + 16], [ox + 174, oy + 16], [ox + 16, oy + 404], [ox + 174, oy + 404]], { r: 5 });
  // spanner (hanging on a peg)
  const sx = ox + 50, sy = oy + 40;
  c.strokePath([[sx, sy + 40, 1], [sx + 2, sy + 150, 1], [sx, sy + 250, 1]], 'mach_flat', '#8a8a96', 1.4, 0.3);
  c.washPoly(circlePts(sx, sy + 30, 22, 16), '#8a8a96', 255);
  c.washPoly(rectPts(sx - 8, sy + 2, 16, 26), '#6e4326', 255);
  c.washPoly(circlePts(sx, sy + 262, 20, 16), '#8a8a96', 255);
  c.strokePath([[sx - 6, sy + 60], [sx - 6, sy + 230]], 'mach_line', '#e0e0f0', 0.6, 0);
  // hammer
  const hx = ox + 120, hy = oy + 40;
  c.strokePath([[hx, hy + 30, 1], [hx + 1, hy + 180, 1], [hx, hy + 300, 0.9]], 'mach_flat', '#b8844a', 1.1, 0.2);
  c.washPoly(rectPts(hx - 36, hy + 6, 72, 34), '#3a3440', 255);
  c.strokePath([[hx - 32, hy + 12], [hx + 30, hy + 12]], 'mach_line', '#c8c0d8', 0.6, 0);
  // oil can on the ledge
  const cx = ox + 95, cy = oy + 380;
  c.washPoly([[cx - 30, cy], [cx + 30, cy], [cx + 26, cy - 60], [cx - 26, cy - 60]], '#c8902e', 255);
  c.washPoly([[cx - 10, cy - 60], [cx + 10, cy - 60], [cx + 4, cy - 86], [cx - 4, cy - 86]], '#a8741e', 255);
  c.strokePath([[cx + 4, cy - 80], [cx + 40, cy - 110], [cx + 62, cy - 124]], 'mach_flat', '#a8741e', 0.35, 0.4);
  c.strokePath([[cx - 22, cy - 52], [cx - 20, cy - 8]], 'mach_line', '#ffe0a0', 0.8, 0);
  c.washPoly(rectPts(ox + 10, oy + 384, 170, 14), '#4a2a16', 255);
}

function beltAngle(lt, master) {
  // follows the machine until 120.4, then coasts to a stop
  const T = 2.9, tau = 0.45;
  if (lt <= T) return 0.9 * master(lt);
  const h = 1 / 240;
  const w0 = 0.9 * (master(T) - master(T - h)) / h;
  return 0.9 * master(T) + w0 * tau * (1 - Math.exp(-(lt - T) / tau));
}
export function drawBelts(R, A, lt, master) {
  const ang = beltAngle(lt, master);
  const { top, bot, r, w, len, stitch } = BELT;
  const off = ((ang * r) % stitch + stitch) % stitch;
  for (const k of PILLARS) {
    const x = pillarX(k);
    const L = bot - top;
    // left strand runs up, right strand runs down
    R.layer(A.belt, M.translate(x - r - w / 2 - 2, top), { uv: [0, off / len, 1, (off + L) / len], h: L });
    R.layer(A.belt, M.translate(x + r - w / 2 - 2, top), { uv: [0, (stitch - off) / len, 1, (stitch - off + L) / len], h: L });
    for (const y of [top, bot]) R.layer(A.pulley, M.place(x, y, (r + 6) / 80, ang, 100, 100));
  }
}

// Dust motes drifting in the warm lamp light in front of the gear train (particles).
const MOTES = (() => {
  const r = rng('motes');
  return Array.from({ length: 90 }, () => ({ x: r(-900, 2800), y: r(-700, 1700), s: r(6, 16), vx: r(-12, 12), vy: r(-26, -6), ph: r(0, TAU), f: r(0.4, 1.3), c: r() }));
})();
export function drawMotes(R, lt) {
  const a = smoothstep(0.1, 1.2, lt) * (1 - smoothstep(3.2, 4.2, lt));
  if (a <= 0) return;
  const out = [];
  for (const m of MOTES) {
    const x = m.x + m.vx * lt + 18 * Math.sin(lt * m.f + m.ph);
    const y = m.y + m.vy * lt + 10 * Math.sin(lt * m.f * 1.3 + m.ph * 2);
    const tw = 0.6 + 0.4 * Math.sin(lt * 2.3 * m.f + m.ph);
    const col = m.c < 0.5 ? [1, 0.78, 0.5] : [1, 0.9, 0.72];
    out.push([x, y, m.s, 0, col[0], col[1], col[2], 0.45 * a * tw]);
  }
  R.particles(out, { kind: 'soft', blend: 'add' });
}
