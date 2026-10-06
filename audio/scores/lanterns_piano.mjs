// audio/scores/lanterns_piano.mjs — solo piano rendition of "Lanterns in the Pavilion".
// Same harmony/motif as lanterns.mjs, voiced for two hands on a grand (GM 0).
import { midi as N, chord, tempoMap, swing, humanizer } from '../lib/music.mjs';

export default function lanternsPiano() {
  const BPM = 84;
  const tm = tempoMap([{ beat: 0, bpm: BPM }]);
  const SW = 0.52; // nearly straight ballad feel
  const T = (bar, beat = 0) => tm.beat(bar * 4 + swing(beat, SW, 0.25));
  const beatSec = 60 / BPM;
  const hum = humanizer(9, { time: 0.006, vel: 5 });
  const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });

  const prog = [
    'Fmaj9', 'Em7b5', 'A7b9', 'Dm9', 'Dbmaj9#11', 'Cmaj9',
    'Bbmaj9', 'Bbm9', 'Eb13', 'Abmaj9', 'Gm9', 'C13sus',
    'Fmaj9', 'D7alt', 'Fmaj9',
  ];
  const END = 14;
  const duration = T(END) + 6.0;

  // Same lead melody as lanterns.mjs: [bar, beat, len(beats), note, vel]
  const mel = [
    [0, 0, 1.4, 'C5', 80], [0, 1.5, 0.4, 'F5', 84], [0, 2, 0.5, 'E5', 74], [0, 2.5, 1.2, 'D5', 78],
    [1, 0, 0.5, 'E5', 76], [1, 0.5, 0.5, 'G5', 80], [1, 1, 1.5, 'Bb4', 78], [1, 2.5, 0.5, 'A4', 74], [1, 3, 0.75, 'C5', 80],
    [2, 0, 1.2, 'C#5', 82], [2, 1.25, 0.4, 'D5', 76], [2, 1.75, 0.5, 'E5', 74], [2, 2.5, 1.25, 'A4', 80],
    [3, 0, 0.6, 'D5', 82], [3, 0.6, 0.4, 'F5', 84], [3, 1, 1.6, 'A5', 88], [3, 2.75, 1, 'G5', 80],
    [4, 0, 1.8, 'Ab5', 90], [4, 2, 0.5, 'G5', 80], [4, 2.5, 0.5, 'F5', 78], [4, 3, 0.8, 'Eb5', 80],
    [5, 0, 1.4, 'E5', 82], [5, 1.5, 0.5, 'G5', 80], [5, 2, 1.5, 'B4', 84],
    [6, 0, 0.6, 'C5', 80], [6, 0.6, 0.4, 'F5', 82], [6, 1, 1.8, 'A5', 86], [6, 3, 0.75, 'G5', 78],
    [7, 0, 0.5, 'Bb4', 78], [7, 0.5, 0.5, 'Db5', 82], [7, 1, 1.6, 'C5', 84], [7, 2.75, 1, 'Bb4', 76],
    [8, 0, 1.2, 'Bb4', 80], [8, 1.25, 0.5, 'Eb5', 84], [8, 1.75, 0.5, 'G5', 82], [8, 2.5, 1.25, 'F5', 84],
    [9, 0, 2.0, 'G5', 86], [9, 2, 0.5, 'F5', 78], [9, 2.5, 1.2, 'Eb5', 80],
    [10, 0, 0.6, 'G5', 82], [10, 0.6, 0.4, 'A5', 84], [10, 1, 1.2, 'Bb5', 88], [10, 2.25, 0.5, 'A5', 80], [10, 2.75, 1, 'G5', 78],
    [11, 0, 1.6, 'A5', 84], [11, 1.75, 0.5, 'G5', 76], [11, 2.25, 0.5, 'E5', 76], [11, 2.75, 1, 'D5', 78],
    [12, 0, 1.4, 'C5', 82], [12, 1.5, 0.5, 'F5', 86], [12, 2, 0.5, 'A5', 84], [12, 2.5, 1.25, 'G5', 82],
    [13, 0, 0.5, 'A5', 82], [13, 0.5, 0.5, 'G#5', 78], [13, 1, 0.5, 'G5', 80], [13, 1.5, 0.5, 'F#5', 78], [13, 2, 1.5, 'G5', 82],
    [END, 0, 3.4, 'F5', 86],
  ];

  const rh = [];
  for (const [bar, b, len, n, v] of mel) {
    rh.push(hum({ t: T(bar, b), d: len * beatSec * 0.96, p: N(n), v }));
  }
  // Tag shimmer: rolled chord tones above the final melody note
  ['A5', 'C6', 'F6'].forEach((n, i) => rh.push({ t: T(END) + 0.25 + i * 0.09, d: 2.5, p: N(n), v: 62 - i * 4 }));

  // Left hand: low root on 1, warm close-voiced chords, gentle anticipation pushes
  const lh = [];
  prog.forEach((sym, bar) => {
    const root = chord(sym, { bass: true, bassOctave: 1 })[0] + 12; // put it in the F1–C3 area
    const tones = chord(sym, { voicing: 'close', center: 55 });
    if (bar === END) {
      lh.push({ t: T(bar), d: 4.5, p: root - 12, v: 72 });
      tones.forEach((p, i) => lh.push({ t: T(bar) + 0.02 + i * 0.03, d: 4.5, p, v: 60 - i * 2 }));
      return;
    }
    lh.push(hum({ t: T(bar, 0), d: beatSec * 1.8, p: root, v: 74 }));
    lh.push(hum({ t: T(bar, 0), d: beatSec * 1.6, p: root + 7, v: 62 }));
    for (const [b, len, vel] of [[0, 1.2, 58], [1.75, 0.5, 52], [2.5, 1.0, 56]]) {
      tones.forEach((p, i) => lh.push(hum({ t: T(bar, b) + i * 0.008, d: len * beatSec, p, v: vel - i * 2 })));
    }
  });

  // Sustain pedal: down on each downbeat, release at end of bar
  const cc = [];
  prog.forEach((sym, bar) => {
    cc.push({ t: T(bar, 0), n: 64, v: 100 });
    cc.push({ t: T(bar, 3.5), n: 64, v: 20 });
  });
  cc.push({ t: T(END), n: 64, v: 110 });
  cc.push({ t: T(END) + 4.6, n: 64, v: 0 });

  return {
    sampleRate: 48000, duration, tempo: tm.scoreTempo(),
    tracks: [
      { id: 'piano', ...gm(0), notes: [...lh, ...rh], cc, gain: -3, pan: 0, reverb: 0.32, eq: [{ type: 'hp', freq: 40 }] },
    ],
    mix: {
      fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.8, predelay: 0.02, return: 'music' } },
      master: { targetLUFS: -14, ceiling: -1, fadeOut: 1.5 },
    },
  };
}
