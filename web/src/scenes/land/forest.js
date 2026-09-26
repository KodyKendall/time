// LAND — the Mesozoic fern forest: painted flats on depth planes. Everything is designed in
// final-frame coordinates of its plane (see cam.js).
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, ease, noise1, crSpline } from './util.js';
import { clipTo, fieldStrokes, dabs, contour } from './paintkit.js';
import { paintTrunk, paintFrond, paintCycad, paintHorsetails, paintRock, trunkPoly, rachisPts, leafShape } from './forestpaint.js';
import { defineLandBrushes } from './brushes.js';
import { atlas } from '../lib/kit.js';

// Ground: a ground point on plane d appears (at rest) at v = HOR + GH / d.
export const HOR = 598, GH = 304;
export const groundV = (d) => HOR + GH / d;
const pick = (r, a) => a[Math.floor(r() * a.length)];

export const FC = {
  skyTop: '#d9e2b8', skyMid: '#b7cea2', skyLow: '#9dbf9f',
  fern: ['#1f5a46', '#2f7058', '#78b07e'], fernDark: ['#0f3129', '#1b4a3c', '#4c8a66'],
  moss: ['#4f8a4a', '#6aa36b', '#3d7040', '#8ab86a'],
};
const TRUNK_NEAR = { dark: '#123f47', mid: '#1f5f66', lit: '#4f9a92', edge: '#9ad0bc' };
const TRUNK_MID = { dark: '#2c6a6a', mid: '#3f8680', lit: '#6fb0a0', edge: '#b6dcc8' };
const ROCK = { stone: '#5f7a72', stoneDark: '#3f5a55', stoneLit: '#8aa89a', edge: '#243a36', moss: ['#5f9a52', '#7ab064', '#4a8246', '#9cc47a'] };

