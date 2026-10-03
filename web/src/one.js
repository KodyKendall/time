// ONE OF MANY — 4 minutes, one continuous shot. See web/src/scenes/one/index.js.
import { Film } from './engine/film.js';
import { scene, overlay, DUR } from './scenes/one/index.js';

// render_parallel reads this to pick chunk boundaries; cuts land on act breaks.
export const SEGMENT_TABLE = [
  { id: 'alone', start: 0, end: 50 },
  { id: 'flock', start: 50, end: 90 },
  { id: 'wonder', start: 90, end: 120 },
  { id: 'together', start: 120, end: 150 },
  { id: 'storm', start: 150, end: 173 },
  { id: 'after', start: 173, end: 208 },
  { id: 'given', start: 208, end: 240 },
];

export async function buildFilm() {
  return new Film({ fps: 30, duration: DUR, shots: [{ id: 'one', scene, start: 0, end: DUR }], overlays: [overlay] });
}
