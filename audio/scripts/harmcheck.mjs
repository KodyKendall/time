// Harmony sanity check: for each melody note (on a strong-ish position or long), compare its pitch
// class with the chord sounding in the rhythm section (Rhodes/pad/bass notes active at that time) and
// flag semitone clashes (minor 2nds / minor 9ths against a chord tone).
//   node audio/scripts/harmcheck.mjs [score.mjs]
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = process.argv[2] || 'audio/scores/time.mjs';
const mod = await import(pathToFileURL(path.resolve(file)).href);
const score = typeof mod.default === 'function' ? await mod.default() : mod.default;
const byId = Object.fromEntries(score.tracks.map((t) => [t.id, t]));
const HARM = ['rhodes', 'pad', 'fretless', 'bass', 'guitar', 'piano'];
const MEL = ['sop', 'alto', 'tenor', 'tpt', 'flugel', 'mute', 'bari', 'tbn'];
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const name = (p) => NAMES[p % 12] + (Math.floor(p / 12) - 1);
const BEAT = 0.625;

function sounding(t) {
  const pcs = new Set();
  for (const id of HARM) {
    const tr = byId[id];
    if (!tr) continue;
    for (const n of tr.notes) if (n.t <= t + 0.03 && n.t + n.d > t + 0.05) pcs.add(n.p % 12);
  }
  return pcs;
}
let issues = 0, checked = 0;
for (const id of MEL) {
  const tr = byId[id];
  if (!tr) continue;
  for (const n of tr.notes) {
    const beatPos = (n.t / BEAT) % 1;
    const strong = beatPos < 0.08 || beatPos > 0.92 || n.d >= BEAT * 0.9;
    if (!strong) continue;
    const pcs = sounding(n.t + 0.02);
    if (pcs.size < 3) continue;
    checked++;
    const pc = n.p % 12;
    if (pcs.has(pc)) continue;
    const clash = [...pcs].filter((c) => ((c - pc + 12) % 12 === 1) || ((pc - c + 12) % 12 === 1));
    if (clash.length) {
      issues++;
      const bar = Math.floor(n.t / (BEAT * 4)), beat = ((n.t / BEAT) % 4).toFixed(2);
      console.log(`${id.padEnd(7)} t=${n.t.toFixed(2).padStart(6)} bar ${String(bar).padStart(2)} beat ${beat}  ${name(n.p).padEnd(4)} dur ${(n.d / BEAT).toFixed(2)}b  vs chord [${[...pcs].map((c) => NAMES[c]).join(' ')}]  clashes with ${clash.map((c) => NAMES[c]).join(',')}`);
    }
  }
}
console.log(`\n${issues} semitone clashes out of ${checked} strong melody notes checked`);
