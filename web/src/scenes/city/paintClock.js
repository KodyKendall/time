// CITY — painted clock tower, dial, hands, split-plate masks and clockwork gears.
import { C } from '../lib/palette.js';
import { TAU, lerp, clamp, mixHex, circlePts, rng } from '../lib/kit.js';
import { gearOutline } from '../pivots.js';
import { massPoly } from './paintCity.js';

const rectP = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const rot = (pts, a, cx, cy) => pts.map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
const closed = (pts) => pts.concat([pts[0]]);

// ------------------------------------------------------------------------------------------------
// DIAL: clock units, radius 800, layer 1700 x 1700, centre (850, 850)
// ------------------------------------------------------------------------------------------------
export const DIAL = { S: 1700, c: 850, R: 800, notch: 118 };
const INK = '#1b1a2e';

// roman numeral glyph polygons in local coords (x right, y down, centred), height h
function glyph(ch, h) {
  const t = h * 0.17, th = h * 0.07, sw = h * 0.36, s = h * 0.08; // thick, thin, serif half-width, serif height
  const I = (x) => [rectP(x - t / 2, -h / 2 + s * 0.5, x + t / 2, h / 2 - s * 0.5), rectP(x - sw / 2, -h / 2, x + sw / 2, -h / 2 + s), rectP(x - sw / 2, h / 2 - s, x + sw / 2, h / 2)];
  const V = (x) => {
    const w = h * 0.62;
    return [
      [[x - w / 2, -h / 2 + s * 0.5], [x - w / 2 + t, -h / 2 + s * 0.5], [x + t * 0.35, h / 2], [x - t * 0.35, h / 2]],
      [[x + w / 2 - th, -h / 2 + s * 0.5], [x + w / 2, -h / 2 + s * 0.5], [x + th * 0.2, h / 2], [x - th * 0.8, h / 2 - th]],
      rectP(x - w / 2 - sw * 0.35, -h / 2, x - w / 2 + t + sw * 0.35, -h / 2 + s),
      rectP(x + w / 2 - th - sw * 0.35, -h / 2, x + w / 2 + sw * 0.35, -h / 2 + s),
    ];
  };
  const X = (x) => {
    const w = h * 0.66;
    return [
      [[x - w / 2, -h / 2 + s * 0.5], [x - w / 2 + t, -h / 2 + s * 0.5], [x + w / 2, h / 2 - s * 0.5], [x + w / 2 - t, h / 2 - s * 0.5]],
      [[x + w / 2 - th, -h / 2 + s * 0.5], [x + w / 2, -h / 2 + s * 0.5], [x - w / 2 + th, h / 2 - s * 0.5], [x - w / 2, h / 2 - s * 0.5]],
      rectP(x - w / 2 - sw * 0.3, -h / 2, x - w / 2 + t + sw * 0.3, -h / 2 + s), rectP(x + w / 2 - th - sw * 0.3, -h / 2, x + w / 2 + sw * 0.3, -h / 2 + s),
      rectP(x - w / 2 - sw * 0.3, h / 2 - s, x - w / 2 + th + sw * 0.3, h / 2), rectP(x + w / 2 - t - sw * 0.3, h / 2 - s, x + w / 2 + sw * 0.3, h / 2),
    ];
  };
  const widths = { I: h * 0.36, V: h * 0.72, X: h * 0.76 };
  let total = 0;
  for (const k of ch) total += widths[k];
  total += (ch.length - 1) * h * 0.04;
  let x = -total / 2;
  const polys = [];
  for (const k of ch) {
    const cx = x + widths[k] / 2;
    polys.push(...(k === 'I' ? I(cx) : k === 'V' ? V(cx) : X(cx)));
    x += widths[k] + h * 0.04;
  }
  return polys;
}
const NUMERALS = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

