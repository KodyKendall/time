// audio/scores/starlight_lullaby.mjs — "Starlight Lullaby", an ORIGINAL gentle lullaby
// for solo piano. Same mood family as a fantasy lullaby (slow rocking 3/4, soft high
// piano, music-box calm) with an all-new melody — it does not quote any existing tune.
// Form: A (8 bars, F major: I–vi–IV–I / V–I) | B (8 bars, gentle lift through ii–V)
// | outro (4 bars, fading recall). LH rocks sparsely: low root on 1, single soft
// chord tones on 2 and 3.
import { midi as N, chord, tempoMap, humanizer } from '../lib/music.mjs';

export default function starlightLullaby() {
  const BARS = 20;
  const tm = tempoMap([
    { beat: 0, bpm: 80 },
    { beat: 48, bpm: 80 },
    { beat: 60, bpm: 66, ramp: true },
  ]);
  const T = (bar, beat = 0) => tm.beat(bar * 3 + beat); // 3/4
  const beatSec = 60 / 80;
  const hum = humanizer(12, { time: 0.007, vel: 4 });
  const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });

  // [bar, beat, chord, beats]
  const changes = [
    [0, 0, 'F', 3], [1, 0, 'Dm', 3], [2, 0, 'Bb', 3], [3, 0, 'F', 3],
    [4, 0, 'C', 3], [5, 0, 'F', 3], [6, 0, 'Dm', 3], [7, 0, 'C7', 3],
    [8, 0, 'F', 3], [9, 0, 'Bb', 3], [10, 0, 'F', 3], [11, 0, 'C', 3],
    [12, 0, 'Dm', 3], [13, 0, 'Gm', 3], [14, 0, 'C7', 3], [15, 0, 'F', 3],
    [16, 0, 'F', 3], [17, 0, 'Bb', 3], [18, 0, 'F', 3], [19, 0, 'F', 3],
  ];

  const dyn = {};
  for (let b = 0; b < 8; b++) dyn[b] = -10;
  for (let b = 8; b < 14; b++) dyn[b] = -6;
  dyn[14] = -4; dyn[15] = -6;
  for (let b = 16; b < 20; b++) dyn[b] = -14;

  // [bar, beat, len(beats), note, vel] — original rocking melody, stepwise, resolves gently
  const mel = [
    [0, 0, 1, 'C5', 72], [0, 1, 1, 'A4', 68], [0, 2, 1, 'F4', 68],
    [1, 0, 1.5, 'G4', 70], [1, 1.5, 0.5, 'A4', 70], [1, 2, 1, 'D5', 74],
    [2, 0, 1, 'C5', 72], [2, 1, 1, 'Bb4', 70], [2, 2, 1, 'A4', 70],
    [3, 0, 2.5, 'G4', 70], [3, 2.5, 0.5, 'A4', 68],
    [4, 0, 1, 'G4', 70], [4, 1, 1, 'E4', 68], [4, 2, 1, 'C5', 72],
    [5, 0, 1.5, 'D5', 74], [5, 1.5, 0.5, 'C5', 70], [5, 2, 1, 'A4', 70],
    [6, 0, 1, 'Bb4', 70], [6, 1, 1, 'A4', 70], [6, 2, 1, 'G4', 68],
    [7, 0, 2, 'A4', 70], [7, 2, 1, 'G4', 68],
    [8, 0, 1, 'A4', 72], [8, 1, 1, 'C5', 74], [8, 2, 1, 'F5', 78],
    [9, 0, 1.5, 'E5', 76], [9, 1.5, 0.5, 'D5', 72], [9, 2, 1, 'C5', 72],
    [10, 0, 1, 'D5', 74], [10, 1, 1, 'C5', 72], [10, 2, 1, 'A4', 70],
    [11, 0, 2, 'G4', 72], [11, 2, 1, 'E4', 68],
    [12, 0, 1, 'F4', 68], [12, 1, 1, 'G4', 70], [12, 2, 1, 'A4', 72],
    [13, 0, 1.5, 'Bb4', 74], [13, 1.5, 0.5, 'A4', 70], [13, 2, 1, 'G4', 70],
    [14, 0, 1, 'A4', 72], [14, 1, 1, 'B4', 72], [14, 2, 1, 'C5', 74],
    [15, 0, 3, 'D5', 74],
    [16, 0, 1, 'C5', 70], [16, 1, 1, 'A4', 68], [16, 2, 1, 'F4', 68],
    [17, 0, 2, 'G4', 68], [17, 2, 1, 'A4', 68],
    [18, 0, 1, 'G4', 68], [18, 1, 1, 'F4', 66], [18, 2, 1, 'E4', 66],
    [19, 0, 2.6, 'F4', 68],
  ];

  const rh = mel.map(([bar, b, len, n, v]) =>
    hum({ t: T(bar, b), d: len * beatSec * 0.94, p: N(n), v: v + (dyn[bar] ?? 0) }));
  // closing music-box sparkle: soft high tonic arpeggio
  ['F5', 'A5', 'C6', 'F6'].forEach((n, i) =>
    rh.push({ t: T(19, 0) + 0.3 + i * 0.12, d: 2.5, p: N(n), v: 58 - i * 3 }));

  // LH: sparse rocking — root on 1, single soft tones on 2 and 3
  const lh = [];
  for (const [bar, b0, sym, beats] of changes) {
    if (bar === 19) continue;
    const root = chord(sym, { bass: true, bassOctave: 1 })[0] + 12;
    const tones = chord(sym, { voicing: 'close', center: 57 }).slice(0, 3);
    const d = dyn[bar] ?? 0;
    lh.push(hum({ t: T(bar, b0), d: beatSec * 1.4, p: root, v: 64 + d }));
    lh.push(hum({ t: T(bar, b0 + 1), d: beatSec * 0.8, p: tones[1] ?? tones[0], v: 50 + d }));
    lh.push(hum({ t: T(bar, b0 + 2), d: beatSec * 0.8, p: tones[0], v: 48 + d }));
  }
  chord('F', { voicing: 'spread', center: 45 }).forEach((p, i) =>
    lh.push({ t: T(19, 0) + i * 0.03, d: 5.0, p, v: 56 }));

  const cc = [];
  for (let bar = 0; bar < BARS; bar++) {
    cc.push({ t: T(bar, 0), n: 64, v: 92 });
    cc.push({ t: T(bar, 2.8), n: 64, v: 12 });
  }

  const duration = T(19, 0) + 6.0;
  return {
    sampleRate: 48000, duration, tempo: tm.scoreTempo(),
    tracks: [
      { id: 'piano', ...gm(0), notes: [...lh, ...rh], cc, gain: -4, pan: 0, reverb: 0.45, eq: [{ type: 'hp', freq: 40 }] },
    ],
    mix: {
      fx: { reverb: { type: 'reverb', preset: 'hall', decay: 3.6, predelay: 0.025, return: 'music' } },
      master: { targetLUFS: -16, ceiling: -1, fadeOut: 2.5 },
    },
  };
}
