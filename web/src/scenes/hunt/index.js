// HUNT (97.5–107.5 s): night sky → tilt down to a teal ridge → two hunters run, the lead hurls a
// spear across the stars → dawn breaks as it plunges into the soil in front of a mammoth herd →
// its line becomes the first furrow → furrows multiply, crops sprout in bands → the camera rises
// and rotates to a top-down view that is exactly PIVOT.fields.
import { PIVOT } from '../pivots.js';
import { C } from '../lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep } from '../lib/kit.js';
import { ease, invLerp, noise1 } from '../../engine/math.js';
import * as K from './choreo.js';
import { paintSky, drawSky, dawnAt } from './sky.js';
import { paintRidge, paintTrees, paintGrass, paintRanges, paintPlain, paintMammoths, plainM, RIDGE, TREE_CELL, GRASS_CELL, RANGE, MAMMOTH } from './land.js';
import { paintFigures, drawHunter, drawSpear } from './figures.js';
import { paintTilled, paintFirstFurrow, paintRows, paintPeriphery, makeTimeMaps, drawCultivation, drawRows, groundLight } from './fields.js';

// ---- static set dressing positions ---------------------------------------------------------------
const TUFTS = (() => {
  const r = rng('hunt-tufts'), out = [];
  for (let x = RIDGE.x0 + 60; x < K.XTOP + 60; x += r(34, 70)) {
    out.push({ x, dy: r(-3, 8), v: r.int(0, GRASS_CELL.n - 1), s: r(0.55, 0.95), ph: r(0, TAU), row: 0 });
    if (r() < 0.55) out.push({ x: x + r(-20, 20), dy: K.SURF * r(0.55, 1.0), v: r.int(0, GRASS_CELL.n - 1), s: r(0.7, 1.15), ph: r(0, TAU), row: 1 });
  }
  return out;
})();
// when does each hunter pass a given x (for the grass kick)
function passTime(h, x) {
  let a = -1.5, b = 5.5;
  if (h.hipX(b) < x) return 99;
  for (let i = 0; i < 30; i++) {
    const m = (a + b) / 2;
    if (h.hipX(m) < x) a = m;
    else b = m;
  }
  return (a + b) / 2;
}
for (const t of TUFTS) t.pass = K.HUNTERS.map((h) => passTime(h, t.x));
const TREES = [{ x: -5200, v: 0, s: 0.95 }, { x: -3900, v: 1, s: 0.9 }, { x: -2900, v: 2, s: 0.85 }, { x: -6150, v: 1, s: 0.7 }];
const FG = (() => {
  const r = rng('hunt-fg'), out = [];
  for (let x = -7600; x < -600; x += r(140, 320)) out.push({ x, v: r.int(0, GRASS_CELL.n - 1), s: r(2.1, 3.2), ph: r(0, TAU), dy: r(-30, 40) });
  return out;
})();
const HERD = (() => {
  const r = rng('hunt-herd');
  return [
    { gx: K.L[0] + 380, gy: -330, s: 0.62 }, { gx: K.L[0] + 620, gy: -410, s: 0.55 }, { gx: K.L[0] + 860, gy: -360, s: 0.66 },
    { gx: K.L[0] + 1080, gy: -470, s: 0.5 }, { gx: K.L[0] + 1300, gy: -400, s: 0.58 }, { gx: K.L[0] + 1480, gy: -520, s: 0.46 },
  ].map((m) => ({ ...m, ph: r(0, 4), react: r(0.05, 0.3), vx: r(520, 700), vy: r(-120, -60) }));
})();
const MOTES = (() => {
  const r = rng('hunt-motes'), out = [];
  for (let i = 0; i < 260; i++) out.push({ x: r(-600, 2600), y: r(-500, 1100), s: r(1, 3), ph: r(0, TAU), f: r(0.2, 0.6) });
  return out;
})();

