// ANCESTORS — the land: burnt ground that turns green (same painting, two palettes, revealed by a
// flowing "spilled paint" front from the sprouts), a far ridge that grows a jungle canopy and then
// heaves up into mountains, a rock, fallen logs, the burrow.
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, circlePts, ellipsePts, ribbon } from '../lib/kit.js';
import { ease, invLerp, noise1, fbm1, noise2, fbm2 } from '../../engine/math.js';
import { dab, along, brokenLine, scatter, curve, cracks, xform } from './brushkit.js';

// ---------------------------------------------------------------------------------------------
// Geometry (ground-plane world coordinates; the stage camera looks at y ~ 1000 … 2080)
// ---------------------------------------------------------------------------------------------
export const GROUND = { x: -300, y: 1300, w: 2600, h: 1180, scale: 1.3 };
export const BURROW = { x: 590, y: 1804, rx: 52, ry: 17 };
export const ROCK = { x: 1215, y: 1778, w: 350, h: 124, top: 1731 };   // top = standing height at centre
export const FIRE = { x: 1532, y: 1808 };
export const LOGS = [
  { x0: 40, y0: 1814, x1: 512, y1: 1792, r: 32, seed: 1 },
  { x0: 1640, y0: 1806, x1: 1905, y1: 1788, r: 28, seed: 2 },
];

export const midFar = (x) => 1512 - 34 * Math.sin(x * 0.0021 + 0.7) - 20 * Math.sin(x * 0.0053 + 2.1) - 60 * Math.exp(-(((x - 1650) / 420) ** 2));
export const midNear = (x) => 1598 - 26 * Math.sin(x * 0.0017 + 2.4) - 14 * Math.sin(x * 0.0061 + 0.3) - 44 * Math.exp(-(((x - 180) / 360) ** 2));
export const pathTop = (x) => 1716 + 16 * Math.sin(x * 0.004 + 1) + 9 * Math.sin(x * 0.011);
export const pathBot = (x) => 1842 + 13 * Math.sin(x * 0.0035 + 2) + 8 * Math.sin(x * 0.013 + 1);
// ground height where a creature walks (path centre line)
export const groundAt = (x) => lerp(pathTop(x), pathBot(x), 0.62);

function band(f0, f1, x0, x1, step = 20) {
  const pts = [];
  for (let x = x0; x <= x1; x += step) pts.push([x, f0(x)]);
  for (let x = x1; x >= x0; x -= step) pts.push([x, f1(x)]);
  return pts;
}

// ---------------------------------------------------------------------------------------------
// Palettes: burnt (panel 13) and green (panel 14). Same painting, different colours.
// ---------------------------------------------------------------------------------------------
const PAL = {
  burnt: {
    midFar: '#524c6b', midNear: '#3e3856', base: '#58516b', path: '#948ca5', pathLite: '#aaa2ba', fore: '#322c41', fore2: '#272132',
    farT: ['#5a5475', '#6a6384', '#48425f', '#7a7090'], nearT: ['#443e5c', '#4f4868', '#352f4a', '#5c4a5a'],
    baseT: ['#5e5772', '#6c6481', '#4c465f', '#7a6a78'], pathT: ['#9a92ab', '#aba3bb', '#877f99', '#b8b0c6', '#a0909c'],
    foreT: ['#383146', '#2c2638', '#453c52', '#3c2f3e'],
    tex: ['#77708f', '#48425e', '#b3abc2', '#6a5462'], dark: '#1e1927', warm: '#7a5a58', speck: '#cdc4d6', hatch: '#2c2740',
    stone: '#6e6781', stoneLite: '#9c94ae', line1: '#7a7294', line2: '#2a2438',
  },
  green: {
    midFar: '#2e6b66', midNear: '#255a50', base: '#3f7f59', path: '#93bc77', pathLite: '#b3cf8b', fore: '#28564a', fore2: '#1e4338',
    farT: ['#357a70', '#428a78', '#285e5a', '#4f9a80'], nearT: ['#2a6456', '#327060', '#1f4e46', '#3c7a5c'],
    baseT: ['#46875c', '#58996a', '#356e4e', '#6aa36b'], pathT: ['#9cc47e', '#b3cf8b', '#86ae6c', '#c4da96', '#a8c47a'],
    foreT: ['#2e5e4e', '#244c40', '#3a6c54', '#2a5648'],
    grass: ['#6aa36b', '#8ab464', '#3f7d4f', '#a8c878', '#2f6a48', '#c4da8a'],
    tex: ['#5f9e66', '#2f6b4c', '#c4da96', '#2a6356'], dark: '#14342b', warm: '#8aa84e', speck: '#dbebae', hatch: '#1b4a40',
    stone: '#5e7a6c', stoneLite: '#8aa692', line1: '#5a9a88', line2: '#163a30',
  },
};

