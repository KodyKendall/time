// Factory hall (the end wall) — painted in "wall units" (1 unit = 1 design unit at the pivot frame).
// Arch k is centred at x = 960 + 2800k; its opening (2160 wide, semicircular top of radius 1080
// centred at y = 380) contains the whole pivot frame, so at the first frame only the gear shows.
import { C } from '../lib/palette.js';
import { rng, lerp, clamp, mixHex, TAU } from '../../engine/math.js';
import { circlePts } from '../lib/kit.js';
import { strokesIn, arcStrokes, contour, glints, rivets, rectPts, paintSurface, inkRect, paintCylinderV } from './brushkit.js';
import { WALL } from './world.js';
import { paintToolBoard } from './factoryfx.js';

export const ARCH = { R: WALL.archW / 2, ring: 230, spring: WALL.spring, pitch: WALL.pitch, floor: WALL.floorY, top: -1000 };
export const archX = (k) => 960 + WALL.pitch * k;

const BRICK = ['#4a2a5e', '#56305f', '#5d2f5a', '#3e2552', '#6b3a66', '#503060'];
const BRICK_HI = ['#8a5a8a', '#9a6a90', '#7c4c7e', '#b07aa0'];
const STONE = ['#b98a9c', '#a87890', '#c79aa6', '#9a6d86', '#d2aab0'];
const IRON = '#2a2030';

// polygon of the ring band (between radius a and b) for angles th0..th1 (screen: y up = -sin)
function ringPts(cx, cy, a, b, th0, th1, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = lerp(th0, th1, i / n); pts.push([cx + Math.cos(t) * b, cy - Math.sin(t) * b]); }
  for (let i = n; i >= 0; i--) { const t = lerp(th0, th1, i / n); pts.push([cx + Math.cos(t) * a, cy - Math.sin(t) * a]); }
  return pts;
}

