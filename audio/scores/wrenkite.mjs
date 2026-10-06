// audio/scores/wrenkite.mjs — original score for TETHERED (Wren & the Kite, told by the Kite).
//
// 60 BPM, so one beat is one second and every time below is the film's own timecode.
// Beat boundaries are locked to the real narration recordings (1.5s breath before each
// voice line, ~1s tail): T = [0, 22.3, 55.2, 91.3, 142.4, 171.0, 203.6, 253.5, 285.6,
// 320.0, 351.8, 395.6], DUR = 414.
//
// THE TUG is the whole score: two notes, D then the A a fifth above, low and high together —
// the kite and the hand. Heard whole only while the kite is on its string.
//
// Tone: soft, beautiful, classic. Piano and strings lead; flute carries the high note and the
// swifts; horn warms the search; harp and celesta are punctuation, never decoration.
// Everything sits UNDER the narration (modest velocities, swells live in the breaths).
//
//   B1    0-22.3     first memory    sparse piano, THE TUG once, low. Home.
//   B2    22.3-55.2  she ran         THE TUG twice, strings warm in.
//   B3    55.2-91.3  the want        swift runs; high A wanting, falls back; string snaps taut.
//   B4    91.3-142.4 fighting        cello pedal 3+3+2, tremolo tightens, fifth hammered off-balance.
//   B5    142.4-171  snap            halo on the spoken Ping, near-silence, then the swell.
//   B6    171-203.6  free            high note alone on flute, lydian strings, no bass at all.
//   B7    203.6-253.5 the fall      flute cut off again and again; strings sink by semitones.
//   B8    253.5-285.6 thorn tree     rain; lone low D on cello: the missing half, from far away.
//   B9    285.6-320  the search      patient piano + cello; horn warms the lantern walk.
//   B10   320-351.8  the mend        solo piano hymn; no high-A motif anywhere: it waits.
//   B11   351.8-395.6 leaning in    THE TUG complete, full strings; swifts return with ground under them.
//   B12   395.6-414  held            low D + high A together, dissolving under the title.
import { midi as N, chord, humanizer } from '../lib/music.mjs';

const hum = humanizer(41, { time: 0.008, vel: 6 });
const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });
const notes = (list) => list.map((n) => hum({ ...n }));
const at = (into, t, d, p, v) => into.push({ t, d, p: typeof p === 'string' ? N(p) : p, v });
const pad = (into, t, d, sym, v, center = 62) => { for (const p of chord(sym, { voicing: 'spread', center })) at(into, t, d, p, v); };

const piano = [], strings = [], trem = [], pizz = [], cello = [], bass = [], horn = [], flute = [], clar = [], oboe = [], harp = [], celesta = [];

// THE TUG: low then high, on any pair of voices.
function tug(t, low, high, { lo = 'D2', hi = 'A2', gap = 0.5, d = 2.2, v = 60 } = {}) {
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
  const scale = [0, 2, 4, 6, 7, 9, 11];
  const base = N(from);
  for (let i = 0; i < n; i++) at(into, t + i * step, step * 1.4, base + scale[i % 7] + 12 * Math.floor(i / 7), v - (i % 3) * 3);
}

// ---------------------------------------------------------------- B1. first memory (0-22.3)
[[0, 'Dadd9'], [8, 'Gmaj9'], [14, 'Bm7'], [18, 'Asus4']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 22.3, c, 38));
tug(0.6, cello, cello, { v: 56, d: 1.8 });
tug(0.6, piano, piano, { lo: 'D4', hi: 'A4', v: 48, d: 1.6 });
tug(12, cello, cello, { v: 62 });
tug(12, piano, piano, { lo: 'D4', hi: 'A4', v: 54 });
pad(strings, 9, 5, 'Gmaj9', 36); pad(strings, 15, 5, 'Bm7', 40);

// ---------------------------------------------------------------- B2. she ran (22.3-55.2)
[[22.3, 'Dadd9'], [30, 'Gmaj9'], [38, 'Bm7'], [46, 'Gmaj9'], [51, 'Asus4']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 55.2, c, 33));
tug(22.8, cello, cello, { v: 58, d: 1.8 });
tug(31, cello, cello, { v: 58, d: 1.6 });
tug(31, piano, piano, { lo: 'D4', hi: 'A4', v: 48, d: 1.4 });
pad(strings, 30, 6, 'Gmaj9', 44); pad(strings, 38, 6, 'Bm9', 48); pad(strings, 46, 6, 'Gmaj9', 52);
tug(54.6, horn, horn, { lo: 'D3', hi: 'A3', v: 58, d: 1.6 });

