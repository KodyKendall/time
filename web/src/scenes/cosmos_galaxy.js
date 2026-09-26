// COSMOS part 2 — atom unspools → nebula clouds bloom behind the escaping electrons → gravity
// twirls the band into a spiral galaxy → dive into one star (= PIVOT.star at 30 s).
//
// Geometry pipeline for everything after 12.5 s:
//   world (design units, galaxy centre G) --view (camera + dive zoom)--> screen
//   --twirl(angle(r)) about view(G)--> --disk tilt--> final screen.
// Painted layers get the twirl+tilt as a GPU warp; particles / strokes use makeFwd() on the CPU
// with the exact same formula, so everything moves as one.
import { C } from './lib/palette.js';
import { M, TAU, rng, lerp, clamp, hex, mixHex, smoothstep, starParticles } from './lib/kit.js';
import { ease, invLerp, prog, noise1, viewMatrix } from '../engine/math.js';
import { PIVOT } from './pivots.js';

export const G = [960, 540];
export const T2 = {
  unspool: 8.75,              // bar 3, beat 2
  release: [9.05, 9.45],       // the two electrons fly off
  ignite: 10.0,               // bar 4: the first star — the theme's downbeat
  nebula: 14.5,
  twirl0: 15.0,               // bar 6
  twirl1: 20.0,               // bar 8: the galaxy is complete (IV chord)
  dive0: 27.5,                // bar 11
  end: 30.0,
};
const BETA = -0.42; // nebula band direction (towards upper right)
const UB = [Math.cos(BETA), Math.sin(BETA)], NB = [-Math.sin(BETA), Math.cos(BETA)];
export const TW_R = 1500; // twirl radius (world units)
const TW_FALL = 1.35; // twirl falloff exponent
const DIVE_Z = 40; // total dive magnification

// ---------------------------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------------------------
export function camZoom(lt, z0) {
  if (lt <= T2.unspool) return z0;
  const a = Math.exp(lerp(Math.log(z0), Math.log(0.74), prog(lt, T2.unspool, T2.nebula + 0.5, ease.inOutSine)));
  const b = lerp(1, 0.95, prog(lt, T2.nebula, T2.twirl0, ease.inOutSine));
  const c = Math.exp(lerp(0, Math.log(0.86), prog(lt, T2.twirl0, T2.twirl1, ease.inOutSine)));
  // the galaxy turns in full glory while the camera leans slowly in, building toward the dive
  const d = lerp(1, 1.07, prog(lt, T2.twirl1 + 0.5, T2.dive0, ease.inOutSine));
  return a * b * c * d;
}
function integrate(rate, t0, t1, steps = 240) {
  if (t1 <= t0) return 0;
  const h = (t1 - t0) / steps;
  let s = 0;
  for (let i = 0; i < steps; i++) s += rate(t0 + (i + 0.5) * h) * h;
  return s;
}
// The camera starts turning while the nebula's stars ignite (so the nebula never sits still); the rate
// is set so the total turn by the dive is unchanged (0.744 rad), keeping the galaxy composition.
const ROT0 = T2.nebula - 2;
const rotRate = (t) => 0.0586 * smoothstep(ROT0, T2.nebula + 1, t) * (1 - smoothstep(T2.dive0 - 1.6, T2.dive0, t));
export function camRot(lt) {
  return integrate(rotRate, ROT0, Math.min(lt, T2.dive0));
}
const twirlRate = (t) => 0.12 * smoothstep(T2.twirl1 - 0.5, T2.twirl1 + 0.5, t) * (1 - smoothstep(T2.dive0 - 1.6, T2.dive0, t));
export function twirlAngle(lt) {
  // gravity takes hold gently before the main twirl (13.25 →), reaching the same 4.4 rad at twirl1
  const w = 0.12 * prog(lt, T2.twirl0 - 1.75, T2.twirl0 + 0.5, ease.inOutSine) + 0.88 * prog(lt, T2.twirl0, T2.twirl1, ease.inOutCubic);
  return 4.4 * w + integrate(twirlRate, T2.twirl1 - 0.5, Math.min(lt, T2.dive0), 120);
}
export function tilt(lt) {
  return { cosi: lerp(1, 0.58, prog(lt, T2.twirl0 + 0.8, T2.twirl1 + 1, ease.inOutSine)), phi: -0.3 };
}
export function diveS(lt, target) {
  const u = invLerp(T2.dive0, T2.end, lt);
  if (u <= 0) return M.id();
  const z = Math.exp(lerp(0, Math.log(DIVE_Z), ease.inOutCubic(u)));
  const su = ease.inOutSine(clamp(u * 1.25));
  return viewMatrix(target, [lerp(target[0], 960, su), lerp(target[1], 540, su)], z, 0);
}

