// TETHER — storyboard frames: nine held paintings, beat k at t in [k, k+1). See
// web/src/scenes/tether/index.js and storyboard-tether.html.
import { Film } from './engine/film.js';
import { scene } from './scenes/tether/index.js';

export async function buildFilm() {
  return new Film({ fps: 30, duration: 9, shots: [{ id: 'tether', scene, start: 0, end: 9 }] });
}
