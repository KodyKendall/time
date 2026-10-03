// audio/scores/one.mjs — score for ONE OF MANY (web/src/one.js).
//
// 72 BPM, 4/4. One bar = 3.3333 s; 72 bars = 240.000 s exactly.
//
// THE CALL is three rising notes — D F A — and it is the whole film. The audience learns it
// in the first twenty seconds, because the bird plays it twice into an empty sky and gets
// nothing back but wind. THE ANSWER is the same three notes a third higher, F A C.
//
// Nobody plays the answer until 1:26, when the second bird does, on the oboe. From then on
// the two lines move together. The oboe stops at 2:37, on the frame the light goes out, and
// is not heard again for a minute. At 3:42 the hero plays THE ANSWER — on the oboe, in the
// dead bird's voice — to a stranger who is calling into an empty sky.
//
//   bars 0-13   alone         piano, and long silences that are meant to be uncomfortable
//   bars 13-17  the flock     strings arrive
//   bars 17-23  the tree      full and warm — belonging
//   bars 23-29  the answer    oboe calls at 1:26, flute replies at 1:28
//   bars 29-35  the whale     wide and slow: wonder, and someone to see it with
//   bars 35-43  together      the call and the answer in thirds. The loudest the film gets.
//   bars 43-47  the storm     timpani, a cluster, and then nothing, mid-bar, at 2:37
//   bars 47-52  after         silence but for one low cello
//   bars 52-65  alone again   the call at 3:13 with nothing behind it
//   bars 65-72  given away    the oboe returns at 3:42, played by the one who was left
import { midi as N, chord, humanizer } from '../lib/music.mjs';

const BPM = 72, BEAT = 60 / BPM, BAR = BEAT * 4;
const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
const hum = humanizer(41, { time: 0.009, vel: 6 });
const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });
const notes = (list) => list.map((n) => hum({ ...n }));

const LOSS = 156.67;
const BARS = 72;

// ---------------------------------------------------------------- harmony
const SECTIONS = [
  { from: 0, to: 13, ch: ['Dmadd9', 'Dmadd9', 'Bbmaj9', 'Dmadd9'] },   // alone
  { from: 13, to: 17, ch: ['Bbmaj9', 'Fmaj9', 'C', 'Dm9'] },           // the flock arrives
  { from: 17, to: 23, ch: ['F', 'C', 'Bb', 'F'] },                     // the tree
  { from: 23, to: 29, ch: ['Gm9', 'Bbmaj9', 'F', 'C'] },               // the answer
  { from: 29, to: 35, ch: ['Dm9', 'Bbmaj9', 'Fmaj9', 'C'] },           // the whale
  { from: 35, to: 43, ch: ['F', 'C', 'Bb', 'F'] },                     // together
  { from: 43, to: 47, ch: ['Bbm'] },                                   // the storm
  { from: 47, to: 52, ch: ['Dm'] },                                    // after: silence
  { from: 52, to: 59, ch: ['Dm', 'Dm9', 'Bbmaj9', 'Gm9'] },            // the grey tree
  { from: 59, to: 65, ch: ['Dm9', 'Bbmaj9', 'Gm9', 'Dm'] },            // one bird
  { from: 65, to: BARS, ch: ['Bbmaj9', 'F', 'C', 'Dmadd9', 'Bbmaj9', 'F', 'F'] },
];
const CHANGES = new Array(BARS);
for (const s of SECTIONS) for (let b = s.from; b < s.to; b++) CHANGES[b] = s.ch[(b - s.from) % s.ch.length];
const tones = CHANGES.map((c) => chord(c, { voicing: 'close', center: 64 }));
const roots = CHANGES.map((c) => chord(c, { bass: true, bassOctave: 2 })[0]);

const piano = [], strings = [], cello = [], horn = [], flute = [], oboe = [], harp = [], celesta = [], timp = [];

