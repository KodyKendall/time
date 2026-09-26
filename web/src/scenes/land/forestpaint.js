// LAND — painterly forest elements (static layers). Every element is built painter-style:
// underpainting -> directional strokes -> accents -> clip -> lost-and-found contour.
import { TAU, lerp, clamp, smoothstep, mixHex, crSpline, inPoly, rng } from './util.js';
import { clipTo, fieldStrokes, dabs, contour, bounds, offsetLine } from './paintkit.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];

// ------------------------------------------------------------------------------------------------
// shapes
// ------------------------------------------------------------------------------------------------
// A small tapered leaf (lens polygon) from p along angle a: length l, max half-width w.
export function leafShape(c, p, a, l, w, col, rib = null) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const L = [], R = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const hw = w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.8) * (1 - 0.25 * t);
    const x = p[0] + ca * l * t, y = p[1] + sa * l * t;
    L.push([x - sa * hw, y + ca * hw]);
    R.push([x + sa * hw, y - ca * hw]);
  }
  c.washPoly(L.concat(R.reverse()), col, 255);
  if (rib) c.strokePath([[p[0] + ca * l * 0.1, p[1] + sa * l * 0.1], [p[0] + ca * l * 0.8, p[1] + sa * l * 0.8]], 'wire', rib, 0.4, 0.3);
}
export function trunkPoly(bx, by, h, w0, w1, lean, wig, flare = 0.55) {
  const L = [], R = [], axis = [];
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = bx + lean * h * t * t * 0.5 + wig * Math.sin(t * 3.1 + 0.7) * t;
    const y = by - h * t;
    const fl = 1 + flare * Math.pow(1 - t, 7);
    const w = lerp(w0, w1, t) * fl * 0.5;
    L.push([x - w, y]);
    R.push([x + w, y]);
    axis.push([x, y]);
  }
  return { L, R, axis, poly: L.concat(R.slice().reverse()) };
}

