// CITY — the town as painted cards placed in 3D: growth, lighting and drawing of buildings,
// ground layers and streets. Every surface samples a p5.brush painting.
import { lerp, clamp, mixHex, hex } from '../lib/kit.js';
import { ease, smoothstep } from '../../engine/math.js';
import { BAND, bw, BUILDINGS, FLOOR, GROUND, MAIN, STREETS, RIVER } from './layout.js';
import { FRONTS, SIDES, SIDE_OF } from './catalog.js';
import { facadeSize, MX } from './paintFacade.js';
import { ROOF, AVE, LANE, RV, TRACK, COB, PARAPET } from './paintCity.js';

const AX = BAND.ax, AY = BAND.ay, NX = BAND.nx, NY = BAND.ny;
const SIZES = FRONTS.map(facadeSize);
const SSIZES = SIDES.map(facadeSize);
// direction towards the sun in the ground plane (sun low in the upper-left of the pivot view)
const TOSUN = (() => { const x = -0.62, y = -0.78, d = Math.hypot(x, y); return [x / d, y / d]; })();

// ------------------------------------------------------------------------------------------------
// light: time of day (0 day .. 1 golden .. 2 dusk .. 3 night)
// ------------------------------------------------------------------------------------------------
export function dayPhase(lt) {
  return 1.0 * smoothstep(1.0, 3.0, lt) + 1.0 * smoothstep(2.6, 4.4, lt) + 0.6 * smoothstep(4.2, 6.0, lt);
}
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const SUN = [[1.03, 1.0, 0.94], [1.16, 0.93, 0.72], [0.78, 0.64, 0.72], [0.58, 0.58, 0.78]];
const SHADE = [[0.74, 0.76, 0.94], [0.66, 0.64, 0.88], [0.52, 0.52, 0.76], [0.46, 0.48, 0.72]];
const stage = (arr, ph) => {
  const i = Math.min(2, Math.floor(ph)), t = ph - i;
  return mix3(arr[i], arr[Math.min(3, i + 1)], t);
};
export function lightAt(lt) {
  const ph = dayPhase(lt);
  const sun = stage(SUN, ph), shade = stage(SHADE, ph);
  // ground: untouched at lt = 0 (pivot), then follows the light
  const ground = mix3([1, 1, 1], mix3(sun, shade, 0.45), smoothstep(0.6, 3.0, lt));
  const contrast = 1 - smoothstep(2.4, 4.4, lt) * 0.8; // directional light fades at dusk
  return { ph, sun, shade, ground, contrast, night: smoothstep(2.8, 4.8, lt) };
}
// tint for a surface with horizontal outward normal m (or roof), per light state
export function faceTint(L, lam, roof = false) {
  const k = roof ? 0.55 + 0.45 * lam : lam;
  const c = mix3(L.shade, L.sun, lerp(0.55, k, L.contrast));
  return [c[0], c[1], c[2], 1];
}

// ------------------------------------------------------------------------------------------------
// building growth: null before birth, else current footprint (w along s, d along o) and heights
// ------------------------------------------------------------------------------------------------
export function growth(b, lt) {
  if (lt < b.birth) return null;
  const sz = SIZES[b.spec];
  const W = b.s1 - b.s0, D = b.o1 - b.o0;
  const pop = ease.outBack(clamp((lt - b.birth) / 0.34));
  let w, d, h, steep = 0.32;
  if (b.house) {
    const g = ease.inOutCubic(clamp((lt - b.grow) / b.dur));
    const cw = Math.min(58, W), cd = Math.min(50, D);
    w = lerp(cw, W, g) * pop;
    d = lerp(cd, D, g) * pop;
    h = lerp(GROUND * 1.02, sz.th, g) * ease.outCubic(clamp((lt - b.birth) / 0.3));
    steep = lerp(0.52, 0.32, g);
  } else {
    const g = clamp((lt - b.birth) / b.dur);
    w = W * lerp(0.35, 1, pop);
    d = D * lerp(0.35, 1, pop);
    h = sz.th * ease.inOutSine(g);
  }
  const hBody = Math.min(h, sz.Hb);
  return { w, d, h, hBody, rh: Math.min(w, d) * steep, sz };
}