export function paintDial(P) {
  const { S, c: cx, R } = DIAL;
  return P.layer('dial', { w: S, h: S, scale: 0.85 }, (c) => {
    const r = c.r;
    const cy = cx;
    // enamel: warm cream, backlit centre, massed texture
    c.washPoly(circlePts(cx, cy, R, 160), '#f1e2c2', 255);
    c.fillPoly(circlePts(cx, cy, R * 0.99, 160), '#e2cc9e', { opacity: 80, bleed: 0.02, texture: 0.8, border: 0.6 });
    c.fillPoly(circlePts(cx, cy, R * 0.62, 120), '#fff6e2', { opacity: 60, bleed: 0.08, texture: 0.7, border: 0.05 });
    massPoly(c, circlePts(cx, cy, R * 0.86, 120), 'city_mass_m', '#ead6ae', { precision: 0.85, strength: 0.25 });
    c.flush();
    // outer dark ring + brass inner ring
    const ring = (r0, r1, col, n = 120) => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 1.05) / n) * TAU;
        c.washPoly([[cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0], [cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1]], col, 255);
      }
    };
    ring(R * 0.965, R, '#241a24');
    ring(R * 0.935, R * 0.965, '#c99a4a');
    c.flush();
    c.strokePath(closed(circlePts(cx, cy, R * 0.95, 160)), 'crayon', '#f6d88a', 0.8, 0.2);
    // minute track: two rules and 60 ticks
    for (const rr of [R * 0.875, R * 0.925]) c.strokePath(closed(circlePts(cx, cy, rr, 180)), 'ink', INK, 2.6, 0.2);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - Math.PI / 2, big = i % 5 === 0;
      const r0 = R * 0.875, r1 = R * 0.925;
      if (big) {
        const w = 0.012;
        c.washPoly([[cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0], [cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0], [cx + Math.cos(a + w * 0.9) * r1, cy + Math.sin(a + w * 0.9) * r1], [cx + Math.cos(a - w * 0.9) * r1, cy + Math.sin(a - w * 0.9) * r1]], INK, 255);
        c.washPoly(circlePts(cx + Math.cos(a) * R * 0.845, cy + Math.sin(a) * R * 0.845, 11, 16), '#b8862e', 255);
      } else {
        c.strokePath([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], 'ink', INK, 2.0, 0.1);
      }
    }
    c.flush();
    // numerals, radial (feet towards the centre)
    NUMERALS.forEach((ch, k) => {
      const a = (k / 12) * TAU;
      const px = cx + Math.sin(a) * R * 0.69, py = cy - Math.cos(a) * R * 0.69;
      const polys = glyph(ch, 150).map((poly) => rot(poly, a, px, py));
      for (const poly of polys) c.washPoly(poly, INK, 255);
      c.flush();
      for (const poly of polys) if (r() < 0.7) c.strokePath(closed(poly), 'wire', '#3a2a3a', 0.9, 0.1);
    });
    // inner garland ring, guilloché sunburst, rosette
    for (const rr of [R * 0.54, R * 0.565]) c.strokePath(closed(circlePts(cx, cy, rr, 160)), 'ink', '#a8782a', 1.8, 0.2);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      c.washPoly(circlePts(cx + Math.cos(a) * R * 0.5525, cy + Math.sin(a) * R * 0.5525, 5.5, 10), i % 2 ? '#c99a4a' : '#8a5a2a', 255);
    }
    for (let i = 0; i < 144; i++) {
      const a = (i / 144) * TAU + r(-0.004, 0.004);
      const r0 = R * 0.13, r1 = R * (i % 2 ? 0.47 : 0.5);
      c.strokePath([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], 'wire', i % 3 ? '#d8b878' : '#b89050', 0.9, 0.1);
    }
    c.flush();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const petal = [];
      for (let k = 0; k <= 16; k++) {
        const t = (k / 16) * Math.PI;
        const rr = R * 0.07 + Math.sin(t) * R * 0.012, len = R * 0.07 + (k / 16) * R * 0.14;
        petal.push([Math.sin(t) * R * 0.035, -len]);
      }
      for (let k = 16; k >= 0; k--) { const t = (k / 16) * Math.PI; petal.push([-Math.sin(t) * R * 0.035, -(R * 0.07 + (k / 16) * R * 0.14)]); }
      const pp = rot(petal, a, cx, cy);
      c.washPoly(pp, '#d9a94e', 245);
      c.strokePath(closed(pp), 'wire', '#8a5a1a', 0.8, 0.3);
    }
    c.washPoly(circlePts(cx, cy, R * 0.075, 48), '#c99a4a', 255);
    // the seam where the dial will split: horizontal with a half-round notch below the centre
    const n = DIAL.notch;
    const seam = [[cx - R * 0.94, cy], [cx - n, cy]];
    for (let k = 0; k <= 24; k++) { const t = Math.PI - (k / 24) * Math.PI; seam.push([cx + Math.cos(t) * n, cy + Math.sin(t) * n]); }
    seam.push([cx + n, cy], [cx + R * 0.94, cy]);
    c.strokePath(seam, 'ink', '#4a3a3a', 1.6, 0.1);
    c.strokePath(seam.map(([x, y]) => [x, y - 3]), 'HB', '#fff4d8', 0.8, 0.1);
    // weathering
    for (let i = 0; i < 16; i++) { const a = r(0, TAU), d = r(0.15, 0.85) * R, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; c.strokePath([[x, y], [x + r(-40, 40), y + r(-40, 40)]], 'dust', '#b89a70', 1.0, 0.5); }
  });
}

// masks for the two plates (alpha = 1 on the plate), same frame as the dial
export function paintPlateMasks(P) {
  const { S, c: cx, notch: n } = DIAL;
  const cut = [];
  cut.push([0, cx], [cx - n, cx]);
  for (let k = 0; k <= 32; k++) { const t = Math.PI - (k / 32) * Math.PI; cut.push([cx + Math.cos(t) * n, cx + Math.sin(t) * n]); }
  cut.push([cx + n, cx], [S, cx]);
  const top = P.layer('plateTop', { w: S, h: S, scale: 0.3 }, (c) => c.washPoly([[0, 0], [S, 0], ...cut.slice().reverse()], '#ffffff', 255));
  const bot = P.layer('plateBot', { w: S, h: S, scale: 0.3 }, (c) => c.washPoly([...cut, [S, S], [0, S]], '#ffffff', 255));
  return { top, bot };
}

