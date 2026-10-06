// WRENKITE — TETHERED (Wren & the Kite, told by the Kite). 12 plates, ~6:54.
// See web/src/scenes/wrenkite/index.js. Score: audio/scores/wrenkite_lullaby.mjs.
// Full mix (score + narration): audio/build/wrenkite_lullaby_full.wav.
import { Film } from './engine/film.js';
import { scene, overlay, PLATES, DUR, shots, transitions } from './scenes/wrenkite/index.js';

export async function buildFilm() {
  await Promise.all(PLATES.map(async (pl) => {
    const img = new Image();
    img.src = pl.src;
    try { await img.decode(); pl.img = img; } catch { console.warn('missing ' + pl.src); }
  }));
  return new Film({ fps: 30, duration: DUR, shots: shots(), transitions: transitions(), overlays: [overlay] });
}
