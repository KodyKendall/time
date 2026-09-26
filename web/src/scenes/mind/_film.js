// Scratch film for iterating on the 'mind' segment alone (same global times as the real film).
//   node tools/cli.mjs sheet --film scenes/mind/_film --w 1280 --from 130 --to 145 ...
import { Film } from '../../engine/film.js';
import { scene as mind } from './index.js';

export async function buildFilm() {
  return new Film({ fps: 30, duration: 145, shots: [{ id: 'mind', scene: mind, start: 130, end: 145 }] });
}
