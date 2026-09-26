// audio/scores/demo.mjs — ~24 s smooth-jazz demo (96 BPM, light 16th swing) exercising the whole toolchain.
// ii–V–I–vi in Db: Ebm9 | Ab13 | Dbmaj9 | Bbm9  (x2) + tag on Dbmaj9.
// Bars 1–4: sticks (ride/hat/kick/rim) ; bars 5–8: brushes ; horn-section stabs from bar 5 ; vibes fill in bar 8.
import { midi as N, chord, tempoMap, swing, humanizer, scoop, fall, vibrato, ccRamp, DRUMS, BRUSH, PERC } from '../lib/music.mjs';
import { inst } from '../lib/instruments.mjs';

export default function demo(overrides = {}) {
  const BPM = 96;
  const tm = tempoMap([{ beat: 0, bpm: BPM }]);
  const SW = 0.56; // light 16th swing
  const T = (bar, beat = 0) => tm.beat(bar * 4 + swing(beat, SW, 0.25)); // bar is 0-based, beat 0..4 within bar
  const beatSec = 60 / BPM;
  const hum = humanizer(11, { time: 0.005, vel: 5 });
  const hum2 = humanizer(23, { time: 0.004, vel: 8 });
  const I = { ...overrides };
  const pick = (name) => ({ ...inst(name), ...(I[name] ?? {}) });

  const prog = ['Ebm9', 'Ab13', 'Dbmaj9', 'Bbm9', 'Ebm9', 'Ab13', 'Dbmaj9', 'Bbm9', 'Dbmaj9'];
  const forms = ['rootlessA', 'rootlessA', 'rootlessA', 'rootlessB'];
  const END_BAR = 8; // tag bar index
  const duration = T(END_BAR) + 4 * beatSec + 2.9; // ring-out ≈ 24 s

  // ---------------- Rhodes: comping rhythm (anticipations, 16th pushes)
  const rhodes = [];
  const compRhythm = [[0, 1.2, 74], [1.75, 0.5, 66], [2.5, 1.1, 70], [3.75, 0.25, 58]];
  prog.forEach((sym, bar) => {
    const v = chord(sym, { voicing: forms[bar % 4], center: 62 });
    if (bar === END_BAR) {
      // tag: rolled, sustained
      chord('Dbmaj9', { voicing: 'rootlessA', center: 62 }).concat([N('Ab4')]).forEach((p, i) => rhodes.push({ t: T(bar) + i * 0.035, d: 4.8, p, v: 72 - i * 3 }));
      return;
    }
    for (const [b, len, vel] of compRhythm) {
      v.forEach((p, i) => rhodes.push(hum({ t: T(bar, b) + i * 0.006, d: len * beatSec * 0.95, p, v: vel - (i === 0 ? 4 : 0) })));
    }
  });

  // ---------------- Fretless bass (root motion, 16th pickups)
  const bassLines = {
    Ebm9: [['Eb2', 0, 1.5], ['Bb1', 1.5, 1], ['Eb2', 2.5, 0.75], ['Gb2', 3.25, 0.5], ['F2', 3.75, 0.25]],
    Ab13: [['Ab1', 0, 1.5], ['Eb2', 1.5, 1], ['Ab1', 2.5, 0.75], ['C2', 3.25, 0.5], ['Db2', 3.75, 0.25]],
    Dbmaj9: [['Db2', 0, 1.5], ['Ab1', 1.5, 1], ['Db2', 2.5, 0.75], ['F2', 3.25, 0.5], ['Ab2', 3.75, 0.25]],
    Bbm9: [['Bb1', 0, 1.5], ['F2', 1.5, 1], ['Bb1', 2.5, 0.75], ['Db2', 3.25, 0.5], ['D2', 3.75, 0.25]],
  };
  const bass = [];
  prog.forEach((sym, bar) => {
    if (bar === END_BAR) { bass.push({ t: T(bar), d: 4.5, p: N('Db1') + 12, v: 96 }); return; }
    for (const [n, b, len] of bassLines[sym]) bass.push(hum({ t: T(bar, b), d: len * beatSec * 0.92, p: N(n), v: b === 0 ? 100 : 86 }));
  });

  // ---------------- Drums with sticks (bars 0–3) then brushes (bars 4–7) on separate tracks
  const sticks = [];
  for (let bar = 0; bar < 4; bar++) {
    for (let s = 0; s < 16; s++) {
      const b = s / 4;
      const acc = [92, 48, 70, 52][s % 4];
      sticks.push(hum2({ t: T(bar, b), d: 0.1, p: DRUMS.hhClosed, v: acc - (bar === 0 && s < 4 ? 10 : 0) }));
    }
    for (const b of [0, 1.75, 2.5]) sticks.push(hum({ t: T(bar, b), d: 0.2, p: DRUMS.kick, v: b === 0 ? 100 : 82 }));
    for (const b of [1, 3]) sticks.push(hum({ t: T(bar, b), d: 0.15, p: DRUMS.sideStick, v: 88 }));
    for (const b of [0, 1, 2, 3]) sticks.push(hum({ t: T(bar, b), d: 0.4, p: DRUMS.ride, v: 60 }));
    if (bar === 3) { // fill into the brushes section
      [[3, 45], [3.25, 45], [3.5, 41], [3.75, 41]].forEach(([b, p]) => sticks.push(hum({ t: T(bar, b), d: 0.2, p, v: 78 + (b - 3) * 30 })));
    }
  }
  sticks.push({ t: T(0), d: 2, p: DRUMS.crash, v: 70 });
  const brushes = [];
  const STIR = 60, TAP = 38, DIG = 39, FOOT = 44;
  for (let bar = 4; bar < 8; bar++) {
    for (const b of [0, 2]) brushes.push(hum({ t: T(bar, b) - 0.04, d: 2 * beatSec, p: STIR, v: 72 }));
    for (const b of [1, 3]) brushes.push(hum2({ t: T(bar, b), d: 0.25, p: TAP, v: 96 }));
    for (const b of [1.75, 3.75]) brushes.push(hum2({ t: T(bar, b), d: 0.2, p: DIG, v: 52 }));
    for (const b of [0, 2.5]) brushes.push(hum({ t: T(bar, b), d: 0.2, p: BRUSH.kick, v: b === 0 ? 78 : 60 }));
    for (const b of [1, 3]) brushes.push(hum({ t: T(bar, b), d: 0.1, p: FOOT, v: 70 }));
    for (const b of [0, 1, 1.75, 2, 3, 3.75]) brushes.push(hum2({ t: T(bar, b), d: 0.4, p: BRUSH.ride, v: b % 1 ? 50 : 66 }));
  }
  brushes.push({ t: T(4), d: 2, p: BRUSH.crash, v: 70 });
  brushes.push({ t: T(END_BAR), d: 4, p: BRUSH.crash, v: 78 });
  brushes.push({ t: T(END_BAR), d: 0.3, p: BRUSH.kick, v: 88 });

  // ---------------- Percussion: shaker 16ths + congas
  const perc = [];
  for (let bar = 0; bar < 8; bar++) {
    for (let s = 0; s < 16; s++) perc.push(hum2({ t: T(bar, s / 4), d: 0.1, p: PERC.shaker, v: [70, 40, 55, 42][s % 4] }));
    [[0, PERC.congaHiMute, 70], [1.5, PERC.congaHiOpen, 84], [2.5, PERC.congaHiMute, 60], [3, PERC.congaHiOpen, 80], [3.5, PERC.congaLo, 88]]
      .forEach(([b, p, v]) => perc.push(hum({ t: T(bar, b), d: 0.2, p, v })));
  }
  perc.push({ t: T(END_BAR), d: 1, p: PERC.triangleOpen, v: 70 });

  // ---------------- Alto sax melody (concert pitch) with scoops, vibrato and a fall
  const mel = [
    // bar, beat, dur(beats), note, vel, scoop?
    [0, 2.5, 0.5, 'Ab4', 82], [0, 3, 1, 'Bb4', 88, true],
    [1, 0, 1.5, 'C5', 92, true], [1, 1.75, 0.25, 'Bb4', 74], [1, 2, 0.5, 'Ab4', 80], [1, 2.5, 1.25, 'F4', 84],
    [2, 0, 0.75, 'Eb4', 78], [2, 0.75, 0.25, 'F4', 76], [2, 1, 2.5, 'Ab4', 88, true],
    [3, 0, 0.5, 'Db5', 86], [3, 0.5, 0.5, 'C5', 80], [3, 1, 0.5, 'Bb4', 82], [3, 1.5, 0.5, 'Ab4', 78], [3, 2, 1.5, 'F4', 84],
    [4, 0, 0.5, 'Bb4', 88], [4, 0.5, 0.5, 'Db5', 90], [4, 1, 2, 'Eb5', 96, true],
    [5, 0, 0.75, 'F5', 98, true], [5, 0.75, 0.25, 'Eb5', 84], [5, 1, 0.5, 'Db5', 86], [5, 1.5, 1.5, 'C5', 90],
    [6, 0, 1, 'Ab4', 86], [6, 1, 0.5, 'Bb4', 84], [6, 1.5, 0.5, 'C5', 86], [6, 2, 1.75, 'Eb5', 94, true],
    [7, 0.5, 0.5, 'Db5', 84], [7, 1, 0.5, 'C5', 80], [7, 1.5, 1.25, 'Ab4', 86],
    [8, 0, 3.4, 'F5', 92, true],
  ];
  const sax = [], saxBend = [], saxCC = [];
  for (const [bar, b, len, n, v, sc] of mel) {
    const t = T(bar, b), d = len * beatSec * 0.97;
    sax.push({ t, d, p: N(n), v });
    if (sc) saxBend.push(...scoop(t - 0.005, { depth: -0.45, dur: 0.11 }));
    if (len >= 1.5 && bar !== 8) saxBend.push(...vibrato(t + 0.12, t + d - 0.02, { depth: 0.07, rate: 5.3, delay: 0.25 }), { t: t + d, v: 0, curve: 'step' });
  }
  // final note: swell then fall off
  const lastT = T(8), lastD = 3.4 * beatSec;
  saxCC.push(...ccRamp(11, lastT, lastT + 0.6, 100, 127), ...ccRamp(11, lastT + lastD - 0.5, lastT + lastD, 127, 90));
  saxBend.push(...vibrato(lastT + 0.2, lastT + lastD - 0.35, { depth: 0.08, rate: 5.0, delay: 0.3 }), ...fall(lastT + lastD - 0.33, { depth: -1, dur: 0.3 }));

  // ---------------- Horn section stabs (bars 4–7 + tag): trumpet / alto / tenor / trombone
  const stabVoicings = {
    Ebm9: ['F5', 'Db5', 'Bb4', 'Gb4'], Ab13: ['F5', 'C5', 'Bb4', 'Gb4'],
    Dbmaj9: ['Eb5', 'C5', 'Ab4', 'F4'], Bbm9: ['F5', 'Db5', 'C5', 'Ab4'],
  };
  const horns = { tpt: [], alto2: [], tenor: [], tbn: [] };
  const hornIds = Object.keys(horns);
  const stabRhythm = [[1.5, 0.35, 104], [3.5, 0.6, 110]];
  for (let bar = 4; bar < 8; bar++) {
    for (const [b, len, vel] of stabRhythm) {
      // close voicing under the trumpet lead; trombone doubled an octave down for weight
      stabVoicings[prog[bar]].forEach((n, i) => horns[hornIds[i]].push(hum({ t: T(bar, b), d: len * beatSec, p: N(n) - (i === 3 ? 12 : 0), v: vel })));
    }
  }
  const tag = ['Eb5', 'C5', 'Ab4', 'F4'];
  tag.forEach((n, i) => horns[hornIds[i]].push({ t: T(END_BAR), d: 2.2, p: N(n) - (i === 3 ? 12 : 0), v: 100 }));
  const hornBends = { tpt: fall(T(END_BAR) + 2.0, { depth: -1, dur: 0.35 }) };

  // ---------------- Vibraphone fill (bar 7, 16ths) + tag shimmer
  const vib = [];
  const fillNotes = ['Ab5', 'F5', 'Db5', 'C5', 'Ab4', 'Bb4', 'C5', 'Db5', 'Eb5', 'F5', 'Ab5', 'C6', 'Bb5', 'Ab5', 'F5', 'Eb5'];
  fillNotes.forEach((n, s) => vib.push(hum2({ t: T(7, s / 4), d: beatSec * 0.5, p: N(n), v: 70 + (s % 4 === 0 ? 14 : 0) })));
  ['Db5', 'F5', 'Ab5', 'C6', 'Eb6'].forEach((n, i) => vib.push({ t: T(END_BAR) + 0.25 + i * 0.07, d: 3.5, p: N(n), v: 78 - i * 4 }));

  const tracks = [
    { id: 'rhodes', ...pick('rhodes'), notes: rhodes, gain: -3, pan: -0.2, width: 0.9, reverb: 0.18, chorus: 0.25,
      eq: [{ type: 'hp', freq: 90 }, { type: 'peak', freq: 350, gain: -2, q: 1 }], cc: [{ t: 0, n: 64, v: 0 }] },
    { id: 'bass', ...pick('uprightBass'), notes: bass, gain: -1.5, pan: 0, reverb: 0.04,
      eq: [{ type: 'hp', freq: 32, order: 4 }, { type: 'peak', freq: 220, gain: -1.5, q: 1.2 }],
      comp: { threshold: -20, ratio: 3, attack: 0.008, release: 0.12, makeup: 0 } },
    { id: 'drums_sticks', ...pick('jazzKit'), notes: sticks, gain: -3.5, reverb: 0.1, eq: [{ type: 'hp', freq: 30 }] },
    { id: 'drums_brush', ...pick('brushKit'), notes: brushes, gain: -4, reverb: 0.12, eq: [{ type: 'hp', freq: 30 }] },
    { id: 'perc', ...pick('percussion'), notes: perc, gain: -11, pan: 0.35, width: 0.8, reverb: 0.14 },
    { id: 'sax', ...pick('altoSax'), notes: sax, bend: saxBend, cc: saxCC, gain: 1.5, pan: 0.05, reverb: 0.24, delay: 0.06,
      eq: [{ type: 'hp', freq: 140 }, { type: 'peak', freq: 2800, gain: 1.5, q: 0.9 }] },
    { id: 'tpt', ...pick('trumpet'), notes: horns.tpt, bend: hornBends.tpt, gain: -4, pan: 0.28, reverb: 0.22, eq: [{ type: 'hp', freq: 180 }] },
    { id: 'alto2', ...pick('altoSaxMTG'), notes: horns.alto2, gain: -5, pan: -0.12, reverb: 0.22, eq: [{ type: 'hp', freq: 160 }] },
    { id: 'tenor', ...pick('tenorSax'), notes: horns.tenor, gain: -5, pan: 0.12, reverb: 0.22, eq: [{ type: 'hp', freq: 110 }] },
    { id: 'tbn', ...pick('trombone'), notes: horns.tbn, gain: -5, pan: -0.28, reverb: 0.22, eq: [{ type: 'hp', freq: 80 }] },
    { id: 'vibes', ...pick('vibesMotor'), notes: vib, gain: -4, pan: 0.38, reverb: 0.3, eq: [{ type: 'hp', freq: 200 }] },
  ];

  return {
    sampleRate: 48000,
    duration,
    tempo: tm.scoreTempo(),
    tracks,
    mix: {
      fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.2, predelay: 0.024, return: 'music' },
            delay: { type: 'delay', time: beatSec * 0.75, feedback: 0.28, lp: 4000, hp: 400 } },
      master: { targetLUFS: -14, ceiling: -1, fadeOut: 0.8 },
    },
  };
}
