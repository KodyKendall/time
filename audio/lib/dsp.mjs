// audio/lib/dsp.mjs — core DSP building blocks (pure JS, Float32/Float64 arrays).
//   dB helpers, RBJ biquads + EQ chains, FFT, FFT convolution, fractional delay, oversampling FIR,
//   fades, deterministic RNG, buffer utilities.

export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => (g > 0 ? 20 * Math.log10(g) : -Infinity);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------- RNG
export function mulberry32(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gaussian(rand) {
  // Box-Muller (one value)
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

// ---------------------------------------------------------------- buffers
export function stereo(n) { return [new Float32Array(n), new Float32Array(n)]; }
export function cloneChannels(ch) { return ch.map((c) => Float32Array.from(c)); }
export function toStereo(ch) {
  if (ch.length >= 2) return [ch[0], ch[1]];
  return [ch[0], Float32Array.from(ch[0])];
}
export function peakAbs(ch) {
  let p = 0;
  for (const c of ch) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > p) p = a; }
  return p;
}
export function rms(ch) {
  let s = 0, n = 0;
  for (const c of ch) { for (let i = 0; i < c.length; i++) s += c[i] * c[i]; n += c.length; }
  return n ? Math.sqrt(s / n) : 0;
}
export function scaleInPlace(ch, g) {
  for (const c of ch) for (let i = 0; i < c.length; i++) c[i] *= g;
  return ch;
}
export function addInto(dst, src, gain = 1, offset = 0) {
  for (let c = 0; c < dst.length; c++) {
    const d = dst[c], s = src[Math.min(c, src.length - 1)];
    const n = Math.min(s.length, d.length - offset);
    for (let i = Math.max(0, -offset); i < n; i++) d[i + offset] += s[i] * gain;
  }
  return dst;
}
export function fadeInOut(ch, sr, fadeIn = 0.002, fadeOut = 0.005) {
  const ni = Math.round(fadeIn * sr), no = Math.round(fadeOut * sr);
  for (const c of ch) {
    const n = c.length;
    for (let i = 0; i < ni && i < n; i++) c[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / ni);
    for (let i = 0; i < no && i < n; i++) c[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / no);
  }
  return ch;
}

// ---------------------------------------------------------------- biquads (RBJ Audio EQ Cookbook)
const TYPE_ALIASES = {
  lp: 'lowpass', lowpass: 'lowpass', hp: 'highpass', highpass: 'highpass', bp: 'bandpass', bandpass: 'bandpass',
  notch: 'notch', peak: 'peaking', peaking: 'peaking', bell: 'peaking', eq: 'peaking',
  ls: 'lowshelf', lowshelf: 'lowshelf', hs: 'highshelf', highshelf: 'highshelf', ap: 'allpass', allpass: 'allpass',
};

export function biquadCoeffs(type, freq, sr, { q, gain = 0, slope } = {}) {
  const t = TYPE_ALIASES[type];
  if (!t) throw new Error(`biquad: unknown type ${type}`);
  const f = clamp(freq, 1, sr * 0.49);
  const w0 = (2 * Math.PI * f) / sr;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const A = Math.pow(10, gain / 40);
  let Q = q ?? Math.SQRT1_2;
  let alpha = sw / (2 * Q);
  if ((t === 'lowshelf' || t === 'highshelf') && slope != null) {
    alpha = (sw / 2) * Math.sqrt((A + 1 / A) * (1 / slope - 1) + 2);
  }
  let b0, b1, b2, a0, a1, a2;
  switch (t) {
    case 'lowpass': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'highpass': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'bandpass': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'allpass': b0 = 1 - alpha; b1 = -2 * cw; b2 = 1 + alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'peaking': b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
    case 'lowshelf': {
      const s2 = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cw + s2); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - s2);
      a0 = A + 1 + (A - 1) * cw + s2; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - s2; break;
    }
    case 'highshelf': {
      const s2 = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cw + s2); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s2);
      a0 = A + 1 - (A - 1) * cw + s2; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s2; break;
    }
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

// Process one channel in place through one biquad (transposed direct form II, double precision state).
export function biquadProcess(x, c, state = { z1: 0, z2: 0 }) {
  const { b0, b1, b2, a1, a2 } = c;
  let z1 = state.z1, z2 = state.z2;
  const n = x.length;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const y = b0 * xi + z1;
    z1 = b1 * xi - a1 * y + z2;
    z2 = b2 * xi - a2 * y;
    x[i] = y;
    if ((i & 255) === 255) { if (Math.abs(z1) < 1e-30) z1 = 0; if (Math.abs(z2) < 1e-30) z2 = 0; }
  }
  state.z1 = z1; state.z2 = z2;
  return x;
}

