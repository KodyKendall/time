// Eight-second scripted performance test. No editor required.
import { Film } from './engine/film.js';
import { M } from './engine/math.js';
import { PARTS, drawArticulatedWren } from './characters/wren/articulated.js';
import { createPullPerformance } from './characters/wren/pull-motion.js';
import { kite as paintKite, X } from './scenes/tether/sketch.js';

const performance = createPullPerformance();
const images = {};
const scene = {
  id: 'wren-pull',
  paint(P) {
    const art = Object.fromEntries(Object.entries(PARTS).map(([name, dimensions]) =>
      [name, P.image(images[name], dimensions)]));
    const bg = P.image(images.bg, { w: 1920, h: 1280 });
    const kite = P.layer('kite', { w: 120, h: 180, scale: 3 }, c => {
      paintKite(c, X(60, 70, 1, 0), 1, {}); c.flush();
    });
    return { art, bg, kite };
  },
  draw(R, t, A) {
    R.layer(A.bg, M.translate(0, -100));
    const pose = performance.sample(t);
    const { grip } = drawArticulatedWren(R, A.art, pose, { x: 715, y: 850, s: 1.7, t });
    // The kite pulls up-right; cord stays precisely at the posed grip.
    // Kite responds to the same tension cue, with a small delayed sway.
    const kiteX = 1520 + 0.8 * pose.gripX;
    const kiteY = 260 - 0.9 * pose.crouch + 7 * Math.sin(t * 0.9);
    const end = [kiteX, kiteY];
    const kiteM = M.place(kiteX, kiteY, 1.45, 0.25 + 0.015 * pose.crouch, 60, 70);
    R.layer(A.kite, kiteM);
    const tail = M.apply(kiteM, 60, 152);
    let previous = tail;
    for (let i = 1; i <= 24; i++) {
      const u = i / 24;
      const point = [tail[0] - 42 * u + 14 * u * Math.sin(5 * u - t * 1.8),
        tail[1] + 150 * u];
      const dx = point[0] - previous[0], dy = point[1] - previous[1];
      R.rect(0, -2, Math.hypot(dx, dy) + 0.5, 4 * (1 - 0.35 * u),
        i % 6 < 3 ? '#a94d37' : '#c5a062',
        { m: M.place(...previous, 1, Math.atan2(dy, dx)), opacity: 0.9 });
      previous = point;
    }
    const dx = end[0] - grip[0], dy = end[1] - grip[1];
    // Long cord is drawn as a narrow transformed rectangle for stable subframes.
    R.rect(0, -1, Math.hypot(dx, dy), 2, '#b8a27d',
      { m: M.place(...grip, 1, Math.atan2(dy, dx)), opacity: 0.85 });
  },
  blur: () => 3,
  post: () => ({ bloom: 0.01, exposure: 1.02, sat: 1.02, contrast: 1.03,
    vignette: 0.15, paper: 0.18, grain: 0.025 }),
};
export async function buildFilm() {
  const sources = { ...Object.fromEntries(Object.keys(PARTS).map(name =>
    [name, `assets/tether/rig-v2/${name}.png`])), bg: 'assets/tether/plates/bg1.png' };
  await Promise.all(Object.entries(sources).map(async ([name, src]) => {
    const img = new Image(); img.src = src; await img.decode(); images[name] = img;
  }));
  return new Film({ fps: 30, duration: 8, shots: [{ id: 'pull', scene, start: 0, end: 8 }] });
}
