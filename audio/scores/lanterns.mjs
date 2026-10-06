// audio/scores/lanterns.mjs — "Lanterns in the Pavilion" — original smooth-jazz ballad.
// Theory: F major, 84 BPM, 14 bars + tag. Functional plan with motivic development:
//   - Home: Fmaj9 (I, F Lydian colour #11) — motif M: rising P4 C->F + falling stepwise answer.
//   - Bars 1-3: Em7b5 -> A7alt -> Dm9 : viiø–V7/vi–vi (secondary ii–V into vi, dorian on Dm).
//   - Bar 4: Dbmaj9#11 : chromatic-mediant / Neapolitan colour (Db Lydian), melody peak.
//   - Bar 5: Cmaj9 : Vmaj tonicization (C Lydian), bright lift.
//   - Bars 6-8: Bbmaj9 (IV) -> Bbm9–Eb13 : modal-interchange minor-iv, then ii–V into bIII.
//   - Bar 9: Abmaj9 (bIII, Ab Lydian) : warm modulated plateau, motif in augmentation.
//   - Bars 10-12: Gm9 -> C13sus -> Fmaj9 : ii–V–I home (mixolydian sus resolves 4->3), turnaround D7alt.
//   - Tag: Fmaj9 shimmer. Melody uses chord-tones on downbeats, diatonic passings,
//     sequence + inversion of motif M for unity.
// Uses only the bundled GeneralUser-GS soundfont (gm) + procedural sfx so it renders anywhere.
import { midi as N, chord, tempoMap, swing, humanizer, scoop, vibrato, ccRamp } from '../lib/music.mjs';