// ---------------------------------------------------------------- the call
const CALL = ['D5', 'F5', 'A5'];          // three rising notes. This is the film.
const ANSWER = ['F5', 'A5', 'C6'];        // the same shape, a third above
const CALL_R = [0.75, 0.75, 1.9];
const SONG = ['D5', 'F5', 'A5', 'G5', 'F5'];
const SONG_R = [1, 1, 2, 1, 3];

// Absolute-time phrase, so the music starts on the frame the ring of light leaves the bird.
function say(into, t0, names, rhythm, { oct = 0, v = 80, scale = 1 } = {}) {
  let b = 0;
  names.forEach((name, i) => {
    const d = rhythm[i] * scale;
    into.push({ t: t0 + b * BEAT, d: d * BEAT * 0.94, p: N(name) + oct * 12, v: v - i * 2 });
    b += d;
  });
}
const sing = (into, bar, names, opts) => say(into, T(bar), names, SONG_R, opts);

// ---------------------------------------------------------------- Act 1: alone
// Sparse on purpose. The silences after each call are the reason the film works.
piano.push(
  { t: T(0), d: BEAT * 6, p: N('D2'), v: 46 },
  { t: T(1), d: BEAT * 3.2, p: N('D4'), v: 44 },
  { t: T(2, 2), d: BEAT * 2.4, p: N('A4'), v: 42 },
  { t: T(3), d: BEAT * 4, p: N('D2'), v: 44 },
);
say(flute, 14.4, CALL, CALL_R, { v: 74 });                        // call one — nothing answers
piano.push({ t: T(5), d: BEAT * 4, p: N('Bb1'), v: 42 }, { t: T(5, 2), d: BEAT * 2, p: N('F4'), v: 40 });
say(flute, 24.4, CALL, CALL_R, { v: 78 });                        // call two — nothing answers
cello.push({ t: 29.5, d: 8.0, p: N('D2'), v: 34 });               // under the first intertitle
for (const b of [10, 11, 12]) {                                   // flying on, alone
  const ch = tones[b];
  piano.push({ t: T(b), d: BEAT * 3.6, p: roots[b], v: 44 });
  for (const e of [0, 1.5, 2.5]) piano.push({ t: T(b, e), d: BEAT * 1.2, p: ch[(e * 2) % ch.length] + 12, v: 36 });
}

// ---------------------------------------------------------------- Acts 2-3: flock, whale, together
for (let bar = 13; bar < 43; bar++) {
  const ch = tones[bar];
  const fig = [0, 2, 1, 3, 2, 4, 1, 2];
  for (let e = 0; e < 8; e++) {
    piano.push({ t: T(bar, e * 0.5), d: BEAT * 0.46, p: ch[fig[e] % ch.length] + (e >= 4 ? 12 : 0), v: 32 + (e % 4 === 0 ? 10 : 0) });
  }
  piano.push({ t: T(bar, 0), d: BEAT * 3.6, p: roots[bar], v: 48 });
  const v = bar >= 35 ? 68 : bar >= 29 ? 62 : bar >= 23 ? 54 : bar >= 17 ? 62 : 44;
  for (const p of ch) strings.push({ t: T(bar, 0), d: 4 * BEAT, p, v });
  cello.push({ t: T(bar, 0), d: BEAT * 2.1, p: roots[bar] - 12, v: 66 });
  cello.push({ t: T(bar, 2), d: BEAT * 1.9, p: roots[bar] - 5, v: 58 });
}
sing(horn, 17, SONG, { oct: -1, v: 82 });                          // the tree
sing(flute, 19, SONG, { v: 62 });
sing(horn, 21, SONG, { oct: -1, v: 76 });

say(oboe, 86.4, CALL, CALL_R, { v: 78 });                          // SOMETHING ANSWERS
say(flute, 88.4, ANSWER, CALL_R, { v: 76 });

sing(horn, 29, SONG, { oct: -1, v: 84 });                          // the whale: wide and slow
sing(flute, 31, SONG, { v: 72 });
sing(oboe, 31, ANSWER.concat(['Bb5', 'A5']), { v: 62 });
sing(horn, 33, SONG, { oct: -1, v: 78 });

