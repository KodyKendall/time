// Shape point clouds for MURMURATION.
//
// Every figure the flock forms is a set of closed polygons in a normalised space
// (x,y in roughly [-1,1], y down). They are sampled into exactly N points, then ordered so that
// point i of one figure is a plausible partner for point i of the next — that ordering is what
// makes the morph read as a flock re-forming rather than a crossfade.
//
// Ordering: points are bucketed by angle around the centroid and, within a bucket, sorted by
// radius. A bird therefore stays on "its" side of the figure and at "its" depth through every
// transformation, so the cloud turns inside out as little as possible.
import { rng, TAU, lerp, clamp } from '../../engine/math.js';

// ---------------------------------------------------------------- polygon math
function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

function area(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

function inside(poly, px, py) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Catmull-Rom resampling of a closed outline: the hand-authored polylines are coarse, and a
// flock traced along straight segments looks faceted.
function smoothClosed(poly, sub = 8) {
  const n = poly.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n], p1 = poly[i], p2 = poly[(i + 1) % n], p3 = poly[(i + 2) % n];
    for (let j = 0; j < sub; j++) {
      const t = j / sub, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}

// Points along a closed outline, spaced by arc length and pushed a little inside.
function samplePerimeter(poly, n, r, inset) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    total += L;
    seg.push({ a, b, L, at: total });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = ((i + r(0, 0.9)) / n) * total;
    let k = 0;
    while (k < seg.length - 1 && seg[k].at < d) k++;
    const s = seg[k];
    const u = clamp(1 - (s.at - d) / (s.L || 1));
    const x = lerp(s.a[0], s.b[0], u), y = lerp(s.a[1], s.b[1], u);
    // inward normal, so the band hugs the silhouette from the inside
    const nx = -(s.b[1] - s.a[1]) / (s.L || 1), ny = (s.b[0] - s.a[0]) / (s.L || 1);
    const off = r(-0.18, 1) * inset;
    out.push([x + nx * off, y + ny * off]);
  }
  return out;
}

// Sample n points over a set of polygons. Just over half of them land in a band along the
// outline — a flock is read by its edge, and an evenly filled shape reads as a blob.
const EDGE_SHARE = 0.56;
function samplePolys(polys, n, seed, inset = 0.085) {
  const r = rng(seed);
  const smooth = polys.map((p) => smoothClosed(p));
  const areas = smooth.map(area);
  const perims = smooth.map((poly) => {
    let L = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      L += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return L;
  });
  const areaTotal = areas.reduce((a, b) => a + b, 0) || 1;
  const perimTotal = perims.reduce((a, b) => a + b, 0) || 1;
  const nEdge = Math.round(n * EDGE_SHARE);
  const out = [];

  for (let k = 0; k < smooth.length; k++) {
    const want = Math.round((perims[k] / perimTotal) * nEdge);
    out.push(...samplePerimeter(smooth[k], want, r, inset));
  }
  for (let k = 0; k < smooth.length; k++) {
    const poly = smooth[k];
    const want = k === smooth.length - 1 ? n - out.length : Math.round((areas[k] / areaTotal) * (n - nEdge));
    const stop = Math.min(n, out.length + want);
    const [x0, y0, x1, y1] = bbox(poly);
    let guard = 0;
    while (out.length < stop && guard < want * 400 + 3000) {
      const x = r(x0, x1), y = r(y0, y1);
      guard++;
      if (inside(poly, x, y)) out.push([x, y]);
    }
  }
  // Degenerate safety: if rejection sampling starved, pad along the longest outline.
  if (out.length < n) {
    const k = perims.indexOf(Math.max(...perims));
    out.push(...samplePerimeter(smooth[k], n - out.length, r, inset));
  }
  return out.slice(0, n);
}

