// HUNT — sky: the pivot's painted night (extended beyond its frame so the tilt never reveals an
// edge), stars, and a dawn painted as light: broad horizontal brush strokes that warm from violet
// through rose to gold, clouds that catch the light, the sun, and a flock of birds.
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, makeStars, starParticles, paintCanvas } from '../lib/kit.js';
import { hash32, invLerp, noise1, ease } from '../../engine/math.js';
import * as K from './choreo.js';

// Sky coordinates = the night pivot's world (identity at lt 0). The horizon sits at K.SKY_H.
const EXT = { x0: -760, y0: -560, x1: 3160, y1: Math.ceil(K.SKY_H + 380) };
const PIVOT_CANVAS = { tones: ['#1b2a48', '#16223a', '#23305a', '#0a1120', '#2a2450'], strokes: 220, angle: -0.3, curl: 0.35 };

function strokeRow(c, x0, x1, y, { len = [300, 900], dy = 18, tones, brush = ['gouache', 'dry'], weight = [3, 8], angle = 0, curl = 0.12, n = 1 }) {
  const r = c.r;
  for (let i = 0; i < n; i++) {
    const L = r(len[0], len[1]), a = angle + r(-0.04, 0.04);
    let x = r(x0 - 200, x1), yy = y + r(-dy, dy);
    const pts = [];
    for (let k = 0; k < 7; k++) {
      pts.push([x, yy, lerp(0.55, 1.1, Math.sin((k / 6) * Math.PI))]);
      x += Math.cos(a + curl * Math.sin(k * 0.8 + i)) * (L / 6);
      yy += Math.sin(a + curl * Math.sin(k * 0.8 + i)) * (L / 6);
    }
    c.strokePath(pts, r.pick(brush), r.pick(tones), r(weight[0], weight[1]) / 5, 0.55);
  }
}

