// audio/lib/loudness.mjs — ITU-R BS.1770-4 / EBU R128 loudness meter.
//   measureLoudness(channels, sampleRate, opts) -> {
//     integrated (LUFS), momentaryMax, shortTermMax, lra (LU), samplePeak (dBFS), truePeak (dBTP),
//     shortTerm: Float32Array (1 value per 100 ms hop, LUFS), momentary: Float32Array }
//   kWeight(channels, sr) -> K-weighted copies
import { biquadProcess, truePeak, gainToDb } from './dsp.mjs';

// K-weighting coefficients for arbitrary sample rates (same analog prototypes as libebur128).
export function kWeightingCoeffs(sr) {
  // Stage 1: high shelf (+4 dB @ high freq)
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / sr);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Stage 2: RLB high-pass
  f0 = 38.13547087602444; Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / sr);
  a0 = 1 + K / Q + K * K;
  const hp = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, hp];
}

export function kWeight(channels, sr) {
  const [s1, s2] = kWeightingCoeffs(sr);
  return channels.map((c) => {
    const x = Float32Array.from(c);
    biquadProcess(x, s1);
    biquadProcess(x, s2);
    return x;
  });
}

const LUFS_OFFSET = -0.691;
const toLufs = (ms) => (ms > 0 ? LUFS_OFFSET + 10 * Math.log10(ms) : -Infinity);

// Block mean-square energies: window w samples, hop samples. Sum over channels (G=1 for L/R).
function blockEnergies(kw, w, hop) {
  const n = kw[0].length;
  // prefix sums of squared, summed across channels (Float64)
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const c of kw) s += c[i] * c[i];
    pre[i + 1] = pre[i] + s;
  }
  const out = [];
  for (let start = 0; start + w <= n; start += hop) out.push((pre[start + w] - pre[start]) / w);
  return out;
}

export function measureLoudness(channels, sr, { truePeak: doTP = true } = {}) {
  const kw = kWeight(channels, sr);
  const n = kw[0].length;
  const hop = Math.round(0.1 * sr);
  const mBlocks = blockEnergies(kw, Math.round(0.4 * sr), hop);
  const sBlocks = blockEnergies(kw, Math.round(3 * sr), hop);

  // Integrated: absolute gate -70 LUFS, relative gate -10 LU
  const abs = mBlocks.filter((z) => toLufs(z) > -70);
  let integrated = -Infinity;
  if (abs.length) {
    const mean1 = abs.reduce((a, b) => a + b, 0) / abs.length;
    const rel = toLufs(mean1) - 10;
    const gated = abs.filter((z) => toLufs(z) > rel);
    if (gated.length) integrated = toLufs(gated.reduce((a, b) => a + b, 0) / gated.length);
  }
  // LRA (EBU Tech 3342): short-term, abs gate -70, relative gate -20 LU, 10th..95th percentile
  let lra = 0;
  const sAbs = sBlocks.filter((z) => toLufs(z) > -70);
  if (sAbs.length) {
    const mean = sAbs.reduce((a, b) => a + b, 0) / sAbs.length;
    const rel = toLufs(mean) - 20;
    const vals = sAbs.map(toLufs).filter((l) => l > rel).sort((a, b) => a - b);
    if (vals.length > 1) {
      const pct = (p) => vals[Math.min(vals.length - 1, Math.max(0, Math.round((p / 100) * (vals.length - 1))))];
      lra = pct(95) - pct(10);
    }
  }
  const momentary = Float32Array.from(mBlocks.map(toLufs));
  const shortTerm = Float32Array.from(sBlocks.map(toLufs));
  let sp = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > sp) sp = a; }
  const tp = doTP ? truePeak(channels) : sp;
  return {
    integrated,
    momentaryMax: momentary.length ? Math.max(...momentary) : -Infinity,
    shortTermMax: shortTerm.length ? Math.max(...shortTerm) : -Infinity,
    lra,
    samplePeak: gainToDb(sp),
    truePeak: gainToDb(Math.max(tp, sp)),
    momentary,
    shortTerm,
    duration: n / sr,
  };
}

// Convenience: integrated loudness only (fast path, no true peak)
export function integratedLoudness(channels, sr) {
  return measureLoudness(channels, sr, { truePeak: false }).integrated;
}
