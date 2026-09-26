// audio/lib/analyze.mjs — level statistics for stems / mixes (QA).
import { applyEQ, gainToDb } from './dsp.mjs';
import { measureLoudness } from './loudness.mjs';

/**
 * stats(channels, sr) -> { peakDb, rmsDb, activeRmsDb, lufs, activeSeconds, first, last, bands:{sub,low,mid,high,air} (dB rel. total) }
 */
export function stats(channels, sr, { loudness = true, bands = true } = {}) {
  const n = channels[0].length;
  const hop = Math.round(0.1 * sr);
  let peak = 0, sum = 0;
  const blocks = [];
  for (let b = 0; b < n; b += hop) {
    let s = 0;
    const e = Math.min(n, b + hop);
    for (const c of channels) for (let i = b; i < e; i++) { const v = c[i]; s += v * v; const a = v < 0 ? -v : v; if (a > peak) peak = a; }
    sum += s;
    blocks.push(s / ((e - b) * channels.length));
  }
  const thr = 1e-6; // -60 dBFS mean-square
  const active = blocks.map((ms, i) => [ms, i]).filter(([ms]) => ms > thr);
  const activeMs = active.length ? active.reduce((a, [ms]) => a + ms, 0) / active.length : 0;
  const out = {
    peakDb: +gainToDb(peak).toFixed(2),
    rmsDb: +gainToDb(Math.sqrt(sum / (n * channels.length))).toFixed(2),
    activeRmsDb: +gainToDb(Math.sqrt(activeMs)).toFixed(2),
    activeSeconds: +(active.length * 0.1).toFixed(1),
    first: active.length ? +(active[0][1] * 0.1).toFixed(2) : null,
    last: active.length ? +((active[active.length - 1][1] + 1) * 0.1).toFixed(2) : null,
  };
  if (loudness) {
    const m = measureLoudness(channels, sr, { truePeak: false });
    out.lufs = Number.isFinite(m.integrated) ? +m.integrated.toFixed(2) : null;
  }
  if (bands && peak > 0) {
    const mono = new Float32Array(n);
    for (const c of channels) for (let i = 0; i < n; i++) mono[i] += c[i] / channels.length;
    const e = (arr) => { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]; return s; };
    const total = e(mono) || 1e-20;
    const band = (lo, hi) => {
      const x = Float32Array.from(mono);
      const eq = [];
      if (lo) eq.push({ type: 'hp', freq: lo, order: 4 });
      if (hi) eq.push({ type: 'lp', freq: hi, order: 4 });
      applyEQ([x], eq, sr);
      return +(10 * Math.log10((e(x) + 1e-20) / total)).toFixed(1);
    };
    out.bands = { sub: band(0, 60), low: band(60, 250), mid: band(250, 2000), high: band(2000, 8000), air: band(8000, 0) };
  }
  return out;
}
