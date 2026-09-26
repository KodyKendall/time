// ANCESTORS — vegetation: charred stumps that resprout into palms (trunks painted per frame, fronds
// are painted sprites that unfold), sprouts, grass, ferns, bushes, smoke from the stumps, and the far
// ridge whose silhouette grows a jungle canopy and then heaves up into mountains.
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, circlePts, ellipsePts, ribbon } from '../lib/kit.js';
import { ease, invLerp, noise1, fbm1 } from '../../engine/math.js';
import { spreadArrival } from './land.js';
import { cam } from './timeline.js';
import { dab, along, brokenLine } from './brushkit.js';

// ---------------------------------------------------------------------------------------------
// Stumps → palms
// ---------------------------------------------------------------------------------------------
// x, y: base ; h: stump height ; H: grown height (crown point above base) ; w: base width
export const STUMPS = [
  // (grown crowns stay below world y ~1270 so no frond reaches into the final night-sky frame)
  { x: 92, y: 1730, h: 420, H: 455, w: 78, lean: -0.05, curve: 0.5, smoke: 0, seed: 1, stub: [0.52, -1, 0.9] },
  { x: 330, y: 1662, h: 340, H: 385, w: 58, lean: 0.06, curve: -0.6, smoke: 1, seed: 2, stub: [0.6, 1, -0.8] },
  { x: 528, y: 1648, h: 260, H: 370, w: 46, lean: -0.1, curve: 0.8, smoke: 0, seed: 3, stub: null },
  { x: 936, y: 1596, h: 150, H: 300, w: 30, lean: 0.07, curve: -0.4, smoke: 0, seed: 4, stub: null },
  { x: 1618, y: 1672, h: 330, H: 395, w: 56, lean: 0.08, curve: 0.5, smoke: 1, seed: 5, stub: [0.45, -1, -0.7] },
  { x: 1836, y: 1700, h: 400, H: 425, w: 72, lean: -0.06, curve: -0.5, smoke: 0, seed: 6, stub: [0.62, 1, 0.8] },
];
for (const s of STUMPS) {
  s.arrive = Math.min(spreadArrival(s.x, s.y + 8), 6.2);
  s.sprout = s.arrive + 0.15;           // leaves pop out of the broken top
  s.grow0 = s.arrive + 0.45;            // trunk starts extending
  s.grow1 = s.grow0 + 1.9 + 0.2 * (s.seed % 3);
  const r = rng('anc-stump-' + s.seed);
  // broken top: one tall splinter, a slanted break and small teeth (fractions of height)
  s.jag = [r(0.02, 0.06), r(0.1, 0.2), r(-0.01, 0.03), r(0.04, 0.09), r(0.0, 0.03), r(0.06, 0.14)];
  if (s.seed % 2) s.jag.reverse();
  s.bulge = [r(-0.06, 0.06), r(-0.06, 0.06), r(-0.05, 0.05)];
}

function stumpGrowth(s, lt) {
  return ease.inOutSine(invLerp(s.grow0, s.grow1, lt));
}
// Spine point at u (0 base .. 1 top) for current height hh.
function spine(s, hh, u) {
  const x = s.x + Math.sin(s.lean) * hh * u + s.curve * 0.06 * hh * Math.sin(Math.PI * u);
  return [x, s.y - hh * u];
}
// Trunk width at u for growth g (thick charred stump -> slender palm above the old break).
function trunkW(s, hh, u, g) {
  const y = u * hh;
  const old = Math.min(1, y / s.h);
  const wStump = s.w * (1 - 0.3 * old) * (1 + s.bulge[0] * Math.sin(old * 7) + s.bulge[1] * Math.sin(old * 13 + 1));
  const wNew = s.w * lerp(0.62, 0.34, clamp((y - s.h * 0.7) / Math.max(1, hh - s.h * 0.7)));
  const k = smoothstep(s.h * 0.55, s.h * 0.95, y) * smoothstep(0, 0.2, g);
  return lerp(wStump, wNew, k) * (1 + 0.5 * Math.pow(1 - u, 8));
}
export function crownPoint(s, lt) {
  const g = stumpGrowth(s, lt);
  const hh = lerp(s.h, s.H, g);
  return spine(s, hh, 1);
}

