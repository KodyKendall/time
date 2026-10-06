import { createClip } from '../../animation/clip.js';

// Weight shifts precede the arms. Head and scarf have delayed, smaller responses.
export const PULL_BASE = { hipX: 0, crouch: 0, lean: 0.015, head: -0.04,
  gripX: 106, gripY: -228, scarf: 0, breath: 0 };
export function createPullPerformance() {
  return createClip(PULL_BASE, [
    { at: 0.8, pose: { head: -0.10, breath: 0.6 } },
    { at: 1.35, pose: { hipX: 7, crouch: 9, lean: 0.07, gripX: 113, gripY: -224 } },
    { at: 1.75, pose: { hipX: -9, crouch: 18, lean: -0.12, gripX: 86, gripY: -219 }, ease: 'power2.out' },
    { at: 2.0, pose: { hipX: -13, crouch: 21, lean: -0.16, head: 0.025, gripX: 78, gripY: -212, scarf: 0.20 } },
    { at: 2.55, pose: { hipX: -7, crouch: 14, lean: -0.085, head: -0.035, gripX: 88, gripY: -220, scarf: -0.08 } },
    { at: 3.5, pose: { hipX: -4, crouch: 8, lean: -0.045, head: -0.08, gripX: 98, gripY: -226, scarf: 0.025 } },
    { at: 4.5, pose: { hipX: 5, crouch: 11, lean: 0.045, gripX: 110, gripY: -222, scarf: 0 } },
    { at: 4.95, pose: { hipX: -11, crouch: 20, lean: -0.14, gripX: 80, gripY: -214 }, ease: 'power2.out' },
    { at: 5.2, pose: { hipX: -14, crouch: 23, lean: -0.18, head: 0.035, scarf: 0.22 } },
    { at: 5.85, pose: { hipX: -6, crouch: 12, lean: -0.065, head: -0.06, gripX: 94, gripY: -223, scarf: -0.06 } },
    { at: 6.8, pose: { hipX: -2, crouch: 5, lean: -0.025, gripX: 102, gripY: -228, scarf: 0.02 } },
    { at: 8, pose: PULL_BASE },
  ]);
}