// ------------------------------------------------------------------------------------------------
// HANDS atlas (clock units): minute hand cell [0,160] x [0,880], pivot (80, 740);
// hour hand cell [160,400] x [0,880], pivot (280, 740). Pointing up.
// ------------------------------------------------------------------------------------------------
export const HANDS = { w: 400, h: 880, min: { x: 80, y: 740, cell: [0, 160] }, hour: { x: 280, y: 740, cell: [160, 400] } };
export function paintHands(P) {
  return P.layer('hands', { w: HANDS.w, h: HANDS.h, scale: 0.9 }, (c) => {
    const body = '#1d1b30', gold = '#e8b85a';
    const hand = (px, py, len, tail, w, orn) => {
      // shaft (tapered), counterweight tail, ornament, tip
      const shaft = [[px - w, py + tail * 0.6], [px + w, py + tail * 0.6], [px + w * 0.55, py - len * 0.86], [px - w * 0.55, py - len * 0.86]];
      c.washPoly(shaft, body, 255);
      c.washPoly(circlePts(px, py + tail * 0.72, w * 2.1, 28), body, 255);
      // tip: spade / arrow
      const tip = [[px - w * 2.2, py - len * 0.84], [px, py - len], [px + w * 2.2, py - len * 0.84], [px + w * 0.6, py - len * 0.8], [px - w * 0.6, py - len * 0.8]];
      c.washPoly(tip, body, 255);
      orn(px, py);
      c.flush();
      c.strokePath([[px - w * 0.5, py + tail * 0.4], [px - w * 0.3, py - len * 0.84]], 'HB', gold, 1.4, 0.2);
      c.strokePath(closed(tip), 'wire', gold, 1.2, 0.2);
    };
    // minute hand: slim, with a Breguet ring at 70%
    hand(80, 740, 700, 150, 9, (px, py) => {
      const ry = py - 700 * 0.68;
      c.strokePath(closed(circlePts(px, ry, 26, 40)), 'ink', body, 7.5, 0.3);
      c.strokePath(closed(circlePts(px, ry, 26, 40)), 'wire', gold, 1.1, 0.3);
      c.washPoly(circlePts(px, ry, 7, 16), body, 255);
    });
    // hour hand: broad, with an open heart / spade
    hand(280, 740, 470, 120, 15, (px, py) => {
      const hy = py - 470 * 0.62;
      const heart = [];
      for (let k = 0; k <= 40; k++) {
        const t = (k / 40) * TAU;
        const x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        heart.push([px + x * 3.6, hy + y * 3.6]);
      }
      c.strokePath(heart, 'ink', body, 9, 0.4);
      c.strokePath(heart, 'wire', gold, 1.2, 0.4);
      c.washPoly(circlePts(px, hy - 6, 9, 16), body, 255);
    });
    // centre caps
    for (const px of [80, 280]) {
      c.washPoly(circlePts(px, 740, 34, 32), '#c99a4a', 255);
      c.washPoly(circlePts(px, 740, 12, 20), '#2a1a14', 255);
      c.strokePath(closed(circlePts(px, 740, 34, 32)), 'ink', '#5a3a14', 1.4, 0.2);
    }
  });
}

// ------------------------------------------------------------------------------------------------
// TOWER: body faces (124 x 400 world units), hi-res clock panel with a real hole, belfry, hall
// ------------------------------------------------------------------------------------------------
export const TW = { W: 124, H: 400, D: 2.5, panel: { z0: 268, z1: 392, D: 12 }, belfry: 56 };
const BRICK = { wall: '#b4503a', wall2: '#8e3a2a', wallL: '#cf6c4c', stone: '#e8d4ae', stone2: '#c9b08a' };

