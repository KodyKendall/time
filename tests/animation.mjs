import assert from 'node:assert/strict';
import { createClip } from '../web/src/animation/clip.js';
import { createFirstFlight } from '../web/src/characters/wren/motion.js';
import { createWrenRig } from '../web/src/characters/wren/rig.js';
import { M } from '../web/src/engine/math.js';
const clip = createClip({ x: 0, y: 10 }, [
  { at: 1, pose: { x: 10 }, ease: 'none' },
  { at: 2, pose: { y: 20 }, ease: 'none' },
]);
assert.deepEqual(clip.sample(0.5), { x: 5, y: 10 });
assert.deepEqual(clip.sample(1.5), { x: 10, y: 15 });
assert.deepEqual(clip.sample(0), { x: 0, y: 10 });
assert.deepEqual(clip.sample(-1), { x: 0, y: 10 });
assert.deepEqual(clip.sample(9), { x: 10, y: 20 });
assert.deepEqual(clip.sample(1.5), { x: 10, y: 15 });
const flight = createFirstFlight();
const times = [0, 0.01, 1.2, 2.4, 5.123, 7.4, 11.99, 12, 12.4];
const expected = times.map(t => {
  const fresh = createFirstFlight();
  const pose = fresh.sample(t);
  fresh.dispose();
  return pose;
});
for (let i = times.length - 1; i >= 0; i--) assert.deepEqual(flight.sample(times[i]), expected[i]);
for (const i of [4, 0, 8, 3, 4, 2, 7, 1, 6, 5]) assert.deepEqual(flight.sample(times[i]), expected[i]);
const parts = { wrenBody: { feet: [300, 870], shoulder: [345, 295], neck: [255, 238] },
  wrenArms: { root: [40, 175], hands: [300, 55] }, wrenScarf: { root: [14, 52] } };
const rig = createWrenRig(parts);
const art = { wrenBody: 'body', wrenArms: 'arms', wrenScarf: 'scarf' };
const draws = [];
const grip = rig.draw({ layer: (...args) => draws.push(args) }, art,
  { x: 360, y: 663, s: 0.22, aim: [1300, 300], ...flight.sample(5.123) });
assert.deepEqual(grip, M.apply(draws.find(([name]) => name === 'arms')[1], ...parts.wrenArms.hands));
assert.equal(draws.length, 3);
assert.ok(grip.every(Number.isFinite));
clip.dispose(); flight.dispose();
console.log('Animation checks passed: interpolation, frame order, endpoints, and attached grip.');
