// PIVOTS — shared hand-off states between film segments.
//
// A pivot is a tiny scene whose picture is drawn identically by the segment that ENDS on it and
// the segment that STARTS from it, so the boundary between segments is invisible. Segments must
// *transform* into / out of the pivot (morph, grow, zoom, camera move) — never fade or wipe.
//
// Use from a segment:   R.drawScene(PIVOT.star, 0)          (draw the pivot with the current view)
//                       PIVOT.eye.drawEye(R, x, y, radius)   (pivot elements at any size/place)
// Pivot animation is driven by GLOBAL time (R.t) so both sides agree at the boundary.
// Each pivot's draw() paints its full background. At the boundary both segments must use the
// DEFAULT post settings (return {} from post(), or ease back to the defaults before the boundary).
// P6 "singularity" is the loop point: pure void (a point of light may shrink to nothing into it).
import { C } from './lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, makeStars, starParticles, circlePts, ellipsePts, paintBall, paintCanvas } from './lib/kit.js';

// ------------------------------------------------------------------------------------------------
// P1 @ 30.5 s  — "star": a single warm star at screen centre on deep night, with a faint starfield.
// ------------------------------------------------------------------------------------------------
const star = {
  id: 'pivot-star',
  bg: C.night,
  paint(P) {
    const canvas = P.layer('nightCanvas', { w: 1920, h: 1080 }, (c) => paintCanvas(c, C.night, ['#16223a', '#1b2a48', '#0a1120', '#221c3a', '#10243a'], { strokes: 260, angle: -0.12 }));
    return { canvas, stars: makeStars('pivot-star', 520, { warm: 0.35 }) };
  },
  // Draws background stars + the central star. `k` (0..1) scales the central star (1 = pivot size).
  draw(R, lt, A, k = 1) {
    R.fill(hex(C.night));
    R.layer(A.canvas);
    R.particles(starParticles(A.stars, R.t, { alpha: 0.55 }), { kind: 'glow', blend: 'add' });
    star.drawStar(R, 960, 540, k);
  },
  drawStar(R, x, y, k = 1) {
    const tw = 1 + 0.04 * Math.sin(R.t * 5.1) + 0.03 * Math.sin(R.t * 8.3);
    R.glow(x, y, 34 * k, [1, 0.93, 0.8], 2.2 * tw, { shape: [2.5, 0.6, 2.2], ext: 5 });
    R.glow(x, y, 130 * k, [1, 0.68, 0.38], 0.32, { shape: [1.2, 0.4, 1.6], ext: 4 });
  },
};

