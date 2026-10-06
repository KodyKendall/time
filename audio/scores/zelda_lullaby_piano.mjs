// audio/scores/zelda_lullaby_piano.mjs — an original solo-piano lullaby in the spirit of
// a pastoral Nintendo-era theme: gentle, wistful, meant to send a listener to sleep.
// Nothing is quoted from any existing game cue; the melody, harmony and form are original.
//
// Character notes:
//   - 6/8 rocking meter, dotted-quarter ~ 60, with a slow ritardando into the final bars.
//   - Theme A: a rising fourth answered by a stepwise falling sigh (G–B–D ... A–B), the
//     classic cradle shape; stated twice, the second time a third higher and open-voiced.
//   - Theme B: E minor (relative minor), lower register, dotted figures, a chromatic
//     C natural under B7 for the one moment of colour.
//   - Left hand oom-pah-pah with a low root, plus rolled chords at each phrase opening.
//   - Theme A reprise doubles the tune in parallel thirds and adds two high "star" notes.
//   - Coda thins out to single notes and lets the final tonic ring under the pedal.
// Form: intro 4 | A 8 | B 8 | A' 8 | coda 4 + final bar = 33 bars (~100 s).
// Grand only: GM program 0 (Acoustic Grand) + sustain pedal (CC64).
import { midi as N, chord, tempoMap, humanizer } from '../lib/music.mjs';