export function paintTowerBody(P, front) {
  const { W, H, D } = TW;
  return P.layer(front ? 'towerFront' : 'towerSide', { w: W * D, h: H * D }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    const R = (x0, y0, x1, y1) => rectP(X(x0), X(y0), X(x1), X(y1));
    c.washPoly(R(0, 0, W, H), BRICK.wall, 255);
    for (let i = 0; i < 8; i++) c.fillPoly(c.blob(X(r(0, W)), X(r(0, H)), X(r(20, 50)), X(r(30, 80)), { wobble: 0.3 }), r.pick([BRICK.wall2, BRICK.wallL]), { opacity: 45, bleed: 0.2, texture: 0.9, border: 0.08 });
    c.flush();
    massPoly(c, R(3, H * 0.55, W - 3, H - 3), 'city_mass_s', BRICK.wall2, { precision: 0.75, strength: 0.35 });
    c.flush();
    // brick courses: individual bricks as short dabs in varied tones, mortar lines between
    for (let y = 0; y < H; y += 2.4) {
      const off = (Math.round(y / 2.4) % 2) * 2.6;
      for (let x = -off; x < W; x += 5.2) {
        if (r() < 0.35) continue;
        c.washPoly(R(x + 0.3, y + 0.35, x + 4.9, y + 2.05), r.pick([BRICK.wall2, BRICK.wallL, '#9a4030', '#c05a40', BRICK.wall]), r(90, 170));
      }
    }
    c.flush();
    for (let y = 2.4; y < H; y += 2.4) c.strokePath([[0, X(y)], [X(W / 2), X(y + r(-0.1, 0.1))], [X(W), X(y)]], 'HB', '#e8c8a8', 0.5, 0.5);
    c.flush();
    // quoins
    for (let y = 2; y < H - 6; y += 7) {
      const big = Math.round(y / 7) % 2 === 0;
      for (const [a, b] of [[0, big ? 9 : 6], [W - (big ? 9 : 6), W]]) {
        c.washPoly(R(a, y, b, y + 6), BRICK.stone, 245);
        c.strokePath([[X(a), X(y + 6)], [X(b), X(y + 6)]], 'charcoal', BRICK.stone2, 0.5, 0.5);
      }
    }
    // string courses (z = 136, 268, 392 -> y = H - z)
    for (const z of [136, 268, 392]) {
      const y = H - z;
      c.washPoly(R(-1, y - 2.5, W + 1, y + 1), BRICK.stone, 250);
      c.hatchPoly(R(0, y + 1, W, y + 4), { dist: 3, angle: 0.9, brushName: 'wire', color: '#2a1420', weight: 0.5, rand: 0.2 });
      c.strokePath([[0, X(y + 1)], [X(W), X(y + 1)]], 'ink', '#2a1418', 1.1, 0.5);
    }
    // windows: tall lancets in the two lower stages; entrance arch at the base (front)
    const lancet = (xc, y0, y1, w) => {
      const arch = [];
      arch.push([X(xc - w / 2), X(y1)], [X(xc + w / 2), X(y1)], [X(xc + w / 2), X(y0 + w / 2)]);
      for (let k = 1; k < 12; k++) { const a = (k / 12) * Math.PI; arch.push([X(xc + Math.cos(a) * w / 2), X(y0 + w / 2 - Math.sin(a) * w / 2 * 1.4)]); }
      arch.push([X(xc - w / 2), X(y0 + w / 2)]);
      return arch;
    };
    const wins = front ? [[40, 150, 188, 12], [84, 150, 188, 12], [62, 290, 330, 14]] : [[62, 150, 190, 13], [62, 290, 330, 13]];
    for (const [xc, y0, y1, w] of wins) {
      c.washPoly(lancet(xc, y0 - 2, y1 + 1.5, w + 4), BRICK.stone, 255);
      c.washPoly(lancet(xc, y0, y1, w), '#1a2030', 255);
      c.strokePath([[X(xc), X(y0 + w * 0.3)], [X(xc), X(y1)]], 'wire', BRICK.stone, 0.9, 0.2);
    }
    if (front) {
      // grand entrance at street level
      const ew = 44, ey0 = H - 74;
      c.washPoly(lancet(62, ey0 - 4, H, ew + 10), BRICK.stone, 255);
      c.washPoly(lancet(62, ey0, H + 1, ew), '#2a1a20', 255);
      c.washPoly(R(62 - ew / 2 + 4, H - 40, 62 + ew / 2 - 4, H), '#5a3420', 255);
      for (let q = 0; q < 5; q++) c.strokePath([[X(62 - ew / 2 + 4 + q * 9), X(H - 40)], [X(62 - ew / 2 + 4 + q * 9), X(H)]], 'charcoal', '#2a1a10', 0.7, 0.5);
    }
    // shade hatch on one side, contours
    c.hatchPoly(R(W - 12, 0, W, H), { dist: 4, angle: 1.05, brushName: 'wire', color: '#241a3a', weight: 0.55, rand: 0.2 });
    c.strokePath([[X(0.5), 0], [X(0.5), X(H)]], 'ink', '#1e1420', 1.6, 0.4);
    c.strokePath([[X(W - 0.5), 0], [X(W - 0.5), X(H)]], 'ink', '#1e1420', 1.6, 0.4);
  });
}

// painted lettering: rasterise text with Canvas2D, then paint it as thin horizontal washes
// (exact letter shapes, laid down like brush work)
function paintLettering(c, text, cx, cy, h, D, col, shadow) {
  const k = 12; // raster px per world unit
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  const font = `600 ${Math.round(h * k * 1.36)}px Georgia, "Times New Roman", serif`;
  const spacing = `${Math.round(h * k * 0.18)}px`;
  g.font = font;
  if ('letterSpacing' in g) g.letterSpacing = spacing;
  const w = Math.ceil(g.measureText(text).width) + 8;
  cv.width = w;
  cv.height = Math.ceil(h * k * 1.8);
  g.font = font;
  if ('letterSpacing' in g) g.letterSpacing = spacing;
  g.fillStyle = '#000';
  g.textBaseline = 'middle';
  g.fillText(text, 4, cv.height / 2);
  const img = g.getImageData(0, 0, cv.width, cv.height).data;
  const x0 = cx - w / k / 2, y0 = cy - cv.height / k / 2;
  const runs = [];
  for (let y = 0; y < cv.height; y += 1.5) {
    const yy = Math.floor(y);
    let start = -1;
    for (let x = 0; x <= cv.width; x++) {
      const on = x < cv.width && img[(yy * cv.width + x) * 4 + 3] > 110;
      if (on && start < 0) start = x;
      if (!on && start >= 0) { runs.push([start, x, yy]); start = -1; }
    }
  }
  const put = (dx, dy, color, alpha) => {
    for (const [s, e, y] of runs) {
      const X0 = (x0 + s / k + dx) * D, X1 = (x0 + e / k + dx) * D, Y0 = (y0 + y / k + dy) * D, Y1 = (y0 + (y + 1.7) / k + dy) * D;
      c.washPoly([[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]], color, alpha);
    }
  };
  put(0.28, 0.32, shadow, 235);
  put(0, 0, col, 255);
  c.flush();
}

