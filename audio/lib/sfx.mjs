// audio/lib/sfx.mjs — deterministic procedural sound effects (offline; Node 22 ESM; no dependencies).
//
// Fallback foley for the "history of time" film (Big Bang -> ... -> AI). Every generator is
//
//     (params = {}) => [Float32Array L, Float32Array R]          (default SR = 48000 Hz)
//
// Common params: sampleRate (Hz, default 48000), seed (int or string, default 1), gain (dB, default 0),
//                pan (-1..1, where meaningful), dur (seconds, where meaningful).
// Guarantees:    identical params -> bit-identical output (mulberry32 PRNG, never Math.random); finite;
//                DC-blocked (10 Hz 1st-order HP); raised-cosine edge fades (first/last sample exactly 0);
//                peak-normalised to 0.89 (-1 dBFS) at gain 0 — slightly lower for small weight/size/strength
//                so those params still read as "quieter". Layer balance *inside* a sound is fixed by design.
//
// DSP toolbox used below: white/pink (Kellet)/brown noise, RBJ biquads, TPT state-variable filters with
// per-sample cutoff modulation, modal resonator banks (recursive decaying sinusoids), polyBLEP oscillators,
// additive wavetables, Catmull-Rom value-noise LFOs, and an 8-line Hadamard FDN reverb with input
// allpass diffusion and in-loop damping for body/space and stereo decorrelation.

export const SR = 48000;

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const SQRT3 = Math.sqrt(3);
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const dbToLin = (db) => Math.pow(10, db / 20);
const nSamp = (sec, sr) => Math.max(1, Math.round(sec * sr));
const softSign = (x) => x / Math.sqrt(1 + x * x);
const smoothstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// ============================================================================================ PRNG
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// mulberry32 with a few distribution helpers.
class Rng {
  constructor(seed = 1) { this.a = seed >>> 0; this.spare = null; }
  u32() {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  next() { return this.u32() / 4294967296; }
  bi() { return this.next() * 2 - 1; }
  range(a, b) { return a + (b - a) * this.next(); }
  logRange(a, b) { return a * Math.pow(b / a, this.next()); }
  int(n) { return Math.floor(this.next() * n); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  gauss() {
    if (this.spare !== null) { const s = this.spare; this.spare = null; return s; }
    let u = this.next(); if (u < 1e-12) u = 1e-12;
    const v = this.next(), m = Math.sqrt(-2 * Math.log(u));
    this.spare = m * Math.sin(TAU * v);
    return m * Math.cos(TAU * v);
  }
  exp(mean) { let u = this.next(); if (u < 1e-12) u = 1e-12; return -Math.log(u) * mean; }
}

function makeRng(name, seed) {
  const s = typeof seed === 'string' ? hashString(seed) : (Math.floor(Number(seed) || 0) >>> 0);
  return new Rng((hashString(name) ^ Math.imul((s + 0x632be5ab) >>> 0, 0x9e3779b1)) >>> 0);
}

// ============================================================================================ basic buffers
function peakAbs(a) { let p = 0; for (let i = 0; i < a.length; i++) { const x = Math.abs(a[i]); if (x > p) p = x; } return p; }
function peak2(a, b) { return Math.max(peakAbs(a), peakAbs(b)); }
function rmsOf(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length)); }
function rms2(a, b) { return Math.sqrt(0.5 * (rmsOf(a) ** 2 + rmsOf(b) ** 2)); }
function scaleTo(a, target) { const r = rmsOf(a); if (r > 0) { const g = target / r; for (let i = 0; i < a.length; i++) a[i] *= g; } return a; }

// Table sine, phase in cycles (any real). Linear interpolation on 8192 points: error < 1e-7.
const SIN_N = 8192;
const SIN_T = (() => { const t = new Float64Array(SIN_N + 1); for (let i = 0; i <= SIN_N; i++) t[i] = Math.sin((TAU * i) / SIN_N); return t; })();
function fsin(ph) { const x = (ph - Math.floor(ph)) * SIN_N, j = x | 0; return SIN_T[j] + (SIN_T[j + 1] - SIN_T[j]) * (x - j); }

function polyBlep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

// ============================================================================================ noise
function whiteNoise(n, rng) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = (rng.next() * 2 - 1) * SQRT3; return a; } // unit RMS

function pinkNoise(n, rng) { // Paul Kellet's refined pink filter (~ -3 dB/oct, 9 Hz..20 kHz)
  const a = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng.next() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    a[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.29; // RMS ~0.5 (layer balances are tuned to this)
    b6 = w * 0.115926;
  }
  return a;
}

function brownNoise(n, rng, cornerHz = 15, sr = SR) { // leaky-integrated white: -6 dB/oct above cornerHz, unit RMS
  const a = new Float32Array(n), k = Math.exp((-TAU * cornerHz) / sr), g = Math.sqrt(1 - k * k) * SQRT3;
  let y = rng.gauss();
  for (let i = 0; i < n; i++) { y = k * y + g * (rng.next() * 2 - 1); a[i] = y; }
  return a;
}

// Smooth random LFO: Catmull-Rom interpolated value noise, knots every 1/rate s, roughly in [-1, 1].
function smoothNoise(n, rate, rng, sr = SR) {
  const out = new Float32Array(n);
  const step = Math.max(2, sr / Math.max(1e-3, rate));
  const nk = Math.ceil(n / step) + 4;
  const k = new Float32Array(nk);
  for (let i = 0; i < nk; i++) k[i] = rng.next() * 2 - 1;
  for (let i = 0; i < n; i++) {
    const x = i / step, j = Math.floor(x), f = x - j;
    const p0 = k[j], p1 = k[j + 1], p2 = k[j + 2], p3 = k[j + 3];
    out[i] = 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * (p1 - p2) + p3 - p0) * f * f * f);
  }
  return out;
}

// ============================================================================================ filters
class Biquad { // RBJ cookbook, transposed direct form II
  constructor(type = 'lp', f = 1000, q = Math.SQRT1_2, gainDb = 0, sr = SR) { this.z1 = 0; this.z2 = 0; this.set(type, f, q, gainDb, sr); }
  set(type, f, q = Math.SQRT1_2, gainDb = 0, sr = SR) {
    f = clamp(f, 1, sr * 0.49);
    const w0 = (TAU * f) / sr, cw = Math.cos(w0), sw = Math.sin(w0), alpha = sw / (2 * q), A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case 'lp': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'hp': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'bp': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break; // 0 dB peak
      case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'ap': b0 = 1 - alpha; b1 = -2 * cw; b2 = 1 + alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'peak': b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
      case 'ls': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 - (A - 1) * cw + s); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - s);
        a0 = A + 1 + (A - 1) * cw + s; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - s; break;
      }
      case 'hs': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 + (A - 1) * cw + s); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s);
        a0 = A + 1 - (A - 1) * cw + s; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s; break;
      }
      default: throw new Error(`Biquad: unknown type ${type}`);
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  tick(x) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
  run(a) { for (let i = 0; i < a.length; i++) a[i] = this.tick(a[i]); return a; }
}
const filt = (a, type, f, q = Math.SQRT1_2, gainDb = 0, sr = SR) => new Biquad(type, f, q, gainDb, sr).run(a);

// Zavalishin/Simper TPT state-variable filter: stable under fast cutoff modulation.
// After tick(): .lp, .bp (peak gain Q), .hp; unity-peak band-pass = k * bp.
class SVF {
  constructor(sr = SR) { this.sr = sr; this.s1 = 0; this.s2 = 0; this.k = 1; this.a1 = 0; this.a2 = 0; this.a3 = 0; this.lp = 0; this.bp = 0; this.hp = 0; }
  set(f, q = Math.SQRT1_2) {
    const g = Math.tan((Math.PI * clamp(f, 5, this.sr * 0.47)) / this.sr), k = 1 / q;
    this.k = k; this.a1 = 1 / (1 + g * (g + k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
    return this;
  }
  tick(v0) {
    const v3 = v0 - this.s2, v1 = this.a1 * this.s1 + this.a2 * v3, v2 = this.s2 + this.a2 * this.s1 + this.a3 * v3;
    this.s1 = 2 * v1 - this.s1; this.s2 = 2 * v2 - this.s2;
    this.lp = v2; this.bp = v1; this.hp = v0 - this.k * v1 - v2;
    return v2;
  }
}

class Allpass { // Schroeder allpass, H(z) = (-g + z^-D) / (1 - g z^-D)
  constructor(len, g) { this.buf = new Float32Array(Math.max(1, len)); this.i = 0; this.g = g; }
  tick(x) {
    const d = this.buf[this.i], v = x + this.g * d;
    this.buf[this.i] = v;
    if (++this.i >= this.buf.length) this.i = 0;
    return d - this.g * v;
  }
}

function dcBlock(a, fc, sr) {
  const r = Math.exp((-TAU * fc) / sr);
  let x1 = 0, y1 = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i], y = x - x1 + r * y1; x1 = x; y1 = y; a[i] = y; }
}

// ============================================================================================ space
// 8-line feedback delay network (orthonormal Hadamard mixing, per-line RT60 gains, one-pole damping in the
// loop), 4-stage allpass input diffusion per channel, orthogonal L/R output taps. In place; the tail is
// truncated at the buffer end (callers size buffers to include the tail they want).
function reverb(L, R, o = {}) {
  const sr = o.sr ?? SR, rt60 = Math.max(0.05, o.rt60 ?? 1.2), size = Math.max(0.05, o.size ?? 1);
  const mix = o.mix ?? 0.25, dry = o.dry ?? 1, damp = o.damp ?? 6000, diff = o.diffusion ?? 0.6;
  if (!(mix > 0) && dry === 1) return [L, R];
  const n = L.length, N = 8;
  const baseMs = [29.71, 37.13, 41.11, 43.73, 53.93, 59.29, 67.07, 73.13];
  const lens = baseMs.map((ms) => Math.max(4, Math.round(ms * 1e-3 * size * sr)));
  const bufs = lens.map((l) => new Float32Array(l));
  const idx = new Int32Array(N);
  const fb = Float64Array.from(lens, (l) => Math.pow(10, (-3 * l) / (rt60 * sr)));
  const da = Math.exp((-TAU * damp) / sr);
  const ds = new Float64Array(N), s = new Float64Array(N);
  const preN = Math.max(1, Math.round((o.predelay ?? 0.012) * sr));
  const pL = new Float32Array(preN), pR = new Float32Array(preN);
  let pi = 0;
  const ds2 = clamp(size, 0.35, 1.5);
  const ms = (x) => Math.max(1, Math.round(x * 1e-3 * sr * ds2));
  const a1 = new Allpass(ms(4.77), diff), a2 = new Allpass(ms(3.59), diff), a3 = new Allpass(ms(12.73), diff * 0.85), a4 = new Allpass(ms(9.31), diff * 0.85);
  const b1 = new Allpass(ms(5.21), diff), b2 = new Allpass(ms(3.23), diff), b3 = new Allpass(ms(11.87), diff * 0.85), b4 = new Allpass(ms(8.71), diff * 0.85);
  const hpL = new Biquad('hp', o.hp ?? 80, 0.7, 0, sr), hpR = new Biquad('hp', o.hp ?? 80, 0.7, 0, sr);
  const lpL = new Biquad('lp', o.lp ?? 14000, 0.7, 0, sr), lpR = new Biquad('lp', o.lp ?? 14000, 0.7, 0, sr);
  const outG = 0.3 * mix;
  for (let i = 0; i < n; i++) {
    const xl = pL[pi], xr = pR[pi];
    pL[pi] = L[i]; pR[pi] = R[i];
    if (++pi >= preN) pi = 0;
    const dl = a4.tick(a3.tick(a2.tick(a1.tick(xl)))) * 0.5, dr = b4.tick(b3.tick(b2.tick(b1.tick(xr)))) * 0.5;
    for (let k = 0; k < N; k++) { const v = bufs[k][idx[k]]; ds[k] = v + da * (ds[k] - v); s[k] = ds[k] * fb[k]; }
    for (let h = 1; h < N; h <<= 1) {
      for (let j = 0; j < N; j += h << 1) {
        for (let k = j; k < j + h; k++) { const x = s[k], y = s[k + h]; s[k] = x + y; s[k + h] = x - y; }
      }
    }
    for (let k = 0; k < N; k++) {
      bufs[k][idx[k]] = s[k] * 0.35355339059327373 + (k & 1 ? dr : dl);
      if (++idx[k] >= lens[k]) idx[k] = 0;
    }
    const wl = ds[0] - ds[1] + ds[2] - ds[3] + ds[4] - ds[5] + ds[6] - ds[7];
    const wr = ds[0] + ds[1] - ds[2] - ds[3] + ds[4] + ds[5] - ds[6] - ds[7];
    L[i] = dry * L[i] + outG * lpL.tick(hpL.tick(wl));
    R[i] = dry * R[i] + outG * lpR.tick(hpR.tick(wr));
  }
  return [L, R];
}

// ============================================================================================ placement
function panGains(p) { const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4; return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2]; }

// Balance-style pan for a stereo signal: folds the far channel into the near one (-3 dB law for mono content).
function panStereo(L, R, p) {
  p = clamp(p || 0, -1, 1);
  if (!p) return;
  const a = Math.abs(p) * HALF_PI, c = Math.cos(a), s = Math.sin(a);
  if (p > 0) for (let i = 0; i < L.length; i++) { R[i] += L[i] * s; L[i] *= c; }
  else for (let i = 0; i < L.length; i++) { L[i] += R[i] * s; R[i] *= c; }
}

function addMono(L, R, src, start, gain = 1, pan = 0) {
  const [gl, gr] = panGains(pan);
  const n = L.length;
  for (let i = Math.max(0, -start); i < src.length; i++) {
    const j = start + i;
    if (j >= n) break;
    const v = src[i] * gain;
    L[j] += v * gl; R[j] += v * gr;
  }
}

// Enveloped noise burst (linear attack `att`, exponential decay `tau`), filtered AFTER enveloping so resonant
// filters ring naturally, peak-normalised to `amp`, added in mono at `pan`.
function burst(L, R, start, o) {
  const sr = o.sr ?? SR;
  if (start >= L.length) return;
  const att = Math.max(1e-5, o.att ?? 0.0002), tau = Math.max(1e-5, o.tau ?? 0.002);
  const len = Math.min(L.length - Math.max(0, start), nSamp(o.len ?? att + tau * 8, sr));
  if (len <= 4) return;
  const a = o.color === 'pink' ? pinkNoise(len, o.rng) : o.color === 'brown' ? brownNoise(len, o.rng, 40, sr) : whiteNoise(len, o.rng);
  for (let i = 0; i < len; i++) { const t = i / sr; a[i] *= t < att ? t / att : Math.exp(-(t - att) / tau); }
  if (o.hp) filt(a, 'hp', o.hp, o.hpq ?? Math.SQRT1_2, 0, sr);
  if (o.lp) filt(a, 'lp', o.lp, o.lpq ?? Math.SQRT1_2, 0, sr);
  if (o.bp) filt(a, 'bp', o.bp, o.q ?? 1, 0, sr);
  const nf = Math.min(len >> 2, Math.round(0.002 * sr)); // tiny tail fade so truncation never clicks
  for (let i = 0; i < nf; i++) a[len - 1 - i] *= i / nf;
  const pk = peakAbs(a);
  if (pk > 0) addMono(L, R, a, start, (o.amp ?? 1) / pk, o.pan ?? 0);
}

