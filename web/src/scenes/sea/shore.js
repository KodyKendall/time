// SEA — the shore (panel 10): a green bank seen in 3/4 view, a sandy path along the creature's footline,
// the shore edge where it steps out of the water (wet sand, foam, algae, pebbles, puddles), and the first
// land plants (Cooksonia, horsetails, small ferns, moss) along the bank's far edge. Static painted layer.
import { C } from '../lib/palette.js';
import { M, TAU, lerp, clamp, rng, mixHex, smoothstep } from './lib.js';
import { fieldStrokes, clipTo, inPoly } from './paintkit.js';
import { groundY } from './terrain.js';

export const LAND = { x0: 4080, y0: -2700, w: 2340, h: 2760, scale: 1.12 };
export const SHORE_X = 4700;                      // where the shore edge meets the far edge
export const farEdge = (x) => groundY(x) - 150 + 55 * (smoothstep(4950, 5200, x) - smoothstep(5650, 5900, x)) - 90 * smoothstep(5700, 6300, x) + 18 * Math.sin(x / 95);
// shore edge line: from the far edge down-left into the water
export const shoreEdge = (t) => [SHORE_X - 0.42 * t + 14 * Math.sin(t / 60), farEdge(SHORE_X) + t];

function cooksonia(c, x, y, h, r) {
  const stem = (x0, y0, a, len, depth) => {
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    c.strokePath([[x0, y0], [lerp(x0, x1, 0.5) + r(-2, 2), lerp(y0, y1, 0.5)], [x1, y1]], 'sea_leaf', r.pick(['#5d7a3e', '#6aa36b', '#7a8a3a']), h / 80, 0.5);
    if (depth > 0) {
      stem(x1, y1, a - r(0.25, 0.45), len * 0.72, depth - 1);
      stem(x1, y1, a + r(0.25, 0.45), len * 0.72, depth - 1);
    } else {
      c.washPoly(c.blob(x1, y1 - h * 0.02, h * 0.04, h * 0.03, { n: 10, wobble: 0.1 }), r.pick([C.ochre, C.gold, '#c98a3a']), 250);
    }
  };
  stem(x, y, -Math.PI / 2 + r(-0.15, 0.15), h * 0.5, 2);
}
function horsetail(c, x, y, h, r) {
  const segs = 7, lean = r(-0.12, 0.12);
  let px = x, py = y;
  for (let k = 0; k < segs; k++) {
    const nx = px + (lean * h) / segs, ny = py - h / segs;
    c.strokePath([[px, py], [nx, ny]], 'sea_contour', r.pick(['#3f7d5a', '#5d7a3e']), h / 55, 0.3);
    for (const sd of [-1, 1]) c.strokePath([[nx, ny], [nx + sd * h * 0.06, ny + h * 0.03], [nx + sd * h * 0.1, ny + h * 0.07]], 'sea_leaf', '#6aa36b', h / 130, 0.5);
    px = nx; py = ny;
  }
  c.washPoly(c.blob(px, py - h * 0.03, h * 0.022, h * 0.05, { n: 10 }), '#c9b070', 240);
}
function fern(c, x, y, h, r, flip = 1) {
  const pts = [];
  for (let k = 0; k <= 16; k++) { const s = k / 16; pts.push([x + flip * h * 0.5 * s * s, y - h * s + h * 0.25 * s * s]); }
  c.strokePath(pts, 'sea_contour', '#2f6048', h / 110, 0.5);
  for (let k = 2; k < 16; k++) {
    const p = pts[k], q = pts[k + 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const l = h * 0.2 * Math.sin(Math.PI * (k / 16)) * (1 - (0.4 * k) / 16);
    for (const sd of [-1, 1]) {
      const la = a + sd * 1.0;
      c.strokePath([p, [p[0] + Math.cos(la) * l * 0.5, p[1] + Math.sin(la) * l * 0.5 + 2], [p[0] + Math.cos(la) * l, p[1] + Math.sin(la) * l + 5]], 'sea_leaf', sd < 0 ? '#4f8a5a' : '#2f6a4c', h / 100, 0.5);
    }
  }
}
function moss(c, x, y, s, r) {
  for (let k = 0; k < 12; k++) {
    const a = r(-Math.PI, 0), d = r(0, s);
    c.washPoly(c.blob(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.45, s * r(0.12, 0.22), s * r(0.08, 0.15), { n: 10, wobble: 0.25 }), r.pick([C.moss, C.leaf, C.olive, '#4f7a3a', '#8aa860']), 240);
  }
}

export function paintLand(P) {
  return P.layer('land', { w: LAND.w, h: LAND.h, scale: LAND.scale }, (c) => {
    const r = c.r;
    const T = (pts) => pts.map((p) => [p[0] - LAND.x0, p[1] - LAND.y0]);
    const x1 = LAND.x0 + LAND.w + 40, yB = LAND.y0 + LAND.h + 40;
    const xs = [];
    for (let x = SHORE_X; x <= x1; x += 12) xs.push(x);
    const edge = [];
    for (let t = 0; t <= 1400; t += 40) edge.push(shoreEdge(t));
    const landW = xs.map((x) => [x, farEdge(x)]).concat([[x1, yB]], [[edge[edge.length - 1][0], yB]], edge.slice().reverse());
    const land = T(landW);
    // ---------------- the bank surface: green underpainting + variation
    c.washPoly(land, '#3a7050', 255);
    c.fillPoly(land, '#4a8058', { opacity: 110, bleed: 0.03, texture: 0.9, border: 0.3 });
    for (let i = 0; i < 16; i++) {
      const x = r(SHORE_X - 200, x1), y = farEdge(x) + r(40, 900);
      c.fillPoly(T(c.blob(x, y, r(160, 380), r(60, 140), { rot: -0.45 + r(-0.2, 0.2), wobble: 0.2 })), r.pick([C.moss, C.olive, C.leaf, '#2f6048', '#5d7a3e', C.green]), { opacity: 60, bleed: 0.08, texture: 0.85, border: 0.2 });
    }
    // grass: short directional blades over the whole bank
    fieldStrokes(c, land, () => -1.2 + r(-0.35, 0.35), {
      n: 900, len: [16, 46], w: [0.3, 0.6], steps: 3, brush: (rr) => (rr() < 0.55 ? 'sea_leaf' : 'sea_comb'),
      col: (x, y, rr) => rr.pick([C.green, C.moss, C.leaf, '#2f6048', C.olive, '#8aa860', '#a8bf96', '#24483a']),
    });
    // ---------------- the sandy path along the footline, narrowing up the bank
    const pw = (x) => lerp(120, 60, smoothstep(4900, 6200, x));
    const pathTop = [], pathBot = [];
    for (let x = SHORE_X - 260; x <= x1; x += 14) {
      pathTop.push([x, groundY(x) - pw(x) * 0.45 + 6 * Math.sin(x / 70)]);
      pathBot.push([x, groundY(x) + pw(x) * 0.55 + 8 * Math.sin(x / 90 + 1)]);
    }
    const path = T(pathTop.concat(pathBot.slice().reverse()));
    c.fillPoly(path, C.sand, { opacity: 235, bleed: 0.025, texture: 0.8, border: 0.45 });
    fieldStrokes(c, path, () => Math.atan(-0.62) + r(-0.06, 0.06), {
      n: 420, len: [24, 90], w: [0.25, 0.5], steps: 4, brush: (rr) => (rr() < 0.6 ? 'sea_comb' : 'sea_dry'),
      col: (x, y, rr) => rr.pick([C.sand, '#f3dcb0', '#d9b070', C.ochre, '#fbe7b0', '#c9a060']),
    });
    for (let i = 0; i < 160; i++) {
      const x = r(SHORE_X - 200, x1), y = groundY(x) + r(-0.45, 0.55) * pw(x);
      const pts = [];
      for (let k = 0; k <= 4; k++) pts.push([x + k * 9, y - k * 5 + 2.5 * Math.sin(k * 1.7 + i)]);
      c.strokePath(T(pts), 'wire', r.pick(['#b89050', '#fbe7b0', '#c9a060']), r(0.6, 1), 0.6);
    }
    // pebbles (mostly along the path and the shore edge)
    for (let i = 0; i < 700; i++) {
      const onPath = r() < 0.6;
      let x, y;
      if (onPath) { x = r(SHORE_X - 250, x1); y = groundY(x) + r(-0.5, 0.6) * pw(x); }
      else { const e = shoreEdge(r(0, 1400)); x = e[0] + r(0, 90); y = e[1] + r(-20, 20); }
      const s = r(2.2, 8.5);
      const col = r.pick(['#8a8594', '#b3a9a0', '#6a6258', C.cream, '#c9a070', '#4d4a57', '#9a8a7a']);
      c.washPoly(T(c.blob(x, y, s, s * 0.7, { n: 12, wobble: 0.15 })), col, 250);
      if (s > 4.5) c.strokePath(T([[x - s * 0.5, y - s * 0.3], [x, y - s * 0.55], [x + s * 0.4, y - s * 0.35]]), 'wire', mixHex(col, '#ffffff', 0.5), s / 8, 0.5);
    }
    // puddles on the path
    for (let i = 0; i < 6; i++) {
      const x = r(4850, 6100), y = groundY(x) + r(0.1, 0.4) * pw(x);
      const w = r(26, 70);
      const pud = c.blob(x, y, w, w * 0.24, { n: 24, wobble: 0.1, rot: -0.4 });
      c.washPoly(T(pud), '#3aa6a8', 245);
      c.fillPoly(T(pud), '#7fd8cf', { opacity: 90, bleed: 0.02, texture: 0.5, border: 0.5 });
      c.strokePath(T([[x - w * 0.5, y + w * 0.12], [x + w * 0.2, y - w * 0.12]]), 'wire', '#e8fff8', 1.1, 0.5);
    }
    // ---------------- shore edge: wet sand, algae, foam
    const wet = T(edge.map(([x, y]) => [x, y]).concat(edge.slice().reverse().map(([x, y]) => [x + 70, y + 6])));
    c.fillPoly(wet, '#6a5a2e', { opacity: 170, bleed: 0.04, texture: 0.8, border: 0.3 });
    for (let i = 0; i < 110; i++) {
      const e = shoreEdge(r(0, 1500));
      const len = r(16, 50);
      c.strokePath(T([[e[0] + r(0, 40), e[1]], [e[0] - len * 0.4, e[1] + len * 0.2], [e[0] - len * 0.8, e[1] + len * 0.25]]), 'sea_leaf', r.pick(['#3f6a3a', '#5a6a2a', '#2f5a3a', '#7a8a3a']), r(0.4, 0.8), 0.5);
    }
    for (let k = 0; k < 3; k++) c.strokePath(T(edge.map(([x, y], i) => [x - 8 - k * 14 + 5 * Math.sin(i * 1.3 + k), y + k * 3])), k === 0 ? 'sea_contour' : 'sea_dry', k === 0 ? '#f3f8ee' : '#dff8f0', 1.1 - k * 0.2, 0.5);
    // keep everything inside the land
    clipTo(c, land, [-20, -20, LAND.w + 20, LAND.h + 20]);
    // ---------------- plants along the far edge and scattered on the bank (not on the path)
    const offPath = (x, y) => Math.abs(y - groundY(x)) > pw(x) * 0.7;
    for (let i = 0; i < 40; i++) {
      const x = r(SHORE_X + 20, x1), y = farEdge(x) + r(4, 14);
      const [px, py] = T([[x, y]])[0];
      moss(c, px, py, r(16, 36), r);
    }
    const plants = [];
    for (let i = 0; i < 70; i++) plants.push(r(SHORE_X + 40, x1 - 10));
    plants.sort((a, b) => a - b);
    for (const x of plants) {
      if (x > 5050 && x < 5720) continue; // keep the sky clear behind the creature's raised head
      const [px, py] = T([[x, farEdge(x) + 6]])[0];
      const k = r();
      if (k < 0.4) cooksonia(c, px, py, r(80, 170), r);
      else if (k < 0.65) horsetail(c, px, py, r(100, 200), r);
      else fern(c, px, py, r(90, 180), r, r() < 0.5 ? -1 : 1);
    }
    for (let i = 0; i < 90; i++) {
      const x = r(SHORE_X + 60, x1), y = farEdge(x) + r(60, 700);
      if (!offPath(x, y) || !inPoly(landW, x, y)) continue;
      const [px, py] = T([[x, y]])[0];
      if (r() < 0.6) moss(c, px, py, r(12, 26), r);
      else cooksonia(c, px, py, r(40, 90), r);
    }
    c.strokePath(T(xs.filter((_, i) => i % 3 === 0).map((x) => [x, farEdge(x)])), 'sea_contour', '#1e3a2a', 1.0, 0.5);
  });
}

export function drawLand(R, A) {
  R.layer(A.land, M.translate(LAND.x0, LAND.y0));
}
