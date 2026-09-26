// Compare scheduled note times of a track with detected onsets in its rendered stem.
//   node audio/scripts/onsets.mjs <trackId> <t0> <t1>   (score: audio/scores/time.mjs, stems: audio/build/stems/time)
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readWav } from '../lib/wav.mjs';

const [id, t0a = '0', t1a = '145'] = process.argv.slice(2);
const t0 = +t0a, t1 = +t1a;
const mod = await import(pathToFileURL(path.resolve('audio/scores/time.mjs')).href);
const score = await mod.default();
const tr = score.tracks.find((t) => t.id === id);
const notes = tr.notes.filter((n) => n.t >= t0 && n.t < t1).sort((a, b) => a.t - b.t);
const { channels, sampleRate: sr } = readWav(`audio/build/stems/time/${id}.wav`);
const mono = channels[0].map((v, i) => 0.5 * (v + channels[1][i]));
// energy envelope (1 ms hop, 3 ms window) and its rise
const hop = Math.round(sr * 0.001), win = Math.round(sr * 0.003);
const env = [];
for (let i = 0; i + win < mono.length; i += hop) {
  let e = 0;
  for (let k = 0; k < win; k++) e += mono[i + k] * mono[i + k];
  env.push(Math.sqrt(e / win));
}
// for each scheduled note, find the envelope peak and the steepest rise in [t, t+120 ms]
console.log('  scheduled   rise(ms)  peak(ms)  key vel');
const rises = [], peaks = [];
for (const n of notes) {
  const a = Math.round(n.t * 1000), b = a + 120;
  let pk = a, pv = 0, rk = a, rv = 0;
  for (let j = Math.max(1, a - 20); j < Math.min(env.length, b); j++) {
    if (env[j] > pv) { pv = env[j]; pk = j; }
    const d = env[j] - env[j - 1];
    if (d > rv) { rv = d; rk = j; }
  }
  rises.push(rk - a); peaks.push(pk - a);
  if (notes.length < 60 || notes.indexOf(n) % 4 === 0) console.log(`  ${n.t.toFixed(3).padStart(8)}  ${String(rk - a).padStart(7)}  ${String(pk - a).padStart(8)}   ${n.p} ${n.v}`);
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`\n${notes.length} notes: median attack-rise offset ${med(rises)} ms, median peak offset ${med(peaks)} ms`);
