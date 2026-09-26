// Music theory helpers for composing the TIME score in code.
// Times in the score are in BEATS (quarter notes) unless noted; the composer converts to seconds.

export const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11 };

// 'C4' -> 60, 'Bb3' -> 58
export function midi(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (+m[2] + 1) + NOTE[m[1]];
}

// Chord qualities -> intervals (root = 0). Extensions included where idiomatic.
const QUAL = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7],
  maj7: [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14], 'maj7#11': [0, 4, 7, 11, 14, 18], 'maj9#11': [0, 4, 7, 11, 14, 18],
  '6': [0, 4, 7, 9], '69': [0, 4, 7, 9, 14],
  m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17], m6: [0, 3, 7, 9], m69: [0, 3, 7, 9, 14],
  mMaj7: [0, 3, 7, 11], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9],
  '7': [0, 4, 7, 10], '9': [0, 4, 7, 10, 14], '13': [0, 4, 7, 10, 14, 21], '7b9': [0, 4, 7, 10, 13],
  '7#9': [0, 4, 7, 10, 15], '7alt': [0, 4, 10, 13, 15, 20], '7#11': [0, 4, 7, 10, 18], '9sus4': [0, 5, 7, 10, 14],
  '13sus4': [0, 5, 7, 10, 14, 21], '7sus4': [0, 5, 7, 10], '13b9': [0, 4, 10, 13, 21],
};
// 'Dm9', 'Bbmaj7#11', 'C13sus4', 'F/A', 'Ab7alt'
export function chord(sym) {
  const [main, slash] = sym.split('/');
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(main);
  const root = NOTE[m[1]];
  let q = m[2] || 'maj';
  const alias = { '': 'maj', M7: 'maj7', 'Δ': 'maj7', m: 'min', '-7': 'm7', mi7: 'm7', sus: 'sus4', '13sus': '13sus4', '9sus': '9sus4', '7sus': '7sus4', 'ø': 'm7b5' };
  q = alias[q] ?? q;
  if (!QUAL[q]) throw new Error('unknown chord quality ' + q + ' in ' + sym);
  return { sym, root, iv: QUAL[q], q, bass: slash ? NOTE[slash] : root };
}

const pc = (n) => ((n % 12) + 12) % 12;
// nearest midi note with pitch class p to reference note ref
export function nearest(p, ref) {
  let n = ref - pc(ref) + pc(p);
  if (n - ref > 6) n -= 12;
  if (ref - n > 6) n += 12;
  return n;
}

// Rootless "A/B" voicing for keys (3–5 notes) around a centre pitch, voice-led from previous voicing.
export function keysVoicing(ch, centre = 62, prev = null) {
  const c = typeof ch === 'string' ? chord(ch) : ch;
  // pick colour tones: 3rd, 7th (or 6th), 9th, 5th/13th
  const want = [];
  const has = (i) => c.iv.includes(i);
  const third = has(4) ? 4 : has(3) ? 3 : has(5) ? 5 : 2;
  const seventh = has(11) ? 11 : has(10) ? 10 : has(9) ? 9 : 7;
  want.push(third, seventh);
  if (c.iv.some((i) => i >= 13)) want.push(c.iv.find((i) => i === 14 || i === 13 || i === 15) ?? 14);
  else want.push(14);
  if (has(21) || has(20)) want.push(has(21) ? 9 : 8);
  else if (has(18)) want.push(6);
  else want.push(7);
  const pcs = [...new Set(want.map((i) => pc(c.root + i)))];
  // voice: stack upwards from lowest near centre-5
  let notes = pcs.map((p) => nearest(p, centre));
  notes.sort((a, b) => a - b);
  // compress within an octave+ and keep a pleasant spread
  if (prev && prev.length) {
    // voice-lead: move each target to nearest of previous voices' average
    const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
    notes = pcs.map((p) => nearest(p, Math.round(avg))).sort((a, b) => a - b);
  }
  for (let i = 1; i < notes.length; i++) while (notes[i] <= notes[i - 1]) notes[i] += 12;
  while (notes[notes.length - 1] - notes[0] > 14) notes[notes.length - 1] -= 12, notes.sort((a, b) => a - b);
  // avoid minor-2nd clusters between adjacent voices in the upper structure
  for (let i = 1; i < notes.length; i++) if (notes[i] - notes[i - 1] === 1 && i === notes.length - 1) notes[i] += 12;
  return notes;
}