// Butterworth Q values for cascaded 2nd-order sections of an even order filter.
function butterworthQs(order) {
  const qs = [];
  for (let k = 0; k < order / 2; k++) qs.push(1 / (2 * Math.cos((Math.PI * (2 * k + 1)) / (2 * order))));
  return qs;
}

// Expand an EQ band description into biquad coefficient list.
//   { type:'hp'|'lp', freq, order=2 (2,4,6,8 → 12..48 dB/oct), q }   (q only for order 2)
//   { type:'peak', freq, gain, q=1 } { type:'lowshelf'|'highshelf', freq, gain, q | slope } { type:'notch'|'bp', freq, q }
export function eqBandToBiquads(band, sr) {
  const t = TYPE_ALIASES[band.type];
  if ((t === 'highpass' || t === 'lowpass') && (band.order ?? 2) > 2) {
    return butterworthQs(band.order).map((q) => biquadCoeffs(t, band.freq, sr, { q }));
  }
  const q = band.q ?? (t === 'peaking' ? 1 : t === 'notch' ? 4 : t === 'bandpass' ? 1 : undefined);
  return [biquadCoeffs(t, band.freq, sr, { q, gain: band.gain ?? 0, slope: band.slope })];
}

// Apply an EQ chain (array of band objects) to channels in place.
export function applyEQ(channels, bands, sr) {
  if (!bands || !bands.length) return channels;
  const sections = bands.filter((b) => b && b.enabled !== false).flatMap((b) => eqBandToBiquads(b, sr));
  for (const ch of channels) for (const c of sections) biquadProcess(ch, c);
  return channels;
}

// Magnitude response (dB) of a biquad list at frequency f.
export function biquadResponseDb(sections, f, sr) {
  const w = (2 * Math.PI * f) / sr;
  let mag = 1;
  for (const { b0, b1, b2, a1, a2 } of sections) {
    const cr1 = Math.cos(w), ci1 = -Math.sin(w), cr2 = Math.cos(2 * w), ci2 = -Math.sin(2 * w);
    const nr = b0 + b1 * cr1 + b2 * cr2, ni = b1 * ci1 + b2 * ci2;
    const dr = 1 + a1 * cr1 + a2 * cr2, di = a1 * ci1 + a2 * ci2;
    mag *= Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
  }
  return 20 * Math.log10(mag);
}

// One-pole lowpass/highpass (smooth, for tone shaping and envelopes)
export function onePoleCoef(freq, sr) { return Math.exp((-2 * Math.PI * freq) / sr); }
export function onePoleLP(x, freq, sr) {
  const a = onePoleCoef(freq, sr); let y = 0;
  for (let i = 0; i < x.length; i++) { y = x[i] + a * (y - x[i]); x[i] = y; }
  return x;
}
export function dcBlock(x, freq = 5, sr = 48000) {
  const R = Math.exp((-2 * Math.PI * freq) / sr); let x1 = 0, y1 = 0;
  for (let i = 0; i < x.length; i++) { const y = x[i] - x1 + R * y1; x1 = x[i]; y1 = y; x[i] = y; }
  return x;
}

