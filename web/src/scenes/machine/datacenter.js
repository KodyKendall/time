// Painted data-centre parts: hard-disk platter, blade face, rack frame (wall units), and the
// corridor rack textures (world units: a rack face is 100 x 250 wu).
import { C } from '../lib/palette.js';
import { rng, lerp, clamp, mixHex, TAU } from '../../engine/math.js';
import { circlePts } from '../lib/kit.js';
import { strokesIn, arcStrokes, contour, glints, rivets, rectPts, paintSurface, inkRect, paintCylinderV } from './brushkit.js';

export const PLAT = { R: 372, size: 800 };       // platter radius (wall units) and layer size
export const BLADE = { w: 664, h: 140 };         // blade face (wall units)
export const RACKW = { w: 2333, h: 5833 };       // rack front in wall units (100 x 250 wu)

const SILVER = ['#cfe3e0', '#a9c9c6', '#8fb4b3', '#e4f1ee', '#7fa6a8', '#bcd8d4'];

// ------------------------------------------------------------------------------------ platter
export function paintPlatter(c) {
  const cx = PLAT.size / 2, cy = PLAT.size / 2, R0 = PLAT.R;
  const disc = circlePts(cx, cy, R0, 120);
  c.washPoly(disc, '#2e4854', 255);
  c.flush();
  // a mirror in a dark hall: mostly dark reflected surroundings in concentric zones, steel bands
  const zones = [[0.22, 0.34, '#5f8088'], [0.34, 0.5, '#23394a'], [0.5, 0.62, '#48707a'], [0.62, 0.8, '#1c3040'], [0.8, 0.9, '#6f98a0'], [0.9, 0.99, '#2a4452']];
  zones.forEach(([a, b, col], i) => arcStrokes(c, cx, cy, R0 * a, R0 * b, { n: 60, arc: [1.2, 3.2], colors: [col, mixHex(col, '#9fd8d8', 0.25), mixHex(col, '#0c1822', 0.3)], brush: 'mach_flat', weight: [0.35, 0.7], seed: 10 + i }));
  // fine data tracks
  for (let i = 0; i < 14; i++) {
    const rr = lerp(R0 * 0.26, R0 * 0.97, i / 13);
    const a0 = (i * 1.37) % TAU, len = TAU * 0.6;
    const pts = [];
    for (let q = 0; q <= 60; q++) { const a = a0 + (len * q) / 60; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.3 + 0.7 * Math.sin((q / 60) * Math.PI)]); }
    c.strokePath(pts, 'wire', i % 5 ? '#5f8f98' : '#bfe6e2', 0.35, 0.4);
  }
  // radial scratches (make the spin readable)
  const r = rng('plat-scr');
  for (let i = 0; i < 9; i++) {
    const a = r(0, TAU), r0 = R0 * r(0.3, 0.55), r1 = R0 * r(0.7, 0.95);
    c.strokePath([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, 0.2], [cx + Math.cos(a + 0.02) * (r0 + r1) / 2, cy + Math.sin(a + 0.02) * (r0 + r1) / 2, 1], [cx + Math.cos(a + 0.04) * r1, cy + Math.sin(a + 0.04) * r1, 0.2]], 'mach_line', r() < 0.5 ? '#c8e8e8' : '#46646c', 0.45, 0.3);
  }
  // spindle clamp: small bright steel ring with screws
  c.washPoly(circlePts(cx, cy, R0 * 0.2, 60), '#b9cbcc', 255);
  arcStrokes(c, cx, cy, R0 * 0.08, R0 * 0.19, { n: 26, colors: ['#e8f2f0', '#7f98a0', '#cfdcdc'], brush: 'mach_flat', weight: [0.25, 0.45], seed: 4 });
  const sc = [];
  for (let i = 0; i < 6; i++) sc.push([cx + Math.cos((i / 6) * TAU) * R0 * 0.14, cy + Math.sin((i / 6) * TAU) * R0 * 0.14]);
  rivets(c, sc, { r: 6, dark: '#2a3a40', light: '#ffffff' });
  c.washPoly(circlePts(cx, cy, R0 * 0.045, 20), '#1a262c', 255);
  contour(c, circlePts(cx, cy, R0 * 0.2, 60), { color: '#3a4e56', weight: 0.8, lost: 0.3 });
  contour(c, disc, { color: '#26383e', weight: 1.4, lost: 0.08 });
}

