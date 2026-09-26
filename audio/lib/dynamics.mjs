// audio/lib/dynamics.mjs — compressor (with external sidechain / ducking) and a true-peak lookahead limiter.
import { dbToGain, gainToDb, truePeakEnvelope, slidingMinForward, movingAverage, biquadCoeffs, biquadProcess } from './dsp.mjs';

const tc = (sec, sr) => (sec <= 0 ? 0 : Math.exp(-1 / (sec * sr)));

// Build a mono detector signal (absolute value, linked across channels) from channels, optional HP filter on detector.
function detectorSignal(channels, sr, { mode = 'peak', rmsTime = 0.01, hpFreq = 0 } = {}) {
  const n = channels[0].length;
  const d = new Float32Array(n);
  let src = channels;
  if (hpFreq > 0) {
    const c = biquadCoeffs('highpass', hpFreq, sr, { q: 0.7071 });
    src = channels.map((ch) => biquadProcess(Float32Array.from(ch), c));
  }
  if (mode === 'rms') {
    const a = tc(rmsTime, sr);
    let ms = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (const c of src) s = Math.max(s, c[i] * c[i]);
      ms = s + a * (ms - s);
      d[i] = Math.sqrt(ms);
    }
  } else {
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (const c of src) { const v = Math.abs(c[i]); if (v > s) s = v; }
      d[i] = s;
    }
  }
  return d;
}

// Static curve: gain reduction (dB, <= 0) for input level (dB)
function gainComputer(xDb, threshold, ratio, knee) {
  const over = xDb - threshold;
  if (knee > 0 && 2 * over > -knee && 2 * over < knee) {
    const t = over + knee / 2;
    return ((1 / ratio - 1) * t * t) / (2 * knee);
  }
  return over > 0 ? (1 / ratio - 1) * over : 0;
}

/**
 * Feed-forward compressor. Returns { channels, gain (Float32Array linear gain curve), maxGR, avgGR }.
 * opts: threshold (dB), ratio, attack (s), release (s), knee (dB), makeup (dB | 'auto'), lookahead (s),
 *       detector: 'peak'|'rms', rmsTime, sidechain: channels (external key), keyHP (Hz), maxReduction (dB cap, e.g. 8),
 *       mix (0..1 parallel), hold (s), inPlace (bool)
 */
export function compress(channels, sr, opts = {}) {
  const {
    threshold = -18, ratio = 3, attack = 0.01, release = 0.15, knee = 6, makeup = 0,
    lookahead = 0, detector = 'peak', rmsTime = 0.01, sidechain = null, keyHP = 0,
    maxReduction = Infinity, mix = 1, hold = 0, inPlace = false,
  } = opts;
  const n = channels[0].length;
  const det = detectorSignal(sidechain || channels, sr, { mode: detector, rmsTime, hpFreq: keyHP });
  const la = Math.round(lookahead * sr);
  const aA = tc(attack, sr), aR = tc(release, sr);
  const holdN = Math.round(hold * sr);
  const grDb = new Float32Array(n);
  let env = 0; // smoothed gain reduction in dB (<= 0)
  let holdCount = 0;
  for (let i = 0; i < n; i++) {
    const di = det[Math.min(n - 1, i + la)] ?? 0;
    const xDb = di > 1e-9 ? 20 * Math.log10(di) : -180;
    let target = gainComputer(xDb, threshold, ratio, knee);
    if (target < -maxReduction) target = -maxReduction;
    if (target < env) { env = target + aA * (env - target); holdCount = holdN; }
    else if (holdCount > 0) { holdCount--; }
    else { env = target + aR * (env - target); }
    grDb[i] = env;
  }
  let mk = 0;
  if (makeup === 'auto') {
    // compensate half of the average gain reduction where the signal is active
    let s = 0, c = 0;
    for (let i = 0; i < n; i++) if (det[i] > 1e-4) { s += grDb[i]; c++; }
    mk = c ? -0.5 * (s / c) : 0;
  } else mk = makeup;
  const out = inPlace ? channels : channels.map((c) => new Float32Array(c.length));
  const gain = new Float32Array(n);
  let maxGR = 0, sumGR = 0;
  for (let i = 0; i < n; i++) {
    const g = dbToGain(grDb[i] + mk);
    gain[i] = g;
    if (grDb[i] < maxGR) maxGR = grDb[i];
    sumGR += grDb[i];
  }
  for (let c = 0; c < channels.length; c++) {
    const x = channels[c], y = out[c];
    for (let i = 0; i < n; i++) y[i] = mix >= 1 ? x[i] * gain[i] : x[i] * (1 - mix + mix * gain[i]);
  }
  return { channels: out, gain, maxGR, avgGR: sumGR / n, makeup: mk };
}

