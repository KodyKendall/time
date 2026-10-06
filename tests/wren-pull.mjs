import assert from 'node:assert/strict';
import { solveTwoBone } from '../web/src/animation/ik.js';
import { evaluatePullRig, PARTS } from '../web/src/characters/wren/articulated.js';
import { createPullPerformance } from '../web/src/characters/wren/pull-motion.js';
import { M } from '../web/src/engine/math.js';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
for (const target of [[0, 0], [1000, 0], [0, -1000], [35, 20]]) {
  const ik = solveTwoBone([0, 0], target, 60, 40);
  close(distance([0, 0], ik.joint), 60);
  close(distance(ik.joint, ik.end), 40);
}
const performance = createPullPerformance();
const expected = [];
for (let i = 0; i <= 240; i++) {
  const pose = performance.sample(i / 30), rig = evaluatePullRig(pose);
  expected.push(pose);
  for (const leg of rig.legs) {
    assert.ok(leg.reachable, 'foot target must be reachable');
    close(distance(leg.root, leg.joint), 96);
    close(distance(leg.joint, leg.end), 89);
    assert.deepEqual(leg.foot, leg === rig.legs[0] ? [-42, 0] : [42, 0]);
    close(distance(leg.end, [leg.foot[0] + 3, -35]), 0);
  }
  assert.ok(rig.arm.reachable && rig.farArm.reachable, 'hand targets must be reachable');
  const paintedGrip = M.apply(rig.hand, ...PARTS.hand.grip);
  close(distance(paintedGrip, rig.grip), 0);
  assert.ok([rig.torso, rig.neck, rig.shoulder, rig.head, rig.scarf, rig.hand, rig.grip].flat().every(Number.isFinite));
}
for (let i = 240; i >= 0; i--) assert.deepEqual(performance.sample(i / 30), expected[i]);
performance.dispose();
console.log('Wren pull passed: all 241 poses preserve bone lengths, planted feet, grip and reverse seeking.');