// ------------------------------------------------------------------------------------------------
export function paintForest(P) {
  defineLandBrushes(P.brush);
  const A = {};

  // ================================================================ sky (d = 12): x -440..2360, y -420..1080
  A.sky = P.layer('landSky', { w: 2800, h: 1500, scale: 0.5 }, (c) => {
    const r = c.r;
    const o = (x, y) => [x + 440, y + 420];
    const bands = [[-420, '#cfdbb0'], [-150, '#c6d7ab'], [120, '#bcd1a4'], [380, '#b0caa0'], [620, '#a6c3a0'], [860, '#9cbc9e']];
    for (let i = 0; i < bands.length; i++) {
      const y0 = bands[i][0], y1 = i + 1 < bands.length ? bands[i + 1][0] + 40 : 1080;
      c.washPoly([o(-440, y0 - 40), o(2360, y0 - 40), o(2360, y1), o(-440, y1)], bands[i][1], 255);
    }
    // warm sun zone upper right
    c.fillPoly(c.blob(...o(1480, 80), 620, 360, { wobble: 0.15 }), '#efe9c0', { opacity: 110, bleed: 0.25, texture: 0.6, border: 0.02 });
    c.fillPoly(c.blob(...o(1500, 60), 300, 190, { wobble: 0.15 }), '#f8f2d4', { opacity: 110, bleed: 0.25, texture: 0.5, border: 0.02 });
    // brushwork: strokes close in value to the local sky colour (warm near the sun, cool low)
    const skyCol = (y) => {
      for (let k = 1; k < bands.length; k++) if (y < bands[k][0]) return mixHex(bands[k - 1][1], bands[k][1], (y - bands[k - 1][0]) / (bands[k][0] - bands[k - 1][0]));
      return bands[bands.length - 1][1];
    };
    for (let i = 0; i < 900; i++) {
      const x = r(-440, 2300), y = r(-420, 1060), l = r(50, 170);
      const warm = clamp(1 - Math.hypot(x - 1480, (y - 80) * 1.6) / 900);
      let col = skyCol(y);
      col = mixHex(col, warm > 0.25 ? '#fbf4d8' : r() < 0.5 ? '#e4ecc8' : '#8fb49a', warm > 0.25 ? warm * 0.6 : r(0.08, 0.22));
      const a0 = r(-0.08, 0.08);
      c.strokePath([o(x, y), o(x + l * 0.5, y + l * 0.5 * a0 + r(-3, 3)), o(x + l, y + l * a0 + r(-4, 4))], i % 5 ? 'land_glaze' : 'land_dry', col, r(0.6, 1.2), 0.5);
    }
    // cloud wisps
    for (let i = 0; i < 26; i++) {
      const x = r(-300, 2200), y = r(-380, 260);
      for (let k = 0; k < 5; k++) c.strokePath([o(x + k * 20, y + k * 3), o(x + 120 + k * 16, y - 10 + k * 4), o(x + 260, y + k * 5)], 'land_glaze', pick(r, ['#eef0d8', '#f6f4e0', '#dfe6c6']), r(0.8, 1.3), 0.6);
    }
  });

  // ================================================================ distant volcanoes (d = 7): x -340..2260, y 150..900
  A.volcano = P.layer('landVolcano', { w: 2600, h: 750, scale: 0.5 }, (c) => {
    const r = c.r;
    const o = (x, y) => [x + 340, y - 150];
    const hor = 648;
    const cone = (cx, h, w, col, colD, smoke) => {
      const poly = crSpline([[cx - w, hor + 20], [cx - w * 0.55, hor - h * 0.45], [cx - w * 0.14, hor - h * 0.97], [cx - w * 0.06, hor - h], [cx + w * 0.07, hor - h * 0.99], [cx + w * 0.16, hor - h * 0.94], [cx + w * 0.6, hor - h * 0.4], [cx + w, hor + 20]], 8, false).concat([[cx + w, hor + 60], [cx - w, hor + 60]]).map((p) => o(p[0], p[1]));
      c.washPoly(poly, col, 255);
      fieldStrokes(c, poly, (x, y) => (x < o(cx, 0)[0] ? 1.9 : 1.25), { trim: true, n: Math.round(w * h / 260), len: [30, 80], brush: 'land_comb', w: [0.5, 0.9], col: (x, y, rr) => (x < o(cx, 0)[0] ? pick(rr, [colD, col]) : pick(rr, [col, mixHex(col, '#fff6e6', 0.25)])) });
      contour(c, poly.slice(0, 57), { col: colD, w: 0.8, keep: 0.5, run: [4, 10], closed: false });
      if (smoke) {
        // rising plume: swirling strokes drifting right
        for (let k = 0; k < 90; k++) {
          const t = r(0, 1);
          const px = cx + t * t * 320 + r(-30, 30) * (0.3 + t), py = hor - h - t * 340 + r(-20, 20);
          const rr = 16 + t * 60;
          const a0 = r(0, TAU);
          const arc = [];
          for (let q = 0; q <= 6; q++) { const a = a0 + q * 0.5; arc.push(o(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.6)); }
          c.strokePath(arc, 'land_glaze', pick(r, ['#c8c6c8', '#b8b4bc', '#d8d6d0', '#a8a6b0']), r(0.7, 1.2), 0.6);
        }
      }
    };
    cone(250, 250, 520, '#9fb2b4', '#8ea2a8', false);
    cone(820, 330, 480, '#a7aeb8', '#929aac', true);
    cone(1500, 210, 420, '#a4b6b4', '#94a8a8', false);
    cone(2050, 280, 460, '#a9b2b8', '#98a0ac', true);
    // misty forest line along the horizon
    for (let i = 0; i < 260; i++) {
      const x = r(-340, 2260), h = r(20, 70);
      c.strokePath([o(x, hor + 30), o(x + r(-4, 4), hor + 30 - h)], 'land_comb', pick(r, ['#9ebca8', '#a8c4ac', '#94b4a2']), r(0.5, 1.1), 0.5);
    }
    c.washPoly([o(-340, hor + 18), o(2260, hor + 18), o(2260, 900), o(-340, 900)], '#a2c0a6', 255);
  });

  // ================================================================ far rows (misty flats) x -700..2600, y -650..(yb+150)
  const farRow = (name, n, cols, wr, yb, seed, extra) => P.layer(name, { w: 3300, h: yb + 800, scale: 0.55 }, (c) => {
    const r = c.r;
    const o = (x, y) => [x + 700, y + 650];
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(-650 + (i + r(0.1, 0.9)) * (3250 / n));
    // crowns behind (araucaria tufts / tree-fern rosettes)
    for (const x of xs) {
      const kind = r() < 0.55 ? 'arau' : 'fern';
      const topY = r(-560, -180);
      if (kind === 'arau') {
        for (let k = 0; k < 7; k++) {
          const yy = topY + k * r(40, 60), ww = r(40, 110);
          c.strokePath([o(x - ww, yy + 12), o(x, yy - 8), o(x + ww, yy + 12)], 'land_comb', pick(r, cols.crown), r(1.2, 2.2), 0.5);
        }
      } else {
        for (let k = 0; k < 9; k++) {
          const a = -Math.PI / 2 + (k / 8 - 0.5) * 3.0;
          const L = r(120, 190);
          const pts = [];
          for (let q = 0; q <= 8; q++) { const t = q / 8; pts.push(o(x + Math.cos(a) * L * t, topY + Math.sin(a) * L * t + 60 * t * t)); }
          c.strokePath(pts, 'land_comb', pick(r, cols.crown), r(1.3, 2.0), 0.5);
        }
      }
      // trunk
      const w = r(wr[0], wr[1]);
      const tp = trunkPoly(x, yb + 6, yb - topY + 10, w, w * 0.75, r(-0.06, 0.06), r(-8, 8), 0.3);
      c.washPoly(tp.poly.map((p) => o(p[0], p[1])), cols.trunk, 255);
      fieldStrokes(c, tp.poly.map((p) => o(p[0], p[1])), () => -Math.PI / 2, { trim: true, n: Math.round((yb - topY) * w / 260), len: [30, 80], brush: 'land_comb', w: [0.35, 0.6], col: (x2, y2, rr) => pick(rr, cols.trunkS) });
    }
    if (extra) extra(c, o, r);
    // ground strip + mist glazes
    const g = [];
    for (let i = 0; i <= 60; i++) { const x = -700 + i * 55; g.push(o(x, yb - 4 + 5 * Math.sin(x * 0.006 + seed))); }
    g.push(o(2600, yb + 150), o(-700, yb + 150));
    c.washPoly(g, cols.ground, 255);
    for (let i = 0; i < 160; i++) {
      const x = r(-700, 2600), y = yb + r(0, 40);
      c.strokePath([o(x, y), o(x + r(40, 120), y + r(-3, 3))], 'land_comb', pick(r, cols.trunkS), r(0.4, 0.8), 0.5);
    }
    for (let i = 0; i < 18; i++) c.fillPoly(c.blob(...o(r(-600, 2500), yb - r(0, 260)), r(180, 380), r(40, 90), { wobble: 0.2 }), cols.mist, { opacity: 40, bleed: 0.2, texture: 0.7, border: 0.05 });
  });
  A.far2 = farRow('landFar2', 22, { crown: ['#98b6a0', '#a3bfa6', '#8fae9c'], trunk: '#a0bea6', trunkS: ['#a8c4aa', '#9ab8a2', '#b0caae'], ground: '#a6c2a4', mist: '#c8dab8' }, [16, 30], groundV(4.5), 1);
  A.far1 = farRow('landFar1', 15, { crown: ['#5f9a88', '#6ea694', '#528c7e', '#7cb09a'], trunk: '#6f9e90', trunkS: ['#79a898', '#658f84', '#86b2a0'], ground: '#88ae8e', mist: '#b8d0ac' }, [28, 52], groundV(2.8), 2, (c, o, r) => {
    // cycads and horsetail clumps along this row's ground
    for (let i = 0; i < 7; i++) {
      const x = -500 + i * 420 + r(-80, 80);
      const pts = [];
      paintCycad(c, ...o(x, groundV(2.8) + 4), r(0.45, 0.6), { leaf: '#5a9480', leafB: '#4a8474', lit: '#9ac4a8', trunk: '#7a8a6a', trunkLit: '#a8b890' });
    }
    for (let i = 0; i < 6; i++) paintHorsetails(c, ...o(-400 + i * 520 + r(-60, 60), groundV(2.8) + 6), r(0.45, 0.6), { stem: '#6a9a7e', stemLit: '#8ab494', node: '#4a7462', needle: '#7aa88a', cone: '#9a8a5a' }, 6);
  });

  // ================================================================ trunks (sprites). local frame: base at (bx, by)
  const trunk = (name, w, h, cols, spec, scale) => {
    const W = Math.round(w * 2.4 + 160), H = h + 90;
    const bx = W / 2, by = H - 50;
    const L = P.layer(name, { w: W, h: H, scale }, (c) => { paintTrunk(c, bx, by, h, w, { cols, ...spec }); });
    return { L, W, H, bx, by, w, h };
  };
  A.trunks = {
    near: [trunk('landTrunkN0', 176, 1520, TRUNK_NEAR, { kind: 'fern', moss: 1.2, vines: 3 }, 0.85),
      trunk('landTrunkN1', 150, 1480, TRUNK_NEAR, { kind: 'conifer', moss: 0.9, vines: 2 }, 0.85)],
    mid: [trunk('landTrunkM0', 112, 1320, TRUNK_MID, { kind: 'conifer', moss: 0.6, vines: 1 }, 0.7),
      trunk('landTrunkM1', 96, 1280, TRUNK_MID, { kind: 'fern', moss: 0.5, vines: 2 }, 0.7)],
  };

  // ================================================================ canopy: arching fronds hanging from above
  const canopy = (name, cols, count, y0, len, seed, spots, gap = [1330, 1790]) => P.layer(name, { w: 3000, h: 900, scale: 0.62 }, (c) => {
    const r = c.r;
    const o = (x, y) => [x + 540, y + 520];
    // dense foliage masses along the top edge (leaf dabs), leaving the meteor gap open
    for (let i = 0; i < 1400; i++) {
      const x = r(-500, 2420);
      if (x > gap[0] - 40 && x < gap[1] + 40) continue;
      const y = y0 - 120 + Math.pow(r(), 1.6) * 190 + 30 * Math.sin(x * 0.004 + seed);
      const a = Math.PI / 2 + r(-1.0, 1.0);
      leafShape(c, o(x, y), a, r(28, 54), r(5, 9), pick(r, [cols[0], cols[1], cols[0]]), r() < 0.3 ? cols[2] : null);
    }
    for (let i = 0; i < count; i++) {
      const hx = -420 + (i + r(0.2, 0.8)) * (2800 / count);
      if (hx > gap[0] - 20 && hx < gap[1] + 20) continue;
      const hy = y0 + r(-40, 30);
      const nf = r.int(5, 7);
      for (let k = 0; k < nf; k++) {
        const side = k % 2 ? 1 : -1;
        const a0 = -Math.PI / 2 + side * r(0.6, 1.3);
        const L = r(len[0], len[1]), lw = r(95, 135), curl = side * r(2.4, 3.2);
        // keep the sky gap (upper right) open: skip fronds whose arch would cross it
        const rc = rachisPts([hx, hy], a0, L, curl);
        if (rc.pts.some(([x, y]) => x > gap[0] - 90 && x < gap[1] + 90 && y > -140)) continue;
        const pr = paintFrond(c, o(hx, hy), a0, L, lw, curl, cols, { density: 1.1, litArc: r(1.4, 2.2), weight: 1.25, rachisW: 1.6 });
        for (let q = 6; q < pr.pts.length; q += 7) spots.push([pr.pts[q][0], pr.pts[q][1]]);
      }
      // hanging vines from the crown
      for (let v = 0; v < 3; v++) {
        const x0 = hx + r(-140, 140), yv = hy + r(60, 140), L = r(160, 420);
        if (x0 > gap[0] - 30 && x0 < gap[1] + 30) continue;
        const pts = [];
        for (let q = 0; q <= 14; q++) { const t = q / 14; pts.push(o(x0 + 18 * Math.sin(t * 2.5 + v), yv + L * t)); }
        c.strokePath(pts, 'land_contour', cols[0], 0.9, 0.6);
        for (let q = 2; q < 14; q++) {
          const p = pts[q], side = q % 2 ? 1 : -1;
          leafShape(c, p, Math.PI / 2 - side * r(0.5, 1.1), r(16, 26), r(4, 6), pick(r, [cols[0], cols[1]]), cols[2]);
        }
      }
    }
  });
  A.canopyBackSpots = [];
  A.canopyBack = canopy('landCanopyB', ['#3c7a74', '#4a8a80', '#bccda6'], 8, -150, [380, 540], 7, A.canopyBackSpots);
  A.canopySpots = [];
  A.canopy = canopy('landCanopy', ['#0f4450', '#185a5e', '#e6d69c'], 7, -170, [480, 680], 8, A.canopySpots);

  // ================================================================ ground bands with dressing
  const band = (name, d, cols, dress, scale, depthBelow = 300) => {
    const v0 = groundV(d);
    const top = v0 - 330, H = 330 + depthBelow;
    const L = P.layer(name, { w: 3600, h: H, scale }, (c) => {
      const r = c.r;
      const o = (x, y) => [x + 800, y - top];
      const edge = [];
      for (let i = 0; i <= 90; i++) {
        const x = -800 + i * 40;
        edge.push(o(x, v0 + cols.wav * Math.sin(x * 0.004 + d * 3) + cols.wav * 0.6 * Math.sin(x * 0.011 + d)));
      }
      const poly = edge.concat([o(2800, v0 + depthBelow), o(-800, v0 + depthBelow)]);
      c.washPoly(poly, cols.base, 255);
      c.fillPoly(poly, cols.glaze, { opacity: 50, bleed: 0.04, texture: 0.8, border: 0.25 });
      // horizontal ground strokes
      fieldStrokes(c, poly, (x, y) => 0.04 * Math.sin(x * 0.01), { n: Math.round(3600 * depthBelow / 900), len: [40, 120], brush: 'land_comb', w: [0.5, 0.9], col: (x, y, rr) => pick(rr, cols.strokes) });
      fieldStrokes(c, poly, () => 0, { n: Math.round(3600 * depthBelow / 3000), len: [12, 30], brush: 'land_dry', w: [0.4, 0.7], col: (x, y, rr) => pick(rr, cols.strokes) });
      clipTo(c, poly, [0, 0, 3600, H]);
      // grass tufts along the edge
      for (let i = 0; i < cols.tufts; i++) {
        const x = r(-790, 2790);
        const j = clamp(Math.round(((x + 800) / 3600) * 90), 0, 90);
        const yb = edge[j][1] + r(2, 10);
        const h = r(8, 30) * cols.tuftS;
        const nb = r.int(3, 9);
        for (let k = 0; k < nb; k++) {
          const xx = o(x, 0)[0] + r(-10, 10) * cols.tuftS;
          const lean = r(-0.5, 0.5);
          c.strokePath([[xx, yb], [xx + lean * h * 0.4, yb - h * 0.55], [xx + lean * h, yb - h * r(0.7, 1.1)]], 'land_leaf', pick(r, cols.grass), r(0.35, 0.8) * cols.tuftS, 0.5);
        }
      }
      if (dress) dress(c, o, r, edge, v0);
    });
    return { d, L, top };
  };
  A.bands = [
    band('landBand1', 2.0, { base: '#5f9676', glaze: '#6aa07e', wav: 10, tufts: 90, tuftS: 0.8, strokes: ['#66a07c', '#5a8e6e', '#70a884', '#548a6a'], grass: ['#7ab086', '#5f9a72', '#9cc494'] }, (c, o, r) => {
      for (let i = 0; i < 5; i++) paintHorsetails(c, ...o(-500 + i * 700 + r(-100, 100), groundV(2.0) + 8), r(0.6, 0.75), { stem: '#4f8a66', stemLit: '#7ab086', node: '#2f5a44', needle: '#5f9a72', cone: '#8a7a4a' }, 7);
      for (let i = 0; i < 4; i++) paintCycad(c, ...o(-200 + i * 760 + r(-80, 80), groundV(2.0) + 6), r(0.6, 0.75), { leaf: '#3f7a5a', leafB: '#2f6a4e', lit: '#8ab88e', trunk: '#6a6a4a', trunkLit: '#a8a078' });
    }, 0.55, 260),
    band('landBand2', 1.3, { base: '#6db4a8', glaze: '#86c6ba', wav: 7, tufts: 40, tuftS: 1, strokes: ['#8ccabc', '#a8dccc', '#6aaea2', '#c4ebdc', '#7fbfb2'], grass: ['#5f9a72', '#4a8660'] }, (c, o, r, edge, v0) => {
      // ripples and sky reflections
      for (let i = 0; i < 70; i++) {
        const x = r(-800, 2800), y = v0 + r(8, 60), l = r(40, 140);
        c.strokePath([o(x, y), o(x + l * 0.5, y + r(-1.5, 1.5)), o(x + l, y + r(-1.5, 1.5))], 'land_glaze', pick(r, ['#d6f0e6', '#b8e2d6']), r(0.4, 0.6), 0.5);
      }
      for (let i = 0; i < 50; i++) {
        const x = r(-800, 2800), y = v0 + r(8, 60), l = r(20, 60);
        c.strokePath([o(x, y), o(x + l, y + r(-1, 1))], 'wire', pick(r, ['#eaf8f0', '#5f9e94']), r(0.4, 0.7), 0.5);
      }
      // stones in the stream
      for (let i = 0; i < 16; i++) paintRock(c, ...o(r(-700, 2700), v0 + r(20, 60)), r(14, 30), r(8, 16), ROCK);
      for (let i = 0; i < 4; i++) paintHorsetails(c, ...o(-300 + i * 850 + r(-100, 100), v0 + 4), r(0.75, 0.9), { stem: '#3f7a5a', stemLit: '#6aa07e', node: '#244a36', needle: '#4f8a66', cone: '#7a6a3a' }, 8);
    }, 0.6, 240),
    band('landBand3', 1.05, { base: '#2f6b55', glaze: '#3a7a5e', wav: 14, tufts: 140, tuftS: 1.1, strokes: ['#36745a', '#2c6650', '#3e7e60', '#2a604c', '#447f62'], grass: ['#5a9a6e', '#3f7a5a', '#7ab07a'] }, (c, o, r, edge, v0) => {
      // pebbles + fallen leaves + moss patches
      for (let i = 0; i < 220; i++) {
        const x = r(-790, 2790), y = v0 + r(10, 200);
        c.strokePath([o(x, y), o(x + r(3, 8), y + r(-1, 1))], 'land_dry', pick(r, ['#8aa27a', '#c4a45a', '#6a5a3a', '#9ab884', '#b8884a']), r(0.35, 0.6), 0.3);
      }
      for (let i = 0; i < 5; i++) paintRock(c, ...o(-600 + i * 800 + r(-100, 100), v0 + r(30, 90)), r(40, 70), r(22, 36), ROCK);
    }, 0.75, 260),
    band('landBand4', 0.8, { base: '#245a4a', glaze: '#2d6b52', wav: 16, tufts: 120, tuftS: 1.3, strokes: ['#2a644e', '#225444', '#31705a', '#1e4e40'], grass: ['#4a8a62', '#2f6b4c', '#6aa06e'] }, (c, o, r, edge, v0) => {
      paintRock(c, ...o(170, v0 + 30), 110, 60, ROCK);
      paintRock(c, ...o(1760, v0 + 44), 90, 48, ROCK);
    }, 0.8, 240),
    band('landBand5', 0.62, { base: '#18402f', glaze: '#214d3c', wav: 20, tufts: 90, tuftS: 1.6, strokes: ['#214d3c', '#14362a', '#2a5a44', '#10302a'], grass: ['#3a7050', '#24503a', '#4f8a5e'] }, null, 0.85, 320),
  ];

  // ================================================================ fern frond atlas (horizontal; base at (16, cell/2+30))
  const FW = 560;
  A.fronds = atlas(P, 'landFronds', 6, FW, (c, cx, cy, i) => {
    const r = c.r;
    const cols = i < 3 ? FC.fern : FC.fernDark;
    paintFrond(c, [cx - FW / 2 + 16, cy + 30], -0.3 + r(-0.08, 0.08), FW * r(0.82, 0.9), r(78, 100), 0.8 + r(-0.15, 0.2), cols, { density: 1.2, weight: 1.35, rachisW: 1.4 });
  }, { cols: 3, scale: 1.0 });
  A.frondCell = FW;
  // cycad sprites (for the near planes)
  A.cycads = atlas(P, 'landCycads', 2, 520, (c, cx, cy, i) => {
    paintCycad(c, cx, cy + 200, 1.15, i ? { leaf: '#2f6a4e', leafB: '#1f5040', lit: '#7ab07e', trunk: '#5a5a3a', trunkLit: '#9a9068' } : { leaf: '#24503e', leafB: '#173a2e', lit: '#5f9a6a', trunk: '#4a4a30', trunkLit: '#8a8058' });
  }, { cols: 2, scale: 1.0 });
  return A;
}

