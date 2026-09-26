// audio/scripts/sfx-gallery.mjs — render + verify every procedural SFX generator (audio/lib/sfx.mjs).
//
// Renders each generator with default params plus a couple of variants to audio/build/sfx-gallery/<name>.wav
// (24-bit), prints duration / peak / RMS / DC / spectral centroid / sub-100 Hz energy / L-R correlation /
// CPU time, and asserts: deterministic (two renders bit-identical), finite, no clipping (peak <= 0.9),
// first/last sample == 0, |DC| < 1e-3, sampleRate override honoured, mixInto/silence behave.
// Spectrogram PNGs (ffmpeg showspectrumpic; `-log` variants with log frequency axis for bass-heavy sounds).
//
// usage: node audio/scripts/sfx-gallery.mjs [--no-png] [--waves] [--only=impact,thud-titan]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SFX, SR, mixInto, silence } from '../lib/sfx.mjs';
import { writeWav } from '../lib/wav.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../build/sfx-gallery');
const args = process.argv.slice(2);
const PNG = !args.includes('--no-png');
const WAVES = args.includes('--waves');
const ONLY = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);

// [file name, generator, params, { log: log-frequency spectrogram too }]
const CASES = [
  ['whoosh', 'whoosh', {}],
  ['whoosh-fall', 'whoosh', { dur: 2.2, from: 3500, to: 220, peak: 0.4, panFrom: 0.8, panTo: -0.8 }],
  ['impact', 'impact', {}, { log: true }],
  ['impact-deep', 'impact', { dur: 4.5, subHz: 38, drop: 1, tail: 1.8, noise: 0.5 }, { log: true }],
  ['rumble', 'rumble', {}, { log: true }],
  ['rumble-quake', 'rumble', { dur: 6, cutoff: 70, grit: 0.8 }, { log: true }],
  ['explosion', 'explosion', {}, { log: true }],
  ['explosion-distant', 'explosion', { dur: 5, distance: 0.7, debris: 0.5 }, { log: true }],
  ['riser', 'riser', {}],
  ['riser-deep-noisy', 'riser', { dur: 6, from: 60, to: 900, noise: 0.9 }],
  ['shimmer', 'shimmer', {}],
  ['shimmer-dense', 'shimmer', { dur: 4, root: 523.25, sparkle: 1 }],
  ['heartbeat', 'heartbeat', {}, { log: true }],
  ['heartbeat-fast', 'heartbeat', { bpm: 120, beats: 8 }, { log: true }],
  ['tick', 'tick', {}],
  ['tick-clock4', 'tick', { type: 'clock', count: 4, interval: 1 }],
  ['tick-watch', 'tick', { type: 'watch', count: 10, interval: 0.2 }],
  ['tick-ratchet', 'tick', { type: 'ratchet', count: 2, interval: 0.8 }],
  ['tick-metronome', 'tick', { type: 'metronome', count: 8, interval: 0.5, accent: 4 }],
  ['clank', 'clank', {}],
  ['clank-big', 'clank', { size: 2.5 }],
  ['bubble', 'bubble', {}],
  ['bubble-stream', 'bubble', { count: 40, dur: 4, ambience: 0.6 }],
  ['crackle', 'crackle', {}],
  ['crackle-dense', 'crackle', { dur: 5, density: 30 }],
  ['wave', 'wave', {}, { log: true }],
  ['wave-calm', 'wave', { dur: 14, period: 5, intensity: 0.6 }, { log: true }],
  ['wind', 'wind', {}],
  ['wind-storm', 'wind', { dur: 8, strength: 1, gustiness: 0.9 }],
  ['hum', 'hum', {}, { log: true }],
  ['hum-50hz-buzzy', 'hum', { freq: 50, buzz: 0.9 }, { log: true }],
  ['glitch', 'glitch', {}],
  ['glitch-long', 'glitch', { dur: 1.5, seed: 7 }],
  ['blip', 'blip', {}],
  ['blip-data', 'blip', { count: 10, interval: 0.07, pattern: 'random', type: 'square', freq: 1500, len: 0.04 }],
  ['typing', 'typing', {}],
  ['typing-typewriter', 'typing', { style: 'typewriter', dur: 5, cps: 6, bell: true }],
  ['keyClick', 'keyClick', {}],
  ['keyClick-typewriter', 'keyClick', { style: 'typewriter' }],
  ['footstep', 'footstep', {}],
  ['footstep-stone-walk', 'footstep', { surface: 'stone', steps: 4 }],
  ['footstep-wood-heavy', 'footstep', { surface: 'wood', steps: 2, weight: 1.4 }],
  ['thud', 'thud', {}, { log: true }],
  ['thud-titan', 'thud', { size: 2.5 }, { log: true }],
  ['shutter', 'shutter', {}],
  ['shutter-projector', 'shutter', { type: 'projector', dur: 5 }],
];

