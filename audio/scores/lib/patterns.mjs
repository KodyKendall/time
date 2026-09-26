// Reusable accompaniment patterns (comping, bass lines, drum grooves) for the TIME score.
import { N, mchord } from './builder.mjs';
import { DRUMS, BRUSH, PERC, parseChord } from '../../lib/music.mjs';

// Jazz keyboard voicing that respects alterations: 3rd, 7th, a 9th colour (b9/#9/9) and a top colour
// (13/b13/#11/5), placed around `center` and voice-led from `prev`.
export function vox(sym, center = 62, prev = null) {
  const c = parseChord(sym);
  const iv = new Set(c.intervals.map((x) => x % 12));
  const has = (x) => c.intervals.includes(x);
  const third = iv.has(4) ? 4 : iv.has(3) ? 3 : iv.has(5) ? 5 : 2;
  const seventh = iv.has(11) ? 11 : iv.has(10) ? 10 : iv.has(9) ? 9 : 7;
  let nine = has(13) ? 1 : has(15) ? 3 : 2;
  if (c.family === 'half') nine = 5; // 11th instead of 9 on m7b5
  if (c.family === 'dim') nine = 2;
  let top = has(21) || iv.has(9) && seventh !== 9 ? 9 : has(20) ? 8 : has(18) ? 6 : 7;
  if (c.family === 'half') top = 6;
  if (c.family === 'dom' && !has(13) && !has(15) && !has(20) && !has(18) && top === 7) top = 9; // plain 9/13 dominants
  if (c.family === 'maj' && top === 9 && seventh === 11) top = 7;
  const pcs = [...new Set([third, seventh, nine, top].map((x) => (c.root + x) % 12))];
  const ref = prev && prev.length ? Math.round(prev.reduce((a, b) => a + b, 0) / prev.length) : center;
  let notes = pcs.map((p) => { let n = ref - (((ref % 12) + 12) % 12) + p; if (n - ref > 6) n -= 12; if (ref - n > 5) n += 12; return n; });
  notes.sort((a, b) => a - b);
  for (let i = 1; i < notes.length; i++) while (notes[i] <= notes[i - 1]) notes[i] += 12;
  while (notes[notes.length - 1] - notes[0] > 12 && notes.length > 1) { notes[notes.length - 1] -= 12; notes.sort((a, b) => a - b); }
  // avoid a semitone rub at the very bottom (muddy)
  if (notes.length > 2 && notes[1] - notes[0] === 1) notes[0] += 12, notes.sort((a, b) => a - b);
  return notes;
}

// Brush kit (Karoryfer Swirly) keys
export const SW = { stir: 60, stir2: 64, tap: 38, dig: 39, edge: 40, foot: 44, kick: 36, ride: 51, crash: 49 };

const parseRoot = (sym) => {
  const m = /^([A-G][b#]?)/.exec(sym);
  return m[1];
};
const PCN = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
// pitch class of chord root (or slash bass)
export function bassPc(sym) {
  const [main, slash] = sym.split('/');
  return PCN[slash || parseRoot(main)];
}
// midi of bass note for chord near reference
export function bassNote(sym, ref = 40) {
  const pc = bassPc(sym);
  let n = ref - (((ref % 12) + 12) % 12) + pc;
  if (n - ref > 6) n -= 12;
  if (ref - n > 5) n += 12;
  return n;
}
const fifth = (n) => n + 7;

// changes: [[bar, beat, symbol], ...] sorted; returns symbol active at (bar, beat)
export function chordAt(changes, bar, beat = 0) {
  const x = bar * 4 + beat;
  let cur = changes[0][2];
  for (const [b, bt, s] of changes) if (b * 4 + bt <= x + 1e-6) cur = s;
  return cur;
}
// iterate chord spans within [bar0, bar1): yields {bar, beat, len(beats), sym}
export function spans(changes, bar0, bar1) {
  const out = [];
  const pts = changes.map(([b, bt, s]) => ({ x: b * 4 + bt, s }));
  for (let i = 0; i < pts.length; i++) {
    const x0 = Math.max(pts[i].x, bar0 * 4), x1 = Math.min(i + 1 < pts.length ? pts[i + 1].x : Infinity, bar1 * 4);
    if (x1 <= x0) continue;
    out.push({ bar: Math.floor(x0 / 4), beat: x0 % 4, len: x1 - x0, sym: pts[i].s });
  }
  return out;
}

// Rhodes / keys comping: rhythm cells per 4-beat bar (beat, len, vel)
export const COMP = {
  smooth: [[0, 1.25, 72], [1.75, 0.5, 62], [2.5, 1.0, 68], [3.75, 0.25, 56]],
  pad: [[0, 3.9, 64]],
  halves: [[0, 1.9, 66], [2, 1.9, 62]],
  bossa: [[0, 0.5, 64], [1.5, 0.5, 60], [2.5, 0.75, 62], [3.5, 0.5, 58]],
  swing: [[0.66, 0.3, 64], [2.66, 0.5, 60]], // Charleston-ish off-beat stabs (use with s8 feel: 0.5 → swung)
  funk: [[0, 0.25, 74], [0.75, 0.25, 64], [1.5, 0.25, 70], [2.25, 0.25, 62], [2.75, 0.5, 68], [3.5, 0.25, 64]],
};
export function comp(track, changes, bar0, bar1, { cell = COMP.smooth, center = 62, vel = 0, roll = 0.006 } = {}) {
  let prev = null;
  for (let bar = bar0; bar < bar1; bar++) {
    for (const [b, len, v] of cell) {
      // pushes (16th/8th before a change) anticipate the coming chord, as a comping pianist would
      const ahead = chordAt(changes, bar, b + 0.3);
      const sym = (b % 1 >= 0.49 && ahead !== chordAt(changes, bar, b)) ? ahead : chordAt(changes, bar, b);
      // keep notes from ringing into the next chord
      const x0 = bar * 4 + b;
      let x1 = x0 + len;
      for (const [cb, cbt] of changes) { const cx = cb * 4 + cbt; if (cx > x0 + 0.01 && cx < x1) x1 = cx; }
      const notes = vox(sym, center, prev);
      prev = notes;
      track.ch(bar, b, Math.max(0.2, x1 - x0 - 0.02), notes, v + vel, { roll });
    }
  }
}

// Bass lines
export function bassSmooth(track, changes, bar0, bar1, { ref = 38, vel = 0 } = {}) {
  for (const sp of spans(changes, bar0, bar1)) {
    const r = bassNote(sp.sym, ref);
    // altered / half-diminished chords have no perfect fifth: use the octave instead
    const pf = parseChord(sp.sym).intervals.some((x) => x % 12 === 7);
    const fifth = (n) => (pf ? n + 7 : n + 12);
    if (sp.len >= 4) {
      track.n(sp.bar, sp.beat, 1.5, r, 100 + vel);
      track.n(sp.bar, sp.beat + 1.5, 1, fifth(r) - 12 >= 28 ? fifth(r) - 12 : fifth(r), 84 + vel);
      track.n(sp.bar, sp.beat + 2.5, 0.75, r, 88 + vel);
      track.n(sp.bar, sp.beat + 3.25, 0.5, r + 12, 80 + vel);
      track.n(sp.bar, sp.beat + 3.75, 0.25, r + 10, 72 + vel);
    } else {
      track.n(sp.bar, sp.beat, Math.min(1.5, sp.len - 0.25), r, 98 + vel);
      if (sp.len >= 2) track.n(sp.bar, sp.beat + 1.5, 0.5, fifth(r) - 12 >= 28 ? fifth(r) - 12 : fifth(r), 80 + vel);
    }
  }
}
export function bassTwo(track, changes, bar0, bar1, { ref = 38, vel = 0 } = {}) {
  for (const sp of spans(changes, bar0, bar1)) {
    const r = bassNote(sp.sym, ref);
    track.n(sp.bar, sp.beat, Math.min(2, sp.len) * 0.95, r, 96 + vel);
    if (sp.len >= 4) track.n(sp.bar, sp.beat + 2, 1.9, fifth(r) > 50 ? fifth(r) - 12 : fifth(r), 86 + vel);
  }
}
export function bassWalk(track, changes, bar0, bar1, { ref = 38, vel = 0, seed = 1 } = {}) {
  let rs = seed;
  const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
  let prev = bassNote(chordAt(changes, bar0, 0), ref);
  for (let bar = bar0; bar < bar1; bar++) {
    for (let b = 0; b < 4; b++) {
      const sym = chordAt(changes, bar, b);
      const next = chordAt(changes, bar, b + 1);
      const c = mchord(sym, { voicing: 'close', center: prev + 4 });
      let n;
      const isChange = chordAt(changes, bar, b - 0.01) !== sym || b === 0;
      if (isChange) n = bassNote(sym, prev);
      else if (next !== sym || b === 3) {
        const tgt = bassNote(next, prev);
        n = tgt + (rnd() < 0.6 ? (prev > tgt ? 1 : -1) : prev > tgt ? 2 : -2);
      } else {
        const tones = c.map((p) => p % 12);
        const pick = tones[Math.floor(rnd() * tones.length)];
        n = prev - (((prev % 12) + 12) % 12) + pick;
        if (Math.abs(n - prev) > 7) n += n > prev ? -12 : 12;
        if (n === prev) n += rnd() < 0.5 ? 2 : -2;
      }
      while (n < 28) n += 12;
      while (n > 52) n -= 12;
      track.n(bar, b, 0.92, n, (b % 2 === 0 ? 96 : 86) + vel);
      prev = n;
    }
  }
}

// Drums --------------------------------------------------------------------------------------
export function brushes(track, bar0, bar1, { vel = 0, ride = false } = {}) {
  for (let bar = bar0; bar < bar1; bar++) {
    for (const b of [0, 2]) track.n(bar, b, 2, SW.stir, 70 + vel, { offset: -0.04 });
    for (const b of [1, 3]) track.n(bar, b, 0.25, SW.tap, 92 + vel);
    for (const b of [1.75, 3.75]) track.n(bar, b, 0.2, SW.dig, 50 + vel);
    track.n(bar, 0, 0.2, SW.kick, 70 + vel);
    for (const b of [1, 3]) track.n(bar, b, 0.1, SW.foot, 62 + vel);
    if (ride) for (const b of [0, 1, 1.75, 2, 3, 3.75]) track.n(bar, b, 0.4, SW.ride, (b % 1 ? 48 : 62) + vel);
  }
}
export function smoothKit(track, bar0, bar1, { vel = 0, hats = true, ride = false, kickPat = [0, 1.75, 2.5], rim = true } = {}) {
  for (let bar = bar0; bar < bar1; bar++) {
    if (hats) for (let s = 0; s < 16; s++) track.n(bar, s / 4, 0.1, DRUMS.hhClosed, [84, 44, 64, 48][s % 4] + vel);
    if (ride) for (const b of [0, 1, 2, 3]) track.n(bar, b, 0.4, DRUMS.ride, 62 + vel);
    for (const b of kickPat) track.n(bar, b, 0.2, DRUMS.kick, (b === 0 ? 100 : 84) + vel);
    for (const b of [1, 3]) track.n(bar, b, 0.15, rim ? DRUMS.sideStick : DRUMS.snare, (rim ? 86 : 92) + vel);
  }
}
export function swingKit(track, bar0, bar1, { vel = 0 } = {}) {
  // ride "ding ding-a ding ding-a", hat foot on 2 & 4, feathered kick, snare comping
  for (let bar = bar0; bar < bar1; bar++) {
    for (const b of [0, 1, 1.5, 2, 3, 3.5]) track.n(bar, b, 0.4, DRUMS.ride, (b % 1 ? 58 : b % 2 ? 80 : 70) + vel);
    for (const b of [1, 3]) track.n(bar, b, 0.1, DRUMS.hhPedal, 76 + vel);
    for (const b of [0, 1, 2, 3]) track.n(bar, b, 0.1, DRUMS.kick, 46 + vel);
    if (bar % 2 === 1) track.n(bar, 3.5, 0.1, DRUMS.snare, 70 + vel);
    if (bar % 4 === 2) track.n(bar, 1.5, 0.1, DRUMS.snare, 60 + vel);
  }
}
export function funkKit(track, bar0, bar1, { vel = 0 } = {}) {
  for (let bar = bar0; bar < bar1; bar++) {
    for (let s = 0; s < 16; s++) track.n(bar, s / 4, 0.1, s % 8 === 6 ? DRUMS.hhOpen : DRUMS.hhClosed, [90, 50, 70, 54][s % 4] + vel);
    for (const b of [0, 0.75, 2.5]) track.n(bar, b, 0.2, DRUMS.kick, 104 + vel);
    for (const b of [1, 3]) track.n(bar, b, 0.2, DRUMS.snare, 108 + vel);
    for (const b of [1.75, 2.25, 3.75]) track.n(bar, b, 0.1, DRUMS.snare, 40 + vel);
  }
}
export function fill(track, bar, beat0 = 2, { vel = 0, toms = [DRUMS.tomHigh, DRUMS.tomHiMid, DRUMS.tomLowMid, DRUMS.tomLow, DRUMS.tomLowFloor] } = {}) {
  const n = Math.round((4 - beat0) * 4);
  for (let i = 0; i < n; i++) {
    const tom = toms[Math.floor((i / n) * toms.length)];
    track.n(bar, beat0 + i / 4, 0.2, i % 4 === 0 ? DRUMS.snare : tom, 70 + (i / n) * 40 + vel);
  }
}
export function latinPerc(track, bar0, bar1, { vel = 0, congas = true, shaker = true } = {}) {
  for (let bar = bar0; bar < bar1; bar++) {
    if (shaker) for (let s = 0; s < 16; s++) track.n(bar, s / 4, 0.1, PERC.shaker, [70, 40, 55, 42][s % 4] + vel);
    if (congas) [[0, PERC.congaHiMute, 70], [1.5, PERC.congaHiOpen, 84], [2.5, PERC.congaHiMute, 60], [3, PERC.congaHiOpen, 80], [3.5, PERC.congaLo, 88]]
      .forEach(([b, p, v]) => track.n(bar, b, 0.2, p, v + vel));
  }
}