// Brick courses inside polygon `poly` (local coords). Painted brick by brick: a base wash, several
// near-tone strokes along the brick, dry-brush texture, the odd lit top edge; then glazes on top.
function bricks(c, poly, { seed = 0, h = 72, w = [130, 190], light = null } = {}) {
  const r = rng('br' + seed + c.name);
  c.washPoly(poly, '#2a1636', 255);
  c.flush();
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (const [x, y] of poly) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const inside = (x, y) => {
    let s = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s;
    }
    return s;
  };
  // mortar texture first (dark strokes along the courses)
  for (let y = y0; y < y1; y += h) c.strokePath([[x0, y + h - 3], [(x0 + x1) / 2, y + h - 3 + r(-2, 2)], [x1, y + h - 3]], 'dry', '#3a2448', 0.5, 0.2);
  let row = 0;
  for (let y = y0; y < y1; y += h, row++) {
    let x = x0 - r(0, w[1]) - (row % 2) * w[0] * 0.5;
    while (x < x1) {
      const bw = r(w[0], w[1]);
      const bx0 = x + 7, bx1 = x + bw - 7, by0 = y + 8, by1 = y + h - 8;
      const cxm = (bx0 + bx1) / 2, cym = (by0 + by1) / 2;
      if (inside(cxm, cym) && inside(bx0 + 4, cym) && inside(bx1 - 4, cym)) {
        let col = r.pick(BRICK);
        let warm = 0;
        if (light) { const d = Math.hypot(cxm - light[0], cym - light[1]); warm = clamp(1 - d / light[2]); col = mixHex(col, '#b0506a', 0.55 * warm); }
        const pts = [[bx0 + r(-5, 5), by0 + r(-3, 3)], [bx1 + r(-5, 5), by0 + r(-3, 3)], [bx1 + r(-5, 5), by1 + r(-3, 3)], [bx0 + r(-5, 5), by1 + r(-3, 3)]];
        c.washPoly(pts, mixHex(col, '#1a0c24', 0.25), 255);
        // body strokes: 3-4 flat strokes of near tones along the brick (warm top, cool bottom)
        const n = 3 + (r() < 0.5 ? 1 : 0);
        for (let q = 0; q < n; q++) {
          const yy = lerp(by0 + 12, by1 - 12, (q + 0.5) / n) + r(-3, 3);
          const tone = q < n / 2 ? mixHex(col, r.pick(BRICK_HI), r(0.15, 0.4)) : mixHex(col, r.pick(['#241430', '#3a1e46', '#5a2a52']), r(0.1, 0.35));
          c.strokePath([[bx0 + r(4, 14), yy, 0.8], [cxm + r(-10, 10), yy + r(-2, 2), 1.1], [bx1 - r(4, 14), yy + r(-2, 2), 0.8]], 'mach_flat', tone, r(1.4, 2.2), 0.3);
        }
        if (r() < 0.7) c.strokePath([[bx0 + 10, cym + r(-8, 8), 0.8], [bx1 - 14, cym + r(-8, 8), 0.9]], 'dry', mixHex(col, r.pick(['#1e0f28', '#e0a8c0']), r(0.2, 0.45)), r(0.4, 0.8), 0.4);
        if (r() < 0.3 + 0.4 * warm) c.strokePath([[bx0 + 10, by0 + 5], [bx1 - 16, by0 + 4]], 'mach_line', mixHex(col, '#f5c8d8', 0.6), r(0.9, 1.5), 0.2);
        if (r() < 0.25) c.strokePath([[bx0 + 8, by1 - 3], [bx1 - 8, by1 - 4]], 'mach_flat', '#160a1e', 0.5, 0.2);
      }
      x += bw;
    }
  }
  // glazes: grime and light variation over the whole field
  c.flush();
  for (let i = 0; i < 10; i++) {
    const bx = r(x0, x1), by = r(y0, y1);
    c.fillPoly(c.blob(bx, by, r(200, 600), r(150, 500), { wobble: 0.3 }), r.pick(['#1a0c24', '#2a1030', '#6a3060']), { opacity: 22, bleed: 0.2, texture: 0.8, border: 0.1 });
  }
  if (light) c.fillPoly(c.blob(light[0], light[1], light[2] * 0.7, light[2] * 0.55, { wobble: 0.2 }), '#e07a60', { opacity: 26, bleed: 0.25, texture: 0.6, border: 0.05 });
}

// Wedge stones (voussoirs) of an arch ring segment: each stone gets a base, radial dabs of
// near tones, a lit outer edge, a shaded inner edge and ink joints.
function voussoirs(c, cx, cy, a, b, th0, th1, { seed = 0, n = 9 } = {}) {
  const r = rng('vs' + seed + c.name);
  for (let i = 0; i < n; i++) {
    const t0 = lerp(th0, th1, i / n) + 0.006, t1 = lerp(th0, th1, (i + 1) / n) - 0.006;
    const pts = ringPts(cx, cy, a + 8, b - 6, t0, t1, 8);
    const col = r.pick(STONE);
    c.washPoly(pts, mixHex(col, '#4a2a5e', 0.42), 255);
    // form-following strokes: tapered arcs along the ring inside each stone, in near tones
    const tones = STONE.concat(['#f0d0d8', '#7a4a78']);
    for (let q = 0; q < 5; q++) {
      const rr = lerp(a + 34, b - 30, (q + r(0.2, 0.8)) / 5);
      const ta = lerp(t0, t1, r(0.02, 0.2)), tb = lerp(t0, t1, r(0.8, 0.98));
      const pts = [];
      for (let m = 0; m <= 4; m++) {
        const t = lerp(ta, tb, m / 4);
        pts.push([cx + Math.cos(t) * rr, cy - Math.sin(t) * rr, [0.3, 0.9, 1, 0.8, 0.25][m]]);
      }
      c.strokePath(pts, 'mach_flat', mixHex(mixHex(col, '#4a2a5e', 0.4), r.pick(tones), r(0.06, 0.16)), r(2.2, 3.4), 0.5);
    }
    // lit outer edge and shaded inner edge
    c.strokePath(ringPts(cx, cy, b - 18, b - 18, t0 + 0.012, t1 - 0.012, 6).slice(0, 7), 'mach_flat', '#e8b8c8', 0.5, 0.3);
    c.strokePath(ringPts(cx, cy, a + 16, a + 16, t0 + 0.012, t1 - 0.012, 6).slice(0, 7), 'mach_flat', '#2a1432', 0.6, 0.3);
    contour(c, pts, { color: '#1c0a20', weight: 0.9, seed: i + seed * 31, lost: 0.3 });
  }
}

