// Scratch film: only the 'sea' segment (for fast iteration; not part of the real film).
//   node tools/cli.mjs sheet --film scenes/sea/lab --w 1280 --from 52.5 --to 70 --n 16 --name sea_x
import { Film } from '../../engine/film.js';
import { scene } from './index.js';

export async function buildFilm() {
  return new Film({ fps: 30, duration: 145, shots: [{ id: 'sea', scene, start: 52.5, end: 70 }] });
}