// ------------------------------------------------------------------------------------------------
// drawing helpers
// ------------------------------------------------------------------------------------------------
const P3 = (s, o, z) => [BAND.ox + s * AX + o * NX, BAND.oy + s * AY + o * NY, z];

// wall between ground points p,q (band coords [s,o]) with outward normal m (world 2D), heights z0..z1.
// u runs left->right as seen from outside; uv = [u0, u1, v0(top), v1(bottom)]
export function wall(r3, tex, p, q, m, z0, z1, uv, o) {
  const rx = m[1], ry = -m[0]; // viewer's right when facing the wall
  const P = P3(p[0], p[1], 0), Q = P3(q[0], q[1], 0);
  let A = P, B = Q;
  if ((Q[0] - P[0]) * rx + (Q[1] - P[1]) * ry < 0) { A = Q; B = P; }
  r3.poly(tex, [[A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1]], [[uv[0], uv[3]], [uv[1], uv[3]], [uv[1], uv[2]], [uv[0], uv[2]]], o);
}
const visible = (cam, p, m) => (cam.pos[0] - p[0]) * m[0] + (cam.pos[1] - p[1]) * m[1] > 0;

// painted ink contour along a 3D edge: a thin strip, ~constant width on screen, pressure-varied stroke
export function inkEdge(r3, A, cam, P, Q, px, cell, alpha = 0.85) {
  const dx = Q[0] - P[0], dy = Q[1] - P[1], dz = Q[2] - P[2];
  const off = (X) => {
    const vx = X[0] - cam.pos[0], vy = X[1] - cam.pos[1], vz = X[2] - cam.pos[2];
    // perpendicular to the edge and to the view ray
    let nx = dy * vz - dz * vy, ny = dz * vx - dx * vz, nz = dx * vy - dy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const d = Math.max(1, cam.depth(X[0], X[1], X[2]));
    const w = (px * d) / cam.f;
    return [(nx / nl) * w, (ny / nl) * w, (nz / nl) * w];
  };
  if (cam.depth(P[0], P[1], P[2]) < 1 && cam.depth(Q[0], Q[1], Q[2]) < 1) return;
  const oP = off(P), oQ = off(Q);
  const u0 = cell / 4, u1 = (cell + 1) / 4;
  r3.poly(A.edges, [[P[0] - oP[0], P[1] - oP[1], P[2] - oP[2]], [P[0] + oP[0], P[1] + oP[1], P[2] + oP[2]], [Q[0] + oQ[0], Q[1] + oQ[1], Q[2] + oQ[2]], [Q[0] - oQ[0], Q[1] - oQ[1], Q[2] - oQ[2]]],
    [[u0, 0.02], [u1, 0.02], [u1, 0.98], [u0, 0.98]], { tint: [0.9, 0.85, 1, alpha] });
}