// the clock panel: ashlar stone with a carved moulding, gilded spandrels, bezel and inscription;
// a real round hole is left for the dial
export function paintClockPanel(P) {
  const W = TW.W, Hp = TW.panel.z1 - TW.panel.z0, D = TW.panel.D;
  const Rw = 40; // dial radius (world units); dial centre at z = 330 -> panel y = z1 - 330
  const cx = W / 2, cy = TW.panel.z1 - 330;
  return P.layer('clockPanel', { w: W * D, h: Hp * D, scale: 1.0 }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    const pts = (arr) => arr.map(([x, y]) => [X(x), X(y)]);
    const RR = (x0, y0, x1, y1) => pts([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    // warm limestone ground, massed
    c.washPoly(RR(0, 0, W, Hp), '#d6bf96', 255);
    massPoly(c, RR(2, 2, W - 2, Hp - 2), 'city_mass_m', '#bba27a', { precision: 0.7, strength: 0.45 });
    c.flush();
    massPoly(c, RR(2, 2, W - 2, Hp * 0.45), 'city_mass_m', '#ead8b4', { precision: 0.6, strength: 0.35 });
    c.flush();
    // ashlar courses with staggered joints (carved: dark line, light lip below)
    const ch = Hp / 8;
    for (let j = 1; j < 8; j++) {
      const y = j * ch;
      c.strokePath([[0, X(y)], [X(W / 2), X(y + r(-0.15, 0.15))], [X(W), X(y)]], 'charcoal', '#8a7252', 0.8, 0.5);
      c.strokePath([[0, X(y + 0.45)], [X(W), X(y + 0.45)]], 'HB', '#f4e6c8', 0.7, 0.5);
    }
    for (let j = 0; j < 8; j++) {
      for (let x = j % 2 ? 15.5 : 31; x < W; x += 31) {
        c.strokePath([[X(x), X(j * ch)], [X(x + r(-0.2, 0.2)), X((j + 1) * ch)]], 'charcoal', '#8a7252', 0.7, 0.5);
      }
    }
    for (let i = 0; i < 24; i++) { const x = r(0, W), y = r(0, Hp); c.strokePath([[X(x), X(y)], [X(x + r(-6, 6)), X(y + r(-4, 4))]], 'dust', '#9a8260', 1.1, 0.5); }
    c.flush();
    // carved moulding: shadow line, light ogee, fine fillet, bead row
    const fr = (m, col, w, brush = 'ink') => c.strokePath(pts([[m, m], [W - m, m], [W - m, Hp - m], [m, Hp - m], [m, m]]), brush, col, w, 0.05);
    c.washPoly(pts([[1, 1], [W - 1, 1], [W - 1, 6.5], [1, 6.5]]), '#e8d6b0', 255);
    c.washPoly(pts([[1, Hp - 6.5], [W - 1, Hp - 6.5], [W - 1, Hp - 1], [1, Hp - 1]]), '#e8d6b0', 255);
    c.washPoly(pts([[1, 1], [6.5, 1], [6.5, Hp - 1], [1, Hp - 1]]), '#e8d6b0', 255);
    c.washPoly(pts([[W - 6.5, 1], [W - 1, 1], [W - 1, Hp - 1], [W - 6.5, Hp - 1]]), '#e8d6b0', 255);
    c.flush();
    fr(1.2, '#5e4a34', 2.6);
    fr(3.4, '#fff4dc', 1.4, 'HB');
    fr(6.6, '#6e583c', 1.6);
    c.hatchPoly(pts([[W - 6.5, 6.5], [W - 1.2, 1.2], [W - 1.2, Hp - 1.2], [W - 6.5, Hp - 6.5]]), { dist: X(0.8), angle: 1.1, brushName: 'wire', color: '#4a3a3a', weight: 0.6, rand: 0.2 });
    c.hatchPoly(pts([[1.2, Hp - 1.2], [W - 1.2, Hp - 1.2], [W - 6.5, Hp - 6.5], [6.5, Hp - 6.5]]), { dist: X(0.8), angle: 0.4, brushName: 'wire', color: '#4a3a3a', weight: 0.6, rand: 0.2 });
    for (let t = 8; t < W - 8; t += 2.6) for (const y of [4.8, Hp - 4.8]) c.washPoly(c.blob(X(t), X(y), X(0.75), X(0.55), { n: 10 }), '#f8ecd0', 255);
    for (let t = 8; t < Hp - 8; t += 2.6) for (const x of [4.8, W - 4.8]) c.washPoly(c.blob(X(x), X(t), X(0.55), X(0.75), { n: 10 }), '#f8ecd0', 255);
    c.flush();
    // corner rosettes on the moulding
    for (const [x, y] of [[3.8, 3.8], [W - 3.8, 3.8], [3.8, Hp - 3.8], [W - 3.8, Hp - 3.8]]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        c.washPoly(c.blob(X(x + Math.cos(a) * 1.3), X(y + Math.sin(a) * 1.3), X(0.9), X(0.6), { n: 10, rot: a }), '#e8b85a', 255);
      }
      c.washPoly(circlePts(X(x), X(y), X(0.8), 12), '#8a5a1a', 255);
    }
    // gilded spandrels: acanthus leaves and a scroll in each corner between square and circle
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const bx = cx + sx * 44, by = cy + sy * 44;
      for (let k = 0; k < 5; k++) {
        const a0 = Math.atan2(-sy, -sx) + (k - 2) * 0.28;
        const len = 9 + (2 - Math.abs(k - 2)) * 3;
        const nx = -Math.sin(a0), ny = Math.cos(a0);
        const spine = [], left = [], right = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10, rr = len * t, bend = 0.15 * Math.sin(t * Math.PI) * (k % 2 ? 1 : -1);
          const x = bx + Math.cos(a0 + bend) * rr, y = by + Math.sin(a0 + bend) * rr;
          const ww = 1.6 * Math.sin(t * Math.PI) * (1 - t * 0.4);
          spine.push([X(x), X(y)]);
          left.push([X(x + nx * ww), X(y + ny * ww)]);
          right.push([X(x - nx * ww), X(y - ny * ww)]);
        }
        c.washPoly(left.concat(right.reverse()), k % 2 ? '#d9a44a' : '#e8b85a', 255);
        c.strokePath(spine, 'ink', '#7a4a12', 0.9, 0.4);
      }
      const spiral = [];
      for (let i = 0; i <= 36; i++) {
        const t = (i / 36) * TAU * 1.4, rr = 5.2 * (1 - i / 48);
        spiral.push([X(bx + Math.cos(t) * rr * sx), X(by + Math.sin(t) * rr * sy)]);
      }
      c.strokePath(spiral, 'ink', '#b8862e', 3.0, 0.4);
      c.strokePath(spiral, 'ink', '#ffe29a', 1.0, 0.4);
      c.washPoly(circlePts(X(bx), X(by), X(1.6), 16), '#ffd772', 255);
      c.strokePath(closed(circlePts(X(bx), X(by), X(1.6), 16)), 'ink', '#7a4a12', 0.8, 0.2);
    }
    c.flush();
    // keystone above the bezel
    c.washPoly(pts([[cx - 5, cy - 53.5], [cx + 5, cy - 53.5], [cx + 3.8, cy - 46], [cx - 3.8, cy - 46]]), '#ecdcb8', 255);
    c.strokePath(pts([[cx - 5, cy - 53.5], [cx - 3.8, cy - 46], [cx + 3.8, cy - 46], [cx + 5, cy - 53.5]]), 'ink', '#5e4a34', 1.2, 0.1);
    // inscription under the dial
    paintLettering(c, 'TEMPUS FUGIT', cx, cy + 52.2, 4.4, D, '#e8b85a', '#3a2412');
    // bezel: brass ring around the hole with rivets
    const ringQ = (r0, r1, col, n = 120) => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 1.05) / n) * TAU;
        c.washPoly(pts([[cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0], [cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1]]), col, 255);
      }
    };
    ringQ(Rw + 5.8, Rw + 7.2, '#4a3010');
    ringQ(Rw, Rw + 5.8, '#b8862e');
    c.flush();
    massPoly(c, pts(circlePts(cx, cy, Rw + 5.5, 96)), 'city_mass_s', '#d8a848', { precision: 0.85, strength: 0.3 });
    c.flush();
    c.strokePath(closed(pts(circlePts(cx, cy, Rw + 3.6, 140))), 'crayon', '#ffe7a8', 1.0, 0.2);
    c.strokePath(closed(pts(circlePts(cx, cy, Rw + 1.2, 140))), 'ink', '#6a4410', 1.2, 0.2);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const px = X(cx + Math.cos(a) * (Rw + 3.2)), py = X(cy + Math.sin(a) * (Rw + 3.2));
      c.washPoly(circlePts(px, py, X(0.85), 12), '#5a3a14', 255);
      c.washPoly(circlePts(px - X(0.2), py - X(0.2), X(0.35), 8), '#ffe7a8', 255);
    }
    // rain streaks below the bezel
    for (let i = 0; i < 9; i++) {
      const x = cx + r(-30, 30);
      const y0 = cy + Math.sqrt(Math.max(0, (Rw + 7) ** 2 - (x - cx) ** 2));
      c.strokePath([[X(x), X(y0)], [X(x + r(-0.4, 0.4)), X(y0 + r(4, 10))]], 'charcoal', '#8a7252', 0.5, 0.4);
    }
    // cut the hole clean (strokes may have strayed inside)
    c.native((p) => {
      p.push();
      p.erase();
      p.noStroke();
      p.circle(X(cx), X(cy), X(Rw * 2 - 0.2));
      p.noErase();
      p.pop();
    });
  });
}

