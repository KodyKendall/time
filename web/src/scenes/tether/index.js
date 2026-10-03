// TETHER — storyboard frames. Not the film yet: nine held paintings, one per beat of
// storyboard-tether.html. Beat k is on screen for t in [k, k+1); render stills at k + 0.5.
//
// Everything is painted into full-frame layers in design units (1920x1080). Sky gradients and
// light are compositor rects / glows underneath and on top, so each frame stays one painting.
import { M, TAU, clamp, lerp, hex } from '../../engine/math.js';

// ---------------------------------------------------------------- palette
const C = {
  red: '#c8372d', redHi: '#e2564a', redLo: '#a42a22', redDeep: '#86201b', spar: '#4a1410',
  ribbon: '#f1e7d2', yellow: '#f2c230', yellowLo: '#d9a21c',
  skin: '#e6b58f', hair: '#3b2a20', dress: '#2f5d7c', dressLo: '#244a63', leg: '#3a2a22',
  grass: '#6aa457', grassLo: '#4d8a44', grassHi: '#8cc06a',
  sea: '#3f7fa0', seaLo: '#2f6884', string: '#f8f4ea', swift: '#1b2230',
};

// ---------------------------------------------------------------- geometry helpers
// Local -> screen: rotate, scale, then translate to (ox, oy).
const X = (ox, oy, s = 1, rot = 0) => {
  const c = Math.cos(rot), sn = Math.sin(rot);
  return (x, y) => [ox + (x * c - y * sn) * s, oy + (x * sn + y * c) * s];
};
const tp = (T, pts) => pts.map(([x, y]) => T(x, y));

// A sinuous ribbon from (x, y) heading `ang`, `len` long, curling with amplitude `amp`.
function wave(x, y, ang, len, amp, freq = 2, ph = 0, n = 18) {
  const pts = [];
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  for (let i = 0; i <= n; i++) {
    const u = i / n, d = u * len, w = amp * Math.sin(u * freq * TAU + ph) * (0.35 + 0.65 * u);
    pts.push([x + dx * d + nx * w, y + dy * d + ny * w]);
  }
  return pts;
}

// Points along a quadratic from a to b bending through control q.
function quad(a, q, b, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    pts.push([v * v * a[0] + 2 * v * u * q[0] + u * u * b[0], v * v * a[1] + 2 * v * u * q[1] + u * u * b[1]]);
  }
  return pts;
}

// ---------------------------------------------------------------- painted pieces
// Ground under a profile y(x), as convex vertical strips (a concave watercolour fill sprays
// ghost triangles), then mottling and a grassy edge.
function ground(c, yAt, color, { x0 = -20, x1 = 1940, bottom = 1100, step = 8, op = 255, mottle = null, grass = null } = {}) {
  for (let x = x0; x < x1; x += step) {
    c.washPoly([[x, yAt(x)], [x + step, yAt(x + step)], [x + step, bottom], [x, bottom]], color, op);
  }
  c.flush();
  if (mottle) {
    for (let i = 0; i < 26; i++) {
      const x = c.r(x0, x1), y = yAt(x) + c.r(40, 260);
      if (y > bottom - 20) continue;
      c.fillPoly(c.blob(x, y, c.r(60, 180), c.r(16, 40), { wobble: 0.3 }), mottle[i % mottle.length], { opacity: c.r(30, 70), bleed: 0.12, texture: 0.6 });
    }
    c.flush();
  }
  if (grass) {
    for (let x = x0; x < x1; x += c.r(3, 9)) {
      const y = yAt(x) + c.r(1, 5);
      c.strokePath([[x, y + 6], [x + c.r(-3, 7), y - c.r(5, 20)]], 'wire', grass, c.r(0.8, 1.6));
    }
    c.flush();
  }
}

function sea(c, y0, y1, { col = C.sea, lo = C.seaLo, glint = '#d8ecf2', n = 160 } = {}) {
  c.washPoly([[-20, y0], [1940, y0], [1940, y1], [-20, y1]], col, 255);
  c.flush();
  c.fillPoly([[-20, y0 + (y1 - y0) * 0.45], [1940, y0 + (y1 - y0) * 0.45], [1940, y1], [-20, y1]], lo, { opacity: 120, bleed: 0.05, texture: 0.5 });
  c.flush();
  for (let i = 0; i < n; i++) {
    const y = c.r(y0 + 4, y1), x = c.r(-20, 1940), l = c.r(10, 60) * (0.4 + (y - y0) / (y1 - y0));
    c.strokePath([[x, y], [x + l, y + c.r(-1, 1)]], 'wire', glint, c.r(0.5, 1.2));
  }
  c.flush();
}

