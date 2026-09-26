// LAND — effects: meteor, impact (flash, burst, ring, debris), dust billows, flames, embers, smoke.
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, ease, noise1, fbm1, T, crSpline, h01 } from './util.js';
import { atlas } from '../lib/kit.js';
import { fieldStrokes, contour, clipTo } from './paintkit.js';
import { defineLandBrushes } from './brushes.js';
import { IMP, blastR, ringPoint, hitTime, impactDist } from './burn.js';
import { groundV } from './forest.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];

// ------------------------------------------------------------------------------------------------
// painting
// ------------------------------------------------------------------------------------------------
export function paintFx(P) {
  defineLandBrushes(P.brush);
  const A = {};
  // billow atlas: stylised cumulus puffs built from swirling strokes. Painted light & warm (cream top,
  // rose-salmon underside) so instances can be tinted from dust-peach to fire-orange to smoke-grey.
  const CELL = 400;
  A.puffs = atlas(P, 'landPuffs', 6, CELL, (c, cx, cy, i) => {
    const r = c.r;
    // cumulus billow: lobes around a flattened base, rounded sides
    const n = 4 + (i % 3);
    const lobes = [];
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const rr = (44 + 62 * Math.sin(Math.PI * (0.12 + 0.76 * t))) * r(0.85, 1.12);
      lobes.push([cx + lerp(-118, 118, t) + r(-8, 8), cy + 50 - rr * (0.55 + 0.25 * Math.sin(Math.PI * t)), rr]);
    }
    const inside = (x, y) => y < cy + 70 && lobes.some(([lx, ly, lr]) => Math.hypot(x - lx, (y - ly) * 1.05) < lr);
    // outline by marching around the union of lobes (angle sweep from the centre)
    const outline = [];
    for (let q = 0; q < 180; q++) {
      const a = (q / 180) * TAU;
      let rad = 5;
      while (rad < 190 && inside(cx + Math.cos(a) * rad, cy + 10 + Math.sin(a) * rad)) rad += 2;
      outline.push([cx + Math.cos(a) * rad, cy + 10 + Math.sin(a) * rad]);
    }
    c.washPoly(outline, '#f2c2a0', 255);
    c.fillPoly(outline, '#f7d6b8', { opacity: 80, bleed: 0.03, texture: 0.8, border: 0.45 });
    // salmon underside glaze
    c.fillPoly(c.blob(cx, cy + 58, 160, 34, { wobble: 0.1 }), '#d9776e', { opacity: 150, bleed: 0.05, texture: 0.7, border: 0.3 });
    // strokes following each lobe (curved), warm light up-left, salmon below
    for (const [lx, ly, lr] of lobes) {
      for (let k = 0; k < 14; k++) {
        const a0 = r(Math.PI * 0.9, Math.PI * 2.1), span = r(0.5, 1.0), rad = lr * r(0.45, 0.95);
        const arc = [];
        for (let q = 0; q <= 6; q++) { const a = a0 + (span * q) / 6; arc.push([lx + Math.cos(a) * rad, ly + Math.sin(a) * rad * 0.95]); }
        const mid = a0 + span / 2;
        const lit = Math.cos(mid + 2.4) > 0.2;
        const low = Math.sin(mid) > 0.3;
        c.strokePath(arc, 'land_comb', lit ? pick(r, ['#fff1dc', '#fbe2c6']) : low ? pick(r, ['#dc8676', '#d27468']) : pick(r, ['#f0b898', '#eaa98a', '#f6c8a8']), r(0.6, 1.0), 0.6);
      }
    }
    for (let k = 0; k < 30; k++) {
      const x = cx + r(-150, 150), y = cy + r(44, 72);
      if (!inside(x, y)) continue;
      c.strokePath([[x - 22, y], [x, y + r(-2, 2)], [x + 22, y + r(-2, 2)]], 'land_dry', pick(r, ['#c86a62', '#b85e58']), r(0.6, 0.9), 0.5);
    }
    clipTo(c, outline, [cx - CELL / 2 + 2, cy - CELL / 2 + 2, cx + CELL / 2 - 2, cy + CELL / 2 - 2]);
    contour(c, outline.filter((p) => p[1] < cy + 60), { col: '#c07068', w: 1.0, keep: 0.65, run: [8, 18], closed: false });
  }, { cols: 3, scale: 0.9 });
  A.puffCell = CELL;

  // smoke billows: charcoal/grey swirling strokes, warm underlight painted in (tintable)
  A.smoke = atlas(P, 'landSmoke', 6, CELL, (c, cx, cy, i) => {
    const r = c.r;
    const lobes = [];
    const n = 4 + (i % 3);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + ((k / (n - 1)) - 0.5) * 2.8 + r(-0.2, 0.2);
      lobes.push([cx + Math.cos(a) * r(50, 78), cy + 26 + Math.sin(a) * r(40, 66), r(64, 96)]);
    }
    lobes.push([cx, cy + 34, 108]);
    // soft body: overlapping bleeding glazes (darker core/base, lighter tops)
    for (const [x, y, rr] of lobes) c.fillPoly(c.blob(x, y, rr, rr * 0.9, { wobble: 0.16, rot: r(0, TAU) }), pick(r, ['#5e5860', '#665f68', '#58525a']), { opacity: 120, bleed: 0.12, texture: 0.75, border: 0.12 });
    for (const [x, y, rr] of lobes) c.fillPoly(c.blob(x - rr * 0.15, y - rr * 0.25, rr * 0.7, rr * 0.55, { wobble: 0.2 }), pick(r, ['#827c86', '#8a848e']), { opacity: 60, bleed: 0.14, texture: 0.7, border: 0.08 });
    c.fillPoly(c.blob(cx, cy + 92, 130, 36, { wobble: 0.15 }), '#433e45', { opacity: 70, bleed: 0.12, texture: 0.7, border: 0.08 });
    // long curling strokes wrapping each lobe's top, close in value (no dark marks)
    for (const [x, y, rr] of lobes) {
      for (let k = 0; k < 10; k++) {
        const a0 = Math.PI * r(0.95, 1.55), span = r(0.7, 1.3), rad = rr * r(0.55, 0.95);
        const arc = [];
        for (let q = 0; q <= 8; q++) { const a = a0 + (span * q) / 8; arc.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.88]); }
        c.strokePath(arc, 'land_glaze', pick(r, ['#7c7680', '#86808a', '#726c76']), r(0.6, 1.0), 0.6);
      }
    }
  }, { cols: 3, scale: 0.8 });

  // flame drawings (cycled on twos at runtime): clusters of tongues, red -> orange -> yellow core
  A.flames = atlas(P, 'landFlames', 12, 320, (c, cx, cy, i) => {
    const r = c.r;
    const by = cy + 112;
    const nt = 2 + (i % 4);
    const lean = r(-0.25, 0.25);
    const tongues = [];
    for (let j = 0; j < nt; j++) {
      const off = (j - (nt - 1) / 2) * r(18, 30) + r(-8, 8);
      const hh = r(70, 200) * (j === Math.floor(nt / 2) ? 1.15 : r(0.5, 0.95));
      tongues.push({ off, hh, lean: lean + r(-0.2, 0.2), s1: r(-1, 1), s2: r(-1, 1), w: r(0.8, 1.2) });
    }
    const path = (tg, sc) => {
      const pts = [];
      for (let q = 0; q <= 9; q++) {
        const t = q / 9;
        const wav = tg.s1 * 16 * Math.sin(t * Math.PI * 1.6) * t + tg.s2 * 9 * Math.sin(t * Math.PI * 3.2) * t;
        pts.push([cx + tg.off * (1 - 0.6 * t) + tg.lean * tg.hh * t * t + wav, by - tg.hh * sc * t]);
      }
      return pts;
    };
    // glowing base: a few ember dabs (no flat blob, which reads as a dash when small)
    for (let k = 0; k < 7; k++) { const ex = cx + r(-40, 40), ey = by - r(0, 10); c.strokePath([[ex - 6, ey], [ex + 6, ey - r(0, 4)]], 'land_leaf', pick(r, ['#c8321e', '#e0522a']), r(0.8, 1.2), 0.4); }
    for (const tg of tongues) c.strokePath(path(tg, 1), 'land_flame', pick(r, ['#c02a1a', '#d8452f', '#b02418']), r(3.6, 4.6) * tg.w, 0.6);
    for (const tg of tongues) c.strokePath(path(tg, 0.78), 'land_flame', pick(r, ['#ec6a24', '#f5902e', '#e8622c']), r(2.5, 3.1) * tg.w, 0.6);
    for (const tg of tongues) if (r() < 0.8) c.strokePath(path(tg, 0.5), 'land_flame', pick(r, ['#ffcc58', '#ffe08a', '#ffc040']), r(1.4, 1.9) * tg.w, 0.6);
    // detached licks
    for (let k = 0; k < 2; k++) {
      const t0 = tongues[Math.floor(r() * nt)];
      const ly = Math.max(cy - 100, by - t0.hh * r(1.05, 1.25)), lx = cx + t0.off * 0.4 + t0.lean * t0.hh * 0.9 + r(-10, 10);
      c.strokePath([[lx, ly + 24], [lx + r(-5, 5), ly], [lx + r(-4, 4), ly - 20]], 'land_flame', pick(r, ['#f07a28', '#ffb040']), r(1.0, 1.5), 0.6);
    }
    for (let k = 0; k < 10; k++) { const ex = cx + r(-60, 60), ey = by - r(0, 16); c.strokePath([[ex, ey], [ex + r(-8, 8), ey - r(2, 6)]], 'land_dry', pick(r, ['#ff6a20', '#ffb040', '#8a1a0a']), r(0.4, 0.7), 0.3); }
  }, { cols: 4, scale: 0.8 });

  // sunburst rays (drawn additively)
  A.burst = P.layer('landBurst', { w: 1000, h: 1000, scale: 0.8 }, (c) => {
    const r = c.r;
    for (let i = 0; i < 150; i++) {
      const a = r(0, TAU), r0 = r(10, 60), r1 = r(160, 490) * (i % 5 === 0 ? 1 : 0.7);
      const pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([500 + Math.cos(a) * lerp(r0, r1, t), 500 + Math.sin(a) * lerp(r0, r1, t), lerp(1.3, 0.2, t)]); }
      c.strokePath(pts, i % 3 ? 'land_contour' : 'land_leaf', pick(r, ['#fff4d0', '#ffd890', '#ffb060', '#ffe8b0', '#ff9a50']), r(0.6, 1.6), 0.3);
    }
  });

  // meteor streak: long tapered ribbon of streaks (cream core, orange, red edges), along +x
  A.streak = P.layer('landStreak', { w: 1200, h: 120, scale: 0.9 }, (c) => {
    const r = c.r;
    // tapering trail: wide and hot at the head (right end), thin and cooler towards the tail
    const layers = [['#b82a1a', 52, 0.9], ['#d8452f', 40, 1.0], ['#e8622c', 30, 1.1], ['#f5a040', 18, 1.2], ['#fff0c8', 8, 1.4]];
    for (const [col, hw, wmul] of layers) {
      for (let k = 0; k < 46; k++) {
        const x1 = r(900, 1190), x0 = r(0, 500);
        const off = r(-1, 1);
        const pts = [];
        for (let q = 0; q <= 6; q++) {
          const t = q / 6, x = lerp(x0, x1, t);
          const taper = Math.pow(x / 1200, 1.4);
          pts.push([x, 60 + off * hw * taper, 0.3 + 1.2 * taper]);
        }
        c.strokePath(pts, 'land_comb', col, r(0.45, 0.8) * wmul, 0.5);
      }
    }
    // hot head
    c.washPoly(c.blob(1150, 60, 42, 30, { wobble: 0.1 }), '#fff4d8', 255);
  });
  return A;
}

