// SEA — microscopic life: organelles inside the cells (inherited across divisions, growing in), and
// microbes drifting through the medium (diatoms, ciliates, bacteria, radiolaria). Sprites painted once.
import { C } from '../lib/palette.js';
import { atlas } from '../lib/kit.js';
import { M, TAU, lerp, clamp, invLerp, ease, rng, seg, mixHex } from './lib.js';
import { LAYOUT, DIV, R0, cellState } from './cells.js';

// ---------------------------------------------------------------- sprites
export function paintMicro(P) {
  const org = atlas(P, 'organelles', 8, 120, (c, cx, cy, i) => {
    const r = c.r;
    if (i < 3) {
      // mitochondrion: capsule + inner membrane squiggle
      const w = 44, h = 18;
      const cap = [];
      for (let k = 0; k <= 16; k++) { const a = -Math.PI / 2 + (k / 16) * Math.PI; cap.push([cx + w - h + Math.cos(a) * h, cy + Math.sin(a) * h]); }
      for (let k = 0; k <= 16; k++) { const a = Math.PI / 2 + (k / 16) * Math.PI; cap.push([cx - w + h + Math.cos(a) * h, cy + Math.sin(a) * h]); }
      const col = [C.rust, '#c24a30', C.plum][i];
      c.washPoly(cap, col, 250);
      c.fillPoly(cap, mixHex(col, '#f7a868', 0.3), { opacity: 90, bleed: 0.02, texture: 0.8, border: 0.4 });
      const sq = [];
      for (let k = 0; k <= 14; k++) sq.push([cx - w + h * 0.8 + (k / 14) * (2 * w - 1.6 * h), cy + 9 * Math.sin(k * 1.9) * (k % 2 ? 1 : -1) * 0.6]);
      c.strokePath(sq, 'ink', '#f6d58e', 0.9, 0.6);
      c.strokePath(cap.concat([cap[0]]), 'ink', '#4a1420', 0.8, 0.3);
    } else if (i < 5) {
      // vesicle: ring with a glint
      const rr = 20 + (i - 3) * 8;
      const d = c.blob(cx, cy, rr, rr, { n: 24, wobble: 0.04 });
      c.washPoly(d, i === 3 ? C.gold : '#f3c8a0', 235);
      c.fillPoly(c.blob(cx, cy, rr * 0.7, rr * 0.7, { n: 20, wobble: 0.05 }), i === 3 ? '#f59b3d' : '#e8a080', { opacity: 110, bleed: 0.02, texture: 0.6, border: 0.4 });
      c.strokePath(d.concat([d[0]]), 'ink', '#7a3a1a', 0.8, 0.3);
      c.strokePath([[cx - rr * 0.5, cy - rr * 0.35], [cx - rr * 0.1, cy - rr * 0.6]], 'ink', '#fff4d8', 1.0, 0.5);
    } else if (i === 5) {
      // endoplasmic reticulum: nested wavy membranes
      for (let k = 0; k < 4; k++) {
        const pts = [];
        for (let j = 0; j <= 12; j++) pts.push([cx - 48 + j * 8, cy - 18 + k * 12 + 5 * Math.sin(j * 1.2 + k)]);
        c.strokePath(pts, 'ink', k % 2 ? C.lavender : '#d9a0c0', 1.4, 0.6);
      }
    } else if (i === 6) {
      // golgi: stacked curved cisternae
      for (let k = 0; k < 4; k++) {
        const pts = [];
        for (let j = 0; j <= 10; j++) { const a = Math.PI * 1.15 + (j / 10) * Math.PI * 0.7; pts.push([cx + Math.cos(a) * (46 - k * 9), cy + 30 + Math.sin(a) * (40 - k * 8)]); }
        const band = pts.concat(pts.slice().reverse().map(([x, y]) => [x + 2, y + 6]));
        c.washPoly(band, [C.rose, C.gold, '#f3a0b0', C.amber][k], 240);
      }
    } else {
      // lipid droplet
      const d = c.blob(cx, cy, 22, 22, { n: 24, wobble: 0.03 });
      c.washPoly(d, '#f6d58e', 245);
      c.fillPoly(c.blob(cx + 5, cy + 5, 15, 15, { n: 20 }), C.gold, { opacity: 120, bleed: 0.02, texture: 0.5, border: 0.4 });
      c.strokePath([[cx - 11, cy - 6], [cx - 4, cy - 13]], 'ink', '#fffaf0', 1.3, 0.5);
    }
    void r;
  }, { cols: 4, scale: 2 });
  const mic = atlas(P, 'microbes', 8, 160, (c, cx, cy, i) => {
    const r = c.r;
    if (i < 2) {
      // pennate diatom: glassy boat with ribs
      const w = 62, h = 16;
      const boat = [];
      for (let k = 0; k <= 24; k++) { const a = (k / 24) * TAU; boat.push([cx + Math.cos(a) * w, cy + Math.sin(a) * h * (0.6 + 0.4 * Math.abs(Math.cos(a)))]); }
      c.washPoly(boat, i ? '#c9b070' : '#a8bf96', 235);
      for (let k = -6; k <= 6; k++) c.strokePath([[cx + k * 8, cy - h * 0.8], [cx + k * 8.4, cy + h * 0.8]], 'wire', '#5a6a3a', 0.8, 0.3);
      c.strokePath(boat, 'ink', '#3a4a2a', 0.9, 0.3);
    } else if (i < 4) {
      // centric diatom / radiolarian: disc with radial spines
      const rr = 30;
      const d = c.blob(cx, cy, rr, rr, { n: 30, wobble: 0.02 });
      c.washPoly(d, i === 2 ? '#bfe0d0' : '#f3e6c8', 220);
      for (let k = 0; k < (i === 2 ? 14 : 18); k++) {
        const a = (k / (i === 2 ? 14 : 18)) * TAU;
        const r0 = i === 2 ? 0.2 : 0.9, r1 = i === 2 ? 0.95 : 1.7;
        c.strokePath([[cx + Math.cos(a) * rr * r0, cy + Math.sin(a) * rr * r0], [cx + Math.cos(a) * rr * r1, cy + Math.sin(a) * rr * r1]], 'wire', i === 2 ? '#3a6a5a' : '#c9a070', 0.9, 0.3);
      }
      c.strokePath(d.concat([d[0]]), 'ink', '#2a4a4a', 0.8, 0.3);
    } else if (i < 6) {
      // ciliate: oval with a fringe of cilia
      const w = 44, h = 26;
      const body = c.blob(cx, cy, w, h, { n: 30, wobble: 0.06 });
      c.washPoly(body, i === 4 ? '#e9a0b0' : '#b3a9c4', 230);
      c.fillPoly(c.blob(cx - 6, cy, w * 0.5, h * 0.5, { n: 20 }), i === 4 ? C.rose : C.violet, { opacity: 90, bleed: 0.03, texture: 0.6, border: 0.3 });
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * TAU, x = cx + Math.cos(a) * w, y = cy + Math.sin(a) * h;
        c.strokePath([[x, y], [x + Math.cos(a) * 9, y + Math.sin(a) * 9]], 'wire', '#f3e6c8', 0.6, 0.3);
      }
    } else if (i === 6) {
      // bacteria cluster (rods)
      for (let k = 0; k < 5; k++) {
        const a = r(0, TAU), x = cx + r(-30, 30), y = cy + r(-24, 24);
        c.strokePath([[x - Math.cos(a) * 14, y - Math.sin(a) * 14], [x + Math.cos(a) * 14, y + Math.sin(a) * 14]], 'sea_dab', r.pick(['#7a8a3a', '#a8bf96', '#c9b070']), 0.9, 0.5);
      }
    } else {
      // flagellate: teardrop with a whip
      const body = [];
      for (let k = 0; k <= 20; k++) { const a = (k / 20) * TAU; const rr = 22 * (1 - 0.45 * Math.cos(a)); body.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7]); }
      c.washPoly(body, '#7fd8cf', 225);
      const wh = [];
      for (let k = 0; k <= 12; k++) wh.push([cx - 30 - k * 5, cy + 7 * Math.sin(k * 0.9)]);
      c.strokePath(wh, 'wire', '#bff0e6', 0.8, 0.6);
      c.strokePath(body, 'ink', '#1f6a6a', 0.8, 0.3);
    }
  }, { cols: 4, scale: 1.5 });
  // caustic light net (drawn additively, shimmering through a noise warp)
  const caustic = P.layer('caustic', { w: 2200, h: 1500, scale: 0.5 }, (c) => {
    const r = c.r;
    const sp = 120;
    for (let gy = -1; gy < 1500 / sp + 1; gy++) for (let gx = -1; gx < 2200 / sp + 1; gx++) {
      const cx = gx * sp + r(-35, 35), cy = gy * sp + r(-35, 35);
      const rad = r(48, 78), pts = [];
      const ph = r(0, TAU);
      for (let k = 0; k <= 14; k++) {
        const a = (k / 14) * TAU;
        const rr = rad * (1 + 0.22 * Math.sin(a * 3 + ph) + 0.1 * Math.sin(a * 5 + ph * 2));
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8]);
      }
      c.strokePath(pts, 'sea_dab', r.pick(['#e8fff8', '#bff0e6', '#fff4d8']), r(0.9, 1.6), 0.7);
      if (r() < 0.5) c.strokePath(pts.slice(0, 8), 'wire', '#ffffff', r(2, 3.5), 0.7);
    }
  });
  return { org, mic, caustic };
}
// Draw the caustic net (world-fixed tiles along the journey), additive light.
export function drawCaustics(R, A, t, alpha, tiles) {
  if (alpha <= 0.002) return;
  const z = R.scale();
  for (const [x, y, s] of tiles) {
    const m = M.place(x + 18 * Math.sin(t * 0.21), y + 10 * Math.sin(t * 0.17), s, 0.1 * Math.sin(t * 0.05), 1100, 750);
    // each tile is a full-screen warp pass: skip tiles that are off screen
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [px, py] of [[0, 0], [2200, 0], [0, 1500], [2200, 1500]]) {
      const [sx, sy] = R.toScreen(...M.apply(m, px, py));
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    if (x1 < -50 || x0 > 1970 || y1 < -50 || y0 > 1130) continue;
    R.layer(A.micro.caustic, m, { blend: 'add', opacity: alpha, warp: { type: 'noise', amp: 9 * z * s, freq: 0.012 / (z * s), time: t * 0.45 } });
  }
}