// The kite, in local units: 120 tall, 84 wide, bridle point at the origin.
//   patch: the yellow scarf patch.  torn: a ripped lower-left panel.  op: overall opacity.
function kite(c, T, s, { patch = false, torn = false, op = 1, dark = 0 } = {}) {
  const top = [0, -60], rt = [42, -14], bot = [0, 82], lf = [-42, -14], mid = [0, -14];
  const sh = (h) => (dark ? lerpHex(h, '#2a1416', dark) : h);
  const f = { bleed: 0.012, texture: 0.3, border: 0.35 };
  if (!torn) c.washPoly(tp(T, [top, rt, bot, lf]), sh(C.red), 255 * op);
  c.fillPoly(tp(T, [top, rt, mid]), sh(C.redHi), { ...f, opacity: 255 * op });
  c.fillPoly(tp(T, [top, mid, lf]), sh(C.red), { ...f, opacity: 255 * op });
  c.fillPoly(tp(T, [mid, rt, bot]), sh(C.redLo), { ...f, opacity: 255 * op });
  if (!torn) c.fillPoly(tp(T, [lf, mid, bot]), sh(C.redDeep), { ...f, opacity: 255 * op });
  else {
    // the panel is half gone: a ragged edge, and a flap folded back over the spar
    c.fillPoly(tp(T, [lf, mid, [-6, 18], [-26, 4]]), sh(C.redDeep), { ...f, opacity: 255 * op });
    c.fillPoly(tp(T, [mid, [8, 40], [0, 82], [-4, 30]]), sh(C.redDeep), { ...f, opacity: 220 * op });
    c.fillPoly(tp(T, [[-6, 18], [-34, 26], [-20, 44]]), sh('#b8433a'), { ...f, opacity: 200 * op });
  }
  c.flush();
  if (patch) {
    c.fillPoly(tp(T, [[-30, -10], [-4, -6], [-2, 34], [-18, 16]]), C.yellow, { opacity: 245 * op, bleed: 0.02, texture: 0.5, border: 0.5 });
    c.flush();
    // big, uneven stitches: a child sewed this
    for (let i = 0; i < 5; i++) {
      const u = (i + 0.5) / 5;
      const p = [lerp(-30, -2, u), lerp(-10, 34, u)];
      const a = T(p[0] - 1.5, p[1] + 0.5), b = T(p[0] + 1.5, p[1] - 1.5);
      c.line(a[0], a[1], b[0], b[1], 'ink', '#9a7420', 0.35 * s);
    }
  }
  const sw = Math.max(0.5, 0.55 * s);
  c.strokePath(tp(T, [top, [0, 10], bot]), 'ink', C.spar, sw);
  c.strokePath(tp(T, [lf, mid, rt]), 'ink', C.spar, sw);
  c.strokePath(tp(T, [top, rt, bot]), 'ink', C.spar, sw * 0.6);
  c.strokePath(tp(T, [top, lf, bot]), 'ink', C.spar, sw * 0.6);
  c.flush();
}

// Tail ribbon with small red bows along it.
function tail(c, pts, s, { bows = 4, op = 255 } = {}) {
  c.strokePath(pts, 'gouache', C.ribbon, 0.75 * s);
  c.flush();
  for (let b = 1; b <= bows; b++) {
    const i = Math.round((b / (bows + 1)) * (pts.length - 1));
    const [x, y] = pts[i], [x2, y2] = pts[Math.min(pts.length - 1, i + 1)];
    const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2, T = X(x, y, s, a);
    c.washPoly(tp(T, [[0, 0], [-9, -5], [-9, 5]]), C.red, op);
    c.washPoly(tp(T, [[0, 0], [9, -5], [9, 5]]), C.red, op);
  }
  c.flush();
}

function stringLine(c, pts, w = 1.0, col = C.string) {
  c.strokePath(pts, 'ink', col, w);
  c.flush();
}

