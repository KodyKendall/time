// EARTH — space part (lt 0 .. ~11.5): the star swells into the young Sun, a protoplanetary disk of
// brush strokes spirals around it, dust clumps into planetesimals, the camera pushes in on the third
// planet. Everything is analytic in lt (random access).
import { PIVOT } from '../pivots.js';
import { starParticles, paintBall, atlas, circlePts } from '../lib/kit.js';
import {
  C, M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, ease, invLerp, prog, noise1, fbm1, fbm2,
  win, smoother, lerpLog, v3, strokeBatch, part, hash, rgb, T,
} from './common.js';
import { camAt, SYS, omega, orbitPos, earthPos } from './camera.js';
import { drawEarth } from './planet.js';
import { paintSphere, crater } from './paint.js';

// ---------------------------------------------------------------------------------------------
// Disk model
// ---------------------------------------------------------------------------------------------
const RINGS = [2.1, 2.9, 3.8, 5.0, 6.3, 7.6, 9.2, 11.0, 12.8, 14.8, 17.0, 19.5, 22.5];
// planetesimals that the disk clumps into (a = orbit radius, th5 = orbital angle at lt 5)
export const CLUMPS = (() => {
  const r = rng('earth-clumps');
  const major = [
    { a: 2.9, th5: -0.95, rad: 0.035, sprite: 3, t0: 5.2, t1: 7.0 },
    { a: 5.0, th5: 0.55, rad: 0.05, sprite: 0, t0: 5.4, t1: 7.25 },
    { a: SYS.earthA, th5: SYS.earthPh5, rad: SYS.earthR, sprite: -1, t0: 5.5, t1: 7.5, earth: true },
    { a: 14.8, th5: -0.42, rad: 0.045, sprite: 1, t0: 5.8, t1: 7.9 },
    { a: 19.5, th5: -0.12, rad: 0.16, sprite: 5, t0: 5.9, t1: 8.2 },
    { a: 7.6, th5: -0.35, rad: 0.03, sprite: 2, t0: 5.6, t1: 7.6 },
  ];
  const minor = [];
  for (let i = 0; i < 44; i++) {
    const a = RINGS[r.int(0, RINGS.length - 1)] * r(0.94, 1.06);
    minor.push({ a, th5: r(0, TAU), rad: r(0.006, 0.02), sprite: r.pick([2, 3, 6, 7, 4]), t0: r(5.0, 6.6), t1: 0, minor: true });
    minor[i].t1 = minor[i].t0 + r(1.2, 2.2);
  }
  return major.concat(minor).map((c, i) => ({ ...c, id: i, w: c.earth ? SYS.earthW : omega(c.a) }));
})();
export const clumpAngle = (c, lt) => c.th5 + c.w * (lt - 5);
export const clumpPos = (c, lt) => orbitPos(c.a, clumpAngle(c, lt), 0);
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

const PAL_STROKE = [
  [C.amber, 20], [C.rose, 13], [C.rust, 12], [C.cream, 16], [C.gold, 10], [C.orange, 9], [C.sand, 9], [C.plum, 6], ['#e9a37a', 7], [C.lavender, 4],
];
function pickW(r, list) {
  let s = 0;
  for (const [, w] of list) s += w;
  let x = r(0, s);
  for (const [v, w] of list) if ((x -= w) <= 0) return v;
  return list[0][0];
}
// nearest clump on (roughly) the same ring
function assign(r, a, th) {
  const E = CLUMPS.find((c) => c.earth);
  if (a > 8.8 && a < 13.4 && Math.abs(angDiff(th, clumpAngle(E, 5))) < 1.3 && r() < 0.9) return E;
  let best = null, bd = 1e9;
  for (const c of CLUMPS) {
    const da = Math.abs(c.a - a) / c.a;
    if (da > (c.minor ? 0.07 : 0.16)) continue;
    const dth = Math.abs(angDiff(th, clumpAngle(c, 5)));
    const d = da * 8 + dth * (c.minor ? 1.2 : 0.55);
    if (d < bd) { bd = d; best = c; }
  }
  return bd < 2.6 ? best : null;
}

const STROKES = (() => {
  const r = rng('earth-disk-strokes');
  const out = [];
  const N = 470;
  for (let i = 0; i < N; i++) {
    let a;
    if (r() < 0.8) a = RINGS[r.int(0, RINGS.length - 1)] * (1 + r.gauss(0, 0.045));
    else a = r(1.7, 24);
    a = Math.max(1.7, a);
    const th0 = r(0, TAU);
    const kind = r();
    const lane = i >= 390;
    const brush = lane ? (i % 3 ? 'earth_lane' : 'earth_glaze') : kind < 0.14 ? 'wire' : kind < 0.3 ? 'ink' : kind < 0.46 ? 'dry' : kind < 0.6 ? 'pastel' : kind < 0.7 ? 'crayon' : kind < 0.78 ? 'earth_hair' : kind < 0.84 ? 'HB' : 'earth_body';
    const wBase = { wire: r(0.7, 1.5), ink: r(0.6, 1.3), dry: r(0.3, 0.6), pastel: r(0.35, 0.7), crayon: r(0.4, 0.8), earth_hair: r(0.8, 1.6), HB: r(0.6, 1.2), earth_body: r(0.18, 0.32), marker: r(0.5, 1.0), earth_scumble: r(0.25, 0.45), wash: r(0.35, 0.7), earth_lane: r(0.35, 0.8), earth_glaze: r(0.25, 0.5) }[brush];
    const span = lane ? r(1.2, 2.6) : r(0.35, 1.25) * (a < 4 ? 1.35 : 1);
    const birth = lerp(2.4, 4.5, clamp((24 - a) / 22 * 0.25 + r(0, 0.75)));
    const color = lane ? r.pick(['#c07a5a', '#b0607a', C.rust, '#d89a6a', C.plum, '#e0b080', '#9a6aa0']) : pickW(r, PAL_STROKE);
    const s = { i, a, th0, span, y0: r.gauss(0, 0.012) * a, brush, w: wBase, color, birth: lane ? birth - 0.3 : birth, bdur: r(1.1, 2.0), wob: r(0, TAU), wamp: r(0.004, 0.02), spiral: r(0.25, 0.55), lane };
    const cl = r() < 0.86 ? assign(r, a, th0 + omega(a) * 5) : null;
    s.clump = cl;
    if (cl) {
      const t0 = cl.t0 + r(-0.2, (cl.t1 - cl.t0) * 0.6);
      s.c0 = t0;
      s.c1 = Math.min(cl.t1, t0 + r(0.8, 1.6));
    }
    out.push(s);
  }
  return out;
})();

