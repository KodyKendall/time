// THE MOON THIEF — painted storyboard film.
//
// 8 beats x 15 s = 120 s. Each beat is one painted panel; the storyboard renders one
// still per beat with the same p5.brush painter + WebGL compositor as the main films:
//   node tools/cli.mjs still --film moonthief --w 1280 --t 7.5 --t 22.5 ... --name mt_beat
import { Film } from './engine/film.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, paintBall, makeStars, starParticles } from './scenes/lib/kit.js';
import { C } from './scenes/lib/palette.js';

const W = 1920, H = 1080;

// ---------------------------------------------------------------- helpers (design units)

// Night-sky gradient in convex horizontal strips + solid ground. (p5.brush watercolour
// fills triangle-fan their polygon, so everything here stays convex.)
function skyWash(c, top, horizon, groundY, ground, n = 26) {
  for (let i = 0; i < n; i++) {
    const y0 = (groundY * i) / n, y1 = (groundY * (i + 1)) / n + 1;
    c.washPoly([[-4, y0], [W + 4, y0], [W + 4, y1], [-4, y1]], mixHex(top, horizon, i / (n - 1)), 255);
  }
  c.washPoly([[-4, groundY], [W + 4, groundY], [W + 4, H + 4], [-4, H + 4]], ground, 255);
  c.flush();
}

// Loose dry-brush streaks so flat washes read as paint.
function streaks(c, n, y0, y1, tones, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r(-100, W), y = r(y0, y1), len = r(150, 520), a = r(-0.2, 0.2);
    c.strokePath([[x, y], [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 + r(-14, 14)],
      [x + Math.cos(a) * len, y + Math.sin(a) * len + r(-24, 24)]], r() < 0.6 ? 'dry' : 'gouache',
      r.pick(tones), r(0.8, 2.2));
  }
  c.flush();
}

function pine(c, x, baseY, w, h, color) {
  for (let i = 0; i < 3; i++) {
    const ty = baseY - (h * i) / 3, th = h / 3 + h * 0.14, tw = (w * (3 - i)) / 3;
    c.washPoly([[x - tw / 2, ty], [x + tw / 2, ty], [x, ty - th]], color, 255);
  }
  c.washPoly([[x - w * 0.045, baseY - h * 0.1], [x + w * 0.045, baseY - h * 0.1],
    [x + w * 0.045, baseY], [x - w * 0.045, baseY]], color, 255);
}

function forest(c, baseY, color, s0, s1, seed, gap = 150) {
  const r = rng(seed);
  for (let x = -80; x < W + 120; x += gap * r(0.7, 1.3)) {
    const s = r(s0, s1);
    pine(c, x, baseY + r(-14, 14), 200 * s, 430 * s, color);
  }
  c.flush();
}

// Solid watercolour shape: opaque wash underlay (so dark grounds can't muddy it)
// plus a light textured pass for the painted feel.
function solid(c, pts, color, { texture = 0.18, seed = 0 } = {}) {
  c.washPoly(pts, color, 255);
  c.fillPoly(pts, color, { opacity: 110, bleed: 0.01, texture, border: 0.15 });
}

// Jam jar, y = bottom. An open jar (cork=false) spills light upward.
function jar(c, x, y, w, h, { light = true, cork = true, seed = 1 } = {}) {
  c.washPoly([[x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y], [x - w / 2, y]], '#9fc4d4', 88);
  if (light) {
    solid(c, c.blob(x, y - h * 0.36, w * 0.36, h * 0.30, { n: 32, wobble: 0.15, seed }), '#ffd98a', { texture: 0.15 });
  }
  if (cork) {
    c.washPoly([[x - w * 0.32, y - h - h * 0.13], [x + w * 0.32, y - h - h * 0.13],
      [x + w * 0.32, y - h], [x - w * 0.32, y - h]], '#7a5a38', 255);
  } else {
    c.fillPoly(c.blob(x, y - h - h * 0.35, w * 0.30, h * 0.35, { n: 28, wobble: 0.3, seed: seed + 5 }),
      '#ffe9ad', { opacity: 150, bleed: 0.12, texture: 0.5, border: 0.4 });
  }
  c.strokePath([[x - w * 0.38, y - h * 0.9], [x - w * 0.38, y - h * 0.4], [x - w * 0.30, y - h * 0.16]],
    'wire', '#eaf6ff', 0.9);
  c.flush();
}