function paintGround(c, pal, kind) {
  const geo = rng('anc-ground-geo');           // shared geometry: identical in both versions
  const rv = rng('anc-ground-' + kind);        // version-specific details
  const X0 = GROUND.x - 20, X1 = GROUND.x + GROUND.w + 20, Y1 = GROUND.y + GROUND.h + 20;
  const depth = (y) => clamp(0.45 + (y - 1450) / 800, 0.4, 1.6);
  const baseTop = (x) => lerp(midNear(x), pathTop(x), 0.45) + 8 * Math.sin(x * 0.009 + 2);
  const foreTop = (x) => pathBot(x) + 10;
  const bands = [
    { top: midFar, bot: (x) => midNear(x) + 30, col: pal.midFar, tones: pal.farT },
    { top: midNear, bot: baseTop, col: pal.midNear, tones: pal.nearT },
    { top: baseTop, bot: pathTop, col: pal.base, tones: pal.baseT },
    { top: pathTop, bot: pathBot, col: pal.path, tones: pal.pathT },
    { top: foreTop, bot: () => Y1, col: pal.fore, tones: pal.foreT },
  ];
  // 1. flat bases (hidden under paint) + underpainting glazes with bleed
  c.washPoly(band(midFar, () => Y1, X0, X1), pal.midFar, 255);
  c.washPoly(band(midNear, () => Y1, X0, X1), pal.midNear, 255);
  c.washPoly(band(baseTop, () => Y1, X0, X1), pal.base, 255);
  c.washPoly(band(pathTop, pathBot, X0, X1), pal.path, 255);
  c.washPoly(band(foreTop, () => Y1, X0, X1), pal.fore, 255);
  // underpainting: glazes in overlapping chunks (never one huge polygon: the watercolour bleed of a
  // 2600-unit shape would haze the sky above the hills)
  for (const b of bands) {
    for (let x = X0; x < X1; x += 260) {
      const top = (xx) => b.top(xx) + 6, bot = b.bot;
      c.fillPoly(band(top, bot, x, x + 300, 30), b.tones[geo.int(0, 1)], { opacity: 45, bleed: 0.03, texture: 0.9, border: 0.3 });
    }
  }
  // warm/cool glaze masses
  for (let i = 0; i < 40; i++) {
    const x = geo(X0, X1), y = geo(1510, Y1 - 40), bi = y < midNear(x) ? 0 : y < baseTop(x) ? 1 : y < pathTop(x) ? 2 : y < pathBot(x) ? 3 : 4;
    const s = depth(y);
    const top = bands[bi].top(x) + 12;
    c.fillPoly(c.blob(x, Math.max(y, top + 30 * s), geo(110, 300) * s, geo(14, 34) * s, { rot: geo(-0.06, 0.06), wobble: 0.3 }), bands[bi].tones[1 + (i % 3)], { opacity: 38, bleed: 0.05, texture: 0.9, border: 0.2 });
  }
  c.flush();
  // 2. hatching in the shaded bands
  c.hatchPoly(band((x) => midNear(x) + 4, (x) => lerp(midNear(x), baseTop(x), 0.9), X0, X1, 40), { dist: 8, angle: 0.5, brushName: 'wire', color: pal.hatch, weight: 0.75, rand: 0.2 });
  c.hatchPoly(band((x) => foreTop(x) + 90 + 14 * Math.sin(x * 0.005), () => Y1, X0, X1, 40), { dist: 12, angle: -0.3, brushName: 'wire', color: pal.dark, weight: 0.9, rand: 0.25 });
  // 3. form-following body strokes: long overlapping sweeps along the terrain, close in value
  const slopeOf = (f, x) => Math.atan2(f(x + 40) - f(x - 40), 80);
  for (const [bi, b] of bands.entries()) {
    const n = [340, 320, 420, 520, 760][bi];
    for (let i = 0; i < n; i++) {
      const x = geo(X0 - 120, X1);
      const t0 = b.top(x), t1 = b.bot(x);
      const y = lerp(t0 + 5, t1, Math.pow(geo(), 0.85));
      const s = depth(y);
      const ang = lerp(slopeOf(b.top, x), slopeOf(b.bot, x), clamp((y - t0) / Math.max(1, t1 - t0))) + geo(-0.04, 0.04);
      const tone = mixHex(b.col, b.tones[geo.int(0, b.tones.length - 1)], geo(0.35, 0.8));
      const pick = geo();
      const brush = pick < 0.5 ? 'gouache' : pick < 0.8 ? 'dry' : pick < 0.92 ? 'charcoal' : 'crayon';
      const len = geo(150, 380) * s, w = (brush === 'gouache' ? geo(0.55, 1.35) : geo(0.5, 1.2)) * s;
      dab(c, x, y, ang, len, brush, tone, w, geo(-0.05, 0.05));
    }
  }
  // accents: a few darker crevice strokes and pale catch-lights, higher contrast
  for (const [bi, b] of bands.entries()) {
    for (let i = 0; i < [40, 40, 60, 70, 90][bi]; i++) {
      const x = geo(X0, X1), y = lerp(b.top(x) + 6, b.bot(x), geo()), s = depth(y);
      const dark = geo() < 0.55;
      dab(c, x, y, slopeOf(b.top, x) + geo(-0.05, 0.05), geo(40, 140) * s, dark ? 'charcoal' : 'pastel', dark ? pal.dark : pal.speck, geo(0.35, 0.7) * s, 0.05);
    }
  }
  // 4. version-specific texture
  if (kind === 'burnt') {
    // cracked earth on the ash plain and path
    for (let i = 0; i < 26; i++) {
      const x = rv(X0 + 60, X1 - 60), y = rv(pathTop(x) - 40, Y1 - 120);
      cracks(c, rv, x, y, 120 * depth(y), 30 * depth(y), 5, pal.dark, 0.9 * depth(y));
    }
    // ash drifts (pale chalky strokes) and charred debris
    scatter(c, rv, 260, { pos: (r) => { const x = r(X0, X1); return [x, r(baseTop(x), Y1 - 30)]; }, dir: () => rv(-0.1, 0.1), len: [14, 60], brushes: ['pastel', 'dry'], colors: [pal.speck, '#b6adc2', '#d9d2e0'], weight: [0.3, 0.7], size: (x, y) => depth(y) });
    scatter(c, rv, 140, { pos: (r) => { const x = r(X0, X1); return [x, r(midNear(x), Y1 - 30)]; }, dir: () => rv(-0.6, 0.6), len: [8, 30], brushes: ['charcoal', 'ink'], colors: ['#16121c', '#2a2230', '#4a2e2e'], weight: [0.4, 0.9], size: (x, y) => depth(y) });
    // burnt stubble on the hills (short dark verticals)
    scatter(c, rv, 220, { pos: (r) => { const x = r(X0, X1); return [x, r(midFar(x) + 4, baseTop(x))]; }, dir: () => -Math.PI / 2 + rv(-0.3, 0.3), len: [6, 16], brushes: ['ink', 'charcoal'], colors: ['#231d2c', '#3a2f3a'], weight: [0.4, 0.8], size: (x, y) => depth(y) });
    // dying embers in the ash (tiny warm dabs)
    scatter(c, rv, 40, { pos: (r) => { const x = r(X0, X1); return [x, r(baseTop(x), Y1 - 60)]; }, dir: () => 0, len: [3, 7], brushes: ['gouache'], colors: ['#e8622c', '#f59b3d', '#a63a2a'], weight: [0.3, 0.5], size: (x, y) => depth(y) });
  } else {
    // grass: upward flicks everywhere, dense on the hills
    scatter(c, rv, 1100, { pos: (r) => { const x = r(X0, X1); return [x, r(midFar(x) + 3, Y1 - 20)]; }, dir: (x) => -Math.PI / 2 + 0.25 * Math.sin(x * 0.01) + rv(-0.35, 0.35), len: [10, 34], brushes: ['gouache', 'crayon', '2B'], colors: pal.grass, weight: [0.3, 0.7], size: (x, y) => depth(y), bend: 0.4 });
    // wild flowers: white, yellow, pink, orange dots on the path and base
    const fl = ['#fff6e0', '#f2d24c', '#e98aa0', '#f59b3d', '#d9707a', '#ffffff'];
    for (let i = 0; i < 180; i++) {
      const x = rv(X0, X1), y = rv(baseTop(x), Y1 - 60), s = depth(y);
      const col = rv.pick(fl);
      c.washPoly(ellipsePts(x, y, 3.2 * s, 2.3 * s, 0, 8), col, 255);
      if (rv() < 0.5) c.washPoly(ellipsePts(x + 4 * s, y + 1.5 * s, 2.6 * s, 2 * s, 0, 8), col, 255);
    }
  }
  // 5. stones (shared geometry, version colours)
  for (let i = 0; i < 30; i++) {
    const x = geo(X0 + 40, X1 - 40), y = geo(baseTop(x) + 10, Y1 - 40), s = geo(7, 18) * depth(y);
    const rot = geo(-0.2, 0.2);
    const mossy = geo() < 0.7;
    c.washPoly(ellipsePts(x + s * 0.2, y + s * 0.35, s * 1.6, s * 0.5, 0, 20), pal.dark, 150);
    c.washPoly(stoneShape(x, y, s * 1.35, s * 0.8, rot, i), pal.stone, 255);
    c.washPoly(stoneShape(x - s * 0.25, y - s * 0.3, s * 0.8, s * 0.35, rot, i + 50), pal.stoneLite, 230);
    if (kind === 'green' && mossy) c.washPoly(stoneShape(x + s * 0.1, y - s * 0.45, s * 0.9, s * 0.28, 0, i + 90), '#5f9a4a', 230);
  }
  // 6. dinosaur remains: a half-buried skull and a rib cage (moss-covered in the green version)
  paintBones(c, pal, kind);
  // 7. contours: broken ink along the hill tops and the path edges
  brokenLine(c, geo, curve(midFar, X0, X1, 24, 1), 'ink', pal.line1, 1.0);
  brokenLine(c, geo, curve(midNear, X0, X1, 24, 1), 'ink', pal.line2, 1.1);
  brokenLine(c, geo, curve(pathTop, X0, X1, 28, 2), 'crayon', pal.line2, 0.8, { keep: 0.55 });
  brokenLine(c, geo, curve(pathBot, X0, X1, 28, -2), 'crayon', pal.speck, 0.7, { keep: 0.5 });
}
// deterministic lumpy stone outline (no rng consumption)
function stoneShape(cx, cy, rx, ry, rot, seed) {
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const k = 1 + 0.1 * Math.sin(a * 3 + seed * 1.7) + 0.06 * Math.sin(a * 5 + seed * 2.3);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k * (Math.sin(a) > 0 ? 0.8 : 1);
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}

