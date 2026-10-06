// audio/scores/melancholy.mjs — original melancholic piece for piano + strings,
// composed from scratch with audio/score/theory.mjs helpers.
//
//   node audio/render.mjs audio/scores/melancholy.mjs audio/build/melancholy.wav
//
// Story arc (D minor, ~63 BPM, 36 bars, ~2.5 min):
//   Bars  0-7  LONELINESS — sparse solo piano, high and quiet. Dm9 … A7.
//   Bars  8-15 MEMORY — strings enter; a warmer F-major-tinted phrase, as if remembering.
//   Bars 16-23 LOSS — chromatic bass descent (D C# C B), harmony darkens to A7b9,
//                    dynamics swell to a single high cry (bar 22-23).
//   Bars 24-35 ACCEPTANCE — fragments of the opening, ritardando, final Dm(add9) whisper.
//
// Theory devices: secondary leading tones (C# -> D throughout), appoggiatura sighs
// (Bb-A, E-D), borrowed major-IV warmth (Bb/F), half-diminished passing (Gm7b5),
// flat-nine tension at the climax (A7b9), bittersweet Dm(Maj7), voice-led pads via
// keysVoicing(), and time-stretched final bars (notated ritardando).
import { midi as N, chord, keysVoicing, seeded } from '../score/theory.mjs';

const BPM = 63;
const BEAT = 60 / BPM;
const rand = seeded(11);

// Notated ritardando: last six bars stretch wider and wider.
const stretch = (bar) => (bar < 30 ? 1 : [1.08, 1.15, 1.25, 1.4, 1.7, 2.2][bar - 30]);
const barStarts = [0];
for (let b = 1; b <= 36; b++) barStarts.push(barStarts[b - 1] + 4 * BEAT * stretch(b - 1));
const T = (bar, beat = 0) => barStarts[bar] + beat * BEAT * stretch(bar);
const D = (bar, beats) => beats * BEAT * stretch(bar);

const PROG = [
  'Dm9', 'Dm9/C', 'Gm7', 'Gm7/Bb', 'Bbmaj9', 'Bbmaj9', 'Asus4', 'A7',          // loneliness
  'F', 'F/A', 'Bb', 'Bb', 'Gm7', 'Gm7', 'Asus4', 'A7',                          // memory
  'Dm', 'Dm/C#', 'Dm/C', 'Dm/B', 'Bb', 'Gm7b5', 'A7b9', 'A7b9',                  // loss
  'Dm9', 'Gm7', 'Bbmaj9', 'F/A', 'Gm7', 'Asus4', 'Dm9', 'DmMaj7',                // acceptance
  'Gm7', 'Asus4', 'A7', 'Dm9',                                               // farewell
];

const piano = [];
const strings = [];
const pianoCC = [];
const stringsCC = [];
let prevPiano = null, prevStrings = null;

// ---- left hand: low root + broken-chord sighs (density follows the arc) ----
const density = (bar) => (bar < 8 ? 'sparse' : bar < 16 ? 'medium' : bar < 24 ? 'full' : bar < 30 ? 'medium' : 'sparse');
const lhVel = (bar) => (bar < 8 ? 52 : bar < 16 ? 60 : bar < 24 ? 68 : bar < 30 ? 60 : 50);
PROG.forEach((sym, bar) => {
  if (bar === 35) return; // final bar handled as a fermata chord below
  const c = chord(sym);
  const low = N('D2') + (((c.bass - 2) % 12 + 12) % 12);
  piano.push({ t: T(bar, 0), d: D(bar, 3.4), p: low, v: lhVel(bar) + 6 });
  const vox = keysVoicing(sym, 57, prevPiano);
  prevPiano = vox;
  const beats = density(bar) === 'sparse' ? [2] : density(bar) === 'medium' ? [1, 2.5] : [1, 2, 3];
  beats.forEach((b, i) => {
    const p = vox[i % vox.length];
    piano.push({ t: T(bar, b) + (rand() - 0.5) * 0.01, d: D(bar, 1.3), p, v: lhVel(bar) - 8 });
  });
  pianoCC.push({ t: T(bar, 0), n: 64, v: 88 });
  pianoCC.push({ t: T(bar, 3.7), n: 64, v: 30 });
});

