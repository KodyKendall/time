// CITY — living detail: chimney smoke, birds, walkers, lamps, trees, tram, boats, wind, dust.
// Everything is a pure function of time (deterministic seeds, no state between frames).
import { lerp, clamp, hex, mixHex, rng } from '../lib/kit.js';
import { ease, smoothstep, noise1, TAU } from '../../engine/math.js';
import { BAND, bw, MAIN, LAMPS, RIVER, BUILDINGS, TOWER, HALL, STREETS } from './layout.js';
import { chimneyTops, growth, riverFront } from './world.js';
import { WALK, BIRD, LAMP, TREE, TRAM } from './paintLife.js';

const AX = BAND.ax, AY = BAND.ay, NX = BAND.nx, NY = BAND.ny;
const P3 = (s, o, z) => [BAND.ox + s * AX + o * NX, BAND.oy + s * AY + o * NY, z];

// cylindrical billboard (stands upright, turns to face the camera), feet at p
function standee(r3, tex, cam, p, w, h, uv, tint, flip = false) {
  const rx = cam.right[0], ry = cam.right[1];
  const a = [p[0] - (rx * w) / 2, p[1] - (ry * w) / 2], b = [p[0] + (rx * w) / 2, p[1] + (ry * w) / 2];
  const [u0, v0, u1, v1] = uv;
  const U0 = flip ? u1 : u0, U1 = flip ? u0 : u1;
  r3.poly(tex, [[a[0], a[1], p[2]], [b[0], b[1], p[2]], [b[0], b[1], p[2] + h], [a[0], a[1], p[2] + h]], [[U0, v1], [U1, v1], [U1, v0], [U0, v0]], { tint });
}
// spherical billboard (faces the camera fully), centred at p
function facing(r3, tex, cam, p, w, h, uv, tint) {
  const R = cam.right, U = cam.up;
  const c = (sx, sy) => [p[0] + R[0] * sx * w / 2 + U[0] * sy * h / 2, p[1] + R[1] * sx * w / 2 + U[1] * sy * h / 2, p[2] + R[2] * sx * w / 2 + U[2] * sy * h / 2];
  const [u0, v0, u1, v1] = uv;
  r3.poly(tex, [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)], [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], { tint });
}
// flat sprite lying on the ground, centred at (s, o), rotated by ang (radians, in band frame)
function flat(r3, tex, s, o, len, wid, ang, z, tint) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const c = (a, b) => { const ds = a * ca - b * sa, dO = a * sa + b * ca; return P3(s + ds, o + dO, z); };
  r3.poly(tex, [c(-len / 2, -wid / 2), c(len / 2, -wid / 2), c(len / 2, wid / 2), c(-len / 2, wid / 2)], [[0, 0], [1, 0], [1, 1], [0, 1]], { tint });
}

