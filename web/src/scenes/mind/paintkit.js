// MIND painting helpers: hand-drawn rectangles, lost-and-found ink contours, directional
// brushwork fills and dabs — so that UI, chip and board read as painted, not rendered.
import { TAU, lerp, clamp, mixHex } from '../../engine/math.js';

export function roundRectPts(x0, y0, x1, y1, rad = 0, step = 18) {
  const pts = [];
  const seg = (ax, ay, bx, by) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let i = 0; i < n; i++) pts.push([lerp(ax, bx, i / n), lerp(ay, by, i / n)]);
  };
  const arc = (cx, cy, a0) => {
    if (rad <= 0) return;
    const n = Math.max(2, Math.ceil((rad * Math.PI) / 2 / step));
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
  };
  seg(x0 + rad, y0, x1 - rad, y0); arc(x1 - rad, y0 + rad, -Math.PI / 2);
  seg(x1, y0 + rad, x1, y1 - rad); arc(x1 - rad, y1 - rad, 0);
  seg(x1 - rad, y1, x0 + rad, y1); arc(x0 + rad, y1 - rad, Math.PI / 2);
  seg(x0, y1 - rad, x0, y0 + rad); arc(x0 + rad, y0 + rad, Math.PI);
  return pts;
}

// Smooth hand-drawn wobble of a closed outline (offset along normals by low-frequency noise).
export function wobble(pts, r, amp = 1.2) {
  const n = pts.length, p1 = r(0, TAU), p2 = r(0, TAU), f1 = r(0.016, 0.028), f2 = r(0.05, 0.08);
  let s = 0;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    if (i > 0) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    let nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const d = Math.hypot(nx, ny) || 1;
    nx /= d; ny /= d;
    const o = amp * (0.65 * Math.sin(s * f1 + p1) + 0.35 * Math.sin(s * f2 + p2));
    return [p[0] + nx * o, p[1] + ny * o];
  });
}
export function wobRect(r, x0, y0, x1, y1, rad = 0, amp = 1.2) {
  return wobble(roundRectPts(x0, y0, x1, y1, rad), r, amp);
}

function sampler(P) {
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = L[L.length - 1];
  const at = (s) => {
    s = ((s % total) + total) % total;
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
    const u = (s - L[lo]) / (L[hi] - L[lo] || 1);
    return [lerp(P[lo][0], P[hi][0], u), lerp(P[lo][1], P[hi][1], u)];
  };
  return { at, total };
}

// Ink contour with pressure swell, broken into runs (lost-and-found edges).
export function inkContour(c, pts, color, weight = 1, { gap = 0.14, closed = true, brushName = 'mind_contour', runs = [3, 6], curv = 0.2, step = 10 } = {}) {
  const r = c.r;
  const P = closed ? pts.concat([pts[0]]) : pts;
  const { at, total } = sampler(P);
  if (!closed) {
    const k = r.int(1, 2);
    let s = 0;
    for (let q = 0; q < k; q++) {
      const s1 = q === k - 1 ? total : s + (total / k) * r(0.8, 1.0);
      const run = [];
      const n = Math.max(2, Math.ceil((s1 - s) / step));
      for (let j = 0; j <= n; j++) run.push(at(Math.min(total - 0.01, s + ((s1 - s) * j) / n)));
      c.strokePath(run, brushName, color, weight, curv);
      s = s1 + (total / k) * gap;
    }
    return;
  }
  const k = r.int(runs[0], runs[1]);
  let pos = r(0, total / k);
  for (let q = 0; q < k; q++) {
    const len = (total / k) * (1 - gap) * r(0.85, 1.15);
    const run = [];
    const n = Math.max(2, Math.ceil(len / step));
    for (let j = 0; j <= n; j++) run.push(at(pos + (len * j) / n));
    c.strokePath(run, brushName, color, weight * r(0.85, 1.15), curv);
    pos += total / k;
  }
}