// ---- right hand: the lament ----
const MEL = [
  [0, 0, 4, 'A4', 54], [1, 0, 3, 'Bb4', 52], [1, 3, 1, 'A4', 50],
  [2, 0, 4, 'G4', 52], [3, 0, 2, 'F4', 50], [3, 2, 2, 'E4', 50],
  [4, 0, 3, 'F4', 54], [4, 3, 1, 'G4', 52], [5, 0, 4, 'A4', 56],
  [6, 0, 2, 'G4', 54], [6, 2, 2, 'E4', 52], [7, 0, 3, 'E4', 54], [7, 3, 1, 'C#4', 52],
  [8, 0, 4, 'F4', 62], [9, 0, 3, 'G4', 64], [9, 3, 1, 'A4', 62],
  [10, 0, 2, 'Bb4', 66], [10, 2, 2, 'A4', 64], [11, 0, 4, 'G4', 62],
  [12, 0, 3, 'A4', 64], [12, 3, 1, 'C5', 66], [13, 0, 2, 'Bb4', 66], [13, 2, 2, 'G4', 62],
  [14, 0, 2, 'A4', 64], [14, 2, 2, 'G4', 62], [15, 0, 3, 'E4', 64], [15, 3, 1, 'C#4', 62],
  [16, 0, 4, 'D4', 68], [17, 0, 3, 'E4', 70], [17, 3, 1, 'F4', 70],
  [18, 0, 2, 'G4', 72], [18, 2, 2, 'A4', 74], [19, 0, 4, 'Bb4', 76],
  [20, 0, 3, 'A4', 78], [20, 3, 1, 'G4', 76], [21, 0, 2, 'F4', 78], [21, 2, 2, 'E4', 80],
  [22, 0, 3, 'D5', 88], [22, 3, 1, 'C5', 86],
  [23, 0, 2, 'Bb4', 90], [23, 2, 1.5, 'A4', 88], [23, 3.5, 0.5, 'G#4', 80],
  [24, 0, 4, 'A4', 64], [25, 0, 3, 'G4', 62], [25, 3, 1, 'F4', 60],
  [26, 0, 4, 'F4', 62], [27, 0, 2, 'E4', 60], [27, 2, 2, 'D4', 58],
  [28, 0, 3, 'E4', 60], [28, 3, 1, 'F4', 58], [29, 0, 4, 'E4', 56],
  [30, 0, 3, 'D4', 56], [30, 3, 1, 'C#4', 52], [31, 0, 4, 'D4', 54],
  [32, 0, 2, 'F4', 52], [32, 2, 2, 'E4', 50], [33, 0, 4, 'D4', 48],
  [34, 0, 3, 'C#4', 46], [34, 3, 1, 'D4', 44],
];
for (const [bar, beat, dur, n, v] of MEL) {
  piano.push({ t: T(bar, beat) + (rand() - 0.5) * 0.012, d: D(bar, dur) * 0.95, p: N(n), v });
}

// ---- strings: enter at Memory, swell to the cry, dissolve at Farewell ----
const stringVel = (bar) =>
  bar < 12 ? 50 : bar < 16 ? 58 : bar < 20 ? 66 : bar < 24 ? 76 : bar < 28 ? 62 : bar < 32 ? 52 : 40;
PROG.forEach((sym, bar) => {
  if (bar < 8 || bar === 35) return;
  const pad = keysVoicing(sym, 58, prevStrings);
  prevStrings = pad;
  pad.forEach((p, i) =>
    strings.push({ t: T(bar, 0) + i * 0.02, d: D(bar, 3.7), p, v: stringVel(bar) - (pad.length - 1 - i) * 2 }));
});
// strings double the cry an octave below (a grief chorus, bars 22-23)
for (const [bar, beat, dur, n, v] of MEL.filter(([b]) => b === 22 || b === 23)) {
  strings.push({ t: T(bar, beat), d: D(bar, dur) * 0.95, p: N(n) - 12, v: Math.round(v * 0.55) });
}
// expression swells across the Loss section into the climax
stringsCC.push({ t: T(16, 0), n: 11, v: 70 }, { t: T(23, 0), n: 11, v: 110, ramp: true });
stringsCC.push({ t: T(24, 0), n: 11, v: 90 }, { t: T(35, 0), n: 11, v: 48, ramp: true });

// ---- farewell fermata: Dm(add9) whispered, piano + strings ----
{
  const toll = ['D2', 'D3', 'F3', 'A3', 'D4', 'E4'];
  toll.forEach((n, i) => piano.push({ t: T(35, 0) + i * 0.03, d: 7.0, p: N(n), v: 46 - Math.max(0, i - 3) * 4 }));
  keysVoicing({ sym: 'Dm(add9)', root: 2, iv: [0, 3, 7, 14], q: 'madd9', bass: 2 }, 58, prevStrings).forEach((p, i) =>
    strings.push({ t: T(35, 0) + i * 0.03, d: 7.0, p, v: 34 }));
  pianoCC.push({ t: T(35, 0), n: 64, v: 100 });
  pianoCC.push({ t: T(35, 0) + 6.5, n: 64, v: 0 });
}

piano.sort((a, b) => a.t - b.t);
strings.sort((a, b) => a.t - b.t);

const duration = T(35, 0) + 8.0;

export default {
  sampleRate: 48000,
  duration,
  tempo: [{ t: 0, bpm: BPM }],
  tracks: [
    { id: 'piano', sf: 'gm', bank: 0, program: 0, notes: piano, cc: pianoCC, gain: -4, pan: -0.05, reverb: 0.3, eq: [{ type: 'hp', freq: 38 }] },
    { id: 'strings', sf: 'gm', bank: 0, program: 49, notes: strings, cc: stringsCC, gain: -9, pan: 0.1, reverb: 0.38, eq: [{ type: 'hp', freq: 90 }] },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 3.2, predelay: 0.03, return: 'music' } },
    master: { targetLUFS: -14, ceiling: -1, fadeOut: 4 },
  },
};