// Twirl + tilt forward map in screen space (must match compositor WARP_FS twirlInv).
export function makeFwd(c, radius, angle, cosi, phi, fall = TW_FALL) {
  const cp = Math.cos(phi), sp = Math.sin(phi);
  return (x, y) => {
    const dx = x - c[0], dy = y - c[1];
    const r = Math.hypot(dx, dy);
    const th = angle * Math.pow(Math.max(0, 1 - r / radius), fall);
    const ct = Math.cos(th), st = Math.sin(th);
    const ex = ct * dx - st * dy, ey = st * dx + ct * dy;
    const ax = cp * ex + sp * ey, ay = -sp * ex + cp * ey;
    const by = ay * cosi;
    return [c[0] + cp * ax - sp * by, c[1] + sp * ax + cp * by];
  };
}
// Post-twirl position in world units (disk plane, before tilt) at the dive.
function twirlWorld(x, y, angle = twirlAngle(T2.dive0)) {
  const dx = x - G[0], dy = y - G[1];
  const r = Math.hypot(dx, dy);
  const th = angle * Math.pow(Math.max(0, 1 - r / TW_R), TW_FALL);
  return [G[0] + Math.cos(th) * dx - Math.sin(th) * dy, G[1] + Math.sin(th) * dx + Math.cos(th) * dy];
}

// Dive target: perpendicular to the band (the twirl maps it into the gap between the arms).
export const PSTAR_PRE = [G[0] + NB[0] * 700, G[1] + NB[1] * 700];
const PSTAR_POST = twirlWorld(PSTAR_PRE[0], PSTAR_PRE[1]);
const farFromTarget = (x, y, margin) => {
  const q = twirlWorld(x, y);
  return Math.hypot(q[0] - PSTAR_POST[0], q[1] - PSTAR_POST[1]) > margin && Math.hypot(x - PSTAR_PRE[0], y - PSTAR_PRE[1]) > margin;
};

