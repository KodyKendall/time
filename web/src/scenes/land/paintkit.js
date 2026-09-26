// LAND — painter helpers: form-following stroke fields, dabs, clipping to a silhouette, contours.
import { TAU, lerp, clamp, inPoly } from './util.js';

export function bounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

export function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
// Erase everything in rect (x0,y0,x1,y1) that is outside polygon `sil` (painted so far).
export function clipTo(c, sil, rect) {
  // the hole must wind opposite to the outer rectangle (which has positive area in y-down coords)
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
// Erase inside polygon (e.g. to cut a hole / notch).
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

// Random point inside polygon.
export function randIn(r, sil, b = bounds(sil), tries = 40) {
  for (let i = 0; i < tries; i++) {
    const x = r(b.x0, b.x1), y = r(b.y0, b.y1);
    if (inPoly(sil, x, y)) return [x, y];
  }
  return null;
}

// Strokes that follow a direction field dir(x,y) -> angle. opts:
//  n, len:[a,b], brush (string or fn), w:[a,b], col(x,y,r) -> colour, steps, curv, where(x,y) filter
export function fieldStrokes(c, sil, dir, o) {
  const r = c.r;
  const b = bounds(sil);
  const steps = o.steps || 5;
  for (let i = 0; i < o.n; i++) {
    const p0 = o.at ? o.at(r) : randIn(r, sil, b);
    if (!p0) continue;
    if (o.where && !o.where(p0[0], p0[1])) continue;
    const L = r(o.len[0], o.len[1]);
    const pts = [];
    let x = p0[0], y = p0[1];
    const sgn = r() < 0.5 ? 1 : -1;
    // walk backwards half, forwards half so strokes are centred on p0
    const back = [];
    for (let k = 0; k < steps / 2; k++) {
      const a = dir(x, y) + Math.PI;
      x += Math.cos(a) * L / steps; y += Math.sin(a) * L / steps;
      back.push([x, y]);
    }
    x = p0[0]; y = p0[1];
    const fwd = [[x, y]];
    for (let k = 0; k < steps / 2; k++) {
      const a = dir(x, y);
      x += Math.cos(a) * L / steps; y += Math.sin(a) * L / steps;
      fwd.push([x, y]);
    }
    let line = back.reverse().concat(fwd);
    if (o.trim) {
      // keep the run of points around p0 that stays inside the polygon
      const mid = back.length;
      let a = mid, b = mid;
      while (a > 0 && inPoly(sil, line[a - 1][0], line[a - 1][1])) a--;
      while (b < line.length - 1 && inPoly(sil, line[b + 1][0], line[b + 1][1])) b++;
      line = line.slice(a, b + 1);
      if (line.length < 2) continue;
    }
    if (sgn < 0) line.reverse();
    const bn = typeof o.brush === 'function' ? o.brush(r) : o.brush;
    c.strokePath(line, bn, o.col(p0[0], p0[1], r), r(o.w[0], o.w[1]), o.curv ?? 0.5);
  }
}

// Short dabs (scales / speckle / foliage touches).
export function dabs(c, sil, o) {
  const r = c.r;
  const b = bounds(sil);
  for (let i = 0; i < o.n; i++) {
    const p = randIn(r, sil, b);
    if (!p) continue;
    if (o.where && !o.where(p[0], p[1])) continue;
    const a = o.dir ? o.dir(p[0], p[1]) + r(-0.4, 0.4) : r(0, TAU);
    const l = r(o.len[0], o.len[1]);
    c.strokePath([[p[0] - Math.cos(a) * l / 2, p[1] - Math.sin(a) * l / 2], [p[0] + Math.cos(a) * l / 2, p[1] + Math.sin(a) * l / 2]], o.brush || 'land_dry', o.col(p[0], p[1], r), r(o.w[0], o.w[1]), 0.3);
  }
}

// Contour with lost-and-found edges: draws runs of the closed outline, skipping some spans.
export function contour(c, sil, { brush = 'land_contour', col = '#5a1020', w = 1, keep = 0.8, run = [10, 30], closed = true, lost = null } = {}) {
  const r = c.r;
  const n = sil.length;
  let i = 0;
  while (i < n - 1) {
    const len = r.int(run[0], run[1]);
    const seg = [];
    for (let k = 0; k <= len && i + k < n + (closed ? 1 : 0); k++) seg.push(sil[(i + k) % n]);
    const mid = seg[Math.floor(seg.length / 2)];
    const isLost = lost ? lost(mid[0], mid[1]) : false;
    if (seg.length > 2 && r() < keep && !isLost) c.strokePath(seg, brush, col, w * r(0.75, 1.2), 0.4);
    i += len;
  }
}

// Offset polyline: points at signed distance d(t) along the left normal.
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
