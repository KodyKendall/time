// TETHER — the plate film. Nine beats, 2:00.
//
// Each beat is a generated background plate (web/assets/tether/plates, made with tools/gen.mjs)
// with Wren as a held cut-out where she appears, and everything that moves drawn by the engine
// every frame: the kite (a sprite painted once with p5.brush), its string and tail (particle
// lines), the swifts (a simulated flock with flapping wings), rain, light.
//
// v1 of the motion: every cut is designed, and the kite is the thread through them (see TRANS).
// Cameras live on the shots (shot.view) so the film's transitions can drive them.
import { M, TAU, clamp, lerp, smoothstep, ease, hex, rng, viewMatrix } from '../../engine/math.js';
import { C, X, kite as paintKite } from './sketch.js';
import { createWrenRig } from '../../characters/wren/rig.js';
import { firstFlight } from '../../characters/wren/motion.js';

// ---------------------------------------------------------------- timing
// Beat k runs T[k]..T[k+1] (the storyboard's timecodes).
export const T = [0, 12, 27, 40, 52, 68, 80, 92, 106, 120];
export const DUR = 120;

// ---------------------------------------------------------------- art
// `top` crops a 3:2 plate (drawn 1920 wide = 1280 tall) to 16:9.
const PL = (n, top = 100) => ({ src: `assets/tether/plates/bg${n}.png`, top });
export const PLATES = [PL(1, 120), PL(2), PL(3), PL(4, 200), PL(5), PL(6), PL(7), PL(8, 60), PL(9)];

// Cut-outs. feet / hands in image pixels; cropTop trims the model's stub of string above the hands.
export const SPRITES = {
  wren1: { src: 'assets/tether/plates/wren_pose1.png', feet: [420, 1320], hands: [725, 458], cropTop: 440 },
  // string stubs erased above-right of the hands (tools/plate_tools.py unstring), so no crop needed
  wrenCliff: { src: 'assets/tether/plates/wren_cliff.png', feet: [438, 1283], hands: [710, 492] },
  // `feet` here is where her back rests on the ground
  wrenLying: { src: 'assets/tether/plates/wren_lying.png', feet: [845, 712], hands: [568, 315] },
  wrenLean: { src: 'assets/tether/plates/wren_lean.png', feet: [407, 1363], hands: [730, 492] },
  // the snap: pulled off her feet (feet = her boots), then sitting up reaching after it (feet = seat)
  wrenFall: { src: 'assets/tether/plates/wren_fall.png', feet: [510, 1425], hands: [800, 590] },
  wrenReach: { src: 'assets/tether/plates/wren_reach.png', feet: [900, 845], hands: [1124, 152] },
  // the night: walking in with the lantern (hands = the lantern flame), then reaching up into the
  // tree (hands = her raised hand; lantern = the flame in her other hand)
  wrenLantern: { src: 'assets/tether/plates/wren_lantern.png', feet: [484, 1344], hands: [831, 677] },
  wrenTree: { src: 'assets/tether/plates/wren_tree.png', feet: [630, 1372], hands: [676, 116], lantern: [340, 959] },
  // the mend: her right hand alone (plate 8 has it painted out). feet = the needle tip.
  handNeedle: { src: 'assets/tether/plates/hand_needle.png', feet: [283, 330], hands: [283, 330] },
  // Wren's rig (tools/plate_tools.py parts): body without arms, both arms as one piece, the loose
  // scarf ends. Points in each piece's own pixels.
  wrenBody: { src: 'assets/tether/plates/wren_rig_body.png', feet: [300, 870], shoulder: [345, 295], neck: [255, 238] },
  wrenArms: { src: 'assets/tether/plates/wren_rig_arms.png', root: [40, 175], hands: [300, 55] },
  wrenScarf: { src: 'assets/tether/plates/wren_rig_scarf.png', root: [14, 52] },
  // the rescue: her body reaching up (no right arm; lantern low in her left hand) and that arm alone
  treeBody: { src: 'assets/tether/plates/treerig_0.png', feet: [360, 915], shoulder: [450, 210], lantern: [205, 600] },
  treeArm: { src: 'assets/tether/plates/treerig_1.png', root: [60, 575], elbow: [65, 365], hand: [100, 60] },
  // the mend: her forearm in its sleeve (elbow -> cuff) and her hand with the needle
  sewArm: { src: 'assets/tether/plates/sewrig_0.png', elbow: [20, 190], cuff: [690, 185] },
  sewHand: { src: 'assets/tether/plates/sewrig_1.png', wrist: [30, 250], tip: [600, 163], eye: [430, 100] },
  // a painted swift, seen from below, facing right: 2x2 sheet of wing positions
  // (0 wings up, 1 level / glide, 2 down, 3 swept down), split into frames by the loader
  swiftClose: { src: 'assets/tether/plates/swift_close.png', grid: [2, 2] },
  // the rigged swift: side view, [body (facing right), near wing, far wing], each painted alone
  swiftRig: { src: 'assets/tether/plates/swift_parts.png', grid: [3, 1], rig: true },
};

// ---------------------------------------------------------------- layers
// Which layers draw: the studio's toggles (window.FILM_LAYERS) or ?only=plate,wren,code,fx.
const ONLY = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('only') : null;
const show = (name) => {
  const on = typeof window !== 'undefined' && window.FILM_LAYERS ? window.FILM_LAYERS : ONLY ? ONLY.split(',') : null;
  return !on || on.includes(name);
};
// With the code layer off, beats draw into a muted context; the character still draws for real.
let REAL_R = null;
const MUTED = new Proxy({}, { get: (_, k) => (k === 'view' ? M.id() : () => {}) });

// ---------------------------------------------------------------- small helpers
const RGB = (h) => hex(h);
const STRING = RGB('#ede5d3'), STRING_SHADE = RGB('#8f8676'), RIBBON = RGB('#efe4cc'), RIBBON_SHADE = RGB('#a8987c'), BOW = RGB(C.red);
// The light each beat is painted in, applied to everything the code draws (kite, tail, string)
// so it sits in the plate: warm day, gold sunset, violet dusk, blue night, lamplight, morning.
const LIGHT = [[1, 0.97, 0.92], [1, 0.97, 0.92], [1, 0.97, 0.93], [1, 0.98, 0.95], [1, 0.8, 0.6], [0.82, 0.66, 0.82], [0.42, 0.46, 0.6], [1, 0.8, 0.58], [1, 0.95, 0.85]];
let CUR = 0;                                   // beat being drawn (set in draw)
const lit = (c, extra = [1, 1, 1]) => c.map((v, i) => v * LIGHT[CUR][i] * extra[i]);

// A polyline as a run of soft dots (cheap enough to redraw every frame). Opacity varies a little
// along the stroke, fixed per dot, the way paint does.
function line(out, pts, w, col, a = 1) {
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (w * 0.45)));
    for (let j = 0; j < n; j++, k++) {
      const u = j / n, grain = 0.78 + 0.22 * Math.abs(Math.sin(k * 12.9898) * 43758.5453 % 1);
      out.push([lerp(x0, x1, u), lerp(y0, y1, u), w * 1.7, 0, col[0], col[1], col[2], a * grain]);
    }
  }
}
// A painted cord: a darker edge just under a lighter core.
function cord(out, pts, w, core, shade, a = 1) {
  line(out, pts.map(([x, y]) => [x + 0.35 * w, y + 0.5 * w]), w * 1.35, shade, a * 0.5);
  line(out, pts, w, core, a);
}

// Quadratic from a through control q to b: n points, or the single point at u when n is null.
function bez(a, q, b, n = 24) {
  const at = (u) => { const v = 1 - u; return [v * v * a[0] + 2 * v * u * q[0] + u * u * b[0], v * v * a[1] + 2 * v * u * q[1] + u * u * b[1]]; };
  if (n === null) return at;
  return Array.from({ length: n + 1 }, (_, i) => at(i / n));
}

// A string that sags by `sag` (0 = taut) between hand and kite.
function stringPts(a, b, sag) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return bez(a, [mx, my + sag * len * 0.25], b);
}

// Tail: a travelling wave hanging from (x, y) along `ang`. ph advances with time. Two waves of
// different length and speed, and a slow gust in the amplitude, so it never repeats evenly.
function tailPts(x, y, ang, len, amp, ph, n = 30) {
  const pts = [];
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const gust = 0.65 + 0.35 * Math.sin(ph * 0.23 + 1.1) * Math.sin(ph * 0.11);
  for (let i = 0; i <= n; i++) {
    const u = i / n, d = u * len;
    const w = amp * gust * (0.8 * Math.sin(u * 1.5 * TAU - ph) + 0.2 * Math.sin(u * 3.1 * TAU - ph * 1.6 + 0.7)) * (0.15 + 0.85 * u);
    pts.push([x + dx * d + nx * w, y + dy * d + ny * w]);
  }
  return pts;
}