export function paintSky(P) {
  const W = EXT.x1 - EXT.x0, H = EXT.y1 - EXT.y0;
  // 1. night canvas beyond the pivot's frame. First replay the pivot's own painting (same RNG) so
  //    its strokes, clipped at the pivot frame, continue seamlessly; then paint the surroundings.
  const skyExt = P.layer('skyExt', { w: W, h: H, scale: K.sc(P, 0.7) }, (c) => {
    const r = c.r;
    c.washPoly([[0, 0], [W, 0], [W, H], [0, H]], C.night, 255);
    c.flush();
    // surroundings: same recipe, placed around the pivot frame
    const tones = PIVOT_CANVAS.tones;
    for (let i = 0; i < 420; i++) {
      const len = r(260, 900), a = PIVOT_CANVAS.angle + r(-0.25, 0.25);
      let x = r(-200, W), y = r(-40, H + 40);
      // skip starts well inside the pivot frame (it has its own)
      const sx = x + EXT.x0, sy = y + EXT.y0;
      if (sx > 120 && sx < 1700 && sy > 80 && sy < 1000) continue;
      const pts = [];
      for (let k = 0; k < 7; k++) {
        pts.push([x, y, lerp(0.6, 1.1, Math.sin((k / 6) * Math.PI))]);
        x += Math.cos(a + PIVOT_CANVAS.curl * Math.sin(k * 0.9 + i)) * (len / 7);
        y += Math.sin(a + PIVOT_CANVAS.curl * Math.sin(k * 0.9 + i)) * (len / 7);
      }
      c.strokePath(pts, r() < 0.6 ? 'gouache' : 'dry', mixHex(C.night, r.pick(tones), r(0.25, 0.85)), r(3, 9) / 5, 0.6);
    }
    for (let i = 0; i < 110; i++) {
      const x = r(0, W), y = r(0, H), pts = [];
      for (let k = 0; k < 5; k++) pts.push([x + r(-60, 60), y + r(-30, 30)]);
      c.strokePath(pts, 'dry', mixHex(C.night, r.pick(tones), r(0.25, 0.7)), r(0.8, 1.6), 0.8);
    }
    // the pivot's canvas, replayed at its place (hidden under the pivot layer inside its frame)
    const c2 = { ...c, r: rng(hash32('pivot-night/nightSkyCanvas') ^ 0x9e3779b9) };
    c.p.push();
    c.p.translate(-EXT.x0, -EXT.y0);
    paintCanvas(c2, C.night, PIVOT_CANVAS.tones, { strokes: PIVOT_CANVAS.strokes, angle: PIVOT_CANVAS.angle, curl: PIVOT_CANVAS.curl });
    c.flush();
    c.p.pop();
    // near the horizon: long low haze strokes (cooler, lighter) — the night air over the plain
    const hy = K.SKY_H - EXT.y0;
    for (let k = 0; k < 16; k++) strokeRow(c, 0, W, hy - 40 - k * 26 + r(-8, 8), { tones: ['#1d2c4c', '#22335a', '#182644', '#26304f'], n: 9, weight: [5, 11], len: [400, 1100] });
  });
  // 2. dawn light: horizontal brush strokes painted in warm lights (drawn with screen blending)
  const dawnLow = P.layer('dawnLow', { w: W, h: 900, scale: K.sc(P, 0.55) }, (c) => {
    const r = c.r, base = 820; // horizon at y = base
    for (let k = 0; k < 40; k++) {
      const q = k / 39, y = base - Math.pow(q, 1.3) * 780;
      const warm = 1 - q;
      const tones = warm > 0.6 ? ['#ffd68a', '#ffc070', '#ffe4a8', '#f7a860'] : warm > 0.3 ? ['#f2a07a', '#e88a7a', '#f0b08a', '#d9707a'] : ['#b07aa8', '#9a6aa0', '#c08ab0', '#8a6aa8'];
      // fewer, more scattered strokes with altitude: the glow feathers out instead of ending in an edge
      strokeRow(c, 0, W, y, { tones, n: Math.max(1, Math.round(22 * Math.pow(warm, 1.6))), weight: [3, 11], len: [380, 1300], dy: 14 + 70 * q, curl: 0.08, brush: ['gouache', 'dry'] });
    }
    // glow core painted with softer marks near the horizon
    for (let i = 0; i < 60; i++) strokeRow(c, 0, W, base - r(0, 90), { tones: ['#fff0c8', '#ffe0a0', '#ffd080'], n: 1, weight: [6, 14], len: [300, 900], dy: 10, brush: ['gouache'] });
  });
  const dawnHigh = P.layer('dawnHigh', { w: W, h: 1300, scale: K.sc(P, 0.5) }, (c) => {
    for (let k = 0; k < 30; k++) {
      const q = k / 29, y = 1180 - k * 38;
      const dens = Math.sin(Math.PI * Math.min(1, q * 1.15));
      strokeRow(c, 0, W, y, { tones: ['#8a6aa8', '#a67ab4', '#c88aa8', '#7a5a9a', '#d49aa8'], n: Math.max(1, Math.round(12 * dens)), weight: [3, 10], len: [400, 1200], dy: 30 + 40 * (1 - dens), curl: 0.1, brush: ['gouache', 'dry'] });
    }
  });
  // 3. clouds: long banks near the horizon + high wisps. Body (dark, normal blend) + lit edges (screen)
  const CL = (() => {
    const r = rng('hunt-clouds'), out = [];
    for (let i = 0; i < 16; i++) {
      const alt = i < 10 ? r(90, 380) : r(420, 820);
      out.push({ x: r(0, W), alt, len: r(380, 1100) * (i < 10 ? 1 : 0.7), th: r(22, 60) * (i < 10 ? 1 : 0.6), ph: r(0, TAU) });
    }
    return out;
  })();
  const cloudH = 1000, cbase = 960; // horizon at cbase in the cloud layers
  const cloudBody = P.layer('cloudBody', { w: W, h: cloudH, scale: K.sc(P, 0.55) }, (c) => {
    const r = c.r;
    for (const cl of CL) {
      const y = cbase - cl.alt, pts = [];
      const n = 26;
      for (let k = 0; k <= n; k++) {
        const u = k / n, x = cl.x - cl.len / 2 + u * cl.len;
        pts.push([x, y - cl.th * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * u), 0.7)) * (1 + 0.25 * Math.sin(u * 9 + cl.ph))]);
      }
      for (let k = n; k >= 0; k--) {
        const u = k / n, x = cl.x - cl.len / 2 + u * cl.len;
        pts.push([x, y + cl.th * 0.28 * Math.sin(Math.PI * u) + 3 * Math.sin(u * 13 + cl.ph)]);
      }
      c.fillPoly(pts, '#3a3150', { opacity: 150, bleed: 0.04, texture: 0.7, border: 0.4 });
      for (let j = 0; j < 7; j++) strokeRow(c, cl.x - cl.len / 2, cl.x + cl.len / 2 - 300, y - r(0, cl.th * 0.7), { tones: ['#2c2842', '#453a5a', '#382e4e'], n: 1, weight: [3, 7], len: [cl.len * 0.3, cl.len * 0.6], dy: 4 });
    }
  });
  const cloudLit = P.layer('cloudLit', { w: W, h: cloudH, scale: K.sc(P, 0.55) }, (c) => {
    const r = c.r;
    for (const cl of CL) {
      const y = cbase - cl.alt;
      // light catches the underside (sun below the horizon) — thin warm strokes along the bottom edge
      for (let j = 0; j < 9; j++) {
        const u0 = r(0.05, 0.6), u1 = u0 + r(0.2, 0.4);
        const pts = [];
        for (let k = 0; k <= 6; k++) {
          const u = lerp(u0, Math.min(0.97, u1), k / 6), x = cl.x - cl.len / 2 + u * cl.len;
          pts.push([x, y + cl.th * 0.22 * Math.sin(Math.PI * u) + r(-3, 3), 0.6 + 0.5 * Math.sin((k / 6) * Math.PI)]);
        }
        c.strokePath(pts, r.pick(['gouache', 'pastel', 'dry']), r.pick(['#ffd49a', '#ffc27a', '#ffe6b8', '#f6a07a']), r(2, 6) / 5, 0.5);
      }
    }
  });
  // 4. birds: a small flock, 4-frame wing cycle (dark silhouettes)
  const birds = P.layer('birds', { w: 400, h: 100, scale: K.sc(P, 1) }, (c) => {
    for (let f = 0; f < 4; f++) {
      const cx = 50 + f * 100, cy = 50;
      const wing = [-0.55, -0.1, 0.35, -0.1][f];
      const pts = (s) => [[cx, cy + 2], [cx + s * 16, cy - 6 + wing * 26 * 0.6], [cx + s * 34, cy - 2 + wing * 30]];
      c.strokePath(pts(1), 'ink', '#1d1a2a', 2.2, 0.6);
      c.strokePath(pts(-1), 'ink', '#1d1a2a', 2.2, 0.6);
      c.washPoly(c.blob(cx, cy + 2, 6, 3.4, { wobble: 0.1 }), '#1d1a2a', 255);
    }
  });
  const starsExt = (() => {
    const all = makeStars('hunt-stars-ext', 2600, { x0: EXT.x0, y0: EXT.y0, x1: EXT.x1, y1: K.SKY_H - 40, warm: 0.25, size: [0.7, 3.4] });
    return all.filter((s) => !(s.x >= -200 && s.x <= 2120 && s.y >= -200 && s.y <= 1280));
  })();
  const flock = (() => {
    const r = rng('hunt-flock'), out = [];
    for (let i = 0; i < 17; i++) out.push({ dx: r(-160, 160) + (i % 2 ? 1 : -1) * (i * 11), dy: r(-40, 40) + Math.abs(i - 8) * 9, s: r(0.55, 0.95), f: r(5.5, 7.5), ph: r(0, TAU) });
    return out;
  })();
  // an opaque card the size of the pivot's frame: used as an inverted mask so the extension never
  // shows through the pivot's (80 % opaque) painted canvas
  const frameCard = P.layer('frameCard', { w: 1920, h: 1080, scale: 0.03, mip: false }, (c) => c.washPoly([[-20, -20], [1940, -20], [1940, 1100], [-20, 1100]], '#ffffff', 255));
  // soft painted cloud shadows for the fields (multiply-blended on the ground)
  const cloudShadow = P.layer('cloudShadow', { w: 2600, h: 1400, scale: K.sc(P, 0.3) }, (c) => {
    const r = c.r;
    for (const [x, y, rx, ry] of [[520, 420, 420, 200], [1350, 900, 520, 230], [2100, 380, 380, 170], [900, 1150, 300, 140]]) {
      for (let k = 0; k < 3; k++) c.fillPoly(c.blob(x + r(-80, 80), y + r(-40, 40), rx * r(0.6, 0.95), ry * r(0.6, 0.95), { wobble: 0.25, freq: 3 }), '#3a4462', { opacity: 55, bleed: 0.25, texture: 0.5, border: 0.05 });
    }
  });
  return { skyExt, dawnLow, dawnHigh, cloudBody, cloudLit, birds, starsExt, flock, cloudBase: cbase, frameCard, cloudShadow };
}