export const SKULL = { x: 318, y: 1940, s: 1.3 };
export const RIBS = { x: 1010, y: 1936, s: 1.0 };
function paintBones(c, pal, kind) {
  const moss = kind === 'green';
  const B = moss
    ? { bone: '#7fa86a', lite: '#a8c888', shade: '#4a7446', hole: '#173a2a', line: '#1f3f2a', crack: '#2f5a36' }
    : { bone: '#cfc4b0', lite: '#ebe3d2', shade: '#958a96', hole: '#211a27', line: '#463e4e', crack: '#6e6470' };
  const br = rng('anc-bones');
  {
    const { x, y, s } = SKULL;
    const P = (px, py) => [x + px * s, y + py * s];
    const top = [P(-136, 2), P(-131, -12), P(-100, -26), P(-60, -36), P(-20, -46), P(20, -60), P(55, -70), P(80, -66), P(100, -52), P(112, -30), P(116, -6), P(108, 12)];
    const row = [P(108, 12), P(60, 17), P(0, 15), P(-60, 10), P(-110, 8)];
    const cranium = top.concat(row);
    const jaw = [P(-122, 10), P(-60, 14), P(0, 18), P(60, 20), P(106, 16), P(112, 26), P(64, 36), P(0, 34), P(-60, 26), P(-116, 18)];
    // jaw first (behind), then teeth, then cranium
    c.washPoly(jaw, B.shade, 255);
    c.fillPoly(jaw, B.bone, { opacity: 70, bleed: 0.01, texture: 0.8, border: 0.5 });
    for (let k = 0; k < 13; k++) {
      const tx = x + (-118 + k * 14) * s, ty = y + (8 + 0.5 * k) * s, l = (11 + (k % 3) * 2) * s;
      c.washPoly([[tx - 3.2 * s, ty], [tx + 3.2 * s, ty], [tx + 2 * s, ty + l * 0.6], [tx + 0.5 * s, ty + l]], B.lite, 255);
    }
    c.washPoly(cranium, B.bone, 255);
    c.fillPoly(cranium, B.shade, { opacity: 55, bleed: 0.01, texture: 0.85, border: 0.7 });
    // light plane along the top of the snout / cranium
    c.washPoly([P(-128, -8), P(-100, -22), P(-60, -32), P(-20, -42), P(20, -56), P(55, -66), P(80, -62), P(96, -50), P(60, -48), P(10, -36), P(-50, -24), P(-100, -12)], B.lite, 200);
    // openings
    const holeC = (pts) => { c.washPoly(pts, B.hole, 255); };
    holeC(ellipsePts(x - 112 * s, y - 9 * s, 9 * s, 5 * s, -0.25, 14));
    holeC([P(-50, -4), P(-12, -30), P(18, -36), P(24, -12), P(-4, 3)]);
    holeC(ellipsePts(x + 52 * s, y - 42 * s, 15 * s, 14 * s, 0, 20));
    holeC([P(78, -30), P(97, -36), P(102, -8), P(84, 2)]);
    c.washPoly(ellipsePts(x + 49 * s, y - 45 * s, 5 * s, 4 * s, 0, 10), mixHex(B.hole, B.shade, 0.35), 255);
    // bone texture: dry strokes along the snout, cracks
    for (let k = 0; k < 16; k++) {
      const px = br(-120, 100), py = br(-50, 6) * (px > 0 ? 1 : 0.6);
      dab(c, x + px * s, y + py * s, br(-0.35, -0.1), br(14, 40) * s, 'dry', k % 3 ? B.lite : B.shade, br(0.35, 0.6) * s);
    }
    for (let k = 0; k < 5; k++) {
      let cx = x + br(-100, 90) * s, cy = y + br(-40, 0) * s;
      const pts = [[cx, cy]];
      for (let j = 0; j < 4; j++) { cx += br(-8, 8) * s; cy += br(4, 10) * s; pts.push([cx, cy]); }
      c.strokePath(pts, 'ink', B.crack, 0.6 * s, 0.2);
    }
    brokenLine(c, br, top, 'ink', B.line, 1.1, { keep: 0.85, seg: 4 });
    brokenLine(c, br, jaw.slice(5), 'ink', B.line, 1.0, { keep: 0.8, seg: 3 });
    if (moss) {
      for (let k = 0; k < 26; k++) dab(c, x + br(-120, 110) * s, y + br(-60, 20) * s, br(-1.6, -1.2), br(6, 16) * s, 'gouache', br.pick(['#4f8a46', '#6aa050', '#3a6e3a', '#8ab860']), br(0.35, 0.6) * s, 0.4);
      for (let k = 0; k < 7; k++) { const fx = x + br(-100, 100) * s, fy = y + br(-60, -10) * s; c.washPoly(ellipsePts(fx, fy, 4 * s, 3.2 * s, 0, 10), br.pick(['#f2d24c', '#e98aa0', '#fff6e0']), 255); }
    }
    // half-buried: soil drifts over the lower jaw
    const soil = [P(-150, 20), P(-100, 14), P(-40, 22), P(20, 18), P(80, 28), P(150, 22), P(160, 44), P(-160, 44)];
    c.washPoly(soil, pal.fore, 255);
    for (let k = 0; k < 14; k++) dab(c, x + br(-150, 150) * s, y + br(18, 36) * s, br(-0.08, 0.08), br(24, 60) * s, 'gouache', pal.foreT[br.int(0, 3)], br(0.8, 1.4) * s, 0.05);
  }
  {
    const { x, y, s } = RIBS;
    c.washPoly(ellipsePts(x + 10 * s, y + 6 * s, 160 * s, 15 * s, 0, 30), pal.dark, 110);
    // spine (vertebrae) along the ground
    for (let k = 0; k < 9; k++) {
      const vx = x + (-150 + k * 34) * s, vy = y + (Math.sin(k * 0.7) * 2 - 2) * s;
      c.washPoly(stoneShape(vx, vy, 13 * s, 8 * s, 0.1, k + 300), B.bone, 255);
      c.washPoly(stoneShape(vx - 2 * s, vy - 3 * s, 8 * s, 3.5 * s, 0.1, k + 330), B.lite, 220);
      c.washPoly([[vx - 3 * s, vy - 6 * s], [vx + 3 * s, vy - 6 * s], [vx + 1 * s, vy - 20 * s]], B.bone, 255); // neural spine
    }
    for (let k = 0; k < 7; k++) {
      const bx = x + (-118 + k * 38) * s, full = (92 - Math.abs(k - 3) * 13) * s;
      const broken = k === 1 || k === 5 ? 0.55 : 1;
      const lean = 0.22 - k * 0.05;
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const u = (j / 10) * broken, a = Math.PI * (0.06 + 0.84 * u);
        pts.push([bx + Math.cos(Math.PI - a) * 28 * s + lean * full * u, y - 4 * s - Math.sin(a) * full]);
      }
      c.washPoly(ribbon(pts, 12 * s, (broken < 1 ? 7 : 3.5) * s), B.bone, 255);
      c.strokePath(pts.map((p) => [p[0] - 2.5 * s, p[1] - 1 * s]), 'dry', B.lite, 0.45 * s, 0.4);
      c.strokePath(pts.map((p) => [p[0] + 3 * s, p[1] + 1.5 * s]), 'wire', B.shade, 0.9 * s, 0.4);
      if (moss) for (let j = 0; j < 5; j++) { const q = pts[br.int(1, 9)]; dab(c, q[0], q[1], br(-1.8, -1.2), br(6, 14) * s, 'gouache', br.pick(['#4f8a46', '#7ab058', '#e98aa0', '#f2d24c']), 0.45 * s, 0.4); }
      else for (let j = 0; j < 5; j++) br();
    }
  }
}