export default function lanterns(overrides = {}) {
  const BPM = 84;
  const tm = tempoMap([{ beat: 0, bpm: BPM }]);
  const SW = 0.56; // light 16th swing
  const T = (bar, beat = 0) => tm.beat(bar * 4 + swing(beat, SW, 0.25));
  const beatSec = 60 / BPM;
  const hum = humanizer(7, { time: 0.005, vel: 5 });
  const hum2 = humanizer(21, { time: 0.004, vel: 7 });
  const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra, ...(overrides[program] ?? {}) });

  // bar -> chord symbol (0-based). 14 bars + tag bar 14.
  const prog = [
    'Fmaj9',        // 0  I
    'Em7b5',        // 1  viiø...
    'A7b9',         // 2  ...V7/vi
    'Dm9',          // 3  vi
    'Dbmaj9#11',    // 4  chromatic mediant peak
    'Cmaj9',        // 5  Vmaj lift
    'Bbmaj9',       // 6  IV
    'Bbm9',         // 7  minor-iv interchange
    'Eb13',         // 8  V7/bIII
    'Abmaj9',       // 9  bIII plateau
    'Gm9',          // 10 ii
    'C13sus',       // 11 V sus
    'Fmaj9',        // 12 I return
    'D7alt',        // 13 turnaround V7/vi
    'Fmaj9',        // 14 tag
  ];
  const END = 14;
  const duration = T(END) + 5.2;

  // ---------------- Rhodes/EP comping (rootless, anticipations)
  const rhodes = [];
  const compRhythm = [[0, 1.4, 72], [1.75, 0.5, 64], [2.5, 1.1, 68], [3.75, 0.25, 56]];
  const centers = [62, 62, 62, 62, 63, 62, 62, 62, 62, 63, 62, 62, 62, 62, 62];
  prog.forEach((sym, bar) => {
    const voice = bar % 2 === 0 ? 'rootlessA' : 'rootlessB';
    const v = chord(sym, { voicing: voice, center: centers[bar] ?? 62 });
    if (bar === END) {
      [...v, N('G5')].forEach((p, i) => rhodes.push({ t: T(bar) + i * 0.04, d: 4.6, p, v: 70 - i * 3 }));
      return;
    }
    for (const [b, len, vel] of compRhythm) {
      v.forEach((p, i) => rhodes.push(hum({ t: T(bar, b) + i * 0.007, d: len * beatSec * 0.95, p, v: vel - (i === 0 ? 4 : 0) })));
    }
  });

  // ---------------- Bass: roots on 1, chord-tone walk + chromatic approaches
  const bassMoves = {
    'Fmaj9': [['F1', 0, 1.6], ['C2', 1.6, 0.9], ['A1', 2.5, 0.8], ['G1', 3.3, 0.45], ['Ab1', 3.75, 0.25]],
    'Em7b5': [['E1', 0, 1.4], ['B1', 1.5, 0.9], ['G1', 2.5, 0.8], ['Ab1', 3.3, 0.45], ['A1', 3.75, 0.25]],
    'A7b9': [['A1', 0, 1.4], ['E2', 1.5, 0.9], ['C2', 2.5, 0.8], ['C#2', 3.3, 0.45], ['D2', 3.75, 0.25]],
    'Dm9': [['D2', 0, 1.6], ['A1', 1.6, 0.9], ['F1', 2.5, 0.8], ['E1', 3.3, 0.45], ['Eb1', 3.75, 0.25]],
    'Dbmaj9#11': [['Db2', 0, 1.8], ['Ab1', 1.8, 1], ['F1', 2.8, 0.7], ['G1', 3.5, 0.5]],
    'Cmaj9': [['C2', 0, 1.6], ['G1', 1.6, 0.9], ['E1', 2.5, 0.8], ['D2', 3.3, 0.45], ['Db2', 3.75, 0.25]],
    'Bbmaj9': [['Bb1', 0, 1.6], ['F1', 1.6, 0.9], ['D2', 2.5, 0.8], ['C2', 3.3, 0.45], ['B1', 3.75, 0.25]],
    'Bbm9': [['Bb1', 0, 1.6], ['F2', 1.6, 0.9], ['Db2', 2.5, 0.8], ['C2', 3.3, 0.45], ['B1', 3.75, 0.25]],
    'Eb13': [['Eb2', 0, 1.4], ['Bb1', 1.5, 0.9], ['G1', 2.5, 0.8], ['Ab1', 3.3, 0.45], ['A1', 3.75, 0.25]],
    'Abmaj9': [['Ab1', 0, 1.8], ['Eb2', 1.8, 1], ['C2', 2.8, 0.7], ['Bb1', 3.5, 0.5]],
    'Gm9': [['G1', 0, 1.6], ['D2', 1.6, 0.9], ['Bb1', 2.5, 0.8], ['A1', 3.3, 0.45], ['Ab1', 3.75, 0.25]],
    'C13sus': [['C2', 0, 1.6], ['G1', 1.6, 0.9], ['Bb1', 2.5, 0.8], ['B1', 3.3, 0.45], ['D2', 3.75, 0.25]],
    'D7alt': [['D2', 0, 1.4], ['A1', 1.5, 0.9], ['C2', 2.5, 0.8], ['Eb2', 3.3, 0.45], ['E2', 3.75, 0.25]],
  };
  const bass = [];
  prog.forEach((sym, bar) => {
    if (bar === END) { bass.push({ t: T(bar), d: 4.6, p: N('F1'), v: 94 }); return; }
    for (const [n, b, len] of (bassMoves[sym] ?? bassMoves['Fmaj9'])) {
      bass.push(hum({ t: T(bar, b), d: len * beatSec * 0.92, p: N(n), v: b === 0 ? 98 : 84 }));
    }
  });

  // ---------------- Brushes (GM brush kit program 40) + shaker/congas on standard kit
  const brushes = [];
  for (let bar = 0; bar < END; bar++) {
    const quiet = bar < 2 ? -8 : 0;
    for (let b = 0; b < 4; b++) brushes.push(hum({ t: T(bar, b), d: 0.3, p: 40, v: 50 + quiet })); // swirl
    for (const b of [1, 3]) brushes.push(hum2({ t: T(bar, b), d: 0.15, p: 38, v: 72 + quiet })); // tap
    brushes.push(hum({ t: T(bar, 0), d: 0.2, p: 36, v: 66 })); // kick
    if (bar % 2 === 1) brushes.push(hum({ t: T(bar, 2.5), d: 0.2, p: 36, v: 54 }));
  }
  brushes.push({ t: T(0), d: 2, p: 49, v: 60 });
  brushes.push({ t: T(12), d: 2, p: 49, v: 66 });
  brushes.push({ t: T(END), d: 3, p: 49, v: 70 });

  const perc = [];
  for (let bar = 0; bar < END; bar++) {
    for (let s = 0; s < 8; s++) perc.push(hum2({ t: T(bar, s / 2), d: 0.08, p: 82, v: [64, 40, 52, 40][s % 4] })); // shaker
    if (bar >= 3) {
      [[0, 62, 60], [1.5, 63, 74], [2.5, 62, 54], [3.25, 64, 78]]
        .forEach(([b, p, v]) => perc.push(hum({ t: T(bar, b), d: 0.2, p, v })));
    }
  }

  // ---------------- Lead: alto sax (GM 65) — motif M (rising 4th + fall), sequence + inversion + peak
  // [bar, beat, len(beats), note, vel, expressive?]
  const mel = [
    [0, 0, 1.4, 'C5', 84, true], [0, 1.5, 0.4, 'F5', 88], [0, 2, 0.5, 'E5', 78], [0, 2.5, 1.2, 'D5', 82],
    [1, 0, 0.5, 'E5', 80], [1, 0.5, 0.5, 'G5', 84], [1, 1, 1.5, 'Bb4', 82, true], [1, 2.5, 0.5, 'A4', 78], [1, 3, 0.75, 'C5', 84],
    [2, 0, 1.2, 'C#5', 86, true], [2, 1.25, 0.4, 'D5', 80], [2, 1.75, 0.5, 'E5', 78], [2, 2.5, 1.25, 'A4', 84],
    [3, 0, 0.6, 'D5', 86], [3, 0.6, 0.4, 'F5', 88], [3, 1, 1.6, 'A5', 92, true], [3, 2.75, 1, 'G5', 84],
    [4, 0, 1.8, 'Ab5', 94, true], [4, 2, 0.5, 'G5', 84], [4, 2.5, 0.5, 'F5', 82], [4, 3, 0.8, 'Eb5', 84],
    [5, 0, 1.4, 'E5', 86], [5, 1.5, 0.5, 'G5', 84], [5, 2, 1.5, 'B4', 88, true],
    [6, 0, 0.6, 'C5', 84], [6, 0.6, 0.4, 'F5', 86], [6, 1, 1.8, 'A5', 90, true], [6, 3, 0.75, 'G5', 82],
    [7, 0, 0.5, 'Bb4', 82], [7, 0.5, 0.5, 'Db5', 86], [7, 1, 1.6, 'C5', 88, true], [7, 2.75, 1, 'Bb4', 80],
    [8, 0, 1.2, 'Bb4', 84, true], [8, 1.25, 0.5, 'Eb5', 88], [8, 1.75, 0.5, 'G5', 86], [8, 2.5, 1.25, 'F5', 88],
    [9, 0, 2.0, 'G5', 90, true], [9, 2, 0.5, 'F5', 82], [9, 2.5, 1.2, 'Eb5', 84],
    [10, 0, 0.6, 'G5', 86], [10, 0.6, 0.4, 'A5', 88], [10, 1, 1.2, 'Bb5', 92, true], [10, 2.25, 0.5, 'A5', 84], [10, 2.75, 1, 'G5', 82],
    [11, 0, 1.6, 'A5', 88], [11, 1.75, 0.5, 'G5', 80], [11, 2.25, 0.5, 'E5', 80], [11, 2.75, 1, 'D5', 82],
    [12, 0, 1.4, 'C5', 86, true], [12, 1.5, 0.5, 'F5', 90], [12, 2, 0.5, 'A5', 88], [12, 2.5, 1.25, 'G5', 86],
    [13, 0, 0.5, 'A5', 86], [13, 0.5, 0.5, 'G#5', 82], [13, 1, 0.5, 'G5', 84], [13, 1.5, 0.5, 'F#5', 82], [13, 2, 1.5, 'G5', 86],
    [END, 0, 3.2, 'F5', 90, true],
  ];
  const sax = [], saxBend = [], saxCC = [];
  for (const [bar, b, len, n, v, sc] of mel) {
    const t = T(bar, b), d = len * beatSec * 0.97;
    sax.push({ t, d, p: N(n), v });
    if (sc) saxBend.push(...scoop(t - 0.005, { depth: -0.4, dur: 0.1 }));
    if (len >= 1.4 && bar !== END) saxBend.push(...vibrato(t + 0.12, t + d - 0.02, { depth: 0.07, rate: 5.2, delay: 0.22 }), { t: t + d, v: 0, curve: 'step' });
  }
  const endT = T(END), endD = 3.2 * beatSec;
  saxCC.push(...ccRamp(11, endT, endT + 0.7, 100, 127), ...ccRamp(11, endT + endD - 0.8, endT + endD, 127, 88));
  saxBend.push(...vibrato(endT + 0.2, endT + endD - 0.3, { depth: 0.08, rate: 5.0, delay: 0.3 }));

  // ---------------- Trumpet counterline (soft, fills gaps) + strings pad + vibes sparkle
  const flug = [];
  const counter = [[1, 2.0, 'D5'], [3, 2.75, 'E5'], [5, 3.0, 'C5'], [7, 2.75, 'D5'], [9, 3.0, 'C6'], [11, 3.0, 'F5'], [13, 2.0, 'E5']];
  for (const [bar, b, n] of counter) flug.push(hum({ t: T(bar, b), d: 0.9 * beatSec, p: N(n), v: 72 }));

  const strings = [];
  prog.forEach((sym, bar) => {
    if (bar === 13) return;
    const v = chord(sym, { voicing: 'spread', center: 55 }).slice(0, 3);
    const d = bar === END ? 4.8 : 4 * beatSec * 0.98;
    v.forEach((p) => strings.push({ t: T(bar) + 0.02, d, p: p - 12, v: 44 }));
  });

  const vib = [];
  ['F5', 'A5', 'C6', 'F6'].forEach((n, i) => vib.push({ t: T(4) + i * 0.11, d: 1.2, p: N(n), v: 66 - i * 3 }));
  ['Eb6', 'C6', 'Bb5', 'G5'].forEach((n, i) => vib.push({ t: T(9) + 0.1 + i * 0.12, d: 1.2, p: N(n), v: 64 - i * 3 }));
  ['F5', 'A5', 'C6', 'E6', 'G6'].forEach((n, i) => vib.push({ t: T(END) + 0.3 + i * 0.09, d: 3.2, p: N(n), v: 66 - i * 4 }));

  const tracks = [
    { id: 'keys', ...gm(4), notes: rhodes, gain: -4, pan: -0.2, width: 0.9, reverb: 0.18, eq: [{ type: 'hp', freq: 90 }] },
    { id: 'bass', ...gm(32), notes: bass, gain: -4, reverb: 0.06, eq: [{ type: 'hp', freq: 32, order: 4 }] },
    { id: 'brushes', ...gm(40, { drums: true }), notes: brushes, gain: -7, reverb: 0.12 },
    { id: 'perc', ...gm(0, { drums: true }), notes: perc, gain: -13, pan: 0.3, reverb: 0.14 },
    { id: 'lead', ...gm(65), notes: sax, bend: saxBend, cc: saxCC, gain: 0, pan: 0.05, reverb: 0.26, delay: 0.06, eq: [{ type: 'hp', freq: 140 }] },
    { id: 'flug', ...gm(56), notes: flug, gain: -8, pan: 0.3, reverb: 0.24, eq: [{ type: 'hp', freq: 180 }] },
    { id: 'strings', ...gm(49), notes: strings, gain: -11, pan: -0.25, width: 1, reverb: 0.32 },
    { id: 'vibes', ...gm(11), notes: vib, gain: -8, pan: 0.35, reverb: 0.32 },
  ];

  return {
    sampleRate: 48000, duration, tempo: tm.scoreTempo(), tracks,
    mix: {
      fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.4, predelay: 0.024, return: 'music' }, delay: { type: 'delay', time: beatSec * 0.75, feedback: 0.28, lp: 4000, hp: 400 } },
      master: { targetLUFS: -14, ceiling: -1, fadeOut: 1.2 },
    },
  };
}