// Modal resonator bank: exponentially decaying sinusoids { f, a, tau, p (pan offset), ph } from sample `start`.
// Computed with a recursive complex rotation (4 mults/sample/mode). o.att adds a short linear onset ramp.
function modes(L, R, start, list, o = {}) {
  const sr = o.sr ?? SR, amp = o.amp ?? 1, pan = o.pan ?? 0, n = L.length, nyq = 0.46 * sr;
  const attN = Math.round((o.att ?? 0) * sr);
  for (const m of list) {
    if (!(m.f > 0) || m.f >= nyq || !(m.a > 0)) continue;
    const tau = Math.max(2e-4, m.tau);
    const len = Math.min(n - start, Math.ceil(tau * sr * 7.5));
    if (len <= 0) continue;
    const w = (TAU * m.f) / sr, r = Math.exp(-1 / (tau * sr)), c = Math.cos(w) * r, s = Math.sin(w) * r;
    const [gl, gr] = panGains(pan + (m.p ?? 0));
    const ph = m.ph ?? 0;
    let x = Math.cos(ph) * m.a * amp, y = Math.sin(ph) * m.a * amp;
    for (let i = 0; i < len; i++) {
      const j = start + i;
      if (j >= 0) { const v = i < attN ? (y * i) / attN : y; L[j] += v * gl; R[j] += v * gr; }
      const nx = c * x - s * y; y = s * x + c * y; x = nx;
    }
  }
}

function saturate(L, R, drive = 1.5) { // peak-normalise then tanh; keeps peak at 1
  const pk = peak2(L, R);
  if (!(pk > 0)) return;
  const k = drive / pk, d = Math.tanh(drive);
  for (let i = 0; i < L.length; i++) { L[i] = Math.tanh(L[i] * k) / d; R[i] = Math.tanh(R[i] * k) / d; }
}

function applyFades(L, R, fin, fout, sr) {
  const n = L.length;
  let ni = Math.min(n, Math.max(1, Math.round(fin * sr))), no = Math.min(n, Math.max(1, Math.round(fout * sr)));
  if (ni + no > n) { const k = n / (ni + no); ni = Math.max(1, Math.floor(ni * k)); no = Math.max(1, Math.floor(no * k)); }
  for (let i = 0; i < ni; i++) { const w = 0.5 - 0.5 * Math.cos((Math.PI * i) / ni); L[i] *= w; R[i] *= w; }
  for (let i = 0; i < no; i++) { const j = n - 1 - i, w = 0.5 - 0.5 * Math.cos((Math.PI * i) / no); L[j] *= w; R[j] *= w; }
}

// Final stage shared by every generator: pan -> DC block -> edge fades -> peak normalise -> gain -> sanitise.
function finish(L, R, o = {}) {
  const sr = o.sr ?? SR, n = L.length;
  if (o.pan) panStereo(L, R, o.pan);
  dcBlock(L, o.dcHz ?? 10, sr); dcBlock(R, o.dcHz ?? 10, sr);
  applyFades(L, R, o.fadeIn ?? 0.002, o.fadeOut ?? 0.02, sr);
  let pk = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (a > pk) pk = a; if (b > pk) pk = b; }
  const target = Math.min(0.9, (o.peak ?? 0.89) * clamp(o.level ?? 1, 0, 1));
  const g = (pk > 1e-12 && Number.isFinite(pk) ? target / pk : 0) * dbToLin(o.gain ?? 0);
  for (let i = 0; i < n; i++) {
    const a = L[i] * g, b = R[i] * g;
    L[i] = Number.isFinite(a) ? a : 0; R[i] = Number.isFinite(b) ? b : 0;
  }
  return [L, R];
}

// ============================================================================================ public helpers
/** Add src ([L,R] or mono Float32Array) into dst ([L,R]) in place at `atSeconds`, clipped to dst length. */
export function mixInto(dst, src, atSeconds = 0, gainDb = 0, sampleRate = SR) {
  const g = dbToLin(gainDb);
  const off = Math.round(atSeconds * sampleRate);
  const dsts = dst instanceof Float32Array || dst instanceof Float64Array ? [dst] : dst;
  const srcs = src instanceof Float32Array || src instanceof Float64Array ? [src] : src;
  for (let c = 0; c < dsts.length; c++) {
    const d = dsts[c], s = srcs[Math.min(c, srcs.length - 1)];
    const i0 = Math.max(0, -off), i1 = Math.min(s.length, d.length - off);
    for (let i = i0; i < i1; i++) d[off + i] += g * s[i];
  }
  return dst;
}

/** Stereo silence: [Float32Array L, Float32Array R] of round(seconds * sampleRate) samples. */
export function silence(seconds, sampleRate = SR) {
  const n = Math.max(0, Math.round(seconds * sampleRate));
  return [new Float32Array(n), new Float32Array(n)];
}

// ============================================================================================ generators

/**
 * whoosh({ dur=1.2, from=300, to=5000, peak=0.55, panFrom=-0.6, panTo=0.6, air=0.5, tone=0.35, width=0.3, pan=0 (offset) })
 * Pass-by model: loudness ~ closeness^1.6 around `peak`; pink band-pass sweeping from->to (fastest near the
 * pass), turbulence "air" hiss that is strongest up close, a faint doppler-bent whistle, flutter AM, moving pan.
 */
export function whoosh(params = {}) {
  const { dur = 1.2, from = 300, to = 5000, peak = 0.55, panFrom = -0.6, panTo = 0.6, air = 0.5, tone = 0.35, width = 0.3,
    pan = 0, sampleRate: sr = SR, seed = 1, gain = 0 } = params;
  const rng = makeRng('whoosh', seed);
  const n = nSamp(dur, sr), D = n / sr;
  const tp = clamp(peak, 0.02, 0.98) * D;
  const w1 = Math.max(tp / 5.5, 0.004), w2 = Math.max((D - tp) / 4.5, 0.004);
  const xAt = (t) => (t < tp ? (t - tp) / w1 : (t - tp) / w2);
  const u0 = softSign(xAt(0)), u1 = softSign(xAt(D));
  const f0 = clamp(from, 20, sr * 0.45), f1 = clamp(to, 20, sr * 0.45), lf = Math.log(f1 / f0);
  const pm = pinkNoise(n, rng), ps = pinkNoise(n, rng), wl = whiteNoise(n, rng), wr = whiteNoise(n, rng), wt = whiteNoise(n, rng);
  const flutter = smoothNoise(n, 22, rng, sr);
  const bM = new SVF(sr), bS = new SVF(sr), lM = new SVF(sr), lS = new SVF(sr), aL = new SVF(sr), aR = new SVF(sr), t1 = new SVF(sr), t2 = new SVF(sr);
  const mid = new Float32Array(n), side = new Float32Array(n), airL = new Float32Array(n), airR = new Float32Array(n), ton = new Float32Array(n);
  const env = new Float32Array(n), prog = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr, x = xAt(t), c = 1 / Math.sqrt(1 + x * x);
    const s = clamp((softSign(x) - u0) / (u1 - u0 || 1), 0, 1);
    prog[i] = s;
    env[i] = Math.pow(c, 1.6) * (1 + 0.15 * flutter[i] * c);
    if ((i & 3) === 0) {
      const fc = f0 * Math.exp(lf * s);
      bM.set(fc, 0.8); bS.set(fc * 1.06, 0.8);
      lM.set(fc * 0.55, 0.6); lS.set(fc * 0.58, 0.6);
      const fa = clamp(fc * 2.5, 1500, 16000); aL.set(fa, 0.55); aR.set(fa * 1.07, 0.55);
      const ft = clamp(fc * 1.6 * (1 - 0.06 * softSign(1.5 * x)), 80, 15000); t1.set(ft, 12); t2.set(ft, 12);
    }
    bM.tick(pm[i]); lM.tick(pm[i]); mid[i] = bM.k * bM.bp + 0.35 * lM.k * lM.bp;
    bS.tick(ps[i]); lS.tick(ps[i]); side[i] = bS.k * bS.bp + 0.35 * lS.k * lS.bp;
    aL.tick(wl[i]); airL[i] = aL.hp; aR.tick(wr[i]); airR[i] = aR.hp;
    t1.tick(wt[i]); t2.tick(t1.k * t1.bp); ton[i] = t2.k * t2.bp;
  }
  const kM = 1 / (rmsOf(mid) || 1), kA = 1 / (rmsOf(airL) || 1), kT = 1 / (rmsOf(ton) || 1);
  const aLvl = 0.45 * air, tLvl = 0.55 * tone;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const e = env[i], p = panFrom + (panTo - panFrom) * prog[i] + pan;
    const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4, gl = Math.cos(a) * Math.SQRT2, gr = Math.sin(a) * Math.SQRT2;
    const m = mid[i] * kM + ton[i] * kT * tLvl, sd = side[i] * kM * width, ea = Math.sqrt(e) * e * aLvl * kA;
    L[i] = e * (gl * m + sd) + ea * gl * airL[i];
    R[i] = e * (gr * m - sd) + ea * gr * airR[i];
  }
  return finish(L, R, { sr, gain, fadeIn: Math.min(0.03, D * 0.1), fadeOut: Math.min(0.08, D * 0.15) });
}

/**
 * impact({ dur=3, subHz=55, drop=0.5, noise=0.8, tail=1, click=0.7, space=0.3, pan=0 })
 * Cinematic hit: saturated sub sine falling `drop` octaves onto subHz, body thump, LP-closing noise burst,
 * transient click, filtered brown-noise rumble tail and a dark hall.
 */
export function impact(params = {}) {
  const { dur = 3, subHz = 55, drop = 0.5, noise = 0.8, tail = 1, click = 0.7, space = 0.3,
    sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('impact', seed);
  const n = nSamp(dur, sr), D = n / sr;
  const L = new Float32Array(n), R = new Float32Array(n);
  const on = Math.min(n - 1, Math.round(0.0015 * sr)), m = n - on;
  const tl = Math.max(0.05, tail), f0 = clamp(subHz, 15, 400);
  // 1) sub drop + body thump
  const tauA = 0.12 + 0.42 * tl, sat = Math.tanh(1.8);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < m; i++) {
    const t = i / sr;
    const att = t < 0.004 ? Math.sin((HALF_PI * t) / 0.004) : 1;
    ph += (f0 * Math.pow(2, drop * Math.exp(-t / 0.12))) / sr;
    const s = Math.tanh(1.8 * fsin(ph) * att * Math.exp(-Math.max(0, t - 0.025) / tauA)) / sat;
    ph2 += (f0 * 2.2 * Math.pow(2, drop * Math.exp(-t / 0.04))) / sr;
    const b = fsin(ph2) * att * Math.exp(-t / 0.075);
    const v = 0.9 * s + 0.4 * b;
    L[on + i] += v; R[on + i] += v;
  }
  // 2) noise burst whose low-pass closes quickly
  const nb = Math.min(m, nSamp(1.2, sr));
  const pL = pinkNoise(nb, rng), pR = pinkNoise(nb, rng), wN = whiteNoise(nb, rng);
  const fL = new SVF(sr), fR = new SVF(sr), gL = new SVF(sr), gR = new SVF(sr);
  const bL = new Float32Array(nb), bR = new Float32Array(nb);
  for (let i = 0; i < nb; i++) {
    const t = i / sr;
    if ((i & 7) === 0) {
      const fc = 220 + 9000 * Math.exp(-t / 0.035) + 900 * Math.exp(-t / 0.3);
      fL.set(fc, 0.75); fR.set(fc * 1.04, 0.75); gL.set(fc * 1.5, 0.6); gR.set(fc * 1.55, 0.6);
    }
    const e = (t < 0.0006 ? t / 0.0006 : 1) * (0.7 * Math.exp(-t / 0.045) + 0.3 * Math.exp(-t / 0.28));
    const w = 0.35 * wN[i];
    fL.tick(pL[i] + w); gL.tick(fL.lp); fR.tick(pR[i] + w); gR.tick(fR.lp);
    bL[i] = gL.lp * e; bR[i] = gR.lp * e;
  }
  const kb = (0.85 * clamp(noise, 0, 2)) / (peak2(bL, bR) || 1);
  for (let i = 0; i < nb; i++) { L[on + i] += kb * bL[i]; R[on + i] += kb * bR[i]; }
  // 3) transient click
  if (click > 0) {
    burst(L, R, on, { sr, rng, len: 0.006, att: 0.00004, tau: 0.0006, hp: 1800, amp: 0.9 * click });
    modes(L, R, on, [{ f: 2800, a: 0.22, tau: 0.004 }, { f: 4100, a: 0.13, tau: 0.003 }, { f: 1450, a: 0.18, tau: 0.006 }], { sr, amp: click });
  }
  // 4) rumble tail
  const rc = brownNoise(m, rng, 20, sr), rl = brownNoise(m, rng, 20, sr), rr = brownNoise(m, rng, 20, sr);
  const tL = new Float32Array(m), tR = new Float32Array(m);
  for (let i = 0; i < m; i++) { tL[i] = 0.8 * rc[i] + 0.6 * rl[i]; tR[i] = 0.8 * rc[i] + 0.6 * rr[i]; }
  for (const a of [tL, tR]) { filt(a, 'lp', 150, 0.7, 0, sr); filt(a, 'lp', 190, 0.6, 0, sr); filt(a, 'hp', 28, 0.7, 0, sr); }
  const kt = (0.1 * Math.sqrt(tl)) / (rms2(tL, tR) || 1);
  const am = smoothNoise(m, 3, rng, sr);
  const tauR = 0.35 + 0.65 * tl;
  for (let i = 0; i < m; i++) {
    const t = i / sr, e = kt * (1 - Math.exp(-t / 0.07)) * Math.exp(-t / tauR) * (1 + 0.35 * am[i]);
    L[on + i] += e * tL[i]; R[on + i] += e * tR[i];
  }
  // 5) space + glue
  reverb(L, R, { sr, rt60: 0.8 + 1.6 * tl, size: 1.8, damp: 2600, hp: 140, lp: 9000, predelay: 0.015, mix: space });
  saturate(L, R, 1.4);
  return finish(L, R, { sr, gain, pan, fadeIn: 0.0015, fadeOut: Math.min(0.35, D * 0.12) });
}

/**
 * rumble({ dur=4, cutoff=120, grit=0.3, pan=0 })
 * Low evolving earth rumble: brown noise through a wandering 4-pole low-pass, sub resonances, slow surges,
 * a band-passed "grinding" layer and sparse stone ticks that follow the surges.
 */
