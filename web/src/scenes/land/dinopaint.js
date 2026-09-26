// LAND — painting of the sauropod's cut-out parts (static layers), painter's process:
// hidden flat base -> watercolour underpainting -> form-following bristle strokes (warm/cool) ->
// stripes, scales, wrinkles -> clip to the silhouette -> lost-and-found contour.
import { TAU, lerp, clamp, smoothstep, mixHex, crSpline, inPoly } from './util.js';
import { circlePts, ellipsePts } from '../lib/kit.js';
import { D, DC, NECK_PAD, TAIL_PAD, neckHalfW, tailHalfW } from './dino.js';
import { clipTo, fieldStrokes, dabs, contour, bounds, offsetLine } from './paintkit.js';
import { defineLandBrushes } from './brushes.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];
const ORANGES = ['#f2893c', '#e06a30', '#f6a050', '#d8552a', '#ec7434', '#c94a2a', '#f59a4a'];
const CRIMSON = ['#d23a44', '#b12838', '#c8303e', '#a02034', '#dc4a4c'];
const CREAMS = ['#f8e2a8', '#f0c066', '#fbe9b8', '#f4d088', '#e8b458'];

export function paintDino(P) {
  defineLandBrushes(P.brush);
  const out = {};

  // ============================================================ torso
  const TW = 580, TH = 340, TOX = 290, TOY = 175;
  const ctrl = [[-262, -78], [-200, -118], [-112, -137], [-24, -132], [66, -119], [146, -104], [206, -92], [246, -50], [253, 10],
    [232, 62], [188, 104], [120, 122], [40, 132], [-50, 130], [-126, 124], [-190, 98], [-236, 56], [-258, 4]];
  const K = 10;
  const sil0 = crSpline(ctrl, K, true);
  const upper0 = sil0.slice(0, 6 * K + 1);
  const lower0 = sil0.slice(8 * K, 17 * K + 1);
  const backY = (x) => {
    for (let i = 1; i < upper0.length; i++) if (upper0[i][0] >= x) {
      const a = upper0[i - 1], b = upper0[i];
      return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1));
    }
    return upper0[upper0.length - 1][1];
  };
  const bandW = (x) => 24 + 14 * Math.sin(clamp((x + 252) / 460) * Math.PI) + 4 * Math.sin(x * 0.09);
  const bellyY = (x) => 52 + 12 * Math.sin((x + 260) / 510 * Math.PI) - 38 * Math.pow(Math.abs(x) / 262, 4);
  out.torso = P.layer('dinoTorso', { w: TW, h: TH, scale: 2.4 }, (c) => {
    const r = c.r;
    const o = (p) => [p[0] + TOX, p[1] + TOY];
    const sil = sil0.map(o);
    const region = (x, y) => { // x,y in body coords
      if (y < backY(x) + bandW(x)) return 'band';
      if (y > bellyY(x)) return 'belly';
      return 'flank';
    };
    // hidden flat map
    c.washPoly(sil, DC.orange, 255);
    const bellyPoly = lower0.concat(Array.from({ length: 51 }, (_, i) => { const x = lerp(-259, 253, i / 50); return [x, bellyY(x)]; })).map(o);
    c.washPoly(bellyPoly, DC.belly, 255);
    const bandPoly = upper0.map(o).concat(upper0.map((p) => o([p[0], p[1] + bandW(p[0])])).reverse());
    c.washPoly(bandPoly, DC.cream, 255);
    // underpainting glazes (warm/cool)
    c.fillPoly(c.blob(...o([-60, -20]), 200, 70, { wobble: 0.2 }), '#f5a050', { opacity: 60, bleed: 0.12, texture: 0.8, border: 0.2 });
    c.fillPoly(c.blob(...o([120, 30]), 120, 60, { wobble: 0.2 }), '#c8452a', { opacity: 60, bleed: 0.12, texture: 0.8, border: 0.2 });
    c.fillPoly(c.blob(...o([-200, 20]), 70, 80, { wobble: 0.2 }), '#a8382a', { opacity: 55, bleed: 0.12, texture: 0.8, border: 0.2 });
    c.fillPoly(bellyPoly, '#9a2034', { opacity: 70, bleed: 0.04, texture: 0.85, border: 0.5 });
    // direction field: ribs wrap vertically on the flank (fanning), along the back near the top
    const dir = (X, Y) => {
      const x = X - TOX, y = Y - TOY;
      const wrap = Math.PI / 2 + 0.38 * (x / 260) + 0.1 * Math.sin(y * 0.03);
      const bl = backY(x);
      const slope = Math.atan2(backY(x + 6) - backY(x - 6), 12);
      const w = smoothstep(bl + 55, bl + 15, y);
      return lerp(wrap, slope, w);
    };
    const colAt = (X, Y, rr) => {
      const x = X - TOX, y = Y - TOY;
      const reg = region(x, y);
      if (reg === 'band') return pick(rr, CREAMS);
      if (reg === 'belly') return pick(rr, CRIMSON);
      // flank: warmer/lighter up top, deeper low and at the rear
      const k = clamp((y - backY(x)) / 150) * 0.6 + clamp((-x - 120) / 160) * 0.4;
      return mixHex(pick(rr, ORANGES), '#b03a26', k * 0.5);
    };
    fieldStrokes(c, sil, dir, { n: 1100, len: [24, 58], brush: 'land_comb', w: [0.42, 0.8], col: colAt });
    fieldStrokes(c, sil, dir, { n: 260, len: [10, 26], brush: 'land_dry', w: [0.35, 0.6], col: colAt });
    // stripes: bold, irregular, wrapping
    for (let i = 0; i < 13; i++) {
      const x = -196 + i * 31 + r(-6, 6);
      const yt = backY(x) + bandW(x) - r(2, 10), yb = bellyY(x) + r(4, 16);
      for (let k = 0; k < 3; k++) {
        const pts = [];
        const v0 = r(0, 0.15), v1 = r(0.8, 1);
        for (let j = 0; j <= 7; j++) {
          const v = lerp(v0, v1, j / 7);
          const y = lerp(yt, yb, v);
          pts.push(o([x + 0.38 * (x / 260) * (y - yt) * 0.5 + 7 * Math.sin(v * Math.PI) + r(-1.5, 1.5) + k * 2.5, y]));
        }
        c.strokePath(pts, k === 1 ? 'land_dry' : 'land_comb', pick(r, ['#b0381e', '#a0301c', '#bc4424', '#962a1a']), r(0.6, 0.9) * (k === 1 ? 0.8 : 1), 0.5);
      }
    }
    // band/flank boundary accent
    c.strokePath(upper0.map((p) => o([p[0], p[1] + bandW(p[0]) - 1])).filter((_, i) => i > 3 && i < 58), 'land_contour', '#b8401e', 0.9, 0.4);
    // scales: small dabs (lighter tops / darker undersides)
    dabs(c, sil, { n: 900, len: [3, 6.5], w: [0.22, 0.36], dir: () => 0, col: (X, Y, rr) => {
      const reg = region(X - TOX, Y - TOY);
      return reg === 'band' ? pick(rr, ['#fff2cc', '#e0a448']) : reg === 'belly' ? pick(rr, ['#e25a5a', '#86182c']) : pick(rr, ['#ffb070', '#b83e22', '#f8a860']);
    } });
    // skin folds at the thigh and shoulder
    for (const [hx, rx, ry] of [[-138, 60, 52], [168, 54, 48]]) {
      for (let k = 0; k < 4; k++) {
        const arc = [];
        const rr = 1 - k * 0.12;
        for (let j = 0; j <= 16; j++) {
          const a = Math.PI * 1.08 + (j / 16) * Math.PI * (0.8 - k * 0.08);
          arc.push(o([hx + Math.cos(a) * rx * rr, 92 + Math.sin(a) * ry * rr]));
        }
        c.strokePath(arc, k === 0 ? 'land_contour' : 'wire', k === 0 ? '#7a1426' : '#8a2030', k === 0 ? 1.2 : 0.7, 0.5);
      }
    }
    // shadow under the belly: glaze + hatching
    const shade = crSpline([[-230, 60], [-120, 95], [40, 96], [180, 88], [230, 60], [184, 104], [40, 114], [-122, 120], [-234, 54]], 6, true).map(o);
    c.fillPoly(shade, '#5e1028', { opacity: 90, bleed: 0.05, texture: 0.7, border: 0.3 });
    c.hatchPoly(shade, { dist: 3.2, angle: 1.15, brushName: 'wire', color: '#4a0c20', weight: 0.6, rand: 0.25 });
    // rim light along the top of the back
    for (let i = 0; i < 40; i++) {
      const x = r(-220, 200);
      const y = backY(x) + r(3, 9);
      c.strokePath([o([x - 14, backY(x - 14) + 4]), o([x, y]), o([x + 16, backY(x + 16) + 5])], 'land_comb', pick(r, ['#fff4d6', '#fbe0a0']), r(0.3, 0.5), 0.5);
    }
    clipTo(c, sil, [0, 0, TW, TH]);
    contour(c, sil, { col: '#5a1020', w: 1.25, keep: 0.85, run: [8, 22], lost: (x, y) => (y < TOY - 110 && x > TOX - 120 && x < TOX + 60) || (x > TOX + 150 && y < TOY + 20) || (x < TOX - 235 && y < TOY + 20) });
  });
  out.torsoO = [TOX, TOY];

  // ============================================================ neck strip (y<0 back, y>0 throat)
  const NL = D.neckL + 2 * NECK_PAD, NH = 2 * (D.neckW0 + 12);
  out.neck = P.layer('dinoNeck', { w: NL, h: NH, scale: 4.2 }, (c) => {
    const r = c.r;
    const o = (x, y) => [x + NECK_PAD, y + NH / 2];
    const up = [], dn = [];
    for (let i = 0; i <= 90; i++) {
      const x = lerp(-NECK_PAD, D.neckL + NECK_PAD, i / 90);
      const w = neckHalfW(x / D.neckL);
      up.push(o(x, -w));
      dn.push(o(x, w));
    }
    const sil = up.concat(dn.slice().reverse());
    const wAt = (X) => neckHalfW((X - NECK_PAD) / D.neckL);
    const thr = (X) => wAt(X) * (0.3 + 0.05 * Math.sin(X * 0.04));
    c.washPoly(sil, DC.orange, 255);
    const th = [];
    for (let i = 0; i <= 90; i++) { const x = lerp(-NECK_PAD, D.neckL + NECK_PAD, i / 90); th.push(o(x, thr(x + NECK_PAD))); }
    const TB = th.concat(dn.slice().reverse());
    c.washPoly(TB, DC.cream, 255);
    c.fillPoly(c.blob(...o(120, -20), 150, 30, { wobble: 0.2 }), '#f5a050', { opacity: 55, bleed: 0.12, texture: 0.8, border: 0.2 });
    c.fillPoly(c.blob(...o(20, -30), 70, 40, { wobble: 0.2 }), '#b8402a', { opacity: 55, bleed: 0.12, texture: 0.8, border: 0.2 });
    // transverse wrap strokes (slightly curved), longitudinal near the dorsal edge
    const dir = (X, Y) => {
      const w = wAt(X), y = Y - NH / 2;
      const along = smoothstep(-w * 0.55, -w * 0.9, y);
      return lerp(Math.PI / 2 + 0.25 * (y / w), 0, along);
    };
    const colAt = (X, Y, rr) => {
      const y = Y - NH / 2;
      if (y > thr(X)) return pick(rr, CREAMS);
      return mixHex(pick(rr, ORANGES), '#b03a26', clamp(-y / wAt(X)) * 0.35);
    };
    fieldStrokes(c, sil, dir, { n: 900, len: [14, 36], brush: 'land_comb', w: [0.3, 0.55], col: colAt });
    fieldStrokes(c, sil, dir, { n: 220, len: [6, 16], brush: 'land_dry', w: [0.25, 0.45], col: colAt });
    // stripes (transverse bands on the dorsal side, fading toward the head)
    for (let i = 0; i < 12; i++) {
      const X = NECK_PAD + 6 + i * 27 + r(-3, 3);
      const w = wAt(X);
      for (let k = 0; k < 2; k++) {
        const pts = [o(X - NECK_PAD - 5 + k * 2, -w * 0.95), o(X - NECK_PAD - 1 + k * 2, -w * 0.4), o(X - NECK_PAD + 3 + k * 2, thr(X) * 0.6)];
        c.strokePath(pts, k ? 'land_dry' : 'land_comb', pick(r, ['#b0381e', '#a0301c', '#bc4424']), (0.75 - i * 0.03) * (k ? 0.7 : 1), 0.5);
      }
    }
    // throat folds (wrinkles)
    for (let i = 0; i < 34; i++) {
      const x = 4 + i * 10.5 + r(-2, 2), X = x + NECK_PAD, w = wAt(X);
      c.strokePath([o(x, thr(X) + 2), o(x + 1.5, lerp(thr(X), w, 0.55)), o(x + r(-1, 2), w * 0.97)], 'wire', pick(r, ['#d0904a', '#c07a3a', '#e0a860']), r(0.45, 0.7), 0.5);
    }
    c.strokePath(th, 'land_contour', '#c4602a', 0.7, 0.4);
    dabs(c, sil, { n: 520, len: [2.5, 5], w: [0.18, 0.3], dir: () => Math.PI / 2, col: (X, Y, rr) => (Y - NH / 2 > thr(X) ? pick(rr, ['#fff4d6', '#d8a060']) : pick(rr, ['#ffb070', '#b83e22', '#f8a860'])) });
    // dorsal ridge scutes
    for (let i = 0; i < 40; i++) {
      const x = 2 + i * 8.6, X = x + NECK_PAD, w = wAt(X);
      c.strokePath([o(x - 2, -w + 3), o(x + 1, -w - 1.2), o(x + 4, -w + 3)], 'land_contour', '#8a2418', 0.5, 0.5);
    }
    clipTo(c, sil, [0, 0, NL, NH]);
    contour(c, up, { col: '#5a1020', w: 1.15, keep: 0.9, run: [10, 24], closed: false });
    contour(c, dn, { col: '#9a5020', w: 0.9, keep: 0.6, run: [8, 18], closed: false });
  });
  out.neckMeta = { L: NL, H: NH, pad: NECK_PAD };

  // ============================================================ tail strip (+y = top/cream; drawn rotated ~180°)
  const TL = D.tailL + 2 * TAIL_PAD, TTH = 2 * (D.tailW0 + 10);
  out.tail = P.layer('dinoTail', { w: TL, h: TTH, scale: 2.4 }, (c) => {
    const r = c.r;
    const o = (x, y) => [x + TAIL_PAD, y + TTH / 2];
    const up = [], dn = [];
    for (let i = 0; i <= 90; i++) {
      const x = lerp(-TAIL_PAD, D.tailL, i / 90);
      const w = tailHalfW(x / D.tailL);
      up.push(o(x, -w));
      dn.push(o(x, w));
    }
    const sil = up.concat([o(D.tailL + 6, 0)], dn.slice().reverse());
    const wAt = (X) => tailHalfW((X - TAIL_PAD) / D.tailL);
    const topB = (X) => wAt(X) * (0.22 + 0.05 * Math.sin(X * 0.05));
    const undB = (X) => -wAt(X) * 0.32;
    c.washPoly(sil, DC.orange, 255);
    const tb = [];
    for (let i = 0; i <= 90; i++) { const x = lerp(-TAIL_PAD, D.tailL, i / 90); tb.push(o(x, topB(x + TAIL_PAD))); }
    c.washPoly(tb.concat(dn.slice().reverse()), DC.cream, 255);
    const ub = [];
    for (let i = 0; i <= 90; i++) { const x = lerp(-TAIL_PAD, D.tailL, i / 90); ub.push(o(x, undB(x + TAIL_PAD))); }
    c.washPoly(ub.concat(up.slice().reverse()), DC.belly, 255);
    const dir = (X, Y) => {
      const y = Y - TTH / 2, w = wAt(X);
      return lerp(Math.PI / 2 - 0.3 * (y / (w + 1)), 0, smoothstep(w * 0.3, w * 0.8, Math.abs(y)));
    };
    const colAt = (X, Y, rr) => {
      const y = Y - TTH / 2;
      if (y > topB(X)) return pick(rr, CREAMS);
      if (y < undB(X)) return pick(rr, CRIMSON);
      return pick(rr, ORANGES);
    };
    fieldStrokes(c, sil, dir, { n: 800, len: [16, 44], brush: 'land_comb', w: [0.3, 0.6], col: colAt });
    fieldStrokes(c, sil, dir, { n: 160, len: [8, 20], brush: 'land_dry', w: [0.25, 0.45], col: colAt });
    for (let i = 0; i < 13; i++) {
      const x = 12 + i * 28 + r(-4, 4), w = wAt(x + TAIL_PAD);
      c.strokePath([o(x, undB(x + TAIL_PAD) * 0.9), o(x + 2, 0), o(x + 4, topB(x + TAIL_PAD) * 1.05)], 'land_comb', pick(r, ['#b0381e', '#a0301c', '#bc4424']), 0.7 * (1 - i / 16) + 0.15, 0.5);
    }
    dabs(c, sil, { n: 500, len: [3, 6], w: [0.2, 0.34], dir: () => Math.PI / 2, col: (X, Y, rr) => (Y - TTH / 2 > topB(X) ? pick(rr, ['#fff4d6', '#d8a060']) : pick(rr, ['#ffb070', '#b83e22'])) });
    c.strokePath(tb, 'land_contour', '#c24a24', 0.8, 0.4);
    clipTo(c, sil, [0, 0, TL, TTH]);
    contour(c, dn, { col: '#9a5020', w: 0.9, keep: 0.6, run: [8, 18], closed: false });
    contour(c, up, { col: '#5a1020', w: 1.1, keep: 0.9, run: [10, 24], closed: false });
  });
  out.tailMeta = { L: TL, H: TTH, pad: TAIL_PAD };

  // ============================================================ legs (painted vertically, joint at (60, 35))
  const legPart = (name, len, w0, w1, dark, kind) => P.layer(name, { w: 120, h: len + 80, scale: 2.6 }, (c) => {
    const r = c.r;
    const o = (x, y) => [x + 60, y + 35];
    const L = [], Rr = [];
    for (let i = 0; i <= 24; i++) {
      const v = i / 24, y = lerp(-10, len, v);
      let w = lerp(w0, w1, v);
      if (kind === 'upper') w *= 1 + 0.1 * Math.sin(v * Math.PI * 0.8);
      if (kind === 'lower') w *= 1 - 0.06 * Math.sin(v * Math.PI);
      L.push(o(-w / 2 - (kind === 'upper' ? 3 * Math.sin(v * Math.PI) : 0), y));
      Rr.push(o(w / 2, y));
    }
    const capB = circlePts(o(0, len)[0], o(0, len)[1], w1 / 2, 20, 0, Math.PI).slice(1, -1);
    const capT = circlePts(o(0, -10)[0], o(0, -10)[1], w0 / 2, 20, Math.PI, TAU).slice(1, -1);
    const sil = L.concat(capB.reverse(), Rr.slice().reverse(), capT.reverse());
    const cols = dark ? ['#8c2034', '#7a1a2e', '#9a2438', '#6a1628', '#a02a3c'] : ['#c82e3e', '#b12838', '#d8404a', '#a82436', '#e04a4e'];
    c.washPoly(sil, dark ? DC.legDark : DC.leg, 255);
    c.fillPoly(c.blob(...o(w0 * 0.2, len * 0.4), w0 * 0.4, len * 0.45), dark ? '#9a2a40' : '#e0504e', { opacity: 55, bleed: 0.1, texture: 0.8, border: 0.2 });
    const dir = (X, Y) => Math.PI / 2 + 0.08 * Math.sin(Y * 0.05);
    fieldStrokes(c, sil, dir, { n: 260, len: [14, 36], brush: 'land_comb', w: [0.3, 0.55], col: (X, Y, rr) => mixHex(pick(rr, cols), dark ? '#3a0816' : '#6a1426', clamp((o(0, 0)[0] - X) / (w0 * 0.5)) * 0.45) });
    // wrinkles (horizontal folds), heavier near the joints
    for (let i = 0; i < 9; i++) {
      const v = i < 4 ? r(0.02, 0.2) : r(0.7, 0.98);
      const y = len * v;
      c.strokePath([o(-w0 * 0.45, y), o(-w0 * 0.1, y + r(1, 3)), o(w0 * 0.25, y + r(-1, 2))], 'wire', dark ? '#3a0a18' : '#6a1426', r(0.6, 0.9), 0.5);
    }
    dabs(c, sil, { n: 160, len: [3, 5.5], w: [0.2, 0.32], dir: () => 0, col: (X, Y, rr) => (dark ? pick(rr, ['#a8304a', '#50101e']) : pick(rr, ['#f06060', '#8a1a2c'])) });
    clipTo(c, sil, [0, 0, 120, len + 80]);
    contour(c, L, { col: dark ? '#2a0612' : '#4a0c1c', w: 1.0, keep: 0.9, run: [6, 14], closed: false });
    contour(c, Rr, { col: dark ? '#3a0c18' : '#7a1a2c', w: 0.8, keep: 0.7, run: [6, 14], closed: false });
  });
  const footPart = (name, dark) => P.layer(name, { w: 120, h: 70, scale: 2.6 }, (c) => {
    const r = c.r;
    const o = (x, y) => [x + 60, y + 24];
    const ctrlF = [[-30, -8], [-10, -16], [14, -14], [34, -2], [42, D.footH - 2], [36, D.footH + 1], [-36, D.footH + 1], [-40, D.footH - 4], [-36, 6]];
    const sil = crSpline(ctrlF, 6, true).map((p) => o(p[0], p[1]));
    const cols = dark ? ['#8c2034', '#7a1a2e', '#9a2438'] : ['#c82e3e', '#b12838', '#d8404a'];
    c.washPoly(sil, dark ? DC.legDark : DC.leg, 255);
    fieldStrokes(c, sil, () => 0.1, { n: 70, len: [10, 22], brush: 'land_comb', w: [0.25, 0.45], col: (X, Y, rr) => pick(rr, cols) });
    for (let i = 0; i < 4; i++) c.strokePath([o(-34 + i * 3, 4 + i * 3), o(0, 2 + i * 3.5), o(30 - i * 2, 6 + i * 3)], 'wire', dark ? '#3a0a18' : '#6a1426', 0.6, 0.5);
    for (let i = 0; i < 3; i++) {
      const x = 12 + i * 10;
      const nb = circlePts(o(x, D.footH - 3)[0], o(x, D.footH - 3)[1], 5, 14, Math.PI, TAU).concat([o(x + 5, D.footH), o(x - 5, D.footH)]);
      c.washPoly(nb, dark ? '#b09070' : DC.nail, 255);
      c.strokePath(nb.slice(0, 15), 'wire', dark ? '#5a3a2a' : '#a07a50', 0.5, 0.5);
    }
    clipTo(c, sil.concat([sil[0]]), [0, 0, 120, 70]);
    contour(c, sil, { col: dark ? '#2a0612' : '#4a0c1c', w: 0.95, keep: 0.85, run: [6, 12] });
  });
  out.legU = [legPart('dinoLegU', D.legU, 84, 62, false, 'upper'), legPart('dinoLegUd', D.legU, 84, 62, true, 'upper')];
  out.legL = [legPart('dinoLegL', D.legL, 62, 56, false, 'lower'), legPart('dinoLegLd', D.legL, 62, 56, true, 'lower')];
  out.foot = [footPart('dinoFoot', false), footPart('dinoFootd', true)];
  out.legO = [60, 35];
  out.footO = [60, 24];

  // ============================================================ head (origin = neck joint; snout → +x)
  const HW = 200, HH = 130, HOX = 50, HOY = 72;
  const hctrl = [[-16, 27], [-27, 5], [-25, -21], [-9, -42], [15, -52], [41, -49], [62, -38], [88, -29], [113, -25], [129, -17], [135, -3], [131, 9], [113, 17], [80, 21], [48, 27], [18, 31], [0, 30]];
  const hsil0 = crSpline(hctrl, 10, true);
  const EX = D.eye[0], EY = D.eye[1], ER = D.eyeR;
  out.head = P.layer('dinoHead', { w: HW, h: HH, scale: 9 }, (c) => {
    const r = c.r;
    const o = (p) => [p[0] + HOX, p[1] + HOY];
    const sil = hsil0.map(o);
    const crownCtrl = [[-24, -22], [-9, -42], [15, -52], [41, -49], [62, -38], [88, -29], [113, -25], [127, -18], [112, -15], [86, -19], [60, -26], [40, -31], [16, -32], [-6, -27]];
    const crown = crSpline(crownCtrl, 8, true).map(o);
    const jawCtrl = [[-12, 21], [18, 16], [56, 13], [96, 10], [124, 6], [131, 9], [113, 17], [80, 21], [48, 27], [18, 31], [0, 30]];
    const jaw = crSpline(jawCtrl, 8, true).map(o);
    c.washPoly(sil, DC.head, 255);
    c.washPoly(crown, '#f4b650', 255);
    c.washPoly(jaw, DC.jaw, 255);
    c.fillPoly(c.blob(...o([-8, 2]), 30, 36, { wobble: 0.15 }), '#b8402a', { opacity: 70, bleed: 0.1, texture: 0.7, border: 0.1 });
    c.fillPoly(c.blob(...o([80, -6]), 40, 14, { wobble: 0.15 }), '#f7a24e', { opacity: 55, bleed: 0.12, texture: 0.7, border: 0.1 });
    // form strokes: along the skull (following the top profile), curving around the eye socket
    const topProf = (x) => { // slope of the head's top outline at x (head coords)
      const pts = [[-25, -21], [-9, -42], [15, -52], [41, -49], [62, -38], [88, -29], [113, -25], [129, -17], [135, -3]];
      for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) return Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
      return 0.4;
    };
    const dir = (X, Y) => {
      const x = X - HOX, y = Y - HOY;
      const along = topProf(x) * clamp(1 - (y + 40) / 70) + 0.05;
      const de = Math.hypot(x - EX, y - EY);
      const around = Math.atan2(y - EY, x - EX) + Math.PI / 2;
      return lerp(around, along, smoothstep(ER * 1.4, ER * 2.6, de));
    };
    const inCrown = (X, Y) => inPoly(crown, X, Y), inJaw = (X, Y) => inPoly(jaw, X, Y);
    const colAt = (X, Y, rr) => (inCrown(X, Y) ? pick(rr, ['#f8c860', '#f0a840', '#fcd88a', '#eea040']) : inJaw(X, Y) ? pick(rr, ['#fbe6b0', '#f4d090', '#fff0c8']) : mixHex(pick(rr, ORANGES), '#a83420', clamp((HOX - X + 10) / 40) * 0.5));
    fieldStrokes(c, sil, dir, { n: 700, len: [5, 13], brush: 'land_comb', w: [0.1, 0.2], col: colAt });
    fieldStrokes(c, sil, dir, { n: 260, len: [3, 7], brush: 'land_dry', w: [0.1, 0.18], col: colAt });
    // scales: fine dabs (skip the eye)
    const nearEye = (X, Y) => Math.hypot(X - o([EX, EY])[0], Y - o([EX, EY])[1]) < ER * 1.3;
    dabs(c, sil, { n: 1400, len: [1.2, 2.4], w: [0.07, 0.12], dir: () => 0, where: (X, Y) => !nearEye(X, Y), col: (X, Y, rr) => (inCrown(X, Y) ? pick(rr, ['#fff0c0', '#c8802a']) : inJaw(X, Y) ? pick(rr, ['#fffaf0', '#d0a060']) : pick(rr, ['#ffb878', '#a8381e', '#f89850'])) });
    // brow ridge
    const brow = crSpline([[EX - 16, EY - 9], [EX - 4, EY - 17.5], [EX + 12, EY - 16.5], [EX + 23, EY - 8.5], [EX + 10, EY - 12], [EX - 4, EY - 12.5]], 8, true).map(o);
    c.fillPoly(brow, '#a8381e', { opacity: 120, bleed: 0.03, texture: 0.6, border: 0.3 });
    fieldStrokes(c, brow, () => -0.2, { n: 40, len: [3, 7], brush: 'land_comb', w: [0.08, 0.14], col: (X, Y, rr) => pick(rr, ['#b8401e', '#8a2a14', '#c8502a']) });
    c.strokePath(crSpline([[EX - 15, EY - 11], [EX - 3, EY - 19], [EX + 12, EY - 18], [EX + 22, EY - 10]], 8, false).map(o), 'land_contour', '#ffe0a0', 0.55, 0.5);
    // mouth, lip wrinkles, nostril
    c.strokePath(crSpline([[131, 8], [118, 11], [96, 13], [74, 14], [58, 13], [52, 10]], 8, false).map(o), 'land_contour', '#5a1410', 0.8, 0.5);
    for (let i = 0; i < 4; i++) c.strokePath(crSpline([[50 - i * 3, 6 + i * 2], [47 - i * 3, 11 + i * 2], [50 - i * 3, 16 + i * 2]], 5, false).map(o), 'wire', '#8a3a20', 0.4, 0.5);
    const nos = c.blob(...o([117, -15]), 4.2, 2.6, { rot: -0.25, wobble: 0.08 });
    c.washPoly(nos, '#4a100c', 255);
    c.strokePath(crSpline([[112, -18], [118, -19.5], [123, -16]], 6, false).map(o), 'wire', '#ffd9a0', 0.5, 0.5);
    // throat wrinkles
    for (let i = 0; i < 6; i++) c.strokePath(crSpline([[-10 + i * 5, 24], [-6 + i * 5, 28], [-2 + i * 5, 30.5]], 5, false).map(o), 'wire', '#c08a50', 0.4, 0.5);
    // highlight on the crown (rim light)
    for (let i = 0; i < 16; i++) {
      const t = r(0.1, 0.9);
      const p = crownCtrl[Math.floor(t * 7)], q = crownCtrl[Math.floor(t * 7) + 1];
      c.strokePath([o([lerp(p[0], q[0], 0.2), lerp(p[1], q[1], 0.2) + 2]), o([lerp(p[0], q[0], 0.8), lerp(p[1], q[1], 0.8) + 2])], 'land_comb', pick(r, ['#fff4d6', '#fde4a8']), r(0.1, 0.16), 0.5);
    }
    clipTo(c, sil, [0, 0, HW, HH]);
    contour(c, sil, { col: '#5a1418', w: 0.75, keep: 0.9, run: [8, 20], lost: (X, Y) => Y < HOY - 44 && X > HOX + 5 && X < HOX + 50 });
  });
  out.headO = [HOX, HOY];

  // ============================================================ eye socket (high-res detail; eye radius ER2 in layer units)
  const ER2 = 100, SS = 2.3 * ER2;
  out.socket = P.layer('dinoSocket', { w: 2 * SS, h: 2 * SS, scale: 5 }, (c) => {
    const r = c.r;
    const cx = SS, cy = SS;
    // granular scales around the eye: size grows outward, jittered, thinning out toward the edge
    let rr = ER2 * 1.34;
    let ring = 0;
    while (rr < ER2 * 2.25) {
      const s0 = ER2 * (0.05 + 0.055 * (rr / ER2 - 1.34));
      const n = Math.floor((TAU * rr) / (s0 * 2.15));
      const keep = 1 - smoothstep(1.75, 2.25, rr / ER2);
      for (let i = 0; i < n; i++) {
        if (r() > keep * 0.95 + 0.05 * (ring < 2 ? 1 : 0)) continue;
        const a = ((i + (ring % 2) * 0.5 + r(-0.22, 0.22)) / n) * TAU;
        const rad = rr + r(-0.18, 0.18) * s0;
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.95;
        const s = s0 * r(0.72, 1.12);
        const top = Math.sin(a) < -0.25;
        const cell = c.blob(x, y, s, s * r(0.72, 0.9), { n: 16, wobble: 0.14, rot: a + r(-0.4, 0.4) });
        const base = top ? pick(r, ['#f3a84c', '#eea044', '#f6b458', '#e89640']) : pick(r, ['#ee8a42', '#e6783a', '#f29650', '#dc6e34']);
        c.washPoly(cell, base, 150 + 90 * keep);
        const arcD = [], arcL = [];
        for (let q = 0; q <= 8; q++) {
          const t2 = Math.PI * 0.05 + (q / 8) * Math.PI * 0.9, t1 = Math.PI * 1.1 + (q / 8) * Math.PI * 0.7;
          arcD.push([x + Math.cos(t2) * s * 0.9, y + Math.sin(t2) * s * 0.74]);
          arcL.push([x + Math.cos(t1) * s * 0.7, y + Math.sin(t1) * s * 0.58]);
        }
        c.strokePath(arcD, 'land_contour', top ? '#a8601e' : '#983c1a', (0.55 + 0.6 * keep) * s / 6, 0.5);
        if (r() < 0.45) c.strokePath(arcL, 'wire', '#ffe2b0', (0.4 + 0.4 * keep) * s / 6, 0.5);
      }
      rr += s0 * 1.9;
      ring++;
    }
    // upper lid + lower lid, painted with wrapping strokes
    const lidPoly = (a0, a1, rO) => {
      const pts = [];
      for (let i = 0; i <= 40; i++) { const a = lerp(a0, a1, i / 40); pts.push([cx + Math.cos(a) * ER2 * rO, cy + Math.sin(a) * ER2 * rO * 0.97]); }
      for (let i = 40; i >= 0; i--) { const a = lerp(a0, a1, i / 40); pts.push([cx + Math.cos(a) * ER2 * 1.0, cy + Math.sin(a) * ER2 * 1.0]); }
      return pts;
    };
    const U = lidPoly(Math.PI + 0.1, TAU - 0.1, 1.3), Lw = lidPoly(0.3, Math.PI - 0.3, 1.22);
    c.fillPoly(U, '#c9502a', { opacity: 170, bleed: 0.02, texture: 0.6, border: 0.4 });
    c.fillPoly(Lw, '#f4c078', { opacity: 180, bleed: 0.02, texture: 0.6, border: 0.4 });
    const around = (X, Y) => Math.atan2(Y - cy, X - cx) + Math.PI / 2;
    fieldStrokes(c, U, around, { trim: true, n: 160, len: [16, 44], brush: 'land_dry', w: [1.1, 1.8], col: (X, Y, rr) => pick(rr, ['#d05a2c', '#b8401e', '#e06a34']) });
    fieldStrokes(c, Lw, around, { trim: true, n: 120, len: [16, 40], brush: 'land_dry', w: [1.0, 1.7], col: (X, Y, rr) => pick(rr, ['#f8cc80', '#eab060', '#fbe0a8']) });
    // dark rim (slightly overlapping the iris edge) + fold lines + soft lid highlights
    const rim = circlePts(cx, cy, ER2 * 1.07, 140);
    c.strokePath(rim.concat([rim[0], rim[1]]), 'ink', '#2a1208', 6, 0.2);
    c.strokePath(circlePts(cx, cy, ER2 * 1.155, 140).concat([[cx + ER2 * 1.155, cy]]), 'land_contour', '#7a2a14', 1.8, 0.3);
    c.strokePath(ellipsePts(cx, cy - ER2 * 0.05, ER2 * 1.31, ER2 * 1.3, 0, 40, Math.PI + 0.22, TAU - 0.22), 'land_contour', '#6a2410', 3.2, 0.4);
    c.strokePath(ellipsePts(cx, cy - ER2 * 0.1, ER2 * 1.48, ER2 * 1.46, 0, 40, Math.PI + 0.5, TAU - 0.5), 'land_contour', '#8a3818', 2.2, 0.4);
    c.strokePath(ellipsePts(cx, cy - ER2 * 0.04, ER2 * 1.2, ER2 * 1.18, 0, 40, Math.PI + 0.6, TAU - 0.9), 'land_contour', '#ffd89a', 1.6, 0.4);
    c.strokePath(ellipsePts(cx, cy + ER2 * 0.02, ER2 * 1.17, ER2 * 1.15, 0, 40, 0.5, Math.PI - 0.5), 'land_contour', '#fff0c0', 1.5, 0.4);
  });
  out.socketMeta = { ER: ER2, SS };
  return out;
}
