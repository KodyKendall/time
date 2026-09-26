// ANCESTORS — painterly helpers: form-following strokes, broken ("lost and found") contours,
// scattered dabs. All take a painting context `c` (see engine/paint.js) and a seeded rng.
import { TAU, lerp, clamp, mixHex } from '../lib/kit.js';

// A stroke of length `len` at (x, y) heading `ang`, gently bent, with pressure taper.
export function dab(c, x, y, ang, len, brush, color, weight, bend = 0.15) {
  const n = 4, pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const a = ang + bend * (u - 0.5);
    pts.push([x + Math.cos(a) * len * u, y + Math.sin(a) * len * u, lerp(0.7, 1.1, Math.sin(Math.PI * u))]);
  }
  c.strokePath(pts, brush, color, weight, 0.5);
}

// Stroke along a polyline (array of [x, y]) — keeps pressure taper at both ends.
export function along(c, pts, brush, color, weight, curv = 0.5) {
  const n = pts.length;
  c.strokePath(pts.map((p, i) => [p[0], p[1], 0.55 + 0.6 * Math.sin((Math.PI * (i + 0.5)) / n)]), brush, color, weight, curv);
}

// Broken contour: draws the polyline as segments with gaps and varying weight.
export function brokenLine(c, r, pts, brush, color, weight, { keep = 0.72, seg = 5 } = {}) {
  let i = 0;
  while (i < pts.length - 1) {
    const n = Math.max(2, Math.round(r(seg * 0.6, seg * 1.5)));
    const part = pts.slice(i, Math.min(pts.length, i + n + 1));
    if (part.length > 1 && r() < keep) along(c, part, brush, color, weight * r(0.7, 1.25));
    i += n;
  }
}

// Scatter n strokes inside a region: pos(r) -> [x, y] | null, dir(x, y) -> angle,
// size(x, y) -> scale. Brushes / colours picked from lists.
export function scatter(c, r, n, { pos, dir, size = () => 1, len = [20, 60], brushes = ['gouache'], colors, weight = [0.5, 1], bend = 0.2 }) {
  for (let i = 0; i < n; i++) {
    const p = pos(r);
    if (!p) continue;
    const [x, y] = p, s = size(x, y);
    dab(c, x, y, dir(x, y) + r(-0.12, 0.12), r(len[0], len[1]) * s, r.pick(brushes), r.pick(colors), r(weight[0], weight[1]) * s, r(-bend, bend));
  }
}

// Polyline sampled from y = f(x).
export function curve(f, x0, x1, step = 20, dy = 0) {
  const pts = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) pts.push([x, f(x) + dy]);
  return pts;
}

// Crack network (cracked earth): random-walk polylines with branches, flattened for perspective.
export function cracks(c, r, cx, cy, rx, ry, n, color, weight) {
  for (let i = 0; i < n; i++) {
    let x = cx + r(-rx, rx), y = cy + r(-ry, ry), a = r(0, TAU);
    const pts = [[x, y]];
    const steps = Math.round(r(4, 9));
    for (let k = 0; k < steps; k++) {
      a += r(-0.9, 0.9);
      const l = r(10, 26);
      x += Math.cos(a) * l;
      y += Math.sin(a) * l * 0.38;
      pts.push([x, y]);
      if (r() < 0.25 && k > 1) {
        const b = a + r(0.8, 1.6) * (r() < 0.5 ? -1 : 1), l2 = r(8, 20);
        c.strokePath([[x, y], [x + Math.cos(b) * l2, y + Math.sin(b) * l2 * 0.38]], 'ink', color, weight * 0.7, 0.3);
      }
    }
    along(c, pts, 'ink', color, weight, 0.3);
  }
}

// A painting context that maps every point through the affine m (and scales brush sizes by m's
// scale) before handing it to p5.brush. Use this instead of p5 transforms inside a layer:
// p5.brush's on-canvas test adds the transform's pixel translation to model coordinates, so a
// translated + scaled layer (4K) silently drops strokes.
export function xform(c, m) {
  const s = Math.hypot(m[0], m[1]);
  const ap = (p) => (p.length > 2 ? [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5], p[2]] : [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]);
  const aps = (pts) => pts.map(ap);
  return {
    ...c,
    scale: s,
    fillPoly: (pts, color, o) => c.fillPoly(aps(pts), color, o),
    washPoly: (pts, color, a) => c.washPoly(aps(pts), color, a),
    hatchPoly: (pts, o = {}) => c.hatchPoly(aps(pts), { ...o, dist: (o.dist ?? 6) * s, weight: (o.weight ?? 1) * s }),
    strokePath: (pts, brush, color, weight = 1, curv = 0.5) => c.strokePath(aps(pts), brush, color, weight * s, curv),
    line: (x1, y1, x2, y2, brush, color, w = 1) => { const a = ap([x1, y1]), b = ap([x2, y2]); c.line(a[0], a[1], b[0], b[1], brush, color, w * s); },
    blob: c.blob,
    flush: c.flush,
  };
}