// ------------------------------------------------------------------------------------------------
// painterly trunk. cols: {dark, mid, lit, edge, moss:[..]} ; kind: 'fern' (leaf-scar diamonds) | 'conifer' (fissures)
// ------------------------------------------------------------------------------------------------
export function paintTrunk(c, bx, by, h, w, spec) {
  const r = c.r;
  const { cols, kind = 'conifer', lean = r(-0.04, 0.04), moss = 0.5, vines = 0, taper = 0.78, flare = 0.55 } = spec;
  const tp = trunkPoly(bx, by, h, w, w * taper, lean, r(-6, 6), flare);
  c.washPoly(tp.poly, cols.mid, 255);
  c.fillPoly(tp.poly, cols.dark, { opacity: 55, bleed: 0.02, texture: 0.9, border: 0.6 });
  const n = tp.axis.length - 1;
  const at = (y) => clamp(Math.round(((by - y) / h) * n), 0, n);
  // vertical strokes following the trunk axis; tone by position across the trunk (shadow left, lit right)
  const dir = (x, y) => {
    const j = at(y), a = tp.axis[Math.min(n, j + 1)], b = tp.axis[Math.max(0, j - 1)];
    return Math.atan2(a[1] - b[1], a[0] - b[0]);
  };
  const across = (x, y) => { const j = at(y); return clamp((x - tp.L[j][0]) / (tp.R[j][0] - tp.L[j][0] + 1e-3)); };
  const colAt = (x, y, rr) => {
    const u = across(x, y);
    if (u < 0.3) return pick(rr, [cols.dark, mixHex(cols.dark, '#000000', 0.15), mixHex(cols.dark, cols.mid, 0.4)]);
    if (u > 0.78) return pick(rr, [cols.lit, mixHex(cols.lit, cols.mid, 0.4), mixHex(cols.lit, '#fff4d0', 0.2)]);
    return pick(rr, [cols.mid, mixHex(cols.mid, cols.dark, 0.3), mixHex(cols.mid, cols.lit, 0.3)]);
  };
  const area = h * w;
  fieldStrokes(c, tp.poly, dir, { n: Math.round(area / 170), len: [30, 90], brush: 'land_comb', w: [0.45, 0.85] .map((q) => q * clamp(w / 90, 0.5, 1.3)), col: colAt });
  fieldStrokes(c, tp.poly, dir, { n: Math.round(area / 700), len: [12, 34], brush: 'land_dry', w: [0.35, 0.6], col: colAt });
  if (kind === 'fern') {
    // tree-fern trunk: irregular overlapping leaf-base scars (curved chevrons), fibrous roots near the base
    const nsc = Math.round(h * w / 900);
    for (let i = 0; i < nsc; i++) {
      const y = by - r(20, h);
      const j = at(y);
      const xl = tp.L[j][0], xr = tp.R[j][0];
      const u = r(0.08, 0.92), x = lerp(xl, xr, u);
      const sc = (1 - Math.abs(u - 0.5) * 1.3) * r(0.7, 1.2);
      if (sc < 0.2) continue;
      const col = u < 0.4 ? mixHex(cols.dark, '#02161a', 0.45) : mixHex(cols.dark, cols.mid, 0.25);
      c.strokePath([[x - 8 * sc, y - 4 * sc], [x - 2 * sc, y + 3 * sc], [x + 8 * sc, y - 3 * sc]], 'land_contour', col, r(0.5, 0.8), 0.5);
      if (u > 0.5 && r() < 0.6) c.strokePath([[x - 6 * sc, y - 7 * sc], [x + 6 * sc, y - 7 * sc]], 'land_dry', cols.lit, 0.35, 0.4);
    }
    for (let i = 0; i < 26; i++) {
      const u = r(0, 1), y0 = by - r(0, 120);
      const j = at(y0), x0 = lerp(tp.L[j][0], tp.R[j][0], u);
      c.strokePath([[x0, y0], [x0 + r(-6, 6), y0 + r(20, 60)]], 'land_contour', mixHex(cols.dark, '#1a0e06', 0.4), r(0.4, 0.7), 0.5);
    }
  } else {
    // conifer: long fissures + ring cracks
    for (let i = 0; i < Math.round(h / 30); i++) {
      const u = r(0.12, 0.9), y0 = r(by - h, by - 20), l = r(40, 140);
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const y = y0 + (l * k) / 6, j = at(y);
        pts.push([lerp(tp.L[j][0], tp.R[j][0], u) + r(-1.5, 1.5), y]);
      }
      c.strokePath(pts, 'land_contour', mixHex(cols.dark, '#02161a', u < 0.5 ? 0.5 : 0.25), r(0.45, 0.75), 0.5);
    }
    for (let y = by - 40; y > by - h; y -= r(60, 130)) {
      const j = at(y);
      c.strokePath([[tp.L[j][0] + 4, y], [lerp(tp.L[j][0], tp.R[j][0], 0.5), y + 4], [tp.R[j][0] - 4, y + 1]], 'wire', mixHex(cols.dark, '#02161a', 0.3), 0.6, 0.5);
    }
  }
  // moss: clustered green dabs on the shadow side and near the base
  if (moss > 0) {
    const mossCols = cols.moss || ['#4f8a4a', '#6aa36b', '#3d7040', '#8ab86a'];
    for (let k = 0; k < Math.round(moss * h / 90); k++) {
      const y = by - h * Math.pow(r(), 1.8) * 0.9;
      const j = at(y), x = lerp(tp.L[j][0], tp.R[j][0], r(0, 0.45));
      for (let q = 0; q < 14; q++) {
        const px = x + r(-14, 14), py = y + r(-18, 18);
        c.strokePath([[px, py], [px + r(-4, 4), py + r(2, 6)]], 'land_dry', pick(r, mossCols), r(0.3, 0.55), 0.3);
      }
    }
  }
  clipTo(c, tp.poly, [bx - w * 3, by - h - 40, bx + w * 3, by + 60]);
  // edges: dark shadow edge, light rim on the lit side (lost and found)
  contour(c, tp.L, { col: mixHex(cols.dark, '#01100f', 0.5), w: clamp(w / 70, 0.7, 1.6), keep: 0.8, run: [4, 10], closed: false });
  contour(c, tp.R, { col: cols.edge, w: clamp(w / 90, 0.5, 1.1), keep: 0.55, run: [3, 8], closed: false });
  // hanging vines / epiphytes
  for (let v = 0; v < vines; v++) {
    const j0 = Math.round(n * r(0.35, 0.95));
    const side = r() < 0.5 ? -1 : 1;
    const x0 = side < 0 ? tp.L[j0][0] : tp.R[j0][0], y0 = tp.L[j0][1];
    const len = r(120, 300);
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push([x0 + side * (14 * Math.sin(t * 2.2) + 8 * t), y0 + len * t]);
    }
    c.strokePath(pts, 'land_contour', '#2f5a3a', 0.8, 0.6);
    for (let k = 1; k < 12; k++) {
      const p = pts[k];
      const sd = k % 2 ? 1 : -1;
      const la = Math.PI / 2 + sd * r(0.5, 1.2);
      leafShape(c, p, la, r(12, 20), r(3, 4.5), pick(r, ['#4f8a4a', '#6aa36b', '#2f6a44']), '#86b87a');
    }
  }
  return tp;
}

