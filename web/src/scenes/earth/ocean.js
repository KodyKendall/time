// EARTH — the primordial ocean at night (lt ~12.5 .. 20): huge young full Moon rising opposite the
// set Sun, moonlit cloud streaks, distant volcanic islands, sea stacks, a dark hatched sea.
import { circlePts } from '../lib/kit.js';
import { C, M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, smoother, win, strokeBatch, hash, fbm2, noise1 } from './common.js';
import { paintSphere, crater } from './paint.js';
import { HORIZON, planetCircle, seaDepth, limbY } from './descent.js';

export const MOON = { R: 300, rest: [1330, 232], r: 178 };

export function paintOcean(P) {
  const A = {};
  // --- the Moon: full, painted like a gouache study (maria, craters, ray systems)
  A.moon = P.layer('moon', { w: 700, h: 700, scale: 0.9 }, (c) => {
    const r = c.r, cx = 350, cy = 350, R0 = MOON.R;
    const pal = { base: '#e9dcc0', light: ['#fff4dc', '#f6ead0', C.cream], mid: ['#e2d4b8', '#d8cbb4', '#e9dcc0'], shadow: ['#b9b0c4', '#a39cb8'], deep: '#8a86a6', hi: '#fffaf0', rim: '#7a7898' };
    const features = (cc, x, y, R, at) => {
      // maria: cool grey-blue watercolour blots in the classic places
      const maria = [[-0.28, -0.3, 0.3, 0.22], [0.12, -0.32, 0.2, 0.17], [0.2, -0.05, 0.22, 0.16], [-0.45, 0.05, 0.25, 0.35], [0.02, 0.2, 0.16, 0.12], [0.35, 0.3, 0.14, 0.1], [-0.15, 0.42, 0.12, 0.09]];
      for (const [mx, my, rx, ry] of maria) {
        const b = cc.blob(x + mx * R, y + my * R, rx * R, ry * R, { wobble: 0.28, rot: r(-0.5, 0.5) });
        cc.fillPoly(b, r.pick(['#6f7a96', '#66708e', '#7a7896', '#6a7490']), { opacity: 170, bleed: 0.07, texture: 0.85, border: 0.55 });
      }
      cc.flush();
      // mare texture: soft horizontal-ish scumbles
      const sc = [];
      for (let k = 0; k < 60; k++) {
        const [mx, my, rx, ry] = r.pick(maria);
        const px = x + (mx + r(-rx, rx) * 0.8) * R, py = y + (my + r(-ry, ry) * 0.8) * R;
        sc.push({ pts: [[px, py], [px + r(-30, 30), py + r(-12, 12)], [px + r(-50, 50), py + r(-18, 18)]], brush: r.pick(['dry', 'pastel']), color: r.pick(['#7d86a0', '#b0aec4', '#8a90aa', '#c8c2d0']), w: r(0.6, 1.1), curv: 0.6, seed: 'ms' + k });
      }
      strokeBatch(cc, sc);
      // craters
      for (let k = 0; k < 34; k++) crater(cc, at(r(0.05, 1.45), r(0, TAU)), r(5, 20) * (R / 300) * (k < 6 ? 1.8 : 1), Math.PI * 1.15, '#8a86a6', '#fffaf0', 'mc' + k);
      // bright ray crater (Tycho-like) and a smaller one
      for (const [tx, ty, n] of [[0.02, 0.62, 16], [-0.62, -0.1, 9]]) {
        const rays = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + r(-0.15, 0.15), L = r(0.2, 0.6) * R;
          rays.push({ pts: [[x + tx * R, y + ty * R, 1], [x + tx * R + Math.cos(a) * L * 0.5, y + ty * R + Math.sin(a) * L * 0.5, 0.6], [x + tx * R + Math.cos(a) * L, y + ty * R + Math.sin(a) * L, 0.1]], brush: 'earth_hair', color: '#fffaf0', w: r(0.7, 1.2), curv: 0.3, seed: `ry${tx}_${k}` });
        }
        strokeBatch(cc, rays);
        cc.washPoly(cc.blob(x + tx * R, y + ty * R, 9, 8), '#fffaf0', 230);
      }
    };
    paintSphere(c, cx, cy, R0, pal, { la: Math.PI * 1.1, lz: 1.28, n: 260, features, seed: 'moon', strokeW: 1.2, hiN: 3, shadowSteps: [[-0.2, 30], [0.0, 55], [0.2, 80]], terminator: 1.2 });
    c.flush();
    for (let k = 0; k < 14; k++) {
      const a = r(0, TAU), d = R0 * r(0.1, 0.85), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      c.line(x, y, x + r(-50, 50), y + r(-50, 50), 'earth_speck', r.pick(['#8a86a6', '#fffaf0']), 0.7);
    }
  });

  // --- cloud streak sheets (moonlit), long horizontal bands
  const cloudSheet = (name, seed, tones) => P.layer(name, { w: 2800, h: 520, scale: 0.8 }, (c) => {
    const r = c.r;
    const list = [];
    for (let k = 0; k < 34; k++) {
      const y = 70 + r(0, 380), x = r(-100, 2200), len = r(500, 1400), pts = [];
      for (let j = 0; j <= 10; j++) pts.push([x + (len * j) / 10, y + 16 * Math.sin(j * 0.8 + k) + r(-4, 4), 0.35 + 0.8 * Math.sin((Math.PI * j) / 10)]);
      list.push({ pts, brush: r.pick(['earth_scumble', 'marker', 'gouache', 'earth_scumble']), color: r.pick(tones), w: r(1.2, 3.0), curv: 0.6, seed: `${seed}b${k}` });
    }
    strokeBatch(c, list);
    // moonlit upper edges + fine horizontal hatching (engraving texture)
    const hl = [];
    for (let k = 0; k < 36; k++) {
      const y = 60 + r(0, 400), x = r(0, 2500), len = r(120, 520), pts = [];
      for (let j = 0; j <= 6; j++) pts.push([x + (len * j) / 6, y + 3 * Math.sin(j + k), Math.sin((Math.PI * j) / 6)]);
      hl.push({ pts, brush: k % 3 ? 'wire' : 'earth_hair', color: r.pick(['#cfd8e8', '#e8e4f0', '#9fb0c8', '#b3a9c4']), w: r(0.6, 1.1), curv: 0.4, seed: `${seed}h${k}` });
    }
    strokeBatch(c, hl);
  });
  A.cloudsHi = cloudSheet('oceanCloudsHi', 'ch', ['#3a4a6a', '#4a5a7a', '#5a6a88', '#6a7898', '#2e3a58']);
  A.cloudsLo = cloudSheet('oceanCloudsLo', 'cl', ['#2a3854', '#34445e', '#46587a', '#22304a', '#56688a']);

  // --- distant volcanic islands on the horizon (silhouettes with moonlit ridges)
  A.islands = P.layer('islands', { w: 2400, h: 300, scale: 0.8 }, (c) => {
    const r = c.r, base = 290;
    const ridge = (x0, x1, h, peaks, seed) => {
      const pts = [[x0, base]];
      for (let j = 0; j <= 40; j++) {
        const x = lerp(x0, x1, j / 40), s = j / 40;
        let y = base - h * Math.sin(Math.PI * s) ** 0.8 * (0.75 + 0.25 * fbm2(x * 0.01, seed, 3));
        for (const p of peaks) y = Math.min(y, base - p.h * Math.max(0, 1 - Math.abs(x - p.x) / p.w));
        pts.push([x, y]);
      }
      pts.push([x1, base]);
      return pts;
    };
    const isl = [
      { x0: 60, x1: 760, h: 60, peaks: [{ x: 420, h: 150, w: 170 }], col: '#15243a' },
      { x0: 650, x1: 1150, h: 38, peaks: [], col: '#1b2c44' },
      { x0: 1650, x1: 2350, h: 46, peaks: [{ x: 1900, h: 90, w: 140 }], col: '#1a2a42' },
    ];
    isl.forEach((s, i) => {
      const pts = ridge(s.x0, s.x1, s.h, s.peaks, i);
      c.washPoly(pts, s.col, 255);
      c.fillPoly(pts, mixHex(s.col, C.sea, 0.25), { opacity: 70, bleed: 0.03, texture: 0.8, border: 0.4 });
      // moonlit ridge strokes (right-facing slopes), texture
      const rl = [];
      for (let k = 0; k < 26; k++) {
        const j = r.int(3, pts.length - 4);
        const p = pts[j], q = pts[j + 2];
        rl.push({ pts: [[p[0], p[1] + 2], [q[0], q[1] + 3]], brush: r.pick(['dry', 'earth_hair', 'pastel']), color: r.pick(['#4a6a8a', '#6a88a8', '#3a5a78']), w: r(0.6, 1.1), curv: 0.4, seed: `ir${i}_${k}` });
      }
      for (let k = 0; k < 60; k++) {
        const j = r.int(2, pts.length - 3);
        const p = pts[j];
        const depth = r(0.05, 0.9) * (base - p[1]);
        const x = p[0] + r(-20, 20), y = p[1] + depth;
        const slope = Math.atan2(pts[j + 1][1] - pts[j - 1][1], pts[j + 1][0] - pts[j - 1][0]);
        const L = r(14, 40);
        rl.push({ pts: [[x, y], [x + Math.cos(slope) * L, y + Math.sin(slope) * L]], brush: r.pick(['dry', 'pastel', 'earth_body']), color: r.pick(['#0e1a2e', '#22344e', '#1a2c46', '#2c4262']), w: r(0.35, 0.8), curv: 0.3, seed: 'it' + i + '_' + k });
      }
      // moonlight catching the right-facing slopes
      for (let k = 0; k < 18; k++) {
        const j = r.int(Math.floor(pts.length / 2), pts.length - 3);
        const p = pts[j], q = pts[Math.min(pts.length - 2, j + 2)];
        if (q[1] <= p[1]) continue;
        rl.push({ pts: [[p[0] + 2, p[1] + 3], [q[0] + 2, q[1] + 3]], brush: 'pastel', color: r.pick(['#5a7a9a', '#7a98b8']), w: r(0.5, 0.9), curv: 0.3, seed: 'im' + i + '_' + k });
      }
      strokeBatch(c, rl);
    });
    // a smoke plume leaning off the volcano
    const pl = [];
    for (let k = 0; k < 14; k++) {
      const x0 = 420 + r(-8, 8), y0 = base - 150 - 4, pts = [];
      for (let j = 0; j <= 7; j++) pts.push([x0 + j * j * 5.5 + r(-6, 6), y0 - j * 26, 0.4 + j * 0.12]);
      pl.push({ pts, brush: r.pick(['earth_scumble', 'marker', 'dry']), color: r.pick(['#3a3a50', '#4a4658', '#2e3044', '#5a5468']), w: r(0.8, 1.6), curv: 0.6, seed: 'pl' + k });
    }
    strokeBatch(c, pl);
    // mist band along the waterline
    for (let k = 0; k < 6; k++) c.strokePath([[r(0, 400), base - r(4, 16)], [r(900, 1400), base - r(4, 20)], [r(1800, 2400), base - r(2, 14)]], 'marker', r.pick(['#3a5a78', '#4a6a88']), r(1.0, 1.8), 0.6);
  });

  // --- a craggy sea stack (foreground framing on the left): two spires, moonlit from the right
  A.stacks = P.layer('stacks', { w: 900, h: 1300, scale: 0.9 }, (c) => {
    const r = c.r;
    const base = 1290;
    // spire profile: half-widths on the left/right as functions of height fraction s
    const mk = (cx, w, h, seed) => {
      const wl = (s2) => w * 0.5 * (Math.pow(1 - s2, 0.55) * 0.9 + 0.1) * (1 + 0.16 * fbm2(s2 * 5, seed, 3) + (Math.floor(s2 * 9) % 3 === 1 ? 0.05 : 0));
      const wr = (s2) => w * 0.5 * (Math.pow(1 - s2, 0.6) * 0.9 + 0.1) * (1 - 0.1 * fbm2(s2 * 6 + 7, seed, 3) + 0.05 * Math.sin(s2 * 11 + seed));
      const L = [], Rr = [];
      for (let j = 0; j <= 40; j++) { const s2 = j / 40; L.push([cx - wl(s2), base - h * s2]); Rr.push([cx + wr(s2), base - h * s2]); }
      return { cx, w, h, wl, wr, pts: L.concat([[cx + (seed % 2 ? 8 : -6), base - h - 22]], Rr.reverse()) };
    };
    const sp = [mk(330, 360, 1080, 1), mk(640, 250, 720, 2)];
    for (const S of sp) {
      c.washPoly(S.pts, '#0b1322', 255);
      c.fillPoly(S.pts, '#15223a', { opacity: 70, bleed: 0.015, texture: 0.85, border: 0.5 });
    }
    c.flush();
    const st = [];
    sp.forEach((S, si) => {
      const at = (u, s2) => [S.cx - S.wl(s2) + (S.wl(s2) + S.wr(s2)) * u, base - S.h * s2];
      // vertical form strokes (the rock's grain), value lifts towards the lit right side
      for (let k = 0; k < 70; k++) {
        const u = r(0.04, 0.96), s0 = r(0, 0.85), s1 = Math.min(0.98, s0 + r(0.06, 0.22));
        const pts = [];
        for (let j = 0; j <= 5; j++) { const q = at(u + 0.02 * Math.sin(j + k), s0 + (s1 - s0) * j / 5); pts.push([q[0], q[1], 0.4 + 0.6 * Math.sin((Math.PI * j) / 5)]); }
        const col = u > 0.8 ? r.pick(['#2c4262', '#34506e', '#263a58']) : u > 0.5 ? r.pick(['#1b2c46', '#223452', '#18263c']) : r.pick(['#0a1220', '#101a2c', '#16223a']);
        st.push({ pts, brush: r.pick(['dry', 'charcoal', 'earth_body']), color: col, w: r(0.6, 1.3), curv: 0.5, seed: 'rv' + si + '_' + k });
      }
      // strata / ledges across the rock (follow its width), with a lit lip on the right
      for (let k = 0; k < 9; k++) {
        const s2 = 0.08 + k * 0.095 + r(-0.02, 0.02);
        const pts = [];
        for (let j = 0; j <= 6; j++) { const q = at(j / 6, s2 + 0.012 * Math.sin(j * 1.7 + k)); pts.push([q[0], q[1] + 3, 0.5 + 0.5 * Math.sin((Math.PI * j) / 6)]); }
        st.push({ pts, brush: 'charcoal', color: '#060b14', w: r(0.9, 1.4), curv: 0.4, seed: 'rl' + si + '_' + k });
        const q0 = at(0.72, s2), q1 = at(1.0, s2 - 0.004);
        st.push({ pts: [[q0[0], q0[1]], [q1[0] - 2, q1[1]]], brush: 'earth_hair', color: r.pick(['#6a88a8', '#7a98b8']), w: 1.1, curv: 0.3, seed: 'rk' + si + '_' + k });
      }
      // the moonlit right flank: a broken band of light following the edge
      for (let k = 0; k < 18; k++) {
        const s0 = r(0, 0.9), s1 = Math.min(0.99, s0 + r(0.05, 0.14));
        const pts = [];
        for (let j = 0; j <= 4; j++) { const s2 = s0 + (s1 - s0) * j / 4; const q = at(0.975 - 0.05 * r(), s2); pts.push([q[0] - 4, q[1], 0.4 + 0.7 * Math.sin((Math.PI * j) / 4)]); }
        st.push({ pts, brush: r.pick(['earth_hair', 'ink', 'dry']), color: r.pick(['#7f9fbf', '#98b4d0', '#6a8cae']), w: r(1.0, 1.7), curv: 0.4, seed: 'rm' + si + '_' + k });
      }
      // found contour on the shadow side
      const left = S.pts.slice(0, 41);
      st.push({ pts: left.map((p, j) => [p[0], p[1], 0.3 + Math.sin((Math.PI * j) / 40)]), brush: 'ink', color: '#03060c', w: 1.4, curv: 0.4, seed: 'rc' + si });
    });
    strokeBatch(c, st);
  });
  return A;
}

