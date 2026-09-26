// MIND · network — lit die cells lift off as glowing nodes, arrange into six layers, think in
// waves, then the lattice straightens into rows of code (storyboard panel 22 -> 23).
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, atlas, paintBall, circlePts } from '../lib/kit.js';
import { ease, invLerp, h1 } from '../../engine/math.js';
import { SYN } from './code.js';
import { T, NODES, LAYERS, MAIN, WEB, ED, SEG0, boardView, netView, lineY, colX, rowTiming, targetOf } from './layout.js';
import { inkContour, dab } from './paintkit.js';

const NB = 12; // samples per noodle

// ------------------------------------------------------------------------------------------------
// Painting
// ------------------------------------------------------------------------------------------------
export function paintNetwork(P) {
  const bases = [C.orange, C.amber, '#ec7236', '#f08a3c', '#e0553a', '#e86a30', '#f59b3d', '#e8622c'];
  const nodes = atlas(P, 'nodes', 8, 120, (c, cx, cy, i) => {
    paintBall(c, cx, cy, 50, bases[i], { lightAngle: -2.2, texture: 0.6, seed: i * 5 + 1, rim: '#ffd9a8', light: '#ffe2b0' });
    // directional strokes following the sphere + a painted core highlight
    const r = c.r;
    for (let k = 0; k < 7; k++) {
      const a0 = r(0, TAU), rr = r(18, 44);
      const pts = [];
      for (let q = 0; q <= 6; q++) { const a = a0 + q * 0.22; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.96]); }
      c.strokePath(pts, 'mind_dry', r.pick([C.vermilion, '#ffb070', C.rust, C.gold]), 0.35, 0.5);
    }
    inkContour(c, circlePts(cx, cy, 50, 48), '#6a2410', 0.9, { gap: 0.3, runs: [2, 3] });
  }, { cols: 4, scale: 2 });
  // painted halos (warm glaze + stipple) drawn additively under the nodes
  const halo = atlas(P, 'halo', 2, 200, (c, cx, cy, i) => {
    const r = c.r;
    for (let k = 0; k < 5; k++) c.fillPoly(c.blob(cx, cy, 90 - k * 14, 86 - k * 14, { wobble: 0.14 }), i ? '#ffb070' : '#f59b3d', { opacity: 16 + k * 6, bleed: 0.2, texture: 0.8, border: 0.1 });
    for (let k = 0; k < 14; k++) {
      const a = r(0, TAU), rr = r(34, 70);
      dab(c, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r(1.5, 3.5), r(1.5, 3.5), r.pick(['#ffd9a8', '#ffb070', '#f59b3d']), { wobble: 0.1, n: 8 });
    }
  }, { cols: 2, scale: 1 });
  // painted wire strokes used for the lattice (stretched between nodes)
  const web = P.layer('webLines', { w: 1000, h: 72, scale: 1 }, (c) => {
    for (let v = 0; v < 6; v++) {
      const y = v * 12 + 6;
      const pts = [];
      for (let k = 0; k <= 10; k++) pts.push([4 + k * 99.2, y + c.r(-0.6, 0.6)]);
      c.strokePath(pts, v % 2 ? 'wire' : 'mind_contour', '#ffffff', v % 2 ? 1.25 : 0.55, 0.5);
    }
  });
  // background: deep painted space with distant networks (parallax planes: far, mid, near)
  const bgFar = P.layer('netBgFar', { w: 2600, h: 1500, scale: 0.55 }, (c) => {
    const r = c.r;
    c.washPoly([[0, 0], [2600, 0], [2600, 1500], [0, 1500]], '#060a15', 255);
    for (let i = 0; i < 26; i++) c.fillPoly(c.blob(r(0, 2600), r(0, 1500), r(300, 700), r(180, 380), { rot: r(0, 3), wobble: 0.22 }), r.pick([C.navy2, '#18223f', '#1c1a3c', '#0e2a38', '#141c3a']), { opacity: 30, bleed: 0.22, texture: 0.9, border: 0.06 });
    // the space has a grain: long soft streaks along a gentle flow
    const flow = (x, y) => 0.12 * Math.sin(x * 0.0016 + 1.3) + 0.08 * Math.sin(y * 0.003 + x * 0.001);
    for (let k = 0; k < 340; k++) {
      let x = r(-100, 2600), y = r(0, 1500);
      const pts = [], L = r(250, 900), n = 8;
      for (let q = 0; q <= n; q++) { pts.push([x, y]); const a = flow(x, y); x += Math.cos(a) * L / n; y += Math.sin(a) * L / n; }
      c.strokePath(pts, 'mind_dry', r.pick(['#1c2850', '#241f4c', '#143244', '#1a2448', '#2a2656', '#18304e']), r(0.25, 0.6), 0.6);
    }
    // luminous veils (cool, with a little plum)
    for (const [x, y, rx, ry, col, op] of [[700, 420, 900, 420, '#1e2150', 46], [1900, 1000, 1000, 460, '#0e3544', 42], [1500, 300, 700, 300, '#2a1838', 40], [500, 1150, 800, 320, '#12284a', 44], [2300, 450, 600, 380, '#1a2a52', 36]]) {
      c.fillPoly(c.blob(x, y, rx, ry, { wobble: 0.25, rot: r(-0.2, 0.2), n: 60 }), col, { opacity: op, bleed: 0.28, texture: 0.9, border: 0.05 });
    }
    // a vast ghost network far behind (the mind is bigger than what we see)
    {
      const cols = 10, pts = [];
      for (let L = 0; L < cols; L++) {
        const n = 7 + ((L * 5) % 4), col = [];
        for (let q = 0; q < n; q++) col.push([130 + L * 260 + r(-30, 30), 750 + (q - (n - 1) / 2) * 150 + r(-25, 25) + 120 * Math.sin(L * 0.8)]);
        pts.push(col);
      }
      for (let L = 0; L < cols - 1; L++) pts[L].forEach((a, ia) => pts[L + 1].forEach((b, ib) => {
        const rel = Math.abs(ia / (pts[L].length - 1) - ib / (pts[L + 1].length - 1));
        if (rel > 0.34 || r() < 0.35) return;
        c.strokePath([a, [lerp(a[0], b[0], 0.5) + r(-8, 8), lerp(a[1], b[1], 0.5) + r(-8, 8)], b], 'wire', r.pick(['#1a2a4c', '#163244', '#22224a']), r(1.0, 1.8), 0.5);
      }));
      for (const col of pts) for (const p of col) {
        c.fillPoly(c.blob(p[0], p[1], 26, 26, { wobble: 0.1 }), '#1a2a4a', { opacity: 40, bleed: 0.2, texture: 0.7, border: 0.05 });
        dab(c, p[0], p[1], 7, 7, r.pick(['#28365a', '#2c3050', '#223e4c']));
      }
    }
    // star dust
    for (let k = 0; k < 520; k++) { const s = Math.pow(r(), 2.2); dab(c, r(0, 2600), r(0, 1500), 0.6 + 1.4 * s, 0.6 + 1.4 * s, r.pick(['#3a4a78', '#4a5a8a', '#5a4a7a', '#2a5a6a', '#6a5a4a']), { wobble: 0.1, n: 8 }); }
    for (let k = 0; k < 10; k++) { const x = r(0, 2600), y = r(0, 1500), a = r(-0.2, 0.2), L = r(150, 400); c.line(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 'mind_speck', r.pick(['#2c3660', '#322e58', '#223e50']), 0.3); }
    // distant networks (very faint)
    for (const [x, y, s] of [[260, 260, 0.45], [2250, 330, 0.4], [420, 1250, 0.4], [2150, 1200, 0.5], [1300, 120, 0.35]]) paintMiniNet(c, x, y, s, ['#1f2d4c', '#1d3a48', '#2a2448'], ['#5a3a34', '#2e5058', '#4a3a5a'], 0.8);
  });
  const bgMid = P.layer('netBgMid', { w: 2600, h: 1500, scale: 0.55 }, (c) => {
    const r = c.r;
    for (const [x, y, s] of [[210, 560, 0.7], [2380, 820, 0.75], [600, 1390, 0.65], [1960, 110, 0.65]]) paintMiniNet(c, x, y, s, ['#2a3f66', '#244f5c', '#3e3264'], ['#a8603a', '#4a9a9a', '#b8784a'], 1.0);
    // drifting fragments of code: rows of coloured dashes (a thought, before it is written)
    const syn = ['#e27a92', '#f2b544', '#7fd8cf', '#f59b3d', '#c6b3f0', '#8d95ad'];
    for (const [x0, y0] of [[260, 150], [2150, 520], [380, 900], [2240, 1330], [1150, 1420], [1500, 60]]) {
      const rows = r.int(3, 5);
      for (let q = 0; q < rows; q++) {
        let x = x0 + r(0, 30) + (q % 2) * 18;
        const y = y0 + q * 17;
        const n = r.int(2, 5);
        for (let k = 0; k < n; k++) {
          const L = r(14, 60);
          c.strokePath([[x, y], [x + L, y + r(-0.5, 0.5)]], 'mind_bar', mixHex(r.pick(syn), '#101830', 0.45), 1.3, 0);
          x += L + r(8, 14);
        }
      }
    }
  });
  // near plane: big out-of-focus nodes and strands framing the edges (exit as the camera leans in)
  const near = P.layer('netNear', { w: 2200, h: 1300, scale: 0.4 }, (c) => {
    const r = c.r;
    const spots = [[140, 180, 70], [90, 900, 95], [2080, 240, 85], [2120, 1080, 110], [1100, 1260, 60], [700, 40, 55], [1560, 60, 50], [1780, 1250, 70]];
    for (const [x, y, R0] of spots) {
      // out-of-focus node: a soft luminous disc with a brighter rim (bokeh), drawn additively
      const warm = r() < 0.7;
      c.fillPoly(c.blob(x, y, R0, R0, { wobble: 0.05, n: 40 }), warm ? '#5a2a10' : '#123a44', { opacity: 120, bleed: 0.06, texture: 0.5, border: 0.6 });
      c.fillPoly(c.blob(x, y, R0 * 0.8, R0 * 0.8, { wobble: 0.06, n: 36 }), warm ? '#3a1a08' : '#0c2830', { opacity: 90, bleed: 0.1, texture: 0.6, border: 0.2 });
      inkContour(c, circlePts(x, y, R0 * 0.97, 40), warm ? '#8a4a1c' : '#1f5a66', 2.2, { gap: 0.25, runs: [2, 3] });
    }
  });
  return { nodes, halo, web, bgFar, bgMid, near };
}
function paintMiniNet(c, x, y, s, lineCols, nodeCols, k = 1) {
  const r = c.r;
  const cols = r.int(3, 5), pts = [];
  for (let L = 0; L < cols; L++) {
    const n = r.int(3, 6), col = [];
    for (let q = 0; q < n; q++) col.push([x + (L - (cols - 1) / 2) * 150 * s + r(-6, 6), y + (q - (n - 1) / 2) * 52 * s + r(-6, 6)]);
    pts.push(col);
  }
  for (let L = 0; L < cols - 1; L++) for (const a of pts[L]) for (const b of pts[L + 1]) {
    if (r() < 0.5) continue;
    const dx = b[0] - a[0];
    c.strokePath([a, [a[0] + dx * 0.45, a[1]], [b[0] - dx * 0.45, b[1]], b], 'mind_callig', r.pick(lineCols), (0.9 * s + 0.3) * k, 0.5);
  }
  for (const col of pts) for (const p of col) {
    const rr = (6 * s + 2) * r(0.8, 1.2);
    c.fillPoly(c.blob(p[0], p[1], rr * 2.2, rr * 2.2, { wobble: 0.1 }), r.pick(nodeCols), { opacity: 26, bleed: 0.2, texture: 0.7, border: 0.05 });
    dab(c, p[0], p[1], rr, rr, r.pick(nodeCols), { hi: mixHex(nodeCols[0], '#ffe6c0', 0.4) });
  }
}