// Rock (panel 14: a broad slab, warm top plane, plum front), in grey (burnt) and warm versions.
export function rockTopY(x) {
  // standing height on the top plane (world), for feet on the rock
  const u = clamp((x - (ROCK.x - ROCK.w * 0.44)) / (ROCK.w * 0.88));
  return ROCK.y - ROCK.h * (0.34 + 0.06 * Math.sin(u * Math.PI)) + 4;
}
function paintRock(c, cx, cy, warm) {
  const w = ROCK.w, h = ROCK.h;
  const top = [[cx - w * 0.5, cy - h * 0.2], [cx - w * 0.4, cy - h * 0.5], [cx - w * 0.08, cy - h * 0.6], [cx + w * 0.26, cy - h * 0.57], [cx + w * 0.47, cy - h * 0.36], [cx + w * 0.44, cy - h * 0.12], [cx + w * 0.12, cy - h * 0.04], [cx - w * 0.3, cy - h * 0.06]];
  const front = [[cx - w * 0.5, cy - h * 0.2], [cx - w * 0.3, cy - h * 0.06], [cx + w * 0.12, cy - h * 0.04], [cx + w * 0.44, cy - h * 0.12], [cx + w * 0.47, cy - h * 0.36], [cx + w * 0.53, cy + h * 0.14], [cx + w * 0.36, cy + h * 0.36], [cx - w * 0.06, cy + h * 0.42], [cx - w * 0.42, cy + h * 0.36], [cx - w * 0.55, cy + h * 0.1]];
  const facet = [[cx + w * 0.12, cy - h * 0.04], [cx + w * 0.44, cy - h * 0.12], [cx + w * 0.47, cy - h * 0.36], [cx + w * 0.53, cy + h * 0.14], [cx + w * 0.36, cy + h * 0.36], [cx + w * 0.16, cy + h * 0.3]];
  const P = warm
    ? { top: '#e2873c', top2: '#f3aa55', front: '#6e2a52', front2: '#86385c', facet: '#4f1c40', line: '#3e1432' }
    : { top: '#8f889f', top2: '#a8a1b6', front: '#4a4460', front2: '#585270', facet: '#3a354e', line: '#26212f' };
  c.washPoly(front, P.front, 255);
  c.fillPoly(front, P.front2, { opacity: 90, bleed: 0.02, texture: 0.85, border: 0.4 });
  c.washPoly(facet, P.facet, 220);
  c.washPoly(top, P.top, 255);
  c.fillPoly(top, P.top2, { opacity: 90, bleed: 0.02, texture: 0.85, border: 0.5 });
  c.flush();
  const r = c.r;
  // top plane: broad flat strokes in 3-4 tones, lighter towards the back edge
  for (let i = 0; i < 60; i++) {
    const x = cx + r(-w * 0.4, w * 0.34), y = cy + r(-h * 0.55, -h * 0.1);
    const back = (cy - h * 0.1 - y) / (h * 0.45);
    const col = warm ? r.pick(back > 0.5 ? ['#f3aa55', '#f8c070', '#e89448'] : ['#e2873c', '#d47632', '#ea9848']) : r.pick(back > 0.5 ? ['#aaa3b8', '#b8b1c6', '#9c95ae'] : ['#8f889f', '#827b94', '#9a93aa']);
    const k = r();
    c.strokePath([[x, y], [x + r(24, 70), y + r(-3, 3)]], k < 0.55 ? 'gouache' : 'dry', col, k < 0.55 ? r(0.5, 0.9) : r(0.4, 0.7), 0.4);
  }
  // front plane: vertical strokes (the rock's grain), darker towards the ground
  for (let i = 0; i < 46; i++) {
    const x = cx + r(-w * 0.5, w * 0.48), y = cy + r(-h * 0.05, h * 0.3);
    const col = warm ? r.pick(['#86385c', '#6e2a52', '#5a2046', '#9a4a62']) : r.pick(['#585270', '#4a4460', '#3e3954', '#625c78']);
    c.strokePath([[x, y], [x + r(-3, 3), y + r(12, 30)]], r() < 0.6 ? 'gouache' : 'charcoal', col, r(0.4, 0.8), 0.3);
  }
  c.hatchPoly(front, { dist: 7, angle: 1.2, brushName: 'wire', color: P.line, weight: 0.8, rand: 0.2 });
  for (let i = 0; i < 4; i++) {
    let x = cx + r(-w * 0.35, w * 0.3), y = cy - h * r(0.2, 0.5);
    const pts = [[x, y]];
    for (let k = 0; k < 4; k++) { x += r(8, 22); y += r(-4, 6); pts.push([x, y]); }
    c.strokePath(pts, 'ink', P.line, 0.7, 0.3);
  }
  for (let i = 0; i < 30; i++) {
    const x = cx + r(-w * 0.45, w * 0.45), y = cy + r(-h * 0.5, h * 0.3);
    c.washPoly(ellipsePts(x, y, r(1.2, 2.6), r(1, 2), 0, 8), r() < 0.5 ? P.top2 : P.line, 200);
  }
  c.strokePath(top.concat([top[0]]), 'ink', P.line, 1.2, 0.25);
  c.strokePath(front.slice(4).concat([front[0]]), 'ink', P.line, 1.2, 0.25);
}

