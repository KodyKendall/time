// MIND — shared timeline + geometry (pure data, computed once at import).
//   board space = the die pivot's world (die = [0,1920]x[0,1080]), seen through boardView(lt)
//   net space   = network / editor space (1920x1080 design units), seen through netView(lt)
import { PIVOT, DIE } from '../pivots.js';
import { rng, lerp, clamp, TAU, M, ease, invLerp } from '../../engine/math.js';
import { CODE, CARET_LINE, tokenize } from './code.js';

export const SEG0 = 130;   // global start of the segment
export const DUR = 15;

// ------------------------------------------------------------------------------------------------
// Timeline (local seconds). Beat = 0.625 s.
// ------------------------------------------------------------------------------------------------
export const T = {
  zoom1: 2.5,                 // pull-back from the die ends (chip + board framed)
  volleys: [1.25, 1.875],     // lit cells lift off (die pattern steps k=525, k=527)
  flight: 1.2,                // lift-off -> network slot
  sink0: 1.7, sink1: 3.9,     // the board sinks away below
  edge0: 2.35,                // edges start growing (per edge once both nodes have landed)
  waves: [5.0, 6.25, 7.5],    // signal waves
  wLayer: 0.17,               // wave delay per layer
  flat: 0.12, flatDur: 0.42,  // after wave 3 passes: each noodle flattens in place
  slide0: 8.2, slideDur: 0.52,// ... then slides into its code row (top row first)
  win0: 8.45, win1: 9.35,     // window unfolds (CRT-on: line -> rect)
  node0: 8.35,                // nodes leave for thumbnails / buttons / dots
  type0: 8.75,                // typing starts (multi-caret cascade)
  rowGap: 0.05,
  cps: 50,                    // typed characters per second per caret
  play: 11.25,                // play button click
  dive0: 11.6, dive1: 13.75,  // camera dive into the caret
  collapse: 13.75,            // caret collapses into a point
  pointEnd: 15.0,             // point shrinks to nothing
};

// ------------------------------------------------------------------------------------------------
// Board camera: pull back from the die (identity at lt=0, from rest), then the board sinks away.
// ------------------------------------------------------------------------------------------------
export const ZC = 0.42;   // chip framing zoom
export function boardView(lt) {
  const u1 = ease.inOutSine(invLerp(0, T.zoom1, lt));
  const u2 = ease.inOutCubic(invLerp(T.sink0, T.sink1, lt));
  const z = Math.exp(Math.log(ZC) * u1 + Math.log(0.16 / ZC) * u2);
  const rot = -0.2 * ease.inOutSine(invLerp(0, 3.2, lt));
  const sx = 960 - 30 * u1, sy = 540 + 12 * u1 + 1320 * u2;
  return M.chain(M.translate(sx, sy), M.rotate(rot), M.scale(z), M.translate(-960, -540));
}
// Board brightness (it leaves the light as it sinks).
export function boardLight(lt) {
  return 1 - 0.55 * ease.inOutSine(invLerp(T.sink0 + 0.3, T.sink1, lt));
}

// Network / editor camera: keyframed drift (push in on the thinking network, ease back to frame
// the editor), at rest at both ends; no roll once the editor's picture masks are on screen.
const CAMK = [
  // t,    zoom,  dx,  dy,   roll
  [2.2, 1.0, 0, 0, 0],
  [4.6, 1.024, -22, 8, 0.008],
  [7.2, 1.062, 16, -6, -0.006],
  [8.6, 1.058, 4, 2, 0],
  [9.6, 1.045, -4, 2, 0],
  [11.6, 1.045, 0, 0, 0],
];
function camKey(lt) {
  const K = CAMK;
  if (lt <= K[0][0]) return K[0].slice(1);
  if (lt >= K[K.length - 1][0]) return K[K.length - 1].slice(1);
  let i = 0;
  while (lt > K[i + 1][0]) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
  const u = (lt - k1[0]) / (k2[0] - k1[0]);
  const out = [];
  for (let c = 1; c < 5; c++) {
    // Catmull-Rom (non-uniform times), zero velocity at the ends
    const d1 = i === 0 ? 0 : ((k2[c] - k0[c]) / (k2[0] - k0[0])) * (k2[0] - k1[0]);
    const d2 = i + 2 >= K.length ? 0 : ((k3[c] - k1[c]) / (k3[0] - k1[0])) * (k2[0] - k1[0]);
    const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
    out.push(h00 * k1[c] + h10 * d1 + h01 * k2[c] + h11 * d2);
  }
  return out;
}
export function netView(lt) {
  const [z, dx, dy, roll] = camKey(lt);
  const rot = lt >= 8.6 ? 0 : roll; // picture masks are axis-aligned
  return M.chain(M.translate(960 + dx, 540 + dy), M.rotate(rot), M.scale(z), M.translate(-960, -540));
}

