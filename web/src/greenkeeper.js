// FORTY YEARS OF STRIPES — 2:58, eleven beats on generated plates, everything that moves drawn
// by the engine. See web/src/scenes/greenkeeper/index.js. Storyboard: storyboard-greenkeeper.html.
import { Film } from './engine/film.js';
import { scene, overlay, PLATES, SPRITES, DUR, shots, transitions } from './scenes/greenkeeper/index.js';

// Anchor a cut-out at the bottom centre of its own opaque pixels, so regenerating a pose can't
// leave her standing above the ground or sinking into it. This is why we do not hand-type feet.
function anchor(img) {
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0, any = false;
  const d = g.getImageData(0, 0, cv.width, cv.height).data;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (d[(y * cv.width + x) * 4 + 3] > 24) { any = true; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  return any ? [Math.round((x0 + x1) / 2), y1] : [Math.round(cv.width / 2), cv.height];
}

export async function buildFilm() {
  // PLATES has a null for beat 10 (the card), which has no picture.
  await Promise.all([...PLATES.filter(Boolean), ...Object.values(SPRITES)].map(async (pl) => {
    const img = new Image();
    img.src = pl.src;
    try { await img.decode(); pl.img = img; } catch { console.warn('missing ' + pl.src); return; }
    if (!PLATES.includes(pl)) pl.feet = anchor(img);   // plates have no feet
  }));
  return new Film({ fps: 30, duration: DUR, shots: shots(), transitions: transitions(), overlays: [overlay] });
}
