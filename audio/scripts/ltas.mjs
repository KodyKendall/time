// Long-term average spectrum in 1/3-octave bands (dB relative to the loudest band), with a crude reference curve.
// usage: node audio/scripts/ltas.mjs <file.wav> [more.wav ...]
import { readWav } from '../lib/wav.mjs';
import { fft } from '../lib/dsp.mjs';

export function ltas(channels, sr, N = 8192) {
  const n = channels[0].length;
  const hop = N / 2;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const acc = new Float64Array(N / 2 + 1);
  let frames = 0;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let s = 0; s + N <= n; s += hop) {
    for (let i = 0; i < N; i++) { let v = 0; for (const c of channels) v += c[s + i]; re[i] = (v / channels.length) * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k <= N / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
  }
  const centers = [];
  for (let b = -17; b <= 13; b++) centers.push(1000 * Math.pow(2, b / 3)); // 20 Hz .. 20 kHz
  const out = centers.map((fc) => {
    const lo = fc / Math.pow(2, 1 / 6), hi = fc * Math.pow(2, 1 / 6);
    let e = 0;
    for (let k = Math.max(1, Math.floor((lo * N) / sr)); k <= Math.min(N / 2, Math.ceil((hi * N) / sr)); k++) e += acc[k];
    return { fc, db: 10 * Math.log10(e / Math.max(1, frames) + 1e-30) };
  });
  const max = Math.max(...out.map((o) => o.db));
  return out.map((o) => ({ fc: o.fc, db: o.db - max }));
}

if (process.argv[1]?.endsWith('ltas.mjs')) {
  for (const f of process.argv.slice(2)) {
    const w = readWav(f);
    const bands = ltas(w.channels, w.sampleRate);
    console.log(`\n${f}`);
    for (const b of bands) {
      const bar = '#'.repeat(Math.max(0, Math.round((b.db + 60) / 1.5)));
      console.log(`${(b.fc < 1000 ? b.fc.toFixed(0) : (b.fc / 1000).toFixed(1) + 'k').padStart(6)} ${b.db.toFixed(1).padStart(6)} ${bar}`);
    }
  }
}
