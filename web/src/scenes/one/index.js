// ONE OF MANY — 4 minutes, one continuous shot.
//
//   You were alone. Someone answered you. You lost them.
//   Then you became the one who answers.
//
// Told plainly, on purpose. The film says what it means with intertitles, and the flock says
// the rest with shapes nobody has to decode: a TREE when the bird belongs somewhere, a WHALE
// for the wonder it gets to share, TWO BIRDS side by side when it is loved — and then the
// identical figure with one of them gone. The left-hand bird sits in exactly the same place
// in both, so the loss is something you see rather than something you work out. In between,
// the flock is a formless SWARM: any figure with a clean silhouette reads as an object.
//
// The device that carries it is a CALL: a ring of light leaving the bird, paired with a
// phrase in the score. At the start it calls twice and nothing answers. Later something does.
// After the storm it calls and nothing answers again. At the end a dark, unlit bird is the
// one calling — and our bird answers it, on the oboe, in the voice of the one it lost, and
// the stranger lights up as our bird's own light goes out.
//
// The lit birds are FOREGROUND, an order of magnitude larger than the flock, drawn over a
// dark rim so the wing shape reads against a bright sky. An earlier cut lit them so hard they
// read as a second sun and the whole story went with it.
import { M, TAU, clamp, lerp, invLerp, smoothstep, ease, rng, hex, mixHex, fbm1 } from '../../engine/math.js';
import { figures, BIRD, FEATHER } from '../murmur/shapes.js';

const N = 5600;
const FG = 12;
export const DUR = 240;    // 72 bars at 72 BPM, to the sample
const W2 = TAU / DUR;

const LOSS = 156.67;       // the frame the second light goes out

// ---------------------------------------------------------------- choreography
const STOPS = [
  { at: 0.00, fig: 'none' },
  { at: 43.33, fig: 'none' },       // ACT 1  forty-three seconds of nothing but our bird
  { at: 50.00, fig: 'swarm' },      // ACT 2  the flock arrives
  { at: 56.67, fig: 'tree' },       //        a tree — somewhere to belong
  { at: 76.67, fig: 'tree' },
  { at: 83.33, fig: 'swarm' },
  { at: 96.67, fig: 'whale' },      // ACT 3  wonder, and someone to see it with
  { at: 110.00, fig: 'whale' },
  { at: 116.67, fig: 'twobirds' },  //        TWO BIRDS, side by side
  { at: 143.33, fig: 'twobirds' },
  { at: 150.00, fig: 'chaos' },     // ACT 4  the storm
  { at: 163.33, fig: 'chaos' },
  { at: 173.33, fig: 'tree' },      // ACT 5  the same tree, grey
  { at: 190.00, fig: 'tree' },
  { at: 196.67, fig: 'onebird' },   //        ONE BIRD. The other one's place is empty.
  { at: 216.67, fig: 'onebird' },
  { at: 223.33, fig: 'swarm' },     // ACT 6  the flock disperses
  { at: DUR, fig: 'none' },
];

// ---------------------------------------------------------------- intertitles
// Said out loud, because a film nobody understands is not subtle, it is unfinished.
export const CARDS = [
  { t0: 1.5, t1: 9.0, size: 96, track: 16, lines: ['ONE OF MANY'] },
  { t0: 30.0, t1: 37.5, size: 60, lines: ['It called.', 'Nothing answered.'] },
  { t0: 90.0, t1: 96.5, size: 60, lines: ['Then something did.'] },
  { t0: 170.0, t1: 177.5, size: 60, lines: ['Nothing answered.'] },
  { t0: 208.0, t1: 214.5, size: 60, lines: ['Someone else was alone.'] },
  { t0: 231.0, t1: DUR, size: 70, track: 4, lines: ['Be the one who answers.'] },
];
export const cardAlpha = (c, t) => smoothstep(c.t0, c.t0 + 1.1, t) * (1 - smoothstep(c.t1 - 1.3, c.t1, t));