// A free-flying tail: the points are where the kite's bottom tip WAS over the last `span`
// seconds (path: t -> {x, y, s, rot}), sagging with gravity and fluttering, so it streams
// behind whatever the kite actually does.
// The tail is a ribbon of fixed length (len, at kite scale 1): sampling stops once it is used up,
// so a fast kite pulls it straight behind and a slow one lets it hang and curl.
function trailPts(path, t, { span = 1.2, n = 80, droop = 900, flutter = 6, len = 230 } = {}) {
  const pts = [];
  let used = 0, L = len;
  for (let i = 0; i <= n; i++) {
    const age = (i / n) * span, k = path(t - age);
    if (i === 0) L = len * k.s;
    const tx = k.x - Math.sin(k.rot) * 82 * k.s, ty = k.y + Math.cos(k.rot) * 82 * k.s;
    const p = [tx + flutter * k.s * Math.sin(i * 0.22 - t * 5.5) * (used / L), ty + droop * age * age];
    if (pts.length) {
      const q = pts[pts.length - 1], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (used + d >= L) { const f = (L - used) / (d || 1); pts.push([lerp(q[0], p[0], f), lerp(q[1], p[1], f)]); break; }
      used += d;
    }
    pts.push(p);
  }
  // still short (a slow or hovering kite): let the rest hang straight down
  if (used < L && pts.length) { const q = pts[pts.length - 1]; pts.push([q[0], q[1] + (L - used)]); }
  return pts;
}

// The kite's state -> sprite draw + tail. s: scale (1 = 120 units tall). trail: a path to
// stream the tail from (see trailPts); otherwise it hangs and waves along tailAng.
function drawKite(R, A, { x, y, s = 1, rot = 0, tex = 'kite', op = 1, tail = true, ph = 0, tailAng = Math.PI / 2, tailAmp = 14, tailLen = 220, tint = [1, 1, 1], trail = null, t = 0, tailTo = null }) {
  const light = lit([1, 1, 1], tint);
  if (tail) {
    // tail hangs from the bottom tip (local (0, 82)): a painted ribbon with painted bows tied on
    const bx = x - Math.sin(rot) * 82 * s, by = y + Math.cos(rot) * 82 * s;
    const pts = tailTo ? bez([bx, by], [(bx + tailTo[0]) / 2 - 10, (by + tailTo[1]) / 2 + 14], tailTo)
      : trail ? trailPts(trail, t) : tailPts(bx, by, tailAng, tailLen * s, tailAmp * s, ph);
    const parts = [];
    cord(parts, pts, 2.4 * s, lit(RIBBON, tint), lit(RIBBON_SHADE, tint), op * 0.95);
    R.particles(parts, { kind: 'soft' });
    for (const f of [0.22, 0.46, 0.7, 0.93]) {
      const i = Math.round(f * (pts.length - 1)), p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)];
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
      R.layer(A.bow, M.chain(M.translate(p[0], p[1]), M.rotate(a), M.scale(0.5 * s), M.translate(-20, -12)), { opacity: op, tint: light });
    }
  }
  R.layer(A[tex], M.chain(M.translate(x, y), M.rotate(rot), M.scale(s), M.translate(-60, -70)), { opacity: op, tint: light });
}

// Bridle point of a kite drawn at (x, y): where the string attaches. Slightly above centre.
const bridle = (x, y, s, rot) => [x + Math.sin(rot) * 6 * s, y - Math.cos(rot) * 6 * s];

function drawString(R, a, b, sag, w = 1.0, op = 0.85) {
  const parts = [];
  cord(parts, stringPts(a, b, sag), w, lit(STRING), lit(STRING_SHADE), op);
  R.particles(parts, { kind: 'soft' });
}

// Wren cut-out, feet at (x, y), scaled s, gently swaying about her feet. Returns her hands.
function drawSprite(R, A, name, x, y, s, { sway = 0, rot = 0, op = 1, tint = null } = {}) {
  if (!A[name]) name = 'wren1';   // pose not generated yet
  R = REAL_R || R;
  const sp = SPRITES[name], img = A[name];
  const r = rot + sway;
  const top = sp.cropTop || 0;
  const m = M.chain(M.translate(x, y), M.rotate(r), M.scale(s), M.translate(-sp.feet[0], -sp.feet[1] + top));
  if (show('wren') && op > 0.003) R.layer(img, m, { uv: [0, top / img.h, 1, 1], w: img.w, h: img.h - top, opacity: op, ...(tint ? { tint } : {}) });
  return M.apply(m, sp.hands[0], sp.hands[1] - top);
}

const WREN_RIG = createWrenRig(SPRITES);

// ---------------------------------------------------------------- Wren, rigged
// The body pivots at her feet (lean, bounce, breathing); the arms hinge at the shoulder and aim
// where the string goes, plus a tug; the scarf hangs from the back of the collar and flutters.
// Each beat gives her its own behaviour through `pose`. Returns her hands (for the string).
function drawWren(R, A, x, y, s, aim, { lean = 0, bob = 0, breathe = 0, tug = 0, scarf = 0, t = 0, op = 1 } = {}) {
  R = REAL_R || R;
  if (!A.wrenBody || !A.wrenArms) return drawSprite(R, A, 'wren1', x, y, s * 0.235 / 0.22);
  return WREN_RIG.draw(R, A, { x, y, s, aim, lean, bob, breathe, tug, scarf, t, op, visible: show('wren') });
}

// ---------------------------------------------------------------- the kite's path
// The kite is the thread through the cuts, so where it crosses a cut its path is ONE function
// of film time, drawn identically by both beats under identical cameras.

// Beats 1-2: bobbing on the hill, then (from 12 s) settling to the end of the string, jerking
// taut at 15 s, and leaning after the swifts.
function kite1(t) {
  return { x: 1340 + 26 * Math.sin(t * 0.7) + 8 * Math.sin(t * 1.9), y: 300 + 18 * Math.sin(t * 0.9 + 1), rot: 0.32 + 0.08 * Math.sin(t * 1.3), s: 1.15 };
}
function KITE12(t) {
  const a = kite1(t), l = t - 12;
  if (l <= 0) return a;
  const jerk = l > 3 ? Math.exp(-(l - 3) * 3) * Math.sin((l - 3) * 18) * 14 : 0;
  const lean = smoothstep(7, 14, l);
  const b = { x: 1150 + 40 * lean + 6 * Math.sin(l * 1.7), y: 360 - jerk + 6 * Math.sin(l * 1.1), rot: 0.45 + 0.35 * lean + 0.05 * Math.sin(l * 2), s: 1.15 };
  const w = ease.inOutSine(clamp(l / 3));
  return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), rot: lerp(a.rot, b.rot, w), s: 1.15, lean };
}

// Beats 5-6: figure-eights above the clouds, calming; from 68 s the tumble down to the thorn tree.
// The fall ends where beat 7's caught kite sits, seen from beat 6 (see the 6->7 embed).
const FALL_END = [1392, 888];
// Three phases: figure-eights (to 66.5), the stall (66.5-69: the loops die, it rises a little,
// hangs, wobbles and starts to turn over), then the fall (from 69) down to the thorn tree.
const STALL = [66.5, 69.0];
function loop56(t) {
  const l = t - 52, wv = TAU / 8;
  const amp = 1 - 0.5 * smoothstep(11, 16, l);
  const x = 960 + 380 * amp * Math.sin(wv * l), y = 380 + 130 * amp * Math.sin(2 * wv * l);
  const vx = 380 * amp * wv * Math.cos(wv * l), vy = 260 * amp * wv * Math.cos(2 * wv * l);
  return { x, y, rot: clamp(vx / 600, -0.6, 0.6), s: 1.1, heading: Math.atan2(vy, vx), vx, falling: 0 };
}
function stall56(u) {
  const a = loop56(STALL[0]);
  return {
    x: a.x + 30 * ease.outCubic(u), y: a.y - 55 * ease.outCubic(u) + 30 * u * u * u,
    rot: a.rot + 0.28 * Math.sin(u * 9) * u + 1.1 * u * u, s: 1.1, heading: a.heading, vx: 0, falling: 0,
  };
}
function KITE56(t) {
  if (t < STALL[0]) return loop56(t);
  if (t < STALL[1]) {
    const u = (t - STALL[0]) / (STALL[1] - STALL[0]), w = smoothstep(0, 0.4, u);
    const a = loop56(t), b = stall56(u);
    return { ...b, x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), rot: lerp(a.rot, b.rot, w) };
  }
  const st = stall56(1), l6 = t - STALL[1], p = ease.inQuad(clamp(l6 / 10.0));
  const [x, y] = bez([st.x, st.y], [st.x + 340, st.y - 60], FALL_END, null)(p);
  return { x, y, rot: st.rot + l6 * (1.2 + 3.5 * p) + 0.6 * Math.sin(l6 * 2.2), s: lerp(1.1, 0.4, p), heading: 0, vx: 0, falling: p };
}

