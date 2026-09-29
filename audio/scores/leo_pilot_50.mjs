// audio/scores/leo_pilot_50.mjs — "Leo" pilot, 50-second cut (v5). Same tune as leo_pilot.mjs
// (same tempo, instruments, motif and chord colours); each section is 6 bars instead of 4, plus
// a 2-bar ending, so the picture has time to be understood (Darren, 2026-09-28).
// 96 BPM, 4/4 -> 1 bar = 2.5 s. 20 bars = 50 s. Cue sheet: docs/leo/PILOT.md, "v5".
//   bars 0-5   the sheet      (marimba on every half bar = one sheet event per note)
//   bars 6-11  Leo reads it   (flute motif at bar 6, vibes answer at bar 8)
//   bars 12-17 the app        (flute + vibes motif at bar 12, glock per app part)
//   bars 18-19 ending         (flute motif under the tagline, celesta "Le-O!" tag, loops)
import { midi as N, chord, humanizer } from '../lib/music.mjs';

const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
const hum = humanizer(11, { time: 0.008, vel: 7 });
const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });

const SHEET = 0, LEO = 6, APP = 12, END = 18, BARS = 20;
const CHANGES = [
  ['Cmaj7'], ['Am7'], ['Cmaj7'], ['Am7'], ['Fmaj7'], ['G7sus4'],              // 0-5   the sheet
  ['Fmaj9'], ['Em7', 'Am7'], ['Fmaj9'], ['Em7', 'Am7'], ['Dm9'], ['G13sus'],  // 6-11  Leo reads it
  ['Cmaj9'], ['Am9'], ['Fmaj9'], ['Cmaj9'], ['Am9'], ['Fmaj9'],              // 12-17 the app
  ['Cmaj9'], ['Cmaj9'],                                                       // 18-19 ending
];

const notes = (list) => list.map((n) => hum({ ...n }));

// Leo's motif ("Le-O!"): C5 -> A5 | G5 E5 D5 C5
function motif(bar, { oct = 0, v = 84, beat = 0 } = {}) {
  const o = oct * 12;
  return [
    { t: T(bar, beat), d: BEAT * 0.9, p: N('C5') + o, v: v - 6 },
    { t: T(bar, beat + 1), d: BEAT * 1.8, p: N('A5') + o, v },
    { t: T(bar, beat + 3), d: BEAT * 0.5, p: N('G5') + o, v: v - 8 },
    { t: T(bar, beat + 3.5), d: BEAT * 0.5, p: N('E5') + o, v: v - 10 },
    { t: T(bar + 1, beat), d: BEAT * 0.9, p: N('D5') + o, v: v - 8 },
    { t: T(bar + 1, beat + 1), d: BEAT * 2.5, p: N('C5') + o, v: v - 4 },
  ];
}
const call = (bar, beat, oct = 0, v = 78) => [
  { t: T(bar, beat), d: BEAT * 0.6, p: N('C5') + oct * 12, v: v - 6 },
  { t: T(bar, beat + 1), d: BEAT * 1.5, p: N('A5') + oct * 12, v },
];

const pizz = [], marimba = [], pad = [], bass = [], brushes = [], glock = [];

CHANGES.forEach((chs, bar) => {
  chs.forEach((sym, k) => {
    const beats = chs.length === 1 ? 4 : 2;
    const b0 = k * 2;
    const tones = chord(sym, { voicing: 'close', center: 64 });
    const root = chord(sym, { bass: true, bassOctave: 2 })[0];
    if (bar >= LEO) for (const p of tones) pad.push({ t: T(bar, b0), d: beats * BEAT, p, v: bar >= APP ? 62 : 54 });
    if (bar >= LEO) {
      bass.push({ t: T(bar, b0), d: BEAT * 1.8, p: root, v: 88 });
      bass.push({ t: T(bar, b0 + beats / 2), d: BEAT * 1.6, p: root + (bar >= APP ? 7 : 12), v: 76 });
    }
    if (bar < APP) for (let e = 0; e < beats * 2; e++) {
      const p = e % 2 ? root + 19 : root + 12;
      pizz.push({ t: T(bar, b0 + e / 2), d: BEAT * 0.3, p, v: e % 2 ? 58 : 70 });
    }
    // The sheet: one marimba note per half bar = one sheet event (grid, header, rows, total, swirl).
    const step = bar < LEO ? 2 : 0.5;
    const arp = [...tones, tones[1] + 12];
    for (let i = 0, b = 0; b < beats; b += step, i++) {
      marimba.push({ t: T(bar, b0 + b), d: BEAT * (bar < LEO ? 0.9 : 0.4), p: arp[(i + bar) % arp.length] + 12, v: bar >= APP ? 74 : bar < LEO ? 66 : 62 });
    }
  });
});