// dawn progress 0 (night) .. 1 (sunrise gold)
export const dawnAt = (lt) => Math.pow(smoothstep(K.T.dawn - 0.05, K.T.dawn + 2.3, lt), 0.7);
const nightStops = (y) => {
  const t = (y + 200) / 1480, a = hex(C.night), b = hex(C.navy2);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
};

// Draw the sky in sky coordinates (caller has pushed the sky view).
export function drawSky(R, lt, A, AN) {
  const d = dawnAt(lt);
  const H0 = K.SKY_H;
  // base gradient: identical to the pivot's inside its frame, extended linearly outside
  R.rect(-3200, -2600, 8400, 2400, [...nightStops(-200), 1]);
  R.rect(-3200, -200, 8400, 1480, [...hex(C.night), 1], { c1: [...hex(C.navy2), 1], grad: 'vertical' });
  R.rect(-3200, 1280, 8400, H0 + 900 - 1280, [...nightStops(1280), 1], { c1: [...nightStops(H0 + 900), 1], grad: 'vertical' });
  // painted night: extension under, pivot canvas on top (exact inside the frame)
  const hole = { type: 'texture', layer: A.frameCard, m: M.mul(R.view, M.chain(M.translate(3, 3), M.scale(1914 / 1920, 1074 / 1080))), threshold: 0.5, softness: 0.02, invert: true };
  R.layer(A.skyExt, M.translate(EXT.x0, EXT.y0), { opacity: 0.8, mask: hole });
  R.layer(AN.canvas, M.id(), { opacity: 0.8 });
  // horizon air: a cool glow at night that warms into the dawn (screen-blended painted light)
  const nightGlow = 0.12 * smoothstep(0.3, 1.6, lt);
  const lowCol = d < 0.5 ? mixHex('#3a5a8a', '#b86aa8', d * 2) : mixHex('#b86aa8', '#ffc070', d * 2 - 1);
  const lowI = nightGlow * (1 - d) + d * 1.0;
  if (lowI > 0.001) R.layer(A.dawnLow, M.translate(EXT.x0, H0 - 820), { blend: 'screen', opacity: clamp(lowI), color: [...hex(lowCol), 0.62] });
  const highI = 0.75 * smoothstep(0.1, 0.8, d);
  if (highI > 0.001) R.layer(A.dawnHigh, M.translate(EXT.x0, H0 - 1250 - 380), { blend: 'screen', opacity: highI, color: [...hex(mixHex('#6a4a8a', '#e89a9a', d)), 0.55] });
  // milky way and stars fade as the sky brightens
  const mw = 0.85 * (1 - smoothstep(K.T.dawn - 0.2, K.T.dawn + 1.4, lt));
  if (mw > 0.001) R.layer(AN.band, M.translate(-240, -160), { opacity: mw });
  const sa = 0.9 * (1 - smoothstep(K.T.dawn + 0.2, K.T.dawn + 2.4, lt));
  if (sa > 0.002) {
    R.particles(starParticles(AN.stars, R.t, { alpha: sa }), { kind: 'glow', blend: 'add' });
    R.particles(starParticles(A.starsExt, R.t, { alpha: sa }), { kind: 'glow', blend: 'add' });
  }
  // a shooting star falls toward the horizon; the camera's tilt follows it down to the ridge
  const mt = lt - 0.22;
  if (mt > 0 && mt < 0.95) {
    const P0 = [1460, 150], P1 = [700, 1180];
    const pos = (k) => [lerp(P0[0], P1[0], k), lerp(P0[1], P1[1], k)];
    const k = ease.inQuad(clamp(mt / 0.8));
    const fade = smoothstep(0, 0.12, mt) * (1 - smoothstep(0.62, 0.9, mt));
    const trail = [];
    for (let i = 0; i < 44; i++) {
      const kk = k - i * 0.009;
      if (kk < 0) break;
      const [x, y] = pos(kk);
      trail.push([x, y, 10 - i * 0.18, 0, 1, 0.92 - i * 0.008, 0.8 - i * 0.01, 0.7 * fade * (1 - i / 44)]);
    }
    R.particles(trail, { kind: 'glow', blend: 'add' });
    const [hx, hy] = pos(k);
    R.glow(hx, hy, 7, [1, 0.95, 0.85], 3.0 * fade, { shape: [3, 0.4, 2], ext: 5 });
    R.glow(hx, hy, 40, [0.8, 0.85, 1], 0.12 * fade, { shape: [1, 0.3, 2], ext: 3 });
  }
  // sun: rises from behind the far hills at the right
  if (d > 0.05) {
    const sx = 1700, sy = H0 + lerp(140, -330, smoothstep(0.3, 1.0, d)) - 60 * smoothstep(K.T.land + 1.2, K.T.land + 3.5, lt);
    R.glow(sx, sy, 560, [1, 0.55, 0.3], 0.32 * d, { shape: [1, 0.45, 1.4], ext: 3 });
    R.glow(sx, H0 - 40, 760, [1, 0.62, 0.35], 0.6 * d, { shape: [1.5, 0.3, 2], ext: 3, sx: 2.8, sy: 0.5 });
    R.glow(sx - 500, H0 - 10, 900, [1, 0.5, 0.45], 0.22 * d, { shape: [1.2, 0.3, 2], ext: 3, sx: 3.2, sy: 0.35 });
    const core = smoothstep(0.45, 0.9, d);
    if (core > 0) {
      R.glow(sx, sy, 34, [1, 0.93, 0.75], 2.2 * core, { shape: [3.2, 0.5, 2.2], ext: 5 });
      // long soft rays
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.33 + 0.04 * Math.sin(lt * 0.7 + i);
        R.glow(sx + Math.cos(a) * 380, sy + Math.sin(a) * 380, 380, [1, 0.75, 0.45], 0.08 * core * (0.7 + 0.3 * Math.sin(i * 2.1 + lt)), { shape: [1.2, 0.2, 2], ext: 2.5, sx: 0.08, sy: 1.1, rot: a + Math.PI / 2 });
      }
    }
  }
  // clouds: dark bodies (visible as the sky lightens), warm lit undersides
  const cb = 0.35 + 0.65 * smoothstep(0.0, 0.5, d);
  const bodyCol = d < 0.5 ? mixHex('#1a2036', '#3a2c4c', d * 2) : mixHex('#3a2c4c', '#7a5a70', d * 2 - 1);
  R.layer(A.cloudBody, M.translate(EXT.x0 + 30 * Math.sin(lt * 0.05), H0 - A.cloudBase), { opacity: cb * 0.9, color: [...hex(bodyCol), 0.85] });
  const lit = smoothstep(0.15, 0.85, d);
  if (lit > 0.001) R.layer(A.cloudLit, M.translate(EXT.x0 + 30 * Math.sin(lt * 0.05), H0 - A.cloudBase), { blend: 'screen', opacity: lit, color: [...hex(d < 0.6 ? '#f090a0' : '#ffc890'), 0.4] });
  // birds cross the dawn sky
  const bt = lt - (K.T.dawn + 0.3);
  if (bt > 0 && bt < 4.2) {
    for (const b of A.flock) {
      const x = 700 + bt * 260 + b.dx, y = H0 - 330 - bt * 45 + b.dy + 8 * Math.sin(bt * 1.3 + b.ph);
      const f = Math.floor(((bt * b.f + b.ph) % 4 + 4) % 4);
      R.layer(A.birds, M.chain(M.translate(x, y), M.scale(b.s * 0.9), M.translate(-50, -50)), { uv: [f / 4, 0, (f + 1) / 4, 1], w: 100, h: 100, color: [...hex(mixHex('#1d1a2a', '#4a3040', d)), 0.8] });
    }
  }
}
