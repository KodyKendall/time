// audio/scores/wrenkite_lullaby.mjs — original score for TETHERED (Wren & the Kite, told by the Kite).
//
// A completely fresh composition, written to the actual film: the measured voice
// recordings (all 12 beats: entries at T+1.5s, real durations, real pauses), the story's
// three acts, the plates, and the scene transitions. It shares nothing with the earlier
// score except the film itself — no reused motifs, no reused structure.
//
// Concept: TWO HANDS. Wren is static, so her music never changes: a rocking piano
// lullaby in D major, the same notes every time, only re-dressed (her hands mending,
// her lantern walk, her waiting). The Kite is dynamic, so its music is one flute that
// keeps trying to sing Wren's tune a fifth higher, in its own key of A — and keeps
// breaking off (wanting, fighting, falling) — until beat 11, where both play the tune
// together for the first time. Separation, attempted union, union. That is the whole piece.
//
// Voice map (measured, film seconds; voice enters each beat at T+1.5):
//   b01  VO 1.5-21.3    b02  VO 23.8-54.2   b03  VO 56.7-90.3    b04  VO 92.8-141.4 (breathless)
//   b05  VO 143.9-170.0 (spoken "Ping" ~146.7, her silence 147.2-148.1 — respected: nothing plays)
//   b06  VO 172.5-202.6  b07  VO 205.1-252.5 ("I flipped over" ~226.6, thorn-tree line ~249-252.5)
//   b08  VO 255.0-284.6 (lantern sentence ~281-284.6)  b09  VO 287.1-319.0
//   b10  VO 321.5-350.8 ("it held" ~347.5-350.5)  b11  VO 353.3-394.6 ("leaned in" ~373-376)
//   b12  VO 397.1-408.4 (moral pause 403.6-404.5 — everything drops to one piano D)
//
// Rules that keep it soft and out of her way: nothing continuous (no wind beds, no bass
// track at all — the lowest voice is cello D2, used sparingly); velocities stay low under
// the voice and bloom only in her breaths, her measured pauses, and the tails; reverb is
// a small room (1.9s), not a hall; the fall is scored as vacuum (one small wind shift,
// then airless), not noise.
import { midi as N, chord, humanizer } from '../lib/music.mjs';

const hum = humanizer(23, { time: 0.008, vel: 5 });
const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });
const notes = (list) => list.map((n) => hum({ ...n }));
const at = (into, t, d, p, v) => into.push({ t, d, p: typeof p === 'string' ? N(p) : p, v });
const pad = (into, t, d, sym, v, center = 62) => { for (const p of chord(sym, { voicing: 'spread', center })) at(into, t, d, p, v); };

const piano = [], strings = [], cello = [], flute = [], horn = [], clar = [], celesta = [], pizz = [];

// Wren's lullaby: a 12-second rocking phrase. Times/durations fixed, intervals relative
// so any voice can sing it in any key. Base 74 = D5 (piano home), base 81 = A5 (kite's key).
const MEL_T = [0, 1, 2, 3, 4.5, 5.5, 6.5, 7.5];
const MEL_D = [1, 1, 1, 1.5, 1, 1, 1, 2.5];
const MEL_IV = [0, 4, 7, 11, 7, 4, 2, 0];
function phrase(into, t0, base, v) {
  for (let i = 0; i < 8; i++) at(into, t0 + MEL_T[i], MEL_D[i], base + MEL_IV[i], i === 7 ? v - 4 : v);
}
// The lullaby's left hand: patient rocking bass, bars of D | G | Em | D.
function rocking(t0, v) {
  at(piano, t0, 2.6, 'D3', v); at(piano, t0 + 3, 2.6, 'G2', v - 2);
  at(piano, t0 + 6, 2.6, 'E2', v - 2); at(piano, t0 + 9, 2.6, 'D3', v);
}
// The Kite's cry: the tune's first four notes in its own key, breaking off unresolved.
function cry(t0, v, cut = 4) {
  const seq = [['A5', 1], ['C#6', 1], ['E6', 1], ['F#6', 1.6]];
  for (let i = 0; i < Math.min(cut, 4); i++) at(flute, t0 + [0, 1, 2, 3][i], seq[i][1], seq[i][0], v - i * 2);
}
// Heartbeat: uneven low pulse for the fight. Quiet on purpose — her words run over it.
function heartbeat(t0, t1, v0, v1) {
  for (let t = t0; t < t1 - 0.1; t += 2) {
    const k = (t - t0) / Math.max(1, t1 - t0);
    for (const o of [0, 0.75, 1.5]) at(cello, t + o, 0.5, 'D2', Math.round(v0 + (v1 - v0) * k));
  }
}
// A fast rising run (the swifts), used rarely: they are guests, not residents.
function run(into, t, from, n, v, step = 0.11) {
  const scale = [0, 2, 4, 6, 7, 9, 11];
  const base = N(from);
  for (let i = 0; i < n; i++) at(into, t + i * step, step * 1.4, base + scale[i % 7] + 12 * Math.floor(i / 7), v - (i % 3) * 3);
}

