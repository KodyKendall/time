// ANCESTORS — a parametric creature rig that morphs continuously: shrew (m = 0) -> primate (m = 1)
// -> early human (m = 2). Proportions, pose and colours are all interpolated, so the morph is one
// continuous transformation. Painted per frame (on twos) with flat facets, fur strokes that follow
// the form, an expressive face, hands, and broken ink contours.
import { TAU, lerp, clamp, mixHex, smoothstep, ellipsePts, ribbon } from '../lib/kit.js';
import { ease, invLerp, noise1 } from '../../engine/math.js';
import { rng } from '../../engine/math.js';

// ---------------------------------------------------------------------------------------------
// Proportions (world units at final size)
// ---------------------------------------------------------------------------------------------
const SHAPES = [
  { // shrew
    spine: 92, hipT: 58, midT: 66, chestT: 52, rump: 0.42, chest: 0.36, hump: 0.18, tuck: 0.0, chestB: 0,
    neck: 8, headR: 27, snout: 48, snoutW: 11, earR: 16, eyeR: 4.4,
    armU: 20, armL: 18, hand: 10, armW: 13, legU: 26, legL: 22, foot: 16, legW: 17,
    tail: 150, tailW: 7, hair: 0, beard: 0, fingers: 0, brow: 0, jaw: 0.25, muscle: 0,
  },
  { // primate (panel 14): arched back, deep chest, long thick arms, crouched legs, big head
    spine: 150, hipT: 92, midT: 104, chestT: 116, rump: 0.3, chest: 0.26, hump: 0.26, tuck: 0.1, chestB: 0.05,
    neck: 20, headR: 46, snout: 26, snoutW: 34, earR: 13, eyeR: 5.8,
    armU: 104, armL: 98, hand: 34, armW: 40, legU: 84, legL: 78, foot: 44, legW: 46,
    tail: 0, tailW: 0, hair: 0.25, beard: 0, fingers: 1, brow: 1, jaw: 0.6, muscle: 1,
  },
  { // early human (panel 15): stocky, broad chest, strong limbs, hair and beard
    spine: 140, hipT: 64, midT: 60, chestT: 82, rump: 0.2, chest: 0.2, hump: 0.12, tuck: 0.12, chestB: 0.16,
    neck: 18, headR: 32, snout: 10, snoutW: 26, earR: 7, eyeR: 4.3,
    armU: 84, armL: 78, hand: 28, armW: 35, legU: 104, legL: 100, foot: 40, legW: 46,
    tail: 0, tailW: 0, hair: 1, beard: 1, fingers: 1, brow: 1, jaw: 0.9, muscle: 1,
  },
];
const COLS = [
  { base: '#e8822c', top: '#f6c24a', shade: '#6e2a57', limb: '#71305a', paw: '#f0a050', ear: '#d8452f', earIn: '#7a2440', nose: '#3a1a2a', face: '#e8822c', muzzle: '#f2a656', hair: '#e8822c', cloth: '#e8822c', fur: ['#f6c24a', '#d8652c', '#f0a050', '#c4562a'] },
  { base: '#d6813a', top: '#f2b056', shade: '#6a2a4a', limb: '#b8662e', paw: '#5a2a38', ear: '#c9682e', earIn: '#6a2a3a', nose: '#2a1418', face: '#7a3a38', muzzle: '#e8a868', hair: '#b8662e', cloth: '#d6813a', fur: ['#f2b056', '#b8622a', '#e89a48', '#8a4a2a'] },
  { base: '#b98a66', top: '#dcb08a', shade: '#5c3c4c', limb: '#a8785a', paw: '#a8785a', ear: '#b07a5a', earIn: '#6a4040', nose: '#5a3434', face: '#b98a66', muzzle: '#d4a07c', hair: '#221c2c', cloth: '#3e2c34', fur: ['#dcb08a', '#9a6a50', '#c8966e', '#7a5040'] },
];
// Night (moonlit blue-grey, panel 15) — colours are pulled towards these as night falls.
const NIGHT = { base: '#56698a', top: '#46587a', shade: '#2c3552', limb: '#4e6082', paw: '#46587a', ear: '#4e6082', earIn: '#262e46', nose: '#1c2034', face: '#5c7090', muzzle: '#6a7e9c', hair: '#121426', cloth: '#1e1a2c', fur: ['#6a7e9c', '#3e4e6e', '#5e7294', '#34405e'] };