// Stable ordering: angular bucket first, radius within the bucket.
const BUCKETS = 96;
function order(pts) {
  let cx = 0, cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts
    .map((p) => {
      const dx = p[0] - cx, dy = p[1] - cy;
      let a = Math.atan2(dy, dx) / TAU;
      if (a < 0) a += 1;
      return { p, b: Math.floor(a * BUCKETS), r: Math.hypot(dx, dy), a };
    })
    .sort((u, v) => (u.b - v.b) || (u.r - v.r))
    .map((u) => u.p);
}

// Normalised figure -> design units, ordered, N points.
function build(polys, n, seed, { cx = 960, cy = 540, s = 1, sy = null, rot = 0 }) {
  const pts = order(samplePolys(polys, n, seed));
  const ky = sy ?? s;
  const c = Math.cos(rot), sn = Math.sin(rot);
  return pts.map(([x, y]) => {
    const X = x * s, Y = y * ky;
    return rot ? [cx + X * c - Y * sn, cy + X * sn + Y * c] : [cx + X, cy + Y];
  });
}

// Wobbly closed blob (organic outlines: crowns, clouds, the loose flock).
function blob(cx, cy, rx, ry, { n = 130, wobble = 0.16, freq = 2.7, seed = 1, squash = null } = {}) {
  const r = rng(seed);
  const p1 = r(0, TAU), p2 = r(0, TAU), p3 = r(0, TAU);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k =
      1 +
      wobble * (0.62 * Math.sin(a * freq + p1) + 0.28 * Math.sin(a * (freq * 2 + 1) + p2) + 0.16 * Math.sin(a * (freq * 3.3 + 2) + p3));
    let x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    if (squash) y *= squash(a);
    out.push([cx + x, cy + y]);
  }
  return out;
}

// A tapered limb (trunk, branch) as a quad with a slight bend.
function limb(x0, y0, x1, y1, w0, w1, bow = 0) {
  const dx = x1 - x0, dy = y1 - y0;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const mx = (x0 + x1) / 2 + nx * bow, my = (y0 + y1) / 2 + ny * bow;
  const wm = (w0 + w1) / 2;
  return [
    [x0 + nx * w0, y0 + ny * w0],
    [mx + nx * wm, my + ny * wm],
    [x1 + nx * w1, y1 + ny * w1],
    [x1 - nx * w1, y1 - ny * w1],
    [mx - nx * wm, my - ny * wm],
    [x0 - nx * w0, y0 - ny * w0],
  ];
}

// ---------------------------------------------------------------- the figures

// A humpback, travelling right. Legibility comes from three things: a jaw notch so the head
// reads as a head, a narrow peduncle, and a wide notched fluke that is unmistakably a tail.
const WHALE = [
  [
    [1.05, -0.02], [0.92, -0.13], [0.70, -0.21], [0.40, -0.26], [0.05, -0.27],   // back
    [-0.30, -0.24], [-0.52, -0.19], [-0.60, -0.27], [-0.70, -0.18],              // dorsal hump
    [-0.92, -0.12], [-1.10, -0.07],                                              // peduncle, narrow
    [-1.26, -0.30], [-1.46, -0.52], [-1.52, -0.38], [-1.40, -0.14], [-1.30, -0.02], // upper lobe
    [-1.42, 0.12], [-1.54, 0.34], [-1.34, 0.30], [-1.16, 0.10], [-1.08, 0.04],   // lower lobe
    [-0.88, 0.14], [-0.55, 0.24], [-0.20, 0.30], [0.16, 0.31], [0.50, 0.27],     // belly
    [0.72, 0.20], [0.88, 0.12], [0.98, 0.06],                                    // jaw
  ],
  limb(0.30, 0.22, -0.16, 0.72, 0.095, 0.030, -0.06),                            // pectoral fin
];