// ------------------------------------------------------------------ analysis
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) {
        const a = i + j, b = a + h;
        const vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi; re[a] += vr; im[a] += vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

function analyse([L, R], sr) {
  const n = L.length;
  let pk = 0, ss = 0, sL = 0, sR = 0, bad = 0, lr = 0, ll = 0, rr = 0;
  for (let i = 0; i < n; i++) {
    const a = L[i], b = R[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) { bad++; continue; }
    pk = Math.max(pk, Math.abs(a), Math.abs(b));
    ss += a * a + b * b; sL += a; sR += b; lr += a * b; ll += a * a; rr += b * b;
  }
  const N = 4096, hop = 2048, win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const re = new Float64Array(N), im = new Float64Array(N);
  let num = 0, den = 0, pLow = 0, pAll = 0;
  for (let s = 0; s + N <= Math.max(n, N); s += hop) {
    for (let i = 0; i < N; i++) { const j = s + i; re[i] = j < n ? 0.5 * (L[j] + R[j]) * win[i] : 0; im[i] = 0; }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k], mag = Math.sqrt(p), f = (k * sr) / N;
      num += f * mag; den += mag; pAll += p; if (f < 100) pLow += p;
    }
  }
  return {
    dur: n / sr,
    peakDb: 20 * Math.log10(pk || 1e-12),
    peak: pk,
    rmsDb: 10 * Math.log10(ss / (2 * n) || 1e-24),
    dc: Math.max(Math.abs(sL / n), Math.abs(sR / n)),
    centroid: den > 0 ? num / den : 0,
    lowPct: pAll > 0 ? (100 * pLow) / pAll : 0,
    corr: ll > 0 && rr > 0 ? lr / Math.sqrt(ll * rr) : 1,
    edge: Math.max(Math.abs(L[0]), Math.abs(R[0]), Math.abs(L[n - 1]), Math.abs(R[n - 1])),
    bad,
  };
}

function identical(a, b) {
  if (a.length !== b.length) return false;
  for (let c = 0; c < a.length; c++) {
    const x = a[c], y = b[c];
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) return false;
  }
  return true;
}

function ffmpeg(argv) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-v', 'error', ...argv], { windowsHide: true });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.toString()}`);
}

// ------------------------------------------------------------------ run
fs.mkdirSync(OUT, { recursive: true });
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };
const rows = [];

