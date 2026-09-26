// MIND · editor — a painted code editor assembles around the straightened lattice (panel 23),
// types this film's own SEGMENTS table, plays, and is dived through into its blinking caret.
import { C } from '../lib/palette.js';
import { PIVOT, gearOutline } from '../pivots.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, circlePts, atlas } from '../lib/kit.js';
import { ease, invLerp, noise1, h1 } from '../../engine/math.js';
import { CODE, CARET_LINE, richLine, tokenize, SYN } from './code.js';
import { T, ED, NODES, CARET, KNOB_T, netView, lineY, colX, rowTiming, trackX } from './layout.js';
import { nodeNet, typed } from './network.js';
import { paintPanel, wobRect, inkContour, strokeFill, discFill, dab } from './paintkit.js';

const W = ED.win;
const FONT = "500 20px Consolas, 'Cascadia Mono', 'Courier New', monospace";
const UIFONT = "400 14px 'Segoe UI', Arial, sans-serif";
const PAD = 8;
export const THUMB_PIVOTS = ['star', 'cell', 'eye', 'fields', 'gear', 'die'];
const SEGS = [['cosmos', 0, 30, '#6b4a8a'], ['earth', 30, 52.5, '#d8452f'], ['sea', 52.5, 70, '#1f8a8a'], ['land', 70, 85, '#6aa36b'], ['ancestors', 85, 97.5, '#c98f3a'], ['hunt', 97.5, 107.5, '#2a5d8a'], ['city', 107.5, 117.5, '#b5543c'], ['machine', 117.5, 130, '#f2b544'], ['mind', 130, 145, '#a33f6f']];
const TREE = [
  [0, 'TIME', 'open'], [1, 'audio', 'dir'], [1, 'docs', 'dir'], [1, 'out', 'dir'], [1, 'tools', 'dir'], [1, 'web', 'open'],
  [2, 'src', 'open'], [3, 'engine', 'open'], [4, 'compositor.js', 'js'], [4, 'engine.js', 'js'], [4, 'film.js', 'js'], [4, 'math.js', 'js'],
  [4, 'paint.js', 'js'], [4, 'post.js', 'js'], [3, 'scenes', 'open'], [4, 'lib', 'dir'], [4, 'mind', 'open'], [5, 'board.js', 'js'],
  [5, 'editor.js', 'js'], [5, 'index.js', 'js'], [5, 'network.js', 'js'], [4, 'cosmos.js', 'js'], [4, 'pivots.js', 'js'], [3, 'film.js', 'js', 1],
  [3, 'main.js', 'js'], [2, 'render.html', 'html'], [1, 'package.json', 'json'],
];
const TREE_Y0 = 166, TREE_DY = 24;
const treeX = (d) => ED.act + 16 + d * 12;
const TABS = [['film.js', ED.side, ED.side + 132, 1], ['engine.js', ED.side + 132, ED.side + 272, 0], ['mind/index.js', ED.side + 272, ED.side + 440, 0]];
const TAB_Y0 = W.y0 + ED.titleH, TAB_Y1 = TAB_Y0 + ED.tabH;
const STATUS_Y = ED.status;
const READOUT = { x: 1576, y: 858 };

// ------------------------------------------------------------------------------------------------
// Painting
// ------------------------------------------------------------------------------------------------
function icon(c, kind, x, y, col, s = 1) {
  const L = (pts, w = 1.1) => c.strokePath(pts.map(([a, b]) => [x + a * s, y + b * s]), 'mind_ui', col, w * s, 0.2);
  if (kind === 'files') { L([[-7, -10], [3, -10], [8, -5], [8, 10], [-7, 10], [-7, -10]]); L([[-11, -6], [-11, 14], [4, 14]]); }
  else if (kind === 'search') { L(circlePts(-2, -2, 7, 16).concat([[5, -2]]), 1.2); L([[3, 3], [10, 10]], 1.6); }
  else if (kind === 'branch') { dab(c, x - 5 * s, y - 9 * s, 2.6 * s, 2.6 * s, col); dab(c, x - 5 * s, y + 9 * s, 2.6 * s, 2.6 * s, col); dab(c, x + 6 * s, y - 4 * s, 2.6 * s, 2.6 * s, col); L([[-5, -9], [-5, 9]]); L([[6, -4], [6, 0], [-5, 5]]); }
  else if (kind === 'blocks') { for (const [a, b] of [[-9, -1], [1, -1], [-9, 9]]) L([[a, b], [a + 8, b], [a + 8, b + 8], [a, b + 8], [a, b]]); L([[4, -12], [11, -5], [4, 2], [-3, -5], [4, -12]]); }
  else if (kind === 'gear') { const g = gearOutline(x, y, 8 * s, 8, 0.3, 6); c.strokePath(g.concat([g[0]]), 'mind_ui', col, 1.0 * s, 0.2); dab(c, x, y, 2.5 * s, 2.5 * s, col); }
  else if (kind === 'user') { L(circlePts(0, -4, 5, 14).concat([[5, -4]])); L([[-9, 11], [-6, 4], [0, 2], [6, 4], [9, 11]]); }
  else if (kind === 'dir' || kind === 'open') {
    L(kind === 'open' ? [[-14, -2], [-10, 2], [-6, -2]] : [[-12, -4], [-8, 0], [-12, 4]], 1.2);
    const f = wobRect(c.r, x, y - 5 * s, x + 14 * s, y + 6 * s, 1.5, 0.3);
    c.washPoly(f, kind === 'open' ? '#d9a44a' : '#b8813a', 255);
    c.washPoly(wobRect(c.r, x, y - 7 * s, x + 6 * s, y - 4 * s, 1, 0.2), kind === 'open' ? '#d9a44a' : '#b8813a', 255);
  } else {
    const cc = kind === 'js' ? '#e5c24a' : kind === 'html' ? '#e8622c' : '#c9b06a';
    c.washPoly(wobRect(c.r, x, y - 6 * s, x + 12 * s, y + 6 * s, 2, 0.3), cc, 255);
    c.strokePath([[x + 3 * s, y + 2 * s], [x + 9 * s, y + 2 * s]], 'mind_ui', '#3a2a08', 0.9 * s, 0);
  }
}

