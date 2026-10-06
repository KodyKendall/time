// audio/scores/spunky_piano.mjs — original spunky piano tune composed from scratch
// with audio/score/theory.mjs helpers.
//
//   node audio/render.mjs audio/scores/spunky_piano.mjs audio/build/spunky_piano.wav
//
// Theory plan (key C major, 152 BPM, 4/4, AABA 32 bars):
// - Harmony: I-vi-ii-V core (C6 | A7 | Dm7 | G7) + secondary dominants.
//   A7 = V/vi -> Dm, D7 = V/V -> G. F#dim7 is a chromatic passing vii°/V into C/G.
//   Bridge goes to the IV (F) then cycles D7->G7 (V/V->V) home.
// - Left hand: stride — bass root/fifth on 1 & 3 (from chord().bass), chord shell
//   on 2 & 4 (from chord().iv). Oom-pah bounce = the "spunk".
// - Right hand: C major pentatonic (C D E G A) + blues rubs (Eb->E, Bb->B) for cheek,
//   Charleston-style syncopation (off-beat 8ths pushed via swingBeat), call-and-response
//   2-bar phrases, octave pops, one stop-time break, final chordScale run into a C6/9 tag.
import { midi as N, chord, keysVoicing, walkingBass, swingBeat, chordScale, seeded, DR } from '../score/theory.mjs';

const BPM = 152;
const BEAT = 60 / BPM; // seconds per quarter
const b2s = (beats) => beats * BEAT;
const T = (bar, beat = 0) => b2s(bar * 4 + beat);

// 32-bar AABA. [chordSym, bars]
const SECTIONS = [
  // A1
  ['C6', 1], ['C6', 1], ['A7', 1], ['A7', 1], ['Dm7', 1], ['G7', 1], ['C6', 1], ['G7', 1],
  // A2 (bar 14 = stop-time F, bar 15 = turnaround)
  ['C6', 1], ['C6', 1], ['A7', 1], ['A7', 1], ['Dm7', 1], ['G7', 1], ['F', 1], ['G7', 1],
  // B (bridge: IV, then V/V -> V)
  ['F', 1], ['F', 1], ['C6', 1], ['C6', 1], ['D7', 1], ['D7', 1], ['G7', 1], ['G7', 1],
  // A3 + tag
  ['C6', 1], ['A7', 1], ['Dm7', 1], ['G7', 1], ['C6', 1], ['F', 1], ['C6', 1], ['C6', 1],
];
const BAR_CHORD = SECTIONS.map(([s]) => s); // length 32

const notes = [];
const cc = [];
const rand = seeded(7);

// ---- left hand: stride (beats 1 & 3 = bass, 2 & 4 = chord stab) ----
let prevVoicing = null;
BAR_CHORD.forEach((sym, bar) => {
  if (bar === 13) return; // stop-time bar: silence except the hit (handled below)
  const c = chord(sym);
  // bass notes: root on 1, fifth (or third for color) on 3, low octave
  const rootLow = N('C2') + ((c.bass - 0 + 12) % 12);
  const fifthLow = rootLow + 7;
  const bassHits = [
    { beat: 0, p: rootLow, v: 72 },
    { beat: 2, p: bar % 2 ? fifthLow : rootLow + 12, v: 66 },
    { beat: 2.5, p: rootLow + 12, v: 58 }, // cheeky octave pickup
  ];
  for (const h of bassHits) {
    notes.push({ t: T(bar, h.beat), d: BEAT * 0.9, p: h.p, v: h.v });
  }
  // chord stabs on 2 & 4 via rootless-ish voicing centered ~C4
  const v1 = keysVoicing(sym, 60, prevVoicing);
  prevVoicing = v1;
  const v2 = keysVoicing(sym, 60, v1);
  prevVoicing = v2;
  for (const [beat, vox, vel] of [[1, v1, 62], [3, v2, 64]]) {
    vox.forEach((p, i) => notes.push({ t: T(bar, beat) + i * 0.008, d: BEAT * 0.55, p, v: vel - i }));
  }
  // sustain pedal: down on 1, up on 4.5
  cc.push({ t: T(bar, 0), n: 64, v: 80 });
  cc.push({ t: T(bar, 3.5), n: 64, v: 20 });
});