// ---------------------------------------------------------------- ACT I. THE PULL
// b01 first memory (VO 1.5-21.3). Dawn hill, folded kite, her hands: lullaby alone, intimate.
at(piano, 0.2, 3.0, 'D3', 32);
phrase(piano, 0.8, 74, 36); rocking(0.8, 28);
pad(strings, 12, 10, 'Gmaj9', 28, 60); at(cello, 12, 8, 'G2', 32);
at(piano, 21.3, 1.2, 'D4', 30);          // tail: one note into the cut

// b02 she ran (VO 23.8-54.2). The lullaby walks; the kite tries its first cry; at
// "for a while we were one line" both voices sing together — bleeding one breath past the cut.
at(cello, 22.4, 1.6, 'D2', 38); at(cello, 23.1, 1.4, 'A2', 36);
phrase(piano, 23.2, 74, 38); rocking(23.2, 30);
at(cello, 30, 6, 'D2', 34); at(cello, 38, 6, 'G2', 34);
cry(40, 46);                              // first attempt, breaks
phrase(piano, 48, 74, 40); phrase(flute, 48, 74, 42);   // one line: girl, string, me
pad(strings, 48, 8, 'Dadd9', 32, 64);

// b03 the want (VO 56.7-90.3). Her tune keeps its shape but the color cools; his cries
// get shorter; at "the string said no" (~85.5) everything stops dead.
at(cello, 55.3, 2.0, 'D2', 40);
pad(strings, 62, 8, 'Bm9', 30, 60); pad(strings, 74, 8, 'Em9', 32, 60);
cry(62, 48); cry(68, 44, 3); cry(74, 40, 3);
run(clar, 64, 'D5', 10, 42); run(clar, 70, 'E5', 10, 40);
at(piano, 78, 2.0, 'A4', 36); at(piano, 80, 1.2, 'G4', 32);   // the high note, unanswered
pad(pizz, 85.5, 0.25, 'D', 72, 55);       // the string says no
at(cello, 88.5, 2.5, 'A3', 32);           // the hum, leading the fight

// b04 fighting (VO 92.8-141.4, breathless). Heartbeat under her words, three soft thuds
// where he dives/swings/yanks (~107/110.5/113.5), four sawing passes (~120-132), one gust
// rising into the snap. No walls: single lines only.
heartbeat(92, 141, 31, 40);
at(strings, 100, 30, 'A5', 21); at(strings, 100, 30, 'Bb5', 21);   // the rub: hating her laugh
for (const t of [107, 110.5, 113.5]) { at(piano, t, 0.8, 'D2', 42); at(piano, t, 0.8, 'D3', 38); }
for (const t of [120, 124, 128, 132]) { at(piano, t, 0.5, 'D2', 28); at(piano, t + 0.3, 0.5, 'C#2', 28); }
pad(strings, 136, 6.4, 'Dm', 38, 58); pad(strings, 139, 3.4, 'A7', 48, 58);   // gust rising

// ---------------------------------------------------------------- ACT II. LOOSE
// b05 snap (VO 143.9-170). One gust, the halo on her spoken Ping (~146.6), then nothing
// for her beat of silence (147.2-148.3), then weightless strings; horn warms Wren reaching.
run(strings, 142.4, 'D4', 14, 50);
at(celesta, 146.6, 2.0, 'A6', 44); at(flute, 146.6, 2.0, 'A6', 42);   // halo on "Ping"
pad(strings, 148.5, 11.5, 'Dmaj9', 40, 66);
at(horn, 158, 8, 'D4', 46); at(horn, 160, 6, 'A4', 44);

// b06 free (VO 172.5-202.6). For the only time he sings the whole tune — in HIS key, A —
// over high shimmer. No low instrument anywhere: orchestrate the absence (nothing to lean on).
phrase(flute, 173, 81, 52); phrase(flute, 186, 81, 48);
pad(strings, 171, 16, 'Dmaj9', 30, 72); pad(strings, 187, 16, 'Gmaj9', 30, 72);
run(clar, 178, 'A5', 9, 38); run(clar, 190, 'B5', 9, 36);