// ------------------------------------------------------------------------------------------------
// Node state
// ------------------------------------------------------------------------------------------------
const waveP = [0.5, 0.7, 0.96];
export function fireTime(n, w) { return T.waves[w] + n.L * T.wLayer + 0.05 * h1(n.id, w, 7); }
export function isActive(n, w) { return h1(n.id, w, 3) < waveP[w]; }
export function flare(n, lt) {
  let f = 0;
  for (let w = 0; w < 3; w++) {
    if (!isActive(n, w)) continue;
    const d = lt - fireTime(n, w);
    if (d < -0.03 || d > 1.5) continue;
    const env = d < 0 ? (d + 0.03) / 0.03 : Math.exp(-d / (0.22 + 0.08 * w));
    f = Math.max(f, env * (0.7 + 0.3 * w / 2));
  }
  return f;
}

// Node position in NET space once landed (includes departure towards its editor target).
export function nodeNet(n, lt) {
  const tg = targetOf(n);
  const u = ease.inOutCubic(invLerp(n.t0, n.t1, lt));
  if (u <= 0) return [n.x, n.y, n.rad];
  let x = lerp(n.x, tg.x, u), y = lerp(n.y, tg.y, u);
  const dx = tg.x - n.x, dy = tg.y - n.y, d = Math.hypot(dx, dy) || 1;
  const sw = Math.sin(Math.PI * u) * Math.min(90, d * 0.14) * (n.id % 3 === 0 ? -1 : 1);
  x += (-dy / d) * sw;
  y += (dx / d) * sw;
  const kind = n.tg.kind;
  let r;
  if (kind === 'thumb') r = lerp(n.rad, n.rad * tg.s, u);
  else if (kind === 'btn') r = n.rad * (1 - ease.inCubic(invLerp(n.t1 - 0.3, n.t1, lt))) * lerp(1, 0.7, u);
  else r = lerp(n.rad, tg.s, u);
  if (kind === 'thumb') {
    const th = ED.thumbs[n.tg.k];
    r *= 1 - ease.inCubic(invLerp(th.tOpen - 0.02, th.tOpen + 0.14, lt));
  }
  return [x, y, r];
}