// ---------------------------------------------------------------------------------------------
// Nebula clouds: painted watercolor sprites that bloom where the electron streams pass
// ---------------------------------------------------------------------------------------------
const FAM = {
  ember: { base: C.rust, mid: [C.orange, C.vermilion, '#e0553a'], hi: [C.amber, C.gold], line: '#ffd9a8' },
  plum: { base: C.purple, mid: [C.plum, C.magenta], hi: [C.rose, '#c77ca8'], line: '#e6c9e0' },
  teal: { base: C.deepTeal, mid: [C.teal, C.sea], hi: [C.cyan, C.aqua], line: '#c9f1ea' },
  rose: { base: C.magenta, mid: [C.rose, '#e88a7a'], hi: [C.cream, C.sand], line: '#fff0e0' },
};
const CW = 720, CH = 480; // cloud sprite canvas (design units)
const CLOUDS = (() => {
  const r = rng('nebula-clouds-v2');
  const plan = [
    ...Array(5).fill(['plum', 1.25]), ...Array(3).fill(['teal', 1.15]), ...Array(10).fill(['ember', 1.0]), ...Array(5).fill(['rose', 0.7]),
  ];
  const out = [];
  plan.forEach(([fam, size], i) => {
    let s, lat, x, y, tries = 0;
    const sc = size * r(0.75, 1.15);
    do {
      s = lerp(-1080, 1080, (i + r(0.1, 0.9)) / 23) + r(-120, 120);
      lat = r.gauss(0, 110 + Math.abs(s) * 0.05);
      x = G[0] + UB[0] * s + NB[0] * lat;
      y = G[1] + UB[1] * s + NB[1] * lat;
      tries++;
    } while (!farFromTarget(x, y, 280 * sc + 90) && tries < 80);
    out.push({
      i, fam, x, y, s, lat, sc,
      rot: BETA + r(-0.35, 0.35),
      birth: T2.release[0] + 0.3 + Math.abs(s) / 700 + r(0, 0.6),
      spin: r(-0.025, 0.025), drift: r(8, 22),
      seed: `cloud-${i}`,
    });
  });
  // draw order: big dark families behind
  const order = { plum: 0, teal: 1, ember: 2, rose: 3 };
  return out.sort((a, b) => order[a.fam] - order[b.fam] || b.sc - a.sc);
})();
function paintCloud(c, fam) {
  const F = FAM[fam];
  const r = c.r;
  const cx = CW / 2, cy = CH / 2;
  // a cumulus of lobes
  const lobes = Array.from({ length: r.int(4, 6) }, () => ({ x: cx + r(-150, 150), y: cy + r(-70, 70), rx: r(90, 170), ry: r(60, 110) }));
  for (const L of lobes) c.fillPoly(c.blob(L.x, L.y, L.rx, L.ry, { wobble: 0.22, rot: r(-0.4, 0.4) }), F.base, { opacity: 70, bleed: 0.16, texture: 0.85, border: 0.35 });
  for (const L of lobes.slice(0, 4)) c.fillPoly(c.blob(L.x + r(-20, 20), L.y + r(-20, 20), L.rx * 0.78, L.ry * 0.74, { wobble: 0.25, rot: r(-0.4, 0.4) }), r.pick(F.mid), { opacity: 95, bleed: 0.12, texture: 0.8, border: 0.4 });
  for (const L of lobes.slice(0, 3)) c.fillPoly(c.blob(L.x + r(-30, 30), L.y - L.ry * 0.25, L.rx * 0.42, L.ry * 0.36, { wobble: 0.3 }), r.pick(F.hi), { opacity: 85, bleed: 0.1, texture: 0.7, border: 0.3 });
  // contour lines (engraving texture): a few calm, open arcs tinted by the cloud
  for (const L of lobes.slice(0, 3)) {
    for (let k = 0; k < 2; k++) {
      const pts = c.blob(L.x, L.y, L.rx * (0.82 - k * 0.22), L.ry * (0.82 - k * 0.22), { n: 44, wobble: 0.12 });
      const a0 = r.int(0, 43), len = r.int(18, 30);
      const arc = [];
      for (let j = 0; j < len; j++) arc.push(pts[(a0 + j) % pts.length]);
      c.strokePath(arc, 'wire', mixHex(F.line, r.pick(F.mid), 0.35), 0.5, 0.6);
    }
  }
  // stipple + dry streaks
  for (let k = 0; k < 4; k++) {
    const a = r(-0.4, 0.4), x = cx + r(-200, 120), y = cy + r(-60, 60);
    c.line(x, y, x + Math.cos(a) * r(120, 260), y + Math.sin(a) * r(120, 260) * 0.3, 'dust', r.pick([F.line, C.cream]), 0.8);
  }
  for (let k = 0; k < 5; k++) {
    const x = cx + r(-220, 180), y = cy + r(-80, 80), pts = [];
    for (let j = 0; j < 5; j++) pts.push([x + j * 40, y + 6 * Math.sin(j + k)]);
    c.strokePath(pts, 'dry', r.pick(F.mid), 0.5, 0.5);
  }
}

// ---------------------------------------------------------------------------------------------
// Electrons leave their orbits and stream outward along the band
// ---------------------------------------------------------------------------------------------
function flightPos(k, t, releaseState) {
  const tr = T2.release[k];
  const { p, v } = releaseState(k);
  const dt = t - tr;
  const sign = k === 1 ? -1 : 1;
  const dir = [UB[0] * sign, UB[1] * sign];
  let x = p[0], y = p[1];
  const steps = Math.max(2, Math.ceil(dt * 40));
  for (let i = 1; i <= steps; i++) {
    const tt = (dt * i) / steps;
    const tn = 1 - Math.exp(-tt * 2.0);
    const ux = lerp(v[0], dir[0], tn), uy = lerp(v[1], dir[1], tn);
    const un = Math.hypot(ux, uy) || 1;
    const sp = 280 + 560 * tt;
    const wig = 0.3 * Math.sin(tt * 2.2 + k * 2);
    const cw = Math.cos(wig), sw = Math.sin(wig);
    x += ((ux / un) * cw - (uy / un) * sw) * sp * (dt / steps);
    y += ((ux / un) * sw + (uy / un) * cw) * sp * (dt / steps);
  }
  return [x, y, 1];
}

