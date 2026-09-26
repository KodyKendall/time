// ANCESTORS — the sky: one continuous sky that is exactly PIVOT.ash at lt = 0 and exactly PIVOT.night
// at lt = 12.5, transforming in between (ash clears, a veiled sun contracts into a bright sun, sets;
// night falls, stars come out, the milky way appears).
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, circlePts } from '../lib/kit.js';
import { ease, invLerp, noise1, fbm1 } from '../../engine/math.js';
import { PIVOT } from '../pivots.js';
import { K, planeView } from './timeline.js';

// ---------------------------------------------------------------------------------------------
// Colour keys: A = top (y -200), B = y 1280 (bottom edge of the pivot sky), C = y 2700 (horizon).
// ---------------------------------------------------------------------------------------------
const SKY_KEYS = [
  { t: 0.0, A: '#3a3742', B: '#77707c', C: '#9e97a8' },
  { t: 3.3, A: '#3a3742', B: '#77707c', C: '#9e97a8' },
  { t: 4.6, A: '#6c7c80', B: '#b9b89a', C: '#d8d3b0' },
  { t: 5.9, A: '#86aa9c', B: '#d5dc9e', C: '#f0e9b4' },
  { t: 7.6, A: '#80a296', B: '#dcd898', C: '#f3e2a8' },
  { t: 8.5, A: '#40507c', B: '#d88c6c', C: '#f2a45c' },
  { t: 9.4, A: '#18223e', B: '#4a4270', C: '#b0605e' },
  { t: 10.3, A: '#0e1628', B: '#1c2844', C: '#3a3a5c' },
  { t: 11.0, A: C.night, B: C.navy2, C: '#26304e' },
  { t: 12.5, A: C.night, B: C.navy2, C: '#26304e' },
];
function keyed(keys, lt, f) {
  if (lt <= keys[0].t) return keys[0][f];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (lt <= b.t) return mixHex(a[f], b[f], smoothstep(a.t, b.t, lt));
  }
  return keys[keys.length - 1][f];
}
export function skyColors(lt) {
  return { A: keyed(SKY_KEYS, lt, 'A'), B: keyed(SKY_KEYS, lt, 'B'), C: keyed(SKY_KEYS, lt, 'C') };
}

// Sun: veiled giant disc rising behind the burnt hills -> contracts into a bright sun as the ash
// clears -> sets (orange, red) behind the mountains. Sky-plane world coordinates.
export function sunState(lt) {
  const rise = ease.inOutSine(invLerp(0.6, 3.6, lt));
  const clear = ease.inOutSine(invLerp(3.9, 6.2, lt));
  const set = ease.inOutSine(invLerp(7.5, 9.7, lt));
  let x = lerp(1300, 1330, clear) + 60 * set;
  let y = lerp(1760, 1395, rise);
  y = lerp(y, 1170, clear);
  y = lerp(y, 1600, set);
  let r = lerp(520, 118, ease.inOutCubic(invLerp(3.9, 5.9, lt)));
  r = lerp(r, 150, set);
  // colour + light
  let col = mixHex('#b7afc4', '#fff0c6', clear);
  col = mixHex(col, '#f2803e', smoothstep(7.6, 8.8, lt));
  col = mixHex(col, '#d8452f', smoothstep(8.8, 9.6, lt));
  const veil = 1 - clear; // ash veil
  const glow = 0.06 * smoothstep(1.2, 3.4, lt) * veil + 1.25 * clear * (1 - 0.45 * set) * (1 - smoothstep(9.2, 9.8, lt));
  return { x, y, r, col, veil, glow, set, clear };
}

// Pivot cloud layer placement (as PIVOT.ash draws it) + our clearing drift.
function cloudM(R, lt) {
  const drift = ease.inOutSine(invLerp(3.3, 8.5, lt));
  return M.translate(-240 + 6 * Math.sin(R.t * 0.1) - 260 * drift, -160 - 90 * drift);
}
function cloudLook(lt) {
  // ash haze thins (atmosphere) and recolours with the light
  const clear = smoothstep(3.3, 5.8, lt);
  let op = lerp(1, 0.34, clear);
  op = lerp(op, 0.42, smoothstep(7.8, 8.6, lt));
  op *= 1 - smoothstep(9.2, 10.4, lt);
  const day = [0.98, 0.96, 0.8], dusk = [0.98, 0.62, 0.52], night = [0.25, 0.26, 0.42];
  let c = day, amt = 0.78 * clear;
  if (lt > 7.8) { const k = smoothstep(7.8, 8.7, lt); c = [lerp(day[0], dusk[0], k), lerp(day[1], dusk[1], k), lerp(day[2], dusk[2], k)]; amt = lerp(amt, 0.7, k); }
  if (lt > 8.8) { const k = smoothstep(8.8, 9.8, lt); c = [lerp(dusk[0], night[0], k), lerp(dusk[1], night[1], k), lerp(dusk[2], night[2], k)]; }
  return { op, color: [c[0], c[1], c[2], amt] };
}