// ---------------------------------------------------------------- FFT (iterative radix-2, in place, Float64)
const fftCache = new Map();
function fftTables(n) {
  let t = fftCache.get(n);
  if (t) return t;
  const levels = Math.log2(n);
  if (!Number.isInteger(levels)) throw new Error('FFT size must be a power of 2');
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = Math.sin((2 * Math.PI * i) / n); }
  t = { rev, cos, sin };
  fftCache.set(n, t);
  return t;
}
export function fft(re, im, inverse = false) {
  const n = re.length;
  const { rev, cos, sin } = fftTables(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  const sgn = inverse ? 1 : -1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cos[k], wi = sgn * sin[k];
        const a = i + j, b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
  if (inverse) { const s = 1 / n; for (let i = 0; i < n; i++) { re[i] *= s; im[i] *= s; } }
}
export const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

// Spectra of two real signals packed into one complex FFT: returns {aRe,aIm,bRe,bIm} for bins 0..N/2
function unpackTwoReal(re, im) {
  const n = re.length, h = n / 2;
  const aRe = new Float64Array(h + 1), aIm = new Float64Array(h + 1), bRe = new Float64Array(h + 1), bIm = new Float64Array(h + 1);
  for (let k = 0; k <= h; k++) {
    const nk = (n - k) % n;
    const xr = re[k], xi = im[k], yr = re[nk], yi = -im[nk]; // conj(X[N-k])
    aRe[k] = 0.5 * (xr + yr); aIm[k] = 0.5 * (xi + yi);
    // (X - conj(X[N-k])) / (2i)  =  -i/2 * (X - conjX)
    const dr = xr - yr, di = xi - yi;
    bRe[k] = 0.5 * di; bIm[k] = -0.5 * dr;
  }
  return { aRe, aIm, bRe, bIm };
}

// ---------------------------------------------------------------- stereo-aware FFT convolution (overlap-add)
// irs: { ll, lr, rl, rr } Float32Arrays (true stereo) or { l, r } (mono-in → stereo-out, input = (L+R)/2)
// input: [L, R]. Returns [L, R] of length input + ir - 1 (or `outLength`).
export function convolveStereo(input, irs, { outLength, blockSize } = {}) {
  const [inL, inR] = input;
  const nIn = inL.length;
  const trueStereo = !!irs.ll;
  const irLen = trueStereo ? Math.max(irs.ll.length, irs.lr.length, irs.rl.length, irs.rr.length) : Math.max(irs.l.length, irs.r.length);
  const B = blockSize ?? Math.max(8192, nextPow2(irLen) / 2);
  const N = nextPow2(B + irLen - 1);
  const h = N / 2;
  const outLen = outLength ?? nIn + irLen - 1;
  const outL = new Float32Array(outLen), outR = new Float32Array(outLen);

  // IR spectra
  function spectraPair(a, b) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < a.length; i++) re[i] = a[i];
    for (let i = 0; i < b.length; i++) im[i] = b[i];
    fft(re, im);
    return unpackTwoReal(re, im);
  }
  let H;
  if (trueStereo) {
    const p1 = spectraPair(irs.ll, irs.lr); // L-in -> L-out, L-in -> R-out
    const p2 = spectraPair(irs.rl, irs.rr); // R-in -> L-out, R-in -> R-out
    H = { llR: p1.aRe, llI: p1.aIm, lrR: p1.bRe, lrI: p1.bIm, rlR: p2.aRe, rlI: p2.aIm, rrR: p2.bRe, rrI: p2.bIm };
  } else {
    const p = spectraPair(irs.l, irs.r);
    H = { lR: p.aRe, lI: p.aIm, rR: p.bRe, rI: p.bIm };
  }
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let start = 0; start < nIn; start += B) {
    const len = Math.min(B, nIn - start);
    re.fill(0); im.fill(0);
    let any = false;
    if (trueStereo) {
      for (let i = 0; i < len; i++) { re[i] = inL[start + i]; im[i] = inR[start + i]; if (!any && (re[i] !== 0 || im[i] !== 0)) any = true; }
    } else {
      for (let i = 0; i < len; i++) { re[i] = 0.5 * (inL[start + i] + inR[start + i]); if (!any && re[i] !== 0) any = true; }
    }
    if (!any) continue;
    fft(re, im);
    // Y_L + i*Y_R packed spectrum for bins 0..N-1 (Hermitian parts rebuilt)
    let X;
    if (trueStereo) X = unpackTwoReal(re, im);
    for (let k = 0; k <= h; k++) {
      let yLr, yLi, yRr, yRi;
      if (trueStereo) {
        const aR = X.aRe[k], aI = X.aIm[k], bR = X.bRe[k], bI = X.bIm[k];
        yLr = aR * H.llR[k] - aI * H.llI[k] + bR * H.rlR[k] - bI * H.rlI[k];
        yLi = aR * H.llI[k] + aI * H.llR[k] + bR * H.rlI[k] + bI * H.rlR[k];
        yRr = aR * H.lrR[k] - aI * H.lrI[k] + bR * H.rrR[k] - bI * H.rrI[k];
        yRi = aR * H.lrI[k] + aI * H.lrR[k] + bR * H.rrI[k] + bI * H.rrR[k];
      } else {
        // mono input spectrum from re/im (im was zero → Hermitian)
        const xr = re[k], xi = im[k];
        yLr = xr * H.lR[k] - xi * H.lI[k]; yLi = xr * H.lI[k] + xi * H.lR[k];
        yRr = xr * H.rR[k] - xi * H.rI[k]; yRi = xr * H.rI[k] + xi * H.rR[k];
      }
      // Z = YL + i*YR ; Z[N-k] = conj(YL) + i*conj(YR)
      const zr = yLr - yRi, zi = yLi + yRr;
      const zr2 = yLr + yRi, zi2 = -yLi + yRr;
      re[k] = zr; im[k] = zi;
      if (k > 0 && k < h) { re[N - k] = zr2; im[N - k] = zi2; }
    }
    fft(re, im, true);
    const lim = Math.min(N, outLen - start);
    for (let i = 0; i < lim; i++) { outL[start + i] += re[i]; outR[start + i] += im[i]; }
  }
  return [outL, outR];
}