// hip roof over footprint (band coords) at height z, ridge height rh, eave overhang e
export function hipRoof(r3, tex, s0, s1, o0, o1, z, rh, uvOff, tint, cam, eave = 2.5, edges = null) {
  s0 -= eave; s1 += eave; o0 -= eave; o1 += eave;
  const w = s1 - s0, d = o1 - o0;
  const S = ROOF.S;
  const alongS = w >= d;
  const half = Math.min(w, d) / 2;
  const r0 = alongS ? [s0 + half, (o0 + o1) / 2] : [(s0 + s1) / 2, o0 + half];
  const r1 = alongS ? [s1 - half, (o0 + o1) / 2] : [(s0 + s1) / 2, o1 - half];
  const zr = z + rh;
  const c00 = [s0, o0], c10 = [s1, o0], c11 = [s1, o1], c01 = [s0, o1];
  const slope = Math.hypot(half, rh);
  const nS = [AX, AY], nO = [NX, NY], mS = [-AX, -AY], mO = [-NX, -NY];
  // faces: eave a -> b, ridge points, outward normal; edges: [p, q, faceA, faceB|-1, isEave]
  let faces, E;
  if (alongS) {
    faces = [[c00, c10, [r1, r0], mO], [c11, c01, [r0, r1], nO], [c10, c11, [r1], nS], [c01, c00, [r0], mS]];
    E = [[c00, c10, 0, -1, 1], [c11, c01, 1, -1, 1], [c10, c11, 2, -1, 1], [c01, c00, 3, -1, 1], [c00, r0, 0, 3], [c10, r1, 0, 2], [c11, r1, 1, 2], [c01, r0, 1, 3], [r0, r1, 0, 1]];
  } else {
    faces = [[c01, c00, [r0, r1], mS], [c10, c11, [r1, r0], nS], [c00, c10, [r0], mO], [c11, c01, [r1], nO]];
    E = [[c01, c00, 0, -1, 1], [c10, c11, 1, -1, 1], [c00, c10, 2, -1, 1], [c11, c01, 3, -1, 1], [c00, r0, 0, 2], [c10, r0, 1, 2], [c11, r1, 1, 3], [c01, r1, 0, 3], [r0, r1, 0, 1]];
  }
  const vis = [], wallVis = [];
  faces.forEach(([a, b, ridge, m]) => {
    const pts = [P3(a[0], a[1], z), P3(b[0], b[1], z)];
    for (const rp of ridge) pts.push(P3(rp[0], rp[1], zr));
    const nx = m[0] * rh, ny = m[1] * rh, nz = half;
    const cx = (pts[0][0] + pts[1][0]) / 2, cy = (pts[0][1] + pts[1][1]) / 2;
    const v = (cam.pos[0] - cx) * nx + (cam.pos[1] - cy) * ny + (cam.pos[2] - z) * nz > 0;
    vis.push(v);
    wallVis.push((cam.pos[0] - cx) * m[0] + (cam.pos[1] - cy) * m[1] > 0);
    if (!v) return;
    const ex = pts[1][0] - pts[0][0], ey = pts[1][1] - pts[0][1], el = Math.hypot(ex, ey);
    const ux = ex / el, uy = ey / el;
    const uvs = pts.map((p, i) => {
      const du = (p[0] - pts[0][0]) * ux + (p[1] - pts[0][1]) * uy;
      const dv = i < 2 ? 0 : slope;
      return [uvOff[0] + du / S, uvOff[1] + (slope - dv) / S + 0.02];
    });
    const lam = Math.max(0, m[0] * TOSUN[0] + m[1] * TOSUN[1]);
    r3.poly(tex, pts, uvs, { tint: tint(lam) });
  });
  if (edges) {
    for (const [p, q, fa, fb, eaveEdge] of E) {
      const show = eaveEdge ? vis[fa] || wallVis[fa] : vis[fa] || (fb >= 0 && vis[fb]);
      if (!show) continue;
      const za = p === r0 || p === r1 ? zr : z, zb = q === r0 || q === r1 ? zr : z;
      if (!eaveEdge && half < 0.5) continue;
      edges(P3(p[0], p[1], za), P3(q[0], q[1], zb));
    }
  }
}

// ------------------------------------------------------------------------------------------------
// the town: buildings sorted far -> near, culled, lit
// ------------------------------------------------------------------------------------------------
export function drawBuildings(r3, A, cam, lt, L, extra = []) {
  const items = [];
  const [cx, cy] = cam.pos;
  for (const b of BUILDINGS) {
    const g = growth(b, lt);
    if (!g) continue;
    const sc = (b.s0 + b.s1) / 2;
    const oF = b.face < 0 ? b.o0 : b.o1;
    const oc = oF - b.face * g.d / 2;
    const C = P3(sc, oc, 0);
    // cull by bounding sphere
    const rad = 0.5 * Math.hypot(g.w, g.d, g.h + g.rh) + 8;
    const sp = cam.toScreen(C[0], C[1], (g.h + g.rh) / 2);
    if (sp[2] < -rad) continue;
    if (sp[2] > 1) {
      const rs = (rad * cam.f) / sp[2];
      if (sp[0] + rs < -60 || sp[0] - rs > 1980 || sp[1] + rs < -60 || sp[1] - rs > 1140) continue;
    }
    items.push({ b, g, sc, oc, oF, d2: (C[0] - cx) ** 2 + (C[1] - cy) ** 2 });
  }
  for (const e of extra) items.push(e);
  items.sort((p, q) => q.d2 - p.d2);
  for (const it of items) {
    if (it.draw) { it.draw(); continue; }
    drawBuilding(r3, A, cam, lt, L, it);
  }
}