// ------------------------------------------------------------------------------------------------
// layout (final-frame coordinates on each plane)
// ------------------------------------------------------------------------------------------------
export const TREES = [
  { d: 1.75, kind: 'mid', v: 0, x: 120, s: 0.95, flip: 1 },
  { d: 1.72, kind: 'mid', v: 1, x: 470, s: 0.85, flip: -1 },
  { d: 1.78, kind: 'mid', v: 0, x: 1210, s: 0.9, flip: 1 },
  { d: 1.75, kind: 'mid', v: 1, x: 1540, s: 0.9, flip: 1 },
  { d: 1.75, kind: 'mid', v: 0, x: 2200, s: 1.0, flip: -1 },
  { d: 1.18, kind: 'near', v: 0, x: 40, s: 1.0, flip: 1 },
  { d: 1.22, kind: 'near', v: 1, x: 1880, s: 0.95, flip: -1 },
  { d: 1.15, kind: 'near', v: 0, x: 2300, s: 1.05, flip: -1 },
  { d: 1.2, kind: 'near', v: 1, x: -420, s: 1.0, flip: 1 },
];

function makePlants() {
  const r = rng('land-plants');
  const plants = [];
  const add = (d, x, n, size, dark, spread = 1) => {
    const fr = [];
    for (let k = 0; k < n; k++) {
      const side = k % 2 ? 1 : -1;
      const a = -Math.PI / 2 + side * (0.2 + (k / n) * 1.05 * spread) + r(-0.12, 0.12);
      fr.push({ a, s: size * r(0.75, 1.05), i: (dark ? 3 : 0) + r.int(0, 2), flip: side, ph: r(0, TAU), f: r(0.7, 1.3) });
    }
    plants.push({ d, x, y: groundV(d) + 4, fr, dark, ph: r(0, TAU) });
  };
  add(1.7, 280, 5, 0.42, 0);
  add(1.7, 1000, 6, 0.4, 0);
  add(1.75, 1860, 5, 0.45, 0);
  add(1.3, 420, 5, 0.5, 0);
  add(1.3, 1480, 6, 0.55, 0);
  add(1.28, 2150, 5, 0.5, 0);
  add(1.1, -80, 6, 0.7, 0);
  add(1.12, 1760, 6, 0.62, 0);
  // near plane: at the sides only (keep the dinosaur's legs clear)
  add(0.86, 260, 6, 0.62, 1);
  add(0.84, 1930, 6, 0.75, 1);
  // foreground corners (big, dark)
  add(0.64, -40, 8, 1.35, 1, 1.1);
  add(0.62, 2010, 8, 1.45, 1, 1.1);
  return plants;
}
export const PLANTS = makePlants();
export const CYCADS = [
  { d: 0.9, x: -10, i: 0, s: 0.95 },
  { d: 0.88, x: 1880, i: 1, s: 0.9, flip: -1 },
  { d: 1.25, x: 1880, i: 1, s: 0.7 },
];
