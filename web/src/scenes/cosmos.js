// COSMOS — Big Bang → (rays curl into orbits) → Atom → … (continued in later phases)
import { C } from './lib/palette.js';
import { PIVOT } from './pivots.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, atlas, paintBall, makeStars, starParticles, ribbon } from './lib/kit.js';
import { ease, invLerp, prog, noise1, fbm1, viewMatrix } from '../engine/math.js';
import { makeGalaxyPart, T2, G, PSTAR_PRE, diveS, camZoom, camRot, twirlAngle, tilt, makeFwd, TW_R } from './cosmos_galaxy.js';

const CX = 960, CY = 540;
export const T = {
  point: 0.7,     // singularity appears
  inhale: 2.25,
  bang: 2.5,
  curl0: 4.375,   // rays start curling (bar 1, beat 3)
  curl1: 6.25,    // orbits closed — atom complete (bar 2, beat 2): Big Bang → atom is a quick breath
  atomEnd: 15,
};

// ---------------------------------------------------------------------------------------------
// Atom model (3D orbits, projected)
// ---------------------------------------------------------------------------------------------
// Helium-4 — the second most common atom made in the Big Bang (about 1 in 12): two electrons on two
// crossing orbits (a gyroscope), around a tight nucleus of 2 protons + 2 neutrons.
const ORBITS = [
  { R: 335, tilt: 1.2, roll: 0.35, color: C.cyan, w: 1.55, speed: 0.9, ph: 0.2, prec: 0.05 },
  { R: 350, tilt: 1.22, roll: 0.35 + TAU / 4, color: C.orange, w: 1.6, speed: -0.78, ph: 2.1, prec: 0.045 },
];
const NE = ORBITS.length;
// Orbit k at time lt: returns fn(theta) -> [x, y, z] (screen coords, z>0 = towards viewer).
function orbitFn(k, lt) {
  const o = ORBITS[k];
  const roll = o.roll + o.prec * lt;
  const ca = Math.cos(o.tilt), sa = Math.sin(o.tilt), cr = Math.cos(roll), sr = Math.sin(roll);
  return (th) => {
    const x = Math.cos(th) * o.R, y = Math.sin(th) * o.R;
    // tilt around X axis: y -> y*cos, z = y*sin
    const y1 = y * ca, z1 = y * sa;
    return [CX + x * cr - y1 * sr, CY + x * sr + y1 * cr, z1];
  };
}
// Polar radius of the projected orbit ellipse at screen angle phi.
function orbitRadius(k, lt, phi) {
  const o = ORBITS[k];
  const A = o.R, B = o.R * Math.abs(Math.cos(o.tilt));
  const roll = o.roll + o.prec * lt;
  const d = phi - roll;
  return (A * B) / Math.sqrt((B * Math.cos(d)) ** 2 + (A * Math.sin(d)) ** 2);
}
// Nucleus: helium-4 (an alpha particle) — 2 protons + 2 neutrons in a tight tetrahedron.
const NUC = (() => {
  const r = rng('nucleus');
  const R0 = 27 / Math.sqrt(3);
  const verts = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  return verts.map(([x, y, z], i) => ({ x: x * R0, y: y * R0, z: z * R0, proton: i % 2 === 0, v: r.int(0, 3), delay: r(0, 0.8) }));
})();

// ---------------------------------------------------------------------------------------------
// Rays
// ---------------------------------------------------------------------------------------------
const RAYS = (() => {
  const r = rng('rays');
  const rays = [];
  const n = 84;
  const pal = [C.cream, C.cream, C.gold, C.amber, C.orange, C.vermilion, C.magenta, C.plum, C.rose];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r(-0.035, 0.035);
    const kind = i % 4 === 0 ? 'ribbon' : i % 4 === 2 ? 'wire' : r() < 0.6 ? 'ink' : 'wire';
    rays.push({
      a,
      kind,
      color: kind === 'ribbon' ? r.pick([C.cream, C.cream, C.gold, C.amber, C.orange, C.rose]) : r.pick(pal),
      brush: kind === 'ribbon' ? 'ink' : kind,
      w: kind === 'ribbon' ? r(5, 13) : kind === 'ink' ? r(1.3, 2.4) : r(1.0, 1.8),
      reach: r(1250, 1900),
      speed: r(3.5, 7),
      delay: r(0, 0.18),
      inner: r(0.02, 0.22),
      wob: r(0, TAU),
      orbit: -1,
    });
  }
  // one orbit ray per electron: pick rays with angles near each orbit's apex, ensure thick-ish
  const picks = [8, 28];
  picks.forEach((idx, k) => {
    rays[idx].orbit = k;
    rays[idx].color = ORBITS[k].color;
    rays[idx].brush = 'orbit';
    rays[idx].w = ORBITS[k].w;
    rays[idx].delay = 0;
  });
  return rays;
})();