// ---------------------------------------------------------------- organelles per cell (deterministic)
// Offsets are in the pivot body layer's local units (cell radius 250 around (320, 320)).
const ORG = (() => {
  const r = rng('sea-organelles');
  const byCell = [];
  const mk = (born, rMin = 112, rMax = 198) => {
    const a = r(0, TAU), d = r(rMin, rMax);
    return { ox: Math.cos(a) * d, oy: Math.sin(a) * d, idx: r.int(0, 7), sz: r(0.45, 0.72), rot: r(0, TAU), born, spin: r(-0.4, 0.4), nx: 0, ny: 0 };
  };
  // level 0: the pivot cell's organelles swell into view as it prepares to divide
  byCell.push([Array.from({ length: 26 }, () => mk(r(0.12, 1.1)))]);
  for (let L = 1; L <= 4; L++) {
    const lv = [];
    for (let i = 0; i < 1 << L; i++) {
      const c = LAYOUT[L][i], par = LAYOUT[L - 1][c.parent];
      // division axis expressed in the parent's (spun) layer frame at the moment of the split
      const aLocal = par.divAxis - cellState(L - 1, c.parent, DIV[L].s0).spin;
      const ax = Math.cos(aLocal), ay = Math.sin(aLocal);
      const inherited = byCell[L - 1][c.parent].filter((o) => (o.ox * ax + o.oy * ay) * c.side > 0).map((o) => {
        // drift from the inherited spot to a new spot spread over the child
        const a = r(0, TAU), d = r(105, 205);
        return { ...o, fromX: o.ox, fromY: o.oy, ox: Math.cos(a) * d, oy: Math.sin(a) * d, inherit: true };
      });
      const fresh = Array.from({ length: 6 }, () => mk(DIV[L].s1 + r(0, 0.35)));
      lv.push(inherited.concat(fresh));
    }
    byCell.push(lv);
  }
  return byCell;
})();
// Draw organelles of a cell (in the cell's frame `Mcell` = cellMatrix(c, 320)).
export function drawOrganelles(R, A, c, Mcell, t, mask) {
  const list = ORG[c.L][c.i];
  const D = c.L > 0 ? DIV[c.L] : null;
  for (const o of list) {
    let g;
    if (o.inherit) g = 1;
    else g = ease.outBack(clamp(invLerp(o.born, o.born + 0.35, t)), 1.8);
    if (g <= 0.01) continue;
    let ox = o.ox, oy = o.oy;
    if (o.inherit && D) {
      const u = ease.inOutSine(clamp(invLerp(D.s0, D.set + 0.3, t)));
      ox = lerp(o.fromX, o.ox, u);
      oy = lerp(o.fromY, o.oy, u);
    }
    const jig = 4;
    ox += jig * Math.sin(t * 1.3 + o.rot * 3);
    oy += jig * Math.cos(t * 1.1 + o.rot * 2);
    const m = M.mul(Mcell, M.place(320 + ox, 320 + oy, o.sz * g, o.rot + o.spin * t, 60, 60));
    R.layer(A.micro.org.layer, m, { uv: A.micro.org.uv(o.idx), w: 120, h: 120, ...(mask ? { mask } : {}) });
  }
}

