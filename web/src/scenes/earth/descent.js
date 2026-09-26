// EARTH — descent (lt ~10.6 .. 14): the planet fills the frame, its lava cools under steam and
// cloud, rain falls, the sea is laid down; the curved limb flattens into the night horizon.
// The planet is a screen circle (cx, cy, Rs): handed over from the 3D camera, then flattened.
import { C, M, TAU, lerp, clamp, hex, mixHex, smoothstep, smoother, win, spline, strokeBatch, hash, fbm2, noise1 } from './common.js';
import { camAt } from './camera.js';
import { earthScreen } from './space.js';

export const HORIZON = 405; // final horizon height (screen y)

const CIRCLE = [
  { t: 10.8, v: [960, -118, Math.log(718)] },
  { t: 11.4, v: [955, -100, Math.log(1150)] },
  { t: 12.0, v: [945, 0, Math.log(1900)] },
  { t: 12.6, v: [940, 160, Math.log(3600)] },
  { t: 13.2, v: [938, 300, Math.log(9000)] },
  { t: 13.8, v: [940, 392, Math.log(30000)] },
  { t: 14.4, v: [940, HORIZON, Math.log(120000)] },
];
// planet circle at lt (screen): {x, y, r, top}
export function planetCircle(lt) {
  const des = (t) => {
    const [x, top, lr] = spline(CIRCLE, Math.max(t, 10.8));
    const r = Math.exp(lr);
    return { x, y: top + r, r, top };
  };
  if (lt >= 11.3) return des(lt);
  const s3 = earthScreen(camAt(lt), lt);
  const d = des(lt);
  if (!s3) return d;
  const w = smoother(10.6, 11.3, lt);
  const r = Math.exp(lerp(Math.log(s3.r), Math.log(d.r), w));
  const x = lerp(s3.x, d.x, w), y = lerp(s3.y, d.y, w);
  return { x, y, r, top: y - r };
}
// the sky sinks as the camera pitches up towards the horizon (so the Sun sets behind the limb)
export function skyDrop(lt) {
  if (lt <= 10.8) return 0;
  const c = planetCircle(lt), c0 = planetCircle(10.8);
  return (c.top - c0.top) * 1.35;
}

// y of the planet limb at screen x (or null outside the circle)
export function limbY(c, x) {
  const dx = x - c.x;
  if (Math.abs(dx) >= c.r) return null;
  return c.y - Math.sqrt(c.r * c.r - dx * dx);
}

// ---------------------------------------------------------------------------------------------
// Lines parallel to the limb ("latitude" arcs), used for cloud bands and for the sea.
// u in (0,1]: 0 = at the limb/horizon, 1 = nearest. Returns screen points.
export function arcLine(c, depth, x0 = -80, x1 = 2000, step = 48, wav = null) {
  const pts = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    const dx = x - c.x;
    const rr = c.r - depth;
    if (rr <= 0 || Math.abs(dx) >= rr * 0.999) continue;
    let y = c.y - Math.sqrt(rr * rr - dx * dx);
    if (wav) y += wav(x);
    pts.push([x, y]);
  }
  return pts;
}

// sea depth mapping: how far below the limb (screen units) a line at u sits
export function seaDepth(c, u, lt) {
  // on the globe: foreshortened towards the limb; at sea level: perspective
  const flat = smoother(12.4, 14.2, lt);
  const globe = c.r * (1 - Math.cos(u * Math.PI * 0.5 * 0.9));
  const persp = 760 * Math.pow(u, 1.85);
  return lerp(globe, persp, flat);
}

