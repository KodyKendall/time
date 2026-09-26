// TIME score — sections. Each function writes one act of the film into the instrument tracks.
// Bars are 0-based; one bar = 2.5 s; beat = 0.625 s. Cue times (film seconds) noted inline.
import { comp, COMP, bassSmooth, bassTwo, bassWalk, brushes, smoothKit, swingKit, funkKit, fill, latinPerc, SW, chordAt, spans, bassNote, vox } from './lib/patterns.mjs';
import { DRUMS, PERC, fall, ccRamp } from '../lib/music.mjs';
import { mchord } from './lib/builder.mjs';

// ================================================================================================
// ACT I — GENESIS (bars 0–5, 0–15 s): the singularity, the Big Bang, the atom, the unspooling.
// ================================================================================================
function genesis(S, I) {
  const { feel } = S;
  feel(0, 4, 'straight');

  // bar 0 — the singularity: a lone A+E fifth swelling out of silence (strings), a single vibe twinkle
  I.pad.n(0, 0.08, 4.6, 'A4', 70, { hum: false, swing: false, legato: 1 });
  I.pad.n(0, 0.08, 4.6, 'E5', 66, { hum: false, swing: false, legato: 1 });
  I.pad.ramp(11, 0, 0, 0, 3.9, 8, 112);
  I.vibes.n(0, 1.12, 3, 'E6', 58, { hum: false }); // 0.7 s: the point of light appears
  I.vibes.n(0, 2.6, 2, 'A5', 50, { hum: false });
  for (let i = 0; i < 12; i++) I.timp.n(0, 1 + i * 0.25, 0.3, 'Bb1', 18 + i * 5, { hum: false });

  // bar 1 (2.5 s) — BANG: full horn-section hit on Bbmaj9#11, crash, kick, timpani, piano octaves
  const HIT = { bari: ['Bb1', 'F2'], tbn: ['D3', 'A3'], tenor: ['C4', 'E4'], alto: ['A4'], tpt: ['D5', 'A5'] };
  for (const [k, notes] of Object.entries(HIT)) for (const p of notes) I[k].n(1, 0, 1.6, p, 120, { hum: false });
  I.tpt.bend.push(...fall(S.T(1, 1.25), { depth: -1, dur: 0.35 }));
  I.alto.bend.push(...fall(S.T(1, 1.3), { depth: -1, dur: 0.3 }));
  I.alto.cc.push({ t: S.T(1, 0) - 0.02, n: 11, v: 127 });
  I.timp.n(1, 0, 2, 'Bb1', 124, { hum: false });
  I.kit.n(1, 0, 3, DRUMS.crash, 118, { hum: false });
  I.kit.n(1, 0, 3, DRUMS.crash2, 110, { hum: false });
  I.kit.n(1, 0, 0.3, DRUMS.kick, 124, { hum: false });
  I.piano.ch(1, 0, 2.9, ['Bb0', 'Bb1', 'F2', 'D3', 'A3', 'E4'], 112, { roll: 0.004 });
  I.piano.cc.push({ t: S.T(1, 0) - 0.01, n: 64, v: 127 }, { t: S.T(1, 2.9), n: 64, v: 0 });
  I.rhodes.ch(1, 0.02, 2.9, ['A3', 'C4', 'D4', 'E4', 'A4'], 88);
  I.pad.ch(1, 0.1, 2.85, ['Bb2', 'F3', 'A3', 'D4', 'E4'], 76, { legato: 1 });
  I.pad.ramp(11, 1, 0, 1, 3, 112, 76);
  I.bass.n(1, 0, 2.9, 'Bb1', 118);
  // sparks: vibes shimmer up the lydian scale
  ['Bb4', 'C5', 'D5', 'E5', 'F5', 'A5', 'C6', 'D6'].forEach((p, i) => I.vibes.n(1, 1.1 + i * 0.22, 1.3, p, 92 - i * 4));

  // bar 1 b3 → bar 2 b2 (4.375–6.25 s) — the rays curl: Gm11 → A7sus4, harp gliss rising into the atom
  I.rhodes.ch(1, 3, 0.95, vox('Gm9', 60), 70);
  I.rhodes.ch(2, 0, 1.95, ['D4', 'E4', 'G4', 'A4'], 70);
  I.pad.ch(1, 3, 1, ['G2', 'D3', 'Bb3', 'F4', 'A4'], 70, { legato: 1 });
  I.pad.ch(2, 0, 2, ['A2', 'E3', 'D4', 'G4', 'A4'], 72, { legato: 1 });
  I.bass.n(1, 3, 1, 'G1', 96);
  I.bass.n(2, 0, 2, 'A1', 96);
  ['A5', 'F5', 'D5', 'Bb4', 'D5', 'F5', 'A5', 'C6'].forEach((p, i) => I.vibes.n(1, 3 + i * 0.25, 0.8, p, 70 - Math.abs(i - 3) * 3));
  const gliss = ['D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'Bb5', 'D6'];
  gliss.forEach((p, i) => I.harp.n(2, 0.35 + i * (1.6 / gliss.length), 1.2, p, 60 + i * 3, { hum: false }));
  for (let i = 0; i < 16; i++) I.kit.n(2, i * 0.125, 0.2, DRUMS.ride, 26 + i * 3.5, { hum: false }); // cymbal swell

  // bar 2 b2 → bar 3 b2 (6.25–8.75 s) — THE ATOM: vibes chime + orbit ostinato, brushes, Rhodes Dm9
  I.vibes.n(2, 2, 3, 'D6', 84);
  ['A4', 'D5', 'E5', 'F5', 'A5', 'F5', 'E5', 'D5'].forEach((p, i) => I.vibes.n(2, 2 + i * 0.5, 0.9, p, 66 + (i % 4 === 0 ? 8 : 0)));
  I.rhodes.ch(2, 2, 1.95, vox('Dm9', 58), 64);
  I.rhodes.ch(3, 0, 1.95, vox('Dm9', 58), 60);
  I.bass.n(2, 2, 2, 'D2', 90);
  I.bass.n(3, 0, 2, 'A1', 86);
  I.pad.ch(2, 2, 4, ['D3', 'A3', 'C4', 'E4', 'F4'], 60, { legato: 1 });
  for (const [b, bt] of [[2, 2], [3, 0]]) { I.brush.n(b, bt, 2, SW.stir, 56, { offset: -0.04 }); I.brush.n(b, bt + 1, 0.25, SW.tap, 74); I.brush.n(b, bt + 1, 0.1, SW.foot, 50); }

  // bar 3 b2 → bar 4 (8.75–10 s) — the orbits unspool: Ebmaj7#11, soprano pickup, walking bass,
  // brass swell into the first star (10.0 = the theme's downbeat)
  I.rhodes.ch(3, 2, 1.95, vox('Ebmaj7#11', 60), 70);
  I.bass.n(3, 2, 0.92, 'Eb2', 94); I.bass.n(3, 3, 0.92, 'G2', 86);
  I.brush.n(3, 2, 2, SW.stir, 66, { offset: -0.04 }); I.brush.n(3, 3, 0.25, SW.tap, 84);
  I.sop.mel([[3, 2, 0.5, 'G4', 80], [3, 2.5, 0.5, 'Bb4', 82], [3, 3, 0.5, 'D5', 86, 's'], [3, 3.5, 0.5, 'C5', 84]]);
  I.sop.cc.push(...ccRamp(11, S.T(3, 2), S.T(4, 0), 84, 110));
  I.tbn.n(3, 2, 2, 'Eb3', 70); I.tbn.n(3, 2, 2, 'G3', 70);
  I.tenor.n(3, 2, 2, 'D4', 70);
  I.tenor.cc.push(...ccRamp(11, S.T(3, 2), S.T(4, 0), 50, 120));
  I.tbn.cc.push(...ccRamp(11, S.T(3, 2), S.T(4, 0), 50, 120));
  for (let i = 0; i < 8; i++) I.kit.n(3, 2 + i * 0.25, 0.2, DRUMS.ride, 30 + i * 8, { hum: false });
}

// ================================================================================================
// ACT I½ — STARDUST (bars 4–11, 10–30 s): the "Time" theme on soprano sax.
// First star ignites on the theme's downbeat (10.0); nebula stars ignite 11.25 / 12.5 / 13.125 / 13.75;
// gravity twirls it (15–20); the galaxy completes on the IV chord (20.0) and turns (20–27.5);
// the dive (27.5–30, the V chord) resolves into the Sun (30.0, the I chord — see earth()).
// ================================================================================================
export const THEME_CHANGES = [
  [0, 0, 'Fmaj9'], [1, 0, 'Em7b5'], [1, 2, 'A7b9'], [2, 0, 'Dm9'], [3, 0, 'Cm9'], [3, 2, 'F13'],
  [4, 0, 'Bbmaj9'], [5, 0, 'Bbm9'], [5, 2, 'Eb13'], [6, 0, 'Am7'], [6, 2, 'D7b9'], [7, 0, 'Gm9'], [7, 2, 'C13sus'],
];
export const THEME_MEL = [
  [0, 0, 1.5, 'F5', 92, 's'], [0, 1.5, 0.5, 'E5', 80], [0, 2, 1, 'G5', 88], [0, 3, 0.5, 'A5', 86], [0, 3.5, 0.5, 'G5', 80],
  [1, 0, 1, 'E5', 86], [1, 1, 0.5, 'D5', 80], [1, 1.5, 0.5, 'E5', 82], [1, 2, 1.5, 'C#5', 88, 'v'],
  [2, 0.5, 0.5, 'A4', 78], [2, 1, 0.5, 'D5', 82], [2, 1.5, 0.5, 'E5', 84], [2, 2, 1, 'F5', 90], [2, 3, 0.5, 'E5', 82], [2, 3.5, 0.5, 'D5', 80],
  [3, 0, 1, 'Eb5', 86], [3, 1, 0.5, 'D5', 80], [3, 1.5, 0.5, 'C5', 78], [3, 2, 1.5, 'D5', 86, 'v'], [3, 3.5, 0.5, 'C5', 82],
  [4, 0, 1.5, 'A5', 96, 's'], [4, 1.5, 0.5, 'G5', 84], [4, 2, 0.5, 'F5', 84], [4, 2.5, 1, 'D5', 86],
  [5, 0, 1, 'Db5', 86], [5, 1, 0.5, 'C5', 80], [5, 1.5, 0.5, 'Bb4', 78], [5, 2, 1.5, 'C5', 86, 'v'], [5, 3.5, 0.5, 'Eb5', 84],
  [6, 0, 0.5, 'E5', 84], [6, 0.5, 1, 'G5', 90], [6, 1.5, 0.5, 'E5', 82], [6, 2, 1, 'F#5', 88], [6, 3, 0.5, 'Eb5', 84], [6, 3.5, 0.5, 'D5', 80],
  [7, 0, 0.5, 'Bb4', 80], [7, 0.5, 0.5, 'D5', 82], [7, 1, 1, 'F5', 88], [7, 2, 2, 'G5', 90, 'v'],
];
// shift a theme-relative list to a starting bar and transpose by semitones
export const shiftChanges = (list, bar0, tr = 0) => list.map(([b, bt, s]) => [b + bar0, bt, tr ? transposeSym(s, tr) : s]);
export const shiftMel = (list, bar0, tr = 0) => list.map(([b, bt, d, p, v, f]) => [b + bar0, bt, d, tr ? transposeNote(p, tr) : p, v, f]);
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function transposeNote(n, tr) {
  const m = /^([A-G][b#]?)(-?\d)$/.exec(n);
  const v = PC[m[1]] + 12 * (+m[2] + 1) + tr;
  return NAMES[((v % 12) + 12) % 12] + (Math.floor(v / 12) - 1);
}
function transposeSym(s, tr) {
  return s.replace(/^([A-G][b#]?)/, (r) => NAMES[(PC[r] + tr + 12) % 12]).replace(/\/([A-G][b#]?)$/, (x, r) => '/' + NAMES[(PC[r] + tr + 12) % 12]);
}

function stardust(S, I) {
  const { feel } = S;
  feel(4, 12, 's16');
  const ch = shiftChanges(THEME_CHANGES, 4);
  // lead: soprano sax states the theme (bars 4–11)
  I.sop.mel(shiftMel(THEME_MEL, 4), { autoVib: true });
  I.sop.cc.push({ t: S.T(4, 0) - 0.05, n: 11, v: 104 }, ...ccRamp(11, S.T(7, 3), S.T(8, 0), 100, 114), ...ccRamp(11, S.T(10, 0), S.T(11, 2), 114, 100));
  // 10.0: first star ignites on the downbeat — brass + cymbal + vibe sparkle
  I.tbn.n(4, 0, 1.2, 'A2', 92); I.tbn.n(4, 0, 1.2, 'E3', 92);
  I.tenor.n(4, 0, 1.2, 'G3', 92); I.tenor.n(4, 0, 1.2, 'C4', 92);
  I.tpt.n(4, 0, 1.2, 'E4', 96); I.tpt.bend.push(...fall(S.T(4, 1.0), { depth: -0.6, dur: 0.25 }));
  I.kit.n(4, 0, 2, DRUMS.crash, 96);
  ['F6', 'C6', 'A5', 'E6', 'G5'].forEach((p, i) => I.vibes.n(4, i * 0.1, 2, p, 80 - i * 6, { swing: false }));
  // nebula stars ignite (11.25, 12.5, 13.125, 13.75): vibe sparkles
  [[4, 2, 'E6'], [5, 0, 'A5'], [5, 1, 'E6'], [5, 2, 'C#6']].forEach(([b, bt, p]) => I.vibes.n(b, bt, 2, p, 84, { swing: false }));
  // rhythm section: Rhodes comp, fretless, a groove that grows with the galaxy
  comp(I.rhodes, ch, 4, 12, { cell: COMP.smooth, center: 60 });
  bassSmooth(I.fretless, ch, 4, 12, { ref: 38 });
  smoothKit(I.kit, 4, 6, { vel: -22, ride: false, rim: true, kickPat: [0, 2.5] });
  smoothKit(I.kit, 6, 8, { vel: -14, ride: false, rim: true, kickPat: [0, 1.75, 2.5] });
  fill(I.kit, 7, 3, { vel: -14 });
  smoothKit(I.kit, 8, 11, { vel: -6, ride: true, rim: false, kickPat: [0, 1.75, 2.5] });
  latinPerc(I.perc, 6, 11, { vel: -18, congas: false });
  // tenor answers while gravity twirls the nebula (bars 6–7)
  I.tenor.mel([[6, 2.5, 0.5, 'A3', 70], [6, 3, 0.5, 'C4', 72], [6, 3.5, 0.5, 'E4', 74], [7, 2.5, 0.5, 'F4', 72], [7, 3, 1, 'A4', 76, 's']]);
  // 20.0 the galaxy is complete: warm section swell on the IV chord (Bbmaj9), crash, strings
  const swell = { tpt: ['C5'], tenor: ['A4', 'F4'], tbn: ['D3', 'Bb3'] };
  for (const [k, ns] of Object.entries(swell)) for (const p of ns) I[k].n(8, 0, 3.8, p, 84);
  I.kit.n(8, 0, 3, DRUMS.crash, 100);
  I.pad.ramp(11, 7, 0, 8, 0, 56, 100);
  I.pad.ch(8, 0, 4, ['Bb2', 'F3', 'A3', 'C4', 'D4'], 78, { legato: 1 });
  I.pad.ch(9, 0, 2, ['Bb2', 'Db3', 'F3', 'Ab3', 'C4'], 74, { legato: 1 });
  I.pad.ch(9, 2, 2, ['Eb2', 'Db3', 'G3', 'C4'], 74, { legato: 1 });
  I.pad.ch(10, 0, 2, ['A2', 'E3', 'G3', 'C4'], 70, { legato: 1 });
  I.pad.ch(10, 2, 2, ['D3', 'C4', 'F#4', 'A4'], 72, { legato: 1 });
  // the galaxy turns (bars 9–10): new stars flare in the arms — soft vibe glints
  [[9, 0.5, 'G6'], [9, 2.5, 'D6'], [10, 1.5, 'A5'], [10, 3.5, 'E6']].forEach(([b, bt, p]) => I.vibes.n(b, bt, 1.5, p, 62, { swing: false }));
  // the dive (27.5–30, bar 11 on the V chord): rising strings + timpani roll + fill → resolves at 30.0
  I.pad.ch(11, 0, 4, ['G2', 'D3', 'F3', 'Bb3', 'A4'], 70, { legato: 1 });
  I.pad.ramp(11, 11, 0, 12, 0, 60, 118);
  for (let i = 0; i < 8; i++) I.timp.n(11, 2 + i * 0.25, 0.3, 'C2', 40 + i * 9, { hum: false });
  smoothKit(I.kit, 11, 12, { vel: -4, ride: true, rim: false, kickPat: [0, 1.75] });
  fill(I.kit, 11, 2, { vel: -6 });
}

// ------------------------------------------------------------------------------------------------
export function sections(S, I) {
  genesis(S, I);
  stardust(S, I);
}
