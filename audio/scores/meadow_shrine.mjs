// audio/scores/meadow_shrine.mjs — "The Meadow Shrine", an original adventure-fantasy
// waltz for solo piano. Evokes a Zelda-like spirit without quoting anything:
//   - 3/4 lilting waltz (oom-pah-pah left hand), D major with Mixolydian bVII colour;
//   - heroic rising-triad call (D–F#–A) + stepwise answer as the recurring motif;
//   - B section in B minor (relative minor, i–VI–III–VII quest feel, dotted rhythms);
//   - Lydian #11 sparkle (G#) at the reprise peak for a "magic" lift;
//   - intro horn-call fifths, rolled harp-like arpeggios, soft coda recall.
// Form: intro 4 | A 8 (D major) | B 8 (B minor) | A' 8 | coda 4 = 32 bars.
// Uses only the bundled GeneralUser-GS grand (gm 0) + sustain pedal (CC64).
import { midi as N, chord, tempoMap, humanizer } from '../lib/music.mjs';

export default function meadowShrine() {
  const BARS = 32;
  const tm = tempoMap([
    { beat: 0, bpm: 104 },
    { beat: 90, bpm: 104 },
    { beat: 96, bpm: 80, ramp: true },
  ]);
  const T = (bar, beat = 0) => tm.beat(bar * 3 + beat); // 3/4
  const beatSec = 60 / 104;
  const hum = humanizer(8, { time: 0.006, vel: 5 });
  const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });

  // [bar, beat, chord, beats]
  const changes = [
    [0, 0, 'D', 3], [1, 0, 'G', 3], [2, 0, 'Em7', 3], [3, 0, 'A7', 3],
    [4, 0, 'D', 3], [5, 0, 'G', 3], [6, 0, 'Em7', 3], [7, 0, 'D', 3],
    [8, 0, 'Em7', 3], [9, 0, 'A7', 3], [10, 0, 'D/F#', 3], [11, 0, 'A7', 3],
    [12, 0, 'Bm', 3], [13, 0, 'G', 3], [14, 0, 'Em7', 3], [15, 0, 'D', 3],
    [16, 0, 'A', 3], [17, 0, 'Bm', 3], [18, 0, 'Gmaj7', 3], [19, 0, 'A7', 3],
    [20, 0, 'D', 3], [21, 0, 'A', 3], [22, 0, 'G', 3], [23, 0, 'Em7', 3],
    [24, 0, 'D', 3], [25, 0, 'A', 3], [26, 0, 'G', 3], [27, 0, 'D', 3],
    [28, 0, 'G', 3], [29, 0, 'Em7', 3], [30, 0, 'D', 3], [31, 0, 'D', 3],
  ];

  const dyn = {};
  for (let b = 0; b < 4; b++) dyn[b] = -14;
  for (let b = 4; b < 12; b++) dyn[b] = -6;
  for (let b = 12; b < 20; b++) dyn[b] = 0;
  dyn[17] = 4;
  for (let b = 20; b < 28; b++) dyn[b] = 2;
  dyn[21] = 6;
  for (let b = 28; b < 32; b++) dyn[b] = -12;

  // [bar, beat, len(beats), note, vel] — original motif M: rising triad + stepwise answer
  const mel = [
    // intro: horn-call fifths
    [0, 0, 1, 'A4', 66], [0, 1, 1, 'D5', 68], [0, 2, 1, 'A4', 64],
    [1, 0, 1, 'B4', 66], [1, 1, 1, 'G5', 70], [1, 2, 1, 'D5', 66],
    [2, 0, 1, 'E5', 68], [2, 1, 1, 'G5', 70], [2, 2, 1, 'B5', 72],
    // A
    [4, 0, 1, 'F#5', 78], [4, 1, 1, 'G5', 80], [4, 2, 1, 'A5', 82],
    [5, 0, 2, 'B5', 84], [5, 2, 1, 'A5', 80],
    [6, 0, 1, 'G5', 80], [6, 1, 1, 'F#5', 78], [6, 2, 1, 'E5', 76],
    [7, 0, 3, 'D5', 80],
    [8, 0, 1, 'E5', 78], [8, 1, 1, 'F#5', 80], [8, 2, 1, 'G5', 82],
    [9, 0, 2, 'A5', 84], [9, 2, 1, 'G5', 80],
    [10, 0, 1, 'F#5', 80], [10, 1, 1, 'E5', 78], [10, 2, 1, 'D5', 78],
    [11, 0, 1.5, 'E5', 80], [11, 1.5, 0.5, 'D5', 76], [11, 2, 1, 'C#5', 78],
    // B (B minor quest, dotted rhythms)
    [12, 0, 1, 'B4', 80], [12, 1, 1, 'D5', 82], [12, 2, 1, 'F#5', 84],
    [13, 0, 1.5, 'G5', 86], [13, 1.5, 1, 'F#5', 82], [13, 2.5, 0.5, 'E5', 78],
    [14, 0, 1, 'D5', 80], [14, 1, 1, 'E5', 82], [14, 2, 1, 'F#5', 84],
    [15, 0, 1, 'A5', 86], [15, 1, 1, 'G5', 82], [15, 2, 1, 'F#5', 82],
    [16, 0, 1, 'E5', 82], [16, 1, 1, 'G5', 84], [16, 2, 1, 'A5', 86],
    [17, 0, 2, 'B5', 90], [17, 2, 1, 'A5', 84],
    [18, 0, 1, 'G5', 84], [18, 1, 0.5, 'F#5', 82], [18, 1.5, 0.5, 'E5', 80], [18, 2, 1, 'D5', 80],
    [19, 0, 1.5, 'E5', 82], [19, 1.5, 0.5, 'D5', 78], [19, 2, 1, 'C#5', 80],
    // A' (reprise, lifted)
    [20, 0, 1, 'A5', 84], [20, 1, 1, 'B5', 86], [20, 2, 1, 'D6', 88],
    [21, 0, 1.5, 'D6', 88], [21, 1.5, 1, 'C#6', 86], [21, 2.5, 0.5, 'B5', 82],
    [22, 0, 1, 'A5', 84], [22, 1, 1, 'G5', 82], [22, 2, 1, 'F#5', 82],
    [23, 0, 2, 'E5', 80], [23, 2, 1, 'F#5', 82],
    [24, 0, 1, 'G5', 82], [24, 1, 1, 'A5', 84], [24, 2, 1, 'B5', 86],
    [25, 0, 1.5, 'D6', 88], [25, 1.5, 0.5, 'C#6', 84], [25, 2, 1, 'B5', 82],
    [26, 0, 1, 'A5', 82], [26, 1, 1, 'G5', 80], [26, 2, 1, 'F#5', 80],
    [27, 0, 1, 'E5', 78], [27, 1, 1, 'F#5', 80], [27, 2, 1.4, 'D5', 82],
    // coda: soft recall
    [28, 0, 2, 'G5', 72], [28, 2, 1, 'F#5', 70],
    [29, 0, 2, 'E5', 70], [29, 2, 1, 'D5', 70],
    [30, 0, 3, 'D5', 74],
  ];

  const rh = mel.map(([bar, b, len, n, v]) =>
    hum({ t: T(bar, b), d: len * beatSec * 0.94, p: N(n), v: v + (dyn[bar] ?? 0) }));
  // harp-like rolled sparkle into A, and the closing ascent
  ['D5', 'F#5', 'A5', 'D6', 'F#6'].forEach((n, i) =>
    rh.push({ t: T(3, 0) + i * 0.07, d: 0.8, p: N(n), v: 58 + i * 3 }));
  ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6'].forEach((n, i) =>
    rh.push({ t: T(31, 0) + i * 0.09, d: 3.5, p: N(n), v: 56 + i * 3 }));

  // LH waltz: low root on 1, chord stabs on 2 and 3
  const lh = [];
  for (const [bar, b0, sym, beats] of changes) {
    if (bar === 3 || bar === 31) continue; // sparkles cover these
    const root = chord(sym, { bass: true, bassOctave: 1 })[0] + 12;
    const tones = chord(sym, { voicing: 'close', center: 55 }).slice(0, 3);
    const d = dyn[bar] ?? 0;
    lh.push(hum({ t: T(bar, b0), d: beatSec * 1.1, p: root, v: 72 + d }));
    lh.push(hum({ t: T(bar, b0), d: beatSec, p: root + 7, v: 60 + d }));
    [[1, 56], [2, 54]].forEach(([b, vel]) =>
      tones.forEach((p, i) => lh.push(hum({ t: T(bar, b0 + b) + i * 0.008, d: beatSec * 0.7, p, v: vel + d }))));
  }
  // final held tonic under the closing ascent
  chord('D', { voicing: 'spread', center: 45 }).forEach((p, i) =>
    lh.push({ t: T(31, 0) + i * 0.02, d: 5.5, p, v: 60 }));

  const cc = [];
  for (let bar = 0; bar < BARS; bar++) {
    cc.push({ t: T(bar, 0), n: 64, v: 96 });
    cc.push({ t: T(bar, 2.85), n: 64, v: 12 });
  }

  const duration = T(31, 0) + 6.0;
  return {
    sampleRate: 48000, duration, tempo: tm.scoreTempo(),
    tracks: [
      { id: 'piano', ...gm(0), notes: [...lh, ...rh], cc, gain: -3, pan: 0, reverb: 0.32, eq: [{ type: 'hp', freq: 40 }] },
    ],
    mix: {
      fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.8, predelay: 0.02, return: 'music' } },
      master: { targetLUFS: -14, ceiling: -1, fadeOut: 2.0 },
    },
  };
}