// Milo the fox cub, side view facing right, y = ground.
function fox(c, x, y, s) {
  const rust = '#c9722f', dark = '#8a4a1e', cream = C.cream;
  solid(c, c.blob(x, y - 34 * s, 62 * s, 40 * s, { n: 40, wobble: 0.10, seed: 7 }), rust);
  solid(c, c.blob(x - 74 * s, y - 26 * s, 46 * s, 30 * s, { n: 36, wobble: 0.14, rot: 0.5, seed: 9 }), rust);
  solid(c, c.blob(x - 102 * s, y - 22 * s, 20 * s, 16 * s, { n: 28, wobble: 0.2, seed: 11 }), cream);
  const ex = x + 58 * s, ey = y - 52 * s;
  solid(c, c.blob(ex, ey, 30 * s, 28 * s, { n: 32, wobble: 0.08, seed: 13 }), rust);
  c.washPoly([[ex - 18 * s, ey - 16 * s], [ex - 2 * s, ey - 20 * s], [ex - 12 * s, ey - 46 * s]], dark, 255);
  c.washPoly([[ex + 6 * s, ey - 20 * s], [ex + 20 * s, ey - 14 * s], [ex + 16 * s, ey - 42 * s]], dark, 255);
  c.washPoly([[ex + 18 * s, ey + 4 * s], [ex + 36 * s, ey + 10 * s], [ex + 18 * s, ey + 15 * s]], cream, 255);
  c.washPoly(c.blob(ex + 8 * s, ey - 6 * s, 4.5 * s, 5.5 * s, { n: 16, wobble: 0.05, seed: 15 }), '#14100c', 255);
  c.flush();
}

// Owl, front view, y = perch/ground.
function owl(c, x, y, s) {
  const brown = '#5a4a3a';
  solid(c, c.blob(x, y - 60 * s, 52 * s, 62 * s, { n: 40, wobble: 0.08, seed: 21 }), brown);
  solid(c, c.blob(x, y - 38 * s, 32 * s, 40 * s, { n: 32, wobble: 0.1, seed: 23 }), '#cbb99a');
  c.washPoly([[x - 44 * s, y - 106 * s], [x - 20 * s, y - 110 * s], [x - 34 * s, y - 138 * s]], brown, 255);
  c.washPoly([[x + 44 * s, y - 106 * s], [x + 20 * s, y - 110 * s], [x + 34 * s, y - 138 * s]], brown, 255);
  for (const dx of [-20 * s, 20 * s]) {
    solid(c, c.blob(x + dx, y - 86 * s, 15 * s, 16 * s, { n: 24, wobble: 0.05, seed: 25 + dx }), '#f6efce', { texture: 0.1 });
    c.washPoly(c.blob(x + dx, y - 86 * s, 6 * s, 7 * s, { n: 16, wobble: 0.05, seed: 31 + dx }), '#14100c', 255);
  }
  c.washPoly([[x - 7 * s, y - 68 * s], [x + 7 * s, y - 68 * s], [x, y - 54 * s]], C.gold, 255);
  c.flush();
}

// Tapered shaft of moonlight (convex quad).
function beam(c, x1, y1, x2, y2, w1, w2, color, opacity, seed = 3) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  c.fillPoly([[x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2],
    [x2 - nx * w2 / 2, y2 - ny * w2 / 2], [x2 + nx * w2 / 2, y2 + ny * w2 / 2]], color,
    { opacity, bleed: 0.1, texture: 0.25, border: 0.4 });
}

function burrow(c, x, y, w, lit) {
  c.fillPoly(c.blob(x, y + w * 0.18, w, w * 0.42, { n: 48, wobble: 0.06, seed: 41 }), '#2c2318',
    { opacity: 255, bleed: 0.01, texture: 0.5, border: 0.3 });
  const hole = c.blob(x, y - w * 0.06, w * 0.30, w * 0.20, { n: 32, wobble: 0.08, seed: 43 });
  if (lit) solid(c, hole, '#ffdf9a', { texture: 0.12 });
  else c.washPoly(hole, '#05070c', 255);
  c.flush();
}

function caption(P, n, title) {
  return P.text([`BEAT ${n} · ${title}`], {
    font: '600 34px Georgia', color: '#f3e7cf', letterSpacing: 4,
    shadow: { color: 'rgba(0,0,0,0.8)', blur: 6 },
  });
}