// ---------------------------------------------------------------- painterly rim light / shade on cells
// World-lit (light from the upper left): a warm highlight arc and a cool shade arc on every cell, drawn in
// progressively on the first cell; a splitting pair each keeps only the arc portion on its own side.
export function paintCellRims(c, P, cells, t, breathe) {
  const z = M.scaleOf(P);
  const g = seg(t, 0.15, 1.1, ease.inOutSine);
  if (g <= 0) return;
  const arc = (cell, a0, a1, rad, brush, col, w) => {
    const pts = [];
    const n = 18;
    for (let k = 0; k <= n; k++) {
      const a = lerp(a0, a1, k / n);
      let x = cell.x + Math.cos(a) * rad, y = cell.y + Math.sin(a) * rad;
      if (cell.split) {
        const sp = cell.split, nx = Math.cos(sp.axis) * sp.side, ny = Math.sin(sp.axis) * sp.side;
        if ((x - sp.mx) * nx + (y - sp.my) * ny < 0) { if (pts.length > 2) break; pts.length = 0; continue; }
      }
      pts.push(M.apply(P, x, y));
    }
    if (pts.length > 2) c.strokePath(pts, brush, col, w * z * cell.s, 0.5);
  };
  for (const cell of cells) {
    if (cell.s < 0.05) continue;
    const R = 250 * cell.s * breathe;
    const len = g * 1.5;
    arc(cell, -2.75, -2.75 + len, R * 0.9, 'sea_dry', '#ffe2a0', 0.9);
    arc(cell, -2.55, -2.55 + len * 0.8, R * 0.76, 'sea_comb', '#f59b5a', 0.55);
    arc(cell, 0.25, 0.25 + len, R * 0.9, 'sea_comb', '#8a2a3a', 0.7);
    arc(cell, 0.45, 0.45 + len * 0.7, R * 0.99, 'sea_contour', '#5a1a2a', 0.9);
  }
}