// ---------------------------------------------------------------- windowed-sinc FIR design
function besselI0(x) {
  let s = 1, t = 1;
  for (let k = 1; k < 50; k++) { t *= (x / (2 * k)) ** 2; s += t; if (t < 1e-12 * s) break; }
  return s;
}
export function kaiserWindow(n, beta) {
  const w = new Float64Array(n), d = besselI0(beta);
  for (let i = 0; i < n; i++) { const r = (2 * i) / (n - 1) - 1; w[i] = besselI0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / d; }
  return w;
}
// lowpass FIR, cutoff as fraction of sample rate (0..0.5)
export function firLowpass(taps, cutoff, beta = 8) {
  const w = kaiserWindow(taps, beta), h = new Float64Array(taps), m = (taps - 1) / 2;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const x = i - m;
    h[i] = (x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x)) * w[i];
    sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  return h;
}

// Polyphase oversampling (default 4x, 16 taps/phase Kaiser-windowed sinc) for true-peak detection.
const tpCache = new Map();
function truePeakPhases(factor, tapsPerPhase) {
  const key = `${factor}:${tapsPerPhase}`;
  if (tpCache.has(key)) return tpCache.get(key);
  // odd-length linear-phase FIR centred on an integer upsampled index, so phase p sits exactly at +p/factor
  const taps = factor * tapsPerPhase + 1;
  const h = firLowpass(taps, (0.5 / factor) * 0.92, 8.5);
  const phases = [];
  for (let p = 0; p < factor; p++) {
    const ph = new Float64Array(tapsPerPhase + 1);
    for (let k = 0; k <= tapsPerPhase; k++) { const idx = k * factor + p; ph[k] = idx < taps ? h[idx] * factor : 0; }
    phases.push(ph);
  }
  tpCache.set(key, phases);
  return phases;
}

// Per-sample true-peak envelope: env[j] = max(|x[j]|, |interpolated values between j-1 and j+1|).
export function truePeakEnvelope(x, { factor = 4, tapsPerPhase = 16 } = {}) {
  const phases = truePeakPhases(factor, tapsPerPhase);
  const T = tapsPerPhase, half = T / 2, n = x.length, K = T + 1;
  const pad = new Float64Array(n + 3 * T);
  for (let i = 0; i < n; i++) pad[i + T] = x[i];
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.abs(x[i]);
  // Output of phase p at padded input index i corresponds to original time (i - T - half) + p/factor.
  for (let i = T; i < n + T + half; i++) {
    let m = 0;
    for (let p = 1; p < phases.length; p++) {
      const ph = phases[p];
      let acc = 0;
      for (let k = 0; k < K; k++) acc += ph[k] * pad[i - k];
      const a = acc < 0 ? -acc : acc;
      if (a > m) m = a;
    }
    const j = i - T - half; // phases 1..factor-1 lie strictly between original samples j and j+1
    if (j >= 0 && j < n && m > env[j]) env[j] = m;
    if (j + 1 < n && j + 1 >= 0 && m > env[j + 1]) env[j + 1] = m;
  }
  return env;
}

export function truePeak(channels, opts) {
  let m = 0;
  for (const c of channels) {
    const e = truePeakEnvelope(c, opts);
    for (let i = 0; i < e.length; i++) if (e[i] > m) m = e[i];
  }
  return m;
}

// ---------------------------------------------------------------- fractional delay line (cubic hermite)
export function hermite(xm1, x0, x1, x2, t) {
  const c = (x1 - xm1) * 0.5;
  const v = x0 - x1;
  const w = c + v;
  const a = w + v + (x2 - x0) * 0.5;
  const b = w + a;
  return ((a * t - b) * t + c) * t + x0;
}

// Resample by arbitrary ratio (rate > 1 = faster/higher). Cubic hermite; fine for SFX pitch/speed changes.
export function resampleHermite(x, rate) {
  if (rate === 1) return Float32Array.from(x);
  const n = Math.max(1, Math.floor((x.length - 1) / rate));
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i * rate, i0 = Math.floor(pos), t = pos - i0;
    y[i] = hermite(x[i0 - 1] ?? 0, x[i0] ?? 0, x[i0 + 1] ?? 0, x[i0 + 2] ?? 0, t);
  }
  return y;
}

// Sliding-window minimum over [i, i+w) (forward-looking) via monotonic deque.
export function slidingMinForward(x, w) {
  const n = x.length, out = new Float32Array(n);
  const dq = new Int32Array(n + 1);
  let head = 0, tail = 0;
  // process from the end: out[i] = min(x[i..i+w-1])
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && x[dq[tail - 1]] >= x[i]) tail--;
    dq[tail++] = i;
    while (dq[head] >= i + w) head++;
    out[i] = x[dq[head]];
  }
  return out;
}
// Moving average over the previous w samples (causal boxcar) — run on a Float64 accumulator.
export function movingAverage(x, w) {
  const n = x.length, out = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += x[i];
    if (i >= w) acc -= x[i - w];
    out[i] = acc / Math.min(w, i + 1);
  }
  return out;
}