// ------------------------------------------------------------------------------------------------
// actors (generated once)
// ------------------------------------------------------------------------------------------------
const SIDEWALK = [MAIN.o0 - 16 + 12, MAIN.o1 + 16 - 12];
const WALKERS = (() => {
  const r = rng('city-walkers');
  const out = [];
  for (let i = 0; i < 46; i++) {
    const side = i % 2, dir = r() < 0.5 ? 1 : -1;
    out.push({ s0: r(-420, 560), o: SIDEWALK[side] + r(-6, 6), v: dir * r(9, 15), variant: r.int(0, WALK.variants - 1), ph: r(0, 4), born: r(2.9, 4.2), scale: r(0.92, 1.08) });
  }
  // people crossing the avenue at the cross streets
  for (let i = 0; i < 8; i++) {
    const s = r.pick([-110, 250, -110, 250]) + r(-12, 12);
    const dir = r() < 0.5 ? 1 : -1;
    out.push({ s0: s, o: MAIN.oc + r(-90, 90), v: 0, vo: dir * r(9, 13), variant: r.int(0, WALK.variants - 1), ph: r(0, 4), born: r(3.2, 4.4), scale: r(0.95, 1.05), cross: true });
  }
  return out;
})();
const TREES = (() => {
  const r = rng('city-trees');
  const out = [];
  // along the avenue sidewalks, between the lamps
  for (let s = -250; s < 600; s += 110) {
    out.push({ s: s + 27, o: MAIN.o0 - 16 + 8, h: r(0.9, 1.15), born: 2.9 + (s + 250) / 900 * 0.8 + r(0, 0.2) });
    out.push({ s: s + 82, o: MAIN.o1 + 16 - 8, h: r(0.9, 1.15), born: 2.9 + (s + 250) / 900 * 0.8 + r(0, 0.2) });
  }
  // along the river banks (they grow as the river is drawn)
  const onStreet = (s, o) => STREETS.some((st) => s > st.s0 - 8 && s < st.s1 + 8 && o > st.o0 - 8 && o < st.o1 + 8);
  for (let o = -900; o < 900; o += r(38, 75)) {
    const side = r() < 0.5 ? -1 : 1;
    const s = RIVER.sAt(o) + side * r(42, 62);
    // grows just after the river has been drawn past it
    let tb = 0;
    while (tb < 3 && riverFront(tb) < o + 40) tb += 0.02;
    const born = tb + r(0.05, 0.35);
    if (onStreet(s, o)) continue;
    out.push({ s, o, h: r(0.8, 1.2), born, river: true });
  }
  return out;
})();
const FLOCKS = [
  // top-down: across the fields (with shadows), street: pigeons past the tower, clock: close pass
  { t0: 0.1, t1: 3.2, n: 9, from: [-900, -200], to: [1300, -700], z: 320, spread: 60, size: 16, shadows: true, seed: 1 },
  { t0: 4.6, t1: 8.0, n: 11, from: [430, -560], to: [560, 40], z: 300, spread: 40, size: 5, seed: 2 },
  { t0: 6.6, t1: 8.4, n: 5, from: [560, -330], to: [590, -210], z: 350, spread: 10, size: 4, seed: 3, close: true },
];