export function rumble(params = {}) {
  const { dur = 4, cutoff = 120, grit = 0.3, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('rumble', seed);
  const n = nSamp(dur, sr), D = n / sr, c0 = clamp(cutoff, 20, 4000);
  const bc = brownNoise(n, rng, 15, sr), bl = brownNoise(n, rng, 15, sr), br = brownNoise(n, rng, 15, sr);
  const wander = smoothNoise(n, 0.35, rng, sr), am1 = smoothNoise(n, 0.45, rng, sr), am2 = smoothNoise(n, 1.6, rng, sr), surge = smoothNoise(n, 0.17, rng, sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const aL = new SVF(sr), bL = new SVF(sr), aR = new SVF(sr), bR = new SVF(sr), r1 = new SVF(sr), r2 = new SVF(sr);
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) {
      const w = wander[i], fc = c0 * Math.pow(2, 0.55 * w);
      aL.set(fc, 0.75); bL.set(fc * 0.92, 0.6); aR.set(fc * 1.06, 0.75); bR.set(fc * 0.97, 0.6);
      r1.set(c0 * 0.34 * Math.pow(2, 0.25 * w), 4); r2.set(c0 * 0.6 * Math.pow(2, -0.2 * w), 3);
    }
    const x = bc[i];
    aL.tick(0.7 * x + 0.7 * bl[i]); bL.tick(aL.lp);
    aR.tick(0.7 * x + 0.7 * br[i]); bR.tick(aR.lp);
    r1.tick(x); r2.tick(x);
    const res = 0.9 * r1.k * r1.bp + 0.6 * r2.k * r2.bp;
    L[i] = bL.lp + res; R[i] = bR.lp + res;
  }
  for (const a of [L, R]) { filt(a, 'hp', 22, 0.7, 0, sr); filt(a, 'hp', 22, 0.7, 0, sr); }
  const k = 1 / (rms2(L, R) || 1);
  const gL = pinkNoise(n, rng), gR = pinkNoise(n, rng);
  for (const a of [gL, gR]) { filt(a, 'bp', 380, 0.8, 0, sr); filt(a, 'lp', 1200, 0.7, 0, sr); }
  const kg = (0.22 * clamp(grit, 0, 3)) / (rms2(gL, gR) || 1);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const e = clamp(0.62 + 0.22 * am1[i] + 0.1 * am2[i] + 0.55 * Math.max(0, surge[i]) ** 2, 0.1, 2);
    env[i] = e;
    L[i] = L[i] * k * e + gL[i] * kg * e * e; R[i] = R[i] * k * e + gR[i] * kg * e * e;
  }
  let t = rng.exp(1 / 20);
  while (t < D - 0.05) {
    const e = env[Math.min(n - 1, Math.floor(t * sr))];
    if (grit > 0 && rng.next() < 0.35 * e * e) {
      burst(L, R, Math.round(t * sr), { sr, rng, len: 0.006, att: 0.0001, tau: rng.range(0.0005, 0.0015), bp: rng.logRange(600, 2500), q: 1.5, amp: 0.25 * grit * e, pan: rng.bi() * 0.8 });
    }
    t += rng.exp(1 / 20);
  }
  return finish(L, R, { sr, gain, pan, fadeIn: Math.min(0.6, 0.15 * D), fadeOut: Math.min(1, 0.25 * D) });
}

/**
 * explosion({ dur=4, debris=1, space=0.4, distance=0, pan=0 })
 * Saturated blast (noise with a slamming low-pass) + sub pressure drop + Poisson debris crackle and falling
 * chunks + rolling low rumble + ping-pong slap echo + big dark space. distance (0..1) darkens and wets it.
 */
export function explosion(params = {}) {
  const { dur = 4, debris = 1, space = 0.4, distance = 0, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('explosion', seed);
  const n = nSamp(dur, sr), D = n / sr;
  const L = new Float32Array(n), R = new Float32Array(n);
  const on = Math.min(n - 1, Math.round(0.002 * sr)), m = n - on;
  const dbr = clamp(debris, 0, 3), dist = clamp(distance, 0, 1);
  // 1) blast
  const bn = Math.min(m, nSamp(1.8, sr));
  const pc = pinkNoise(bn, rng), pl = pinkNoise(bn, rng), pr = pinkNoise(bn, rng), wl = whiteNoise(bn, rng), wr = whiteNoise(bn, rng);
  const aL = new SVF(sr), bL = new SVF(sr), aR = new SVF(sr), bR = new SVF(sr);
  const blL = new Float32Array(bn), blR = new Float32Array(bn);
  for (let i = 0; i < bn; i++) {
    const t = i / sr;
    if ((i & 7) === 0) {
      const fc = 150 + 11000 * Math.exp(-t / 0.028) + 1600 * Math.exp(-t / 0.25);
      aL.set(fc, 0.7); bL.set(fc * 1.3, 0.6); aR.set(fc * 1.05, 0.7); bR.set(fc * 1.35, 0.6);
    }
    const e = (t < 0.0005 ? t / 0.0005 : 1) * (0.5 * Math.exp(-t / 0.045) + 0.5 * Math.exp(-t / 0.42));
    aL.tick(0.55 * pc[i] + 0.55 * pl[i] + 0.4 * wl[i]); bL.tick(aL.lp);
    aR.tick(0.55 * pc[i] + 0.55 * pr[i] + 0.4 * wr[i]); bR.tick(aR.lp);
    blL[i] = bL.lp * e; blR[i] = bR.lp * e;
  }
  const pb = peak2(blL, blR) || 1;
  for (let i = 0; i < bn; i++) { L[on + i] += 0.8 * Math.tanh((2.2 * blL[i]) / pb); R[on + i] += 0.8 * Math.tanh((2.2 * blR[i]) / pb); }
  // shock-front crack on top of the saturated body (kept clean so the onset stays sharp)
  burst(L, R, on, { sr, rng, len: 0.03, att: 0.0001, tau: 0.004, hp: 400, amp: 0.55, pan: -0.1 });
  burst(L, R, on, { sr, rng, len: 0.03, att: 0.0001, tau: 0.004, hp: 400, amp: 0.55, pan: 0.1 });
  // 2) sub pressure wave
  const sn = Math.min(m, nSamp(3.5, sr)), st = Math.tanh(1.8);
  let ph = 0;
  for (let i = 0; i < sn; i++) {
    const t = i / sr;
    ph += (32 * Math.pow(2, 0.9 * Math.exp(-t / 0.16))) / sr;
    const a = (t < 0.003 ? Math.sin((HALF_PI * t) / 0.003) : 1) * Math.exp(-t / 0.7);
    const v = (0.9 * Math.tanh(1.8 * fsin(ph) * a)) / st;
    L[on + i] += v; R[on + i] += v;
  }
  // 3) debris crackle (dense early, thinning out) + falling chunks
  let t = 0.025;
  for (;;) {
    const rate = dbr * (100 * Math.exp(-t / 0.35) + 14 * Math.exp(-t / 1.4)) + 0.5;
    t += rng.exp(1 / rate);
    if (t > D - 0.3 || dbr <= 0) break;
    const a = Math.min(0.9, 0.16 * Math.exp(0.7 * rng.gauss())) * Math.exp(-t / 1.2) * Math.min(1, dbr);
    burst(L, R, on + Math.round(t * sr), { sr, rng, len: rng.range(0.002, 0.01), att: 0.00003, tau: rng.range(0.0002, 0.002), bp: rng.logRange(900, 6500), q: rng.range(0.7, 2), amp: a, pan: rng.bi() * 0.85 });
  }
  t = 0.1;
  for (;;) {
    const rate = dbr * 6 * Math.exp(-t / 0.8) + 0.3;
    t += rng.exp(1 / rate);
    if (t > D - 0.4 || dbr <= 0) break;
    burst(L, R, on + Math.round(t * sr), { sr, rng, color: 'pink', len: 0.2, att: 0.002, tau: rng.range(0.02, 0.06), lp: rng.range(250, 800), amp: 0.3 * Math.exp(-t / 1.0) * rng.range(0.4, 1) * Math.min(1, dbr), pan: rng.bi() * 0.7 });
  }
  // 4) rolling rumble tail
  const rc = brownNoise(m, rng, 20, sr), rl = brownNoise(m, rng, 20, sr), rr = brownNoise(m, rng, 20, sr);
  const tlL = new Float32Array(m), tlR = new Float32Array(m);
  for (let i = 0; i < m; i++) { tlL[i] = 0.75 * rc[i] + 0.65 * rl[i]; tlR[i] = 0.75 * rc[i] + 0.65 * rr[i]; }
  for (const a of [tlL, tlR]) { filt(a, 'lp', 120, 0.7, 0, sr); filt(a, 'lp', 160, 0.6, 0, sr); filt(a, 'hp', 24, 0.7, 0, sr); }
  const kr = 0.2 / (rms2(tlL, tlR) || 1);
  const roll = smoothNoise(m, 1.6, rng, sr);
  for (let i = 0; i < m; i++) {
    const tt = i / sr, e = kr * (1 - Math.exp(-tt / 0.08)) * Math.exp(-tt / 1.3) * Math.max(0, 1 + 0.5 * roll[i]);
    L[on + i] += e * tlL[i]; R[on + i] += e * tlR[i];
  }
  // 5) slap echo off distant terrain (ping-pong, dark)
  const ed = Math.round(0.37 * sr);
  if (ed < n) {
    const eL = new Float32Array(n), eR = new Float32Array(n);
    for (let i = 0; i + ed < n; i++) { eL[i + ed] = R[i]; eR[i + ed] = L[i]; }
    filt(eL, 'lp', 1400, 0.7, 0, sr); filt(eR, 'lp', 1400, 0.7, 0, sr);
    for (let i = 0; i < n; i++) { L[i] += 0.18 * eL[i]; R[i] += 0.18 * eR[i]; }
  }
  // 6) distance + space + glue
  if (dist > 0) {
    const fc = 16000 * Math.pow(0.08, dist);
    for (const a of [L, R]) { filt(a, 'lp', fc, 0.7, 0, sr); filt(a, 'lp', fc * 1.4, 0.6, 0, sr); }
  }
  reverb(L, R, { sr, rt60: 2.4 + 1.2 * dist, size: 2.2, damp: 2200, hp: 80, lp: 9000, predelay: 0.02 + 0.05 * dist, mix: space + 0.4 * dist });
  saturate(L, R, 1.5);
  return finish(L, R, { sr, gain, pan, fadeIn: 0.002, fadeOut: Math.min(0.6, 0.15 * D) });
}

/**
 * riser({ dur=4, from=200, to=2000, noise=0.5, voices=5, detune=18, pulse=0.2, pan=0 })
 * Tension riser: detuned polyBLEP saw stack + sine gliding (accelerating) from->to through an opening
 * resonant low-pass, rising band-passed noise, accelerating tremolo, crescendo and stereo widening.
 */
export function riser(params = {}) {
  const { dur = 4, from = 200, to = 2000, noise = 0.5, voices = 5, detune = 18, pulse = 0.2,
    sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('riser', seed);
  const n = nSamp(dur, sr);
  const nv = clamp(Math.round(voices), 1, 12);
  const f0 = clamp(from, 20, sr * 0.4), f1 = clamp(to, 20, sr * 0.4), lr = Math.log(f1 / f0);
  const K = 2.0, eK = Math.exp(K) - 1;
  const phL = new Float64Array(nv), phR = new Float64Array(nv), dL = new Float64Array(nv), dR = new Float64Array(nv);
  const rL = new Float64Array(nv), rR = new Float64Array(nv);
  for (let v = 0; v < nv; v++) {
    phL[v] = rng.next(); phR[v] = rng.next();
    const base = nv === 1 ? 0 : (v / (nv - 1)) * 2 - 1;
    dL[v] = base * detune + rng.bi() * detune * 0.25;
    dR[v] = -base * detune * 0.9 + rng.bi() * detune * 0.25;
  }
  const lpL = new SVF(sr), lpR = new SVF(sr), nbL = new SVF(sr), nbR = new SVF(sr), nhL = new SVF(sr), nhR = new SVF(sr);
  const wl = whiteNoise(n, rng), wr = whiteNoise(n, rng);
  const toneL = new Float32Array(n), toneR = new Float32Array(n), nzL = new Float32Array(n), nzR = new Float32Array(n);
  const env = new Float32Array(n), wid = new Float32Array(n);
  let fph = 0, trPh = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const f = f0 * Math.exp((lr * (Math.exp(K * x) - 1)) / eK);
    if ((i & 31) === 0) {
      const spread = 0.3 + 0.7 * x;
      for (let v = 0; v < nv; v++) { rL[v] = Math.pow(2, (dL[v] * spread) / 1200); rR[v] = Math.pow(2, (dR[v] * spread) / 1200); }
      const fc = clamp(f * (1.4 + 7 * x * x), 80, 16000);
      lpL.set(fc, 1.1); lpR.set(fc * 1.02, 1.1);
      const fn = clamp(f * 2.5, 150, 14000); nbL.set(fn, 1.2); nbR.set(fn * 1.03, 1.2);
      const fh = clamp(1500 + 7000 * x, 1000, 15000); nhL.set(fh, 0.7); nhR.set(fh * 1.04, 0.7);
    }
    let vl = 0, vr = 0;
    for (let v = 0; v < nv; v++) {
      let dt = (f * rL[v]) / sr, p = phL[v] + dt; if (p >= 1) p -= 1; phL[v] = p; vl += 2 * p - 1 - polyBlep(p, dt);
      dt = (f * rR[v]) / sr; p = phR[v] + dt; if (p >= 1) p -= 1; phR[v] = p; vr += 2 * p - 1 - polyBlep(p, dt);
    }
    fph += f / sr;
    const fund = 0.6 * fsin(fph);
    lpL.tick(vl / nv + fund); lpR.tick(vr / nv + fund);
    toneL[i] = lpL.lp; toneR[i] = lpR.lp;
    nbL.tick(wl[i]); nbR.tick(wr[i]); nhL.tick(wl[i]); nhR.tick(wr[i]);
    nzL[i] = nbL.k * nbL.bp + 0.5 * x * nhL.hp; nzR[i] = nbR.k * nbR.bp + 0.5 * x * nhR.hp;
    trPh += (3 + 12 * x * x) / sr;
    env[i] = (0.02 + 0.98 * Math.pow(x, 2.2)) * (1 - pulse * (0.5 - 0.5 * Math.cos(TAU * trPh)));
    wid[i] = 0.3 + 0.7 * x;
  }
  const kt = 1 / (rms2(toneL, toneR) || 1), kn = (0.9 * clamp(noise, 0, 3)) / (rms2(nzL, nzR) || 1);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = toneL[i] * kt + nzL[i] * kn, r = toneR[i] * kt + nzR[i] * kn;
    const M = 0.5 * (l + r), S = 0.5 * (l - r) * wid[i];
    L[i] = env[i] * (M + S); R[i] = env[i] * (M - S);
  }
  return finish(L, R, { sr, gain, pan, fadeIn: 0.05, fadeOut: 0.03 });
}

/**
 * shimmer({ dur=3, root=880, sparkle=0.5, space=0.45, pan=0 })
 * Glassy cluster (root, 5th, octave, 9th, 12th, 2 oct...) with slow per-partial beating and faint 2.76x
 * glass partials, random bell-like twinkles on a pentatonic scale, sparkling air, bright reverb.
 */