for (let bar = LEO; bar < BARS; bar++) {
  for (let b = 0; b < 4; b++) brushes.push({ t: T(bar, b), d: BEAT, p: 40, v: 50 });
  brushes.push({ t: T(bar, 1), d: 0.2, p: 38, v: 64 }, { t: T(bar, 3), d: 0.2, p: 38, v: 66 });
}
// One glock sparkle per app part unfolding (bars 12-14.5), and one under the tagline.
[[APP, 0], [APP, 2], [APP + 1, 0], [APP + 1, 2], [APP + 2, 0], [APP + 2, 2], [END, 0]].forEach(([bar, b], i) => {
  glock.push({ t: T(bar, b), d: BEAT, p: [N('E6'), N('G6'), N('A6'), N('C7'), N('D7'), N('E7'), N('C7')][i], v: i === 6 ? 60 : 70 });
});

// Blue dot born on the first call (bar 3), blinks on each A5; the loop tag on the last bar.
const celesta = [...call(3, 0), ...call(3, 2.5, 0, 70), ...call(END + 1, 1, 0, 72)];
const flute = [...motif(LEO, { v: 88 }), ...motif(APP, { v: 92 }), ...motif(END, { v: 78 })];
const vibes = [...motif(LEO + 2, { oct: -1, v: 70 }), ...motif(APP, { oct: -1, v: 72 })];

export default {
  sampleRate: 48000,
  duration: 52,
  tempo: [{ t: 0, bpm: BPM }],
  tracks: [
    { id: 'pad', ...gm(49), notes: pad, gain: -12, pan: 0, reverb: 0.4, width: 1,
      cc: [{ t: T(LEO), n: 11, v: 30 }, { t: T(APP - 1, 3), n: 11, v: 110, ramp: true }, { t: T(APP), n: 11, v: 90 }, { t: T(BARS - 1), n: 11, v: 90 }, { t: T(BARS), n: 11, v: 55, ramp: true }] },
    { id: 'pizz', ...gm(45), notes: notes(pizz), gain: -8, pan: -0.25, reverb: 0.2 },
    { id: 'marimba', ...gm(12), notes: notes(marimba), gain: -7, pan: 0.3, reverb: 0.25 },
    { id: 'bass', ...gm(32), notes: notes(bass), gain: -5, pan: 0, reverb: 0.08 },
    { id: 'brush', ...gm(40, { drums: true }), notes: notes(brushes), gain: -9, reverb: 0.12 },
    { id: 'celesta', ...gm(8), notes: celesta, gain: -4, pan: 0.15, reverb: 0.4 },
    { id: 'flute', ...gm(73), notes: flute, gain: -3, pan: 0.05, reverb: 0.3, delay: 0.06 },
    { id: 'vibes', ...gm(11), notes: vibes, gain: -7, pan: -0.2, reverb: 0.35 },
    { id: 'glock', ...gm(9), notes: glock, gain: -9, pan: 0.35, reverb: 0.45 },
    { id: 'whoosh', type: 'sfx', events: [{ t: T(LEO) - 0.9, fx: 'whoosh', params: { dur: 1.2 } }], gain: -14 },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.4, return: 'music' } },
    master: { targetLUFS: -16, ceiling: -1 },
  },
};
