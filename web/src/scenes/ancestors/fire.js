// ANCESTORS — fire: flint sparks, a campfire of layered flame tongues painted with flicking tapered
// strokes (on twos), firelight, embers, smoke, and rising sparks — some of which become the stars of
// PIVOT.night.
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, ellipsePts, ribbon } from '../lib/kit.js';
import { ease, invLerp, noise1, fbm1 } from '../../engine/math.js';
import { FIRE } from './land.js';
import { dab, along } from './brushkit.js';

export const IGNITE = 10.0;
// fire size 0..1(+flare) at local time
export function fireSize(lt) {
  if (lt < IGNITE) return 0;
  const u = (lt - IGNITE) / 0.7;
  return u < 1 ? ease.outBack(u, 2.6) * lerp(0.15, 1, u) : 1 + 0.04 * Math.sin(lt * 2.3);
}
export function flicker(t) {
  return clamp(0.5 + 0.28 * noise1(t * 9, 3) + 0.16 * noise1(t * 21, 5) + 0.06 * Math.sin(t * 37));
}

// ---------------------------------------------------------------------------------------------
// Fire pit (ring of stones + sticks); it is laid out (grows in) as the camp appears at dusk.
// ---------------------------------------------------------------------------------------------
export function paintFirePit(P) {
  const L = P.layer('firepit', { w: 360, h: 160, scale: 1.6 }, (c) => {
    const cx = 180, cy = 96, r = c.r;
    // ash bed
    c.washPoly(ellipsePts(cx, cy + 4, 104, 26, 0, 30), '#2a2430', 230);
    c.fillPoly(ellipsePts(cx, cy + 2, 86, 20, 0, 30), '#4a4250', { opacity: 90, bleed: 0.03, texture: 0.8, border: 0.4 });
    // crossed sticks
    const sticks = [[-70, 10, 62, -22], [-60, -18, 70, 14], [-20, 16, 40, -30], [-50, -2, 20, -36]];
    for (const [x0, y0, x1, y1] of sticks) {
      const pts = [[cx + x0, cy + y0 * 0.5], [cx + (x0 + x1) / 2, cy + (y0 + y1) / 4 - 3], [cx + x1, cy + y1 * 0.5]];
      c.washPoly(ribbon(pts, 13, 9), '#6a3a2a', 255);
      c.strokePath(pts.map((p) => [p[0], p[1] - 3]), 'gouache', '#a4562c', 0.5, 0.4);
      c.strokePath(pts.map((p) => [p[0], p[1] + 3]), 'ink', '#2a141c', 0.6, 0.4);
      c.washPoly(ellipsePts(pts[2][0], pts[2][1], 5, 6.5, 0.3, 10), '#2a1a20', 255);
    }
    // ring of stones
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * 0.05 + (i / 10) * Math.PI * 0.9;
      const x = cx + Math.cos(a) * 108, y = cy + 6 + Math.sin(a) * 30;
      const s = r(13, 19);
      c.washPoly(ellipsePts(x + 2, y + s * 0.4, s * 1.2, s * 0.45, 0, 16), '#1c1822', 150);
      c.washPoly(ellipsePts(x, y, s * 1.15, s * 0.75, r(-0.3, 0.3), 18), '#5e5870', 255);
      for (let k = 0; k < 6; k++) dab(c, x + r(-s * 0.8, s * 0.5), y + r(-s * 0.5, s * 0.3), r(-0.4, 0.4), r(s * 0.5, s * 1.2), k % 2 ? 'gouache' : 'dry', r.pick(['#77708a', '#4a4458', '#8a8298', '#3e384a']), 0.45);
      c.washPoly(ellipsePts(x - s * 0.3, y - s * 0.32, s * 0.55, s * 0.22, 0, 12), '#9a93ac', 200);
      c.strokePath(ellipsePts(x, y, s * 1.15, s * 0.75, 0, 16).slice(4, 13), 'ink', '#1e1a26', 0.7, 0.4);
    }
    for (let i = 0; i < 18; i++) dab(c, cx + r(-80, 80), cy + r(-4, 18), r(-0.1, 0.1), r(10, 26), 'dry', r.pick(['#8a8298', '#3a3240', '#b0a8ba']), 0.4);
  });
  return { L, x: FIRE.x - 180, y: FIRE.y - 96 };
}