// Face profile (forehead -> brow -> eye notch -> nose -> lips -> chin -> throat), eye and ear
// positions, in head units (f forward, u up); same point count for every species so they morph.
const FACE = [
  { prof: [[0.45, 0.72], [1.0, 0.45], [1.6, 0.22], [2.5, 0.03], [2.53, -0.12], [2.2, -0.22], [1.8, -0.3], [1.4, -0.42], [0.9, -0.6], [0.25, -0.8]], eye: [0.98, 0.26], ear: [-0.22, 0.64] },
  { prof: [[0.5, 0.76], [0.94, 0.42], [0.86, 0.24], [1.42, 0.0], [1.5, -0.18], [1.46, -0.32], [1.36, -0.44], [1.3, -0.56], [1.05, -0.78], [0.35, -0.9]], eye: [0.7, 0.19], ear: [-0.1, 0.12] },
  { prof: [[0.55, 0.68], [0.92, 0.32], [0.82, 0.16], [1.12, -0.1], [0.95, -0.22], [0.98, -0.34], [0.9, -0.42], [0.95, -0.5], [0.84, -0.74], [0.3, -0.9]], eye: [0.67, 0.14], ear: [-0.04, 0.04] },
];
function faceAt(m) {
  const i = clamp(Math.floor(m), 0, 1), t = ease.inOutSine(clamp(m - i)), A = FACE[i], B = FACE[i + 1];
  const lp = (a, b) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  return { prof: A.prof.map((p, k) => lp(p, B.prof[k])), eye: lp(A.eye, B.eye), ear: lp(A.ear, B.ear) };
}

function mixObj(a, b, t) {
  const o = {};
  for (const k in a) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], t) : Array.isArray(a[k]) ? a[k].map((v, i) => mixHex(v, b[k][i], t)) : mixHex(a[k], b[k], t);
  return o;
}
const LEN_KEYS = ['spine', 'hipT', 'midT', 'chestT', 'neck', 'headR', 'snout', 'snoutW', 'earR', 'eyeR', 'armU', 'armL', 'hand', 'armW', 'legU', 'legL', 'foot', 'legW', 'tail', 'tailW'];
export function scaled(S, k) {
  const o = { ...S };
  for (const key of LEN_KEYS) o[key] = S[key] * k;
  return o;
}
export function morph(m, night = 0) {
  const i = clamp(Math.floor(m), 0, 1), t = ease.inOutSine(clamp(m - i));
  const shape = mixObj(SHAPES[i], SHAPES[i + 1], t);
  let col = mixObj(COLS[i], COLS[i + 1], t);
  if (night > 0) col = mixObj(col, NIGHT, night * 0.92);
  return { ...shape, col, m };
}

// ---------------------------------------------------------------------------------------------
// Pose: angles are absolute in the creature frame (0 = forward, +PI/2 = down). Limbs: [upper, lower, end].
// ---------------------------------------------------------------------------------------------
export function basePose() {
  return {
    x: 0, y: 0, face: 1, // hip position (world), facing (+1 right)
    spine: -0.08, spineBend: 0, neck: -0.35, head: 0.25, yaw: 0, jawOpen: 0, blink: 0, brow: 0, earFlick: 0, sniff: 0,
    armN: [1.65, 1.5, 0.2], armF: [1.6, 1.5, 0.2], legN: [1.2, 1.9, 0], legF: [1.3, 1.85, 0],
    grip: 0, tail: [0.4, 0.2, -0.3], breath: 0, lean: 0,
  };
}
export function mixPose(a, b, t) {
  const o = {};
  for (const k in a) {
    const v = a[k];
    o[k] = Array.isArray(v) ? v.map((x, i) => lerp(x, b[k][i], t)) : lerp(v, b[k], t);
  }
  return o;
}

const dirv = (a) => [Math.cos(a), Math.sin(a)];
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const add = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l];