// Ray polyline at time lt -> array of [x, y, pressure], or null.
function rayPoints(ray, lt, N = 36) {
  const tb = lt - T.bang - ray.delay;
  if (tb <= 0) return null;
  const grow = 1 - Math.exp(-tb * ray.speed * 0.55);
  const r1 = 20 + ray.reach * grow;
  const r0 = 8 + r1 * ray.inner * smoothstep(0, 1.5, tb);
  const u = ease.inOutCubic(invLerp(T.curl0, T.curl1, lt));
  const pts = [];
  const dir = ray.orbit >= 0 ? (ORBITS[ray.orbit].speed > 0 ? 1 : -1) : ray.a % 0.2 > 0.1 ? 1 : -1;
  const aj = ray.a + 0.012 * Math.sin(lt * 0.7 + ray.wob);
  for (let j = 0; j < N; j++) {
    const s = j / (N - 1);
    let rr = lerp(r0, r1, s);
    let ang = aj;
    if (u > 0) {
      if (ray.orbit >= 0) {
        // wind the tail backwards around the nucleus into the full orbit
        const thT = aj - dir * TAU * (1 - s);
        const rT = orbitRadius(ray.orbit, lt, thT);
        ang = lerp(aj, thT, ease.inOutSine(u));
        rr = Math.exp(lerp(Math.log(rr), Math.log(rT), u));
      } else {
        // coil into the centre and contract to nothing (finishes early)
        const v = clamp(u / 0.72);
        const thT = aj + dir * 3.5 * (1 - s);
        const rT = lerp(4, 30, s) * (1 - v);
        ang = lerp(aj, thT, v);
        rr = Math.exp(lerp(Math.log(rr), Math.log(Math.max(rT, 0.5)), ease.inCubic(v)));
      }
    }
    const pr = ray.orbit >= 0 ? lerp(lerp(0.25, 1.2, s), 1, u) : lerp(0.2, 1.25, s) * (1 - 0.85 * clamp(u / 0.72));
    pts.push([CX + Math.cos(ang) * rr, CY + Math.sin(ang) * rr, pr]);
  }
  return pts;
}

// Tip of an orbit ray == electron position during the curl.
function electronPos(k, lt) {
  if (lt < T.curl1) {
    const ray = RAYS.find((r) => r.orbit === k);
    const p = rayPoints(ray, lt, 36);
    return p ? p[p.length - 1] : null;
  }
  const o = ORBITS[k];
  // at curl1 the electron sits at the ray tip; it then accelerates smoothly along its orbit
  const f = orbitFn(k, lt);
  return f(electronTheta0(k) + o.speed * TAU * 0.5 * rampIntegral(lt - T.curl1, 1.2));
}
function rampIntegral(x, r) {
  // integral of smoothstep ramp from 0..x with ramp length r (accelerate smoothly to full speed)
  if (x <= 0) return 0;
  if (x >= r) return r / 2 + (x - r);
  const u = x / r;
  return r * (u * u * u - u * u * u * u / 2);
}
const _th0 = {};
function electronTheta0(k) {
  if (_th0[k] !== undefined) return _th0[k];
  const ray = RAYS.find((r) => r.orbit === k);
  const f = orbitFn(k, T.curl1);
  let best = 0, bd = Infinity;
  for (let i = 0; i < 2000; i++) {
    const th = (i / 2000) * TAU;
    const [x, y] = f(th);
    let d = Math.atan2(y - CY, x - CX) - ray.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < bd) { bd = Math.abs(d); best = th; }
  }
  return (_th0[k] = best);
}


