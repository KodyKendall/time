// CITY — asset viewer film (dev only): shows painted layers, one per second of film time.
//   node tools/cli.mjs still --film scenes/city/viewer --w 1920 --t 0.5 --t 1.5
import { Film } from '../../engine/film.js';
import { M, hex } from '../../engine/math.js';
import { scene as city } from './index.js';

const viewer = {
  id: 'city-viewer',
  bg: '#3a3a40',
  deps: [city],
  paint() { return {}; },
  draw(R, lt) {
    const A = R.engine.ensure(city);
    const list = A.viewList ? A.viewList() : [];
    const i = Math.floor(lt);
    const L = list[i % Math.max(1, list.length)];
    if (!L) return;
    R.fill(hex('#8a8a90'));
    const s = Math.min(1840 / L.w, 1000 / L.h);
    R.layer(L, M.place(960, 540, s, 0, L.w / 2, L.h / 2));
  },
};

export async function buildFilm() {
  return new Film({ fps: 30, duration: 100, shots: [{ id: 'viewer', scene: viewer, start: 0, end: 100 }] });
}
