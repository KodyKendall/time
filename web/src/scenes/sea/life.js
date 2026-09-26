// SEA — marine life for the swim: schools of small fish, jellyfish, swaying kelp. Pure functions of time.
import { C } from '../lib/palette.js';
import { atlas } from '../lib/kit.js';
import { M, TAU, lerp, clamp, invLerp, ease, rng, seg, mixHex } from './lib.js';
import { groundY } from './terrain.js';

export function paintLife(P) {
  const fish = atlas(P, 'smallfish', 4, 200, (c, cx, cy, i) => {
    const pal = [
      { body: C.orange, belly: C.cream, stripe: C.gold, fin: C.teal, tail: C.vermilion },
      { body: '#8fb7c9', belly: '#e8f0f0', stripe: '#2a5d8a', fin: '#5a8aa8', tail: '#2a5d8a' },
      { body: C.gold, belly: '#fbe7b0', stripe: C.orange, fin: C.amber, tail: C.orange },
      { body: C.rose, belly: '#f3d0d8', stripe: C.magenta, fin: C.plum, tail: C.magenta },
    ][i];
    const body = [];
    for (let k = 0; k <= 28; k++) {
      const a = (k / 28) * TAU;
      const w = 62, h = 24 * (1 - 0.35 * Math.cos(a));
      body.push([cx + 10 + Math.cos(a) * w, cy + Math.sin(a) * h]);
    }
    const tail = [[cx - 44, cy], [cx - 86, cy - 30], [cx - 74, cy], [cx - 86, cy + 30]];
    c.washPoly(tail, pal.tail, 250);
    c.washPoly(body, pal.body, 255);
    c.fillPoly(body.slice(14).concat([[cx + 72, cy], [cx - 52, cy]]), pal.belly, { opacity: 160, bleed: 0.02, texture: 0.6, border: 0.4 });
    c.strokePath([[cx - 40, cy - 6], [cx, cy - 12], [cx + 46, cy - 6]], 'sea_comb', pal.stripe, 0.7, 0.5);
    c.washPoly([[cx - 6, cy - 22], [cx + 14, cy - 44], [cx + 30, cy - 22]], pal.fin, 240);
    c.washPoly([[cx + 12, cy + 8], [cx - 4, cy + 26], [cx + 24, cy + 14]], pal.fin, 230);
    const eye = c.blob(cx + 50, cy - 5, 6, 6, { n: 12, wobble: 0.02 });
    c.washPoly(eye, '#fff4d8', 255);
    c.washPoly(c.blob(cx + 51, cy - 5, 3, 3, { n: 10, wobble: 0.02 }), '#101828', 255);
    c.strokePath(body.concat([body[0]]), 'sea_contour', '#3a1022', 0.7, 0.4);
    c.strokePath([[cx + 30, cy - 18], [cx + 26, cy], [cx + 30, cy + 16]], 'wire', '#3a1022', 0.9, 0.5);
  }, { cols: 4, scale: 1.4 });
  const jelly = atlas(P, 'jelly', 2, 300, (c, cx, cy, i) => {
    const col = i ? C.lavender : '#f3b0c0';
    const bell = [];
    for (let k = 0; k <= 24; k++) { const a = Math.PI + (k / 24) * Math.PI; bell.push([cx + Math.cos(a) * 70, cy - 40 + Math.sin(a) * 60]); }
    bell.push([cx + 70, cy - 30], [cx - 70, cy - 30]);
    c.fillPoly(bell, col, { opacity: 150, bleed: 0.03, texture: 0.6, border: 0.5 });
    c.strokePath(bell.slice(0, 25), 'sea_contour', mixHex(col, '#ffffff', 0.4), 1.0, 0.5);
    for (let k = 0; k < 9; k++) {
      const x0 = cx - 60 + k * 15, pts = [];
      for (let j = 0; j <= 8; j++) pts.push([x0 + 8 * Math.sin(j * 0.9 + k), cy - 30 + j * 20]);
      c.strokePath(pts, k % 3 ? 'wire' : 'sea_leaf', mixHex(col, '#ffffff', 0.25), k % 3 ? 1.1 : 0.35, 0.6);
    }
  }, { cols: 2, scale: 1.2 });
  return { fish, jelly };
}