export function shimmer(params = {}) {
  const { dur = 3, root = 880, sparkle = 0.5, space = 0.45, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('shimmer', seed);
  const n = nSamp(dur, sr), D = n / sr, r0 = clamp(root, 40, sr * 0.3), sp = clamp(sparkle, 0, 3);
  const att = Math.min(0.6, 0.25 * D), rel = Math.min(1.4, 0.45 * D);
  const envAt = (t) => (t < att ? Math.sin((HALF_PI * t) / att) ** 2 : 1) * (t > D - rel ? Math.max(0, (D - t) / rel) ** 1.6 : 1);
  // cluster
  const ratios = [1, 1.4983, 2, 2.2449, 2.9966, 4, 4.4898, 5.9932];
  const parts = [];
  ratios.forEach((r, k) => {
    for (const [mul, amp] of [[1, 0.5], [2.76, 0.08]]) {
      const f = r0 * r * mul;
      if (f > Math.min(16000, 0.42 * sr)) continue;
      parts.push({ f, a: amp / Math.sqrt(1 + k), dl: rng.range(0.4, 2.2), rate: rng.range(0.25, 1.6), depth: rng.range(0.25, 0.6), ph: rng.next(), pl: rng.next(), pr: rng.next() });
    }
  });
  const cL = new Float32Array(n), cR = new Float32Array(n);
  for (const p of parts) {
    let a = p.pl, b = p.pr, c = p.ph;
    const iL = (p.f - p.dl / 2) / sr, iR = (p.f + p.dl / 2) / sr, iA = p.rate / sr;
    for (let i = 0; i < n; i++) {
      const g = p.a * (1 - p.depth * (0.5 + 0.5 * fsin(c)));
      cL[i] += g * fsin(a); cR[i] += g * fsin(b);
      a += iL; b += iR; c += iA;
    }
  }
  const kc = 0.12 / (rms2(cL, cR) || 1);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const e = envAt(i / sr) * kc; L[i] = cL[i] * e; R[i] = cR[i] * e; }
  // twinkles
  const rate = 2 + 26 * sp, scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
  let t = rng.exp(0.5 / rate);
  while (t < D - 0.15 && sp > 0) {
    const e = envAt(t);
    if (rng.next() < 0.3 + 0.7 * e) {
      let f = r0 * rng.pick([1, 2, 2, 4, 4, 8]) * rng.pick(scale);
      while (f > Math.min(7000, 0.3 * sr)) f /= 2;
      const tau = rng.range(0.05, 0.28), a = rng.range(0.15, 0.5) * (0.5 + 0.5 * e);
      const tw = [{ f, a, tau }, { f: f * 2.756, a: a * 0.22, tau: tau * 0.45 }, { f: f * 5.404, a: a * 0.07, tau: tau * 0.25 }].filter((m) => m.f < 16000);
      modes(L, R, Math.round(t * sr), tw, { sr, pan: rng.bi() * 0.9, att: 0.0015 });
    }
    t += rng.exp(1 / rate);
  }
  // sparkling air
  if (sp > 0) {
    const aL = whiteNoise(n, rng), aR = whiteNoise(n, rng), fl = smoothNoise(n, 12, rng, sr), fr = smoothNoise(n, 12, rng, sr);
    for (const a of [aL, aR]) { filt(a, 'hp', 7000, 0.7, 0, sr); filt(a, 'hp', 7000, 0.7, 0, sr); }
    const g = 0.035 * sp;
    for (let i = 0; i < n; i++) {
      const e = envAt(i / sr) * g;
      L[i] += aL[i] * e * Math.max(0, fl[i]) ** 2; R[i] += aR[i] * e * Math.max(0, fr[i]) ** 2;
    }
  }
  reverb(L, R, { sr, rt60: 2.4, size: 1.3, damp: 9000, hp: 250, predelay: 0.025, mix: space });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.01, fadeOut: Math.min(0.15, 0.1 * D) });
}

/**
 * heartbeat({ bpm=60, beats=4, space=0.06, pan=0 })
 * Lub-dub: each sound = pitch-dropping low sine + low-passed noise knock, S2 higher/shorter/quieter than S1,
 * split ~0.1+0.22*period s, slight beat-to-beat variability, chest low-pass, gentle saturation.
 */
export function heartbeat(params = {}) {
  const { bpm = 60, beats = 4, space = 0.06, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('heartbeat', seed);
  const period = 60 / clamp(bpm, 20, 240), nb = Math.max(1, Math.round(beats));
  const pre = 0.02, D = pre + (nb - 1) * period + Math.max(0.75, 0.9 * period);
  const n = nSamp(D, sr);
  const M = new Float32Array(n);
  const split = clamp(0.1 + 0.22 * period, 0.15, 0.42);
  const thump = (t0, fA, fB, tauF, att, tau, amp, lp) => {
    const s0 = Math.round(t0 * sr), len = Math.min(n - s0, nSamp(att + tau * 9, sr));
    if (len <= 0) return;
    const nz = brownNoise(len, rng, 60, sr);
    filt(nz, 'lp', lp, 0.7, 0, sr);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const e = t < att ? Math.sin((HALF_PI * t) / att) ** 2 : Math.exp(-(t - att) / tau);
      ph += (fB + (fA - fB) * Math.exp(-t / tauF)) / sr;
      M[s0 + i] += amp * e * (fsin(ph) + 0.45 * nz[i] * Math.exp(-t / (0.5 * tau)));
    }
  };
  for (let b = 0; b < nb; b++) {
    const t = Math.max(0.004, pre + b * period + rng.gauss() * 0.008 * period);
    const a = 1 + 0.06 * rng.gauss();
    thump(t, 68, 44, 0.03, 0.009, 0.05, a, 150);
    thump(t + split * (1 + 0.03 * rng.gauss()), 86, 56, 0.022, 0.006, 0.036, 0.7 * a, 200);
  }
  filt(M, 'lp', 260, 0.7, 0, sr);
  filt(M, 'peak', 55, 1.0, 3, sr);
  const pk = peakAbs(M) || 1, d = Math.tanh(1.8);
  for (let i = 0; i < n; i++) M[i] = Math.tanh((1.8 * M[i]) / pk) / d;
  const L = M, R = Float32Array.from(M);
  reverb(L, R, { sr, rt60: 0.35, size: 0.35, damp: 1500, hp: 60, predelay: 0.004, mix: space });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.003, fadeOut: 0.1 });
}

/**
 * tick({ type='clock'|'watch'|'ratchet'|'metronome', count=1, interval=1, accent=0, clicks=12, rate=26, pan=0 })
 * Modal escapement ticks. clock alternates tick/tock with a wooden case body; watch is tiny and bright;
 * metronome is a woodblock clack (accent every `accent` beats); ratchet = one crank of `clicks` pawl clicks
 * at ~`rate`/s per count (count repeats the crank every `interval` s).
 */
export function tick(params = {}) {
  const { type = 'clock', count = 1, interval = 1, accent = 0, clicks = 12, rate = 26, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('tick:' + type, seed);
  const cnt = Math.max(1, Math.round(count)), ivl = Math.max(0.005, interval);
  const nClk = Math.max(1, Math.round(clicks)), rt = clamp(rate, 2, 200);
  const evLen = { clock: 0.3, watch: 0.06, metronome: 0.25, ratchet: nClk / rt + 0.12 }[type] ?? 0.3;
  const D = 0.003 + (cnt - 1) * ivl + evLen + 0.12;
  const n = nSamp(D, sr), L = new Float32Array(n), R = new Float32Array(n);
  const S = (t) => Math.round(t * sr);
  const jit = (x) => 1 + x * rng.bi();
  for (let k = 0; k < cnt; k++) {
    const t0 = 0.003 + k * ivl;
    if (type === 'watch') {
      const pz = (k % 2 ? 0.95 : 1) * jit(0.004);
      for (const [dt, a] of [[0, 1], [0.0022, 0.55]]) {
        burst(L, R, S(t0 + dt), { sr, rng, len: 0.002, att: 0.00001, tau: 0.00015, hp: 4000, amp: 0.6 * a });
        modes(L, R, S(t0 + dt), [{ f: 4700 * pz, a: 0.35, tau: 0.006 }, { f: 6150 * pz, a: 0.28, tau: 0.005 }, { f: 7900 * pz, a: 0.18, tau: 0.004 }, { f: 2300 * pz, a: 0.12, tau: 0.004 }], { sr, amp: a });
      }
    } else if (type === 'metronome') {
      const acc = accent > 0 && k % Math.round(accent) === 0;
      const f0 = (acc ? 1480 : 1120) * jit(0.004);
      burst(L, R, S(t0), { sr, rng, len: 0.004, att: 0.00002, tau: 0.0004, hp: 1500, amp: 0.7 });
      modes(L, R, S(t0), [{ f: f0, a: 0.6, tau: 0.03 }, { f: f0 * 1.71, a: 0.28, tau: 0.018 }, { f: f0 * 2.44, a: 0.2, tau: 0.012 }, { f: f0 * 3.38, a: 0.1, tau: 0.008 }, { f: 260, a: 0.25, tau: 0.02 }], { sr });
    } else if (type === 'ratchet') {
      let tc = t0;
      for (let j = 0; j < nClk; j++) {
        const x = j / Math.max(1, nClk - 1), lr = rt * (0.75 + 0.5 * Math.sin(Math.PI * x));
        const a = rng.range(0.75, 1), pz = jit(0.015), p = rng.bi() * 0.1;
        burst(L, R, S(tc), { sr, rng, len: 0.003, att: 0.00002, tau: 0.00025, hp: 2500, amp: 0.8 * a, pan: p });
        modes(L, R, S(tc), [{ f: 1850 * pz, a: 0.35, tau: 0.012 }, { f: 3150 * pz, a: 0.3, tau: 0.008 }, { f: 4550 * pz, a: 0.22, tau: 0.006 }, { f: 6300 * pz, a: 0.14, tau: 0.004 }, { f: 560 * pz, a: 0.2, tau: 0.015 }, { f: 1120 * pz, a: 0.12, tau: 0.01 }], { sr, amp: a, pan: p });
        const td = tc + rng.range(0.35, 0.45) / lr; // pawl drops into the next tooth
        burst(L, R, S(td), { sr, rng, len: 0.002, att: 0.00001, tau: 0.0002, hp: 3500, amp: 0.3 * a, pan: p });
        modes(L, R, S(td), [{ f: 4200 * pz, a: 0.12, tau: 0.005 }, { f: 2700 * pz, a: 0.1, tau: 0.006 }], { sr, amp: a, pan: p });
        tc += (1 / lr) * jit(0.06);
      }
    } else { // pendulum clock: unlocking click, then the escape-wheel drop exciting metal + wooden case
      const pz = (k % 2 ? 0.89 : 1) * jit(0.005);
      burst(L, R, S(t0), { sr, rng, len: 0.003, att: 0.00003, tau: 0.00025, hp: 3000, amp: 0.25 });
      const t1 = t0 + rng.range(0.0035, 0.005);
      burst(L, R, S(t1), { sr, rng, len: 0.004, att: 0.00002, tau: 0.0003, hp: 1800, amp: 0.9 });
      const fb = 2350 * pz;
      modes(L, R, S(t1), [{ f: fb, a: 0.5, tau: 0.028 }, { f: fb * 1.52, a: 0.32, tau: 0.02 }, { f: fb * 2.23, a: 0.24, tau: 0.014 }, { f: fb * 2.87, a: 0.16, tau: 0.01 }, { f: fb * 3.61, a: 0.1, tau: 0.007 }], { sr });
      modes(L, R, S(t1), [{ f: 410 * pz, a: 0.22, tau: 0.035 }, { f: 770 * pz, a: 0.2, tau: 0.025 }, { f: 1230 * pz, a: 0.16, tau: 0.018 }], { sr, att: 0.0004 });
    }
  }
  const room = { clock: [0.45, 0.5, 5000, 0.12], watch: [0.2, 0.3, 8000, 0.03], metronome: [0.4, 0.5, 6000, 0.1], ratchet: [0.35, 0.4, 5000, 0.08] }[type] ?? [0.45, 0.5, 5000, 0.12];
  reverb(L, R, { sr, rt60: room[0], size: room[1], damp: room[2], hp: 200, predelay: 0.005, mix: params.space ?? room[3] });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.002, fadeOut: 0.05 });
}

/**
 * clank({ size=1, bounces=2, space=0.25, pan=0 })
 * Metallic clank / gear hit: ~34 inharmonic modes (plate/bar-like ratios, split doublets for beating),
 * hardness-dependent excitation, a low mass "thunk", 1-2 smaller bounce re-strikes, industrial room.
 */
export function clank(params = {}) {
  const { size = 1, bounces = 2, space = 0.25, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('clank', seed);
  const sz = clamp(size, 0.15, 6), rs = Math.sqrt(sz);
  const D = 0.3 + 1.5 * rs + 0.4;
  const n = nSamp(D, sr), L = new Float32Array(n), R = new Float32Array(n);
  const f1 = 360 / Math.pow(sz, 0.8);
  const ratios = [1, 1.593, 2.136, 2.296, 2.653, 2.917, 3.156, 3.501, 4.07, 4.61, 5.18, 5.66, 6.27, 7.08, 7.93, 8.83, 9.91, 11.27, 12.6, 14.1, 15.9, 17.6, 19.8, 22.3];
  const bank = [];
  ratios.forEach((r, k) => {
    const f = f1 * r * (1 + 0.025 * rng.bi());
    if (f > 0.44 * sr) return;
    const tau = ((0.75 * rs) / (1 + 0.22 * k)) * rng.range(0.6, 1.35), a = rng.range(0.4, 1) / (1 + 0.1 * k);
    bank.push({ f, a, tau, p: rng.bi() * 0.45 });
    if (k < 10) bank.push({ f: f * (1 + rng.range(0.0006, 0.0025)), a: a * rng.range(0.3, 0.8), tau: tau * rng.range(0.8, 1.1), p: rng.bi() * 0.45 });
  });
  const strike = (t, amp, hard) => {
    const s = Math.round(t * sr);
    const ms = bank.map((m) => ({ ...m, a: (m.a * rng.range(0.3, 1)) / (1 + (m.f / (5000 * hard)) ** 2) }));
    modes(L, R, s, ms, { sr, amp: 0.8 * amp });
    burst(L, R, s, { sr, rng, len: 0.004, att: 0.00002, tau: 0.00035 / hard, hp: 1200, amp: 0.5 * amp });
    burst(L, R, s, { sr, rng, color: 'pink', len: 0.1 * rs, att: 0.0005, tau: 0.018 * rs, lp: 260 / rs, amp: 0.55 * amp });
  };
  strike(0.004, 1, 1.2);
  let tb = 0.004, ab = 1;
  for (let b = 0; b < Math.round(bounces); b++) {
    tb += rng.range(0.045, 0.1) * Math.pow(0.75, b) * rs;
    ab *= rng.range(0.25, 0.4);
    if (tb < D - 0.3) strike(tb, ab, 0.8);
  }
  reverb(L, R, { sr, rt60: 0.9 + 0.5 * sz, size: 1.3, damp: 5000, hp: 120, predelay: 0.01, mix: space });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.002, fadeOut: Math.min(0.3, 0.15 * D), level: Math.min(1, 0.6 + 0.4 * sz) });
}

