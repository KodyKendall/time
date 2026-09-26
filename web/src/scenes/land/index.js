// LAND (70 – 85 s): PIVOT.eye → pull back: the eye belongs to a sauropod in a fern forest → it walks,
// looks up at a streak in the sky → IMPACT (77.5) → blast wave, fire, the forest burns to ash →
// camera tilts up into the smoke → PIVOT.ash.
import { PIVOT } from '../pivots.js';
import { M, TAU, lerp, clamp, hex, mixHex, smoothstep, ease, noise1, T, DUR, START, h01 } from './util.js';
import { camState, depthM, TY_END } from './cam.js';
import { drawDino, pose, D } from './dino.js';
import { paintDino } from './dinopaint.js';
import { paintForest, TREES, PLANTS, CYCADS, groundV, FC } from './forest.js';
import { IMP, blastR, hitTime, impactDist, burnState, burnLook, flashK, backlit, fireGlow, burnNoise, burnNoiseAt, burnDownWide, burnDown, texMask, ringPoint } from './burn.js';
import { paintFx, drawMeteor, drawExplosion, dustPuffs, debrisParticles, makeFireSources, EMBERS, smokePuffs } from './fx.js';
import { paintLife, drawPteros, drawHerd, drawFlies, drawShafts, footDust } from './life.js';

const FIRES = makeFireSources(TREES);
const DINO_HIT = hitTime(impactDist(D.bodyEnd[0] - 48, 1));   // blast reaches the dinosaur
for (const tr of TREES) tr.tHit = hitTime(impactDist(tr.x, tr.d));
for (const p of PLANTS) p.tHit = hitTime(impactDist(p.x, p.d));
for (const cy of CYCADS) cy.tHit = hitTime(impactDist(cy.x, cy.d));

