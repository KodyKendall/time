// Milo model sheet — review film. Shot 1: rig parts. Shot 2: pose tests.
//   node tools/cli.mjs still --film milosheet --w 1280 --t 2.5 --t 7.5 --name milo
import { Film } from './engine/film.js';
import { M } from './engine/math.js';
import { paintMiloParts, PART } from './characters/milo/parts.js';
import { drawMilo, POSES } from './characters/milo/rig.js';

const label = (P, text, size = 26) => P.text([text], {
  font: `600 ${size}px Georgia`, color: '#f3e7cf', letterSpacing: 3,
  shadow: { color: 'rgba(0,0,0,0.8)', blur: 5 },
});

const partsScene = {
  id: 'milo-parts',
  bg: '#26232c',
  paint(P) {
    const mp = paintMiloParts(P);
    const bg = P.layer('bg', { w: 1920, h: 1080 }, (c) => {
      c.washPoly([[-4, -4], [1924, -4], [1924, 1084], [-4, 1084]], '#26232c', 255);
      c.flush();
    });
    const items = [
      ['torso', 240, 400], ['head', 640, 400], ['ear (rear)', 910, 400], ['ear (front)', 1180, 400],
      ['tail 1', 240, 760], ['tail 2', 640, 760], ['leg F', 950, 760], ['leg B', 1180, 760],
    ];
    const keys = ['torso', 'head', 'earB', 'earF', 'tail1', 'tail2', 'legF', 'legB'];
    const caps = items.map(([t]) => label(P, t.toUpperCase(), 24));
    return { mp, bg, items, keys, caps, title: label(P, 'MILO — MODEL SHEET · PARTS', 40) };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    A.items.forEach(([t, px, py], i) => {
      const k = A.keys[i];
      const layer = A.mp[k];
      const pk = k.startsWith('ear') ? 'ear' : k;
      R.layer(layer, M.place(px, py, 0.85, 0, PART[pk][2], PART[pk][3]));
      R.layer(A.caps[i], M.translate(px - 90, py + 155), { opacity: 0.85 });
    });
    drawMilo(R, A.mp, { ...POSES.stand, x: 1600, y: 690, s: 0.72 });
    R.layer(A.title, M.translate(60, 40));
  },
};

const posesScene = {
  id: 'milo-poses',
  bg: '#0b1222',
  paint(P) {
    const mp = paintMiloParts(P);
    const bg = P.layer('bg', { w: 1920, h: 1080 }, (c) => {
      c.washPoly([[-4, -4], [1924, -4], [1924, 1084], [-4, 1084]], '#0b1222', 255);
      for (const gy of [470, 940]) {
        c.washPoly([[40, gy], [1880, gy], [1880, gy + 4], [40, gy + 4]], '#3a4a63', 255);
      }
      c.flush();
    });
    const defs = [
      ['STAND', 'stand', 320, 470, 0.55], ['PROUD', 'proud', 960, 470, 0.55], ['LOOK UP', 'lookup', 1600, 470, 0.55],
      ['SIT', 'sit', 320, 940, 0.55], ['LIE', 'lie', 960, 940, 0.55], ['SAD', 'sad', 1600, 940, 0.55],
    ];
    const caps = defs.map(([t]) => label(P, t, 24));
    return { mp, bg, defs, caps, title: label(P, 'MILO — POSE TESTS', 40) };
  },
  draw(R, lt, A) {
    R.layer(A.bg);
    A.defs.forEach(([t, pose, px, gy, s], i) => {
      const lift = pose === 'lie' || pose === 'sad' ? 60 * s : pose === 'sit' ? 150 * s : 200 * s;
      drawMilo(R, A.mp, { ...POSES[pose], x: px, y: gy - lift, s });
      R.layer(A.caps[i], M.translate(px - 70, gy - lift - 330 * s - 44), { opacity: 0.85 });
    });
    R.layer(A.title, M.translate(60, 40));
  },
};

export async function buildFilm() {
  return new Film({
    fps: 30,
    duration: 10,
    shots: [
      { id: 'parts', scene: partsScene, start: 0, end: 5 },
      { id: 'poses', scene: posesScene, start: 5, end: 10 },
    ],
  });
}
