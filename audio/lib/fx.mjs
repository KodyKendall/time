// audio/lib/fx.mjs — send effects: convolution reverb with generated impulse responses, stereo chorus, ping-pong delay.
import { mulberry32, gaussian, biquadCoeffs, biquadProcess, convolveStereo, hermite, applyEQ } from './dsp.mjs';

// ------------------------------------------------------------------ reverb impulse responses
export const REVERB_PRESETS = {
  // jazz club: intimate, warm, short-ish
  club: { decay: 1.5, predelay: 0.014, lowRatio: 1.15, highRatio: 0.45, earlyTime: 0.045, earlyCount: 12, earlyLevel: 0.55, onset: 0.012, cross: 0.6, hp: 140, lp: 9000 },
  // concert hall: big, smooth, the default "jazz hall" sound
  hall: { decay: 2.3, predelay: 0.024, lowRatio: 1.3, highRatio: 0.5, earlyTime: 0.085, earlyCount: 18, earlyLevel: 0.45, onset: 0.028, cross: 0.7, hp: 110, lp: 8500 },
  // long lush hall for pads / ending tails
  bighall: { decay: 2.8, predelay: 0.03, lowRatio: 1.35, highRatio: 0.45, earlyTime: 0.11, earlyCount: 22, earlyLevel: 0.4, onset: 0.04, cross: 0.75, hp: 100, lp: 8000 },
  // EMT-style plate: dense immediately, bright, classic on saxes/vocals
  plate: { decay: 2.0, predelay: 0.008, lowRatio: 0.9, highRatio: 0.8, earlyTime: 0, earlyCount: 0, earlyLevel: 0, onset: 0.002, cross: 0.85, hp: 180, lp: 11000 },
  room: { decay: 0.75, predelay: 0.005, lowRatio: 1.05, highRatio: 0.55, earlyTime: 0.028, earlyCount: 10, earlyLevel: 0.7, onset: 0.006, cross: 0.55, hp: 120, lp: 10000 },
};

// Linkwitz-Riley 4th-order (two cascaded Butterworth 2nd order) split
function lr4(x, f, sr, type) {
  const c = biquadCoeffs(type, f, sr, { q: Math.SQRT1_2 });
  biquadProcess(x, c);
  biquadProcess(x, c);
  return x;
}

/**
 * Generate a true-stereo reverb IR: { ll, lr, rl, rr, sampleRate, length, params }.
 * params: preset name or overrides { decay (T60 @ ~700 Hz, s), predelay (s), lowRatio, highRatio, earlyTime, earlyCount,
 *         earlyLevel, onset (s), cross (0..1), hp, lp, seed, sampleRate }
 */