const DUST = (() => {
  const r = rng('earth-disk-dust');
  const out = [];
  for (let i = 0; i < 2600; i++) {
    let a = r() < 0.75 ? RINGS[r.int(0, RINGS.length - 1)] * (1 + r.gauss(0, 0.06)) : r(1.7, 25);
    a = Math.max(1.6, a);
    const th0 = r(0, TAU);
    const icy = a > 13.5 && r() < 0.45;
    const col = icy ? hex(mixHex('#dff4ff', C.aqua, r(0, 0.5))) : hex(pickW(r, [[C.cream, 30], [C.gold, 18], [C.amber, 16], ['#f4c7a1', 14], [C.rose, 10], [C.sand, 12]]));
    const d = { a, th0, y0: r.gauss(0, 0.014) * a, s: Math.pow(r(), 2.2) * 2.6 + 0.7, col, al: r(0.35, 0.95), birth: lerp(2.3, 4.5, clamp((24 - a) / 22 * 0.3 + r(0, 0.7))), ph: r(0, TAU), tw: r(1, 4), icy };
    const cl = r() < 0.8 ? assign(r, a, th0 + omega(a) * 5) : null;
    d.clump = cl;
    if (cl) {
      d.c0 = cl.t0 + r(-0.3, (cl.t1 - cl.t0) * 0.7);
      d.c1 = Math.min(cl.t1 + 0.2, d.c0 + r(0.6, 1.4));
    }
    out.push(d);
  }
  return out;
})();

// rocks: small bodies orbiting in the disk (painted sprites), some get swept into clumps
const ROCKS = (() => {
  const r = rng('earth-disk-rocks');
  const out = [];
  for (let i = 0; i < 150; i++) {
    const a = r() < 0.7 ? RINGS[r.int(0, RINGS.length - 1)] * (1 + r.gauss(0, 0.05)) : r(2, 23);
    const rk = { a, th0: r(0, TAU), y0: r.gauss(0, 0.01) * a, rad: r(0.004, 0.014) * (a > 13 ? 1.4 : 1), sprite: r.int(8, 15), spin: r(-1.5, 1.5), birth: lerp(2.4, 4.8, r()) };
    const cl = r() < 0.6 ? assign(r, a, rk.th0 + omega(a) * 5) : null;
    rk.clump = cl;
    if (cl) {
      rk.c0 = cl.t0 + r(0, (cl.t1 - cl.t0) * 0.7);
      rk.c1 = Math.min(cl.t1 + 0.2, rk.c0 + r(0.7, 1.4));
    }
    out.push(rk);
  }
  return out;
})();

// formation state of a disk element with ring a, birth b (spiral infall), returns {p, rMul, dth}
function infall(lt, birth, bdur = 1.4) {
  const p = smoother(birth, birth + bdur, lt);
  return { p, rMul: 1 + 0.55 * (1 - p) * (1 - p), dth: 1.1 * (1 - p) * (1 - p) };
}
// clumping progress for element with window c0..c1
const clumpQ = (el, lt) => (el.clump ? smoother(el.c0, el.c1, lt) : 0);

// World position of a disk point (ring a, angle th, height y) under clumping toward clump c with progress q
function diskPoint(a, th, y, c, q, lt) {
  if (!c || q <= 0) return orbitPos(a, th, y);
  const tc = clumpAngle(c, lt);
  const qq = q * q * (3 - 2 * q);
  const th2 = th + angDiff(th, tc) * qq;
  const a2 = lerp(a, c.a, qq);
  return orbitPos(a2, th2, y * (1 - qq));
}

// ---------------------------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------------------------
const SUN_R = 200; // painted sun radius (layer units)