/**
 * bubble({ count=12, dur=2, ambience=0.3, minRadius=1.2, maxRadius=6 (mm), pan=0 })
 * Underwater bubbles (van den Doel model): Minnaert pitch f0 = 3.26/r, damping d(r), rising chirp
 * f(t) = f0 (1 + xi d t); bubbles partly clustered in streams; muffled; optional low underwater ambience.
 */
export function bubble(params = {}) {
  const { count = 12, dur = 2, ambience = 0.3, minRadius = 1.2, maxRadius = 6, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('bubble', seed);
  const n = nSamp(dur, sr), D = n / sr;
  const L = new Float32Array(n), R = new Float32Array(n);
  const nb = Math.max(0, Math.round(count)), tMax = Math.max(0.06, D - 0.3);
  const rMin = clamp(Math.min(minRadius, maxRadius), 0.3, 30), rMax = clamp(Math.max(minRadius, maxRadius), 0.3, 30);
  const times = [];
  while (times.length < nb) {
    if (nb - times.length >= 2 && rng.chance(0.55)) {
      const m = Math.min(nb - times.length, 2 + rng.int(4));
      let t = rng.range(0.03, tMax);
      for (let j = 0; j < m; j++) { times.push(Math.min(t, tMax)); t += rng.range(0.03, 0.13); }
    } else times.push(rng.range(0.03, tMax));
  }
  times.sort((a, b) => a - b);
  for (const t0 of times) {
    const rmm = rMin * Math.pow(rMax / rMin, Math.pow(rng.next(), 1.5)), r = rmm * 1e-3;
    const f0 = 3.26 / r, d = 0.13 / r + 0.0072 * Math.pow(r, -1.5);
    const dA = d * 0.6, sigma = rng.range(0.06, 0.14) * d;
    const amp = Math.pow(rmm / rMax, 0.7) * rng.range(0.55, 1);
    const s0 = Math.round(t0 * sr), len = Math.min(nSamp(6.5 / dA, sr), n - s0);
    if (len <= 0 || f0 > 0.45 * sr) continue;
    const buf = new Float32Array(len);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      ph += Math.min(0.45 * sr, f0 * (1 + sigma * t)) / sr;
      buf[i] = fsin(ph) * (1 - Math.exp(-t / 0.0008)) * Math.exp(-dA * t);
    }
    addMono(L, R, buf, s0, amp, rng.bi() * 0.6);
  }
  filt(L, 'lp', 3200, 0.7, 0, sr); filt(R, 'lp', 3200, 0.7, 0, sr);
  if (ambience > 0) {
    const pk = peak2(L, R) || 1;
    const aL = brownNoise(n, rng, 30, sr), aR = brownNoise(n, rng, 30, sr), sw = smoothNoise(n, 0.25, rng, sr);
    for (const a of [aL, aR]) { filt(a, 'lp', 380, 0.7, 0, sr); filt(a, 'hp', 35, 0.7, 0, sr); }
    const ka = (0.1 * clamp(ambience, 0, 3) * pk) / (rms2(aL, aR) || 1);
    for (let i = 0; i < n; i++) { const e = ka * (0.75 + 0.25 * sw[i]); L[i] += aL[i] * e; R[i] += aR[i] * e; }
  }
  reverb(L, R, { sr, rt60: 0.45, size: 0.5, damp: 2500, hp: 150, predelay: 0.005, mix: 0.18 });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.02, fadeOut: Math.min(0.3, 0.15 * D) });
}

/**
 * crackle({ dur=4, density=12, hiss=0.35, roar=0.5, pan=0 })
 * Fire: doubly-stochastic Poisson pops (log-normal sizes, micro-clusters, some with a woody body, occasional
 * resonant snaps with a steam sizzle), a dense flickering micro-crackle "fizz" bed (sparse heavy-tailed
 * impulse train, band-limited) over a soft gas hiss (`hiss` scales both), and a breathing low roar (`roar`).
 */
export function crackle(params = {}) {
  const { dur = 4, density = 12, hiss = 0.35, roar = 0.5, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('crackle', seed);
  const n = nSamp(dur, sr), D = n / sr;
  const L = new Float32Array(n), R = new Float32Array(n);
  const dens = Math.max(0, density);
  const rm = smoothNoise(n, 0.8, rng, sr); // flame activity: drives pop rate and bed flicker
  const act = (t) => clamp(1 + 1.1 * rm[clamp(Math.floor(t * sr), 0, n - 1)], 0.1, 2.6);
  const tk = (s, a, p, f) => burst(L, R, s, { sr, rng, len: rng.range(0.0015, 0.004), att: 0.00001, tau: rng.range(0.00012, 0.0006), bp: f, q: rng.range(0.5, 1.2), amp: a, pan: p });
  const pop = (t) => {
    const s = Math.round(t * sr), p = rng.bi() * 0.8, a = Math.min(1, 0.35 * Math.exp(0.55 * rng.gauss()));
    if (rng.chance(0.14)) { // resonant wood snap (+ sometimes escaping steam)
      burst(L, R, s, { sr, rng, len: 0.004, att: 0.00002, tau: 0.0003, hp: 1200, amp: Math.min(1, a * 1.8), pan: p });
      burst(L, R, s, { sr, rng, len: 0.03, att: 0.0001, tau: rng.range(0.002, 0.006), bp: rng.logRange(600, 2200), q: rng.range(2, 5), amp: a * 0.9, pan: p });
      burst(L, R, s, { sr, rng, color: 'pink', len: 0.03, att: 0.0003, tau: 0.004, lp: 500, amp: a * 0.35, pan: p });
      if (rng.chance(0.35)) burst(L, R, s + nSamp(0.004, sr), { sr, rng, len: 0.4, att: 0.015, tau: rng.range(0.04, 0.12), bp: rng.logRange(3000, 7000), q: 1.2, amp: a * 0.15, pan: p });
    } else {
      tk(s, a, p, rng.logRange(1500, 5000));
      if (rng.chance(0.3)) burst(L, R, s, { sr, rng, color: 'pink', len: 0.012, att: 0.0002, tau: 0.0015, lp: 700, amp: a * 0.3, pan: p });
      let tt = t;
      const k = rng.chance(0.45) ? 1 + rng.int(4) : 0;
      for (let j = 0; j < k; j++) { tt += rng.range(0.0015, 0.015); tk(Math.round(tt * sr), a * rng.range(0.25, 0.7), p + rng.bi() * 0.1, rng.logRange(1500, 6000)); }
    }
  };
  const lamMax = Math.max(0.1, dens) * 2.6;
  let t = rng.exp(1 / lamMax);
  while (t < D - 0.03 && dens > 0) {
    if (rng.next() * lamMax < dens * act(t)) pop(t);
    t += rng.exp(1 / lamMax);
  }
  const ref = Math.max(0.3, peak2(L, R));
  // micro-crackle fizz bed
  if (hiss > 0) {
    const hz = clamp(hiss, 0, 3), rate = 1500 * hz, bufs = [new Float32Array(n), new Float32Array(n)];
    for (const b of bufs) {
      let tt = rng.exp(1 / rate);
      while (tt < D) {
        const i = Math.floor(tt * sr);
        if (rng.next() * 2.6 < act(tt)) {
          const a = Math.pow(rng.next(), 2.5) * (rng.chance(0.5) ? 1 : -1), len = 2 + rng.int(8);
          for (let q = 0; q < len && i + q < n; q++) b[i + q] += a * rng.bi() * Math.exp(-q / 2);
        }
        tt += rng.exp(1 / rate);
      }
      filt(b, 'hp', 1800, 0.7, 0, sr); filt(b, 'hp', 1800, 0.7, 0, sr); filt(b, 'lp', 10000, 0.7, 0, sr);
    }
    // peak-referenced (a sparse impulse train has a huge crest factor): loudest fizz tick ~ -10 dB under the pops
    const kh = (0.3 * ref * Math.sqrt(hz / 0.35)) / (peak2(bufs[0], bufs[1]) || 1);
    // plus a soft continuous gas hiss under the fizz, flickering with the flames
    const hL = whiteNoise(n, rng), hR = whiteNoise(n, rng), fl = smoothNoise(n, 5, rng, sr);
    for (const a of [hL, hR]) { filt(a, 'hp', 3000, 0.7, 0, sr); filt(a, 'lp', 12000, 0.7, 0, sr); }
    const ks = (0.012 * ref * (hz / 0.35)) / (rms2(hL, hR) || 1);
    for (let i = 0; i < n; i++) {
      const e = ks * (0.6 + 0.4 * Math.abs(fl[i])) * act(i / sr) * 0.6;
      L[i] += bufs[0][i] * kh + hL[i] * e; R[i] += bufs[1][i] * kh + hR[i] * e;
    }
  }
  // roar
  if (roar > 0) {
    const oL = pinkNoise(n, rng), oR = pinkNoise(n, rng), bc = brownNoise(n, rng, 25, sr);
    for (let i = 0; i < n; i++) { oL[i] += 0.7 * bc[i]; oR[i] += 0.7 * bc[i]; }
    for (const a of [oL, oR]) { filt(a, 'lp', 300, 0.7, 0, sr); filt(a, 'lp', 420, 0.6, 0, sr); filt(a, 'hp', 35, 0.7, 0, sr); }
    const f1 = smoothNoise(n, 3, rng, sr), f2 = smoothNoise(n, 9, rng, sr), br = smoothNoise(n, 0.3, rng, sr);
    const ko = (0.2 * clamp(roar, 0, 3) * ref) / (rms2(oL, oR) || 1);
    for (let i = 0; i < n; i++) { const e = ko * Math.max(0, 0.6 + 0.25 * f1[i] + 0.12 * f2[i]) * (0.8 + 0.2 * br[i]); L[i] += oL[i] * e; R[i] += oR[i] * e; }
  }
  reverb(L, R, { sr, rt60: 0.5, size: 0.6, damp: 6000, hp: 150, predelay: 0.006, mix: 0.08 });
  return finish(L, R, { sr, gain, pan, fadeIn: Math.min(0.25, 0.1 * D), fadeOut: Math.min(0.4, 0.15 * D) });
}

/**
 * wave({ dur=8, period=7, intensity=1, bed=0.35, pan=0 })
 * Ocean surf: per breaker a swelling low wash, a broadband crash whose low-pass opens with it, a low boom and
 * a long fizzing foam hiss receding; breakers sweep across the stereo field; constant distant surf bed.
 */
export function wave(params = {}) {
  const { dur = 8, period = 7, intensity = 1, bed = 0.35, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('wave', seed);
  const n = nSamp(dur, sr), D = n / sr, P = Math.max(1.5, period), I0 = clamp(intensity, 0.05, 2);
  const waves = [];
  let tc = Math.min(0.42 * P, Math.max(0.9, 0.38 * D));
  while (tc - 0.5 * P < D) {
    waves.push({ tc, I: rng.range(0.75, 1), swell: 0.38 * P * rng.range(0.9, 1.1), crashTau: rng.range(0.6, 0.9) * Math.sqrt(P / 7), foamTau: 0.28 * P * rng.range(0.85, 1.15), off: rng.bi() * 0.15 });
    tc += P * rng.range(0.9, 1.1);
  }
  const eW = [new Float32Array(n), new Float32Array(n)], eC = [new Float32Array(n), new Float32Array(n)], eF = [new Float32Array(n), new Float32Array(n)];
  for (const w of waves) {
    for (let c = 0; c < 2; c++) { // the breaker sweeps along the beach: one side hears it slightly earlier
      const t0 = w.tc + (c === 0 ? -w.off : w.off);
      const i0 = Math.max(0, Math.floor((t0 - w.swell) * sr)), i1 = Math.min(n, Math.ceil((t0 + 8 * w.foamTau) * sr));
      for (let i = i0; i < i1; i++) {
        const x = i / sr - t0, u = (x + w.swell) / w.swell, v = smoothstep((x + 0.3) / 0.45);
        const wash = x < -w.swell ? 0 : x < 0 ? u * u * u : Math.exp(-x / 0.6);
        const crash = x < -0.3 ? 0 : x < 0.15 ? v * Math.sqrt(v) : Math.exp(-(x - 0.15) / w.crashTau);
        const foam = x < 0 ? 0 : (1 - Math.exp(-x / 0.4)) * Math.exp(-x / w.foamTau);
        eW[c][i] += w.I * wash; eC[c][i] += w.I * crash; eF[c][i] += w.I * foam;
      }
    }
  }
  // noise sources: a shared component (correlation ~0.35 between channels) + independent per channel
  const pwC = pinkNoise(n, rng), wcC = whiteNoise(n, rng), wfC = whiteNoise(n, rng), bb = brownNoise(n, rng, 25, sr);
  filt(bb, 'lp', 120, 0.7, 0, sr); filt(bb, 'hp', 25, 0.7, 0, sr); scaleTo(bb, 1);
  const out = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const pw = pinkNoise(n, rng), wc = whiteNoise(n, rng), wf = whiteNoise(n, rng), pb = pinkNoise(n, rng);
    for (let i = 0; i < n; i++) { pw[i] = 0.6 * pwC[i] + 0.8 * pw[i]; wc[i] = 0.6 * wcC[i] + 0.8 * wc[i]; wf[i] = 0.6 * wfC[i] + 0.8 * wf[i]; }
    const fz = smoothNoise(n, 40, rng, sr), fz2 = smoothNoise(n, 7, rng, sr), bedAm = smoothNoise(n, 0.15, rng, sr);
    filt(wc, 'hp', 220, 0.7, 0, sr);
    filt(wf, 'hp', 1600, 0.7, 0, sr); filt(wf, 'peak', 5500, 0.8, 4, sr); filt(wf, 'lp', 14000, 0.7, 0, sr); scaleTo(wf, 1);
    filt(pb, 'lp', 700, 0.7, 0, sr); filt(pb, 'hp', 60, 0.7, 0, sr); scaleTo(pb, 1);
    const fw = new SVF(sr), fcr = new SVF(sr);
    const o = out[c], W = eW[c], C = eC[c], F = eF[c];
    for (let i = 0; i < n; i++) {
      if ((i & 7) === 0) { fw.set(200 + 1800 * W[i] + 3500 * C[i], 0.6); fcr.set(clamp(900 + 9000 * C[i], 500, 16000), 0.6); }
      fw.tick(pw[i]); fcr.tick(wc[i]);
      const az = Math.abs(fz[i]), fizz = 0.3 + 0.7 * az * Math.sqrt(az) * (0.7 + 0.3 * fz2[i]), cc = C[i];
      o[i] = I0 * (fw.lp * (0.5 * W[i] + 0.25 * cc) + 1.1 * fcr.lp * cc + 0.55 * wf[i] * F[i] * fizz + 0.8 * bb[i] * cc * Math.sqrt(cc))
        + 0.25 * bed * pb[i] * (0.8 + 0.2 * bedAm[i]);
    }
  }
  return finish(out[0], out[1], { sr, gain, pan, fadeIn: Math.min(0.8, 0.1 * D), fadeOut: Math.min(1.2, 0.15 * D), level: Math.min(1, 0.6 + 0.4 * I0) });
}

/**
 * wind({ dur=6, strength=0.6, gustiness=0.5, pan=0 })
 * Howling wind: log-normal gust envelope drives (a) a rushing pink-noise low-pass whose cutoff rises with
 * gusts and (b) three resonant (cascaded band-pass) howl bands whose centres wander and rise with gust speed,
 * spread across the stereo field; plus low buffeting.
 */
export function wind(params = {}) {
  const { dur = 6, strength = 0.6, gustiness = 0.5, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('wind', seed);
  const n = nSamp(dur, sr), D = n / sr;
  const st = clamp(strength, 0, 1.5), gu = clamp(gustiness, 0, 1.5);
  const g1 = smoothNoise(n, 0.3, rng, sr), g2 = smoothNoise(n, 0.8, rng, sr), g3 = smoothNoise(n, 2.2, rng, sr);
  const G = new Float32Array(n), base = 0.35 + 0.65 * st;
  for (let i = 0; i < n; i++) G[i] = base * Math.exp(gu * 1.6 * (0.85 * g1[i] + 0.45 * g2[i] + 0.15 * g3[i]));
  const pc = pinkNoise(n, rng), pl = pinkNoise(n, rng), pr = pinkNoise(n, rng);
  const NB = 3, hw = [], wd = [], bands = [], howl = [];
  const fB = [380, 610, 950].map((f) => f * (0.8 + 0.4 * st) * rng.range(0.92, 1.08)), pB = [-0.55, 0.5, 0.05];
  const qB = 3 + 5 * st;
  for (let b = 0; b < NB; b++) { hw.push(whiteNoise(n, rng)); wd.push(smoothNoise(n, rng.range(0.3, 0.6), rng, sr)); bands.push([new SVF(sr), new SVF(sr)]); howl.push(new Float32Array(n)); }
  const rL = new SVF(sr), rR = new SVF(sr), rushL = new Float32Array(n), rushR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if ((i & 7) === 0) {
      const gg = G[i], fc = 220 + 1600 * Math.pow(gg, 1.3);
      rL.set(fc, 0.55); rR.set(fc * 1.08, 0.55);
      for (let b = 0; b < NB; b++) { const f = fB[b] * (0.5 + 0.6 * gg) * Math.pow(2, 0.3 * wd[b][i]); bands[b][0].set(f, qB); bands[b][1].set(f, qB); }
    }
    rL.tick(0.6 * pc[i] + 0.8 * pl[i]); rushL[i] = rL.lp;
    rR.tick(0.6 * pc[i] + 0.8 * pr[i]); rushR[i] = rR.lp;
    for (let b = 0; b < NB; b++) {
      const s1 = bands[b][0], s2 = bands[b][1];
      s1.tick(hw[b][i]); s2.tick(s1.k * s1.bp); howl[b][i] = s2.k * s2.bp;
    }
  }
  const kr = 1 / (rms2(rushL, rushR) || 1), kh = howl.map((h) => 1 / (rmsOf(h) || 1));
  const hl = 0.75 * (0.3 + st), gains = pB.map((p) => panGains(p));
  const bL = brownNoise(n, rng, 20, sr), bR = brownNoise(n, rng, 20, sr);
  for (const a of [bL, bR]) { filt(a, 'lp', 70, 0.7, 0, sr); filt(a, 'hp', 20, 0.7, 0, sr); }
  const kb = (0.35 * gu) / (rms2(bL, bR) || 1);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const gg = G[i], er = Math.pow(gg, 1.3) * kr, eh = Math.pow(gg, 2.2) * hl, eb = gg * gg * kb;
    let l = rushL[i] * er + bL[i] * eb, r = rushR[i] * er + bR[i] * eb;
    for (let b = 0; b < NB; b++) { const v = howl[b][i] * kh[b] * eh; l += v * gains[b][0]; r += v * gains[b][1]; }
    L[i] = l; R[i] = r;
  }
  return finish(L, R, { sr, gain, pan, fadeIn: Math.min(1.2, 0.2 * D), fadeOut: Math.min(1.5, 0.25 * D), level: Math.min(1, 0.55 + 0.45 * (st / 0.6)) });
}