// ------------------------------------------------------------------------------------------------
// P2 @ 52.5 s — "cell": one large cell centred in a teal medium (the start of cell division).
// ------------------------------------------------------------------------------------------------
export const CELL = { x: 960, y: 540, r: 250, nucleusR: 96, body: '#e0553a', rim: C.amber, nucleus: '#16223a', medium: C.teal };
const cell = {
  id: 'pivot-cell',
  bg: C.teal,
  paint(P) {
    const medium = P.layer('medium', { w: 2400, h: 1400 }, (c) => {
      const r = c.r;
      c.washPoly([[0, 0], [2400, 0], [2400, 1400], [0, 1400]], C.teal, 255);
      for (let i = 0; i < 14; i++) c.fillPoly(c.blob(r(0, 2400), r(0, 1400), r(250, 600), r(160, 360), { rot: r(0, 3) }), r.pick([C.cyan, C.deepTeal, C.sea, C.aqua]), { opacity: 40, bleed: 0.12, texture: 0.8, border: 0.15 });
      // fine flowing lines
      for (let i = 0; i < 70; i++) {
        const y0 = (i / 70) * 1400 + r(-6, 6);
        const pts = [];
        for (let x = -40; x <= 2440; x += 80) pts.push([x, y0 + 18 * Math.sin(x * 0.004 + i * 0.37) + 7 * Math.sin(x * 0.011 + i)]);
        c.strokePath(pts, 'wire', i % 3 ? C.aqua : C.cyan, 0.8, 0.6);
      }
    });
    const body = P.layer('cellBody', { w: 640, h: 640, scale: 2 }, (c) => {
      const cx = 320, cy = 320;
      const outline = circlePts(cx, cy, CELL.r, 120);
      // rim colour first, body colour inside it: a lighter band at the membrane
      c.washPoly(outline, CELL.rim, 255);
      c.fillPoly(outline, C.gold, { opacity: 90, bleed: 0.01, texture: 0.6, border: 0.4 });
      const inner = circlePts(cx, cy, CELL.r * 0.84, 120);
      c.washPoly(inner, CELL.body, 255);
      c.fillPoly(inner, C.vermilion, { opacity: 140, bleed: 0.015, texture: 0.7, border: 0.5 });
      // cytoplasm specks
      const r = c.r;
      for (let i = 0; i < 26; i++) {
        const a = r(0, TAU), d = r(CELL.nucleusR + 30, CELL.r * 0.75);
        c.fillPoly(c.blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r(5, 14), r(4, 10), { rot: a }), r.pick([C.rust, C.gold, C.plum]), { opacity: 150, bleed: 0.02, texture: 0.4 });
      }
      c.strokePath(circlePts(cx, cy, CELL.r * 0.995, 120).concat([circlePts(cx, cy, CELL.r * 0.995, 120)[0]]), 'ink', C.cream, 1.4, 0.3);
    });
    const nucleus = P.layer('cellNucleus', { w: 260, h: 260, scale: 2 }, (c) => {
      const cx = 130, cy = 130;
      const o = circlePts(cx, cy, CELL.nucleusR, 90);
      c.washPoly(o, CELL.nucleus, 255);
      c.fillPoly(o, C.navy2, { opacity: 150, bleed: 0.02, texture: 0.7, border: 0.4 });
      // chromatin squiggles
      const r = c.r;
      for (let i = 0; i < 7; i++) {
        const pts = [];
        let a = r(0, TAU), x = cx + r(-30, 30), y = cy + r(-30, 30);
        for (let k = 0; k < 7; k++) {
          pts.push([x, y]);
          a += r(-1.4, 1.4);
          x += Math.cos(a) * 11;
          y += Math.sin(a) * 11;
        }
        c.strokePath(pts, 'ink', C.cream, 1.3, 0.8);
      }
      c.strokePath(o.concat([o[0]]), 'ink', C.lavender, 1.0, 0.3);
    });
    return { medium, body, nucleus };
  },
  draw(R, lt, A) {
    R.fill(hex(C.teal));
    R.layer(A.medium, M.translate(-240, -160));
    cell.drawCell(R, A, CELL.x, CELL.y, 1, R.t);
  },
  // The cell at any position / scale (scale 1 = pivot size). Gentle breathing driven by global time.
  drawCell(R, A, x, y, s = 1, t = R.t) {
    const b = 1 + 0.012 * Math.sin(t * 1.7);
    R.layer(A.body, M.place(x, y, s * b, 0.03 * Math.sin(t * 0.5), 320, 320));
    R.layer(A.nucleus, M.place(x, y, s * b, -0.05 * t, 130, 130));
  },
};

