// SEA (52.5 – 70 s): PIVOT.cell -> mitosis -> cleavage (2, 4, 8, 16 cells on the beat) -> the morula folds
// into an embryo and becomes a small fish -> it swims through the sea -> reaches the shallows, fins become
// legs, it crawls onto the bank -> the camera pushes into its eye = PIVOT.eye.
import { PIVOT } from '../pivots.js';
import { C } from '../lib/palette.js';
import { M, TAU, lerp, clamp, invLerp, ease, seg, hex, T0, DUR } from './lib.js';
import { defineSeaBrushes } from './brushes.js';
import { cellsAt, cellMatrix, splitMask, C0, NUC_R } from './cells.js';
import { paintMitosis, MT, poles } from './mitosis.js';
import { cam, viewOf, viewDepth } from './camera.js';
import { pose, eyeOf, CT } from './creature.js';
import { paintCreature, paintSkin, SKIN } from './creaturePaint.js';
import { bodyPt, spine } from './rig.js';
import { paintSea, drawSea, bandY } from './backdrop.js';
import { paintReef, reefMatrix } from './terrain.js';
import { paintLand, drawLand } from './shore.js';
import { drawStars, drawSpray, drawMotes, drawBubbles, drawShafts } from './atmos.js';
import { headAt } from './path.js';
import { paintMicro, drawOrganelles, drawMicrobes, paintCellRims, drawCaustics } from './micro.js';
import { paintLife, drawSchools, drawJellies, paintKelp } from './life.js';

// Bubbles from the gills: a burst at the dart, then a sparse trail. Pure function of time.
const BUB = (() => {
  const out = [];
  let i = 0;
  for (let t = 7.3; t < 15.2; t += t < 8.2 ? 0.035 : 0.16) {
    const k = Math.sin(i * 12.9898) * 43758.5453;
    const f = k - Math.floor(k);
    out.push({ t0: t, s: 2 + 6 * f, life: 1.6 + 1.2 * f, ox: (f - 0.5) * 40, ph: f * 6.28, a: 0.5 + 0.5 * f });
    i++;
  }
  return out;
})();
function bubbles(lt) {
  const res = [];
  for (const b of BUB) {
    const age = lt - b.t0;
    if (age <= 0 || age > b.life) continue;
    const h = headAt(b.t0);
    const back = 120;
    const x = h.x - Math.cos(h.a) * back + b.ox + 12 * Math.sin(age * 5 + b.ph);
    const y = h.y - Math.sin(h.a) * back + 20 - age * (60 + 40 * age);
    res.push({ x, y, s: b.s * (1 + 0.3 * age), a: b.a * Math.min(1, (b.life - age) * 2) });
  }
  return res;
}

// A per-frame painting in near-screen space, repainted when R.key(fps) changes.
// paint(c, P, ltK) gets P = world -> layer transform at the key time.
function dynPaint(R, name, fps, paint, carry = null) {
  const key = R.key(fps);
  const ltK = clamp(key / fps - T0, 1 / 30, DUR);
  const P = M.mul(M.translate(96, 54), viewOf(cam(ltK)));
  const L = R.dyn(name, key, (c) => paint(c, P, ltK), { w: 2112, h: 1188 });
  // `carry`: rigid world motion from the key pose to this (sub-)sample, so things painted on twos still
  // travel smoothly (and are tracked, not smeared, by the camera)
  const W = carry ? M.mul(carry, M.inv(P)) : M.inv(P);
  R.layer(L, W);
  return { L, P, screen: M.mul(R.view, W) };
}
// Rigid transform taking the creature's head frame at the key time to its head frame now.
function carryOf(pK, pN) {
  return M.chain(M.translate(pN.x, pN.y), M.rotate(pN.th - pK.th), M.translate(-pK.x, -pK.y));
}
// Cells fold into the embryo: target body point for cell k.
function cellTarget(p, sp, k) {
  const s = 0.1 + 0.8 * ((k * 7) % 16) / 15;
  const v = ((k * 5) % 3 - 1) * 0.45;
  return bodyPt(p, sp, s, v);
}
// All cells at animation time t, including the fold into the embryo (glide to body points, shrink).
function cellList(t) {
  const { cells } = cellsAt(Math.min(t, 5.6));
  if (t > 5.1) {
    const p = pose(t), sp = spine(p);
    cells.forEach((c, k) => {
      const w = seg(t, 5.1 + k * 0.03, 6.1 + k * 0.03, ease.inOutSine);
      const tgt = cellTarget(p, sp, k);
      c.x = lerp(c.x, tgt[0], w);
      c.y = lerp(c.y, tgt[1], w);
      c.s *= 1 - seg(t, 5.5 + k * 0.035, 6.55 + k * 0.02, ease.inCubic);
    });
  }
  return cells;
}

