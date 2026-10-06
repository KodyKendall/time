import { gsap } from '../../vendor/gsap-core.js';

// Flat numeric pose channels. Explicit from/to values avoid lazy capture of a
// previous frame. Each sample rewinds first, including motion-blur subframes.
export function createClip(base, keys) {
  for (const value of Object.values(base)) {
    if (!Number.isFinite(value)) throw new TypeError('Clip channels must be finite numbers');
  }
  const state = { ...base };
  const timeline = gsap.timeline({ paused: true });
  let previous = { ...base }, end = 0;
  for (const { at, pose, ease = 'sine.inOut' } of keys) {
    if (!Number.isFinite(at) || at <= end) throw new RangeError('Key times must increase from zero');
    for (const [key, value] of Object.entries(pose)) {
      if (!(key in base) || !Number.isFinite(value)) throw new TypeError(`Invalid channel: ${key}`);
    }
    const next = { ...previous, ...pose };
    timeline.fromTo(state, previous, { ...next, duration: at - end, ease,
      immediateRender: false, lazy: false }, end);
    previous = next;
    end = at;
  }
  return {
    duration: end,
    sample(t) {
      if (!Number.isFinite(t)) throw new TypeError('Sample time must be finite');
      timeline.totalTime(0, true);
      Object.assign(state, base);
      timeline.totalTime(Math.max(0, Math.min(end, t)), true);
      return Object.fromEntries(Object.keys(base).map(key => [key, state[key]]));
    },
    dispose() { timeline.kill(); },
  };
}