// ---------------------------------------------------------------- swifts
// A flock simulated ahead of time (boids: separation, alignment, cohesion, plus a goal per bird)
// at 60 Hz and stored at 30 Hz, so any frame can be rendered alone and in any order.
// Birds spawn off-screen and are dropped once they leave it.
const SIM_HZ = 60, STORE_HZ = 30;
function makeFlock({ n, seed, t0, t1, spawn, goal, vmin = 230, vmax = 480, accel = 900, sep = 46, view = 150 }) {
  const r = rng(seed);
  const B = Array.from({ length: n }, (_, i) => ({ i, ...spawn(i, r), z: r(0.5, 1.5), ph: r(0, 1), rate: r(3.6, 5.2), shade: r(-0.12, 0.12), glide: r(0, 1), alive: false, gone: false, x: 0, y: 0, vx: 0, vy: 0 }));
  const frames = Math.ceil((t1 - t0) * STORE_HZ) + 2;
  const buf = new Float32Array(frames * n * 4).fill(NaN);
  const dt = 1 / SIM_HZ, per = SIM_HZ / STORE_HZ;
  for (let s = 0; s < frames * per; s++) {
    const t = t0 + s * dt;
    for (const b of B) {
      if (!b.alive && !b.gone && t >= b.t) { b.alive = true; b.x = b.x0; b.y = b.y0; b.vx = b.vx0; b.vy = b.vy0; }
    }
    for (const b of B) {
      if (!b.alive) continue;
      let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, k = 0;
      for (const o of B) {
        if (o === b || !o.alive) continue;
        const dx = b.x - o.x, dy = b.y - o.y, d2 = dx * dx + dy * dy;
        if (d2 < sep * sep && d2 > 1) { sx += dx / d2; sy += dy / d2; }
        if (d2 < view * view) { ax += o.vx; ay += o.vy; cx += o.x; cy += o.y; k++; }
      }
      const [gx, gy, gw = 1] = goal(b, t);
      let fx = sx * sep * 18, fy = sy * sep * 18;
      if (k) { fx += (ax / k - b.vx) * 0.9 + (cx / k - b.x) * 0.8; fy += (ay / k - b.vy) * 0.9 + (cy / k - b.y) * 0.8; }
      const gd = Math.hypot(gx - b.x, gy - b.y) || 1;
      fx += ((gx - b.x) / gd) * 520 * gw; fy += ((gy - b.y) / gd) * 520 * gw;
      fx += 140 * Math.sin(t * 1.3 + b.ph * 9); fy += 140 * Math.cos(t * 1.1 + b.ph * 7);   // a little wander
      const fm = Math.hypot(fx, fy);
      if (fm > accel) { fx *= accel / fm; fy *= accel / fm; }
      b.vx += fx * dt; b.vy += fy * dt;
      const v = Math.hypot(b.vx, b.vy);
      const vc = clamp(v, vmin, vmax);
      b.vx *= vc / v; b.vy *= vc / v;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (t - b.t > 1.5 && (b.x < -320 || b.x > 2240 || b.y < -320 || b.y > 1400)) { b.alive = false; b.gone = true; }
    }
    if (s % per === 0) {
      const f = s / per;
      for (const b of B) if (b.alive) buf.set([b.x, b.y, b.vx, b.vy], (f * n + b.i) * 4);
    }
  }
  // State of every visible bird at time t: [x, y, heading, z, flapFrame].
  return (t) => {
    const fpos = (t - t0) * STORE_HZ;
    if (fpos < 0 || fpos >= frames - 1) return [];
    const f0 = Math.floor(fpos), u = fpos - f0, out = [];
    for (const b of B) {
      const o0 = (f0 * n + b.i) * 4, o1 = o0 + n * 4;
      if (Number.isNaN(buf[o0]) || Number.isNaN(buf[o1])) continue;
      const x = lerp(buf[o0], buf[o1], u), y = lerp(buf[o0 + 1], buf[o1 + 1], u);
      const vx = lerp(buf[o0 + 2], buf[o1 + 2], u), vy = lerp(buf[o0 + 3], buf[o1 + 3], u);
      const g = glideAmount(b, t, vy);
      out.push([x, y, Math.atan2(vy, vx), b.z, flapFrame(b, t, vy), b.shade, t * b.rate + b.ph, g]);
    }
    return out;
  };
}

// Swifts flap in bursts and glide between them; climbing birds flap more.
const NFRAMES = 6;
// 0 flapping .. 1 gliding, eased in and out so the wings settle into and out of a glide.
function glideAmount(b, t, vy) {
  const u = (((t * 0.45 + b.glide) % 1) + 1) % 1, on = vy < -120 ? 0.6 : 0.35;
  return smoothstep(on, on + 0.08, u) * (1 - smoothstep(0.92, 1, u));
}
function flapFrame(b, t, vy) {
  const burst = ((t * 0.45 + b.glide) % 1) < (vy < -120 ? 0.6 : 0.35);
  if (!burst) return 0;
  return Math.floor((((t * b.rate + b.ph) % 1) + 1) % 1 * NFRAMES);
}

function paintRig(P, A) {
  const f = SPRITES.swiftRig.frames;
  if (!f) return;
  [A.rigBody, A.rigWing, A.rigWingFar] = f.map((cv) => P.image(cv, { w: cv.width, h: cv.height }));
}

// ---- the rigged swift
// Body painted side-on facing right; each wing painted flat. Per frame the wing hinges at the
// shoulder: its 3D direction (out toward us, swept back, raised by the flap angle) is projected
// onto the screen, so it reaches up, foreshortens to a stub as it points at us mid-stroke, and
// reaches down. Timing lingers at the top and bottom; the downstroke is faster than the recovery.
const SHOULDER = [0.6, 0.36];            // on the body frame, as fractions of its size
function flapAngle(phase) {
  const p = ((phase % 1) + 1) % 1;
  const q = p < 0.42 ? (p / 0.42) * 0.5 : 0.5 + ((p - 0.42) / 0.58) * 0.5;   // fast down, slow up
  const c = Math.cos(q * TAU);
  return 1.05 * Math.sign(c) * Math.pow(Math.abs(c), 0.6);                // ~60 deg, lingering at extremes
}
function drawSwift(R, A, x, y, len, heading, phase, glide, tint = [1, 1, 1], op = 1) {
  const body = A.rigBody, wing = A.rigWing, far = A.rigWingFar, an = SPRITES.swiftRig.anchors;
  if (!body || !an) return;
  const vx = Math.cos(heading), vy = Math.sin(heading), left = vx < 0;
  const tilt = clamp(Math.atan2(vy, Math.abs(vx)), -0.7, 0.7);
  const s = len / body.w;
  const alpha = lerp(flapAngle(phase), 0.18, glide);                  // gliding: wings held a little up
  const bob = (1 - glide) * Math.sin(phase * TAU) * 0.05 * body.h;    // body rises on the downstroke
  // whole bird: position, facing, tilt; then body space (pixels of the body frame)
  const B = M.chain(M.translate(x, y), M.rotate(left ? -tilt : tilt), M.scale(left ? -s : s, s), M.translate(-body.w / 2, -body.h / 2 + bob));
  const sh = [SHOULDER[0] * body.w, SHOULDER[1] * body.h];
  const wingTo = (W, a, lenK, sweep, dark) => {
    const { root, tip } = a;
    const wl = Math.hypot(tip[0] - root[0], tip[1] - root[1]), a0 = Math.atan2(tip[1] - root[1], tip[0] - root[0]);
    // projected wing: back along the body by `sweep`, up/down by the flap
    const px = -sweep, py = -Math.sin(alpha), pl = Math.hypot(px, py);
    const L = body.w * 1.05 * lenK;
    const m = M.chain(B, M.translate(sh[0], sh[1]), M.rotate(Math.atan2(py, px)), M.scale((L * pl) / wl, lerp(0.75, 1, pl)), M.rotate(-a0), M.translate(-root[0], -root[1]));
    R.layer(W, m, { opacity: op, tint: tint.map((v) => v * dark) });
  };
  wingTo(far, an[2], 0.9, lerp(0.55, 0.75, glide), 0.72);              // far wing, behind
  R.layer(body, B, { opacity: op, tint });
  wingTo(wing, an[1], 1.0, lerp(0.42, 0.7, glide), 1.0);                // near wing, in front
}