// ------------------------------------------------------------------------------------------------
export function lifeItems(r3, A, cam, lt, L) {
  const items = [];
  const [cx, cy] = cam.pos;
  const d2 = (p) => (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
  const litK = L.night;
  // --- trees (grow)
  for (const t of TREES) {
    const g = ease.outBack(clamp((lt - t.born) / 0.5));
    if (g <= 0.01) continue;
    const p = P3(t.s, t.o, 0);
    const w = TREE.w * 0.62 * t.h * g, h = TREE.h * 0.62 * t.h * g;
    const tint = [lerp(L.sun[0], L.shade[0], 0.3), lerp(L.sun[1], L.shade[1], 0.3), lerp(L.sun[2], L.shade[2], 0.3), 1];
    items.push({ d2: d2(p), draw: () => {
      // top canopy (for the high views) then the upright card
      if (cam.pos[2] > h * 1.4) flat(r3, A.treeTop, t.s, t.o, w * 0.95, w * 0.95, t.s * 0.01, h * 0.62, tint);
      standee(r3, A.treeSide, cam, p, w, h, [0, 0, 1, 1], tint);
    } });
  }
  // --- lamps: posts rise with the avenue, light up in a wave towards the tower
  LAMPS.forEach((lp, k) => {
    const born = 3.0 + (lp.s + 300) / 1000 * 0.6;
    const g = ease.outCubic(clamp((lt - born) / 0.4));
    if (g <= 0.01) return;
    const p = P3(lp.s, lp.o, 0);
    items.push({ d2: d2(p), draw: () => {
      const on = lampOn(k, lt);
      const tint = [lerp(0.6, 1.25, on) * L.sun[0], lerp(0.6, 1.1, on) * L.sun[1], lerp(0.7, 0.9, on) * L.sun[2], 1];
      standee(r3, A.lamp, cam, p, LAMP.w * g, LAMP.h * g, [0, 0, 1, 1], tint);
    } });
  });
  // --- walkers (front views on the sidewalks, side views crossing)
  for (const w of WALKERS) {
    const age = lt - w.born;
    if (age <= 0) continue;
    const g = ease.outBack(clamp(age / 0.35));
    const s = w.s0 + w.v * lt, o = w.o + (w.vo || 0) * (lt - w.born);
    if (w.cross && Math.abs(o - MAIN.oc) > 105) continue;
    const p = P3(s, o, 0.6);
    const frame = Math.floor((lt * 7 + w.ph) % 4);
    const col = (w.cross ? 4 : 0) + frame;
    const uv = [(col * WALK.cw) / (WALK.cw * WALK.cols), (w.variant * WALK.ch) / (WALK.ch * WALK.variants), ((col + 1) * WALK.cw) / (WALK.cw * WALK.cols), ((w.variant + 1) * WALK.ch) / (WALK.ch * WALK.variants)];
    const h = WALK.height * w.scale * (WALK.ch / 56) * g, wd = h * (WALK.cw / WALK.ch);
    const tint = [lerp(L.shade[0], 1, 0.5), lerp(L.shade[1], 1, 0.5), lerp(L.shade[2], 1, 0.5), 1];
    items.push({ d2: d2(p), draw: () => {
      // soft shadow on the pavement, then the figure
      flat(r3, A.flatTex, s, o, 5 * g, 3 * g, 0, 0.4, [0.1, 0.08, 0.16, 0.35]);
      standee(r3, A.walkers, cam, [p[0], p[1], 0.6 - h * 0.03], wd, h, uv, tint, w.cross ? (w.vo || 0) < 0 : false);
    } });
  }
  // --- horse tram rolling away up the avenue towards the tower
  if (lt > 3.4) {
    const g = ease.outBack(clamp((lt - 3.4) / 0.4));
    const s = 40 + 38 * (lt - 3.4), o = MAIN.oc + 22;
    const p = P3(s, o, 0.5);
    items.push({ d2: d2(p), draw: () => {
      const tint = [lerp(L.shade[0], L.sun[0], 0.6) * (1 + 0.25 * litK), lerp(L.shade[1], L.sun[1], 0.6) * (1 + 0.15 * litK), lerp(L.shade[2], L.sun[2], 0.6), 1];
      standee(r3, A.tram, cam, p, TRAM.w * g, TRAM.h * g, [0, 0, 1, 1], tint);
    } });
  }
  return items;
}

export function lampOn(k, lt) {
  // lamps light in pairs, one every 16th note, from the camera end of the street towards the tower
  const i = Math.floor(k / 2);
  const t0 = 4.375 + i * 0.15625;
  return smoothstep(t0, t0 + 0.12, lt) * (0.92 + 0.08 * noise1(lt * 9 + k, 5));
}

// ground-level details drawn with the streets (before buildings): boats, carts, dots of people
export function drawGroundLife(r3, A, cam, lt, L) {
  const tint = [...L.ground, 1];
  // boats drifting down the river once it exists
  for (let i = 0; i < 3; i++) {
    const born = 1.3 + i * 0.35;
    if (lt < born) continue;
    const o = -700 + i * 520 + (lt - born) * 38;
    const s = RIVER.sAt(o) + [-6, 5, -2][i];
    const ds = RIVER.sAt(o + 5) - RIVER.sAt(o - 5);
    const ang = Math.atan2(10, ds) ;
    const g = ease.outBack(clamp((lt - born) / 0.4));
    flat(r3, A.boatTop, s, o, 16 * g, 7 * g, ang, 0.6, tint);
  }
  // carts on the lanes and the avenue while the city grows (seen from above)
  const r = rng('city-carts');
  for (let i = 0; i < 10; i++) {
    const born = r(2.4, 3.4), speed = r(28, 45) * (r() < 0.5 ? 1 : -1);
    const oLane = r.pick([-607, -833, 99, 388, 658, -1038]) + r(-6, 6);
    const s0 = r(-600, 700);
    if (lt < born) continue;
    const g = ease.outBack(clamp((lt - born) / 0.35));
    const s = s0 + speed * (lt - born);
    flat(r3, A.cartTop, s, oLane, 16 * g, 6 * g, speed > 0 ? 0 : Math.PI, 0.7, tint);
  }
}

// screen-space lights and particles have no depth test: hide what the tower / hall would cover
const BOXES = [
  { s0: TOWER.front, s1: TOWER.front + 2 * TOWER.half, o0: TOWER.o - TOWER.half, o1: TOWER.o + TOWER.half, z1: 580 },
  { s0: HALL.s0, s1: HALL.s1, o0: HALL.o0, o1: HALL.o1, z1: 150 },
];
export function occluded(cam, p) {
  // segment camera -> p in band coords, slab test against each box
  const toB = (q) => { const dx = q[0] - BAND.ox, dy = q[1] - BAND.oy; return [dx * AX + dy * AY, dx * NX + dy * NY, q[2]]; };
  const a = toB(cam.pos), b = toB(p);
  for (const B of BOXES) {
    let t0 = 0, t1 = 1;
    const lo = [B.s0, B.o0, 0], hi = [B.s1, B.o1, B.z1];
    let hit = true;
    for (let k = 0; k < 3 && hit; k++) {
      const d = b[k] - a[k];
      if (Math.abs(d) < 1e-9) { if (a[k] < lo[k] || a[k] > hi[k]) hit = false; continue; }
      let u0 = (lo[k] - a[k]) / d, u1 = (hi[k] - a[k]) / d;
      if (u0 > u1) [u0, u1] = [u1, u0];
      t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
      if (t0 > t1) hit = false;
    }
    if (hit && t1 > 0 && t0 < 0.999) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------------
// particles & lights (compositor, screen space): smoke, bird flocks, lamp glows, dust, wind
// ------------------------------------------------------------------------------------------------
export function drawAir(R, r3, A, cam, lt, L) {
  // chimney smoke
  const smoke = [];
  const tops = chimneyTops(lt);
  const sm = mixHex('#dcd8e2', '#8a86a2', clamp(L.ph / 2.2));
  const col = hex(sm);
  for (const c of tops) {
    if ((c.seed * 7.13) % 1 > 0.2 && !c.b.house) continue;
    const g = growth(c.b, lt);
    const on = smoothstep(c.b.birth + 0.3, c.b.birth + 0.8, lt);
    if (on <= 0) continue;
    for (let k = 0; k < 9; k++) {
      const period = 0.24, life = 2.0;
      const tk = Math.floor((lt - k * period) / (period * 9)) * period * 9 + k * period + (c.seed % 1) * period;
      const age = lt - tk;
      if (age < 0 || age > life) continue;
      const u = age / life;
      const p = [c.p[0] + 34 * age + 6 * Math.sin(age * 2 + c.seed), c.p[1] - 20 * age, c.p[2] + 16 * age + 30 * u * u];
      const sp = cam.toScreen(p[0], p[1], p[2]);
      if (sp[2] < 2) continue;
      if (lt > 4.5 && occluded(cam, p)) continue;
      const size = (6 + 22 * u) * cam.f / sp[2];
      if (size < 0.6 || size > 500) continue;
      // near chimneys (street level) would smear across the facades: keep smoke for the distance
      // particles are not depth-tested: smoke only while the camera is above the rooftops
      const far = smoothstep(220, 560, sp[2]) * smoothstep(300, 560, cam.pos[2]);
      if (far <= 0) continue;
      smoke.push([sp[0], sp[1], size, c.seed + age * 0.6 + k, col[0], col[1], col[2], 0.9 * on * far * (1 - u) * Math.min(1, u * 4)]);
    }
    void g;
  }
  if (smoke.length) R.particles(smoke, { kind: 'tex', tex: A.puff });

  // lamp glows (and warm pools on the pavement)
  if (lt > 4.2) {
    LAMPS.forEach((lp, k) => {
      const on = lampOn(k, lt);
      if (on <= 0.01) return;
      const p = P3(lp.s, lp.o, LAMP.h - 5);
      const sp = cam.toScreen(p[0], p[1], p[2]);
      if (sp[2] < 3) return;
      if (occluded(cam, p)) return;
      const sc = cam.f / sp[2];
      if (sp[0] < -300 || sp[0] > 2220 || sp[1] < -300 || sp[1] > 1380) return;
      R.glow(sp[0], sp[1], 4.5 * sc, [1, 0.8, 0.5], 1.6 * on, { shape: [2.4, 0.5, 2.2], ext: 4 });
      const g0 = P3(lp.s, lp.o, 0.5), gp = cam.toScreen(g0[0], g0[1], g0[2]);
      if (gp[2] > 3) R.glow(gp[0], gp[1], 22 * cam.f / gp[2], [1, 0.72, 0.42], 0.1 * on, { ext: 2, sx: 1.6, sy: 0.55 });
    });
  }

  // birds
  for (const F of FLOCKS) {
    const u = (lt - F.t0) / (F.t1 - F.t0);
    if (u <= 0 || u >= 1) continue;
    const r = rng('flock' + F.seed);
    for (let i = 0; i < F.n; i++) {
      const off = [r(-1, 1) * F.spread, r(-1, 1) * F.spread, r(-1, 1) * F.spread * 0.3];
      const lag = (Math.abs(i - F.n / 2) / F.n) * 0.08;
      const uu = clamp(u - lag);
      const s = lerp(F.from[0], F.to[0], uu) + off[0] + 8 * Math.sin(lt * 1.7 + i);
      const o = lerp(F.from[1], F.to[1], uu) + off[1];
      const z = F.z + off[2] + 10 * Math.sin(lt * 1.1 + i * 2);
      const p = P3(s, o, z);
      const frame = Math.floor((lt * (9 + (i % 3)) + i * 0.7) % 4);
      const uv = [(frame * BIRD.cw) / (BIRD.cw * BIRD.n), 0, ((frame + 1) * BIRD.cw) / (BIRD.cw * BIRD.n), 1];
      const tint = [0.9 * L.shade[0], 0.9 * L.shade[1], L.shade[2], 1];
      facing(r3, A.birds, cam, p, F.size * 1.6, F.size, uv, tint);
      if (F.shadows) {
        // shadow on the ground, cast along the low sun
        const gp = P3(s + 40, o + 60, 0.6);
        r3.poly(A.birds, [[gp[0] - 12, gp[1] - 6, 0.6], [gp[0] + 12, gp[1] - 6, 0.6], [gp[0] + 12, gp[1] + 6, 0.6], [gp[0] - 12, gp[1] + 6, 0.6]], [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], { tint: [0.2, 0.15, 0.25, 0.28] });
      }
    }
  }
  r3.flush();

  // wind over the crops (top-down phase): long soft sheen gliding along the bands
  if (lt < 3.2) {
    const k = (1 - smoothstep(2.2, 3.2, lt)) * smoothstep(0.15, 1.1, lt);
    for (let i = 0; i < 4; i++) {
      const u = ((lt * 0.28 + i * 0.27) % 1);
      const s = lerp(-1200, 1400, u), o = [-500, 120, 520, -140][i];
      const p = P3(s, o, 0);
      const sp = cam.toScreen(p[0], p[1], p[2]);
      if (sp[2] < 10) continue;
      const sc = cam.f / sp[2];
      R.glow(sp[0], sp[1], 90 * sc, [1, 0.95, 0.75], 0.045 * k * Math.sin(u * Math.PI), { ext: 2.5, sx: 3.2, sy: 0.7, rot: Math.atan2(AY, AX) - cam.yaw + 0 });
    }
  }
}