// Full node state in SCREEN space: { x, y, r, hot } or null.
export function nodeState(n, lt) {
  const cell = n.cell;
  if (lt < cell.tl + 0.06) return null;
  const nv = netView(lt);
  const zN = M.scaleOf(nv);
  const g = ease.outBack(clamp(invLerp(cell.tl + 0.06, cell.tl + 0.44, lt)), 1.6);
  const hot = 1 - smoothstep(cell.tl + 0.1, cell.tl + 0.9, lt);
  const u = invLerp(cell.tl + 0.05, n.tArr, lt);
  if (u < 1) {
    const [sx, sy] = M.apply(nv, n.x, n.y);
    // the light rides with its cell while condensing, then is free of the sinking board
    const [bx, by] = M.apply(boardView(Math.min(lt, cell.tl + 0.24)), cell.cx, cell.cy);
    const e = ease.inOutCubic(u);
    let x = lerp(bx, sx, e), y = lerp(by, sy, e);
    const dx = sx - bx, dy = sy - by, d = Math.hypot(dx, dy) || 1;
    const sw = Math.sin(Math.PI * e) * (n.id % 2 ? 1 : -1) * Math.min(110, d * 0.2);
    x += (-dy / d) * sw;
    y += (dx / d) * sw;
    return { x, y, r: n.rad * zN * g * (1 + 0.35 * Math.sin(Math.PI * e)), hot };
  }
  const [x, y, r] = nodeNet(n, lt);
  const [sx, sy] = M.apply(nv, x, y);
  return { x: sx, y: sy, r: r * zN, hot };
}