// stop-time bar 13 (F): band hits on 1 and 2-and, piano answers
{
  const stabs = keysVoicing('F', 62, prevVoicing);
  stabs.forEach((p) => notes.push({ t: T(13, 0), d: BEAT * 0.5, p, v: 84 }));
  notes.push({ t: T(13, 0), d: BEAT * 0.9, p: N('F2'), v: 80 });
  stabs.forEach((p) => notes.push({ t: T(13, 1.5), d: BEAT * 0.5, p, v: 84 }));
  notes.push({ t: T(13, 1.5), d: BEAT * 0.9, p: N('C3'), v: 78 });
  // piano fill answers in the gap (F major scale fragment)
  const fill = ['A4', 'Bb4', 'C5', 'D5', 'E5', 'F5'];
  fill.forEach((n, i) => notes.push({ t: T(13, 2 + i * 0.25), d: BEAT * 0.28, p: N(n), v: 74 + i * 2 }));
  cc.push({ t: T(13, 0), n: 64, v: 70 });
}

// ---- right hand: the hook ------------------------------------------
// [bar, beat, durBeats, note, vel] — 2-bar call + 2-bar response, syncopated.
// Pentatonic core + blue grace notes (Eb->E). Off-beat 8ths get swingBeat push.
const MEL = [
  // A1 call (bars 0-1): "hey!" motif
  [0, 0, 0.5, 'E5', 88], [0, 0.5, 0.5, 'G5', 90], [0, 1, 1, 'C6', 94], [0, 2, 0.5, 'B5', 86], [0, 2.5, 0.5, 'A5', 86], [0, 3, 1, 'G5', 90],
  [1, 0, 0.5, 'A5', 88], [1, 0.5, 0.5, 'C6', 90], [1, 1, 1.5, 'D6', 94], [1, 2.5, 0.5, 'B5', 84], [1, 3, 0.5, 'G5', 86], [1, 3.5, 0.5, 'E5', 84],
  // response (bars 2-3): A7 -> blues rub
  [2, 0, 0.5, 'C#6', 90], [2, 0.5, 0.5, 'E6', 92], [2, 1, 1, 'D6', 90], [2, 2, 0.5, 'C#6', 86], [2, 2.5, 0.5, 'A5', 84], [2, 3, 1, 'E5', 88],
  [3, 0, 0.75, 'E5', 90], [3, 1, 0.25, 'Eb5', 70], [3, 1.25, 0.75, 'E5', 90], [3, 2, 0.5, 'G5', 88], [3, 2.5, 0.5, 'A5', 88], [3, 3, 1, 'G5', 92],
  // bars 4-5: ii-V bounce, octave pops
  [4, 0, 0.5, 'A5', 88], [4, 0.5, 0.5, 'F5', 86], [4, 1, 0.5, 'A5', 90], [4, 1.5, 0.5, 'D6', 92], [4, 2, 1, 'C6', 90], [4, 3, 0.5, 'A5', 86], [4, 3.5, 0.5, 'F5', 84],
  [5, 0, 0.5, 'G5', 88], [5, 0.5, 0.5, 'B5', 90], [5, 1, 0.5, 'D6', 92], [5, 1.5, 0.5, 'G6', 94], [5, 2, 1, 'F6', 92], [5, 3, 0.5, 'D6', 88], [5, 3.5, 0.5, 'B5', 86],
  // bars 6-7: home + turnaround sparkle
  [6, 0, 0.5, 'E6', 94], [6, 0.5, 0.5, 'C6', 90], [6, 1, 0.5, 'A5', 88], [6, 1.5, 0.5, 'G5', 88], [6, 2, 1, 'E5', 90], [6, 3, 0.5, 'G5', 86], [6, 3.5, 0.5, 'A5', 86],
  [7, 0, 0.5, 'B5', 90], [7, 0.5, 0.5, 'D6', 92], [7, 1, 1, 'G6', 94], [7, 2, 0.5, 'F6', 90], [7, 2.5, 0.5, 'D6', 88], [7, 3, 0.5, 'B5', 88], [7, 3.5, 0.5, 'G5', 86],
  // A2: same hook up a playful step, bars 8-11
  [8, 0, 0.5, 'G5', 88], [8, 0.5, 0.5, 'A5', 90], [8, 1, 1, 'E6', 94], [8, 2, 0.5, 'D6', 86], [8, 2.5, 0.5, 'C6', 86], [8, 3, 1, 'A5', 90],
  [9, 0, 0.5, 'C6', 88], [9, 0.5, 0.5, 'E6', 90], [9, 1, 1.5, 'G6', 94], [9, 2.5, 0.5, 'E6', 84], [9, 3, 0.5, 'C6', 86], [9, 3.5, 0.5, 'A5', 84],
  [10, 0, 0.5, 'E6', 90], [10, 0.5, 0.5, 'G6', 92], [10, 1, 1, 'A6', 94], [10, 2, 0.5, 'G6', 86], [10, 2.5, 0.5, 'E6', 84], [10, 3, 1, 'C#6', 88],
  [11, 0, 0.75, 'D6', 90], [11, 1, 0.25, 'Eb6', 70], [11, 1.25, 0.75, 'D6', 90], [11, 2, 0.5, 'A5', 88], [11, 2.5, 0.5, 'C#6', 88], [11, 3, 1, 'E6', 92],
  [12, 0, 0.5, 'F6', 90], [12, 0.5, 0.5, 'D6', 88], [12, 1, 0.5, 'F6', 92], [12, 1.5, 0.5, 'A6', 94], [12, 2, 1, 'G6', 90], [12, 3, 0.5, 'F6', 86], [12, 3.5, 0.5, 'D6', 84],
  // bar 13 is stop-time (LH fill covers it); RH joins the fill tail
  [13, 2, 0.5, 'F5', 88], [13, 2.5, 0.5, 'G5', 88], [13, 3, 0.5, 'A5', 90], [13, 3.5, 0.5, 'C6', 92],
  // bars 14-15: turnaround lift
  [14, 0, 0.5, 'A5', 88], [14, 0.5, 0.5, 'C6', 90], [14, 1, 0.5, 'F6', 92], [14, 1.5, 0.5, 'E6', 90], [14, 2, 0.5, 'D6', 88], [14, 2.5, 0.5, 'C6', 88], [14, 3, 1, 'A5', 90],
  [15, 0, 0.5, 'G5', 88], [15, 0.5, 0.5, 'B5', 90], [15, 1, 1, 'D6', 92], [15, 2, 0.5, 'B5', 88], [15, 2.5, 0.5, 'G5', 86], [15, 3, 0.5, 'A5', 86], [15, 3.5, 0.5, 'B5', 88],
  // B bridge bars 16-19: sing higher, longer notes (contrast)
  [16, 0, 1.5, 'A5', 90], [16, 1.5, 0.5, 'C6', 88], [16, 2, 0.5, 'D6', 88], [16, 2.5, 0.5, 'E6', 90], [16, 3, 1, 'F6', 92],
  [17, 0, 2, 'G6', 94], [17, 2, 0.5, 'F6', 88], [17, 2.5, 0.5, 'E6', 88], [17, 3, 1, 'D6', 90],
  [18, 0, 1, 'E6', 92], [18, 1, 1, 'C6', 90], [18, 2, 0.5, 'A5', 88], [18, 2.5, 0.5, 'G5', 86], [18, 3, 1, 'E5', 88],
  [19, 0, 1, 'G5', 90], [19, 1, 1, 'A5', 90], [19, 2, 1, 'C6', 92], [19, 3, 1, 'E6', 94],
  // bars 20-23: V/V->V chain, rhythmic anticipation of each bar (the "and-of-4" pickup)
  [20, 0, 0.5, 'F#5', 88], [20, 0.5, 0.5, 'A5', 90], [20, 1, 0.5, 'D6', 92], [20, 1.5, 0.5, 'F#6', 94], [20, 2, 1, 'E6', 90], [20, 3, 0.5, 'D6', 88], [20, 3.5, 0.5, 'C#6', 88],
  [21, 0, 1, 'D6', 92], [21, 1, 0.5, 'E6', 90], [21, 1.5, 0.5, 'F#6', 92], [21, 2, 1, 'A6', 94], [21, 3, 1, 'G6', 90],
  [22, 0, 0.5, 'G5', 90], [22, 0.5, 0.5, 'B5', 92], [22, 1, 1, 'D6', 92], [22, 2, 0.5, 'G6', 94], [22, 2.5, 0.5, 'F6', 90], [22, 3, 1, 'D6', 90],
  [23, 0, 1, 'B5', 90], [23, 1, 1, 'D6', 92], [23, 2, 0.5, 'G5', 88], [23, 2.5, 0.5, 'A5', 88], [23, 3, 0.5, 'B5', 90], [23, 3.5, 0.5, 'D6', 92],
  // A3 finale bars 24-29: hook returns, higher + louder
  [24, 0, 0.5, 'E5', 90], [24, 0.5, 0.5, 'G5', 92], [24, 1, 1, 'C6', 96], [24, 2, 0.5, 'E6', 94], [24, 2.5, 0.5, 'D6', 90], [24, 3, 1, 'C6', 92],
  [25, 0, 0.5, 'C#6', 92], [25, 0.5, 0.5, 'E6', 94], [25, 1, 1, 'A6', 96], [25, 2, 0.5, 'G6', 90], [25, 2.5, 0.5, 'E6', 88], [25, 3, 1, 'C#6', 90],
  [26, 0, 0.5, 'D6', 92], [26, 0.5, 0.5, 'F6', 94], [26, 1, 0.5, 'A6', 96], [26, 1.5, 0.5, 'G6', 92], [26, 2, 1, 'F6', 90], [26, 3, 0.5, 'D6', 88], [26, 3.5, 0.5, 'F6', 88],
  [27, 0, 0.5, 'E6', 94], [27, 0.5, 0.5, 'G6', 94], [27, 1, 1, 'C7', 98], [27, 2, 0.5, 'B6', 92], [27, 2.5, 0.5, 'G6', 90], [27, 3, 0.5, 'E6', 90], [27, 3.5, 0.5, 'G6', 92],
  [28, 0, 0.5, 'A6', 94], [28, 0.5, 0.5, 'G6', 92], [28, 1, 0.5, 'E6', 90], [28, 1.5, 0.5, 'C6', 90], [28, 2, 1, 'A5', 90], [28, 3, 0.5, 'C6', 88], [28, 3.5, 0.5, 'E6', 90],
  [29, 0, 1, 'F6', 94], [29, 1, 1, 'E6', 92], [29, 2, 0.5, 'D6', 90], [29, 2.5, 0.5, 'C6', 90], [29, 3, 1, 'D6', 92],
];