// The night sky above the horizon (atmosphere) — drawn before the sea.
export function drawNightSky(R, A, lt, circ, o = {}) {
  const k = smoother(11.0, 13.6, lt); // atmosphere thickens as we descend
  const on = smoothstep(10.6, 11.5, lt);
  if (on <= 0) return;
  const band = lerp(18, 520, k);
  const top = circ.top;
  // airglow / sky gradient above the limb
  const mask = { type: 'ellipse', x: circ.x, y: circ.y, rx: circ.r + band, ry: circ.r + band, r0: circ.r / (circ.r + band), r1: 1 };
  R.rect(-20, top - band - 40, 1960, band + 80, [...hex('#0b1222'), 0], { c1: [...hex('#1d3f5a'), 0.9 * (0.35 + 0.65 * k) * on], grad: 'vertical', mask });
  R.glow(circ.x, top + 40, 900, [0.35, 0.6, 0.85], (0.1 * (1 - k) + 0.05) * on, { shape: [0.2, 0.6, 3], sx: 2.4, sy: 0.35, ext: 2 });
  // twilight where the Sun has set (left), fading into night
  const tw = win(lt, 10.9, 11.8, 13.2, 16.0);
  if (tw > 0) {
    const ly = limbY(circ, 360) ?? top;
    R.glow(360, ly + 10, 520, [1, 0.5, 0.22], 0.55 * tw, { shape: [0.6, 0.5, 2.5], sx: 2.2, sy: 0.45, ext: 2 });
    R.glow(360, ly + 4, 140, [1, 0.75, 0.45], 0.8 * tw, { shape: [1.4, 0.4, 2], sx: 2.6, sy: 0.3, ext: 2 });
  }
}