// A fallen, burnt log (panel 13: orange top, plum underside, a broken end and a snapped branch).
function paintLog(c, L, k) {
  const r = c.r;
  const dx = L.x1 - L.x0, dy = L.y1 - L.y0, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const top = [], bot = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = L.x0 + dx * t, y = L.y0 + dy * t, rr = L.r * (1 - 0.22 * t) * (1 + 0.07 * Math.sin(i * 2.1 + k * 3));
    top.push([x - nx * rr, y - ny * rr]);
    bot.push([x + nx * rr, y + ny * rr]);
  }
  // broken (splintered) far end
  const e = [L.x1, L.y1], rr1 = L.r * 0.78;
  const splinter = [
    [e[0] - nx * rr1 + ux * 10, e[1] - ny * rr1 + uy * 10], [e[0] - nx * rr1 * 0.4 + ux * 34, e[1] - ny * rr1 * 0.4 + uy * 34],
    [e[0] + ux * 8, e[1] + uy * 8], [e[0] + nx * rr1 * 0.3 + ux * 22, e[1] + ny * rr1 * 0.3 + uy * 22], [e[0] + nx * rr1 + ux * 4, e[1] + ny * rr1 + uy * 4],
  ];
  const body = top.concat(splinter, bot.slice().reverse());
  c.washPoly(body, '#b45f30', 255);
  c.fillPoly(body, '#d4793a', { opacity: 90, bleed: 0.02, texture: 0.85, border: 0.45 });
  // plum underside
  const under = bot.map((p) => [p[0] - nx * L.r * 0.95, p[1] - ny * L.r * 0.95]).concat(bot.slice().reverse());
  c.washPoly(under, '#5a2644', 240);
  // snapped branch stub
  const bt = 0.42 + 0.1 * k, bx = L.x0 + dx * bt, by = L.y0 + dy * bt;
  const stub = ribbon([[bx - nx * L.r * 0.5, by - ny * L.r * 0.5], [bx - nx * L.r * 1.5 + ux * 14, by - ny * L.r * 1.5 + uy * 14], [bx - nx * L.r * 2.1 + ux * 30, by - ny * L.r * 2.1 + uy * 30]], L.r * 0.7, L.r * 0.36);
  c.washPoly(stub, '#a4542c', 255);
  c.flush();
  // bark painted along the grain: body strokes, top highlights, dark fissures, charred patches
  const along2 = (t0, t1, o) => { const p = (t) => [L.x0 + dx * t - nx * L.r * o * (1 - 0.2 * t), L.y0 + dy * t - ny * L.r * o * (1 - 0.2 * t)]; return [p(t0), p((t0 + t1) / 2), p(t1)]; };
  for (let i = 0; i < 70; i++) {
    const t0 = r(0, 0.9), t1 = Math.min(0.99, t0 + r(0.04, 0.22)), o = r(-0.85, 0.75);
    const top = o > 0.2, kind = r();
    const col = top ? r.pick(['#e88a48', '#f2a860', '#d4773a', '#c8683a']) : o < -0.4 ? r.pick(['#6a2a44', '#4a1a34', '#7a3a4a']) : r.pick(['#b45f30', '#a4502a', '#c86a34', '#8a4028']);
    c.strokePath(along2(t0, t1, o), kind < 0.5 ? 'gouache' : kind < 0.8 ? 'dry' : 'charcoal', col, kind < 0.5 ? r(0.35, 0.7) : r(0.5, 0.9), 0.3);
  }
  for (let i = 0; i < 18; i++) {
    const t0 = r(0, 0.9), t1 = Math.min(0.99, t0 + r(0.05, 0.16)), o = r(-0.6, 0.6);
    c.strokePath(along2(t0, t1, o), 'ink', r.pick(['#2a1020', '#3a1a2a']), r(0.6, 1.0), 0.3);
  }
  for (let i = 0; i < 5; i++) {
    const t = r(0.1, 0.85), o = r(-0.2, 0.5), p = [L.x0 + dx * t - nx * L.r * o, L.y0 + dy * t - ny * L.r * o];
    c.washPoly(ellipsePts(p[0], p[1], r(8, 18), r(3, 6), Math.atan2(dy, dx), 12), r.pick(['#2a1a24', '#3a2230']), 220);
  }
  // cut end: pale end grain with rings
  const ang = Math.atan2(dy, dx);
  c.washPoly(ellipsePts(L.x0, L.y0, L.r * 0.36, L.r * 1.02, ang, 26), '#eaa66a', 255);
  for (const f of [0.72, 0.46, 0.2]) c.strokePath(ellipsePts(L.x0, L.y0, L.r * 0.36 * f, L.r * f, ang, 20), 'wire', '#9a5a2e', 0.8, 0.3);
  c.strokePath(body.concat([body[0]]), 'ink', '#351828', 1.1, 0.3);
}