// Screen-space linear mask: 1 above world-y `y0`, 0 below `y1` (for the current view).
function fadeBelow(R, y0, y1) {
  const a = R.toScreen(0, y0)[1], b = R.toScreen(0, y1)[1];
  return { type: 'linear', nx: 0, ny: -1, d0: -b, d1: -a };
}
function fadeAbove(R, y0, y1) {
  const a = R.toScreen(0, y0)[1], b = R.toScreen(0, y1)[1];
  return { type: 'linear', nx: 0, ny: 1, d0: a, d1: b };
}

// ---------------------------------------------------------------------------------------------
export function paintSky(P) {
  // Ash clouds continued below the pivot's cloud layer (same recipe), for the horizon region.
  const lowClouds = P.layer('lowClouds', { w: 2600, h: 1000, scale: 0.75 }, (c) => {
    const r = c.r;
    for (let i = 0; i < 22; i++) {
      c.fillPoly(c.blob(r(-100, 2700), r(150, 900), r(180, 460), r(80, 200), { rot: r(-0.3, 0.3), wobble: 0.18 }),
        r.pick(['#5c5764', '#6f6878', '#3d3a45', '#7d7166', '#57504a', '#8a8298']), { opacity: 60, bleed: 0.14, texture: 0.85, border: 0.2 });
    }
    for (let i = 0; i < 26; i++) {
      const y = r(120, 950), x = r(-200, 2600), pts = [];
      for (let k = 0; k < 6; k++) pts.push([x + k * 90, y + 14 * Math.sin(k * 1.3 + i)]);
      c.strokePath(pts, 'dry', r.pick(['#8a8594', '#b3a9c4', '#4d4a57']), r(0.6, 1.2), 0.5);
    }
  });
  // The sun disc (pale, textured; recoloured per phase).
  const sun = P.layer('sunDisc', { w: 600, h: 600, scale: 1 }, (c) => {
    const o = circlePts(300, 300, 280, 140);
    c.washPoly(o, '#e9e3ef', 255);
    c.fillPoly(o, '#ffffff', { opacity: 110, bleed: 0.01, texture: 0.7, border: 0.5 });
    const r = c.r;
    for (let i = 0; i < 9; i++) c.fillPoly(c.blob(300 + r(-120, 120), 300 + r(-120, 120), r(40, 110), r(30, 80)), r.pick(['#d6cfe0', '#f4f0f8', '#ddd4e6']), { opacity: 50, bleed: 0.05, texture: 0.6 });
    c.strokePath(o.concat([o[0]]), 'ink', '#cfc6da', 1.2, 0.3);
  });
  // Brushed sky texture below the pivot frame (grey values; tinted to the sky colour per phase).
  const skyTex = P.layer('skyTex', { w: 3000, h: 900, scale: 0.7 }, (c) => {
    const r = c.r;
    c.washPoly([[-20, -20], [3020, -20], [3020, 920], [-20, 920]], '#808080', 255);
    for (let i = 0; i < 520; i++) {
      const y = r(0, 900), x = r(-200, 3000), len = r(150, 520), a = r(-0.06, 0.06);
      const pts = [];
      for (let k = 0; k < 5; k++) pts.push([x + (len * k) / 4, y + Math.sin(a) * (len * k) / 4 + 6 * Math.sin(k * 1.4 + i), 0.6 + 0.5 * Math.sin((Math.PI * k) / 4)]);
      const pick = r();
      const brush = pick < 0.5 ? 'gouache' : pick < 0.8 ? 'dry' : 'pastel';
      const tone = y < 500 ? r.pick(['#8e8e8e', '#9a9a9a', '#747474', '#868686', '#a8a8a8']) : r.pick(['#8a8a8a', '#969696', '#7a7a7a', '#b2b2b2']);
      c.strokePath(pts, brush, tone, brush === 'gouache' ? r(1.2, 3.2) : r(0.6, 1.4), 0.5);
    }
  });
  return { lowClouds, sun, skyTex };
}