// ------------------------------------------------------------------------------------ pillar card
// Local card space: x in [0, 2800] (arch k centre -> arch k+1 centre), y in [0, 6100] (wall y -1000..5100)
export const PCARD = { w: 2800, h: 6100, oy: ARCH.top };
export function paintPillarCard(c, k, { detail = 1 } = {}) {
  const r = rng('pillar' + k);
  const oy = -ARCH.top; // wall y -> local y
  const R0 = ARCH.R, RB = ARCH.R + ARCH.ring;
  const cyA = ARCH.spring + oy;            // spring line (local)
  const floorY = ARCH.floor + oy;
  const pl = R0, pr = PCARD.w - R0;        // pillar opening edges (local x)
  // the arch openings are painted flat night (exactly the pivot's background colour) so nothing
  // behind the wall can show through them
  // same winding for both, no duplicated vertices
  const openL = [], openR = [];
  for (let i = 0; i <= 24; i++) { const t = lerp(Math.PI / 2, 0, i / 24); openL.push([Math.cos(t) * R0, cyA - Math.sin(t) * R0]); }
  openL.push([R0, floorY + 40], [-2, floorY + 40], [-2, cyA - R0]);
  for (let i = 0; i <= 24; i++) { const t = lerp(Math.PI, Math.PI / 2, i / 24); openR.push([PCARD.w + Math.cos(t) * R0, cyA - Math.sin(t) * R0]); }
  openR.push([PCARD.w + 2, cyA - R0], [PCARD.w + 2, floorY + 40], [PCARD.w - R0, floorY + 40]);

  // ---- spandrel + pillar body brick field (everything outside the two openings and rings)
  const field = [];
  field.push([0, 0], [PCARD.w, 0]);
  // down the right arch ring's outer edge (arch k+1 centred at x = 2800), from crown to spring
  for (let i = 0; i <= 20; i++) { const t = lerp(Math.PI / 2, Math.PI, i / 20); field.push([PCARD.w + Math.cos(t) * RB, cyA - Math.sin(t) * RB]); }
  field.push([pr - ARCH.ring, floorY + 40]);
  field.push([pl + ARCH.ring, floorY + 40]);
  for (let i = 0; i <= 20; i++) { const t = lerp(0, Math.PI / 2, i / 20); field.push([Math.cos(t) * RB, cyA - Math.sin(t) * RB]); }
  // (the polygon closes back to (0, 0) along the crown line)
  const lamp = [PCARD.w / 2, 200 + oy, 900];
  bricks(c, field, { seed: k, light: [lamp[0], lamp[1] + 700, 1300] });
  // ---- arch rings (voussoirs) + jambs below the spring
  voussoirs(c, 0, cyA, R0, RB, 0, Math.PI / 2, { seed: k * 2 + 1, n: 7 });
  voussoirs(c, PCARD.w, cyA, R0, RB, Math.PI / 2, Math.PI, { seed: k * 2 + 2, n: 7 });
  const jambL = rectPts(pl, cyA + 6, ARCH.ring, floorY - cyA - 6), jambR = rectPts(pr - ARCH.ring, cyA + 6, ARCH.ring, floorY - cyA - 6);
  for (const [q, jamb] of [jambL, jambR].entries()) {
    paintSurface(c, jamb, '#8a5a86', STONE.concat(['#5d2f5a', '#6b3a66']), { angle: Math.PI / 2 + 0.08, spacing: 14, len: [60, 180], weight: [2.5, 4], seed: k * 7 + q, grain: 0.3, mix: [0.1, 0.35] });
    // stone joints every ~300
    for (let y = cyA + 300; y < floorY; y += 300 + r(-30, 30)) c.strokePath([[jamb[0][0] + 6, y, 0.8], [jamb[1][0] - 6, y + r(-4, 4), 1]], 'mach_line', '#2a1030', 1.0, 0);
    // shadow on the opening side
    const sx = q === 0 ? pl + 8 : pr - 8;
    c.strokePath([[sx, cyA + 10], [sx + r(-3, 3), (cyA + floorY) / 2], [sx, floorY]], 'gouache', '#1a0c22', 1.6, 0.2);
  }
  // impost blocks at the spring line
  for (const x0 of [pl - 20, pr - ARCH.ring - 20]) {
    const imp = rectPts(x0, cyA - 30, ARCH.ring + 40, 70);
    paintSurface(c, imp, '#c79aa6', ['#f0d0d0', '#9a6d86', '#e0b0b8'], { angle: 0, spacing: 9, len: [60, 200], weight: [1, 1.8], seed: k * 3 + x0 });
    inkRect(c, imp, { color: '#2a1030', weight: 1.1 });
  }
  // ---- pillar centre: iron pipe with flanges, a valve wheel, a gauge, a plate
  const px = PCARD.w / 2;
  paintCylinderV(c, px - 36, 260, 72, floorY - 260, '#9a5430', { light: '#ffc080', dark: '#2a1008', seed: k * 11 });
  for (let y = 520; y < floorY; y += 520) {
    const fl = rectPts(px - 52, y - 16, 104, 32);
    paintSurface(c, fl, '#6a3a22', ['#c8703a', '#2a1410'], { angle: 0, spacing: 5, len: [30, 80], weight: [0.6, 1], seed: y + k });
    inkRect(c, fl, { color: '#1a0c08', weight: 0.9 });
    rivets(c, [[px - 40, y], [px + 40, y]], { r: 5 });
  }
  // gauge (face painted; the needle is a separate sprite at GAUGE pos)
  const gx = px + 150, gy = 1640;
  c.washPoly(rectPts(px + 30, gy - 14, 80, 28), '#6a3a22', 255);
  c.washPoly(circlePts(gx, gy, 104, 60), '#3a2418', 255);
  c.washPoly(circlePts(gx, gy, 92, 60), '#b8864a', 255);
  c.washPoly(circlePts(gx, gy, 80, 60), '#f1e2c0', 255);
  arcStrokes(c, gx, gy, 20, 76, { n: 26, colors: ['#e8d6b0', '#fff6e0', '#d8c098'], brush: 'gouache', weight: [0.3, 0.6], seed: k + 99 });
  for (let i = 0; i <= 10; i++) {
    const a = lerp(Math.PI * 0.75, Math.PI * 2.25, i / 10);
    c.strokePath([[gx + Math.cos(a) * 62, gy + Math.sin(a) * 62], [gx + Math.cos(a) * 76, gy + Math.sin(a) * 76]], 'mach_line', '#2a1a10', 0.9, 0);
  }
  arcStrokes(c, gx, gy, 68, 74, { n: 3, arc: [0.5, 0.6], colors: [C.vermilion], brush: 'gouache', weight: [0.35, 0.4], a0: Math.PI * 1.9, a1: Math.PI * 2.25, seed: 5 });
  contour(c, circlePts(gx, gy, 104, 40), { color: '#1a0c08', weight: 1.1 });
  glints(c, [[gx - 50, gy - 60]], { angle: -0.8, weight: [0.9, 1.2], len: [18, 30] });
  // valve handwheel
  const vx = px - 150, vy = 2300;
  c.washPoly(rectPts(vx, vy - 12, 120, 24), '#6a3a22', 255);
  const wheel = circlePts(vx, vy, 95, 48);
  for (let s = 0; s < 5; s++) { const a = (s / 5) * TAU + 0.3; c.strokePath([[vx, vy], [vx + Math.cos(a) * 88, vy + Math.sin(a) * 88]], 'gouache', '#b0302a', 0.9, 0); }
  c.strokePath(wheel.concat([wheel[0]]), 'gouache', '#c0382e', 1.6, 0.3);
  c.strokePath(wheel.slice(30, 44), 'mach_line', '#ff9a80', 0.9, 0.3);
  c.washPoly(circlePts(vx, vy, 20, 16), '#3a1410', 255);
  // riveted iron plate at the base
  const plate = rectPts(px - 260, floorY - 520, 520, 500);
  paintSurface(c, plate, '#3a2a40', ['#5a4a60', '#22182a', '#6a5070'], { angle: 0.05, spacing: 10, len: [80, 240], weight: [1, 2], seed: k * 17 });
  const rv = [];
  for (let i = 0; i < 8; i++) { rv.push([px - 230 + i * 65.7, floorY - 495], [px - 230 + i * 65.7, floorY - 45]); }
  rivets(c, rv, { r: 7, dark: '#140c18', light: '#b8a0c0' });
  inkRect(c, plate, { color: '#0e0812', weight: 1.2 });
  // lamp bracket (the glass/flame glow is dynamic)
  const lx = px, ly = lamp[1];
  c.strokePath([[px - 60, ly + 220], [px - 110, ly + 120], [px - 60, ly + 30], [lx, ly + 4]], 'gouache', IRON, 1.3, 0.6);
  c.washPoly([[lx - 36, ly - 60], [lx + 36, ly - 60], [lx + 46, ly + 50], [lx - 46, ly + 50]], '#e8a040', 255);
  c.washPoly([[lx - 20, ly - 40], [lx + 20, ly - 40], [lx + 26, ly + 36], [lx - 26, ly + 36]], '#fff0b0', 255);
  c.washPoly([[lx - 52, ly - 84], [lx + 52, ly - 84], [lx + 36, ly - 58], [lx - 36, ly - 58]], IRON, 255);
  c.washPoly([[lx - 50, ly + 48], [lx + 50, ly + 48], [lx + 40, ly + 66], [lx - 40, ly + 66]], IRON, 255);
  inkRect(c, [[lx - 46, ly - 60], [lx + 46, ly - 60], [lx + 46, ly + 50], [lx - 46, ly + 50]], { color: '#140a10', weight: 0.9 });
  // workers' tool board on the right jamb
  paintToolBoard(c, px + 42, 2560 + oy);
  // stains + soot
  for (let i = 0; i < 10 * detail; i++) {
    const x = r(pl + 40, pr - 40), y = r(cyA, floorY - 600);
    c.strokePath([[x, y, 1], [x + r(-6, 6), y + r(80, 260), 0.4]], 'dry', r.pick(['#1e0f28', '#3a2040', '#6a3a50']), r(0.4, 0.9), 0.4);
  }
  // openings last: flat night (the pivot's background) over anything that spilled into them
  c.flush();
  c.washPoly(openL, C.night, 255);
  c.washPoly(openR, C.night, 255);
  c.flush();
  return { lamp: [lx, ly], gauge: [gx, gy], valve: [vx, vy] };
}

