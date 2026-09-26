// Lab items: each { paint(P) -> assets, draw(R, lt, A) }.
import { hex } from '../../engine/math.js';
import { PIVOT } from '../pivots.js';
// the die pivot exactly as drawn at global time T (boundary reference)
const dieAt = (T) => ({
  bg: '#0c1e26',
  paint() { return {}; },
  draw(R) {
    const AD = R.engine.ensure(PIVOT.die);
    R.fill(hex('#0c1e26'));
    R.layer(AD.grid);
    PIVOT.die.drawLights(R, T);
  },
});
export const LAB = [dieAt(129.9667), dieAt(130.0)];