export function paintEditor(P) {
  {
    const cv = document.createElement('canvas').getContext('2d');
    cv.font = FONT;
    ED.cw = cv.measureText('MMMMMMMMMM').width / 10;
    CARET.x = colX(CODE[CARET_LINE].length) + 1;
  }
  const M0 = 30;
  const ww = W.x1 - W.x0 + 2 * M0, wh = W.y1 - W.y0 + 2 * M0;
  const win = P.layer('window', { w: ww, h: wh, scale: 1.5 }, (c) => {
    const r = c.r, p = c.p;
    p.push();
    p.translate(M0 - W.x0, M0 - W.y0); // paint in editor space
    const cool = ['#101a30', '#0c1628', '#131d36', '#0e1a2e', '#121a33'];
    const body = wobRect(r, W.x0, W.y0, W.x1, W.y1, 16, 1.4);
    c.washPoly(body, '#0c1526', 255);
    c.fillPoly(body, C.navy2, { opacity: 55, bleed: 0.015, texture: 0.85, border: 0.3 });
    // title bar
    paintPanel(c, W.x0 + 2, W.y0 + 2, W.x1 - 2, W.y0 + ED.titleH, { base: '#17243b', glaze: '#1e2d48', strokes: ['#1d2c46', '#152036', '#232f4e', '#1a2440', '#26324f'], rad: 14, spacing: 5, len: [50, 180], sw: 0.7, hi: '#7d97bd' });
    // activity bar + explorer
    paintPanel(c, W.x0 + 2, TAB_Y0, ED.act, STATUS_Y, { base: '#0a1221', strokes: ['#0d1629', '#09101e', '#101a30'], dir: 'v', rad: 2, spacing: 5, len: [80, 260], sw: 0.7 });
    paintPanel(c, ED.act, TAB_Y0, ED.side, STATUS_Y, { base: '#0e182a', glaze: '#121d33', strokes: ['#111c31', '#0c1627', '#15203a', '#101b2f'], dir: 'v', rad: 2, spacing: 6, len: [90, 300], sw: 0.8 });
    paintPanel(c, ED.act + 2, TAB_Y0 + 1, ED.side - 2, TAB_Y1, { base: '#111c30', strokes: ['#15213a', '#0f192c'], rad: 2, spacing: 5, len: [40, 120], sw: 0.6 });
    // tab strip + tabs
    paintPanel(c, ED.side, TAB_Y0, ED.split, TAB_Y1, { base: '#0d1729', strokes: ['#101b30', '#0b1424'], rad: 1, spacing: 5, len: [40, 140], sw: 0.6 });
    for (const [, x0, x1, act] of TABS) {
      paintPanel(c, x0 + 1, TAB_Y0 + 3, x1 - 1, TAB_Y1 + (act ? 2 : 0), { base: act ? '#0b1322' : '#121d31', strokes: act ? ['#0e1729', '#0a1220'] : ['#16223a', '#101a2d'], rad: 5, spacing: 5, len: [30, 100], sw: 0.6, contour: '#26375a', cw: 0.6 });
      if (act) c.strokePath([[x0 + 6, TAB_Y0 + 4], [x1 - 6, TAB_Y0 + 4]], 'mind_contour', C.amber, 1.3, 0);
      icon(c, 'js', x0 + 12, (TAB_Y0 + TAB_Y1) / 2 + 1, '#000', 0.85);
      c.strokePath([[x1 - 18, TAB_Y0 + 10], [x1 - 11, TAB_Y0 + 17]], 'mind_ui', act ? '#9aa6bd' : '#56647e', 0.9, 0);
      c.strokePath([[x1 - 11, TAB_Y0 + 10], [x1 - 18, TAB_Y0 + 17]], 'mind_ui', act ? '#9aa6bd' : '#56647e', 0.9, 0);
    }
    // code pane
    paintPanel(c, ED.side, TAB_Y1, ED.split, STATUS_Y, { base: '#0a1221', glaze: '#0f1a30', strokes: cool, spacing: 6, len: [70, 260], sw: 0.85, rad: 1 });
    c.fillPoly(wobRect(r, ED.side + 1, TAB_Y1 + 1, ED.gutterX + 8, STATUS_Y - 1, 1, 0.6), '#070d19', { opacity: 55, bleed: 0.01, texture: 0.7, border: 0.3 });
    // indent guides
    for (const [c0, rows] of [[2, [4, 12]], [2, [16, 19]], [4, [17, 18]]]) {
      const x = colX(c0) + 2;
      c.strokePath([[x, lineY(rows[0]) - 14], [x + r(-0.6, 0.6), lineY(rows[1]) + 14]], 'wire', '#1d2a44', 0.7, 0);
    }
    // minimap + scrollbar
    const mm = ED.mini;
    c.fillPoly(wobRect(r, mm.x0 - 6, TAB_Y1 + 6, mm.x1 + 6, STATUS_Y - 8, 3, 0.5), '#070c17', { opacity: 110, bleed: 0.01, texture: 0.6, border: 0.3 });
    c.fillPoly(wobRect(r, mm.x0 - 4, mm.y0 - 6, mm.x1 + 4, mm.y0 + ED.rows * mm.sy + 8, 3, 0.4), '#16223c', { opacity: 90, bleed: 0.01, texture: 0.6, border: 0.3 });
    const sb = wobRect(r, 1096, TAB_Y1 + 8, 1106, STATUS_Y - 10, 4, 0.4);
    c.fillPoly(sb, '#0b1220', { opacity: 140, bleed: 0.01, texture: 0.5, border: 0.3 });
    const th = wobRect(r, 1097, TAB_Y1 + 14, 1105, TAB_Y1 + 300, 4, 0.4);
    c.washPoly(th, '#23324f', 255);
    c.strokePath([[1099, TAB_Y1 + 20], [1099, TAB_Y1 + 290]], 'mind_contour', '#3b5078', 0.7, 0);
    // preview pane
    paintPanel(c, ED.split, TAB_Y0, W.x1 - 2, STATUS_Y, { base: '#080e1a', glaze: '#0c1428', strokes: ['#0b1224', '#070c18', '#0e1630', '#0a1120'], spacing: 6, len: [80, 300], sw: 0.85, rad: 1 });
    paintPanel(c, ED.split + 2, TAB_Y0 + 1, W.x1 - 3, TAB_Y1, { base: '#0f192c', strokes: ['#131f36', '#0d1628'], rad: 1, spacing: 5, len: [40, 120], sw: 0.6 });
    for (const t of ED.thumbs) {
      const well = wobRect(r, t.x - 5, t.y - 5, t.x + t.w + 5, t.y + t.h + 5, 3, 0.6);
      c.washPoly(well, '#03060c', 255);
      c.strokePath([[t.x - 4, t.y + t.h + 4], [t.x + t.w + 4, t.y + t.h + 4], [t.x + t.w + 4, t.y - 4]], 'mind_contour', '#1d2a44', 0.9, 0);
    }
    // timeline: one painted bar per segment of the film + ticks
    const tk = ED.track;
    for (const [, a, b, col] of SEGS) {
      const x0 = trackX(a) + 1.5, x1 = trackX(b) - 1.5;
      const bar = wobRect(r, x0, tk.y - 10, x1, tk.y + 10, 3, 0.5);
      c.washPoly(bar, mixHex(col, '#0a1020', 0.35), 255);
      c.fillPoly(bar, col, { opacity: 90, bleed: 0.02, texture: 0.8, border: 0.4 });
      strokeFill(c, x0 + 1, tk.y - 9, x1 - 1, tk.y + 9, { brushName: 'mind_dry', colors: [mixHex(col, '#ffffff', 0.2), mixHex(col, '#000000', 0.25), col], weight: 0.45, spacing: 3.5, len: [20, 70] });
      c.strokePath([[x0 + 2, tk.y - 9], [x1 - 2, tk.y - 9]], 'mind_ui', mixHex(col, '#ffffff', 0.45), 0.6, 0);
    }
    for (let s = 0; s <= 145; s += 2.5) {
      const x = trackX(s), big = s % 10 === 0;
      c.strokePath([[x, tk.y + 15], [x + r(-0.3, 0.3), tk.y + 15 + (big ? 9 : 4)]], 'wire', big ? '#5a6d92' : '#34425f', 0.7, 0);
    }
    // status bar
    paintPanel(c, W.x0 + 2, STATUS_Y, W.x1 - 2, W.y1 - 2, { base: '#0f4550', glaze: '#135562', strokes: ['#125663', '#0c3c46', '#16606a', '#0f4a54'], rad: 12, spacing: 5, len: [60, 220], sw: 0.7 });
    // activity icons
    ['files', 'search', 'branch', 'blocks'].forEach((k, i) => icon(c, k, (W.x0 + ED.act) / 2, TAB_Y0 + 36 + i * 50, i === 0 ? '#e9dcc0' : '#6d7c99'));
    c.strokePath([[W.x0 + 4, TAB_Y0 + 20], [W.x0 + 4, TAB_Y0 + 52]], 'mind_contour', C.amber, 1.4, 0);
    icon(c, 'user', (W.x0 + ED.act) / 2, STATUS_Y - 86, '#6d7c99');
    icon(c, 'gear', (W.x0 + ED.act) / 2, STATUS_Y - 38, '#6d7c99');
    // explorer tree: guides, icons, selection
    TREE.forEach(([d, , kind, sel], i) => {
      const y = TREE_Y0 + i * TREE_DY;
      if (sel) paintPanel(c, ED.act + 3, y - 11, ED.side - 3, y + 11, { base: '#1a2a47', strokes: ['#1f3152', '#172642'], rad: 3, spacing: 4, len: [40, 120], sw: 0.6 });
      icon(c, kind, treeX(d) + (kind === 'dir' || kind === 'open' ? 0 : 2), y + 1, '#8d9ab5', 0.9);
    });
    for (const [d, i0, i1] of [[1, 1, 26], [2, 6, 25], [3, 7, 24], [4, 8, 13], [4, 15, 22], [5, 17, 20]]) {
      const x = treeX(d) - 7;
      c.strokePath([[x, TREE_Y0 + i0 * TREE_DY - 10], [x, TREE_Y0 + i1 * TREE_DY + 8]], 'wire', '#1f2c46', 0.6, 0);
    }
    // dividers + border (hand-inked, lost and found)
    const vline = (x, y0, y1, col, w) => inkContour(c, [[x, y0], [x + r(-0.8, 0.8), (y0 + y1) / 2], [x, y1]], col, w, { closed: false, gap: 0.1 });
    vline(ED.act, TAB_Y0, STATUS_Y, '#1c2842', 1.0);
    vline(ED.side, TAB_Y0, STATUS_Y, '#26354f', 1.2);
    vline(ED.split, TAB_Y0, STATUS_Y, '#2c3d5c', 1.3);
    inkContour(c, [[W.x0 + 8, TAB_Y0], [W.x1 - 8, TAB_Y0]], '#26354f', 1.1, { closed: false, gap: 0.08 });
    inkContour(c, [[W.x0 + 8, STATUS_Y], [W.x1 - 8, STATUS_Y]], '#0a2a30', 1.2, { closed: false, gap: 0.05 });
    inkContour(c, body, '#3a4f72', 2.0, { gap: 0.1, runs: [5, 8] });
    c.strokePath([[W.x0 + 24, W.y0 + 2.5], [W.x1 - 24, W.y0 + 2.5]], 'mind_contour', '#8aa2c8', 0.9, 0);
    p.pop();
  });

  // code text (one texture per row, crisp even when magnified during the dive)
  const rows = CODE.map((line) => (line.length ? P.text([richLine(line)], { font: FONT, pad: PAD, scale: 3 }) : null));
  const nums = CODE.map((_, i) => P.text([String(i + 1)], { font: "400 16px Consolas, monospace", color: '#46597a', pad: PAD, align: 'right', maxW: 22, scale: 2 }));
  const ui = (s, col = '#a8b3c8', font = UIFONT, o = {}) => P.text([s], { font, color: col, pad: 4, scale: 2, ...o });
  const txt = {
    title: ui('film.js — TIME', '#8d95ad', "500 15px 'Segoe UI', Arial, sans-serif"),
    explorer: ui('EXPLORER', '#7d8aa6', "600 12px 'Segoe UI', Arial, sans-serif", { letterSpacing: 1.5 }),
    preview: ui('PREVIEW   ·   1920 × 1080   ·   30 fps', '#7d8aa6', "600 12px 'Segoe UI', Arial, sans-serif", { letterSpacing: 1 }),
    statusL: ui('⎇ main    ✓ 0   ⚠ 0', '#cfe6e0', "500 13px 'Segoe UI', Arial, sans-serif"),
    statusR: ui('Ln 13, Col 49     Spaces: 2     UTF-8     JavaScript     96 BPM', '#cfe6e0', "500 13px 'Segoe UI', Arial, sans-serif"),
    tabs: TABS.map(([s, , , act]) => ui(s, act ? '#e6dcc6' : '#7d8aa6', "500 13px 'Segoe UI', Arial, sans-serif")),
    tree: TREE.map(([d, s, kind, sel]) => ui(s, sel ? '#f3e6c8' : kind === 'js' || kind === 'html' || kind === 'json' ? '#a8b3c8' : '#c8d0de', "400 13.5px 'Segoe UI', Arial, sans-serif")),
    ticks: ['0:00', '1:00', '2:00'].map((s) => ui(s, '#5a6d92', "500 11px Consolas, monospace")),
  };
  const glyphFont = "500 17px Consolas, monospace";
  const glyphs = P.text(['0123456789:./ '], { font: glyphFont, color: '#c8d0de', pad: 4, scale: 2 });
  {
    const cv = document.createElement('canvas').getContext('2d');
    cv.font = glyphFont;
    glyphs.cw = cv.measureText('0000000000').width / 10;
  }
  // minimap (a tiny painted echo of the code), revealed row by row as it is typed
  const mm = ED.mini;
  const mini = P.layer('minimap', { w: mm.x1 - mm.x0 + 8, h: ED.rows * mm.sy + 8, scale: 3 }, (c) => {
    CODE.forEach((line, li) => tokenize(line).forEach((tk) => {
      const y = 4 + li * mm.sy + mm.sy / 2;
      c.strokePath([[4 + tk.c0 * mm.sx, y], [4 + tk.c1 * mm.sx, y + c.r(-0.2, 0.2)]], 'mind_ui', SYN[tk.cls], 1.7, 0);
    }));
  });
  // transport buttons: prev, play, next (grown from nodes)
  const btns = atlas(P, 'mind_btns', 3, 120, (c, cx, cy, i) => {
    const play = i === 1;
    const disc = circlePts(cx, cy, 46, 64);
    c.washPoly(disc, play ? '#0f2a33' : '#111c30', 255);
    c.fillPoly(disc, play ? '#15424a' : '#18253d', { opacity: 90, bleed: 0.01, texture: 0.6, border: 0.4 });
    discFill(c, cx, cy, 44, { brushName: 'mind_dry', colors: play ? ['#1a4f58', '#0f3038'] : ['#1c2a44', '#121c30'], weight: 0.5, spacing: 5, len: [20, 60] });
    inkContour(c, circlePts(cx, cy, 45, 64), play ? C.cyan : '#3a4f72', play ? 2.4 : 1.8, { gap: 0.1, runs: [2, 3] });
    const ic = play ? C.cyan : '#c8d0de';
    if (play) {
      const tri = [[cx - 12, cy - 19], [cx + 21, cy], [cx - 12, cy + 19]];
      c.washPoly(tri, ic, 255);
      c.fillPoly(tri, '#bff5ef', { opacity: 60, bleed: 0.01, texture: 0.5, border: 0.4 });
      inkContour(c, tri, '#e6fffb', 1.0, { gap: 0.15, runs: [2, 3] });
    } else {
      const s = i === 0 ? -1 : 1;
      const tri = [[cx - 10 * s, cy - 15], [cx + 12 * s, cy], [cx - 10 * s, cy + 15]];
      c.washPoly(tri, ic, 255);
      c.washPoly(wobRect(c.r, cx + (s > 0 ? 13 : -18), cy - 15, cx + (s > 0 ? 18 : -13), cy + 15, 1, 0.3), ic, 255);
    }
  }, { cols: 3, scale: 2 });
  // thumbnail frame (cream ink rectangle) — stretched to each thumbnail
  const frame = P.layer('thumbFrame', { w: 338, h: 199, scale: 1.5 }, (c) => {
    const x0 = 10, y0 = 10, x1 = 328, y1 = 189;
    inkContour(c, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], '#e7cf98', 1.4, { gap: 0.08, runs: [4, 6] });
    for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]]) {
      c.strokePath([[x + dx * 16, y], [x, y], [x, y + dy * 16]], 'mind_contour', C.gold, 2.2, 0);
    }
  });
  // current-line band: brushed lighter navy
  const band = P.layer('lineBand', { w: ED.split - ED.gutterX, h: ED.lh, scale: 1.5 }, (c) => {
    const w = ED.split - ED.gutterX - 12;
    c.washPoly(wobRect(c.r, 0, 2, w, ED.lh - 2, 2, 0.4), '#152139', 255);
    strokeFill(c, 0, 2, w, ED.lh - 2, { brushName: 'mind_comb', colors: ['#1b2946', '#16233c', '#203052'], weight: 0.6, spacing: 4, len: [60, 200] });
    c.strokePath([[2, 2], [w - 2, 2.5]], 'mind_ui', '#2a3c62', 0.7, 0);
    c.strokePath([[2, ED.lh - 2], [w - 2, ED.lh - 2.5]], 'mind_ui', '#2a3c62', 0.7, 0);
  });
  // playhead (inked needle)
  const needle = P.layer('playhead', { w: 24, h: 60, scale: 2 }, (c) => {
    c.strokePath([[12, 10], [12.3, 58]], 'mind_contour', C.cream, 1.3, 0);
  });
  return { win, winOrigin: [W.x0 - M0, W.y0 - M0], winSize: [ww, wh], rows, nums, txt, glyphs, mini, btns, frame, band, needle };
}