// Wren: feet at local (0,0), about 100 units tall. arms: angles (local) of left/right arm.
//   wind: how far the scarf and hair stream (+x).  legs: 'stand' | 'run' | 'brace'.
function girl(c, T, s, { arms = [-0.9, -0.7], legs = 'stand', wind = 1, scarf = true } = {}) {
  const w = s;
  const feet = {
    stand: [[-7, 0], [7, 0]],
    run: [[-24, -4], [18, -2]],
    brace: [[-20, 0], [10, 0]],
  }[legs];
  for (const [i, hip] of [[-6, -40], [6, -40]].entries()) {
    const ft = feet[i];
    c.strokePath(tp(T, [hip, [(hip[0] + ft[0]) / 2, -20], ft]), 'gouache', C.leg, 0.7 * w);
  }
  c.flush();
  // boots
  for (const ft of feet) c.washPoly(tp(T, [[ft[0] - 4, ft[1] - 5], [ft[0] + 7, ft[1] - 5], [ft[0] + 8, ft[1] + 1], [ft[0] - 4, ft[1] + 1]]), '#2a1d16');
  c.flush();
  // coat-dress
  c.fillPoly(tp(T, [[-12, -80], [12, -80], [20, -36], [-20, -36]]), C.dress, { opacity: 240, bleed: 0.03, texture: 0.5, border: 0.4 });
  c.fillPoly(tp(T, [[2, -80], [12, -80], [20, -36], [6, -36]]), C.dressLo, { opacity: 140, bleed: 0.03, texture: 0.5 });
  c.flush();
  // arms + hands
  for (const [i, sx] of [-10, 10].entries()) {
    const a = arms[i], sh = [sx, -74], end = [sh[0] + Math.cos(a) * 34, sh[1] + Math.sin(a) * 34];
    const el = [(sh[0] + end[0]) / 2 + Math.cos(a + 1.57) * 3, (sh[1] + end[1]) / 2 + Math.sin(a + 1.57) * 3];
    c.strokePath(tp(T, [sh, el, end]), 'gouache', C.dress, 0.62 * w);
    c.flush();
    c.washPoly(tp(T, c.blob(end[0], end[1], 4.6, 4.6, { n: 14, wobble: 0.1 })), C.skin);
  }
  c.flush();
  // head, hair and a ponytail in the wind
  c.fillPoly(tp(T, c.blob(1, -93, 11, 12, { n: 30, wobble: 0.04 })), C.skin, { opacity: 245, bleed: 0.02, texture: 0.3 });
  c.flush();
  c.fillPoly(tp(T, c.blob(-2, -96, 12, 11, { n: 30, wobble: 0.06 })), C.hair, { opacity: 245, bleed: 0.02, texture: 0.4 });
  c.fillPoly(tp(T, [[-8, -100], [-10 - 6 * wind, -104], [-14 - 22 * wind, -94], [-6, -90]]), C.hair, { opacity: 235, bleed: 0.02, texture: 0.4 });
  c.flush();
  if (scarf) {
    c.fillPoly(tp(T, [[-12, -84], [12, -84], [11, -76], [-11, -76]]), C.yellow, { opacity: 250, bleed: 0.02, texture: 0.4 });
    c.fillPoly(tp(T, [[6, -84], [10 + 30 * wind, -92 - 4 * wind], [14 + 34 * wind, -84 - 2 * wind], [8, -77]]), C.yellow, { opacity: 245, bleed: 0.02, texture: 0.4 });
    c.fillPoly(tp(T, [[8, -80], [12 + 30 * wind, -80], [10 + 36 * wind, -72], [8, -74]]), C.yellowLo, { opacity: 220, bleed: 0.02, texture: 0.4 });
    c.flush();
  }
  // where the string leaves her hands (screen coords)
  const a = arms[1];
  return T(10 + Math.cos(a) * 34, -74 + Math.sin(a) * 34);
}

// A swift, flat silhouette, facing +x.
function swift(c, x, y, s, rot, col = C.swift, op = 235, flap = 0) {
  const T = X(x, y, s, rot);
  const up = 1 - 0.6 * flap;
  c.washPoly(tp(T, c.blob(0, 0, 12, 3.4, { n: 14, wobble: 0.04 })), col, op);
  c.washPoly(tp(T, [[6, -1], [-1, -2.4], [-14, -21 * up], [-9, -22 * up]]), col, op);
  c.washPoly(tp(T, [[6, 1], [-1, 2.4], [-14, 21], [-9, 22]]), col, op);
  c.washPoly(tp(T, [[-10, -1], [-22, -6], [-16, 0]]), col, op);
  c.washPoly(tp(T, [[-10, 1], [-22, 6], [-16, 0]]), col, op);
}

function flock(c, list, col, op) {
  for (const b of list) swift(c, b[0], b[1], b[2], b[3], col, op, b[4] || 0);
  c.flush();
}

// A thorny branch, recursively.
function thornBranch(c, x, y, ang, len, w, depth, col) {
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  const bend = c.r(-0.14, 0.14) * len;
  const mx = (x + x2) / 2 - Math.sin(ang) * bend, my = (y + y2) / 2 + Math.cos(ang) * bend;
  c.strokePath([[x, y], [mx, my], [x2, y2]], 'gouache', col, w);
  const nt = Math.round(len / 22);
  for (let i = 0; i < nt; i++) {
    const u = c.r(0.15, 0.95), px = lerp(x, x2, u), py = lerp(y, y2, u), side = c.r() < 0.5 ? -1 : 1;
    const ta = ang + side * c.r(0.7, 1.2), tl = c.r(7, 15) * Math.max(0.6, w);
    c.line(px, py, px + Math.cos(ta) * tl, py + Math.sin(ta) * tl, 'ink', col, 0.8);
  }
  if (depth <= 0) return;
  const kids = depth > 2 ? 3 : 2;
  for (let k = 0; k < kids; k++) {
    thornBranch(c, x2, y2, ang + c.r(-0.75, 0.75), len * c.r(0.6, 0.8), w * 0.66, depth - 1, col);
  }
}