// ---------------------------------------------------------------- B3. the want (55.2-91.3)
[[55.2, 'Gmaj7'], [62, 'D'], [70, 'Em7'], [78, 'Asus4'], [85, 'Em7']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 91.3, c, 36));
at(cello, 55.7, 1.8, 'D2', 56);            // the tug begins, in the breath before the voice…
pad(pizz, 84.7, 0.3, 'D', 80, 55);         // …and the string snaps taut ("I leaned. The string said no.")
at(bass, 84.7, 0.4, 'D1', 70);
for (const t of [60, 64, 68, 72]) { run(flute, t, 'D5', 12, 58); run(clar, t + 0.06, 'D4', 12, 50); }
pad(strings, 70, 5, 'Em9', 52); pad(strings, 78, 5, 'Asus4', 58);
at(oboe, 76, 4.5, 'A5', 62);               // the high note, wanting: falls back unanswered
at(oboe, 80.8, 0.8, 'G5', 50);
for (const [t, n] of [[62, 'A6'], [68, 'D7'], [74, 'F#6']]) at(celesta, t, 1.2, n, 44);

// ---------------------------------------------------------------- B4. fighting (91.3-142.4)
// cello pedal in 3+3+2, getting louder under the fight
for (let t = 91.3; t < 141.5; t += 2) {
  for (const [o, acc] of [[0, 1], [0.75, 1], [1.5, 0]]) at(cello, t + o, 0.45, 'D2', 48 + (acc ? 10 : 0) + (t - 91.3) * 0.4);
  at(bass, t, 1.0, 'D1', 46 + (t - 91.3) * 0.35);
}
[[91.3, 'Dm'], [104, 'Bb'], [117, 'Gm'], [130, 'A7']].forEach(([t, c], i, a) => pad(trem, t, (a[i + 1] ? a[i + 1][0] : 142.4) - t, c, 48 + i * 6, 60));
// the fifth, hammered at the wrong moments, crowding toward the snap
for (const t of [94, 97.5, 100.8, 104.2, 107.6, 111, 114.5, 118, 121.5, 125, 128.5, 132, 135, 137.5, 139.5, 141]) {
  const k = (t - 91.3) * 0.45;
  at(piano, t, 0.25, 'D4', 60 + k);
  at(piano, t + 0.12, 0.25, 'A4', 56 + k);
}

// ---------------------------------------------------------------- B5. snap (142.4-171)
at(celesta, 147.5, 3.0, 'A6', 52);         // halo around the spoken "Ping". Then almost nothing.
pad(strings, 151, 4, 'Dmaj9', 62, 66); pad(strings, 157, 3.5, 'Bm9', 64, 66); pad(strings, 162, 3.5, 'Gmaj7#11', 62, 67);
[['D4', 153], ['F#4', 154.2], ['A4', 155.4], ['D5', 156.8]].forEach(([n, t], i) => at(horn, t, i === 3 ? 3.0 : 0.9, n, 64 + i * 3));
at(flute, 161, 4.0, 'A5', 66);             // the high note, alone, soaring
at(flute, 166, 2.0, 'B5', 62);
for (let i = 0; i < 10; i++) at(harp, 151 + i * 0.06, 2.2, chord('Dmaj9', { voicing: 'close', center: 62 })[i % 5] + 12 * Math.floor(i / 5), 56 - i);

// ---------------------------------------------------------------- B6. free (171-203.6)
// lydian strings floating high, no bass under them at all
[[171, 'Dmaj7#11'], [177, 'Gmaj7#11'], [183, 'Dmaj7#11'], [190, 'Gmaj7#11'], [196, 'Dmaj7#11']].forEach(([t, c], i) => pad(strings, t, 5, c, [64, 66, 58, 60, 44][i], 70));
const SOAR = [[171, 'A5', 1.5], [172.5, 'C#6', 0.5], [173, 'E6', 1], [174, 'D6', 1], [175, 'A5', 2], [177.5, 'B5', 0.5], [178, 'C#6', 0.5],
  [178.5, 'E6', 0.5], [179, 'F#6', 1.5], [180.5, 'E6', 0.5], [181, 'A5', 2], [184, 'A5', 2.5], [190, 'B5', 1], [191.5, 'C#6', 1.5], [194, 'A5', 3]];