// ---------------------------------------------------------------- flight paths
const HERO_WP = [
  [-8, 120, 560], [0, 300, 520], [8, 520, 470], [16, 700, 500], [24, 880, 450],
  [32, 1010, 510], [38, 1120, 460], [43, 980, 520],
  [50, 880, 480], [56, 800, 430], [62, 720, 400], [68, 820, 440], [74, 940, 490],
  [80, 1000, 450], [83, 900, 480],
  [88, 800, 500], [92, 720, 470], [96, 780, 440], [102, 900, 420], [108, 1000, 450],
  [114, 940, 490], [120, 860, 450], [126, 780, 430], [132, 880, 410], [138, 980, 450], [143, 900, 480],
  [148, 960, 500], [153, 860, 540], [157, 740, 520], [160, 690, 610],
  [163, 660, 750], [166, 640, 866],                      // dives after the fallen one
  [169, 720, 700], [172, 820, 572],                      // and comes back up alone
  [178, 900, 480], [186, 980, 430], [194, 900, 470], [200, 820, 510], [208, 900, 450], [214, 960, 440],
  [218, 880, 490], [222, 700, 530], [226, 540, 545], [229, 434, 546], [232, 376, 554],
  [235, 350, 570], [238, 336, 652], [242, 318, 816], [248, 304, 1010],  // gives it away, and falls
];
const MATE_WP = [
  [80, 2320, 290], [84, 2060, 316], [88, 1780, 352], [92, 1450, 400], [96, 1120, 442], [100, 900, 470],
];
const HEIR_WP = [
  [202, 150, 884], [207, 196, 834], [212, 250, 786], [217, 296, 718], [222, 348, 632],
  [227, 410, 558], [231, 470, 528], [235, 560, 506], [239, 700, 478], [244, 900, 448], [249, 1120, 420],
];

function pathAt(WP, s) {
  let i = 0;
  while (i < WP.length - 2 && s >= WP[i + 1][0]) i++;
  const p0 = WP[Math.max(0, i - 1)], p1 = WP[i], p2 = WP[Math.min(WP.length - 1, i + 1)], p3 = WP[Math.min(WP.length - 1, i + 2)];
  const u = clamp((s - p1[0]) / ((p2[0] - p1[0]) || 1));
  const cr = (a, b, c, d, x) => 0.5 * (2 * b + (-a + c) * x + (2 * a - 5 * b + 4 * c - d) * x * x + (-a + 3 * b - 3 * c + d) * x * x * x);
  return [cr(p0[1], p1[1], p2[1], p3[1], u), cr(p0[2], p1[2], p2[2], p3[2], u)];
}

function heroAt(t) {
  const [x, y] = pathAt(HERO_WP, t);
  return [x + 7 * Math.sin(t * 0.9), y + 6 * Math.sin(t * 1.7)];
}
// The mate crosses the whole sky to reach our bird, flies with it, is prised away by the
// storm, then is struck: its light goes out and it falls, all the way down and out of frame.
function mateAt(t) {
  const [hx, hy] = heroAt(t);
  const join = smoothstep(98.0, 105.0, t);
  const [ex, ey] = pathAt(MATE_WP, t);
  const orbit = (t - 100) * 0.95;
  const r = lerp(300, 150, join) * (1 - 0.20 * Math.sin((t - 104) * 0.42));
  let x = lerp(ex, hx + Math.cos(orbit) * r, join);
  let y = lerp(ey, hy + Math.sin(orbit) * r * 0.56, join);
  const torn = smoothstep(150.5, LOSS, t);
  x += 330 * torn;
  y -= 120 * torn;
  if (t > LOSS) {
    const f = t - LOSS;
    x += 64 * f + 40 * Math.sin(f * 6.5);
    y += 118 * f * f + 34 * f;                           // straight down, out of the world
  }
  return [x, y];
}
const heirAt = (t) => pathAt(HEIR_WP, t);