function lerpHex(a, b, t) {
  const A = hex(a), B = hex(b);
  const h = (v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0');
  return '#' + h(lerp(A[0], B[0], t)) + h(lerp(A[1], B[1], t)) + h(lerp(A[2], B[2], t));
}

// ---------------------------------------------------------------- the nine beats
const BEAT = [];
const MARK = { knot: [960, 540] };   // points painted in paint() that draw() lights up

// 1. First flight. Bright day, a hill above the sea, the string a single line to the kite.
BEAT[0] = (c) => {
  sea(c, 690, 1100);
  // far headland
  ground(c, (x) => 690 - 46 * Math.exp(-(((x - 1650) / 260) ** 2)), '#7c9c8a', { x0: 1300, x1: 1940, bottom: 700, op: 200 });
  const hill = (x) => 820 - 150 * Math.exp(-(((x - 360) / 560) ** 2)) + 40 * Math.max(0, (x - 900) / 600) ** 2;
  ground(c, hill, C.grass, { mottle: [C.grassLo, C.grassHi, '#5d9a4a'], grass: C.grassLo });
  ground(c, (x) => 1000 - 30 * Math.sin(x * 0.004), C.grassLo, { op: 170, grass: '#3f7a38' });
  const hand = girl(c, X(430, hill(430) + 2, 1.75), 1.75, { arms: [-1.1, -0.55], legs: 'run', wind: 1 });
  const k = [1380, 300];
  stringLine(c, quad(hand, [900, 420], [k[0], k[1] + 6]), 0.7);
  tail(c, wave(k[0] + 2, k[1] + 82 * 1.6, 1.95, 330, 26, 1.6, 0.4), 1.6);
  kite(c, X(k[0], k[1], 1.6, 0.32), 1.6);
  // gulls
  for (const [x, y, s] of [[760, 230, 1], [820, 260, 0.8], [1700, 520, 0.7]]) {
    c.strokePath([[x - 14 * s, y - 4 * s], [x - 6 * s, y - 8 * s], [x, y]], 'ink', '#41505c', 0.7);
    c.strokePath([[x, y], [x + 6 * s, y - 8 * s], [x + 14 * s, y - 4 * s]], 'ink', '#41505c', 0.7);
  }
  c.flush();
};

// 2. The end of the string. Taut line; the swifts pour past and away over the sea.
BEAT[1] = (c) => {
  sea(c, 760, 1100, { n: 220 });
  const cliff = (x) => (x < 560 ? 890 + 20 * Math.sin(x * 0.01) : 890 + (x - 560) ** 1.6 * 0.12);
  ground(c, cliff, C.grassLo, { x0: -20, x1: 820, mottle: ['#3e7a3a', C.grass], grass: '#355f2f' });
  // cliff face
  for (let x = 560; x < 820; x += 8) c.washPoly([[x, cliff(x)], [x + 8, cliff(x + 8)], [x + 8, 1100], [x, 1100]], '#7a6a58', 230);
  c.flush();
  const hand = girl(c, X(270, 892, 1.6), 1.6, { arms: [-0.8, -0.55], legs: 'brace', wind: 1.1 });
  const k = [1080, 420];
  stringLine(c, [hand, [lerp(hand[0], k[0], 0.5), lerp(hand[1], k[1], 0.5) - 4], [k[0] - 6, k[1] + 4]], 0.75);
  // the tail curls out after the birds
  tail(c, wave(k[0] + 20, k[1] + 110, -0.25, 300, 34, 1.3, 2.2), 1.5);
  kite(c, X(k[0], k[1], 1.5, 0.62), 1.5);
  // the stream: dense near the kite, thinning and shrinking toward the horizon
  const birds = [];
  for (let i = 0; i < 70; i++) {
    const u = Math.pow(c.r(), 0.8);
    const x = lerp(1170, 1960, u) + c.r(-60, 60);
    const y = lerp(470, 120, u) + 120 * Math.sin(u * 3.2) * 0.4 + c.r(-70, 70);
    birds.push([x, y, lerp(1.6, 0.55, u) * c.r(0.8, 1.15), -0.45 + c.r(-0.35, 0.35), c.r()]);
  }
  flock(c, birds, C.swift, 225);
};

// 3. Tugging. Close on the fence post: the string sawing across its top, one strand left.
BEAT[2] = (c) => {
  ground(c, (x) => 860 + 30 * Math.sin(x * 0.003 + 1), '#7fae66', { op: 200, mottle: [C.grass] });
  ground(c, (x) => 960 + 18 * Math.sin(x * 0.006), C.grassLo, { grass: '#3d6f36' });
  // rail running off left, behind the post
  c.washPoly([[-20, 560], [800, 548], [800, 600], [-20, 616]], '#6e5038', 255);
  c.flush();
  // the post: weathered, a notch worn in its top-right corner
  const post = [[760, 360], [980, 330], [992, 1100], [748, 1100]];
  c.washPoly(post, '#7a5a3c', 255);
  c.flush();
  c.washPoly([[880, 344], [980, 330], [992, 1100], [890, 1100]], '#5e4430', 150);
  c.flush();
  for (let i = 0; i < 26; i++) {
    const x = c.r(770, 975);
    c.strokePath([[x, c.r(350, 420)], [x + c.r(-6, 6), c.r(600, 800)], [x + c.r(-8, 8), 1100]], 'dry', '#3e2c1e', c.r(0.4, 0.9));
  }
  c.flush();
  c.fillPoly([[935, 336], [972, 331], [966, 352], [944, 356]], '#2a1d14', { opacity: 230, bleed: 0.01, texture: 0.3 });
  c.flush();
  // the string: up from Wren (off frame left), over the post, away to the kite
  const P0 = [-20, 780], P1 = [952, 340], P2 = [1700, 150];
  stringLine(c, [P0, [470, 560], P1], 2.2);
  stringLine(c, [P1, [1330, 245], P2], 1.6);
  // frayed strands at the rub point
  for (let i = 0; i < 9; i++) {
    const a = c.r(-2.6, 0.6), l = c.r(16, 42);
    c.strokePath([P1, [P1[0] + Math.cos(a) * l * 0.5, P1[1] + Math.sin(a) * l * 0.5 - 4], [P1[0] + Math.cos(a) * l, P1[1] + Math.sin(a) * l]], 'ink', C.string, 0.5);
  }
  c.flush();
  tail(c, wave(1712, 230, 1.4, 160, 30, 1.8, 0.3), 0.8, { bows: 2 });
  kite(c, X(1712, 140, 0.8, 1.0), 0.8);
};

// 4. Snap. Wren flat on her back holding slack string; the broken end curling in the air.
BEAT[3] = (c) => {
  const hill = (x) => 840 + 40 * Math.sin(x * 0.002 + 0.6);
  ground(c, hill, C.grass, { mottle: [C.grassLo, C.grassHi], grass: C.grassLo });
  // she lies along the grass, head to the left, arms up holding nothing
  const hand = girl(c, X(560, hill(560) + 6, 2.3, -Math.PI / 2), 2.3, { arms: [0.15, -0.25], legs: 'stand', wind: 0.2 });
  // slack string: from her hands, a loose loop, then collapsing onto the grass
  stringLine(c, [hand, [hand[0] + 60, hand[1] - 120], [hand[0] + 160, hand[1] - 60], [hand[0] + 230, hand[1] + 30], [hand[0] + 380, hill(940) - 4], [hand[0] + 520, hill(1080)]], 1.6);
  // the broken end, still whipping in the air
  stringLine(c, [[1010, 460], [1060, 500], [1040, 560], [1000, 520], [1030, 470], [1120, 420]], 1.4);
  for (let i = 0; i < 6; i++) {
    const a = c.r(-3.4, -1.6), l = c.r(10, 24);
    c.line(1010, 460, 1010 + Math.cos(a) * l, 460 + Math.sin(a) * l, 'ink', C.string, 0.5);
  }
  c.flush();
  // the kite, shooting up and away, speed lines beneath
  for (let i = 0; i < 14; i++) {
    const x = 1470 + c.r(-50, 50), y = c.r(260, 420);
    c.line(x, y, x - 12, y + c.r(60, 150), 'wire', '#ffffff', c.r(0.6, 1.2));
  }
  c.flush();
  tail(c, wave(1490, 300, 1.75, 240, 10, 2.2, 0), 1.1, { bows: 3 });
  kite(c, X(1490, 170, 1.1, 0.18), 1.1);
};

// 5. Free. Above the clouds at sunset, among the swifts; the broken string hangs slack.
BEAT[4] = (c) => {
  // cloud sea: rows of soft heaps, paler toward the sun
  for (let row = 0; row < 5; row++) {
    const y = 640 + row * 95;
    for (let i = 0; i < 18; i++) {
      const x = c.r(-120, 2040), rx = c.r(140, 300), ry = c.r(60, 110);
      const col = ['#f9d9b8', '#f2bf9c', '#e9a58a', '#d98c7f', '#c47778'][row];
      c.fillPoly(c.blob(x, y + c.r(-20, 20), rx, ry, { wobble: 0.22, freq: 3 }), col, { opacity: 200, bleed: 0.12, texture: 0.5, border: 0.5, dir: 'out' });
    }
    c.flush();
  }
  const k = [860, 360];
  // slack string trailing down into the clouds
  stringLine(c, [[k[0] - 4, k[1] + 8], [k[0] + 30, k[1] + 140], [k[0] - 50, k[1] + 240], [k[0] + 10, k[1] + 330], [k[0] - 30, k[1] + 430]], 0.65);
  // a loop-the-loop tail
  const loop = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, a = u * TAU * 1.15 - 0.5;
    loop.push([k[0] + 60 + u * 260 + Math.cos(a) * 70 * (1 - u * 0.4), k[1] + 120 + Math.sin(a) * 70 * (1 - u * 0.4) - u * 60]);
  }
  tail(c, loop, 1.5, { bows: 5 });
  kite(c, X(k[0], k[1], 1.55, -0.45), 1.55);
  const birds = [];
  for (let i = 0; i < 34; i++) {
    const a = c.r(0, TAU), r = c.r(160, 640);
    const x = k[0] + Math.cos(a) * r * 1.3, y = k[1] - 40 + Math.sin(a) * r * 0.42;
    birds.push([x, y, c.r(0.9, 1.7) * (1 - r / 1400), a + Math.PI / 2 + c.r(-0.3, 0.3), c.r()]);
  }
  flock(c, birds, '#33202c', 240);
};