function paintSun(P) {
  // the disc, painted in its own space: stepped radial block-in, convection swirls, limb strokes
  return P.layer('sunDisc', { w: 480, h: 480, scale: 1.1 }, (c) => {
    const r = c.r, cx = 240, cy = 240, R0 = SUN_R;
    const disc = c.blob(cx, cy, R0, R0, { n: 140, wobble: 0.006, freq: 5 });
    c.washPoly(disc, '#cf4a24', 255);
    // many small value steps (limb darkening), each edge wobbly so no hard banding
    const stops = ['#d9582a', '#e0652c', '#e8752f', '#ee8634', '#f29a3c', '#f5a944', '#f8b84e', '#fbc75c', '#fdd46e', '#ffe08a', '#ffe9a8'];
    stops.forEach((col, i) => {
      const k = 0.985 - i * 0.078;
      c.washPoly(c.blob(cx - 14 * (1 - k), cy - 16 * (1 - k), R0 * k, R0 * k, { n: 90, wobble: 0.025 + 0.012 * i, freq: 3 + (i % 4) }), col, 150);
    });
    c.fillPoly(disc, C.amber, { opacity: 60, bleed: 0.02, texture: 0.85, border: 0.6 });
    // convection cells: swirling strokes around cell centres, lighter in the middle of the disc
    const sw = [];
    for (let k = 0; k < 95; k++) {
      const rr = Math.sqrt(r()) * 0.9, a = r(0, TAU);
      const x0 = cx + Math.cos(a) * rr * R0, y0 = cy + Math.sin(a) * rr * R0;
      const cellR = r(10, 22) * (1 - 0.45 * rr * rr);
      const n = r.int(3, 5);
      for (let q = 0; q < n; q++) {
        const a0 = r(0, TAU), span = r(1.2, 2.6), rad = cellR * r(0.5, 1.05), pts = [];
        for (let j = 0; j <= 7; j++) {
          const aa = a0 + (span * j) / 7;
          pts.push([x0 + Math.cos(aa) * rad, y0 + Math.sin(aa) * rad * (1 - 0.35 * rr), 0.45 + 0.6 * Math.sin((Math.PI * j) / 7)]);
        }
        const col = rr < 0.45 ? r.pick([C.cream, '#fff0c4', '#ffe29a', C.gold]) : rr < 0.75 ? r.pick([C.gold, '#f9c060', C.amber, '#ffd98c']) : r.pick([C.amber, C.orange, '#f28a3a', C.vermilion]);
        sw.push({ pts, brush: r() < 0.6 ? 'earth_body' : 'pastel', color: col, w: r(0.45, 0.85) * (1 - 0.35 * rr), curv: 0.6, seed: `sc${k}_${q}` });
      }
    }
    strokeBatch(c, sw);
    // intergranular lanes: thin darker strokes
    const lanes = [];
    for (let k = 0; k < 110; k++) {
      const rr = Math.sqrt(r()) * 0.93, a = r(0, TAU);
      let x = cx + Math.cos(a) * rr * R0, y = cy + Math.sin(a) * rr * R0, ang = r(0, TAU);
      const pts = [];
      for (let j = 0; j < 5; j++) { pts.push([x, y, 1 - j * 0.15]); ang += r(-0.9, 0.9); x += Math.cos(ang) * 7; y += Math.sin(ang) * 7; }
      lanes.push({ pts, brush: 'earth_hair', color: rr < 0.6 ? r.pick([C.amber, C.orange, '#e8862e']) : r.pick([C.vermilion, C.rust, '#b83a1e']), w: r(0.8, 1.3), curv: 0.6, seed: 'ln' + k });
    }
    strokeBatch(c, lanes);
    // limb: tangential strokes wrapping the edge (form), deeper reds
    const limb = [];
    for (let k = 0; k < 70; k++) {
      const a0 = r(0, TAU), span = r(0.25, 0.7), rad = R0 * r(0.84, 0.985), pts = [];
      for (let j = 0; j <= 8; j++) {
        const aa = a0 + (span * j) / 8;
        pts.push([cx + Math.cos(aa) * rad, cy + Math.sin(aa) * rad, 0.4 + 0.7 * Math.sin((Math.PI * j) / 8)]);
      }
      limb.push({ pts, brush: r() < 0.6 ? 'earth_body' : 'dry', color: r.pick([C.orange, C.vermilion, '#d9582a', C.amber, '#c2401f']), w: r(0.4, 0.75), curv: 0.5, seed: 'lb' + k });
    }
    strokeBatch(c, limb);
    // faculae (bright dabs near the limb) + highlights
    const fac = [];
    for (let k = 0; k < 40; k++) {
      const a = r(0, TAU), rr = r(0.7, 0.93), x = cx + Math.cos(a) * rr * R0, y = cy + Math.sin(a) * rr * R0;
      fac.push({ pts: [[x, y], [x - Math.sin(a) * r(6, 14), y + Math.cos(a) * r(6, 14)]], brush: 'earth_dab', color: r.pick([C.cream, '#ffe7b0', C.gold]), w: r(0.35, 0.6), curv: 0, seed: 'fc' + k });
    }
    for (let k = 0; k < 14; k++) {
      const a = r(0, TAU), rr = r(0, 0.4), x = cx - 25 + Math.cos(a) * rr * R0, y = cy - 30 + Math.sin(a) * rr * R0;
      fac.push({ pts: [[x, y], [x + r(-18, 18), y + r(-10, 10)]], brush: 'earth_dab', color: '#fff6dc', w: r(0.5, 0.9), curv: 0, seed: 'hl' + k });
    }
    strokeBatch(c, fac);
    // sunspot groups with penumbra strokes
    for (const [sx, sy, s] of [[cx + 72, cy + 44, 1], [cx - 60, cy + 98, 0.7], [cx + 20, cy - 110, 0.5]]) {
      const pen = [];
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        pen.push({ pts: [[sx + Math.cos(a) * 5 * s, sy + Math.sin(a) * 4 * s], [sx + Math.cos(a) * 15 * s, sy + Math.sin(a) * 12 * s]], brush: 'earth_hair', color: r.pick([C.rust, '#8a2a1c']), w: 1.1 * s, curv: 0, seed: `pn${sx}_${k}` });
      }
      strokeBatch(c, pen);
      c.washPoly(c.blob(sx, sy, 7 * s, 5.5 * s), '#4a1410', 235);
    }
    // soft contour, mostly lost (a light source), found low-right
    const ct = [];
    for (let k = 0; k < 3; k++) {
      const a0 = 0.2 + k * 0.55, pts = [];
      for (let j = 0; j <= 10; j++) { const a = a0 + (0.5 * j) / 10; pts.push([cx + Math.cos(a) * R0 * 0.995, cy + Math.sin(a) * R0 * 0.995, 0.3 + Math.sin((Math.PI * j) / 10)]); }
      ct.push({ pts, brush: 'crayon', color: '#9a2a18', w: 1.2, curv: 0.5, seed: 'sct' + k });
    }
    strokeBatch(c, ct);
    c.flush();
    for (let k = 0; k < 16; k++) {
      const a = r(0, TAU), d = R0 * r(0.1, 0.85), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      c.line(x, y, x + r(-40, 40), y + r(-40, 40), 'earth_speck', r.pick([C.cream, C.rust, C.gold]), 0.7);
    }
  });
}

function paintCorona(P) {
  // painted corona: soft haze rings, petal streamers, clustered flame tongues, a few prominences
  return P.layer('sunCorona', { w: 1000, h: 1000, scale: 0.7 }, (c) => {
    const r = c.r, cx = 500, cy = 500, R0 = SUN_R;
    // soft radial haze dabs hugging the limb
    const hz = [];
    for (let k = 0; k < 90; k++) {
      const a = r(0, TAU), r0 = R0 - 4, L = r(14, 42), pts = [];
      for (let j = 0; j <= 4; j++) pts.push([cx + Math.cos(a) * (r0 + (L * j) / 4), cy + Math.sin(a) * (r0 + (L * j) / 4), 1.1 - j * 0.2]);
      hz.push({ pts, brush: 'marker', color: r.pick([C.amber, C.orange, '#ffb45a', C.gold]), w: r(0.9, 1.6), curv: 0.4, seed: 'hz' + k });
    }
    strokeBatch(c, hz);
    // streamers (petals)
    const pet = [];
    for (let k = 0; k < 18; k++) {
      const a = r(0, TAU), L = r(60, 170), bend = r(-0.3, 0.3), pts = [];
      for (let j = 0; j <= 8; j++) {
        const s2 = j / 8, rr = R0 + 4 + L * s2, aa = a + bend * s2 * s2;
        pts.push([cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, 1.1 - s2]);
      }
      pet.push({ pts, brush: r() < 0.5 ? 'marker' : 'earth_scumble', color: r.pick(['#f7a24a', C.gold, '#ffcf8a', C.rose]), w: r(0.6, 1.1), curv: 0.6, seed: 'pt' + k });
    }
    strokeBatch(c, pet);
    // flame tongues in clusters
    const fl = [];
    const clusters = Array.from({ length: 20 }, () => ({ a: r(0, TAU), w: r(0.06, 0.24), L: r(14, 60) }));
    for (let k = 0; k < 150; k++) {
      const cl = clusters[k % clusters.length];
      const a = cl.a + r(-cl.w, cl.w), L = cl.L * r(0.35, 1.1) * (k % 6 === 0 ? 1.5 : 1), bend = r(-0.7, 0.7);
      const pts = [];
      for (let j = 0; j <= 6; j++) {
        const s2 = j / 6, rr = R0 - 5 + L * s2;
        const aa = a + bend * s2 * s2 * (L / rr);
        pts.push([cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, 1.2 - s2]);
      }
      fl.push({ pts, brush: r() < 0.8 ? 'earth_flame' : 'dry', color: r.pick([C.amber, C.gold, C.orange, C.vermilion, '#ffcf7a', '#ff9a55']), w: r(0.7, 1.6), curv: 0.6, seed: 'corF' + k });
    }
    strokeBatch(c, fl);
    // prominences: arches of layered flame strokes
    const loops = [];
    for (let k = 0; k < 6; k++) {
      const a = r(0, TAU), w = r(0.1, 0.22), h = r(22, 55);
      for (let q = 0; q < 4; q++) {
        const pts = [];
        for (let j = 0; j <= 14; j++) {
          const s2 = j / 14;
          const aa = a - w / 2 + w * s2 + q * 0.006;
          const rr = R0 - 3 + h * Math.sin(Math.PI * s2) * (1 - q * 0.12);
          pts.push([cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, 0.5 + 0.6 * Math.sin(Math.PI * s2)]);
        }
        loops.push({ pts, brush: q < 2 ? 'earth_flame' : 'earth_hair', color: r.pick([C.orange, C.vermilion, C.amber, '#ff8a4a']), w: q < 2 ? r(0.9, 1.4) : r(0.8, 1.1), curv: 0.6, seed: `corP${k}_${q}` });
      }
    }
    strokeBatch(c, loops);
  });
}

