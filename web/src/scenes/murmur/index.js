// MURMURATION — 20 s, one continuous shot.
//
// One bird crosses a painted dusk. It bursts into a flock of several thousand, and the flock
// spends the film becoming things: a whale, a tree, a face in profile. Then it pours away and
// leaves one bird, on the same line it entered on. The last frame is the first frame.
//
// Everything on screen except the sky is the same ~3400 birds. Nothing cuts, nothing fades.
import { M, TAU, clamp, lerp, invLerp, smoothstep, ease, rng, hex, mixHex, fbm1 } from '../../engine/math.js';
import { figures, BIRD } from './shapes.js';

const N = 5200;          // birds in the flock
const FG = 11;           // near birds, crossing in front
const DUR = 20;
const W2 = TAU / DUR;    // one cycle per film; every wobble frequency is a multiple of this,
                         // which is what makes the last frame identical to the first

// ---------------------------------------------------------------- choreography
// Figure the flock holds, and when. Equal names between two stops = a hold.
const STOPS = [
  { at: 0.0000, fig: 'seed' },
  { at: 2.5000, fig: 'seed' },   // bar 0 beat 4 — the boil starts on the beat
  { at: 4.1667, fig: 'cloud' },  // bar 1 beat 1
  { at: 5.4167, fig: 'whale' },  // bar 1 beat 2.5
  { at: 7.5000, fig: 'whale' },  // bar 2 beat 1
  { at: 9.1667, fig: 'tree' },   // bar 2 beat 3
  { at: 11.6667, fig: 'tree' },  // bar 3 beat 2
  { at: 13.3333, fig: 'face' },  // bar 4 beat 0 — the face lands on the downbeat
  { at: 15.8333, fig: 'face' },  // bar 4 beat 3
  { at: 17.5000, fig: 'cloud' }, // bar 5 beat 1
  { at: 19.1667, fig: 'seed' },  // bar 5 beat 3
  { at: DUR, fig: 'seed' },
];

// The lone bird's line, valid for s in [-0.7, 2.4]. The film ends by replaying it at s = t - 20,
// so the flock's last collapse lands exactly where the first bird began.
function lone(s) {
  return [232 + 176 * s, 468 + 27 * Math.sin(s * 1.15) - 4 * s];
}

// Sky: top colour, horizon colour, glow colour, glow strength. Lerped across the film.
const SKY = [
  { t: 0.0, top: '#141c38', low: '#e39a58', orb: '#ffd9a0', lift: 1.00 },
  { t: 4.2, top: '#101f36', low: '#dd8f5e', orb: '#ffcf96', lift: 0.95 },
  { t: 6.6, top: '#061d2a', low: '#2f8790', orb: '#9fe6dd', lift: 0.80 },
  { t: 10.2, top: '#12283a', low: '#c9ae63', orb: '#ffe6a8', lift: 1.05 },
  { t: 14.4, top: '#221a3a', low: '#c98aa4', orb: '#ffc4cf', lift: 0.92 },
  { t: 17.6, top: '#1a1c3c', low: '#e0955f', orb: '#ffd2a0', lift: 0.98 },
  { t: DUR, top: '#141c38', low: '#e39a58', orb: '#ffd9a0', lift: 1.00 },
];

function skyAt(t) {
  let i = 0;
  while (i < SKY.length - 2 && t >= SKY[i + 1].t) i++;
  const a = SKY[i], b = SKY[i + 1];
  const u = smoothstep(a.t, b.t, t);
  return { top: mixHex(a.top, b.top, u), low: mixHex(a.low, b.low, u), orb: mixHex(a.orb, b.orb, u), lift: lerp(a.lift, b.lift, u) };
}

