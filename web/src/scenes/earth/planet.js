// EARTH — the young planet: painted surface band (crust plates + magma), glowing crack network,
// hand-painted night side (dynamic, boils at 12 fps), lost-and-found contour, volcano glows.
import { circlePts } from '../lib/kit.js';
import { C, M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, fbm2, noise1, win, smoother, strokeBatch, hash } from './common.js';

// texture band: planet diameter = 1000 units; band 2400 x 1000
export const TEX = { w: 1800, h: 1000, R: 500 };
const DISC = { w: 1100, h: 1100, R: 500 };

// Voronoi cells by half-plane clipping
function clipHalf(poly, px, py, nx, ny, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
function voronoi(seeds, x0, y0, x1, y1) {
  return seeds.map((s, i) => {
    let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const nb = [];
    seeds.forEach((o, j) => {
      if (i === j) return;
      const dx = o[0] - s[0], dy = o[1] - s[1];
      if (dx * dx + dy * dy > 520 * 520) return;
      const L = Math.hypot(dx, dy), nx = dx / L, ny = dy / L;
      const mx = (s[0] + o[0]) / 2, my = (s[1] + o[1]) / 2;
      const before = poly.length;
      poly = clipHalf(poly, 0, 0, nx, ny, mx * nx + my * ny);
      nb.push(j);
    });
    return { seed: s, poly, i };
  });
}
// wobbly subdivided polyline
function wobble(pts, amp, freq, seed) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(2, Math.ceil(L / 14));
    const nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const o = amp * fbm2(x * freq, y * freq, seed);
      out.push([x + nx * o, y + ny * o]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function insetPoly(poly, cx, cy, k) {
  return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

export const VOLCANOES = (() => {
  const r = rng('earth-volcanoes');
  return Array.from({ length: 13 }, (_, i) => ({ x: r(150, 1650), y: r(180, 820), s: r(0.6, 1.3), ph: r(0, TAU), f: r(0.8, 2.2) }));
})();

export function paintPlanet(P) {
  const A = {};
  const r0 = rng('earth-plates');
  const seeds = [];
  for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 11; gx++) seeds.push([gx * 175 + r0(-55, 55) + 10, gy * 185 + r0(-60, 60) - 20]);
  const cells = voronoi(seeds, -60, -60, TEX.w + 60, TEX.h + 60);

  // surface band: magma underneath, crust plates on top
  A.tex = P.layer('earthTex', { w: TEX.w, h: TEX.h, scale: 1.2 }, (c) => {
    const r = c.r;
    const full = [[-10, -10], [TEX.w + 10, -10], [TEX.w + 10, TEX.h + 10], [-10, TEX.h + 10]];
    c.washPoly(full, '#d0482a', 255);
    for (let k = 0; k < 12; k++) c.fillPoly(c.blob(r(0, TEX.w), r(0, TEX.h), r(140, 300), r(90, 180), { rot: r(0, 3), wobble: 0.3 }), r.pick([C.orange, '#e0553a', C.amber, '#f07a3a']), { opacity: 80, bleed: 0.12, texture: 0.8, border: 0.3 });
    // flowing magma strokes
    const flow = [];
    for (let k = 0; k < 220; k++) {
      let x = r(0, TEX.w), y = r(0, TEX.h);
      const pts = [];
      for (let j = 0; j < 7; j++) {
        pts.push([x, y]);
        const a = 3.2 * fbm2(x * 0.003, y * 0.003, 5);
        x += Math.cos(a) * 26; y += Math.sin(a) * 26;
      }
      flow.push({ pts, brush: r.pick(['dry', 'earth_body', 'pastel']), color: r.pick([C.amber, C.gold, C.orange, '#ff9a55', C.vermilion]), w: r(0.5, 1.1), curv: 0.6, seed: 'mf' + k });
    }
    strokeBatch(c, flow);
    c.flush();
    // crust plates (inset so the magma shows along the seams): rust-red crusts, a few dark scabs
    const plateCols = ['#a63a2a', '#b5543c', '#8e3222', '#c0502a', '#9a3a26', '#7a2a1e', '#5c2418', '#b04428'];
    const byCol = {};
    for (const cell of cells) {
      if (cell.poly.length < 3) continue;
      const [sx, sy] = cell.seed;
      const pts = wobble(insetPoly(cell.poly, sx, sy, r(0.82, 0.9)).concat([insetPoly(cell.poly, sx, sy, 0.86)[0]]), 9, 0.02, cell.i);
      const col = r.pick(plateCols);
      (byCol[col] = byCol[col] || []).push(pts);
      cell.paint = { pts, col };
    }
    for (const col in byCol) for (const pts of byCol[col]) c.washPoly(pts, col, 240);
    c.flush();
    // glazes across the band (texture) + darker cooled scabs
    for (let k = 0; k < 10; k++) c.fillPoly(c.blob(r(0, TEX.w), r(0, TEX.h), r(150, 320), r(100, 200), { rot: r(0, 3), wobble: 0.35 }), r.pick(['#5a2418', C.rust, '#7a2e22', C.plum]), { opacity: 55, bleed: 0.1, texture: 0.85, border: 0.3 });
    // plate texture: directional strokes + cooled ridges, warm/cool shifts
    const pl = [];
    for (const cell of cells) {
      const [sx, sy] = cell.seed;
      const ang = r(0, Math.PI);
      for (let k = 0; k < 9; k++) {
        const ox = r(-65, 65), oy = r(-65, 65), L = r(30, 85);
        const x = sx + ox, y = sy + oy, pts = [];
        for (let j = 0; j <= 4; j++) pts.push([x + Math.cos(ang) * L * (j / 4 - 0.5) + 4 * Math.sin(j + k), y + Math.sin(ang) * L * (j / 4 - 0.5)]);
        pl.push({ pts, brush: r.pick(['charcoal', 'pastel', 'dry', 'earth_body']), color: r.pick(['#3a1410', '#7a3a24', '#e0703a', '#5a1e22', C.rust, C.orange, '#4a1e30']), w: r(0.35, 0.8), curv: 0.5, seed: `pl${cell.i}_${k}` });
      }
    }
    strokeBatch(c, pl);
    c.flush();
    for (let k = 0; k < 30; k++) c.line(r(0, TEX.w), r(0, TEX.h), r(0, TEX.w), r(0, TEX.h), 'earth_speck', r.pick(['#2a1010', C.amber]), 0.7);
  });

  // crack network: bright seams between plates (two sets so they can pulse out of phase)
  const edges = [];
  cells.forEach((cell) => {
    const p = cell.poly;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 8) continue;
      // de-duplicate shared edges: keep the one whose midpoint lies left of the seed (arbitrary but consistent)
      const key = [Math.round((a[0] + b[0]) / 4), Math.round((a[1] + b[1]) / 4)].join(',');
      edges.push({ a, b, key, cell: cell.i });
    }
  });
  const seen = new Set();
  const uniq = edges.filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)));
  const paintCracks = (name, pick) => P.layer(name, { w: TEX.w, h: TEX.h, scale: 1.2 }, (c) => {
    const r = c.r;
    const list = [];
    uniq.forEach((e, k) => {
      if (!pick(k)) return;
      const pts = wobble([e.a, e.b], 10, 0.025, k + 3).map((p, j, arr) => [p[0], p[1], 0.5 + 0.7 * Math.sin((Math.PI * j) / (arr.length - 1))]);
      list.push({ pts, brush: 'earth_flame', color: r.pick([C.orange, '#ff8a3a', C.amber]), w: r(1.1, 1.8), curv: 0.4, seed: 'cko' + k });
      list.push({ pts, brush: 'ink', color: r.pick([C.gold, '#ffe39a', C.cream]), w: r(0.6, 1.0), curv: 0.4, seed: 'cki' + k });
    });
    // branching hairline cracks into the plates
    for (let k = 0; k < 160; k++) {
      const e = uniq[r.int(0, uniq.length - 1)];
      if (!pick(k * 7)) continue;
      const t = r(0.2, 0.8);
      let x = lerp(e.a[0], e.b[0], t), y = lerp(e.a[1], e.b[1], t);
      let ang = Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0]) + (r() < 0.5 ? 1 : -1) * r(0.9, 1.9);
      const pts = [];
      for (let j = 0; j < 5; j++) { pts.push([x, y, 1 - j / 5]); ang += r(-0.5, 0.5); x += Math.cos(ang) * r(10, 22); y += Math.sin(ang) * r(10, 22); }
      list.push({ pts, brush: 'earth_hair', color: r.pick([C.amber, C.gold, C.orange]), w: r(0.7, 1.2), curv: 0.5, seed: 'ckh' + k });
    }
    strokeBatch(c, list);
    // volcano vents: bright dabs with radiating flow lines
    if (name === 'earthCracksA') for (const v of VOLCANOES) {
      c.fillPoly(c.blob(v.x, v.y, 16 * v.s, 13 * v.s), C.gold, { opacity: 220, bleed: 0.05, texture: 0.3, border: 0.2 });
      c.fillPoly(c.blob(v.x, v.y, 7 * v.s, 6 * v.s), '#fff2cf', { opacity: 240, bleed: 0.02, texture: 0.2, border: 0.2 });
      const rays = [];
      for (let k = 0; k < 7; k++) {
        const a = r(0, TAU), L = r(25, 60) * v.s, pts = [];
        for (let j = 0; j <= 4; j++) pts.push([v.x + Math.cos(a + 0.2 * Math.sin(j)) * L * j / 4, v.y + Math.sin(a + 0.2 * Math.sin(j)) * L * j / 4, 1 - j / 5]);
        rays.push({ pts, brush: 'earth_flame', color: r.pick([C.orange, C.amber]), w: 0.8, curv: 0.5, seed: `vr${k}` });
      }
      strokeBatch(c, rays);
    }
  });
  A.cracksA = paintCracks('earthCracksA', (k) => k % 3 !== 0);
  A.cracksB = paintCracks('earthCracksB', (k) => k % 3 === 0);

  // painted silhouette disc (mask + base) with an organic edge
  A.disc = P.layer('earthDisc', { w: DISC.w, h: DISC.h, scale: 1.25 }, (c) => {
    const cx = DISC.w / 2, cy = DISC.h / 2;
    const d = c.blob(cx, cy, DISC.R, DISC.R, { n: 160, wobble: 0.004, freq: 7 });
    c.washPoly(d, '#3a1418', 255);
    c.fillPoly(d, '#5c2418', { opacity: 120, bleed: 0.004, texture: 0.6, border: 0.7 });
  });
  return A;
}

