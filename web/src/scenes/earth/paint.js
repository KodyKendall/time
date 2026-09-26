// EARTH — painterly helpers: spheres painted like a gouache painter would (block-in, soft shadow
// mass, form-following strokes, features, highlights, lost-and-found contour).
import { C, TAU, lerp, clamp, mixHex, fbm2, strokeBatch, hash } from './common.js';

// point on a sphere given angle `th` from the light axis and azimuth `ph` around it.
// Light comes from screen angle `la` (in the image plane, tilted towards the viewer by `lz`).
function sph(th, ph, la, lz) {
  // light axis L (unit), basis U, V orthogonal
  const L = [Math.cos(la) * Math.cos(lz), Math.sin(la) * Math.cos(lz), Math.sin(lz)];
  const U = [-Math.sin(la), Math.cos(la), 0];
  const V = [L[1] * U[2] - L[2] * U[1], L[2] * U[0] - L[0] * U[2], L[0] * U[1] - L[1] * U[0]];
  const s = Math.sin(th), c = Math.cos(th);
  const x = L[0] * c + (U[0] * Math.cos(ph) + V[0] * Math.sin(ph)) * s;
  const y = L[1] * c + (U[1] * Math.cos(ph) + V[1] * Math.sin(ph)) * s;
  const z = L[2] * c + (U[2] * Math.cos(ph) + V[2] * Math.sin(ph)) * s;
  return [x, y, z];
}