const lit = {
  hero: { at: heroAt, from: -8, to: 246 },
  mate: { at: mateAt, from: 80.0, to: 163.0 },
  heir: { at: heirAt, from: 202.0, to: DUR + 6 },
};
// How lit each bird is. The heir is DARK when we meet it — an ordinary bird calling into an
// empty sky, exactly as ours was — and only lights up once it has been answered.
function glowOf(which, t) {
  if (which === 'hero') return smoothstep(-2, 2, t) * (1 - smoothstep(228.5, 233.5, t));
  if (which === 'mate') return smoothstep(80.0, 86.0, t) * (1 - smoothstep(LOSS - 0.1, LOSS + 0.5, t));
  return smoothstep(226.0, 231.5, t);
}

// ---------------------------------------------------------------- the calls
const CALLS = [
  { t: 14.4, who: 'hero' },    // nothing answers
  { t: 24.4, who: 'hero' },    // nothing answers
  { t: 86.4, who: 'mate' },    // the first thing that ever answers
  { t: 88.4, who: 'hero' },
  { t: 128.4, who: 'hero' },
  { t: 130.0, who: 'mate' },
  { t: 193.0, who: 'hero' },   // nothing answers
  { t: 214.4, who: 'heir' },   // someone else is alone now
  { t: 222.4, who: 'hero' },   // and our bird is the one who answers
];

// ---------------------------------------------------------------- sky
const SKY = [
  { t: 0.0, top: '#26354f', low: '#ded1c0', orb: '#f4eada', lift: 0.58 },   // empty, pale, alone
  { t: 32.0, top: '#243350', low: '#e0cfba', orb: '#f7e9d2', lift: 0.62 },
  { t: 52.0, top: '#1d3350', low: '#eec49a', orb: '#ffe3ba', lift: 0.84 },  // the flock arrives
  { t: 66.0, top: '#1c3342', low: '#e6c072', orb: '#fff0bc', lift: 1.06 },  // the tree: gold
  { t: 100.0, top: '#123049', low: '#7fb9b4', orb: '#d8f3ea', lift: 0.94 }, // the whale: deep
  { t: 124.0, top: '#2a2347', low: '#eba887', orb: '#ffd4b2', lift: 1.08 }, // together: rose
  { t: 144.0, top: '#301f42', low: '#e59583', orb: '#ffc6ab', lift: 1.04 },
  { t: 157.0, top: '#1d1830', low: '#6b5c72', orb: '#8d8296', lift: 0.42 }, // the storm
  { t: 172.0, top: '#1b2338', low: '#8b8a9e', orb: '#b3b7c6', lift: 0.48 }, // after: colour gone
  { t: 204.0, top: '#1c2740', low: '#a8a4a6', orb: '#d6cfcb', lift: 0.56 },
  { t: 228.0, top: '#233050', low: '#cdbcac', orb: '#ecdfcb', lift: 0.64 }, // it comes back
  { t: DUR, top: '#243450', low: '#dbcdbb', orb: '#f2e8d6', lift: 0.62 },
];
function skyAt(t) {
  let i = 0;
  while (i < SKY.length - 2 && t >= SKY[i + 1].t) i++;
  const a = SKY[i], b = SKY[i + 1];
  const u = smoothstep(a.t, b.t, t);
  return { top: mixHex(a.top, b.top, u), low: mixHex(a.low, b.low, u), orb: mixHex(a.orb, b.orb, u), lift: lerp(a.lift, b.lift, u) };
}