export default function zeldaLullabyPiano() {
  const BPM = 120;                       // eighth-note pulse -> dotted quarter = 60
  const tm = tempoMap([
    { beat: 0, bpm: BPM },
    { beat: 150, bpm: BPM },
    { beat: 192, bpm: 104, ramp: true },
  ], { beatsPerBar: 6 });
  const EIGHTH = 60 / BPM;               // 0.5 s
  const T = (bar, beat = 0) => tm.beat(bar * 6 + beat);
  const hum = humanizer(11, { time: 0.008, vel: 5 });
  const gm = (program, extra = {}) => ({ sf: 'gm', bank: 0, program, ...extra });

  const INTRO = 0, A = 4, B = 12, APR = 20, CODA = 28, END = 32;
  const duration = T(END) + 6.5;

  const notes = [];
  const mel = (bar, beat, len, p, v) => {
    for (const n of [].concat(p)) notes.push(hum({ t: T(bar, beat), d: len * EIGHTH * 0.97, p: typeof n === 'string' ? N(n) : n, v }));
  };

  // diatonic third below a note name (E/A/B drop 4 semitones, C/D/F/G drop 3)
  const thirdBelow = (n) => {
    const letter = n[0];
    const acc = (n.match(/#/g)?.length ?? 0) - (n.match(/b/g)?.length ?? 0);
    return N(n) - (['E', 'A', 'B'].includes(letter) ? 4 : 3) - acc;
  };

  // ---------------------------------------------------------------- theme A (G major)
  const themeA = (bar0, { thirds = false, v = 76 } = {}) => {
    const head = [
      [0, 0, 2, 'G4', 0], [0, 2, 1, 'B4', 2], [0, 3, 3, 'D5', 4],
      [1, 0, 1, 'C5', -4], [1, 1, 1, 'B4', -2], [1, 2, 2, 'A4', -2], [1, 4, 2, 'B4', 0],
      [2, 0, 1, 'D5', 2], [2, 1, 1, 'E5', 4], [2, 2, 2, 'D5', 0], [2, 4, 2, 'B4', -4],
      [3, 0, 3, 'A4', -6], [3, 3, 3, 'F#4', -6],
      [4, 0, 2, 'B4', 4], [4, 2, 1, 'D5', 6], [4, 3, 3, 'G5', 8],
      [5, 0, 1, 'F#5', 6], [5, 1, 1, 'E5', 2], [5, 2, 2, 'D5', 0], [5, 4, 2, 'E5', 0],
      [6, 0, 1, 'F#5', 4], [6, 1, 2, 'G5', 6], [6, 3, 1, 'A5', 8], [6, 4, 2, 'G5', 4],
      [7, 0, 3, 'D5', 0], [7, 3, 3, 'B4', -4],
    ];
    for (const [b, beat, len, n, dv] of head) {
      mel(bar0 + b, beat, len, n, v + dv);
      if (thirds && len >= 2 && !n.endsWith('4')) mel(bar0 + b, beat, len, thirdBelow(n), v + dv - 13);
    }
  };

  // ---------------------------------------------------------------- theme B (E minor)
  const themeB = (bar0, v = 72) => {
    const head = [
      [0, 0, 3, 'E4', 0], [0, 3, 1, 'G4', 2], [0, 4, 2, 'B4', 4],
      [1, 0, 2, 'C5', 4], [1, 2, 1, 'B4', 0], [1, 3, 3, 'G4', -4],
      [2, 0, 1, 'A4', 0], [2, 1, 1, 'B4', 2], [2, 2, 3, 'D5', 4],
      [3, 0, 1, 'E5', 6], [3, 1, 2, 'D5', 2], [3, 3, 1, 'C5', 0], [3, 4, 2, 'A4', -2],
      [4, 0, 3, 'B4', 2], [4, 3, 3, 'G4', -4],
      [5, 0, 2, 'E5', 4], [5, 2, 1, 'D5', 0], [5, 3, 3, 'C5', 2],
      [6, 0, 1, 'D5', 2], [6, 1, 1, 'C5', 0], [6, 2, 1, 'B4', -2], [6, 3, 1, 'A4', -4], [6, 4, 2, 'B4', 0],
      [7, 0, 4, 'E4', -4], [7, 4, 2, 'G4', -2],
    ];
    for (const [b, beat, len, n, dv] of head) mel(bar0 + b, beat, len, n, v + dv);
  };

  // ---------------------------------------------------------------- melody
  const introRh = [
    [0, 3, 3, 'D5'], [1, 3, 3, 'B4'], [2, 3, 3, 'G4'], [3, 3, 3, 'F#4'],
  ];
  for (const [b, beat, len, n] of introRh) mel(INTRO + b, beat, len, n, 58);

  themeA(A, { v: 76 });
  themeB(B, { v: 72 });
  themeA(APR, { v: 72, thirds: true });

  // two high "stars" over the reprise peak
  mel(APR + 6, 4, 1.5, 'D6', 54);
  mel(APR + 4, 4, 1.5, 'B5', 50);

  const coda = [
    [0, 0, 2, 'D5', 70], [0, 2, 1, 'B4', 66], [0, 3, 3, 'G4', 62],
    [1, 0, 3, 'B4', 64], [1, 3, 3, 'G4', 60],
    [2, 0, 3, 'A4', 62], [2, 3, 3, 'F#4', 58],
    [3, 0, 4, 'G4', 60], [3, 4, 2, 'B4', 56],
  ];
  for (const [b, beat, len, n, v] of coda) mel(CODA + b, beat, len, n, v);

  // final rolled tonic, ringing out
  const finalTones = chord('Gmaj7', { voicing: 'close', center: 64 });
  finalTones.forEach((p, i) => notes.push(hum({ t: T(END) + i * 0.055, d: 5.2, p, v: 74 - i * 3 })));

  // ---------------------------------------------------------------- left hand
  const lh = [];
  const bass = (bar, sym, v = 68) => lh.push(hum({ t: T(bar), d: 3 * EIGHTH * 1.5, p: chord(sym, { bass: true, bassOctave: 1 })[0], v }));
  const pat = (bar, sym, v = 74) => {
    bass(bar, sym, v);
    const tones = chord(sym, { voicing: 'close', center: 55 });
    for (const [beat, len, vel] of [[3, 1.5, 56], [4.5, 1.5, 52]]) {
      tones.forEach((p, i) => lh.push(hum({ t: T(bar, beat) + i * 0.01, d: len * EIGHTH, p, v: vel - i * 2 })));
    }
  };
  const roll = (bar, sym, { center = 62, v = 60, gap = 0.28 } = {}) => {
    chord(sym, { voicing: 'close', center }).forEach((p, i) => {
      lh.push(hum({ t: T(bar) + i * gap * EIGHTH, d: 2.6, p, v: v - i * 2 }));
    });
  };

  const introChords = ['Gmaj7', 'Em7', 'C', 'D'];
  introChords.forEach((sym, b) => {
    roll(INTRO + b, sym, { center: 57, v: 56, gap: 0.5 });
    pat(INTRO + b, sym, 62);
  });

  const aChords = ['G', 'G', 'Em', 'D', 'G', 'C', 'D', 'G'];
  aChords.forEach((sym, b) => pat(A + b, sym));
  roll(A, 'Gmaj7', { v: 52, gap: 0.22 });

  const bChords = ['Em', 'C', 'G', 'D/F#', 'Em', 'C', 'B7', 'Em'];
  bChords.forEach((sym, b) => {
    pat(B + b, sym, 70);
    if (b === 4) roll(B + b, 'Em', { center: 55, v: 54, gap: 0.22 });
  });

  aChords.forEach((sym, b) => pat(APR + b, sym, 70));
  roll(APR, 'Gmaj7', { v: 56, gap: 0.22 });

  const codaChords = ['Gmaj7', 'G', 'Em', 'D'];
  codaChords.forEach((sym, b) => {
    const bar = CODA + b;
    if (b === 3) {
      bass(bar, 'D', 62);
      chord('G', { voicing: 'close', center: 55 }).forEach((p, i) => lh.push(hum({ t: T(bar, 3) + i * 0.02, d: 3 * EIGHTH, p, v: 52 - i * 2 })));
      return;
    }
    pat(bar, sym, b === 0 ? 68 : 62);
  });
  roll(CODA, 'Gmaj7', { center: 55, v: 52, gap: 0.24 });

  // ---------------------------------------------------------------- pedal
  const cc = [];
  const allBars = [...introChords, ...aChords, ...bChords, ...aChords, ...codaChords].length;
  for (let bar = 0; bar < allBars; bar++) {
    cc.push({ t: T(bar, 0), n: 64, v: 100 });
    cc.push({ t: T(bar, 5.6), n: 64, v: 24 });
  }
  cc.push({ t: T(END), n: 64, v: 110 });
  cc.push({ t: T(END) + 5.4, n: 64, v: 0 });

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