// 6. The fall. Dusk; the kite flipping down the sky in three exposures.
BEAT[5] = (c) => {
  ground(c, (x) => 930 + 26 * Math.sin(x * 0.003), '#1d2230', { op: 255 });
  // a thorn tree, small, where it is going to land
  thornBranch(c, 1360, 935, -1.6, 60, 1.2, 3, '#12151f');
  c.flush();
  // wind streaks
  for (let i = 0; i < 22; i++) {
    const x = c.r(-50, 1900), y = c.r(80, 800), l = c.r(120, 380);
    c.strokePath([[x, y], [x + l * 0.5, y + c.r(-14, 14)], [x + l, y + c.r(-10, 10)]], 'wire', '#c8b6c6', c.r(0.5, 1.0));
  }
  c.flush();
  // the spin path
  stringLine(c, quad([480, 150], [1180, 260], [1160, 760], 26), 0.5, '#d9c9d6');
  const pose = [[520, 170, 0.75, 1.1, 0.25], [880, 380, 1.0, 2.7, 0.5], [1140, 690, 1.25, 4.3, 1]];
  for (const [x, y, s, r, op] of pose) {
    if (op === 1) tail(c, wave(x, y + 30, -2.2, 150, 30, 2.4, 1), s, { bows: 2 });
    kite(c, X(x, y, s, r), s, { op });
  }
};