// Moon screen state (rises at lt 15.0 from behind the horizon at x ~1330)
export function moonState(lt, drop = 0) {
  const rise = smoother(14.85, 16.9, lt);
  const y = lerp(HORIZON + MOON.r + 12, MOON.rest[1], rise) - 10 * smoother(16.9, 22, lt);
  return { x: MOON.rest[0] - 18 * smoother(15, 20, lt), y, r: MOON.r, rise };
}

// Sky furniture of the night ocean (drawn after the sky, before the sea)
export function drawOceanSky(R, A, lt, circ) {
  const atm = smoother(11.6, 13.8, lt);
  const m = moonState(lt);
  const t = R.t;
  // moonrise glow on the horizon before the disc appears
  const pre = smoother(13.9, 15.2, lt);
  if (pre > 0) {
    R.glow(m.x, HORIZON - 6, 300, [0.75, 0.82, 0.95], 0.2 * pre, { shape: [0.6, 0.5, 2.2], sx: 1.8, sy: 0.5, ext: 2 });
  }
  // high cloud streaks drifting left (atmosphere: thicken as we descend)
  if (atm > 0) {
    const dx = -18 * t;
    R.layer(A.cloudsHi, M.place(960 + dx + 800, 120 + (1 - atm) * 120, 0.95, -0.01, 1400, 260), { opacity: 0.6 * atm });
  }
  // the Moon + halo
  if (m.rise > 0) {
    const g = smoothstep(0, 0.6, m.rise);
    // halo behind the disc, the disc itself slightly over-bright so it blooms like a lamp
    R.glow(m.x, m.y, m.r * 2.8, [0.7, 0.78, 0.92], 0.08 * g, { shape: [0.5, 0.5, 2.2], ext: 2.5 });
    R.glow(m.x, m.y, m.r * 1.3, [0.95, 0.93, 0.85], 0.09 * g, { shape: [1.0, 0.3, 2], ext: 2 });
    R.layer(A.moon, M.place(m.x, m.y, m.r / MOON.R, 0.08, 350, 350), { grade: [1, 0.96, 1.05] });
  }
  // low clouds in front of the rising Moon, lit from behind (silver lining)
  if (atm > 0) {
    const dx = -26 * t;
    R.layer(A.cloudsLo, M.place(960 + dx + 1200, HORIZON - 70, 0.85, 0.005, 1400, 330), { opacity: 0.75 * atm });
    if (m.rise > 0) R.glow(m.x, m.y + m.r * 0.3, m.r * 1.6, [0.85, 0.9, 1], 0.08 * smoothstep(0, 0.5, m.rise), { shape: [0.8, 0.4, 2], sx: 1.6, sy: 0.7, ext: 2 });
  }
  // distant volcanic islands rise over the horizon as we come down; a volcano glows and smokes
  const isl = smoother(12.9, 14.4, lt);
  if (isl > 0) {
    const yb = (limbY(circ, 960) ?? HORIZON) + lerp(40, 1, isl);
    R.layer(A.islands, M.place(960, yb, 0.8, 0, 1200, 290));
    const vx = 960 + (420 - 1200) * 0.8, vy = yb - 150 * 0.8;
    R.glow(vx, vy + 3, 9, [1, 0.5, 0.22], 0.9 * isl * (0.8 + 0.2 * Math.sin(t * 3.1)), { shape: [2.0, 0.3, 2], ext: 3 });
    R.glow(vx, vy - 16, 40, [1, 0.35, 0.15], 0.1 * isl, { shape: [0.6, 0.5, 2], sy: 1.8, ext: 2 });
  }
}

// A craggy sea stack framing the left edge: its base is below the frame, so it rises into view as we
// come down to the water (near objects climb faster than the far islands); the dive sweeps it away.
export function drawStacks(R, A, lt, circ) {
  const k = smoother(13.3, 14.8, lt);
  if (k <= 0) return;
  const hy = HORIZON;
  const baseY = lerp(1080 + 1300 * 0.9 * 0.95, hy + 700, k);
  R.layer(A.stacks, M.place(-40, baseY, 0.95, -0.02, 0, 1290));
  const m = moonState(lt);
  if (m.rise > 0) R.glow(260, baseY - 900, 160, [0.6, 0.72, 0.9], 0.05 * m.rise, { shape: [0.6, 0.5, 2], sx: 0.8, sy: 2.5, ext: 2 });
}
