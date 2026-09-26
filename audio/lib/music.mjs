// audio/lib/music.mjs — composition helpers for writing scores in JS (all output times in SECONDS).
//
//   midi('Db4') -> 61            noteName(61) -> 'Db4'
//   chord('Gm9', { voicing:'rootlessA', center:62 }) -> [MIDI...]
//   const tm = tempoMap([{ beat:0, bpm:96 }, { beat:64, bpm:100, ramp:true }]);  tm.beat(4.5) -> seconds, tm.bar(3, 1.5)
//   swing(beat, 0.58, 0.25) -> swung beat position (16th swing);  swing(beat, 0.62, 0.5) (8th swing)
//   humanizer(seed)({ t, v }) -> jittered copy
//   scoop(t, { depth, dur }), fall(t, …), doit(t, …), vibrato(t0, t1, …) -> bend point arrays (bend units -1..1)
//   ccRamp(n, t0, t1, v0, v1) -> [{t,n,v},{t,n,v,ramp:true}]
//   DRUMS / BRUSH / PERC constants (GM / GS key numbers)

// ------------------------------------------------------------------ pitch names
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-Ga-g])([#b♯♭]*)(-?\d+)$/.exec(String(name).trim());
  if (!m) throw new Error(`midi(): bad note name '${name}'`);
  let pc = PC[m[1].toUpperCase()];
  for (const a of m[2]) pc += a === '#' || a === '♯' ? 1 : -1;
  return pc + 12 * (parseInt(m[3], 10) + 1);
}
const NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export function noteName(p, flats = true) {
  const names = flats ? NAMES_FLAT : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
}
export const hz = (p) => 440 * Math.pow(2, (p - 69) / 12);

// ------------------------------------------------------------------ chords
// quality -> intervals (semitones above root, may exceed an octave)
const QUALITIES = {
  '': [0, 4, 7], maj: [0, 4, 7], M: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], '-': [0, 3, 7],
  dim: [0, 3, 6], aug: [0, 4, 8], '+': [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7],
  6: [0, 4, 7, 9], 69: [0, 4, 7, 9, 14], '6/9': [0, 4, 7, 9, 14], m6: [0, 3, 7, 9], m69: [0, 3, 7, 9, 14],
  maj7: [0, 4, 7, 11], M7: [0, 4, 7, 11], 'Δ': [0, 4, 7, 11], 'Δ7': [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14], M9: [0, 4, 7, 11, 14],
  'maj7#11': [0, 4, 7, 11, 18], 'maj9#11': [0, 4, 7, 11, 14, 18], maj13: [0, 4, 7, 11, 14, 21], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  m7: [0, 3, 7, 10], min7: [0, 3, 7, 10], '-7': [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], '-9': [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17],
  mMaj7: [0, 3, 7, 11], 'm(maj7)': [0, 3, 7, 11], mMaj9: [0, 3, 7, 11, 14],
  7: [0, 4, 7, 10], 9: [0, 4, 7, 10, 14], 11: [0, 7, 10, 14, 17], 13: [0, 4, 7, 10, 14, 21],
  '7b9': [0, 4, 7, 10, 13], '7#9': [0, 4, 7, 10, 15], '7#11': [0, 4, 7, 10, 18], '9#11': [0, 4, 7, 10, 14, 18], '7b13': [0, 4, 7, 10, 20],
  '13b9': [0, 4, 7, 10, 13, 21], '13#11': [0, 4, 7, 10, 14, 18, 21], '7alt': [0, 4, 10, 13, 15, 20], alt: [0, 4, 10, 13, 15, 20],
  '7sus4': [0, 5, 7, 10], '7sus': [0, 5, 7, 10], '9sus4': [0, 5, 7, 10, 14], '9sus': [0, 5, 7, 10, 14], '13sus': [0, 5, 7, 10, 14, 21],
  m7b5: [0, 3, 6, 10], 'ø': [0, 3, 6, 10], 'ø7': [0, 3, 6, 10], m9b5: [0, 3, 6, 10, 14], dim7: [0, 3, 6, 9], 'o7': [0, 3, 6, 9], aug7: [0, 4, 8, 10], '+7': [0, 4, 8, 10],
};