// Burrow: an earth mound with a dark hole; `front` = only the lip in front of the hole.
function burrowPts() {
  const B = BURROW;
  const mound = [];
  for (let i = 0; i <= 28; i++) {
    const a = Math.PI + (Math.PI * i) / 28;
    mound.push([B.x + Math.cos(a) * B.rx * 2.3, B.y + 6 + Math.sin(a) * B.ry * 2.2 + 3 * Math.sin(i * 1.9)]);
  }
  mound.push([B.x + B.rx * 2.4, B.y + 12], [B.x - B.rx * 2.4, B.y + 12]);
  const hole = ellipsePts(B.x, B.y - 2, B.rx, B.ry, 0, 40);
  const lip = [];
  for (let i = 0; i <= 24; i++) {
    const a = (Math.PI * i) / 24;
    lip.push([B.x + Math.cos(a) * B.rx * 1.02, B.y - 2 + Math.sin(a) * B.ry * 1.02]);
  }
  for (let i = 24; i >= 0; i--) {
    const a = (Math.PI * i) / 24;
    lip.push([B.x + Math.cos(a) * B.rx * 1.6, B.y + 10 + Math.sin(a) * B.ry * 0.9]);
  }
  return { mound, hole, lip };
}
function paintBurrow(c, front) {
  const { mound, hole, lip } = burrowPts();
  if (!front) {
    c.washPoly(mound, '#827487', 255);
    c.fillPoly(mound, '#9a8c9c', { opacity: 70, bleed: 0.02, texture: 0.8, border: 0.4 });
    c.washPoly(hole, '#1b1522', 255);
    c.fillPoly(ellipsePts(BURROW.x, BURROW.y - 6, BURROW.rx * 0.8, BURROW.ry * 0.6, 0, 30), '#2c2233', { opacity: 120, bleed: 0.02, texture: 0.5 });
    const r = c.r;
    for (let i = 0; i < 10; i++) {
      const a = r(Math.PI * 1.05, Math.PI * 1.95), d = r(1.3, 2.1);
      const x = BURROW.x + Math.cos(a) * BURROW.rx * d, y = BURROW.y + 4 + Math.sin(a) * BURROW.ry * d;
      c.strokePath([[x, y], [x + r(8, 20), y + r(-2, 2)]], 'dry', r.pick(['#b3a6b8', '#5d5063']), r(0.3, 0.5), 0.4);
    }
    c.strokePath(mound.slice(0, 29), 'ink', '#4a3e50', 0.9, 0.3);
    // exposed roots curling out of the mound and over the rim of the hole
    for (let i = 0; i < 7; i++) {
      const a = r(Math.PI * 1.08, Math.PI * 1.92), d0 = r(0.95, 1.2), d1 = r(1.6, 2.3);
      const p0 = [BURROW.x + Math.cos(a) * BURROW.rx * d0, BURROW.y + Math.sin(a) * BURROW.ry * d0];
      const p1 = [BURROW.x + Math.cos(a + r(-0.3, 0.3)) * BURROW.rx * d1, BURROW.y + 4 + Math.sin(a) * BURROW.ry * d1 * 1.3];
      const mid = [(p0[0] + p1[0]) / 2 + r(-8, 8), (p0[1] + p1[1]) / 2 + r(-6, 2)];
      c.strokePath([p0, mid, p1], 'gouache', r.pick(['#3a2a30', '#4a3438', '#2a1e26']), r(0.3, 0.55), 0.6);
      c.strokePath([mid, [mid[0] + r(-10, 10), mid[1] + r(4, 10)]], 'wire', '#2a1e26', 0.7, 0.4);
    }
  } else {
    c.washPoly(lip, '#8d7f92', 255);
    c.strokePath(lip.slice(0, 25), 'ink', '#3a3040', 0.9, 0.3);
  }
}

