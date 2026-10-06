// Reusable painted cutout rig. Art anchors are supplied by the film.
// Returns the world-space grip, so strings remain attached to animated hands.
import { M, clamp } from '../../engine/math.js';

export function createWrenRig(parts) {
  return {
    draw(R, A, { x, y, s, aim, lean = 0, bob = 0, breathe = 0, tug = 0,
      scarf = 0, t = 0, op = 1, visible = true }) {
      const SB = parts.wrenBody, SA = parts.wrenArms, SS = parts.wrenScarf;
      // body: feet planted, leaning, bobbing, breathing (a hair of vertical scale)
      const B = M.chain(M.translate(x, y + bob), M.rotate(lean), M.scale(s, s * (1 + breathe)), M.translate(-SB.feet[0], -SB.feet[1]));
      const shoulder = M.apply(B, SB.shoulder[0], SB.shoulder[1]), neck = M.apply(B, SB.neck[0], SB.neck[1]);
      // arms: aimed at the string's direction, within what a shoulder can do, plus the tug
      const natural = Math.atan2(SA.hands[1] - SA.root[1], SA.hands[0] - SA.root[0]);
      const want = clamp(Math.atan2(aim[1] - shoulder[1], aim[0] - shoulder[0]), -1.25, 0.35);
      const Am = M.chain(M.translate(shoulder[0], shoulder[1]), M.rotate(want - natural + tug), M.scale(s), M.translate(-SA.root[0], -SA.root[1]));
      const show_ = visible;
      if (show_ && A.wrenScarf) {
        // scarf: hangs back from the collar, lifted and rippled by the wind
        const Sm = M.chain(M.translate(neck[0], neck[1]), M.rotate(0.35 - 0.45 * scarf + 0.08 * Math.sin(t * 2.1) + 0.04 * Math.sin(t * 5.3)), M.scale(-s, s), M.translate(-SS.root[0], -SS.root[1]));
        R.layer(A.wrenScarf, Sm, { opacity: op, warp: { type: 'noise', amp: 6 + 10 * scarf, freq: 0.02, time: t * (0.6 + 0.8 * scarf) } });
      }
      if (show_) {
        R.layer(A.wrenBody, B, { opacity: op });
        R.layer(A.wrenArms, Am, { opacity: op });
      }
      return M.apply(Am, SA.hands[0], SA.hands[1]);
    },
  };
}