// push melody with swing + tiny humanize
for (const [bar, beat, dur, n, v] of MEL) {
  const j = (rand() - 0.5) * 0.012; // ±6 ms feel
  const sw = swingBeat(beat, 0.62, 0.5); // push off-beat 8ths late = bounce
  notes.push({ t: T(bar, sw) + j, d: b2s(dur) * 0.92, p: N(n), v });
}
// grace-note blues rubs: crushed Eb->E before two downbeats
for (const [bar, beat] of [[3, 3], [11, 3]]) {
  notes.push({ t: T(bar, beat) - 0.045, d: 0.04, p: N('Eb5'), v: 66 });
}

// ---- finale: chordScale run + C6/9 tag (bars 30-31) ----
{
  const pcs = chordScale('C6'); // C major-ish pitch classes from theory
  // build a 2-octave run C5 -> E6 from those classes
  let p = N('C5');
  const run = [p];
  while (run[run.length - 1] < N('E6')) {
    let q = run[run.length - 1] + 1;
    while (!pcs.includes(((q % 12) + 12) % 12)) q++;
    run.push(q);
  }
  run.forEach((midiP, i) => notes.push({ t: T(30, i * 0.25), d: BEAT * 0.3, p: midiP, v: 82 + Math.round(i * 1.2) }));
  // octave pops into the final hit
  notes.push({ t: T(31, 0), d: BEAT * 0.4, p: N('C5'), v: 80 });
  notes.push({ t: T(31, 0.5), d: BEAT * 0.4, p: N('C6'), v: 88 });
  // final C6/9 crunch: C E G A D across two octaves
  const tag = ['C3', 'G3', 'E4', 'G4', 'A4', 'D5', 'E5', 'C6'];
  tag.forEach((n, i) => notes.push({ t: T(31, 1) + i * 0.012, d: 3.2, p: N(n), v: 88 - Math.max(0, i - 4) * 3 }));
  cc.push({ t: T(31, 1), n: 64, v: 100 });
  cc.push({ t: T(31, 1) + 3.0, n: 64, v: 0 });
}