export const scene = {
  id: 'sea',
  bg: C.teal,
  deps: [PIVOT.cell, PIVOT.eye],

  paint(P) {
    defineSeaBrushes(P.brush);
    return { sea: paintSea(P), reef: paintReef(P), land: paintLand(P), micro: paintMicro(P), skin: paintSkin(P), life: paintLife(P) };
  },

  view(lt) {
    if (lt <= 0) return M.id();
    return viewOf(cam(lt));
  },

  post(lt) {
    return {};
  },

  draw(R, lt, A) {
    if (lt <= 0) {
      R.drawScene(PIVOT.cell, 0, M.id());
      return;
    }
    const CA = R.engine.ensure(PIVOT.cell);
    const EA = R.engine.ensure(PIVOT.eye);
    const tK = clamp(R.key(15) / 15 - T0, 1 / 30, DUR); // animation time (on twos)
    const tg = T0 + tK;

    const cs = cam(lt);
    const inv1 = M.inv(R.view);
    const plane = (d, fn) => { R.push(M.mul(inv1, viewDepth(cs, d))); try { fn(); } finally { R.pop(); } };

    // ---- the water world: sea, surface band, sky
    R.fill(hex(C.teal));
    drawSea(R, A);
    // ---- the pivot's water, with soft world-space edges so it sits inside the wider sea
    {
      const sft = 75 * cs.z;
      const [ax, ay] = R.toScreen(-240, -160), [bx, by] = R.toScreen(2160, 1240);
      if (bx > -50 && ax < 1970 && by > -50 && ay < 1130) {
        const mask = { type: 'rect', x0: ax + sft, y0: ay + sft, x1: bx - sft, y1: by - sft, soft: sft };
        // the medium layer is not fully opaque: give it the same teal ground the pivot has behind it
        R.rect(-240, -160, 2400, 1400, hex(C.teal).concat(1), { mask });
        R.layer(CA.medium, M.translate(-240, -160), { mask });
      }
    }

    // ---- microbes drifting in the medium
    if (tK < 9.5) drawMicrobes(R, A, tK);
    // ---- sky life, far motes and light
    {
      plane(3, () => drawStars(R, lt, seg(lt, 3, 6)));
      drawSpray(R, lt, seg(lt, 3, 6));
      plane(1.25, () => drawMotes(R, lt, 'far', 0.8 * seg(lt, 0.2, 2.5)));
      drawShafts(R, lt, seg(lt, 5.5, 8.5) * (1 - seg(lt, 15.2, 16.6)), [1500, 2050, 2600, 3150, 3700, 4200, 4650]);
    }
    // ---- reef along the seabed, rising into the shore bank
    {
      R.layer(A.reef, reefMatrix());
      drawLand(R, A);
    }
    // ---- sea life behind the hero: kelp, jellyfish, schools
    {
      // (all of these start well outside the opening frame; they only enter or leave by moving)
      const vx0 = cs.x - 1000 / cs.z, vx1 = cs.x + 1000 / cs.z;
      if (vx1 > 2250 && vx0 < 4900) dynPaint(R, 'kelp', 15, (c, PM, t) => paintKelp(c, PM, t));
      drawJellies(R, A, lt);
      drawSchools(R, A, lt);
    }
    {
      drawMotes(R, lt, 'mid', seg(lt, 0.2, 2.5) * (1 - seg(lt, 16.2, 17.2)));
      drawBubbles(R, lt, bubbles(lt), seg(lt, 6.9, 7.3) * (1 - seg(lt, 15.4, 16.2)));
    }

    // ---- creature (grows behind the cells while they fold into the embryo)
    let P = null, sp = null, carry = M.id();
    if (tK >= CT.form0) {
      P = pose(tK);
      sp = spine(P);
      // shape on twos, travel on ones: carry the key-time painting to the current pose
      carry = lt > 6.9 ? carryOf(P, pose(Math.min(lt, DUR))) : M.id();
      // flat colour masses, then watercolour granulation through their silhouette, then the brushwork
      const base = dynPaint(R, 'crtBase', 15, (c, PM, t) => paintCreature(c, pose(t), PM, { pass: 'base' }), carry);
      const hd = P;
      R.layer(A.skin, M.mul(carry, M.place(hd.x, hd.y, hd.L / 1000, hd.th + Math.PI, SKIN.sx, SKIN.sy)), { blend: 'multiply', opacity: 0.85, mask: { type: 'texture', layer: base.L, m: base.screen, threshold: 0.5, softness: 0.08 } });
      dynPaint(R, 'crtTop', 15, (c, PM, t) => paintCreature(c, pose(t), PM, { pass: 'top' }), carry);
    }

    // ---- cells
    if (tK < 6.9) {
      const cells = cellList(tK);
      const b = 1 + 0.012 * Math.sin(tg * 1.7);
      const baseRot = 0.03 * Math.sin(tg * 0.5);
      for (const c of cells) {
        if (c.s < 0.004) continue;
        const mask = splitMask(R, c);
        const Mc = cellMatrix(c, 320, { breathe: b, baseRot });
        R.layer(CA.body, Mc, mask ? { mask } : {});
        drawOrganelles(R, A, c, Mc, tK, mask);
      }
      dynPaint(R, 'rims', 15, (c, PM, t) => paintCellRims(c, PM, cellList(t), t, 1 + 0.012 * Math.sin((T0 + t) * 1.7)));
      // beaded membrane (little lipid glints travelling around each cell)
      const ba = seg(tK, 0.2, 1.3);
      if (ba > 0) {
        const beads = [];
        for (const c of cells) {
          if (c.s < 0.05) continue;
          const n = Math.round(70 * c.s);
          const rad = 250 * c.s * b * 0.985;
          for (let k = 0; k < n; k++) {
            const a = (k / n) * TAU + tK * 0.12 * (c.i % 2 ? 1 : -1) + c.i;
            const x = c.x + Math.cos(a) * rad, y = c.y + Math.sin(a) * rad;
            if (c.split) {
              const sp = c.split;
              if ((x - sp.mx) * Math.cos(sp.axis) * sp.side + (y - sp.my) * Math.sin(sp.axis) * sp.side < 0) continue;
            }
            const tw = 0.6 + 0.4 * Math.sin(tK * 3 + k * 1.7);
            beads.push([x, y, 2.6 * c.s + 0.8, 0, 1, 0.93, 0.72, 0.55 * ba * tw]);
          }
        }
        R.particles(beads, { kind: 'soft' });
      }
      if (tK < MT.gone) {
        const nS = 1 - seg(tK, 0.35, MT.gone, ease.inCubic);
        if (nS > 0.002) {
          const tw = 3.2 * seg(tK, MT.wind0, MT.gone, ease.inOutSine);
          const m = M.place(C0[0], C0[1], b * nS, -0.05 * tg, 130, 130);
          const [sx, sy] = R.toScreen(C0[0], C0[1]);
          const rad = NUC_R * nS * b * R.scale() * 1.25;
          R.layer(CA.nucleus, m, { warp: { type: 'twirlNoise', cx: sx, cy: sy, radius: rad, angle: tw, amp: 7 * seg(tK, 0.2, 0.8) * R.scale() * nS, freq: 0.045 / R.scale(), time: tK * 0.6, falloff: 1.6 } });
        }
      }
      if (tK < 2.8) dynPaint(R, 'mitosis', 15, (c, PM, t) => paintMitosis(c, t, PM));
      if (cells.length > 1) {
        for (const c of cells) {
          let g = 1;
          if (c.L === 1 && tK < 3) g = ease.outBack(clamp(invLerp(MT.nuc0 + (c.i ? 0.06 : 0), MT.nuc1, tK)), 1.5);
          if (g * c.s <= 0.002) continue;
          R.layer(CA.nucleus, cellMatrix(c, 130, { scale: g * 0.92, breathe: b, baseRot: -0.05 * tg, kLong: 0.3, kShort: 0.16 }));
        }
      }
      // spindle poles: small warm lights
      if (tK > 0.5 && tK < 2.6) {
        const a = seg(tK, 0.5, 0.95) * (1 - seg(tK, 2.0, 2.55));
        for (const q of poles(tK)) R.glow(q[0], q[1], 7, [1, 0.85, 0.55], 1.1 * a, { shape: [2.5, 0.5, 2], ext: 4 });
      }
    }

    // ---- caustic light over everything in the water (fades out before the close-up)
    {
      const ca = 0.045 * seg(lt, 0.3, 2.2) * (1 - seg(lt, 12.6, 13.6));
      // under the surface only: a soft linear mask 250 units below the band, in screen space
      const bx0 = cs.x - 900, bx1 = cs.x + 900;
      const [ax, ay] = R.toScreen(bx0, bandY(bx0) + 250), [bx, by] = R.toScreen(bx1, bandY(bx1) + 250);
      let nx = -(by - ay), ny = bx - ax;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      if (ny < 0) { nx = -nx; ny = -ny; }
      const d0 = ax * nx + ay * ny;
      R.withMask({ type: 'linear', nx, ny, d0, d1: d0 + 160 * cs.z }, () => drawCaustics(R, A, lt, ca, [[960, 560, 1.25], [2600, -60, 1.3]]));
    }
    // ---- the eye (the same painted eye as PIVOT.eye, all the way to the end)
    if (P) {
      const E = eyeOf(P, sp);
      const [ex, ey] = M.apply(carry, E.x, E.y);
      // a fish's round eye; its pupil narrows into the reptile's slit as the fins become legs (66 → 68.5 s)
      if (E.r > 0.2) PIVOT.eye.drawEye(R, EA, ex, ey, E.r, 0, clamp(invLerp(66.0, 68.5, R.t), 0, 1));
    }
    // ---- foreground motes (bokeh) and big microbes drifting past close to the lens
    plane(0.72, () => drawMotes(R, lt, 'near', 0.55 * seg(lt, 6.5, 8) * (1 - seg(lt, 14.8, 15.8)), { flow: [40, -14] }));
    if (tK < 8.5) plane(0.8, () => drawMicrobes(R, A, tK, 'near'));
  },
};