// Planet / rock sprites: painted spheres (lit from the left), rotated at draw time to face the Sun
function paintPlanets(P) {
  const defs = [
    { base: '#c2401f', light: [C.amber, C.gold, '#ff9a55'], mid: [C.orange, '#e0553a', C.vermilion], shadow: ['#7a2230', '#4a1a30'], deep: '#2a1030', hi: '#ffe0a0' },  // molten
    { base: C.rust, light: ['#e9a37a', C.sand, '#d98a5a'], mid: [C.brick, '#b85a3a', C.rust], shadow: ['#5a2030', '#3a1a2a'], deep: '#1f1020', hi: '#ffe6c8' },           // rusty
    { base: C.ochre, light: [C.sand, '#f0d090', C.cream], mid: [C.ochre, '#d9a066', C.gold], shadow: ['#6a3a2a', '#4a2a2a'], deep: '#241420', hi: '#fff4d8' },            // ochre
    { base: '#8a8594', light: [C.lavender, '#d8d0e0', C.sand], mid: ['#8a8594', '#a098a8', '#9a8a90'], shadow: ['#4a4458', '#302a40'], deep: '#1a1628', hi: '#f4eefa' },  // grey
    { base: C.sky, light: ['#e8f6ff', C.aqua, '#cfe8f0'], mid: [C.sky, '#7aa8c0', C.aqua], shadow: [C.blue, '#1f3a5a'], deep: '#121c34', hi: '#ffffff' },                // icy
    { base: C.sand, light: [C.cream, '#f4dcaa', '#ffe8c0'], mid: [C.sand, C.ochre, '#d9a066'], shadow: ['#8a5a3a', '#5a3a30'], deep: '#2a1a20', hi: '#fff6e0' },          // banded giant
    { base: C.plum, light: [C.rose, '#e08aa0', C.magenta], mid: [C.magenta, C.plum, '#8a3a6a'], shadow: [C.purple, '#2a1438'], deep: '#170c24', hi: '#ffd8e8' },          // plum
    { base: '#b8a080', light: [C.cream, C.sand, '#e0cca8'], mid: ['#b8a080', '#a08a6a', C.sand], shadow: ['#5a4a40', '#3a3030'], deep: '#1f1a1c', hi: '#fffaf0' },          // pale
  ];
  return atlas(P, 'planets', 16, 220, (c, cx, cy, i) => {
    const r = c.r;
    const d = defs[i % 8];
    const rock = i >= 8;
    const R0 = rock ? 70 : 96;
    const features = (cc, x, y, R, at) => {
      if (i === 5) {
        // bands: strokes along latitude lines
        const bl = [];
        for (let k = 0; k < 11; k++) {
          const lat = -1.2 + (k / 10) * 2.4, pts = [];
          for (let j = 0; j <= 14; j++) {
            const lon = -1.5 + (3.0 * j) / 14;
            pts.push([x + Math.cos(lat) * Math.sin(lon) * R * 0.97, y + Math.sin(lat) * R * 0.97 + 2 * Math.sin(lon * 4 + k), 0.4 + 0.6 * Math.sin((Math.PI * j) / 14)]);
          }
          bl.push({ pts, brush: 'earth_body', color: r.pick([C.ochre, C.rust, '#d9a066', C.cream, '#b86a3a']), w: r(0.9, 1.6), curv: 0.5, seed: `bd${k}` });
        }
        strokeBatch(cc, bl);
      } else if (i === 0) {
        const cr = [];
        for (let k = 0; k < 12; k++) {
          const th = r(0.1, 1.5), ph = r(0, TAU), L = r(0.2, 0.5);
          const pts = [];
          for (let j = 0; j <= 5; j++) { const p = at(th + 0.1 * Math.sin(j + k), ph + (L * j) / 5); if (p) pts.push([p[0], p[1], 1 - j * 0.12]); }
          if (pts.length > 2) cr.push({ pts, brush: 'earth_flame', color: r.pick([C.gold, '#ffe39a', C.amber]), w: r(0.5, 0.9), curv: 0.5, seed: `lv${k}` });
        }
        strokeBatch(cc, cr);
      } else if (rock || i === 3 || i === 7 || i === 1) {
        for (let k = 0; k < (rock ? 6 : 9); k++) crater(cc, at(r(0.2, 1.5), r(0, TAU)), r(5, 14) * (R / 96), Math.PI, mixHex(d.shadow[0], '#000000', 0.2), d.hi, `cr${i}_${k}`);
      }
    };
    if (rock) {
      // irregular silhouette under the painted sphere
      c.washPoly(c.blob(cx, cy, R0 * 1.02, R0 * r(0.8, 0.95), { n: 40, wobble: 0.14, rot: r(0, TAU) }), d.deep, 255);
    }
    paintSphere(c, cx, cy, R0, d, { seed: 'pl' + i, n: rock ? 90 : 170, features, wobble: rock ? 0.05 : 0.008, terminator: 1.75 });
  }, { cols: 4, scale: 1 });
}