say(flute, 128.4, CALL, CALL_R, { v: 80 });
say(oboe, 130.0, ANSWER, CALL_R, { v: 78 });
// Together: the call and the answer, in thirds, three times over. The loudest the film gets.
[35, 37, 41].forEach((bar, i) => {
  sing(flute, bar, SONG, { v: 84 + i * 2 });
  sing(oboe, bar, ANSWER.concat(['Bb5', 'A5']), { v: 74 + i * 2 });
  if (i) sing(horn, bar, SONG, { oct: -1, v: 62 });
});
for (let i = 0; i < 9; i++) {                                      // harp opens things out
  for (const bar of [17, 29, 35]) {
    harp.push({ t: T(bar) + i * 0.06, d: BEAT * 1.8, p: tones[bar].slice(0, 3)[i % 3] + 12 * Math.floor(i / 3), v: 60 - i });
  }
}
[[18, 0, 'D6'], [20, 2, 'A6'], [22, 0, 'D7'], [30, 0, 'A6'], [32, 2, 'D6'], [36, 0, 'A6'], [40, 2, 'D7']].forEach(([bar, beat, n]) => {
  celesta.push({ t: T(bar, beat), d: BEAT * 1.4, p: N(n), v: 56 });
});

// ---------------------------------------------------------------- Act 4: the storm, and the stop
for (let bar = 43; bar < 47; bar++) {
  const end = Math.min(T(bar + 1), LOSS);
  if (end <= T(bar)) break;
  for (const p of [N('Bb3'), N('Db4'), N('F4'), N('Gb4'), N('C5')]) {
    strings.push({ t: T(bar), d: end - T(bar), p, v: 62 + (bar - 43) * 8 });
  }
  cello.push({ t: T(bar), d: end - T(bar), p: N('Bb1'), v: 74 + (bar - 43) * 6 });
  for (let b = 0; b < 8; b++) {
    const t = T(bar, b * 0.5);
    if (t < LOSS) timp.push({ t, d: 0.3, p: N('Bb1'), v: 34 + (bar - 43) * 14 + b * 3 });
  }
}
timp.push({ t: LOSS - 0.06, d: 2.0, p: N('D1'), v: 104 });
// Then nothing at all, for thirteen seconds, except one low string and the rain.
cello.push({ t: LOSS + 0.5, d: 9.0, p: N('D2'), v: 36 });

// ---------------------------------------------------------------- Act 5: alone again
for (let bar = 52; bar < 65; bar++) {
  const ch = tones[bar];
  for (const p of ch) strings.push({ t: T(bar), d: 4 * BEAT, p, v: bar < 55 ? 30 : 40 });
  cello.push({ t: T(bar), d: BEAT * 3.4, p: roots[bar] - 12, v: 54 });
  if (bar >= 55) for (const e of [0, 2]) piano.push({ t: T(bar, e), d: BEAT * 1.6, p: ch[e % ch.length] + 12, v: 32 });
}
say(flute, 193.0, CALL, CALL_R, { v: 72 });    // the call. The oboe does not come. Nothing does.
sing(cello, 59, SONG, { oct: -2, v: 58 });     // the song, alone, an octave and a half down
sing(flute, 62, SONG, { v: 56 });

// ---------------------------------------------------------------- Act 6: given away
for (let bar = 65; bar < BARS; bar++) {
  const ch = tones[bar];
  for (const p of ch) strings.push({ t: T(bar), d: 4 * BEAT, p, v: bar < 67 ? 38 : 58 });
  cello.push({ t: T(bar), d: BEAT * 3.4, p: roots[bar] - 12, v: 58 });
  for (let e = 0; e < 8; e++) {
    piano.push({ t: T(bar, e * 0.5), d: BEAT * 0.46, p: ch[[0, 2, 1, 3, 2, 4, 1, 2][e] % ch.length] + (e >= 4 ? 12 : 0), v: 30 + (e % 4 === 0 ? 8 : 0) });
  }
}
say(flute, 214.4, CALL, CALL_R, { oct: 1, v: 58 });   // someone else, small and far off
say(oboe, 222.4, ANSWER, CALL_R, { v: 82 });          // and our bird answers, in the voice it lost
sing(flute, 68, SONG, { v: 76 });                     // the song comes back, both lines
sing(oboe, 68, ANSWER.concat(['Bb5', 'A5']), { v: 70 });
sing(horn, 70, SONG, { oct: -1, v: 64 });
[[68, 0, 'D6'], [70, 2, 'A6'], [71, 2, 'D6']].forEach(([bar, beat, n]) => {
  celesta.push({ t: T(bar, beat), d: BEAT * 1.6, p: N(n), v: 50 });
});
piano.push({ t: T(71, 2), d: BEAT * 6, p: N('D2'), v: 46 }, { t: T(71, 2), d: BEAT * 5, p: N('D4'), v: 44 });