// ---------------------------------------------------------------- camera
// Never at or below 1.0: the camera drifts and shakes, and any lower slides the frame edge in.
function view(t) {
  const z =
    1.12 +
    0.10 * smoothstep(50, 140, t) -
    0.10 * smoothstep(149, 158, t) +
    0.09 * smoothstep(166, 204, t) -
    0.09 * smoothstep(222, DUR, t);
  const px = 24 * Math.sin(t * W2 * 3) - 30 * smoothstep(60, 140, t) + 30 * smoothstep(204, DUR, t);
  const py = 16 * Math.sin(t * W2 * 5 + 1.1) + 30 * smoothstep(156, 166, t) - 30 * smoothstep(170, 204, t);
  const q = smoothstep(150.5, 152.5, t) * (1 - smoothstep(160.0, 165.0, t));
  const sx = q * 17 * fbm1(t * 5.1, 3, 3), sy = q * 13 * fbm1(t * 4.4, 8, 3);
  return M.place(960 + px + sx, 540 + py + sy, z, q * 0.012 * fbm1(t * 3.3, 12, 2), 960, 540);
}

// ---------------------------------------------------------------- painted assets
function paint(P) {
  const A = {};

  A.bird = P.layer('bird', { w: 120, h: 120, scale: 2, seed: 'bird' }, (c) => {
    for (const poly of BIRD) c.washPoly(poly.map(([x, y]) => [60 + (x + 0.175) * 58, 60 + y * 58]), '#000000', 255);
    c.flush();
  });

  A.feather = P.layer('feather', { w: 140, h: 240, scale: 2, seed: 'feather' }, (c) => {
    for (const poly of FEATHER) c.washPoly(poly.map(([x, y]) => [70 + x * 56, 120 + y * 104]), '#000000', 255);
    c.line(70, 16, 70, 224, 'wire', '#000000', 1.5);
    c.flush();
  });

  for (let k = 0; k < 3; k++) {
    A['cloud' + k] = P.layer('cloud' + k, { w: 4000, h: 520, seed: 'cl' + k }, (c) => {
      const r = c.r;
      for (let i = 0; i < 40; i++) {
        c.fillPoly(c.blob(r(60, 3940), r(150, 380), r(140, 420), r(26, 72), { n: 40, wobble: 0.34, freq: 2.4, seed: i }), '#ffffff', {
          opacity: r(26, 64), bleed: 0.34, texture: 0.7, border: 0.5, dir: 'out',
        });
      }
      c.flush();
    });
  }

  // Convex vertical strips: p5.brush's watercolour fill triangle-fans a polygon, which on a
  // concave skyline sprays ghost triangles and washes the layer. Painted white, so it tints.
  A.ridge = P.layer('ridge', { w: 2200, h: 300, seed: 'ridge' }, (c) => {
    const H = (x, base, amp, f0, f1, sd) => base + amp * fbm1(x * f0, sd, 4) + amp * 0.33 * fbm1(x * f1, sd + 3, 3);
    const range = (base, amp, f0, f1, sd, op) => {
      for (let x = 0; x < 2200; x += 8) {
        c.washPoly([[x, H(x, base, amp, f0, f1, sd)], [x + 8, H(x + 8, base, amp, f0, f1, sd)], [x + 8, 300], [x, 300]], '#ffffff', op);
      }
      c.flush();
      for (let x = 0; x < 2200; x += 26) {
        c.strokePath([[x, H(x, base, amp, f0, f1, sd) + 1], [x + 13, H(x + 13, base, amp, f0, f1, sd) + 1],
          [x + 26, H(x + 26, base, amp, f0, f1, sd) + 1]], 'dry', '#ffffff', 1.1);
      }
      c.flush();
    };
    range(170, 46, 0.0042, 0.016, 5, 105);
    range(238, 26, 0.0067, 0.023, 11, 255);
    for (let i = 0; i < 60; i++) {
      const x = c.r(0, 2200), y = c.r(252, 296);
      c.strokePath([[x, y], [x + c.r(-7, 7), y - c.r(8, 24)]], 'wire', '#ffffff', c.r(0.4, 1.0));
    }
    c.flush();
  });

  A.rain = P.layer('rain', { w: 2400, h: 1400, seed: 'rain' }, (c) => {
    for (let i = 0; i < 300; i++) {
      const x = c.r(0, 2400), y = c.r(0, 1400), L = c.r(40, 130);
      c.strokePath([[x, y], [x - L * 0.22, y + L]], 'wire', '#ffffff', c.r(0.5, 1.4));
    }
    c.flush();
  });

  return A;
}