// Painter for the sea lines: wavy hatched lines moving towards the camera.
// k = density/visibility (0..1). moonX: x of the Moon's reflection column (or null).
export function paintSea(c, circ, lt, t, { k = 1, moonX = null, glitter = 0, key = 0, bottom = 1140 } = {}) {
  const N = 78;
  const list = [];
  const speed = 0.09;
  for (let i = 0; i < N; i++) {
    const u0 = ((i + t * speed * N) % N) / N; // moves towards the camera
    const u = Math.max(0.004, u0);
    const depth = seaDepth(circ, u, lt);
    const yProbe = circ.top + depth;
    if (yProbe > bottom) continue;
    // each line is laid down from its centre outwards as the sea forms
    const tau = (i * 0.61803) % 1;
    const grow = clamp((k * 1.35 - tau * 0.9) * 2.2);
    if (grow <= 0.01) continue;
    const vis = smoothstep(0, 0.06, u) * lerp(0.6, 1, grow);
    const xc0 = 180 + ((i * 0.3819) % 1) * 1560, half = 60 + grow * 1300;
    const amp = lerp(0.6, 11, Math.pow(u, 1.4));
    const f = lerp(0.03, 0.009, u);
    const ph = i * 1.7 + t * (1.1 + (i % 5) * 0.13);
    const wav = (x) => amp * (Math.sin(x * f + ph) * 0.7 + Math.sin(x * f * 2.3 - ph * 1.3) * 0.3);
    // points on a FIXED screen grid (so hatching gaps and segment ends never jump)
    const STEP = 40;
    const x0 = Math.max(-80, xc0 - half), x1 = Math.min(2000, xc0 + half);
    const rr = circ.r - depth;
    const segs = [];
    let cur = [];
    for (let kx = Math.ceil((x0 + 80) / STEP); -80 + kx * STEP <= x1; kx++) {
      const x = -80 + kx * STEP;
      const dx = x - circ.x;
      if (rr <= 0 || Math.abs(dx) >= rr * 0.999) { if (cur.length > 2) segs.push(cur); cur = []; continue; }
      const y = circ.y - Math.sqrt(rr * rr - dx * dx) + wav(x);
      const gap = hash(i * 131 + kx, 5) < 0.2;
      if (gap) { if (cur.length > 2) segs.push(cur); cur = []; } else cur.push([x, y, lerp(0.5, 1.1, hash(i * 7 + kx, 9))]);
    }
    if (cur.length > 2) segs.push(cur);
    if (!segs.length) continue;
    // broad swell bodies (painted surface) under the line work, on fixed grid spans
    if (u > 0.08 && i % 2 === 0) {
      const k0 = Math.floor(hash(i, 91) * 30), k1 = k0 + 6 + Math.floor(hash(i, 92) * 22);
      const rr2 = circ.r - depth - lerp(2, 18, u);
      const sw = [];
      for (let kx = k0; kx <= k1; kx++) {
        const x = -80 + kx * STEP * 1.5;
        if (x < x0 || x > x1) continue;
        const dx = x - circ.x;
        if (rr2 <= 0 || Math.abs(dx) >= rr2 * 0.999) continue;
        sw.push([x, circ.y - Math.sqrt(rr2 * rr2 - dx * dx) + wav(x) * 0.6]);
      }
      if (sw.length > 2) {
        const ss = sw.map((p, j, arr) => [p[0], p[1], 0.3 + 0.7 * Math.sin((Math.PI * j) / Math.max(1, arr.length - 1))]);
        list.push({ pts: ss, brush: i % 4 === 0 ? 'earth_body' : 'dry', color: i % 3 ? '#16283e' : '#0a1422', w: lerp(0.6, 3.2, u) * vis * smoothstep(0.08, 0.2, u), curv: 0.5, seed: 'swb' + i + '_' + Math.floor(t * 12) });
      }
    }
    // brush and colour are fixed per line (no switching as the line travels); width grows with nearness
    const col = ['#8fb7c9', '#3f6f8f', '#5a88a8', '#274a6a', '#a9cbd6', '#6f9fb4'][i % 6];
    const brush = i % 5 === 0 ? 'dry' : i % 2 ? 'ink' : 'earth_hair';
    const w = lerp(0.45, 1.9, Math.pow(u, 0.8)) * (brush === 'dry' ? 0.35 : 1) * vis;
    segs.forEach((sg, q) => list.push({ pts: sg, brush, color: col, w, curv: 0.5, seed: 'sea' + i + '_' + sg[0][0] + '_' + Math.floor(t * 12) }));
    // moon glitter: short bright dashes on lines under the Moon
    if (moonX !== null && glitter > 0 && u > 0.02) {
      const spread = lerp(40, 260, Math.pow(u, 0.8));
      for (let g = 0; g < 3; g++) {
        const hsh = hash(i * 17 + g * 101 + Math.floor(t * 8), 3);
        if (hsh > glitter * 0.85) continue;
        const gx = moonX + (hash(i * 29 + g * 7 + Math.floor(t * 8), 4) - 0.5) * 2 * spread;
        const gy = limbY({ x: circ.x, y: circ.y, r: circ.r - depth }, gx);
        if (gy === null) continue;
        const L = lerp(8, 60, u) * (0.5 + hsh);
        list.push({ pts: [[gx - L / 2, gy + wav(gx), 0.4], [gx, gy + wav(gx) - 1, 1], [gx + L / 2, gy + wav(gx), 0.4]], brush: 'earth_hair', color: hsh < 0.3 ? '#fff6dc' : '#e8f0e0', w: lerp(0.8, 2.2, u), curv: 0.5, seed: `gl${i}_${g}` });
      }
    }
  }
  strokeBatch(c, list);
}