// 4/5-part horn section voicing (drop-2 of a close chord under a lead note).
export function hornVoicing(ch, lead, parts = 4) {
  const c = typeof ch === 'string' ? chord(ch) : ch;
  const tones = [...new Set(c.iv.map((i) => pc(c.root + i)))];
  // choose chord tones below the lead, close position
  const out = [lead];
  let cur = lead;
  const cands = tones.filter((p) => p !== pc(lead));
  // prefer 3rd & 7th & 9th/13th
  const pref = (p) => {
    const iv = pc(p - c.root);
    return { 4: 0, 3: 0, 11: 1, 10: 1, 9: 2, 2: 2, 7: 3, 6: 3, 8: 3, 1: 2, 5: 3, 0: 4 }[iv] ?? 5;
  };
  cands.sort((a, b) => pref(a) - pref(b));
  for (const p of cands) {
    if (out.length >= parts) break;
    let n = cur - 1;
    while (pc(n) !== p) n--;
    out.push(n);
    cur = n;
  }
  out.sort((a, b) => b - a);
  // drop-2: second voice from top down an octave
  if (out.length >= 4) out[1] -= 12;
  return out.sort((a, b) => a - b);
}

// Scale for improvising lines over a chord (chord-scale).
export function chordScale(ch) {
  const c = typeof ch === 'string' ? chord(ch) : ch;
  const q = c.q;
  let steps;
  if (q.startsWith('maj') || q === '6' || q === '69' || q === 'maj') steps = q.includes('#11') ? [0, 2, 4, 6, 7, 9, 11] : [0, 2, 4, 5, 7, 9, 11];
  else if (q === 'm7b5') steps = [0, 1, 3, 5, 6, 8, 10];
  else if (q.startsWith('m')) steps = [0, 2, 3, 5, 7, 9, 10]; // dorian
  else if (q.includes('alt')) steps = [0, 1, 3, 4, 6, 8, 10];
  else if (q.includes('sus')) steps = [0, 2, 5, 7, 9, 10];
  else if (q.includes('b9')) steps = [0, 1, 4, 5, 7, 8, 10];
  else steps = [0, 2, 4, 5, 7, 9, 10]; // mixolydian
  return steps.map((s) => pc(c.root + s));
}

// Walking bass for a list of [chordSym, beats] — quarter notes, chromatic approaches.
export function walkingBass(changes, { low = 36, high = 55, rng = Math.random, start = null } = {}) {
  const out = []; // [beat, midi]
  let b = 0;
  let prev = start ?? nearest(chord(changes[0][0]).bass, 41);
  for (let ci = 0; ci < changes.length; ci++) {
    const [sym, beats] = changes[ci];
    const c = chord(sym);
    const next = changes[ci + 1] ? chord(changes[ci + 1][0]) : c;
    for (let k = 0; k < beats; k++) {
      let n;
      if (k === 0) n = nearest(c.bass, prev);
      else if (k === beats - 1) {
        // chromatic or diatonic approach to next root
        const target = nearest(next.bass, prev);
        n = target + (rng() < 0.6 ? (prev > target ? 1 : -1) : (prev > target ? 2 : -2));
      } else {
        const tones = [c.iv[1] ?? 4, c.iv[2] ?? 7, c.iv[3] ?? 10, 0, 2].map((i) => c.root + i);
        const p = tones[Math.floor(rng() * tones.length)];
        n = nearest(p, prev + (rng() < 0.5 ? 2 : -2));
      }
      while (n < low) n += 12;
      while (n > high) n -= 12;
      out.push([b + k, n]);
      prev = n;
    }
    b += beats;
  }
  return out;
}

// Swing: shift off-beat eighths (or sixteenths) later. ratio 0.5 = straight, 0.66 = triplet swing.
export function swingBeat(beat, ratio = 0.6, grid = 0.5) {
  const cell = Math.floor(beat / (grid * 2)) * grid * 2;
  const pos = beat - cell;
  if (Math.abs(pos - grid) < 1e-6) return cell + ratio * grid * 2;
  return beat;
}

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// General MIDI percussion keys (GS/GM kits)
export const DR = {
  kick: 36, kick2: 35, stick: 37, snare: 38, clap: 39, snare2: 40, tomLo: 41, hatC: 42, tomLo2: 43, hatP: 44,
  tomM: 45, hatO: 46, tomM2: 47, tomHi: 48, crash: 49, tomHi2: 50, ride: 51, china: 52, rideBell: 53,
  tamb: 54, splash: 55, cowbell: 56, crash2: 57, vibraslap: 58, ride2: 59, bongoHi: 60, bongoLo: 61,
  congaMute: 62, congaHi: 63, congaLo: 64, timbHi: 65, timbLo: 66, agogoHi: 67, agogoLo: 68, cabasa: 69,
  maracas: 70, whistleS: 71, whistleL: 72, guiroS: 73, guiroL: 74, claves: 75, woodHi: 76, woodLo: 77,
  cuicaMute: 78, cuicaOpen: 79, triMute: 80, triOpen: 81, shaker: 82, jingle: 83, chimes: 84, castanets: 85,
  // GS brush kit specifics (program 40): 38 = brush tap, 39 = brush slap, 40 = brush swirl
  brushTap: 38, brushSlap: 39, brushSwirl: 40,
};
