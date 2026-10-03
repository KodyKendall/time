// audio/scores/tether.mjs — score for TETHER (web/src/tether.js).
//
// 60 BPM, so one beat is one second and every time below is the film's own timecode.
//
// THE TUG is the whole score: two notes, D then the A a fifth above, low and high together —
// the kite and the hand. It is heard whole only while the kite is on its string.
//
//   0-12    first flight   piano and cello play THE TUG together, twice. Home.
//   12-27   the want       the swifts are woodwind runs; the motif is cut off when the string jerks taut
//   27-40   tugging        a cello pedal in 3+3+2, tremolo strings tightening, the fifth hammered off-balance
//   40      snap           everything stops on the frame. A ping, two seconds of nothing, then the swell
//   42-68   free           the high note alone, on flute, over lydian strings with no bass under them
//   68-80   the fall       the flute keeps trying to start its note and keeps being cut off
//   80-92   the tree       rain, and at 86 the low D alone on cello: the missing half, from far away
//   92-106  the mend       solo piano, low, and no A anywhere: it waits
//   106-120 leaning in     THE TUG complete in the full orchestra; low D and high A held together at the end
import { midi as N, chord, humanizer } from '../lib/music.mjs';

const hum = humanizer(77, { time: 0.008, vel: 6 });
const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });
const notes = (list) => list.map((n) => hum({ ...n }));
const at = (into, t, d, p, v) => into.push({ t, d, p: typeof p === 'string' ? N(p) : p, v });
const pad = (into, t, d, sym, v, center = 62) => { for (const p of chord(sym, { voicing: 'spread', center })) at(into, t, d, p, v); };

const piano = [], strings = [], trem = [], pizz = [], cello = [], bass = [], horn = [], flute = [], clar = [], oboe = [], harp = [], celesta = [];

// THE TUG: low then high, on any pair of voices.
function tug(t, low, high, { lo = 'D2', hi = 'A2', gap = 0.5, d = 2.2, v = 70 } = {}) {
  at(low, t, d + gap, lo, v);
  at(high, t + gap, d, hi, v - 2);
}

// Broken-chord piano in eighths across [t0, t1).
function arp(t0, t1, sym, v, center = 64) {
  const ch = chord(sym, { voicing: 'close', center });
  const fig = [0, 2, 1, 3, 2, 1, 3, 2];
  let e = 0;
  for (let t = t0; t < t1 - 0.01; t += 0.5, e++) at(piano, t, 0.46, ch[fig[e % 8] % ch.length] + (e % 8 >= 4 ? 12 : 0), v + (e % 4 === 0 ? 8 : 0));
  at(piano, t0, Math.min(3.8, t1 - t0), chord(sym, { bass: true, bassOctave: 2 })[0], v + 4);
}

// A fast rising run (the swifts) on one instrument.
function run(into, t, from, n, v, step = 0.11) {
  const scale = [0, 2, 4, 6, 7, 9, 11];   // D major from `from` (a D)
  const base = N(from);
  for (let i = 0; i < n; i++) at(into, t + i * step, step * 1.4, base + scale[i % 7] + 12 * Math.floor(i / 7), v - (i % 3) * 3);
}

// ---------------------------------------------------------------- 1. first flight (0-12)
[[0, 'Dadd9'], [4, 'Gmaj9'], [8, 'Bm7'], [10, 'Asus4']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 12, c, 46));
tug(1, cello, cello, { v: 72 });
tug(1, piano, piano, { lo: 'D4', hi: 'A4', v: 62 });
tug(7, cello, cello, { v: 74 });
tug(7, piano, piano, { lo: 'D4', hi: 'A4', v: 64 });
pad(strings, 4, 4, 'Gmaj9', 42); pad(strings, 8, 4, 'Bm7', 46);

