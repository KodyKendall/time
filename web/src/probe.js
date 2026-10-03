import { Film } from './engine/film.js';
import { M, fbm1 } from './engine/math.js';
const scene = {
  id: 'probe', bg: '#0b1024',
  paint(P) {
    const A = {};
    A.a = P.layer('a', { w: 2200, h: 380, seed: 'a' }, (c) => {
      const pts = [[0, 380]];
      for (let x = 0; x <= 2200; x += 22) pts.push([x, 246 + 62 * fbm1(x * 0.0042, 5, 4)]);
      pts.push([2200, 380]);
      c.fillPoly(pts, '#000000', { opacity: 165, bleed: 0.04, texture: 0.45, border: 0.25 });
      c.flush();
    });
    A.b = P.layer('b', { w: 2200, h: 380, seed: 'b' }, (c) => {
      const pts = [[0, 380]];
      for (let x = 0; x <= 2200; x += 22) pts.push([x, 246 + 62 * fbm1(x * 0.0042, 5, 4)]);
      pts.push([2200, 380]);
      c.fillPoly(pts, '#000000', { opacity: 255, bleed: 0.0, texture: 0.0, border: 0.0 });
      c.flush();
    });
    return A;
  },
  draw(R, lt, A) {
    R.rect(0, 0, 1920, 1080, [0.85, 0.85, 0.9, 1]);
    R.layer(A.a, M.translate(-150, 40), { opacity: 1, tint: [1, 0, 0] });
    R.layer(A.b, M.translate(-150, 560), { opacity: 1, tint: [0, 0.4, 1] });
  },
};
export async function buildFilm() { return new Film({ fps: 30, duration: 1, shots: [{ id: 'probe', scene, start: 0, end: 1 }] }); }