for (const [name, gen, params, opt = {}] of CASES) {
  if (ONLY.length && !ONLY.includes(name) && !ONLY.includes(gen)) continue;
  const fn = SFX[gen];
  check(typeof fn === 'function', `${name}: SFX.${gen} missing`);
  if (typeof fn !== 'function') continue;
  const c0 = process.cpuUsage();
  const a = fn({ ...params });
  const cu = process.cpuUsage(c0);
  const cpuMs = (cu.user + cu.system) / 1000;
  const b = fn({ ...params });
  const st = analyse(a, SR);
  check(Array.isArray(a) && a.length === 2 && a[0] instanceof Float32Array && a[1] instanceof Float32Array, `${name}: must return [Float32Array, Float32Array]`);
  check(identical(a, b), `${name}: not deterministic`);
  check(st.bad === 0, `${name}: ${st.bad} non-finite samples`);
  check(st.peak <= 0.9 + 1e-6, `${name}: peak ${st.peak.toFixed(4)} > 0.9 (clipping risk)`);
  check(st.peak > 0.1, `${name}: suspiciously quiet (peak ${st.peak.toFixed(4)})`);
  check(st.edge === 0, `${name}: edge samples not zero (${st.edge})`);
  check(st.dc < 1e-3, `${name}: DC offset ${st.dc.toExponential(2)}`);
  check(cpuMs < 1000, `${name}: too slow (${cpuMs.toFixed(0)} ms CPU)`);
  const file = path.join(OUT, `${name}.wav`);
  writeWav(file, a, SR, 24);
  rows.push({ name, ...st, cpuMs });
  if (PNG) {
    ffmpeg(['-i', file, '-lavfi', 'showspectrumpic=s=1024x512:legend=1', path.join(OUT, `${name}.png`)]);
    if (opt.log) ffmpeg(['-i', file, '-lavfi', 'showspectrumpic=s=1024x512:legend=1:fscale=log:start=15:stop=24000', path.join(OUT, `${name}-log.png`)]);
    if (WAVES) ffmpeg(['-i', file, '-lavfi', 'showwavespic=s=1024x300:split_channels=1:filter=peak', '-frames:v', '1', path.join(OUT, `${name}-wave.png`)]);
  }
}