export function parseChord(symbol) {
  const m = /^([A-G])([#b♯♭]?)(.*?)(?:\/([A-G][#b♯♭]?))?$/.exec(symbol.trim());
  if (!m) throw new Error(`chord(): cannot parse '${symbol}'`);
  let root = PC[m[1]] + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0);
  root = (root + 12) % 12;
  const q = m[3];
  const intervals = QUALITIES[q];
  if (!intervals) throw new Error(`chord(): unknown quality '${q}' in '${symbol}' (known: ${Object.keys(QUALITIES).join(' ')})`);
  let bass = null;
  if (m[4]) bass = (PC[m[4][0]] + (m[4][1] === '#' || m[4][1] === '♯' ? 1 : m[4][1] ? -1 : 0) + 12) % 12;
  const family = /^(maj|M|Δ|6|69|6\/9|add9|$)/.test(q) && !/^m(?!aj)/.test(q) ? 'maj'
    : /^(m7b5|ø|m9b5)/.test(q) ? 'half' : /^(dim|o)/.test(q) ? 'dim'
    : /^(m|min|-)/.test(q) ? 'min' : /sus/.test(q) ? 'sus' : 'dom';
  return { root, quality: q, intervals, bass, family };
}

// Rootless (Bill Evans style) voicing interval sets, A and B forms (relative to root)
const ROOTLESS = {
  maj: { A: [4, 7, 11, 14], B: [11, 14, 16, 19] },
  min: { A: [3, 7, 10, 14], B: [10, 14, 15, 19] },
  dom: { A: [10, 14, 16, 21], B: [4, 9, 10, 14] },
  sus: { A: [5, 10, 14, 19], B: [10, 14, 17, 19] },
  half: { A: [3, 6, 10, 14], B: [10, 15, 18, 20] },
  dim: { A: [3, 6, 9, 14], B: [9, 14, 15, 18] },
};

function placeNear(intervals, root, center) {
  // choose octave so that the mean pitch of the voicing is closest to `center`
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const base = Math.round((center - mean - root) / 12) * 12 + root;
  return intervals.map((iv) => base + iv);
}

/**
 * chord(symbol, { voicing = 'close'|'drop2'|'rootlessA'|'rootlessB'|'shell'|'spread', center = 62, bass = false, bassOctave = 2 })
 * returns ascending MIDI pitches. With bass:true, prepends the root (or slash bass) in `bassOctave`.
 */
export function chord(symbol, { voicing = 'close', center = 62, bass = false, bassOctave = 2 } = {}) {
  const c = parseChord(symbol);
  let ivs;
  switch (voicing) {
    case 'rootlessA': case 'rootless': ivs = ROOTLESS[c.family]?.A ?? c.intervals; break;
    case 'rootlessB': ivs = ROOTLESS[c.family]?.B ?? c.intervals; break;
    case 'shell': ivs = [0, c.intervals.find((i) => i === 3 || i === 4) ?? 7, c.intervals.find((i) => i === 10 || i === 11 || i === 9) ?? 12]; break;
    case 'drop2': {
      const four = c.intervals.slice(0, 4).map((i) => i % 12).sort((a, b) => a - b);
      const top = four.slice();
      top[top.length - 2] -= 12;
      ivs = top.sort((a, b) => a - b);
      break;
    }
    case 'spread': ivs = [0, 7 + 12 * 0, ...c.intervals.slice(1).map((i) => (i < 12 ? i + 12 : i))].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b); break;
    default: ivs = c.intervals.map((i) => i % 24);
  }
  let notes = placeNear(ivs, c.root, center).sort((a, b) => a - b);
  if (bass) {
    const b = (c.bass ?? c.root) + 12 * (bassOctave + 1);
    notes = [b, ...notes.filter((p) => p > b)];
  }
  return notes;
}

// ------------------------------------------------------------------ tempo
/**
 * tempoMap(points, { beatsPerBar = 4 }) — points: [{ beat, bpm, ramp? }] (ramp: linear bpm change from previous point).
 * Returns { beat(b) -> sec, bar(barIndex0, beatInBar=0) -> sec, secToBeat(s), bpmAt(b), scoreTempo() -> [{t,bpm}] }
 */