// Approximate half-width (design units) of a brush at weight w (incl. pressure swell + scatter).
export function halfWidth(name, w = 1) {
  const base = { mind_comb: 5.6, mind_glaze: 13, mind_dry: 3.8, mind_haze: 6, mind_contour: 1.1, mind_callig: 1.4, mind_bar: 0.8, mind_trace: 0.7, mind_ui: 0.5, wire: 0.45, ink: 0.8, gouache: 4.5, dry: 3.2 }[name] ?? 2;
  return base * w * 1.15;
}
// Directional brushwork filling an axis-aligned rect. dir 'h' | 'v'. (p5.brush's clip() is a
// no-op in this build, so strokes are generated inside the bounds instead of being clipped.)
// `extent(v)` may narrow each row to [b0, b1] (e.g. a disc's chord).
export function strokeFill(c, x0, y0, x1, y1, { brushName = 'mind_comb', colors, weight = 1, spacing = 8, len = [80, 260], dir = 'h', wav = 1.2, jit = 0.5, curv = 0.5, extent = null } = {}) {
  const r = c.r;
  const H = dir === 'h';
  const half = halfWidth(brushName, weight * 1.2) + wav + jit;
  const a0 = (H ? y0 : x0) + half, a1 = (H ? y1 : x1) - half;
  if (a1 < a0) return;
  for (let v = a0 + r(0, Math.min(spacing * 0.5, (a1 - a0) * 0.5)); v <= a1; v += spacing * r(0.7, 1.3)) {
    let [b0, b1] = extent ? extent(v) : H ? [x0, x1] : [y0, y1];
    b0 += 2; b1 -= 2;
    if (b1 - b0 < 6) continue;
    let u = b0 + r(0, Math.min(len[0] * 0.5, (b1 - b0) * 0.25));
    while (u < b1 - 4) {
      const l = Math.min(r(len[0], len[1]), b1 - u);
      if (l < Math.min(len[0] * 0.3, (b1 - b0) * 0.4)) break;
      const pts = [];
      const ph = r(0, TAU);
      for (let k = 0; k <= 4; k++) {
        const uu = u + (l * k) / 4, vv = v + wav * Math.sin(k * 1.2 + ph) + r(-jit, jit);
        pts.push(H ? [uu, vv] : [vv, uu]);
      }
      c.strokePath(pts, brushName, r.pick(colors), weight * r(0.8, 1.2), curv);
      u += l * r(0.55, 1.0);
    }
  }
}
// Directional brushwork inside a disc.
export function discFill(c, cx, cy, R, o = {}) {
  const hw = halfWidth(o.brushName || 'mind_comb', (o.weight || 1) * 1.2);
  strokeFill(c, cx - R, cy - R, cx + R, cy + R, {
    ...o,
    extent: (v) => {
      const d = v - cy, h = Math.sqrt(Math.max(0, (R - hw) * (R - hw) - d * d));
      return [cx - h, cx + h];
    },
  });
}

// A painted panel: opaque base (hidden), underpainting glaze, directional strokes, contour.
export function paintPanel(c, x0, y0, x1, y1, o = {}) {
  const r = c.r;
  const { base, glaze = base, strokes = null, dir = 'h', rad = 6, wob = 1.0, contour = null, cw = 1, hi = null, spacing = 7, len = [70, 240], sw = 0.9, brushName = 'mind_comb', gap = 0.16 } = o;
  const pts = wobRect(r, x0, y0, x1, y1, rad, wob);
  c.washPoly(pts, base, 255);
  c.fillPoly(pts, glaze, { opacity: 60, bleed: 0.015, texture: 0.85, border: 0.3 });
  if (strokes) strokeFill(c, x0 + 1, y0 + 1, x1 - 1, y1 - 1, { brushName, colors: strokes, dir, spacing, len, weight: sw });
  if (hi) c.strokePath([[x0 + rad + 4, y0 + 1.6 + r(-0.4, 0.4)], [lerp(x0, x1, 0.5), y0 + 1.2], [x1 - rad - 4, y0 + 1.8]], 'mind_contour', hi, 0.7, 0.3);
  if (contour) inkContour(c, pts, contour, cw, { gap });
  return pts;
}

// Small painted dab (blob) with an optional highlight.
export function dab(c, x, y, rx, ry, color, { hi = null, rot = 0, wobble: wb = 0.12, n = 18 } = {}) {
  c.washPoly(c.blob(x, y, rx, ry, { n, wobble: wb, rot }), color, 255);
  if (hi) c.washPoly(c.blob(x - rx * 0.28, y - ry * 0.3, rx * 0.4, ry * 0.32, { n: 12, wobble: 0.15, rot }), hi, 230);
}

export { mixHex, clamp, lerp };
