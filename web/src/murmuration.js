// MURMURATION — 20 s, one continuous shot, no cuts. See web/src/scenes/murmur/index.js.
import { Film } from './engine/film.js';
import { scene } from './scenes/murmur/index.js';

export async function buildFilm() {
  return new Film({ fps: 30, duration: 20, shots: [{ id: 'murmur', scene, start: 0, end: 20 }] });
}