// ---------------------------------------------------------------- microbes in the medium
const MIC = (() => {
  const r = rng('sea-microbes');
  const mk = (n, szR, spR, box) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      // start outside the opening frame, swim in
      let x, y;
      do { x = r(box[0], box[2]); y = r(box[1], box[3]); } while (x > -80 && x < 2000 && y > -80 && y < 1160);
      const tx = r(100, 1800), ty = r(80, 1000);
      const sp = r(spR[0], spR[1]);
      const a = Math.atan2(ty - y, tx - x) + r(-0.5, 0.5);
      out.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, idx: r.int(0, 7), sz: r(szR[0], szR[1]), ph: r(0, TAU), wig: r(0.6, 1.6), spin: r(-0.3, 0.3) });
    }
    return out;
  };
  return { mid: mk(60, [0.45, 0.95], [40, 95], [-1300, -800, 3200, 1900]), near: mk(14, [1.3, 2.2], [90, 160], [-900, -500, 2800, 1600]) };
})();
export function drawMicrobes(R, A, t, which = 'mid') {
  const at = A.micro.mic;
  for (const m of MIC[which]) {
    const x = m.x + m.vx * t + 14 * Math.sin(t * m.wig + m.ph);
    const y = m.y + m.vy * t + 10 * Math.cos(t * m.wig * 0.8 + m.ph);
    const rot = Math.atan2(m.vy, m.vx) + 0.25 * Math.sin(t * m.wig * 1.3 + m.ph) + m.spin * t;
    const pulse = 1 + 0.06 * Math.sin(t * 3 + m.ph);
    R.layer(at.layer, M.place(x, y, m.sz, rot, 80, 80, m.sz * pulse), { uv: at.uv(m.idx), w: 160, h: 160 });
  }
}
