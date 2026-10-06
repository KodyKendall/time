// audio/scores/nocturne_eb_strings.mjs — "Falling Light" with strings.
// Same solo-piano nocturne as nocturne_eb.mjs, plus a barely-there bed:
//   - slow strings (gm 49) sustain the harmony under B (bars 8–15) and the
//     climax (bars 19–23), silent elsewhere so A stays piano alone;
//   - cello (gm 42) doubles the bass roots in those sections.
// Strings carry CC11 swells; piano part is unchanged.
import { midi as N, chord, tempoMap, humanizer } from '../lib/music.mjs';

export default function nocturneEbStrings() {
  const TOTAL_BARS = 26; // 0–25, bar 25 = final held chord
  const tm = tempoMap([
    { beat: 0, bpm: 66 },
    { beat: 92, bpm: 66 },
    { beat: 104, bpm: 54, ramp: true },
  ]);
  const T = (bar, beat = 0) => tm.beat(bar * 4 + beat);
  const beatSec = 60 / 66;
  const hum = humanizer(5, { time: 0.006, vel: 4 });
  const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });

  // [bar, beat, chord, beats]
  const changes = [
    [0, 0, 'Ebmaj7', 4], [1, 0, 'Cm9', 4], [2, 0, 'Fm9', 4],
    [3, 0, 'Bb13sus', 2], [3, 2, 'Bb13', 2],
    [4, 0, 'Ebmaj7', 4], [5, 0, 'Abmaj9', 4],
    [6, 0, 'Fm9', 2], [6, 2, 'Bb13', 2],
    [7, 0, 'Ebmaj7', 2], [7, 2, 'G7b9', 2],
    [8, 0, 'Cm9', 4], [9, 0, 'Abmaj9', 4], [10, 0, 'Fm9', 4],
    [11, 0, 'G7b9', 2], [11, 2, 'G7alt', 2],
    [12, 0, 'Cm9', 4], [13, 0, 'Fm7b5', 4],
    [14, 0, 'Fm9', 2], [14, 2, 'Bb13', 2],
    [15, 0, 'Bb13sus', 2], [15, 2, 'Bb13', 2],
    [16, 0, 'Ebmaj7', 4], [17, 0, 'Cm9', 4], [18, 0, 'Fm9', 4],
    [19, 0, 'Bb13sus', 2], [19, 2, 'Bb13', 2],
    [20, 0, 'Ebmaj7', 4], [21, 0, 'Abmaj9#11', 4],
    [22, 0, 'Fm9', 2], [22, 2, 'Bb13', 2],
    [23, 0, 'Ebmaj7', 4], [24, 0, 'Ebmaj7', 4], [25, 0, 'Ebmaj7', 4],
  ];

  // Per-bar dynamic offsets (velocity): A tender, B swells, bar 21 climax, coda fades.
  const dyn = { 0: -8, 1: -8, 2: -6, 3: -4, 4: -8, 5: -4, 6: -2, 7: -2, 8: 0, 9: 0, 10: 2, 11: 4, 12: 4, 13: 4, 14: 6, 15: 6, 16: -6, 17: -4, 18: -2, 19: 0, 20: 2, 21: 6, 22: 2, 23: -4, 24: -10, 25: -12 };

  // [bar, beat, len(beats), note, vel]
  const mel = [
    [0, 0, 1, 'G4', 74], [0, 1, 1, 'Bb4', 76], [0, 2, 1.5, 'Eb5', 82], [0, 3.5, 0.5, 'D5', 74],
    [1, 0, 1, 'C5', 78], [1, 1, 1, 'Bb4', 74], [1, 2, 2, 'G4', 72],
    [2, 0, 1, 'Ab4', 74], [2, 1, 1, 'C5', 78], [2, 2, 2, 'Eb5', 82],
    [3, 0, 1.5, 'F5', 84], [3, 1.5, 0.5, 'Eb5', 78], [3, 2, 1, 'D5', 78], [3, 3, 1, 'C5', 76],
    [4, 0, 2, 'Bb4', 74], [4, 2, 1, 'G4', 70], [4, 3, 1, 'Bb4', 72],
    [5, 0, 1, 'C5', 78], [5, 1, 1, 'Eb5', 82], [5, 2, 2, 'G5', 86],
    [6, 0, 1, 'Ab5', 86], [6, 1, 1, 'G5', 82], [6, 2, 0.5, 'F5', 80], [6, 2.5, 0.5, 'Eb5', 78], [6, 3, 1, 'D5', 78],
    [7, 0, 1.5, 'Eb5', 80], [7, 1.5, 0.5, 'D5', 76], [7, 2, 1, 'B4', 78], [7, 3, 1, 'D5', 78],
    [8, 0, 2, 'C5', 80], [8, 2, 1, 'Eb5', 82], [8, 3, 1, 'D5', 78],
    [9, 0, 1.5, 'C5', 80], [9, 1.5, 0.5, 'Bb4', 76], [9, 2, 2, 'Ab4', 76],
    [10, 0, 1, 'Ab4', 76], [10, 1, 1, 'Bb4', 78], [10, 2, 2, 'C5', 82],
    [11, 0, 1, 'B4', 82], [11, 1, 1, 'D5', 84], [11, 2, 1, 'F5', 84], [11, 3, 1, 'Eb5', 82],
    [12, 0, 1, 'D5', 82], [12, 1, 1, 'C5', 80], [12, 2, 2, 'G4', 74],
    [13, 0, 1, 'C5', 80], [13, 1, 1, 'B4', 78], [13, 2, 1, 'Bb4', 78], [13, 3, 1, 'Ab4', 76],
    [14, 0, 1, 'Ab4', 76], [14, 1, 1, 'C5', 80], [14, 2, 0.5, 'Eb5', 82], [14, 2.5, 0.5, 'F5', 84], [14, 3, 1, 'G5', 86],
    [15, 0, 1.5, 'Ab5', 88], [15, 1.5, 0.5, 'G5', 84], [15, 2, 1, 'F5', 82], [15, 3, 1, 'Eb5', 80],
    [16, 0, 3.4, 'Eb5', 82],
    [17, 0, 1.5, 'G5', 84], [17, 1.5, 0.5, 'F5', 80], [17, 2, 1, 'Eb5', 80], [17, 3, 1, 'D5', 78],
    [18, 0, 2, 'C5', 80], [18, 2, 2, 'Eb5', 82],
    [19, 0, 1, 'F5', 84], [19, 1, 1, 'G5', 86], [19, 2, 1, 'Ab5', 88], [19, 3, 1, 'G5', 84],
    [20, 0, 2, 'G5', 86], [20, 2, 2, 'Bb5', 90],
    [21, 0, 1.5, 'C6', 92], [21, 1.5, 0.5, 'Bb5', 86], [21, 2, 1, 'Ab5', 84], [21, 3, 1, 'G5', 82],
    [22, 0, 1.5, 'F5', 82], [22, 1.5, 0.5, 'Eb5', 78], [22, 2, 1, 'D5', 78], [22, 3, 1, 'C5', 76],
    [23, 0, 2, 'Bb4', 74], [23, 2, 1, 'G4', 70], [23, 3, 1, 'Bb4', 72],
    [24, 0, 1, 'D5', 72], [24, 1, 1, 'C5', 70], [24, 2, 1, 'Bb4', 70], [24, 3, 1.5, 'Eb5', 74],
  ];

  const rh = mel.map(([bar, b, len, n, v]) =>
    hum({ t: T(bar, b), d: len * beatSec * 0.94, p: N(n), v: v + (dyn[bar] ?? 0) }));

  // LH: bass note + eighth-note broken chords per harmony segment
  const lh = [];
  for (const [bar, b0, sym, beats] of changes) {
    if (bar === 25) continue; // final chord handled below
    const root = chord(sym, { bass: true, bassOctave: 1 })[0] + 12;
    const tones = chord(sym, { voicing: 'close', center: 52 });
    const d = dyn[bar] ?? 0;
    lh.push(hum({ t: T(bar, b0), d: beats * beatSec * 0.9, p: root, v: 70 + d }));
    lh.push(hum({ t: T(bar, b0), d: beats * beatSec * 0.9, p: root + 7, v: 58 + d }));
    // flowing eighths: up then down the chord
    const seq = [...tones, tones[tones.length - 1] + 12, ...[...tones].reverse()];
    const n8 = Math.round(beats * 2);
    for (let i = 0; i < n8; i++) {
      const b = b0 + 0.5 + i * 0.5;
      if (b >= b0 + beats) break;
      const p = seq[i % seq.length];
      const accent = i % 4 === 0 ? 4 : 0;
      lh.push(hum({ t: T(bar, b), d: beatSec * 0.48, p, v: 56 + d + accent }));
    }
  }
  // Final bars: sustained tonic + rolled closing arpeggio (bottom to top)
  const finalTones = chord('Ebmaj7', { voicing: 'spread', center: 50 });
  [...finalTones.map((p) => p - 12), ...finalTones].forEach((p, i) =>
    lh.push({ t: T(24, 0) + i * 0.02, d: 6.5, p, v: 58 - i }));
  const closing = [N('Eb2'), N('Bb2'), N('Eb3'), N('G3'), N('Bb3'), N('Eb4'), N('G4'), N('Bb4'), N('Eb5')];
  closing.forEach((p, i) => lh.push({ t: T(25, 0) + i * 0.09, d: 5.0, p, v: 60 + (i === closing.length - 1 ? 14 : 0) }));

  // Pedal: change every 2 beats so harmonies don't blur
  const cc = [];
  for (const [bar, b0, , beats] of changes) {
    for (let b = b0; b < b0 + beats; b += 2) {
      cc.push({ t: T(bar, b), n: 64, v: 96 });
      cc.push({ t: T(bar, Math.min(b + 1.9, b0 + beats - 0.05)), n: 64, v: 12 });
    }
  }

  // ---- The "little bit more": strings + cello under B (8–15) and climax (19–23)
  const inBed = (bar) => (bar >= 8 && bar <= 15) || (bar >= 19 && bar <= 23);
  const strings = [];
  const cello = [];
  for (const [bar, b0, sym, beats] of changes) {
    if (!inBed(bar)) continue;
    const t0 = T(bar, b0);
    const t1 = T(bar, b0 + beats);
    const d = dyn[bar] ?? 0;
    for (const p of chord(sym, { voicing: 'close', center: 62 })) {
      strings.push(hum({ t: t0 + 0.03, d: t1 - t0 - 0.15, p, v: 42 + d }));
    }
    const root = chord(sym, { bass: true, bassOctave: 2 })[0];
    cello.push(hum({ t: t0, d: (t1 - t0) * 0.95, p: root, v: 52 + d }));
    cello.push(hum({ t: t0, d: (t1 - t0) * 0.9, p: root + 7, v: 44 + d }));
  }
  const stringsCC = [
    { t: T(8), n: 11, v: 32 },
    { t: T(12), n: 11, v: 84, ramp: true },
    { t: T(15, 2), n: 11, v: 90 },
    { t: T(16), n: 11, v: 30 },
    { t: T(19), n: 11, v: 44 },
    { t: T(21), n: 11, v: 94, ramp: true },
    { t: T(23, 2), n: 11, v: 52, ramp: true },
  ];

  const duration = T(25, 0) + 6.0;
  return {
    sampleRate: 48000, duration, tempo: tm.scoreTempo(),
    tracks: [
      { id: 'piano', ...gm(0), notes: [...lh, ...rh], cc, gain: -3, pan: 0, reverb: 0.34, eq: [{ type: 'hp', freq: 40 }] },
      { id: 'strings', ...gm(49), notes: strings, cc: stringsCC, gain: -13, pan: 0.05, width: 1, reverb: 0.55, eq: [{ type: 'hp', freq: 120 }] },
      { id: 'cello', ...gm(42), notes: cello, gain: -10, pan: -0.2, reverb: 0.36, eq: [{ type: 'hp', freq: 60 }] },
    ],
    mix: {
      fx: { reverb: { type: 'reverb', preset: 'hall', decay: 3.2, predelay: 0.02, return: 'music' } },
      master: { targetLUFS: -15, ceiling: -1, fadeOut: 2.0 },
    },
  };
}
