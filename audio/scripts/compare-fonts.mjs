// Compare candidate soundfont presets per instrument: sample properties + identical test phrases + metrics.
// usage: node audio/scripts/compare-fonts.mjs [instrument ...]
// writes audio/build/compare/<instrument>/<candidate>.wav, <instrument>_AB.wav (+ spectrogram), report.md/json
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadSoundBank, findPreset, describePreset, presetBank, SOUNDFONTS } from '../lib/soundfonts.mjs';
import { renderSynthTrack } from '../lib/synth.mjs';
import { renderSfzTrack, loadSfzInstrument } from '../lib/sfz.mjs';
import { writeWav } from '../lib/wav.mjs';
import { applyEQ, gainToDb, fft } from '../lib/dsp.mjs';
import { measureLoudness } from '../lib/loudness.mjs';
import { DRUMS, BRUSH } from '../lib/music.mjs';

const OUT = path.resolve('audio/build/compare');
const SR = 48000;

const extraIds = Object.keys(SOUNDFONTS).filter((k) => !['gm', 'gu', 'ms', 'fluid'].includes(k));
const C = (sf, bank, program, note = '') => ({ sf, bank, program, note });
export const CANDIDATES = {
  altoSax: { kind: 'horn', key: 67, range: [55, 79], c: [C('gm', 0, 65), C('ms', 0, 65), C('fluid', 0, 65)] },
  tenorSax: { kind: 'horn', key: 58, range: [46, 70], c: [C('gm', 0, 66), C('ms', 0, 66), C('fluid', 0, 66)] },
  sopranoSax: { kind: 'horn', key: 72, range: [60, 84], c: [C('gm', 0, 64), C('ms', 0, 64), C('fluid', 0, 64)] },
  trumpet: { kind: 'horn', key: 70, range: [58, 82], c: [C('gm', 0, 56), C('gm', 1, 56), C('ms', 0, 56), C('fluid', 0, 56)] },
  mutedTrumpet: { kind: 'horn', key: 70, range: [58, 82], c: [C('gm', 0, 59), C('ms', 0, 59), C('fluid', 0, 59)] },
  trombone: { kind: 'horn', key: 53, range: [41, 65], c: [C('gm', 0, 57), C('gm', 1, 57), C('ms', 0, 57), C('fluid', 0, 57)] },
  brass: { kind: 'horn', key: 65, range: [53, 77], c: [C('gm', 0, 61), C('gm', 8, 61), C('ms', 0, 61), C('fluid', 0, 61)] },
  rhodes: { kind: 'keys', key: 60, range: [48, 72], c: [C('gm', 0, 4), C('ms', 0, 4), C('fluid', 0, 4)] },
  piano: { kind: 'keys', key: 60, range: [48, 72], c: [C('gm', 0, 0), C('ms', 0, 0), C('fluid', 0, 0)] },
  vibes: { kind: 'keys', key: 72, range: [60, 84], c: [C('gm', 0, 11), C('ms', 0, 11), C('fluid', 0, 11)] },
  clav: { kind: 'keys', key: 60, range: [48, 72], c: [C('gm', 0, 7), C('ms', 0, 7), C('fluid', 0, 7)] },
  nylonGuitar: { kind: 'keys', key: 55, range: [43, 67], c: [C('gm', 0, 24), C('ms', 0, 24), C('fluid', 0, 24)] },
  uprightBass: { kind: 'bass', key: 40, range: [28, 52], c: [C('gm', 0, 32), C('gm', 0, 43), C('ms', 0, 32), C('fluid', 0, 32)] },
  fretlessBass: { kind: 'bass', key: 40, range: [28, 52], c: [C('gm', 0, 35), C('ms', 0, 35), C('fluid', 0, 35)] },
  strings: { kind: 'pad', key: 60, range: [48, 72], c: [C('gm', 0, 49), C('ms', 0, 49), C('fluid', 0, 49), C('gm', 0, 48)] },
  jazzKit: { kind: 'drums', c: [C('gm', 128, 32), C('ms', 128, 32), C('fluid', 128, 32)] },
  brushKit: { kind: 'drums', brush: true, c: [C('gm', 128, 40), C('ms', 128, 40), C('fluid', 128, 40)] },
};