/**
 * hum({ dur=3, freq=60, buzz=0.3, pan=0 })
 * Mains hum / transformer buzz: additive band-limited wavetables (fundamental + strong 2f magnetostriction
 * line + low harmonics; a rattling even-weighted harmonic "buzz" with housing formants ~1.5/3.8 kHz),
 * slow amplitude drift, flickering buzz level, faint electrical hiss, small room.
 */
export function hum(params = {}) {
  const { dur = 3, freq = 60, buzz = 0.3, space = 0.15, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('hum', seed);
  const n = nSamp(dur, sr), D = n / sr, f0 = clamp(freq, 16, 2000);
  const TS = 8192, tone = new Float64Array(TS + 1), bz = new Float64Array(TS + 1);
  const Kmax = Math.floor(Math.min(14000, 0.45 * sr) / f0);
  const toneAmps = [0, 0.4, 1.0, 0.28, 0.42, 0.1, 0.2, 0.05, 0.1];
  const bump = (f, fc, w) => Math.exp(-0.5 * (Math.log2(f / fc) / w) ** 2);
  for (let k = 1; k <= Kmax; k++) {
    const ph = rng.next() * TAU, fk = k * f0;
    const at = k < toneAmps.length ? toneAmps[k] : 0;
    let ab = 0;
    if (k >= 3) {
      ab = ((k % 2 === 0 ? 1 : 0.5) * (1 + 2.2 * bump(fk, 1500, 0.5) + 1.5 * bump(fk, 3800, 0.45))) / Math.pow(k / 2, 0.9);
      ab *= rng.range(0.6, 1.2) * (fk > 9000 ? Math.exp(-(fk - 9000) / 2000) : 1);
    }
    if (at === 0 && ab === 0) continue;
    for (let j = 0; j <= TS; j++) { const s = Math.sin((TAU * k * j) / TS + ph); tone[j] += at * s; bz[j] += ab * s; }
  }
  const pt = peakAbs(tone) || 1, pbz = peakAbs(bz) || 1;
  for (let j = 0; j <= TS; j++) { tone[j] /= pt; bz[j] /= pbz; }
  const bA = smoothNoise(n, 6, rng, sr), bB = smoothNoise(n, 0.9, rng, sr), am = smoothNoise(n, 0.5, rng, sr);
  const hs = pinkNoise(n, rng);
  filt(hs, 'hp', 300, 0.7, 0, sr);
  const bl = clamp(buzz, 0, 3) * 0.9, inc = f0 / sr;
  const M = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const x = ph * TS, j = x | 0, fr = x - j;
    const tv = tone[j] + (tone[j + 1] - tone[j]) * fr, bv = bz[j] + (bz[j + 1] - bz[j]) * fr;
    const ba = bl * Math.max(0, 1 + 0.35 * bA[i] + 0.2 * bB[i]);
    M[i] = (tv + ba * bv) * (1 + 0.04 * am[i]) + 0.004 * hs[i];
    ph += inc; if (ph >= 1) ph -= 1;
  }
  const L = M, R = Float32Array.from(M);
  reverb(L, R, { sr, rt60: 0.45, size: 0.45, damp: 5000, hp: 100, predelay: 0.006, mix: space });
  return finish(L, R, { sr, gain, pan, fadeIn: Math.min(0.12, 0.1 * D), fadeOut: Math.min(0.25, 0.15 * D) });
}

/**
 * glitch({ dur=0.6, intensity=1, pan=0 })
 * Digital glitch: a random timeline of stutters (repeated, optionally shrinking grains), bit-crushed /
 * sample-held sources, raw sample-and-hold noise, data bursts, blips and dropouts, ping-ponged in stereo.
 */
export function glitch(params = {}) {
  const { dur = 0.6, intensity = 1, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('glitch', seed);
  const n = nSamp(dur, sr), L = new Float32Array(n), R = new Float32Array(n);
  const it = clamp(intensity, 0, 2);
  const srcTone = (m) => { const f = rng.logRange(150, 2400), duty = rng.range(0.1, 0.5), a = new Float32Array(m); let p = rng.next(); for (let i = 0; i < m; i++) { p += f / sr; p -= Math.floor(p); a[i] = p < duty ? 1 : -1; } return a; };
  const srcFm = (m) => { const fc = rng.logRange(200, 3000), fm = fc * rng.pick([0.25, 0.5, 1.41, 2, 3.5]), I = rng.range(1, 8), a = new Float32Array(m); for (let i = 0; i < m; i++) { const t = i / sr; a[i] = Math.sin(TAU * fc * t + I * Math.sin(TAU * fm * t)); } return a; };
  const srcNoise = (m) => { const a = whiteNoise(m, rng); if (rng.chance(0.5)) filt(a, 'bp', rng.logRange(500, 8000), 2, 0, sr); const p = peakAbs(a) || 1; for (let i = 0; i < m; i++) a[i] /= p; return a; };
  const srcChirp = (m) => { const fa = rng.logRange(100, 4000), fb = rng.logRange(100, 4000), a = new Float32Array(m); let p = 0; for (let i = 0; i < m; i++) { p += (fa * Math.pow(fb / fa, i / m)) / sr; a[i] = fsin(p); } return a; };
  const srcData = (m) => { const per = Math.max(2, Math.round(sr / rng.logRange(800, 6000))), a = new Float32Array(m); let v = 1; for (let i = 0; i < m; i++) { if (i % per === 0) v = rng.chance(0.5) ? 1 : -1; a[i] = v; } return a; };
  const sources = [srcTone, srcFm, srcNoise, srcChirp, srcData];
  const kinds = ['stutter', 'stutter', 'stutter', 'crush', 'crush', 'sh', 'data', 'gap', 'blip'];
  let i = 0;
  while (i < n) {
    const kind = rng.pick(kinds);
    const len = Math.min(n - i, Math.max(16, Math.round(rng.logRange(0.012, 0.09) * sr)));
    let seg;
    if (kind === 'stutter') {
      const g = Math.max(24, Math.round(rng.logRange(0.004, 0.03) * sr)), grain = rng.pick(sources)(g);
      const shrink = rng.chance(0.5) ? rng.range(0.65, 0.9) : 1;
      seg = new Float32Array(len);
      let pos = 0, gl = g, rep = 0;
      while (pos < len && gl >= 12) {
        const ga = Math.pow(0.9, rep++);
        for (let q = 0; q < gl && pos < len; q++) seg[pos++] = grain[q] * ga;
        gl = Math.round(gl * shrink);
      }
    } else if (kind === 'crush') {
      seg = rng.pick(sources)(len);
      const lv = 2 ** (1 + rng.int(4)), hold = 1 + rng.int(16);
      let hv = 0;
      for (let q = 0; q < len; q++) { if (q % hold === 0) hv = Math.round(seg[q] * lv) / lv; seg[q] = hv; }
    } else if (kind === 'sh') {
      seg = new Float32Array(len);
      const per = Math.max(2, Math.round(sr / rng.logRange(200, 4000)));
      let hv = 0;
      for (let q = 0; q < len; q++) { if (q % per === 0) hv = rng.bi(); seg[q] = hv; }
    } else if (kind === 'data') seg = srcData(len);
    else if (kind === 'blip') {
      seg = new Float32Array(len);
      const f = rng.logRange(800, 4500);
      for (let q = 0; q < len; q++) seg[q] = fsin((f * q) / sr);
    } else seg = new Float32Array(len); // gap / dropout
    addMono(L, R, seg, i, rng.range(0.45, 1) * it, clamp(rng.bi() * 0.9, -1, 1));
    i += len;
  }
  filt(L, 'lp', 15000, 0.7, 0, sr); filt(R, 'lp', 15000, 0.7, 0, sr);
  return finish(L, R, { sr, gain, pan, fadeIn: 0.001, fadeOut: 0.01 });
}

/**
 * blip({ freq=1200, count=1, interval=0.12, type='sine'|'square', len=0.06, pattern='same'|'up'|'down'|'random', space=0.08, pan=0 })
 * Data blips / computer beeps: raised-cosine gated tones (polyBLEP square through a small-speaker band-pass).
 */
export function blip(params = {}) {
  const { freq = 1200, count = 1, interval = 0.12, type = 'sine', len = 0.06, pattern = 'same', space = 0.08,
    sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('blip', seed);
  const cnt = Math.max(1, Math.round(count)), bl = clamp(len, 0.005, 5), ivl = Math.max(0.005, interval);
  const D = 0.002 + (cnt - 1) * ivl + bl + 0.2;
  const n = nSamp(D, sr), L = new Float32Array(n), R = new Float32Array(n);
  const ratios = [0.5, 2 / 3, 3 / 4, 1, 5 / 4, 4 / 3, 3 / 2, 2];
  for (let k = 0; k < cnt; k++) {
    let f = freq;
    if (pattern === 'up') f = freq * Math.pow(2, (2 * k) / 12);
    else if (pattern === 'down') f = freq * Math.pow(2, (-2 * k) / 12);
    else if (pattern === 'random') f = freq * rng.pick(ratios);
    f = clamp(f, 20, sr * 0.45);
    const m = nSamp(bl, sr), a = Math.max(1, Math.round(0.0015 * sr)), r = Math.max(1, Math.round(Math.min(0.012, bl * 0.3) * sr));
    const buf = new Float32Array(m), dt = f / sr;
    let ph = 0;
    for (let i = 0; i < m; i++) {
      ph += dt; if (ph >= 1) ph -= 1;
      const v = type === 'square' ? 0.55 * ((ph < 0.5 ? 1 : -1) + polyBlep(ph, dt) - polyBlep((ph + 0.5) % 1, dt)) : fsin(ph);
      const e = i < a ? 0.5 - 0.5 * Math.cos((Math.PI * i) / a) : i > m - r ? 0.5 - 0.5 * Math.cos((Math.PI * (m - i)) / r) : 1;
      buf[i] = v * e;
    }
    if (type === 'square') { filt(buf, 'lp', Math.min(7000, sr * 0.4), 0.7, 0, sr); filt(buf, 'lp', Math.min(9000, sr * 0.4), 0.6, 0, sr); filt(buf, 'hp', 200, 0.7, 0, sr); }
    addMono(L, R, buf, Math.round((0.002 + k * ivl) * sr), 1, 0);
  }
  reverb(L, R, { sr, rt60: 0.3, size: 0.35, damp: 7000, hp: 200, predelay: 0.004, mix: space });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.001, fadeOut: 0.03 });
}