export function paintBelfry(P) {
  const W = TW.W, H = TW.belfry, D = 3;
  return P.layer('belfry', { w: W * D, h: H * D }, (c) => {
    const X = (v) => v * D;
    const R = (x0, y0, x1, y1) => rectP(X(x0), X(y0), X(x1), X(y1));
    c.washPoly(R(0, 0, W, H), '#e2cca0', 255);
    massPoly(c, R(2, 2, W - 2, H - 2), 'city_mass_m', '#c8ae82', { precision: 0.55, strength: 0.5 });
    c.flush();
    for (const xc of [24, 62, 100]) {
      const w = 26, y0 = 10, y1 = H - 8;
      const arch = [[X(xc - w / 2), X(y1)], [X(xc + w / 2), X(y1)], [X(xc + w / 2), X(y0 + w / 2)]];
      for (let k = 1; k < 14; k++) { const a = (k / 14) * Math.PI; arch.push([X(xc + Math.cos(a) * w / 2), X(y0 + w / 2 - Math.sin(a) * w / 2)]); }
      arch.push([X(xc - w / 2), X(y0 + w / 2)]);
      c.washPoly(arch, '#161a2a', 255);
      if (xc === 62) {
        // the bell
        const bell = [[X(xc - 9), X(y1 - 10)], [X(xc + 9), X(y1 - 10)], [X(xc + 6), X(y0 + 18)], [X(xc + 3), X(y0 + 12)], [X(xc - 3), X(y0 + 12)], [X(xc - 6), X(y0 + 18)]];
        c.washPoly(bell, '#b8862e', 255);
        c.strokePath([[X(xc - 4), X(y0 + 14)], [X(xc - 6), X(y1 - 11)]], 'HB', '#ffe29a', 1.2, 0.3);
      }
      c.strokePath(arch.slice(2).concat([arch[0]]), 'ink', '#2a1a14', 1.2, 0.3);
    }
    // balustrade
    c.washPoly(R(0, H - 8, W, H - 5.5), '#f2e2c0', 255);
    for (let x = 2; x < W; x += 4) c.washPoly(R(x, H - 5.5, x + 1.8, H), '#f2e2c0', 250);
    c.washPoly(R(-1, 0, W + 1, 3.5), '#f2e2c0', 255);
    c.hatchPoly(R(0, 3.5, W, 6), { dist: 3, angle: 0.9, brushName: 'wire', color: '#2a1420', weight: 0.5, rand: 0.2 });
    c.strokePath([[X(0.5), 0], [X(0.5), X(H)]], 'ink', '#1e1420', 1.4, 0.4);
    c.strokePath([[X(W - 0.5), 0], [X(W - 0.5), X(H)]], 'ink', '#1e1420', 1.4, 0.4);
  });
}