// ---------------------------------------------------------------------------------------------
export function paintLand(P) {
  const G = GROUND;
  const ground = {};
  for (const k of ['burnt', 'green']) {
    ground[k] = P.layer('ground_' + k, { w: G.w, h: G.h, scale: G.scale, seed: 'anc-ground' }, (c) => {
      paintGround(xform(c, M.translate(-G.x, -G.y)), PAL[k], k);
    });
  }
  const rocks = {};
  for (const k of ['grey', 'warm']) {
    rocks[k] = P.layer('rock_' + k, { w: 400, h: 200, scale: 1.5, seed: 'anc-rock' }, (c) => paintRock(c, 200, 100, k === 'warm'));
  }
  const logs = LOGS.map((L, i) => {
    const x0 = Math.min(L.x0, L.x1) - 40, y0 = Math.min(L.y0, L.y1) - 50;
    const w = Math.abs(L.x1 - L.x0) + 80, h = Math.abs(L.y1 - L.y0) + 100;
    const layer = P.layer('log' + i, { w, h, scale: 1.4 }, (c) => {
      paintLog(xform(c, M.translate(-x0, -y0)), L, i);
    });
    return { layer, x0, y0 };
  });
  const bx = BURROW.x - 140, by = BURROW.y - 60;
  const burrowBack = P.layer('burrow', { w: 280, h: 110, scale: 1.4 }, (c) => paintBurrow(xform(c, M.translate(-bx, -by)), false));
  const burrowLip = P.layer('burrowLip', { w: 280, h: 110, scale: 1.4 }, (c) => paintBurrow(xform(c, M.translate(-bx, -by)), true));
  return { ground, rocks, logs, burrow: { back: burrowBack, lip: burrowLip, x: bx, y: by } };
}