export function makeGalaxyPart(deps) {
  const { electronPos } = deps;
  const relCache = {};
  const releaseState = (k) => {
    if (relCache[k]) return relCache[k];
    const tr = T2.release[k];
    const a = electronPos(k, tr), b = electronPos(k, tr + 0.01);
    const v = [(b[0] - a[0]) / 0.01, (b[1] - a[1]) / 0.01];
    const n = Math.hypot(v[0], v[1]) || 1;
    return (relCache[k] = { p: a, v: [v[0] / n, v[1] / n] });
  };

  return {
    flightPos: (k, t) => flightPos(k, t, releaseState),

    paint(P) {
      const clouds = CLOUDS.map((cl) => ({ ...cl, L: P.layer(cl.seed, { w: CW, h: CH, scale: 0.85, seed: cl.seed }, (c) => paintCloud(c, cl.fam)) }));
      const bulge = P.layer('bulge', { w: 800, h: 800, scale: 0.6 }, (c) => {
        const rings = [[380, C.plum, 30], [300, C.orange, 45], [220, C.amber, 70], [150, C.gold, 110], [90, '#fff0c8', 160], [45, C.white, 220]];
        for (const [rad, col, op] of rings) c.fillPoly(c.blob(400, 400, rad, rad, { n: 64, wobble: 0.06 }), col, { opacity: op, bleed: 0.12, texture: 0.6, border: 0.15 });
      });
      // star / gas particles (pre-twirl world coords)
      const r = rng('galaxy-particles-v2');
      const parts = [];
      while (parts.length < 5600) {
        let x, y, birth;
        if (r() < 0.62) {
          const s = r.gauss(0, 560), lat = r.gauss(0, 130 + Math.abs(s) * 0.18);
          x = G[0] + UB[0] * s + NB[0] * lat;
          y = G[1] + UB[1] * s + NB[1] * lat;
          birth = T2.release[0] + 0.6 + Math.abs(s) / 650 + r(0, 1.5);
        } else {
          const a = r(0, TAU), d = Math.pow(r(), 0.65) * 1350;
          x = G[0] + Math.cos(a) * d;
          y = G[1] + Math.sin(a) * d;
          birth = T2.twirl0 + r(0, 4);
        }
        // arm material keeps clear of the Sun; the diffuse disk surrounds it (it lives inside the galaxy)
        if (!farFromTarget(x, y, r() < 0.62 ? 130 : 38)) continue;
        const warm = r() < 0.55;
        const col = hex(warm ? mixHex('#ffd9a8', '#ff9f6b', r()) : mixHex('#fff6e8', '#bcd6ff', r()));
        parts.push({ x, y, sz: 0.7 + Math.pow(r(), 4) * 3.2, b: r(0.3, 1), col, birth, ph: r(0, TAU), f: r(0.6, 2.4) });
      }
      // The Sun sits where ours does in the Milky Way: about halfway out, between two major arms, on the
      // inner edge of a minor spur (our "Orion Spur"). A short radial streak before the twirl winds into a
      // spur segment exactly like the arms do.
      {
        const rs = rng('orion-spur');
        const a0 = Math.atan2(NB[1], NB[0]) + 0.07;
        for (let k = 0; k < 650; k++) {
          const d = lerp(430, 1000, Math.pow(rs(), 0.9)), a = a0 + rs.gauss(0, 0.025 + 12 / d);
          const x = G[0] + Math.cos(a) * d, y = G[1] + Math.sin(a) * d;
          if (!farFromTarget(x, y, 30)) continue;
          const warm = rs() < 0.45;
          const col = hex(warm ? mixHex('#ffd9a8', '#ff9f6b', rs()) : mixHex('#fff6e8', '#bcd6ff', rs()));
          parts.push({ x, y, sz: 0.6 + Math.pow(rs(), 5) * 2.6, b: rs(0.35, 0.95), col, birth: T2.twirl0 + 0.5 + rs(0, 3.5), ph: rs(0, TAU), f: rs(0.6, 2.4) });
        }
      }
      // galaxy arcs (pre-twirl circles around G, along the band)
      const arcs = [];
      const rr = rng('galaxy-arcs-v2');
      while (arcs.length < 240) {
        const sgn = rr() < 0.5 ? 1 : -1;
        const rad = Math.pow(rr(), 0.75) * 1150 + 70;
        const a0 = Math.atan2(UB[1] * sgn, UB[0] * sgn) + rr.gauss(0, 0.2 + 70 / rad);
        const len = rr(0.1, 0.45) * (rad < 300 ? 1.6 : 1);
        let ok = true;
        for (let k = 0; k <= 8 && ok; k++) {
          const a = a0 - len / 2 + (len * k) / 8;
          ok = farFromTarget(G[0] + Math.cos(a) * rad, G[1] + Math.sin(a) * rad, 150);
        }
        if (!ok) continue;
        arcs.push({ rad, a0, len, col: rr.pick([C.rust, C.orange, C.rose, C.cream, C.plum, C.amber, '#c96a4a']), w: rr(0.7, 1.9), brush: rr() < 0.6 ? 'wire' : 'ink', birth: T2.twirl0 + 0.5 + rr(0, 3.2) + (1 - rad / 1220) * 0.8 });
      }
      // the Sun's spur: finer, cooler strokes winding past it (between the two major arms)
      const rsp = rng('orion-spur-arcs');
      const aSpur = Math.atan2(NB[1], NB[0]);
      for (let n = 0, tries = 0; n < 46 && tries < 400; tries++) {
        const rad = lerp(430, 1000, rsp());
        const a0 = aSpur + 0.05 + rsp.gauss(0, 0.05 + 20 / rad);
        const len = rsp(0.08, 0.22);
        let ok = true;
        for (let k = 0; k <= 8 && ok; k++) {
          const a = a0 - len / 2 + (len * k) / 8;
          ok = farFromTarget(G[0] + Math.cos(a) * rad, G[1] + Math.sin(a) * rad, 42);
        }
        if (!ok) continue;
        n++;
        arcs.push({ rad, a0, len, col: rsp.pick([C.cream, C.rose, C.lavender, '#9fb8e0', '#c96a4a']), w: rsp(0.5, 1.2), brush: rsp() < 0.7 ? 'wire' : 'ink', birth: T2.twirl0 + 1.2 + rsp(0, 3) });
      }
      const nstars = [
        { s: -300, lat: 50, t: 11.25, k: 1.0 }, { s: 380, lat: -80, t: 12.5, k: 0.8 }, { s: 120, lat: 140, t: 13.125, k: 0.65 }, { s: -620, lat: -100, t: 13.75, k: 0.6 },
      ].map((q) => ({ ...q, x: G[0] + UB[0] * q.s + NB[0] * q.lat, y: G[1] + UB[1] * q.s + NB[1] * q.lat }));
      // tiny painted background galaxies (atlas of 6)
      const farGal = P.layer('farGalaxies', { w: 1200, h: 200, scale: 1 }, (c) => {
        const r = c.r;
        for (let i = 0; i < 6; i++) {
          const cx = 100 + i * 200, cy = 100;
          const ry = r(0.3, 0.85), rot = r(0, 3);
          c.fillPoly(c.blob(cx, cy, 70, 70 * ry, { rot, wobble: 0.1 }), r.pick([C.plum, C.purple, C.blue, C.rust]), { opacity: 60, bleed: 0.15, texture: 0.8, border: 0.1 });
          for (let k = 0; k < 14; k++) {
            const a0 = r(0, 6.28), rad = r(12, 70), pts = [];
            for (let j = 0; j < 6; j++) {
              const a = a0 + j * 0.28, rr = rad * (1 - j * 0.05);
              const x = Math.cos(a) * rr, y = Math.sin(a) * rr * ry;
              pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
            }
            c.strokePath(pts, 'wire', r.pick([C.cream, C.rose, C.amber, C.lavender]), r(0.4, 0.9), 0.6);
          }
          c.fillPoly(c.blob(cx, cy, 12, 12 * ry, { rot }), C.cream, { opacity: 200, bleed: 0.05, texture: 0.3 });
        }
      });
      const fr = rng('far-gal-pos');
      const farGalaxies = [];
      while (farGalaxies.length < 11) {
        const x = fr(-80, 2000), y = fr(-60, 1140);
        if (Math.hypot(x - 960, y - 540) < 420) continue;
        const i = fr.int(0, 5);
        farGalaxies.push({ x, y, s: fr(0.25, 0.7), rot: fr(0, 6.28), a: fr(0.45, 0.85), uv: [i / 6, 0, (i + 1) / 6, 1] });
      }
      const br = rng('galaxy-births');
      const births = [];
      while (births.length < 12) {
        const sAlong = br.gauss(0, 520), lat = br.gauss(0, 150);
        const x = G[0] + UB[0] * sAlong + NB[0] * lat, y = G[1] + UB[1] * sAlong + NB[1] * lat;
        if (!farFromTarget(x, y, 220)) continue;
        births.push({ x, y, t: 20.6 + births.length * 0.55 + br(0, 0.3), k: br(0.35, 0.7) });
      }
      return { clouds, bulge, parts, arcs, nstars, farGal, farGalaxies, births };
    },

    draw(R, lt, A, drawAtomFn) {
      const view = R.view;
      const z = M.scaleOf(view);
      const vr = Math.atan2(view[1], view[0]);
      const c = M.apply(view, G[0], G[1]);
      const ang = twirlAngle(lt);
      const tl = tilt(lt);
      const fwd = makeFwd(c, TW_R * z, ang, tl.cosi, tl.phi + vr);
      const toS = (x, y) => { const s = M.apply(view, x, y); return fwd(s[0], s[1]); };
      const dive = invLerp(T2.dive0, T2.end, lt);
      const onScreen = (x, y, pad) => x > -pad && y > -pad && x < 1920 + pad && y < 1080 + pad;

      // background: void → the night of PIVOT.star
      const nightK = smoothstep(T2.twirl0, T2.end - 0.4, lt);
      if (nightK > 0) {
        const PA0 = R.engine.ensure(PIVOT.star);
        R.fill(hex(C.night), { opacity: nightK });
        R.push(M.inv(view));
        R.layer(PA0.canvas, M.id(), { opacity: nightK });
        R.pop();
      }
      // distant galaxies far behind (weak parallax; they rush outward during the dive)
      if (lt > T2.release[0]) {
        const vis = smoothstep(T2.release[0], T2.nebula, lt);
        const zz = Math.pow(z, 0.12) * Math.pow(1 + dive * (DIVE_Z - 1), 0.55);
        R.push(M.inv(view));
        for (const g of A.farGalaxies) {
          const x = 960 + (g.x - 960) * zz, y = 540 + (g.y - 540) * zz;
          if (!onScreen(x, y, g.s * zz * 80)) continue;
          R.layer(A.farGal, M.place(x, y, g.s * zz, g.rot + vr * 0.3, 100, 100), { opacity: vis * g.a, uv: g.uv, w: 200, h: 200, blend: 'screen' });
        }
        R.pop();
      }

      // ---- nebula clouds bloom, billow, then twirl into the arms
      const billow = { amp: 16 * Math.sqrt(z), freq: 0.0042 / z, time: lt * 0.12 };
      for (const cl of A.clouds) {
        const g = ease.outCubic(clamp((lt - cl.birth) / 2.6));
        if (g <= 0) continue;
        const age = Math.max(0, lt - cl.birth);
        const sc = cl.sc * lerp(0.1, 1, g) * (1 + 0.012 * Math.min(age, 12));
        const px = cl.x + UB[0] * Math.sign(cl.s) * cl.drift * Math.min(age, 12) * 0.08;
        const py = cl.y + UB[1] * Math.sign(cl.s) * cl.drift * Math.min(age, 12) * 0.08;
        // cull if far off screen (conservative: centre + radius)
        const [sx, sy] = toS(px, py);
        if (!onScreen(sx, sy, CW * sc * z * (1 + dive * DIVE_Z))) continue;
        R.layer(cl.L, M.place(px, py, sc, cl.rot + cl.spin * age, CW / 2, CH / 2), {
          warp: { type: 'twirlNoise', cx: c[0], cy: c[1], radius: TW_R * z, angle: ang, falloff: TW_FALL, tilt: tl.cosi, tiltRot: tl.phi + vr, ...billow },
        });
      }

      // ---- particles: gas atoms → galaxy stars
      const ps = [];
      // the galaxy's own stars rush past the camera and thin out at the very end of the dive, where the
      // star pivot's own starfield takes over (the Sun's neighbours would otherwise pop at 30 s)
      const passK = 1 - smoothstep(0.72, 0.96, dive);
      for (const p of A.parts) {
        const g = clamp((lt - p.birth) / 1.4) * passK;
        if (g <= 0) continue;
        const [x, y] = toS(p.x, p.y);
        if (!onScreen(x, y, 40)) continue;
        const twk = 0.75 + 0.25 * Math.sin(R.t * p.f * 2 + p.ph);
        ps.push([x, y, p.sz * 2.2 * Math.max(0.6, Math.sqrt(z)) * (1 + dive * 1.5), 0, p.col[0], p.col[1], p.col[2], p.b * g * twk]);
      }
      R.push(M.inv(view));
      R.particles(ps, { kind: 'glow', blend: 'add' });
      R.pop();

      // ---- galaxy core: the first star gathers a glowing bulge
      const gal = smoothstep(T2.twirl0, T2.twirl1, lt);
      if (gal > 0) {
        const [bx, by] = toS(G[0], G[1]);
        const bs = 0.25 + 0.75 * gal;
        if (onScreen(bx, by, 800 * bs * z)) {
          R.push(M.inv(view));
          R.layer(A.bulge, M.chain(M.translate(bx, by), M.rotate(tl.phi + vr), M.scale(bs * z * 0.95, bs * z * 0.95 * tl.cosi), M.translate(-400, -400)), { blend: 'screen', opacity: 0.85 });
          R.pop();
        }
      }

      // ---- galaxy arcs (painted in screen space every frame so they stay crisp at any zoom)
      if (lt > T2.twirl0 + 0.4) {
        const L = R.dyn('arcs', R.key(30), (cc) => {
          const { brush } = cc;
          brush.noFill();
          const byCol = [...A.arcs].sort((a, b) => (a.col < b.col ? -1 : 1));
          for (const a of byCol) {
            const g = ease.outCubic(clamp((lt - a.birth) / 1.6));
            if (g <= 0) continue;
            const pts = [];
            const n = 16, len = a.len * g;
            for (let k = 0; k <= n; k++) {
              const t = a.a0 - len / 2 + (len * k) / n;
              pts.push(toS(G[0] + Math.cos(t) * a.rad, G[1] + Math.sin(t) * a.rad));
            }
            if (pts.every(([x, y]) => !onScreen(x, y, 60))) continue;
            const wScale = Math.max(0.7, Math.sqrt(z / 0.55)) * (1 + dive * 4);
            brush.set(a.brush, a.col, a.w * wScale);
            brush.spline(pts.map((p, i) => [p[0], p[1], Math.sin((i / n) * Math.PI) * 0.8 + 0.3]), 0.5);
          }
        });
        R.push(M.inv(view));
        R.layer(L);
        R.pop();
      }

      // ---- stars ignite inside the nebula
      R.push(M.inv(view));
      for (const s of A.nstars) {
        const g = smoothstep(s.t - 0.1, s.t + 0.5, lt);
        if (g <= 0) continue;
        const flash = Math.exp(-Math.max(0, lt - s.t) * 3) * smoothstep(s.t - 0.1, s.t, lt);
        const [x, y] = toS(s.x, s.y);
        if (!onScreen(x, y, 300)) continue;
        const k = Math.sqrt(z / 0.74) * (1 + dive * 6);
        R.glow(x, y, 7 * s.k * g * k, [1, 0.94, 0.82], 2.2 * g + 3 * flash, { shape: [3, 0.5, 2.5], ext: 6 });
        R.glow(x, y, 44 * s.k * k, [1, 0.65, 0.35], 0.3 * g + 0.7 * flash, { ext: 4 });
      }
      R.pop();

      // ---- new stars flare in the arms while the galaxy turns
      if (lt > T2.twirl1) {
        R.push(M.inv(view));
        for (const b of A.births) {
          if (lt < b.t - 0.05 || lt > b.t + 2.5) continue;
          const g = smoothstep(b.t - 0.05, b.t + 0.2, lt), fl = Math.exp(-Math.max(0, lt - b.t) * 3.5) * g;
          const [x, y] = toS(b.x, b.y);
          if (!onScreen(x, y, 100)) continue;
          const k = Math.sqrt(z / 0.74) * (1 + dive * 6);
          R.glow(x, y, 6 * b.k * k, [1, 0.95, 0.85], 1.2 * g * (1 - smoothstep(b.t + 1.2, b.t + 2.5, lt)) + 3 * fl, { shape: [3, 0.5, 2.5], ext: 6 });
          R.glow(x, y, 36 * b.k * k, [1, 0.7, 0.45], 0.9 * fl, { ext: 4 });
        }
        R.pop();
      }

      // ---- the atom (its nucleus collapses into the first star)
      if (lt < T2.ignite + 0.4) drawAtomFn(R, lt);
      const ig = smoothstep(T2.ignite - 1.0, T2.ignite, lt);
      if (ig > 0) {
        const [x, y] = toS(G[0], G[1]);
        if (onScreen(x, y, 400)) {
          const flare = Math.exp(-Math.max(0, lt - T2.ignite) * 2.8) * smoothstep(T2.ignite - 0.25, T2.ignite, lt);
          const k = Math.sqrt(z / 0.74);
          R.push(M.inv(view));
          R.glow(x, y, (9 + 5 * gal) * k, [1, 0.93, 0.8], 1.9 * ig + 2.5 * flare, { shape: [2.6, 0.5, 2.2], ext: 6 });
          R.glow(x, y, (46 + 60 * gal) * k, [1, 0.7, 0.4], 0.28 * ig + 0.25 * gal + 0.7 * flare, { shape: [1.4, 0.4, 1.6], ext: 4, sy: lerp(1, tl.cosi, gal), rot: tl.phi + vr });
          R.pop();
        }
      }

      // ---- the dive: the target star grows into the pivot star; the pivot's own stars converge
      const PA = R.engine.ensure(PIVOT.star);
      R.push(M.inv(view));
      if (dive > 0) {
        const m = M.mul(A._diveNow, M.inv(A._Sfinal));
        // The pivot's star field grows out of the target star. While it is still a tiny patch it would
        // read as a bright rectangle, so it fades in as it spreads, with soft edges until it is nearly
        // screen-sized; by the last frame it is exactly the pivot's starfield.
        const sc = M.scaleOf(m);
        const fadeIn = smoothstep(0.08, 0.55, sc), edgeOff = smoothstep(0.55, 0.98, sc);
        if (fadeIn > 0) {
          const list = starParticles(PA.stars, R.t, { alpha: 0.55, m });
          for (let i = 0; i < list.length; i++) {
            const st = PA.stars[i];
            const e = Math.min(st.x, 1920 - st.x, st.y, 1080 - st.y);
            list[i][7] *= fadeIn * lerp(smoothstep(0, 260, e), 1, edgeOff);
          }
          R.particles(list, { kind: 'glow', blend: 'add' });
        }
        const [x, y] = M.apply(A._diveNow, A._diveTarget[0], A._diveTarget[1]);
        PIVOT.star.drawStar(R, x, y, lerp(0.3, 1, ease.inOutSine(dive)));
      } else if (lt > T2.twirl1 - 1.5) {
        const [x, y] = toS(PSTAR_PRE[0], PSTAR_PRE[1]);
        PIVOT.star.drawStar(R, x, y, 0.3 * smoothstep(T2.twirl1 - 1.5, T2.twirl1, lt));
      }
      R.pop();
    },
  };
}