// Night side + terminator + rim + contour painted in the planet's local frame (light from -x).
// alpha = phase angle (0 full .. PI new), cool = 0 molten .. 1 cooled.
function paintShade(c, alpha, cool, key) {
  const R = 440, cx = 500, cy = 500;
  const r = (i) => hash(i, 77);
  const ca = Math.cos(alpha);
  const term = (y) => R * ca * Math.sqrt(Math.max(0, 1 - (y / R) ** 2));
  // night region polygon, washes stepped across the terminator for a soft painted edge
  const night = (shift) => {
    const pts = [];
    for (let j = 0; j <= 40; j++) {
      const y = -R + (2 * R * j) / 40;
      pts.push([cx + term(y) + shift * Math.sqrt(Math.max(0, 1 - (y / R) ** 2)), cy + y]);
    }
    for (let j = 40; j >= 0; j--) {
      const a = -Math.PI / 2 + (Math.PI * j) / 40;
      pts.push([cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02]);
    }
    return pts;
  };
  const nightCol = mixHex('#1a1030', '#0e1a30', cool);
  const steps = [[-40, 30], [-20, 45], [0, 65], [20, 85], [45, 105]];
  steps.forEach(([sh, op], k) => c.washPoly(night(sh), mixHex(nightCol, k % 2 ? '#241438' : '#101c34', 0.08 * k), op));
  // strokes parallel to the terminator (wrap the form)
  const list = [];
  for (let k = 0; k < 46; k++) {
    const f = r(k) * 1.0;
    const cc = lerp(ca, 1, f);
    const y0 = -R + r(k + 100) * 1.4 * R, len = (0.25 + 0.5 * r(k + 200)) * R;
    const pts = [];
    for (let j = 0; j <= 8; j++) {
      const y = clamp(y0 + len * (j / 8 - 0.5), -R * 0.98, R * 0.98);
      pts.push([cx + R * cc * Math.sqrt(Math.max(0, 1 - (y / R) ** 2)) + 6 * Math.sin(j + k), cy + y, 0.4 + 0.6 * Math.sin((Math.PI * j) / 8)]);
    }
    const col = [mixHex('#2a1a4a', '#1b2a4a', cool), mixHex(C.purple, '#16223a', cool), mixHex('#3a1a3a', C.navy2, cool), C.ink][k % 4];
    list.push({ pts, brush: ['earth_body', 'dry', 'charcoal', 'pastel'][k % 4], color: col, w: 0.8 + r(k + 300) * 0.9, curv: 0.6, seed: `nt${k}_${key}` });
  }
  // terminator seam: broken warm/cool strokes
  for (let k = 0; k < 9; k++) {
    const y0 = -R * 0.9 + (k / 8) * R * 1.8, pts = [];
    for (let j = 0; j <= 5; j++) {
      const y = clamp(y0 + (j - 2.5) * R * 0.05, -R * 0.97, R * 0.97);
      pts.push([cx + term(y) - 8, cy + y, 0.6]);
    }
    list.push({ pts, brush: 'pastel', color: k % 2 ? C.plum : mixHex(C.rust, C.sea, cool), w: 1.1, curv: 0.5, seed: `tm${k}_${key}` });
  }
  // lit limb (sun side) + contour (lost on the lit side, found on the night side)
  for (let k = 0; k < 4; k++) {
    const a0 = Math.PI - 0.9 + k * 0.42, pts = [];
    for (let j = 0; j <= 8; j++) { const a = a0 + (0.5 * j) / 8; pts.push([cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97, Math.sin((Math.PI * j) / 8)]); }
    list.push({ pts, brush: 'pastel', color: mixHex(C.gold, '#bfe6ff', cool * 0.7), w: 1.3, curv: 0.5, seed: `lm${k}_${key}` });
  }
  for (let k = 0; k < 5; k++) {
    const a0 = -1.2 + k * 0.52 + 0.1 * r(k + 400), pts = [];
    for (let j = 0; j <= 8; j++) { const a = a0 + (0.45 * j) / 8; pts.push([cx + Math.cos(a) * R * 1.0, cy + Math.sin(a) * R * 1.0, 0.3 + Math.sin((Math.PI * j) / 8)]); }
    list.push({ pts, brush: 'ink', color: mixHex('#120a18', '#0a1020', cool), w: 1.5, curv: 0.5, seed: `ct${k}_${key}` });
  }
  strokeBatch(c, list);
}