// ---------------------------------------------------------------- flock state
const FIG = figures(N);
const R0 = rng('oneofmany');
const P = new Array(N);
for (let i = 0; i < N; i++) {
  const a = R0(0, TAU);
  P[i] = {
    born: Math.pow(R0(), 0.7),
    ph: R0(0, TAU), qh: R0(0, TAU),
    f1: R0(0.55, 1.25), f2: R0(1.6, 3.2), f3: R0(0.6, 1.4), f4: R0(1.8, 3.6),
    amp: R0(5, 20),
    z: R0(0.58, 1.30),
    lag: R0(0, 1),
    swirl: R0(-1, 1),
    ox: 960 + Math.cos(a) * R0(1500, 2400), oy: 540 + Math.sin(a) * R0(900, 1500),
    cx: R0(-1, 1), cy: R0(-1, 1), cf: R0(0.5, 1.4), cg: R0(0.7, 1.9),
  };
}
const FGB = new Array(FG);
for (let i = 0; i < FG; i++) {
  FGB[i] = { t0: R0(52, 216), y: R0(120, 940), sp: R0(150, 320), sz: R0(24, 40), up: R0(0, TAU), rate: R0(5, 9), dir: R0() < 0.5 ? -1 : 1 };
}

function stage(t) {
  let i = 0;
  while (i < STOPS.length - 2 && t >= STOPS[i + 1].at) i++;
  const a = STOPS[i], b = STOPS[i + 1];
  return { a: a.fig, b: b.fig, u: invLerp(a.at, b.at, t), moving: a.fig !== b.fig };
}

function target(fig, i, t, out) {
  const p = P[i];
  if (fig === 'none') {
    out[0] = p.ox;
    out[1] = p.oy;
    return;
  }
  if (fig === 'chaos') {
    out[0] = 960 + p.cx * 880 + 300 * Math.sin(t * p.cf + p.ph) + 150 * Math.sin(t * p.cg + p.qh);
    out[1] = 520 + p.cy * 470 + 210 * Math.cos(t * p.cg + p.qh) + 110 * Math.cos(t * p.cf + p.ph);
    return;
  }
  const pt = FIG[fig][i];
  out[0] = pt[0];
  out[1] = pt[1];
}

const ta = [0, 0], tb = [0, 0];

function at(i, t, out) {
  const p = P[i];
  const st = stage(t);
  target(st.a, i, t, ta);
  let x, y, transit = 0;
  if (!st.moving) {
    x = ta[0];
    y = ta[1];
    if (st.a === 'chaos') transit = 1;
  } else {
    target(st.b, i, t, tb);
    const w = 0.42;
    const k = ease.inOutCubic(clamp((st.u - p.lag * w) / (1 - w)));
    transit = Math.sin(Math.PI * clamp(k <= 0 || k >= 1 ? 0 : st.u));
    if (st.a === 'chaos' || st.b === 'chaos') transit = Math.max(transit, 0.75);
    x = lerp(ta[0], tb[0], k);
    y = lerp(ta[1], tb[1], k);
    const mx = (ta[0] + tb[0]) / 2, my = (ta[1] + tb[1]) / 2;
    const dx = x - mx, dy = y - my;
    const ang = p.swirl * 0.85 * Math.sin(Math.PI * k);
    const c = Math.cos(ang), s = Math.sin(ang);
    x = mx + dx * c - dy * s;
    y = my + dx * s + dy * c;
    const spread = 1 + 0.30 * Math.sin(Math.PI * k);
    x = mx + (x - mx) * spread;
    y = my + (y - my) * spread;
  }
  const amp = p.amp * (0.26 + 1.80 * transit);
  x += Math.sin(t * p.f1 + p.ph) * amp + Math.sin(t * p.f2 + p.qh) * amp * 0.45;
  y += Math.cos(t * p.f3 + p.qh) * amp * 0.72 + Math.cos(t * p.f4 + p.ph) * amp * 0.3;
  out[0] = x;
  out[1] = y;
  out[2] = transit;
}