// ------------------------------------------------------------------------------------ keystone
export function paintKeystone(c) {
  const pts = [[60, 0], [180, 0], [210, 250], [30, 250]];
  paintSurface(c, pts, '#d2aab0', ['#f0d0d0', '#a87890', '#e8c0c0'], { angle: Math.PI / 2, spacing: 9, len: [60, 200], weight: [1, 1.8] });
  contour(c, pts, { color: '#2a1030', weight: 1.2 });
  c.strokePath([[70, 12], [170, 12]], 'mach_line', '#fff0f0', 1, 0);
}

// ------------------------------------------------------------------------------------ upper wall
// Local: x in [0, W] <-> wall x in [x0, x0 + W]; y in [0, H] <-> wall y in [-2900, -660].
export const UPPER = { x0: 960 - 2800 * 3, W: 2800 * 6, y0: -2900, H: 1960 };
export function paintUpperWall(c) {
  const { W } = UPPER;
  const wy = (y) => y - UPPER.y0; // wall y -> local
  // dark roof space
  paintSurface(c, rectPts(0, 0, W, wy(-2300)), '#140e24', ['#241a3a', '#0c0818', '#2a1a40'], { angle: 0.1, spacing: 40, len: [300, 900], weight: [3, 6], seed: 1, grain: 0.3 });
  // clerestory wall with round windows (oculi) above each pillar: moonlit glass with mullions
  bricks(c, rectPts(0, wy(-2300), W, wy(-1460) - wy(-2300)), { seed: 77, h: 70 });
  for (let k = -3; k < 3; k++) {
    const cx = 960 + 2800 * k + 1400 - UPPER.x0, cy = wy(-1900);
    c.washPoly(circlePts(cx, cy, 300, 60), '#1b3350', 255);
    arcStrokes(c, cx, cy, 30, 280, { n: 40, colors: ['#2b5a7a', '#3a6a8a', '#1f4460', '#5a8aa8'], brush: 'gouache', weight: [0.6, 1.2], seed: k + 20 });
    for (let s = 0; s < 8; s++) { const a = (s / 8) * TAU; c.strokePath([[cx, cy], [cx + Math.cos(a) * 290, cy + Math.sin(a) * 290]], 'gouache', '#1a1024', 0.7, 0); }
    const ring = circlePts(cx, cy, 150, 40);
    c.strokePath(ring.concat([ring[0]]), 'gouache', '#1a1024', 0.7, 0.3);
    voussoirs(c, cx, cy, 296, 370, 0, TAU, { seed: 300 + k, n: 16 });
  }
  // the girder: riveted orange iron I-beam
  const g = rectPts(0, wy(-1460), W, 220);
  paintSurface(c, g, C.orange, [C.vermilion, C.amber, '#ff9a50', C.rust, '#c84a20'], { angle: 0, spacing: 8, len: [300, 900], weight: [1.2, 2.4], seed: 6 });
  c.washPoly(rectPts(0, wy(-1460), W, 26), '#ffb070', 255);
  c.washPoly(rectPts(0, wy(-1266), W, 26), '#7a2a14', 255);
  const rv = [];
  for (let x = 40; x < W; x += 90) rv.push([x, wy(-1410)], [x + 45, wy(-1310)]);
  rivets(c, rv, { r: 9, dark: '#5a1c0c', light: '#ffd0a0' });
  inkRect(c, g, { color: '#3a1008', weight: 1.4 });
  for (let k = -3; k <= 3; k++) {
    const x = 960 + 2800 * k + 1400 - UPPER.x0;
    c.washPoly(rectPts(x - 30, wy(-1434), 60, 168), '#a83a1c', 255);
    c.strokePath([[x - 22, wy(-1430)], [x - 22, wy(-1270)]], 'mach_line', '#ffb080', 1, 0);
  }
  // brick band between girder and string course
  bricks(c, rectPts(0, wy(-1240), W, wy(-1010) - wy(-1240)), { seed: 78, h: 68 });
  // string course (moulding) above the arch crowns
  const sc = rectPts(0, wy(-1010), W, 70);
  paintSurface(c, sc, '#b98a9c', ['#f0d0d0', '#8a5a78', '#d2aab0'], { angle: 0, spacing: 10, len: [200, 600], weight: [1.2, 2.2], seed: 5 });
  c.strokePath([[0, wy(-1006)], [W, wy(-1006)]], 'mach_line', '#ffe0e8', 1.2, 0);
  c.strokePath([[0, wy(-942)], [W, wy(-942)]], 'gouache', '#1a0c20', 1.4, 0);
}
