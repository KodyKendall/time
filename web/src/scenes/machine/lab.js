// Scratch "film" for studying painted assets of the machine segment in isolation.
// Usage: node tools/cli.mjs still --film scenes/machine/lab --w 3840 --t 0.5 --name mach_lab
import { Film } from '../../engine/film.js';
import { M } from '../../engine/math.js';
import { C } from '../lib/palette.js';
import { LAB } from './labassets.js';

const shots = LAB.map((item, i) => ({
  id: 'lab' + i,
  start: i,
  end: i + 1,
  scene: {
    id: 'machlab' + i,
    bg: item.bg || '#20242c',
    paint(P) { return item.paint(P); },
    draw(R, lt, A) { item.draw(R, lt, A); },
  },
}));

export async function buildFilm() {
  return new Film({ fps: 30, duration: shots.length, shots });
}