export default {
  sampleRate: 48000,
  duration: 240,
  tempo: [{ t: 0, bpm: BPM }],
  tracks: [
    { id: 'piano', ...gm(0), notes: notes(piano), gain: -5, pan: -0.06, reverb: 0.34 },
    { id: 'strings', ...gm(48), notes: strings, gain: -12, pan: 0.05, reverb: 0.55, width: 1,
      cc: [{ t: T(13), n: 11, v: 28 }, { t: T(17), n: 11, v: 86, ramp: true }, { t: T(23), n: 11, v: 58 },
           { t: T(29), n: 11, v: 96, ramp: true }, { t: T(35), n: 11, v: 116, ramp: true }, { t: T(43), n: 11, v: 122 },
           { t: LOSS, n: 11, v: 0 }, { t: T(52), n: 11, v: 40 }, { t: T(65), n: 11, v: 52 },
           { t: T(68), n: 11, v: 90, ramp: true }, { t: T(71), n: 11, v: 44, ramp: true }] },
    { id: 'cello', ...gm(42), notes: notes(cello), gain: -8, pan: -0.22, reverb: 0.36 },
    { id: 'horn', ...gm(60), notes: notes(horn), gain: -7, pan: -0.14, reverb: 0.46 },
    { id: 'flute', ...gm(73), notes: notes(flute), gain: -4, pan: 0.12, reverb: 0.44, delay: 0.06 },
    { id: 'oboe', ...gm(68), notes: notes(oboe), gain: -6, pan: -0.20, reverb: 0.44 },
    { id: 'harp', ...gm(46), notes: notes(harp), gain: -11, pan: 0.26, reverb: 0.48 },
    { id: 'celesta', ...gm(8), notes: celesta, gain: -13, pan: 0.30, reverb: 0.56 },
    { id: 'timp', ...gm(47), notes: notes(timp), gain: -10, pan: 0, reverb: 0.32 },
    { id: 'air', type: 'sfx', gain: -27,
      events: [{ t: 0, fx: 'wind', params: { dur: 240, strength: 0.30, gustiness: 0.55, seed: 9 } }] },
    { id: 'weather', type: 'sfx', gain: -16,
      events: [
        { t: 49.0, fx: 'whoosh', params: { dur: 2.4, from: 180, to: 2000, peak: 0.30, air: 0.85, tone: 0.2 } },
        { t: 56.0, fx: 'shimmer', params: { dur: 3.0, root: 1180, sparkle: 0.5, space: 0.5 } },
        { t: 96.0, fx: 'shimmer', params: { dur: 3.6, root: 880, sparkle: 0.4, space: 0.65 } },
        { t: 146.0, fx: 'riser', params: { dur: 9.0 } },
        { t: 150.0, fx: 'wind', params: { dur: 20.0, strength: 1.0, gustiness: 0.95, seed: 3 } },
        { t: LOSS - 0.05, fx: 'impact', params: { dur: 3.2 } },
        { t: 226.0, fx: 'shimmer', params: { dur: 3.4, root: 1480, sparkle: 0.5, space: 0.6 } },
      ] },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 3.6, return: 'music' } },
    master: { targetLUFS: -17, ceiling: -1 },
  },
};