// Rain streaks (particles with an elongated texture are not available: use short strokes in a dyn
// layer painted on twelves — reads as hand-drawn rain)
export function paintRain(c, lt, t, dens, key, drop = 0) {
  const list = [];
  const N = Math.round(260 * dens);
  const k = Math.floor(t * 12);
  for (let i = 0; i < N; i++) {
    const x = hash(i * 3 + k * 977, 31) * 2200 - 140;
    const y = hash(i * 5 + k * 613, 32) * 1300 - 120;
    const L = lerp(30, 110, hash(i, 33));
    const a = 1.85 + 0.08 * Math.sin(t * 0.5);
    list.push({ pts: [[x, y, 0.2], [x + Math.cos(a) * L, y + Math.sin(a) * L, 1]], brush: 'earth_hair', color: i % 3 ? '#9fb4cc' : '#dfe8f0', w: lerp(0.6, 1.2, hash(i, 34)), curv: 0, seed: `rn${i}_${k}` });
  }
  strokeBatch(c, list);
}

// ---------------------------------------------------------------------------------------------
// Painted cloud banks over the cooling planet (steam condensing into storm clouds)
import { atlas } from '../lib/kit.js';
export function paintCloudDeck(P) {
  return atlas(P, 'cloudBanks', 6, 760, (c, cx, cy, i) => {
    const r = c.r;
    const base = ['#34344c', '#3c3a54', '#2e3048', '#403c58'][i % 4];
    const mids = ['#54546e', '#5e5a78', '#4a4c66', '#686482'];
    const tops = ['#9a94b4', '#b3a9c4', '#c8c0d8', '#8a8aa8'];
    const lobes = Array.from({ length: r.int(5, 7) }, (_, k) => ({ x: cx + r(-230, 230), y: cy + r(-30, 50) - (k % 2) * 30, rx: r(80, 150), ry: r(45, 85) }));
    for (const L of lobes) c.fillPoly(c.blob(L.x, L.y, L.rx, L.ry, { wobble: 0.2, rot: r(-0.2, 0.2) }), base, { opacity: 120, bleed: 0.1, texture: 0.8, border: 0.45 });
    for (const L of lobes) c.fillPoly(c.blob(L.x + r(-15, 15), L.y - L.ry * 0.25, L.rx * 0.78, L.ry * 0.6, { wobble: 0.22 }), r.pick(mids), { opacity: 100, bleed: 0.1, texture: 0.75, border: 0.4 });
    c.flush();
    // lit tops (twilight / moonlight from above), billow strokes following each lobe
    const st = [];
    lobes.forEach((L, k) => {
      for (let q = 0; q < 5; q++) {
        const a0 = Math.PI * 1.05 + r(0, 0.4), span = r(0.5, 1.1), rr = r(0.55, 0.95), pts = [];
        for (let j = 0; j <= 8; j++) {
          const a = a0 + (span * j) / 8;
          pts.push([L.x + Math.cos(a) * L.rx * rr, L.y + Math.sin(a) * L.ry * rr, 0.35 + 0.7 * Math.sin((Math.PI * j) / 8)]);
        }
        st.push({ pts, brush: q < 1 ? 'earth_body' : r.pick(['pastel', 'dry', 'pastel']), color: r.pick(tops), w: q < 1 ? r(0.4, 0.7) : r(0.6, 1.0), curv: 0.6, seed: 'cb' + i + '_' + k + '_' + q });
      }
      // under-shadow
      const pts = [];
      for (let j = 0; j <= 8; j++) { const a = 0.15 + (2.8 * j) / 8; pts.push([L.x + Math.cos(a) * L.rx * 0.85, L.y + Math.sin(a) * L.ry * 0.8, Math.sin((Math.PI * j) / 8)]); }
      st.push({ pts, brush: 'dry', color: '#1c1c30', w: 0.9, curv: 0.6, seed: `cs${i}_${k}` });
    });
    strokeBatch(c, st);
    // wisps trailing off the bank
    for (let k = 0; k < 6; k++) {
      const y = cy + r(-40, 60), x = cx + r(-300, 100), pts = [];
      for (let j = 0; j <= 5; j++) pts.push([x + j * 50, y + 6 * Math.sin(j + k), 1 - j * 0.15]);
      c.strokePath(pts, 'earth_hair', r.pick(tops), 0.9, 0.6);
    }
  }, { cols: 3, scale: 0.8 });
}
const BANKS = (() => {
  const out = [];
  for (let i = 0; i < 28; i++) out.push({ u: hash(i, 71) * 0.9 + 0.05, x: hash(i, 72) * 2300 - 190, sp: 0.07 + 0.05 * hash(i, 73), s: 0.75 + 0.6 * hash(i, 74), i: i % 6, flip: hash(i, 75) < 0.5, born: 10.9 + hash(i, 76) * 0.9 });
  return out;
})();
// draw the cloud banks (masked to the planet disc)
export function drawCloudDeck(R, A, lt, circ) {
  const dens = win(lt, 10.9, 11.9, 12.7, 13.9);
  if (dens <= 0.01) return;
  const mask = { type: 'ellipse', x: circ.x, y: circ.y, rx: circ.r, ry: circ.r, r0: 1 - 2 / circ.r, r1: 1 };
  const items = [];
  for (const b of BANKS) {
    const g = smoothstep(b.born, b.born + 0.9, lt);
    if (g <= 0) continue;
    // banks drift towards us (and past us) as we descend
    const u = b.u + b.sp * Math.max(0, lt - 11.0) * (1 + 2.2 * smoother(12.4, 13.9, lt));
    if (u > 1.25) continue;
    const depth = seaDepth(circ, Math.min(u, 1.2), lt) * (u > 1 ? 1 + (u - 1) * 3 : 1);
    const y = circ.top + depth;
    // perspective scale ~ spacing of sea lines at that depth
    const du = 0.02;
    const ds = Math.max(1, seaDepth(circ, Math.min(u + du, 1.2), lt) - seaDepth(circ, Math.min(u, 1.2), lt)) / du;
    const scale = clamp(ds / 900, 0.05, 3.2) * b.s * g;
    items.push({ y, draw: () => A.cloudBanks.draw(R, b.i, b.x + 20 * Math.sin(lt * 0.3 + b.u * 9), y, 760 * scale, 0, { opacity: dens, mask }) });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
}