// ------------------------------------------------------------------------------------------------
// frond: rachis from p0 at angle a0, curling by `curl`; leaflets painted as tapered leaf strokes.
// cols: [back, front, lit]; opts: density, lw (leaflet length), droop
// ------------------------------------------------------------------------------------------------
export function rachisPts(p0, a0, len, curl, n = 40) {
  const pts = [[p0[0], p0[1]]], angs = [];
  let x = p0[0], y = p0[1];
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) / n;
    const a = a0 + curl * s * s;
    angs.push(a);
    x += (Math.cos(a) * len) / n;
    y += (Math.sin(a) * len) / n;
    pts.push([x, y]);
  }
  return { pts, angs };
}
export function paintFrond(c, p0, a0, len, lw, curl, cols, { density = 1, litArc = 0, weight = 1, rachisW = 1, stiff = 0 } = {}) {
  const r = c.r;
  const rc = rachisPts(p0, a0, len, curl);
  const n = Math.round(32 * density);
  const leaf = (s, side, back) => {
    const k = Math.min(rc.angs.length - 1, Math.floor(s * rc.angs.length));
    const p = rc.pts[k], a = rc.angs[k];
    const l = lw * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * s)), 0.55) * (1 - 0.5 * s) * r(0.85, 1.1);
    const la = a + side * lerp(1.1, 0.6, s) + r(-0.07, 0.07);
    const droop = (1 - stiff) * 0.35 * side;
    const mid = [p[0] + Math.cos(la) * l * 0.5, p[1] + Math.sin(la) * l * 0.5];
    const tip = [p[0] + Math.cos(la + droop) * l, p[1] + Math.sin(la + droop) * l + (1 - stiff) * l * 0.12];
    // leaflets facing up catch the light; some vary warm/cool
    const up = clamp(-Math.sin(la) * 0.8 + 0.2);
    const col = back ? mixHex(cols[0], cols[1], r(0, 0.3)) : mixHex(cols[1], cols[2], up * r(0.15, 0.55));
    c.strokePath([p, mid, tip], 'land_leaf', col, weight * r(0.8, 1.05) * clamp(l / 60, 0.35, 1.4), 0.5);
    return { p, mid, tip, l };
  };
  for (let i = 1; i < n; i++) leaf(i / n, -1, true);
  const fronts = [];
  for (let i = 1; i < n; i++) fronts.push(leaf(i / n + 0.5 / n, 1, false));
  // lit touches on the front leaflets
  for (const f of fronts) {
    if (r() < 0.55) c.strokePath([f.p, [lerp(f.p[0], f.tip[0], 0.7), lerp(f.p[1], f.tip[1], 0.7)]], 'wire', cols[2], 0.55 * weight, 0.4);
  }
  c.strokePath(rc.pts.map((q, i) => [q[0], q[1], lerp(1.25, 0.35, i / rc.pts.length)]), 'land_contour', litArc ? cols[2] : cols[0], rachisW * weight, 0.4);
  if (litArc) {
    const seg = rc.pts.slice(3, Math.round(rc.pts.length * 0.8)).map((p, j, arr) => [p[0], p[1] - 2, Math.sin((Math.PI * j) / (arr.length - 1)) * 1.2 + 0.25]);
    c.strokePath(seg, 'land_comb', cols[2], litArc, 0.5);
  }
  return rc;
}

// ------------------------------------------------------------------------------------------------
// cycad: pineapple trunk + rosette of stiff, straight, comb-like fronds
// ------------------------------------------------------------------------------------------------
export function paintCycad(c, bx, by, s, cols) {
  const r = c.r;
  const th = 70 * s, tw = 46 * s;
  // fronds behind
  const nf = 11;
  const frond = (k, front) => {
    const a = -Math.PI / 2 + ((k / (nf - 1)) - 0.5) * 2.7 + r(-0.08, 0.08);
    paintFrond(c, [bx, by - th + 4 * s], a, r(150, 200) * s, 42 * s, (a + Math.PI / 2) * 0.45, front ? [cols.leafB, cols.leaf, cols.lit] : [mixHex(cols.leafB, '#000', 0.2), cols.leafB, cols.leaf], { density: 0.9, weight: 0.9 * s, stiff: 0.8, rachisW: 1.2 });
  };
  for (let k = 0; k < nf; k += 2) frond(k, false);
  // trunk: ovoid with diamond scales
  const poly = crSpline([[bx - tw * 0.5, by], [bx - tw * 0.56, by - th * 0.5], [bx - tw * 0.4, by - th], [bx + tw * 0.4, by - th], [bx + tw * 0.56, by - th * 0.5], [bx + tw * 0.5, by]], 6, true);
  c.washPoly(poly, cols.trunk, 255);
  for (let y = by - 6; y > by - th; y -= 9 * s) {
    for (let x = bx - tw * 0.5 + ((by - y) % 18) * 0.5; x < bx + tw * 0.5; x += 12 * s) {
      if (!inPoly(poly, x - 5 * s, y) || !inPoly(poly, x + 5 * s, y) || !inPoly(poly, x, y - 6 * s)) continue;
      c.strokePath([[x - 5 * s, y], [x, y - 6 * s], [x + 5 * s, y]], 'land_contour', mixHex(cols.trunk, '#1a0e04', 0.5), 0.55 * s, 0.4);
      c.strokePath([[x - 3 * s, y - 2 * s], [x + 3 * s, y - 2 * s]], 'wire', cols.trunkLit, 0.5 * s, 0.4);
    }
  }
  contour(c, poly, { col: mixHex(cols.trunk, '#120a02', 0.6), w: 0.8 * s, keep: 0.8, run: [4, 10] });
  for (let k = 1; k < nf; k += 2) frond(k, true);
}