// ------------------------------------------------------------------------------------------------
// P3 @ 70 s — "eye": a reptilian eye so close it fills the frame (iris covers the screen).
// The same painted eye is used on the creatures, at any size: PIVOT.eye.drawEye(R, A, x, y, r).
// ------------------------------------------------------------------------------------------------
export const EYE = { R: 1200 };
const eye = {
  id: 'pivot-eye',
  bg: '#2a1a0c',
  paint(P) {
    const E = EYE.R;
    // painted at 2400 design units wide; scale 0.9 keeps it ~4300 px wide at 4K — the pivot is a close-up
    const paintIris = (withPupil) => (c) => {
      const cx = E, cy = E, r = c.r;
      c.washPoly(circlePts(cx, cy, E, 160), '#c98a2e', 255);
      // warm concentric colour zones
      c.fillPoly(circlePts(cx, cy, E * 0.98, 160), C.gold, { opacity: 170, bleed: 0.02, texture: 0.8, border: 0.3 });
      c.fillPoly(circlePts(cx, cy, E * 0.55, 140), C.amber, { opacity: 150, bleed: 0.04, texture: 0.7, border: 0.25 });
      c.fillPoly(circlePts(cx, cy, E * 0.32, 120), C.orange, { opacity: 140, bleed: 0.05, texture: 0.6, border: 0.2 });
      // radial fibres
      for (let i = 0; i < 520; i++) {
        const a = r(0, TAU), r0 = E * r(0.12, 0.3), r1 = E * r(0.55, 0.99);
        const bend = r(-0.08, 0.08);
        const pts = [];
        for (let k = 0; k <= 6; k++) {
          const t = k / 6, rr = lerp(r0, r1, t), aa = a + bend * Math.sin(t * Math.PI);
          pts.push([cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr]);
        }
        c.strokePath(pts, r() < 0.5 ? 'wire' : 'ink', r.pick(['#fff0c0', C.sand, '#7a4a1a', C.rust, '#ffd27a', '#5a3a14']), r(0.8, 2.6), 0.6);
      }
      // crypts
      for (let i = 0; i < 40; i++) {
        const a = r(0, TAU), d = E * r(0.35, 0.85);
        c.fillPoly(c.blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r(20, 60), r(10, 28), { rot: a + Math.PI / 2 }), '#6a3a12', { opacity: 110, bleed: 0.04, texture: 0.6 });
      }
      // dark limbal ring
      const ring = circlePts(cx, cy, E, 160).concat(circlePts(cx, cy, E * 0.9, 160).reverse());
      c.fillPoly(ring, '#3a2208', { opacity: 200, bleed: 0.04, texture: 0.5, border: 0.3 });
      if (!withPupil) return;
      // pupil (vertical slit)
      const pupil = ellipsePts(cx, cy, E * 0.085, E * 0.62, 0, 90).slice(0, -1);
      c.washPoly(pupil, '#07080c', 255);
      c.fillPoly(pupil, '#1a2440', { opacity: 90, bleed: 0.02, texture: 0.5, border: 0.6 });
    };
    const iris = P.layer('iris', { w: 2 * E, h: 2 * E, scale: 0.9 }, paintIris(true));
    // the same iris without its pupil (same seed → same fibres), plus a round painted pupil that can be
    // squeezed into the slit: a fish's round eye becoming the reptile's (PIVOT.eye.drawEye(..., pupil))
    const irisBare = P.layer('irisBare', { w: 2 * E, h: 2 * E, scale: 0.9, seed: 'iris' }, paintIris(false));
    const pupilDisc = P.layer('pupilDisc', { w: E, h: E, scale: 0.5 }, (c) => {
      const disc = circlePts(E / 2, E / 2, E * 0.48, 120);
      c.washPoly(disc, '#07080c', 255);
      c.fillPoly(disc, '#1a2440', { opacity: 90, bleed: 0.02, texture: 0.5, border: 0.6 });
    });
    return { iris, irisBare, pupilDisc };
  },
  draw(R, lt, A) {
    R.fill(hex('#2a1a0c'));
    eye.drawEye(R, A, 960, 540, EYE.R);
  },
  // pupil: 0 = a fish's big round pupil … 1 = the reptile's vertical slit (the pivot)
  drawEye(R, A, x, y, radius, rot = 0, pupil = 1) {
    const s = radius / EYE.R;
    const u = clamp(pupil, 0, 1);
    // the squeezing round pupil hands over to the painted slit once their shapes coincide (u 0.88 → 1)
    const handover = clamp((u - 0.88) / 0.12, 0, 1);
    if (handover < 1) {
      R.layer(A.irisBare, M.place(x, y, s, rot, EYE.R, EYE.R));
      const k = u * u * (3 - 2 * u);
      const rx = lerp(0.4, 0.085, k), ry = lerp(0.4, 0.62, k); // radii in units of EYE.R
      const m = M.chain(M.translate(x, y), M.rotate(rot), M.scale((s * rx) / 0.48, (s * ry) / 0.48), M.translate(-EYE.R / 2, -EYE.R / 2));
      R.layer(A.pupilDisc, m);
    }
    if (handover > 0) R.layer(A.iris, M.place(x, y, s, rot, EYE.R, EYE.R), { opacity: handover });
    // wet highlight (a soft window reflection) + faint sheen
    const hx = x + (-0.36 * Math.cos(rot) + 0.3 * Math.sin(rot)) * radius, hy = y + (-0.36 * Math.sin(rot) - 0.3 * Math.cos(rot)) * radius;
    R.glow(hx, hy, radius * 0.07, [1, 0.97, 0.9], 1.4, { shape: [3.5, 0.2, 3], ext: 3 });
    R.glow(x, y, radius * 0.9, [1, 0.8, 0.5], 0.08, { shape: [1, 0.2, 1], ext: 1.4 });
  },
};

