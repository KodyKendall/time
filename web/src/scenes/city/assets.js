// CITY — paints every static layer once (cached by the engine).
import { cityBrushes } from './brushes.js';
import { FRONTS, SIDES, STYLES } from './catalog.js';
import { paintFacade, facadeSize, FD, LITC } from './paintFacade.js';
import { paintRoofs, paintChimney, paintEdges, paintHatch, paintNoise, paintAvenue, paintLane, paintRiver, paintLand, paintSky, paintTrack, paintCobbles, paintParapet, paintPath } from './paintCity.js';
import { rng } from '../../engine/math.js';
import { HALL_SPEC } from './catalog.js';
import { paintWalkers, paintBirds, paintLamp, paintTree, paintTram, paintTopSprites, paintPuff } from './paintLife.js';
import { paintDial, paintPlateMasks, paintHands, paintTowerBody, paintClockPanel, paintBelfry, paintCopper, paintGears, paintMovement } from './paintClock.js';
import { lerp, mixHex } from '../lib/kit.js';

// lit windows + light-order mask for a painted facade (same layout, lower resolution)
function litLayers(P, name, meta, sz, seed) {
  const D2 = 1.6;
  const lit = P.layer(name + 'Lit', { w: sz.tw * D2, h: sz.th * D2 }, (c) => {
    const r = c.r;
    const X = (p) => [p[0] * D2, p[1] * D2];
    for (const w of meta.windows) {
      const col = r.pick(LITC);
      const poly = w.arch ? archPts(w.x0, w.y0, w.x1, w.y1) : [[w.x0, w.y0], [w.x1, w.y0], [w.x1, w.y1], [w.x0, w.y1]];
      c.washPoly(poly.map(X), col, 255);
      // warm core and the silhouettes of curtains / people against the light
      const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2;
      c.washPoly(c.blob(cx * D2, cy * D2, (w.x1 - w.x0) * 0.3 * D2, (w.y1 - w.y0) * 0.3 * D2, { n: 14 }), mixHex(col, '#fff6e0', 0.5), 200);
      if (w.curtain) {
        const tie = w.y0 + (w.y1 - w.y0) * 0.65;
        const cc = mixHex(w.curtain, '#6a3018', 0.45);
        c.washPoly([[w.x0, w.y0], [w.x0 + 3.6, w.y0], [w.x0 + 1.2, tie], [w.x0 + 1.8, w.y1], [w.x0, w.y1]].map(X), cc, 220);
        c.washPoly([[w.x1, w.y0], [w.x1 - 3.6, w.y0], [w.x1 - 1.2, tie], [w.x1 - 1.8, w.y1], [w.x1, w.y1]].map(X), cc, 220);
      } else if (w.kind === 'win' && r() < 0.35) {
        const px = r(w.x0 + 3, w.x1 - 3), sil = mixHex(col, '#4a2410', 0.6);
        c.washPoly([[px - 2, w.y1], [px + 2, w.y1], [px + 1.5, w.y1 - 7], [px - 1.5, w.y1 - 7]].map(X), sil, 220);
        c.washPoly(c.blob(px * D2, (w.y1 - 8.8) * D2, 1.5 * D2, 1.8 * D2, { n: 12 }), sil, 220);
      }
    }
    for (const l of meta.lamps) c.washPoly(c.blob(l.x * D2, l.y * D2, 2 * D2, 2.4 * D2, { n: 12 }), '#fff0c0', 255);
  });
  const mask = P.layer(name + 'Mask', { w: sz.tw, h: sz.th, scale: 0.5 }, (c) => {
    const r = rng(name + 'order' + seed);
    for (const w of meta.windows) {
      const always = w.kind === 'shop' || w.kind === 'door' || w.kind === 'fan';
      if (!always && r() < 0.24) continue; // stays dark
      const v = always ? r(0.55, 0.98) : r(0.06, 0.95);
      c.washPoly([[w.x0 - 1.2, w.y0 - 1.2], [w.x1 + 1.2, w.y0 - 1.2], [w.x1 + 1.2, w.y1 + 1.2], [w.x0 - 1.2, w.y1 + 1.2]], '#ffffff', Math.round(v * 255));
    }
    for (const l of meta.lamps) c.washPoly([[l.x - 3, l.y - 3], [l.x + 3, l.y - 3], [l.x + 3, l.y + 3], [l.x - 3, l.y + 3]], '#ffffff', 250);
  });
  return { lit, mask };
}
function archPts(x0, y0, x1, y1, n = 12) {
  const cx = (x0 + x1) / 2, rr = (x1 - x0) / 2, pts = [[x0, y1], [x1, y1], [x1, y0 + rr]];
  for (let i = 1; i < n; i++) { const a = (i / n) * Math.PI; pts.push([cx + Math.cos(a) * rr, y0 + rr - Math.sin(a) * rr]); }
  pts.push([x0, y0 + rr]);
  return pts;
}