export function generateReverbIR(params = {}) {
  const base = REVERB_PRESETS[params.preset ?? 'hall'] ?? REVERB_PRESETS.hall;
  const p = { ...base, ...params };
  const sr = p.sampleRate ?? 48000;
  const seed = p.seed ?? 12345;
  const tMid = p.decay;
  const t60 = (f) => {
    // piecewise log-frequency interpolation: 125 Hz -> lowRatio, 700 Hz -> 1, 8 kHz -> highRatio, 16 kHz -> highRatio*0.75
    const pts = [[31, p.lowRatio * 1.05], [125, p.lowRatio], [700, 1], [2500, (1 + p.highRatio) / 2], [8000, p.highRatio], [16000, p.highRatio * 0.75]];
    const lf = Math.log(f);
    if (f <= pts[0][0]) return tMid * pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (f <= pts[i][0]) {
        const [f0, r0] = pts[i - 1], [f1, r1] = pts[i];
        const a = (lf - Math.log(f0)) / (Math.log(f1) - Math.log(f0));
        return tMid * (r0 + a * (r1 - r0));
      }
    }
    return tMid * pts[pts.length - 1][1];
  };
  const maxT60 = Math.max(t60(31), t60(125), tMid);
  const pre = Math.round(p.predelay * sr);
  const len = pre + Math.round(maxT60 * 1.15 * sr);
  const crossovers = [88, 177, 354, 707, 1414, 2828, 5657, 11314];
  const centers = [55, 125, 250, 500, 1000, 2000, 4000, 8000, 15000];
  const rand = mulberry32(seed);

  function tail(pathSeed) {
    const r = mulberry32(pathSeed);
    const n = len - pre;
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) noise[i] = gaussian(r);
    // split into bands (LR4 tree: successively peel off the lowest band)
    const out = new Float32Array(n);
    let rest = noise;
    for (let b = 0; b <= crossovers.length; b++) {
      let band;
      if (b < crossovers.length) {
        band = lr4(Float32Array.from(rest), crossovers[b], sr, 'lowpass');
        rest = lr4(rest, crossovers[b], sr, 'highpass');
      } else band = rest;
      const T = t60(centers[b]);
      const k = -6.907755 / (T * sr); // ln(1e-3) per sample
      for (let i = 0; i < n; i++) out[i] += band[i] * Math.exp(k * i);
    }
    // echo-density build-up (smooth onset) and end fade
    const on = Math.max(1, p.onset * sr);
    const fadeN = Math.round(0.1 * n);
    for (let i = 0; i < n; i++) {
      let g = 1 - Math.exp(-i / on);
      if (i > n - fadeN) g *= 0.5 + 0.5 * Math.cos((Math.PI * (i - (n - fadeN))) / fadeN);
      out[i] *= g;
    }
    return out;
  }

  function early(pathSeed, sameSide) {
    const e = new Float32Array(len);
    if (!p.earlyCount || !p.earlyTime) return e;
    const r = mulberry32(pathSeed);
    for (let k = 0; k < p.earlyCount; k++) {
      // reflections cluster increasingly densely toward earlyTime
      const u = (k + r()) / p.earlyCount;
      const t = 0.002 + p.earlyTime * Math.pow(u, 0.7) + (sameSide ? 0 : 0.0015 + 0.004 * r());
      const idx = pre + Math.round(t * sr);
      if (idx >= len) continue;
      const amp = (1 - 0.65 * u) * (0.6 + 0.4 * r()) * (r() < 0.5 ? -1 : 1) * (sameSide ? 1 : 0.8);
      e[idx] += amp;
    }
    // walls absorb highs: soften the tap train
    biquadProcess(e, biquadCoeffs('lowpass', 7000, sr, { q: 0.6 }));
    return e;
  }

  const paths = {};
  const names = ['ll', 'lr', 'rl', 'rr'];
  const seeds = names.map(() => Math.floor(rand() * 2 ** 31));
  // normalise tail and early separately so earlyLevel is meaningful
  const rmsOf = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s); };
  names.forEach((name, i) => {
    const same = name === 'll' || name === 'rr';
    const t = tail(seeds[i]);
    const e = early(seeds[i] ^ 0x9e3779b9, same);
    const tr = rmsOf(t) || 1, er = rmsOf(e) || 1;
    const out = new Float32Array(len);
    const cross = same ? 1 : p.cross;
    for (let j = 0; j < t.length; j++) out[pre + j] += (t[j] / tr) * cross;
    if (p.earlyCount) for (let j = 0; j < len; j++) out[j] += (e[j] / er) * p.earlyLevel * cross;
    paths[name] = out;
  });
  // overall tone: HP (12 dB/oct) + gentle LP
  for (const name of names) {
    applyEQ([paths[name]], [
      { type: 'hp', freq: p.hp, order: 2 },
      { type: 'lp', freq: p.lp, order: 2 },
    ], sr);
  }
  // energy normalisation: unit input power -> unit output power per output channel (sum of both input paths)
  let eL = 0;
  for (const name of ['ll', 'rl']) for (const v of paths[name]) eL += v * v;
  let eR = 0;
  for (const name of ['lr', 'rr']) for (const v of paths[name]) eR += v * v;
  const norm = 1 / Math.sqrt(Math.max(eL, eR) / 2);
  for (const name of names) { const a = paths[name]; for (let j = 0; j < a.length; j++) a[j] *= norm; }
  return { ...paths, sampleRate: sr, length: len, params: p };
}

const irCache = new Map();
export function getReverbIR(params = {}) {
  const key = JSON.stringify(params);
  if (!irCache.has(key)) irCache.set(key, generateReverbIR(params));
  return irCache.get(key);
}