// ------------------------------------------------------------------------------------------------
// meteor
// ------------------------------------------------------------------------------------------------
export const MET = { p0: [1620, 70], dir: null };
MET.dir = (() => { const dx = IMP.u - MET.p0[0], dy = IMP.v - MET.p0[1]; const L = Math.hypot(dx, dy); return [dx / L, dy / L, L]; })();
// progress along the path (0 at appearance, 1 at impact)
export function meteorS(lt) {
  const x = (lt - T.streak) / (T.impact - T.streak);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 0.06 * x + 0.94 * Math.pow(x, 4.2);
}
export function meteorPos(s) {
  return [MET.p0[0] + MET.dir[0] * MET.dir[2] * s, MET.p0[1] + MET.dir[1] * MET.dir[2] * s];
}
// Draw the meteor in plane IMP.d coordinates (caller pushes the plane matrix).
export function drawMeteor(R, A, lt) {
  const x = lt - T.streak;
  if (x < 0) return;
  const ang = Math.atan2(MET.dir[1], MET.dir[0]);
  if (lt < T.impact) {
    const s = meteorS(lt);
    const p = meteorPos(s);
    const grow = smoothstep(0, 0.3, x);
    const k = 0.3 + 0.7 * Math.pow(s, 0.55);
    // tail: the burning trail behind it (never shorter than a glowing streak)
    const sPrev = meteorS(lt - 0.3);
    const trail = Math.max((s - sPrev) * MET.dir[2], 70 + 380 * smoothstep(0, 1.15, x));
    const q = [p[0] - MET.dir[0] * trail, p[1] - MET.dir[1] * trail];
    // painted fiery trail (opaque paint so it reads against the bright sky) + additive heat
    R.layer(A.streak, M.chain(M.translate(q[0], q[1]), M.rotate(ang), M.scale(trail / 1200, (0.3 + 0.8 * k) * grow), M.translate(0, -60)), { opacity: grow });
    R.layer(A.streak, M.chain(M.translate(q[0], q[1]), M.rotate(ang), M.scale(trail / 1200, (0.3 + 0.8 * k) * grow * 0.55), M.translate(0, -60)), { blend: 'add', opacity: 0.6 * grow });
    R.glow(lerp(q[0], p[0], 0.6), lerp(q[1], p[1], 0.6), trail * 0.35, [1, 0.5, 0.22], 0.22 * k * grow, { ext: 2.5, sx: 1.8, sy: 0.25, rot: ang });
    R.glow(p[0], p[1], 10 + 40 * k, [1, 0.92, 0.75], (1.0 + 1.8 * k) * grow, { shape: [2.6, 0.4, 2.2], ext: 4 });
    R.glow(p[0], p[1], 50 + 150 * k, [1, 0.5, 0.2], 0.16 * k * grow, { ext: 3 });
    // sparkle when it first appears
    R.glow(p[0], p[1], 120 * grow, [1, 0.95, 0.85], 0.35 * Math.exp(-x * 2.5) * grow, { shape: [8, 0.1, 6], ext: 3, sx: 2.5, sy: 0.1, rot: 0.6 });
    R.glow(p[0], p[1], 120 * grow, [1, 0.95, 0.85], 0.25 * Math.exp(-x * 2.5) * grow, { shape: [8, 0.1, 6], ext: 3, sx: 2.5, sy: 0.1, rot: -0.9 });
  } else {
    // lingering beam: the whole trail glows and fades
    const f = Math.exp(-(lt - T.impact) * 1.6) * (1 - smoothstep(T.impact + 1.4, T.impact + 2.4, lt));
    if (f < 0.002) return;
    const q = meteorPos(-0.25), p = [IMP.u, IMP.v];
    const len = Math.hypot(p[0] - q[0], p[1] - q[1]);
    const wid = 1 + 1.8 * (1 - Math.exp(-(lt - T.impact) * 3));
    R.layer(A.streak, M.chain(M.translate(q[0], q[1]), M.rotate(ang), M.scale(len / 1200, 0.9 * wid), M.translate(0, -60)), { blend: 'add', opacity: f });
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      R.glow(lerp(q[0], p[0], t), lerp(q[1], p[1], t), 60 * wid, [1, 0.6, 0.3], 0.18 * f, { ext: 3, sx: 3, sy: 0.45, rot: ang });
    }
  }
}