// A broad tree: trunk, three boughs, a deep crown. The crown is most of the mass.
const TREE = [
  ...[
    limb(-0.02, 1.02, 0.0, 0.24, 0.072, 0.048, 0.015),
    limb(-0.01, 0.50, -0.48, 0.08, 0.040, 0.015, 0.07),
    limb(0.01, 0.42, 0.50, 0.02, 0.038, 0.015, -0.07),
    limb(0.0, 0.30, 0.05, -0.14, 0.036, 0.017, 0.02),
  ],
  blob(0.0, -0.46, 1.14, 0.72, { seed: 21, wobble: 0.20, freq: 2.4 }),
  blob(-0.74, -0.08, 0.46, 0.34, { seed: 22, wobble: 0.24, freq: 3.1 }),
  blob(0.76, -0.12, 0.47, 0.35, { seed: 23, wobble: 0.24, freq: 2.9 }),
];

// A human head in profile, facing left. Skull, brow, nose, lips, chin, jaw, neck.
const FACE = [
  [
    [0.06, -1.00], [-0.12, -0.98], [-0.28, -0.90], [-0.40, -0.76], [-0.47, -0.60],
    [-0.52, -0.46], [-0.44, -0.40],                                   // brow ridge, then its notch
    [-0.50, -0.30], [-0.58, -0.20], [-0.74, -0.09],                   // bridge down to the nose tip
    [-0.62, -0.02], [-0.50, 0.00], [-0.48, 0.05],                     // undercut and philtrum
    [-0.57, 0.10], [-0.50, 0.14], [-0.55, 0.20],                      // lips
    [-0.44, 0.26], [-0.50, 0.36], [-0.44, 0.45],                      // chin notch, chin
    [-0.30, 0.56], [-0.12, 0.64], [0.08, 0.66],                       // jaw
    [0.16, 0.90], [0.46, 1.00], [0.52, 0.72],                         // neck
    [0.50, 0.46], [0.54, 0.18], [0.56, -0.16], [0.50, -0.52], [0.38, -0.80], [0.22, -0.94],
  ],
];

// A great swell: a long rising back, a crest that hooks over, a concave face. The three
// figures of ONE OF MANY are chosen to mean something — wave is the world's motion, tree is
// life and shelter, greatbird is the flock seeing itself.
const WAVE = [
  [
    [-1.55, 0.70], [-1.15, 0.58], [-0.75, 0.40], [-0.38, 0.12],   // back of the swell
    [-0.08, -0.18], [0.18, -0.46], [0.42, -0.64],                  // rising to the crest
    [0.64, -0.72], [0.86, -0.66], [0.96, -0.48],                   // the crest
    [0.86, -0.32], [0.66, -0.26], [0.48, -0.33],                   // the lip hooks under
    [0.57, -0.10], [0.50, 0.12], [0.30, 0.31],                     // the concave face
    [0.02, 0.47], [-0.32, 0.59], [-0.72, 0.67], [-1.16, 0.73], [-1.55, 0.77],
  ],
  blob(1.06, -0.60, 0.20, 0.13, { n: 40, wobble: 0.46, freq: 3.2, seed: 41 }),   // spray
  blob(0.80, -0.88, 0.14, 0.10, { n: 34, wobble: 0.52, freq: 3.6, seed: 42 }),
];

// An enormous soaring bird, seen from below. Built like the little sprite that already reads
// — body, head, two swept wings, a fan tail. The first version had level elliptical wings over
// a vertical body and tail, which read unmistakably as a mushroom cloud. Sweeping the wings
// down and out into a V, and pushing the head clear of the shoulders, is what fixes it.
const GREATBIRD = [
  blob(0.0, 0.02, 0.135, 0.38, { n: 40, wobble: 0.10, seed: 51 }),        // body
  blob(0.0, -0.44, 0.105, 0.115, { n: 26, wobble: 0.10, seed: 52 }),      // head, clear of the wings
  limb(-0.09, -0.17, -1.46, 0.30, 0.255, 0.045, 0.24),                    // wings swept down and
  limb(0.09, -0.17, 1.46, 0.30, 0.255, 0.045, -0.24),                     // out, into a shallow V
  limb(0.0, 0.30, 0.0, 0.78, 0.100, 0.205, 0.0),                          // tail fan
];

// Move/scale a figure's polygons, so a figure can be built out of other figures.
function xform(polys, sc, dx, dy) {
  return polys.map((poly) => poly.map(([x, y]) => [x * sc + dx, y * sc + dy]));
}