/** Convolution reverb: returns 100%-wet stereo return, same length as input (tail truncated to input length unless tail:true). */
export function reverb(input, sr, params = {}) {
  const ir = getReverbIR({ ...params, sampleRate: sr });
  const outLength = params.tail ? input[0].length + ir.length : input[0].length;
  const wet = convolveStereo(input, ir, { outLength });
  if (params.eq) applyEQ(wet, params.eq, sr);
  if (params.width != null && params.width !== 1) {
    const w = params.width;
    for (let i = 0; i < wet[0].length; i++) {
      const m = 0.5 * (wet[0][i] + wet[1][i]), s = 0.5 * (wet[0][i] - wet[1][i]) * w;
      wet[0][i] = m + s; wet[1][i] = m - s;
    }
  }
  return wet;
}

// ------------------------------------------------------------------ chorus (stereo, 3 voices/side, 100% wet)
export function chorus(input, sr, { voices = 3, delay = 0.013, depth = 0.0035, rate = 0.33, spread = 1, hp = 120, seed = 7 } = {}) {
  const [inL, inR] = input;
  const n = inL.length;
  const maxD = Math.ceil((delay + depth) * sr) + 4;
  const outL = new Float32Array(n), outR = new Float32Array(n);
  const r = mulberry32(seed);
  const vs = [];
  for (let v = 0; v < voices; v++) {
    vs.push({ phaseL: r() * 2 * Math.PI, phaseR: r() * 2 * Math.PI, rate: rate * (0.8 + 0.45 * r()), d: delay * (0.75 + 0.5 * r()) });
  }
  const g = 1 / Math.sqrt(voices);
  for (const v of vs) {
    const wL = (2 * Math.PI * v.rate) / sr;
    for (let i = 0; i < n; i++) {
      for (let side = 0; side < 2; side++) {
        const src = side === 0 ? inL : inR;
        const ph = side === 0 ? v.phaseL : v.phaseR;
        const dSec = v.d + depth * Math.sin(ph + wL * i);
        const pos = i - dSec * sr;
        const i0 = Math.floor(pos), t = pos - i0;
        if (i0 < 1 || i0 + 2 >= n) continue;
        const s = hermite(src[i0 - 1], src[i0], src[i0 + 1], src[i0 + 2], t);
        // cross-blend by spread: voices feed both sides with different modulation
        if (side === 0) { outL[i] += s * g; outR[i] += s * g * (1 - spread) * 0.5; }
        else { outR[i] += s * g; outL[i] += s * g * (1 - spread) * 0.5; }
      }
    }
  }
  void maxD;
  if (hp) applyEQ([outL, outR], [{ type: 'hp', freq: hp }], sr);
  return [outL, outR];
}

// ------------------------------------------------------------------ ping-pong delay (100% wet)
export function delay(input, sr, { time = 0.375, feedback = 0.35, pingpong = true, lp = 5000, hp = 250, repeats = 12 } = {}) {
  const [inL, inR] = input;
  const n = inL.length;
  const D = Math.max(1, Math.round(time * sr));
  const outL = new Float32Array(n), outR = new Float32Array(n);
  // input to delay: mono sum for ping-pong, per side otherwise
  let cur = [Float32Array.from(inL), Float32Array.from(inR)];
  if (pingpong) { const m = new Float32Array(n); for (let i = 0; i < n; i++) m[i] = 0.5 * (inL[i] + inR[i]); cur = [m, new Float32Array(n)]; }
  let gain = 1;
  for (let k = 1; k <= repeats; k++) {
    // each repeat is darker and quieter
    applyEQ(cur, [{ type: 'lp', freq: lp }, { type: 'hp', freq: hp }], sr);
    const off = D * k;
    if (off >= n) break;
    const toLeft = !pingpong || k % 2 === 1;
    for (let i = 0; i + off < n; i++) {
      if (pingpong) {
        if (toLeft) outL[i + off] += cur[0][i] * gain; else outR[i + off] += cur[0][i] * gain;
      } else { outL[i + off] += cur[0][i] * gain; outR[i + off] += cur[1][i] * gain; }
    }
    gain *= feedback;
    if (gain < 0.001) break;
  }
  return [outL, outR];
}
