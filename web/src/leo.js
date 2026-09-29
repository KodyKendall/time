// LEO — painted short, pilot. 50 s = 20 bars (v5; the 30 s cut was 12 bars) at 96 BPM (1 bar = 2.5 s). Plan: docs/leo/PILOT.md.
// Segments hand off by transformation (no cuts). A segment that fails to load, or has not been
// written yet, becomes a labelled placeholder so the rest of the film still renders.
import { Film } from './engine/film.js';
import { M } from './engine/math.js';

export const SEGMENT_TABLE = [
  { id: 'leo_sheet', start: 0, end: 15 },
  { id: 'leo_forms', start: 15, end: 30 },
  { id: 'leo_app', start: 30, end: 50 },
];

function placeholder(id) {
  return {
    id,
    bg: '#101a2e',
    paint(P) {
      return { label: P.text([`${id}`, 'not painted yet'], { font: '400 44px Georgia', color: '#f3e6c8', letterSpacing: 2 }) };
    },
    draw(R, lt, A) {
      R.layer(A.label, M.translate(760, 500));
    },
  };
}

export async function buildFilm() {
  const shots = [];
  for (const s of SEGMENT_TABLE) {
    let scene = null;
    try {
      scene = (await import(`./scenes/${s.id}/index.js`)).scene;
    } catch (e) {
      console.warn(`segment '${s.id}' not loaded (${e.message}); using placeholder`);
    }
    shots.push({ id: s.id, scene: scene || placeholder(s.id), start: s.start, end: s.end });
  }
  return new Film({ fps: 30, duration: 50, shots });
}
