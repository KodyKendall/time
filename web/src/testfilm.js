// Calibration film: checks orientation, transparency, brush sizes, fills, hatch, glow, text.
import { Film } from './engine/film.js';
import { M, hex } from './engine/math.js';

const test = {
  id: 'test',
  bg: '#101a2e',
  paint(P) {
    const brushes = ['pen', 'rotring', '2B', 'HB', '2H', 'cpencil', 'pastel', 'crayon', 'charcoal', 'spray', 'marker', 'ink', 'wire', 'gouache', 'dry', 'dust', 'wash'];
    const t0 = performance.now();
    const strokes = P.layer('strokes', { w: 1920, h: 1080 }, (c) => {
      const { brush } = c;
      brushes.forEach((b, i) => {
        brush.set(b, '#f3e6c8', 1);
        brush.line(80, 60 + i * 34, 700, 60 + i * 34);
      });
      // TOP-LEFT marker
      c.fillPoly([[0, 0], [60, 0], [0, 60]], '#e8622c', { opacity: 255, bleed: 0.02, texture: 0.2 });
    });
    const t1 = performance.now();
    const fills = P.layer('fills', { w: 1920, h: 1080 }, (c) => {
      c.fillPoly(c.blob(1150, 330, 220, 180), '#e8622c', { opacity: 170, bleed: 0.08, texture: 0.6 });
      c.fillPoly(c.blob(1450, 420, 200, 160), '#7a2e5c', { opacity: 170, bleed: 0.08, texture: 0.6 });
      c.fillPoly(c.blob(1300, 650, 240, 150), '#2aa6a0', { opacity: 170, bleed: 0.1, texture: 0.7 });
      c.washPoly(c.blob(1700, 850, 150, 150), '#f2b544', 255);
      c.hatchPoly(c.blob(900, 820, 200, 130), { dist: 7, angle: 0.3, brushName: 'wire', color: '#f3e6c8', weight: 1 });
      c.hatchPoly(c.blob(400, 850, 220, 140), { dist: 10, angle: -0.6, brushName: 'HB', color: '#3cc7c6', weight: 1.2, rand: 0.2 });
    });
    const t2 = performance.now();
    const label = P.text(['TIME — calibration', `strokes ${Math.round(t1 - t0)}ms · fills ${Math.round(t2 - t1)}ms`], {
      font: '400 30px Georgia', color: '#f3e7cf', letterSpacing: 2,
    });
    return { strokes, fills, label };
  },
  draw(R, lt, A) {
    R.layer(A.fills);
    R.layer(A.strokes);
    R.glow(1150, 330, 60, '#ffd9a0', 1.2);
    R.layer(A.label, M.translate(1180, 960));
    // moving small copy to check mip / motion
    R.layer(A.fills, M.place(300 + lt * 40, 150, 0.15, lt * 0.2, 960, 540));
    R.particles(Array.from({ length: 200 }, (_, i) => [(i * 97.3) % 1920, (i * 53.1) % 1080, 2 + (i % 5), 0, 1, 0.9, 0.7, 0.8]), { kind: 'glow', blend: 'add' });
  },
};

export async function buildFilm() {
  return new Film({
    fps: 30,
    duration: 4,
    shots: [{ id: 'test', scene: test, start: 0, end: 4 }],
  });
}
