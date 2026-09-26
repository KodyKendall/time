// The film: one shot per segment. Segments hand off through shared PIVOT states (scenes/pivots.js),
// transforming into / out of them - no cross-fades, wipes or dissolves anywhere.
// Timing grid: 96 BPM, 4/4 -> one bar = 2.5 s. All segment boundaries sit on bar lines.
//
// Segments are imported one by one so that a segment that is mid-edit (and fails to load) never
// breaks the rest of the film: it falls back to a placeholder between its two pivots.
import { Film } from './engine/film.js';
import { cosmos } from './scenes/cosmos.js';
import { PIVOT } from './scenes/pivots.js';
import { placeholder } from './scenes/_placeholder.js';
import { captions } from './captions.js';

export const SEGMENT_TABLE = [
  { id: 'earth', start: 30, end: 52.5, from: 'star', to: 'cell' },
  { id: 'sea', start: 52.5, end: 70, from: 'cell', to: 'eye' },
  { id: 'land', start: 70, end: 85, from: 'eye', to: 'ash' },
  { id: 'ancestors', start: 85, end: 97.5, from: 'ash', to: 'night' },
  { id: 'hunt', start: 97.5, end: 107.5, from: 'night', to: 'fields' },
  { id: 'city', start: 107.5, end: 117.5, from: 'fields', to: 'gear' },
  { id: 'machine', start: 117.5, end: 130, from: 'gear', to: 'die' },
  { id: 'mind', start: 130, end: 145, from: 'die', to: 'singularity' },
];

export async function buildFilm() {
  const q = new URLSearchParams(location.search);
  const only = q.get('only'); // e.g. ?only=cosmos,earth  (others become placeholders, faster to load)
  const shots = [{ id: 'cosmos', scene: cosmos, start: 0, end: 30 }];
  for (const s of SEGMENT_TABLE) {
    let scene = null;
    if (!only || only.split(',').includes(s.id)) {
      try {
        scene = (await import(`./scenes/${s.id}/index.js`)).scene;
      } catch (e) {
        console.error(`segment '${s.id}' failed to load, using placeholder: ${e.message}`);
      }
    }
    shots.push({ id: s.id, scene: scene || placeholder(s.id, PIVOT[s.from], PIVOT[s.to], s.end - s.start), start: s.start, end: s.end });
  }
  return new Film({ fps: 30, duration: 145, shots, overlays: captions() });
}
