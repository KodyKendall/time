// Placeholder segment: shows the start pivot for the first half and the end pivot for the second.
// Each segment author replaces web/src/scenes/<segment>/index.js with the real scene.
import { PIVOT } from './pivots.js';
export function placeholder(id, from, to, duration) {
  return {
    id,
    bg: '#000000',
    deps: [from, to].filter(Boolean),
    paint() { return {}; },
    draw(R, lt) {
      const p = lt < duration / 2 ? from : to;
      if (p) R.drawScene(p, 0);
    },
  };
}