// ---------------------------------------------------------------------------------------------
// Camera (whole cosmos segment)
// ---------------------------------------------------------------------------------------------
function zBang(lt) {
  return 1 + 0.07 * prog(lt, 0, T.bang, ease.inQuad) + 0.05 * prog(lt, T.bang, T.curl1, ease.outCubic) + 0.03 * prog(lt, T.curl1, T2.unspool, ease.inOutSine);
}
function camView(lt) {
  const z = lt <= T2.unspool ? zBang(lt) : camZoom(lt, zBang(T2.unspool));
  const k = lt > T.bang ? Math.exp(-(lt - T.bang) * 5) : 0;
  const sx = k * 9 * noise1(lt * 30, 1), sy = k * 9 * noise1(lt * 30, 2);
  const tremble = smoothstep(T.point, T.inhale, lt) * (lt < T.bang ? 1 : 0);
  const tx = tremble * 1.2 * noise1(lt * 40, 3), ty = tremble * 1.2 * noise1(lt * 40, 4);
  return M.chain(M.translate(CX + sx + tx, CY + sy + ty), M.rotate(camRot(lt)), M.scale(z), M.translate(-CX, -CY));
}
let _diveTarget = null;
function diveTarget() {
  if (_diveTarget) return _diveTarget;
  const V = camView(T2.dive0);
  const c = M.apply(V, G[0], G[1]), z = M.scaleOf(V), vr = Math.atan2(V[1], V[0]);
  const tl = tilt(T2.dive0);
  const fwd = makeFwd(c, TW_R * z, twirlAngle(T2.dive0), tl.cosi, tl.phi + vr);
  const sp = M.apply(V, PSTAR_PRE[0], PSTAR_PRE[1]);
  return (_diveTarget = fwd(sp[0], sp[1]));
}
function fullView(lt) {
  const V = camView(lt);
  if (lt <= T2.dive0) return V;
  return M.mul(diveS(lt, diveTarget()), V);
}
// world -> final screen (includes twirl + tilt), for a given full view
function mapper(view, lt) {
  const z = M.scaleOf(view), vr = Math.atan2(view[1], view[0]);
  const c = M.apply(view, G[0], G[1]);
  const tl = tilt(lt);
  const fwd = makeFwd(c, TW_R * z, twirlAngle(lt), tl.cosi, tl.phi + vr);
  return (x, y) => { const q = M.apply(view, x, y); return fwd(q[0], q[1]); };
}

const GAL = makeGalaxyPart({ orbitFn, electronPos, ORBITS });
const PERIOD = ORBITS.map((o) => 2 / Math.abs(o.speed));
function electronPath(k, t) {
  return t <= T2.release[k] ? electronPos(k, t) : GAL.flightPos(k, t);
}