// Screen-fixed specular glint over a spinning platter (drawn with 'screen' blend): a soft wedge.
export function paintPlatterGlint(c) {
  // anisotropic specular cross of a spinning disc: two bright opposite lobes + a warm lamp lobe
  const cx = PLAT.size / 2, cy = PLAT.size / 2, R0 = PLAT.R;
  const r = rng('glint');
  for (const [ac, col, n] of [[-2.25, '#ffffff', 46], [0.89, '#dff6ff', 30], [-0.65, '#ffd49a', 16]]) {
    for (let i = 0; i < n; i++) {
      const a = ac + r(-0.22, 0.22), rr0 = R0 * r(0.24, 0.45), rr1 = R0 * r(0.78, 0.98);
      const pts = [];
      for (let q = 0; q <= 6; q++) { const u = q / 6, rr = lerp(rr0, rr1, u); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.3 + Math.sin(u * Math.PI)]); }
      c.strokePath(pts, 'mach_flat', col, r(0.15, 0.4) * (1 - Math.abs(a - ac) * 2.5), 0.4);
    }
  }
}

// Platter underside / rim colour disc (drawn below the tilted top face)
export function paintPlatterRim(c) {
  const cx = PLAT.size / 2, cy = PLAT.size / 2, R0 = PLAT.R;
  const disc = circlePts(cx, cy, R0, 120);
  c.washPoly(disc, '#1f4a52', 255);
  arcStrokes(c, cx, cy, R0 * 0.5, R0 * 0.99, { n: 40, colors: ['#2f6a72', '#143a42', '#3f7a80'], brush: 'mach_flat', weight: [0.4, 0.8], seed: 9 });
  contour(c, disc, { color: '#0a1a20', weight: 1.2 });
}

// ------------------------------------------------------------------------------------ blade face
// A drive-bay / blade front: teal face, vent slots, handle, label, LED socket (LED lit dynamically
// at BLADE.led). Painted in wall units (664 x 140) inside a layer with a small margin.
export const BLADE_LED = [0.915, 0.5];
export function paintBlade(c, variant = 0) {
  const r = rng('blade' + variant);
  const m = 8, w = BLADE.w, h = BLADE.h;
  const face = [[m + r(-2, 2), m], [w + m + r(-2, 2), m], [w + m, h + m + r(-2, 2)], [m, h + m]];
  const base = [C.teal, '#1b7880', '#237f84', C.sea][variant % 4];
  paintSurface(c, face, base, [C.cyan, C.deepTeal, C.aqua, '#0f3a44'], { angle: 0, spacing: 7, len: [60, 220], weight: [2, 3.5], seed: variant, grain: 0.25, mix: [0.1, 0.3] });
  // top highlight + bottom shadow bands
  c.strokePath([[m + 6, m + 5], [w + m - 6, m + 5]], 'mach_flat', mixHex(base, '#e8fff8', 0.45), 0.35, 0);
  c.strokePath([[m + 6, h + m - 6], [w + m - 6, h + m - 6]], 'mach_flat', mixHex(base, '#02141a', 0.55), 0.45, 0);
  // vent slots (short dark dashes) on the left two thirds
  for (let row = 0; row < 3; row++) {
    for (let x = m + 40; x < m + w * 0.62; x += 26) {
      const y = m + 32 + row * 34;
      c.strokePath([[x, y], [x + 14, y]], 'mach_flat', '#08262c', 0.28, 0);
      if (r() < 0.3) c.strokePath([[x, y - 5], [x + 12, y - 5]], 'mach_line', mixHex(base, '#ffffff', 0.4), 0.4, 0);
    }
  }
  // cream label
  const lx = m + w * 0.66, ly = m + 26;
  c.washPoly(rectPts(lx, ly, 120, 44), '#efe2c2', 255);
  for (let i = 0; i < 3; i++) c.strokePath([[lx + 10, ly + 12 + i * 11], [lx + 10 + r(40, 100), ly + 12 + i * 11]], 'mach_line', '#3a3a3a', 0.45, 0);
  // handle
  c.strokePath([[m + w * 0.66, h + m - 30], [m + w * 0.84, h + m - 30]], 'mach_flat', '#0e2a30', 0.6, 0);
  c.strokePath([[m + w * 0.66, h + m - 34], [m + w * 0.84, h + m - 34]], 'mach_line', '#b8e8e0', 0.5, 0);
  // LED socket
  const ex = m + w * BLADE_LED[0], ey = m + h * BLADE_LED[1];
  c.washPoly(circlePts(ex, ey, 13, 16), '#062028', 255);
  c.washPoly(circlePts(ex, ey, 8, 12), '#3a8a70', 255);
  inkRect(c, face, { color: '#041216', weight: 1.0, seed: variant, lost: 0.2 });
}