// ------------------------------------------------------------------------------------------------
// P4 @ 97.5 s — "night sky": a full-frame starry night (no ground visible).
// ------------------------------------------------------------------------------------------------
const night = {
  id: 'pivot-night',
  bg: C.night,
  paint(P) {
    const band = P.layer('milkyway', { w: 2400, h: 1400, scale: 0.6 }, (c) => {
      const r = c.r;
      for (let i = 0; i < 26; i++) {
        const x = r(-100, 2500), y = 700 - (x - 1200) * 0.35 + r(-160, 160);
        c.fillPoly(c.blob(x, y, r(160, 380), r(60, 140), { rot: -0.34 + r(-0.2, 0.2) }), r.pick([C.navy2, C.violet, C.blue, C.purple]), { opacity: 35, bleed: 0.15, texture: 0.9, border: 0.05 });
      }
    });
    const canvas = P.layer('nightSkyCanvas', { w: 1920, h: 1080 }, (c) => paintCanvas(c, C.night, ['#1b2a48', '#16223a', '#23305a', '#0a1120', '#2a2450'], { strokes: 220, angle: -0.3, curl: 0.35 }));
    return { band, canvas, stars: makeStars('pivot-night', 900, { warm: 0.25, size: [0.7, 3.4] }) };
  },
  draw(R, lt, A) {
    R.rect(-200, -200, 2320, 1480, [...hex(C.night), 1], { c1: [...hex(C.navy2), 1], grad: 'vertical' });
    R.layer(A.canvas, M.id(), { opacity: 0.8 });
    R.layer(A.band, M.translate(-240, -160), { opacity: 0.85 });
    R.particles(starParticles(A.stars, R.t, { alpha: 0.9 }), { kind: 'glow', blend: 'add' });
  },
};