// ---------------------------------------------------------------------------------------------
// Green spread ("spilled paint"): origins, timing, and the arrival time at any point.
// ---------------------------------------------------------------------------------------------
export const SPREAD = [
  // x, y: origin (a sprout) ; t: burst time ; R: final radius (x); dur: seconds to reach R
  { x: 870, y: 1808, t: 3.75, R: 900, dur: 2.2 },
  { x: 1340, y: 1802, t: 4.0, R: 820, dur: 2.0 },
  { x: 430, y: 1832, t: 4.15, R: 760, dur: 2.1 },
  { x: 1620, y: 1858, t: 4.3, R: 700, dur: 2.0 },
  { x: 1060, y: 1640, t: 4.45, R: 700, dur: 2.2 },
  { x: 190, y: 1640, t: 4.55, R: 650, dur: 2.0 },
  { x: 1880, y: 1600, t: 4.6, R: 600, dur: 2.0 },
  { x: 600, y: 1560, t: 4.7, R: 700, dur: 2.1 },
];
const SQUASH = 0.34; // ground seen at a grazing angle: blobs are flattened
const spreadEase = (u) => 1 - Math.pow(1 - clamp(u), 2.2);
const spreadInv = (v) => 1 - Math.pow(1 - clamp(v), 1 / 2.2);
export function spreadRadius(s, lt) {
  if (lt <= s.t) return 0;
  return s.R * spreadEase((lt - s.t) / s.dur);
}
// Time at which the paint front reaches (x, y) (Infinity if never).
export function spreadArrival(x, y) {
  let best = Infinity;
  for (const s of SPREAD) {
    const d = Math.hypot(x - s.x, (y - s.y) / SQUASH);
    if (d >= s.R * 0.97) continue;
    const t = s.t + s.dur * spreadInv(d / s.R);
    if (t < best) best = t;
  }
  return best;
}
export const SPREAD_DONE = Math.max(...SPREAD.map((s) => s.t + s.dur));

// Paint the spread mask (world coords under the current transform): flowing blobs with lobes.
export function paintSpread(c, lt) {
  const pts = (s, R, n, wob) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      // lobes: low-frequency noise around the rim that slowly evolves as the paint flows
      const k = 1 + wob * (0.55 * noise1(a * 2.2 + s.x * 0.01, 7) + 0.3 * noise1(a * 5.1 + lt * 0.8 + s.y * 0.01, 9) + 0.15 * Math.sin(a * 9 + s.x));
      out.push([s.x + Math.cos(a) * R * k, s.y + Math.sin(a) * R * k * SQUASH]);
    }
    return out;
  };
  for (const s of SPREAD) {
    const R = spreadRadius(s, lt);
    if (R <= 1) continue;
    c.washPoly(pts(s, R * 1.07 + 6, 72, 0.22), '#000000', 90); // wet rim (partial alpha)
  }
  for (const s of SPREAD) {
    const R = spreadRadius(s, lt);
    if (R <= 1) continue;
    c.washPoly(pts(s, R, 72, 0.22), '#000000', 255);
  }
}