export function tempoMap(points = [{ beat: 0, bpm: 96 }], { beatsPerBar = 4 } = {}) {
  const pts = [...points].sort((a, b) => a.beat - b.beat);
  if (pts[0].beat !== 0) pts.unshift({ beat: 0, bpm: pts[0].bpm });
  // precompute seconds at each point
  const secAt = [0];
  for (let i = 1; i < pts.length; i++) secAt.push(secAt[i - 1] + segSeconds(pts[i - 1], pts[i], pts[i].beat - pts[i - 1].beat));
  function segSeconds(p0, p1, db) {
    // seconds for db beats into segment p0->p1
    if (!p1 || !p1.ramp || p1.bpm === p0.bpm) return (db * 60) / p0.bpm;
    const L = p1.beat - p0.beat, k = (p1.bpm - p0.bpm) / L; // bpm(x) = p0.bpm + k x
    return (60 / k) * Math.log((p0.bpm + k * db) / p0.bpm);
  }
  function beat(b) {
    let i = pts.length - 1;
    while (i > 0 && pts[i].beat > b) i--;
    const next = pts[i + 1];
    const db = b - pts[i].beat; // i is the last point at or before b, so db never passes `next`
    if (next && next.ramp) return secAt[i] + segSeconds(pts[i], next, db);
    return secAt[i] + (db * 60) / pts[i].bpm;
  }
  function bpmAt(b) {
    let i = pts.length - 1;
    while (i > 0 && pts[i].beat > b) i--;
    const next = pts[i + 1];
    if (next && next.ramp) return pts[i].bpm + ((next.bpm - pts[i].bpm) * (b - pts[i].beat)) / (next.beat - pts[i].beat);
    return pts[i].bpm;
  }
  function secToBeat(s) {
    let lo = 0, hi = 1;
    while (beat(hi) < s) hi *= 2;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (beat(mid) < s) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  return {
    beat, bpmAt, secToBeat, beatsPerBar,
    bar: (barIndex, beatInBar = 0) => beat(barIndex * beatsPerBar + beatInBar),
    scoreTempo: () => pts.map((p) => ({ t: beat(p.beat), bpm: p.bpm })),
  };
}

// Swing a beat position. unit = 0.5 (8ths) or 0.25 (16ths); ratio = fraction of the pair given to the first note
// (0.5 straight, 0.58 light 16th swing, 0.667 triplet swing).
export function swing(beatPos, ratio = 0.58, unit = 0.25) {
  const pair = unit * 2;
  const k = Math.floor(beatPos / pair + 1e-9);
  const within = beatPos - k * pair;
  if (within < unit - 1e-9) return k * pair + (within / unit) * (ratio * pair);
  return k * pair + ratio * pair + ((within - unit) / unit) * ((1 - ratio) * pair);
}

// ------------------------------------------------------------------ randomness / humanize
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function humanizer(seed = 7, { time = 0.006, vel = 6, dur = 0 } = {}) {
  const r = rng(seed);
  const tri = () => r() - r();
  return (note) => ({
    ...note,
    t: Math.max(0, note.t + tri() * time),
    v: Math.max(1, Math.min(127, Math.round((note.v ?? 90) + tri() * vel))),
    d: dur ? Math.max(0.01, note.d * (1 + tri() * dur)) : note.d,
  });
}

// ------------------------------------------------------------------ expression shapes (bend units: -1..1 × bendRange)
// scoop: start below pitch and slide up into it
export function scoop(t, { depth = -0.5, dur = 0.09 } = {}) {
  return [{ t, v: depth, curve: 'step' }, { t: t + dur * 0.6, v: depth * 0.25 }, { t: t + dur, v: 0 }];
}
// fall: drop off the end of a note (t = start of the fall)
export function fall(t, { depth = -1, dur = 0.3, reset = 0.05 } = {}) {
  const pts = [{ t, v: 0, curve: 'step' }];
  for (let i = 1; i <= 6; i++) { const x = i / 6; pts.push({ t: t + dur * x, v: depth * x * x }); }
  pts.push({ t: t + dur + reset, v: 0, curve: 'step' });
  return pts;
}
// doit: rip upward at the end of a note
export function doit(t, { depth = 1, dur = 0.2, reset = 0.05 } = {}) {
  return fall(t, { depth, dur, reset });
}
// bend-based vibrato between t0 and t1 (depth in bend units; with bendRange 2, 0.1 = 20 cents)
export function vibrato(t0, t1, { depth = 0.08, rate = 5.2, delay = 0.15, step = 0.02 } = {}) {
  const pts = [];
  for (let t = t0; t <= t1; t += step) {
    const ramp = Math.min(1, Math.max(0, (t - t0 - delay) / 0.25));
    pts.push({ t, v: depth * ramp * Math.sin(2 * Math.PI * rate * (t - t0)) });
  }
  pts.push({ t: t1 + step, v: 0 });
  return pts;
}
export function ccRamp(n, t0, t1, v0, v1) {
  return [{ t: t0, n, v: v0 }, { t: t1, n, v: v1, ramp: true }];
}

// ------------------------------------------------------------------ drum maps (GM / GS keys)
export const DRUMS = {
  kick2: 35, kick: 36, sideStick: 37, rim: 37, snare: 38, clap: 39, snare2: 40,
  tomLowFloor: 41, hhClosed: 42, tomHighFloor: 43, hhPedal: 44, tomLow: 45, hhOpen: 46, tomLowMid: 47, tomHiMid: 48,
  crash: 49, tomHigh: 50, ride: 51, china: 52, rideBell: 53, tambourine: 54, splash: 55, cowbell: 56, crash2: 57,
  vibraslap: 58, ride2: 59,
};
// GS Brush kit (program 40 on the drum channel): these keys differ from the stick kit
export const BRUSH = { kick: 36, rim: 37, tap: 38, slap: 39, swirl: 40, hhClosed: 42, hhPedal: 44, hhOpen: 46, ride: 51, rideBell: 53, crash: 49 };
export const PERC = {
  bongoHi: 60, bongoLo: 61, congaHiMute: 62, congaHiOpen: 63, congaLo: 64, timbaleHi: 65, timbaleLo: 66,
  agogoHi: 67, agogoLo: 68, cabasa: 69, maracas: 70, whistleShort: 71, whistleLong: 72, guiroShort: 73, guiroLong: 74,
  claves: 75, woodblockHi: 76, woodblockLo: 77, cuicaMute: 78, cuicaOpen: 79, triangleMute: 80, triangleOpen: 81,
  shaker: 82, jingleBell: 83, bellTree: 84, castanets: 85, surdoMute: 86, surdoOpen: 87,
};
// GS drum kit programs (drum channel)
export const KITS = { standard: 0, room: 8, power: 16, electronic: 24, tr808: 25, jazz: 32, brush: 40, orchestra: 48 };