// ---- particles ------------------------------------------------------------------------------------
function footDust(h, lt, out, grit) {
  const sc = h.H / K.H1;
  for (const st of h.steps) {
    const age = lt - st.t;
    if (age < 0 || age > 1.1 || st.t < K.T.run - 0.4) continue;
    const r = rng(`dust-${h.id}-${Math.round(st.t * 1000)}`);
    const gy = h.trackY(st.x);
    const plant = st.style === 'plant';
    const n = plant ? 30 : 14;
    // pale dust puffs, kicked back and up, spreading and settling
    for (let i = 0; i < n; i++) {
      const vx = r(-190, 30) * sc * (plant ? 1.4 : 1), vy = r(-130, -30) * sc;
      const k = 1 - Math.exp(-age * 3.2);
      const x = st.x + r(-10, 30) * sc + (vx / 3.2) * k, y = gy - 2 + (vy / 3.2) * k + 16 * age * age;
      const a = Math.pow(1 - age / 1.1, 1.4) * r(0.26, 0.5) * (plant ? 1.25 : 1);
      const sz = r(10, 26) * sc * (0.5 + age * 2.2);
      out.push([x, y, sz, 0, 0.64, 0.78, 0.74, a]);
    }
    // grit: a few dark crumbs thrown back in a little arc
    for (let i = 0; i < (plant ? 12 : 5); i++) {
      const vx = r(-260, -60) * sc, vy = r(-240, -110) * sc, g = 1400 * sc;
      const tt = Math.min(age, 0.45);
      const x = st.x + vx * tt, y = gy - 4 + vy * tt + 0.5 * g * tt * tt;
      if (y > gy + 2 || age > 0.5) continue;
      grit.push([x, y, r(2.5, 4.5) * sc, 0, 0.05, 0.2, 0.22, 0.9 * (1 - age / 0.5)]);
    }
  }
}
function landingBurst(lt, e, out, outGlow) {
  const age = lt - K.T.land;
  if (age < 0 || age > 2.6) return;
  const r = rng('hunt-landing');
  const [lx, ly] = K.L;
  // clods (ballistic in 3D, projected)
  for (let i = 0; i < 70; i++) {
    const a = r(0, TAU), sp = r(60, 420), vh = r(160, 620), g = 1500;
    const tt = Math.min(age, (2 * vh) / g);
    const gx = lx + Math.cos(a) * sp * tt * 0.9 + K.LAND_DIR[0] * 40 * tt, gy = ly + Math.sin(a) * sp * tt * 0.5;
    const hh = Math.max(0, vh * tt - 0.5 * g * tt * tt);
    const [x, y] = K.proj3(gx, gy, hh, e);
    const s = r(3, 8);
    const fade = 1 - smoothstep(1.6, 2.6, age);
    const col = hex(r.pick(['#3e2616', '#5a3a24', '#6e4a2e', '#2a1a0e']));
    out.push([x, y, s, 0, col[0], col[1], col[2], 0.95 * fade]);
  }
  // dust cloud lit by the dawn
  for (let i = 0; i < 46; i++) {
    const a = r(-Math.PI, 0), sp = r(40, 260);
    const k = 1 - Math.exp(-age * 2.4);
    const gx = lx + Math.cos(a) * sp * k * 1.3, hh = -Math.sin(a) * sp * k * 0.9 + 30 * age;
    const [x, y] = K.proj3(gx, ly + r(-30, 30), hh, e);
    const s = r(18, 46) * (0.5 + age * 0.9);
    const al = (1 - age / 2.6) ** 1.6 * r(0.18, 0.36);
    out.push([x, y, s, 0, 0.78, 0.62, 0.48, al]);
  }
  // spark of the impact (light)
  if (age < 0.25) {
    const [x, y] = K.proj3(lx, ly, 0, e);
    outGlow.push([x, y, 90 * (1 - age * 3), 0, 1, 0.8, 0.5, (1 - age / 0.25) * 0.8]);
  }
}
function furrowSpray(lt, e, out) {
  if (lt < K.T.furrow || lt > K.T.furrow + 1.6) return;
  for (const [dir, dur, dist, t0] of [[1, 1.0, 2900, K.T.furrow], [-1, 0.9, 1700, K.T.furrow + 0.08]]) {
    for (let k = 0; k < 60; k++) {
      const te = t0 + (k / 60) * dur;
      const age = lt - te;
      if (age < 0 || age > 0.55) continue;
      const u = K.U_L + dir * dist * ease.outCubic(clamp((te - t0) / dur));
      if (u < -1650 || u > 1650) continue;
      const r = rng(`spray-${dir}-${k}`);
      for (let i = 0; i < 4; i++) {
        const vh = r(80, 260), g = 1200, hh = Math.max(0, vh * age - 0.5 * g * age * age);
        const [gx, gy] = K.bandToWorld(u - dir * r(0, 60) * age, K.O1 + r(-24, 24));
        const [x, y] = K.proj3(gx, gy, hh, e);
        const col = hex(r.pick(['#3e2616', '#6e4a2e', '#8a5e3a']));
        out.push([x, y, r(2.5, 5.5), 0, col[0], col[1], col[2], 0.9 * (1 - age / 0.55)]);
      }
    }
  }
}

