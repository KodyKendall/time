// SEA — living atmosphere: stars, spray over the surface band, plankton and motes at several depths,
// bubbles, light shafts. Particles and light only (they may fade); positions are pure functions of time.
import { M, TAU, lerp, clamp, rng, hex, mixHex, smoothstep, seg, ease, noise1 } from './lib.js';
import { bandY, BAND_W } from './backdrop.js';
import { groundY } from './terrain.js';

const STARS = (() => {
  const r = rng('sea-stars');
  return Array.from({ length: 700 }, () => {
    const x = r(-2500, 9000);
    return { x, y: bandY(x) - 60 - Math.pow(r(), 0.7) * 3200, s: lerp(0.8, 3.0, Math.pow(r(), 3)), ph: r(0, TAU), f: r(0.6, 2.4), col: hex(r.pick(['#fff2d8', '#cfe0ff', '#ffd9a8', '#f3e6c8'])), b: r(0.35, 1) };
  });
})();
const SPRAY = (() => {
  const r = rng('sea-spray');
  return Array.from({ length: 1400 }, () => {
    const x = r(-2000, 8600);
    return { x, h: Math.abs(r.gauss(0, 60)) + 4, s: r(1.2, 3.6), ph: r(0, TAU), v: r(8, 30), col: hex(r.pick(['#dff8f0', '#bff0e6', '#7fd8cf', '#f3e6c8'])) };
  });
})();
const MOTES = (() => {
  const r = rng('sea-motes');
  const mk = (n, d, size) => Array.from({ length: n }, () => ({
    x: r(-1800, 7000), y: r(-2600, 1900), s: r(size[0], size[1]), ph: r(0, TAU), f: r(0.2, 0.7), d,
    col: hex(r.pick(['#bff0e6', '#f3e6c8', '#7fd8cf', '#e9c98a', '#dff8f0'])), a: r(0.25, 0.8),
  }));
  return { far: mk(900, 1.25, [1.2, 3.2]), mid: mk(1100, 1, [1.4, 4.2]), near: mk(170, 0.72, [4, 11]) };
})();

// Stars in a far plane (screen-space sized).
export function drawStars(R, lt, alpha) {
  if (alpha <= 0) return;
  const k = 1 / R.scale();
  const out = [];
  for (const s of STARS) {
    const tw = 0.65 + 0.35 * Math.sin(lt * s.f * 2 + s.ph);
    out.push([s.x, s.y, s.s * 2.4 * k, 0, s.col[0], s.col[1], s.col[2], s.b * tw * alpha]);
  }
  R.particles(out, { kind: 'glow', blend: 'add' });
}
// Spray motes drifting above the band crest.
export function drawSpray(R, lt, alpha) {
  if (alpha <= 0) return;
  const out = [];
  for (const p of SPRAY) {
    const x = p.x + p.v * lt;
    const y = bandY(x) - BAND_W(x) * 0.5 - p.h - 6 * Math.sin(lt * 1.3 + p.ph);
    const tw = 0.55 + 0.45 * Math.sin(lt * 2.1 + p.ph * 3);
    out.push([x, y, p.s, 0, p.col[0], p.col[1], p.col[2], 0.75 * tw * alpha]);
  }
  R.particles(out, { kind: 'soft' });
}
// Plankton / motes in the water (below the band): list = 'far' | 'mid' | 'near'.
export function drawMotes(R, lt, which, alpha, { flow = [22, -9] } = {}) {
  if (alpha <= 0) return;
  const out = [];
  for (const p of MOTES[which]) {
    const x = p.x + flow[0] * lt * p.f + 14 * Math.sin(lt * p.f + p.ph);
    const y = p.y + flow[1] * lt * p.f + 10 * Math.sin(lt * p.f * 1.3 + p.ph * 2);
    if (y < bandY(x) + 30) continue;
    if (which !== 'near' && y > groundY(x) + 60) continue;
    const tw = 0.7 + 0.3 * Math.sin(lt * 1.7 + p.ph);
    out.push([x, y, p.s, 0, p.col[0], p.col[1], p.col[2], p.a * tw * alpha]);
  }
  R.particles(out, { kind: 'soft' });
}
// Bubbles: from the fish (trail) and from vents on the reef.
export function drawBubbles(R, lt, src, alpha) {
  if (alpha <= 0) return;
  const out = [];
  for (const b of src) {
    const x = b.x, y = b.y;
    out.push([x, y, b.s, 0, 0.85, 0.97, 0.95, 0.35 * alpha * b.a]);
    out.push([x - b.s * 0.3, y - b.s * 0.3, b.s * 0.3, 0, 1, 1, 1, 0.6 * alpha * b.a]);
  }
  R.particles(out, { kind: 'soft' });
}
// Light shafts slanting down from the surface (additive, gently breathing).
export function drawShafts(R, lt, alpha, xs) {
  if (alpha <= 0) return;
  for (let i = 0; i < xs.length; i++) {
    const x0 = xs[i];
    const y0 = bandY(x0) + 40;
    const len = 1100 + 250 * Math.sin(i * 1.7);
    const ang = 1.25 + 0.06 * Math.sin(i);
    const cx = x0 + Math.cos(ang) * len * 0.5, cy = y0 + Math.sin(ang) * len * 0.5;
    const br = (0.5 + 0.5 * Math.sin(lt * 0.8 + i * 2.1)) * (0.6 + 0.4 * noise1(lt * 0.6 + i * 3, 7));
    R.glow(cx, cy, 60 + 25 * Math.sin(i * 2.9), [0.55, 0.95, 0.9], 0.06 * alpha * (0.5 + br), { sx: 0.9 + 0.3 * Math.sin(i), sy: len / 110, rot: ang - Math.PI / 2, shape: [1.2, 0.25, 2.5], ext: 3 });
  }
}
