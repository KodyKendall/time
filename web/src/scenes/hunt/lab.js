// HUNT — asset lab (development only; not part of the film): one shot per painted asset so each
// can be inspected in isolation.  node tools/cli.mjs still --film scenes/hunt/lab --w 1920 --t 0.5
import { Film } from '../../engine/film.js';
import { M, hex } from '../lib/kit.js';
import { C } from '../lib/palette.js';
import { paintRidge, paintTrees, paintGrass, paintRanges, paintPlain, paintMammoths, RIDGE } from './land.js';
import { paintFigures } from './figures.js';
import { paintTilled, paintFirstFurrow, paintRows, paintPeriphery } from './fields.js';
import { paintSky } from './sky.js';

const fit = (R, L, bg = '#3a4a50', box = [20, 20, 1880, 1040]) => {
  R.fill(hex(bg));
  const s = Math.min(box[2] / L.w, box[3] / L.h);
  R.layer(L, M.chain(M.translate(box[0] + (box[2] - L.w * s) / 2, box[1] + (box[3] - L.h * s) / 2), M.scale(s)));
};
const sub = (R, L, x, y, w, h, bg = '#3a4a50') => {
  R.fill(hex(bg));
  const s = Math.min(1880 / w, 1040 / h);
  R.layer(L, M.chain(M.translate(20, 20), M.scale(s)), { uv: [x / L.w, y / L.h, (x + w) / L.w, (y + h) / L.h], w, h });
};
const mk = (id, paint, draw) => ({ id: 'lab-' + id, bg: '#3a4a50', paint, draw });
const BRUSHES = ['pen', 'rotring', '2B', 'HB', '2H', 'cpencil', 'pastel', 'crayon', 'charcoal', 'spray', 'marker', 'ink', 'wire', 'gouache', 'dry', 'dust', 'wash'];
const brushTest = (P) => ({ L: P.layer('brushes', { w: 1880, h: 1040, scale: 1 }, (c) => {
  BRUSHES.forEach((b, i) => {
    const y = 30 + i * 60;
    [0.4, 1, 2, 4].forEach((w, j) => {
      const x0 = 30 + j * 460, pts = [];
      for (let k = 0; k <= 8; k++) pts.push([x0 + k * 50, y + 10 * Math.sin(k * 0.8), 0.6 + 0.5 * Math.sin((k / 8) * Math.PI)]);
      c.strokePath(pts, b, j % 2 ? '#e9c98a' : '#d9707a', w, 0.5);
    });
  });
}) });
const scenes = [
  mk('ridgeA', (P) => ({ L: paintRidge(P) }), (R, lt, A) => sub(R, A.L, 3300, 100, 1900, 1070)),
  mk('ridgeB', (P) => ({ L: paintRidge(P) }), (R, lt, A) => fit(R, A.L)),
  mk('figs', (P) => paintFigures(P), (R, lt, A) => fit(R, A.atlas, '#20283a')),
  mk('grass', (P) => ({ L: paintGrass(P), T: paintTrees(P) }), (R, lt, A) => { R.fill(hex('#16223a')); R.layer(A.L, M.chain(M.translate(20, 40), M.scale(1880 / A.L.w))); R.layer(A.T, M.chain(M.translate(100, 260), M.scale(1.2))); }),
  mk('mammoth', (P) => ({ L: paintMammoths(P) }), (R, lt, A) => fit(R, A.L, '#8a9a7a')),
  mk('ranges', (P) => paintRanges(P), (R, lt, A) => { R.fill(hex('#1a2440')); R.layer(A.far, M.chain(M.translate(0, 100), M.scale(0.3))); R.layer(A.near, M.chain(M.translate(0, 480), M.scale(0.3))); R.layer(A.rim, M.chain(M.translate(0, 700), M.scale(0.3))); }),
  mk('plain', (P) => ({ L: paintPlain(P) }), (R, lt, A) => fit(R, A.L)),
  mk('plainZ', (P) => ({ L: paintPlain(P) }), (R, lt, A) => sub(R, A.L, 2600, 500, 1400, 788)),
  mk('tilled', (P) => ({ L: paintTilled(P) }), (R, lt, A) => sub(R, A.L, 900, 600, 960, 540)),
  mk('rows', (P) => ({ L: paintRows(P), F: paintFirstFurrow(P) }), (R, lt, A) => { R.fill(hex('#5a3a24')); R.layer(A.L, M.chain(M.translate(20, 20), M.scale(1.1))); R.layer(A.F, M.chain(M.translate(20, 960), M.scale(0.55))); }),
  mk('peri', (P) => ({ L: paintPeriphery(P) }), (R, lt, A) => fit(R, A.L, '#2c4a3a')),
  mk('brushes', brushTest, (R, lt, A) => { R.fill(hex('#1b2136')); R.layer(A.L, M.translate(20, 20)); }),
  mk('sky', (P) => paintSky(P), (R, lt, A) => { R.fill(hex(C.night)); R.layer(A.skyExt, M.scale(0.45)); R.layer(A.dawnLow, M.chain(M.translate(0, 560), M.scale(0.45)), { blend: 'screen' }); R.layer(A.cloudBody, M.chain(M.translate(900, 560), M.scale(0.25))); R.layer(A.cloudLit, M.chain(M.translate(900, 560), M.scale(0.25)), { blend: 'screen' }); }),
];
export async function buildFilm() {
  return new Film({ fps: 30, duration: scenes.length, shots: scenes.map((scene, i) => ({ id: scene.id, scene, start: i, end: i + 1 })) });
}