// ---------------------------------------------------------------------------------------------
export const cosmos = {
  id: 'cosmos',
  bg: C.void,
  deps: [PIVOT.star, PIVOT.singularity],

  paint(P) {
    const { brush } = P;
    // brushes for rays / orbits
    if (!brush.box().includes('rayThick')) {
      brush.add('rayThick', { type: 'default', weight: 2.2, scatter: 0.5, sharpness: 0.75, grain: 0.7, opacity: 200, spacing: 0.3, pressure: [0.6, 1.2], rotate: 'none', noise: 0.3 });
      brush.add('orbit', { type: 'default', weight: 1.5, scatter: 0.3, sharpness: 0.85, grain: 0.85, opacity: 210, spacing: 0.25, pressure: [1, 1], rotate: 'none', noise: 0.2 });
    }
    const haze = P.layer('haze', { w: 2400, h: 1500, scale: 0.5 }, (c) => {
      const r = c.r;
      for (let i = 0; i < 34; i++) {
        const col = r.pick([C.navy2, C.purple, C.deepTeal, C.plum, C.violet]);
        c.fillPoly(c.blob(r(0, 2400), r(0, 1500), r(220, 560), r(140, 320), { rot: r(0, 3), wobble: 0.2 }), col, { opacity: 26, bleed: 0.18, texture: 0.9, border: 0.05 });
      }
    });
    const nucleons = atlas(P, 'nucleons', 8, 120, (c, cx, cy, i) => {
      const proton = i < 4;
      const base = proton ? [C.vermilion, C.orange, '#e0553a', C.rust][i % 4] : [C.gold, C.cream, '#f0c36b', C.sand][i % 4];
      paintBall(c, cx, cy, 50, base, { lightAngle: -2.3, texture: 0.6, seed: i * 7, rim: proton ? '#ffd2a0' : '#fff2d0' });
    }, { cols: 4, scale: 2 });
    const electron = atlas(P, 'electron', 1, 80, (c, cx, cy) => {
      paintBall(c, cx, cy, 30, C.amber, { lightAngle: -2.3, light: '#fff0c8', texture: 0.4 });
    }, { cols: 1, scale: 2 });
    const stars = makeStars('cosmos-stars', 900, { warm: 0.4 });
    const sparks = (() => {
      const r = rng('sparks');
      return Array.from({ length: 1400 }, () => ({ a: r(0, TAU), v: Math.pow(r(), 1.8) * 1500 + 60, s: r(1, 4.5), d: r(0, 0.25), hue: r(), life: r(1.5, 4) }));
    })();
    // hot plasma: radial, flame-like dry-brush strokes (expands and cools after the bang)
    const plasma = P.layer('plasma2', { w: 2400, h: 2400, scale: 0.7 }, (c) => {
      const r = c.r;
      const cx = 1200, cy = 1200;
      const warm = [C.gold, C.amber, C.orange, C.vermilion, C.rose, C.cream, C.magenta];
      for (let i = 0; i < 520; i++) {
        const a = r(0, TAU), r0 = r(30, 220), r1 = Math.min(1080, r0 + r(200, 820));
        const bend = r(-0.25, 0.25), pts = [];
        for (let k = 0; k <= 6; k++) {
          const t = k / 6, rr = lerp(r0, r1, t), aa = a + bend * t * t;
          pts.push([cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, lerp(1.2, 0.35, t)]);
        }
        c.strokePath(pts, r.pick(['dry', 'gouache', 'pastel', 'dry']), r.pick(warm), r(0.5, 2.2), 0.5);
      }
      for (let i = 0; i < 60; i++) {
        const a = r(0, TAU), r0 = r(10, 60), pts = [];
        for (let k = 0; k <= 4; k++) pts.push([cx + Math.cos(a) * (r0 + k * 40), cy + Math.sin(a) * (r0 + k * 40), lerp(1.2, 0.4, k / 4)]);
        c.strokePath(pts, 'gouache', r.pick([C.cream, C.white, C.gold]), r(1, 2.2), 0.3);
      }
    });
    // electron probability cloud: stippled haze around the nucleus and along the orbits
    const ecloud = P.layer('ecloud', { w: 1000, h: 1000, scale: 0.9 }, (c) => {
      const r = c.r;
      for (let i = 0; i < 260; i++) {
        const a = r(0, TAU), d = Math.abs(r.gauss(0, 170)) + 40, x = 500 + Math.cos(a) * d, y = 500 + Math.sin(a) * d * 0.85;
        const b = a + Math.PI / 2 + r(-0.4, 0.4), L = r(30, 110);
        c.line(x, y, x + Math.cos(b) * L, y + Math.sin(b) * L, 'dust', r.pick([C.aqua, C.cyan, C.cream, C.amber, C.lavender]), r(0.5, 1));
      }
      for (let i = 0; i < 70; i++) {
        const a = r(0, TAU), d = r(60, 330), pts = [];
        for (let k = 0; k < 6; k++) pts.push([500 + Math.cos(a + k * 0.12) * d, 500 + Math.sin(a + k * 0.12) * d * 0.85]);
        c.strokePath(pts, 'wire', r.pick([C.aqua, C.lavender, C.cream]), 0.35, 0.6);
      }
    });
    // far stars later fall into the forming galaxy: give each a pre-twirl galaxy position
    const gr = rng('star-targets');
    const starTargets = stars.map(() => {
      let x, y;
      do {
        const sAlong = gr.gauss(0, 620), lat = gr.gauss(0, 260);
        x = G[0] + Math.cos(-0.42) * sAlong - Math.sin(-0.42) * lat;
        y = G[1] + Math.sin(-0.42) * sAlong + Math.cos(-0.42) * lat;
      } while (Math.hypot(x - PSTAR_PRE[0], y - PSTAR_PRE[1]) < 170);
      return { x, y, d: gr(0, 2.2) };
    });
    return { haze, plasma, ecloud, nucleons, electron, stars, sparks, starTargets, ...GAL.paint(P) };
  },

  view(lt) {
    return fullView(lt);
  },

  post(lt) {
    const flash = lt > T.bang ? Math.exp(-(lt - T.bang) * 3.2) : 0;
    const f2 = lt > T.bang ? Math.exp(-(lt - T.bang) * 9) : 0;
    const ig = lt > T2.ignite ? Math.exp(-(lt - T2.ignite) * 4) * 0.25 : 0;
    // ease back to the default post settings for the hand-off at 30 s
    const k = smoothstep(0.1, 2.0, lt) * (1 - smoothstep(T2.dive0, T2.end - 0.6, lt));
    return { exposure: 1 + 0.8 * f2 + 0.1 * flash + ig, bloom: 0.9 + 0.5 * flash, threshold: lerp(1, 0.95, k), vignette: lerp(0.32, 0.42, k), sat: lerp(1, 1.05, k) };
  },

  draw(R, lt, A) {
    const tb = lt - T.bang;
    const view = R.view;
    // the painted darkness before (and behind) everything: the same canvas the film loops into
    R.drawScene(PIVOT.singularity, 0, M.id());
    // ---- faint haze (the diffuse gas is gathered into the galaxy as it forms)
    const cooled = smoothstep(T.bang + 1.5, T.curl1 + 2, lt) * (1 - smoothstep(T2.twirl0, T2.twirl1, lt));
    if (cooled > 0) {
      const z = M.scaleOf(view), vr = Math.atan2(view[1], view[0]);
      const pm = M.chain(M.translate(960, 540), M.rotate(vr), M.scale(Math.pow(z, 0.12)), M.translate(-960, -540));
      R.push(M.inv(view));
      R.layer(A.haze, M.mul(pm, M.translate(-240, -210)), { opacity: 0.35 * cooled, grade: [0.9, 0.7, 1] });
      R.pop();
    }
    if (tb > 0) {
      // hot radiation field cooling from white-gold through orange and magenta to deep violet
      const cool = smoothstep(0, 5, tb);
      const heat = Math.exp(-tb * 0.45);
      const col = hex(cool < 0.5 ? mixHex('#ffb070', '#e8442c', cool * 2) : mixHex('#e8442c', '#5a1a6a', cool * 2 - 1));
      if (lt < T2.unspool + 3) R.glow(CX, CY, 360 + 560 * (1 - Math.exp(-tb * 1.2)), col, (0.12 * heat + 0.02) * (1 - smoothstep(T2.unspool, T2.unspool + 3, lt)), { shape: [1.1, 0.35, 1.6], ext: 3 });
      if (tb < 6) {
        const sc = 0.35 + 1.25 * (1 - Math.exp(-tb * 0.9));
        const pc = hex(cool < 0.5 ? mixHex('#ffe0b0', '#ff8a4a', cool * 2) : mixHex('#ff8a4a', '#8a3a8a', cool * 2 - 1));
        R.layer(A.plasma, M.chain(M.translate(CX, CY), M.rotate(tb * 0.05), M.scale(sc), M.translate(-1200, -1200)), {
          blend: 'screen', opacity: clamp(0.42 * Math.exp(-tb * 0.5) * smoothstep(0, 0.12, tb)), tint: [pc[0], pc[1], pc[2]],
        });
      }
      // far stars: nearly fixed (parallax), later falling into the galaxy disk
      const starA = smoothstep(3.5, 7.5, tb);
      if (starA > 0) {
        const z = M.scaleOf(view), vr = Math.atan2(view[1], view[0]);
        const pm = M.chain(M.translate(960, 540), M.rotate(vr), M.scale(Math.pow(z, 0.12)), M.translate(-960, -540));
        const base = starParticles(A.stars, lt, { alpha: starA * 0.8, m: pm });
        if (lt > T2.twirl0) {
          const toS = mapper(view, lt);
          base.forEach((q, i) => {
            const tg = A.starTargets[i];
            const u = prog(lt, T2.twirl0 + tg.d, T2.twirl1 - 0.3 + tg.d * 0.3, ease.inOutCubic);
            if (u <= 0) return;
            const [gx, gy] = toS(tg.x, tg.y);
            q[0] = lerp(q[0], gx, u);
            q[1] = lerp(q[1], gy, u);
          });
        }
        R.push(M.inv(view));
        R.particles(base, { kind: 'glow', blend: 'add' });
        R.pop();
      }
    }

    // ---- singularity
    if (lt >= T.point && lt < T.bang + 0.2) {
      const g = smoothstep(T.point, T.point + 1.2, lt);
      const inh = 1 - 0.55 * smoothstep(T.inhale, T.bang, lt);
      const flick = 0.85 + 0.15 * noise1(lt * 23, 9);
      R.glow(CX, CY, 7 * g * inh, [1, 0.93, 0.8], 3.2 * g * flick * (lt < T.bang ? 1 : 0), { shape: [3, 0.5, 2.5], ext: 6 });
      R.glow(CX, CY, 60 * g * inh, [1, 0.6, 0.35], 0.35 * g * (lt < T.bang ? 1 : 0), { shape: [1.5, 0.3, 2], ext: 4 });
    }

    // ---- rays (dynamic brush layer, repainted every frame)
    if (tb > 0 && lt < T.curl1 + 0.001) {
      const L = R.dyn('rays', R.key(30), (c) => {
        const { brush } = c;
        const live = RAYS.map((ray) => ({ ray, pts: rayPoints(ray, lt) })).filter((x) => x.pts && !(x.ray.orbit < 0 && lt > T.curl0 + 0.72 * (T.curl1 - T.curl0) - 0.02));
        const byColor = (arr) => arr.sort((a, b) => (a.ray.color < b.ray.color ? -1 : 1));
        for (const { ray, pts } of byColor(live.filter((x) => x.ray.kind === 'ribbon' && x.ray.orbit < 0))) {
          c.washPoly(ribbon(pts, 0.05, ray.w), ray.color, 235);
        }
        for (const { ray, pts } of byColor(live.filter((x) => x.ray.kind === 'ribbon' && x.ray.orbit < 0))) {
          brush.set('wire', mixHex(ray.color, '#ffffff', 0.35), 0.8);
          brush.noFill();
          brush.spline(pts.map((p) => [p[0], p[1], p[2] * 0.8]), 0.5);
        }
        for (const { ray, pts } of byColor(live.filter((x) => x.ray.kind !== 'ribbon' || x.ray.orbit >= 0))) {
          brush.set(ray.brush, ray.color, ray.w);
          brush.noFill();
          brush.spline(pts, 0.5);
        }
      });
      R.layer(L);
    }

    // ---- flash + core glow + sparks
    if (tb > -0.05 && lt < T.curl1 + 4) {
      const f = Math.exp(-Math.max(0, tb) * 11);
      R.glow(CX, CY, 40 + 240 * (1 - Math.exp(-Math.max(0, tb) * 12)), [1, 0.9, 0.74], 2.6 * f, { shape: [2.4, 0.5, 2.2], ext: 5 });
      // shock ring racing outward
      if (tb > 0 && tb < 0.9) {
        const rr = 60 + 1500 * ease.outCubic(tb / 0.9);
        const k = 1 - tb / 0.9;
        const pts = [];
        for (let i = 0; i < 420; i++) {
          const a = (i / 420) * TAU + 0.01 * Math.sin(i * 12.9898);
          const jr = rr * (1 + 0.025 * Math.sin(i * 78.233) - 0.04 * Math.abs(Math.sin(i * 3.7)) * (1 - k));
          pts.push([CX + Math.cos(a) * jr, CY + Math.sin(a) * jr * 0.98, 3.5 * k + 1, 0, 1, 0.86, 0.66, 0.4 * k * (0.6 + 0.4 * Math.abs(Math.sin(i * 5.1)))]);
        }
        R.particles(pts, { kind: 'glow', blend: 'add' });
      }
      const core = lerp(1, 0.0, smoothstep(T.curl0, T.curl1 - 0.3, lt));
      if (core > 0) R.glow(CX, CY, 55 * core + 8, [1, 0.8, 0.55], 1.25 * core * Math.min(1, 0.35 + 0.65 * Math.exp(-tb * 0.9)), { shape: [2.2, 0.35, 2.5], ext: 4 });
      const sp = [];
      for (const s of A.sparks) {
        const t = tb - s.d;
        if (t <= 0 || t > s.life) continue;
        const d = s.v * (1 - Math.exp(-t * 1.6)) / 1.6 * 1.9;
        const life = 1 - t / s.life;
        const col = hex(mixHex(mixHex('#fff4d6', '#ffb35c', clamp(t * 0.9)), '#d8452f', clamp(t * 0.5 - 0.3)));
        const x = CX + Math.cos(s.a) * d, y = CY + Math.sin(s.a) * d * 0.98;
        sp.push([x, y, s.s * (0.6 + life), 0, col[0], col[1], col[2], life * life * 1.2]);
      }
      if (sp.length) R.particles(sp, { kind: 'glow', blend: 'add' });
    }

    // ---- atom → nebula → galaxy → dive
    if (lt >= T2.unspool) {
      A._diveTarget = diveTarget();
      A._diveNow = lt > T2.dive0 ? diveS(lt, A._diveTarget) : M.id();
      A._Sfinal = diveS(T2.end, A._diveTarget);
      GAL.draw(R, lt, A, (R2, l) => this.drawAtom(R2, l, A));
    } else if (lt > T.curl0) {
      this.drawAtom(R, lt, A);
    }
  },

  drawAtom(R, lt, A) {
    const build = smoothstep(T.curl0 + 0.4, T.curl1, lt);
    const spin = lt * 0.35;
    const cs = Math.cos(spin), sn = Math.sin(spin), tiltX = 0.4;
    const unspool = lt >= T2.unspool;
    // --- orbits: full rings (7.5–12.5) as back/front brush strokes
    const orbitLayer = (front) =>
      R.dyn(front ? 'orbitsFront' : 'orbitsBack', R.key(30), (c) => {
        const { brush } = c;
        for (let k = 0; k < NE; k++) {
          const f = orbitFn(k, lt);
          let seg = [];
          const flush = () => {
            if (seg.length > 2) {
              brush.set('orbit', ORBITS[k].color, ORBITS[k].w);
              brush.spline(seg, 0.4);
            }
            seg = [];
          };
          for (let i = 0; i <= 120; i++) {
            const th = (i / 120) * TAU;
            const [x, y, z] = f(th);
            if ((z >= 0) === front) seg.push([x, y, 1]);
            else flush();
          }
          flush();
        }
      });
    const ringsOn = lt >= T.curl1 && !unspool;
    if (ringsOn) R.layer(orbitLayer(false));
    // --- stippled electron cloud (condenses as the orbits close; disperses as they unspool)
    const ec = smoothstep(T.curl1 - 0.8, T.curl1 + 1.2, lt) * (1 - smoothstep(T2.unspool, T2.unspool + 1.2, lt));
    if (ec > 0) R.layer(A.ecloud, M.chain(M.translate(CX, CY), M.rotate(lt * 0.05), M.scale(0.9 + 0.1 * ec), M.translate(-500, -500)), { opacity: 0.55 * ec, blend: 'screen' });
    // --- electrons behind the nucleus
    const drawE = (front) => {
      for (let k = 0; k < NE; k++) {
        const p = unspool ? electronPath(k, lt) : electronPos(k, lt);
        if (!p) continue;
        const z = lt >= T.curl1 ? (p[2] ?? 1) : 1;
        if ((z >= 0) !== front) continue;
        const grow = smoothstep(T.curl0 + 0.8, T.curl1 - 0.2, lt);
        const sz = 30 * grow * (1 + 0.12 * (z / 330));
        if (sz <= 0.5) continue;
        R.glow(p[0], p[1], 16 * grow, [1, 0.72, 0.4], 0.9 * grow, { ext: 4 });
        A.electron.draw(R, 0, p[0], p[1], (sz * 80) / 60);
      }
    };
    drawE(false);
    // --- nucleus: nucleons sorted by depth; from 12.8 s they fall together and ignite
    const contract = lerp(1, 0.12, prog(lt, T2.unspool + 0.3, T2.ignite, ease.inQuad));
    const shrink = 1 - prog(lt, T2.ignite - 0.9, T2.ignite + 0.2, ease.inCubic);
    const heat = prog(lt, T2.unspool + 0.3, T2.ignite, ease.inQuad);
    if (shrink > 0) {
      const items = NUC.map((n, i) => {
        const x = n.x * cs + n.z * sn, z0 = -n.x * sn + n.z * cs;
        const y = n.y * Math.cos(tiltX) - z0 * Math.sin(tiltX), z = n.y * Math.sin(tiltX) + z0 * Math.cos(tiltX);
        return { n, i, x: x * contract, y: y * contract, z };
      }).sort((a, b) => a.z - b.z);
      // Flat sprites sorted by depth would swap order in a single frame when two overlapping nucleons pass
      // the same depth (a visible pop / z-fight). Instead the order cross-fades over a small depth band:
      // right after drawing a nucleon, any slightly-farther overlapping neighbour is redrawn on top with an
      // opacity that falls from 1 (equal depth) to 0 (EPS nearer), so the covering slides continuously.
      const EPS = 9;
      const drawn = [];
      for (const it of items) {
        const g = ease.outBack(clamp(invLerp(T.curl0 + 0.3 + it.n.delay * 0.6, T.curl0 + 1.1 + it.n.delay * 0.6, lt)));
        if (g <= 0) continue;
        const persp = 1 + it.z / 400;
        const size = 64 * g * persp * shrink;
        const d = {
          it, x: CX + it.x * persp, y: CY + it.y * persp, s: (size * 120) / 100, size,
          sprite: (it.n.proton ? 0 : 4) + it.n.v,
          shade: (0.78 + 0.22 * ((it.z + 27) / 54)) * (1 + 0.6 * heat),
        };
        A.nucleons.draw(R, d.sprite, d.x, d.y, d.s, it.i * 0.7, { grade: [1, d.shade, 1] });
        for (const q of drawn) {
          const dz = it.z - q.it.z;
          if (dz >= EPS || Math.hypot(d.x - q.x, d.y - q.y) > (d.size + q.size) * 0.5) continue;
          const a = 1 - smoothstep(0, EPS, dz);
          if (a > 0.003) A.nucleons.draw(R, q.sprite, q.x, q.y, q.s, q.it.i * 0.7, { grade: [1, q.shade, 1], opacity: a });
        }
        drawn.push(d);
      }
    }
    // --- unspooling orbit trails (screen-space brush strokes)
    if (unspool) {
      const view = R.view;
      const L = R.dyn('trails', R.key(30), (c) => {
        const { brush } = c;
        brush.noFill();
        for (let k = 0; k < NE; k++) {
          const W = lerp(PERIOD[k], 0.42, prog(lt, T2.unspool, T2.release[k] + 0.7, ease.inOutSine));
          const N = 72, pts = [];
          for (let j = 0; j <= N; j++) {
            const tau = lt - W * (1 - j / N);
            const p = electronPath(k, tau);
            const q = M.apply(view, p[0], p[1]);
            pts.push([q[0], q[1], lerp(0.25, 1.1, Math.pow(j / N, 0.7))]);
          }
          brush.set('orbit', ORBITS[k].color, ORBITS[k].w * M.scaleOf(view) * 1.1);
          brush.spline(pts, 0.45);
        }
      });
      R.push(M.inv(view));
      R.layer(L);
      R.pop();
    }
    if (ringsOn) R.layer(orbitLayer(true));
    drawE(true);
    // warm light around the nucleus (heats up as it collapses into a star)
    R.glow(CX, CY, 95, [1, 0.62, 0.3], 0.16 * build + 0.9 * heat, { ext: 4, shape: [1.2, 0.5, 1.5] });
  },
};