// Solve the rig in local space (hip at 0,0; facing +x) -> joints + outlines.
export function solve(P, S) {
  const d = dirv(P.spine), up = [d[1], -d[0]];
  const H = [0, 0];
  const Sh = add(H, d, S.spine);
  // torso outline around the spine (back = "up" side, belly = the other side)
  const N = 26, top = [], bot = [], mid = [];
  const u0 = -S.rump, u1 = 1 + S.chest;
  const thick = (u) => {
    const uu = clamp(u);
    let t = uu < 0.5 ? lerp(S.hipT, S.midT, uu * 2) : lerp(S.midT, S.chestT, (uu - 0.5) * 2);
    if (u < 0) t *= Math.sqrt(Math.max(0, 1 - (u / S.rump) ** 2)) * 0.9 + 0.1 * (1 + u / S.rump);
    if (u > 1) t *= Math.sqrt(Math.max(0, 1 - ((u - 1) / S.chest) ** 2)) * 0.9 + 0.1 * (1 - (u - 1) / S.chest);
    return Math.max(0, t) / 2;
  };
  for (let i = 0; i <= N; i++) {
    const u = lerp(u0, u1, i / N);
    // spine bend (arched back while bounding)
    const bendOff = P.spineBend * S.spine * 0.12 * Math.sin(Math.PI * clamp(u));
    const c = [H[0] + d[0] * u * S.spine + up[0] * bendOff, H[1] + d[1] * u * S.spine + up[1] * bendOff];
    const t = thick(u) * (1 + P.breath * 0.03);
    const uc = clamp(u);
    const hump = 1 + S.hump * Math.sin(Math.PI * Math.pow(uc, 1.9));
    const belly = 0.92 - S.tuck * Math.sin(Math.PI * uc) + S.chestB * 2 * Math.exp(-(((u - 0.8) / 0.2) ** 2)) + P.breath * 0.02 * S.chestB;
    top.push([c[0] + up[0] * t * hump, c[1] + up[1] * t * hump]);
    bot.push([c[0] - up[0] * t * belly, c[1] - up[1] * t * belly]);
    mid.push(c);
  }
  // neck + head
  const neckBase = add(add(Sh, d, S.spine * S.chest * 0.35), up, S.chestT * 0.18);
  const nd = dirv(P.neck);
  const headC = add(neckBase, nd, S.neck + S.headR * 0.55);
  // limbs
  const limb = (base, ang, L1, L2, L3) => {
    const a = base, b = add(a, dirv(ang[0]), L1), c = add(b, dirv(ang[1]), L2), e = add(c, dirv(ang[2]), L3);
    return [a, b, c, e];
  };
  const shoulder = add(add(Sh, up, -S.chestT * 0.08), d, S.spine * 0.02);
  const hip = add(H, up, -S.hipT * 0.12);
  return {
    d, up, H, Sh, top, bot, mid, neckBase, headC,
    armN: limb(shoulder, P.armN, S.armU, S.armL, S.hand), armF: limb(add(shoulder, d, -4), P.armF, S.armU, S.armL, S.hand),
    legN: limb(hip, P.legN, S.legU, S.legL, S.foot), legF: limb(add(hip, d, -6), P.legF, S.legU, S.legL, S.foot),
  };
}

// Height of the lowest foot below the hip (for ground contact).
export function footDrop(P, S) {
  const J = solve(P, S);
  const f = (L) => Math.max(L[2][1], L[3][1]);
  return Math.max(f(J.legN), f(J.legF));
}

// ---------------------------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------------------------
function capsule(a, b, wa, wb, n = 8) {
  // rounded tapered capsule from a (width wa) to b (width wb)
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 + (Math.PI * i) / n; pts.push([b[0] + Math.cos(t) * wb / 2, b[1] + Math.sin(t) * wb / 2]); }
  for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 + (Math.PI * i) / n; pts.push([a[0] + Math.cos(t) * wa / 2, a[1] + Math.sin(t) * wa / 2]); }
  return pts;
}
function limbPoly(L, w1, w2, w3) {
  // one smooth outline around a -> b -> c with widths w1, w2, w3 and round caps
  const [a, b, c] = L;
  const nrm = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
  const n1 = nrm(a, b), n2 = nrm(b, c);
  let nb = [n1[0] + n2[0], n1[1] + n2[1]];
  const nl = Math.hypot(nb[0], nb[1]) || 1;
  nb = [nb[0] / nl, nb[1] / nl];
  const miter = 1 / Math.max(0.55, (nb[0] * n1[0] + nb[1] * n1[1]));
  const off = (p, n, w, s) => [p[0] + n[0] * w / 2 * s, p[1] + n[1] * w / 2 * s];
  const mab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], wm = lerp(w1, w2, 0.5) * 1.12;
  const pts = [off(a, n1, w1, 1), off(mab, n1, wm, 1), off(b, nb, w2 * miter, 1), off(c, n2, w3, 1)];
  const angC = Math.atan2(c[1] - b[1], c[0] - b[0]);
  for (let i = 1; i < 8; i++) { const t = angC + Math.PI / 2 - (Math.PI * i) / 8; pts.push([c[0] + Math.cos(t) * w3 / 2, c[1] + Math.sin(t) * w3 / 2]); }
  pts.push(off(c, n2, w3, -1), off(b, nb, w2 * miter, -1), off(mab, n1, wm, -1), off(a, n1, w1, -1));
  const angA = Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (let i = 1; i < 8; i++) { const t = angA - Math.PI / 2 - (Math.PI * i) / 8; pts.push([a[0] + Math.cos(t) * w1 / 2, a[1] + Math.sin(t) * w1 / 2]); }
  return pts;
}