// copper spire sheet (tiles in verdigris), sampled like the roof sheets
export function paintCopper(P) {
  const S = 256, D = 2.5;
  return P.layer('copper', { w: S * D, h: S * D, scale: 1.6 }, (c) => {
    const r = c.r, W = S * D;
    c.washPoly(rectP(0, 0, W, W), '#3f8f84', 255);
    massPoly(c, rectP(5, 5, W - 5, W - 5), 'city_mass_m', '#2a6a62', { precision: 0.45, strength: 0.6 });
    c.flush();
    for (let k = 0; k < 6; k++) massPoly(c, c.blob(r(0, W), r(0, W), r(50, 120), r(40, 90)), 'city_mass_s', r.pick(['#7fc4b2', '#2a5a52', '#a8d8c4']), { precision: 0.4, strength: 0.4 });
    c.flush();
    for (let y = 12; y < W; y += 12) {
      c.strokePath([[0, y], [W / 2, y + r(-1, 1)], [W, y]], 'charcoal', '#1f4a44', 0.5, 0.5);
      for (let x = (y / 12) % 2 ? 8 : 0; x < W; x += 16) c.strokePath([[x, y - 11], [x, y - 1]], 'HB', '#1f4a44', 0.6, 0.5);
    }
  });
}

// ------------------------------------------------------------------------------------------------
// GEARS: painted like the pivot gear (1000 x 1000, centre 500), in brass / copper / steel variants
// ------------------------------------------------------------------------------------------------
export const GEARS = [
  { name: 'gearBrass', r: 380, teeth: 36, spokes: 8, body: C.ochre, fill: '#e0b050', hole: C.night, hub: '#a87a2a', ink: '#5a3a14', toothH: 0.09 },
  { name: 'gearCopper', r: 380, teeth: 16, spokes: 5, body: C.orange, fill: '#c8502a', hole: C.night, hub: '#8a3a1a', ink: '#4a1a0a', toothH: 0.16 },
  { name: 'gearEscape', r: 380, teeth: 28, spokes: 4, body: C.gold, fill: '#f0c060', hole: C.night, hub: '#b8862e', ink: '#5a3a14', toothH: 0.14, escape: true },
  { name: 'gearSteel', r: 380, teeth: 12, spokes: 0, body: '#7d97a4', fill: '#6f8a98', hole: C.night, hub: '#a8bcc4', ink: '#1a2a34', toothH: 0.2 },
];
export function paintGears(P) {
  return GEARS.map((G) => P.layer(G.name, { w: 1000, h: 1000, scale: 0.8 }, (c) => {
    const cx = 500, cy = 500, R0 = G.r;
    let outer = gearOutline(cx, cy, R0, G.teeth, G.toothH);
    if (G.escape) {
      // hooked escapement teeth
      outer = [];
      for (let i = 0; i < G.teeth; i++) {
        const a0 = (i / G.teeth) * TAU, a1 = ((i + 1) / G.teeth) * TAU;
        outer.push([cx + Math.cos(a0) * R0, cy + Math.sin(a0) * R0]);
        outer.push([cx + Math.cos(a0 + (a1 - a0) * 0.15) * R0 * 1.16, cy + Math.sin(a0 + (a1 - a0) * 0.15) * R0 * 1.16]);
        outer.push([cx + Math.cos(a0 + (a1 - a0) * 0.35) * R0 * 1.02, cy + Math.sin(a0 + (a1 - a0) * 0.35) * R0 * 1.02]);
      }
    }
    c.washPoly(outer, G.body, 255);
    c.fillPoly(outer, G.fill, { opacity: 120, bleed: 0.02, texture: 0.8, border: 0.5 });
    massPoly(c, circlePts(cx, cy, R0 * 0.95, 96), 'city_mass_l', mixHex(G.fill, '#3a2210', 0.25), { precision: 0.6, strength: 0.5 });
    c.flush();
    if (G.spokes) {
      const hr0 = R0 * 0.3, hr1 = R0 * 0.8;
      for (let s = 0; s < G.spokes; s++) {
        const gap = 0.9 / G.spokes;
        const a0 = (s / G.spokes) * TAU + gap, a1 = ((s + 1) / G.spokes) * TAU - gap;
        const hole = [];
        for (let k = 0; k <= 18; k++) hole.push([cx + Math.cos(lerp(a0, a1, k / 18)) * hr1, cy + Math.sin(lerp(a0, a1, k / 18)) * hr1]);
        for (let k = 18; k >= 0; k--) hole.push([cx + Math.cos(lerp(a0 + 0.1, a1 - 0.1, k / 18)) * hr0, cy + Math.sin(lerp(a0 + 0.1, a1 - 0.1, k / 18)) * hr0]);
        c.washPoly(hole, G.hole, 255);
        c.fillPoly(hole, C.navy2, { opacity: 110, bleed: 0.02, texture: 0.6 });
      }
    }
    // engraved rings and rivets
    for (const rr of [R0 * 0.88, R0 * 0.84]) c.strokePath(closed(circlePts(cx, cy, rr, 120)), 'wire', G.ink, 1.1, 0.3);
    c.hatchPoly(circlePts(cx, cy, R0 * 0.97, 96), { dist: 10, angle: 0.6, brushName: 'wire', color: mixHex(G.fill, '#3a2210', 0.4), weight: 0.8, rand: 0.15 });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; c.washPoly(circlePts(cx + Math.cos(a) * R0 * 0.86, cy + Math.sin(a) * R0 * 0.86, 6, 10), G.ink, 255); }
    c.fillPoly(circlePts(cx, cy, R0 * 0.24, 64), G.hub, { opacity: 220, bleed: 0.02, texture: 0.6, border: 0.4 });
    c.washPoly(circlePts(cx, cy, R0 * 0.09, 40), C.night, 255);
    c.strokePath(closed(circlePts(cx, cy, R0 * 0.99, 140)), 'ink', G.ink, 1.6, 0.3);
    c.strokePath(closed(circlePts(cx, cy, R0 * 0.24, 60)), 'ink', G.ink, 1.6, 0.3);
    c.strokePath(outer.concat([outer[0]]).filter((_, i) => i % 2 === 0), 'crayon', mixHex(G.body, '#fff0c0', 0.5), 0.6, 0.2);
  }));
}

