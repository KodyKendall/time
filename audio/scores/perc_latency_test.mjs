// Test score: every percussion key we use, hit 4x on a 0.5 s grid, to measure sample latency.
import { inst } from '../lib/instruments.mjs';
const KEYS = [82, 70, 69, 54, 62, 63, 64, 60, 61, 75, 80, 81, 65, 66, 56, 76, 77];
export default function () {
  const tracks = [];
  for (const [name, keys] of [['percussion', KEYS], ['timbales', [65, 66, 56, 76, 77]], ['brushKit', [60, 64, 38, 39, 40, 44, 36, 51, 49]], ['jazzKit', [36, 37, 38, 42, 44, 46, 49, 51, 53, 41, 43, 45, 47, 48, 50]]]) {
    const notes = [];
    keys.forEach((k, i) => { for (let j = 0; j < 4; j++) notes.push({ t: 1 + i * 2 + j * 0.5, d: 0.3, p: k, v: 90 }); });
    tracks.push({ id: `lat_${name}`, ...inst(name), notes, gain: 0 });
  }
  return { sampleRate: 48000, duration: 40, tempo: [{ t: 0, bpm: 96 }], tracks, mix: { stemLUFS: null, master: { targetLUFS: -20, normalize: false } } };
}
