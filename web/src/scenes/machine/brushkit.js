// Painterly helpers for the machine segment: custom brushes + form-following brushwork.
import { rng, lerp, clamp, mixHex, TAU } from '../../engine/math.js';

// ------------------------------------------------------------------------------------ brushes
export function defineMachBrushes(brush) {
  const add = (name, params) => { if (!brush.box().includes(name)) brush.add(name, params); };
  // flat bristle brush: a row of hairs across the stroke direction -> streaky, directional marks
  add('mach_bristle', {
    type: 'custom', weight: 5, scatter: 0.1, sharpness: 0.6, grain: 0.5, opacity: 150, spacing: 0.08,
    pressure: [1.05, 0.8], rotate: 'natural', noise: 0.2,
    tip: (s) => {
      const r = rng('mach_bristle_tip');
      for (let i = 0; i < 26; i++) {
        const y = -46 + (92 * i) / 25 + r(-1.5, 1.5);
        s.fill(0, 0, 0, r(90, 255));
        s.ellipse(r(-4, 4), y, r(4, 9), r(3.5, 6));
      }
    },
  });
  // softer, fuller loaded brush for masses (gouache-like with bristle edges)
  add('mach_load', {
    type: 'custom', weight: 6, scatter: 0.2, sharpness: 0.5, grain: 0.8, opacity: 90, spacing: 0.1,
    pressure: [1.1, 0.85], rotate: 'natural', noise: 0.3,
    tip: (s) => {
      const r = rng('mach_load_tip');
      for (let i = 0; i < 30; i++) {
        const y = r(-42, 42);
        s.fill(0, 0, 0, r(60, 200));
        s.ellipse(r(-6, 6), y, r(2, 6), r(3, 9));
      }
    },
  });
  // flat, untapered gouache dab for stone / metal masses
  add('mach_flat', {
    type: 'default', weight: 5, scatter: 0.35, sharpness: 0.55, grain: 0.75, opacity: 150, spacing: 0.25,
    pressure: [1, 1], rotate: 'natural', noise: 0.3,
  });
  // fine liner with a little tooth for contours
  add('mach_line', {
    type: 'default', weight: 0.9, scatter: 0.15, sharpness: 0.85, grain: 0.7, opacity: 210, spacing: 0.2,
    pressure: [1.25, 0.7], rotate: 'none', noise: 0.2,
  });
}

// ------------------------------------------------------------------------------------ geometry
export const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

// Intersect the infinite line p + t*d with a polygon: returns sorted [t0, t1, ...] crossings.
function lineCrossings(poly, px, py, dx, dy) {
  const ts = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - px) * ey - (a[1] - py) * ex) / den;
    const u = ((a[0] - px) * dy - (a[1] - py) * dx) / den;
    if (u >= 0 && u < 1) ts.push(t);
  }
  return ts.sort((x, y) => x - y);
}

// Directional brushwork inside a polygon: parallel strokes at `angle`, broken into dabs of
// length `len` with jitter, in the given colours (array -> random pick). Strokes stay inside.
export function strokesIn(c, poly, { angle = 0, spacing = 6, len = [30, 90], colors, brush = 'mach_bristle', weight = [0.6, 1.2], jitter = 0.15, bend = 0.06, gap = [4, 20], density = 1, seed = 0, margin = 0 } = {}) {
  const r = rng('si' + seed + c.name);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const nx = -dy, ny = dx;
  // extent along the normal
  let n0 = Infinity, n1 = -Infinity, cx = 0, cy = 0;
  for (const [x, y] of poly) { const n = x * nx + y * ny; n0 = Math.min(n0, n); n1 = Math.max(n1, n); cx += x; cy += y; }
  cx /= poly.length; cy /= poly.length;
  const c0 = cx * nx + cy * ny;
  for (let n = n0 + spacing * 0.5; n < n1; n += spacing * r(0.7, 1.3)) {
    const px = cx + nx * (n - c0), py = cy + ny * (n - c0);
    const ts = lineCrossings(poly, px, py, dx, dy);
    for (let k = 0; k + 1 < ts.length; k += 2) {
      let t = ts[k] + margin, tEnd = ts[k + 1] - margin;
      while (t < tEnd) {
        const L = Math.min(r(len[0], len[1]), tEnd - t);
        if (L > 3 && r() < density) {
          const a2 = angle + r(-jitter, jitter) * 0.3;
          const ddx = Math.cos(a2), ddy = Math.sin(a2);
          const off = r(-spacing * 0.3, spacing * 0.3);
          const x0 = px + dx * t + nx * off, y0 = py + dy * t + ny * off;
          const b = r(-bend, bend) * L;
          const pts = [];
          for (let q = 0; q <= 4; q++) {
            const u = q / 4;
            pts.push([x0 + ddx * L * u + nx * b * Math.sin(u * Math.PI), y0 + ddy * L * u + ny * b * Math.sin(u * Math.PI), lerp(0.7, 1.1, Math.sin(u * Math.PI))]);
          }
          c.strokePath(pts, brush, Array.isArray(colors) ? r.pick(colors) : colors, r(weight[0], weight[1]), 0.5);
        }
        t += L + r(gap[0], gap[1]);
      }
    }
  }
}