// Paint all trunks into the flora dyn layer (world coords under the current transform).
export function paintTrunks(c, lt, look) {
  const { brush } = c;
  const nt = (col, k = 1) => mixHex(col, look.nightTint, look.night * k);
  for (const s of STUMPS) {
    const g = stumpGrowth(s, lt);
    const hh = lerp(s.h, s.H, g);
    const heal = smoothstep(s.arrive + 0.1, s.arrive + 1.0, lt); // charred -> living colour
    const N = 24;
    const L = [], Rr = [], Mid = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const [x, y] = spine(s, hh, u);
      const w = trunkW(s, hh, u, g);
      L.push([x - w / 2, y]);
      Rr.push([x + w / 2, y]);
      Mid.push([x + w * 0.1, y]);
    }
    // broken top (stump) -> smooth crown junction as the palm grows
    const jagK = 1 - smoothstep(0, 0.22, g);
    const [tx, ty] = spine(s, hh, 1);
    const wTop = trunkW(s, hh, 1, g);
    const top = s.jag.map((j, k) => {
      const f = (k + 0.5) / s.jag.length;
      return [tx - wTop / 2 + wTop * f, ty - j * s.h * jagK * (k === 1 || k === 5 ? 1.4 : 1) + 3 * (1 - jagK)];
    });
    const poly = L.concat(top, Rr.slice().reverse());
    const base = mixHex('#2b2532', '#78ab90', heal);
    const lit = mixHex('#453b4c', '#a6d2b4', heal);
    const shade = mixHex('#1a1520', '#4f836e', heal);
    c.washPoly(poly, nt(base), 255);
    // lit left edge band and shaded right half (flat facets)
    const litR = L.map((p, i) => [lerp(p[0], Rr[i][0], 0.3), p[1]]);
    c.washPoly(L.concat(litR.reverse()), nt(lit), 150);
    c.washPoly(Mid.concat(Rr.slice().reverse()), nt(shade), 230);
    // side branch stub (charred; heals too)
    if (s.stub) {
      const [su, dir, bend] = s.stub;
      const [bx, by] = spine(s, hh, (su * s.h) / hh);
      const len = s.w * 1.6, a = -Math.PI / 2 + dir * 0.9;
      const pts = [[bx, by + s.w * 0.25], [bx + Math.cos(a + bend * 0.2) * len * 0.5, by + Math.sin(a) * len * 0.5], [bx + Math.cos(a) * len, by + Math.sin(a) * len - bend * 6]];
      c.washPoly(ribbon(pts, s.w * 0.42, s.w * 0.18), nt(mixHex(base, shade, 0.4)), 255);
    }
    // texture strokes (seeded per trunk so they don't boil): warm hatching on the lit side,
    // dark cracks; ring marks on the living trunk
    brush.seed('anc-trunk-' + s.seed + '-' + (look.key || 0));
    const hatchTop = Math.min(1, (s.h * 0.97) / hh);
    const tr = rng('anc-bark-' + s.seed);
    for (let k = 0; k < 18; k++) {
      const off = tr(-0.46, 0.4);
      const u0 = tr(0.0, 0.35), u1 = Math.min(hatchTop, u0 + tr(0.25, 0.7));
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const u = lerp(u0, u1, i / 6);
        const [x, y] = spine(s, hh, u);
        pts.push([x + (off + 0.03 * Math.sin(i * 1.7 + k)) * trunkW(s, hh, u, g), y]);
      }
      const kind = k % 6;
      const charred = kind === 0 ? '#9a5a3c' : kind === 1 ? '#6e4234' : kind === 2 ? '#15111a' : kind === 3 ? '#5a4a60' : kind === 4 ? '#2e2533' : '#7a4a3a';
      const living = kind === 0 ? '#a8d4b4' : kind === 1 ? '#5f9a80' : kind === 2 ? '#3c6c5a' : kind === 3 ? '#8cc0a0' : kind === 4 ? '#4a806a' : '#6fa88c';
      const brushName = kind === 2 || kind === 4 ? 'charcoal' : kind === 3 ? 'dry' : 'gouache';
      c.strokePath(pts, brushName, nt(mixHex(charred, living, heal)), (brushName === 'gouache' ? 0.55 : 0.7) * s.w / 50, 0.3);
    }
    // glowing ember cracks in the charred wood (fade as the land heals)
    if (heal < 0.99) {
      for (let k = 0; k < 3; k++) {
        const u0 = tr(0.3, 0.8), off = tr(-0.3, 0.2);
        const pts = [];
        for (let i = 0; i <= 3; i++) {
          const u = u0 + i * 0.035;
          const [x, y] = spine(s, hh, u);
          pts.push([x + (off + tr(-0.08, 0.08)) * trunkW(s, hh, u, g), y]);
        }
        c.strokePath(pts, 'ink', mixHex('#ff8a3a', '#2b2532', smoothstep(0, 0.6, heal)), 0.7, 0.3);
      }
    }
    if (g > 0.01) {
      for (let yy = s.h * 0.9; yy < hh - 12; yy += 22) {
        const u = yy / hh;
        const [x, y] = spine(s, hh, u);
        const w = trunkW(s, hh, u, g);
        c.strokePath([[x - w * 0.5, y], [x, y + 3.5], [x + w * 0.5, y]], 'wire', nt('#3a6a58'), 0.8, 0.5);
      }
    }
    c.strokePath(Rr, 'wire', nt(mixHex('#120e16', '#2f5a4a', heal)), 1.0, 0.3);
    // a vine climbs the living trunk, leaf by leaf
    if (s.seed === 2 || s.seed === 5 || s.seed === 6) {
      const v = smoothstep(s.grow0 + 0.2, s.grow1 + 0.7, lt);
      if (v > 0.01) {
        const pts = [];
        const N2 = 40;
        for (let i = 0; i <= N2; i++) {
          const u = (i / N2) * 0.82 * v;
          const [x, y] = spine(s, hh, u);
          pts.push([x + 0.55 * trunkW(s, hh, u, g) * Math.sin(u * 22 + s.seed), y]);
        }
        c.strokePath(pts, 'gouache', nt('#244f34'), 0.42, 0.5);
        for (let i = 3; i <= N2; i += 4) {
          const p = pts[i], side = i % 8 ? 1 : -1;
          c.washPoly(ellipsePts(p[0] + side * 7, p[1] - 3, 7, 4.2, side * 0.6, 10), nt(i % 12 ? '#3f8a4a' : '#6aa050'), 255);
        }
      }
    }
  }
}