// pal: { base, light:[], mid:[], shadow:[], deep, rim, hi }
// o: { la (light screen angle, default PI = from the left), lz (towards viewer), n (stroke count),
//      terminator (0..PI, default ~1.75), seed, features(c, cx, cy, R, toScreen), contour }
export function paintSphere(c, cx, cy, R, pal, o = {}) {
  const r = c.r;
  const la = o.la ?? Math.PI, lz = o.lz ?? 0.45;
  const seed = o.seed ?? 'sph';
  const disc = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU;
    const w = 1 + (o.wobble ?? 0.006) * Math.sin(a * 5 + 1.3) + (o.wobble ?? 0.006) * 0.6 * Math.sin(a * 11 + 0.4);
    disc.push([cx + Math.cos(a) * R * w, cy + Math.sin(a) * R * w]);
  }
  c.washPoly(disc, pal.base, 255);
  c.fillPoly(disc, pal.mid[0], { opacity: 110, bleed: 0.015, texture: 0.8, border: 0.55 });
  // shadow mass: stepped washes beyond the terminator, soft painted edge
  const term = o.terminator ?? 1.72;
  const darkA = la + Math.PI;
  const shadowPoly = (thEdge) => {
    const n = 120, P = [];
    for (let i = 0; i < n; i++) P.push(sph(thEdge, (i / n) * TAU, la, lz));
    const s0 = P.findIndex((p) => p[2] < 0);
    if (s0 < 0) return P.map((p) => [cx + p[0] * R, cy + p[1] * R]);
    const run = [];
    for (let k = 1; k <= n; k++) {
      const p = P[(s0 + k) % n];
      if (p[2] >= 0) run.push(p);
      else if (run.length) break;
    }
    if (run.length < 2) return [];
    const a0 = Math.atan2(run[0][1], run[0][0]), a1 = Math.atan2(run[run.length - 1][1], run[run.length - 1][0]);
    // limb arc from a1 back to a0 through the dark side
    let ccw = ((a0 - a1) % TAU + TAU) % TAU;
    const dd = ((darkA - a1) % TAU + TAU) % TAU;
    const sweep = dd <= ccw ? ccw : -(TAU - ccw);
    const pts = run.map((p) => [cx + p[0] * R, cy + p[1] * R]);
    for (let i = 0; i <= 40; i++) {
      const a = a1 + (sweep * i) / 40;
      pts.push([cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02]);
    }
    return pts;
  };
  const steps = o.shadowSteps ?? [[-0.22, 45], [-0.1, 70], [0.02, 100], [0.16, 130], [0.34, 170]];
  steps.forEach(([d, op], k) => {
    const sp = shadowPoly(term + d);
    if (sp.length > 2) c.washPoly(sp, k < 2 ? pal.shadow[0] : k < 4 ? pal.shadow[1 % pal.shadow.length] : pal.deep, op);
  });
  c.flush();
  // form strokes: arcs around the light axis (parallel to the terminator), colour by illumination
  const N = o.n ?? 160;
  const list = [];
  for (let k = 0; k < N; k++) {
    const th = Math.acos(clamp(1 - 2 * Math.pow(r(), 0.9), -1, 1)) * 0.98;
    const ph0 = r(0, TAU), span = r(0.7, 1.7) * (1.2 - 0.4 * Math.sin(th));
    const pts = [];
    for (let j = 0; j <= 12; j++) {
      const ph = ph0 + (span * j) / 12;
      const wob = 0.035 * fbm2(ph * 2 + k, th * 3, 5);
      const p = sph(th + wob, ph, la, lz);
      if (p[2] < 0.06) { if (pts.length > 2) break; continue; }
      // thinner towards the limb so marks stay inside the silhouette
      pts.push([cx + p[0] * R * 0.985, cy + p[1] * R * 0.985, (0.35 + 0.7 * Math.sin((Math.PI * j) / 12)) * Math.min(1, 0.35 + p[2] * 1.3)]);
    }
    if (pts.length < 3) continue;
    const illum = Math.cos(th); // 1 lit .. -1 dark
    const light = illum > 0.55 ? r.pick(pal.light) : illum > 0.05 ? r.pick(pal.mid) : illum > -0.25 ? r.pick(pal.shadow) : pal.deep;
    const col = r() < 0.18 ? mixHex(light, r.pick(pal.mid), 0.5) : light;
    const bw = (o.strokeW ?? 1.8) * R / 100;
    list.push({ pts, brush: r() < 0.5 ? 'earth_body' : r() < 0.6 ? 'dry' : 'pastel', color: col, w: bw * r(0.45, 0.9), curv: 0.55, seed: `${seed}f${k}` });
  }
  strokeBatch(c, list);
  if (o.features) o.features(c, cx, cy, R, (th, ph) => {
    const p = sph(th, ph, la, lz);
    return p[2] > 0 ? [cx + p[0] * R, cy + p[1] * R, p[2]] : null;
  });
  // broken dry-brush texture over everything
  const dry = [];
  for (let k = 0; k < Math.round(N * 0.35); k++) {
    const th = Math.acos(clamp(1 - 2 * r(), -1, 1)), ph0 = r(0, TAU), pts = [];
    for (let j = 0; j <= 5; j++) {
      const p = sph(th, ph0 + j * 0.12, la, lz);
      if (p[2] < 0.05) continue;
      pts.push([cx + p[0] * R, cy + p[1] * R]);
    }
    if (pts.length < 3) continue;
    const illum = Math.cos(th);
    dry.push({ pts, brush: 'dry', color: illum > 0.2 ? r.pick(pal.light.concat(pal.mid)) : r.pick(pal.shadow), w: (R / 100) * r(0.3, 0.6), curv: 0.5, seed: `${seed}d${k}` });
  }
  strokeBatch(c, dry);
  // highlights near the sub-light point
  const hi = [];
  for (let k = 0; k < (o.hiN ?? 5); k++) {
    const th = r(0.1, 0.6), ph0 = r(0, TAU), pts = [];
    for (let j = 0; j <= 4; j++) { const p = sph(th, ph0 + j * 0.18, la, lz); pts.push([cx + p[0] * R, cy + p[1] * R, 1 - j * 0.15]); }
    hi.push({ pts, brush: 'pastel', color: pal.hi, w: (R / 100) * r(0.6, 1.0), curv: 0.5, seed: `${seed}h${k}` });
  }
  strokeBatch(c, hi);
  // lost-and-found contour: found on the shadow side, lost on the light side
  if (o.contour !== false) {
    const ct = [];
    for (let k = 0; k < 4; k++) {
      const a0 = darkA - 1.3 + k * 0.62 + r(-0.1, 0.1), pts = [];
      for (let j = 0; j <= 10; j++) {
        const a = a0 + (0.62 * j) / 10;
        pts.push([cx + Math.cos(a) * R * 0.998, cy + Math.sin(a) * R * 0.998, 0.25 + Math.sin((Math.PI * j) / 10)]);
      }
      ct.push({ pts, brush: k % 2 ? 'crayon' : 'ink', color: pal.rim ?? mixHex(pal.deep, '#000000', 0.3), w: (R / 100) * 1.2, curv: 0.5, seed: `${seed}c${k}` });
    }
    // a touch of reflected light / rim light on the lit edge
    for (let k = 0; k < 2; k++) {
      const a0 = la - 0.7 + k * 0.6, pts = [];
      for (let j = 0; j <= 8; j++) {
        const a = a0 + (0.55 * j) / 8;
        pts.push([cx + Math.cos(a) * R * 0.955, cy + Math.sin(a) * R * 0.955, Math.sin((Math.PI * j) / 8)]);
      }
      ct.push({ pts, brush: 'pastel', color: pal.hi, w: (R / 100) * 0.7, curv: 0.5, seed: `${seed}l${k}` });
    }
    strokeBatch(c, ct);
  }
}

// crater drawn as a painter would: a shadowed bowl (dark crescent on the light side of the bowl)
// plus a lit rim on the far side. p: [x, y, z] screen point from the sphere mapper.
export function crater(c, p, rad, la, dark, lit, seed) {
  if (!p) return;
  const [x, y, z] = p;
  const sq = clamp(z, 0.2, 1); // foreshortening
  const list = [];
  const mk = (a0, a1, col, w, s) => {
    const pts = [];
    for (let j = 0; j <= 8; j++) {
      const a = a0 + ((a1 - a0) * j) / 8;
      pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad * sq, Math.sin((Math.PI * j) / 8)]);
    }
    list.push({ pts, brush: 'earth_body', color: col, w, curv: 0.5, seed: s });
  };
  mk(la - 1.3, la + 1.3, dark, rad / 22, seed + 'a');
  mk(la + Math.PI - 1.1, la + Math.PI + 1.1, lit, rad / 30, seed + 'b');
  strokeBatch(c, list);
}