// ------------------------------------------------------------------------------------------------
// Lift-off: every cell lit by the die pattern at a volley lifts off as a node.
// ------------------------------------------------------------------------------------------------
const lr = rng('mind-lift');
export const LIFT = [];
{
  const seen = new Set();
  const maxD = Math.hypot(7.5, 4);
  T.volleys.forEach((vt, v) => {
    for (let j = 0; j < DIE.rows; j++) for (let i = 0; i < DIE.cols; i++) {
      const key = i * 100 + j;
      if (seen.has(key) || !PIVOT.die.lit(i, j, SEG0 + vt)) continue;
      seen.add(key);
      const d = Math.hypot(i - 7.5, j - 4) / maxD;
      LIFT.push({ i, j, v, tl: vt + 0.02 + 0.09 * d + lr(0, 0.025), cx: i * DIE.cell + 60, cy: j * DIE.cell + 60 });
    }
  });
}
export const LIFT_END = Math.max(...LIFT.map((c) => c.tl)) + 0.01;
export const LIFTMAP = new Map(LIFT.map((c) => [c.i * 100 + c.j, c]));

// ------------------------------------------------------------------------------------------------
// Network: 6 layers (columns). Cells are assigned to columns by their die column (left -> left).
// ------------------------------------------------------------------------------------------------
const NL = 6;
const props = [0.12, 0.155, 0.207, 0.207, 0.172, 0.139];
export const COUNTS = props.map((p) => Math.round(p * LIFT.length));
{
  let diff = LIFT.length - COUNTS.reduce((a, b) => a + b, 0);
  let k = 2;
  while (diff !== 0) { COUNTS[k] += Math.sign(diff); diff -= Math.sign(diff); k = (k + 1) % NL; }
}
export const COLX = Array.from({ length: NL }, (_, L) => 960 + (L - 2.5) * 276);
const COLY = [560, 538, 522, 530, 546, 560];
export const NODES = [];
export const LAYERS = [];
{
  const r = rng('mind-net');
  const sorted = LIFT.slice().sort((a, b) => a.i + a.j * 0.001 - (b.i + b.j * 0.001));
  let idx = 0;
  for (let L = 0; L < NL; L++) {
    const chunk = sorted.slice(idx, idx + COUNTS[L]).sort((a, b) => a.j - b.j || a.i - b.i);
    idx += COUNTS[L];
    const n = chunk.length, dy = 60;
    const layer = [];
    chunk.forEach((cell, k) => {
      const node = {
        id: NODES.length, L, k, n, cell,
        x: COLX[L] + r(-8, 8),
        y: COLY[L] + (k - (n - 1) / 2) * dy + r(-5, 5),
        rad: 12.5 + 8 * Math.pow(r(), 1.3),
        spr: r.int(0, 7),
        ph: r(0, TAU),
      };
      node.tArr = cell.tl + T.flight;
      NODES.push(node);
      layer.push(node);
    });
    LAYERS.push(layer);
  }
}

// ------------------------------------------------------------------------------------------------
// Editor layout (editor space = net space).
// ------------------------------------------------------------------------------------------------
export const ED = {
  win: { x0: 100, y0: 76, x1: 1820, y1: 1004 },
  titleH: 42, tabH: 28,
  act: 150, side: 380, split: 1110,      // activity bar | explorer | code | preview
  status: 976,                           // status bar top
  font: 20, cw: 11.0,                    // Consolas 20px advance (re-measured at paint time)
  x0: 448, y0: 176, lh: 32,              // code text left, first row centre, row height
  gutterX: 430,                          // right edge of line numbers
  mini: { x0: 1034, x1: 1090, y0: 160, sy: 3.4, sx: 1.05 },
  thumbs: [],
  track: { x0: 1136, x1: 1794, y: 784 },
  transport: [{ x: 1392, y: 858, r: 17, i: 4 }, { x: 1458, y: 858, r: 25, i: 3 }, { x: 1524, y: 858, r: 17, i: 5 }],
  dots: [{ x: 126, y: 97, c: '#e0553a' }, { x: 150, y: 97, c: '#f2b544' }, { x: 174, y: 97, c: '#3cc7c6' }],
};
for (let k = 0; k < 6; k++) {
  const col = k % 2, row = Math.floor(k / 2);
  ED.thumbs.push({ x: 1136 + col * 340, y: 160 + row * 200, w: 318, h: 179 });
}
ED.rows = CODE.length;
export const lineY = (i) => ED.y0 + i * ED.lh;
export const colX = (c) => ED.x0 + c * ED.cw;
export const trackX = (t) => lerp(ED.track.x0, ED.track.x1, t / 145);

// Tokens: { line, c0, c1, cls }. Keys absorb their ':' so rows read as runs of colour.
export const TOKENS = [];
CODE.forEach((line, li) => {
  const toks = tokenize(line);
  for (let q = 0; q < toks.length; q++) {
    const tk = toks[q];
    const nx = toks[q + 1];
    if (tk.cls === 'key' && nx && nx.t === ':' && nx.c0 === tk.c1) { TOKENS.push({ line: li, c0: tk.c0, c1: nx.c1, cls: 'key' }); q++; continue; }
    TOKENS.push({ line: li, c0: tk.c0, c1: tk.c1, cls: tk.cls });
  }
});
export const ROWS = CODE.map((line, li) => ({ li, len: line.length, toks: TOKENS.filter((t) => t.line === li) }));

// Typing: every non-empty row gets a caret; the cascade runs top -> bottom.
export function rowTiming(li) {
  const len = CODE[li].length;
  const ts = T.type0 + T.rowGap * li;
  return { ts, te: ts + len / T.cps, len };
}
export const CARET = { x: colX(CODE[CARET_LINE].length) + 1, y: lineY(CARET_LINE) };