// Embers glowing in the broken stump tops (light), fading as the land heals.
export function drawEmbers(R, lt) {
  for (const s of STUMPS) {
    const k = 1 - smoothstep(s.arrive - 0.6, s.arrive + 0.2, lt);
    if (k <= 0) continue;
    const [x, y] = spine(s, s.h, 1);
    const fl = 0.65 + 0.35 * noise1(R.t * 7 + s.seed * 3, s.seed);
    R.glow(x, y - 8, 7, [1, 0.45, 0.18], 0.9 * k * fl, { shape: [2.5, 0.35, 2.5], ext: 3 });
    R.glow(x, y - 4, 26, [1, 0.35, 0.12], 0.12 * k * fl, { shape: [1.2, 0.3, 1.5], ext: 2.5 });
  }
}

// Smoke wisps curling up from two stumps (atmosphere: thins away as the land heals).
export function paintSmoke(c, lt, t) {
  for (const s of STUMPS) {
    if (!s.smoke) continue;
    const k = 1 - smoothstep(s.arrive - 1.0, s.arrive + 0.4, lt);
    if (k <= 0.01) continue;
    const [x0, y0] = spine(s, s.h, 1);
    // the column lifts away from the stump as the ember dies
    const lift = 220 * ease.inQuad(smoothstep(s.arrive - 1.0, s.arrive + 0.4, lt));
    // the plume rises into view with the crane: its top is always below the frame at 85.0 s
    const topLimit = 1088 - 0.45 * (cam(lt).y - 540);
    const len = Math.max(0, Math.min(560, y0 - 10 - lift - topLimit));
    if (len < 4) continue;
    const path = (w, off) => {
      const pts = [];
      const n = 16;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const hgt = u * len * (0.85 + 0.025 * w) + lift;
        const sway = 48 * Math.sin(u * 4.4 - t * 1.1 + w * 0.9 + s.seed) * u + 130 * u * u + 30 * noise1(u * 3 - t * 0.45 + s.seed * 5, 3 + w) * u;
        const spread = off * (6 + 50 * u);
        pts.push([x0 + sway + spread, y0 - 10 - hgt, 0.4 + 0.9 * Math.sin(Math.PI * Math.pow(u, 0.6))]);
      }
      return pts;
    };
    // soft body of the plume (translucent wash) + swirling dry-brush strokes on top
    const body = ribbon(path(0, 0), 10, 70);
    c.washPoly(body, '#6d6888', Math.round(70 * k));
    const cols = ['#5a5576', '#8a85a6', '#a7a2c0', '#4a4666', '#bdb8d2'];
    for (let w = 0; w < 7; w++) {
      const off = -1 + (2 * w) / 6;
      c.strokePath(path(w, off * 0.6), w % 3 === 0 ? 'charcoal' : 'dry', cols[w % cols.length], (1.4 + 0.5 * (w % 3)) * (0.4 + 0.6 * k), 0.5);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Sprites: palm fronds, fern fronds, grass tufts, bushes, sprouts.
// ---------------------------------------------------------------------------------------------
const SPR = {
  frond: { n: 4, cell: 320, len: 290 },
  fern: { n: 3, cell: 240, len: 210 },
  grass: { n: 4, cell: 140 },
  bush: { n: 3, cell: 240 },
  sprout: { n: 2, cell: 60 },
};

function paintFrond(c, x0, y0, len, i) {
  // a broad drooping leaf (panel 14): pointing right from (x0, y0)
  const r = c.r;
  const droop = 0.18 + 0.1 * i;
  const mid = [];
  for (let k = 0; k <= 16; k++) {
    const u = k / 16;
    mid.push([x0 + len * u, y0 + len * droop * u * u - 6 * Math.sin(u * Math.PI)]);
  }
  const wMax = [30, 22, 36, 26][i % 4];
  const L = [], Rr = [];
  for (let k = 0; k <= 16; k++) {
    const u = k / 16, [x, y] = mid[k];
    const w = wMax * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.8) * (1 - 0.15 * u);
    L.push([x, y - w * 0.5]);
    Rr.push([x, y + w * 0.5]);
  }
  const leaf = L.concat(Rr.slice().reverse());
  const cols = [['#1f6a58', '#2f8a6c'], ['#2c7a5c', '#4a9c70'], ['#18594f', '#2a7462'], ['#3a8a60', '#5aa872']][i % 4];
  c.washPoly(leaf, cols[0], 255);
  c.fillPoly(leaf, cols[1], { opacity: 70, bleed: 0.02, texture: 0.7, border: 0.45 });
  // lower half darker (fold)
  c.washPoly(mid.concat(Rr.slice().reverse()), mixHex(cols[0], '#0c2a2a', 0.35), 200);
  c.flush();
  // leaflet cuts (palm-like slits)
  for (let k = 2; k < 15; k += 1) {
    const [x, y] = mid[k];
    const w = wMax * 0.5 * Math.sin(Math.PI * k / 16);
    c.strokePath([[x, y], [x + 10, y - w * 0.9]], 'wire', '#0e3a34', 0.7, 0.3);
    c.strokePath([[x, y], [x + 10, y + w * 0.9]], 'wire', '#0e3a34', 0.7, 0.3);
  }
  c.strokePath(mid, 'ink', mixHex(cols[1], '#e8f0c0', 0.4), 0.9, 0.5);
}
function paintFern(c, x0, y0, len, i) {
  const r = c.r;
  const mid = [];
  for (let k = 0; k <= 20; k++) {
    const u = k / 20;
    mid.push([x0 + len * u, y0 - len * (0.18 + 0.05 * i) * Math.sin(u * Math.PI * 0.9) + len * 0.1 * u * u]);
  }
  const col = ['#2f7d52', '#3f8f58', '#246a4c'][i % 3];
  for (let k = 1; k < 20; k++) {
    const u = k / 20, [x, y] = mid[k];
    const l = 34 * Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1 - 0.3 * u);
    for (const sgn of [-1, 1]) {
      const leaf = ellipsePts(x + 4 + l * 0.4, y + sgn * l * 0.45, l * 0.5, 4.2, sgn * 0.9 + 0.3, 12);
      c.washPoly(leaf, r() < 0.5 ? col : mixHex(col, '#9cc47a', 0.35), 255);
    }
  }
  c.strokePath(mid, 'ink', '#1c4a36', 0.9, 0.5);
}
function paintTuft(c, cx, by, i) {
  const r = c.r;
  const cols = ['#5a9a5a', '#3f7d4f', '#8ab464', '#2f6a48'];
  const n = 9 + i;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + r(-0.7, 0.7), l = r(40, 92);
    const bx = cx + r(-18, 18);
    const tip = [bx + Math.cos(a) * l + r(-10, 10), by + Math.sin(a) * l];
    const midp = [bx + Math.cos(a) * l * 0.5, by + Math.sin(a) * l * 0.55];
    const blade = ribbon([[bx, by], midp, tip], 7, 0.5);
    c.washPoly(blade, r.pick(cols), 255);
  }
}
function paintBush(c, cx, cy, i) {
  const r = c.r;
  const cols = [['#1f5a4a', '#2f7a5a', '#4a9a68'], ['#245f48', '#3a8058', '#62a86a'], ['#1a4f46', '#2a6a5a', '#3f8a6a']][i % 3];
  c.washPoly(c.blob(cx, cy + 10, 96, 62, { wobble: 0.14 }), cols[0], 255);
  for (let k = 0; k < 9; k++) {
    const a = r(-Math.PI, 0), d = r(20, 70);
    c.fillPoly(c.blob(cx + Math.cos(a) * d, cy + 14 + Math.sin(a) * d * 0.65, r(26, 44), r(20, 32), { wobble: 0.2 }), r.pick(cols.slice(1)), { opacity: 120, bleed: 0.02, texture: 0.6, border: 0.4 });
  }
  c.flush();
  for (let k = 0; k < 16; k++) {
    const x = cx + r(-80, 80), y = cy + r(-40, 50);
    c.strokePath([[x, y], [x + r(-8, 8), y - r(8, 20)]], 'wire', cols[2], 0.8, 0.3);
  }
  // fruit: clusters of red / orange berries on two of the three bushes
  if (i !== 1) {
    const fc = i === 0 ? ['#d8452f', '#a63a2a', '#f06a4a'] : ['#f59b3d', '#e8622c', '#ffc060'];
    for (let k = 0; k < 7; k++) {
      const bx = cx + r(-70, 70), by = cy + r(-30, 40);
      for (let j = 0; j < 4; j++) {
        const x = bx + r(-9, 9), y = by + r(-7, 7);
        c.washPoly(ellipsePts(x, y, 5.5, 5.5, 0, 12), r.pick(fc), 255);
        c.washPoly(ellipsePts(x - 1.6, y - 1.8, 1.6, 1.6, 0, 8), '#fff0d0', 220);
      }
    }
  }
}
function paintSprout(c, cx, by, i) {
  c.strokePath([[cx, by], [cx + 1, by - 10], [cx - 1, by - 20]], 'ink', '#3f8a4a', 1.4, 0.5);
  c.washPoly(ellipsePts(cx - 8, by - 22, 9, 4.5, -0.5, 16), '#7cc05a', 255);
  c.washPoly(ellipsePts(cx + 8, by - 24, 10, 5, 0.45, 16), '#5aa84a', 255);
}