// ------------------------------------------------------------------------------------------------
// Edges: grow -> (think) -> flatten in place -> slide into the code row
// ------------------------------------------------------------------------------------------------
export function growOf(e, lt) {
  const t0 = Math.max(e.a.tArr, e.b.tArr) - 0.1 + 0.25 * h1(e.id, 11, 5);
  return ease.inOutSine(invLerp(t0, t0 + 0.5, lt));
}
export function flatOf(e, lt) {
  const t0 = fireTime(e.a, 2) + T.flat + 0.05 * h1(e.id, 17, 5);
  return ease.inOutSine(invLerp(t0, t0 + T.flatDur, lt));
}
export function slideOf(e, row, lt) {
  const ts = T.slide0 + 0.022 * row + 0.03 * h1(e.id, 13, 5);
  return ease.inOutCubic(invLerp(ts, ts + T.slideDur, lt));
}
function bez(a, c1, c2, b, s) {
  const m = 1 - s;
  return [
    m * m * m * a[0] + 3 * m * m * s * c1[0] + 3 * m * s * s * c2[0] + s * s * s * b[0],
    m * m * m * a[1] + 3 * m * m * s * c1[1] + 3 * m * s * s * c2[1] + s * s * s * b[1],
  ];
}
function noodle(e, lt) {
  const [ax, ay] = nodeNet(e.a, lt), [bx, by] = nodeNet(e.b, lt);
  const dx = bx - ax, dy = by - ay;
  return [[ax, ay], [ax + dx * 0.45, ay + e.bend * dy], [bx - dx * 0.45, by - e.bend * dy], [bx, by]];
}
export function mainPoints(e, lt, s0 = 0, s1 = 1) {
  const [a, c1, c2, b] = noodle(e, lt);
  const pts = [];
  for (let k = 0; k < NB; k++) pts.push(bez(a, c1, c2, b, lerp(s0, s1, k / (NB - 1))));
  return pts;
}
// The edge's polyline at lt (net space) and its state.
export function edgeShape(e, lt) {
  const g = growOf(e, lt);
  const uf = flatOf(e, lt), us = slideOf(e, e.tok.line, lt);
  let pts;
  if (uf <= 0 && us <= 0) pts = mainPoints(e, lt, 0, g);
  else {
    // flatten about the curve's own middle height, then slide into the token's place in its row
    const full = mainPoints(e, Math.min(lt, T.node0), 0, 1);
    const my = (full[0][1] + full[NB - 1][1]) / 2;
    const y = lineY(e.tok.line) + 1, x0 = colX(e.tok.c0) + 1.5, x1 = colX(e.tok.c1) - 1.5;
    pts = full.map((p, k) => {
      const s = k / (NB - 1);
      const f = [p[0], lerp(p[1], my, uf)];
      const d = clamp(us * 1.2 - 0.2 * Math.abs(s - 0.5) * 2);
      const dd = ease.inOutSine(d);
      return [lerp(f[0], lerp(x0, x1, s), dd), lerp(f[1], y, dd)];
    });
  }
  return { pts, g, uf, us };
}
const EDGE_BASE = [C.amber, '#e98a4c', '#a9d8cf', '#c9e4dc', C.aqua, '#f2c27a', '#7fc8d8'];
function edgeColor(e) { return EDGE_BASE[Math.floor(e.hue * EDGE_BASE.length)]; }