// ------------------------------------------------------------------------------------ rack frame
// Magenta rack cabinet frame for the end wall (wall units, 2333 x 5833), interior transparent.
// Parts are separate layers so they can be assembled: post (left/right), top panel, plinth.
export const FRAME = { post: 120, top: 320, plinth: 650 };
export function paintPost(c, h, ox = 0, oy = 0) {
  const w = FRAME.post;
  const pts = rectPts(ox + 4, oy, w - 8, h);
  paintSurface(c, pts, C.magenta, [C.plum, C.rose, '#c2527f', C.purple], { angle: Math.PI / 2, spacing: 9, len: [200, 700], weight: [2, 3], seed: 3 + ox, mix: [0.1, 0.35] });
  c.strokePath([[ox + 26, oy + 10], [ox + 26, oy + h - 10]], 'mach_line', '#f0a0c0', 1.2, 0);
  c.strokePath([[ox + w - 22, oy + 10], [ox + w - 22, oy + h - 10]], 'mach_flat', '#3a0f2a', 0.6, 0);
  const holes = [];
  for (let y = 60; y < h - 40; y += 88) holes.push([ox + w / 2, oy + y]);
  rivets(c, holes, { r: 6, dark: '#2a0a20', light: '#ffc0d8' });
  inkRect(c, pts, { color: '#1e0616', weight: 1.1, lost: 0.15 });
}
export function paintTopPanel(c, w, ox = 0, oy = 0) {
  const h = FRAME.top;
  const body = rectPts(ox, oy, w, h);
  paintSurface(c, body, C.magenta, [C.plum, C.rose, '#c2527f'], { angle: 0, spacing: 10, len: [200, 600], weight: [2, 3], seed: 4, mix: [0.1, 0.3] });
  // patch panel strip with colourful cables
  const pp = rectPts(ox + 140, oy + 90, w - 280, 150);
  c.washPoly(pp, '#101820', 255);
  const r = rng('patch' + ox);
  for (let x = 160; x < w - 150; x += 34) c.washPoly(rectPts(ox + x, oy + 110, 20, 22), '#40505a', 255);
  for (let i = 0; i < 26; i++) {
    const x0 = ox + r(170, w - 170), col = r.pick([C.orange, C.rose, C.cream, C.cyan, C.gold, '#e0503a']);
    c.strokePath([[x0, oy + 128], [x0 + r(-20, 20), oy + 190], [x0 + r(-80, 80), oy + 250], [x0 + r(-160, 160), oy + 300]], 'mach_flat', col, 0.35, 0.5);
  }
  inkRect(c, body, { color: '#1e0616', weight: 1.1 });
}
export function paintPlinth(c, w, ox = 0, oy = 0) {
  const h = FRAME.plinth;
  const body = rectPts(ox, oy, w, h);
  paintSurface(c, body, '#5a2250', [C.plum, C.magenta, '#2a0a24'], { angle: 0, spacing: 12, len: [200, 600], weight: [2, 3.2], seed: 5, mix: [0.1, 0.3] });
  // PSU grille
  const g = rectPts(ox + 160, oy + 120, w - 320, h - 240);
  c.washPoly(g, '#12161e', 255);
  for (let y = 150; y < h - 130; y += 30) c.strokePath([[ox + 190, oy + y], [ox + w - 190, oy + y]], 'mach_flat', '#2a3440', 0.35, 0);
  for (let x = 200; x < w - 200; x += 180) c.washPoly(circlePts(ox + x, oy + h - 80, 16, 12), '#1a1a1a', 255);
  inkRect(c, body, { color: '#1e0616', weight: 1.1 });
}

// Actuator arm (read/write head), painted pointing right from its pivot at (60, 60).
export const ARM = { w: 520, h: 120, px: 60, py: 60 };
export function paintArm(c) {
  const pivot = circlePts(ARM.px, ARM.py, 46, 30);
  c.washPoly([[ARM.px, ARM.py - 26], [470, ARM.py - 10], [505, ARM.py], [470, ARM.py + 10], [ARM.px, ARM.py + 26]], '#b9c9cc', 255);
  c.strokePath([[ARM.px + 20, ARM.py - 12], [460, ARM.py - 4]], 'mach_line', '#ffffff', 0.8, 0);
  c.strokePath([[ARM.px + 20, ARM.py + 14], [460, ARM.py + 6]], 'mach_flat', '#5a6a70', 0.35, 0);
  c.washPoly(pivot, '#3a4a50', 255);
  c.washPoly(circlePts(ARM.px, ARM.py, 18, 16), '#c8d8d8', 255);
  c.washPoly(rectPts(488, ARM.py - 9, 26, 18), '#e0b040', 255);
  contour(c, [[ARM.px, ARM.py - 26], [470, ARM.py - 10], [505, ARM.py], [470, ARM.py + 10], [ARM.px, ARM.py + 26]], { color: '#1a2428', weight: 0.8 });
}