// ---------------------------------------------------------------- 2. the want (12-27)
[[12, 'Gmaj7'], [16, 'D'], [20, 'Em7'], [24, 'Asus4']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 27, c, 44));
at(cello, 14, 1.0, 'D2', 74);            // the tug begins…
pad(pizz, 15, 0.3, 'D', 90, 55);          // …and the string snaps taut on the frame (15.0)
at(bass, 15, 0.4, 'D1', 80);
for (const t of [16, 17.4, 18.9, 20.4]) { run(flute, t, 'D5', 12, 66); run(clar, t + 0.06, 'D4', 12, 58); }
pad(strings, 20, 4, 'Em9', 58); pad(strings, 24, 3, 'Asus4', 64);
at(oboe, 23, 3.4, 'A5', 70);             // the high note, wanting: it falls back unanswered
at(oboe, 26.4, 0.6, 'G5', 58);
for (const [t, n] of [[16.2, 'A6'], [19.0, 'D7'], [21.6, 'F#6']]) at(celesta, t, 1.2, n, 52);

// ---------------------------------------------------------------- 3. tugging (27-40)
// cello pedal in 3+3+2 sixteenths-of-a-bar, getting louder
for (let t = 27; t < 39.9; t += 2) {
  for (const [o, acc] of [[0, 1], [0.75, 1], [1.5, 0]]) at(cello, t + o, 0.45, 'D2', 60 + (acc ? 14 : 0) + (t - 27) * 1.4);
  at(bass, t, 1.6, 'D1', 58 + (t - 27));
}
[[27, 'Dm'], [31, 'Bb'], [34, 'Gm'], [37, 'A7']].forEach(([t, c], i, a) => pad(trem, t, (a[i + 1] ? a[i + 1][0] : 40) - t, c, 56 + i * 8, 60));
// the fifth, hammered at the wrong moments
for (const t of [28.2, 29.9, 31.3, 33.1, 34.4, 35.9, 37.0, 37.8, 38.6, 39.2, 39.6]) {
  at(piano, t, 0.25, 'D4', 70 + (t - 27) * 1.5);
  at(piano, t + 0.12, 0.25, 'A4', 66 + (t - 27) * 1.5);
}

// ---------------------------------------------------------------- 4. snap (40-52)
at(celesta, 40.0, 2.6, 'A6', 78);         // ping. Then nothing until 42.
pad(strings, 42, 4, 'Dmaj9', 70, 66); pad(strings, 46, 3, 'Bm9', 72, 66); pad(strings, 49, 3, 'Gmaj7#11', 70, 67);
[['D4', 42.5], ['F#4', 43.3], ['A4', 44.1], ['D5', 45.2]].forEach(([n, t], i) => at(horn, t, i === 3 ? 3.2 : 0.9, n, 76 + i * 3));
at(flute, 46.5, 3.5, 'A5', 74);           // the high note, alone, soaring
at(flute, 50.2, 1.6, 'B5', 70);
for (let i = 0; i < 10; i++) at(harp, 42 + i * 0.06, 2.2, chord('Dmaj9', { voicing: 'close', center: 62 })[i % 5] + 12 * Math.floor(i / 5), 66 - i);

// ---------------------------------------------------------------- 5. free (52-68)
// lydian strings floating high, no bass under them at all
[[52, 'Dmaj7#11'], [56, 'Gmaj7#11'], [60, 'Dmaj7#11'], [64, 'Gmaj7#11']].forEach(([t, c], i) => pad(strings, t, 4, c, [72, 74, 64, 46][i], 70));
const SOAR = [[52, 'A5', 1.5], [53.5, 'C#6', 0.5], [54, 'E6', 1], [55, 'D6', 1], [56, 'A5', 2], [58.5, 'B5', 0.5], [59, 'C#6', 0.5],
  [59.5, 'E6', 0.5], [60, 'F#6', 1.5], [61.5, 'E6', 0.5], [62, 'A5', 2], [64.5, 'A5', 3.2]];
for (const [t, n, d] of SOAR) at(flute, t, d * 0.97, n, t > 64 ? 60 : 76);
for (let t = 52; t < 63; t += 0.5) at(harp, t, 1.2, chord(t < 56 || (t >= 60 && t < 64) ? 'Dmaj7#11' : 'Gmaj7#11', { voicing: 'close', center: 74 })[Math.floor(t * 2) % 5], 46);
for (const t of [52.5, 54.2, 56.1, 57.8, 59.6, 61.2]) run(clar, t, 'D5', 9, 52);
for (const t of [53, 57, 61]) at(celesta, t, 1.4, 'G#6', 46);