export function paintFloraSprites(P) {
  const mk = (name, spec, fn, scale = 1.3) => {
    const cols = spec.n;
    const L = P.layer('spr_' + name, { w: cols * spec.cell, h: spec.cell, scale }, (c) => {
      for (let i = 0; i < spec.n; i++) fn(c, i * spec.cell, 0, i);
    });
    return { L, ...spec };
  };
  return {
    frond: mk('frond', SPR.frond, (c, ox, oy, i) => paintFrond(c, ox + 14, oy + 160, SPR.frond.len, i), 1.4),
    fern: mk('fern', SPR.fern, (c, ox, oy, i) => paintFern(c, ox + 10, oy + 150, SPR.fern.len, i)),
    grass: mk('grass', SPR.grass, (c, ox, oy, i) => paintTuft(c, ox + 70, oy + 130, i)),
    bush: mk('bush', SPR.bush, (c, ox, oy, i) => paintBush(c, ox + 120, oy + 150, i)),
    sprout: mk('sprout', SPR.sprout, (c, ox, oy, i) => paintSprout(c, ox + 30, oy + 52, i), 2),
  };
}
// Draw sprite i of an atlas with its pivot (px, py in cell coords) at (x, y).
export function spr(R, S, i, x, y, s, rot, px, py, sy = s, o = {}) {
  const w = S.n * S.cell;
  const m = M.place(x, y, s, rot, px, py, sy);
  R.layer(S.L, m, { ...o, uv: [(i * S.cell) / w, 0, ((i + 1) * S.cell) / w, 1], w: S.cell, h: S.cell });
}