// API-level checks (only on a full run)
if (!ONLY.length) {
  const w44 = SFX.whoosh({ sampleRate: 44100 });
  check(w44[0].length === Math.round(1.2 * 44100), `sampleRate override: whoosh length ${w44[0].length}`);
  const g6 = SFX.blip({ gain: -6 }), g0 = SFX.blip();
  check(Math.abs(g6[0][500] - g0[0][500] * Math.pow(10, -6 / 20)) < 1e-6, 'gain param not applied as dB');
  const s1 = SFX.impact({ seed: 2 }), s0 = SFX.impact();
  check(!identical(s0, s1), 'seed has no effect');
  const dst = silence(1.0);
  check(dst.length === 2 && dst[0].length === SR && dst[1].length === SR, 'silence() shape');
  const src = SFX.blip();
  mixInto(dst, src, 0.9, -6);
  const off = Math.round(0.9 * SR), k = Math.pow(10, -6 / 20);
  check(Math.abs(dst[0][off + 300] - k * src[0][300]) < 1e-7, 'mixInto placement/gain');
  check(dst[0][off - 1] === 0, 'mixInto wrote before offset');
  mixInto(dst, src, -0.01, 0); // negative offset / clipping must not throw
  const pl = SFX.tick({ pan: 1 });
  check(peak(pl[0]) < 1e-9 && peak(pl[1]) > 0.5, 'pan=1 should be hard right');

  // robustness: other sample rates + edge-case params must stay finite, <= 0.9, zero-edged, fast
  const EDGE = [
    ['whoosh', { dur: 0.1 }], ['whoosh', { from: 6000, to: 150, peak: 0.95 }], ['impact', { dur: 0.3 }], ['impact', { drop: 0, tail: 0, noise: 0, click: 0 }],
    ['rumble', { dur: 0.5, cutoff: 30 }], ['explosion', { dur: 0.5, debris: 0 }], ['explosion', { distance: 1, dur: 6 }], ['riser', { dur: 0.5, voices: 1, noise: 0 }],
    ['shimmer', { dur: 0.3, sparkle: 0 }], ['shimmer', { root: 5000, sparkle: 2 }], ['heartbeat', { bpm: 200, beats: 1 }], ['heartbeat', { bpm: 30, beats: 2 }],
    ['tick', { type: 'ratchet', clicks: 1 }], ['tick', { type: 'bogus', count: 3, interval: 0.01 }], ['clank', { size: 0.2 }], ['clank', { size: 5, bounces: 0 }],
    ['bubble', { count: 0 }], ['bubble', { count: 200, dur: 1, minRadius: 0.5, maxRadius: 20 }], ['crackle', { density: 0, hiss: 0, roar: 0 }], ['crackle', { dur: 0.2, density: 200 }],
    ['wave', { dur: 1, period: 1.5 }], ['wind', { strength: 0, gustiness: 0 }], ['wind', { dur: 0.4, strength: 1.5, gustiness: 1.5 }], ['hum', { freq: 400, buzz: 0 }], ['hum', { freq: 16, buzz: 3 }],
    ['glitch', { dur: 0.05 }], ['blip', { count: 3, type: 'square', pattern: 'down', freq: 20000 }], ['typing', { dur: 0.3 }], ['typing', { style: 'typewriter', bell: true, dur: 1.6 }],
    ['keyClick', { variant: 'space' }], ['keyClick', { style: 'typewriter', variant: 'return' }], ['keyClick', { style: 'typewriter', variant: 'bell' }],
    ['footstep', { surface: 'stone', weight: 4 }], ['footstep', { surface: 'wood', weight: 0.2, steps: 3, interval: 0.1 }], ['thud', { size: 0.2 }], ['thud', { size: 5, debris: 3 }],
    ['shutter', { type: 'projector', dur: 0.5 }], ['shutter', { exposure: 0.5, wind: false }], ['shutter', { dur: 0.05 }],
  ];
  for (const g of Object.keys(SFX)) EDGE.push([g, { sampleRate: 44100 }], [g, { sampleRate: 96000, seed: 'alt' }]);
  let nEdge = 0;
  for (const [g, p] of EDGE) {
    const label = `${g}(${JSON.stringify(p)})`;
    try {
      const c0 = process.cpuUsage(), out = SFX[g](p), cu = process.cpuUsage(c0), sr = p.sampleRate ?? SR;
      const st = analyse(out, sr);
      check(st.bad === 0, `${label}: non-finite`);
      check(st.peak <= 0.9 + 1e-6, `${label}: peak ${st.peak}`);
      check(st.edge === 0, `${label}: edge not zero`);
      check((cu.user + cu.system) / 1000 < 2000, `${label}: too slow`);
      if (p.dur) check(Math.abs(out[0].length - Math.round(p.dur * sr)) <= 1, `${label}: length ${out[0].length}`);
      nEdge++;
    } catch (e) { failures.push(`${label}: threw ${e.message}`); }
  }
  console.log(`robustness: ${nEdge}/${EDGE.length} edge-case / alt-rate renders ok`);
}
function peak(a) { let p = 0; for (const v of a) p = Math.max(p, Math.abs(v)); return p; }

// ------------------------------------------------------------------ report
const pad = (s, w) => String(s).padEnd(w);
const lpad = (s, w) => String(s).padStart(w);
console.log(`\n${pad('name', 22)}${lpad('dur s', 7)}${lpad('peak dB', 9)}${lpad('rms dB', 8)}${lpad('DC', 10)}${lpad('centroid', 10)}${lpad('<100Hz%', 9)}${lpad('L/R r', 7)}${lpad('cpu ms', 8)}`);
for (const r of rows) {
  console.log(`${pad(r.name, 22)}${lpad(r.dur.toFixed(2), 7)}${lpad(r.peakDb.toFixed(2), 9)}${lpad(r.rmsDb.toFixed(1), 8)}${lpad(r.dc.toExponential(1), 10)}${lpad(r.centroid.toFixed(0), 10)}${lpad(r.lowPct.toFixed(1), 9)}${lpad(r.corr.toFixed(2), 7)}${lpad(r.cpuMs.toFixed(0), 8)}`);
}
console.log(`\n${rows.length} renders -> ${OUT}`);
if (failures.length) {
  console.error(`\nFAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('all checks passed (determinism, finite, peak <= 0.9, zero edges, DC < 1e-3, CPU < 1 s, API)');
