// TETHER (sketch) — code-painted storyboard frames: nine held paintings, beat k at t in [k, k+1). See
// web/src/scenes/tether/sketch.js and storyboard-tether.html. Beats with a generated background
// plate load it here, before the engine paints anything.
import { Film } from './engine/film.js';
import { scene, PLATES, SPRITES } from './scenes/tether/sketch.js';

export async function buildFilm() {
  await Promise.all([...Object.values(PLATES), ...Object.values(SPRITES)].map(async (pl) => {
    const img = new Image();
    img.src = pl.src;
    await img.decode();
    pl.img = img;
  }));
  return new Film({ fps: 30, duration: 9, shots: [{ id: 'tether', scene, start: 0, end: 9 }] });
}