// ---------------------------------------------------------------------------------------- keys
function keystroke(L, R, t0, style, variant, rng, sr, amp = 1, pan = 0) {
  const S = (t) => Math.round(t * sr);
  if (style === 'typewriter') {
    // key lever travel
    burst(L, R, S(t0), { sr, rng, color: 'pink', len: 0.006, att: 0.0003, tau: 0.0012, lp: 2500, amp: 0.3 * amp, pan });
    modes(L, R, S(t0), [{ f: 330, a: 0.12, tau: 0.012 }, { f: 950, a: 0.1, tau: 0.008 }], { sr, amp, pan });
    if (variant === 'space' || variant === 'enter') { // no type-bar: carriage escapement clunk
      const ts = t0 + rng.range(0.015, 0.025);
      burst(L, R, S(ts), { sr, rng, color: 'pink', len: 0.02, att: 0.0002, tau: 0.003, lp: 1800, amp: 0.5 * amp, pan });
      modes(L, R, S(ts), [{ f: 180, a: 0.3, tau: 0.03 }, { f: 520, a: 0.2, tau: 0.02 }, { f: 2300, a: 0.12, tau: 0.008 }], { sr, amp, pan, att: 0.0004 });
      burst(L, R, S(ts + 0.03), { sr, rng, len: 0.003, att: 0.00002, tau: 0.0003, hp: 2200, amp: 0.3 * amp, pan });
      return;
    }
    // type-bar strike through ribbon onto the platen
    const ts = t0 + rng.range(0.022, 0.034), pz = rng.range(0.96, 1.04);
    burst(L, R, S(ts), { sr, rng, len: 0.006, att: 0.00002, tau: 0.0005, hp: 900, amp: 1.0 * amp, pan });
    modes(L, R, S(ts), [{ f: 1650 * pz, a: 0.45, tau: 0.022 }, { f: 2870 * pz, a: 0.38, tau: 0.016 }, { f: 4130 * pz, a: 0.3, tau: 0.011 }, { f: 5590 * pz, a: 0.2, tau: 0.007 }, { f: 7350 * pz, a: 0.12, tau: 0.005 }], { sr, amp, pan });
    burst(L, R, S(ts), { sr, rng, color: 'pink', len: 0.03, att: 0.0003, tau: 0.003, lp: 900, amp: 0.8 * amp, pan });
    modes(L, R, S(ts), [{ f: 235 * pz, a: 0.35, tau: 0.03 }, { f: 610, a: 0.2, tau: 0.018 }], { sr, amp, pan, att: 0.0005 });
    // carriage escapement advance + type-bar return
    const te = ts + rng.range(0.03, 0.045);
    burst(L, R, S(te), { sr, rng, len: 0.003, att: 0.00002, tau: 0.0003, hp: 2200, amp: 0.3 * amp, pan: pan + 0.1 });
    modes(L, R, S(te), [{ f: 2450, a: 0.1, tau: 0.006 }, { f: 3750, a: 0.08, tau: 0.005 }], { sr, amp, pan: pan + 0.1 });
    burst(L, R, S(ts + rng.range(0.06, 0.09)), { sr, rng, len: 0.006, att: 0.0001, tau: 0.0006, bp: 1400, q: 1, amp: 0.15 * amp, pan });
    return;
  }
  // modern keyboard: switch click, bottom-out "thock" of plate/case, key release
  const big = variant === 'space' || variant === 'enter';
  const pz = (big ? 0.72 : 1) * rng.range(0.93, 1.07);
  burst(L, R, S(t0), { sr, rng, len: 0.003, att: 0.00003, tau: 0.00025, hp: 2500, amp: 0.35 * amp, pan });
  modes(L, R, S(t0), [{ f: 4200 * pz, a: 0.12, tau: 0.002 }, { f: 5600 * pz, a: 0.08, tau: 0.0015 }], { sr, amp, pan });
  const tb = t0 + rng.range(0.006, 0.011);
  burst(L, R, S(tb), { sr, rng, len: 0.006, att: 0.0001, tau: 0.0006, lp: 3500, amp: 0.8 * amp, pan });
  modes(L, R, S(tb), [{ f: 215 * pz, a: 0.25, tau: 0.02 }, { f: 480 * pz, a: 0.5, tau: 0.016 }, { f: 1250 * pz, a: 0.3, tau: 0.008 }, { f: 2600 * pz, a: 0.18, tau: 0.004 }], { sr, amp, pan, att: 0.0002 });
  if (big) { // stabiliser wire rattle
    const tr = tb + rng.range(0.003, 0.006);
    burst(L, R, S(tr), { sr, rng, len: 0.006, att: 0.00003, tau: 0.0005, bp: 3000, q: 1.2, amp: 0.35 * amp, pan: pan + 0.15 });
    modes(L, R, S(tr), [{ f: 3400, a: 0.1, tau: 0.005 }, { f: 1800, a: 0.12, tau: 0.007 }], { sr, amp, pan: pan + 0.15 });
  }
  const tu = t0 + rng.range(0.07, 0.13) * (big ? 1.3 : 1);
  burst(L, R, S(tu), { sr, rng, len: 0.003, att: 0.00003, tau: 0.0003, hp: 1800, amp: 0.25 * amp, pan });
  modes(L, R, S(tu), [{ f: 700 * pz, a: 0.12, tau: 0.008 }, { f: 1900 * pz, a: 0.1, tau: 0.005 }], { sr, amp: 0.6 * amp, pan });
}

function typewriterBell(L, R, t0, rng, sr, amp = 1, pan = 0.3) {
  const f = 2520, s = Math.round(t0 * sr);
  burst(L, R, s, { sr, rng, len: 0.003, att: 0.00002, tau: 0.0003, hp: 3000, amp: 0.3 * amp, pan });
  modes(L, R, s, [{ f, a: 0.5, tau: 0.7 }, { f: f * 1.003, a: 0.3, tau: 0.6 }, { f: f * 2.01, a: 0.12, tau: 0.3 }, { f: f * 2.76, a: 0.18, tau: 0.25 }, { f: f * 0.5, a: 0.05, tau: 0.4 }, { f: f * 5.4, a: 0.05, tau: 0.08 }], { sr, amp, pan });
}

// Carriage return: lever throw, carriage sliding over the escapement rack (decelerating ratchet + friction),
// slam against the margin stop. Returns the time the slam rings out.
function carriageReturn(L, R, t0, rng, sr, amp = 1, pan = -0.2) {
  const S = (t) => Math.round(t * sr), slide = 0.3, ts = t0 + 0.03 + slide;
  burst(L, R, S(t0), { sr, rng, color: 'pink', len: 0.03, att: 0.001, tau: 0.004, lp: 1500, amp: 0.4 * amp, pan });
  for (let tt = t0 + 0.03; tt < ts - 0.01;) {
    const x = (tt - t0 - 0.03) / slide;
    burst(L, R, S(tt), { sr, rng, len: 0.002, att: 0.00001, tau: 0.00015, hp: 2800, amp: 0.18 * amp * rng.range(0.7, 1), pan: pan + 0.4 * x });
    tt += 0.009 + 0.01 * x;
  }
  burst(L, R, S(t0 + 0.03), { sr, rng, color: 'pink', len: slide, att: 0.05, tau: 0.12, bp: 1800, q: 0.8, amp: 0.12 * amp, pan });
  burst(L, R, S(ts), { sr, rng, len: 0.012, att: 0.00003, tau: 0.001, lp: 4000, amp: 0.9 * amp, pan: pan + 0.4 });
  modes(L, R, S(ts), [{ f: 160, a: 0.35, tau: 0.04 }, { f: 430, a: 0.3, tau: 0.025 }, { f: 1240, a: 0.2, tau: 0.012 }, { f: 2650, a: 0.12, tau: 0.008 }, { f: 3900, a: 0.06, tau: 0.05 }], { sr, amp, pan: pan + 0.4, att: 0.0002 });
  return ts + 0.15;
}

/**
 * typing({ dur=3, cps=8, style='modern'|'typewriter', bell=false, space, pan=0 })
 * Typing burst with human timing (log-normal inter-key intervals, word groups, spacebar, pauses). Each key =
 * click transient + resonant thock + bottom-out (+ release); typewriter = lever, type-bar strike on the
 * platen, carriage escapement; bell=true (typewriter only) rings the margin bell ~1 s before the end of the
 * line while typing continues, then throws the carriage return (needs dur >= ~1.5 s).
 */
export function typing(params = {}) {
  const { dur = 3, cps = 8, style = 'modern', bell = false, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('typing:' + style, seed);
  const n = nSamp(dur, sr), D = n / sr, L = new Float32Array(n), R = new Float32Array(n);
  const ivl = 1 / clamp(cps, 0.5, 30), tw = style === 'typewriter', ret = tw && bell && D >= 1.5;
  const retT = ret ? D - 0.62 : Infinity;
  const endT = Math.min(D - (tw ? 0.2 : 0.18), retT - 0.12), bellT = ret ? Math.max(0.05, endT - 1.0) : Infinity;
  let bellDone = false, t = 0.02;
  while (t < endT) {
    const wl = 2 + rng.int(7);
    for (let c = 0; c < wl && t < endT; c++) {
      keystroke(L, R, t, style, 'key', rng, sr, rng.range(0.7, 1), rng.bi() * 0.25);
      if (!bellDone && t >= bellT) { typewriterBell(L, R, t + 0.03, rng, sr, 0.8); bellDone = true; }
      t += ivl * Math.exp(0.35 * rng.gauss()) * (c === 0 ? 1.15 : 0.95);
    }
    if (t >= endT) break;
    keystroke(L, R, t, style, 'space', rng, sr, rng.range(0.8, 1), 0.05);
    t += ivl * rng.range(1.2, 2.2);
    if (rng.chance(0.06)) t += rng.range(0.25, 0.6);
  }
  if (ret) {
    if (!bellDone) typewriterBell(L, R, Math.max(0.02, retT - 0.5), rng, sr, 0.8);
    carriageReturn(L, R, retT, rng, sr, 1, -0.2);
  }
  reverb(L, R, { sr, rt60: tw ? 0.55 : 0.35, size: tw ? 0.6 : 0.4, damp: tw ? 5000 : 7000, hp: 150, predelay: 0.005, mix: params.space ?? (tw ? 0.16 : 0.1) });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.003, fadeOut: 0.06 });
}

/**
 * keyClick({ style='modern'|'typewriter', variant='key'|'space'|'enter'|'bell'|'return', space, pan=0 })
 * A single keystroke; typewriter extras: variant 'bell' (margin bell) and 'return' (carriage return).
 */
export function keyClick(params = {}) {
  const { style = 'modern', variant = 'key', sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('keyClick:' + style, seed);
  const tw = style === 'typewriter', isBell = variant === 'bell', isRet = tw && variant === 'return';
  const D = isBell ? 2.2 : isRet ? 0.8 : tw ? 0.4 : 0.3;
  const n = nSamp(D, sr), L = new Float32Array(n), R = new Float32Array(n);
  if (isBell) typewriterBell(L, R, 0.003, rng, sr, 1, 0);
  else if (isRet) carriageReturn(L, R, 0.003, rng, sr, 1, 0);
  else keystroke(L, R, 0.003, style, variant === 'return' ? 'enter' : variant, rng, sr, 1, 0);
  reverb(L, R, { sr, rt60: tw ? 0.55 : 0.35, size: tw ? 0.6 : 0.4, damp: tw ? 5000 : 7000, hp: 150, predelay: 0.005, mix: params.space ?? (tw ? 0.16 : 0.1) });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.002, fadeOut: isBell ? 0.3 : 0.04 });
}

// ---------------------------------------------------------------------------------------- steps
/**
 * footstep({ surface='dirt'|'stone'|'wood', weight=1, steps=1, interval=0.55, space, pan=0 })
 * Heel strike + toe roll per step; every contact has a soft low body-weight thud, plus surface texture:
 * dirt = granular crunch + scuff, stone = hard click + short sole/stone modes + grit (reverberant hall),
 * wood = hollow board modes (room). steps>1 renders a walk with alternating feet.
 */
export function footstep(params = {}) {
  const { surface = 'dirt', weight = 1, steps = 1, interval = 0.55, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('footstep:' + surface, seed);
  const w = clamp(weight, 0.2, 4), ns = Math.max(1, Math.round(steps)), ivl = Math.max(0.1, interval);
  const tail = surface === 'stone' ? 1.0 : surface === 'wood' ? 0.6 : 0.35;
  const D = 0.01 + (ns - 1) * ivl + 0.3 + tail;
  const n = nSamp(D, sr), L = new Float32Array(n), R = new Float32Array(n);
  const S = (t) => Math.round(t * sr);
  const grit = (s, count, spread, amp, fc, p, lp) => { // granular crunch: many tiny grain impacts, band-limited
    const g = new Float32Array(nSamp(spread + 0.03, sr));
    for (let j = 0; j < count; j++) {
      const tt = Math.pow(rng.next(), 1.7) * spread, gi = Math.round(tt * sr), gl = 6 + rng.int(Math.round(0.0006 * sr));
      const ga = Math.exp(-tt / (spread * 0.45)) * rng.range(0.15, 1);
      for (let q = 0; q < gl && gi + q < g.length; q++) g[gi + q] += ga * rng.bi() * Math.exp((-q * 3) / gl);
    }
    filt(g, 'bp', fc, 0.55, 0, sr); filt(g, 'hp', 600, 0.7, 0, sr); filt(g, 'lp', lp, 0.7, 0, sr); filt(g, 'lp', lp * 1.3, 0.6, 0, sr);
    const pk = peakAbs(g);
    if (pk > 0) addMono(L, R, g, s, amp / pk, p);
  };
  const contact = (t, amp, heel, p) => {
    const s = S(t);
    burst(L, R, s, { sr, rng, color: 'brown', len: 0.12, att: 0.002, tau: 0.014 * Math.sqrt(w), lp: 240 / Math.pow(w, 0.3), amp: 0.7 * amp * Math.pow(w, 0.5), pan: p });
    if (surface === 'stone') {
      burst(L, R, s, { sr, rng, len: 0.005, att: 0.00002, tau: heel ? 0.0004 : 0.0003, hp: 1600, amp: (heel ? 0.9 : 0.5) * amp, pan: p });
      const pz = rng.range(0.93, 1.07);
      modes(L, R, s, [{ f: 1720 * pz, a: 0.2, tau: 0.009 }, { f: 2630 * pz, a: 0.16, tau: 0.007 }, { f: 3900 * pz, a: 0.11, tau: 0.005 }, { f: 5350 * pz, a: 0.07, tau: 0.003 }, { f: 820 * pz, a: 0.1, tau: 0.01 }], { sr, amp, pan: p });
      grit(s, 10, 0.03, 0.25 * amp, 2500, p, 9000);
    } else if (surface === 'wood') {
      burst(L, R, s, { sr, rng, len: 0.005, att: 0.00003, tau: 0.0005, hp: 1200, amp: 0.55 * amp, pan: p });
      const pz = rng.range(0.95, 1.05) / Math.pow(w, 0.12);
      modes(L, R, s, [{ f: 118 * pz, a: 0.5, tau: 0.075 }, { f: 247 * pz, a: 0.38, tau: 0.05 }, { f: 455 * pz, a: 0.28, tau: 0.032 }, { f: 880 * pz, a: 0.16, tau: 0.016 }, { f: 1590 * pz, a: 0.08, tau: 0.009 }], { sr, amp: amp * Math.pow(w, 0.3), pan: p, att: 0.0012 });
    } else {
      grit(s, heel ? 55 : 35, 0.11, 1.0 * amp, 1800, p, 5500);
      burst(L, R, s + S(0.004), { sr, rng, color: 'pink', len: 0.09, att: 0.008, tau: 0.02, bp: 1300, q: 0.7, amp: 0.25 * amp, pan: p });
    }
  };
  for (let k = 0; k < ns; k++) {
    const t0 = 0.008 + k * ivl + (k > 0 ? rng.bi() * 0.02 * ivl : 0);
    const side = ns > 1 ? (k % 2 ? 0.1 : -0.1) : 0, a = rng.range(0.85, 1);
    contact(t0, a, true, side);
    contact(t0 + rng.range(0.05, 0.085) * Math.pow(w, 0.25), a * rng.range(0.45, 0.65), false, side);
  }
  const rv = surface === 'stone' ? [1.3, 1.1, 5000, 0.22] : surface === 'wood' ? [0.55, 0.6, 4000, 0.12] : [0.35, 0.5, 3500, 0.05];
  reverb(L, R, { sr, rt60: rv[0], size: rv[1], damp: rv[2], hp: 120, predelay: 0.008, mix: params.space ?? rv[3] });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.002, fadeOut: Math.min(0.2, D * 0.2), level: Math.min(1, 0.55 + 0.45 * w) });
}

