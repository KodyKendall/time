// EARTH (30 – 52.5 s): PIVOT.star swells into the young Sun; a protoplanetary disk of brush strokes
// spirals around it and clumps into planets; we push in on the molten third planet, descend through
// its cooling skies to a primordial night ocean under a huge young Moon; a great wave curls over the
// camera and the foam's bubbles become living cells (= PIVOT.cell).
import { PIVOT } from '../pivots.js';
import { C, M, hex, lerp, clamp, smoothstep, smoother, win, DUR, T } from './common.js';
import { earthBrushes } from './brushes.js';
import { paintSpace, drawSpace, drawEarthEvents, meteorImpact } from './space.js';
import { paintPlanet, drawEarth } from './planet.js';
import { planetCircle, skyDrop, paintSea, paintRain, HORIZON, paintCloudDeck, drawCloudDeck } from './descent.js';
import { paintOcean, drawNightSky, drawOceanSky, drawStacks, moonState } from './ocean.js';
import { W8, diveView, paintWaveMask, paintWaveFoam, waveLight, waveGeom } from './wave.js';
import { paintUnder, drawUnder, drawMedium, drawSurfaceBand } from './under.js';

const DESCENT = 10.6; // the 2D planet circle takes over from here
const ap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

function drawOceanWorld(R, A, lt, AS, AC) {
  const circ = planetCircle(lt);
  const drop = skyDrop(lt);
  const dv = diveView(lt);
  const V = dv.m, Z = dv.z;
  const cT = (() => { const p = ap(V, [circ.x, circ.y]); const r = circ.r * Z; return { x: p[0], y: p[1], r, top: p[1] - r }; })();
  const t = R.t;
  // sky: stars, painted sky tiles, the setting Sun (sinks behind the limb)
  R.push(V);
  const { sun } = drawSpace(R, A, lt, AS, { drop, earthCircle: null });
  R.pop();
  drawNightSky(R, A, lt, cT);
  if (lt > 11.5) {
    R.push(V);
    drawOceanSky(R, A, lt, circ);
    R.pop();
  }
  // the planet: lava cools, crust darkens, the surface becomes the night sea
  const phaseAt = (x) => lerp(lerp(1.15, 2.35, smoother(9.2, 11.0, x)), 2.95, smoother(11.0, 12.8, x));
  const phase = phaseAt(lt);
  const cool = smoother(10.2, 12.6, lt);
  const wet = smoother(11.8, 13.4, lt);
  drawEarth(R, A, lt, { ...cT, m: 1, sun: { x: sun.x, y: sun.y } }, { phase, cool, wet, phaseAt });
  if (lt < 12.3) drawEarthEvents(R, lt, cT);
  // the sea is laid down stroke by stroke
  const seaK = smoother(12.0, 13.6, lt);
  if (seaK > 0) {
    const key = R.key(30);
    const m = moonState(lt);
    const mx = ap(V, [m.x, m.y])[0];
    R.layer(R.dyn('sea', key, (c) => paintSea(c, cT, lt, t, { k: seaK, key, moonX: mx, glitter: smoothstep(0.1, 0.8, m.rise) * (1 - dv.u) })));
    if (m.rise > 0) R.with(V, () => R.glow(m.x, HORIZON + 160, 260, [0.75, 0.82, 0.95], 0.12 * m.rise, { shape: [0.5, 0.5, 2], sx: 0.7, sy: 1.8, ext: 2 }));
  }
  // sea stacks rise past the horizon on the left as we reach the water
  if (lt > 12.9) R.with(V, () => drawStacks(R, A, lt, circ));
  // storm clouds condense over the cooling planet, then we descend through them
  drawCloudDeck(R, A, lt, cT);
  // rain, lightning in the cloud deck
  const rain = win(lt, 11.5, 12.3, 13.4, 14.2);
  if (rain > 0.01) {
    const key = R.key(12);
    R.layer(R.dyn('rain', key, (c) => paintRain(c, lt, t, rain, key)), M.id(), { opacity: clamp(rain * 1.2) });
  }
  for (const [tl, x] of [[11.875, 1300], [12.5, 640], [13.125, 1520]]) {
    const f = lt > tl ? Math.exp(-(lt - tl) * 14) * (0.6 + 0.4 * Math.sin((lt - tl) * 90)) : 0;
    if (f > 0.01) R.glow(x, Math.max(circ.top + 120, 300), 320, [0.75, 0.8, 1], 0.55 * f, { shape: [0.8, 0.6, 2], ext: 2 });
  }
  // the great wave: its water is the living medium (night-graded), foam painted per frame
  if (lt > W8.rise0) {
    const key = R.key(30);
    const maskL = R.dyn('waveMask', key, (c) => paintWaveMask(c, lt));
    const mask = { type: 'texture', layer: maskL, m: M.id(), threshold: 0.5, softness: 0.12 };
    drawMedium(R, AC, lt, mask, smoothstep(15, 220, waveGeom(lt).H));
    if (lt > 19.6) drawSurfaceBand(R, A, lt, mask);
    waveLight(R, lt, mask);
    R.layer(R.dyn('waveFoam', key, (c) => paintWaveFoam(c, lt, key)));
  }
}

export const scene = {
  id: 'earth',
  bg: C.night,
  deps: [PIVOT.star, PIVOT.cell],
  paint(P) {
    earthBrushes(P.brush);
    return { ...paintSpace(P), ...paintPlanet(P), ...paintOcean(P), ...paintUnder(P), cloudBanks: paintCloudDeck(P) };
  },
  draw(R, lt, A) {
    // exact hand-off frames
    if (lt <= 0) return R.drawScene(PIVOT.star, 0);
    if (lt >= DUR - 1e-4) return R.drawScene(PIVOT.cell, 0);
    const AS = R.engine.ensure(PIVOT.star);
    const AC = R.engine.ensure(PIVOT.cell);
    if (lt < DESCENT) {
      R.fill(hex(C.night));
      drawSpace(R, A, lt, AS);
      return;
    }
    if (lt < 20.06) {
      R.fill(hex(C.night));
      drawOceanWorld(R, A, lt, AS, AC);
    } else {
      R.fill(hex(C.teal));
      drawMedium(R, AC, lt);
    }
    if (lt > 19.6) drawUnder(R, A, AC, lt);
    // the crash: a white-green flash of churned water
    const cf = win(lt, 19.55, 19.78, 19.82, 20.3);
    if (cf > 0) R.glow(960, 470, 900, [0.75, 0.95, 0.92], 0.22 * cf, { shape: [0.35, 0.6, 1.5], sx: 1.5, ext: 2 });
  },
  post(lt) {
    // engine defaults at both hand-offs; brief exposure punches for the impact and the crash
    if (lt < 0.6 || lt > DUR - 0.6) return {};
    const hit = meteorImpact(lt);
    const crash = win(lt, 19.6, 19.78, 19.84, 20.4);
    return { exposure: 1 + 0.22 * hit + 0.05 * crash, bloom: 0.9 + 0.35 * hit };
  },
  // extra motion-blur samples where things move fast in screen space (approach streaks, bolides, the crash)
  blur(lt) {
    if (lt > 1.0 && lt < 3.0) return 3;
    if (lt > 8.2 && lt < 10.15) return 3;
    if (lt > 19.3 && lt < 20.1) return 4;
    return 1;
  },
};