// Typing progress of a row (chars) and caret x.
export function typed(row, lt) {
  const { ts, te, len } = rowTiming(row);
  if (len === 0 || lt < ts) return { n: 0, x: colX(0), on: false, done: false, ts, te };
  const c = Math.min(len, (lt - ts) * T.cps);
  return { n: Math.floor(c), c, x: colX(c), on: true, done: lt >= te, ts, te };
}

// Tails: threads pulled up from the die by each column's lowest node; they stretch as the board
// sinks, then hang and sway below the layers (storyboard 22), and retract before the lattice
// flattens. Returns net-space points or null.
const TAILS = LAYERS.map((layer) => layer[layer.length - 1]);
function tailPts(n, t) {
  const st = nodeState(n, t);
  if (!st) return null;
  const keep = 1 - ease.inOutCubic(invLerp(7.3, 8.1, t));
  if (keep <= 0.01) return null;
  const inv = M.inv(netView(t));
  const [nx, ny] = M.apply(inv, st.x, st.y);
  const [bx, by] = M.apply(inv, ...M.apply(boardView(t), n.cell.cx, n.cell.cy));
  const hang = smoothstep(T.sink0 + 0.6, T.sink1 - 0.2, t);
  const ex = lerp(bx, nx + 60 * Math.sin(n.ph), hang), ey = lerp(by, 1200, hang);
  const pts = [];
  const N = 16, len = Math.hypot(ex - nx, ey - ny) || 1;
  const px = -(ey - ny) / len, py = (ex - nx) / len;
  for (let k = 0; k < N; k++) {
    const s = (k / (N - 1)) * keep;
    const sway = (18 + 30 * hang) * Math.sin(s * 7 + t * 1.3 + n.ph) * Math.sin(Math.PI * Math.min(1, s * 1.1));
    pts.push([lerp(nx, ex, s) + px * sway, lerp(ny + st.r * 0.8, ey, s) + py * sway]);
  }
  return pts;
}