for (const [t, n, d] of SOAR) at(flute, t, d * 0.97, n, t > 190 ? 50 : 60);
for (let t = 171; t < 196; t += 0.5) at(harp, t, 1.2, chord(t < 177 || (t >= 183 && t < 190) ? 'Dmaj7#11' : 'Gmaj7#11', { voicing: 'close', center: 74 })[Math.floor(t * 2) % 5], 40);
for (const t of [171.5, 175, 179, 183, 187, 191]) run(clar, t, 'D5', 9, 46);
for (const t of [172, 180, 188]) at(celesta, t, 1.4, 'G#6', 40);

// ---------------------------------------------------------------- B7. the fall (203.6-253.5)
// the flute keeps starting its note and is cut off, faster and quieter
for (const [t, v] of [[204.1, 52], [207.5, 54], [210, 50], [212.4, 48], [214.6, 44], [216.6, 42], [218.4, 38], [220, 34]]) at(flute, t, 0.32, 'A5', v);
// low strings sliding down by semitones into a cluster
['D3', 'C#3', 'C3', 'B2', 'Bb2', 'A2'].forEach((n, i) => {
  at(strings, 206 + i * 6, 6.1, n, 48 + i * 2);
  at(strings, 206 + i * 6, 6.1, N(n) + 1, 44 + i * 2);
  at(bass, 206 + i * 6, 3.0, N(n) - 12, 46 + i * 2);
});
pad(strings, 240, 8, 'A7', 56, 58);

// ---------------------------------------------------------------- B8. the thorn tree (253.5-285.6)
at(cello, 278, 6.0, 'D2', 48);             // the missing half, alone, under "a warm dot of light"
for (const [t, n] of [[281, 'A5'], [283.5, 'G5']]) at(flute, t, 2.2, n, 36);

// ---------------------------------------------------------------- B9. the search (285.6-320)
// patient piano + cello; horn warms the lantern walk; the high A stays away
at(piano, 287, 3.4, 'D2', 44); at(piano, 287, 3.4, 'D3', 42);
const SEARCH = [[288.5, ['D3', 'F#3', 'E4']], [291.5, ['G2', 'D3', 'B3', 'F#4']], [295, ['B1', 'F#3', 'D4']], [298.5, ['G2', 'D3', 'B3', 'E4']],
  [302, ['E2', 'B2', 'G3', 'D4', 'F#4']], [306, ['G2', 'D3', 'B3', 'E4']], [310, ['D3', 'F#3', 'A3', 'D4']], [314, ['G2', 'D3', 'B3', 'G4']]];
for (const [t, ch] of SEARCH) ch.forEach((n, i) => at(piano, t + i * 0.04, 2.3, n, 38 + i * 2));
for (const [t, n] of [[289.2, 'F#4'], [292.6, 'G4'], [296.1, 'F#4'], [299.3, 'E4'], [303.4, 'D4'], [311.2, 'E4'], [315.2, 'D4']]) at(piano, t, 1.1, n, 44);
at(cello, 290, 8, 'D2', 46); at(cello, 300, 8, 'G2', 44); at(cello, 310, 8, 'D2', 46);
at(horn, 296, 4, 'D3', 52); at(horn, 304, 4, 'G3', 52); at(horn, 312, 5, 'D3', 54);
for (const t of [292, 300, 308, 314]) at(harp, t, 1.6, chord('Gmaj9', { voicing: 'close', center: 74 })[Math.floor(t) % 5], 36);

// ---------------------------------------------------------------- B10. the mend (320-351.8)
// solo piano hymn, low and patient; the high-A motif appears nowhere
at(piano, 320, 3.4, 'D2', 44); at(piano, 320, 3.4, 'D3', 42);
const HYMN = [[321.5, ['D3', 'F#3', 'E4']], [324, ['G2', 'D3', 'B3', 'F#4']], [327.5, ['B1', 'F#3', 'D4']], [330.5, ['G2', 'D3', 'B3', 'E4']],
  [334, ['E2', 'B2', 'G3', 'D4', 'F#4']], [338, ['G2', 'D3', 'B3', 'E4']], [342, ['D3', 'F#3', 'G4']], [346, ['E2', 'B2', 'E3', 'G3']]];