// st: {x, y, r, m, sun:{x,y}}; returns nothing. Draws the planet at screen circle (x, y, r).
export function drawEarth(R, A, lt, st, o = {}) {
  const { x, y } = st;
  const rr = st.r;
  if (!(rr > 0.05)) return;
  const cool = o.cool ?? smoother(10.2, 12.6, lt);
  const wet = o.wet ?? 0;
  const heat = 1 - cool;
  const form = win(lt, 6.6, 7.4, 7.5, 8.6); // accretion glow
  const sunAng = st.sun ? Math.atan2(st.sun.y - y, st.sun.x - x) : Math.PI * 1.1;
  if (rr < 1.6) {
    R.glow(x, y, 4 + rr * 3, [1, 0.62, 0.3], 0.5 + 1.5 * form, { ext: 3 });
    return;
  }
  // heat halo behind (orange) -> thin blue atmosphere once cooled
  const haloK = 1 - smoothstep(900, 1700, rr);
  if (haloK > 0) R.glow(x, y, rr * 1.35, mixRGBc([1, 0.45, 0.2], [0.35, 0.55, 0.9], cool), (0.22 * heat + 0.12 * cool + 0.5 * form) * haloK, { shape: [1.2, 0.35, 2.2], ext: 2.2 });
  const discM = M.place(x, y, rr / DISC.R, sunAng + Math.PI, DISC.w / 2, DISC.h / 2);
  // painted, wobbly silhouette while the planet is a globe; an exact limb once it is a horizon
  const big = rr > 1200;
  const mask = big ? { type: 'ellipse', x, y, rx: rr, ry: rr, r0: 1 - 1.2 / rr, r1: 1 } : { type: 'texture', layer: A.disc, m: discM, threshold: 0.5, softness: 0.08 };
  // base silhouette
  if (!big) R.layer(A.disc, discM);
  else R.rect(-20, Math.max(-20, y - rr - 4), 1960, 1200, [...hex('#140f1e'), 1], { mask });
  // surface band scrolls (planet rotation), bulge-warped to read as a sphere
  const k = rr / TEX.R;
  const scroll = 560 + 60 * (lt - 6);
  const axis = -0.42;
  const texM = M.place(x, y, k, axis, scroll, TEX.h / 2);
  const warp = rr > 40 ? { type: 'bulge', cx: x, cy: y, radius: rr * 1.02, strength: 0.62 } : undefined;
  // cooling crust -> wet, dark basalt under the night sea
  const surfGrade = [lerp(lerp(1.05, 0.55, cool), 0.3, wet), lerp(lerp(1.0, 0.42, cool), 0.2, wet), lerp(1, 0.55, wet)];
  const tint = [lerp(1, 0.55, wet), lerp(lerp(1, 0.9, cool), 0.78, wet), lerp(lerp(1, 1.25, cool), 1.35, wet)];
  R.layer(A.tex, texM, { warp, mask, grade: surfGrade, tint });
  // crack seams: bright paint while molten, darkening to crust, then drowned
  const crackCol = hex(mixHex('#2a1612', '#10192a', wet));
  const crackVis = 1 - smoothstep(0.55, 0.95, wet);
  if (crackVis > 0.01) {
    R.layer(A.cracksA, texM, { warp, mask, opacity: crackVis, color: [crackCol[0], crackCol[1], crackCol[2], smoothstep(0.2, 0.9, cool)] });
    R.layer(A.cracksB, texM, { warp, mask, opacity: crackVis, color: [crackCol[0], crackCol[1], crackCol[2], smoothstep(0.1, 0.7, cool)] });
  }
  // painted night side (boils on twelves), rotated so the lit limb faces the Sun
  const alpha = o.phase ?? lerp(1.15, 2.35, smoother(9.2, 11.0, lt));
  // the brush texture boils on twelves while the planet is a globe; once the planet fills the sky
  // (and the storm deck covers it) the painting is frozen: repaints would shimmer under magnification
  const FREEZE = o.freezeAt ?? 12.25;
  let key = R.key(12), boil = rr < 900 ? key : 'still', a2 = alpha, c2 = cool;
  if (lt >= FREEZE) {
    key = 'frozen';
    boil = 'still';
    a2 = o.phaseAt ? o.phaseAt(FREEZE) : alpha;
    c2 = smoother(10.2, 12.6, FREEZE);
  }
  const shade = R.dyn('earthShade', key, (c) => paintShade(c, a2, c2, boil), { w: 1000, h: 1000, scale: 1.5 });
  R.layer(shade, M.place(x, y, rr / 440, sunAng + Math.PI, 500, 500));
  // lava glow on top (HDR, pulsing out of phase) — cools away
  const pulse = (ph) => 0.75 + 0.25 * Math.sin(R.t * 2.3 + ph) * Math.sin(R.t * 0.9 + ph * 2);
  const gA = heat * (1.6 + 1.4 * form) * pulse(0), gB = heat * 1.3 * pulse(2.1);
  if (gA > 0.02) R.layer(A.cracksA, texM, { warp, mask, blend: 'add', grade: [1.15, 1.1 * gA, 1], opacity: 1 });
  if (gB > 0.02) R.layer(A.cracksB, texM, { warp, mask, blend: 'add', grade: [1.15, 1.0 * gB, 1], opacity: 1 });
  // accretion flash
  if (form > 0.01) R.glow(x, y, rr * 0.9, [1, 0.7, 0.4], 0.8 * form, { shape: [1.5, 0.3, 2], ext: 2 });
}
function mixRGBc(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
