// SEA painter helpers: form-following stroke fields, dabs, silhouette clipping, broken contours.
import { TAU, lerp, clamp } from '../../engine/math.js';

export function bounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}
export function inPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
export function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
// Erase everything inside rect that lies outside polygon `sil` (painted so far).
export function clipTo(c, sil, rect) {
  const hole = signedArea(sil) > 0 ? sil.slice().reverse() : sil;
  c.flush();
  c.native((p) => {
    p.push();
    p.erase();
    p.noStroke();
    p.beginShape();
    p.vertex(rect[0], rect[1]); p.vertex(rect[2], rect[1]); p.vertex(rect[2], rect[3]); p.vertex(rect[0], rect[3]);
    p.beginContour();
    for (const q of hole) p.vertex(q[0], q[1]);
    p.endContour();
    p.endShape(p.CLOSE);
    p.noErase();
    p.pop();
  });
}
export function eraseIn(c, poly) {
  c.flush();
  c.native((p) => {
    p.push();
    p.erase();
    p.noStroke();
    p.beginShape();
    for (const q of poly) p.vertex(q[0], q[1]);
    p.endShape(p.CLOSE);
    p.noErase();
    p.pop();
  });
}
export function randIn(r, sil, b = bounds(sil), tries = 40) {
  for (let i = 0; i < tries; i++) {
    const x = r(b.x0, b.x1), y = r(b.y0, b.y1);
    if (inPoly(sil, x, y)) return [x, y];
  }
  return null;
}
// Strokes following a direction field dir(x,y) -> angle, seeded inside `sil`.
// o: n, len:[a,b], brush (name | fn(r)), w:[a,b], col(x,y,r), steps, curv, where(x,y), at(r)
export function fieldStrokes(c, sil, dir, o) {
  const r = c.r;
  const b = bounds(sil);
  const steps = o.steps || 6;
  for (let i = 0; i < o.n; i++) {
    const p0 = o.at ? o.at(r) : randIn(r, sil, b);
    if (!p0) continue;
    if (o.where && !o.where(p0[0], p0[1])) continue;
    const L = r(o.len[0], o.len[1]);
    let x = p0[0], y = p0[1];
    const back = [];
    for (let k = 0; k < steps / 2; k++) {
      const a = dir(x, y) + Math.PI;
      x += (Math.cos(a) * L) / steps; y += (Math.sin(a) * L) / steps;
      back.push([x, y]);
    }
    x = p0[0]; y = p0[1];
    const fwd = [[x, y]];
    for (let k = 0; k < steps / 2; k++) {
      const a = dir(x, y);
      x += (Math.cos(a) * L) / steps; y += (Math.sin(a) * L) / steps;
      fwd.push([x, y]);
    }
    const line = back.reverse().concat(fwd);
    if (r() < 0.5) line.reverse();
    const bn = typeof o.brush === 'function' ? o.brush(r) : o.brush;
    c.strokePath(line, bn, o.col(p0[0], p0[1], r), r(o.w[0], o.w[1]), o.curv ?? 0.5);
  }
}
// Short dabs (speckle, pebbles, foliage touches).
export function dabs(c, sil, o) {
  const r = c.r;
  const b = bounds(sil);
  for (let i = 0; i < o.n; i++) {
    const p = o.at ? o.at(r) : randIn(r, sil, b);
    if (!p) continue;
    if (o.where && !o.where(p[0], p[1])) continue;
    const a = o.dir ? o.dir(p[0], p[1]) + r(-0.4, 0.4) : r(0, TAU);
    const l = r(o.len[0], o.len[1]);
    c.strokePath([[p[0] - (Math.cos(a) * l) / 2, p[1] - (Math.sin(a) * l) / 2], [p[0] + (Math.cos(a) * l) / 2, p[1] + (Math.sin(a) * l) / 2]], o.brush || 'sea_dry', o.col(p[0], p[1], r), r(o.w[0], o.w[1]), 0.3);
  }
}
// Broken contour along a closed (or open) outline: runs of the outline with some spans skipped.
export function contour(c, sil, { brush = 'sea_contour', col = '#3a1020', w = 1, keep = 0.8, run = [8, 24], closed = true, lost = null, r = c.r } = {}) {
  const n = sil.length;
  let i = 0;
  while (i < n - (closed ? 0 : 1)) {
    const len = r.int(run[0], run[1]);
    const seg = [];
    for (let k = 0; k <= len && (closed || i + k < n); k++) seg.push(sil[(i + k) % n]);
    const mid = seg[Math.floor(seg.length / 2)];
    const isLost = lost ? lost(mid[0], mid[1]) : false;
    if (seg.length > 2 && r() < keep && !isLost) c.strokePath(seg, brush, col, w * r(0.75, 1.2), 0.4);
    i += len;
  }
}
// Offset polyline by signed distance d (number or fn(t)) along its left normal.
export function offsetLine(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    const k = typeof d === 'function' ? d(i / (n - 1)) : d;
    out.push([pts[i][0] - dy * k, pts[i][1] + dx * k]);
  }
  return out;
}
// Closed Catmull-Rom spline through control points.
export function crClosed(ctrl, sub = 8) {
  const n = ctrl.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}
export { TAU, lerp, clamp };