export const scene = {
  id: 'hunt',
  bg: C.night,
  deps: [PIVOT.night, PIVOT.fields],
  paint(P) {
    const sky = paintSky(P);
    const ridge = paintRidge(P);
    const trees = paintTrees(P);
    const grass = paintGrass(P);
    const ranges = paintRanges(P);
    const plain = paintPlain(P);
    const mammoth = paintMammoths(P);
    const fig = paintFigures(P);
    const tilled = paintTilled(P);
    const firstFurrow = paintFirstFurrow(P);
    const rows = paintRows(P);
    const peri = paintPeriphery(P);
    return { sky, ridge, trees, grass, ranges, plain, mammoth, fig, tilled, firstFurrow, rows, peri, maps: null };
  },
  view(lt) {
    return K.viewM(K.camAt(lt));
  },
  post(lt) {
    return {};
  },
  blur(lt) {
    if (lt < 0.02) return 1;
    if (lt > K.T.plant - 0.15 && lt < K.T.release + 0.3) return 12;
    if (lt > K.T.run - 0.2 && lt < K.T.release + 0.6) return 5;
    if (lt > K.T.land - 0.05 && lt < K.T.land + 0.6) return 3;
    return 1;
  },
  draw(R, lt, A) {
    if (lt <= 0) {
      R.drawScene(PIVOT.night, 0, M.id());
      return;
    }
    const AN = R.engine.ensure(PIVOT.night), AF = R.engine.ensure(PIVOT.fields);
    if (!A.maps) {
      const cur = R.comp.cur;
      R.comp.done();
      A.maps = makeTimeMaps(R.engine.gl);
      const rec = R.engine.assets.get(scene.id);
      if (rec) rec.P._layers.push(A.maps.A, A.maps.B);
      R.comp.bind(cur);
    }
    const c = K.camAt(lt);
    const V = R.view, iV = M.inv(V);
    const e = c.e;
    const d = dawnAt(lt);
    const light = groundLight(lt);
    // ---------------------------------------------------------------- sky
    R.with(M.mul(iV, K.skyM(c)), () => drawSky(R, lt, A.sky, AN));
    // ---------------------------------------------------------------- far ranges (billboards on the horizon)
    const hz = K.horizonSW(e);
    const rangeTint = (k) => ({ tint: [lerp(0.8, 1.15, d), lerp(0.85, 0.8, d), lerp(1, 0.95, d)].map((v) => v * k) });
    const bm = (k) => M.mul(K.parallaxM(c, k), M.mul(K.boardM(K.GFAR, e), M.translate(RANGE.x0, RANGE.top)));
    R.layer(A.ranges.far, M.mul(iV, bm(0.28)), rangeTint(1));
    if (d > 0.01) R.layer(A.ranges.rim, M.mul(iV, bm(0.28)), { blend: 'screen', opacity: 0.8 * smoothstep(0.2, 0.9, d) });
    R.layer(A.ranges.near, M.mul(iV, bm(0.5)), rangeTint(0.95));
    // ---------------------------------------------------------------- the plain
    R.layer(A.plain, plainM(e), light);
    // haze over the far plain in the side view (atmosphere)
    const haze = (1 - smoothstep(0.35, 0.8, Math.sin(e))) * 0.55;
    if (haze > 0.01) {
      const hc = hex(mixHex('#2a3a60', '#e0a080', d));
      R.rect(-9000, hz - 10, 20000, 260 * Math.sin(e) / K.SE0, [...hc, haze], { c1: [...hc, 0], grad: 'vertical' });
    }
    // ---------------------------------------------------------------- cultivation
    drawCultivation(R, lt, A, AF, c, A.maps);
    // ---------------------------------------------------------------- the herd
    if (lt > K.T.release - 0.5 && Math.cos(e) > 0.2) {
      const herd = HERD.map((m) => {
        const ts = lt - (K.T.land + m.react);
        const run = ts > 0 ? ts : 0;
        const gx = m.gx + 18 * lt + (run > 0 ? m.vx * (run * run * 0.9 / (1 + run * 0.9)) + m.vx * 0.4 * run : 0);
        const gy = m.gy + (run > 0 ? m.vy * run : 0);
        return { ...m, gxx: gx, gyy: gy, running: ts > 0 };
      }).sort((a, b) => a.gyy - b.gyy);
      for (const m of herd) {
        // soft contact shadow on the ground
        const Gs = K.groundM(e);
        R.rect(m.gxx - 150 * m.s, m.gyy - 40 * m.s, 300 * m.s, 80 * m.s, [0.08, 0.1, 0.06, 0.45], { c1: [0.08, 0.1, 0.06, 0], grad: 'radial', m: M.mul(Gs, M.id()), blend: 'normal', ...{} });
      }
      for (const m of herd) {
        const f = m.running ? Math.floor((lt * 10 + m.ph * 4) % 4) : Math.floor((lt * 5 + m.ph * 4) % 4);
        const row = m.running ? 1 : 0;
        const bmM = M.chain(K.boardM(m.gyy, e), M.translate(m.gxx, 0), M.scale(m.s), M.translate(-MAMMOTH.rx, -MAMMOTH.ry));
        const cx = f * MAMMOTH.cw, cy = row * MAMMOTH.ch;
        R.layer(A.mammoth, M.mul(bmM, M.translate(0, 0)), { ...light, uv: [cx / (MAMMOTH.cw * 4), cy / (MAMMOTH.ch * 2), (cx + MAMMOTH.cw) / (MAMMOTH.cw * 4), (cy + MAMMOTH.ch) / (MAMMOTH.ch * 2)], w: MAMMOTH.cw, h: MAMMOTH.ch });
      }
    }
    // ---------------------------------------------------------------- crop rows
    drawRows(R, lt, A, c);
    // ---------------------------------------------------------------- the landed spear (3D, sinking)
    const soft = [], glow = [];
    if (lt >= K.T.land) {
      const age = lt - K.T.land;
      const q = 0.07 * Math.exp(-age * 4.5) * Math.sin(age * 38);
      const embed = 0.12 * (1 - Math.exp(-age * 28)) + 0.88 * ease.inOutSine(clamp((lt - 7.0) / 1.7));
      if (embed < 0.995) {
        const L3 = K.SPEAR3.len3, vis = (1 - embed) * L3;
        const entry = K.proj3(K.L[0], K.L[1], 0, e);
        const tail = K.proj3(K.L[0] - vis * K.SPEAR3.c * K.FU[0], K.L[1] - vis * K.SPEAR3.c * K.FU[1], vis * K.SPEAR3.sh, e);
        let ang = Math.atan2(entry[1] - tail[1], entry[0] - tail[0]) + q;
        const len = Math.hypot(entry[0] - tail[0], entry[1] - tail[1]);
        const t2 = [entry[0] - Math.cos(ang) * len, entry[1] - Math.sin(ang) * len];
        if (len > 1) drawSpear(R, A.fig, t2, ang, len / (1 - embed), light, [0, 1 - embed]);
      }
    }
    landingBurst(lt, e, soft, glow);
    furrowSpray(lt, e, soft);
    // ---------------------------------------------------------------- the ridge and the hunt
    if (lt < 5.6) {
      R.layer(A.ridge, M.translate(RIDGE.x0, RIDGE.y0));
      // trees on the crest (gentle sway)
      for (const t of TREES) {
        const x = t.x, y = K.crestY(x) + 6;
        const sway = 0.02 * Math.sin(R.t * 0.9 + x) + 0.01 * noise1(R.t * 1.3, x);
        R.layer(A.trees, M.place(x, y, t.s, sway, TREE_CELL.w / 2, TREE_CELL.h - 14), { uv: [t.v / 3, 0, (t.v + 1) / 3, 1], w: TREE_CELL.w, h: TREE_CELL.h });
      }
      const vx0 = K.camCenterSW(c)[0] - 1100 / c.z, vx1 = K.camCenterSW(c)[0] + 1100 / c.z;
      const drawTufts = (row) => {
        for (const t of TUFTS) {
          if (t.row !== row || t.x < vx0 || t.x > vx1) continue;
          let a = 0.07 * Math.sin(R.t * 1.7 + t.ph) + 0.05 * noise1(R.t * 0.8 + t.x * 0.01, 7);
          for (let j = 0; j < 2; j++) {
            const tp = lt - t.pass[j];
            if (tp > -0.08 && tp < 2) a += (j ? 0.35 : 0.5) * Math.exp(-Math.max(0, tp) * 3.2) * Math.sin(Math.max(0, tp) * 13 + 0.9) * smoothstep(-0.08, 0.02, tp);
          }
          const y = K.crestY(t.x) + t.dy;
          R.layer(A.grass, M.place(t.x, y, t.s, a, GRASS_CELL.rx, GRASS_CELL.ry), { uv: [t.v / GRASS_CELL.n, 0, (t.v + 1) / GRASS_CELL.n, 1], w: GRASS_CELL.w, h: GRASS_CELL.h, tint: row ? [0.78, 0.86, 0.9] : [0.64, 0.74, 0.84] });
        }
      };
      drawTufts(0);
      const dust = [], grit = [];
      for (const h of [K.HUNTERS[1], K.HUNTERS[0]]) {
        const hx = h.hipX(lt);
        if (hx > vx0 - 400 && hx < vx1 + 400) drawHunter(R, A.fig, h, lt);
        footDust(h, lt, dust, grit);
      }
      R.particles(dust, { kind: 'soft' });
      R.particles(grit, { kind: 'hard' });
      drawTufts(1);
    }
    // ---------------------------------------------------------------- the spear in flight
    if (lt >= K.T.release && lt < K.T.land) {
      const s = K.spearFlight(lt);
      const Ls = K.SPEAR.len;
      const tail = [s.tip[0] - Math.cos(s.ang) * Ls, s.tip[1] - Math.sin(s.ang) * Ls];
      // air trail (light)
      for (let i = 1; i <= 14; i++) {
        const tt = lt - i * 0.018;
        if (tt < K.T.release) break;
        const p = K.spearFlight(tt), a = (1 - i / 15) * 0.22;
        const bx = p.tip[0] - Math.cos(p.ang) * Ls * 0.55, by = p.tip[1] - Math.sin(p.ang) * Ls * 0.55;
        glow.push([bx, by, 6 + i * 0.8, 0, 1, 0.92, 0.8, a]);
      }
      drawSpear(R, A.fig, tail, s.ang, Ls, { tint: [lerp(0.85, 1.1, d), lerp(0.85, 0.98, d), lerp(0.95, 0.9, d)] });
      glow.push([s.tip[0], s.tip[1], 10, 0, 1, 0.95, 0.85, 0.25]);
    }
    if (soft.length) R.particles(soft, { kind: 'soft' });
    if (glow.length) R.particles(glow, { kind: 'glow', blend: 'add' });
    // ---------------------------------------------------------------- foreground grass (parallax)
    if (lt < 4.9) {
      const FGM = M.mul(iV, K.parallaxM(c, 1.35, -2600));
      R.with(FGM, () => {
        for (const g of FG) {
          const y = K.crestY(Math.min(g.x, K.XTOP)) + K.SURF + 330 + g.dy;
          const a = 0.06 * Math.sin(R.t * 1.4 + g.ph) + 0.04 * noise1(R.t + g.x, 3);
          R.layer(A.grass, M.place(g.x, y, g.s, a, GRASS_CELL.rx, GRASS_CELL.ry), { uv: [g.v / GRASS_CELL.n, 0, (g.v + 1) / GRASS_CELL.n, 1], w: GRASS_CELL.w, h: GRASS_CELL.h, tint: [0.28, 0.36, 0.42] });
        }
      });
    }
    // ---------------------------------------------------------------- morning life over the fields
    // cloud shadows drifting across the land (atmosphere), gone as the morning clears
    const cs = smoothstep(7.5, 8.2, lt) * (1 - smoothstep(9.2, 9.8, lt));
    if (cs > 0.002) {
      const G2 = K.groundM(e);
      const drift = 150 * (lt - 7.5);
      R.layer(A.sky.cloudShadow, M.mul(G2, M.translate(-700 + drift, -500 + 0.4 * drift)), { blend: 'multiply', opacity: 0.9 * cs, color: [0.3, 0.34, 0.5, 1] });
    }
    // a flock crossing high over the fields (seen from above as the camera rises)
    const ft = lt - 8.05;
    if (ft > 0 && ft < 1.55) {
      for (const b of A.sky.flock) {
        const gx = -250 + ft * 1500 + b.dx * 1.4, gy = 1150 - ft * 900 + b.dy * 1.6;
        const [x, y] = K.proj3(gx, gy, 260, e);
        const f = Math.floor(((ft * b.f + b.ph) % 4 + 4) % 4);
        const hd = Math.atan2(-900 * Math.sin(e), 1500);
        R.layer(A.sky.birds, M.chain(M.translate(x, y), M.rotate(hd), M.scale(b.s * 1.25), M.translate(-50, -50)), { uv: [f / 4, 0, (f + 1) / 4, 1], w: 100, h: 100, color: [0.12, 0.1, 0.12, 0.85] });
        const [sx2, sy2] = K.proj3(gx + 60, gy + 40, 0, e);
        R.layer(A.sky.birds, M.chain(M.translate(sx2, sy2), M.rotate(hd), M.scale(b.s * 1.25, b.s * 1.25 * Math.sin(e)), M.translate(-50, -50)), { uv: [f / 4, 0, (f + 1) / 4, 1], w: 100, h: 100, blend: 'multiply', opacity: 0.35, color: [0.3, 0.3, 0.35, 1] });
      }
    }
    // ---------------------------------------------------------------- motes in the dawn light
    if (d > 0.02 && Math.cos(e) > 0.05) {
      const pm = [];
      for (const m of MOTES) {
        const x = K.camCenterSW(c)[0] + ((m.x + R.t * 14 + 40 * Math.sin(R.t * m.f + m.ph)) % 2200) - 1100;
        const y = K.camCenterSW(c)[1] - 540 + ((m.y + 60 + 20 * Math.sin(R.t * m.f * 1.3 + m.ph)) % 1080);
        pm.push([x, y, m.s, 0, 1, 0.8, 0.55, 0.3 * d * Math.cos(e) * (0.5 + 0.5 * Math.sin(R.t * 2 + m.ph))]);
      }
      R.particles(pm, { kind: 'glow', blend: 'add' });
    }
  },
};