// painted night-sky tiles (strokes only, transparent) placed on the celestial sphere
const TILE = 900;
function paintSkyTiles(P) {
  const tones = ['#16223a', '#1b2a48', '#0a1120', '#221c3a', '#10243a', '#2a2248', '#123040'];
  return atlas(P, 'skyTiles', 6, TILE, (c, cx, cy, i) => {
    const r = c.r;
    const mix = () => mixHex(C.night, r.pick(tones.slice(0, 5)), r(0.25, 0.8));
    // soft haze lobes (kept inside the cell)
    for (let k = 0; k < 4; k++) c.fillPoly(c.blob(cx + r(-160, 160), cy + r(-110, 110), r(110, 200), r(60, 120), { rot: r(-0.5, 0.5), wobble: 0.25 }), r.pick([C.navy2, '#1b2a48', '#221c3a']), { opacity: 12, bleed: 0.18, texture: 0.9, border: 0.1 });
    const ang = r(-0.3, 0.3);
    for (let k = 0; k < 34; k++) {
      const len = r(280, 620), a = ang + r(-0.2, 0.2);
      let x = cx + r(-200, 200) - Math.cos(a) * len / 2, y = cy + r(-260, 260) - Math.sin(a) * len / 2;
      const pts = [];
      for (let j = 0; j < 7; j++) {
        pts.push([x, y, lerp(0.35, 1.05, Math.sin((j / 6) * Math.PI))]);
        x += Math.cos(a + 0.25 * Math.sin(j * 0.9 + k)) * (len / 6);
        y += Math.sin(a + 0.25 * Math.sin(j * 0.9 + k)) * (len / 6);
      }
      c.strokePath(pts, r() < 0.6 ? 'gouache' : 'dry', mix(), r(0.6, 1.5), 0.6);
    }
    for (let k = 0; k < 14; k++) {
      const x = cx + r(-280, 280), y = cy + r(-220, 220), pts = [];
      for (let j = 0; j < 5; j++) pts.push([x + r(-50, 50), y + r(-25, 25)]);
      c.strokePath(pts, 'charcoal', mix(), r(1.2, 2.2), 0.8);
    }
    for (let k = 0; k < 5; k++) {
      const x = cx + r(-250, 250), y = cy + r(-200, 200), a = r(0, TAU);
      c.line(x, y, x + Math.cos(a) * r(80, 200), y + Math.sin(a) * r(80, 200), 'earth_speck', r.pick(['#2a3050', '#3a2a50', '#1e3a4a']), 0.6);
    }
  }, { cols: 3, scale: 0.55 });
}

function paintRays(P) {
  return P.layer('starRays', { w: 1600, h: 1600, scale: 0.6 }, (c) => {
    const r = c.r, cx = 800, cy = 800;
    const list = [];
    for (let k = 0; k < 90; k++) {
      const a = (k / 90) * TAU + r(-0.03, 0.03);
      const L = (k % 6 === 0 ? r(520, 760) : k % 2 ? r(160, 420) : r(260, 560));
      const r0 = r(20, 60), pts = [];
      for (let j = 0; j <= 6; j++) {
        const s2 = j / 6, rr = r0 + (L - r0) * s2;
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.2 - s2 * 1.05]);
      }
      list.push({ pts, brush: k % 3 ? 'earth_hair' : 'earth_flame', color: r.pick(['#fff2d8', '#ffd9a0', '#ffe8c0', '#f7b86a', '#ffc98a']), w: k % 3 ? r(0.9, 1.6) : r(0.5, 0.9), curv: 0.2, seed: 'ray' + k });
    }
    strokeBatch(c, list);
  });
}

export function paintSpace(P) {
  const A = {};
  A.rays = paintRays(P);
  A.sun = paintSun(P);
  A.corona = paintCorona(P);
  A.planets = paintPlanets(P);
  A.sky = paintSkyTiles(P);
  // tile directions (world space, at infinity) covering the sky the camera sweeps
  const r = rng('earth-skytiles');
  A.skyDirs = [];
  for (let i = 0; i < 90; i++) {
    const az = r(-0.8, 2.0), el = r(-1.0, 0.55);
    A.skyDirs.push({ d: [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], i: i % 6, s: r(1.0, 1.5), rot: r(-0.4, 0.4) });
  }
  return A;
}

// ---------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------
// star directions: the pivot's stars mapped through the lt = 0 camera, so frame 0 equals the pivot
let STARDIRS = null;
function starDirs(stars) {
  if (STARDIRS) return STARDIRS;
  const cam = camAt(0);
  STARDIRS = stars.map((s) => {
    const x = (s.x - 960) / cam.F, y = -(s.y - 540) / cam.F;
    const d = v3.norm(v3.add(v3.add(v3.mul(cam.r, x), v3.mul(cam.u, y)), cam.f));
    return d;
  });
  return STARDIRS;
}

export function drawStars(R, AS, cam, alpha = 0.55) {
  const dirs = starDirs(AS.stars);
  const out = [];
  const t = R.t;
  AS.stars.forEach((s, i) => {
    const p = cam.projDir(dirs[i]);
    if (!p || p[0] < -20 || p[0] > 1940 || p[1] < -20 || p[1] > 1100) return;
    const tw = 1 - 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.f * 2.1 + s.ph));
    out.push([p[0], p[1], s.s * 2.2, 0, s.col[0], s.col[1], s.col[2], s.b * tw * alpha]);
  });
  R.particles(out, { kind: 'glow', blend: 'add' });
}

// Sun screen state
export function sunState(cam) {
  const s = cam.sphere([0, 0, 0], SYS.sunR);
  return s;
}

