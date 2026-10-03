// Milo rig — poses painted parts (parts.js) through a joint hierarchy.
//
// Angles in radians, + = clockwise on screen (y-down). Head + tips the muzzle down,
// legs + swing paws backward, tail − raises the brush.
import { M } from '../../engine/math.js';
import { PART, A } from './parts.js';

const piv = (key) => [PART[key][2], PART[key][3]];

export function drawMilo(R, mp, o = {}) {
  const { x = 960, y = 800, s = 0.5, flip = false, lean = 0,
    head = 0, earB = 0, earF = 0, tail1 = 0, tail2 = 0,
    legF = 0, legB = 0, look = [0, 0], opacity = 1 } = o;
  // Flip by mirroring art (UV), anchors, pivots and angles — never by negative
  // scale (the compositor can't reflect matrices).
  const mir = (w, v) => (flip ? w - v : v);
  const ang = (a) => (flip ? -a : a);
  const lk = flip ? [-look[0], look[1]] : look;
  const UV = flip ? [1, 0, 0, 1] : undefined;
  const uv = (o) => (UV ? { ...o, uv: UV } : o);
  const TW = PART.torso[0], HW = PART.head[0];
  const [tx, ty] = piv('torso');
  const [hpx, hpy] = piv('head');
  const [t1x, t1y] = piv('tail1');
  const [t2x, t2y] = piv('tail2');
  const [epx, epy] = piv('ear');
  const [fpx, fpy] = piv('legF');
  const [bpx, bpy] = piv('legB');
  R.with(M.place(x, y, s, ang(lean), mir(TW, tx), ty), () => {
    // far-side legs behind the body, darkened for depth
    R.layer(mp.legF, M.place(mir(TW, A.shoulder[0] - 14), A.shoulder[1], 1, ang(legF - 0.12), mir(PART.legF[0], fpx), fpy),
      uv({ opacity: 0.9 * opacity, tint: [0.72, 0.68, 0.66] }));
    R.layer(mp.legB, M.place(mir(TW, A.hip[0] - 16), A.hip[1], 1, ang(legB - 0.1), mir(PART.legB[0], bpx), bpy),
      uv({ opacity: 0.9 * opacity, tint: [0.72, 0.68, 0.66] }));
    R.layer(mp.torso, M.id(), uv({ opacity }));
    R.with(M.place(mir(TW, A.rump[0]), A.rump[1], 1, ang(tail1), mir(PART.tail1[0], t1x), t1y), () => {
      R.layer(mp.tail1, M.id(), uv({ opacity }));
      R.layer(mp.tail2, M.place(mir(PART.tail1[0], A.tailMid[0]), A.tailMid[1], 1, ang(tail2), mir(PART.tail2[0], t2x), t2y), uv({ opacity }));
    });
    R.with(M.place(mir(TW, A.neck[0]), A.neck[1], 1, ang(head), mir(HW, hpx), hpy), () => {
      R.layer(mp.head, M.id(), uv({ opacity }));
      R.layer(mp.earB, M.place(mir(HW, A.earB[0]), A.earB[1], 1, ang(earB), mir(PART.ear[0], epx), epy), uv({ opacity }));
      R.layer(mp.earF, M.place(mir(HW, A.earF[0]), A.earF[1], 1, ang(earF), mir(PART.ear[0], epx), epy), uv({ opacity }));
      R.layer(mp.pupil, M.translate(mir(HW, A.eye[0]) + lk[0] - 20, A.eye[1] + lk[1] - 20), { opacity });
    });
    R.layer(mp.legB, M.place(mir(TW, A.hip[0]), A.hip[1], 1, ang(legB), mir(PART.legB[0], bpx), bpy), uv({ opacity }));
    R.layer(mp.legF, M.place(mir(TW, A.shoulder[0]), A.shoulder[1], 1, ang(legF), mir(PART.legF[0], fpx), fpy), uv({ opacity }));
  });
}

// Pose presets (v1 — tuned against the model sheet).
export const POSES = {
  stand: { lean: 0, head: 0, tail1: -0.2, tail2: -0.15, legF: 0, legB: 0 },
  proud: { lean: -0.06, head: -0.12, tail1: -0.25, tail2: -0.15, legF: 0, legB: 0, look: [2, -2] },
  sit: { lean: -0.5, head: 0.45, tail1: 0.35, tail2: 0.3, legF: 0.2, legB: 1.1 },
  lie: { lean: 0, head: 0.15, tail1: 0.55, tail2: 0.7, legF: 1.5, legB: 1.5 },
  lookup: { lean: 0, head: -0.6, tail1: -0.25, tail2: -0.1, legF: 0, legB: 0, look: [2, -4] },
  sad: { lean: 0.06, head: 0.35, tail1: 0.5, tail2: 0.4, earF: -0.5, earB: -0.5, legF: 1.5, legB: 1.5 },
  soft: { lean: 0, head: 0.1, tail1: 0.1, tail2: 0.15, legF: 0.5, legB: 1.1, look: [3, 1] },
  pull: { lean: 0.18, head: 0.2, tail1: 0.15, tail2: 0.1, legF: -0.5, legB: 0.55 },
  happy: { lean: -0.25, head: -0.1, tail1: -0.1, tail2: 0.0, legF: 0.4, legB: 0.9 },
};