// ------------------------------------------------------------------------------------------------
// P5 @ 117.5 s — "gear": one large golden gear, centred, turning (angle from global time).
// ------------------------------------------------------------------------------------------------
export const GEAR = { x: 960, y: 540, r: 380, teeth: 24, spin: 0.55 };
export function gearOutline(cx, cy, r, teeth, toothH = 0.12, n = 12) {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    for (let k = 0; k < n; k++) {
      const u = k / n, a = ((i + u) / teeth) * TAU;
      // trapezoid tooth profile
      const on = u < 0.18 ? u / 0.18 : u < 0.5 ? 1 : u < 0.68 ? 1 - (u - 0.5) / 0.18 : 0;
      const rr = r * (1 + toothH * on);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  }
  return pts;
}
const gear = {
  id: 'pivot-gear',
  bg: C.night,
  paint(P) {
    const g = P.layer('gear', { w: 1000, h: 1000, scale: 1.5 }, (c) => {
      const cx = 500, cy = 500, R0 = GEAR.r;
      const outer = gearOutline(cx, cy, R0, GEAR.teeth);
      c.washPoly(outer, C.gold, 255);
      c.fillPoly(outer, C.amber, { opacity: 120, bleed: 0.02, texture: 0.8, border: 0.5 });
      // rim band + spokes cut-outs painted dark (the background shows through as navy paint)
      const holeR0 = R0 * 0.3, holeR1 = R0 * 0.78;
      for (let s = 0; s < 6; s++) {
        const a0 = (s / 6) * TAU + 0.16, a1 = ((s + 1) / 6) * TAU - 0.16;
        const hole = [];
        for (let k = 0; k <= 18; k++) hole.push([cx + Math.cos(lerp(a0, a1, k / 18)) * holeR1, cy + Math.sin(lerp(a0, a1, k / 18)) * holeR1]);
        for (let k = 18; k >= 0; k--) hole.push([cx + Math.cos(lerp(a0 + 0.1, a1 - 0.1, k / 18)) * holeR0, cy + Math.sin(lerp(a0 + 0.1, a1 - 0.1, k / 18)) * holeR0]);
        c.washPoly(hole, C.night, 255);
        c.fillPoly(hole, C.navy2, { opacity: 120, bleed: 0.02, texture: 0.6 });
      }
      c.hatchPoly(circlePts(cx, cy, R0 * 0.97, 96), { dist: 9, angle: 0.6, brushName: 'wire', color: C.ochre, weight: 0.9, rand: 0.15 });
      // hub
      c.fillPoly(circlePts(cx, cy, R0 * 0.22, 64), C.ochre, { opacity: 220, bleed: 0.02, texture: 0.6, border: 0.4 });
      c.washPoly(circlePts(cx, cy, R0 * 0.08, 40), C.night, 255);
      const o1 = circlePts(cx, cy, R0 * 0.99, 140), o2 = circlePts(cx, cy, R0 * 0.22, 60);
      c.strokePath(o1.concat([o1[0]]), 'ink', '#6a4a1a', 1.6, 0.3);
      c.strokePath(o2.concat([o2[0]]), 'ink', '#6a4a1a', 1.6, 0.3);
    });
    return { g };
  },
  angle(t) { return (t - 117.5) * GEAR.spin; },
  draw(R, lt, A) {
    R.fill(hex(C.night));
    R.glow(960, 540, 700, hex(C.navy2), 0.35, { ext: 2 });
    gear.drawGear(R, A, GEAR.x, GEAR.y, 1, gear.angle(R.t));
  },
  drawGear(R, A, x, y, s = 1, rot = 0, o = {}) {
    R.layer(A.g, M.place(x, y, s, rot, 500, 500), o);
  },
};

// ------------------------------------------------------------------------------------------------
// P6 @ 145 s (= 0 s) — "singularity": darkness with a tiny trembling point of light (film loops).
// ------------------------------------------------------------------------------------------------
const singularity = {
  id: 'pivot-singularity',
  bg: C.void,
  paint(P) {
    const canvas = P.layer('voidCanvas', { w: 1920, h: 1080 }, (c) => paintCanvas(c, C.void, ['#0b1020', '#10122a', '#070a14', '#140e1c', '#0a1418'], { strokes: 240, angle: 0.08, weight: [4, 11] }));
    return { canvas };
  },
  draw(R, lt, A) { R.fill(hex(C.void)); R.layer(A.canvas); },
  drawPoint(R, x, y, k = 1) {
    if (k <= 0) return;
    R.glow(x, y, 2.2 * k, [1, 0.93, 0.8], 2.0 * k, { shape: [3, 0.5, 2.5], ext: 6 });
  },
};