// ------------------------------------------------------------------------------------------------
// Pivot thumbnails. R.fill (used by pivots for their background) ignores masks and view, and
// particles ignore masks: build the pivot's render context here with a masked, view-mapped fill
// and particles culled to the pivot frame.
// ------------------------------------------------------------------------------------------------
function drawPivotIn(R, pivot, view, mask) {
  const eng = R.engine;
  const oa = eng.ensure(pivot);
  const R2 = eng.renderCtx(R.comp.cur, view, 0, R.t, R.shot, oa, pivot, R.frameT, [mask]);
  R2.fill = (c, o = {}) => R2.rect(-4, -4, 1928, 1088, c, o);
  const parts = R2.particles;
  R2.particles = (list, o = {}) => parts(list.filter((q) => q[0] > 2 && q[0] < 1918 && q[1] > 2 && q[1] < 1078), o);
  pivot.draw(R2, 0, oa);
}

// ------------------------------------------------------------------------------------------------
// Dive: every piece of the editor streams outward past the camera; the caret stays centred.
// ------------------------------------------------------------------------------------------------
export function diveE(lt) { return invLerp(T.dive0, T.dive1, lt); }
export function diveZoom(lt) {
  const e = diveE(lt);
  return 1 / (1 - 0.985 * Math.pow(e, 2.4));
}
function caretScreen0() { return M.apply(netView(T.dive0), CARET.x, CARET.y); }
export function diveView(lt) {
  const nv = netView(lt);
  if (lt <= T.dive0) return nv;
  const q0 = caretScreen0();
  const k = ease.inOutCubic(invLerp(T.dive0, T.dive0 + 1.5, lt));
  const q = [lerp(q0[0], 960, k), lerp(q0[1], 540, k)];
  const s = diveZoom(lt);
  return M.chain(M.translate(q[0], q[1]), M.scale(s), M.translate(-q0[0], -q0[1]), nv);
}
function piece(lt, cx, cy, seed, rotAmt = 1) {
  const e = diveE(lt);
  if (e <= 0) return M.id();
  const dx = cx - CARET.x, dy = cy - CARET.y, d = Math.hypot(dx, dy) || 1;
  const push = 150 * Math.pow(e, 1.6) * (0.7 + 0.6 * h1(seed, 1, 9)) + 4 * e;
  const ux = dx / d, uy = (dy / d) * 1.15;
  const rot = rotAmt * (h1(seed, 2, 9) - 0.5) * 0.35 * Math.pow(e, 1.5);
  return M.chain(M.translate(cx + ux * push, cy + uy * push), M.rotate(rot), M.translate(-cx, -cy));
}
const TILES = (() => {
  const r = rng('mind-tiles');
  const out = [];
  const ys = [W.y0, TAB_Y0, TAB_Y1];
  for (let i = 0; i < CODE.length; i++) ys.push(lineY(i) - ED.lh / 2);
  ys.push(lineY(CODE.length - 1) + ED.lh / 2, 880, STATUS_Y, W.y1);
  const Y = [...new Set(ys.map((y) => Math.round(y * 100) / 100))].sort((a, b) => a - b);
  for (let k = 0; k < Y.length - 1; k++) {
    const y0 = Y[k], y1 = Y[k + 1];
    if (y1 - y0 < 1) continue;
    const xs = [W.x0, ED.act, ED.side, ED.split, 1465, W.x1];
    for (let q = 0; q < r.int(1, 2); q++) xs.push(r(ED.side + 60, ED.split - 60));
    if (r() < 0.5) xs.push(r(ED.act + 40, ED.side - 40));
    xs.push(r(ED.split + 60, W.x1 - 60));
    if (y0 < CARET.y && y1 > CARET.y) xs.push(CARET.x);
    xs.sort((a, b) => a - b);
    for (let q = 0; q < xs.length - 1; q++) if (xs[q + 1] - xs[q] > 1) out.push({ x0: xs[q], y0, x1: xs[q + 1], y1, id: out.length });
  }
  return out;
})();

