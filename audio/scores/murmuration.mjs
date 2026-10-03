// audio/scores/murmuration.mjs — score for MURMURATION (web/src/murmuration.js).
//
// 72 BPM, 4/4. One bar = 3.3333 s, six bars = 20.000 s exactly, and the harmony is a circle:
// bar 5 hands back to bar 0, so the music loops with the picture.
//
//   bar 0  Am(add9)    one bird        solo piano, nothing else
//   bar 1  Fmaj9       the boil        strings and cello arrive under a rising call
//   bar 2  Cmaj9       the whale       horn takes the theme; the widest the piece gets
//   bar 3  Gadd9       the tree        harp opens it out, celesta sparkles
//   bar 4  Fmaj7#11    the face        flute, alone over strings — the tender one
//   bar 5  Am(add9)    the return      everything leaves except the piano it began with
//
// Cue points are the same grid the animation is cut to: the boil at bar 0 beat 4, the whale at
// bar 1 beat 2.5, the tree at bar 2 beat 3, the face on the bar 4 downbeat.
import { midi as N, chord, humanizer } from '../lib/music.mjs';

const BPM = 72, BEAT = 60 / BPM, BAR = BEAT * 4;
const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
const hum = humanizer(23, { time: 0.009, vel: 6 });
const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });
const notes = (list) => list.map((n) => hum({ ...n }));

const CHANGES = ['Amadd9', 'Fmaj9', 'Cmaj9', 'Gadd9', 'Fmaj7#11', 'Amadd9'];
const tones = CHANGES.map((c) => chord(c, { voicing: 'close', center: 64 }));
const roots = CHANGES.map((c) => chord(c, { bass: true, bassOctave: 2 })[0]);

const piano = [], strings = [], cello = [], horn = [], flute = [], harp = [], celesta = [];

// ---------------------------------------------------------------- the theme
// A five-note call that rises, opens, and comes home. Every voice sings the same shape.
const CALL = {
  rise: ['E5', 'G5', 'A5'],                       // bar 1 — something is happening
  wide: ['C6', 'B5', 'A5', 'G5', 'E5'],           // bar 2 — the whale
  open: ['G5', 'A5', 'C6', 'D6', 'E6'],           // bar 3 — the tree
  tender: ['E6', 'D6', 'C6', 'A5', 'G5', 'E5'],   // bar 4 — the face
};
// Lay a phrase over a bar: rhythm in beats, then a held last note.
function phrase(into, bar, names, rhythm, { oct = 0, v = 80, hold = 2.0, beat = 0 } = {}) {
  let b = beat;
  names.forEach((name, i) => {
    const last = i === names.length - 1;
    const d = last ? hold : rhythm[i % rhythm.length];
    into.push({ t: T(bar, b), d: d * BEAT * 0.96, p: N(name) + oct * 12, v: v - (last ? 4 : 0) - i });
    b += d;
  });
}

// ---------------------------------------------------------------- piano
// Bar 0 and bar 5 are the whole point: the same two hands, alone, at both ends of the film.
piano.push(
  { t: T(0, 0), d: BEAT * 3.4, p: N('A2'), v: 62 },
  { t: T(0, 0), d: BEAT * 2.6, p: N('A4'), v: 70 },
  { t: T(0, 2), d: BEAT * 1.7, p: N('E5'), v: 64 },
  { t: T(0, 3), d: BEAT * 1.4, p: N('C5'), v: 68 },   // the boil, on the beat
);
// Bars 1-4: an eighth-note figure, low in the mix, that keeps the film breathing.
for (let bar = 1; bar <= 4; bar++) {
  const ch = tones[bar];
  const fig = [0, 2, 1, 3, 2, 4 % ch.length, 1, 2];
  for (let e = 0; e < 8; e++) {
    const p = ch[fig[e] % ch.length] + (e >= 4 ? 12 : 0);
    piano.push({ t: T(bar, e * 0.5), d: BEAT * 0.46, p, v: 40 + (e % 4 === 0 ? 10 : 0) + (bar === 4 ? -6 : 0) });
  }
  piano.push({ t: T(bar, 0), d: BEAT * 3.6, p: roots[bar], v: 56 });
}
// Bar 5: everything falls away and the opening gesture returns, a fifth lower to settle.
piano.push(
  { t: T(5, 0), d: BEAT * 3.2, p: roots[5], v: 58 },
  { t: T(5, 0), d: BEAT * 2.2, p: N('C5'), v: 58 },
  { t: T(5, 1.5), d: BEAT * 1.6, p: N('E5'), v: 54 },
  { t: T(5, 3), d: BEAT * 1.0, p: N('A4'), v: 60 },   // the bird lands; rings out by 20.0 s
);