for (const [t, ch] of HYMN) ch.forEach((n, i) => at(piano, t + i * 0.04, 2.3, n, 38 + i * 2));
for (const [t, n] of [[322.2, 'F#4'], [325.6, 'G4'], [329.1, 'F#4'], [332.3, 'E4'], [336.4, 'D4'], [343.2, 'E4'], [347.2, 'D4']]) at(piano, t, 1.1, n, 44);
at(cello, 322, 10, 'D2', 42); at(cello, 334, 10, 'G2', 42);
at(celesta, 344, 2.0, 'G5', 40);           // the knot, tugged once to test it
pad(strings, 330, 10, 'Gmaj9', 36, 60);

// ---------------------------------------------------------------- B11. leaning in (351.8-395.6)
tug(353.3, cello, cello, { v: 72, d: 2.6 });
tug(353.3, piano, piano, { lo: 'D3', hi: 'A3', v: 62, d: 2.4 });
tug(353.3, piano, piano, { lo: 'D4', hi: 'A4', v: 58, d: 2.4 });
[[354, 'Dadd9'], [358, 'Gmaj9'], [363, 'Bm9'], [368, 'Gmaj9'], [373, 'Asus4'], [378, 'D'], [384, 'Gmaj9'], [389, 'Asus4']].forEach(([t, c], i, a) => {
  const d = (a[i + 1] ? a[i + 1][0] : 395.2) - t;
  pad(strings, t, d, c, 62 + (t > 378 ? 10 : 0), 64);
  at(bass, t, d * 0.6, chord(c, { bass: true, bassOctave: 1 })[0], 54);
});
tug(357, horn, horn, { lo: 'D3', hi: 'A3', v: 72, d: 2.0 });
tug(364, horn, horn, { lo: 'D3', hi: 'A3', v: 78, d: 2.0 });
tug(373, horn, horn, { lo: 'D3', hi: 'A3', v: 82, d: 2.2 });
// the swifts come back as a countermelody: the free-flight tune, now with ground under it
for (const [t, n, d] of [[361, 'A5', 1], [362, 'C#6', 0.5], [362.5, 'E6', 1], [363.5, 'D6', 1], [364.5, 'F#6', 1.5], [366.5, 'E6', 0.5],
  [372, 'A5', 1.5], [374, 'B5', 0.5], [374.5, 'C#6', 1], [376, 'D6', 1.5]]) at(flute, t, d * 0.97, n, 66);
for (const t of [361, 366, 372, 378]) run(clar, t, 'D4', 10, 50);
for (const t of [360, 370, 380]) at(celesta, t, 1.4, 'G#6', 40);
// the end of the climb: low D and high A held together
at(cello, 390, 5.2, 'D2', 66); at(bass, 390, 5.2, 'D1', 56);
at(flute, 390.5, 4.7, 'A5', 58); at(oboe, 390.5, 4.7, 'A4', 48);

// ---------------------------------------------------------------- B12. held (395.6-414)
pad(strings, 395.6, 12, 'Dadd9', 56, 64);
at(cello, 395.6, 14, 'D2', 60); at(bass, 395.6, 8, 'D1', 46);
at(flute, 396, 12, 'A5', 50); at(oboe, 396, 12, 'A4', 42);
at(horn, 398, 8, 'D3', 54);
for (const [t, n] of [[397.5, 'F#5'], [400, 'E5'], [402.5, 'D5']]) at(flute, t, 2.0, n, 44);
for (let i = 0; i < 12; i++) at(harp, 396 + i * 0.35, 3.0, chord('Dadd9', { voicing: 'close', center: 62 })[i % 4] + 12 * Math.floor(i / 4), 48 - i * 2);
at(celesta, 404, 3.0, 'A6', 40);
pad(strings, 404, 8, 'Gmaj9', 40, 64);