// Painted noodles + node contours (dynamic layer, net space, boiling at 12-15 fps).
export function mainLayer(R, lt, ltF) {
  if (ltF < T.volleys[0] || ltF > 11.0) return null;
  const moving = (ltF < 4.0) || (ltF > 7.25 && ltF < 9.35);
  const fps = moving ? 15 : 12;
  const key = R.key(fps);
  const tLt = key / fps - SEG0;
  return R.dyn('mind_main', key, (c) => {
    const items = [], his = [];
    for (const e of MAIN) {
      const { pts, g, uf, us } = edgeShape(e, tLt);
      if (g <= 0.001) continue;
      const col = us > 0 ? mixHex(edgeColor(e), SYN[e.tok.cls], smoothstep(0.15, 1, us)) : edgeColor(e);
      // the calligraphic stroke morphs into a steadier code dash as it lands in its row
      const kb = smoothstep(0.35, 0.95, us);
      const curv = us > 0.98 ? 0 : 0.5;
      if (kb < 1) items.push({ col, pts, w: 1.35 * e.w * (1 - kb) + 0.05, b: 'mind_callig', curv });
      if (kb > 0) items.push({ col, pts, w: 2.2 * kb, b: 'mind_bar', curv });
      // a thin lit edge along the noodle (painted two-tone)
      if (us < 0.6) his.push({ col: mixHex(col, '#fff4dc', 0.45), pts: pts.map((p) => [p[0], p[1] - 0.9]), w: 0.45 * (1 - us / 0.6) });
    }
    for (const n of TAILS) {
      const pts = tailPts(n, tLt);
      if (pts) items.push({ col: n.L % 2 ? '#d8452f' : '#e8622c', pts, w: 1.6, b: 'mind_callig', curv: 0.6 });
    }
    items.sort((p, q) => (p.col < q.col ? -1 : 1));
    for (const it of items) c.strokePath(it.pts, it.b, it.col, it.w, it.curv);
    for (const it of his) if (it.w > 0.05) c.strokePath(it.pts, 'mind_contour', it.col, it.w, 0.5);
    // boiling ink contours around resting nodes
    for (const n of NODES) {
      if (tLt < n.tArr + 0.15 || tLt > n.t0) continue;
      const pts = circlePts(n.x, n.y, n.rad * 1.12, 26);
      inkContour(c, pts, c.r() < 0.5 ? '#ffd2a0' : '#b8561e', 0.75, { gap: 0.3, runs: [2, 3], step: 6 });
    }
  }, { seed: 'mind_main' + key });
}
// Draw the noodle layer; rows that are being typed are cropped left of their caret.
export function drawMain(R, lt, L) {
  const nv = netView(lt);
  if (lt < T.type0) { R.layer(L, nv); return; }
  const bands = [];
  let y = 0;
  const half = ED.lh / 2;
  for (let i = 0; i < ED.rows; i++) {
    const cy = lineY(i);
    if (cy - half > y) bands.push({ y0: y, y1: cy - half, x: 0 });
    const tp = typed(i, lt);
    bands.push({ y0: cy - half, y1: cy + half, x: tp.on ? tp.x + 2 : 0 });
    y = cy + half;
  }
  bands.push({ y0: y, y1: 1080, x: 0 });
  for (const b of bands) {
    if (b.x >= 1920 || b.y1 <= b.y0) continue;
    R.layer(L, M.mul(nv, M.translate(b.x, b.y0)), { uv: [b.x / 1920, b.y0 / 1080, 1, b.y1 / 1080], w: 1920 - b.x, h: b.y1 - b.y0 });
  }
}