// ---------------------------------------------------------------------------------------------
// Flames (paint ctx, world coordinates). Tongues sway with noise, flick upward, lick and split.
// ---------------------------------------------------------------------------------------------
const TONGUES = (() => {
  const r = rng('anc-flames');
  const L = [];
  const layers = [
    { n: 8, col: '#d9442a', edge: '#ff7a3a', h: [110, 250], w: [38, 66], spread: 82 },
    { n: 7, col: '#f2822e', edge: '#ffb050', h: [90, 190], w: [30, 52], spread: 62 },
    { n: 5, col: '#ffc440', edge: '#ffe28a', h: [60, 135], w: [22, 40], spread: 42 },
    { n: 3, col: '#fff2c4', edge: '#ffffff', h: [34, 76], w: [16, 28], spread: 22 },
  ];
  layers.forEach((ly, li) => {
    for (let i = 0; i < ly.n; i++) {
      L.push({ li, col: ly.col, edge: ly.edge, x: lerp(-ly.spread, ly.spread, (i + 0.5) / ly.n) + r(-10, 10), h: r(ly.h[0], ly.h[1]) * (1 - 0.4 * Math.abs((i + 0.5) / ly.n - 0.5) * 2), w: r(ly.w[0], ly.w[1]), ph: r(0, TAU), f: r(1.5, 3.4), curl: r(-1, 1) });
    }
  });
  return L;
})();
function tonguePts(tg, t, size) {
  const sway = 14 * noise1(t * tg.f + tg.ph, tg.li + 1) + 7 * Math.sin(t * 7.3 + tg.ph) + 18 * tg.curl;
  const lick = 0.78 + 0.34 * (0.5 + 0.5 * noise1(t * tg.f * 1.7 + tg.ph * 3, tg.li + 7));
  const h = tg.h * lick * size, w = tg.w * Math.sqrt(size);
  const bx = FIRE.x + tg.x * size, by = FIRE.y - 6;
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {           // left edge, bottom -> tip
    const u = i / n;
    const wx = w * 0.5 * Math.pow(Math.sin(Math.PI * (0.5 + 0.5 * (1 - u))), 0.8) * (1 - u * 0.95);
    const cx = bx + sway * u * u + 5 * Math.sin(u * 5 - t * 11 + tg.ph) * u;
    pts.push([cx - wx, by - h * u]);
  }
  for (let i = n; i >= 0; i--) {           // right edge, tip -> bottom
    const u = i / n;
    const wx = w * 0.5 * Math.pow(Math.sin(Math.PI * (0.5 + 0.5 * (1 - u))), 0.8) * (1 - u * 0.95);
    const cx = bx + sway * u * u + 5 * Math.sin(u * 5 - t * 11 + tg.ph + 0.6) * u;
    pts.push([cx + wx, by - h * u]);
  }
  const spine = [];
  for (let i = 0; i <= 5; i++) { const u = 0.1 + (i / 5) * 0.85; spine.push([bx + sway * u * u + 5 * Math.sin(u * 5 - t * 11 + tg.ph) * u, by - h * u]); }
  return { pts, spine, h, w };
}
export function paintFlames(c, lt, t) {
  const size = fireSize(lt);
  if (size <= 0.01) return;
  c.brush.seed('anc-fire-' + Math.round(t * 15));
  // glowing ember bed under the flames
  const er = rng('anc-embers-' + Math.round(t * 15));
  c.washPoly(ellipsePts(FIRE.x, FIRE.y - 2, 70 * Math.sqrt(size), 14, 0, 24), '#5a1a1a', 255);
  for (let i = 0; i < 16; i++) dab(c, FIRE.x + er(-62, 62) * Math.sqrt(size), FIRE.y + er(-10, 6), er(-0.3, 0.3), er(6, 16), 'gouache', er.pick(['#ff7a2a', '#e8442a', '#ffb040', '#a62a1a']), 0.4);
  // body washes per layer (same colour merges into one pass), then flicking tapered strokes
  for (let li = 0; li < 4; li++) {
    for (const tg of TONGUES) if (tg.li === li) c.washPoly(tonguePts(tg, t, size).pts, tg.col, 255);
    for (const tg of TONGUES) {
      if (tg.li !== li) continue;
      const { spine, w, pts } = tonguePts(tg, t, size);
      along(c, spine, 'gouache', tg.edge, (0.28 + 0.12 * li) * Math.sqrt(size) * w / 30);
      // a darker licking edge on the outer tongues
      if (li === 0) along(c, pts.slice(1, 9), 'gouache', '#a8281e', 0.22 * Math.sqrt(size) * w / 30);
    }
  }
  // stray licks detaching at the top
  const r = rng('anc-licks-' + Math.round(t * 15));
  for (let i = 0; i < 4; i++) {
    const x = FIRE.x + r(-40, 40) * size, y = FIRE.y - r(120, 210) * size;
    dab(c, x, y, -Math.PI / 2 + r(-0.4, 0.4), r(14, 30) * size, 'gouache', r.pick(['#ff9a3a', '#ffcf5a', '#e8562c']), 0.35 * size, 0.6);
  }
}