// b07 the fall (VO 205.1-252.5). One small wind shift, then vacuum: his tune starts four
// times and is cut off, strings sink in single steps, a lurch where he flips (~226.4),
// and the thorn-tree impact (~250.5) — then stop.
cry(206.5, 46, 3); cry(210, 42, 3); cry(213.5, 38, 2); cry(217, 34, 2);
at(strings, 208, 8, 'D4', 34); at(strings, 216, 8, 'C#4', 34);
at(strings, 224, 8, 'C4', 34); at(strings, 232, 8, 'B3', 34);
at(piano, 226.4, 1.2, 'D2', 40); at(piano, 226.4, 1.2, 'E2', 40);   // the flip: a stumble
pad(strings, 228, 20, 'Bbmaj7', 36, 58);

// b08 thorn tree (VO 255-284.6). The film's one true silence — only rain — until the warm
// dot of light (~281): a single cello D.
// deepened for the sobbing take: an octave lower under her grief, landing with the lantern line (~283)
at(cello, 283.0, 3.6, 'D2', 36); at(cello, 283.0, 3.6, 'D3', 34);
at(piano, 283.0, 3.0, 'D2', 28);

// ---------------------------------------------------------------- ACT III. TAUT
// b09 the search (VO 287.1-319). Her accompaniment without a melody (humming without words),
// long cello tones, one horn call, and her walk: soft irregular pizz footsteps.
for (let t = 287; t < 318; t += 2) at(piano, t, 1.6, (t / 2) % 2 < 1 ? 'D3' : 'A2', 28);
at(cello, 289, 8, 'D2', 34); at(cello, 298, 8, 'G2', 34); at(cello, 307, 8, 'D2', 34);
at(horn, 304, 5, 'D3', 44); at(horn, 306, 3, 'G3', 42);
for (const [t, n] of [[288.5, 'D4'], [290, 'D4'], [291, 'G3'], [293.5, 'D4'], [295, 'G3'], [298, 'D4'],
  [300.5, 'D4'], [303, 'G3'], [306, 'D4'], [309, 'D4'], [312, 'G3'], [315, 'D4']]) at(pizz, t, 0.4, n, 28);
at(piano, 319, 1.2, 'D3', 28);

// b10 the mend (VO 321.5-350.8). Solo piano hymn low and patient; three celesta stitches;
// one warm chord where the knot holds (~348).
phrase(piano, 322, 62, 38); phrase(piano, 336, 62, 38);
at(piano, 322, 3, 'D3', 30); at(piano, 329, 3, 'G2', 28); at(piano, 336, 3, 'E2', 28); at(piano, 343, 3, 'D3', 30);
for (const t of [330, 334, 338]) at(celesta, t, 1.0, 'G6', 34);
at(cello, 322, 10, 'D2', 30); at(cello, 336, 10, 'G2', 30);
for (const n of ['D3', 'F#3', 'A3', 'D4']) at(piano, 348, 3.0, n, 42);   // it held

// b11 leaning in (VO 353.3-394.6). Morning mirror of b01 — then the old anger flickers and
// dies at "taut" (~371-373), and at "So I leaned in" both voices sing the tune TOGETHER,
// same notes, same octave: the film's first true unison. Strings climb past the old heights;
// the swifts visit once and leave.
at(piano, 351.9, 2.5, 'D3', 32); at(cello, 351.9, 2.5, 'D2', 34);
phrase(piano, 356, 74, 38); rocking(356, 28);        // she ran. i caught. (remembered)
heartbeat(365, 371, 38, 42);                          // the old anger, briefly
phrase(piano, 373, 74, 44); phrase(flute, 373, 74, 48);   // leaned in: one tune, two voices
pad(strings, 373, 12, 'Dadd9', 44, 64);
pad(strings, 379, 13, 'Gmaj9', 52, 66); pad(strings, 385, 7, 'Dadd9', 54, 66);
at(horn, 381, 7, 'D4', 52); at(horn, 383, 5, 'A4', 50);
run(clar, 387, 'A5', 10, 42);                         // the swifts, leaving
at(piano, 394.6, 1.2, 'D4', 32);