function openness(t) {
  const st = stage(t);
  const v = (f) => (f === 'none' ? 0 : 1);
  return st.moving ? lerp(v(st.a), v(st.b), ease.inOutSine(st.u)) : v(st.a);
}

// ---------------------------------------------------------------- draw
const buf = [0, 0, 0], buf2 = [0, 0, 0];
const INK = [0.05, 0.045, 0.07];

function drawLight(R, which, t, warm) {
  const L = lit[which];
  if (t < L.from || t > L.to) return;
  const g = glowOf(which, t);
  const fn = L.at;
  const [x, y] = fn(t);
  const [x2, y2] = fn(t + 0.05);
  const rot = Math.atan2(y2 - y, x2 - x);
  // A wingbeat, not a pulse. The previous cut breathed +/-20% of its size at 1.5 Hz and the
  // rim scaled with it, which read as a throbbing light rather than a bird.
  const flap = Math.sin(t * 6.6 + (which === 'mate' ? 1.7 : 0));
  const sz = which === 'mate' ? 35 : 38;

  // One soft halo, well under the bloom threshold. An earlier cut used two bright glows and
  // the bird read as a second sun — you could not tell it was a bird at all.
  if (g > 0.01) R.glow(x, y, 44, warm, 0.085 * g, { ext: 2.6 });

  if (g > 0.01) {
    const trail = [];
    for (let k = 1; k <= 6; k++) {
      const [tx, ty] = fn(t - k * 0.085);
      trail.push([tx, ty, sz * (0.68 - 0.08 * k), rot, warm[0], warm[1], warm[2], 0.09 * g * (1 - k / 7)]);
    }
    R.particles(trail, { kind: 'tex', tex: R.assets.bird });
  }

  const wob = sz * (1 + flap * 0.05), ang = rot + flap * 0.05;
  // A soft edge rather than an outline: enough to hold the wing shape against a bright sky,
  // not enough to look like clip art pasted over a painting. It does not scale with the flap.
  R.particles([[x, y, sz * 1.07, ang, 0.11, 0.10, 0.13, 0.40]], { kind: 'tex', tex: R.assets.bird });
  const c = [lerp(0.09, warm[0], g), lerp(0.085, warm[1], g), lerp(0.11, warm[2], g)];
  R.particles([[x, y, wob, ang, c[0], c[1], c[2], 0.96]], { kind: 'tex', tex: R.assets.bird });
}

// The ring a call leaves behind: it stays where it was made and opens outward. An unlit bird
// calls in a pale, colourless ring — it has no light of its own yet.
function drawCalls(R, t, warm, mateWarm) {
  for (const c of CALLS) {
    const a = t - c.t;
    if (a < 0 || a > 2.8) continue;
    const [x, y] = lit[c.who].at(c.t);
    const g = glowOf(c.who, c.t);
    const col = c.who === 'mate' ? mateWarm : g > 0.4 ? warm : [0.82, 0.84, 0.90];
    const u = a / 2.8;
    R.glow(x, y, lerp(30, 320, ease.outCubic(u)), col, (1 - u) * (1 - u) * 0.20, { ext: 1.9, shape: [7.0, 0.9, 1.0] });
  }
}

// One feather, from where the mate was struck, all the way down and out of frame.
function drawFeather(R, t, A) {
  const a = t - (LOSS + 0.3);
  if (a < 0 || a > 13) return;
  const [mx, my] = mateAt(LOSS);
  const x = mx + 66 * Math.sin(a * 0.85) + 12 * a;
  const y = my + 78 * a;
  if (y > 1240) return;
  const fade = smoothstep(0, 0.6, a) * (1 - smoothstep(10.5, 13, a));
  R.layer(A.feather, M.place(x, y, 0.62, 0.55 * Math.sin(a * 0.85) + 0.3, 70, 120),
    { opacity: 0.88 * fade, tint: [0.96, 0.88, 0.76] });
}

