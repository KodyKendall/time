// Reusable painting + animation helpers for scenes.
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep } from '../../engine/math.js';

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------
export function circlePts(cx, cy, r, n = 64, a0 = 0, a1 = TAU) {
  const pts = [];
  const closed = Math.abs(a1 - a0 - TAU) < 1e-6;
  const cnt = closed ? n : n + 1;
  for (let i = 0; i < cnt; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
export function ellipsePts(cx, cy, rx, ry, rot = 0, n = 96, a0 = 0, a1 = TAU) {
  const pts = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}
// Crescent (shadow side of a disc lit from direction `light` angle).
export function crescentPts(cx, cy, r, lightAngle, depth = 0.45, n = 40) {
  const pts = [];
  const sa = lightAngle + Math.PI; // shadow side center angle
  for (let i = 0; i <= n; i++) {
    const a = sa - Math.PI / 2 + (Math.PI * i) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  // inner terminator (ellipse arc), going back
  const tx = Math.cos(sa), ty = Math.sin(sa);
  for (let i = n; i >= 0; i--) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    const along = Math.cos(a) * r * (1 - depth * 2) ;
    const across = Math.sin(a) * r;
    pts.push([cx + tx * along - ty * across, cy + ty * along + tx * across]);
  }
  return pts;
}
export function polyBounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
// Resample a polyline to n points evenly by arc length.
export function resample(pts, n) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[L.length - 1] || 1;
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (total * i) / (n - 1);
    while (j < L.length - 2 && L[j + 1] < d) j++;
    const seg = L[j + 1] - L[j] || 1;
    const t = (d - L[j]) / seg;
    out.push([lerp(pts[j][0], pts[j + 1][0], t), lerp(pts[j][1], pts[j + 1][1], t)]);
  }
  return out;
}
export function lerpPts(a, b, t) {
  return a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]);
}
// Sub-path of a polyline between fractions f0..f1 of its length.
export function subPath(pts, f0, f1, n = 0) {
  if (f1 <= f0) return [];
  const count = n || Math.max(2, Math.ceil(pts.length * (f1 - f0)) + 1);
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[L.length - 1];
  const at = (d) => {
    let j = 0;
    while (j < L.length - 2 && L[j + 1] < d) j++;
    const seg = L[j + 1] - L[j] || 1;
    const t = clamp((d - L[j]) / seg);
    return [lerp(pts[j][0], pts[j + 1][0], t), lerp(pts[j][1], pts[j + 1][1], t)];
  };
  const out = [];
  for (let i = 0; i < count; i++) out.push(at(total * lerp(f0, f1, i / (count - 1))));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Painted sprites
// ---------------------------------------------------------------------------------------------
// Paint a shaded ball (planet, nucleon, cell) centered at (cx,cy) radius r on a painting ctx.
export function paintBall(c, cx, cy, r, base, { shadow = null, light = null, lightAngle = -2.3, rim = null, outline = null, texture = 0.55, detail = null, seed = 0 } = {}) {
  const { brush } = c;
  const sh = shadow || mixHex(base, '#1b1030', 0.45);
  const li = light || mixHex(base, '#fff6e0', 0.45);
  const disc = c.blob(cx, cy, r, r, { n: 72, wobble: 0.012, seed });
  c.washPoly(disc, base, 255);
  c.fillPoly(disc, mixHex(base, '#ffffff', 0.08), { opacity: 170, bleed: 0.01, texture, border: 0.45 });
  c.fillPoly(crescentPts(cx, cy, r * 0.985, lightAngle, 0.42), sh, { opacity: 150, bleed: 0.02, texture: 0.5, border: 0.2 });
  if (detail) detail(c);
  const hx = cx + Math.cos(lightAngle) * r * 0.42, hy = cy + Math.sin(lightAngle) * r * 0.42;
  c.fillPoly(c.blob(hx, hy, r * 0.33, r * 0.26, { n: 40, wobble: 0.08, rot: lightAngle, seed: seed + 3 }), li, { opacity: 120, bleed: 0.05, texture: 0.4, border: 0.1 });
  if (rim) {
    brush.set('ink', rim, Math.max(0.5, r / 60));
    brush.noFill();
    brush.arc(cx, cy, r * 0.96, lightAngle + 2.2, lightAngle + 4.1);
  }
  if (outline) {
    brush.set('ink', outline, Math.max(0.6, r / 50));
    brush.noFill();
    brush.circle(cx, cy, r, 0.3);
  }
}

// Tapered ribbon polygon along a polyline pts ([x,y] or [x,y,w]); widths in design units.
export function ribbon(pts, w0, w1) {
  const n = pts.length;
  if (n < 2) return [];
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const t = i / (n - 1);
    const w = (pts[i][2] !== undefined ? pts[i][2] : 1) * lerp(w0, w1, t) * 0.5;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return L.concat(R.reverse());
}

// A painted ground: base wash + many long, gently curving brush strokes in near-tones, charcoal
// scumbles and stipple — so even "empty" darkness reads as paint on a canvas.
export function paintCanvas(c, base, tones, { w = 1920, h = 1080, strokes = 240, angle = 0, curl = 0.25, weight = [3, 9], seed = 0, scumbles = 60, dust = 26 } = {}) {
  const r = c.r;
  c.washPoly([[-20, -20], [w + 20, -20], [w + 20, h + 20], [-20, h + 20]], base, 255);
  const pick = () => mixHex(base, r.pick(tones), r(0.25, 0.85));
  for (let i = 0; i < strokes; i++) {
    const len = r(260, 900), a = angle + r(-0.25, 0.25);
    let x = r(-200, w), y = r(-40, h + 40);
    const pts = [];
    const n = 7;
    for (let k = 0; k < n; k++) {
      pts.push([x, y, lerp(0.6, 1.1, Math.sin((k / (n - 1)) * Math.PI))]);
      x += Math.cos(a + curl * Math.sin(k * 0.9 + i)) * (len / n);
      y += Math.sin(a + curl * Math.sin(k * 0.9 + i)) * (len / n);
    }
    c.strokePath(pts, r() < 0.6 ? 'gouache' : 'dry', pick(), r(weight[0], weight[1]) / 5, 0.6);
  }
  for (let i = 0; i < scumbles; i++) {
    const x = r(0, w), y = r(0, h), pts = [];
    for (let k = 0; k < 5; k++) pts.push([x + r(-60, 60), y + r(-30, 30)]);
    c.strokePath(pts, 'charcoal', pick(), r(1.5, 3), 0.8);
  }
  for (let i = 0; i < dust; i++) {
    const x = r(0, w), y = r(0, h), a = r(0, 6.28);
    c.line(x, y, x + Math.cos(a) * r(80, 260), y + Math.sin(a) * r(80, 260), 'dust', pick(), 0.8);
  }
}

// Paint a sprite atlas: cells of size `cell` design units, `cols` per row; fn(c, cx, cy, i).
export function atlas(P, name, count, cell, fn, { cols = 8, scale = 1 } = {}) {
  const rows = Math.ceil(count / cols);
  const w = cols * cell, h = rows * cell;
  const L = P.layer(name, { w, h, scale }, (c) => {
    for (let i = 0; i < count; i++) {
      const cx = (i % cols) * cell + cell / 2, cy = Math.floor(i / cols) * cell + cell / 2;
      fn(c, cx, cy, i);
    }
  });
  return {
    layer: L, cell, cols, count,
    uv(i) {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
      return [x / w, y / h, (x + cell) / w, (y + cell) / h];
    },
    // Draw sprite i centered at (x,y) with size s (design units diameter of the cell), rotation r
    draw(R, i, x, y, s, rot = 0, o = {}) {
      const m = M.place(x, y, s / cell, rot, cell / 2, cell / 2);
      R.layer(L, m, { ...o, uv: this.uv(i), w: cell, h: cell });
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Star fields (particles)
// ---------------------------------------------------------------------------------------------
export function makeStars(seed, n, { x0 = -200, y0 = -200, x1 = 2120, y1 = 1280, size = [0.8, 3.2], warm = 0.35 } = {}) {
  const r = rng(seed);
  const stars = [];
  for (let i = 0; i < n; i++) {
    const s = Math.pow(r(), 3.2);
    const col = r() < warm ? hex(mixHex('#ffd9a8', '#ff9f6b', r())) : hex(mixHex('#fff6e8', '#bcd6ff', r()));
    stars.push({ x: r(x0, x1), y: r(y0, y1), s: lerp(size[0], size[1], s), b: lerp(0.35, 1, r()), ph: r(0, TAU), f: r(0.5, 2.5), col });
  }
  return stars;
}
export function starParticles(stars, t, { twinkle = 0.35, alpha = 1, m = null } = {}) {
  const out = [];
  for (const s of stars) {
    const tw = 1 - twinkle + twinkle * (0.5 + 0.5 * Math.sin(t * s.f * 2.1 + s.ph));
    let x = s.x, y = s.y;
    if (m) [x, y] = M.apply(m, x, y);
    out.push([x, y, s.s * 2.2, 0, s.col[0], s.col[1], s.col[2], s.b * tw * alpha]);
  }
  return out;
}

export { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep };
