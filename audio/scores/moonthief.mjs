// The Moon Thief — original lullaby score, 120 s, GM-only (GeneralUser GS).
//   node audio/render.mjs audio/scores/moonthief.mjs audio/build/moonthief.wav
import { midi, chord } from '../lib/music.mjs';
import { inst } from '../lib/instruments.mjs';

const N = (t, d, p, v) => ({ t, d, p: typeof p === 'string' ? midi(p) : p, v });
const box = { sf: 'gm', bank: 0, program: 10 };   // music box
const pizz = { sf: 'gm', bank: 0, program: 45 };  // pizzicato strings
const flute = { sf: 'gm', bank: 0, program: 73 }; // flute

// Lullaby theme A (C major), ~9.6 s statement starting at t0.
function themeA(t0, v, stretch = 1) {
  const line = [
    [0, 0.8, 'E5'], [0.8, 0.8, 'G5'], [1.6, 1.2, 'C6'],
    [2.8, 0.8, 'B5'], [3.6, 0.8, 'A5'], [4.4, 1.2, 'G5'],
    [5.6, 0.8, 'E5'], [6.4, 0.8, 'D5'], [7.2, 2.4, 'C5'],
  ];
  return line.map(([dt, d, p]) => N(t0 + dt * stretch, d * stretch, p, v));
}
function pad(t0, d, symbol, center, v) {
  return chord(symbol, { voicing: 'close', center }).map((p) => N(t0, d, p, v));
}

const boxNotes = [
  ...themeA(2, 70),                       // B1: sparse theme
  ...themeA(16, 80, 0.9),                 // B2: playful, quicker
  ...themeA(31, 85),                      // B3: full statement
  N(47, 3, 'C4', 55), N(51, 3, 'A3', 52), N(55, 3.5, 'G3', 50), // B4: low questioning notes
  N(64, 1.6, 'E5', 60), N(65.8, 1.6, 'G5', 58), N(67.6, 3, 'C6', 60), // B5: simplest fragment
  N(71, 1.2, 'A5', 55), N(72.4, 1.2, 'G5', 55), N(73.8, 1.4, 'C5', 58),
  ...themeA(106, 70),                     // B8: resolving duet
  N(116, 3.5, 'C5', 65), N(116, 3.5, 'E5', 60), N(116, 3.5, 'G5', 60),
];
// B2 catch stabs (film catches at 18/22/26) + B7 arpeggios.
const sparkle = [
  N(18, 0.5, 'C7', 90), N(22, 0.5, 'E7', 88), N(26, 0.6, 'G6', 88),
];
{
  const arpTones = ['C6', 'E6', 'G6', 'C7', 'G6', 'E6'];
  for (let i = 0; i < 52; i++) sparkle.push(N(90 + i * 0.25, 0.22, arpTones[i % 6], 55 + (i % 3) * 5));
}
const pizzNotes = [
  N(17, 0.4, 'C5', 70), N(19, 0.4, 'E5', 68), N(21, 0.4, 'G5', 68),
  N(23, 0.4, 'A5', 66), N(25, 0.4, 'G5', 66), N(27.5, 0.5, 'E5', 64),
];
const fluteNotes = [
  ...themeA(31, 70).map((n) => ({ ...n, v: n.v - 15 })), // B3: doubling under the box
  ...themeA(91, 92),                                     // B7: lead at the climax
  ...themeA(112, 65, 1.1),                               // B8: answering phrase
];
const stringNotes = [
  ...pad(8, 7, 'Cmaj', 48, 50),                          // B1: pad enters late
  ...pad(30, 5, 'Fmaj', 48, 62), ...pad(35, 5, 'Cmaj', 48, 62), ...pad(40, 5, 'Gmaj', 48, 64), // B3
  ...pad(45, 15, 'Cm', 43, 38),                          // B4: dark bed
  ...pad(90, 3.2, 'Cmaj', 50, 72), ...pad(93.2, 3.2, 'Fmaj', 50, 74),
  ...pad(96.4, 3.4, 'Gmaj', 50, 76), ...pad(99.8, 3.7, 'Cmaj', 52, 78), // B7: rising bed
  ...pad(106, 5, 'Cmaj', 48, 55), ...pad(111, 5, 'Fmaj', 48, 52), ...pad(116, 3.8, 'Cmaj', 50, 58), // B8
];
// B6 heartbeat, quickening.
const drums = [];
for (let i = 0; i < 16; i++) drums.push(N(75 + i * 0.9, 0.2, 36, 68 + i * 1.5));
const sfx = [
  { t: 26, fx: 'shimmer', params: { dur: 3, root: 1760, sparkle: 0.5, seed: 2 }, gain: -14 },
  { t: 86, fx: 'riser', params: { dur: 3.5, from: 200, to: 2500, noise: 0.3, seed: 3 }, gain: -10 },
  { t: 90, fx: 'shimmer', params: { dur: 4, root: 1320, sparkle: 0.7, seed: 4 }, gain: -10 },
  { t: 95, fx: 'shimmer', params: { dur: 4, root: 1760, sparkle: 0.7, seed: 5 }, gain: -10 },
  { t: 100, fx: 'shimmer', params: { dur: 4, root: 2093, sparkle: 0.7, seed: 6 }, gain: -10 },
  { t: 103, fx: 'impact', params: { dur: 3, subHz: 55, drop: 0.5, noise: 0.4, tail: 1, seed: 9 }, gain: -6 },
  { t: 116.5, fx: 'shimmer', params: { dur: 3, root: 1568, sparkle: 0.4, seed: 7 }, gain: -14 },
];

export default {
  sampleRate: 48000, duration: 120, tempo: [{ t: 0, bpm: 75 }],
  tracks: [
    { id: 'box', ...box, notes: boxNotes, gain: 0, reverb: 0.3 },
    { id: 'sparkle', ...box, notes: sparkle, gain: -4, reverb: 0.35 },
    { id: 'pizz', ...pizz, notes: pizzNotes, gain: -2, reverb: 0.2 },
    { id: 'flute', ...flute, notes: fluteNotes, gain: 1, reverb: 0.28 },
    { id: 'strings', ...inst('strings'), notes: stringNotes, gain: -3, reverb: 0.3 },
    { id: 'drums', ...inst('brushKitGM'), notes: drums, gain: -4 },
    { id: 'sfx', type: 'sfx', events: sfx, gain: -2 },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.4, return: 'music' } },
    buses: { music: { duck: { key: ['sfx'], depth: 4 } } },
    master: { targetLUFS: -14, ceiling: -1 },
  },
};