// ------------------------------------------------------------------------------------------------
// Edges. MAIN = one calligraphic noodle per code token (they straighten into the token's colour
// bar); WEB = the faint full lattice (painted wire sprites) that swings into the rows too.
// ------------------------------------------------------------------------------------------------
export const MAIN = [];
export const WEB = [];
{
  const r = rng('mind-edges');
  const has = new Set();
  const add = (a, b) => {
    const key = a.id * 1000 + b.id;
    if (has.has(key)) return false;
    has.add(key);
    MAIN.push({ a, b, id: MAIN.length, bend: r(-0.25, 0.25), hue: r(), w: r(0.8, 1.3) });
    return true;
  };
  const rel = (n) => (n.n > 1 ? n.k / (n.n - 1) : 0.5);
  for (let L = 0; L < NL - 1; L++) {
    const A = LAYERS[L], B = LAYERS[L + 1];
    for (const a of A) {
      const best = B.slice().sort((p, q) => Math.abs(rel(p) - rel(a)) - Math.abs(rel(q) - rel(a)));
      add(a, best[0]);
    }
    for (const b of B) if (!MAIN.some((e) => e.b === b)) {
      const best = A.slice().sort((p, q) => Math.abs(rel(p) - rel(b)) - Math.abs(rel(q) - rel(b)));
      add(best[0], b);
    }
  }
  let guard = 0;
  while (MAIN.length < TOKENS.length && guard++ < 20000) {
    const L = Math.min(NL - 2, Math.floor(r(0, NL - 1)));
    const a = r.pick(LAYERS[L]);
    const B = LAYERS[L + 1];
    let b;
    if (r() < 0.8) {
      const target = clamp(rel(a) + r.gauss(0, 0.22));
      b = B.slice().sort((p, q) => Math.abs(rel(p) - target) - Math.abs(rel(q) - target))[0];
    } else b = r.pick(B);
    add(a, b);
  }
  MAIN.length = Math.min(MAIN.length, TOKENS.length);
  for (let L = 0; L < NL - 1; L++) for (const a of LAYERS[L]) for (const b of LAYERS[L + 1]) {
    WEB.push({ a, b, id: WEB.length, v: r.int(0, 5), alpha: r(0.55, 1) });
  }
}
// MAIN edges -> tokens: by vertical order into rows, by horizontal order within a row.
{
  const mid = (e) => [(e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2];
  const edges = MAIN.slice().sort((p, q) => mid(p)[1] - mid(q)[1]);
  let k = 0;
  for (const row of ROWS) {
    if (!row.toks.length) continue;
    const chunk = edges.slice(k, k + row.toks.length).sort((p, q) => mid(p)[0] - mid(q)[0]);
    k += row.toks.length;
    chunk.forEach((e, q) => { e.tok = row.toks[q]; });
  }
}
// WEB lines -> rows (by vertical rank) and a span inside the row's text.
{
  const r = rng('mind-web-rows');
  const rows = ROWS.filter((rw) => rw.len > 0);
  const byY = WEB.slice().sort((p, q) => (p.a.y + p.b.y) - (q.a.y + q.b.y));
  byY.forEach((w, q) => {
    const row = rows[Math.min(rows.length - 1, Math.floor((q / byY.length) * rows.length))];
    const a = r(0, 0.7), b = Math.min(1, a + r(0.15, 0.5));
    const first = CODE[row.li].search(/\S/);
    w.row = row.li;
    w.c0 = first + a * (row.len - first);
    w.c1 = first + b * (row.len - first);
  });
}

// ------------------------------------------------------------------------------------------------
// Nodes -> editor targets. Layer L's nodes merge into thumbnail L, except a few that become the
// title-bar dots, the transport buttons and the playhead.
// ------------------------------------------------------------------------------------------------
{
  const top = (L) => LAYERS[L][0], bot = (L, o = 0) => LAYERS[L][LAYERS[L].length - 1 - o];
  const special = [
    [top(0), { kind: 'dot', k: 0 }], [top(1), { kind: 'dot', k: 1 }], [top(2), { kind: 'dot', k: 2 }],
    [bot(3), { kind: 'btn', k: 0 }], [bot(4), { kind: 'btn', k: 1 }], [bot(5), { kind: 'btn', k: 2 }],
    [bot(5, 1), { kind: 'knob' }],
  ];
  const r = rng('mind-targets');
  for (const [n, tg] of special) n.tg = tg;
  for (const n of NODES) {
    if (!n.tg) n.tg = { kind: 'thumb', k: n.L };
    n.t0 = T.node0 + 0.12 * n.L / 5 + r(0, 0.22);
    n.t1 = n.t0 + (n.tg.kind === 'thumb' ? 0.74 : 0.82);
  }
  ED.thumbs.forEach((th, k) => {
    const ns = NODES.filter((n) => n.tg.kind === 'thumb' && n.tg.k === k);
    th.tOpen = Math.max(...ns.map((n) => n.t1));
    th.nodes = ns;
  });
}
export const KNOB_T = 130; // the preview is parked at the start of this segment until play
export function targetOf(n) {
  const tg = n.tg;
  if (tg.kind === 'thumb') {
    const th = ED.thumbs[tg.k];
    const q = th.nodes.indexOf(n), m = th.nodes.length;
    const a = (q / m) * TAU + tg.k;
    return { x: th.x + th.w / 2 + Math.cos(a) * 16, y: th.y + th.h / 2 + Math.sin(a) * 10, s: 0.55 };
  }
  if (tg.kind === 'dot') return { x: ED.dots[tg.k].x, y: ED.dots[tg.k].y, s: 7 };
  if (tg.kind === 'btn') { const b = ED.transport[tg.k]; return { x: b.x, y: b.y, s: 0 }; }
  return { x: trackX(KNOB_T), y: ED.track.y, s: 7.5 };
}