const S1 = makeStars('mt1', 200, { y1: 640 });
const S2 = makeStars('mt2', 240, { y1: 700 });
const S3 = makeStars('mt3', 90, { y1: 620 });
const S7 = makeStars('mt7', 260, { y1: 760 });
const S8 = makeStars('mt8', 240, { y1: 700 });

// ---------------------------------------------------------------- beat 1: afraid of the dark
const beat1 = {
  id: 'mt-beat1',
  bg: C.night,
  paint(P) {
    const bg = P.layer('bg', { w: W, h: H }, (c) => {
      skyWash(c, '#0a1120', '#1b2a44', 800, '#0d140f');
      streaks(c, 90, 0, 780, ['#1b2a44', '#24344f', '#0a1120'], 'b1a');
      paintBall(c, 1520, 210, 95, '#f6efce', { lightAngle: -2.6, texture: 0.4 });
      forest(c, 820, '#141d2e', 0.7, 1.0, 'b1far', 190);
      forest(c, 880, '#090e16', 1.1, 1.5, 'b1near', 260);
      burrow(c, 560, 880, 190, false);
      beam(c, 1520, 300, 560, 830, 60, 200, '#f6efce', 40);
      fox(c, 430, 940, 1.15);
    });
    return { bg, cap: caption(P, 1, 'AFRAID OF THE DARK') };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    R.particles(starParticles(S1, lt, { alpha: 0.85 }), { kind: 'glow', blend: 'add' });
    R.glow(1520, 210, 130, '#f6efce', 0.35, { ext: 2.8 });
    R.glow(560, 800, 90, '#f6efce', 0.22, { ext: 2.4 });
    R.layer(A.cap, M.translate(60, 36), { opacity: 0.9 });
  },
};

// ---------------------------------------------------------------- beat 2: the stealing
const beat2 = {
  id: 'mt-beat2',
  bg: '#0d1626',
  paint(P) {
    const bg = P.layer('bg', { w: W, h: H }, (c) => {
      skyWash(c, '#0c1424', '#20334f', 830, '#0e150f');
      streaks(c, 80, 0, 800, ['#20334f', '#16263e', '#0c1424'], 'b2a');
      paintBall(c, 960, 250, 165, '#f8f0d2', { lightAngle: -2.4, texture: 0.35 });
      forest(c, 850, '#0a101c', 0.8, 1.1, 'b2far', 220);
      beam(c, 900, 400, 660, 800, 40, 120, '#f8f0d2', 55);
      beam(c, 990, 405, 1010, 810, 40, 120, '#f8f0d2', 55);
      beam(c, 1060, 395, 1300, 800, 36, 110, '#f8f0d2', 50);
      jar(c, 660, 900, 120, 170, { seed: 61 });
      jar(c, 1010, 910, 140, 195, { seed: 62 });
      jar(c, 1300, 895, 105, 150, { seed: 63 });
      fox(c, 1530, 950, 1.0);
    });
    return { bg, cap: caption(P, 2, 'THE STEALING') };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    R.particles(starParticles(S2, lt, { alpha: 0.8 }), { kind: 'glow', blend: 'add' });
    R.glow(960, 250, 220, '#f8f0d2', 0.3, { ext: 2.8 });
    for (const [jx, jy] of [[660, 830], [1010, 825], [1300, 830]])
      R.glow(jx, jy, 70, '#ffd98a', 0.35, { ext: 2.2 });
    R.layer(A.cap, M.translate(60, 36), { opacity: 0.9 });
  },
};

// ---------------------------------------------------------------- beat 3: a private sun
const beat3 = {
  id: 'mt-beat3',
  bg: '#0a0e18',
  paint(P) {
    const bg = P.layer('bg', { w: W, h: H }, (c) => {
      skyWash(c, '#070b14', '#131c30', 820, '#0c1008');
      streaks(c, 70, 0, 800, ['#131c30', '#070b14'], 'b3a');
      forest(c, 840, '#05080f', 1.0, 1.4, 'b3a', 200);
      burrow(c, 960, 900, 300, true);
      c.fillPoly(c.blob(960, 800, 220, 150, { n: 48, wobble: 0.12, seed: 71 }), '#ffcf7a',
        { opacity: 120, bleed: 0.1, texture: 0.6, border: 0.5 });
      fox(c, 1330, 980, 1.25);
    });
    return { bg, cap: caption(P, 3, 'A PRIVATE SUN') };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    R.particles(starParticles(S3, lt, { alpha: 0.35 }), { kind: 'glow', blend: 'add' });
    R.glow(960, 830, 260, '#ffcf7a', 0.45, { ext: 2.6 });
    R.glow(960, 830, 120, '#ffe9ad', 0.35, { ext: 2.0 });
    R.layer(A.cap, M.translate(60, 36), { opacity: 0.9 });
  },
};