function draw(R, t) {
  const A = R.assets;
  const S = skyAt(t);
  const top = hex(S.top), low = hex(S.low), orb = hex(S.orb);
  const open = openness(t);
  const storm = smoothstep(150.0, 153.5, t) * (1 - smoothstep(160.5, 170.0, t));

  R.rect(0, 0, 1920, 1080, [...top, 1], { grad: 'vertical', c1: [...low, 1] });

  // No hot core: a disc of light in the sky is exactly what the audience mistook the bird for.
  const ox = 1290 + 90 * Math.sin(t * W2), oy = 742 + 16 * Math.cos(t * W2);
  R.glow(ox, oy, 420, orb, 0.15 * S.lift, { ext: 3.4, shape: [1.5, 0.30, 2.2] });
  R.glow(ox, oy, 190, orb, 0.10 * S.lift, { ext: 3.0, shape: [1.6, 0.35, 2.0] });

  const shelves = [
    { y: 300, sw: 46, ph: 0.0, op: 0.30, sc: 1.25 },
    { y: 470, sw: 78, ph: 1.1, op: 0.42, sc: 1.0 },
    { y: 626, sw: 122, ph: 2.3, op: 0.52, sc: 0.78 },
  ];
  shelves.forEach((sh, k) => {
    const h = 520 * sh.sc;
    const x = -560 + sh.sw * Math.sin(t * W2 * 4 + sh.ph);
    const tint = [lerp(low[0], 1, 0.35), lerp(low[1], 1, 0.35), lerp(low[2], 1, 0.35)];
    R.layer(A['cloud' + k], M.chain(M.translate(x, sh.y - h / 2), M.scale(sh.sc)),
      { opacity: sh.op * (1 + 0.5 * storm), tint: tint.map((v) => lerp(v, v * 0.35, storm)), w: 4000, h: 520 });
  });

  const ridgeTint = [lerp(top[0], low[0], 0.42), lerp(top[1], low[1], 0.42), lerp(top[2], low[2], 0.42)];
  R.layer(A.ridge, M.translate(-150, 792), { opacity: 0.94, tint: ridgeTint.map((v) => v * 0.30) });

  // --- the flock
  const birds = [], haze = [];
  const dt = 0.030;
  if (open > 0.004) {
    for (let i = 0; i < N; i++) {
      const p = P[i];
      const alive = smoothstep(p.born * 0.94, p.born * 0.94 + 0.16, open);
      if (alive <= 0.004) continue;
      at(i, t, buf);
      at(i, t + dt, buf2);
      const vx = buf2[0] - buf[0], vy = buf2[1] - buf[1];
      const rot = Math.atan2(vy, vx);
      const size = (2.5 + 4.0 * p.z) * (1 + 0.22 * Math.min(1, Math.hypot(vx, vy) / 26));
      const wash = clamp((1.32 - p.z) * 0.42 + 0.06);
      const a = alive * (0.58 + 0.42 * p.z);
      const cr = lerp(INK[0], low[0], wash), cg = lerp(INK[1], low[1], wash), cb = lerp(INK[2], low[2], wash);
      if (p.z < 0.68) haze.push([buf[0], buf[1], size * 0.48, rot, cr, cg, cb, a * 0.50]);
      else birds.push([buf[0], buf[1], size, rot, cr, cg, cb, a]);
    }
  }
  if (haze.length) R.particles(haze, { kind: 'soft' });
  if (birds.length) R.particles(birds, { kind: 'tex', tex: A.bird });

  // --- other birds crossing, but never in Act 1: our bird has to look as alone as it is
  const fgGate = smoothstep(50, 58, t) * (1 - smoothstep(218, 224, t));
  if (fgGate > 0.01) {
    const fg = [];
    for (const b of FGB) {
      const s = t - b.t0;
      if (s < 0 || s > 16) continue;
      const x = b.dir > 0 ? -120 + b.sp * s : 2040 - b.sp * s;
      if (x < -160 || x > 2080) continue;
      const y = b.y + 42 * Math.sin(s * 0.5 + b.up) + 9 * Math.sin(s * b.rate);
      const fade = smoothstep(0, 1.2, s) * (1 - smoothstep(14.4, 16, s)) * (1 - 0.8 * storm) * fgGate;
      const flap = Math.sin(s * b.rate + b.up);
      fg.push([x, y, b.sz * (0.82 + 0.3 * Math.abs(flap)), (b.dir > 0 ? 0 : Math.PI) + flap * 0.22, INK[0], INK[1], INK[2], 0.9 * fade]);
    }
    if (fg.length) R.particles(fg, { kind: 'tex', tex: A.bird });
  }

  if (storm > 0.01) {
    for (let k = 0; k < 2; k++) {
      const yy = ((t * (620 + k * 240)) % 1400) - 1400;
      for (const off of [0, 1400]) {
        R.layer(A.rain, M.chain(M.translate(-240 + k * 90, yy + off), M.scale(1.15)),
          { opacity: 0.30 * storm, tint: [0.86, 0.89, 0.97], w: 2400, h: 1400 });
      }
    }
  }

  // Sit in the same muted watercolour world as everything else. The previous cut was fully
  // saturated and read as a sticker over the painting.
  const warm = [0.84, 0.67, 0.41];        // our bird: old gold
  const mateWarm = [0.83, 0.54, 0.50];    // the one that answers: dusty rose
  drawCalls(R, t, warm, mateWarm);
  drawLight(R, 'mate', t, mateWarm);
  drawFeather(R, t, A);
  drawLight(R, 'heir', t, warm);
  drawLight(R, 'hero', t, warm);
}

