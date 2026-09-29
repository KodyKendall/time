// audio/scores/leo_pilot.mjs — "Leo" pilot, original score (first sketch).
// 96 BPM, 4/4 -> 1 bar = 2.5 s. 12 bars = 30 s. Cue sheet: docs/leo/cue_sheet.md.
// Uses ONLY GeneralUser GS ('gm', 31 MB) so it renders on a small box. Swap in the dedicated
// instruments from audio/INSTRUMENTS.md (jRhodes3, VCSL vibes, Meatbass...) once the tune is right.
//
// Leo's motif ("Le-O!"): a leap up a major sixth, then a falling answer that lands home.
//   C5 -> A5 | G5 E5 D5 C5
import { midi as N, chord, humanizer } from '../lib/music.mjs';

const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
const hum = humanizer(11, { time: 0.008, vel: 7 });
const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });

// Harmony, one chord per bar (bar 5 has two).
const CHANGES = [
  ['Cmaj7'], ['Am7'], ['Fmaj7'], ['G7sus4'],          // 0-3  the spreadsheet
  ['Fmaj9'], ['Em7', 'Am7'], ['Dm9'], ['G13sus'],    // 4-7  Leo forms
  ['Cmaj9'], ['Am9'], ['Fmaj9'], ['Cmaj9'],           // 8-11 the app blooms
];

const notes = (list) => list.map((n) => hum({ ...n }));

// ---- Leo's motif, placed at a bar with an octave shift
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
// Only the "Le-O!" call (the eye blinks)
const call = (bar, beat, oct = 0, v = 78) => [
  { t: T(bar, beat), d: BEAT * 0.6, p: N('C5') + oct * 12, v: v - 6 },
  { t: T(bar, beat + 1), d: BEAT * 1.5, p: N('A5') + oct * 12, v },
];

// ---- tracks
const pizz = [];    // ledger "ticking": pizzicato root/fifth eighths, bars 0-7
const marimba = []; // cells appearing: broken-chord 8ths
const pad = [];     // strings pad
const bass = [];
const brushes = [];
const glock = [];

CHANGES.forEach((chs, bar) => {
  chs.forEach((sym, k) => {
    const beats = chs.length === 1 ? 4 : 2;
    const b0 = k * 2;
    const tones = chord(sym, { voicing: 'close', center: 64 });
    const root = chord(sym, { bass: true, bassOctave: 2 })[0];
    // pad from bar 4 on
    if (bar >= 4) for (const p of tones) pad.push({ t: T(bar, b0), d: beats * BEAT, p, v: bar >= 8 ? 62 : 54 });
    // bass: half notes from bar 4, walking-ish from 8
    if (bar >= 4) {
      bass.push({ t: T(bar, b0), d: BEAT * 1.8, p: root, v: 88 });
      bass.push({ t: T(bar, b0 + beats / 2), d: BEAT * 1.6, p: root + (bar >= 8 ? 7 : 12), v: 76 });
    }
    // pizz ticks, bars 0-7
    if (bar < 8) for (let e = 0; e < beats * 2; e++) {
      const p = e % 2 ? root + 19 : root + 12;
      pizz.push({ t: T(bar, b0 + e / 2), d: BEAT * 0.3, p, v: e % 2 ? 58 : 70 });
    }
    // marimba broken chord: sparse in 0-3 (one "cell" per beat), full 8ths from 8
    const step = bar < 4 ? 1 : bar < 8 ? 0.5 : 0.5;
    const arp = [...tones, tones[1] + 12];
    for (let i = 0, b = 0; b < beats; b += step, i++) {
      if (bar < 4 && i % 2 === 1 && bar < 2) continue; // the sheet fills in slowly
      marimba.push({ t: T(bar, b0 + b), d: BEAT * 0.4, p: arp[i % arp.length] + 12, v: bar >= 8 ? 74 : 62 });
    }
  });
});

// Brushes from bar 4: swirl (40) every beat, tap (38) on 2 and 4
for (let bar = 4; bar < 12; bar++) {
  for (let b = 0; b < 4; b++) brushes.push({ t: T(bar, b), d: BEAT, p: 40, v: 50 });
  brushes.push({ t: T(bar, 1), d: 0.2, p: 38, v: 64 }, { t: T(bar, 3), d: 0.2, p: 38, v: 66 });
}
// Glock sparkles: one per app card unfolding (bars 8-10, every 2 beats)
[[8, 0], [8, 2], [9, 0], [9, 2], [10, 0], [10, 2]].forEach(([bar, b], i) => {
  glock.push({ t: T(bar, b), d: BEAT, p: [N('E6'), N('G6'), N('A6'), N('C7'), N('D7'), N('E7')][i], v: 70 });
});

const celesta = [...call(2, 0), ...call(2, 2.5, 0, 70), ...call(11, 1, 0, 72)]; // blinks, and the loop tag
const flute = [...motif(4, { v: 88 }), ...motif(8, { v: 92 })];
const vibes = [...motif(6, { oct: -1, v: 70 }), ...motif(8, { oct: -1, v: 72 })];

export default {
  sampleRate: 48000,
  duration: 32,
  tempo: [{ t: 0, bpm: BPM }],
  tracks: [
    { id: 'pad', ...gm(49), notes: pad, gain: -12, pan: 0, reverb: 0.4, width: 1, cc: [{ t: T(4), n: 11, v: 30 }, { t: T(7, 3), n: 11, v: 110, ramp: true }, { t: T(8), n: 11, v: 90 }] },
    { id: 'pizz', ...gm(45), notes: notes(pizz), gain: -8, pan: -0.25, reverb: 0.2 },
    { id: 'marimba', ...gm(12), notes: notes(marimba), gain: -7, pan: 0.3, reverb: 0.25 },
    { id: 'bass', ...gm(32), notes: notes(bass), gain: -5, pan: 0, reverb: 0.08 },
    { id: 'brush', ...gm(40, { drums: true }), notes: notes(brushes), gain: -9, reverb: 0.12 },
    { id: 'celesta', ...gm(8), notes: celesta, gain: -4, pan: 0.15, reverb: 0.4 },
    { id: 'flute', ...gm(73), notes: flute, gain: -3, pan: 0.05, reverb: 0.3, delay: 0.06 },
    { id: 'vibes', ...gm(11), notes: vibes, gain: -7, pan: -0.2, reverb: 0.35 },
    { id: 'glock', ...gm(9), notes: glock, gain: -9, pan: 0.35, reverb: 0.45 },
    { id: 'whoosh', type: 'sfx', events: [{ t: T(4) - 0.9, fx: 'whoosh', params: { dur: 1.2 } }], gain: -14 },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.4, return: 'music' } },
    master: { targetLUFS: -16, ceiling: -1 },
  },
};