// ---------------------------------------------------------------- 6. the fall (68-80)
// the flute keeps starting its note and is cut off, faster and quieter
for (const [t, v] of [[68.4, 66], [70.0, 62], [71.5, 58], [72.8, 56], [73.9, 52], [74.8, 50], [75.6, 46], [76.3, 42]]) at(flute, t, 0.32, 'A5', v);
// low strings sliding down by semitones into a cluster
['D3', 'C#3', 'C3', 'B2', 'Bb2', 'A2'].forEach((n, i) => {
  at(strings, 68 + i * 2, 2.1, n, 54 + i * 3);
  at(strings, 68 + i * 2, 2.1, N(n) + 1, 50 + i * 3);
  at(bass, 68 + i * 2, 2.1, N(n) - 12, 56 + i * 3);
});

// ---------------------------------------------------------------- 7. the thorn tree (80-92)
at(cello, 86, 5.8, 'D2', 54);             // the missing half, alone

// ---------------------------------------------------------------- 8. the mend (92-106)
// solo piano, low and patient; there is no A anywhere in this section
at(piano, 92, 3.4, 'D2', 50); at(piano, 92, 3.4, 'D3', 48);
const HYMN = [[93.5, ['D3', 'F#3', 'E4']], [95.5, ['G2', 'D3', 'B3', 'F#4']], [98, ['B1', 'F#3', 'D4']], [100, ['G2', 'D3', 'B3', 'E4']],
  [102.5, ['E2', 'B2', 'G3', 'D4', 'F#4']], [104.5, ['G2', 'D3', 'B3', 'E4']]];
for (const [t, ch] of HYMN) ch.forEach((n, i) => at(piano, t + i * 0.04, t === 104.5 ? 1.5 : 2.3, n, 42 + i * 2));
for (const [t, n] of [[94.2, 'F#4'], [96.6, 'G4'], [99.1, 'F#4'], [101.3, 'E4'], [103.4, 'D4']]) at(piano, t, 1.1, n, 50);

// ---------------------------------------------------------------- 9. leaning in (106-120)
tug(106, cello, cello, { v: 80, d: 2.6 });
tug(106, piano, piano, { lo: 'D3', hi: 'A3', v: 70, d: 2.4 });
tug(106, piano, piano, { lo: 'D4', hi: 'A4', v: 66, d: 2.4 });
[[107, 'Dadd9'], [109, 'Gmaj9'], [111, 'Bm9'], [113, 'Gmaj9'], [114.5, 'Asus4'], [115.5, 'D']].forEach(([t, c], i, a) => {
  const d = (a[i + 1] ? a[i + 1][0] : 119.6) - t;
  pad(strings, t, d, c, 70 + (t > 112 ? 10 : 0), 64);
  at(bass, t, d, chord(c, { bass: true, bassOctave: 1 })[0], 66);
});
tug(109, horn, horn, { lo: 'D3', hi: 'A3', v: 80, d: 2.0 });
tug(113, horn, horn, { lo: 'D3', hi: 'A3', v: 86, d: 2.0 });
// the swifts come back as a countermelody: the free-flight tune, now with ground under it
for (const [t, n, d] of [[110, 'A5', 1], [111, 'C#6', 0.5], [111.5, 'E6', 1], [112.5, 'D6', 1], [113.5, 'F#6', 1.5], [115, 'E6', 0.5]]) at(flute, t, d * 0.97, n, 74);
for (const t of [110.2, 111.8, 113.4]) run(clar, t, 'D4', 10, 56);
// the end: low D and high A held together, under the title
at(cello, 115.5, 4.1, 'D2', 74); at(bass, 115.5, 4.1, 'D1', 64);
at(flute, 116, 3.6, 'A5', 66); at(oboe, 116, 3.6, 'A4', 56);
at(celesta, 117.2, 2.4, 'A6', 50);
for (let i = 0; i < 12; i++) at(harp, 115.5 + i * 0.07, 3.5, chord('Dadd9', { voicing: 'close', center: 62 })[i % 4] + 12 * Math.floor(i / 4), 62 - i);