function drawSun(R, A, cam, lt, s) {
  const tw = 1 + 0.04 * Math.sin(R.t * 5.1) + 0.03 * Math.sin(R.t * 8.3);
  const rs = s.r;
  // the star's glare gives way to a painted disc as it resolves; light stays in the halo around it
  const res = smoothstep(3, 90, rs);
  const k = 1 + rs / 34;
  const k2 = 1 + rs / 70;
  R.glow(s.x, s.y, 130 * k2, [1, 0.68, 0.38], 0.32 * (1 - 0.5 * res), { shape: [1.2, 0.4, 1.6], ext: 4 });
  if (res > 0) R.glow(s.x, s.y, rs * 1.18, [1, 0.6, 0.28], 0.55 * res, { shape: [0.7, 0.55, 1.2], ext: 2.6 });
  if (rs > 0.6) {
    const sc = rs / SUN_R;
    const rot = 0.05 * lt;
    // corona: flames flicker with a gentle noise warp in screen space
    const cw = { type: 'noise', amp: 5 * sc * 3, freq: 0.012 / Math.max(sc, 0.05), time: lt * 0.9 };
    R.layer(A.corona, M.place(s.x, s.y, sc, rot * 0.6, 500, 500), { opacity: smoothstep(1, 12, rs), warp: rs > 20 ? cw : undefined, grade: [1.05, 1.15, 1] });
    const sw = rs > 25 ? { warp: { type: 'noise', amp: 1.2 * sc * 3, freq: 0.03 / Math.max(sc, 0.05), time: lt * 0.6 } } : {};
    R.layer(A.sun, M.place(s.x, s.y, sc, rot, 240, 240), { ...sw, grade: [1.08, 1.1, 1.02] });
  }
  const glare = (1 - res) * (1 - res);
  R.glow(s.x, s.y, 34 * k * (1 - 0.1 * res), [1, 0.93, 0.8], 2.2 * tw * glare, { shape: [2.5, 0.6, 2.2], ext: 5 });
  // painted starburst: swells as we fall towards the star, then gives way to the resolved corona
  const burst = smoothstep(0.05, 1.1, lt) * (1 - smoothstep(2.2, 3.6, lt));
  if (burst > 0.001 && A.rays) {
    const sc = (0.18 + 0.55 * smoothstep(0, 3, lt)) * (1 + 0.04 * Math.sin(R.t * 3.3));
    R.layer(A.rays, M.place(s.x, s.y, sc, 0.08 * lt, 800, 800), { blend: 'add', opacity: 0.55 * burst, grade: [1, 1.4, 1] });
    R.layer(A.rays, M.place(s.x, s.y, sc * 0.72, -0.05 * lt + 0.035, 800, 800), { blend: 'add', opacity: 0.35 * burst, grade: [1, 1.2, 1] });
  }
}

// disk strokes for the current frame, split front/back of the Sun
function diskStrokes(cam, lt, sunDepth) {
  const back = [], front = [];
  const boil = Math.floor(R_KEY12(lt));
  for (const s of STROKES) {
    if (lt < s.birth) continue;
    const inf = infall(lt, s.birth, s.bdur);
    const q = clumpQ(s, lt);
    if (q > 0.985) continue;
    const w = omega(s.a);
    const head = s.th0 + w * lt + inf.dth;
    const span = s.span * Math.pow(inf.p, 0.7) * (1 - 0.85 * q);
    if (span < 0.01) continue;
    const n = Math.max(6, Math.min(26, Math.ceil(span * s.a * 3)));
    const raw = [];
    for (let j = 0; j <= n; j++) {
      const u = j / n; // 0 = head, 1 = tail
      const th = head - span * u;
      const aa = s.a * inf.rMul * (1 + s.spiral * (1 - inf.p) * u * 0.35) * (1 + s.wamp * Math.sin(th * 3 + s.wob));
      const X = diskPoint(aa, th, s.y0 * (1 + 2 * (1 - inf.p)), s.clump, q, lt);
      const p = cam.proj(X);
      const ok = p[2] > (s.lane ? 1.2 : 0.35);
      const pr = Math.pow(Math.sin(Math.PI * clamp(u * 0.94 + 0.03)), 0.6) * clamp(p[3] / 180, 0.35, s.lane ? 1.5 : 2.0);
      raw.push({ x: p[0], y: p[1], pr, ok, front: p[2] < sunDepth, vis: ok && p[0] > -100 && p[0] < 2020 && p[1] > -100 && p[1] < 1180 });
    }
    const wmul = (1 - 0.6 * q) * lerp(0.4, 1, inf.p);
    let seg = [], segFront = null, k = 0;
    const flush = () => {
      if (seg.length > 2) (segFront ? front : back).push({ pts: seg, brush: s.brush, color: s.color, w: s.w * wmul, curv: 0.5, seed: `ds${s.i}_${k++}_${boil}` });
      seg = [];
    };
    for (let j = 0; j < raw.length; j++) {
      const r0 = raw[j];
      const near = r0.vis || (j > 0 && raw[j - 1].vis) || (j < raw.length - 1 && raw[j + 1].vis);
      if (!r0.ok || !near) { flush(); segFront = null; continue; }
      if (segFront !== null && r0.front !== segFront) { const last = seg[seg.length - 1]; flush(); if (last) seg.push(last); }
      segFront = r0.front;
      seg.push([r0.x, r0.y, r0.pr]);
    }
    flush();
  }
  // accretion swirls: short curved strokes spiralling into each forming planet
  for (const c of CLUMPS) {
    if (c.minor) continue;
    const w = win(lt, c.t0 - 0.2, c.t0 + 0.6, c.t1 - 0.3, c.t1 + 0.5);
    if (w <= 0.01) continue;
    const C0 = clumpPos(c, lt);
    const pc = cam.proj(C0);
    if (!(pc[2] > 0.3) || pc[0] < -300 || pc[0] > 2220 || pc[1] < -300 || pc[1] > 1380) continue;
    const R0 = (c.earth ? 0.85 : 0.5) * (c.earth ? 1 : Math.sqrt(c.a / 5));
    for (let k = 0; k < 9; k++) {
      const a0 = (k / 9) * TAU + lt * (1.6 + 0.3 * (k % 3)), rad = R0 * (0.35 + 0.65 * ((k * 0.37 + lt * 0.4) % 1)) * (1.2 - 0.6 * smoother(c.t0, c.t1, lt));
      const pts = [];
      for (let j = 0; j <= 7; j++) {
        const a = a0 + j * 0.28, rr = rad * (1 - j * 0.06);
        const p = cam.proj([C0[0] + Math.cos(a) * rr, (Math.sin(a * 2) * 0.02) * rr, C0[2] + Math.sin(a) * rr]);
        if (!(p[2] > 0.3)) break;
        pts.push([p[0], p[1], (0.3 + 0.8 * Math.sin((Math.PI * j) / 7)) * clamp(p[3] / 200, 0.4, 1.6)]);
      }
      if (pts.length > 2) (pc[2] < sunDepth ? front : back).push({ pts, brush: k % 3 ? 'earth_hair' : 'dry', color: ['#ffd9a0', C.amber, C.rose, C.cream][k % 4], w: (k % 3 ? 1.1 : 0.45) * w, curv: 0.6, seed: 'acc' + c.id + '_' + k + '_' + boil });
    }
  }
  return { back, front };
}
const R_KEY12 = (lt) => lt * 12;
function onScreenPts(pts) {
  for (const p of pts) if (p[0] > -60 && p[0] < 1980 && p[1] > -60 && p[1] < 1140) return true;
  return false;
}

