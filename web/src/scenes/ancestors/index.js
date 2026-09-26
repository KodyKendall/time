// ANCESTORS (85 – 97.5 s): PIVOT.ash -> burnt land, a shrew, regrowth, primate, dusk, human, fire,
// sparks become the stars of PIVOT.night.
import { M, lerp, clamp, hex, smoothstep } from '../lib/kit.js';
import { xform } from './brushkit.js';
import { ease } from '../../engine/math.js';
import { PIVOT } from '../pivots.js';
import { T0, DUR, K, planeView } from './timeline.js';
import { paintSky, drawSky, drawSun, drawClouds, drawFlakes, drawStars } from './sky.js';
import { paintLand, GROUND, ROCK, BURROW, FIRE, paintSpread, SPREAD_DONE } from './land.js';
import { paintCreature, solve } from './creature.js';
import { paintFirePit, paintFlames, paintFireSmoke, drawFireLight, fireSize, flicker, fireSparks, strikeSparks, strikeFlash } from './fire.js';
import { creatureAt, figuresAt } from './anim.js';
import { paintProps, drawFlowers, drawBigLeaves, drawButterflies, drawBirds, drawCamp, dustPuffs, fireflies } from './props.js';
import { sparkStarSet, sparkStarParticles } from './sparkstars.js';
import { paintFloraSprites, paintTrunks, paintSmoke, drawEmbers, drawGroundFlora, drawCrowns, drawFerns, paintFarRidge, paintFarTex, FAR_TEX, farColor } from './flora.js';

const PAD = 64;
// Dynamic layer painted once per nominal frame in (padded) screen space of plane k, so it is crisp at
// output resolution; drawn under the plane's view it also follows camera motion blur sub-samples.
function dynPlane(R, name, k, ltN, paint, scale = 1, key = R.key(30)) {
  const VN = planeView(ltN, k);
  const L = R.dyn(name, key, (c) => {
    paint(xform(c, M.mul(M.translate(PAD, PAD), VN)), VN);
  }, { w: 1920 + 2 * PAD, h: 1080 + 2 * PAD, scale });
  return { L, m: M.mul(M.inv(VN), M.translate(-PAD, -PAD)) };
}

// Colour grade for painted sprites / trunks as the light changes (day -> sunset -> night).
function lookAt(lt) {
  const sunset = smoothstep(7.8, 8.8, lt) * (1 - smoothstep(9.0, 9.9, lt));
  const night = smoothstep(8.9, 10.2, lt);
  const tint = [lerp(1, 1.08, sunset), lerp(1, 0.86, sunset), lerp(1, 0.78, sunset)];
  const nt = [0.5, 0.66, 0.92];
  return {
    night,
    nightTint: '#1e3450',
    trunk: '#6f9e86',
    grade: [lerp(1, 0.7, night), lerp(1, 0.62, night), 1],
    tint: [lerp(tint[0], nt[0], night), lerp(tint[1], nt[1], night), lerp(tint[2], nt[2], night)],
  };
}