// Extra fonts: user-provided registry (audio/assets/sf/extra/registry.json) + optional candidates file
const extraCandFile = path.resolve('audio/assets/sf/extra/candidates.json');
if (fs.existsSync(extraCandFile)) {
  const extra = JSON.parse(fs.readFileSync(extraCandFile, 'utf8'));
  for (const [inst, list] of Object.entries(extra)) {
    if (!CANDIDATES[inst]) continue;
    for (const e of list) CANDIDATES[inst].c.push({ ...C(e.sf, e.bank ?? 0, e.program ?? 0, e.note ?? ''), melodicDrums: !!e.melodicDrums, keymap: e.keymap });
  }
}
void extraIds;

// ---------------------------------------------------------------- sample-level inspection
function loopSeamError(sample, ls, le) {
  let data;
  try { data = sample.getAudioData(); } catch { return null; }
  if (!(le > ls + 16) || le > data.length) return null;
  // compare the 16 samples before loopEnd with the 16 before loopStart (what the playhead "expects" at the wrap)
  let d = 0, e = 0;
  for (let k = 1; k <= 16; k++) {
    const a = data[le - k], b = data[ls - k] ?? 0;
    d += (a - b) ** 2; e += a * a + b * b;
  }
  // local slope mismatch at the wrap: x[le-1] -> x[ls]
  const jump = Math.abs(data[ls] - data[le - 1]);
  let rmsLoop = 0;
  for (let i = ls; i < le; i++) rmsLoop += data[i] * data[i];
  rmsLoop = Math.sqrt(rmsLoop / (le - ls)) || 1e-9;
  return { seamDb: +(10 * Math.log10((d + 1e-20) / (e / 2 + 1e-20))).toFixed(1), jumpRel: +(jump / rmsLoop).toFixed(3) };
}

function inspect(sfId, bank, program, key) {
  const sb = loadSoundBank(sfId);
  const p = findPreset(sb, { bank, program });
  if (!p) return null;
  const layers = describePreset(p);
  const at = layers.filter((l) => key >= l.keyRange[0] && key <= l.keyRange[1]);
  const distinct = new Map();
  for (const l of at) {
    if (/\(R\)|_R$|R\)$/.test(l.sample) && at.some((o) => o.sample === l.sample.replace(/R/, 'L'))) continue;
    distinct.set(l.sample, l);
  }
  const samples = [...distinct.values()];
  const mf = at.find((l) => 80 >= l.velRange[0] && 80 <= l.velRange[1]) ?? at[0];
  let seam = null;
  if (mf) {
    const inst = p.zones.map((z) => z.instrument).find((i) => i.name === mf.instrument);
    const zone = inst?.zones.find((z) => z.sample.name === mf.sample);
    if (zone && (mf.loopMode === 1 || mf.loopMode === 3)) seam = loopSeamError(zone.sample, mf.loopStart, mf.loopEnd);
  }
  const totalSamples = new Set(layers.map((l) => l.sample)).size;
  return {
    preset: p.name,
    zonesAtKey: at.length,
    sampleLayersAtKey: samples.length,
    velSplitsAtKey: new Set(at.map((l) => `${l.velRange[0]}-${l.velRange[1]}`)).size,
    totalSamples,
    mf: mf ? {
      sample: mf.sample, rate: mf.sampleRate, seconds: +mf.seconds.toFixed(2), loopMode: mf.loopMode,
      attackSec: +(mf.loopStart / mf.sampleRate).toFixed(3), loopSec: +mf.loopSeconds.toFixed(3), stereo: mf.stereo, rootKey: mf.rootKey,
    } : null,
    seam,
  };
}

// ---------------------------------------------------------------- test phrases (seconds)
function phrase(kind, key, brush) {
  const notes = [];
  let t = 0.1;
  if (kind === 'drums') {
    const K = brush ? BRUSH : DRUMS;
    const hits = brush ? [K.kick, K.tap, K.slap, K.swirl, K.hhClosed, K.hhPedal, K.ride, K.rideBell] : [K.kick, K.snare, K.sideStick, K.hhClosed, K.hhPedal, K.hhOpen, K.ride, K.rideBell, K.crash];
    for (const p of hits) for (const v of [35, 70, 105, 127]) { notes.push({ t, d: p === K.swirl ? 0.6 : 0.3, p, v }); t += p === K.crash || p === K.ride || p === K.hhOpen ? 0.9 : 0.4; }
    return { notes, dur: t + 2 };
  }
  // 1) long note 3.2 s (sustain / loop test)
  notes.push({ t, d: 3.2, p: key, v: 90, tag: 'long' }); t += 3.6;
  // 2) velocity ladder
  for (const v of [30, 60, 90, 120]) { notes.push({ t, d: 0.55, p: key, v, tag: `v${v}` }); t += 0.75; }
  // 3) 16th line over an octave (96 BPM)
  const s16 = 60 / 96 / 4;
  const line = [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0, -1];
  for (const iv of line) { notes.push({ t, d: s16 * 0.9, p: key + iv, v: 84 }); t += s16; }
  t += 0.4;
  // 4) range check: low / high notes
  for (const k of [key - 12, key + 12]) { notes.push({ t, d: 0.9, p: k, v: 90 }); t += 1.1; }
  // 5) chord (keys/pads/brass)
  if (kind !== 'horn' || true) { for (const iv of [0, 4, 7, 11, 14]) notes.push({ t, d: 2.2, p: key - 12 + iv + (kind === 'bass' ? 12 : 0), v: 80 }); t += 2.6; }
  return { notes, dur: t + 1.5 };
}