function drawBuilding(r3, A, cam, lt, L, { b, g, sc, oF }) {
  const f = FRONTS[b.spec], sz = g.sz;
  const tex = A.fronts[b.spec];
  const side = A.sides[SIDE_OF[f.style]], ssz = SSIZES[SIDE_OF[f.style]];
  const s0 = sc - g.w / 2, s1 = sc + g.w / 2;
  const oB = oF - b.face * g.d;
  const oMin = Math.min(oF, oB), oMax = Math.max(oF, oB);
  const nF = [b.face * NX, b.face * NY], nB = [-nF[0], -nF[1]];
  const nE = [AX, AY], nW = [-AX, -AY];
  const lamOf = (m) => Math.max(0, m[0] * TOSUN[0] + m[1] * TOSUN[1]);
  const vH = (hh, th) => 1 - hh / th;
  const litThr = 1 - 0.82 * smoothstep(2.7 + b.lit * 1.6, 4.2 + b.lit * 1.6, lt);
  const litTint = [1.08, 0.96, 0.8, 1];
  // side / back walls (body height only), then the front (with roofline), then the roof
  const hs = g.hBody;
  const sideWall = (p, q, m, len, uStart) => {
    const pw = P3(p[0], p[1], 0);
    if (!visible(cam, pw, m)) return;
    const uv = [uStart, uStart + len / ssz.tw, vH(hs, ssz.th), 1];
    const lam = lamOf(m);
    wall(r3, side.tex, p, q, m, 0, hs, uv, { tint: faceTint(L, lam) });
    if (L.night > 0.01) wall(r3, side.lit, p, q, m, 0, hs, uv, { tint: litTint, mask: side.mask, thr: litThr + 0.1, soft: 0.02 });
    if (L.contrast > 0.05 && lam < 0.35) wall(r3, A.hatch, p, q, m, 0, hs, [0, len / 60, 0, hs / 60], { tint: [0.35, 0.3, 0.55, 0.45 * L.contrast * (1 - lam / 0.35)] });
  };
  sideWall([s1, oMin], [s1, oMax], nE, g.d, 0.05);
  sideWall([s0, oMin], [s0, oMax], nW, g.d, 0.3);
  sideWall([s0, oB], [s1, oB], nB, g.w, 0.02);
  // front: centred crop of the painting, bottom-anchored (floors stack as it grows)
  {
    const pw = P3(sc, oF, 0);
    if (visible(cam, pw, nF)) {
      const k = g.w / (b.s1 - b.s0);
      const half = g.w / 2 + MX * k;
      const uv = [0.5 - half / sz.tw, 0.5 + half / sz.tw, vH(g.h, sz.th), 1];
      const lam = lamOf(nF);
      wall(r3, tex.tex, [sc - half, oF], [sc + half, oF], nF, 0, g.h, uv, { tint: faceTint(L, lam) });
      if (L.night > 0.01) wall(r3, tex.lit, [sc - half, oF], [sc + half, oF], nF, 0, g.h, uv, { tint: litTint, mask: tex.mask, thr: litThr, soft: 0.02 });
      if (L.contrast > 0.05 && lam < 0.35) wall(r3, A.hatch, [sc - half, oF], [sc + half, oF], nF, 0, g.hBody, [0, (2 * half) / 60, 0, g.hBody / 60], { tint: [0.35, 0.3, 0.55, 0.4 * L.contrast * (1 - lam / 0.35)] });
    }
  }
  // roof
  const uvOff = [((b.seed * 0.137) % 0.25), ((b.seed * 0.291) % 0.25)];
  // ink contours: corners of the body, then the roof's eaves, hips and ridge
  let ec = Math.floor(b.seed) % 4;
  const edge = (P, Q) => inkEdge(r3, A, cam, P, Q, 1.1, (ec++) % 4, 0.7);
  {
    // a vertical corner is drawn when one of its two walls faces the camera
    const vF = visible(cam, P3(sc, oF, 0), nF), vB = visible(cam, P3(sc, oB, 0), nB);
    const vE = visible(cam, P3(s1, (oF + oB) / 2, 0), nE), vW = visible(cam, P3(s0, (oF + oB) / 2, 0), nW);
    for (const [s, o, a, c] of [[s0, oF, vF, vW], [s1, oF, vF, vE], [s0, oB, vB, vW], [s1, oB, vB, vE]]) if (a || c) edge(P3(s, o, 0), P3(s, o, g.hBody));
  }
  hipRoof(r3, A.roofs[b.roof], s0, s1, oMin, oMax, g.hBody, g.rh, uvOff, (lam) => faceTint(L, lam, true), cam, 2.5, edge);
  // chimneys
  if (b.chimneys && g.hBody > 20) {
    for (let i = 0; i < b.chimneys; i++) {
      const t = i ? 0.28 : 0.72;
      const cs = lerp(s0 + 8, s1 - 8, t), co = lerp(oMin, oMax, 0.5 + (i ? -0.18 : 0.15));
      const z0 = g.hBody, z1 = g.hBody + g.rh * 0.6 + 7;
      drawChimney(r3, A, cam, cs, co, z0, z1, L);
    }
  }
}

