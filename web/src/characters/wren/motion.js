import { createClip } from '../../animation/clip.js';

// One reusable performance, independent of art, placement, camera and kite aim.
export function createFirstFlight() {
  const base = { lean: -0.03, bob: 0, breathe: 0, tug: 0.025, scarf: 0.6 };
  const clip = createClip(base, [
    // Anticipate the pull, brace quickly, overshoot, then recover slowly.
    { at: 1.4, pose: { lean: 0.055, tug: -0.12, scarf: 0.65 } },
    { at: 2.2, pose: { lean: -0.20, tug: 0.20, scarf: 0.95 }, ease: 'power2.out' },
    { at: 2.65, pose: { lean: -0.24, tug: 0.28 } },
    { at: 3.2, pose: { lean: -0.10, tug: 0.02 }, ease: 'power2.out' },
    { at: 4.6, pose: { lean: -0.045, tug: 0.04, scarf: 0.65 } },
    { at: 6.0, pose: { lean: 0.045, tug: -0.10 } },
    { at: 6.7, pose: { lean: -0.18, tug: 0.22, scarf: 0.85 }, ease: 'power2.out' },
    { at: 7.2, pose: { lean: -0.22, tug: 0.26 } },
    { at: 8.1, pose: { lean: -0.075, tug: 0.015 }, ease: 'power2.out' },
    { at: 10, pose: { lean: -0.04, tug: 0.04, scarf: 0.65 } },
    { at: 12, pose: base },
  ]);
  return clip;
}
const flight = createFirstFlight();
// Baseline is available for CLI comparisons without swapping scene files.
export function originalFirstFlight(t) {
  return { lean: -0.03 + 0.02 * Math.sin(t * 0.9),
    bob: -4 * Math.abs(Math.sin(t * 3.1)), breathe: 0.006 * Math.sin(t * 1.7),
    tug: 0.06 * Math.sin(t * 1.3 + 0.5), scarf: 0.6 + 0.2 * Math.sin(t * 0.7) };
}
const baseline = typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('rigmotion') === 'original';
export const firstFlight = t => baseline ? originalFirstFlight(t) : flight.sample(t);