// walking bass: full 32-bar stroll from theory (quarter notes, chromatic
// approaches into each new root) — its own track so it can sit under the stride.
const walk = walkingBass(SECTIONS.map(([s, bars]) => [s, bars * 4]), { low: 28, high: 55, rng: rand, start: 36 });
const bassNotes = walk.map(([bt, m, ], i) => ({
  t: b2s(bt) + (rand() - 0.5) * 0.008,
  d: BEAT * (bt % 4 === 3 ? 0.95 : 0.85),
  p: m,
  v: bt % 4 === 0 ? 72 : 66,
}));

// drums: spunky swing on the GeneralUser Jazz kit (GM 128:32).
// Ride spang-a-lang (quarters + triplet skips after 2 & 4), feathered kick on
// 1 & 3, hat chicks on 2 & 4, snare comping on the "and"s, crashes on section
// tops, snare-build fill into each new section.
const drums = [];
{
  const sectTops = new Set([0, 8, 16, 24]);
  for (let bar = 0; bar < 32; bar++) {
    // crash on section tops
    if (sectTops.has(bar)) drums.push({ t: T(bar, 0), d: 0.4, p: DR.crash, v: 88 });
    // ride: quarters + skips (triplet-ish, 0.666 late)
    for (const b of [0, 1, 2, 3]) drums.push({ t: T(bar, b), d: 0.2, p: DR.ride, v: b % 2 ? 78 : 84 });
    for (const b of [1.666, 3.666]) drums.push({ t: T(bar, b), d: 0.15, p: DR.ride, v: 66 });
    // kick feathered, hat chicks
    for (const b of [0, 2]) drums.push({ t: T(bar, b), d: 0.15, p: DR.kick, v: 70 });
    for (const b of [1, 3]) drums.push({ t: T(bar, b), d: 0.1, p: DR.hatC, v: 62 });
    // snare comping: deterministic syncopation, louder on the bridge/finale
    const hot = bar >= 16 ? 0.5 : 0.32;
    for (const b of [0.5, 1.5, 2.5, 3.5]) {
      if (rand() < hot) drums.push({ t: T(bar, swingBeat(b, 0.62, 0.5)), d: 0.12, p: DR.snare, v: 64 + Math.round(rand() * 14) });
    }
    // rim click through the stop-time bar, then a pickup
    if (bar === 13) {
      drums.push({ t: T(bar, 0), d: 0.1, p: DR.stick, v: 90 });
      drums.push({ t: T(bar, 1.5), d: 0.1, p: DR.stick, v: 90 });
      for (let k = 0; k < 4; k++) drums.push({ t: T(bar, 2 + k * 0.25), d: 0.1, p: DR.snare, v: 70 + k * 4 });
    }
    // one-bar snare build into each section
    if (bar === 7 || bar === 15 || bar === 23) {
      for (let k = 0; k < 8; k++) drums.push({ t: T(bar, k * 0.5), d: 0.1, p: DR.snare, v: 62 + k * 3 });
      drums.push({ t: T(bar, 3.5), d: 0.2, p: DR.crash, v: 80 });
    }
  }
  // final tag: kick + crash with the piano hit
  drums.push({ t: T(31, 1), d: 0.5, p: DR.crash, v: 92 });
  drums.push({ t: T(31, 1), d: 0.3, p: DR.kick, v: 84 });
  drums.sort((a, b) => a.t - b.t);
}

notes.sort((a, b) => a.t - b.t);
cc.sort((a, b) => a.t - b.t);

const duration = T(32) + 4.2;

export default {
  sampleRate: 48000,
  duration,
  tempo: [{ t: 0, bpm: BPM }],
  tracks: [
    {
      id: 'piano',
      sf: 'gm', bank: 0, program: 0, // GeneralUser grand (only bank on disk)
      notes, cc,
      gain: -3, pan: 0, reverb: 0.28,
      eq: [{ type: 'hp', freq: 40 }],
    },
    {
      id: 'bass',
      sf: 'gm', bank: 0, program: 32, // GeneralUser Acoustic Bass
      notes: bassNotes, cc: [],
      gain: -5, pan: -0.1, reverb: 0.06,
      eq: [{ type: 'hp', freq: 30 }],
    },
    {
      id: 'drums',
      sf: 'gm', program: 32, drums: true, // GeneralUser GS Jazz kit (128:32), GM keys
      notes: drums, cc: [],
      gain: -8, reverb: 0.1,
      eq: [{ type: 'hp', freq: 30 }],
    },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.2, predelay: 0.02, return: 'music' } },
    master: { targetLUFS: -14, ceiling: -1, fadeOut: 1.5 },
  },
};