// Draw birds [x, y, heading, z, frame, shade, phase, glide]. With the painted swift loaded, each bird is that
// painting: mirrored to face where it's going, tilted with its climb or dive, smaller and fainter
// with distance, tinted for the light it's in. Otherwise the code-painted silhouette particles.
const WINGBEAT = [1, 0, 1, 2, 3, 2];   // silhouette frame (0 = glide, 1-5 a wingbeat) -> painted frame
function drawFlock(R, A, birds, { size = 30, ink = [0.1, 0.12, 0.17], haze = null, depth = null, tint = [1, 1, 1] } = {}) {
  if (A.rigBody) {
    for (const [x, y, h, z, f, shade = 0, phase = 0, glide = 0] of birds) {
      const zz = depth ? z * depth(x, y) : z;
      drawSwift(R, A, x, y, size * zz * 1.5, h, phase, glide, tint.map((v) => clamp(v * 0.6 * (1 + shade))), clamp(0.6 + 0.4 * zz));   // darker, as birds read against the sky
    }
    return;
  }
  if (A.swiftClose0) {
    for (const [x, y, h, z, f, shade = 0] of birds) {
      const zz = depth ? z * depth(x, y) : z;
      const L = A['swiftClose' + WINGBEAT[f]];
      const vx = Math.cos(h), vy = Math.sin(h), left = vx < 0;
      const tilt = clamp(Math.atan2(vy, Math.abs(vx)), -0.7, 0.7);
      const s = (size * zz * 2.6) / L.w;                       // size ~ a silhouette's span
      const sh = 1 + shade;
      R.layer(L, M.chain(M.translate(x, y), M.rotate(left ? -tilt : tilt), M.scale(left ? -s : s, s), M.translate(-L.w / 2, -L.h / 2)),
        { opacity: clamp(0.55 + 0.45 * zz), tint: tint.map((v) => clamp(v * sh)) });
    }
    return;
  }
  const groups = Array.from({ length: NFRAMES }, () => []);
  for (const [x, y, h, z, f, shade = 0] of birds) {
    const zz = depth ? z * depth(x, y) : z;
    const w = haze ? clamp((1.3 - zz) * 0.6 + shade) : 0;
    const c = haze ? ink.map((v, i) => lerp(v, haze[i], w)) : ink;
    groups[f].push([x, y, size * zz, h, c[0], c[1], c[2], 0.96]);
  }
  groups.forEach((g, f) => { if (g.length) R.particles(g, { kind: 'tex', tex: A['bird' + f] }); });
}

// Paint the six wing frames: a swift from above, facing +x. Frame 0 is the glide (wings fully
// out and swept back); the rest are one wingbeat, the wings foreshortening as they rise.
const SPAN = [1.0, 0.93, 0.78, 0.62, 0.78, 0.93];
function paintBirds(P, A) {
  SPAN.forEach((span, f) => {
    A['bird' + f] = P.layer('bird' + f, { w: 120, h: 120, scale: 2 }, (c) => {
      const cy = 60;
      c.washPoly(c.blob(64, cy, 19, 5.6, { n: 24, wobble: 0.02 }), '#000000', 255);   // body
      c.washPoly(c.blob(82, cy, 5.5, 4.6, { n: 16, wobble: 0.02 }), '#000000', 255);   // head
      c.washPoly([[48, cy - 2], [26, cy - 9], [30, cy - 1]], '#000000', 255);           // forked tail
      c.washPoly([[48, cy + 2], [26, cy + 9], [30, cy + 1]], '#000000', 255);
      for (const s of [-1, 1]) {
        const reach = 34 * span, sweep = 12 + 8 * span;
        const el = [62 - sweep * 0.35, cy + s * (6 + reach * 0.45)];
        const tip = [62 - sweep, cy + s * (6 + reach)];
        c.washPoly([[70, cy + s * 2.5], [56, cy + s * 3.5], [el[0] - 4, el[1]], [el[0] + 5, el[1] - s * 1]], '#000000', 255);
        c.washPoly([[el[0] + 5, el[1] - s * 1], [el[0] - 4, el[1]], [tip[0] - 3, tip[1]], [tip[0] + 1, tip[1] - s * 2]], '#000000', 255);
      }
      c.flush();
    });
  });
}

// Beat 2: the swifts pour in from behind the cliff, sweep past the kite, and away over the sea.
const FLOCK2 = makeFlock({
  n: 34, seed: 'swifts-2', t0: 15.5, t1: 27.6,
  spawn: (i, r) => ({ t: 16 + i * 0.1 + r(0, 0.4), x0: r(-260, -80), y0: r(520, 820), vx0: r(300, 420), vy0: r(-200, -80) }),
  goal: (b, t) => {
    if (t - b.t < 2.6) { const k = KITE12(t); return [k.x + 140 + (b.ph - 0.5) * 300, k.y - 40 + (b.glide - 0.5) * 220, 1]; }
    return [2400, 60 + b.ph * 180, 1.2];
  },
});
// Beat 5: they come in from the right and sweep with the kite: the flock streams along one long
// figure-eight that runs past both edges of the frame (so they swoop across, out, and back),
// each bird a little behind the one ahead. At ~63 s they peel away and leave the kite alone.
const SWEEP5 = (t) => { const w = TAU / 12, a = w * (t - 52) - 0.6; return [960 + 1150 * Math.sin(a), 360 + 230 * Math.sin(2 * a)]; };
const FLOCK5 = makeFlock({
  n: 26, seed: 'swifts-5', t0: 51.2, t1: 68.2, vmin: 260, vmax: 520, accel: 1100,
  spawn: (i, r) => ({ t: 51.4 + i * 0.09 + r(0, 0.3), x0: r(2020, 2200), y0: r(200, 520), vx0: r(-460, -340), vy0: r(-60, 60) }),
  goal: (b, t) => {
    if (t > 63 + b.ph * 1.5) return [2500, 220 + b.glide * 200, 1.2];
    const [gx, gy] = SWEEP5(t + 0.6 - b.i * 0.08);
    return [gx + (b.ph - 0.5) * 160, gy + (b.glide - 0.5) * 120, 1.3];
  },
});
// Beat 9: they come back and circle the kite, and stay.
// Beat 4: flung from the post up and to the right, fast, then out of frame.
const KITE4 = (l) => {
  const p = ease.outCubic(clamp(l / 1.7));
  return { x: lerp(1180, 2150, p), y: lerp(560, -420, p) + 120 * Math.sin(p * Math.PI) * 0.3, rot: lerp(0.5, 1.1, p), s: lerp(0.95, 0.8, p) };
};
const KITE9 = (l) => {
  const climb = ease.inOutSine(clamp(l / 9));
  return { x: lerp(1000, 1640, climb) + 10 * Math.sin(l * 0.8), y: lerp(560, 160, climb) + 8 * Math.sin(l * 1.1), rot: 0.42 + 0.04 * Math.sin(l * 1.4), s: lerp(1.0, 0.75, climb) };
};
const FLOCK9 = makeFlock({
  n: 16, seed: 'swifts-9', t0: 109.5, t1: 120.2, vmin: 180, vmax: 380,
  spawn: (i, r) => ({ t: 110 + i * 0.12 + r(0, 0.3), x0: r(2020, 2200), y0: r(40, 360), vx0: r(-380, -260), vy0: r(-40, 60) }),
  // one ring, everyone chasing the bird ahead, all the same way round
  goal: (b, t) => {
    const k = KITE9(t - 106), th = 1.1 * (t - 106) - b.i * 0.38;
    return [k.x + Math.cos(th) * 250, k.y + 20 + Math.sin(th) * 120, 1.2];
  },
});