export default {
  sampleRate: 48000,
  duration: 414,
  tempo: [{ t: 0, bpm: 60 }],
  tracks: [
    { id: 'piano', ...gm(0), notes: notes(piano), gain: -6, pan: -0.06, reverb: 0.34 },
    { id: 'strings', ...gm(48), notes: strings, gain: -13, pan: 0.05, reverb: 0.52, width: 1,
      cc: [{ t: 0, n: 11, v: 55 }, { t: 91, n: 11, v: 55 }, { t: 130, n: 11, v: 110, ramp: true }, { t: 142.4, n: 11, v: 45, ramp: true },
           { t: 171, n: 11, v: 60 }, { t: 196, n: 11, v: 45, ramp: true }, { t: 203.6, n: 11, v: 75 },
           { t: 253.5, n: 11, v: 40 }, { t: 351.8, n: 11, v: 55 }, { t: 384, n: 11, v: 108, ramp: true }, { t: 404, n: 11, v: 60, ramp: true }] },
    { id: 'tremolo', ...gm(44), notes: trem, gain: -14, pan: 0.18, reverb: 0.42,
      cc: [{ t: 91.3, n: 11, v: 40 }, { t: 142, n: 11, v: 115, ramp: true }] },
    { id: 'pizz', ...gm(45), notes: pizz, gain: -7, pan: 0.1, reverb: 0.3 },
    { id: 'cello', ...gm(42), notes: notes(cello), gain: -9, pan: -0.22, reverb: 0.34 },
    { id: 'bass', ...gm(43), notes: bass, gain: -16, pan: -0.1, reverb: 0.3 },
    { id: 'horn', ...gm(60), notes: notes(horn), gain: -9, pan: -0.14, reverb: 0.46 },
    { id: 'flute', ...gm(73), notes: notes(flute), gain: -7, pan: 0.14, reverb: 0.44, delay: 0.05 },
    { id: 'clarinet', ...gm(71), notes: notes(clar), gain: -12, pan: 0.3, reverb: 0.42 },
    { id: 'oboe', ...gm(68), notes: notes(oboe), gain: -10, pan: 0.2, reverb: 0.44 },
    { id: 'harp', ...gm(46), notes: notes(harp), gain: -11, pan: 0.26, reverb: 0.48 },
    { id: 'celesta', ...gm(8), notes: celesta, gain: -11, pan: 0.3, reverb: 0.56 },
    { id: 'air', type: 'sfx', gain: -18,
      events: [
        { t: 0, fx: 'wind', params: { dur: 91.5, strength: 0.2, gustiness: 0.5, seed: 3 } },
        { t: 91.3, fx: 'wind', params: { dur: 51.1, strength: 0.35, gustiness: 0.7, seed: 5 } },
        { t: 142.4, fx: 'wind', params: { dur: 10, strength: 0.35, gustiness: 0.6, seed: 6 } },
        { t: 171, fx: 'wind', params: { dur: 32.6, strength: 0.2, gustiness: 0.4, seed: 7 } },
        { t: 203.6, fx: 'wind', params: { dur: 50, strength: 0.5, gustiness: 0.7, seed: 8 } },
        { t: 253.5, fx: 'wind', params: { dur: 32, strength: 0.15, gustiness: 0.3, seed: 9 } },
        { t: 285.6, fx: 'wind', params: { dur: 34.4, strength: 0.18, gustiness: 0.4, seed: 10 } },
        { t: 351.8, fx: 'wind', params: { dur: 44, strength: 0.2, gustiness: 0.5, seed: 11 } },
        { t: 395.6, fx: 'wind', params: { dur: 18, strength: 0.14, gustiness: 0.3, seed: 12 } },
      ] },
    { id: 'rain', type: 'sfx', gain: -16,
      events: [{ t: 250, fx: 'crackle', params: { dur: 32, density: 400, hiss: 0.9, roar: 0, seed: 2 } }] },
    { id: 'hits', type: 'sfx', gain: -10,
      events: [
        { t: 84.65, fx: 'whoosh', params: { dur: 0.5, from: 300, to: 2400, peak: 0.4, air: 0.5, tone: 0.3 } },
        { t: 91.0, fx: 'shimmer', params: { dur: 2.4, root: 1320, sparkle: 0.5, space: 0.5 } },
        { t: 134.0, fx: 'riser', params: { dur: 8 } },
        { t: 142.4, fx: 'shimmer', params: { dur: 3.0, root: 1760, sparkle: 0.7, space: 0.6 } },
        { t: 147.0, fx: 'shimmer', params: { dur: 2.0, root: 1760, sparkle: 0.6, space: 0.6 } },
        { t: 216.0, fx: 'whoosh', params: { dur: 1.8, from: 2200, to: 260, peak: 0.35, air: 0.8, tone: 0.2 } },
        { t: 236.0, fx: 'whoosh', params: { dur: 1.5, from: 1800, to: 220, peak: 0.32, air: 0.8, tone: 0.2 } },
        { t: 250.0, fx: 'impact', params: { dur: 1.6, subHz: 70, drop: 0.3, noise: 0.5, tail: 0.4, click: 0.9, space: 0.2 } },
      ] },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 3.2, return: 'music' } },
    master: { targetLUFS: -16, ceiling: -1 },
  },
};