export default {
  sampleRate: 48000,
  duration: 120,
  tempo: [{ t: 0, bpm: 60 }],
  tracks: [
    { id: 'piano', ...gm(0), notes: notes(piano), gain: -5, pan: -0.06, reverb: 0.32 },
    { id: 'strings', ...gm(48), notes: strings, gain: -12, pan: 0.05, reverb: 0.5, width: 1,
      cc: [{ t: 0, n: 11, v: 60 }, { t: 42, n: 11, v: 50 }, { t: 46, n: 11, v: 100, ramp: true }, { t: 64, n: 11, v: 50, ramp: true },
           { t: 68, n: 11, v: 80 }, { t: 106, n: 11, v: 60 }, { t: 114, n: 11, v: 112, ramp: true }, { t: 119.5, n: 11, v: 70, ramp: true }] },
    { id: 'tremolo', ...gm(44), notes: trem, gain: -13, pan: 0.18, reverb: 0.4,
      cc: [{ t: 27, n: 11, v: 40 }, { t: 39.9, n: 11, v: 120, ramp: true }] },
    { id: 'pizz', ...gm(45), notes: pizz, gain: -6, pan: 0.1, reverb: 0.3 },
    { id: 'cello', ...gm(42), notes: notes(cello), gain: -8, pan: -0.22, reverb: 0.32 },
    { id: 'bass', ...gm(43), notes: bass, gain: -11, pan: -0.1, reverb: 0.3 },
    { id: 'horn', ...gm(60), notes: notes(horn), gain: -8, pan: -0.14, reverb: 0.44 },
    { id: 'flute', ...gm(73), notes: notes(flute), gain: -6, pan: 0.14, reverb: 0.42, delay: 0.05 },
    { id: 'clarinet', ...gm(71), notes: notes(clar), gain: -11, pan: 0.3, reverb: 0.4 },
    { id: 'oboe', ...gm(68), notes: notes(oboe), gain: -9, pan: 0.2, reverb: 0.42 },
    { id: 'harp', ...gm(46), notes: notes(harp), gain: -10, pan: 0.26, reverb: 0.46 },
    { id: 'celesta', ...gm(8), notes: celesta, gain: -10, pan: 0.3, reverb: 0.55 },
    { id: 'air', type: 'sfx', gain: -17,
      events: [
        { t: 0, fx: 'wind', params: { dur: 40.2, strength: 0.35, gustiness: 0.7, seed: 3 } },
        { t: 42, fx: 'wind', params: { dur: 10, strength: 0.3, gustiness: 0.5, seed: 5 } },
        { t: 68, fx: 'wind', params: { dur: 12, strength: 1.1, gustiness: 1.1, seed: 8 } },
        { t: 80, fx: 'wind', params: { dur: 12, strength: 0.25, gustiness: 0.4, seed: 9 } },
        { t: 106, fx: 'wind', params: { dur: 14, strength: 0.3, gustiness: 0.6, seed: 11 } },
      ] },
    { id: 'rain', type: 'sfx', gain: -11,
      events: [{ t: 80, fx: 'crackle', params: { dur: 12.4, density: 400, hiss: 0.9, roar: 0, seed: 2 } }] },
    { id: 'hits', type: 'sfx', gain: -9,
      events: [
        { t: 14.95, fx: 'whoosh', params: { dur: 0.5, from: 300, to: 2400, peak: 0.5, air: 0.5, tone: 0.3 } },
        { t: 16.0, fx: 'shimmer', params: { dur: 2.4, root: 1320, sparkle: 0.6, space: 0.5 } },
        { t: 34.0, fx: 'riser', params: { dur: 6 } },
        { t: 40.0, fx: 'shimmer', params: { dur: 2.0, root: 1760, sparkle: 0.9, space: 0.7 } },
        { t: 69.0, fx: 'whoosh', params: { dur: 1.8, from: 2200, to: 260, peak: 0.4, air: 0.8, tone: 0.2 } },
        { t: 73.5, fx: 'whoosh', params: { dur: 1.5, from: 1800, to: 220, peak: 0.36, air: 0.8, tone: 0.2 } },
        { t: 79.2, fx: 'impact', params: { dur: 1.6, subHz: 70, drop: 0.3, noise: 0.5, tail: 0.4, click: 0.9, space: 0.2 } },
      ] },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 3.2, return: 'music' } },
    master: { targetLUFS: -16, ceiling: -1 },
  },
};