// ------------------------------------------------------------------------------------------------
// explosion (plane IMP.d): core, burst rays
// ------------------------------------------------------------------------------------------------
export function drawExplosion(R, A, lt) {
  const x = lt - T.impact;
  if (x < -0.04) return;
  const u = IMP.u, v = IMP.v;
  const pre = x < 0 ? (x + 0.04) / 0.04 : 1;
  const grow = 1 - Math.exp(-Math.max(0, x) * 6);
  const fade = x < 0 ? 1 : Math.exp(-x * 0.9);
  // fireball dome glow (short HDR burst, then a warm glowing dome)
  R.glow(u, v - 40, 120 + 420 * grow, [1, 0.66, 0.34], (0.25 + 0.8 * Math.exp(-x * 8)) * fade * pre, { shape: [1.4, 0.45, 1.6], ext: 3 });
  R.glow(u, v - 20, 40 + 150 * grow, [1, 0.94, 0.8], (0.5 + 1.4 * Math.exp(-Math.max(0, x) * 9)) * pre * fade, { shape: [2.2, 0.4, 2.4], ext: 4 });
  // ground-hugging flare
  R.glow(u, v, 300 + 800 * grow, [1, 0.58, 0.28], 0.2 * fade * pre, { ext: 2.5, sx: 2.6, sy: 0.32 });
  // rays: painted burst, spun and scaled out, additive
  const bs = (0.25 + 1.6 * grow) * (1 + 0.15 * Math.sin(x * 9));
  const bo = pre * Math.exp(-x * 1.4);
  R.layer(A.burst, M.place(u, v - 30, bs, 0.15 * x, 500, 500, bs * 0.75), { blend: 'add', opacity: 0.9 * bo });
  R.layer(A.burst, M.place(u, v - 30, bs * 0.62, -0.3 * x + 1, 500, 500, bs * 0.5), { blend: 'add', opacity: 0.7 * bo });
}