// ---------------------------------------------------------------- painted assets
function paint(P) {
  const A = {};

  // Bird sprite. Only its alpha is used; every bird is tinted per particle.
  A.bird = P.layer('bird', { w: 120, h: 120, scale: 2, seed: 'bird' }, (c) => {
    for (const poly of BIRD) c.washPoly(poly.map(([x, y]) => [60 + (x + 0.175) * 58, 60 + y * 58]), '#000000', 255);
    c.flush();
  });

  // Three cloud shelves, painted white so they can be tinted into any sky.
  for (let k = 0; k < 3; k++) {
    A['cloud' + k] = P.layer('cloud' + k, { w: 4000, h: 520, seed: 'cl' + k }, (c) => {
      const r = c.r;
      for (let i = 0; i < 40; i++) {
        const cx = r(60, 3940), cy = r(150, 380), rx = r(140, 420), ry = r(26, 72);
        c.fillPoly(c.blob(cx, cy, rx, ry, { n: 40, wobble: 0.34, freq: 2.4, seed: i }), '#ffffff', {
          opacity: r(26, 64), bleed: 0.34, texture: 0.7, border: 0.5, dir: 'out',
        });
      }
      c.flush();
    });
  }

  // Two low ranges. Built from convex vertical strips: p5.brush's watercolour fill
  // triangle-fans a polygon, which on a concave skyline sprays ghost triangles above the
  // peaks and washes the whole layer. Painted white so the sky's colour can tint it.
  A.ridge = P.layer('ridge', { w: 2200, h: 300, seed: 'ridge' }, (c) => {
    const H = (x, base, amp, f0, f1, sd) => base + amp * fbm1(x * f0, sd, 4) + amp * 0.33 * fbm1(x * f1, sd + 3, 3);
    const range = (base, amp, f0, f1, sd, op) => {
      for (let x = 0; x < 2200; x += 8) {
        const y0 = H(x, base, amp, f0, f1, sd), y1 = H(x + 8, base, amp, f0, f1, sd);
        c.washPoly([[x, y0], [x + 8, y1], [x + 8, 300], [x, 300]], '#ffffff', op);
      }
      c.flush();
      for (let x = 0; x < 2200; x += 26) {
        c.strokePath(
          [[x, H(x, base, amp, f0, f1, sd) + 1], [x + 13, H(x + 13, base, amp, f0, f1, sd) + 1], [x + 26, H(x + 26, base, amp, f0, f1, sd) + 1]],
          'dry', '#ffffff', 1.1);
      }
      c.flush();
    };
    range(170, 46, 0.0042, 0.016, 5, 105);   // far range
    range(238, 26, 0.0067, 0.023, 11, 255);  // near range
    for (let i = 0; i < 60; i++) {
      const x = c.r(0, 2200), y = c.r(252, 296);
      c.strokePath([[x, y], [x + c.r(-7, 7), y - c.r(8, 24)]], 'wire', '#ffffff', c.r(0.4, 1.0));
    }
    c.flush();
  });

  return A;
}

// ---------------------------------------------------------------- flock state
const FIG = figures(N);
const R0 = rng('murmur');
const P = new Array(N);
for (let i = 0; i < N; i++) {
  P[i] = {
    born: Math.pow(R0(), 0.75),            // stagger of the boil
    ph: R0(0, TAU), qh: R0(0, TAU),        // wobble phases
    f1: R0.int(2, 4) * W2, f2: R0.int(5, 10) * W2,   // wobble rates, whole cycles per film
    f3: R0.int(2, 5) * W2, f4: R0.int(6, 11) * W2,
    amp: R0(5, 20),                        // wobble amplitude
    z: R0(0.58, 1.30),                     // depth -> size and tone
    lag: R0(0, 1),                         // morph stagger
    swirl: R0(-1, 1),                      // which way it curls through a transit
    jx: R0(-13, 13), jy: R0(-9, 9),        // seed-point jitter
    tone: R0(),
  };
}
const FGB = new Array(FG);
for (let i = 0; i < FG; i++) {
  FGB[i] = { t0: R0(0, DUR), y: R0(120, 940), sp: R0(150, 320), sz: R0(26, 46), up: R0(0, TAU), rate: R0(5, 9), dir: R0() < 0.5 ? -1 : 1 };
}

