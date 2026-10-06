// audio/scores/greenkeeper.mjs — score for FORTY YEARS OF STRIPES (web/src/greenkeeper.js).
//
// 60 BPM, so one beat is one second and every time below is the film's own timecode.
//
// THE STRIPE is the whole score: two notes a tone apart, low then high, F then G, six-tenths
// apart and repeating every 1.2 seconds. It is the sound of a mower making a pass and turning.
// It is also the sound of a stripe: an alternation, forever, going nowhere in particular.
//
// The film's argument is an argument about this motif, so the score's job is very simple: it is
// complete in Act one, it loses a note at the turn, it tries to get its note back, and in the
// last shot it comes back complete in a key she did not choose, played by nobody she knows, with
// harmony around it for the first time. She is gone before it is finished.
//
//   0-16    1 dawn         THE STRIPE on piano and cello. Home. Birds and the mower.
//   16-32   2 pushing      full statement; clippings sparkle above it
//   32-44   3 stripes      the motif alone, empty, no bass
//   44-60   4 the bank     D minor, the most unresolved place in the score; the motif goes quiet
//   60-76   5 sunday       warmest and fullest: B flat major, harmony, a second voice on the motif
//   76-96   6 the board    THE MOTIF LOSES ITS HIGH NOTE. F alone, and the birds stop.
//   96-114  7 the hoarding one note on cello over a D pedal; wind and construction
//   114-130 8 the choice   she mows her own line: the motif completes ONCE, deliberately, on piano
//   130-142 9 the leaving  the single note, held, then let go. It does not resolve.
//   142-150 10 the card    SILENCE
//   150-178 11 the strangers  THE STRIPE returns complete, a third higher, on celesta and vibes,
//                          with chords around it. The motif gets its harmony only now.
import { midi as N, chord, humanizer } from '../lib/music.mjs';

const hum = humanizer(41, { time: 0.008, vel: 5 });
const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });
const notes = (list) => list.map((n) => hum({ ...n }));
const at = (into, t, d, p, v) => { if (v > 0) into.push({ t, d, p: typeof p === 'string' ? N(p) : p, v }); };
const pad = (into, t, d, sym, v, center = 62) => { for (const p of chord(sym, { voicing: 'spread', center })) at(into, t, d, p, v); };

const piano = [], celesta = [], vibes = [], strings = [], cello = [], bass = [], flute = [], harp = [], horn = [];

// THE STRIPE. `hi` false is the broken version used from beat 6 onward.
function stripe(into, t, { v = 60, lo = 'F3', hi = 'G3', gap = 0.6, d = 0.55, both = true } = {}) {
  at(into, t, d, lo, v);
  if (both) at(into, t + gap, d, hi, v - 2);
}

// The motif on a two-step cycle, from t0 for `len` seconds.
function stripeLoop(into, t0, len, opts = {}) {
  const step = 1.2;
  for (let t = t0; t < t0 + len - 0.15; t += step) stripe(into, t, opts);
}

// Gentle broken-chord figure, but quieter and further back than Tether's — this is a park, not a kite.
function arp(t0, t1, sym, v, center = 62) {
  const ch = chord(sym, { voicing: 'close', center });
  const fig = [0, 2, 1, 3, 2, 1, 3, 1];
  let e = 0;
  for (let t = t0; t < t1 - 0.01; t += 0.6, e++) at(piano, t, 0.55, ch[fig[e % 8] % ch.length], v + (e % 4 === 0 ? 5 : 0));
}

// ---------------------------------------------------------------- 1. dawn (0-16)
[[0, 'Fmaj7'], [4, 'Dm7'], [8, 'Bbmaj7'], [12, 'C7sus']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 16, c, 34));
stripeLoop(piano, 1.2, 14.8, { v: 44 });
stripeLoop(cello, 1.2, 14.8, { v: 52, lo: 'F2', hi: 'G2', d: 0.7 });
at(bass, 0, 6, 'F1', 62); at(bass, 8, 8, 'F1', 58);
pad(strings, 4, 4, 'Dm7', 34); pad(strings, 12, 4, 'C7sus', 36);
at(flute, 6.0, 2.6, 'A4', 44);                    // a bird, or the morning being a morning

// ---------------------------------------------------------------- 2. pushing (16-32)
[[16, 'Dm7'], [20, 'Bbmaj7'], [24, 'Gmaj7'], [28, 'C7sus']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 32, c, 38));
stripeLoop(piano, 17.0, 15, { v: 50 });
stripeLoop(cello, 17.0, 15, { v: 56, lo: 'F2', hi: 'G2', d: 0.7 });
at(bass, 16, 8, 'D2', 62); at(bass, 24, 8, 'G1', 58);
pad(strings, 20, 4, 'Bbmaj7', 40); pad(strings, 28, 4, 'C7sus', 40);
for (const [t, n] of [[19.4, 'C6'], [23.0, 'A5'], [26.6, 'F6'], [30.2, 'G6']]) at(celesta, t, 1.6, n, 34);  // clippings