/**
 * Sidechain ducker: reduce `channels` by up to `depth` dB whenever the key signal exceeds `threshold`.
 * key: channels array (e.g. the SFX bus). Also accepts manual `events: [{t, dur, depth, attack, release}]`.
 */
export function duck(channels, sr, { key = null, depth = 6, threshold = -36, range = 12, attack = 0.015, release = 0.4, hold = 0.08, lookahead = 0.005, events = [], inPlace = true } = {}) {
  const n = channels[0].length;
  const grDb = new Float32Array(n); // target reduction in dB (<= 0)
  if (key) {
    const det = detectorSignal(key, sr, { mode: 'rms', rmsTime: 0.01 });
    const la = Math.round(lookahead * sr);
    for (let i = 0; i < n; i++) {
      const d = det[Math.min(n - 1, i + la)];
      const xDb = d > 1e-9 ? 20 * Math.log10(d) : -180;
      // map key level in [threshold, threshold+range] -> reduction [0, depth]
      const f = Math.max(0, Math.min(1, (xDb - threshold) / range));
      grDb[i] = -depth * f;
    }
  }
  for (const e of events) {
    const s = Math.max(0, Math.round(e.t * sr)), eN = Math.min(n, Math.round((e.t + (e.dur ?? 1)) * sr));
    const dp = e.depth ?? depth;
    for (let i = s; i < eN; i++) grDb[i] = Math.min(grDb[i], -dp);
  }
  const aA = tc(attack, sr), aR = tc(release, sr), holdN = Math.round(hold * sr);
  let env = 0, hc = 0;
  const out = inPlace ? channels : channels.map((c) => new Float32Array(c.length));
  let maxGR = 0;
  const gainCurve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = grDb[i];
    if (t < env) { env = t + aA * (env - t); hc = holdN; }
    else if (hc > 0) hc--;
    else env = t + aR * (env - t);
    if (env < maxGR) maxGR = env;
    gainCurve[i] = dbToGain(env);
  }
  for (let c = 0; c < channels.length; c++) {
    const x = channels[c], y = out[c];
    for (let i = 0; i < n; i++) y[i] = x[i] * gainCurve[i];
  }
  return { channels: out, maxGR, gain: gainCurve };
}

/**
 * True-peak lookahead limiter (linked stereo). Guarantees |x| (4x-oversampled estimate) <= ceiling (+ tiny margin).
 * opts: ceiling (dBTP, default -1), lookahead (s, default 0.003), release (s, default 0.08), margin (dB, default 0.2)
 * Returns { channels, maxGR (dB), gain }
 */
export function limit(channels, sr, { ceiling = -1, lookahead = 0.003, release = 0.08, margin = 0.2, inPlace = false } = {}) {
  const n = channels[0].length;
  const ceil = dbToGain(ceiling - margin);
  // required gain per sample from the true-peak envelope (linked)
  const req = new Float32Array(n).fill(1);
  for (const c of channels) {
    const env = truePeakEnvelope(c);
    for (let i = 0; i < n; i++) { const e = env[i]; if (e > ceil) { const g = ceil / e; if (g < req[i]) req[i] = g; } }
  }
  const w = Math.max(1, Math.round(lookahead * sr));
  // forward-looking min over w samples, then w-sample moving average: smooth attack reaching the minimum at the peak
  const g1 = slidingMinForward(req, w);
  // shift: g1[i] = min(req[i..i+w)) ; averaging over previous w samples of g1 gives g2[i] <= req[i]
  const g2 = movingAverage(g1, w);
  // release smoothing (upward only), never exceeding g2
  const aR = tc(release, sr);
  const gain = new Float32Array(n);
  let s = 1, maxGR = 0;
  for (let i = 0; i < n; i++) {
    const target = g2[i];
    s = target < s ? target : target + aR * (s - target);
    if (s > target) s = target;
    gain[i] = s;
    const gr = 20 * Math.log10(s);
    if (gr < maxGR) maxGR = gr;
  }
  const out = inPlace ? channels : channels.map((c) => new Float32Array(c.length));
  for (let c = 0; c < channels.length; c++) {
    const x = channels[c], y = out[c];
    for (let i = 0; i < n; i++) y[i] = x[i] * gain[i];
  }
  return { channels: out, maxGR, gain };
}

// Soft saturation (for gentle tape-like glue / safety). drive in dB.
export function saturate(channels, drive = 0, { inPlace = true } = {}) {
  const g = dbToGain(drive);
  const out = inPlace ? channels : channels.map((c) => new Float32Array(c.length));
  for (let c = 0; c < channels.length; c++) {
    const x = channels[c], y = out[c];
    for (let i = 0; i < x.length; i++) y[i] = Math.tanh(x[i] * g) / g;
  }
  return out;
}

export { gainToDb };