// ---------------------------------------------------------------- strings + cello
for (let bar = 1; bar <= 5; bar++) {
  const ch = tones[bar];
  const v = bar === 2 ? 66 : bar === 4 ? 58 : bar === 5 ? 44 : 60;
  const len = bar === 5 ? 2.6 : 4;
  for (const p of ch) strings.push({ t: T(bar, 0), d: len * BEAT, p, v });
  cello.push({ t: T(bar, 0), d: BEAT * (bar === 5 ? 2.4 : 2.1), p: roots[bar] - 12, v: bar === 5 ? 56 : 74 });
  if (bar !== 5) cello.push({ t: T(bar, 2), d: BEAT * 1.9, p: roots[bar] - 5, v: 64 });
}

// ---------------------------------------------------------------- the melody, voice by voice
phrase(horn, 1, CALL.rise, [1, 1], { oct: -1, v: 74, hold: 1.6, beat: 1 });      // the boil
phrase(horn, 2, CALL.wide, [0.5, 0.5, 1, 1], { oct: -1, v: 86, hold: 2.2 });      // the whale
phrase(harp, 3, CALL.open, [0.5, 0.5, 0.5, 0.5], { v: 72, hold: 2.0, beat: 0 }); // the tree
phrase(flute, 3, CALL.open, [0.5, 0.5, 0.5, 0.5], { v: 66, hold: 2.0, beat: 0 });
phrase(flute, 4, CALL.tender, [1, 0.5, 0.5, 1], { v: 84, hold: 2.4 });            // the face
// The last word: the home note, alone, as the flock pours away.
flute.push({ t: T(5, 2), d: BEAT * 1.4, p: N('A5'), v: 50 });

// Harp: an opening sweep under the tree, a falling one as the face forms. The ladder is built
// from the bottom three chord tones so it climbs monotonically — a close voicing's 9th sits
// above the octave and puts a dip in the middle of the run.
const sweep = (bar, beat, steps, dir, v) => {
  const ch = tones[bar].slice(0, 3);
  for (let i = 0; i < steps; i++) {
    const k = dir > 0 ? i : steps - 1 - i;
    harp.push({ t: T(bar, beat) + i * 0.055, d: BEAT * 1.6, p: ch[k % ch.length] + 12 * Math.floor(k / ch.length), v: v - i });
  }
};
sweep(3, 0, 9, 1, 66);
sweep(4, 0, 9, -1, 58);

// Celesta: one sparkle at each thing the flock becomes.
[[1, 2.5, 'E6'], [2, 3, 'A6'], [3, 2, 'E7'], [5, 3, 'A5']].forEach(([bar, beat, n], i) => {
  celesta.push({ t: T(bar, beat), d: BEAT * 1.4, p: N(n), v: i === 3 ? 52 : 64 });
});

export default {
  sampleRate: 48000,
  duration: 20,
  tempo: [{ t: 0, bpm: BPM }],
  tracks: [
    { id: 'piano', ...gm(0), notes: notes(piano), gain: -5, pan: -0.06, reverb: 0.30 },
    { id: 'strings', ...gm(48), notes: strings, gain: -13, pan: 0.05, reverb: 0.52, width: 1,
      cc: [{ t: T(1), n: 11, v: 40 }, { t: T(2), n: 11, v: 104, ramp: true }, { t: T(4), n: 11, v: 86 },
           { t: T(5), n: 11, v: 74 }, { t: T(5, 2), n: 11, v: 34, ramp: true }] },
    { id: 'cello', ...gm(42), notes: notes(cello), gain: -9, pan: -0.22, reverb: 0.30 },
    { id: 'horn', ...gm(60), notes: notes(horn), gain: -7, pan: -0.14, reverb: 0.44 },
    { id: 'flute', ...gm(73), notes: notes(flute), gain: -6, pan: 0.12, reverb: 0.40, delay: 0.05 },
    { id: 'harp', ...gm(46), notes: notes(harp), gain: -10, pan: 0.26, reverb: 0.46 },
    { id: 'celesta', ...gm(8), notes: celesta, gain: -12, pan: 0.30, reverb: 0.55 },
    { id: 'air', type: 'sfx', gain: -30,
      events: [{ t: 0, fx: 'wind', params: { dur: 20, strength: 0.28, gustiness: 0.6, seed: 4 } }] },
    { id: 'gusts', type: 'sfx', gain: -21,
      events: [
        { t: 2.34, fx: 'whoosh', params: { dur: 1.5, from: 240, to: 2600, peak: 0.42, air: 0.75, tone: 0.2 } },
        { t: 9.00, fx: 'shimmer', params: { dur: 2.6, root: 1320, sparkle: 0.6, space: 0.55 } },
        { t: 17.30, fx: 'whoosh', params: { dur: 1.9, from: 1800, to: 220, peak: 0.34, air: 0.8, tone: 0.25, panFrom: 0.5, panTo: -0.5 } },
      ] },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 3.1, return: 'music' } },
    master: { targetLUFS: -16, ceiling: -1 },
  },
};