// ------------------------------------------------------------------------------------------------
// clockwork furniture (clock units): brass pillar (turned post) and the escapement anchor
// ------------------------------------------------------------------------------------------------
export const PILLAR = { w: 140, h: 1600 };
export const ANCHOR = { w: 700, h: 520, px: 350, py: 90 };
export function paintMovement(P) {
  const pillar = P.layer('pillar', { w: PILLAR.w, h: PILLAR.h, scale: 0.5 }, (c) => {
    const w = PILLAR.w, h = PILLAR.h, cx = w / 2;
    const prof = [];
    for (let y = 0; y <= h; y += 20) {
      const t = y / h;
      let rr = 34;
      for (const [yc, amp] of [[0.08, 22], [0.22, 14], [0.5, 18], [0.78, 14], [0.92, 22]]) rr += amp * Math.exp(-(((t - yc) / 0.025) ** 2));
      prof.push([y, rr]);
    }
    const body = prof.map(([y, rr]) => [cx - rr, y]).concat(prof.slice().reverse().map(([y, rr]) => [cx + rr, y]));
    c.washPoly(body, '#c9963c', 255);
    massPoly(c, body, 'city_mass_m', '#8a5a1a', { precision: 0.7, strength: 0.5 });
    c.flush();
    c.strokePath(prof.map(([y, rr]) => [cx - rr * 0.55, y]), 'crayon', '#ffe29a', 1.4, 0.4);
    c.strokePath(prof.map(([y, rr]) => [cx + rr * 0.75, y]), 'charcoal', '#5a3410', 1.4, 0.4);
    c.strokePath(prof.map(([y, rr]) => [cx - rr, y]), 'ink', '#3a2208', 1.6, 0.3);
    c.strokePath(prof.map(([y, rr]) => [cx + rr, y]), 'ink', '#3a2208', 1.6, 0.3);
    for (const yc of [0.08, 0.22, 0.5, 0.78, 0.92]) c.strokePath([[cx - 50, h * yc], [cx + 50, h * yc]], 'wire', '#5a3410', 1, 0.2);
  });
  const anchor = P.layer('anchor', { w: ANCHOR.w, h: ANCHOR.h, scale: 0.6 }, (c) => {
    const { px, py } = ANCHOR;
    const bar = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24, a = Math.PI * (0.18 + 0.64 * t); bar.push([px + Math.cos(a) * 300, py + Math.sin(a) * 300 - 30]); }
    for (let i = 24; i >= 0; i--) { const t = i / 24, a = Math.PI * (0.18 + 0.64 * t); bar.push([px + Math.cos(a) * 250, py + Math.sin(a) * 250 - 30]); }
    c.washPoly(bar, '#6a7f8e', 255);
    massPoly(c, bar, 'city_mass_s', '#3e5060', { precision: 0.8, strength: 0.5 });
    c.flush();
    c.strokePath(bar.concat([bar[0]]), 'ink', '#1a2430', 1.4, 0.2);
    for (const a of [Math.PI * 0.2, Math.PI * 0.8]) {
      const x = px + Math.cos(a) * 285, y = py + Math.sin(a) * 285 - 30;
      c.washPoly([[x - 20, y], [x + 20, y], [x + 12, y + 70], [x - 12, y + 70]], '#6a7f8e', 255);
      c.washPoly([[x - 10, y + 50], [x + 10, y + 50], [x + 7, y + 82], [x - 7, y + 82]], '#c8283a', 255);
      c.strokePath([[x - 4, y + 54], [x - 2, y + 74]], 'HB', '#ffd0d8', 1.2, 0.2);
    }
    c.washPoly([[px - 18, py], [px + 18, py], [px + 14, py + 250], [px - 14, py + 250]], '#6a7f8e', 255);
    c.washPoly(circlePts(px, py, 40, 24), '#b8862e', 255);
    c.washPoly(circlePts(px, py, 14, 16), '#1a1418', 255);
    c.strokePath(closed(circlePts(px, py, 40, 24)), 'ink', '#4a3010', 1.4, 0.2);
  });
  return { pillar, anchor };
}