// Faint lattice (painted wire sprites stretched between nodes). Drawn with R.view = netView.
export function drawWeb(R, lt, A) {
  if (lt < T.edge0) return;
  const U = A.net.web;
  for (const w of WEB) {
    const g = growOf(w, lt);
    if (g <= 0.001) continue;
    const uf = flatOf(w, lt);
    const us = slideOf(w, w.row, lt);
    const tn = Math.min(lt, T.node0);
    let [ax, ay] = nodeNet(w.a, tn), [bx, by] = nodeNet(w.b, tn);
    let alpha = 0.2 * w.alpha;
    let col = [0.35, 0.85, 0.82];
    if (uf > 0 || us > 0) {
      const my = (ay + by) / 2;
      ay = lerp(ay, my, uf); by = lerp(by, my, uf);
      const y = lineY(w.row) + 1;
      ax = lerp(ax, colX(w.c0), us); ay = lerp(ay, y, us);
      bx = lerp(bx, colX(w.c1), us); by = lerp(by, y, us);
      alpha *= 1 + 1.1 * us;
      col = [lerp(0.35, 0.9, us), 0.85, lerp(0.82, 0.72, us)];
    }
    const f = Math.max(flare(w.a, lt), 0.6 * flare(w.b, lt));
    alpha *= 1 + 2.5 * f;
    let u0 = 0;
    if (us >= 1) {
      const tp = typed(w.row, lt);
      if (tp.on) {
        const cx = tp.x + 2;
        if (cx >= bx) continue;
        if (cx > ax) u0 = (cx - ax) / (bx - ax);
      }
    }
    const full = Math.hypot(bx - ax, by - ay);
    if (full * g < 1) continue;
    const ang = Math.atan2(by - ay, bx - ax);
    const m = M.place(ax, ay, full / 1000, ang, 0, 6, 1);
    R.layer(U, M.mul(m, M.translate(u0 * 1000 * g, 0)), {
      uv: [u0 * g, (w.v * 12) / 72, g, (w.v * 12 + 12) / 72], w: 1000 * g * (1 - u0), h: 12,
      opacity: Math.min(1, alpha), tint: col,
    });
  }
}