// ------------------------------------------------------------------------------------------------
// P4 @ 85 s — "ash": an overcast sky choked with smoke and falling ash (no ground visible).
// ------------------------------------------------------------------------------------------------
const ash = {
  id: 'pivot-ash',
  bg: '#4a4652',
  paint(P) {
    const clouds = P.layer('ashClouds', { w: 2400, h: 1400, scale: 0.75 }, (c) => {
      const r = c.r;
      for (let i = 0; i < 30; i++) {
        c.fillPoly(c.blob(r(-100, 2500), r(-100, 1500), r(180, 460), r(90, 220), { rot: r(-0.3, 0.3), wobble: 0.18 }),
          r.pick(['#5c5764', '#6f6878', '#3d3a45', '#7d7166', '#57504a']), { opacity: 60, bleed: 0.14, texture: 0.85, border: 0.2 });
      }
      for (let i = 0; i < 40; i++) {
        const y = r(0, 1400), x = r(-200, 2400), pts = [];
        for (let k = 0; k < 6; k++) pts.push([x + k * 90, y + 14 * Math.sin(k * 1.3 + i)]);
        c.strokePath(pts, 'dry', r.pick(['#8a8594', '#b3a9c4', '#4d4a57']), r(0.6, 1.2), 0.5);
      }
    });
    const r = rng('pivot-ash-flakes');
    const flakes = Array.from({ length: 700 }, () => ({ x: r(0, 1920), y: r(0, 1080), s: r(1.2, 4.2), v: r(18, 60), sway: r(8, 30), f: r(0.3, 1.2), ph: r(0, TAU), c: r() }));
    return { clouds, flakes };
  },
  draw(R, lt, A) {
    R.rect(-200, -200, 2320, 1480, [...hex('#3a3742'), 1], { c1: [...hex('#77707c'), 1], grad: 'vertical' });
    R.layer(A.clouds, M.translate(-240 + 6 * Math.sin(R.t * 0.1), -160));
    ash.drawFlakes(R, A, 1);
  },
  // Falling ash in screen space (positions from global time so both sides agree).
  drawFlakes(R, A, alpha = 1) {
    const t = R.t, out = [];
    for (const f of A.flakes) {
      const y = ((f.y + f.v * t) % 1180) - 50;
      const x = f.x + f.sway * Math.sin(t * f.f + f.ph);
      const g = 0.62 + 0.3 * f.c;
      out.push([x, y, f.s, t * f.f, g, g * 0.97, g * 0.95, 0.75 * alpha]);
    }
    R.particles(out, { kind: 'soft' });
  },
};

// ------------------------------------------------------------------------------------------------
// P6 @ 107.5 s — "fields": top-down cultivated land, diagonal bands of crops with furrow lines.
// ------------------------------------------------------------------------------------------------
export const FIELDS = { angle: -0.35 };
const fields = {
  id: 'pivot-fields',
  bg: '#8a5a3a',
  paint(P) {
    const land = P.layer('fields', { w: 2600, h: 1800, scale: 1.1 }, (c) => {
      const r = c.r;
      const cols = [C.leaf, C.sand, C.green, C.ochre, '#8a5a3a', C.olive, C.gold, C.moss, C.sage];
      const ca = Math.cos(FIELDS.angle), sa = Math.sin(FIELDS.angle);
      const cx = 1300, cy = 900, span = 3200;
      let off = -1500;
      const bands = [];
      while (off < 1500) {
        const w = r(150, 320);
        bands.push({ off, w, col: cols[bands.length % cols.length] });
        off += w;
      }
      for (const b of bands) {
        const pts = [];
        for (let k = 0; k <= 16; k++) {
          const u = -span / 2 + (span * k) / 16;
          const o = b.off + 10 * Math.sin(k * 0.9 + b.off);
          pts.push([cx + u * ca - o * sa, cy + u * sa + o * ca]);
        }
        for (let k = 16; k >= 0; k--) {
          const u = -span / 2 + (span * k) / 16;
          const o = b.off + b.w + 10 * Math.sin(k * 0.9 + b.off + b.w);
          pts.push([cx + u * ca - o * sa, cy + u * sa + o * ca]);
        }
        c.washPoly(pts, b.col, 255);
        c.fillPoly(pts, mixHex(b.col, '#3a2a1a', 0.18), { opacity: 70, bleed: 0.03, texture: 0.8, border: 0.3 });
        const n = Math.floor(b.w / 14);
        for (let i = 1; i < n; i++) {
          const o = b.off + (b.w * i) / n;
          c.line(cx - (span / 2) * ca - o * sa, cy - (span / 2) * sa + o * ca, cx + (span / 2) * ca - o * sa, cy + (span / 2) * sa + o * ca, 'wire', mixHex(b.col, '#2a1a0a', 0.35), 0.7);
        }
      }
    });
    return { land };
  },
  draw(R, lt, A) {
    R.fill(hex('#8a5a3a'));
    R.layer(A.land, M.translate(-340, -360));
  },
};