// ---------------------------------------------------------------------------------------------
// Placement of growing things
// ---------------------------------------------------------------------------------------------
const rr = rng('anc-flora');
export const SPROUTS = [
  { x: 870, y: 1808, t: 3.0 }, { x: 1340, y: 1802, t: 3.35 }, { x: 430, y: 1832, t: 3.5 }, { x: 1620, y: 1858, t: 3.6 },
  { x: 800, y: 1830, t: 3.2 }, { x: 1010, y: 1834, t: 3.45 },
];
export const TUFTS = [];
for (let i = 0; i < 70; i++) {
  const x = rr(-160, 2200), y = rr(1600, 2120);
  if (Math.abs(x - 1215) < 170 && Math.abs(y - 1770) < 50) continue; // not on the rock
  if (Math.hypot(x - 1452, (y - 1804) * 2.5) < 150) continue; // keep the fire place clear
  if (Math.hypot(x - 590, (y - 1800) * 2.5) < 110) continue; // burrow
  TUFTS.push({ x, y, v: rr.int(0, 3), s: rr(0.5, 1.1) * (0.6 + (y - 1600) / 700), a: rr(-0.1, 0.1), ph: rr(0, TAU) });
}
TUFTS.sort((a, b) => a.y - b.y);
for (const g of TUFTS) g.t = spreadArrival(g.x, g.y) + rr(0.05, 0.35);
export const BUSHES = [
  { x: 250, y: 1670, s: 0.9, v: 0 }, { x: 700, y: 1640, s: 0.7, v: 1 }, { x: 1040, y: 1618, s: 0.55, v: 2 }, { x: 1480, y: 1660, s: 0.75, v: 1 },
  { x: 1960, y: 1672, s: 0.95, v: 0 }, { x: 40, y: 1760, s: 1.1, v: 2 }, { x: 1720, y: 1706, s: 0.6, v: 2 }, { x: 420, y: 1690, s: 0.6, v: 1 },
];
for (const b of BUSHES) b.t = spreadArrival(b.x, b.y + 20) + 0.25;
// Fern clumps in the near foreground (near plane).
export const FERNS = [
  { x: 150, y: 2080, s: 1.25, n: 7, t: 4.6 }, { x: 1830, y: 2060, s: 1.1, n: 6, t: 4.8 }, { x: 560, y: 2140, s: 0.95, n: 5, t: 5.0 }, { x: 2010, y: 1960, s: 0.9, n: 5, t: 4.9 },
];