// Schools: formation offsets around a centre travelling on an endless straight line (so a school only
// ever enters or leaves the picture by swimming across the frame edge), each fish with its own wiggle.
const SCHOOLS = (() => {
  const r = rng('sea-schools');
  const mk = (n, variant, tMid, mid, vel, spread, scale, depth) => {
    const f = [];
    for (let i = 0; i < n; i++) f.push({ ox: r.gauss(0, spread), oy: r.gauss(0, spread * 0.45), ph: r(0, TAU), sp: r(0.8, 1.2), s: scale * r(0.8, 1.15), v: variant >= 0 ? variant : r.int(0, 3) });
    return { f, tMid, mid, vel, depth };
  };
  return [
    mk(22, 0, 9.9, [2520, -80], [-330, 175], 150, 0.62, 1),
    mk(14, 1, 11.6, [3480, -620], [-240, 120], 130, 0.5, 1.2),
    mk(10, -1, 13.2, [4480, -980], [-300, 150], 110, 0.55, 1),
  ];
})();
export function drawSchools(R, A, t, alpha = 1) {
  const at = A.life.fish;
  for (const S of SCHOOLS) {
    const dt = t - S.tMid;
    const cx = S.mid[0] + S.vel[0] * dt, cy = S.mid[1] + S.vel[1] * dt + 40 * Math.sin(dt * 1.3);
    const [sx, sy] = R.toScreen(cx, cy);
    const rad = 600 * R.scale();
    if (sx < -rad || sx > 1920 + rad || sy < -rad || sy > 1080 + rad) continue;
    const dir = Math.atan2(S.vel[1], S.vel[0]);
    const flip = Math.cos(dir) < 0 ? -1 : 1;
    for (const f of S.f) {
      const x = cx + f.ox + 25 * Math.sin(t * 1.3 * f.sp + f.ph), y = cy + f.oy + 12 * Math.sin(t * 1.7 * f.sp + f.ph * 2);
      const wig = 0.12 * Math.sin(t * 9 * f.sp + f.ph);
      const rot = (flip < 0 ? dir + Math.PI : dir) + wig;
      const sxx = f.s * flip * (1 + 0.05 * Math.sin(t * 9 * f.sp + f.ph + 1)), syy = f.s;
      R.layer(at.layer, M.chain(M.translate(x, y), M.rotate(rot), M.scale(sxx, syy), M.translate(-100, -100)), { uv: at.uv(f.v), w: 200, h: 200, opacity: alpha, ...(S.depth > 1 ? { grade: [0.8, 0.85, 1], color: [0.12, 0.45, 0.5, 0.25] } : {}) });
    }
  }
}
const JELLIES = (() => {
  const r = rng('sea-jellies');
  return Array.from({ length: 7 }, (_, i) => ({ x: r(1700, 4500), y: r(-1300, -200), s: r(0.35, 0.7), v: i % 2, ph: r(0, TAU), drift: r(8, 22) }));
})();
export function drawJellies(R, A, t) {
  const at = A.life.jelly;
  for (const j of JELLIES) {
    const pulse = Math.sin(t * 2.2 + j.ph);
    const x = j.x + 20 * Math.sin(t * 0.4 + j.ph), y = j.y - j.drift * t - 10 * Math.max(0, pulse);
    R.layer(at.layer, M.chain(M.translate(x, y), M.rotate(0.15 * Math.sin(t * 0.7 + j.ph)), M.scale(j.s * (1 + 0.07 * pulse), j.s * (1 - 0.08 * pulse)), M.translate(-150, -150)), { uv: at.uv(j.v), w: 300, h: 300, opacity: 0.85 });
  }
}
// Kelp strands rooted on the reef, swaying (per-frame strokes).
const KELP = (() => {
  const r = rng('sea-kelp');
  const out = [];
  for (let i = 0; i < 26; i++) {
    const x = r(2350, 4750);
    out.push({ x, h: r(260, 620), ph: r(0, TAU), col: r.pick(['#3f7d5a', '#2f6048', '#5d7a3e', '#4f8a5a', '#7a8a3a']), w: r(0.7, 1.2) });
  }
  return out;
})();
export function paintKelp(c, P, t, rect = [-100, -100, 2212, 1288]) {
  const z = M.scaleOf(P);
  for (const k of KELP) {
    const y0 = groundY(k.x) + 10;
    const pts = [];
    const n = 9;
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      const sway = (18 + 40 * u) * u * Math.sin(t * 1.1 - u * 2.4 + k.ph) + 30 * u * u;
      pts.push(M.apply(P, k.x + sway, y0 - k.h * u));
    }
    if (!pts.some((q) => q[0] > rect[0] && q[0] < rect[2] && q[1] > rect[1] && q[1] < rect[3])) continue;
    c.strokePath(pts, 'sea_contour', k.col, 1.2 * z * k.w, 0.5);
    for (let j = 1; j < n; j += 2) {
      const a = pts[j], b = pts[j + 1];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const side = j % 2 ? 1 : -1;
      const l = 70 * z * (1 - (j / n) * 0.4) * k.w;
      const la = ang + side * 0.9 + 0.2 * Math.sin(t * 1.4 + j + k.ph);
      c.strokePath([a, [a[0] + Math.cos(la) * l * 0.5, a[1] + Math.sin(la) * l * 0.5], [a[0] + Math.cos(la) * l, a[1] + Math.sin(la) * l]], 'sea_leaf', mixHex(k.col, '#a8bf96', 0.25), 0.5 * z * k.w, 0.5);
    }
  }
}
