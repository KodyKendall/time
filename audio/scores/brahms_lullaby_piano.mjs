// audio/scores/brahms_lullaby_piano.mjs — Johannes Brahms, "Wiegenlied" (Op. 49 No. 4),
// "Guten Abend, gut' Nacht" (1868), arranged here for solo piano.
//
// The melody, its rhythm and the harmonic plan are Brahms's own, transcribed from the
// Mutopia Project edition of the Indiana University score (public domain):
//   https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1037
// Pitches are as written in the source (E-flat major, melody in the soprano octave).
// The accompaniment is my own voicing: a soft rocking waltz bass-chord-chord, the melody
// doubled a third below on the long notes, one rolled chord to open, and a final rolled
// tonic under a slow ritardando. Nothing about the tune itself is altered.
//
//   node audio/render.mjs audio/scores/brahms_lullaby_piano.mjs audio/build/brahms_lullaby_piano.wav
import { midi as N, chord, tempoMap, humanizer } from '../lib/music.mjs';

export default function brahmsLullabyPiano() {
  // 3/4, quarter = 62, easing to 54 for the closing phrase.
  const tm = tempoMap([
    { beat: 0, bpm: 62 },
    { beat: 39, bpm: 62 },
    { beat: 48, bpm: 54, ramp: true },
  ], { beatsPerBar: 3 });
  const T = (bar, beat = 0) => tm.beat(bar * 3 + beat);
  const hum = humanizer(5, { time: 0.009, vel: 5 });
  const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });

  const PRE = -1, END = 17;               // one bar of rolled-chord lead-in, 17 bars of song
  const duration = T(END) + 6.0;

  const notes = [];
  const mel = (bar, beat, len, n, v) => notes.push(hum({ t: T(bar, beat), d: len * (60 / 62) * 0.98, p: N(n), v }));
  // diatonic third below (E/A/B drop 4 semitones, C/D/F/G drop 3)
  const thirdBelow = (n) => {
    const acc = (n.match(/#/g)?.length ?? 0) - (n.match(/b/g)?.length ?? 0);
    return N(n) - (['E', 'A', 'B'].includes(n[0]) ? 4 : 3) - acc;
  };
  // melody + a soft inner voice a third below, as Brahms's own texture implies
  const line = (bar, beat, len, n, v, third = true) => {
    mel(bar, beat, len, n, v);
    if (third && len >= 1.5) mel(bar, beat, len, thirdBelow(n), v - 14);
  };

  // ---------------------------------------------------------------- melody (bars 1-17)
  // [bar, beat, beats, note, velocity]
  const melody = [
    [1, 2, 0.5, 'G5', 66], [1, 2.5, 0.5, 'G5', 60],
    [2, 0, 1.5, 'Bb5', 70], [2, 1.5, 0.5, 'G5', 62], [2, 2, 1, 'G5', 64],
    [3, 0, 1, 'Bb5', 68], [3, 2, 0.5, 'G5', 62], [3, 2.5, 0.5, 'Bb5', 64],
    [4, 0, 1, 'Eb5', 66], [4, 1, 1.5, 'D5', 62], [4, 2.5, 0.5, 'C5', 60],
    [5, 0, 1, 'C5', 62], [5, 1, 1, 'Bb5', 64], [5, 2, 0.5, 'F5', 62], [5, 2.5, 0.5, 'G5', 64],
    [6, 0, 1, 'Ab5', 68], [6, 1, 1, 'F5', 62], [6, 2, 0.5, 'F5', 60], [6, 2.5, 0.5, 'G5', 62],
    [7, 0, 1, 'Ab5', 66], [7, 2, 0.5, 'F5', 62], [7, 2.5, 0.5, 'Ab5', 64],
    [8, 0, 0.5, 'D5', 62], [8, 0.5, 0.5, 'C5', 60], [8, 1, 1, 'Bb5', 64], [8, 2, 1, 'D5', 66],
    [9, 0, 1, 'Eb5', 64], [9, 2, 0.5, 'Eb4', 58], [9, 2.5, 0.5, 'Eb4', 56],
    [10, 0, 2, 'Eb5', 68], [10, 2, 0.5, 'C5', 60], [10, 2.5, 0.5, 'Ab5', 62],
    [11, 0, 2, 'Bb5', 68], [11, 2, 0.5, 'G5', 62], [11, 2.5, 0.5, 'Eb5', 60],
    [12, 0, 1, 'Ab5', 64], [12, 1, 1, 'Bb5', 66], [12, 2, 1, 'C5', 64],
    [13, 0, 0.25, 'G5', 48], [13, 0.25, 1.75, 'Bb5', 70], [13, 2, 0.5, 'Eb4', 58], [13, 2.5, 0.5, 'Eb4', 56],
    [14, 0, 2, 'Eb5', 66], [14, 2, 0.5, 'C5', 60], [14, 2.5, 0.5, 'Ab5', 62],
    [15, 0, 2, 'Bb5', 66], [15, 2, 0.5, 'G5', 62], [15, 2.5, 0.5, 'Eb5', 60],
    [16, 0, 1, 'Ab5', 64], [16, 1, 0.25, 'Bb5', 48], [16, 1.25, 0.25, 'Ab5', 46],
    [16, 1.5, 0.5, 'G4', 58], [16, 2.5, 0.5, 'F4', 56],
  ];
  for (const [bar, beat, len, n, v] of melody) line(bar, beat, len, n, v);
  mel(17, 0, 2, 'Eb4', 58);

  // ---------------------------------------------------------------- left hand
  const lh = [];
  // one chord per beat; null = rest. Eb tonic throughout with passing Bb7 / Fm7,
  // matching Brahms's own accompaniment.
  const plan = [
    ['Eb', 'Eb', 'Eb'], ['Eb', 'Eb', 'Eb'], ['Eb', 'Eb', 'Eb'], ['Eb', 'Eb', 'Eb'],
    ['Bb', 'Bb', 'Bb'], ['Fm', 'Fm', 'Fm'], ['Fm', 'Fm', 'Bb'], ['Eb', 'Eb', 'Eb'],
    ['Eb', 'Eb', 'Bb'], ['Bb', 'Bb', 'Eb'], ['Eb', 'Eb', 'Eb'], ['Eb', 'Eb', 'Eb'],
    ['Eb', 'Eb', 'Eb'], ['Bb', 'Bb', 'Eb'], ['Eb', 'Eb', 'Eb'], ['Eb', 'Eb', 'Eb'],
    ['Eb', null, null],
  ];
  plan.forEach((beats, bar) => {
    beats.forEach((sym, beat) => {
      if (!sym) return;
      if (beat === 0) {
        const p = sym === 'Fm' ? 41 : sym === 'Bb' ? 34 : 39;
        lh.push(hum({ t: T(bar), d: (60 / 62) * 1.35, p, v: 62 }));
        return;
      }
      const tones = chord(sym, { voicing: 'close', center: 51 });
      tones.forEach((p, i) => lh.push(hum({ t: T(bar, beat) + i * 0.012, d: (60 / 62) * 0.85, p, v: (bar >= 13 ? 50 : 54) - i * 2 })));
    });
  });

  const roll = (bar, sym, { center = 55, v = 54, gap = 0.34 } = {}) => {
    chord(sym, { voicing: 'close', center }).forEach((p, i) => lh.push(hum({ t: T(bar) + i * gap * (60 / 62), d: 2.4, p, v: v - i * 2 })));
  };
  roll(PRE, 'Eb', { center: 55, v: 52 });

  // final chord: let it bloom, top note first
  chord('Eb', { voicing: 'close', center: 56 }).forEach((p, i) => {
    lh.push(hum({ t: T(17) + i * 0.06, d: 5.4, p, v: 66 - i * 2 }));
  });
  chord('Eb', { voicing: 'close', center: 75 }).forEach((p, i) => {
    notes.push(hum({ t: T(17) + 0.34 + i * 0.045, d: 5.0, p, v: 52 - i * 2 }));
  });

  // ---------------------------------------------------------------- pedal
  const cc = [];
  for (let bar = 1; bar < 17; bar++) {
    cc.push({ t: T(bar, 0), n: 64, v: 96 });
    cc.push({ t: T(bar, 2.85), n: 64, v: 28 });
  }
  cc.push({ t: T(17), n: 64, v: 104 });
  cc.push({ t: T(17) + 5.6, n: 64, v: 0 });

  return {
    sampleRate: 48000, duration, tempo: tm.scoreTempo(),
    tracks: [
      {
        id: 'piano', ...gm(0),
        notes: [...lh, ...notes], cc,
        gain: -3, pan: 0, reverb: 0.3,
        eq: [{ type: 'hp', freq: 38 }],
      },
    ],
    mix: {
      fx: { reverb: { type: 'reverb', preset: 'hall', decay: 3.0, predelay: 0.025, return: 'music' } },
      master: { targetLUFS: -14, ceiling: -1, fadeOut: 2.5 },
    },
  };
}