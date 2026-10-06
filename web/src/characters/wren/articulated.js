import { M } from '../../engine/math.js';
import { solveTwoBone } from '../../animation/ik.js';

// Dimensions and anchors in rig units. The assets are painted once, resized at
// upload, then posed without redrawing. Far limbs reuse the same art with tint.
export const PARTS = {
  torso: { w: 120, h: 190, pivot: [58, 142] },
  head: { w: 116, h: 94, pivot: [79, 84] },
  upperarm: { w: 43, h: 100, start: [21, 13], end: [20, 89] },
  forearm: { w: 88, h: 49, start: [12, 24], end: [80, 24] },
  hand: { w: 48, h: 37, pivot: [8, 19], grip: [38, 18] },
  thigh: { w: 48, h: 124, start: [24, 16], end: [24, 112] },
  calf: { w: 40, h: 117, start: [20, 16], end: [20, 105] },
  boot: { w: 70, h: 49, pivot: [20, 47], ankle: [23, 12] },
  scarf: { w: 145, h: 61, pivot: [10, 27] },
};
const length = name => {
  const p = PARTS[name];
  return Math.hypot(p.end[0] - p.start[0], p.end[1] - p.start[1]);
};
function boneMatrix(name, root, tip) {
  const p = PARTS[name];
  const angle = Math.atan2(tip[1] - root[1], tip[0] - root[0]) -
    Math.atan2(p.end[1] - p.start[1], p.end[0] - p.start[0]);
  return M.place(...root, 1, angle, ...p.start);
}
export function evaluatePullRig(pose) {
  const { hipX = 0, crouch = 0, lean = 0, head = 0, gripX = 106,
    gripY = -228, scarf = 0, breath = 0 } = pose;
  const hip = [hipX, -205 + crouch + breath * 0.7];
  const torso = M.place(...hip, 1, lean, ...PARTS.torso.pivot);
  const neck = M.apply(torso, 64, 27);
  const shoulder = M.apply(torso, 82, 61);
  const farShoulder = M.apply(torso, 72, 63);
  const grip = [gripX, gripY];
  const wrist = [grip[0] - 30, grip[1] + 1];
  const arm = solveTwoBone(shoulder, wrist, length('upperarm'), length('forearm'), 1);
  const farArm = solveTwoBone(farShoulder, [wrist[0] - 7, wrist[1] + 4], length('upperarm'), length('forearm'), 1);
  const feet = [[-42, 0], [42, 0]];
  const legs = feet.map((foot, i) => {
    const root = [hip[0] + (i ? 13 : -13), hip[1] + 5];
    const ankle = [foot[0] + 3, foot[1] - 35];
    return { root, foot, ...solveTwoBone(root, ankle, length('thigh'), length('calf'), -1) };
  });
  return { torso, neck, shoulder, farShoulder, arm, farArm, legs,
    head: M.place(...neck, 1, lean + head, ...PARTS.head.pivot),
    // Positive rotation: scarf travels back as the shoulders recoil.
    scarf: M.place(...M.apply(torso, 30, 36), 1, Math.PI + scarf, ...PARTS.scarf.pivot),
    hand: M.place(...arm.end, 1, 0, ...PARTS.hand.pivot),
    grip: [arm.end[0] + 30, arm.end[1] - 1] };
}
export function drawArticulatedWren(R, art, pose, { x, y, s = 1, t = 0 } = {}) {
  const rig = evaluatePullRig(pose);
  const dark = { tint: [0.74, 0.77, 0.82] };
  const limb = (name, root, tip, options = {}) => R.layer(art[name], boneMatrix(name, root, tip), options);
  const leg = (index, options) => {
    const p = rig.legs[index];
    limb('thigh', p.root, p.joint, options);
    limb('calf', p.joint, p.end, options);
    R.layer(art.boot, M.place(...p.foot, 1, 0, ...PARTS.boot.pivot), options);
  };
  const arm = (root, chain, options) => {
    limb('upperarm', root, chain.joint, options);
    limb('forearm', chain.joint, chain.end, options);
  };
  R.with(M.place(x, y, s, 0), () => {
    leg(0, dark);
    arm(rig.farShoulder, rig.farArm, dark);
    leg(1, {});
    R.layer(art.scarf, rig.scarf, { warp: { type: 'noise', amp: 1.3,
      freq: 0.035, time: t * 0.65 } });
    R.layer(art.head, rig.head);
    R.layer(art.torso, rig.torso);
    arm(rig.shoulder, rig.arm, {});
    R.layer(art.hand, rig.hand);
  });
  return { grip: [x + s * rig.grip[0], y + s * rig.grip[1]], rig };
}