// ------------------------------------------------------------------------------------------------
// P8 @ 130 s — "die": extreme close-up of a microchip die — a grid of cells, some lit.
// ------------------------------------------------------------------------------------------------
export const DIE = { cols: 16, rows: 9, cell: 120 };
const die = {
  id: 'pivot-die',
  bg: '#0c1e26',
  paint(P) {
    const grid = P.layer('die', { w: 1920, h: 1080, scale: 1 }, (c) => {
      const r = c.r;
      c.washPoly([[0, 0], [1920, 0], [1920, 1080], [0, 1080]], '#0c1e26', 255);
      for (let j = 0; j < DIE.rows; j++) for (let i = 0; i < DIE.cols; i++) {
        const x = i * DIE.cell + 10, y = j * DIE.cell + 10, w = DIE.cell - 20;
        const cell = [[x, y], [x + w, y], [x + w, y + w], [x, y + w]];
        c.washPoly(cell, r.pick([C.deepTeal, '#15434c', '#1f4e57']), 255);
        c.fillPoly(cell, C.teal, { opacity: 60, bleed: 0.01, texture: 0.8, border: 0.5 });
      }
      for (let j = 0; j <= DIE.rows; j++) c.line(0, j * DIE.cell, 1920, j * DIE.cell, 'wire', C.ochre, 0.9);
      for (let i = 0; i <= DIE.cols; i++) c.line(i * DIE.cell, 0, i * DIE.cell, 1080, 'wire', C.ochre, 0.9);
    });
    return { grid };
  },
  // Which cells are lit (deterministic in global time; pattern steps 4x per second).
  lit(i, j, t) {
    const k = Math.floor(t * 4);
    const v = Math.sin(i * 1.7 + j * 2.3 + k * 0.9) * Math.sin(i * 0.6 - j * 1.1 + k * 0.37);
    return v > 0.45 ? 1 : 0;
  },
  draw(R, lt, A) {
    R.fill(hex('#0c1e26'));
    R.layer(A.grid);
    die.drawLights(R, R.t);
  },
  drawLights(R, t, alpha = 1) {
    for (let j = 0; j < DIE.rows; j++) for (let i = 0; i < DIE.cols; i++) {
      if (!die.lit(i, j, t)) continue;
      const x = i * DIE.cell + 10, y = j * DIE.cell + 10, w = DIE.cell - 20;
      R.rect(x + 8, y + 8, w - 16, w - 16, [...hex(C.cream), 0.92 * alpha]);
      R.glow(x + w / 2, y + w / 2, w * 0.45, [1, 0.8, 0.45], 0.35 * alpha, { ext: 2.2 });
    }
  },
};

export const PIVOT = { star, cell, eye, ash, night, fields, gear, die, singularity };