// Where the flock is, as a figure name + morph progress, at time t.
function stage(t) {
  let i = 0;
  while (i < STOPS.length - 2 && t >= STOPS[i + 1].at) i++;
  const a = STOPS[i], b = STOPS[i + 1];
  return { a: a.fig, b: b.fig, u: invLerp(a.at, b.at, t), moving: a.fig !== b.fig };
}

// Target of bird i in figure `fig` at time t (seed follows the lone bird).
function target(fig, i, t, out) {
  if (fig === 'seed') {
    const s = t > DUR * 0.5 ? t - DUR : t;
    const [x, y] = lone(s);
    const p = P[i];
    out[0] = x + p.jx * 0.5;
    out[1] = y + p.jy * 0.5;
    return;
  }
  const pt = FIG[fig][i];
  out[0] = pt[0];
  out[1] = pt[1];
}

const ta = [0, 0], tb = [0, 0];

// Position of bird i at time t, including the transit swirl and its idle wobble.
function at(i, t, out) {
  const p = P[i];
  const st = stage(t);
  target(st.a, i, t, ta);
  let x, y, transit = 0;
  if (!st.moving) {
    x = ta[0];
    y = ta[1];
  } else {
    target(st.b, i, t, tb);
    // each bird leaves and lands on its own beat, so the cloud peels rather than slides
    const w = 0.42;
    const k = ease.inOutCubic(clamp((st.u - p.lag * w) / (1 - w)));
    transit = Math.sin(Math.PI * clamp(k <= 0 || k >= 1 ? 0 : st.u));
    x = lerp(ta[0], tb[0], k);
    y = lerp(ta[1], tb[1], k);
    // curl the path: birds arc around the midpoint instead of running straight lines
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
  // idle wobble — always breathing, wilder in transit
  const amp = p.amp * (0.26 + 1.80 * transit);
  x += Math.sin(t * p.f1 + p.ph) * amp + Math.sin(t * p.f2 + p.qh) * amp * 0.45;
  y += Math.cos(t * p.f3 + p.qh) * amp * 0.72 + Math.cos(t * p.f4 + p.ph) * amp * 0.3;
  out[0] = x;
  out[1] = y;
  out[2] = transit;
}

// How open the flock is (0 = one bird, 1 = full cloud), for birth and death of birds.
function openness(t) {
  const st = stage(t);
  const v = (f) => (f === 'seed' ? 0 : 1);
  return st.moving ? lerp(v(st.a), v(st.b), ease.inOutSine(st.u)) : v(st.a);
}

// ---------------------------------------------------------------- draw
const buf = [0, 0, 0];
const buf2 = [0, 0, 0];

function draw(R, t) {
  const A = R.assets;
  const S = skyAt(t);
  const top = hex(S.top), low = hex(S.low), orb = hex(S.orb);
  const open = openness(t);

  // --- sky
  R.rect(0, 0, 1920, 1080, [...top, 1], { grad: 'vertical', c1: [...low, 1] });

  // low sun, drifting a little across the film
  const ox = 1290 + 90 * Math.sin(t * W2), oy = 742 + 16 * Math.cos(t * W2);
  R.glow(ox, oy, 320, orb, 0.22 * S.lift, { ext: 3.4, shape: [2.0, 0.45, 2.6] });
  R.glow(ox, oy, 56, orb, 0.38 * S.lift, { ext: 3.0 });

  // --- clouds, three shelves at different speeds
  // The shelves sway rather than scroll: a constant drift has to snap back at the loop point,
  // and 260 units of snap is a visible jump. A sine returns to its start continuously.
  const shelves = [
    { y: 300, sw: 46, ph: 0.0, op: 0.30, sc: 1.25 },
    { y: 470, sw: 78, ph: 1.1, op: 0.42, sc: 1.0 },
    { y: 626, sw: 122, ph: 2.3, op: 0.52, sc: 0.78 },
  ];
  shelves.forEach((sh, k) => {
    const w = 4000 * sh.sc, h = 520 * sh.sc;
    const x = -560 + sh.sw * Math.sin(t * W2 + sh.ph);
    const tint = [lerp(low[0], 1, 0.35), lerp(low[1], 1, 0.35), lerp(low[2], 1, 0.35)];
    R.layer(A['cloud' + k], M.chain(M.translate(x, sh.y - h / 2), M.scale(sh.sc)), { opacity: sh.op, tint, w: 4000, h: 520 });
  });

  // --- horizon
  const ridgeTint = [lerp(top[0], low[0], 0.42), lerp(top[1], low[1], 0.42), lerp(top[2], low[2], 0.42)];
  R.layer(A.ridge, M.translate(-150, 792), { opacity: 0.94, tint: ridgeTint.map((v) => v * 0.30) });

  // --- the flock
  const birds = [];
  const haze = [];
  const dt = 0.030;
  // birds read darker against a bright horizon, and pick up a little of the sky at depth
  const ink = [0.055, 0.052, 0.078];
  for (let i = 0; i < N; i++) {
    const p = P[i];
    const alive = i === 0 ? 1 : smoothstep(p.born * 0.94, p.born * 0.94 + 0.16, open);
    if (alive <= 0.004) continue;
    at(i, t, buf);
    at(i, t + dt, buf2);
    const vx = buf2[0] - buf[0], vy = buf2[1] - buf[1];
    const rot = Math.atan2(vy, vx);
    const speed = Math.hypot(vx, vy);
    const size = (2.5 + 4.0 * p.z) * (1 + 0.22 * Math.min(1, speed / 26));
    // depth haze: distant birds wash toward the sky behind them
    const wash = clamp((1.32 - p.z) * 0.42 + 0.06);
    const cr = lerp(ink[0], low[0], wash), cg = lerp(ink[1], low[1], wash), cb = lerp(ink[2], low[2], wash);
    const a = alive * (0.58 + 0.42 * p.z) * (i === 0 ? 1 : 0.94);
    if (p.z < 0.68) haze.push([buf[0], buf[1], size * 0.48, rot, cr, cg, cb, a * 0.50]);
    else birds.push([buf[0], buf[1], size, rot, cr, cg, cb, a]);
  }
  if (haze.length) R.particles(haze, { kind: 'soft' });
  if (birds.length) R.particles(birds, { kind: 'tex', tex: A.bird });

  // --- near birds crossing in front, for scale
  const fg = [];
  for (const b of FGB) {
    const s = ((t - b.t0) % DUR + DUR) % DUR;   // periodic, so t=20 matches t=0
    if (s > 16) continue;
    const x = b.dir > 0 ? -120 + b.sp * s : 2040 - b.sp * s;
    if (x < -160 || x > 2080) continue;
    const y = b.y + 42 * Math.sin(s * 0.5 + b.up) + 9 * Math.sin(s * b.rate);
    const fade = smoothstep(0, 1.2, s) * (1 - smoothstep(14.4, 16, s));
    const flap = Math.sin(s * b.rate + b.up);
    fg.push([x, y, b.sz * (0.82 + 0.3 * Math.abs(flap)), (b.dir > 0 ? 0 : Math.PI) + flap * 0.22, ink[0], ink[1], ink[2], 0.9 * fade]);
  }
  if (fg.length) R.particles(fg, { kind: 'tex', tex: A.bird });
}

// Motion blur: cheap on the holds, generous while the flock is travelling.
function blur(lt) {
  const st = stage(lt);
  if (!st.moving) return 2;
  return 3 + Math.round(4 * Math.sin(Math.PI * st.u));
}

function post(lt) {
  const S = skyAt(lt);
  return {
    bloom: 0.36 * S.lift,
    threshold: 0.72,
    exposure: 1.03,
    sat: 1.06,
    contrast: 1.05,
    vignette: 0.32,
    paper: 0.30,
    grain: 0.055,
  };
}

export const scene = { id: 'murmur', bg: '#0b1024', paint, draw, blur, post };