// ------------------------------------------------------------------------------------------------
// Drawing
// ------------------------------------------------------------------------------------------------
function unfold(lt) {
  // CRT-on: a bright line that widens, then opens vertically into the window
  const a = ease.outCubic(invLerp(T.win0, T.win0 + 0.36, lt));
  const b = ease.inOutCubic(invLerp(T.win0 + 0.26, T.win1, lt));
  return { a, b, sx: lerp(0.015, 1, a), sy: lerp(5 / (W.y1 - W.y0), 1, b) };
}
const WCX = (W.x0 + W.x1) / 2, WCY = (W.y0 + W.y1) / 2;

export function drawEditor(R, lt, A, E) {
  if (lt < T.win0) return;
  const diving = lt > T.dive0;
  const V = diveView(lt);
  const place = (cx, cy, seed, rotAmt = 1) => (diving ? M.mul(V, piece(lt, cx, cy, seed, rotAmt)) : V);
  const { a, b, sx, sy } = unfold(lt);
  const U = M.chain(M.translate(WCX, WCY), M.scale(sx, sy), M.translate(-WCX, -WCY));
  E.place = place;
  E.U = U;
  const ed = A.ed;
  // ---- window body
  if (!diving) {
    R.layer(ed.win, M.chain(V, U, M.translate(ed.winOrigin[0], ed.winOrigin[1])));
  } else {
    const [ox, oy] = ed.winOrigin, [ww, wh] = ed.winSize;
    for (const tl of TILES) {
      const m = place((tl.x0 + tl.x1) / 2, (tl.y0 + tl.y1) / 2, tl.id + 100);
      R.layer(ed.win, M.mul(m, M.translate(tl.x0, tl.y0)), { uv: [(tl.x0 - ox) / ww, (tl.y0 - oy) / wh, (tl.x1 - ox) / ww, (tl.y1 - oy) / wh], w: tl.x1 - tl.x0, h: tl.y1 - tl.y0 });
    }
  }
  // power-on beam (light)
  if (b < 1 && a > 0) {
    const beam = Math.sin(Math.PI * Math.min(1, a * 0.7 + b * 0.6)) * (1 - b);
    const [cx, cy] = M.apply(V, WCX, WCY);
    R.glow(cx, cy, 40, [0.55, 0.85, 1], 0.9 * beam, { ext: 3, sx: 21 * sx, sy: 0.35 + 6 * b, shape: [2, 0.4, 2] });
  }
  // ---- UI text (painted surface, crisp letters)
  const text = (L, x, y, seed, align = 'l', o = {}) => {
    const ox = align === 'c' ? L.w / 2 : align === 'r' ? L.w - 4 : 4;
    const cx = x - ox + L.w / 2;
    R.layer(L, M.chain(place(cx, y, seed), U, M.translate(x - ox, y - L.h / 2)), o);
  };
  text(ed.txt.title, WCX, W.y0 + ED.titleH / 2, 1, 'c');
  text(ed.txt.explorer, ED.act + 14, (TAB_Y0 + TAB_Y1) / 2, 2);
  text(ed.txt.preview, ED.split + 20, (TAB_Y0 + TAB_Y1) / 2, 3);
  text(ed.txt.statusL, W.x0 + 64, (STATUS_Y + W.y1) / 2, 4);
  text(ed.txt.statusR, W.x1 - 20, (STATUS_Y + W.y1) / 2, 5, 'r');
  TABS.forEach(([, x0], i) => text(ed.txt.tabs[i], x0 + 30, (TAB_Y0 + TAB_Y1) / 2 + 1, 10 + i));
  TREE.forEach(([d, , kind], i) => text(ed.txt.tree[i], treeX(d) + (kind === 'dir' || kind === 'open' ? 19 : 17), TREE_Y0 + i * TREE_DY, 20 + i));
  [0, 60, 120].forEach((s, i) => text(ed.txt.ticks[i], trackX(s) + 2, ED.track.y + 34, 60 + i));
  // ---- line numbers (each appears as its row starts typing)
  for (let i = 0; i < CODE.length; i++) {
    const tr = rowTiming(i);
    const g = CODE[i].length ? ease.outCubic(invLerp(tr.ts - 0.05, tr.ts + 0.12, lt)) : 0;
    if (g <= 0) continue;
    const L = ed.nums[i];
    const y = lineY(i);
    R.layer(L, M.chain(place(ED.gutterX - 10, y, 300 + i), U, M.translate(ED.gutterX, y), M.scale(1, g), M.translate(-(L.w - PAD), -L.h / 2)));
  }
  // ---- minimap rows (painted echo, revealed as typed)
  {
    const mm = ED.mini, L = ed.mini;
    for (let i = 0; i < CODE.length; i++) {
      const tp = typed(i, lt);
      if (!tp.on || tp.n <= 0) continue;
      const y0 = 4 + i * mm.sy - 0.5, h = mm.sy + 1, xw = Math.min(L.w, 4 + tp.c * mm.sx + 1);
      R.layer(L, M.chain(place(mm.x0, mm.y0 + i * mm.sy, 900 + i), U, M.translate(mm.x0 - 4, mm.y0 - 4 + y0)), { uv: [0, y0 / L.h, xw / L.w, (y0 + h) / L.h], w: xw, h });
    }
  }
  // ---- current-line band (caret row), unfolds from the caret when the row is done
  {
    const tr = rowTiming(CARET_LINE);
    const g = ease.inOutCubic(invLerp(tr.te + 0.05, tr.te + 0.45, lt));
    if (g > 0) {
      const L = ed.band;
      const y0 = lineY(CARET_LINE) - ED.lh / 2;
      const bx0 = ED.gutterX, bx1 = ED.split - 12;
      const xl = lerp(CARET.x, bx0, g), xr = lerp(CARET.x, bx1, g);
      const cut = (xa, xb, seed) => {
        if (xb - xa < 0.5) return;
        const u0 = (xa - bx0) / L.w, u1 = (xb - bx0) / L.w;
        R.layer(L, M.chain(place((xa + xb) / 2, y0 + ED.lh / 2, seed), U, M.translate(xa, y0)), { uv: [u0, 0, u1, 1], w: xb - xa, h: ED.lh });
      };
      cut(xl, CARET.x, 400);
      cut(CARET.x, xr, 401);
    }
  }
  // ---- thumbnails (grow from the merged nodes: a line that opens into a picture)
  ED.thumbs.forEach((th, k) => {
    const o1 = ease.outCubic(invLerp(th.tOpen, th.tOpen + 0.16, lt));
    const o2 = ease.inOutCubic(invLerp(th.tOpen + 0.1, th.tOpen + 0.42, lt));
    if (o1 <= 0) return;
    const cx = th.x + th.w / 2, cy = th.y + th.h / 2;
    const w = th.w * lerp(0.03, 1, o1), h = th.h * lerp(0.025, 1, o2);
    const m = M.mul(place(cx, cy, 500 + k, 0), U);
    const [x0, y0] = M.apply(m, cx - w / 2, cy - h / 2), [x1, y1] = M.apply(m, cx + w / 2, cy + h / 2);
    if (x1 < -50 || x0 > 1970 || y1 < -50 || y0 > 1130) return;
    const view = M.chain(M.translate(x0, y0), M.scale((x1 - x0) / 1920, (y1 - y0) / 1080));
    drawPivotIn(R, PIVOT[THUMB_PIVOTS[k]], view, { type: 'rect', x0, y0, x1, y1, soft: 0.6 });
    const flash = lt >= th.tOpen ? Math.exp(-(lt - th.tOpen) * 5) : 0;
    if (flash > 0.01) R.glow((x0 + x1) / 2, (y0 + y1) / 2, 30, [1, 0.8, 0.55], 1.2 * flash, { ext: 3, sx: Math.max(1, (x1 - x0) / 60), sy: Math.max(0.3, (y1 - y0) / 60) });
    const play = smoothstep(T.play, T.play + 0.25, lt) * (1 - smoothstep(T.dive0 + 0.6, T.dive0 + 1.2, lt));
    if (play > 0) R.rect(x0, y0, x1 - x0, y1 - y0, [0.25, 0.2, 0.12, 0.1 * play * (0.6 + 0.4 * Math.sin((lt - T.play) * 9 + k))], { blend: 'add' });
    R.layer(ed.frame, M.chain(M.translate(x0, y0), M.scale((x1 - x0) / th.w, (y1 - y0) / th.h), M.translate(-10, -10)), { opacity: 0.95 });
  });
  // ---- transport buttons (grow as their node dissolves into them)
  ED.transport.forEach((bt, i) => {
    const node = NODES.find((n) => n.tg.kind === 'btn' && n.tg.k === i);
    const g = ease.outBack(clamp(invLerp(node.t1 - 0.3, node.t1 + 0.12, lt)), 1.5);
    if (g <= 0.001) return;
    let press = 1;
    const d = lt - T.play;
    if (i === 1 && d > -0.08 && d < 0.5) press = 1 - 0.16 * Math.exp(-Math.pow((d - 0.02) / 0.07, 2)) + 0.05 * Math.sin(Math.max(0, d) * 22) * Math.exp(-Math.max(0, d) * 9);
    const m = M.mul(place(bt.x, bt.y, 610 + i), U);
    const [px, py] = M.apply(m, bt.x, bt.y);
    const s = M.scaleOf(m) * bt.r * g * press;
    ed.btns.draw(R, i, px, py, (s * 120) / 46, 0);
    if (i === 1) {
      const f = d > 0 ? Math.exp(-d * 4) : 0;
      R.glow(px, py, s * 1.1, [0.35, 0.95, 0.9], 0.18 * g + 1.4 * f, { ext: 3, shape: [1.6, 0.5, 2] });
      if (d > 0 && d < 0.9) {
        const rr = s * (1.2 + 5 * ease.outCubic(d / 0.9)), al = (1 - d / 0.9) * 0.7;
        const ring = [];
        for (let q = 0; q < 72; q++) {
          const an = (q / 72) * TAU;
          ring.push([px + Math.cos(an) * rr, py + Math.sin(an) * rr, 2.2, 0, 0.5, 1, 0.95, al * (0.7 + 0.3 * Math.sin(q * 1.7))]);
        }
        R.particles(ring, { kind: 'glow', blend: 'add' });
      }
    }
  });
  // ---- title dots + playhead: the nodes that became them
  const playT = KNOB_T + Math.max(0, lt - T.play - 0.05) * 1.0;
  for (const n of NODES) {
    if (n.tg.kind !== 'dot' && n.tg.kind !== 'knob') continue;
    if (lt < n.t1) continue;
    let [x, y, r] = nodeNet(n, lt);
    if (n.tg.kind === 'knob') x = trackX(playT);
    const m = M.mul(place(x, y, 700 + n.id), U);
    const [px, py] = M.apply(m, x, y);
    const s = M.scaleOf(m) * r;
    const col = n.tg.kind === 'dot' ? [...hex(ED.dots[n.tg.k].c), 0.9] : [...hex(C.cream), 0.8];
    if (n.tg.kind === 'knob') {
      const nm = M.mul(place(x, y - 20, 721), U);
      R.layer(ed.needle, M.mul(nm, M.translate(x - 12, y - 42)), { opacity: 0.9 });
    }
    A.net.nodes.draw(R, n.spr, px, py, s * 2.4, n.ph * 0.3, { color: col });
    if (n.tg.kind === 'knob') R.glow(px, py, s * 1.4, [1, 0.85, 0.6], 0.35, { ext: 3 });
  }
  // ---- time readout (monospace glyph atlas)
  {
    const f = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `0${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
    const str = `${f(playT)} / 02:25.00`;
    const G = ed.glyphs, set = '0123456789:./ ';
    const cw = G.cw;
    for (let q = 0; q < str.length; q++) {
      const gi = set.indexOf(str[q]);
      if (gi < 0 || str[q] === ' ') continue;
      const u0 = (4 + gi * cw) / G.w, u1 = (4 + (gi + 1) * cw) / G.w;
      const x = READOUT.x + q * cw;
      R.layer(G, M.chain(place(x, READOUT.y, 740 + q), U, M.translate(x, READOUT.y - G.h / 2)), { uv: [u0, 0, u1, 1], w: cw, h: G.h, opacity: q < 8 ? 1 : 0.6 });
    }
  }
}

// Each row breaks into ~3 chunks at spaces (for the dive).
const CHUNKS = CODE.map((line) => {
  const n = line.length, cuts = [0];
  for (const f of [1 / 3, 2 / 3]) {
    const target = Math.round(n * f);
    let best = -1;
    for (let d = 0; d < n; d++) {
      for (const c of [target - d, target + d]) if (c > cuts[cuts.length - 1] + 2 && c < n - 2 && line[c] === ' ') { best = c; break; }
      if (best >= 0) break;
    }
    if (best > 0) cuts.push(best);
  }
  cuts.push(n);
  return cuts;
});

// Typed text + carets. Drawn after the edges so glyphs sit on top of the bars.
export function drawCode(R, lt, A, E) {
  if (lt < T.type0 - 0.1 || !E.place) return;
  const place = E.place, U = E.U;
  const diving = lt > T.dive0;
  for (let i = 0; i < CODE.length; i++) {
    const L = A.ed.rows[i];
    if (!L) continue;
    const tp = typed(i, lt);
    if (!tp.on || tp.n <= 0) continue;
    const y = lineY(i);
    const wv = PAD + tp.n * ED.cw + (tp.n >= CODE[i].length ? PAD : 0);
    const u1 = Math.min(1, wv / L.w);
    if (!diving) {
      R.layer(L, M.chain(place(0, 0, 0), U, M.translate(ED.x0 - PAD, y - L.h / 2)), { uv: [0, 0, u1, 1], w: L.w * u1, h: L.h });
    } else {
      const cuts = CHUNKS[i], chunks = cuts.length - 1;
      for (let q = 0; q < chunks; q++) {
        const c0 = cuts[q], c1 = cuts[q + 1];
        const xa = q === 0 ? 0 : PAD + c0 * ED.cw, xb = q === chunks - 1 ? L.w : PAD + c1 * ED.cw;
        const cx = ED.x0 - PAD + (xa + xb) / 2;
        R.layer(L, M.mul(place(cx, y, 800 + i * 7 + q), M.translate(ED.x0 - PAD + xa, y - L.h / 2)), { uv: [xa / L.w, 0, xb / L.w, 1], w: xb - xa, h: L.h });
      }
    }
  }
  // typing carets (multi-caret cascade) — light
  const z = M.scaleOf(netView(lt));
  for (let i = 0; i < CODE.length; i++) {
    if (i === CARET_LINE || !CODE[i].length) continue;
    const tp = typed(i, lt);
    if (!tp.on) continue;
    const k = tp.done ? Math.exp(-(lt - tp.te) / 0.12) : 1;
    if (k < 0.01) continue;
    const [x, y] = M.apply(M.mul(place(0, 0, 0), U), tp.x + 1, lineY(i));
    R.rect(x - 1.1 * z, y - 12 * z, 2.2 * z, 24 * z, [1, 0.93, 0.8, 0.95 * k]);
    R.glow(x, y, 7 * z, [1, 0.8, 0.5], 0.9 * k, { ext: 3, sy: 2.2 });
  }
}

// The one caret that remains: types the current segment's row, blinks on the beat, pulls the
// camera in and collapses into the point of light the film begins with.
export function drawCaret(R, lt) {
  const tp = typed(CARET_LINE, lt);
  if (!tp.on) return;
  const V = diveView(lt);
  const [x, y] = tp.done ? M.apply(V, CARET.x, CARET.y) : M.apply(V, tp.x + 1, lineY(CARET_LINE));
  const z = M.scaleOf(netView(lt));
  let on = 1;
  if (tp.done && lt < T.dive0 + 0.9) {
    const ph = (lt / 0.625) % 1;
    on = smoothstep(0.0, 0.06, ph) * (1 - smoothstep(0.5, 0.56, ph));
    on = lerp(on, 1, smoothstep(T.dive0 + 0.3, T.dive0 + 0.9, lt));
    if (lt < tp.te + 0.3) on = 1;
  }
  const col = invLerp(T.collapse, T.collapse + 0.32, lt);
  const dg = smoothstep(T.dive0 + 0.2, T.dive1, lt);
  const hs = 1 + 7 * dg * dg, ws = 1 + 2.2 * dg;
  const h = 24 * z * hs * (1 - ease.inCubic(clamp(col))), w = 2.3 * z * ws * lerp(1, 0.5, clamp(col));
  if (col < 1 && h > 0.3) {
    R.rect(x - w / 2, y - h / 2, w, h, [1, 0.94, 0.82, 0.96 * on]);
    R.glow(x, y, 8 * z * ws, [1, 0.78, 0.5], (0.8 + 0.6 * smoothstep(T.dive0, T.dive1, lt)) * on, { ext: 3, sy: Math.max(1, h / (16 * z * ws)) });
  }
  if (lt >= T.collapse - 0.05) {
    const grow = smoothstep(T.collapse, T.collapse + 0.3, lt);
    const k = grow * (1 - ease.inOutSine(invLerp(T.collapse + 0.4, T.pointEnd, lt)));
    const tr = 0.7 * k;
    const px = 960 + tr * noise1(lt * 37, 5), py = 540 + tr * noise1(lt * 37, 6);
    const flash = Math.exp(-Math.pow((lt - T.collapse - 0.3) / 0.12, 2));
    PIVOT.singularity.drawPoint(R, px, py, k * (1 + 0.8 * flash));
  }
}