// ---------------------------------------------------------------- beat 4: the dark he made
const beat4 = {
  id: 'mt-beat4',
  bg: C.void,
  paint(P) {
    const bg = P.layer('bg', { w: W, h: H }, (c) => {
      skyWash(c, '#04060c', '#0a0f1a', 840, '#05070a');
      streaks(c, 60, 0, 820, ['#0a0f1a', '#04060c'], 'b4a');
      // pale drained moon
      paintBall(c, 1560, 200, 80, '#8a8267', { lightAngle: -2.6, texture: 0.5 });
      forest(c, 860, '#03050a', 1.0, 1.4, 'b4a', 210);
      // ring of dying jars
      jar(c, 700, 940, 100, 140, { light: false, seed: 81 });
      jar(c, 960, 960, 120, 165, { light: true, seed: 82 });
      jar(c, 1220, 940, 100, 140, { light: false, seed: 83 });
      owl(c, 350, 990, 1.3);
      fox(c, 1520, 990, 1.0);
    });
    return { bg, cap: caption(P, 4, 'THE DARK HE MADE') };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    const flicker = 0.5 + 0.5 * Math.sin(lt * 7.0) * Math.sin(lt * 3.1);
    R.glow(960, 880, 80, '#ffd98a', 0.18 + 0.12 * flicker, { ext: 2.2 });
    R.layer(A.cap, M.translate(60, 36), { opacity: 0.9 });
  },
};

// ---------------------------------------------------------------- beat 5: realization (close-up)
const beat5 = {
  id: 'mt-beat5',
  bg: '#0a0d14',
  paint(P) {
    const bg = P.layer('bg', { w: W, h: H }, (c) => {
      skyWash(c, '#080b12', '#141b2c', 1080, '#0a0c10', 30);
      streaks(c, 110, 0, 1080, ['#141b2c', '#080b12', '#1d2740'], 'b5a');
      jar(c, 640, 1020, 430, 640, { seed: 101 });
      fox(c, 1480, 1030, 3.1);
    });
    return { bg, cap: caption(P, 5, 'REALIZATION') };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    R.glow(640, 780, 200, '#ffd98a', 0.3, { ext: 2.4 });
    R.glow(640, 780, 90, '#ffe9ad', 0.28, { ext: 2.0 });
    R.layer(A.cap, M.translate(60, 36), { opacity: 0.9 });
  },
};

// ---------------------------------------------------------------- beat 6: the climb
const beat6 = {
  id: 'mt-beat6',
  bg: '#101722',
  paint(P) {
    const bg = P.layer('bg', { w: W, h: H }, (c) => {
      skyWash(c, '#1a2436', '#5a6a80', 1080, '#222a30', 30);
      streaks(c, 80, 0, 700, ['#5a6a80', '#2c3a52', '#1a2436'], 'b6a');
      // diagonal hill in convex strips: rises to the right
      const Hs = (x) => 1120 - (x / W) * 560;
      for (let x = -8; x < W + 8; x += 8)
        c.washPoly([[x, Hs(x)], [x + 8, Hs(x + 8)], [x + 8, H + 4], [x, H + 4]], '#131a15', 255);
      c.flush();
      forest(c, 1090, '#0a0e0a', 0.9, 1.2, 'b6far', 260);
      const wx = 1180, wy = Hs(1180);
      // wagon silhouette with its glowing load
      c.washPoly([[wx - 100, wy - 78], [wx + 100, wy - 78], [wx + 100, wy - 24], [wx - 100, wy - 24]], '#14100c', 255);
      c.washPoly(c.blob(wx - 60, wy - 8, 36, 36, { n: 24, wobble: 0.03, seed: 91 }), '#14100c', 255);
      c.washPoly(c.blob(wx + 60, wy - 8, 36, 36, { n: 24, wobble: 0.03, seed: 92 }), '#14100c', 255);
      jar(c, wx - 42, wy - 78, 62, 88, { seed: 94 });
      jar(c, wx + 34, wy - 78, 72, 100, { seed: 95 });
      fox(c, wx - 330, wy + 120, 1.15);
      c.strokePath([[wx - 250, wy + 60], [wx - 170, wy + 10], [wx - 100, wy - 40]], 'wire', '#3a3228', 1.2);
      owl(c, wx + 260, wy - 60, 0.95);
    });
    return { bg, cap: caption(P, 6, 'THE CLIMB') };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    const wx = 1180, wy = 1120 - (wx / W) * 560;
    R.glow(wx, wy - 120, 110, '#ffd98a', 0.35, { ext: 2.4 });
    R.layer(A.cap, M.translate(60, 36), { opacity: 0.9 });
  },
};