export const scene = {
  id: 'land',
  bg: '#2a1a0c',
  deps: [PIVOT.eye, PIVOT.ash],

  paint(P) {
    return { ...paintForest(P), dino: paintDino(P), fx: paintFx(P), life: paintLife(P) };
  },

  view(lt) {
    if (lt <= 0 || lt >= DUR) return M.id();
    return depthM(camState(lt), 1) || M.id();
  },

  post(lt) {
    if (lt < 0.6 || lt > DUR - 0.6) return {};
    const f = flashK(lt), g = fireGlow(lt);
    const ash = smoothstep(T.ash0, DUR - 0.7, lt);
    const k = 1 - smoothstep(DUR - 1.4, DUR - 0.6, lt); // ease every override back to defaults
    return {
      exposure: 1 + 1.1 * f * k,
      bloom: 0.9 + (0.5 * f + 0.08 * g) * k,
      sat: 1 + (0.1 * g - 0.12 * ash) * k,
      contrast: 1 + 0.06 * g * k,
      gain: [1 + 0.07 * g * k, 1 - 0.01 * g * k, 1 - 0.08 * g * k],
      vignette: 0.32 + 0.1 * g * k,
    };
  },

  blur(lt) {
    if (lt > T.impact - 0.35 && lt < T.impact + 0.9) return 4; // meteor dash + debris
    return 1;
  },

  draw(R, lt, A) {
    if (lt <= 0) { R.drawScene(PIVOT.eye, 0, M.id()); return; }
    if (lt >= DUR) { R.drawScene(PIVOT.ash, 0, M.id()); return; }
    const c = camState(lt);
    const inv1 = M.inv(R.view);
    const plane = (d, fn) => {
      const Vd = depthM(c, d);
      if (!Vd) return;
      R.push(M.mul(inv1, Vd));
      try { fn(); } finally { R.pop(); }
    };
    const gl = R.engine.gl;
    const NZ = burnNoise(gl), ND = burnDown(gl), NW = burnDownWide(gl);
    const eyeA = R.engine.ensure(PIVOT.eye);
    const ashA = R.engine.ensure(PIVOT.ash);
    const t = lt;
    const tN = R.frameT - START;              // nominal frame time (shared by motion-blur samples)
    const fk = flashK(lt), bl = backlit(lt), fg = fireGlow(lt);
    const bs = (tHit) => burnState(lt, tHit);

    // element burning in place: heat/char grading + noise-masked charring front with a glowing edge
    const drawBurning = (L, m, b, o = {}, box = null) => {
      const w = box ? box[0] : Math.max(L.w, L.h), h = box ? box[1] : Math.max(L.w, L.h);
      R.layer(L, m, { ...o, ...burnLook(b, fg) });
      if (b.char > 0.001 && b.char < 0.999) {
        const Ms = M.mul(R.view, m);
        const th = 1.02 - 1.06 * b.char;
        R.layer(L, m, { ...o, color: [1.7, 0.55, 0.12, 1], blend: 'add', opacity: 0.85 * (1 - b.ash), mask: texMask(NZ, Ms, w, h, th - 0.07, 0.03) });
        R.layer(L, m, { ...o, ...burnLook({ heat: 1, char: 1, ash: b.ash }, fg), mask: texMask(NZ, Ms, w, h, th, 0.025) });
      }
    };
    // foliage burning away: erodes with a glowing front
    const drawBurnAway = (L, m, b, o = {}, box = null) => {
      const look = { ...o, ...burnLook({ heat: b.heat, char: b.char * 0.6, ash: 0 }, fg) };
      if (b.burn <= 0.001) { R.layer(L, m, look); return; }
      if (b.burn >= 0.999) return;
      const Ms = M.mul(R.view, m);
      const w = box ? box[0] : Math.max(L.w, L.h), h = box ? box[1] : Math.max(L.w, L.h);
      const th = -0.05 + 1.12 * b.burn;
      R.layer(L, m, { ...o, color: [1.15, 0.3, 0.05, 1], blend: 'add', opacity: 0.85, mask: texMask(NZ, Ms, w, h, th - 0.07, 0.025) });
      R.layer(L, m, { ...look, mask: texMask(NZ, Ms, w, h, th, 0.02) });
    };
    // flames + embers riding the burn front of a canopy layer (spots recorded while painting)
    const canopyFire = (spots, m, b, size, seed) => {
      if (b.burn <= 0.001 || b.burn >= 0.999) return;
      const th = -0.05 + 1.12 * b.burn;
      const frame = Math.floor(tN * 15);
      const cell = A.fx.flames.cell;
      const emb = [];
      for (let k = 0; k < spots.length; k++) {
        const sp = spots[k];
        if (sp[2] === undefined) sp[2] = burnNoiseAt(sp[0] / 3000, sp[1] / 3000);
        const e = (sp[2] - (th - 0.035)) / 0.11;           // 0..1 across the burning band (still-unburnt side)
        if (e <= 0 || e >= 1) continue;
        const a = Math.sin(Math.PI * e);
        const [wx, wy] = M.apply(m, sp[0], sp[1]);
        const s = size * (0.6 + 0.5 * h01(k, seed)) * (0.5 + 0.5 * a);
        R.layer(A.fx.flames.layer, M.chain(M.translate(wx, wy + 20 * s), M.scale(s * (k % 2 ? -1 : 1), s), M.translate(-cell / 2, -cell / 2 - 112)), { uv: A.fx.flames.uv((frame + k * 5) % 12), w: cell, h: cell, opacity: Math.min(1, a * 1.8) });
        const ph = h01(k, seed + 1) * 10;
        for (let q = 0; q < 2; q++) {
          const x = ((lt * 0.9 + ph + q * 0.5) % 1);
          emb.push([wx + 30 * Math.sin(lt * 2 + ph + q) * x, wy - 160 * x, 2.4, 0, 1, 0.55 + 0.3 * (1 - x), 0.2, a * (1 - x)]);
        }
      }
      if (emb.length) R.particles(emb, { kind: 'glow', blend: 'add' });
    };
    // blast push for swaying things: impulse away from the impact
    const push = (u, d, tHit) => {
      const b = bs(tHit);
      return (u < IMP.u ? -1 : 1) * (0.5 * b.push + 0.1 * b.heat * (1 - b.burn));
    };

    // ================================================================= SKY
    // the ash sky sits above the forest (revealed by the final tilt). Replica of PIVOT.ash's gradient
    // + clouds (its flakes are drawn separately, fading in); the exact pivot is drawn at lt = 15.
    plane(Infinity, () => {
      R.push(M.translate(0, -TY_END));
      R.rect(-400, -1600, 2720, 1420, [0.2, 0.19, 0.23, 1], { c1: [...hex('#3a3742'), 1], grad: 'vertical' });
      R.rect(-200, -200, 2320, 1480, [...hex('#3a3742'), 1], { c1: [...hex('#77707c'), 1], grad: 'vertical' });
      R.rect(-400, 1279, 2720, 900, [...hex('#77707c'), 1], { c1: [...hex('#6e6874'), 1], grad: 'vertical' });
      R.layer(ashA.clouds, M.translate(-240 + 6 * Math.sin(R.t * 0.1), -160));
      R.pop();
    });
    // forest sky (graded: day -> fire -> smoke)
    const skyB = { heat: smoothstep(T.impact, T.impact + 0.6, lt), char: smoothstep(T.impact + 1.5, T.ash0 + 0.5, lt), ash: smoothstep(T.ash0 - 1, T.end - 1.5, lt) };
    const hh = skyB.heat * (1 - skyB.ash);
    const skyLook = { grade: [lerp(lerp(1, 1.15, skyB.heat), 0.3, skyB.char), lerp(lerp(1, 0.86, skyB.heat), 0.5, skyB.char) * lerp(1, 1.12, skyB.ash), 1], tint: [lerp(1, 1.12, hh), lerp(1, 0.6, hh), lerp(1, 0.4, hh)] };
    if (skyB.ash > 0) skyLook.color = [0.44, 0.415, 0.46, 0.95 * skyB.ash];
    plane(12, () => {
      const topY = R.toScreen(0, -420)[1];
      R.withMask({ type: 'linear', nx: 0, ny: 1, d0: topY + 10, d1: topY + 240 }, () => {
        R.rect(-800, -440, 3600, 440, [...hex(FC.skyTop), 1], { c1: [...hex(FC.skyMid), 1], grad: 'vertical', ...skyLook });
        R.rect(-800, -1, 3600, 1400, [...hex(FC.skyMid), 1], { c1: [...hex(FC.skyLow), 1], grad: 'vertical', ...skyLook });
        R.layer(A.sky, M.translate(-440, -420), skyLook);
      });
      R.glow(1480, 60, 520, [1, 0.96, 0.8], 0.14 * (1 - skyB.char), { shape: [1.2, 0.4, 1.6], ext: 2.5 });
    });
    const farB = (d) => burnState(lt, T.impact + 0.2 + 0.1 * d, T.impact + 1.6 + 0.25 * d);
    plane(7, () => R.layer(A.volcano, M.translate(-340, 150), burnLook(farB(7), fg)));
    plane(IMP.d, () => drawMeteor(R, A.fx, lt));
    // far rows: char, then burn down from the top (stump heights vary tree to tree), embers at the edge
    const farRow = (L, d) => plane(d, () => {
      const b = farB(d);
      const m = M.translate(-700, -650);
      const down = smoothstep(T.roar - 0.4, T.ash0 + 0.6, lt) * 0.62;
      if (down <= 0.001) { drawBurning(L, m, b); return; }
      const Ms = M.mul(R.view, m);
      const mk = (tt, s) => texMask(NW, Ms, L.w, L.h, tt, s);
      R.layer(L, m, { color: [0.9, 0.22, 0.04, 1], blend: 'add', opacity: 0.4 * (1 - b.ash), mask: mk(down - 0.02, 0.012) });
      R.withMask(mk(down, 0.012), () => R.layer(L, m, burnLook(b, fg)));
    });
    farRow(A.far2, 4.5);
    const mistK = 1 - smoothstep(T.impact, T.impact + 1.2, lt);
    if (mistK > 0.001) plane(3.2, () => R.layer(A.life.mist, M.translate(-560 + 14 * Math.sin(t * 0.13), groundV(3.2) - 250), { opacity: 0.8 * mistK }));
    drawPteros(R, A.life, lt, plane);
    farRow(A.far1, 2.8);
    plane(2.3, () => {
      const th = T.impact + 0.45;
      const sw = M.chain(M.translate(960, -300), M.rotate(0.004 * Math.sin(t * 0.6) + 0.03 * push(960, 2.3, th)), M.translate(-960, 300));
      const m = M.mul(sw, M.translate(-540, -520 + 260)), b = burnState(lt, th, T.roar - 0.45);
      drawBurnAway(A.canopyBack, m, b);
      canopyFire(A.canopyBackSpots, m, b, 0.45, 3);
    });

    // ================================================================= MID / NEAR FOREST
    const band = (i) => {
      const bd = A.bands[i];
      const b = bs(hitTime(impactDist(IMP.u, bd.d)) + 0.25);
      plane(bd.d, () => drawBurning(bd.L, M.translate(-800, bd.top), b));
    };
    const trees = (lo, hi) => {
      for (const tr of TREES) {
        if (tr.d < lo || tr.d >= hi) continue;
        const S = A.trunks[tr.kind][tr.v];
        const b = bs(tr.tHit);
        plane(tr.d, () => {
          const lean = push(tr.x, tr.d, tr.tHit) * 0.06;
          const m = M.chain(M.translate(tr.x, groundV(tr.d) + 6), M.rotate(lean), M.scale(tr.s * tr.flip, tr.s), M.translate(-S.bx, -S.by));
          // once burning, the trunk is eaten from the top down into a charred stump; flames ride the edge
          const down = smoothstep(0.3, 3.4, b.tb) * 0.74;
          if (down > 0.001) {
            const Ms = M.mul(R.view, m);
            R.layer(S.L, m, { color: [0.95, 0.22, 0.04, 1], blend: 'add', opacity: 0.55 * (0.25 + 0.75 * Math.min(1, b.fire)) * (1 - b.ash), mask: texMask(ND, Ms, S.W, S.H, down - 0.018, 0.012) });
            R.withMask(texMask(ND, Ms, S.W, S.H, down, 0.015), () => R.layer(S.L, m, burnLook(b, fg)));
            const fire = Math.min(1, b.fire);
            if (fire > 0.03) {
              const yTop = ((down - 0.12) / 0.8) * S.H;               // burn edge in sprite coordinates
              const frame = Math.floor(tN * 15);
              const cell = A.fx.flames.cell;
              for (let q = 0; q < 3; q++) {
                const lx = S.bx + (q - 1) * S.w * 0.3 * (0.8 + 0.1 * Math.sin(q * 5.1));
                const [wx, wy] = M.apply(m, lx, yTop + 10);
                const k = S.w / 150 * tr.s * (0.8 + 0.25 * h01(q, frame)) * fire;
                const sp = (frame + q * 4 + Math.floor(tr.x)) % 12;
                R.layer(A.fx.flames.layer, M.chain(M.translate(wx, wy), M.scale(0.75 * k * (q % 2 ? -1 : 1), 0.75 * k), M.translate(-cell / 2, -cell / 2 - 112)), { uv: A.fx.flames.uv(sp), w: cell, h: cell, opacity: Math.min(1, fire * 1.5) });
              }
              const [gx, gy] = M.apply(m, S.bx, yTop);
              R.glow(gx, gy - 40, 130 * tr.s, [1, 0.45, 0.14], 0.14 * fire, { ext: 3 });
            }
          } else drawBurning(S.L, m, b);
        });
      }
    };
    const plants = (lo, hi) => {
      for (const p of PLANTS) {
        if (p.d < lo || p.d >= hi) continue;
        const b = bs(p.tHit);
        const pp = push(p.x, p.d, p.tHit);
        plane(p.d, () => {
          const cell = A.frondCell;
          for (const fr of p.fr) {
            const sw = 0.035 * Math.sin(t * 1.3 * fr.f + fr.ph) + 0.02 * Math.sin(t * 0.7 + p.ph) + 0.5 * pp;
            const side = fr.a < -Math.PI / 2 ? -1 : 1;
            const wilt = smoothstep(-0.2, 1.4, b.tb);                     // fronds curl down and shrivel in the fire
            const flat = side * (b.heat * 0.25 + 0.9 * wilt);
            const shrink = 1 - 0.45 * wilt;
            const m = M.chain(M.translate(p.x, p.y), M.rotate(fr.a + sw + flat), M.scale(fr.s * shrink, fr.s * fr.flip * lerp(1, 0.7, wilt)), M.translate(-16, -(cell / 2 + 30)));
            drawBurnAway(A.fronds.layer, m, { ...b, char: Math.max(b.char, wilt * 0.9) }, { uv: A.fronds.uv(fr.i), w: cell, h: cell }, [cell, cell]);
          }
        });
      }
    };
    const cycads = (lo, hi) => {
      for (const cy of CYCADS) {
        if (cy.d < lo || cy.d >= hi) continue;
        const b = bs(cy.tHit);
        plane(cy.d, () => {
          const size = 520 * cy.s, cell = A.cycads.cell;
          const m = M.place(cy.x, groundV(cy.d) + 6 - 200 * cy.s, size / cell, 0.012 * Math.sin(t * 0.9 + cy.x) + 0.05 * push(cy.x, cy.d, cy.tHit), cell / 2, cell / 2);
          drawBurnAway(A.cycads.layer, m, b, { uv: A.cycads.uv(cy.i), w: cell, h: cell }, [cell, cell]);
        });
      }
    };
    const puffs = dustPuffs(lt);
    const drawPuff = (p) => plane(p.d, () => {
      const age = p.age;
      const warm = smoothstep(0.3, 1.2, age), sm = smoothstep(1.0, 2.6, age);
      const tint = [lerp(lerp(1.0, 1.08, warm), 0.62, sm), lerp(lerp(0.8, 0.68, warm), 0.58, sm), lerp(lerp(0.7, 0.52, warm), 0.6, sm)];
      const lit = 1 + 0.15 * bl * (p.d > 1.1 ? 1 : 0.3);
      A.fx.puffs.draw(R, p.sp, p.u, p.v - 40 * sm * sm, p.size * (1 + 0.15 * sm), p.rot, { tint, grade: [lerp(1, 0.35, sm), lit * lerp(1, 0.8, sm), 1], opacity: 1 - smoothstep(1.8, 3.0, age) });
    });
    // blast ring on the ground: a hazy glowing band of dust with a hot core, sweeping outward.
    // Split by depth so the dinosaur and the near plants occlude it correctly.
    const ringGroups = { far: [[], []], mid: [[], []], near: [[], []] };
    {
      const rho = blastR(lt);
      if (rho > 0 && lt < T.wavePass + 0.4) {
        const fade = 1 - smoothstep(T.wavePass - 0.3, T.wavePass + 0.4, lt);
        const young = Math.exp(-(lt - T.impact) * 1.5);
        const N = 720, pts = [];
        for (let k = 0; k <= N; k++) {
          const q = ringPoint(rho, (k / N) * TAU);
          if (!q || q.d < 0.55) { pts.push(null); continue; }
          const Vd = depthM(c, q.d);
          if (!Vd) { pts.push(null); continue; }
          const [x, y] = M.apply(Vd, q.u, q.v);
          pts.push({ x, y, k: M.scaleOf(Vd), d: q.d });
        }
        for (let k = 0; k <= N; k++) {
          const p = pts[k];
          if (!p) continue;
          const a = pts[Math.max(0, k - 1)] || p, b = pts[Math.min(N, k + 1)] || p;
          const sp = Math.hypot(b.x - a.x, b.y - a.y) / 2;
          const g = p.d > 1.02 ? ringGroups.far : p.d > 0.84 ? ringGroups.mid : ringGroups.near;
          const coreS = 5 * p.k, hazeS = 46 * p.k;
          g[1].push([p.x, p.y, coreS, 0, 1, 0.8, 0.55, (0.25 + 0.4 * young) * fade * clamp(sp / (0.6 * coreS))]);
          if (k % 4 === 0) g[0].push([p.x, p.y - 8 * p.k, hazeS, 0, 1, 0.72, 0.5, 0.1 * fade * clamp((4 * sp) / (0.6 * hazeS))]);
        }
      }
    }
    const drawRing = (g) => {
      if (!g[1].length) return;
      R.with(inv1, () => { R.particles(g[0], { kind: 'soft', blend: 'add' }); R.particles(g[1], { kind: 'glow', blend: 'add' }); });
    };
    band(0);
    drawHerd(R, A.life, lt, plane, burnLook(bs(T.impact + 0.5), fg));
    if (mistK > 0.001) plane(1.9, () => R.layer(A.life.mist, M.translate(-520 - 10 * Math.sin(t * 0.17), groundV(1.9) - 245), { opacity: 0.55 * mistK }));
    trees(1.5, 2.0);
    plants(1.5, 2.0);
    plane(1.45, () => {
      const th = hitTime(impactDist(IMP.u, 1.45)) + 0.1;
      const sw = M.chain(M.translate(960, -250), M.rotate(0.006 * Math.sin(t * 0.8) + 0.05 * push(700, 1.45, th)), M.translate(-960, 250));
      const m = M.mul(sw, M.translate(-540, -520 + 250)), b = burnState(lt, th, T.roar - 0.15);
      drawBurnAway(A.canopy, m, b);
      canopyFire(A.canopySpots, m, b, 0.7, 5);
    });
    for (const p of puffs) if (p.d >= 1.25) drawPuff(p);
    plane(IMP.d, () => drawExplosion(R, A.fx, lt));
    band(1);
    plants(1.25, 1.5);
    cycads(1.2, 1.5);
    trees(1.1, 1.5);
    plants(1.07, 1.25);
    for (const p of puffs) if (p.d >= 1.02 && p.d < 1.25) drawPuff(p);
    band(2);
    drawRing(ringGroups.far);

    // ================================================================= FIRE (painted flame drawings, cycled on twos)
    const drawFire = (lo, hi) => {
      if (lt < T.impact + 0.3 || lt > DUR - 0.9) return;
      const frame = Math.floor(tN * 15);
      const cell = A.fx.flames.cell;
      for (let si = 0; si < FIRES.length; si++) {
        const s = FIRES[si];
        if (s.kind !== 'ground' || s.d < lo || s.d >= hi) continue;
        const b = burnState(lt, s.tHit);
        if (b.fire <= 0.02) continue;
        plane(s.d, () => {
          const sp = (frame + si * 5) % 12;
          const k = s.h * (0.45 + 0.55 * Math.min(1.2, b.fire)) * (s.kind === 'trunk' ? 0.75 : 1) * (0.92 + 0.12 * h01(frame, si));
          const flip = (si + (frame >> 2)) % 2 ? -1 : 1;
          const m = M.chain(M.translate(s.u, s.v), M.scale(0.62 * k * flip, 0.62 * k), M.translate(-cell / 2, -cell / 2 - 150));
          R.layer(A.fx.flames.layer, m, { uv: A.fx.flames.uv(sp), w: cell, h: cell, opacity: Math.min(1, b.fire * 1.6) });
          R.glow(s.u, s.v - 50 * k, 90 * k, [1, 0.45, 0.14], 0.16 * Math.min(1, b.fire), { ext: 3 });
        });
      }
    };
    drawFire(1.02, 3);

    // ================================================================= DINOSAUR
    const tau = lt - DINO_HIT;
    const col = smoothstep(1.6, 4.2, tau);
    const P = pose(lt, { recoil: smoothstep(-0.3, 0.25, tau) * (1 - smoothstep(0.9, 2.2, tau)), collapse: col });
    const db = bs(DINO_HIT + 0.2);
    const dLook = burnLook(db, fg);
    const sil = Math.max(bl, 0.8 * smoothstep(T.impact + 0.4, T.impact + 1.4, lt)) * (1 - 0.5 * db.char) * (1 - db.ash);
    dLook.grade = [dLook.grade[0] * lerp(1, 0.45, sil), dLook.grade[1] * lerp(1, 0.09, sil), dLook.grade[2]];
    if (sil > 0.01) dLook.tint = [dLook.tint[0] * lerp(1, 1.3, sil), dLook.tint[1] * lerp(1, 0.75, sil), dLook.tint[2] * lerp(1, 0.7, sil)];
    const crumble = smoothstep(T.impact + 3.5, T.impact + 5.6, lt);
    if (bl > 0.01) plane(1.02, () => R.glow(P.body.x - 60, P.body.y - 100, 560, [1, 0.72, 0.42], 0.3 * bl, { ext: 2 }));
    const fireBack = smoothstep(T.impact + 0.8, T.impact + 1.6, lt) * (1 - db.char);
    if (fireBack > 0.01) plane(1.02, () => R.glow(P.body.x + 20, P.body.y + 60, 460, [1, 0.45, 0.12], 0.22 * fireBack, { ext: 2, sx: 1.4, sy: 0.7 }));
    plane(1, () => {
      if (crumble > 0.001) {
        // mask box around the collapsed body (world coords on the dino plane)
        const bx0 = P.body.x - 520, by0 = P.body.y - 330, BW = 1040, BH = 520;
        const Ms = M.mul(R.view, M.translate(bx0, by0));
        const th = 0.12 + 0.42 * crumble;               // stops at a low jagged mound
        R.withMask(texMask(ND, Ms, BW, BH, th - 0.03, 0.02), () => drawDino(R, A.dino, P, { ...dLook, color: [1.3, 0.34, 0.06, 1], blend: 'add', opacity: 0.8 * (1 - db.ash) }, null));
        R.withMask(texMask(ND, Ms, BW, BH, th, 0.02), () => drawDino(R, A.dino, P, dLook, eyeA));
      } else drawDino(R, A.dino, P, dLook, eyeA);
      const fd = footDust(lt, P);
      if (fd.length) R.particles(fd, { kind: 'soft' });
    });
    drawFlies(R, A.life, lt, plane, 1 - smoothstep(T.impact, T.impact + 0.06, lt));   // gone inside the white-out

    // ================================================================= NEAR FOREGROUND
    drawRing(ringGroups.mid);
    for (const p of puffs) if (p.d < 1.02 && p.d >= 0.8) drawPuff(p);
    cycads(0.85, 1.0);
    plants(0.84, 1.07);
    band(3);
    drawRing(ringGroups.near);
    drawFire(0.5, 1.02);
    plants(0.6, 0.84);
    band(4);
    for (const p of puffs) if (p.d < 0.8) drawPuff(p);

    // ================================================================= LIGHT / PARTICLES
    plane(IMP.d, () => {
      const { rocks, sparks } = debrisParticles(lt);
      if (rocks.length) R.particles(rocks, { kind: 'hard' });
      if (sparks.length) R.particles(sparks, { kind: 'glow', blend: 'add' });
    });
    // embers rising from the fires
    if (lt > T.impact + 0.5) {
      const out = [];
      for (const e of EMBERS) {
        const s = FIRES[Math.floor(e.src * FIRES.length)];
        const x = lt - (s.tHit + 0.4 + e.t0 * 5.5);
        if (x <= 0 || x > e.life) continue;
        const Vd = depthM(c, s.d);
        if (!Vd) continue;
        const [px, py] = M.apply(Vd, s.u + (e.vx * x + 16 * Math.sin(x * e.f + e.ph)) / s.d, s.v - 20 + (e.vy * x) / s.d);
        const k = 1 - x / e.life;
        const colr = hex(mixHex('#fff0b0', '#ff5a1a', clamp((x / e.life) * 1.3)));
        out.push([px, py, e.s * M.scaleOf(Vd) * (0.6 + 0.6 * k), 0, colr[0], colr[1], colr[2], k * (1 - smoothstep(DUR - 1.6, DUR - 0.7, lt))]);
      }
      R.with(inv1, () => R.particles(out, { kind: 'glow', blend: 'add' }));
    }
    // smoke rising from the fires
    for (const s of smokePuffs(lt, FIRES)) {
      plane(s.d, () => {
        const dk = s.dark;
        A.fx.smoke.draw(R, s.sp, s.u, s.v, s.size, s.rot, { tint: [lerp(1.12, 0.98, dk), lerp(0.96, 0.96, dk), lerp(0.9, 1.02, dk)], grade: [0.5, lerp(0.72, 1.0, dk) * (1 + 0.2 * fg * (1 - dk)), 1], opacity: 0.92 * s.a * (1 - smoothstep(DUR - 1.8, DUR - 0.5, lt)) });
      });
    }
    drawShafts(R, lt, plane, smoothstep(0.8, 2.4, lt) * (1 - smoothstep(T.impact - 0.3, T.impact + 0.05, lt)));
    // smoke ceiling: big billows drifting above the burning forest (the camera tilts up through them)
    const ceil = smoothstep(T.roar, T.ash0, lt) * (1 - smoothstep(DUR - 1.7, DUR - 0.35, lt));
    if (ceil > 0.001) {
      plane(3, () => {
        for (let k = 0; k < 22; k++) {
          const x = -300 + ((k * 197) % 2500) + 40 * (lt - T.roar) * (0.6 + 0.4 * ((k * 37) % 7) / 7);
          const y = -150 - ((k * 131) % 900) - 30 * (lt - T.roar);
          const size = 700 + ((k * 53) % 400);
          A.fx.smoke.draw(R, k % 6, x, y, size, ((k * 17) % 10) * 0.06, { tint: [0.98, 0.95, 1.02], grade: [0.4, 0.95, 1], opacity: 0.85 * ceil });
        }
      });
    }
    // flash + fire light over the frame
    if (fk > 0.001) R.with(inv1, () => R.fill([1, 0.95, 0.85, 1], { blend: 'add', opacity: 1.5 * fk }));
    if (fg > 0.001) R.with(inv1, () => R.rect(-10, 300, 1940, 800, [0.9, 0.35, 0.08, 0], { c1: [0.7, 0.2, 0.04, 0.16 * fg], grad: 'vertical', blend: 'add' }));
    // falling ash: the pivot's own flakes (screen space), fading in
    const ashIn = smoothstep(T.ash0, T.ash0 + 1.6, lt);
    if (ashIn > 0.001) R.with(inv1, () => PIVOT.ash.drawFlakes(R, ashA, ashIn));
  },
};