// 7. The thorn tree. Night, rain; the kite torn and tangled; one warm light far below.
BEAT[6] = (c) => {
  ground(c, (x) => 905 + 30 * Math.sin(x * 0.0024 + 2), '#1a2230', { op: 255 });
  ground(c, (x) => 990 + 16 * Math.sin(x * 0.004), '#0e131c', { op: 255 });
  // trunk, tapered strips
  for (let i = 0; i < 20; i++) {
    const u0 = i / 20, u1 = (i + 1) / 20;
    const y0 = lerp(1100, 640, u0), y1 = lerp(1100, 640, u1);
    const w0 = lerp(46, 16, u0), w1 = lerp(46, 16, u1);
    const x0 = 1000 + 30 * Math.sin(u0 * 2.2), x1 = 1000 + 30 * Math.sin(u1 * 2.2);
    c.washPoly([[x0 - w0, y0], [x0 + w0, y0], [x1 + w1, y1], [x1 - w1, y1]], '#06080d');
  }
  c.flush();
  thornBranch(c, 1010, 650, -2.2, 210, 3.0, 4, '#06080d');
  thornBranch(c, 1015, 650, -0.75, 220, 3.0, 4, '#06080d');
  thornBranch(c, 1012, 660, -1.5, 180, 2.6, 4, '#06080d');
  thornBranch(c, 1008, 760, -2.7, 160, 2.2, 3, '#06080d');
  c.flush();
  // tail tangled through the branches, hanging limp
  tail(c, [[1180, 520], [1150, 600], [1100, 560], [1060, 620], [1080, 700], [1050, 760], [1062, 830]], 1.2, { bows: 3, op: 170 });
  kite(c, X(1200, 450, 1.45, -0.7), 1.45, { torn: true, dark: 0.45 });
  thornBranch(c, 1020, 600, -0.5, 170, 1.4, 1, '#06080d');
  c.flush();
};

// 8. The mend. Lamplight, the kitchen table, Wren's scratched hands, the scarf patch.
BEAT[7] = (c) => {
  // table, planked
  c.washPoly([[-20, 600], [1940, 580], [1940, 1100], [-20, 1100]], '#6b4a30', 255);
  c.flush();
  for (let i = 0; i < 5; i++) {
    const y = 680 + i * 95;
    c.strokePath([[-20, y], [960, y - 8], [1940, y - 16]], 'ink', '#3c2818', 0.9);
  }
  for (let i = 0; i < 70; i++) {
    const x = c.r(-20, 1900), y = c.r(610, 1080);
    c.line(x, y, x + c.r(80, 260), y - c.r(0, 4), 'dry', '#55381f', c.r(0.25, 0.5));
  }
  c.flush();
  // lantern
  c.fillPoly([[250, 300], [350, 300], [362, 470], [238, 470]], '#f6d27a', { opacity: 240, bleed: 0.04, texture: 0.3 });
  c.flush();
  c.washPoly([[230, 280], [370, 280], [370, 304], [230, 304]], '#2a1e16');
  c.washPoly([[226, 466], [374, 466], [374, 490], [226, 490]], '#2a1e16');
  c.strokePath([[260, 280], [300, 230], [340, 280]], 'ink', '#2a1e16', 1.6);
  c.flush();
  // what's left of the scarf, cut, its edge frayed
  c.fillPoly([[110, 690], [430, 672], [462, 744], [140, 772]], C.yellow, { opacity: 240, bleed: 0.03, texture: 0.5 });
  c.flush();
  for (let i = 0; i < 12; i++) c.line(430 + i * 2.7, 672 + i * 6, 450 + i * 2.7 + c.r(0, 8), 672 + i * 6 + c.r(-3, 3), 'ink', C.yellowLo, 0.4);
  c.flush();
  // the kite on its back across the table, patch going on
  const T = X(1040, 760, 3.2, -1.42);
  kite(c, T, 3.2, { patch: true });
  // the string, coiled, with a big ugly knot
  const coil = [];
  for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU * 2.4; coil.push([1520 + Math.cos(a) * (90 - i * 0.6), 940 + Math.sin(a) * (34 - i * 0.2)]); }
  stringLine(c, coil, 1.0);
  stringLine(c, [[1420, 940], [1330, 960], [1240, 950], [1180, 975]], 1.0);
  c.fillPoly(c.blob(1340, 958, 11, 9, { wobble: 0.3 }), '#efe8d8', { opacity: 250, bleed: 0.01, texture: 0.3 });
  c.flush();
  // hands: left steadies the kite, right pulls the thread tight; scratches from the thorns
  // a hand reaching in along `rot` from a sleeve that leaves the frame
  const hand = (x, y, rot, curl) => {
    const H = X(x, y, 2.4, rot);
    c.washPoly(tp(H, [[-30, -15], [-260, -24], [-260, 26], [-28, 16]]), C.dress, 255);
    c.washPoly(tp(H, [[-34, -17], [-46, -18], [-46, 20], [-34, 18]]), C.dressLo, 255);
    c.flush();
    c.fillPoly(tp(H, c.blob(-6, 0, 26, 16, { wobble: 0.05 })), C.skin, { opacity: 255, bleed: 0.01, texture: 0.25 });
    c.flush();
    for (let f = 0; f < 4; f++) {
      const fy = -10 + f * 6.6, fl = [17, 19, 18, 14][f] * (1 - curl * 0.35);
      c.fillPoly(tp(H, c.blob(16 + fl * 0.5, fy, fl * 0.62, 3.6, { n: 16, wobble: 0.03, rot: curl * 0.25 })), C.skin, { opacity: 255, bleed: 0.01, texture: 0.25 });
    }
    c.fillPoly(tp(H, c.blob(6, -16, 11, 4.2, { n: 16, wobble: 0.03, rot: -0.6 })), '#d9a47e', { opacity: 255, bleed: 0.01, texture: 0.25 });
    c.flush();
    // thorn scratches across the back of the hand
    for (const [a0, a1] of [[[-22, -6], [0, -10]], [[-16, 4], [6, -2]], [[-10, 10], [8, 8]]]) {
      const a = H(...a0), b = H(...a1);
      c.line(a[0], a[1], b[0], b[1], 'ink', '#b0362c', 0.6);
    }
    c.flush();
  };
  hand(770, 860, -0.35, 0.2);
  hand(1360, 640, Math.PI - 0.35, 0.6);
  // needle and thread
  stringLine(c, [[1180, 700], [1260, 640], [1330, 640]], 0.6, '#5a3a10');
  c.line(1330, 640, 1372, 628, 'ink', '#c9ccd2', 1.1);
  c.flush();
};