function paintBuilding(P, name, spec, i) {
  const sp = { ...spec, style: STYLES[spec.style], seed: i + 1 };
  const sz = facadeSize(sp);
  let meta = null;
  const tex = P.layer(name, { w: sz.tw * FD, h: sz.th * FD }, (c) => { meta = paintFacade(c, sp); });
  const { lit, mask } = litLayers(P, name, meta, sz, i);
  return { tex, lit, mask, meta, sz };
}

export function paintAll(P) {
  cityBrushes(P.brush);
  const T = (name, fn) => { const t = performance.now(); const v = fn(); console.log('paint', name, Math.round(performance.now() - t)); return v; };
  const t0 = performance.now();
  const fronts = FRONTS.map((f, i) => T('front' + i, () => paintBuilding(P, 'front' + i, f, i)));
  const sides = SIDES.map((f, i) => paintBuilding(P, 'side' + i, f, 100 + i));
  const t1 = performance.now();
  const roofs = T('roofs', () => paintRoofs(P));
  const chimney = T('chimney', () => paintChimney(P));
  const edges = T('edges', () => paintEdges(P));
  const hatch = T('hatch', () => paintHatch(P));
  const noise = T('noise', () => paintNoise(P));
  const avenue = T('avenue', () => paintAvenue(P));
  const lane = T('lane', () => paintLane(P));
  const track = T('track', () => paintTrack(P));
  const cobbles = T('cobbles', () => paintCobbles(P));
  const parapet = T('parapet', () => paintParapet(P));
  const path = T('path', () => paintPath(P));
  const t2 = performance.now();
  const river = T('river', () => paintRiver(P));
  const landNear = T('landNear', () => paintLand(P, 'landNear', 2600, 0.32, 16));
  const landFar = T('landFar', () => paintLand(P, 'landFar', 6500, 0.075, 44));
  const sky = T('sky', () => paintSky(P));
  const hall = T('hall', () => paintBuilding(P, 'hall', HALL_SPEC, 200));
  const towerFront = T('towerFront', () => paintTowerBody(P, true));
  const towerSide = T('towerSide', () => paintTowerBody(P, false));
  const clockPanel = T('clockPanel', () => paintClockPanel(P));
  const belfry = T('belfry', () => paintBelfry(P));
  const copper = T('copper', () => paintCopper(P));
  const dial = T('dial', () => paintDial(P));
  const plates = T('plates', () => paintPlateMasks(P));
  const hands = T('hands', () => paintHands(P));
  const gears = T('gears', () => paintGears(P));
  const move = T('movement', () => paintMovement(P));
  const flatTex = P.layer('flat', { w: 8, h: 8 }, (c) => c.washPoly([[-1, -1], [9, -1], [9, 9], [-1, 9]], '#ffffff', 255));
  const walkers = T('walkers', () => paintWalkers(P));
  const birds = T('birds', () => paintBirds(P));
  const lamp = T('lamp', () => paintLamp(P));
  const tree = T('tree', () => paintTree(P));
  const tram = T('tram', () => paintTram(P));
  const tops = T('tops', () => paintTopSprites(P));
  const puff = T('puff', () => paintPuff(P));
  const t3 = performance.now();
  console.log(`city paint: buildings ${Math.round(t1 - t0)} ms, town ${Math.round(t2 - t1)} ms, land/sky ${Math.round(t3 - t2)} ms`);
  const A = { path, parapet, cobbles, track, fronts, sides, roofs, chimney, edges, hatch, noise, avenue, lane, river, landNear, landFar, sky, hall, towerFront, towerSide, clockPanel, belfry, copper, dial, plates, hands, gears, move, flatTex, walkers, birds, lamp, treeSide: tree.side, treeTop: tree.top, tram, cartTop: tops.cart, boatTop: tops.boat, puff };
  A.repeat = [hatch, noise, avenue, lane, track, cobbles, path, ...roofs];
  A.viewList = () => [walkers, birds, lamp, tree.side, tree.top, tram, tops.cart, tops.boat, dial, hands, clockPanel, towerFront, belfry, ...gears, hall.tex, copper, ...fronts.map((f) => f.tex), ...sides.map((f) => f.tex), ...roofs, avenue, lane, river, landNear, sky, fronts[0].lit];
  return A;
}

// REPEAT wrapping for tiling textures (done once, needs the GL context)
export function prepareGL(gl, A) {
  if (A._glReady) return;
  for (const L of A.repeat) {
    gl.bindTexture(gl.TEXTURE_2D, L.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  A._glReady = true;
}
