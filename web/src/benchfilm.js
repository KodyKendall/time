// Benchmark: per-frame repaint cost of different p5.brush operations at output resolution.
import { Film } from './engine/film.js';
import { M, rng } from './engine/math.js';

window.BENCH = {};
const kinds = {
  strokes40: (c, lt) => {
    const r = rng(1);
    for (let i = 0; i < 40; i++) {
      const pts = [];
      let x = r(100, 1800), y = r(100, 1000);
      for (let k = 0; k < 8; k++) { pts.push([x, y]); x += r(-80, 80) + 40 * Math.sin(lt + i); y += r(-60, 60); }
      c.strokePath(pts, 'ink', i % 2 ? '#f3e6c8' : '#e8622c', 1.2);
    }
  },
  lines200: (c, lt) => {
    const r = rng(2);
    c.brush.set('wire', '#f3e6c8', 1);
    for (let i = 0; i < 200; i++) {
      const x = r(0, 1920), y = r(0, 1080), a = r(0, 6.28) + lt;
      c.brush.line(x, y, x + Math.cos(a) * 300, y + Math.sin(a) * 300);
    }
  },
  fills6: (c, lt) => {
    const cols = ['#e8622c', '#7a2e5c', '#2aa6a0', '#f2b544', '#3cc7c6', '#d8452f'];
    for (let i = 0; i < 6; i++) c.fillPoly(c.blob(300 + i * 260, 540 + 100 * Math.sin(lt + i), 180, 140), cols[i], { opacity: 170 });
  },
  bigfill: (c, lt) => {
    c.fillPoly(c.blob(960, 540, 900, 500), '#2aa6a0', { opacity: 200 });
  },
  wash12: (c, lt) => {
    const cols = ['#e8622c', '#7a2e5c', '#2aa6a0', '#f2b544'];
    for (let i = 0; i < 12; i++) c.washPoly(c.blob(160 + i * 140, 540 + 80 * Math.sin(lt + i), 120, 200), cols[i % 4], 230);
  },
  hatch: (c, lt) => {
    c.hatchPoly(c.blob(960, 540, 700, 420), { dist: 8, angle: 0.3 + lt * 0.1, brushName: 'wire', color: '#f3e6c8', weight: 1 });
  },
};

const scene = {
  id: 'bench',
  bg: '#101a2e',
  paint(P) {
    const stat = P.layer('static', { w: 1920, h: 1080 }, (c) => {
      c.fillPoly(c.blob(700, 400, 400, 300), '#e8622c', { opacity: 170 });
      c.fillPoly(c.blob(1200, 600, 400, 300), '#2aa6a0', { opacity: 170 });
    });
    const dyn = {};
    for (const k in kinds) dyn[k] = P.dynamic(k, { w: 1920, h: 1080 });
    return { stat, dyn };
  },
  draw(R, lt, A) {
    R.layer(A.stat);
    const kind = window.BENCH_KIND;
    if (kind && kinds[kind]) {
      const gl = R.engine.gl;
      gl.finish();
      const t0 = performance.now();
      const L = A.dyn[kind].get(lt, (c) => kinds[kind](c, lt));
      gl.finish();
      (window.BENCH[kind] ||= []).push(performance.now() - t0);
      R.layer(L);
    }
  },
};

export async function buildFilm() {
  return new Film({ fps: 30, duration: 10, shots: [{ id: 'bench', scene, start: 0, end: 10 }] });
}