// ---------------------------------------------------------------- beat 7: letting go
const beat7 = {
  id: 'mt-beat7',
  bg: '#0b1424',
  paint(P) {
    const bg = P.layer('bg', { w: W, h: H }, (c) => {
      skyWash(c, '#0a1220', '#1c3050', 860, '#0c120c');
      streaks(c, 90, 0, 820, ['#1c3050', '#14263e', '#0a1220'], 'b7a');
      paintBall(c, 960, 215, 120, '#f8f0d2', { lightAngle: -2.4, texture: 0.35 });
      forest(c, 880, '#080d16', 0.9, 1.2, 'b7far', 260);
      beam(c, 620, 780, 880, 320, 70, 200, '#f8f0d2', 60);
      beam(c, 960, 770, 960, 320, 80, 210, '#ffe9ad', 65);
      beam(c, 1300, 780, 1040, 320, 70, 200, '#f8f0d2', 60);
      jar(c, 620, 960, 120, 170, { cork: false, seed: 111 });
      jar(c, 960, 970, 140, 195, { cork: false, seed: 112 });
      jar(c, 1300, 960, 120, 170, { cork: false, seed: 113 });
      fox(c, 1650, 1000, 1.0);
    });
    return { bg, cap: caption(P, 7, 'LETTING GO') };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    R.particles(starParticles(S7, lt, { alpha: 0.95 }), { kind: 'glow', blend: 'add' });
    R.glow(960, 215, 170, '#f8f0d2', 0.35, { ext: 2.8 });
    for (const jx of [620, 960, 1300]) R.glow(jx, 800, 80, '#ffe9ad', 0.35, { ext: 2.2 });
    R.layer(A.cap, M.translate(60, 36), { opacity: 0.9 });
  },
};

// ---------------------------------------------------------------- beat 8: shared glow
const beat8 = {
  id: 'mt-beat8',
  bg: C.night,
  paint(P) {
    const bg = P.layer('bg', { w: W, h: H }, (c) => {
      skyWash(c, '#0c1526', '#27405c', 820, '#0d150f');
      streaks(c, 90, 0, 800, ['#27405c', '#16273e', '#0c1526'], 'b8a');
      paintBall(c, 960, 235, 145, '#f8f0d2', { lightAngle: -2.4, texture: 0.35 });
      beam(c, 960, 370, 960, 830, 200, 420, '#f8f0d2', 30);
      forest(c, 840, '#0a1220', 1.2, 1.7, 'b8far', 170);
      fox(c, 790, 980, 1.2);
      owl(c, 1150, 990, 1.25);
    });
    return { bg, cap: caption(P, 8, 'SHARED GLOW') };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    R.particles(starParticles(S8, lt, { alpha: 0.9 }), { kind: 'glow', blend: 'add' });
    R.glow(960, 235, 200, '#f8f0d2', 0.35, { ext: 2.8 });
    R.glow(960, 850, 150, '#f8f0d2', 0.25, { ext: 2.6 });
    R.layer(A.cap, M.translate(60, 36), { opacity: 0.9 });
  },
};

export async function buildFilm() {
  return new Film({
    fps: 30,
    duration: 120,
    shots: [
      { id: 'b1', scene: beat1, start: 0, end: 15 },
      { id: 'b2', scene: beat2, start: 15, end: 30 },
      { id: 'b3', scene: beat3, start: 30, end: 45 },
      { id: 'b4', scene: beat4, start: 45, end: 60 },
      { id: 'b5', scene: beat5, start: 60, end: 75 },
      { id: 'b6', scene: beat6, start: 75, end: 90 },
      { id: 'b7', scene: beat7, start: 90, end: 105 },
      { id: 'b8', scene: beat8, start: 105, end: 120 },
    ],
  });
}
