// CITY (107.5 - 117.5 s): fields -> river -> village -> city -> street -> clock tower -> clockwork gear.
// Starts exactly on PIVOT.fields (top-down crop bands) and ends exactly on PIVOT.gear.
import { C } from '../lib/palette.js';
import { PIVOT } from '../pivots.js';
import { M, lerp, clamp, hex, mixHex } from '../lib/kit.js';
import { ease, smoothstep } from '../../engine/math.js';
import { R3 } from './gl3d.js';
import { camAt, camParams, CLOCK } from './camera.js';
const camTarget = (lt) => camParams(lt).T;
import { BAND, bw, TOWER, HALL, MAIN, GROUND, FLOOR } from './layout.js';
import { paintAll, prepareGL } from './assets.js';
import { lightAt, drawBuildings, drawGround, drawRiver, drawStreets, drawShadows, drawTrack, bridgeItems } from './world.js';
import { SKY } from './paintCity.js';
import { towerItem, hallItem, tickTimes, CLUNK } from './clock.js';
import { lifeItems, drawGroundLife, drawAir } from './life.js';

export const scene = {
  id: 'city',
  bg: '#8a5a3a',
  deps: [PIVOT.fields, PIVOT.gear],
  paint(P) { return paintAll(P); },

  // post: defaults at both hand-offs; a touch more bloom for the lamp-lit evening in between
  post(lt) {
    const k = smoothstep(3.6, 5.0, lt) * (1 - smoothstep(8.4, 9.3, lt));
    if (k <= 0) return {};
    return { bloom: 0.9 + 0.2 * k, vignette: 0.32 + 0.08 * k };
  },

  // camera motion blur: the 3D camera is not the scene view, so measure its screen motion here
  blur(lt) {
    const dt = 0.5 / 30;
    const a = camAt(lt - dt / 2), b = camAt(lt + dt / 2);
    let maxPx = 0;
    for (const [x, y] of [[160, 90], [960, 540], [1760, 90], [160, 990], [1760, 990]]) {
      // world point seen at (x, y) at depth ~ distance to the look-at point
      const dz = Math.max(40, a.depth(...camTarget(lt)));
      const px = (x - a.cx) / a.f * dz, py = (y - a.cy) / a.f * dz;
      const w = [a.pos[0] + a.fwd[0] * dz + a.right[0] * px - a.up[0] * py, a.pos[1] + a.fwd[1] * dz + a.right[1] * px - a.up[1] * py, a.pos[2] + a.fwd[2] * dz - a.up[2] * py];
      const s = b.toScreen(w[0], w[1], w[2]);
      maxPx = Math.max(maxPx, Math.hypot(s[0] - x, s[1] - y) * 2); // 4K pixels
    }
    let n = Math.ceil(maxPx / 6);
    // the clock hands whirl before midnight
    const t = 107.5 + lt;
    if (t > 115.95 && t < 116.4) n = Math.max(n, 8);
    else if (t > 115.25 && t < 116.4) n = Math.max(n, 4);
    return Math.max(1, Math.min(12, n));
  },

  // a small mechanical jolt of the whole picture on each clock tick, bigger on the midnight clunk
  view(lt) {
    const t = 107.5 + lt;
    let dy = 0;
    for (const tk of tickTimes()) {
      if (t < tk || t > tk + 0.5) continue;
      const a = t - tk, big = Math.abs(tk - CLUNK) < 1e-6;
      dy += (big ? 7 : tk > 115.9 ? 1.2 : 2.2) * Math.exp(-a * (big ? 11 : 16)) * Math.sin(a * (big ? 70 : 90));
    }
    return dy ? M.translate(0, dy) : M.id();
  },

  draw(R, lt, A) {
    if (lt <= 0) { R.drawScene(PIVOT.fields, 0); return; }
    const F = R.engine.ensure(PIVOT.fields);
    const gl = R.comp.gl;
    prepareGL(gl, A);
    const cam = camAt(lt);
    const L = lightAt(lt);
    R.fill(hex('#8a5a3a'));
    // ---- sky (only when the horizon is in view)
    const horizonY = cam.cy + cam.f * Math.tan(cam.pitch);
    if (horizonY > -200) {
      const k = (cam.f / 1080) * SKY.K;
      const x = 960 - cam.f * Math.tan(cam.yaw - BAND.yaw);
      R.layer(A.sky, M.place(x, horizonY, k, 0, SKY.w / 2 / SKY.K, SKY.hy / SKY.K));
    }
    // ---- the painted world
    const r3 = R3.get(gl);
    r3.begin(R, cam);
    drawGround(r3, A, F, cam, lt, L);
    drawRiver(r3, A, lt, L);
    drawTrack(r3, A, lt, L);
    drawStreets(r3, A, lt, L);
    drawGroundLife(r3, A, cam, lt, L);
    drawShadows(r3, A, cam, lt, L);
    drawBuildings(r3, A, cam, lt, L, [towerItem(R, r3, A, cam, lt, L), hallItem(r3, A, cam, lt, L), ...lifeItems(r3, A, cam, lt, L), ...bridgeItems(r3, A, cam, lt, L)]);
    r3.flush();
    drawAir(R, r3, A, cam, lt, L);
    r3.end();
  },
};