// Signal pulses + always-flowing motes along the noodles. Drawn in SCREEN space.
export function drawSignals(R, lt, A) {
  if (lt < T.edge0 || lt > T.slide0 + 0.4) return;
  const nv = netView(lt);
  const parts = [];
  const settle = 1 - smoothstep(T.slide0 - 0.4, T.slide0 + 0.2, lt);
  for (const e of MAIN) {
    const g = growOf(e, lt);
    if (g < 0.98) continue;
    const pts = mainPoints(e, lt);
    const at = (q) => {
      q = clamp(q);
      const f = q * (NB - 1), i = Math.min(NB - 2, Math.floor(f)), k = f - i;
      return M.apply(nv, lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k));
    };
    if (flatOf(e, lt) > 0.02) continue;
    // idle flow: two faint motes per edge drifting towards the output
    for (let k = 0; k < 2; k++) {
      const q = (lt * (0.32 + 0.2 * h1(e.id, k, 21)) + h1(e.id, k, 23)) % 1;
      const [x, y] = at(q);
      const warm = e.hue < 0.35;
      parts.push([x, y, 2.4, 0, warm ? 1 : 0.6, warm ? 0.78 : 0.95, warm ? 0.5 : 0.9, 0.5 * settle * Math.sin(Math.PI * q)]);
    }
    for (let w = 0; w < 3; w++) {
      if (!isActive(e.a, w)) continue;
      const t0 = fireTime(e.a, w), dur = T.wLayer * 1.15;
      const s = (lt - t0) / dur;
      if (s < 0 || s > 1.25) continue;
      const fade = s > 1 ? 1 - (s - 1) / 0.25 : 1;
      if (s <= 1) {
        const [x, y] = at(s);
        R.glow(x, y, 6, [1, 0.86, 0.6], 1.1 * fade * (0.8 + 0.2 * w), { ext: 3, shape: [2.6, 0.45, 2.4] });
      }
      for (let k = 1; k <= 12; k++) {
        const q = s - k * 0.032;
        if (q < 0 || q > 1) continue;
        const [x, y] = at(q);
        parts.push([x, y, 2.8, 0, 1, 0.78, 0.45, (1 - k / 13) * 0.75 * fade]);
      }
    }
  }
  R.particles(parts, { kind: 'glow', blend: 'add' });
}

export function drawNodes(R, lt, A, filter = null) {
  const atl = A.net.nodes, halo = A.net.halo;
  for (const n of NODES) {
    if (filter && !filter(n)) continue;
    const st = nodeState(n, lt);
    if (!st || st.r < 0.3) continue;
    const f = flare(n, lt);
    const dep = invLerp(n.t0, n.t1, lt);
    let color = [1, 0.95, 0.82, 0.85 * st.hot + 0.45 * f];
    if (n.tg.kind === 'dot' && dep > 0) color = [...hex(ED.dots[n.tg.k].c), 0.9 * ease.inOutSine(dep)];
    if (n.tg.kind === 'knob' && dep > 0) color = [...hex(C.cream), 0.8 * ease.inOutSine(dep)];
    const hs = (0.55 + 0.9 * f + 0.8 * st.hot) * (1 - 0.7 * smoothstep(0, 1, dep));
    halo.draw(R, n.id % 2, st.x, st.y, st.r * 5.2, n.ph, { blend: 'add', opacity: Math.min(1, 0.55 * hs) });
    R.glow(st.x, st.y, st.r * 1.5, [1, 0.55, 0.22], (0.2 + 1.2 * f + 1.4 * st.hot) * (1 - 0.6 * smoothstep(0, 1, dep)), { ext: 3.2, shape: [1.5, 0.5, 1.8] });
    atl.draw(R, n.spr, st.x, st.y, st.r * 2.4, n.ph * 0.3, { color });
  }
}

// Dust motes drifting in the network's space (secondary life).
const MOTES = (() => {
  const r = rng('mind-motes');
  return Array.from({ length: 420 }, () => ({ x: r(-100, 2020), y: r(-100, 1180), s: r(0.8, 2.4), v: r(4, 16), ph: r(0, TAU), f: r(0.2, 0.7), c: r() }));
})();
export function drawMotes(R, lt, k) {
  if (k <= 0) return;
  const out = [];
  for (const m of MOTES) {
    const x = ((m.x + lt * m.v + 2200) % 2140) - 110, y = m.y + 10 * Math.sin(lt * m.f + m.ph);
    const tw = 0.5 + 0.5 * Math.sin(lt * m.f * 3 + m.ph);
    out.push([x, y, m.s, 0, m.c < 0.5 ? 0.6 : 1, m.c < 0.5 ? 0.9 : 0.75, m.c < 0.5 ? 1 : 0.5, 0.35 * tw * k]);
  }
  R.particles(out, { kind: 'glow', blend: 'add' });
}