// ---------------------------------------------------------------- 3. stripes (32-44)
stripeLoop(piano, 33.0, 11, { v: 38 });
at(cello, 33.0, 10.5, 'F2', 40);
pad(strings, 36, 7, 'Fmaj7', 30, 66);

// ---------------------------------------------------------------- 4. the bank (44-60)
// D minor with nothing under it. The motif is present but she is not playing it.
[[44, 'Dm'], [48, 'Dm7'], [54, 'Bbmaj7']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 60, c, 26, 58));
stripe(cello, 47.4, { v: 40, lo: 'F2', hi: 'G2', d: 0.6 });
stripe(cello, 55.8, { v: 34, lo: 'F2', hi: 'G2', d: 0.6 });
at(bass, 44, 16, 'D1', 50);
pad(strings, 46, 12, 'Dm7', 26, 58);
at(harp, 50.0, 3.4, 'D4', 34); at(harp, 57.0, 3.0, 'A4', 28);

// ---------------------------------------------------------------- 5. sunday (60-76)
// The warmest and fullest the film gets. A second voice takes the motif a third above.
[[60, 'Bbmaj7'], [64, 'F'], [68, 'C7sus'], [72, 'Bbmaj7']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 76, c, 42));
stripeLoop(piano, 61.0, 15, { v: 54 });
stripeLoop(cello, 61.0, 15, { v: 58, lo: 'F2', hi: 'G2', d: 0.7 });
stripeLoop(flute, 62.2, 13.8, { v: 44, lo: 'A4', hi: 'B4', d: 0.5 });
at(bass, 60, 8, 'Bb1', 64); at(bass, 68, 8, 'F1', 60);
pad(strings, 64, 4, 'F', 46); pad(strings, 72, 4, 'Bbmaj7', 44);
for (const [t, n] of [[65.2, 'D6'], [69.8, 'F6'], [74.2, 'B5']]) at(vibes, t, 2.0, n, 32);   // children, far off
at(horn, 73.4, 2.4, 'Bb3', 44);

// ---------------------------------------------------------------- 6. the board (76-96)
// The turn. THE STRIPE LOSES ITS HIGH NOTE — one note, repeating, going nowhere.
// The birds stop at 76.4. The score does not stop; it just stops being a pair.
[[76, 'Dm'], [82, 'Dm'], [88, 'C7sus']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 96, c, 20, 58));
stripeLoop(piano, 77.0, 19, { v: 30, both: false });
stripeLoop(cello, 77.0, 19, { v: 44, lo: 'F2', both: false, d: 0.8 });
at(bass, 76, 20, 'D1', 54);
pad(strings, 80, 14, 'Dm', 22, 58);

// ---------------------------------------------------------------- 7. the hoarding (96-114)
stripeLoop(cello, 97.0, 17, { v: 48, lo: 'F2', both: false, d: 0.9 });
at(bass, 96, 18, 'D1', 58);
pad(strings, 100, 12, 'Dm', 24, 58);
at(flute, 104.0, 3.0, 'F4', 30);                 // she almost has it

// ---------------------------------------------------------------- 8. the choice (114-130)
// She mows her own line. The motif completes ONCE, deliberately, and is left alone again.
stripe(piano, 118.0, { v: 52 });
at(piano, 118.6, 1.4, 'G3', 46);
at(cello, 118.0, 3.2, 'F2', 50); at(cello, 118.6, 2.6, 'G2', 46);
stripeLoop(cello, 122.0, 8, { v: 42, lo: 'F2', both: false, d: 0.8 });
at(bass, 114, 16, 'D1', 52);
pad(strings, 118, 8, 'Dm', 26, 58);

// ---------------------------------------------------------------- 9. the leaving (130-142)
at(cello, 131.0, 9.0, 'F2', 46);                 // held, and let go. It does not resolve.
at(bass, 130, 11, 'D1', 44);
pad(strings, 132, 8, 'Dm', 20, 58);

// ---------------------------------------------------------------- 10. the card (142-150)
// Silence. Nothing plays. This is the only eight seconds in the film with no sound in it.