// Light from the fire (additive): hot core, broad warm halo, light pooled on the ground.
export function drawFireLight(R, lt, t) {
  const size = fireSize(lt);
  const fl = flicker(t);
  if (size > 0.01) {
    R.glow(FIRE.x, FIRE.y - 50 * size, 22 * size, [1, 0.8, 0.5], 0.55 * size * (0.8 + 0.4 * fl), { shape: [2.2, 0.35, 2.2], ext: 3 });
    R.glow(FIRE.x, FIRE.y - 60 * size, 170 * size, [1, 0.5, 0.2], 0.15 * size * (0.75 + 0.5 * fl), { shape: [1.2, 0.45, 1.6], ext: 3.2 });
    R.glow(FIRE.x, FIRE.y + 6, 200, [1, 0.48, 0.18], 0.12 * size * (0.8 + 0.4 * fl), { shape: [1.2, 0.4, 1.8], ext: 2.8, sx: 2.4, sy: 0.55 });
  }
}

// Flint strikes: bursts of sparks from the hands at the strike times, and the kindling catching.
const STRIKES = [9.75, 10.0];
export function strikeSparks(lt, hand) {
  const out = [];
  STRIKES.forEach((t0, si) => {
    const tt = lt - t0;
    if (tt < 0 || tt > 0.6 || !hand) return;
    const r = rng('anc-strike-' + si);
    for (let i = 0; i < 38; i++) {
      const a = r(-Math.PI * 0.95, -Math.PI * 0.05) + (si === 1 ? 0.2 : 0), v = r(120, 520);
      const life = r(0.2, 0.55);
      if (tt > life) continue;
      const k = 1 - tt / life;
      const x = hand[0] + Math.cos(a) * v * tt, y = hand[1] + Math.sin(a) * v * tt + 520 * tt * tt;
      out.push([x, y, r(1.4, 3.2) * (0.5 + k), 0, 1, lerp(0.55, 0.95, k), lerp(0.2, 0.7, k), 1.4 * k]);
    }
  });
  return out;
}
export function strikeFlash(lt) {
  return STRIKES.reduce((a, t0) => a + Math.exp(-Math.pow((lt - t0) / 0.04, 2)), 0);
}

// Rising sparks (particles): spawned continuously from the fire; cool from white-gold to red.
const SPARKS = (() => {
  const r = rng('anc-sparks');
  return Array.from({ length: 260 }, () => ({ t0: IGNITE + r(0, 2.6), life: r(0.8, 2.2), vx: r(-40, 40), vy: r(160, 330), x: r(-40, 40), f: r(1, 3), a: r(10, 50), ph: r(0, TAU), s: r(1.2, 3.2) }));
})();
export function fireSparks(lt, drop = 0) {
  const out = [];
  const size = fireSize(lt);
  const fade = 1 - smoothstep(11.3, 11.9, lt); // ordinary sparks give way to the star-sparks
  for (const s of SPARKS) {
    const tt = lt - s.t0;
    if (tt < 0 || tt > s.life) continue;
    const k = 1 - tt / s.life;
    const x = FIRE.x + s.x * size + s.vx * tt + s.a * Math.sin(tt * s.f * 3 + s.ph) * tt;
    const y = FIRE.y - 60 * size - s.vy * tt - 30 * tt * tt;
    const col = k > 0.6 ? [1, 0.9, 0.6] : k > 0.3 ? [1, 0.62, 0.25] : [0.95, 0.35, 0.15];
    if (fade <= 0) break;
    out.push([x, y, s.s * (0.6 + 0.6 * k), 0, col[0], col[1], col[2], 1.3 * k * Math.min(1, tt * 8) * fade]);
  }
  return out;
}

// Smoke above the fire (atmosphere): soft translucent curls drifting up and to the right.
export function paintFireSmoke(c, lt, t) {
  const size = fireSize(lt);
  if (size < 0.3) return;
  const k = smoothstep(10.3, 11.2, lt);
  const x0 = FIRE.x + 10, y0 = FIRE.y - 190 * size;
  const path = (w) => {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const u = i / 15;
      pts.push([x0 + 40 * Math.sin(u * 4.2 - t * 1.2 + w * 1.3) * u + 160 * u * u + w * 14, y0 - u * (400 + 40 * w), 0.25 + Math.sin(Math.PI * Math.pow(u, 0.6))]);
    }
    return pts;
  };
  c.washPoly(ribbon(path(0), 16, 120), '#3a4058', Math.round(40 * k));
  c.washPoly(ribbon(path(0.6), 10, 80), '#4a5068', Math.round(38 * k));
  c.washPoly(ribbon(path(1.3), 6, 50), '#5a6078', Math.round(30 * k));
}