// 9. Leaning in. Morning; one long taut line; the patched kite higher than ever; swifts around it.
BEAT[8] = (c) => {
  sea(c, 760, 1100, { n: 200, glint: '#f3ecd6' });
  const hill = (x) => 880 - 120 * Math.exp(-(((x - 260) / 520) ** 2)) + 60 * Math.max(0, (x - 800) / 600) ** 2;
  ground(c, hill, C.grass, { mottle: [C.grassLo, C.grassHi], grass: C.grassLo });
  // leaning back into the pull
  const hand = girl(c, X(330, hill(330) + 2, 1.7, -0.22), 1.7, { arms: [-0.5, -0.38], legs: 'brace', wind: 1.2 });
  const k = [1660, 170];
  stringLine(c, [hand, [lerp(hand[0], k[0], 0.5), lerp(hand[1], k[1], 0.5)], [k[0] - 4, k[1] + 4]], 0.85);
  // the knot, a bump on the line
  const kn = [lerp(hand[0], k[0], 0.42), lerp(hand[1], k[1], 0.42)];
  MARK.knot = kn;
  c.fillPoly(c.blob(kn[0], kn[1], 4.5, 3.5, { wobble: 0.3 }), C.string, { opacity: 255, bleed: 0.01, texture: 0.2 });
  c.flush();
  tail(c, wave(k[0] + 4, k[1] + 70, 1.85, 200, 16, 1.7, 0.2), 0.85, { bows: 3 });
  kite(c, X(k[0], k[1], 0.85, 0.42), 0.85, { patch: true });
  const birds = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + c.r(-0.15, 0.15), rx = c.r(150, 210), ry = c.r(80, 110);
    birds.push([k[0] + Math.cos(a) * rx, k[1] + 20 + Math.sin(a) * ry, c.r(0.7, 1.0), a + Math.PI / 2, c.r()]);
  }
  flock(c, birds, C.swift, 230);
};

// ---------------------------------------------------------------- look per beat
// sky gradient, cloud shelf, light, grade
const LOOK = [
  { top: '#5c9ed6', low: '#e9f1ee', cloud: ['#ffffff', 0.75, 0], sun: [260, 140, 120, '#fff6d8', 0.5], wash: '#ffffff' },
  { top: '#4f8fc9', low: '#dcebf0', cloud: ['#ffffff', 0.6, 60], sun: [1500, 200, 110, '#fff2cc', 0.4], wash: '#ffffff' },
  { top: '#8fbfd9', low: '#e6eff0', cloud: ['#ffffff', 0.55, 30], sun: [1500, 120, 160, '#fff6dc', 0.45], wash: '#ffffff' },
  { top: '#b7d7e6', low: '#f6f6ee', cloud: ['#ffffff', 0.5, 0], sun: [1010, 460, 260, '#ffffff', 1.1], wash: '#ffffff' },
  { top: '#d9774f', low: '#fbe0ae', cloud: ['#ffe0c0', 0.35, -120], sun: [1450, 610, 150, '#fff0c8', 0.95], wash: '#ffe6c8' },
  { top: '#2b2f52', low: '#b07a8a', cloud: ['#8e6f8a', 0.6, 80], sun: [1700, 820, 220, '#ff9e7a', 0.35], wash: '#d6b6c8' },
  { top: '#0b0f17', low: '#1e2a3a', cloud: ['#2c3a4e', 0.7, -60], sun: [330, 905, 18, '#ffb35a', 1.4], wash: '#5a6a84' },
  { top: '#2a1a12', low: '#4a2e1c', cloud: null, sun: [300, 385, 150, '#ffb860', 1.0], wash: '#ffcf96' },
  { top: '#4f9ad8', low: '#f6ead0', cloud: ['#ffffff', 0.7, 40], sun: [220, 120, 160, '#fff1c8', 0.6], wash: '#ffffff' },
];

