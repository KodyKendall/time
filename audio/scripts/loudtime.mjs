// Loudness timeline of a WAV: short-term (3 s) and momentary (400 ms) K-weighted loudness every step.
//   node audio/scripts/loudtime.mjs build/time_v1.wav [step=0.5] [from=0] [to=end]
import { readWav } from '../lib/wav.mjs';
import { kWeight } from '../lib/loudness.mjs';

const [file, stepArg = '0.5', fromArg = '0', toArg] = process.argv.slice(2);
const { channels, sampleRate: sr } = readWav(file);
const kw = kWeight(channels, sr);
const n = kw[0].length;
// prefix sums of mean-square (sum over channels)
const ps = new Float64Array(n + 1);
for (let i = 0; i < n; i++) ps[i + 1] = ps[i] + kw[0][i] * kw[0][i] + kw[1][i] * kw[1][i];
const lufs = (t0, t1) => {
  const a = Math.max(0, Math.round(t0 * sr)), b = Math.min(n, Math.round(t1 * sr));
  if (b <= a) return -99;
  const ms = (ps[b] - ps[a]) / (b - a);
  return ms > 0 ? -0.691 + 10 * Math.log10(ms) : -99;
};
const peak = (t0, t1) => {
  let p = 0;
  for (const ch of channels) for (let i = Math.max(0, Math.round(t0 * sr)); i < Math.min(n, Math.round(t1 * sr)); i++) p = Math.max(p, Math.abs(ch[i]));
  return p > 0 ? 20 * Math.log10(p) : -99;
};
const step = +stepArg, from = +fromArg, to = toArg ? +toArg : n / sr;
console.log('   t     M(0.4s)  S(3s)   peak   bar');
for (let t = from; t <= to + 1e-9; t += step) {
  const m = lufs(t - 0.2, t + 0.2), s = lufs(t - 1.5, t + 1.5), p = peak(t - step / 2, t + step / 2);
  const bars = '#'.repeat(Math.max(0, Math.round((m + 50) / 1.5)));
  console.log(`${t.toFixed(2).padStart(7)}  ${m.toFixed(1).padStart(6)}  ${s.toFixed(1).padStart(6)}  ${p.toFixed(1).padStart(6)}  ${bars}`);
}