// Dark back panel of a rack (fills the cabinet behind the blades), wall units.
export function paintShutter(c, w, h) {
  const body = rectPts(10, 10, w, h);
  paintSurface(c, body, '#0e1624', ['#1a2436', '#070b14', '#16223a'], { angle: Math.PI / 2, spacing: 18, len: [300, 900], weight: [2.5, 4], seed: 8, mix: [0.1, 0.35] });
  for (let y = 120; y < h; y += 175) c.strokePath([[40, y], [w - 20, y]], 'mach_flat', '#05080e', 0.4, 0);
}

// ------------------------------------------------------------------------------------ corridor rack
// Full rack front (wall units 2333 x 5833 = 100 x 250 wu) matching the assembled end-wall racks:
// posts, top patch panel, plinth, dark back and 3 columns x 7 rows x 4 blades.
export const RACK_BLADES = (() => {
  const out = [];
  const r = PLAT.R * 0.892;
  for (let m = -1; m <= 5; m++) for (let a = 0; a <= 2; a++) for (let q = 0; q < 4; q++) {
    const x = RACKW.w / 2 + (a - 1) * 700, y = 540 + 700 * m + (q - 1.5) * 175 + 813;
    out.push({ x0: x - r, y0: y, w: 2 * r, h: BLADE.h, a, m, q });
  }
  return out;
})();
// Corridor rack front: bold painted server units (fewer, larger shapes read better at a glance).
export const RACK_UNITS = (() => {
  const out = [];
  const top = FRAME.top, bot = RACKW.h - FRAME.plinth;
  const n = 11, gap = 40, h = (bot - top - gap * (n + 1)) / n;
  for (let i = 0; i < n; i++) out.push({ y0: top + gap + i * (h + gap), h, i });
  return out;
})();
export const RACK_LEDS = (() => {
  const out = [];
  for (const u of RACK_UNITS) for (let k = 0; k < 4; k++) out.push({ x: RACKW.w * (0.64 + k * 0.075), y: u.y0 + u.h * 0.72, unit: u.i, k });
  return out;
})();
export function paintRackFront(c, variant = 0) {
  const W = RACKW.w, H = RACKW.h;
  const r = rng('rackfront' + variant);
  const inner = rectPts(FRAME.post - 14, FRAME.top - 14, W - 2 * FRAME.post + 28, H - FRAME.top - FRAME.plinth + 28);
  paintSurface(c, inner, '#0a121e', ['#1a2436', '#05080e', '#16223a'], { angle: Math.PI / 2, spacing: 30, len: [300, 1000], weight: [4, 7], seed: 8 + variant, mix: [0.1, 0.35] });
  const tones = [C.teal, '#1b7880', C.sea, '#237f84', C.deepTeal];
  for (const u of RACK_UNITS) {
    const kind = (u.i * 3 + variant * 5) % 7; // 0-2 storage, 3-4 compute, 5 switch, 6 blank
    const base = kind === 6 ? '#1a3a48' : r.pick(tones);
    const x0 = FRAME.post + 26, x1 = W - FRAME.post - 26;
    const face = [[x0 + r(-6, 6), u.y0 + r(-4, 4)], [x1 + r(-6, 6), u.y0 + r(-4, 4)], [x1 + r(-6, 6), u.y0 + u.h + r(-4, 4)], [x0 + r(-6, 6), u.y0 + u.h + r(-4, 4)]];
    paintSurface(c, face, base, [C.cyan, C.deepTeal, C.aqua, '#0f3a44'], { angle: r(-0.05, 0.05), spacing: 16, len: [200, 700], weight: [4.5, 7], seed: u.i * 13 + variant, mix: [0.12, 0.38], grain: 0.35 });
    // lit top edge, dark bottom edge (painted light)
    c.strokePath([[x0 + 10, u.y0 + 14, 0.8], [(x0 + x1) / 2, u.y0 + 12, 1.1], [x1 - 10, u.y0 + 15, 0.8]], 'mach_flat', mixHex(base, '#e8fff8', 0.5), 1.1, 0.2);
    c.strokePath([[x0 + 10, u.y0 + u.h - 12], [x1 - 10, u.y0 + u.h - 10]], 'mach_flat', mixHex(base, '#02141a', 0.6), 1.3, 0.2);
    if (kind <= 2) {
      // drive bays: vertical caddies
      for (let x = x0 + 40; x < x0 + (x1 - x0) * 0.58; x += 118) {
        c.strokePath([[x, u.y0 + 30], [x, u.y0 + u.h - 30]], 'mach_flat', mixHex(base, '#041018', 0.55), 0.55, 0);
        c.strokePath([[x + 12, u.y0 + 34], [x + 12, u.y0 + u.h - 34]], 'mach_line', mixHex(base, '#dffff8', 0.4), 0.7, 0);
      }
    } else if (kind <= 4) {
      // vent grille
      for (let y = u.y0 + 40; y < u.y0 + u.h - 30; y += 34) c.strokePath([[x0 + 40, y], [x0 + (x1 - x0) * 0.55, y + r(-3, 3)]], 'mach_flat', mixHex(base, '#041018', 0.5), 0.45, 0);
    } else if (kind === 5) {
      // switch: ports + colourful patch cables looping out
      for (let x = x0 + 40; x < x1 - 60; x += 46) c.washPoly(rectPts(x, u.y0 + u.h * 0.35, 26, 30), '#0a1a20', 255);
      for (let q = 0; q < 12; q++) {
        const xa = r(x0 + 40, x1 - 60), col = r.pick([C.orange, C.rose, C.cream, C.gold, '#3a6ae0', C.cyan]);
        c.strokePath([[xa, u.y0 + u.h * 0.5], [xa + r(-40, 40), u.y0 + u.h * 0.9], [xa + r(-160, 160), u.y0 + u.h * 1.4]], 'mach_flat', col, 0.55, 0.5);
      }
    }
    // label
    if (kind !== 6) {
      c.washPoly(rectPts(x0 + (x1 - x0) * 0.62, u.y0 + 26, 190, 58), '#efe2c2', 245);
      for (let i = 0; i < 3; i++) c.strokePath([[x0 + (x1 - x0) * 0.62 + 16, u.y0 + 42 + i * 14], [x0 + (x1 - x0) * 0.62 + 16 + r(60, 160), u.y0 + 42 + i * 14]], 'mach_line', '#3a3a3a', 0.5, 0);
    }
    // LED sockets
    for (let k = 0; k < 4; k++) c.washPoly(circlePts(W * (0.64 + k * 0.075), u.y0 + u.h * 0.72, 16, 12), '#041018', 255);
    inkRect(c, face, { color: '#020a10', weight: 1.4, seed: u.i + variant * 17, lost: 0.25 });
  }
  paintTopPanel(c, W, 0, 0);
  paintPlinth(c, W, 0, H - FRAME.plinth);
  paintPost(c, H, 0, 0);
  paintPost(c, H, W - FRAME.post, 0);
  // cable bundle running down the left inner side
  for (let i = 0; i < 7; i++) {
    const col = r.pick([C.orange, C.rose, C.cream, C.cyan, C.gold]);
    const x = FRAME.post + 10 + i * 9;
    c.strokePath([[x, FRAME.top], [x + r(-10, 30), H * 0.3], [x + r(-10, 40), H * 0.6], [x + r(0, 30), H - FRAME.plinth]], 'mach_flat', col, 0.45, 0.6);
  }
}
export function paintRackSide(c, variant = 0) {
  const W = RACKW.w, H = RACKW.h;
  const body = rectPts(6, 0, W - 12, H);
  paintSurface(c, body, variant % 2 ? '#8a3464' : C.magenta, [C.plum, C.rose, '#c2527f', C.purple], { angle: Math.PI / 2, spacing: 30, len: [400, 1400], weight: [4, 7], seed: 11 + variant, mix: [0.1, 0.35] });
  // vent louvres
  for (let y = 900; y < H - 900; y += 90) c.strokePath([[W * 0.25, y], [W * 0.75, y]], 'mach_flat', '#3a0f2a', 0.6, 0);
  c.washPoly(rectPts(W * 0.3, 380, W * 0.4, 260), '#efe2c2', 240);
  inkRect(c, body, { color: '#1e0616', weight: 1.4 });
  c.strokePath([[40, 20], [40, H - 20]], 'mach_line', '#f0a0c0', 1.4, 0);
}