function drawChimney(r3, A, cam, s, o, z0, z1, L) {
  const hw = 2.5;
  const c = [[s - hw, o - hw], [s + hw, o - hw], [s + hw, o + hw], [s - hw, o + hw]];
  const norms = [[-NX, -NY], [AX, AY], [NX, NY], [-AX, -AY]];
  for (let k = 0; k < 4; k++) {
    const p = c[k], q = c[(k + 1) % 4], m = norms[k];
    const pw = P3(p[0], p[1], 0);
    if (!visible(cam, pw, m)) continue;
    const lam = Math.max(0, m[0] * TOSUN[0] + m[1] * TOSUN[1]);
    wall(r3, A.chimney, p, q, m, z0, z1, [0, 1, 0, 1], { tint: faceTint(L, lam) });
  }
  if (cam.pos[2] > z1) r3.poly(A.chimney, c.map((p) => P3(p[0], p[1], z1)), [[0.1, 0.02], [0.9, 0.02], [0.9, 0.06], [0.1, 0.06]], { tint: faceTint(L, 1, true) });
}
export function chimneyTops(lt) {
  // world positions of chimney tops for smoke (same placement as drawBuilding)
  const out = [];
  for (const b of BUILDINGS) {
    if (!b.chimneys) continue;
    const g = growth(b, lt);
    if (!g || g.hBody <= 20) continue;
    const sc = (b.s0 + b.s1) / 2, oF = b.face < 0 ? b.o0 : b.o1, oB = oF - b.face * g.d;
    const oMin = Math.min(oF, oB), oMax = Math.max(oF, oB);
    const s0 = sc - g.w / 2, s1 = sc + g.w / 2;
    for (let i = 0; i < b.chimneys; i++) {
      const t = i ? 0.28 : 0.72;
      const cs = lerp(s0 + 8, s1 - 8, t), co = lerp(oMin, oMax, 0.5 + (i ? -0.18 : 0.15));
      out.push({ p: P3(cs, co, g.hBody + g.rh * 0.6 + 7), seed: b.seed + i * 17, b });
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// ground: land, pivot fields, river (drawn by its own reveal), streets (paved progressively)
// ------------------------------------------------------------------------------------------------
export function bandQuad(r3, tex, s0, s1, o0, o1, uv = [0, 0, 1, 1], o = {}) {
  r3.poly(tex, [P3(s0, o0, 0), P3(s1, o0, 0), P3(s1, o1, 0), P3(s0, o1, 0)], [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], o);
}

export function drawGround(r3, A, F, cam, lt, L) {
  const gt = [...L.ground, 1];
  // far + near land (band aligned), then the pivot's own painted fields on top
  bandQuad(r3, A.landFar, -6500, 6500, -6500, 6500, [0, 0, 1, 1], { tint: gt });
  bandQuad(r3, A.landNear, -2600, 2600, -2600, 2600, [0, 0, 1, 1], { tint: gt });
  const Lf = F.land;
  r3.poly(Lf, [[-340, -360, 0], [-340 + Lf.w, -360, 0], [-340 + Lf.w, -360 + Lf.h, 0], [-340, -360 + Lf.h, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], { tint: gt });
}

// the river draws itself along its course: the stretch visible in the opening frame (o = -750..500)
// is drawn over ~1.3 s, the off-screen remainder while the camera is busy with the village
export function riverFront(lt) {
  const r1 = ease.inOutSine(clamp(lt / 1.5));
  const r2 = ease.inOutSine(clamp((lt - 1.3) / 1.3));
  return -800 + 1500 * r1 + 1380 * r2;
}
export function drawRiver(r3, A, lt, L) {
  if (lt <= 0) return;
  const front = riverFront(lt);
  const gt = [...L.ground, 1];
  const pts = [P3(RV.s0, RV.o0, 0.2), P3(RV.s1, RV.o0, 0.2), P3(RV.s1, RV.o1, 0.2), P3(RV.s0, RV.o1, 0.2)];
  const rev = [RV.o0, RV.o0, RV.o1, RV.o1];
  r3.poly(A.river, pts, [[0, 0], [1, 0], [1, 1], [0, 1]], { tint: gt, mode: 2, mask: A.noise, uv2: [[0, 0], [2, 0], [2, 14], [0, 14]], rev, thr: front, soft: 90 });
}

// the village track: a worn earth road drawn along the future main street (river -> east)
export function drawTrack(r3, A, lt, L) {
  const k = ease.inOutSine(clamp((lt - 1.3) / 1.2));
  if (k <= 0) return;
  const gt = [...L.ground, 1];
  const a0 = -470, a1 = lerp(a0, 700, k);
  const o0 = MAIN.oc - TRACK.W / 2 + 8, o1 = MAIN.oc + TRACK.W / 2 + 8;
  const pts = [P3(a0, o0, 0.3), P3(a1, o0, 0.3), P3(a1, o1, 0.3), P3(a0, o1, 0.3)];
  r3.poly(A.track, pts, [[a0 / TRACK.L, 0], [a1 / TRACK.L, 0], [a1 / TRACK.L, 1], [a0 / TRACK.L, 1]], { tint: gt, mode: 2, mask: A.noise, uv2: [[0, 0], [9, 0], [9, 0.4], [0, 0.4]], rev: [a0, a1, a1, a0], thr: a1 + 1, soft: 30 });
  // footpaths from the track to each cottage door
  for (const b of BUILDINGS) {
    if (!b.house || lt < b.birth + 0.2) continue;
    const kk = ease.outCubic(clamp((lt - b.birth - 0.2) / 0.5));
    const sc = (b.s0 + b.s1) / 2, oF = b.face < 0 ? b.o0 : b.o1;
    const oT = MAIN.oc + 8 + (oF < MAIN.oc ? -TRACK.W / 2 + 4 : TRACK.W / 2 - 4);
    const oE = lerp(oT, oF, kk);
    const hw = 4.5, len = Math.abs(oE - oT) / 80;
    const u0 = (b.seed % 1) * 0.3;
    r3.poly(A.path, [P3(sc - hw, oT, 0.35), P3(sc + hw, oT, 0.35), P3(sc + hw, oE, 0.35), P3(sc - hw, oE, 0.35)], [[u0, 0], [u0, 1], [u0 + len, 1], [u0 + len, 0]], { tint: gt });
  }
}

// streets pave themselves outward from the village between lt a..b
export function drawStreets(r3, A, lt, L) {
  const gt = [...L.ground, 1];
  for (const st of STREETS) {
    let a0, a1, tex, uvL, along;
    if (st.kind === 'main') { tex = A.avenue; uvL = AVE.L; }
    else { tex = A.lane; uvL = LANE.L; }
    if (st.kind === 'cross') {
      // runs along o
      const t0 = 2.55 + Math.abs((st.s0 + st.s1) / 2 + 250) / 2200;
      const k = ease.inOutSine(clamp((lt - t0) / 0.9));
      if (k <= 0) continue;
      const oc = MAIN.oc, len = 1800 * k;
      a0 = Math.max(st.o0, oc - len); a1 = Math.min(st.o1, oc + len);
      const pts = [P3(st.s1, a0, 0.4), P3(st.s1, a1, 0.4), P3(st.s0, a1, 0.4), P3(st.s0, a0, 0.4)];
      const u0 = a0 / uvL, u1 = a1 / uvL;
      r3.poly(tex, pts, [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], { tint: gt });
      continue;
    }
    const isMain = st.kind === 'main';
    const t0 = isMain ? 2.3 : 2.6 + Math.abs((st.o0 + st.o1) / 2 - MAIN.oc) / 2600;
    const k = ease.inOutSine(clamp((lt - t0) / (isMain ? 1.1 : 1.0)));
    if (k <= 0) continue;
    // paved outwards from the village with a brushed, grainy front (two halves so the reveal
    // coordinate |s - sc| stays linear across each quad)
    const sc = -250, len = 2400 * k;
    const soft = 60;
    for (const [e0, e1] of [[Math.max(st.s0, sc - len - soft), sc], [sc, Math.min(st.s1, sc + len + soft)]]) {
      if (e1 <= e0) continue;
      const pts = [P3(e0, st.o0, 0.5), P3(e1, st.o0, 0.5), P3(e1, st.o1, 0.5), P3(e0, st.o1, 0.5)];
      const u0 = e0 / uvL, u1 = e1 / uvL;
      const rv = [Math.abs(e0 - sc), Math.abs(e1 - sc), Math.abs(e1 - sc), Math.abs(e0 - sc)];
      r3.poly(tex, pts, [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], { tint: gt, mode: 2, mask: A.noise, uv2: [[e0 / 90, 0], [e1 / 90, 0], [e1 / 90, 1.2], [e0 / 90, 1.2]], rev: rv, thr: len, soft });
      if (isMain) {
        // cobblestones over the carriageway (between the curbs)
        // (in strips between the tram tracks, so the rails stay on top)
        const k = (st.o1 - st.o0) / AVE.W, om = (st.o0 + st.o1) / 2;
        const c0 = st.o0 + AVE.side * k + 1.5, c1 = st.o1 - AVE.side * k - 1.5;
        const strips = [[c0, om - 22 * k - 6.8 * k], [om - 22 * k + 6.8 * k, om + 22 * k - 6.8 * k], [om + 22 * k + 6.8 * k, c1]];
        for (const [a, b] of strips) {
          const cp = [P3(e0, a, 0.55), P3(e1, a, 0.55), P3(e1, b, 0.55), P3(e0, b, 0.55)];
          r3.poly(A.cobbles, cp, [[a / COB.S, e0 / COB.S], [a / COB.S, e1 / COB.S], [b / COB.S, e1 / COB.S], [b / COB.S, e0 / COB.S]], { tint: gt, mode: 2, mask: A.noise, uv2: [[e0 / 90, 0], [e1 / 90, 0], [e1 / 90, 1.2], [e0 / 90, 1.2]], rev: rv, thr: len, soft });
        }
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------
// cast shadows (daylight): multiply-blended hull of the footprint and its sun-projected top,
// overlaid with painted hatching so the shade reads as drawn
// ------------------------------------------------------------------------------------------------
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export function drawShadows(r3, A, cam, lt, L) {
  const k = L.contrast * (1 - L.night);
  if (k < 0.02) return;
  const elev = lerp(0.95, 0.32, smoothstep(0.8, 3.4, lt));
  const len = 1 / Math.tan(elev);
  const sx = -TOSUN[0] * len, sy = -TOSUN[1] * len;
  const polys = [];
  for (const b of BUILDINGS) {
    const g = growth(b, lt);
    if (!g || g.h < 2) continue;
    const sc = (b.s0 + b.s1) / 2, oF = b.face < 0 ? b.o0 : b.o1, oB = oF - b.face * g.d;
    const s0 = sc - g.w / 2, s1 = sc + g.w / 2;
    const hh = g.hBody + g.rh * 0.6;
    const cs = [[s0, oF], [s1, oF], [s1, oB], [s0, oB]].map(([s, o]) => P3(s, o, 0));
    const pts = [];
    for (const c of cs) { pts.push([c[0], c[1]]); pts.push([c[0] + sx * hh, c[1] + sy * hh]); }
    // rough cull
    const sp = cam.toScreen(cs[0][0], cs[0][1], 0);
    if (sp[2] < 0 || sp[0] < -900 || sp[0] > 2800 || sp[1] < -900 || sp[1] > 2000) continue;
    polys.push(hull(pts));
  }
  const tint = [0.5, 0.46, 0.66, 0.62 * k];
  for (const hp of polys) {
    const P = hp.map(([x, y]) => [x, y, 0.8]);
    r3.poly(A.flatTex, P, P.map(() => [0.5, 0.5]), { tint, blend: 'multiply' });
  }
  for (const hp of polys) {
    const P = hp.map(([x, y]) => [x, y, 0.9]);
    r3.poly(A.hatch, P, hp.map(([x, y]) => [x / 70, y / 70]), { tint: [0.3, 0.22, 0.45, 0.3 * k] });
  }
}

// ------------------------------------------------------------------------------------------------
// bridges: stone parapets where the avenue and the lanes cross the river (rise with the paving)
// ------------------------------------------------------------------------------------------------
const pavedLen = (st, lt) => {
  const isMain = st.kind === 'main';
  const t0 = isMain ? 2.3 : 2.6 + Math.abs((st.o0 + st.o1) / 2 - MAIN.oc) / 2600;
  return 2400 * ease.inOutSine(clamp((lt - t0) / (isMain ? 1.1 : 1.0)));
};
export function bridgeItems(r3, A, cam, lt, L) {
  const items = [];
  const tint = faceTint(L, 0.6);
  for (const st of STREETS) {
    if (st.kind === 'cross') continue;
    const om = (st.o0 + st.o1) / 2;
    const sx = RIVER.sAt(om);
    if (sx < st.s0 || sx > st.s1) continue;
    const reach = pavedLen(st, lt) - Math.abs(sx - -250);
    const k = ease.outBack(clamp(reach / 70), 1.2);
    if (k <= 0.01) continue;
    const h = 9 * k;
    const half = 44;
    // cast shadow of the deck on the water, on the side away from the sun
    {
      const away = (NX * TOSUN[0] + NY * TOSUN[1]) > 0 ? -1 : 1; // +1: shadow towards +o
      const oe = away > 0 ? st.o1 : st.o0;
      const w = 14 * k;
      const c = P3(sx, oe + away * w, 0);
      items.push({ d2: (c[0] - cam.pos[0]) ** 2 + (c[1] - cam.pos[1]) ** 2 + 1e6, draw: () => {
        const sh = [0.32, 0.36, 0.52, 0.55 * L.contrast * (1 - L.night) + 0.25];
        r3.poly(A.flatTex, [P3(sx - 30, oe, 0.35), P3(sx + 30, oe, 0.35), P3(sx + 30, oe + away * w, 0.35), P3(sx - 30, oe + away * w, 0.35)], [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]], { tint: sh, blend: 'multiply' });
      } });
    }
    for (const [o, m] of [[st.o0 + 2.5, [NX, NY]], [st.o1 - 2.5, [-NX, -NY]]]) {
      const c = P3(sx, o, 0);
      items.push({
        d2: (c[0] - cam.pos[0]) ** 2 + (c[1] - cam.pos[1]) ** 2,
        draw: () => {
          // both faces of the thin wall: the one facing the camera is drawn
          for (const mm of [m, [-m[0], -m[1]]]) {
            const oo = o + (mm === m ? 0.7 : -0.7) * (m[0] * NX + m[1] * NY);
            const p = P3(sx, oo, 0);
            if ((cam.pos[0] - p[0]) * mm[0] + (cam.pos[1] - p[1]) * mm[1] <= 0) continue;
            wall(r3, A.parapet, [sx - half, oo], [sx + half, oo], mm, 0, h, [0, 88 / PARAPET.L, 1 - h / PARAPET.H, 1], { tint });
          }
          // coping seen from above
          if (cam.pos[2] > h) {
            r3.poly(A.parapet, [P3(sx - half, o - 0.8, h), P3(sx + half, o - 0.8, h), P3(sx + half, o + 0.8, h), P3(sx - half, o + 0.8, h)], [[0.1, 0.02], [0.9, 0.02], [0.9, 0.1], [0.1, 0.1]], { tint });
          }
        },
      });
    }
  }
  return items;
}