function paint(P) {
  const A = {};
  // watercolour bloom over the sky gradient, painted white and tinted per beat
  A.wash = P.layer('wash', { w: 1920, h: 1080, seed: 'wash' }, (c) => {
    for (let i = 0; i < 46; i++) {
      c.fillPoly(c.blob(c.r(-100, 2020), c.r(-60, 900), c.r(160, 460), c.r(80, 220), { wobble: 0.3 }), '#ffffff', { opacity: c.r(10, 26), bleed: 0.2, texture: 0.8, border: 0.6 });
    }
    c.flush();
  });
  A.clouds = P.layer('clouds', { w: 1920, h: 1080, seed: 'clouds' }, (c) => {
    const shelves = [[180, 10], [330, 12], [500, 14]];
    for (const [y, n] of shelves) {
      for (let i = 0; i < n; i++) {
        const cx = c.r(-60, 1980), rx = c.r(110, 300), ry = c.r(28, 70);
        c.fillPoly(c.blob(cx, y + c.r(-40, 40), rx, ry, { n: 40, wobble: 0.32, freq: 2.4, seed: i }), '#ffffff', { opacity: c.r(40, 90), bleed: 0.3, texture: 0.7, border: 0.5, dir: 'out' });
      }
      c.flush();
    }
  });
  A.rain = P.layer('rain', { w: 1920, h: 1080, seed: 'rain' }, (c) => {
    for (let i = 0; i < 700; i++) {
      const x = c.r(-80, 1960), y = c.r(-60, 1080), l = c.r(30, 70);
      c.line(x, y, x - l * 0.18, y + l, 'wire', '#ffffff', c.r(0.35, 0.8));
    }
    c.flush();
  });
  for (let k = 0; k < BEAT.length; k++) A['b' + k] = P.layer('b' + k, { w: 1920, h: 1080, seed: 'tether' + k }, BEAT[k]);
  return A;
}

function draw(R, t) {
  const k = clamp(Math.floor(t), 0, BEAT.length - 1), L = LOOK[k], A = R.assets;
  R.rect(0, 0, 1920, 1080, [...hex(L.top), 1], { grad: 'vertical', c1: [...hex(L.low), 1] });
  R.layer(A.wash, M.id(), { opacity: k >= 5 && k <= 7 ? 0.12 : 0.35, tint: hex(L.wash) });
  const [sx, sy, sr, scol, si] = L.sun;
  if (k !== 3 && k !== 6 && k !== 7) {
    R.glow(sx, sy, sr * 0.9, hex(scol), si * 0.16, { ext: 3.0 });
    R.glow(sx, sy, sr * 0.22, hex(scol), si * 0.55, { ext: 2.6 });
  }
  if (L.cloud) R.layer(A.clouds, M.translate(L.cloud[2], 0), { opacity: L.cloud[1], tint: hex(L.cloud[0]) });
  R.layer(A['b' + k]);
  if (k === 3) R.glow(sx, sy, sr * 0.4, hex(scol), 0.45, { ext: 3 });                       // the snap flash
  if (k === 6) { R.layer(A.rain, M.id(), { opacity: 0.32, tint: [0.7, 0.78, 0.9] }); R.glow(sx, sy, sr, hex(scol), 0.8, { ext: 5 }); }
  if (k === 7) { R.glow(sx, sy, sr * 0.5, hex(scol), 0.35, { ext: 3 }); R.glow(1000, 800, 700, hex('#ffb060'), 0.08, { ext: 2 }); }                 // lamplight over the table
  if (k === 8) R.glow(MARK.knot[0], MARK.knot[1], 8, hex('#fff6dc'), 0.7); // the knot catches the sun
}

function post(lt) {
  const k = clamp(Math.floor(lt), 0, BEAT.length - 1);
  const dark = k === 6 || k === 7;
  return {
    // bright skies sit above the bloom threshold and haze the whole frame: keep it for night
    bloom: [0.03, 0.03, 0.03, 0.08, 0.1, 0.15, 0.3, 0.2, 0.03][k],
    threshold: 0.8,
    exposure: dark ? 1.08 : 1.02,
    sat: 1.05,
    contrast: 1.05,
    vignette: dark ? 0.5 : 0.3,
    paper: 0.34,
    grain: 0.05,
  };
}

export const scene = { id: 'tether', bg: '#ffffff', paint, draw, blur: () => 1, post };