function blur(lt) {
  const st = stage(lt);
  if (st.a === 'chaos' || st.b === 'chaos') return 6;
  if (!st.moving) return 2;
  return 3 + Math.round(4 * Math.sin(Math.PI * st.u));
}

function post(lt) {
  const S = skyAt(lt);
  const storm = smoothstep(150.0, 153.5, lt) * (1 - smoothstep(160.5, 170.0, lt));
  return {
    bloom: lerp(0.36, 0.20, storm) * S.lift,
    threshold: 0.72,
    exposure: lerp(1.03, 0.97, storm),
    sat: lerp(1.06, 0.30, storm),
    contrast: lerp(1.05, 1.16, storm),
    vignette: lerp(0.32, 0.52, storm),
    paper: 0.30,
    grain: lerp(0.055, 0.10, storm),
  };
}

export const scene = { id: 'one', bg: '#0b1024', paint, draw, blur, post, view };

// Intertitles live in screen space, above the camera move, as a film overlay.
export const overlay = {
  id: 'cards',
  start: 0,
  end: DUR,
  paint(P) {
    return {
      cards: CARDS.map((c) =>
        P.text(c.lines, {
          font: `400 ${c.size}px Georgia`, color: '#f7eedd', align: 'center',
          letterSpacing: c.track ?? 2, lineHeight: 1.45, pad: 18,
          shadow: { color: 'rgba(0,0,0,0.8)', blur: 20 },
        })),
    };
  },
  draw(R, lt, A) {
    CARDS.forEach((c, i) => {
      const a = cardAlpha(c, lt);
      if (a <= 0.004) return;
      R.rect(0, 0, 1920, 1080, [0, 0, 0, 1], { opacity: 0.38 * a });
      const L = A.cards[i];
      R.layer(L, M.translate(960 - L.w / 2, 536 - L.h / 2), { opacity: a });
    });
  },
};