function drawDust(R, cam, lt) {
  const out = [];
  const t = lt;
  for (const d of DUST) {
    if (lt < d.birth - 0.2) continue;
    const inf = infall(lt, d.birth, 1.3);
    const q = clumpQ(d, lt);
    if (q > 0.97) continue;
    const th = d.th0 + omega(d.a) * lt + inf.dth;
    const X = diskPoint(d.a * inf.rMul, th, d.y0 * (1 + 2 * (1 - inf.p)), d.clump, q, lt);
    const p = cam.proj(X);
    if (!(p[2] > 0.3) || p[0] < -20 || p[0] > 1940 || p[1] < -20 || p[1] > 1100) continue;
    const size = clamp(d.s * p[3] / 160, 0.5, 7);
    const tw = d.icy ? 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(t * d.tw * 2 + d.ph), 3) : 0.8 + 0.2 * Math.sin(t * d.tw + d.ph);
    const a = d.al * smoothstep(0, 0.6, inf.p) * (1 - q) * tw;
    out.push([p[0], p[1], size, 0, d.col[0], d.col[1], d.col[2], a]);
  }
  R.particles(out, { kind: 'glow', blend: 'add' });
}

function drawRocksAndPlanets(R, A, cam, lt, sun) {
  const items = [];
  for (const rk of ROCKS) {
    if (lt < rk.birth) continue;
    const q = clumpQ(rk, lt);
    if (q > 0.97) continue;
    const inf = infall(lt, rk.birth, 1.4);
    const X = diskPoint(rk.a * inf.rMul, rk.th0 + omega(rk.a) * lt + inf.dth, rk.y0, rk.clump, q, lt);
    const s = cam.sphere(X, rk.rad * (1 - 0.7 * q) * smoothstep(0, 0.5, inf.p));
    if (!s || s.r < 0.45 || s.x < -50 || s.x > 1970 || s.y < -50 || s.y > 1130) continue;
    items.push({ z: s.z, draw: () => {
      const rot = Math.atan2(sun.y - s.y, sun.x - s.x) - Math.PI;
      A.planets.draw(R, rk.sprite, s.x, s.y, s.r * 2 * 110 / 70, rot + rk.spin * 0.2);
    } });
  }
  for (const c of CLUMPS) {
    if (c.earth) continue;
    const m = smoother(c.t0 + 0.3, c.t1, lt);
    if (m <= 0) continue;
    const X = clumpPos(c, lt);
    const s = cam.sphere(X, c.rad * Math.pow(m, 0.6));
    if (!s || s.x < -300 || s.x > 2220 || s.y < -300 || s.y > 1380) continue;
    items.push({ z: s.z, draw: () => {
      const heat = win(lt, c.t0 + 0.4, c.t1 - 0.3, c.t1, c.t1 + 1.2);
      if (s.r < 1.2) {
        R.glow(s.x, s.y, 3 + s.r * 2, [1, 0.75, 0.45], 0.25 + 0.6 * heat, { ext: 3 });
        return;
      }
      const rot = Math.atan2(sun.y - s.y, sun.x - s.x) - Math.PI;
      R.glow(s.x, s.y, s.r * 2.2, [1, 0.6, 0.3], 0.12 + 0.5 * heat, { shape: [1.2, 0.3, 2], ext: 3 });
      A.planets.draw(R, c.sprite, s.x, s.y, s.r * 2 * 110 / 96, rot);
      if (heat > 0.01) R.glow(s.x, s.y, s.r * 1.05, [1, 0.55, 0.25], 0.5 * heat, { shape: [1.8, 0.2, 2], ext: 2 });
    } });
  }
  return items;
}

// the planet (Earth) screen state from the 3D camera
export function earthScreen(cam, lt) {
  const E = earthPos(lt);
  const c = CLUMPS.find((x) => x.earth);
  const m = smoother(c.t0 + 0.4, c.t1, lt);
  const s = cam.sphere(E, SYS.earthR * Math.max(1e-4, Math.pow(m, 0.6)));
  return s ? { ...s, m } : null;
}

// Main space draw (lt < ~11.5)
export function drawSpace(R, A, lt, AS, opts = {}) {
  const { drop = 0, earthCircle = null, earthOpts = {} } = opts;
  const lc = Math.min(lt, 11.3);
  const cam = camAt(lc);
  const sun = sunState(cam);
  R.push(M.translate(0, drop));
  // backdrop: painted sky tiles at infinity; the pivot's night canvas streams past as dust haze
  for (const w of A.skyDirs) {
    const p = cam.projDir(w.d);
    if (!p || p[0] < -900 || p[0] > 2820 || p[1] < -700 - drop || p[1] > 1780 - drop) continue;
    A.sky.draw(R, w.i, p[0], p[1], TILE * w.s, w.rot + cam.roll);
  }
  const hz = 1 - smoothstep(0.25, 2.9, lt);
  if (hz > 0) {
    const zs = 1 + 2.2 * Math.pow(smoother(0, 3.2, lt), 1.2);
    R.layer(AS.canvas, M.place(sun.x, sun.y, zs, 0, 960, 540), { opacity: hz });
  }
  drawStars(R, AS, cam, 0.55);
  if (lt < 3.4) drawApproachDust(R, lt, sun);
  // the disk (gone by the descent)
  const { back, front } = lt > 2.2 && lt < 11.3 ? diskStrokes(cam, lt, sun.z) : { back: [], front: [] };
  if (back.length) R.layer(R.dyn('diskBack', R.key(30), (c) => strokeBatch(c, back)));
  if (sun.y + drop - sun.r < 1400) drawSun(R, A, cam, lt, sun);
  if (front.length) R.layer(R.dyn('diskFront', R.key(30), (c) => strokeBatch(c, front)));
  if (lt > 1.2 && lt < 11.3) drawDust(R, cam, lt);
  const items = lt > 2.2 && lt < 11.3 ? drawRocksAndPlanets(R, A, cam, lt, sun) : [];
  const es = !earthCircle && lt > 5.4 ? earthScreen(cam, lt) : null;
  if (es && es.r > 0.05) items.push({ z: es.z, draw: () => drawEarth(R, A, lt, { ...es, sun, cam }) });
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.draw();
  if (es && es.r > 0.05) drawEarthEvents(R, lt, es);
  R.pop();
  const sunS = { x: sun.x, y: sun.y + drop, r: sun.r };
  if (earthCircle) drawEarth(R, A, lt, { ...earthCircle, m: 1, sun: sunS }, earthOpts);
  return { cam, sun: sunS, es };
}