// ---------------------------------------------------------------- the beats
// Each gets (R, A, l, d): local seconds (negative or past d inside a transition) and duration.
// cam: [from, to] as [scale, focusX, focusY]. Where the kite crosses a cut, the outgoing beat's
// `to` equals the incoming beat's `from`, so the kite lands on the same pixels in both.
const BEATS = [
  // 1. First flight
  {
    cam: [[1.0, 900, 420], [1.06, 900, 420]],
    draw(R, A, l, d, t) {
      const k = KITE12(t);
      // playful: a light bounce in her step, arms following the kite as it bobs
      const hands = drawWren(R, A, 360, 663, 0.22, [k.x, k.y], {
        ...firstFlight(l), t: l });
      drawString(R, hands, bridle(k.x, k.y, k.s, k.rot), 0.12 + 0.04 * Math.sin(l * 0.9));
      drawKite(R, A, { ...k, ph: t * 2.2, tailAng: 1.9, tailAmp: 14 });   // lazy curls
    },
  },
  // 2. The end of the string: the kite jerks taut; the swifts pour past and away.
  {
    cam: [[1.06, 900, 420], [1.03, 1080, 420]],
    draw(R, A, l, d, t) {
      const k = KITE12(t), lean = k.lean || 0;
      // braced on the cliff: the jerk at 0:15 yanks her arms forward and she leans back into it
      const yank = l > 3 ? Math.exp(-(l - 3) * 2.5) * Math.sin((l - 3) * 9) : 0;
      const hands = drawWren(R, A, 300, 779, 0.19, [k.x, k.y], {
        lean: -0.06 - 0.06 * smoothstep(3, 3.6, l) + 0.05 * yank, bob: 0, breathe: 0.008 * Math.sin(l * 2.2),
        tug: 0.18 * yank + 0.04 * Math.sin(l * 1.1) - 0.1 * lean, scarf: 0.8, t: l });
      drawString(R, hands, bridle(k.x, k.y, k.s, k.rot), lerp(0.15, 0, smoothstep(2.5, 3.1, l)));
      // The distant flock passes behind the kite.
      drawFlock(R, A, FLOCK2(t), { size: 34, depth: (x) => lerp(1, 0.4, smoothstep(1100, 1950, x)), haze: [0.74, 0.84, 0.94] });
      // streaming flatter and quicker as it strains after the birds
      drawKite(R, A, { ...k, ph: t * lerp(2.4, 3.6, lean), tailAng: lerp(1.9, 0.6, lean), tailAmp: lerp(14, 9, lean) });
    },
  },
  // 3. Tugging: close on the post; the string saws across its corner, frays, and parts.
  {
    cam: [[1.0, 1000, 250], [1.14, 1000, 250]],
    // the last second and a half: punch in on the rub point for the snap
    view: (l, d) => { const k = ease.inCubic(smoothstep(d - 1.5, d, l)); return M.chain(M.translate(1000, 250), M.scale(1 + 0.9 * k), M.translate(-1000, -250)); },
    draw(R, A, l, d) {
      const u = l / d;
      const snap = smoothstep(d - 0.3, d, l);   // the strand parting
      const fury = 0.4 + 0.6 * smoothstep(0, d, l);
      const kx = 1760 + 60 * Math.sin(l * 2.3) * fury, ky = 120 + 40 * Math.sin(l * 3.1 + 1) * fury;
      const saw = 9 * Math.sin(l * 2.3);
      const P1 = [1000 + saw, 250];   // the post's worn top-right corner in plate 3
      const w = lerp(2.4, 0.8, smoothstep(0.55, 1, u));            // wearing down to one strand
      const parts = [];
      if (snap <= 0) {
        line(parts, bez([-30, 840], [480, 600 + 20 * Math.sin(l * 2.3)], P1), w, lit(STRING));
        line(parts, bez(P1, [1380, 200], bridle(kx, ky, 0.55, 0.9)), w * 0.8, lit(STRING));
      } else {
        // the two ends whip apart: hers recoils down-left, the kite's flies up-right
        const lower = bez([-30, 840], [480, 600], P1, 24).slice(0, Math.round(24 * (1 - 0.45 * snap)));
        line(parts, lower.map(([x, y], i) => [x, y + 30 * snap * Math.sin(i * 0.6)]), w, lit(STRING));
        const upper = bez(P1, [1380, 200], bridle(kx, ky, 0.55, 0.9), 24).slice(Math.round(24 * 0.4 * snap));
        line(parts, upper.map(([x, y]) => [x + 60 * snap, y - 40 * snap]), w * 0.8, lit(STRING));
      }
      // frayed strands at the rub point, more as it goes
      const nf = Math.floor(2 + 10 * clamp(u));
      for (let i = 0; i < nf; i++) {
        const a = -2.4 + (i / nf) * 2.6 + 0.2 * Math.sin(l * 7 + i), len = 10 + 26 * ((i * 37) % 10) / 10;
        line(parts, [P1, [P1[0] + Math.cos(a) * len * 0.5, P1[1] + Math.sin(a) * len * 0.5 - 3], [P1[0] + Math.cos(a) * len, P1[1] + Math.sin(a) * len]], 0.6, lit(STRING), 0.9);
      }
      R.particles(parts, { kind: 'soft' });
      drawKite(R, A, { x: kx, y: ky, s: 0.55, rot: 0.9 + 0.3 * Math.sin(l * 2.3), ph: l * (4 + 3 * fury), tailAng: 1.7, tailAmp: 14 + 12 * fury });   // thrashing
    },
  },
  // 4. Snap: a flash; the kite rockets up and away trailing the broken end; Wren on her back.
  {
    cam: [[1.02, 960, 600], [1.0, 960, 600]],
    // the camera follows the kite up for a moment (the 4->5 tilt carries on from here)
    view: (l) => { const k = ease.outCubic(clamp(l / 1.6)); return M.translate(0, 140 * k); },
    draw(R, A, l) {
      // Wren: yanked backward off her feet, down on her back, then up on one hand reaching after it
      const tip = ease.inQuad(clamp(l / 0.75));
      const toLying = smoothstep(0.55, 0.85, l), toReach = smoothstep(2.1, 2.5, l);
      const fallHands = drawSprite(R, A, 'wrenFall', 470, 862 - 30 * Math.sin(tip * Math.PI), 0.2, { rot: -0.55 * tip, op: 1 - toLying });
      const lyingHands = drawSprite(R, A, 'wrenLying', 450, 860, 0.2, { op: toLying * (1 - toReach) });
      drawSprite(R, A, 'wrenReach', 470, 862, 0.2, { op: toReach, rot: 0.02 * Math.sin(l * 2.2) * toReach });
      // her end of the string: in her hands as she falls, then collapsing onto the grass
      const hands = toLying > 0.5 ? lyingHands : fallHands;
      const fall = ease.outCubic(clamp(l / 2.2));
      const parts = [];
      line(parts, bez(hands, [hands[0] + 140, lerp(hands[1] - 260, 840, fall)], [hands[0] + 420, 868]), 1.1, lit(STRING));
      R.particles(parts, { kind: 'soft' });
      // the kite, away: released tension flings it up and right, gone in under two seconds
      const k = KITE4(l);
      if (k.y > -400) {
        const end = [];
        const path = (tt) => KITE4(tt - 40);
        // the broken end of the string whips along behind it
        const pts = [];
        for (let i = 0; i <= 14; i++) { const kk = path(40 + l - i * 0.02); const b = bridle(kk.x, kk.y, kk.s, kk.rot); pts.push([b[0], b[1] + 260 * (i * 0.02) ** 2]); }
        line(end, pts, 1.0, lit(STRING));
        R.particles(end, { kind: 'soft' });
        drawKite(R, A, { ...k, trail: path, t: 40 + l });
      }
      // the flash
      const f = l >= 0 ? Math.exp(-l * 3.2) : 0;
      if (f > 0.01) { R.fill([1, 1, 1, 1], { opacity: 0.85 * f }); R.glow(1200, 520, 260, [1, 1, 1], 1.2 * f); }
    },
  },
  // 5. Free: loops above the sunset clouds inside the flock; then the flock leaves.
  {
    cam: [[1.0, 960, 420], [1.05, 960, 420]],
    draw(R, A, l, d, t) {
      drawFreeKite(R, A, t);
      drawFlock(R, A, FLOCK5(t), { size: 30, tint: [0.62, 0.45, 0.42] });   // dark against the sunset
    },
  },
  // 6. Nothing to push against: the same kite, on the same pixels, starts to tumble.
  {
    cam: [[1.05, 960, 420], [1.0, 1150, 600]],
    draw(R, A, l, d, t) {
      drawFreeKite(R, A, t);   // the tail streams out behind the tumble by itself
    },
  },
  // 7. The thorn tree: rain; the torn kite hangs in the branches; a lantern comes across the hill:
  // it's Wren. She reaches up, and the kite drops out of the branches into her hand.
  {
    cam: [[1.0, 1300, 560], [1.07, 1300, 560]],
    draw(R, A, l) {
      const sway = 0.05 * Math.sin(l * 1.1) + 0.02 * Math.sin(l * 3.7);
      // Wren: small on the far hill, nearer with each step, then under the tree reaching up
      const [lx, ly, , walkP] = lanternAt(l);
      const toTree = smoothstep(8.1, 8.9, l);
      if (l > 1.3) {
        const ws = lerp(0.07, TREE_S, walkP), wl = SPRITES.wrenLantern;
        const feet = [lx + (wl.feet[0] - wl.hands[0]) * ws, ly + (wl.feet[1] - wl.hands[1]) * ws];
        drawSprite(R, A, 'wrenLantern', feet[0], feet[1], ws, { op: smoothstep(1.3, 2.2, l) * (1 - toTree), sway: 0.025 * Math.sin(l * 4.2) });
      }
      // the rescue rig: body (leaning into each tug) and her right arm hinged at the shoulder
      const tug = tugAt(l), free = ease.inQuad(clamp((l - FREE) / 0.8));
      const RR = REAL_R || R;
      const bodyM = M.chain(M.translate(TREE_FEET[0], TREE_FEET[1]), M.rotate(0.01 * Math.sin(l * 3) + 0.03 * tug), M.scale(TB_S), M.translate(-SPRITES.treeBody.feet[0], -SPRITES.treeBody.feet[1]));
      const S7 = M.apply(bodyM, SPRITES.treeBody.shoulder[0], SPRITES.treeBody.shoulder[1]);
      // where the kite is: shaken by each tug, then falling into her arms
      const shake = 14 * tug;
      const inTree = { x: 1330 + 4 * Math.sin(l * 9) * tug, y: 360 + shake, rot: -0.75 + sway + 0.18 * tug };
      // the tail's end, hanging, is what she reaches for
      const tip = [inTree.x - Math.sin(inTree.rot) * 82 * 1.05, inTree.y + Math.cos(inTree.rot) * 82 * 1.05];
      const grab = [tip[0] - 40, tip[1] + 250];
      // Two fixed-length painted bones: the elbow bends as she reaches and pulls.
      const TA = SPRITES.treeArm;
      const raise = ease.inOutSine(clamp((l - 8.9) / 0.8)), lower = ease.inOutSine(clamp((l - FREE - 0.3) / 0.8));
      const upperLen = Math.hypot(TA.elbow[0] - TA.root[0], TA.elbow[1] - TA.root[1]) * TB_S;
      const lowerLen = Math.hypot(TA.hand[0] - TA.elbow[0], TA.hand[1] - TA.elbow[1]) * TB_S;
      const rest = [S7[0] + 25, S7[1] + 140];
      const reach = [grab[0], grab[1] + 32 * tug];
      const target = [lerp(lerp(rest[0], reach[0], raise), S7[0] + 94, lower),
        lerp(lerp(rest[1], reach[1], raise), S7[1] + 60, lower)];
      const dx = target[0] - S7[0], dy = target[1] - S7[1];
      const dist = clamp(Math.hypot(dx, dy), Math.abs(upperLen - lowerLen) + 1, upperLen + lowerLen - 2);
      const aim = Math.atan2(dy, dx);
      const bend = Math.acos(clamp((upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist), -1, 1));
      const elbow = [S7[0] + upperLen * Math.cos(aim + bend), S7[1] + upperLen * Math.sin(aim + bend)];
      const hand = [S7[0] + dist * Math.cos(aim), S7[1] + dist * Math.sin(aim)];
      const bone = (from, to, root, end) => M.chain(M.translate(...from),
        M.rotate(Math.atan2(to[1] - from[1], to[0] - from[0]) - Math.atan2(end[1] - root[1], end[0] - root[0])),
        M.scale(TB_S), M.translate(-root[0], -root[1]));
      if (show('wren') && A.treeBody && A.treeUpperArm && A.treeForearm) {
        RR.layer(A.treeBody, bodyM, { opacity: toTree });
        RR.layer(A.treeUpperArm, bone(S7, elbow, TA.root, TA.elbow), { opacity: toTree });
        RR.layer(A.treeForearm, bone(elbow, hand, TA.elbow, TA.hand), { opacity: toTree });
      }
      // the kite: in the branches, then tumbling down into her arms (in front of her)
      const held = [hand[0] - 10, hand[1] - 70];
      const k7 = {
        x: lerp(inTree.x, held[0], free), y: lerp(inTree.y, held[1], free),
        rot: lerp(inTree.rot, 0.15, free) + 1.6 * Math.sin(free * Math.PI), s: lerp(1.05, 0.8, free),
      };
      const grabbed = l > 9.7 && free <= 0;
      drawKite(R, A, { ...k7, tex: 'kiteTorn', ph: l * 0.6, tailAng: Math.PI / 2 + 0.25, tailAmp: 3, tailLen: 260, tailTo: grabbed ? hand : null });   // limp, wet; in her hand once grabbed
      // rain: the same sheet twice, falling
      const yo = (((l * 900) % 1080) + 1080) % 1080;
      for (const dy of [yo - 1080, yo]) R.layer(A.rain, M.translate(-0.18 * dy, dy), { opacity: 0.28, tint: [0.72, 0.8, 0.92] });
      // its light: drawn over her painted lantern, flickering
      const on = smoothstep(1.3, 2.3, l) * (0.85 + 0.15 * Math.sin(l * 13) * Math.sin(l * 7.3));
      if (on > 0.01) {
        const [x, y, r] = lanternAt(l);
        R.glow(x, y, r, [1, 0.72, 0.36], 1.4 * on, { ext: 6 });
        R.glow(x, y, r * 6, [1, 0.6, 0.3], 0.25 * on, { ext: 4 });
      }
    },
  },
  // 8. The mend: the camera drifts in on the patch, the lantern breathes, and her right hand sews:
  // needle in at the edge of the patch, pull up and out with the thread drawn taut, back again.
  {
    cam: [[1.0, 1050, 740], [1.1, 1050, 740]],
    draw(R, A, l) {
      // her right arm: the hand comes with its own painted cuff (hand_needle.png), so the wrist is
      // always inside the sleeve; it turns about the needle as she pushes in and pulls out. The
      // forearm tube runs from under that cuff to the elbow off the right edge, drawn beneath it.
      // Each 2 s pass: needle in at the next stitch, pull the thread out and up, come back; a new
      // stitch appears on the patch with each pass.
      const RR = REAL_R || R;
      const SA = SPRITES.sewArm, HN = SPRITES.handNeedle, HS = 0.78;
      const EDGE = [[1134, 650], [1070, 792]];                     // the patch's right edge, top to bottom
      const along = (i) => [lerp(EDGE[0][0], EDGE[1][0], (i + 0.5) / 8), lerp(EDGE[0][1], EDGE[1][1], (i + 0.5) / 8)];
      const pass = Math.max(0, Math.floor(l / 2.0)), ph = (((l % 2.0) + 2.0) % 2.0) / 2.0;
      const k = Math.min(pass, 7), S = along(k);
      const out = ph < 0.3 ? 0 : ph < 0.75 ? ease.inOutSine((ph - 0.3) / 0.45) : 1 - ease.inOutSine((ph - 0.75) / 0.25);
      const push = ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) : 0;
      // finished stitches, in dark thread across the patch edge
      const st = [];
      for (let i = 0; i < k; i++) { const p = along(i); line(st, [[p[0] - 16, p[1] - 5], [p[0] + 15, p[1] + 7]], 1.6, lit(RGB('#5a3a1e')), 0.9); }
      RR.particles(st, { kind: 'soft' });
      // the hand: needle tip on its path, the hand turning about it
      const tipAt = [S[0] + 10 - 8 * push + 160 * out, S[1] - 6 + 6 * push - 105 * out];
      const handM = M.chain(M.translate(tipAt[0], tipAt[1]), M.rotate(-0.22 * out + 0.05 * push), M.scale(HS), M.translate(-HN.feet[0], -HN.feet[1]));
      // the forearm: from the elbow (off the right edge) to a point inside the hand's painted cuff
      const J = M.apply(handM, 780, 740), E = [2010, 900];
      const fl = Math.hypot(J[0] - E[0], J[1] - E[1]), natural = SA.cuff[0] - SA.elbow[0];
      const armM = M.chain(M.translate(E[0], E[1]), M.rotate(Math.atan2(J[1] - E[1], J[0] - E[0])), M.scale(fl / natural, HS * 0.62), M.translate(-SA.elbow[0], -SA.elbow[1]));
      // the thread, from the stitch to the needle: slack going in, drawn taut as it pulls out
      const th = [];
      line(th, bez(S, [(S[0] + tipAt[0]) / 2, (S[1] + tipAt[1]) / 2 + 30 * (1 - out)], tipAt), 0.9, lit(RGB('#e8dcc0')), 0.9);
      RR.particles(th, { kind: 'soft' });
      if (show('wren') && A.handNeedle) {
        if (A.sewArm) RR.layer(A.sewArm, armM, { tint: [0.93, 0.8, 0.64] });   // beneath the cuff
        RR.layer(A.handNeedle, handM, { tint: [0.93, 0.8, 0.64] });
      }
      const f = 0.8 + 0.12 * Math.sin(l * 9.1) * Math.sin(l * 5.3) + 0.08 * Math.sin(l * 2.2);
      R.glow(LANTERN8[0], LANTERN8[1], 26, [1, 0.74, 0.4], 0.5 * f, { ext: 4 });
      R.glow(LANTERN8[0], LANTERN8[1], 260, [1, 0.62, 0.3], 0.07 * f, { ext: 3 });
    },
  },
  // 9. Leaning in: the patched kite climbs on a taut string, higher than ever; the swifts come back.
  {
    cam: [[1.06, 900, 500], [1.0, 900, 500]],
    draw(R, A, l, d, t) {
      const k = KITE9(l);
      // leaning in: a steady lean back against the pull, calm breathing, arms firm with a little give
      const hands = drawWren(R, A, 360, 722, 0.21, [k.x, k.y], {
        lean: -0.1 - 0.04 * smoothstep(0, 9, l), breathe: 0.01 * Math.sin(l * 1.4),
        tug: 0.03 * Math.sin(l * 0.8) + 0.015 * Math.sin(l * 2.3), scarf: 0.7 + 0.15 * Math.sin(l * 0.5), t: l });
      const b = bridle(k.x, k.y, k.s, k.rot);
      drawString(R, hands, b, 0.015, 1.1);
      // the knot, catching the sun as it passes
      const kn = [lerp(hands[0], b[0], 0.42), lerp(hands[1], b[1], 0.42)];
      R.glow(kn[0], kn[1], 6, [1, 0.96, 0.85], 0.55 + 0.35 * Math.sin(l * 2), { ext: 4 });
      drawKite(R, A, { ...k, tex: 'kitePatch', ph: l * 2.0, tailAng: 1.8, tailAmp: 8 });   // steady and calm
      drawFlock(R, A, FLOCK9(t), { size: 26, tint: [0.9, 0.9, 0.95] });
    },
  },
];
// The free kite (beats 5 and 6): just the kite and its tail streaming behind its real path.
function drawFreeKite(R, A, t) {
  const k = KITE56(t);
  if (k.falling >= 1) return;
  drawKite(R, A, { ...k, trail: KITE56, t });
}
const LANTERN8 = [337, 184];      // the lantern flame in plate 8
// Beat 7: she stands at the foot of the tree under the kite (feet at TREE_FEET, scale TREE_S).
const TREE_FEET = [1318, 1030], TREE_S = 0.27;   // the walking cut-out's final size
const TB_S = 0.31;                               // the rig body at the tree, about the same height
const fromSprite = (sp, pt, at, sc) => [at[0] + (pt[0] - sp.feet[0]) * sc, at[1] + (pt[1] - sp.feet[1]) * sc];
const LANTERN7 = fromSprite(SPRITES.treeBody, SPRITES.treeBody.lantern, TREE_FEET, TB_S);   // the 7->8 cut matches on it
const SHOULDER7 = fromSprite(SPRITES.treeBody, SPRITES.treeBody.shoulder, TREE_FEET, TB_S);
// The rescue, in beat-7 seconds: reach (8.9-9.7), grab the tail, three tugs, the third frees it,
// it tumbles into her arms (11.5-12.3).
const TUGS = [10.0, 10.7, 11.4], FREE = 11.5;
const bump = (x) => (x < 0 ? 0 : x < 0.14 ? x / 0.14 : Math.exp(-(x - 0.14) * 5));
const tugAt = (l) => TUGS.reduce((a, T) => a + bump(l - T), 0);
// The lantern: appears on the far hill (l = 1.5), carried to the tree by l = 8.3 at a walk,
// bobbing with her steps.
function lanternAt(l) {
  const p = ease.inOutSine(clamp((l - 1.5) / 6.8));
  const walking = p > 0 && p < 1;
  return [lerp(262, LANTERN7[0], p), lerp(880, LANTERN7[1], p) - 4 * Math.abs(Math.sin(l * 4.2)) * (walking ? 1 : 0), lerp(6, 30, p), p];
}