// b12 held (VO 397.1-408.4). Wide shot, resolving strings; at her moral pause (403.6-404.5)
// everything falls away to one piano D, then blooms under "holds me up"; the lullaby's last
// three notes dissolve under the title.
pad(strings, 395.6, 16, 'Dadd9', 46, 64);
at(piano, 403.6, 1.0, 'D3', 36);
for (const n of ['D3', 'F#3', 'A3', 'D4', 'F#4']) at(piano, 404.5, 4.0, n, 44);
pad(strings, 404.5, 8, 'Gmaj9', 38, 64);
at(piano, 408.5, 1.6, 'E5', 34); at(piano, 409.5, 1.6, 'F#5', 34); at(piano, 410.5, 2.5, 'D5', 34);

// ---------------------------------------------------------------- credits coda (414-450)
// Her voice is done; the music plays the film out under the title, the moral, and the credits:
// the lullaby once whole on piano, once in union with the flute, then one last D major bloom.
phrase(piano, 415, 74, 36); rocking(415, 26);
pad(strings, 415, 12, 'Dadd9', 36, 64);
phrase(piano, 428, 74, 40); phrase(flute, 428, 74, 42);
pad(strings, 428, 11, 'Gmaj9', 40, 64); pad(strings, 434, 5, 'Dadd9', 42, 64);
at(cello, 428, 10, 'D2', 32); at(cello, 434, 5, 'G2', 30);
for (const n of ['D3', 'F#3', 'A3', 'D4', 'F#4']) at(piano, 440, 8.0, n, 40);
pad(strings, 440, 8, 'Dadd9', 40, 64);
at(cello, 440, 8, 'D2', 34); at(flute, 441, 7, 'A5', 36); at(horn, 442, 6, 'D4', 36);

export default {
  sampleRate: 48000,
  duration: 450,
  tempo: [{ t: 0, bpm: 60 }],
  tracks: [
    { id: 'piano', ...gm(0), notes: notes(piano), gain: -8, pan: -0.06, reverb: 0.30 },
    { id: 'strings', ...gm(48), notes: strings, gain: -14, pan: 0.05, reverb: 0.40, width: 1,
      cc: [{ t: 0, n: 11, v: 50 }, { t: 136, n: 11, v: 50 }, { t: 142.4, n: 11, v: 95, ramp: true },
           { t: 148.5, n: 11, v: 45, ramp: true }, { t: 379, n: 11, v: 55 }, { t: 392, n: 11, v: 95, ramp: true },
           { t: 404.5, n: 11, v: 55, ramp: true }] },
    { id: 'cello', ...gm(42), notes: notes(cello), gain: -11, pan: -0.22, reverb: 0.30 },
    { id: 'flute', ...gm(73), notes: notes(flute), gain: -9, pan: 0.14, reverb: 0.38, delay: 0.05 },
    { id: 'horn', ...gm(60), notes: notes(horn), gain: -11, pan: -0.14, reverb: 0.36 },
    { id: 'clarinet', ...gm(71), notes: notes(clar), gain: -13, pan: 0.3, reverb: 0.36 },
    { id: 'celesta', ...gm(8), notes: celesta, gain: -12, pan: 0.3, reverb: 0.40 },
    { id: 'pizz', ...gm(45), notes: pizz, gain: -11, pan: 0.1, reverb: 0.28 },
    { id: 'air', type: 'sfx', gain: -16,
      events: [
        { t: 138, fx: 'wind', params: { dur: 4.4, strength: 0.4, gustiness: 0.7, seed: 21 } },
        { t: 142.4, fx: 'wind', params: { dur: 3.6, strength: 0.5, gustiness: 0.6, seed: 22 } },
        { t: 204, fx: 'wind', params: { dur: 2.5, strength: 0.25, gustiness: 0.4, seed: 23 } },
      ] },
    { id: 'rain', type: 'sfx', gain: -24,
      events: [{ t: 254, fx: 'crackle', params: { dur: 26, density: 150, hiss: 0.4, roar: 0, seed: 24 } }] },
    { id: 'hits', type: 'sfx', gain: -12,
      events: [
        { t: 85.4, fx: 'whoosh', params: { dur: 0.5, from: 300, to: 2400, peak: 0.35, air: 0.5, tone: 0.3 } },
        { t: 142.4, fx: 'shimmer', params: { dur: 2.0, root: 1760, sparkle: 0.5, space: 0.4 } },
        { t: 250.5, fx: 'impact', params: { dur: 1.6, subHz: 70, drop: 0.3, noise: 0.5, tail: 0.4, click: 0.9, space: 0.2 } },
      ] },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'room', decay: 1.9, return: 'music' } },
    master: { targetLUFS: -16, ceiling: -1 },
  },
};