// TWO BIRDS side by side, and then the identical figure with the right-hand one gone. The
// left bird sits in exactly the same place in both, so the flock says what happened without
// anyone having to interpret a symbol: there were two, and now there is one.
const PAIR_L = xform(GREATBIRD, 0.52, -0.95, -0.12);
const PAIR_R = xform(GREATBIRD, 0.52, 0.95, 0.12);
const TWOBIRDS = [...PAIR_L, ...PAIR_R];
const ONEBIRD = [...PAIR_L];

// A single feather, falling. The oldest shorthand there is for something lost.
const FEATHER = [
  [[0.0, -1.0], [0.13, -0.62], [0.20, -0.18], [0.19, 0.28], [0.12, 0.66], [0.04, 0.95],
   [-0.04, 0.95], [-0.12, 0.66], [-0.19, 0.28], [-0.20, -0.18], [-0.13, -0.62]],
];

// The loose flock: a soft drifting cloud, denser at its heart.
const CLOUD = [blob(0.0, 0.0, 1.12, 0.60, { seed: 31, wobble: 0.26, freq: 2.2 })];

// A bird, wings up mid-beat. Built from solid limbs rather than one thin outline: the
// watercolour fill needs polygons with real width, and at 14 px on screen the union reads
// as a silhouette anyway. Painted facing +x, so a particle's heading rotates it directly.
const BIRD = [
  blob(0.04, 0.0, 0.44, 0.115, { n: 26, wobble: 0.07, seed: 7 }),          // slim body, head at +x
  limb(0.12, -0.03, -0.58, -0.74, 0.155, 0.030, 0.13),                      // wings swept back into
  limb(0.12, 0.03, -0.58, 0.74, 0.155, 0.030, -0.13),                       // a shallow crescent
];

// A formless gathering: radial density falling off to a ragged nothing, with no outline at
// all. Anything with a clean silhouette reads as an object; this has to read as birds.
function buildSwarm(n, seed, { cx, cy, rx, ry }) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = r(0, TAU);
    const u = Math.pow(r(), 0.58);                 // dense in the middle, thinning outward
    pts.push([Math.cos(a) * u * rx * r(0.75, 1.3), Math.sin(a) * u * ry * r(0.7, 1.35)]);
  }
  return order(pts).map(([x, y]) => [cx + x, cy + y]);
}

// ---------------------------------------------------------------- public API
export function figures(N) {
  return {
    cloud: build(CLOUD, N, 'cloud', { cx: 980, cy: 500, s: 560, sy: 330 }),
    swarm: buildSwarm(N, 'swarm', { cx: 960, cy: 500, rx: 700, ry: 330 }),
    wave: build(WAVE, N, 'wave', { cx: 960, cy: 520, s: 560, sy: 470 }),
    greatbird: build(GREATBIRD, N, 'greatbird', { cx: 960, cy: 512, s: 372, sy: 372 }),
    // same centre, same scale for both, so the left bird does not move between them
    twobirds: build(TWOBIRDS, N, 'twobirds', { cx: 960, cy: 470, s: 418, sy: 418 }),
    onebird: build(ONEBIRD, N, 'onebird', { cx: 960, cy: 470, s: 418, sy: 418 }),
    whale: build(WHALE, N, 'whale', { cx: 955, cy: 462, s: 458, sy: 458, rot: -0.05 }),
    tree: build(TREE, N, 'tree', { cx: 950, cy: 598, s: 432, sy: 432 }),
    face: build(FACE, N, 'face', { cx: 930, cy: 468, s: 448, sy: 448, rot: -0.07 }),
  };
}

// Outline of a figure in design units — for the faint ghost line under the flock.
export function outline(which, { cx, cy, s }) {
  const src = { whale: WHALE, tree: TREE, face: FACE }[which];
  return src.map((poly) => poly.map(([x, y]) => [cx + x * s, cy + y * s]));
}

export { BIRD, FEATHER, clamp, lerp };