// Each beat's camera at local time l (held at its ends inside transitions).
function camView(k, l) {
  const [[s0, x0, y0], [s1, x1, y1]] = BEATS[k].cam;
  const u = ease.inOutSine(clamp(l / (T[k + 1] - T[k])));
  const s = lerp(s0, s1, u), fx = lerp(x0, x1, u), fy = lerp(y0, y1, u);
  const base = M.chain(M.translate(fx, fy), M.scale(s), M.translate(-fx, -fy));
  return BEATS[k].view ? M.mul(BEATS[k].view(l, T[k + 1] - T[k]), base) : base;
}

// ---------------------------------------------------------------- the cuts
// Window [start, end] around each boundary, and how it's crossed.
const shift = (dy, m) => M.mul(M.translate(0, dy), m);
// Reveal an embedded shot through a soft circle around `c` (its own coordinates) that opens up
// until it covers the frame, so the incoming picture never shows its rectangular edge.
const iris = (c, r0, r1) => (viewB, u) => {
  const [x, y] = M.apply(viewB, c[0], c[1]), s = M.scaleOf(viewB);
  const open = 1 + 5 * smoothstep(0.55, 1, u);
  return { type: 'radial', x, y, r0: r0 * open * s, r1: r1 * open * s };
};
const TRANS = [
  // 1->2: the kite holds its place in the sky while the land dissolves from hill to cliff under it
  { start: 11.0, end: 13.0, kind: 'fade', ease: ease.inOutSine },
  // 2->3: the swifts sweep across the lens (overlay); the cut hides behind them
  { start: 26.5, end: 27.5, kind: 'fade', ease: ease.inOutSine },
  // 3->4: the snap. The one hard cut, into the white flash
  { start: 39.99, end: 40.01, kind: 'cut' },
  // 4->5: tilt up after the kite through a wall of cloud (overlay), out above the clouds
  {
    start: 46.4, end: 53.2, kind: 'custom',
    fn: ({ u, A, B, la, lb, vA, vB }) => u < 0.5
      ? [{ shot: A, lt: la, view: shift(195 * ease.inOutSine(u * 2), vA), opacity: 1 }]
      : [{ shot: B, lt: lb, view: shift(-100 * (1 - ease.inOutSine((u - 0.5) * 2)), vB), opacity: 1 }],
  },
  // 5->6: time-lapse; the same kite on the same pixels while the sun goes down behind it
  { start: 65.5, end: 70.0, kind: 'fade', ease: ease.inOutSine },   // slow: the stall happens inside it
  // 6->7: into the little thorn tree on the horizon, until it is the big one, at night, in rain.
  // embed maps plate 7 into plate 6: its trunk base onto the small tree's, scaled to its height.
  { start: 79.2, end: 81.8, kind: 'zoomIn', ease: ease.inOutCubic, fade: [0.3, 0.75],
    embed: M.chain(M.translate(1350, 987), M.scale(0.148), M.translate(-1042, -1025)), mask: iris([1060, 560], 150, 520) },
  // 7->8: the lantern light on the hill becomes the lantern on the table
  { start: 92.8, end: 94.8, kind: 'zoomIn', ease: ease.inOutCubic, fade: [0.04, 0.24],
    embed: M.chain(M.translate(LANTERN7[0], LANTERN7[1]), M.scale(0.15), M.translate(-LANTERN8[0], -LANTERN8[1])), mask: iris(LANTERN8, 50, 165),
    // the night goes dark around her lantern as we push in, so only the light carries across
    after: (list, u) => { list[0].opacity = 1 - smoothstep(0.08, 0.4, u); } },
  // 8->9: push into the flame; it flares to white (overlay) and opens on the dawn
  {
    start: 104.8, end: 107.2, kind: 'custom',
    fn: ({ t, A, B, la, lb, vA, vB }) => {
      if (t < 106) {
        const k = ease.inCubic(clamp((t - 104.8) / 1.2));
        // the flame slides to the centre of the frame as we push into it
        const F = M.apply(vA, LANTERN8[0], LANTERN8[1]);
        return [{ shot: A, lt: la, view: M.mul(viewMatrix(F, [lerp(F[0], 960, k), lerp(F[1], 540, k)], 1 + 5 * k), vA), opacity: 1 }];
      }
      return [{ shot: B, lt: lb, view: vB, opacity: 1 }];
    },
  },
];