function rmsWin(ch, t0, t1) {
  const a = Math.max(0, Math.round(t0 * SR)), b = Math.min(ch[0].length, Math.round(t1 * SR));
  let s = 0;
  for (const c of ch) for (let i = a; i < b; i++) s += c[i] * c[i];
  return Math.sqrt(s / Math.max(1, (b - a) * ch.length));
}
function flutter(ch, t0, t1) {
  // RMS envelope in 10 ms windows: coefficient of variation (loop pumping / tremolo / grain)
  const env = [];
  for (let t = t0; t < t1; t += 0.01) env.push(rmsWin(ch, t, t + 0.01));
  const m = env.reduce((a, b) => a + b, 0) / env.length;
  const sd = Math.sqrt(env.reduce((a, b) => a + (b - m) ** 2, 0) / env.length);
  return m > 0 ? +(sd / m).toFixed(3) : null;
}
function centroid(ch, t0, t1) {
  const N = 8192, a = Math.round(t0 * SR);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N && a + i < ch[0].length; i++) re[i] = 0.5 * (ch[0][a + i] + ch[1][a + i]) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  void t1;
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); num += m * (k * SR / N); den += m; }
  return den ? Math.round(num / den) : 0;
}
function bandRatio(ch, lo) {
  const x = [Float32Array.from(ch[0])];
  applyEQ(x, [{ type: 'hp', freq: lo, order: 4 }], SR);
  let a = 0, b = 0;
  for (let i = 0; i < ch[0].length; i++) { a += x[0][i] ** 2; b += ch[0][i] ** 2; }
  return +(10 * Math.log10((a + 1e-20) / (b + 1e-20))).toFixed(1);
}