// ---------------------------------------------------------------- 11. the strangers (150-178)
// THE STRIPE returns complete, a third higher, in instruments she never touched, with chords
// around it for the first time. The motif gets its harmony only after she has gone.
[[150, 'Dm'], [156, 'Gmaj7'], [162, 'Bbmaj7'], [168, 'C7sus'], [174, 'Dm']].forEach(([t, c], i, a) => arp(t, a[i + 1] ? a[i + 1][0] : 178, c, 24, 64));
stripeLoop(celesta, 152.0, 26, { v: 42, lo: 'A3', hi: 'B3', d: 0.7 });
stripeLoop(vibes, 153.2, 24.8, { v: 34, lo: 'A4', hi: 'B4', d: 0.6 });
stripeLoop(strings, 154.4, 23.6, { v: 34, lo: 'F3', hi: 'G3', d: 0.9 });
pad(strings, 158, 8, 'Gmaj7', 34, 66); pad(strings, 166, 8, 'Bbmaj7', 32, 66);
at(bass, 150, 10, 'D2', 44); at(bass, 162, 10, 'Bb1', 42); at(bass, 172, 6, 'D1', 40);
at(cello, 176.4, 2.6, 'F2', 34);                  // the last F, from far away, under the city

export default {
  name: 'forty-years-of-stripes',
  duration: 180,
  bpm: 60,
  tracks: [
    { id: 'piano', ...gm(0), notes: notes(piano), gain: -11, pan: -0.06, reverb: 0.42 },
    { id: 'celesta', ...gm(8), notes: notes(celesta), gain: -10, pan: 0.18, reverb: 0.6 },
    { id: 'vibes', ...gm(11), notes: notes(vibes), gain: -11, pan: 0.24, reverb: 0.58 },
    { id: 'strings', ...gm(48), notes: notes(strings), gain: -7, pan: 0.04, reverb: 0.55,
      cc: [{ t: 0, n: 11, v: 58 }, { t: 76, n: 11, v: 30, ramp: true }, { t: 96, n: 11, v: 34 },
           { t: 142, n: 11, v: 0, ramp: true }, { t: 150.5, n: 11, v: 56, ramp: true }, { t: 178, n: 11, v: 44, ramp: true }] },
    { id: 'cello', ...gm(42), notes: notes(cello), gain: -9, pan: -0.2, reverb: 0.36 },
    { id: 'bass', ...gm(43), notes: notes(bass), gain: -12, pan: -0.1, reverb: 0.3 },
    { id: 'horn', ...gm(60), notes: notes(horn), gain: -12, pan: -0.14, reverb: 0.46 },
    { id: 'flute', ...gm(73), notes: notes(flute), gain: -10, pan: 0.16, reverb: 0.44 },
    { id: 'harp', ...gm(46), notes: notes(harp), gain: -10, pan: 0.26, reverb: 0.48 },

    // birds: the dawn chorus, real birdsong's shape — a few quick high notes then a gap.
    { id: 'birds', type: 'sfx', gain: -15, events: [
      { t: 1.0, fx: 'blip', params: { freq: 2600, count: 5, interval: 0.09, len: 0.05, type: 'sine', space: 0.14, seed: 2, pan: -0.3 } },
      { t: 4.6, fx: 'blip', params: { freq: 3100, count: 4, interval: 0.11, len: 0.04, type: 'sine', space: 0.2, seed: 5, pan: 0.34 } },
      { t: 9.2, fx: 'blip', params: { freq: 2200, count: 7, interval: 0.07, len: 0.05, type: 'sine', space: 0.1, seed: 7, pan: -0.1 } },
      { t: 13.8, fx: 'blip', params: { freq: 2850, count: 4, interval: 0.1, len: 0.04, type: 'sine', space: 0.22, seed: 9, pan: 0.22 } },
      { t: 18.4, fx: 'blip', params: { freq: 2400, count: 6, interval: 0.08, len: 0.05, type: 'sine', space: 0.12, seed: 12, pan: -0.26 } },
      { t: 24.0, fx: 'blip', params: { freq: 3300, count: 3, interval: 0.13, len: 0.04, type: 'sine', space: 0.26, seed: 14, pan: 0.3 } },
      { t: 29.4, fx: 'blip', params: { freq: 2050, count: 8, interval: 0.06, len: 0.05, type: 'sine', space: 0.1, seed: 16, pan: -0.16 } },
      { t: 35.0, fx: 'blip', params: { freq: 2700, count: 5, interval: 0.09, len: 0.04, type: 'sine', space: 0.18, seed: 18, pan: 0.26 } },
      { t: 41.2, fx: 'blip', params: { freq: 2950, count: 4, interval: 0.1, len: 0.05, type: 'sine', space: 0.2, seed: 21, pan: -0.2 } },
      { t: 50.4, fx: 'blip', params: { freq: 2300, count: 6, interval: 0.08, len: 0.04, type: 'sine', space: 0.16, seed: 23, pan: 0.18 } },
      { t: 62.0, fx: 'blip', params: { freq: 2500, count: 9, interval: 0.06, len: 0.05, type: 'sine', space: 0.09, seed: 25, pan: -0.28 } },
      { t: 66.4, fx: 'blip', params: { freq: 3150, count: 5, interval: 0.09, len: 0.04, type: 'sine', space: 0.15, seed: 27, pan: 0.3 } },
      { t: 70.8, fx: 'blip', params: { freq: 2750, count: 6, interval: 0.08, len: 0.04, type: 'sine', space: 0.13, seed: 29, pan: -0.12 } },
      { t: 74.6, fx: 'blip', params: { freq: 3000, count: 4, interval: 0.1, len: 0.04, type: 'sine', space: 0.18, seed: 31, pan: 0.24 } },
      { t: 76.4, fx: 'blip', params: { freq: 3400, count: 2, interval: 0.16, len: 0.03, type: 'sine', space: 0.3, seed: 33, pan: 0.36, gain: -6 } },
    ] },

    // the mower: a low rumble on the motif's own 1.2 s cycle, so the score and the machine agree.
    { id: 'mower', type: 'sfx', gain: -22, events: [
      ...Array.from({ length: 13 }, (_, i) => ({ t: 1.2 + i * 1.2, fx: 'rumble', params: { dur: 0.85, cutoff: 210, grit: 0.42, seed: 40 + i } })),
      ...Array.from({ length: 13 }, (_, i) => ({ t: 17.0 + i * 1.2, fx: 'rumble', params: { dur: 0.9, cutoff: 240, grit: 0.5, seed: 60 + i } })),
      // 6 the board: it is still running, but it is idling and it is alone.
      { t: 77.0, fx: 'hum', params: { dur: 18.4, freq: 86, buzz: 0.5, space: 0.1, seed: 90 } },
      { t: 97.0, fx: 'rumble', params: { dur: 16.5, cutoff: 190, grit: 0.36, seed: 95 } },
      // 8 the choice: she finishes her own line, slower, on the same machine.
      { t: 118.0, fx: 'rumble', params: { dur: 11.0, cutoff: 205, grit: 0.44, seed: 99 } },
    ] },

    // the park itself, and then the city that replaced it.
    { id: 'air', type: 'sfx', gain: -20, events: [
      { t: 0, fx: 'wind', params: { dur: 44.0, strength: 0.3, gustiness: 0.6, seed: 3 } },
      { t: 44, fx: 'wind', params: { dur: 32.0, strength: 0.24, gustiness: 0.5, seed: 6 } },
      { t: 76, fx: 'wind', params: { dur: 12.0, strength: 0.4, gustiness: 0.9, seed: 11 } },
      { t: 96, fx: 'wind', params: { dur: 18.0, strength: 0.34, gustiness: 0.7, seed: 14 } },
      { t: 130, fx: 'wind', params: { dur: 11.5, strength: 0.26, gustiness: 0.5, seed: 17 } },
      { t: 142, fx: 'wind', params: { dur: 7.0, strength: 0.18, gustiness: 0.4, seed: 20 } },
      // 11 the city. no birds, no mower, no wind in the grass.
      { t: 150.5, fx: 'rumble', params: { dur: 27.5, cutoff: 90, grit: 0.22, seed: 44 } },
      { t: 152.0, fx: 'hum', params: { dur: 26.0, freq: 74, buzz: 0.18, space: 0.2, seed: 47 } },
      { t: 156.0, fx: 'wave', params: { dur: 22.0, period: 9.5, intensity: 0.5, bed: 0.25, seed: 51 } },
      { t: 164.0, fx: 'wave', params: { dur: 14.0, period: 11.0, intensity: 0.4, bed: 0.2, seed: 55 } },
      // distant, unsentimental traffic, well under the music
      { t: 152.0, fx: 'tick', params: { type: 'clock', count: 1, interval: 2, clicks: 5, rate: 14, seed: 58, gain: -14 } },
      { t: 168.0, fx: 'tick', params: { type: 'clock', count: 1, interval: 2, clicks: 4, rate: 11, seed: 61, gain: -16 } },
    ] },

    // one event on the turn: a distant door, far off, which is the only human sound after beat 5.
    { id: 'hits', type: 'sfx', gain: -21, events: [
      { t: 19.4, fx: 'shimmer', params: { dur: 2.0, root: 2400, sparkle: 0.4, space: 0.6 } },
      { t: 76.4, fx: 'shutter', params: { dur: 0.9, seed: 71 } },
      { t: 118.6, fx: 'shimmer', params: { dur: 1.6, root: 1900, sparkle: 0.5, space: 0.7 } },
      { t: 150.2, fx: 'shimmer', params: { dur: 3.2, root: 1600, sparkle: 0.7, space: 0.8 } },
      { t: 176.6, fx: 'impact', params: { dur: 2.2, subHz: 58, drop: 0.25, noise: 0.2, tail: 0.5, click: 0.3, space: 0.5 } },
    ] },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 3.6, return: 'music' } },
    master: { targetLUFS: -16, ceiling: -1 },
  },
};