// ---------------------------------------------------------------- scene
function paint(P) {
  const A = {};
  PLATES.forEach((pl, k) => { if (pl.img) A['plate' + k] = P.image(pl.img, { w: 1920, h: (1920 * pl.img.height) / pl.img.width }); });
  for (const [name, sp] of Object.entries(SPRITES)) if (sp.img) A[name] = P.image(sp.img, { w: sp.img.width, h: sp.img.height });
  // Overlap the existing sleeve painting at the elbow, preserving its texture.
  if (SPRITES.treeArm.img) {
    const img = SPRITES.treeArm.img, joint = SPRITES.treeArm.elbow[1];
    for (const [name, upper] of [['treeUpperArm', true], ['treeForearm', false]]) {
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d');
      ctx.save(); ctx.beginPath();
      ctx.rect(0, upper ? joint - 16 : 0, img.width, upper ? img.height - joint + 16 : joint + 16);
      ctx.clip(); ctx.drawImage(img, 0, 0); ctx.restore();
      A[name] = P.image(cv, { w: cv.width, h: cv.height });
    }
  }
  // kite sprites: bridle point at (60, 70), 120 x 180 layer
  const K = (opts) => (c) => { paintKite(c, X(60, 70, 1, 0), 1, opts); c.flush(); };
  A.kite = P.layer('kite', { w: 120, h: 180, scale: 3 }, K({}));
  A.kitePatch = P.layer('kitePatch', { w: 120, h: 180, scale: 3 }, K({ patch: true }));
  A.kiteTorn = P.layer('kiteTorn', { w: 120, h: 180, scale: 3 }, K({ torn: true, dark: 0.45 }));
  paintBirds(P, A);
  (SPRITES.swiftClose.frames || []).forEach((cv, i) => { A['swiftClose' + i] = P.image(cv, { w: cv.width, h: cv.height }); });
  paintRig(P, A);
  A.bow = P.layer('bow', { w: 40, h: 24, scale: 4, seed: 'bow' }, (c) => {
    c.fillPoly([[20, 12], [3, 3], [5, 12], [3, 21]], C.red, { opacity: 240, bleed: 0.04, texture: 0.4, border: 0.4 });
    c.fillPoly([[20, 12], [37, 3], [35, 12], [37, 21]], C.redLo, { opacity: 240, bleed: 0.04, texture: 0.4, border: 0.4 });
    c.flush();
    c.fillPoly(c.blob(20, 12, 3.4, 3.6, { n: 14, wobble: 0.1 }), C.redDeep, { opacity: 250, bleed: 0.02, texture: 0.3 });
    c.flush();
  });
  A.rain = P.layer('rain', { w: 1920, h: 1080, seed: 'rain' }, (c) => {
    for (let i = 0; i < 700; i++) {
      const x = c.r(-80, 1960), y = c.r(-60, 1080), len = c.r(30, 70);
      c.line(x, y, x - len * 0.18, y + len, 'wire', '#ffffff', c.r(0.35, 0.8));
    }
    c.flush();
  });
  return A;
}