// Draw grown/growing ground vegetation (ground plane). look: colour grade.
export function drawGroundFlora(R, lt, S, look, filter) {
  const o = { grade: look.grade, tint: look.tint };
  for (const b of BUSHES) {
    if (filter && !filter(b)) continue;
    const g = ease.outBack(clamp((lt - b.t) / 0.9), 1.4);
    if (g <= 0.01) continue;
    const sway = 0.015 * Math.sin(R.t * 1.3 + b.x);
    spr(R, S.bush, b.v, b.x, b.y + 22, b.s * g, sway, 120, 170, b.s * g, o);
  }
  for (const s of SPROUTS) {
    const g = ease.outBack(clamp((lt - s.t) / 0.45), 2);
    if (g <= 0.01) continue;
    // once the paint spreads, sprouts become the heart of a tuft
    spr(R, S.sprout, 0, s.x, s.y, 1.1 * g, 0.05 * Math.sin(R.t * 2 + s.x), 30, 52, 1.1 * g, o);
  }
  for (const g of TUFTS) {
    if (filter && !filter(g)) continue;
    const k = ease.outBack(clamp((lt - g.t) / 0.6), 1.6);
    if (k <= 0.01) continue;
    const sway = 0.04 * Math.sin(R.t * 1.7 + g.ph);
    spr(R, S.grass, g.v, g.x, g.y, g.s, g.a + sway, 70, 130, g.s * k, o);
  }
}

