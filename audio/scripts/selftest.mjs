// Self-test for the audio toolchain: node audio/scripts/selftest.mjs
// Checks WAV I/O, loudness meter (vs ffmpeg ebur128), true peak, reverb decay, limiter ceiling, synth + SFZ rendering.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeWav, readWav } from '../lib/wav.mjs';
import { measureLoudness } from '../lib/loudness.mjs';
import { truePeak, applyEQ, mulberry32 } from '../lib/dsp.mjs';
import { generateReverbIR } from '../lib/fx.mjs';
import { limit } from '../lib/dynamics.mjs';
import { renderSynthTrack } from '../lib/synth.mjs';
import { renderSfzTrack } from '../lib/sfz.mjs';

const sr = 48000;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-selftest-'));
let fails = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); if (!ok) fails++; };
const sine = (f, amp, secs, ph = 0) => Float32Array.from({ length: Math.round(secs * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / sr + ph));

// 1. WAV round trip
{
  const x = sine(440, 0.5, 0.5);
  for (const [bits, tol] of [[16, 1 / 16000], [24, 1 / 4e6], [32, 1e-7]]) {
    const f = path.join(tmp, `rt${bits}.wav`);
    writeWav(f, [x, x], sr, bits, { dither: false });
    const w = readWav(f);
    let err = 0;
    for (let i = 0; i < x.length; i++) err = Math.max(err, Math.abs(w.channels[0][i] - x[i]));
    check(`wav ${bits}-bit round trip`, err < tol && w.sampleRate === sr && w.channels.length === 2, `max err ${err.toExponential(2)}`);
  }
}
// 2. loudness: stereo 997 Hz at -20 dBFS -> -20 LUFS; compare with ffmpeg on a music-like signal
{
  const x = sine(997, 0.1, 10);
  const m = measureLoudness([x, x], sr);
  check('LUFS of -20 dBFS stereo sine', Math.abs(m.integrated + 20) < 0.05, `${m.integrated.toFixed(3)} LUFS`);
  const r = mulberry32(3), n = sr * 12;
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) { const env = 0.3 + 0.7 * Math.abs(Math.sin(i / sr * 0.9)); a[i] = (r() - 0.5) * 0.4 * env; b[i] = (r() - 0.5) * 0.3 * env; }
  applyEQ([a, b], [{ type: 'lp', freq: 3000 }], sr);
  const f = path.join(tmp, 'noise.wav');
  writeWav(f, [a, b], sr, 32);
  const mine = measureLoudness([a, b], sr).integrated;
  const res = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const all = [...(res.stderr ?? '').matchAll(/I:\s+(-?[\d.]+) LUFS/g)];
  const ff = parseFloat(all.at(-1)?.[1]); // last one = summary
  check('LUFS vs ffmpeg ebur128', Number.isFinite(ff) && Math.abs(mine - ff) < 0.15, `mine ${mine.toFixed(2)} / ffmpeg ${ff}`);
}
// 3. true peak: fs/4 sine at 45 deg phase has sample peak -3.01 dB and true peak 0 dB
{
  const x = sine(sr / 4, 1, 1, Math.PI / 4);
  const tp = 20 * Math.log10(truePeak([x]));
  check('true peak of fs/4 sine (45 deg)', Math.abs(tp) < 0.2, `${tp.toFixed(3)} dBTP (sample peak -3.01)`);
}
// 4. reverb decay (Schroeder T30 on the ll path, 1 kHz band)
{
  const ir = generateReverbIR({ preset: 'hall', decay: 2.2 });
  const x = Float32Array.from(ir.ll);
  applyEQ([x], [{ type: 'bp', freq: 700, q: 1.4 }], sr);
  const e = new Float64Array(x.length); let acc = 0;
  for (let i = x.length - 1; i >= 0; i--) { acc += x[i] * x[i]; e[i] = acc; }
  const db = (i) => 10 * Math.log10(e[i] / e[0]);
  let i5 = 0, i35 = 0;
  for (let i = 0; i < x.length; i++) { if (!i5 && db(i) <= -5) i5 = i; if (db(i) <= -35) { i35 = i; break; } }
  const rt = ((i35 - i5) / sr) * 2;
  check('hall reverb RT60 @700 Hz ≈ 2.2 s', Math.abs(rt - 2.2) < 0.35, `${rt.toFixed(2)} s`);
}
// 5. limiter ceiling
{
  const r = mulberry32(9), n = sr * 5;
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) { const burst = (i % sr) < 3000 ? 4 : 0.5; a[i] = (r() - 0.5) * burst; b[i] = (r() - 0.5) * burst; }
  const out = limit([a, b], sr, { ceiling: -1 }).channels;
  const tp = 20 * Math.log10(truePeak(out));
  check('limiter keeps true peak ≤ -1 dBTP', tp <= -0.95, `${tp.toFixed(2)} dBTP`);
}
// 6. synth + SFZ smoke tests
{
  const notes = [60, 64, 67, 71].map((p) => ({ t: 0.1, d: 1, p, v: 90 }));
  const s = await renderSynthTrack({ id: 't', sf: 'gm', program: 4, notes }, { sampleRate: sr, duration: 2, warn: () => {} });
  check('spessasynth renders (GeneralUser EP)', s.info.peak > 0.01 && s.info.peak < 4, `peak ${s.info.peak.toFixed(3)} preset ${s.info.preset}`);
  const z = await renderSfzTrack({ id: 'z', sfz: 'vcsl-vibes-soft', notes }, { sampleRate: sr, duration: 2, warn: () => {} });
  check('SFZ sampler renders (VCSL vibes)', z.info.peak > 0.01 && z.info.peak < 4, `peak ${z.info.peak.toFixed(3)} voices ${z.info.maxVoices}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