// ---------------------------------------------------------------------------------------------
// The planet's birth flash (37.5 s) and meteor strikes (38.9, 39.375, 40.0 s), in planet-local units
const METEORS = [
  { t: 8.75, u: 0.35, v: -0.42, dir: [0.8, -0.6], len: 2.2, size: 0.6 },
  { t: 9.375, u: -0.25, v: 0.3, dir: [0.9, -0.44], len: 2.6, size: 0.7 },
  { t: 10.0, u: 0.42, v: -0.12, dir: [0.75, -0.66], len: 3.4, size: 1.6 },
];
export function meteorImpact(lt) {
  let f = 0;
  for (const m of METEORS) if (lt >= m.t) f = Math.max(f, m.size * Math.exp(-(lt - m.t) * 6));
  return f;
}
export function drawEarthEvents(R, lt, es) {
  const { x, y, r } = es;
  // birth: the gathering glow peaks as the last dust falls in
  const pre = smoothstep(6.4, 7.5, lt) * (lt < 7.5 ? 1 : Math.exp(-(lt - 7.5) * 3.5));
  if (pre > 0.01) {
    R.glow(x, y, 22 + r * 2.5, [1, 0.72, 0.42], 1.3 * pre, { shape: [1.6, 0.5, 2], ext: 3 });
    R.glow(x, y, 70 + r * 4, [1, 0.5, 0.25], 0.25 * pre, { shape: [0.7, 0.5, 2], ext: 2.5 });
  }
  const t = R.t;
  const sparks = [];
  for (const [mi, m] of METEORS.entries()) {
    const dt = lt - m.t;
    const px = x + m.u * r, py = y + m.v * r;
    if (dt < 0 && dt > -0.6) {
      // incoming bolide: bright head, streaking trail (light)
      const s = 1 + dt / 0.6; // 0..1 approach
      const d = m.len * (1 - s) * (1 - s) + 0.02;
      const hx = px + m.dir[0] * d * r, hy = py + m.dir[1] * d * r;
      const ang = Math.atan2(m.dir[1], m.dir[0]);
      const L = Math.max(20, r * 0.9 * m.size);
      R.glow(hx + m.dir[0] * L * 0.5, hy + m.dir[1] * L * 0.5, L * 0.5, [1, 0.72, 0.45], 0.55 * m.size * smoothstep(0, 0.3, s), { shape: [1.4, 0.3, 2], sx: 1, sy: 0.07, rot: ang, ext: 2.5 });
      R.glow(hx, hy, 6 + 5 * m.size, [1, 0.95, 0.85], 1.8 * m.size * smoothstep(0, 0.2, s), { shape: [2, 0.5, 2], ext: 4 });
    }
    if (dt >= 0 && dt < 2.2) {
      // flash, lingering melt glow, shock ring, thrown sparks
      const fl = Math.exp(-dt * 7);
      R.glow(px, py, (16 + r * 0.18) * m.size, [1, 0.9, 0.7], 1.7 * fl * Math.min(m.size, 1.2), { shape: [1.6, 0.6, 2], ext: 4 });
      R.glow(px, py, (8 + r * 0.08) * m.size, [1, 0.5, 0.2], 1.2 * Math.exp(-dt * 1.4) * m.size, { shape: [1.4, 0.3, 2], ext: 3 });
      const ringR = r * (0.05 + 0.5 * (1 - Math.exp(-dt * 2.2))) * m.size;
      const ra = Math.exp(-dt * 2.2);
      const nx = m.u, ny = m.v, foreshort = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
      const na = Math.atan2(ny, nx);
      for (let k = 0; k < 150; k++) {
        const a = (k / 150) * TAU + 0.02 * hash(k, 64);
        const rj = ringR * (0.9 + 0.2 * hash(k + mi * 500, 65));
        const ex = Math.cos(a) * rj * foreshort, ey = Math.sin(a) * rj;
        const qx = px + ex * Math.cos(na) - ey * Math.sin(na), qy = py + ex * Math.sin(na) + ey * Math.cos(na);
        sparks.push([qx, qy, (1.2 + 2.2 * hash(k, 66)) * (1 + r * 0.003), 0, 1, 0.7 + 0.2 * hash(k, 67), 0.4, 0.5 * ra * (0.5 + hash(k, 68))]);
      }
      for (let k = 0; k < 70 * m.size; k++) {
        const h1 = hash(k + mi * 1000, 61), h2 = hash(k + mi * 1000, 62), h3 = hash(k + mi * 1000, 63);
        const a = na + (h1 - 0.5) * 2.4 + Math.PI * 0.0, v = (0.25 + h2 * 0.9) * r * 0.5 * m.size;
        const life = 0.5 + h3 * 1.2;
        if (dt > life) continue;
        const g = 0.9 * r * 0.35;
        const sx = px + Math.cos(a) * v * dt, sy = py + Math.sin(a) * v * dt + 0.5 * g * dt * dt * 0.3;
        const c = 1 - dt / life;
        sparks.push([sx, sy, (1.5 + 2.5 * h2) * (0.6 + r * 0.002), 0, 1, 0.55 + 0.35 * c, 0.25 + 0.4 * c, c]);
      }
    }
  }
  if (sparks.length) R.particles(sparks, { kind: 'glow', blend: 'add' });
}

// dust of the stellar nursery streaming past as we fall towards the star (lt 0 .. 3.4)
const APPROACH = (() => {
  const r = rng('earth-approach');
  return Array.from({ length: 420 }, () => ({ a: r(0, TAU), d0: Math.pow(r(), 0.5), t0: r(-1.2, 2.6), s: r(0.6, 2.4), c: r(), sp: r(0.7, 1.4) }));
})();
function drawApproachDust(R, lt, sun) {
  const out = [];
  const env = smoothstep(0.05, 0.6, lt) * (1 - smoothstep(2.6, 3.4, lt));
  if (env <= 0) return;
  for (const p of APPROACH) {
    // each mote drifts out from the vanishing point, accelerating (perspective), then leaves the frame
    const age = lt - p.t0;
    if (age <= 0) continue;
    const d = (20 + 140 * p.d0) * Math.exp(age * 1.35 * p.sp);
    if (d > 1500) continue;
    const x = sun.x + Math.cos(p.a) * d, y = sun.y + Math.sin(p.a) * d * 0.86;
    const near = clamp(d / 900);
    const col = p.c < 0.5 ? [1, 0.82, 0.62] : p.c < 0.8 ? [0.85, 0.75, 1] : [1, 0.95, 0.88];
    out.push([x, y, p.s * (1.2 + 4.5 * near), 0, col[0], col[1], col[2], 0.95 * env * smoothstep(0, 0.35, age) * (0.45 + 0.55 * near)]);
  }
  R.particles(out, { kind: 'glow', blend: 'add' });
}