// Strokes following circles (rims, platters): arcs around (cx,cy) between radii r0..r1.
export function arcStrokes(c, cx, cy, r0, r1, { n = 60, arc = [0.3, 1.2], colors, brush = 'mach_bristle', weight = [0.5, 1], seed = 0, a0 = 0, a1 = TAU } = {}) {
  const r = rng('arc' + seed + c.name);
  for (let i = 0; i < n; i++) {
    const rr = lerp(r0, r1, r());
    const len = r(arc[0], arc[1]);
    const s = lerp(a0, a1 - len, r());
    const pts = [];
    const m = Math.max(4, Math.ceil(len * 8));
    for (let q = 0; q <= m; q++) {
      const a = s + (len * q) / m;
      const w = rr * (1 + r(-0.004, 0.004));
      pts.push([cx + Math.cos(a) * w, cy + Math.sin(a) * w, lerp(0.6, 1.1, Math.sin((q / m) * Math.PI))]);
    }
    c.strokePath(pts, brush, Array.isArray(colors) ? r.pick(colors) : colors, r(weight[0], weight[1]), 0.5);
  }
}

// A painted surface: flat opaque base, near-tone directional gouache strokes, dry-brush texture,
// charcoal grain. `tones` are colours mixed with the base; angle = stroke direction.
export function paintSurface(c, poly, base, tones, { angle = 0, spacing = 10, len = [40, 140], weight = [1.6, 3.2], dry = 0.5, grain = 0.4, seed = 0, margin = 2, mix = [0.12, 0.4], opacity = 255, brush = 'mach_flat' } = {}) {
  const r = rng('ps' + seed + c.name);
  c.washPoly(poly, base, opacity);
  c.flush();
  const pick = () => mixHex(base, r.pick(tones), r(mix[0], mix[1]));
  const cols = Array.from({ length: 7 }, pick);
  strokesIn(c, poly, { angle, spacing, len, colors: cols, brush, weight: [weight[0] * 0.3, weight[1] * 0.3], jitter: 0.2, bend: 0.03, gap: [2, 12], seed, margin });
  if (dry > 0) strokesIn(c, poly, { angle, spacing: spacing * 2.2, len: [len[0] * 0.6, len[1] * 0.8], colors: cols, brush: 'dry', weight: [0.25, 0.5], density: dry, seed: seed + 7, margin });
  if (grain > 0) strokesIn(c, poly, { angle: angle + 0.3, spacing: spacing * 3, len: [20, 60], colors: cols, brush: 'charcoal', weight: [0.4, 0.8], density: grain, seed: seed + 13, margin });
}