export const scene = {
  id: 'ancestors',
  bg: '#3a3742',
  deps: [PIVOT.ash, PIVOT.night],

  paint(P) {
    return { ...paintSky(P), land: paintLand(P), spr: paintFloraSprites(P), farTex: paintFarTex(P), pit: paintFirePit(P), props: paintProps(P) };
  },

  view(lt) {
    return planeView(lt, K.ground);
  },

  post(lt) {
    return {};
  },

  draw(R, lt, A) {
    // exact hand-off frames
    if (lt <= 0) { R.drawScene(PIVOT.ash, 0); return; }
    if (lt >= DUR) { R.drawScene(PIVOT.night, 0); return; }
    const ash = R.engine.ensure(PIVOT.ash), night = R.engine.ensure(PIVOT.night);
    const ltN = R.frameT - T0; // nominal frame time (shared by motion-blur sub-samples)
    const V = R.view;
    const plane = (k, fn) => R.with(M.mul(M.inv(V), planeView(lt, k)), fn);
    const look = lookAt(lt);

    // ---------------------------------------------------------------- sky plane
    plane(K.sky, () => {
      drawSky(R, lt, A, ash, night);
      drawStars(R, lt, night, sparkStarSet(night.stars));
      drawSun(R, lt, A);
      drawClouds(R, lt, A, ash);
      drawBirds(R, lt, A.props, look);
    });

    // ---------------------------------------------------------------- far ridge (hills -> canopy -> mountains)
    plane(K.far, () => {
      const d = dynPlane(R, 'far', K.far, ltN, (c) => paintFarRidge(c, ltN));
      R.layer(d.L, d.m);
      const fc = hex(farColor(lt));
      R.layer(A.farTex, M.translate(FAR_TEX.x, FAR_TEX.y), {
        opacity: 0.62, tint: [fc[0] * 2, fc[1] * 2, fc[2] * 2],
        mask: { type: 'texture', layer: d.L, m: M.mul(R.view, d.m), threshold: 0.5, softness: 0.04 },
      });
    });

    // ---------------------------------------------------------------- ground plane
    const G = GROUND, land = A.land;
    const gm = M.translate(G.x, G.y);
    const nightGround = { grade: look.grade, tint: look.tint };
    // the green "spilled paint" front: a per-frame mask while it flows (null = all green, or none yet)
    let spreadMk = null;
    const greenOn = lt > 3.7, spreading = greenOn && lt < SPREAD_DONE;
    if (spreading) {
      const d = dynPlane(R, 'spread', K.ground, ltN, (c) => paintSpread(c, ltN), 0.5);
      spreadMk = (th, sf) => ({ type: 'texture', layer: d.L, m: M.mul(R.view, d.m), threshold: th, softness: sf });
    }
    // draw the burnt version, then the same thing repainted green where the paint has flowed
    const twoState = (burnt, green, m, o = {}) => {
      R.layer(burnt, m, o);
      if (!greenOn) return;
      if (spreading) {
        R.layer(green, m, { ...o, mask: spreadMk(0.18, 0.06), color: [0.1, 0.32, 0.22, 0.55] }); // wet rim
        R.layer(green, m, { ...o, mask: spreadMk(0.62, 0.05) });
      } else R.layer(green, m, o);
    };
    twoState(land.ground.burnt, land.ground.green, gm, nightGround);
    // burrow + rock + logs
    R.layer(land.burrow.back, M.translate(land.burrow.x, land.burrow.y), nightGround);
    twoState(land.rocks.grey, land.rocks.warm, M.translate(ROCK.x - 200, ROCK.y - 100), nightGround);
    land.logs.forEach((lg) => R.layer(lg.layer, M.translate(lg.x0, lg.y0), nightGround));

    // trunks (stumps -> palms), smoke
    const fl = dynPlane(R, 'flora', K.ground, ltN, (c) => {
      paintTrunks(c, ltN, lookAt(ltN));
      paintSmoke(c, ltN, R.frameT);
    });
    R.layer(fl.L, fl.m);
    drawEmbers(R, lt);
    drawCrowns(R, lt, A.spr, look);
    drawGroundFlora(R, lt, A.spr, look);
    drawBigLeaves(R, lt, A.props, look);
    drawFlowers(R, lt, A.props, look);
    drawCamp(R, lt, A.props, look);

    // fire pit (ring of stones + sticks), laid out as the camp appears at dusk
    const pitG = ease.outBack(clamp((lt - 9.15) / 0.45), 1.8);
    if (pitG > 0.01) R.layer(A.pit.L, M.place(FIRE.x, A.pit.y + 96 + 14, lerp(0.7, 1, pitG), 0, 180, 110, pitG), nightGround);

    // the creature — animated on twos: drawing k shows time k/15 and is locked to the world
    const kc = R.key(15), ltK = kc / 15 - T0;
    const cr = creatureAt(ltK), figs = figuresAt(ltK);
    let hand = null;
    if (cr) {
      const light = { fire: [FIRE.x, FIRE.y], fireK: Math.min(1, fireSize(ltK)), flick: flicker(ltK + T0), night: lookAt(ltK).night };
      const d = dynPlane(R, 'creature', K.ground, ltK, (c) => {
        for (const f of figs) paintCreature(c, f.P, f.S, light, kc * 7 + 1);
        paintCreature(c, cr.P, cr.S, light, kc);
      }, 1, kc);
      if (cr.surface === 'burrow') {
        // inside the burrow: hide what is below the rim (the lip sprite covers the curved front)
        const ys = R.toScreen(0, BURROW.y + 12)[1];
        R.layer(d.L, d.m, { mask: { type: 'linear', nx: 0, ny: -1, d0: -ys - 1.5, d1: -ys + 1.5 } });
      } else R.layer(d.L, d.m);
      const J = solve(cr.P, cr.S), h = J.armN[3];
      hand = [cr.P.x + h[0] * cr.P.face, cr.P.y + h[1]];
    }
    // the fire: flames on twos, light, sparks
    if (lt > 9.6) {
      const f = dynPlane(R, 'fire', K.ground, ltK, (c) => { paintFireSmoke(c, ltK, ltK + T0); paintFlames(c, ltK, ltK + T0); }, 1, kc);
      if (fireSize(ltK) > 0.01) R.layer(f.L, f.m);
      drawFireLight(R, lt, R.t);
      const fl = strikeFlash(lt);
      if (fl > 0.01 && hand) R.glow(hand[0], hand[1], 9, [1, 0.85, 0.6], 0.9 * fl, { shape: [2.5, 0.25, 2.5], ext: 3 });
      R.particles(strikeSparks(lt, hand).concat(fireSparks(lt)), { kind: 'glow', blend: 'add' });
    }
    R.layer(land.burrow.lip, M.translate(land.burrow.x, land.burrow.y), nightGround);
    drawButterflies(R, lt, A.props, look);
    const puffs = dustPuffs(lt);
    if (puffs.length) R.particles(puffs, { kind: 'soft' });
    const ff = fireflies(lt);
    if (ff.length) R.particles(ff, { kind: 'glow', blend: 'add' });

    // ---------------------------------------------------------------- near plane
    plane(K.near, () => {
      drawFerns(R, lt, A.spr, look);
    });

    // falling ash
    drawFlakes(R, lt, ash);

    // sparks that become stars (screen space; exactly the pivot's stars once they have landed)
    if (lt > 10.3) R.with(M.inv(R.view), () => R.particles(sparkStarParticles(lt, R.t, night.stars), { kind: 'glow', blend: 'add' }));
  },
};