// ------------------------------------------------------------------------------------------------
// horsetails: clump of tall segmented stems with whorls of fine branches
// ------------------------------------------------------------------------------------------------
export function paintHorsetails(c, bx, by, s, cols, n = 9) {
  const r = c.r;
  for (let i = 0; i < n; i++) {
    const x0 = bx + r(-40, 40) * s, h = r(160, 280) * s, lean = r(-0.18, 0.18);
    const pts = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([x0 + lean * h * t * t + 4 * Math.sin(t * 4 + i), by - h * t]); }
    c.strokePath(pts.map((p, k) => [p[0], p[1], lerp(1.2, 0.5, k / 10)]), 'land_comb', pick(r, [cols.stem, cols.stemLit]), 0.28 * s, 0.4);
    // nodes + whorls
    for (let k = 1; k < 10; k++) {
      const p = pts[k];
      c.strokePath([[p[0] - 3 * s, p[1]], [p[0] + 3 * s, p[1]]], 'wire', cols.node, 0.6 * s, 0.3);
      if (k > 2) {
        const wl = (1 - k / 11) * 26 * s + 6 * s;
        for (let q = 0; q < 6; q++) {
          const a = Math.PI / 2 + (q < 3 ? -1 : 1) * r(0.5, 1.3);
          c.strokePath([p, [p[0] + Math.cos(a) * wl * (q < 3 ? -1 : 1) * -1, p[1] + Math.sin(a) * wl * 0.6]], 'wire', pick(r, [cols.needle, cols.stem]), 0.5 * s, 0.4);
        }
      }
    }
    // cone tip
    const tp = pts[10];
    c.strokePath([[tp[0], tp[1] + 6 * s], [tp[0], tp[1] - 8 * s]], 'land_leaf', cols.cone, 1.2 * s, 0.3);
  }
}

// ------------------------------------------------------------------------------------------------
// mossy rock
// ------------------------------------------------------------------------------------------------
export function paintRock(c, cx, cy, rx, ry, cols) {
  const r = c.r;
  const poly = crSpline([[cx - rx, cy], [cx - rx * 0.8, cy - ry * 0.7], [cx - rx * 0.2, cy - ry], [cx + rx * 0.5, cy - ry * 0.85], [cx + rx, cy - ry * 0.2], [cx + rx * 0.95, cy], [cx, cy + ry * 0.12]], 7, true);
  c.washPoly(poly, cols.stone, 255);
  c.fillPoly(poly, cols.stoneDark, { opacity: 70, bleed: 0.03, texture: 0.9, border: 0.6 });
  fieldStrokes(c, poly, (x, y) => -0.3 + 0.6 * ((x - cx) / rx), { trim: true, n: Math.round(rx * ry / 40), len: [10, 30], brush: 'land_comb', w: [0.3, 0.5], col: (x, y, rr) => (y < cy - ry * 0.5 ? pick(rr, [cols.stoneLit, cols.stone]) : pick(rr, [cols.stone, cols.stoneDark])) });
  // moss cap
  const cap = poly.filter((p) => p[1] < cy - ry * 0.35);
  if (cap.length > 3) {
    dabs(c, poly, { n: Math.round(rx * ry / 18), len: [2, 5], w: [0.25, 0.4], where: (x, y) => y < cy - ry * 0.25 + 12 * Math.sin(x * 0.05), col: (x, y, rr) => pick(rr, cols.moss) });
  }
  contour(c, poly, { col: cols.edge, w: 1, keep: 0.85, run: [5, 12] });
  // grass at its foot
  for (let i = 0; i < 10; i++) {
    const x = cx + r(-rx, rx);
    c.strokePath([[x, cy + 4], [x + r(-6, 6), cy - r(8, 20)]], 'land_leaf', pick(r, cols.moss), r(0.7, 1.1), 0.4);
  }
}