// Blast ring on the ground: returns polyline (screen coords via caller's plane function).
export function ringSamples(lt, n = 96) {
  const rho = blastR(lt);
  if (rho <= 0) return [];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const p = ringPoint(rho, a);
    out.push(p);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// dust billows from the impact: [ {d, u, v, size, rot, sprite, col...} ] for time lt
// ------------------------------------------------------------------------------------------------
const PUFFS = (() => {
  const r = rng('land-dust');
  const out = [];
  // two banks rolling left / right along the ground behind the dinosaur, a few rolling away
  for (let i = 0; i < 26; i++) {
    const kind = i < 11 ? 'L' : i < 22 ? 'R' : 'B';
    const a = kind === 'L' ? Math.PI + r(-0.05, 0.35) : kind === 'R' ? r(-0.35, 0.05) : Math.PI / 2 + r(-0.6, 0.6);
    out.push({ kind, a, f: r(0.3, 0.95), s: r(0.75, 1.2), sp: r.int(0, 5), rot: r(-0.1, 0.1), delay: r(0, 0.18), rise: r(8, 30), ph: r(0, TAU) });
  }
  return out;
})();
export function dustPuffs(lt) {
  const x = lt - T.impact;
  if (x <= 0 || x > 5) return [];
  const out = [];
  for (const p of PUFFS) {
    const xx = x - p.delay;
    if (xx <= 0) continue;
    const rho = blastR(T.impact + xx) * p.f * 0.9;
    const q = ringPoint(rho, p.a);
    if (!q || q.d < 1.02) continue;
    const grow = 1 - Math.exp(-xx * 2.6);
    const size = Math.min(430, (100 + 250 * grow + 30 * xx) * p.s / q.d);
    const lift = (p.rise * xx + 12 * xx * xx) / q.d;
    out.push({ d: q.d, u: q.u, v: q.v - size * 0.3 - lift, size, rot: p.rot + 0.04 * Math.sin(xx * 1.3 + p.ph), sp: p.sp, age: xx, kind: p.kind });
  }
  return out.sort((a, b) => b.d - a.d);
}

// ------------------------------------------------------------------------------------------------
// debris + sparks (plane IMP.d coordinates), analytic ballistic arcs
// ------------------------------------------------------------------------------------------------
const DEBRIS = (() => {
  const r = rng('land-debris');
  return Array.from({ length: 260 }, (_, i) => ({ a: -Math.PI / 2 + r(-1.25, 1.25), v: r(300, 1300), s: r(1.5, 6), spark: i % 5 !== 0, life: r(0.8, 2.2), spin: r(-8, 8), delay: r(0, 0.12) }));
})();
export function debrisParticles(lt) {
  const x0 = lt - T.impact;
  if (x0 <= 0) return { rocks: [], sparks: [] };
  const rocks = [], sparks = [];
  for (const d of DEBRIS) {
    const x = x0 - d.delay;
    if (x <= 0 || x > d.life) continue;
    const g = 900;
    const px = IMP.u + Math.cos(d.a) * d.v * x;
    const py = IMP.v - 40 + Math.sin(d.a) * d.v * x + 0.5 * g * x * x;
    const life = 1 - x / d.life;
    if (d.spark) {
      const col = hex(mixHex('#fff2c0', '#ff6a20', clamp(x / d.life * 1.4)));
      sparks.push([px, py, d.s * 0.8 * (0.5 + life), 0, col[0], col[1], col[2], life * 1.4]);
    } else {
      rocks.push([px, py, d.s * 0.9, d.spin * x, 0.3, 0.1, 0.05, Math.min(1, life * 3) * 0.85]);
    }
  }
  return { rocks, sparks };
}

// ------------------------------------------------------------------------------------------------
// fire sources: points on the ground / trunks, each with its own hit time
// ------------------------------------------------------------------------------------------------
export function makeFireSources(trees) {
  const r = rng('land-fire');
  const src = [];
  // clustered along each ground band: some patches dense, some bare; size varies
  const bands = [[2.0, 16], [1.3, 12], [1.05, 16], [0.8, 12], [0.66, 8]];
  for (const [d, n] of bands) {
    for (let i = 0; i < n; i++) {
      const cx = lerp(-250, 2250, (i + r(0.1, 0.9)) / n);
      const k = r() < 0.35 ? 1 : r.int(2, 3);
      for (let j = 0; j < k; j++) {
        const u = cx + r(-70, 70) / d;
        const dd = d * r(0.97, 1.05);
        src.push({ d: dd, u, v: groundV(dd) + r(0, 16) / dd, h: r(0.55, 1.35), kind: 'ground', tHit: hitTime(impactDist(u, dd)) + r(0.1, 0.6), ph: r(0, 100) });
      }
    }
  }
  for (const tr of trees) {
    for (let k = 0; k < 3; k++) {
      src.push({ d: tr.d, u: tr.x + r(-20, 20) * tr.s, v: groundV(tr.d) - r(80, 420) * tr.s, h: r(0.8, 1.2), kind: 'trunk', tHit: hitTime(impactDist(tr.x, tr.d)) + r(0.2, 0.9), ph: r(0, 100) });
    }
  }
  return src;
}

// Embers: analytic particles rising from fire sources (world coords per plane handled by caller).
const EMBERS = (() => {
  const r = rng('land-embers');
  return Array.from({ length: 1600 }, () => ({ src: r(), t0: r(0, 1), life: r(1.2, 3.2), vx: r(-40, 80), vy: r(-90, -220), s: r(1.2, 3.6), ph: r(0, TAU), f: r(1, 3) }));
})();
export { EMBERS };

// Smoke: columns of puffs streaming up from a few fire sources (plus a drifting ceiling).
const COLUMNS = (() => {
  const r = rng('land-smoke');
  return Array.from({ length: 9 }, (_, i) => ({ src: (i + r(0.1, 0.9)) / 9, lean: r(20, 70), grow: r(0.9, 1.3), sp: i % 6, ph: r(0, TAU) }));
})();
export function smokePuffs(lt, sources) {
  const out = [];
  if (lt < T.impact + 1.4) return out;
  const period = 0.3, life = 5.0;
  for (const col of COLUMNS) {
    const pool = sources.filter((s) => s.kind === 'ground' && s.d >= 1.04);
    const src = pool[Math.floor(col.src * pool.length)];
    const start = Math.max(src.tHit + 1.2, T.impact + 1.4);
    for (let k = 0; k < Math.ceil(life / period) + 1; k++) {
      // puff k born at the latest multiple of the period (so puffs keep a fixed identity over time)
      const n = Math.floor((lt - start) / period) - k;
      if (n < 0) continue;
      const born = start + n * period;
      const x = lt - born;
      if (x < 0 || x > life) continue;
      const q = x / life;
      const size = (90 + 520 * Math.pow(q, 0.7) * col.grow) / Math.max(src.d, 0.95);
      const h1 = ((n * 7919) % 101) / 101;
      out.push({ d: src.d, u: src.u + (col.lean * x + 30 * Math.sin(x * 0.8 + col.ph + n)) / src.d, v: src.v - (110 * x + 34 * x * x) / src.d - size * 0.25, size, rot: (h1 - 0.5) * 0.8 + 0.1 * x, sp: (col.sp + n) % 6, a: smoothstep(0, 0.12, q) * (1 - smoothstep(0.55, 1, q)), dark: q });
    }
  }
  return out.sort((a, b) => b.d - a.d);
}