// Palm crowns: fronds unfold one by one from a folded bud.
export function drawCrowns(R, lt, S, look) {
  const o = { grade: look.grade, tint: look.tint };
  for (const s of STUMPS) {
    if (lt < s.sprout) continue;
    const [cx, cy] = crownPoint(s, lt);
    const r = rng('anc-crown-' + s.seed);
    const n = 8;
    for (let k = 0; k < n; k++) {
      const fin = -Math.PI / 2 + (k - (n - 1) / 2) * 0.42 + r(-0.12, 0.12);
      const droop = Math.abs(Math.cos(fin)) * 0.9 + 0.1;
      const final = fin + (Math.cos(fin) > 0 ? 1 : -1) * droop * 0.55;
      const t0 = s.sprout + 0.12 * k + r(0, 0.15);
      const u = clamp((lt - t0) / 1.6);
      if (u <= 0) continue;
      const grow = lerp(0.18, 1, ease.outCubic(invLerp(0, 1, (lt - t0) / (s.grow1 - t0 + 0.4))));
      const unfold = ease.outBack(u, 1.1);
      const ang = lerp(-Math.PI / 2 + (final > -Math.PI / 2 ? 0.1 : -0.1), final, unfold);
      const sway = 0.05 * Math.sin(R.t * 1.4 + k * 1.3 + s.seed) + 0.03 * noise1(R.t * 0.8 + k, s.seed);
      const sc = (s.H / 560) * 0.95 * grow * lerp(0.3, 1, unfold);
      const left = Math.cos(ang) < 0;
      spr(R, S.frond, (k + s.seed) % 4, cx, cy, sc, ang + sway, 14, 160, left ? -sc : sc, o);
    }
  }
}