async function main() {
  const which = process.argv.slice(2);
  const insts = which.length ? which : Object.keys(CANDIDATES);
  fs.mkdirSync(OUT, { recursive: true });
  const reportJson = fs.existsSync(path.join(OUT, 'report.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'report.json'), 'utf8')) : {};
  for (const name of insts) {
    const spec = CANDIDATES[name];
    const dir = path.join(OUT, name);
    fs.mkdirSync(dir, { recursive: true });
    const { notes, dur } = phrase(spec.kind, spec.key, spec.brush);
    const rows = [];
    const ab = [[], []];
    for (const cand of spec.c) {
      const label = cand.sf.startsWith('sfz:') ? cand.sf.slice(4) : `${cand.sf}-${cand.bank}-${cand.program}`;
      let info;
      const isSfz = cand.sf.startsWith('sfz:');
      try {
        if (isSfz) {
          const inst = loadSfzInstrument(cand.sf.slice(4));
          const k = spec.kind === 'drums' ? (spec.brush ? 38 : 38) : spec.key;
          const at = inst.regions.filter((r) => k >= r.lokey && k <= r.hikey);
          info = { preset: cand.sf.slice(4), sampleLayersAtKey: new Set(at.map((r) => r.sample)).size, totalSamples: new Set(inst.regions.map((r) => r.sample)).size, mf: null, seam: null };
        } else info = spec.kind === 'drums' && !cand.melodicDrums ? inspect(cand.sf, 128, cand.program, spec.brush ? 40 : 38) : inspect(cand.sf, cand.bank, cand.program, spec.kind === 'drums' ? 38 : spec.key);
      }
      catch (e) { console.warn(name, label, e.message); continue; }
      if (!info) { console.warn(`${name}: ${label} missing`); continue; }
      const track = isSfz ? { id: `${name}_${label}`, sfz: cand.sf.slice(4), notes, keymap: cand.keymap }
        : { id: `${name}_${label}`, sf: cand.sf, bank: spec.kind === 'drums' ? 0 : cand.bank, program: cand.program, drums: spec.kind === 'drums' && !cand.melodicDrums, notes, keymap: cand.keymap };
      const r = await (isSfz ? renderSfzTrack : renderSynthTrack)(track, { sampleRate: SR, duration: dur, warn: () => {} });
      const ch = r.channels;
      writeWav(path.join(dir, `${label}.wav`), ch, SR, 24, { quiet: true });
      const L = measureLoudness(ch, SR, { truePeak: false });
      const m = { label, ...cand, ...info, lufs: +L.integrated.toFixed(1) };
      if (spec.kind !== 'drums') {
        const vt = notes.filter((n) => n.tag?.startsWith('v'));
        const lv = (tag) => { const n = vt.find((x) => x.tag === tag); return gainToDb(rmsWin(ch, n.t, n.t + 0.4)); };
        m.velRangeDb = +(lv('v120') - lv('v30')).toFixed(1);
        const long = notes.find((n) => n.tag === 'long');
        m.sustainDb = +(gainToDb(rmsWin(ch, long.t + 2.6, long.t + 3.1)) - gainToDb(rmsWin(ch, long.t + 0.2, long.t + 0.7))).toFixed(1);
        m.flutter = flutter(ch, long.t + 0.6, long.t + 3.0);
        m.centroidHz = centroid(ch, long.t + 0.3, long.t + 0.5);
      } else {
        const loud = [];
        for (let k = 0; k < notes.length; k += 4) loud.push(+(gainToDb(rmsWin(ch, notes[k + 3].t, notes[k + 3].t + 0.15)) - gainToDb(rmsWin(ch, notes[k].t, notes[k].t + 0.15))).toFixed(1));
        m.velRangeDbPerHit = loud;
        m.centroidHz = centroid(ch, 0, 0.2);
      }
      m.airDb = bandRatio(ch, 10000);
      rows.push(m);
      // A/B concat with 0.6 s gap, loudness-matched to -20 LUFS for fair listening
      const g = Math.pow(10, (-20 - (Number.isFinite(L.integrated) ? L.integrated : -20)) / 20);
      for (let c = 0; c < 2; c++) { ab[c].push(Float32Array.from(ch[c], (x) => x * g)); ab[c].push(new Float32Array(Math.round(0.6 * SR))); }
      console.log(`${name.padEnd(13)} ${label.padEnd(14)} ${info.preset.padEnd(22)} layers@key=${info.sampleLayersAtKey} total=${info.totalSamples} mf=${info.mf?.seconds}s@${info.mf?.rate} loop=${info.mf?.loopSec}s seam=${info.seam?.seamDb ?? '-'}dB vel=${m.velRangeDb ?? m.velRangeDbPerHit} sus=${m.sustainDb ?? '-'} flut=${m.flutter ?? '-'} cen=${m.centroidHz} air=${m.airDb}`);
    }
    const cat = (arr) => { const n = arr.reduce((a, b) => a + b.length, 0); const o = new Float32Array(n); let off = 0; for (const a of arr) { o.set(a, off); off += a.length; } return o; };
    const abFile = path.join(OUT, `${name}_AB.wav`);
    writeWav(abFile, [cat(ab[0]), cat(ab[1])], SR, 24, { quiet: true });
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', abFile, '-lavfi', 'showspectrumpic=s=1400x600:mode=combined:scale=log:fscale=log:legend=1', abFile.replace(/\.wav$/, '.png')]);
    reportJson[name] = { order: rows.map((r) => r.label), rows };
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(reportJson, null, 1));
  // markdown summary
  const md = ['# Soundfont comparison', '', 'A/B files: `<instrument>_AB.wav` (candidates in table order, loudness-matched to -20 LUFS, 0.6 s gaps).', ''];
  for (const [name, { rows }] of Object.entries(reportJson)) {
    md.push(`## ${name}`, '', '| candidate | preset | sample layers @key | total samples | mf sample len (s) | rate | loop len (s) | seam (dB) | vel range (dB) | sustain (dB) | flutter | centroid (Hz) | >10k (dB) |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const r of rows) md.push(`| ${r.label} | ${r.preset} | ${r.sampleLayersAtKey} | ${r.totalSamples} | ${r.mf?.seconds ?? ''} | ${r.mf?.rate ?? ''} | ${r.mf?.loopSec ?? ''} | ${r.seam?.seamDb ?? ''} | ${r.velRangeDb ?? (r.velRangeDbPerHit ?? []).join('/')} | ${r.sustainDb ?? ''} | ${r.flutter ?? ''} | ${r.centroidHz} | ${r.airDb} |`);
    md.push('');
  }
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n'));
  console.log(`\nwrote ${path.join(OUT, 'report.md')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