// A vertical cylinder (pipe, piston rod, column) in the rect x..x+w, y..y+h: structured bands of
// light -> body -> shadow, strokes along the axis inside each band, a sharp highlight line.
export function paintCylinderV(c, x, y, w, h, base, { light = '#ffffff', dark = '#000000', seed = 0, hi = null, lightSide = -1 } = {}) {
  const r = rng('cyl' + seed + c.name);
  c.washPoly(rectPts(x, y, w, h), base, 255);
  c.flush();
  const bands = [[0, 0.22, dark, 0.35], [0.22, 0.42, base, 0], [0.42, 0.6, light, 0.28], [0.6, 0.8, base, 0.05], [0.8, 1, dark, 0.5]];
  for (const [u0, u1, col, k] of bands) {
    const a = lightSide < 0 ? u0 : 1 - u1, b = lightSide < 0 ? u1 : 1 - u0;
    const bx0 = x + w * a, bx1 = x + w * b;
    const tone = mixHex(base, col, k);
    c.washPoly(rectPts(bx0, y, bx1 - bx0, h), tone, 200);
    const n = Math.max(2, Math.round(((bx1 - bx0) / w) * 8));
    for (let i = 0; i < n; i++) {
      const sx = lerp(bx0, bx1, (i + 0.5) / n);
      let yy = y + r(0, 30);
      while (yy < y + h - 10) {
        const L = Math.min(r(h * 0.15, h * 0.5), y + h - yy);
        c.strokePath([[sx + r(-1, 1), yy, 1], [sx + r(-1.5, 1.5), yy + L, 1]], 'mach_flat', mixHex(tone, r.pick([light, dark, base]), r(0.05, 0.2)), (w / n) / 5 * r(0.6, 1), 0);
        yy += L + r(10, 60);
      }
    }
  }
  const hx = lightSide < 0 ? x + w * 0.5 : x + w * 0.5;
  c.strokePath([[hx, y + 4, 0.6], [hx, y + h * 0.5, 1.1], [hx, y + h - 4, 0.6]], 'mach_line', hi || mixHex(base, light, 0.75), Math.max(0.5, w / 60), 0);
}

// Straight-edged ink contour (no spline rounding): polyline segments with pressure.
export function inkRect(c, pts, { color = '#1b1020', weight = 1, brush = 'mach_line', seed = 0, lost = 0.1, closed = true } = {}) {
  const r = rng('ir' + seed + c.name);
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m = Math.max(2, Math.ceil(L / 40));
    let seg = [];
    for (let q = 0; q <= m; q++) {
      const u = q / m;
      if (q > 0 && q < m && r() < lost * 0.5) { if (seg.length > 1) c.strokePath(seg, brush, color, weight, 0); seg = []; continue; }
      seg.push([a[0] + (b[0] - a[0]) * u + r(-0.4, 0.4), a[1] + (b[1] - a[1]) * u + r(-0.4, 0.4), lerp(0.7, 1.2, r())]);
    }
    if (seg.length > 1) c.strokePath(seg, brush, color, weight, 0);
  }
}

// Ink contour with pressure variation and "lost" gaps.
export function contour(c, pts, { closed = true, color = '#1b1020', weight = 1, brush = 'mach_line', lost = 0.15, seed = 0, wobble = 0 } = {}) {
  const r = rng('ct' + seed + c.name);
  const P = closed ? pts.concat([pts[0]]) : pts.slice();
  // resample into segments; drop a few to create lost edges
  let seg = [];
  const flush = () => {
    if (seg.length > 1) c.strokePath(seg, brush, color, weight * r(0.8, 1.15), 0.4);
    seg = [];
  };
  for (let i = 0; i < P.length; i++) {
    const [x, y] = P[i];
    const pr = lerp(0.55, 1.25, 0.5 + 0.5 * Math.sin(i * 0.7 + r(0, 6)));
    seg.push([x + r(-wobble, wobble), y + r(-wobble, wobble), pr]);
    if (seg.length > 6 && r() < lost * 0.35) flush();
  }
  flush();
}

// Bright glints: short strokes.
export function glints(c, pts, { color = '#fff4d6', weight = [0.4, 0.9], len = [6, 18], angle = 0, seed = 0, brush = 'mach_line' } = {}) {
  const r = rng('gl' + seed + c.name);
  for (const [x, y] of pts) {
    const L = r(len[0], len[1]), a = angle + r(-0.2, 0.2);
    c.strokePath([[x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2, 0.5], [x, y, 1.2], [x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2, 0.5]], brush, color, r(weight[0], weight[1]), 0.5);
  }
}

// Rivets / bolt heads: small dark discs with a light dot.
export function rivets(c, pts, { r = 3, dark = '#2a1a14', light = '#f5d9a0' } = {}) {
  for (const [x, y] of pts) {
    const circ = [];
    for (let q = 0; q < 10; q++) circ.push([x + Math.cos((q / 10) * TAU) * r, y + Math.sin((q / 10) * TAU) * r]);
    c.washPoly(circ, dark, 230);
    c.strokePath([[x - r * 0.45, y - r * 0.35], [x - r * 0.1, y - r * 0.55]], 'mach_line', light, r * 0.18, 0.4);
  }
}