// Fern clumps unfolding (near plane).
export function drawFerns(R, lt, S, look) {
  const o = { grade: look.grade, tint: look.tint };
  for (const f of FERNS) {
    const r = rng('anc-fern-' + f.x);
    for (let k = 0; k < f.n; k++) {
      const t0 = f.t + 0.1 * k + r(0, 0.2);
      const u = clamp((lt - t0) / 1.3);
      if (u <= 0) continue;
      const fin = -Math.PI / 2 + (k - (f.n - 1) / 2) * 0.36 + r(-0.1, 0.1);
      // fiddlehead: starts curled towards the stem, unrolls outward
      const ang = lerp(-Math.PI / 2 - 0.4 * Math.sign(Math.cos(fin) || 1), fin, ease.outCubic(u));
      const sc = f.s * lerp(0.15, 1, ease.outBack(u, 1.2));
      const sway = 0.04 * Math.sin(R.t * 1.6 + k + f.x);
      const left = Math.cos(fin) < 0;
      spr(R, S.fern, k % 3, f.x, f.y, sc, ang + sway, 10, 150, left ? -sc : sc, o);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Far ridge: burnt hills -> jungle canopy (crowns grow on it) -> mountains (dusk). Far plane.
// ---------------------------------------------------------------------------------------------
const FR = rng('anc-far');
const hillsY = (x) => 1452 - 38 * Math.sin(x * 0.0019 + 0.4) - 20 * Math.sin(x * 0.0047 + 1.9) - 8 * Math.sin(x * 0.013 + 0.5) - 120 * Math.exp(-(((x - 240) / 320) ** 2));
const CROWNS = [];
for (let x = -420; x < 2440; x += FR(34, 60)) {
  CROWNS.push({ x, r: FR(26, 48), t: 4.35 + 0.9 * Math.abs(x - 900) / 1400 + FR(0, 0.35), h: FR(0.2, 0.45) });
}
// Mountain range profile: alternating peaks / valleys (and shoulders), straight rugged slopes.
// (All tops stay below world y 1080 + margin so nothing shows in the final night-sky frame.)
const PEAKS = [
  [-460, 1300], [-300, 1236], [-90, 1338], [180, 1150], [350, 1282], [455, 1256], [610, 1328], [800, 1214], [980, 1132],
  [1190, 1300], [1420, 1104], [1560, 1210], [1650, 1250], [1850, 1178], [2060, 1306], [2250, 1166], [2480, 1296],
];
function mountainY(x) {
  let i = 0;
  while (i < PEAKS.length - 2 && x > PEAKS[i + 1][0]) i++;
  const [x0, y0] = PEAKS[i], [x1, y1] = PEAKS[i + 1];
  const u = clamp((x - x0) / (x1 - x0));
  // straight slope, slightly convex near the summit, with rugged noise
  const top = Math.min(y0, y1), conv = -10 * Math.sin(Math.PI * u) * (y0 === top ? 1 - u : u);
  return lerp(y0, y1, u) + conv + 6 * noise1(x * 0.045, 11) + 3 * noise1(x * 0.17, 12);
}
function canopyY(x, lt) {
  let y = hillsY(x);
  for (const c of CROWNS) {
    const d = Math.abs(x - c.x);
    if (d >= c.r) continue;
    const g = ease.outBack(clamp((lt - c.t) / 0.9), 1.3);
    if (g <= 0) continue;
    const top = hillsY(c.x) + c.r * c.h - g * c.r * (1 + c.h) * Math.sqrt(1 - (d / c.r) ** 2);
    if (top < y) y = top;
  }
  return y;
}
export function farRidgeY(x, lt) {
  const m = ease.inOutSine(invLerp(7.6, 9.8, lt));
  const cy = canopyY(x, lt);
  return m > 0 ? lerp(cy, mountainY(x), m) : cy;
}
const FAR_KEYS = [
  { t: 0, c: '#3f3a58' }, { t: 4.3, c: '#3f3a58' }, { t: 5.6, c: '#2a605d' }, { t: 7.6, c: '#2a605d' },
  { t: 8.6, c: '#46416a' }, { t: 9.6, c: '#283a5a' }, { t: 11, c: '#22405a' },
];
export function farColor(lt) {
  for (let i = 0; i < FAR_KEYS.length - 1; i++) {
    const a = FAR_KEYS[i], b = FAR_KEYS[i + 1];
    if (lt <= b.t) return mixHex(a.c, b.c, smoothstep(a.t, b.t, lt));
  }
  return FAR_KEYS[FAR_KEYS.length - 1].c;
}
export function paintFarRidge(c, lt) {
  const col = farColor(lt);
  const top = [];
  for (let x = -460; x <= 2480; x += 8) top.push([x, farRidgeY(x, lt)]);
  const poly = top.concat([[2480, 1800], [-460, 1800]]);
  c.washPoly(poly, col, 255);
  // lit faces of the mountains (appear as the forms emerge)
  const m = ease.inOutSine(invLerp(8.0, 9.8, lt));
  if (m > 0.01) {
    for (let i = 1; i < PEAKS.length - 1; i++) {
      const [px] = PEAKS[i];
      if (PEAKS[i][1] > PEAKS[i - 1][1] || PEAKS[i][1] > PEAKS[i + 1][1]) continue; // peaks only
      const xl = lerp(px, PEAKS[i - 1][0], 0.85);
      const face = [];
      for (let x = xl; x <= px; x += 8) face.push([x, farRidgeY(x, lt)]);
      face.push([px + 10, 1520], [xl + 40, 1560]);
      c.washPoly(face, mixHex(col, '#9ab8d0', 0.22), Math.round(255 * m));
    }
  }
  // ridge light line
  const line = [];
  for (let x = -460; x <= 2480; x += 24) line.push([x, farRidgeY(x, lt) + 5]);
  c.strokePath(line, 'wire', mixHex(col, '#e8e0c0', 0.25), 1.0, 0.4);
}

// Static brush texture for the far ridge (grey values; tinted per phase and seen through the
// ridge's per-frame silhouette).
export const FAR_TEX = { x: -520, y: 1100, w: 3060, h: 720 };
export function paintFarTex(P) {
  return P.layer('farTex', { w: FAR_TEX.w, h: FAR_TEX.h, scale: 0.9 }, (c) => {
    const r = c.r;
    const W = FAR_TEX.w, H = FAR_TEX.h;
    c.washPoly([[0, 0], [W, 0], [W, H], [0, H]], '#808080', 255);
    for (let i = 0; i < 40; i++) c.fillPoly(c.blob(r(0, W), r(0, H), r(120, 320), r(40, 110), { rot: r(-0.4, 0.4), wobble: 0.3 }), r.pick(['#6c6c6c', '#949494', '#767676', '#8a8a8a']), { opacity: 55, bleed: 0.1, texture: 0.9, border: 0.3 });
    c.flush();
    // slope strokes (both diagonals, like light on facets) and horizontal strata
    for (let i = 0; i < 900; i++) {
      const x = r(-40, W), y = r(0, H);
      const kind = r();
      const ang = kind < 0.4 ? r(-0.75, -0.45) : kind < 0.8 ? r(0.45, 0.75) : r(-0.08, 0.08);
      const tone = r.pick(['#5c5c5c', '#6a6a6a', '#9c9c9c', '#a8a8a8', '#747474', '#8e8e8e']);
      const brush = r() < 0.55 ? 'gouache' : r() < 0.7 ? 'dry' : 'charcoal';
      dab(c, x, y, ang, r(30, 110), brush, tone, brush === 'gouache' ? r(0.8, 1.8) : r(0.5, 1.1), r(-0.1, 0.1));
    }
    c.hatchPoly([[0, H * 0.35], [W, H * 0.3], [W, H], [0, H]], { dist: 10, angle: 0.6, brushName: 'wire', color: '#5a5a5a', weight: 0.7, rand: 0.25 });
  });
}