/**
 * thud({ size=1, debris=1, space=0.3, pan=0 })
 * Giant (dinosaur) footfall: soft-attack fleshy impact, saturated sub drop (~50->30 Hz / size^0.25),
 * brown-noise ground rumble, kicked-up dirt and pebble pings, large dark outdoor space.
 */
export function thud(params = {}) {
  const { size = 1, debris = 1, space = 0.3, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const rng = makeRng('thud', seed);
  const sz = clamp(size, 0.2, 5), rs = Math.sqrt(sz), dbr = clamp(debris, 0, 3);
  const D = 0.5 + 2.3 * Math.pow(sz, 0.4);
  const n = nSamp(D, sr), L = new Float32Array(n), R = new Float32Array(n);
  const on = Math.min(n - 1, Math.round(0.003 * sr)), m = n - on;
  const fA = 50 / Math.pow(sz, 0.25), fB = 30 / Math.pow(sz, 0.25), tauA = 0.32 * rs, st = Math.tanh(1.7);
  let ph = 0;
  for (let i = 0; i < m; i++) {
    const t = i / sr;
    const att = t < 0.012 ? Math.sin((HALF_PI * t) / 0.012) ** 2 : 1;
    ph += (fB + (fA - fB) * Math.exp(-t / 0.1)) / sr;
    const v = Math.tanh(1.7 * fsin(ph) * att * Math.exp(-Math.max(0, t - 0.02) / tauA)) / st;
    L[on + i] += v; R[on + i] += v;
  }
  burst(L, R, on, { sr, rng, color: 'pink', len: 0.5 * rs, att: 0.006, tau: 0.06 * rs, lp: 380 / Math.pow(sz, 0.3), amp: 0.75, pan: -0.15 });
  burst(L, R, on, { sr, rng, color: 'pink', len: 0.5 * rs, att: 0.007, tau: 0.06 * rs, lp: 400 / Math.pow(sz, 0.3), amp: 0.75, pan: 0.15 });
  const rc = brownNoise(m, rng, 15, sr), rl = brownNoise(m, rng, 15, sr), rr = brownNoise(m, rng, 15, sr);
  const gL = new Float32Array(m), gR = new Float32Array(m);
  for (let i = 0; i < m; i++) { gL[i] = 0.8 * rc[i] + 0.6 * rl[i]; gR[i] = 0.8 * rc[i] + 0.6 * rr[i]; }
  for (const a of [gL, gR]) { filt(a, 'lp', 90, 0.7, 0, sr); filt(a, 'lp', 120, 0.6, 0, sr); filt(a, 'hp', 22, 0.7, 0, sr); }
  const kg = 0.15 / (rms2(gL, gR) || 1), am = smoothNoise(m, 2.5, rng, sr);
  for (let i = 0; i < m; i++) {
    const t = i / sr, e = kg * (1 - Math.exp(-t / 0.05)) * Math.exp(-t / (0.7 * rs)) * (1 + 0.3 * am[i]);
    L[on + i] += e * gL[i]; R[on + i] += e * gR[i];
  }
  let t = 0.02;
  const tEnd = Math.min(D - 0.3, 1.4 * rs);
  for (;;) {
    t += rng.exp(1 / (dbr * 70 * Math.exp(-t / (0.25 * rs)) + 2));
    if (t > tEnd || dbr <= 0) break;
    const a = 0.08 * Math.exp(-t / (0.35 * rs)) * rng.range(0.3, 1) * Math.min(1.5, dbr), s = on + Math.round(t * sr), p = rng.bi() * 0.9;
    if (rng.chance(0.8)) burst(L, R, s, { sr, rng, len: 0.004, att: 0.00002, tau: 0.0005, bp: rng.logRange(1000, 4500), q: 1.2, amp: a, pan: p });
    else { const f = rng.logRange(1800, 4200); modes(L, R, s, [{ f, a: a * 0.5, tau: 0.006 }, { f: f * 1.6, a: a * 0.3, tau: 0.004 }], { sr, pan: p }); }
  }
  reverb(L, R, { sr, rt60: 1.6 * Math.pow(sz, 0.3), size: 2.0, damp: 1800, hp: 60, lp: 8000, predelay: 0.02, mix: space });
  saturate(L, R, 1.3);
  return finish(L, R, { sr, gain, pan, fadeIn: 0.003, fadeOut: Math.min(0.5, 0.15 * D), level: Math.min(1, 0.6 + 0.4 * sz) });
}

// ---------------------------------------------------------------------------------------- shutter
/**
 * shutter({ type='camera'|'projector', dur (0.6 camera / 4 projector), exposure=1/60, wind=true, fps=24, pan=0 })
 * camera: SLR mirror slap, first/second curtain clicks `exposure` apart, mirror return, optional motor winder.
 * projector: spin-up then continuous intermittent-claw clatter at `fps` (engage + release per frame), motor
 * harmonics with gear whine, fan noise with blade-pass modulation and 3-blade shutter air chop.
 */
export function shutter(params = {}) {
  const { type = 'camera', exposure = 1 / 60, wind: winder = true, fps = 24, sampleRate: sr = SR, seed = 1, gain = 0, pan = 0 } = params;
  const dur = params.dur ?? (type === 'projector' ? 4 : 0.6);
  const rng = makeRng('shutter:' + type, seed);
  const n = nSamp(dur, sr), D = n / sr, L = new Float32Array(n), R = new Float32Array(n);
  const S = (t) => Math.round(t * sr);
  if (type === 'projector') {
    const spin = Math.min(0.9, 0.3 * D), fp = clamp(fps, 4, 60), fm0 = 30;
    const TS = 2048, mt = new Float64Array(TS + 1);
    for (let k = 1; k <= 40; k++) {
      const a = (k === 24 ? 0.6 : k === 1 ? 0.5 : k === 2 ? 0.8 : 1 / Math.pow(k, 0.8)) * (k === 24 ? 1 : rng.range(0.3, 1)), p = rng.next() * TAU;
      for (let j = 0; j <= TS; j++) mt[j] += a * Math.sin((TAU * k * j) / TS + p);
    }
    const pm = peakAbs(mt) || 1;
    const motor = new Float32Array(n), fan = new Float32Array(n), blade = new Float32Array(n);
    const pk = pinkNoise(n, rng), wk = whiteNoise(n, rng);
    const fanBP = new SVF(sr).set(900, 0.6), bladeHP = new Biquad('hp', 1800, 0.7, 0, sr);
    const pull = (t, sp) => { // claw engages the perforation and yanks the frame down; gate/sprocket thunk
      const a = (0.2 + 0.8 * sp) * rng.range(0.85, 1.15), pz = 1 + 0.03 * rng.bi(), s = S(t + rng.bi() * 0.0002);
      burst(L, R, s, { sr, rng, len: 0.006, att: 0.00003, tau: 0.0006, bp: 2600, q: 0.8, amp: 0.7 * a, pan: 0.05 });
      burst(L, R, s, { sr, rng, color: 'pink', len: 0.02, att: 0.0003, tau: 0.003, lp: 900, amp: 0.35 * a, pan: 0.05 });
      modes(L, R, s, [{ f: 940 * pz, a: 0.25, tau: 0.012 }, { f: 1780 * pz, a: 0.2, tau: 0.008 }, { f: 3150 * pz, a: 0.12, tau: 0.005 }, { f: 420 * pz, a: 0.15, tau: 0.015 }], { sr, amp: a, pan: 0.05 });
    };
    const release = (t, sp) => { // claw withdraws
      const a = (0.2 + 0.8 * sp) * rng.range(0.8, 1.2), s = S(t + rng.bi() * 0.0002);
      burst(L, R, s, { sr, rng, len: 0.004, att: 0.00002, tau: 0.0004, bp: 2000, q: 0.9, amp: 0.35 * a, pan: -0.05 });
      modes(L, R, s, [{ f: 1250 * (1 + 0.03 * rng.bi()), a: 0.14, tau: 0.007 }, { f: 2600, a: 0.08, tau: 0.004 }], { sr, amp: a, pan: -0.05 });
    };
    let fph = 0, mph = 0, bph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, sp = smoothstep(t / spin);
      mph += (fm0 * sp) / sr; if (mph >= 1) mph -= 1;
      const x = mph * TS, j = x | 0;
      motor[i] = ((mt[j] + (mt[j + 1] - mt[j]) * (x - j)) / pm) * sp;
      fanBP.tick(pk[i]);
      bph += (5 * fm0 * sp) / sr; bph -= Math.floor(bph);
      fan[i] = fanBP.k * fanBP.bp * sp * (1 + 0.25 * fsin(bph));
      blade[i] = bladeHP.tick(wk[i]) * Math.pow(0.5 + 0.5 * Math.cos(TAU * 3 * fph), 3) * sp;
      const prev = fph;
      fph += (fp * sp) / sr;
      if (Math.floor(fph) > Math.floor(prev)) pull(t, sp);
      if (Math.floor(fph - 0.42) > Math.floor(prev - 0.42)) release(t, sp);
    }
    filt(motor, 'hp', 60, 0.7, 0, sr); filt(motor, 'lp', 1500, 0.7, 0, sr);
    filt(fan, 'lp', 4000, 0.7, 0, sr);
    filt(blade, 'lp', 7000, 0.7, 0, sr);
    const km = 0.07 / (rmsOf(motor) || 1), kf = 0.025 / (rmsOf(fan) || 1), kbl = 0.012 / (rmsOf(blade) || 1);
    const ref = Math.max(0.3, peak2(L, R));
    for (let i = 0; i < n; i++) {
      const v = ref * (motor[i] * km + fan[i] * kf);
      L[i] += v + ref * blade[i] * kbl * 0.7; R[i] += v * 0.9 + ref * blade[i] * kbl;
    }
    reverb(L, R, { sr, rt60: 0.5, size: 0.55, damp: 5000, hp: 120, predelay: 0.006, mix: params.space ?? 0.12 });
    return finish(L, R, { sr, gain, pan, fadeIn: 0.02, fadeOut: Math.min(0.3, 0.1 * D) });
  }
  // camera
  const t0 = 0.004;
  burst(L, R, S(t0), { sr, rng, color: 'pink', len: 0.012, att: 0.0002, tau: 0.0015, lp: 3000, amp: 0.6 });
  modes(L, R, S(t0), [{ f: 520, a: 0.3, tau: 0.012 }, { f: 1340, a: 0.22, tau: 0.008 }, { f: 2750, a: 0.14, tau: 0.005 }], { sr, att: 0.0003 });
  const t1 = t0 + 0.009;
  burst(L, R, S(t1), { sr, rng, len: 0.004, att: 0.00002, tau: 0.0003, hp: 2500, amp: 0.8 });
  modes(L, R, S(t1), [{ f: 3250, a: 0.18, tau: 0.004 }, { f: 4700, a: 0.12, tau: 0.003 }, { f: 6900, a: 0.08, tau: 0.002 }], { sr });
  const t2 = t1 + clamp(exposure, 0.0005, Math.max(0.001, D - 0.2));
  burst(L, R, S(t2), { sr, rng, len: 0.004, att: 0.00002, tau: 0.0003, hp: 2200, amp: 0.9 });
  modes(L, R, S(t2), [{ f: 3050, a: 0.18, tau: 0.004 }, { f: 4450, a: 0.12, tau: 0.003 }, { f: 2100, a: 0.1, tau: 0.006 }], { sr });
  const t3 = t2 + 0.012;
  burst(L, R, S(t3), { sr, rng, color: 'pink', len: 0.015, att: 0.0003, tau: 0.002, lp: 2500, amp: 0.55 });
  modes(L, R, S(t3), [{ f: 440, a: 0.3, tau: 0.014 }, { f: 1150, a: 0.2, tau: 0.009 }, { f: 2400, a: 0.12, tau: 0.006 }], { sr, att: 0.0003 });
  burst(L, R, S(t3 + 0.008), { sr, rng, len: 0.003, att: 0.00002, tau: 0.0003, hp: 2000, amp: 0.18 });
  const tw = t3 + 0.035, wl = 0.17;
  if (winder && tw + wl + 0.03 < D) {
    const m = nSamp(wl, sr), buf = new Float32Array(m), nz = whiteNoise(m, rng);
    filt(nz, 'bp', 2500, 1, 0, sr);
    let ph = 0;
    for (let i = 0; i < m; i++) {
      const x = i / m, f = 185 + 25 * Math.sin(Math.PI * x) - 30 * x * x, dt = f / sr;
      ph += dt; if (ph >= 1) ph -= 1;
      const e = Math.min(1, x / 0.05) * Math.min(1, (1 - x) / 0.1);
      buf[i] = (2 * ph - 1 - polyBlep(ph, dt) + 0.4 * nz[i]) * e;
    }
    filt(buf, 'bp', 1400, 0.8, 0, sr); filt(buf, 'lp', 5000, 0.7, 0, sr);
    addMono(L, R, buf, S(tw), 0.3 / (peakAbs(buf) || 1), 0);
    for (let tt = tw + 0.01; tt < tw + wl - 0.01; tt += 1 / 75) burst(L, R, S(tt), { sr, rng, len: 0.002, att: 0.00001, tau: 0.00015, hp: 3000, amp: 0.1 });
    burst(L, R, S(tw + wl), { sr, rng, len: 0.004, att: 0.00002, tau: 0.0004, hp: 1500, amp: 0.35 });
    modes(L, R, S(tw + wl), [{ f: 2900, a: 0.12, tau: 0.006 }, { f: 4300, a: 0.08, tau: 0.004 }, { f: 1200, a: 0.1, tau: 0.008 }], { sr });
  }
  reverb(L, R, { sr, rt60: 0.25, size: 0.3, damp: 7000, hp: 200, predelay: 0.003, mix: params.space ?? 0.06 });
  return finish(L, R, { sr, gain, pan, fadeIn: 0.002, fadeOut: Math.min(0.05, 0.1 * D) });
}

// ============================================================================================ registry
export const SFX = Object.freeze({
  whoosh, impact, rumble, explosion, riser, shimmer, heartbeat, tick, clank, bubble, crackle, wave, wind, hum,
  glitch, blip, typing, keyClick, footstep, thud, shutter,
});

export default SFX;