// ---------------------------------------------------------------------------------------------
// Draw the sky (sky plane). Stars are handled by drawStars (they must stay behind the land).
export function drawSky(R, lt, A, ash, night) {
  const col = skyColors(lt);
  R.rect(-200, -200, 2320, 1480, [...hex(col.A), 1], { c1: [...hex(col.B), 1], grad: 'vertical' });
  if (lt > 0) R.rect(-600, 1280, 3120, 1420, [...hex(col.B), 1], { c1: [...hex(col.C), 1], grad: 'vertical' });
  // brushed day / dusk sky (atmosphere): appears as the ash clears, gives way to the night canvas
  const texA = 0.5 * smoothstep(3.6, 5.4, lt) * (1 - smoothstep(9.6, 11.0, lt));
  if (texA > 0.005 && A.skyTex) {
    const b = hex(col.B);
    R.layer(A.skyTex, M.translate(-540, 1050), { opacity: texA, tint: [b[0] * 2, b[1] * 2, b[2] * 2], mask: fadeAbove(R, 1070, 1180) });
  }
  // the night sky's painted canvas (PIVOT.night) settles in as the light goes; mirrored tiles keep
  // it seamless beyond the pivot frame while the camera is still down on the land
  const canA = 0.8 * smoothstep(9.3, 11.2, lt);
  if (canA > 0) {
    for (let j = 0; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const m = M.chain(M.translate(i === 1 ? 3840 : i === -1 ? 0 : 0, j === 1 ? 2160 : 0), M.scale(i === 0 ? 1 : -1, j === 0 ? 1 : -1));
      R.layer(night.canvas, m, { opacity: canA });
    }
  }
  // milky way comes out as night falls (light haze)
  const bandA = 0.85 * smoothstep(9.8, 11.6, lt);
  if (bandA > 0) R.layer(night.band, M.translate(-240, -160), { opacity: bandA });
}

export function drawSun(R, lt, A) {
  const s = sunState(lt);
  if (s.y - s.r > 2600) return;
  // warm light around the disc (light — may fade)
  if (s.glow > 0.001) {
    const gc = hex(mixHex('#fff4d8', '#ff8a40', s.set));
    R.glow(s.x, s.y, s.r * 1.1, gc, s.glow * 0.5, { shape: [1.4, 0.55, 1.4], ext: 3.2 });
    R.glow(s.x, s.y, s.r * 3.5, gc, s.glow * 0.12, { shape: [0.8, 0.4, 1.2], ext: 2.2 });
  }
  const c = hex(s.col);
  const op = lerp(0.5, 1, s.clear);
  R.layer(A.sun, M.place(s.x, s.y, s.r / 280, 0, 300, 300), { opacity: op, color: [c[0], c[1], c[2], 0.72] });
  if (s.clear > 0.05) R.glow(s.x, s.y, s.r * 0.9, hex(mixHex('#fffaf0', '#ffb070', s.set)), 0.9 * s.clear * (1 - smoothstep(9.0, 9.7, lt)), { shape: [1.6, 0.2, 2], ext: 1.6 });
}

export function drawClouds(R, lt, A, ash) {
  const look = cloudLook(lt);
  if (look.op <= 0.001) return;
  const m = cloudM(R, lt);
  if (lt <= 0) {
    R.layer(ash.clouds, m);
    return;
  }
  // pivot cloud layer; its bottom edge (world y 1240) is feathered away below y 1080 (off-screen at lt 0)
  const dy = m[5] + 160;
  R.layer(ash.clouds, m, { opacity: look.op, color: look.color, mask: fadeBelow(R, 1080 + dy, 1235 + dy) });
  // continuation for the horizon region
  R.layer(A.lowClouds, M.translate(m[4] - 100, 1000 + dy * 0.6), { opacity: look.op, color: look.color, mask: fadeAbove(R, 1090 + dy, 1200 + dy) });
}

// Falling ash (pivot flakes), tiled vertically (period 1180) so it also covers the land below.
export function drawFlakes(R, lt, ash) {
  const a = 1 - smoothstep(3.6, 5.2, lt);
  if (a <= 0) return;
  PIVOT.ash.drawFlakes(R, ash, a);
  if (lt > 0) {
    R.with(M.translate(0, 1180), () => PIVOT.ash.drawFlakes(R, ash, a));
    R.with(M.translate(0, 2360), () => PIVOT.ash.drawFlakes(R, ash, a));
  }
}

// ---------------------------------------------------------------------------------------------
// Stars (pivot night stars). Most come out as the sky darkens; a subset is born as sparks from the
// fire (see fire.js) — those are excluded here and drawn by the spark system.
// ---------------------------------------------------------------------------------------------
export function starFade(s, i) {
  // brighter stars come out first
  const r = rng('anc-star-' + i);
  const t0 = lerp(9.4, 10.9, 1 - s.b) + r(-0.3, 0.3);
  return [t0, t0 + 0.9];
}
export function drawStars(R, lt, night, sparkSet) {
  if (lt < 9.0) return;
  const out = [];
  const t = R.t;
  night.stars.forEach((s, i) => {
    if (sparkSet && sparkSet.has(i)) return;
    const [a0, a1] = starFade(s, i);
    const a = smoothstep(a0, a1, lt);
    if (a <= 0) return;
    const tw = 1 - 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.f * 2.1 + s.ph));
    out.push([s.x, s.y, s.s * 2.2, 0, s.col[0], s.col[1], s.col[2], s.b * tw * 0.9 * a]);
  });
  if (out.length) R.particles(out, { kind: 'glow', blend: 'add' });
}