function draw(R) {
  const k = +R.shot.id.slice(1), A = R.assets;
  const l = R.t - T[k], d = T[k + 1] - T[k];
  if (A['plate' + k] && show('plate')) R.layer(A['plate' + k], M.translate(0, -PLATES[k].top));
  else R.fill('#8a8f96');
  REAL_R = R; CUR = k;
  BEATS[k].draw(show('code') ? R : MUTED, A, l, d, R.t);
  REAL_R = null;
}

function post() {
  return { bloom: 0.015, threshold: 0.92, exposure: 1.02, sat: 1.04, contrast: 1.04, vignette: 0.3, paper: 0.3, grain: 0.05 };
}

export const scene = { id: 'tether', bg: '#000000', paint, draw, blur: () => 2, post };

// ---------------------------------------------------------------- overlay: things that cross cuts
// Screen space, over every shot: the swifts that wipe 2->3, the cloud wall 4->5, the flare 8->9,
// and the title.
const WIPE = Array.from({ length: 6 }, (_, i) => {
  const r = rng('wipe' + i);
  return { t: 25.3 + i * 0.42 + r(0, 0.2), dur: r(1.9, 2.6), y0: r(120, 960), y1: r(80, 1000), bow: r(-160, 160), size: r(170, 480), ph: r(0, 1), rate: r(2.6, 3.6) };
});

function paintFx(P) {
  const A = {};
  paintBirds(P, A);
  (SPRITES.swiftClose.frames || []).forEach((cv, i) => { A['swiftClose' + i] = P.image(cv, { w: cv.width, h: cv.height }); });
  paintRig(P, A);
  // a tall wall of cloud, dense in the middle, soft at both ends, painted white to tint
  A.cloudwall = P.layer('cloudwall', { w: 1920, h: 2600, seed: 'cloudwall' }, (c) => {
    // each puff: a blue-grey shadow underneath, the lit white top over it, so they read as volume
    for (let i = 0; i < 150; i++) {
      const y = 1300 + (c.r() - 0.5) * 2 * Math.pow(c.r(), 0.7) * 1250;
      const x = c.r(-200, 2120), rx = c.r(240, 520), ry = c.r(120, 260);
      c.fillPoly(c.blob(x, y + ry * 0.35, rx * 1.02, ry * 0.9, { wobble: 0.26, freq: 3 }), '#aab6c8', { opacity: c.r(150, 220), bleed: 0.16, texture: 0.6, border: 0.5, dir: 'out' });
      c.fillPoly(c.blob(x - rx * 0.06, y - ry * 0.12, rx * 0.9, ry * 0.78, { wobble: 0.3, freq: 3 }), '#ffffff', { opacity: c.r(170, 240), bleed: 0.16, texture: 0.6, border: 0.5, dir: 'out' });
      if (i % 15 === 14) c.flush();
    }
    c.flush();
  });
  A.title = P.text('T E T H E R', { font: '400 96px Georgia', color: '#f3ecdf', align: 'center' });
  return A;
}

function drawFx(R, t) {
  const A = R.assets;
  if (!show('fx')) return;
  // 2->3: near swifts across the lens, right to left, big and fast
  if (t > 25.2 && t < 28.8) {
    const CYCLE = [0, 1, 2, 3, 2, 1];   // one wingbeat through the painted frames; 1 is the glide
    for (const w of WIPE) {
      const u = (t - w.t) / w.dur;
      if (u <= 0 || u >= 1) continue;
      const pos = (uu) => [lerp(2300, -400, uu), lerp(w.y0, w.y1, uu) - w.bow * Math.sin(uu * Math.PI)];
      const [x, y] = pos(u), [x2, y2] = pos(u + 0.01);
      const g = smoothstep(0.5, 0.6, (t * 0.5 + w.ph) % 1);
      if (A.rigBody) { drawSwift(R, A, x, y, w.size * 1.1, Math.atan2(y2 - y, x2 - x), t * w.rate + w.ph, g, [0.55, 0.56, 0.62]); continue; }
      const f = g > 0.5 ? 1 : CYCLE[Math.floor(((t * w.rate + w.ph) % 1) * CYCLE.length)];
      const L = A['swiftClose' + f];
      if (!L) continue;
      const s = w.size / 300;                                     // ~300 px is a frame's wingspan
      const tilt = Math.atan2(y2 - y, x - x2);                    // nose up or down along the path
      R.layer(L, M.chain(M.translate(x, y), M.rotate(-tilt), M.scale(-s, s), M.translate(-L.w / 2, -L.h / 2)));
    }
  }
  // 4->5: the cloud wall comes down through the frame as the camera tilts up; the cut is hidden
  // at its densest, where a flat fill of cloud colour makes it fully opaque
  if (t > 46.4 && t < 53.2) {
    const u = (t - 46.4) / 6.8, e = ease.inOutSine(u);
    const tint = [lerp(0.9, 1.0, u), lerp(0.94, 0.86, u), lerp(1.0, 0.76, u)];
    R.layer(A.cloudwall, M.translate(0, lerp(-2600, 1080, e)), { tint });
    R.fill([tint[0] * 0.97, tint[1] * 0.97, tint[2] * 0.97, 1], { opacity: smoothstep(0.3, 0.46, u) * (1 - smoothstep(0.54, 0.7, u)) });
  }
  // 8->9: the flame flares to white, then the white opens onto the morning
  if (t > 105.0 && t < 107.2) {
    const w = t < 106 ? smoothstep(105.2, 106, t) : 1 - smoothstep(106, 107.2, t);
    R.fill([1, 0.97, 0.9, 1], { opacity: w });
  }
  // the end: fade to black under the title
  const out = smoothstep(116.8, 118.4, t);
  if (out > 0) {
    R.fill([0, 0, 0, 1], { opacity: out });
    const L = A.title;
    R.layer(L, M.translate(960 - L.w / 2, 540 - L.h / 2), { opacity: smoothstep(117.6, 118.8, t) });
  }
}

export const overlay = { id: 'tether_fx', start: 0, end: DUR, paint: paintFx, draw: drawFx };

// One shot per beat, spanning its neighbouring transition windows; the camera lives on the shot.
const NAMES = ['1 First flight', '2 The want', '3 Tugging', '4 Snap', '5 Free', '6 The fall', '7 The thorn tree', '8 The mend', '9 Leaning in'];
export function shots() {
  return BEATS.map((_, k) => ({
    id: 'b' + k, label: NAMES[k], scene,
    start: k === 0 ? 0 : TRANS[k - 1].start,
    end: k === BEATS.length - 1 ? DUR : TRANS[k].end,
    view(lt) { return camView(k, lt + this.start - T[k]); },
  }));
}
export function transitions() {
  return TRANS.map((tr, i) => ({ from: 'b' + i, to: 'b' + (i + 1), ...tr }));
}