// Paint the creature. c: paint ctx (world coords under current transform). P: pose. S: morph().
// light: { fire: [x, y] | null, fireK: 0..1, flick: 0..1 }. seedKey varies per drawing (boil).
export function paintCreature(c, P, S, light, seedKey = 0, detail = 1) {
  const J = solve(P, S);
  const col = S.col;
  const fx = P.face;
  const T = (p) => [P.x + p[0] * fx, P.y + p[1]]; // local -> world
  const TP = (pts) => pts.map(T);
  // 3-drawing boil loop (classic hand-drawn shimmer): strokes stay on the body, texture cycles
  const r = rng('anc-creature-' + (seedKey % 3));
  c.brush.seed('anc-cr-' + (seedKey % 3));
  const wash = (pts, color, a = 255) => c.washPoly(TP(pts), color, a);
  const stroke = (pts, brush, color, w, curv = 0.5) => c.strokePath(TP(pts), brush, color, w, curv);
  const fur = S.m < 1.7 ? 1 - smoothstep(1.2, 1.9, S.m) : 0;
  const k = S.spine / 100; // stroke size scale

  // warm firelight: side of each part facing the fire gets a warm facet
  const fireDir = light && light.fire ? Math.sign(light.fire[0] - P.x) * fx : 0;
  const fireA = light ? light.fireK * (0.75 + 0.25 * light.flick) : 0;
  const warm = mixHex('#f0a050', '#ffd27a', light ? light.flick : 0);

  // ---- limb painter
  const paintLimb = (L, far, isArm) => {
    const w1 = isArm ? S.armW : S.legW, w2 = w1 * 0.72, w3 = w1 * 0.55;
    const base = far ? mixHex(col.limb, col.shade, 0.55) : col.limb;
    wash(limbPoly(L, w1, w2, w3), base);
    if (!far && S.muscle > 0.05) {
      // shoulder (deltoid) / haunch mass: a lighter plane over the top of the limb
      const [a, b] = L, mr = w1 * (isArm ? 0.5 : 0.56);
      const q = [lerp(a[0], b[0], 0.26), lerp(a[1], b[1], 0.26)];
      wash(ellipsePts(q[0], q[1], mr * 1.3, mr, Math.atan2(b[1] - a[1], b[0] - a[0]), 20), mixHex(base, mixHex(base, col.top, 0.3), S.muscle), 150);
    }
    // light edge along the front of the limb
    if (!far) {
      const [a, b, cc] = L;
      stroke([[a[0] + w1 * 0.2, a[1]], [b[0] + w2 * 0.25, b[1]], [cc[0] + w3 * 0.2, cc[1]]], 'gouache', mixHex(base, col.top, 0.45), 0.35 * w1 / 20);
    }
    // hand / foot
    const [, , cc, e] = L;
    const dx = e[0] - cc[0], dy = e[1] - cc[1], len = Math.hypot(dx, dy) || 1;
    const paw = far ? mixHex(col.paw, col.shade, 0.5) : col.paw;
    const pw = w3 * (isArm ? 0.9 : 0.8);
    wash(capsule(cc, e, pw, pw * 0.8), paw);
    if (S.fingers > 0.3 && detail) {
      // fingers / toes: short tapered strokes, curled by grip
      const n = 4;
      for (let i = 0; i < n; i++) {
        const a0 = Math.atan2(dy, dx) + (i - 1.5) * 0.28;
        const curl = (isArm ? P.grip : 0.2) * 1.4;
        const f0 = [e[0] + Math.cos(a0) * pw * 0.2, e[1] + Math.sin(a0) * pw * 0.2];
        const fl = len * 0.55 * S.fingers;
        const f1 = [f0[0] + Math.cos(a0 + curl * 0.5) * fl * 0.55, f0[1] + Math.sin(a0 + curl * 0.5) * fl * 0.55];
        const f2 = [f1[0] + Math.cos(a0 + curl) * fl * 0.45, f1[1] + Math.sin(a0 + curl) * fl * 0.45];
        stroke([f0, f1, f2], 'gouache', paw, 0.32 * pw / 12, 0.4);
      }
    }
    // fur strokes along the limb
    if (fur > 0.05 && detail) {
      for (let i = 0; i < 5; i++) {
        const u = r(0.1, 0.9), seg = u < 0.5 ? [L[0], L[1]] : [L[1], L[2]], uu = (u % 0.5) * 2;
        const p = [lerp(seg[0][0], seg[1][0], uu) + r(-0.3, 0.3) * w1, lerp(seg[0][1], seg[1][1], uu)];
        const a = Math.atan2(seg[1][1] - seg[0][1], seg[1][0] - seg[0][0]);
        stroke([p, [p[0] + Math.cos(a) * 10 * k, p[1] + Math.sin(a) * 10 * k]], 'dry', r.pick(col.fur), 0.3 * k * fur, 0.3);
      }
    }
    // firelight on the fire-facing side of the near limbs: a warm band along that edge + a hot rim
    if (!far && fireA > 0.02 && light.fire) {
      const fl = [(light.fire[0] - P.x) * fx, light.fire[1] - 80 - P.y];
      const pts = [L[0], L[1], L[2]], ws = [w1, w2, w3];
      const edge = [], inner = [], hot = [];
      for (let i = 0; i < 3; i++) {
        const p = pts[i], q = pts[Math.min(2, i + 1)], o = pts[Math.max(0, i - 1)];
        let nx = -(q[1] - o[1]), ny = q[0] - o[0];
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;
        if (nx * (fl[0] - p[0]) + ny * (fl[1] - p[1]) < 0) { nx = -nx; ny = -ny; }
        edge.push([p[0] + nx * ws[i] * 0.48, p[1] + ny * ws[i] * 0.48]);
        inner.push([p[0] - nx * ws[i] * 0.05, p[1] - ny * ws[i] * 0.05]);
        hot.push([p[0] + nx * ws[i] * 0.3, p[1] + ny * ws[i] * 0.3]);
      }
      wash(edge.concat(inner.slice().reverse()), mixHex('#d8703a', base, 0.35), Math.round(110 * fireA));
      wash(edge.concat(hot.slice().reverse()), mixHex(warm, '#e8883a', 0.4), Math.round(210 * fireA));
      stroke(edge, 'ink', mixHex(warm, '#fff2c8', 0.6), 0.45 * fireA, 0.4);
    }
    // contour on the back edge
    const [a, b] = L;
    stroke([[a[0] - w1 * 0.45, a[1]], [b[0] - w2 * 0.5, b[1]], [cc[0] - w3 * 0.5, cc[1]]], 'ink', mixHex(col.shade, '#1a0f18', 0.5), 0.55 * Math.max(0.6, k), 0.3);
  };

  // ---- far limbs
  paintLimb(J.legF, true, false);
  paintLimb(J.armF, true, true);

  // ---- tail
  if (S.tail > 2) {
    const pts = [];
    let p = [J.top[1][0], lerp(J.top[1][1], J.bot[1][1], 0.45)];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      pts.push(p);
      const u = i / n;
      const th = Math.PI - 0.45 + (0.95 + P.tail[0]) * u + P.tail[1] * Math.sin(u * 5 + P.tail[2]) * u;
      p = add(p, dirv(th), S.tail / n);
    }
    wash(ribbon(pts, S.tailW, S.tailW * 0.3), mixHex(col.base, col.shade, 0.15));
    stroke(pts.map((q) => [q[0], q[1] - S.tailW * 0.25]), 'wire', col.top, 0.6, 0.4);
  }

  // ---- near leg (behind torso for the quadruped? no: legs attach under the body — draw after torso)
  // ---- torso
  const torso = J.top.concat(J.bot.slice().reverse());
  wash(torso, col.base);
  // back light facet (top 45 %) — by night it turns into shadow; a thin cool rim of moonlight
  const litIn = J.top.map((p, i) => [lerp(p[0], J.mid[i][0], 0.55), lerp(p[1], J.mid[i][1], 0.55)]);
  wash(J.top.concat(litIn.slice().reverse()), col.top, 235);
  if (light && light.night > 0.3) stroke(J.top.slice(3, -3), 'gouache', mixHex(col.base, '#b8c8e8', 0.45), 0.3 * k * light.night, 0.4);
  // belly shade facet
  const shIn = J.bot.map((p, i) => [lerp(p[0], J.mid[i][0], 0.45), lerp(p[1], J.mid[i][1], 0.45)]);
  wash(J.bot.concat(shIn.slice().reverse()), col.shade, 225);
  // human: loincloth band around the hips
  if (S.m > 1.6) {
    const cl = smoothstep(1.6, 1.95, S.m);
    const n = J.top.length;
    const i0 = 0, i1 = Math.round(n * 0.3);
    const band = J.top.slice(i0, i1).concat(J.bot.slice(i0, i1).reverse());
    wash(band, mixHex(col.base, col.cloth, cl), 255);
    stroke(J.bot.slice(i0, i1), 'dry', mixHex(col.cloth, '#000000', 0.3), 0.6 * k, 0.3);
  }
  // firelight facet on the torso's fire side
  if (fireA > 0.01) {
    const side = fireDir >= 0 ? J.bot : J.top;
    const inner = side.map((p, i) => [lerp(p[0], J.mid[i][0], 0.32), lerp(p[1], J.mid[i][1], 0.32)]);
    const from = Math.round(side.length * 0.2);
    wash(side.slice(from).concat(inner.slice(from).reverse()), mixHex(warm, col.base, 0.3), Math.round(200 * fireA));
    stroke(side.slice(from), 'gouache', mixHex(warm, '#fff0c0', 0.4), 0.45 * k * fireA, 0.4);
    stroke(side.slice(from), 'ink', '#fff0c8', 0.35 * fireA, 0.4);
    // the far side falls into deep shadow
    const other = fireDir >= 0 ? J.top : J.bot;
    const inner2 = other.map((p, i) => [lerp(p[0], J.mid[i][0], 0.3), lerp(p[1], J.mid[i][1], 0.3)]);
    wash(other.concat(inner2.slice().reverse()), col.shade, Math.round(150 * fireA));
  }
  // fur strokes over the torso, following the body from shoulders to rump
  if (detail) {
    const nFur = Math.round(lerp(22, 64, fur));
    for (let i = 0; i < nFur; i++) {
      const u = r(0.02, 0.98), v = r(-0.95, 0.95);
      const iu = Math.round(u * (J.mid.length - 1));
      const m0 = J.mid[iu], tp = J.top[iu], bt = J.bot[iu];
      const p = v > 0 ? [lerp(m0[0], tp[0], v), lerp(m0[1], tp[1], v)] : [lerp(m0[0], bt[0], -v), lerp(m0[1], bt[1], -v)];
      const a = Math.atan2(-J.d[1], -J.d[0]) + v * 0.35 + r(-0.15, 0.15);
      const len = r(14, 30) * k * (0.6 + 0.4 * fur);
      const cc = v > 0.35 ? r.pick([col.top, col.fur[0], col.fur[2], mixHex(col.top, '#fff4d0', 0.35)]) : v < -0.4 ? r.pick([col.shade, col.fur[3]]) : r.pick(col.fur);
      const br = fur > 0.3 ? (i % 3 ? 'dry' : 'gouache') : 'gouache';
      stroke([p, [p[0] + Math.cos(a) * len * 0.5, p[1] + Math.sin(a) * len * 0.5 + 1], [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len]], br, cc, (br === 'dry' ? 0.5 : 0.3) * k, 0.4);
    }
  }
  // skin: crayon hatching in the shade, pastel catch-lights, a few anatomy lines (human)
  if (detail && S.m > 1.4) {
    const hk = smoothstep(1.4, 1.9, S.m);
    for (let i = 0; i < 14; i++) {
      const iu = r.int(2, J.mid.length - 3), v = r(0.35, 0.85);
      const p = [lerp(J.mid[iu][0], J.bot[iu][0], v), lerp(J.mid[iu][1], J.bot[iu][1], v)];
      const a = Math.atan2(J.d[1], J.d[0]) + 0.9;
      stroke([p, [p[0] + Math.cos(a) * 12 * k, p[1] + Math.sin(a) * 12 * k]], 'crayon', mixHex(col.shade, col.base, 0.3), 0.35 * k * hk, 0.3);
    }
    for (let i = 0; i < 8; i++) {
      const iu = r.int(3, J.mid.length - 4), v = r(0.3, 0.8);
      const p = [lerp(J.mid[iu][0], J.top[iu][0], v), lerp(J.mid[iu][1], J.top[iu][1], v)];
      stroke([p, [p[0] - J.d[0] * 16 * k, p[1] - J.d[1] * 16 * k]], 'pastel', mixHex(col.top, '#ffffff', 0.2), 0.3 * k * hk, 0.3);
    }
    // pectoral + rib lines on the chest
    const iC = Math.round(J.mid.length * 0.72), iR = Math.round(J.mid.length * 0.5);
    const pc = (i, v) => [lerp(J.mid[i][0], J.bot[i][0], v), lerp(J.mid[i][1], J.bot[i][1], v)];
    stroke([pc(iC + 3, 0.1), pc(iC, 0.55), pc(iC - 3, 0.9)], 'ink', mixHex(col.shade, col.base, 0.2), 0.4 * k * hk, 0.5);
    for (let j = 0; j < 3; j++) stroke([pc(iR - j * 2, 0.3), pc(iR - j * 2 - 1, 0.75)], 'crayon', mixHex(col.shade, col.base, 0.35), 0.3 * k * hk, 0.4);
  }
  // torso contour (broken ink, heavier underneath)
  const ink = mixHex(col.shade, '#140a14', 0.55);
  for (let i = 0; i < J.top.length - 4; i += 4) if (r() < 0.85) stroke(J.top.slice(i, i + 5), 'ink', ink, 0.6 * Math.max(0.7, k), 0.4);
  for (let i = 0; i < J.bot.length - 4; i += 4) if (r() < 0.9) stroke(J.bot.slice(i, i + 5), 'ink', ink, 0.75 * Math.max(0.7, k), 0.4);

  // ---- near limbs
  paintLimb(J.legN, false, false);

  // ---- neck + head (morphing face profile)
  const hd = dirv(P.head), hu = [hd[1], -hd[0]];
  const Hc = J.headC, R = S.headR;
  const F = faceAt(S.m);
  const HP = (f, u) => [Hc[0] + (hd[0] * f + hu[0] * u) * R, Hc[1] + (hd[1] * f + hu[1] * u) * R];
  const prof = F.prof.map(([f, u], i) => HP(f, u + (i >= 6 ? -P.jawOpen * 0.12 : 0)));
  wash(capsule(J.neckBase, HP(-0.15, -0.3), S.chestT * 0.42, R * 1.1), col.base);
  // cranium arc: from the forehead over the top and back down to the nape (hair adds volume)
  const a0 = Math.atan2(F.prof[0][1], F.prof[0][0]), a1 = Math.atan2(F.prof[9][1], F.prof[9][0]) + TAU;
  const head = [];
  for (let i = 0; i <= 18; i++) {
    const a = lerp(a0, a1, i / 18), back = Math.cos(a) < 0 ? 1 + 0.12 * S.hair : 1;
    head.push(HP(Math.cos(a) * back, Math.sin(a) * 0.96 * back));
  }
  const headPoly = head.concat(prof.slice().reverse());
  wash(headPoly, col.face === col.base ? col.base : mixHex(col.base, col.face, 0.2));
  // top light on the cranium
  wash(head.slice(0, 10).concat([HP(0.05, 0.25)]), col.top, 190);
  // face mask (primate: dark face) and pale muzzle (shrew / primate)
  const maskA = smoothstep(0.35, 1, S.m) * (1 - smoothstep(1.3, 1.9, S.m));
  if (maskA > 0.02) wash([HP(0.15, 0.6), prof[1], prof[2], prof[3], prof[4], prof[5], prof[6], prof[7], prof[8], HP(0.2, -0.6)], mixHex(col.base, col.face, maskA), 255);
  const muzA = 1 - 0.9 * smoothstep(1.35, 1.9, S.m);
  wash([lerp2(prof[2], prof[3], 0.3), prof[3], prof[4], prof[5], prof[6], prof[7], prof[8], HP(lerp(0.9, 0.5, clamp(S.m)), -0.45)], mixHex(mixHex(col.base, col.face, maskA), col.muzzle, muzA), 255);
  // human hair (shaggy) + beard along the jaw
  if (S.hair > 0.3) {
    const hA = smoothstep(0.3, 1, S.hair);
    const hair = head.slice(1, 16).concat([HP(-0.2, 0.05), HP(0.35, 0.42)]);
    wash(hair, mixHex(col.base, col.hair, hA), 255);
    for (let i = 0; i < 12; i++) {
      const q = head[r.int(2, 15)];
      stroke([q, [q[0] - hd[0] * r(6, 14) * k + r(-3, 3), q[1] + r(4, 12) * k]], 'dry', mixHex(col.hair, col.top, 0.3), 0.4 * k, 0.4);
    }
  }
  if (S.beard > 0.3) {
    const bA = smoothstep(0.3, 1, S.beard);
    const beard = [HP(-0.12, -0.02), HP(0.4, -0.2), prof[4], prof[5], lerp2(prof[5], prof[6], 0.5), prof[7], prof[8], prof[9], HP(-0.1, -0.7)];
    wash(beard, mixHex(col.face, col.hair, bA), 255);
    wash([prof[5], prof[6], prof[7], lerp2(prof[6], HP(0.6, -0.42), 0.5)], mixHex(mixHex(col.face, col.hair, bA), mixHex(col.nose, col.face, 0.3), bA), 255); // lips
    for (let i = 0; i < 8; i++) {
      const q = beard[r.int(1, 7)];
      stroke([q, [q[0] + r(-3, 3), q[1] + r(6, 14) * k]], 'dry', mixHex(col.hair, col.top, 0.3), 0.35 * k, 0.3);
    }
  }
  // firelight on the face
  if (fireA > 0.01 && fireDir > 0) {
    wash([prof[0], prof[1], prof[2], prof[3], prof[4], prof[5], prof[6], prof[7], prof[8], HP(0.55, -0.4), HP(0.6, 0.2)], warm, Math.round(170 * fireA));
    stroke(prof.slice(1, 9), 'gouache', mixHex(warm, '#fff0c0', 0.5), 0.3 * k, 0.4);
  }
  // ear
  const ec = HP(F.ear[0], F.ear[1] + P.earFlick * 0.08);
  wash(ellipsePts(ec[0], ec[1], S.earR * 0.95, S.earR * 1.12, -0.2, 18), col.ear);
  wash(ellipsePts(ec[0] + hd[0] * S.earR * 0.14, ec[1] + 1, S.earR * 0.55, S.earR * 0.66, -0.2, 14), col.earIn);
  // eye, under the brow; a second eye when the face turns to camera
  const eyeP = HP(F.eye[0] + 0.14 * P.yaw, F.eye[1]);
  const eh = S.eyeR * (1 - 0.9 * P.blink);
  const eyeCol = '#1b0f16';
  if (S.m > 0.6) wash(ellipsePts(eyeP[0], eyeP[1], S.eyeR * 1.6, S.eyeR * 1.25, 0, 14), mixHex(mixHex(col.base, col.face, maskA), mixHex(col.muzzle, '#ffffff', 0.25), 0.7 * smoothstep(0.6, 1.4, S.m) * (1 - 0.8 * smoothstep(1.5, 1.95, S.m))), 255);
  wash(ellipsePts(eyeP[0], eyeP[1], S.eyeR, Math.max(0.5, eh), 0, 14), eyeCol);
  if (P.blink < 0.5) wash(ellipsePts(eyeP[0] + S.eyeR * 0.3, eyeP[1] - S.eyeR * 0.35, S.eyeR * 0.32, S.eyeR * 0.32, 0, 8), '#fffaf0');
  if (P.yaw > 0.15) {
    const e2 = HP(F.eye[0] - 0.3 + 0.2 * P.yaw, F.eye[1] + 0.04);
    wash(ellipsePts(e2[0], e2[1], S.eyeR * 0.85 * smoothstep(0.15, 0.5, P.yaw), Math.max(0.5, eh * 0.9), 0, 12), eyeCol, 255); // far eye opens into view as the head turns
  }
  // brow ridge stroke (expression: raised when startled)
  if (S.brow > 0.2) {
    const b0 = HP(F.eye[0] - 0.28, F.eye[1] + 0.2 + 0.08 * P.brow), b1 = HP(F.eye[0] + 0.25, F.eye[1] + 0.24 + 0.1 * P.brow);
    stroke([b0, b1], 'gouache', mixHex(col.shade, '#1a0f18', 0.45), 0.42 * k * S.brow, 0.3);
  }
  // nose, mouth, whiskers
  wash(ellipsePts(prof[3][0] - hd[0] * 3, prof[3][1] - hd[1] * 3 - 1, lerp(4.5, 3.2, clamp(S.m - 1)), 3, 0, 10), mixHex(col.nose, col.face, 0.7 * smoothstep(1.5, 1.95, S.m)), 255);
  stroke([prof[6], lerp2(prof[6], HP(0.5, -0.4), 0.6)], 'ink', col.nose, 0.4 * Math.max(0.7, k), 0.3);
  if (S.m < 0.8) {
    const wa = 1 - smoothstep(0.3, 0.8, S.m);
    for (let i = 0; i < 3; i++) {
      const w0 = lerp2(prof[3], prof[5], 0.5), ang = Math.atan2(hd[1], hd[0]) + (i - 1) * 0.28 + 0.1 * Math.sin(P.sniff * 3 + i);
      stroke([w0, [w0[0] + Math.cos(ang) * 30 * wa, w0[1] + Math.sin(ang) * 30 * wa - 4]], 'wire', '#2a1a22', 0.5, 0.3);
    }
  }
  // fur on the head
  if (detail && fur > 0.1) for (let i = 0; i < 12; i++) {
    const q = HP(r(-0.7, 0.5), r(-0.5, 0.75));
    const ang = Math.atan2(-hd[1], -hd[0]) + r(-0.4, 0.4);
    stroke([q, [q[0] + Math.cos(ang) * 8 * k, q[1] + Math.sin(ang) * 8 * k]], 'dry', r.pick(col.fur), 0.3 * k * fur, 0.3);
  }
  // contours (broken ink)
  for (let i = 0; i < head.length - 3; i += 3) if (r() < 0.9) stroke(head.slice(i, i + 4), 'ink', ink, 0.6 * Math.max(0.7, k), 0.4);
  stroke(prof, 'ink', ink, 0.55 * Math.max(0.7, k), 0.4);

  // ---- near arm (in front)
  paintLimb(J.armN, false, true);
  return J;
}
