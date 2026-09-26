// audio/lib/sfz.mjs — offline SFZ sampler (pure JS) used for instruments that only exist as SFZ packs.
//
// Supported (the subset used by the packs in audio/assets/sfz): <control>/<global>/<master>/<group>/<region>/<curve>,
// #define/#include, default_path, note/octave_offset, set_cc/set_hdcc; lokey/hikey/key, lovel/hivel, loccN/hiccN,
// lorand/hirand, seq_length/seq_position, trigger=attack|release|first|legato, sw_lokey/sw_hikey/sw_last/sw_default,
// group/off_by/off_mode/off_time, polyphony, note_polyphony; pitch_keycenter/keytrack, transpose, tune, pitch_random,
// bend_up/bend_down; volume, amplitude, amp_veltrack, amp_velcurve_N, amp_random, pan, width, position,
// xfin/xfout_lo/hivel and _lo/hiccN; offset, offset_random, end, delay; loop_mode/loop_start/loop_end (+ WAV/FLAC smpl
// loops); ampeg_delay/start/attack/hold/decay/sustain/release; fil_type (lpf/hpf/bpf 1p/2p), cutoff, resonance,
// fil_keytrack/keycenter/veltrack, fileg_*; pitchlfo_*, amplfo_*, fillfo_*, lfoNN_freq/delay/fade/phase/wave with
// lfoNN_pitch/volume/amplitude/cutoff/pan; every *_onccN / *_ccN / *ccN modulation with *_curveccN curves
// (predefined curves 0–6 + <curve>), ARIA extended CCs 131 (velocity) 133 (key) 135/136 (random) 137 (alternate).
// Channel CC7/CC10/CC11 are applied by the engine when the instrument does not map them itself; CC64 sustain.
// Not supported: EQ bands, pitcheg/egNN, var/lfo-to-lfo modulation, sample generators (*sine, *noise...), effects.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSfz } from './sfz-parse.mjs';
import { readWav, decodeAudioFile, readFlacSmpl } from './wav.mjs';
import { mulberry32 } from './dsp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SFZ_DIR = path.resolve(HERE, '..', 'assets', 'sfz');

// Registry: id -> { file (relative to assets/sfz), cc: default CC overrides (0..127), note }
export const SFZ_INSTRUMENTS = {
  'mtg-alto': { file: 'mtg-solo-sax/MTG Solo Saxophones/MTG Alto Sax (NL).sfz' },
  'mtg-tenor': { file: 'mtg-solo-sax/MTG Solo Saxophones/MTG Tenor Sax (NL).sfz' },
  'mtg-soprano': { file: 'mtg-solo-sax/MTG Solo Saxophones/MTG Soprano Sax (NL).sfz' },
  'mtg-bari': { file: 'mtg-solo-sax/MTG Solo Saxophones/MTG Baritone Sax (NL).sfz' },
  // MTG programs ship with loop_mode=no_loop and random takes of 0.2-5 s; these variants use the loops embedded in the
  // FLAC files (loop while the key is held, then play the natural release) so long notes never stop early.
  'mtg-alto-looped': { file: 'mtg-solo-sax/MTG Solo Saxophones/MTG Alto Sax (NL).sfz', override: { loop_mode: 'loop_sustain' } },
  'mtg-tenor-looped': { file: 'mtg-solo-sax/MTG Solo Saxophones/MTG Tenor Sax (NL).sfz', override: { loop_mode: 'loop_sustain' } },
  'mtg-soprano-looped': { file: 'mtg-solo-sax/MTG Solo Saxophones/MTG Soprano Sax (NL).sfz', override: { loop_mode: 'loop_sustain' } },
  'mtg-bari-looped': { file: 'mtg-solo-sax/MTG Solo Saxophones/MTG Baritone Sax (NL).sfz', override: { loop_mode: 'loop_sustain' } },
  'weresax-alto': { file: 'karoryfer-weresax/Programs/Sax.sfz' },
  'vsco-trumpet': { file: 'vsco2ce-brass/TrumpetSus.sfz' },
  'vsco-trumpet-vib': { file: 'vsco2ce-brass/TrumpetSusVib.sfz' },
  'vsco-trumpet-harmon': { file: 'vsco2ce-brass/TrumpetHarmonMuteSus.sfz' },
  'vsco-trumpet-straight': { file: 'vsco2ce-brass/TrumpetStraightMuteSus.sfz' },
  'vsco-trumpet-stac': { file: 'vsco2ce-brass/TrumpetStac.sfz' },
  'vsco-trombone': { file: 'vsco2ce-brass/TromboneSus.sfz' },
  'vsco-trombone-vib': { file: 'vsco2ce-brass/TromboneVib.sfz' },
  'vsco-trombone-stac': { file: 'vsco2ce-brass/TromboneStac.sfz' },
  'vcsl-vibes-soft': { file: 'vcsl-vibraphone/Idiophones/Struck Idiophones/Vibraphone - Soft Mallets.sfz' },
  'vcsl-vibes-hard': { file: 'vcsl-vibraphone/Idiophones/Struck Idiophones/Vibraphone - Hard Mallets.sfz' },
  // soft mallets + simulated motor tremolo (sine amplitude LFO, ±3 dB at 4.8 Hz)
  'vcsl-vibes-motor': { file: 'vcsl-vibraphone/Idiophones/Struck Idiophones/Vibraphone - Soft Mallets.sfz', override: { amplfo_freq: 4.8, amplfo_depth: 3 } },
  'meatbass-pizz': { file: 'karoryfer-meatbass/Programs/04_pizz.sfz' },
  'swirly-brushes': { file: 'karoryfer-swirly-drums/Programs/Basic_kit.sfz' },
  'virtuosity-kit': { file: 'virtuosity-drums/Programs/06-mid-mic.sfz', cc: { 4: 127 } }, // CC4=127: hi-hat pedal closed
  'wurlitzer': { file: 'gregsullivan-epianos/Wurlitzer EP200/Wurlitzer EP200.sfz' },
  'cp80': { file: 'gregsullivan-epianos/CP80/CP80.sfz' },
  'pianet': { file: 'gregsullivan-epianos/Pianet T/Pianet T.sfz' },
};

export function resolveSfzPath(idOrPath) {
  if (SFZ_INSTRUMENTS[idOrPath]) return path.join(SFZ_DIR, SFZ_INSTRUMENTS[idOrPath].file);
  if (fs.existsSync(idOrPath)) return path.resolve(idOrPath);
  const p = path.join(SFZ_DIR, idOrPath);
  if (fs.existsSync(p)) return p;
  throw new Error(`Unknown SFZ instrument '${idOrPath}'. Known ids: ${Object.keys(SFZ_INSTRUMENTS).join(', ')}`);
}

// ------------------------------------------------------------------ curves
function predefinedCurve(idx, x) {
  switch (idx) {
    case 1: return 2 * x - 1;
    case 2: return 1 - x;
    case 3: return 1 - 2 * x;
    case 4: return x * x;
    case 5: return Math.sqrt(x);
    case 6: return Math.sqrt(1 - x);
    default: return x;
  }
}
function makeCurveFn(curves) {
  const cache = new Map();
  return (idx, x) => {
    const pts = idx != null ? curves[idx] : null;
    if (!pts || !pts.length) return predefinedCurve(idx ?? 0, x);
    let table = cache.get(idx);
    if (!table) {
      const p = [...pts];
      if (p[0][0] !== 0) p.unshift([0, 0]);
      if (p[p.length - 1][0] !== 127) p.push([127, 1]);
      table = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        let k = 0;
        while (k < p.length - 1 && p[k + 1][0] < i) k++;
        const [x0, y0] = p[k], [x1, y1] = p[Math.min(k + 1, p.length - 1)];
        table[i] = x1 === x0 ? y1 : y0 + ((i - x0) / (x1 - x0)) * (y1 - y0);
      }
      cache.set(idx, table);
    }
    const v = Math.max(0, Math.min(127, x * 127));
    const i0 = Math.floor(v), f = v - i0;
    return i0 >= 127 ? table[127] : table[i0] + f * (table[i0 + 1] - table[i0]);
  };
}

// ------------------------------------------------------------------ opcode normalisation + region compilation
function normalizeKey(k) {
  let m;
  if (k === 'loopmode') return 'loop_mode';
  if (k === 'loopstart') return 'loop_start';
  if (k === 'loopend') return 'loop_end';
  if ((m = /^(ampeg_(?:delay|start|attack|hold|decay|sustain|release)|fileg_(?:delay|start|attack|hold|decay|sustain|release|depth))cc(\d+)$/.exec(k))) return `${m[1]}_oncc${m[2]}`;
  if ((m = /^(tune|pitch|volume|gain|pan|offset|amplitude|cutoff|resonance|width|position|delay)_?cc(\d+)$/.exec(k)) && !/^(lo|hi)cc/.test(k)) {
    const base = m[1] === 'gain' ? 'volume' : m[1] === 'pitch' ? 'tune' : m[1];
    return `${base}_oncc${m[2]}`;
  }
  if ((m = /^gain_oncc(\d+)$/.exec(k))) return `volume_oncc${m[1]}`;
  if ((m = /^pitch_oncc(\d+)$/.exec(k))) return `tune_oncc${m[1]}`;
  if ((m = /^pitchlfo_(depth|freq)cc(\d+)$/.exec(k))) return `pitchlfo_${m[1]}_oncc${m[2]}`;
  if ((m = /^(amplfo|fillfo)_(depth|freq)cc(\d+)$/.exec(k))) return `${m[1]}_${m[2]}_oncc${m[3]}`;
  if ((m = /^lfo(\d)_(.*)$/.exec(k))) return `lfo0${m[1]}_${m[2]}`; // lfo3_pitch_oncc119 -> lfo03_...
  return k;
}

function compileRegion(raw, idx) {
  const r = {};
  for (const [k, v] of Object.entries(raw)) r[normalizeKey(k)] = v;
  const num = (k, d) => (r[k] !== undefined && r[k] !== '' && Number.isFinite(+r[k]) ? +r[k] : d);
  const reg = {
    idx, raw: r, sample: r._sample, generator: r._generator,
    lokey: num('lokey', 0), hikey: num('hikey', 127), lovel: num('lovel', 0), hivel: num('hivel', 127),
    lorand: num('lorand', 0), hirand: num('hirand', 1),
    seqLength: num('seq_length', 1), seqPosition: num('seq_position', 1), seqCounter: 0,
    trigger: (r.trigger ?? 'attack').toLowerCase(),
    swLast: num('sw_last'), swLo: num('sw_lokey'), swHi: num('sw_hikey'), swDefault: num('sw_default'),
    group: num('group', 0), offBy: num('off_by'), offMode: (r.off_mode ?? 'fast').toLowerCase(), offTime: num('off_time', 0.006),
    polyphony: num('polyphony'), notePolyphony: num('note_polyphony'),
    keycenter: r.pitch_keycenter === 'sample' ? 'sample' : num('pitch_keycenter', 60), keytrack: num('pitch_keytrack', 100),
    transpose: num('transpose', 0), tune: num('tune', 0), pitchRandom: num('pitch_random', 0), pitchVeltrack: num('pitch_veltrack', 0),
    bendUp: num('bend_up', 200), bendDown: num('bend_down', -200),
    volume: num('volume', 0), amplitude: num('amplitude', 100), ampVeltrack: num('amp_veltrack', 100), ampRandom: num('amp_random', 0),
    pan: num('pan', 0), width: num('width', 100), position: num('position', 0),
    offset: num('offset', 0), offsetRandom: num('offset_random', 0), end: num('end'), delay: num('delay', 0), delayRandom: num('delay_random', 0),
    loopMode: (r.loop_mode ?? '').toLowerCase() || null, loopStart: num('loop_start'), loopEnd: num('loop_end'),
    rtDecay: num('rt_decay', 0),
    ampeg: {
      delay: num('ampeg_delay', 0), start: num('ampeg_start', 0), attack: num('ampeg_attack', 0), hold: num('ampeg_hold', 0),
      decay: num('ampeg_decay', 0), sustain: num('ampeg_sustain', 100), release: num('ampeg_release', 0.001),
    },
    filType: (r.fil_type ?? r.filtype ?? '').toLowerCase() || (r.cutoff != null ? 'lpf_2p' : null),
    cutoff: num('cutoff'), resonance: num('resonance', 0), filKeytrack: num('fil_keytrack', 0), filKeycenter: num('fil_keycenter', 60), filVeltrack: num('fil_veltrack', 0),
    fileg: {
      delay: num('fileg_delay', 0), start: num('fileg_start', 0), attack: num('fileg_attack', 0), hold: num('fileg_hold', 0),
      decay: num('fileg_decay', 0), sustain: num('fileg_sustain', 100), release: num('fileg_release', 0), depth: num('fileg_depth', 0),
    },
    velcurve: null, ccConds: [], xfCC: [], mods: new Map(),
    xfinLovel: num('xfin_lovel', 0), xfinHivel: num('xfin_hivel', 0), xfoutLovel: num('xfout_lovel', 127), xfoutHivel: num('xfout_hivel', 127),
    lfos: [],
  };
  if (reg.keycenter === 'sample') reg.keycenter = null;
  // amp_velcurve_N
  const vc = [];
  for (const [k, v] of Object.entries(r)) {
    let m;
    if ((m = /^amp_velcurve_(\d+)$/.exec(k))) vc.push([+m[1], +v]);
    else if ((m = /^locc(\d+)$/.exec(k))) (reg._cc ??= {})[m[1]] = { ...(reg._cc?.[m[1]] ?? {}), lo: +v };
    else if ((m = /^hicc(\d+)$/.exec(k))) (reg._cc ??= {})[m[1]] = { ...(reg._cc?.[m[1]] ?? {}), hi: +v };
    else if ((m = /^xf(in|out)_(lo|hi)cc(\d+)$/.exec(k))) {
      const key = `${m[1]}${m[3]}`;
      (reg._xf ??= {})[key] = { ...(reg._xf?.[key] ?? { dir: m[1], cc: +m[3] }), [m[2]]: +v };
    } else if ((m = /^(.+)_oncc(\d+)$/.exec(k))) {
      const target = m[1], cc = +m[2];
      const curve = r[`${target}_curvecc${cc}`];
      if (!reg.mods.has(target)) reg.mods.set(target, []);
      reg.mods.get(target).push({ cc, amt: +v, curve: curve != null ? +curve : null });
    }
  }
  if (vc.length) {
    vc.sort((a, b) => a[0] - b[0]);
    if (vc[0][0] !== 0) vc.unshift([0, 0]);
    if (vc[vc.length - 1][0] !== 127) vc.push([127, 1]);
    reg.velcurve = vc;
  }
  for (const [cc, c] of Object.entries(reg._cc ?? {})) reg.ccConds.push({ cc: +cc, lo: c.lo ?? 0, hi: c.hi ?? 127 });
  for (const x of Object.values(reg._xf ?? {})) reg.xfCC.push({ dir: x.dir, cc: x.cc, lo: x.lo ?? 0, hi: x.hi ?? (x.dir === 'in' ? 0 : 127) });
  delete reg._cc; delete reg._xf;
  // LFOs: legacy pitchlfo/amplfo/fillfo + v2 lfoNN
  const legacy = (pfx, target) => {
    const depth = num(`${pfx}_depth`, 0), freq = num(`${pfx}_freq`, 0);
    if (depth || reg.mods.has(`${pfx}_depth`)) {
      reg.lfos.push({ wave: 1, freq, freqMods: reg.mods.get(`${pfx}_freq`) ?? [], delay: num(`${pfx}_delay`, 0), fade: num(`${pfx}_fade`, 0), phase: 0,
        targets: [{ target, amt: depth, mods: reg.mods.get(`${pfx}_depth`) ?? [] }] });
    }
  };
  legacy('pitchlfo', 'pitch'); legacy('amplfo', 'volume'); legacy('fillfo', 'cutoff');
  const lfoIds = new Set();
  for (const k of Object.keys(r)) { const m = /^lfo(\d\d)_/.exec(k); if (m) lfoIds.add(m[1]); }
  for (const kId of [...reg.mods.keys()]) { const m = /^lfo(\d\d)_/.exec(kId); if (m) lfoIds.add(m[1]); }
  for (const id of lfoIds) {
    const p = `lfo${id}`;
    const targets = [];
    for (const [tName, tKey] of [['pitch', 'pitch'], ['volume', 'volume'], ['amplitude', 'amplitude'], ['cutoff', 'cutoff'], ['pan', 'pan']]) {
      const amt = num(`${p}_${tKey}`, 0), mods = reg.mods.get(`${p}_${tKey}`) ?? [];
      if (amt || mods.length) targets.push({ target: tName, amt, mods });
    }
    if (!targets.length) continue;
    reg.lfos.push({ wave: num(`${p}_wave`, 0), freq: num(`${p}_freq`, 0), freqMods: reg.mods.get(`${p}_freq`) ?? [],
      delay: num(`${p}_delay`, 0), delayMods: reg.mods.get(`${p}_delay`) ?? [], fade: num(`${p}_fade`, 0), fadeMods: reg.mods.get(`${p}_fade`) ?? [],
      phase: num(`${p}_phase`, 0), targets });
  }
  return reg;
}

// ------------------------------------------------------------------ instrument loading
const instCache = new Map();
export function loadSfzInstrument(idOrPath, extraOverride = null) {
  const file = resolveSfzPath(idOrPath);
  const override = { ...(SFZ_INSTRUMENTS[idOrPath]?.override ?? {}), ...(extraOverride ?? {}) };
  const key = `${file}|${JSON.stringify(override)}`;
  if (instCache.has(key)) return instCache.get(key);
  const parsed = parseSfz(file);
  const regions = parsed.regions.map((r, i) => compileRegion(Object.keys(override).length ? { ...r, ...override } : r, i));
  const exists = new Map();
  let missing = 0;
  const usable = regions.filter((r) => {
    if (r.generator) return false;
    if (!r.sample) return false;
    if (!exists.has(r.sample)) exists.set(r.sample, fs.existsSync(r.sample));
    if (!exists.get(r.sample)) { missing++; return false; }
    return true;
  });
  const usesCC = new Set();
  for (const r of usable) {
    for (const [, list] of r.mods) for (const m of list) usesCC.add(m.cc);
    for (const c of r.ccConds) usesCC.add(c.cc);
    for (const x of r.xfCC) usesCC.add(x.cc);
  }
  const inst = { file, parsed, regions: usable, missing, usesCC, curve: makeCurveFn(parsed.curves), ccInit: parsed.ccInit, id: idOrPath };
  instCache.set(key, inst);
  return inst;
}

const sampleCache = new Map();
function getSample(file) {
  let s = sampleCache.get(file);
  if (s) return s;
  let w;
  if (/\.wav$/i.test(file)) {
    try { w = readWav(file); } catch { w = decodeAudioFile(file, { sampleRate: 0, channels: 0 }); }
  } else {
    w = decodeAudioFile(file, { sampleRate: 0, channels: 0 });
    const sm = /\.flac$/i.test(file) ? readFlacSmpl(file) : null;
    if (sm) { w.loops = sm.loops; w.unityNote = sm.unityNote; }
  }
  s = { ch: w.channels.slice(0, 2), sr: w.sampleRate, n: w.numFrames, loops: w.loops ?? [], unity: w.unityNote };
  sampleCache.set(file, s);
  return s;
}

// ------------------------------------------------------------------ voice
const LN1000 = Math.log(1000);
class Env {
  constructor(p, sr) {
    this.sr = sr;
    this.delayN = Math.round(Math.max(0, p.delay) * sr);
    this.attackN = Math.max(1, Math.round(Math.max(0, p.attack) * sr));
    this.holdN = Math.round(Math.max(0, p.hold) * sr);
    this.sus = Math.max(0, Math.min(1, p.sustain / 100));
    this.decayCoef = p.decay > 0 ? Math.exp(-5 / (p.decay * sr)) : 0;
    this.release = Math.max(0.0015, p.release);
    this.start = Math.max(0, Math.min(1, (p.start ?? 0) / 100));
    this.stage = this.delayN > 0 ? 0 : 1;
    this.count = 0;
    this.level = this.stage === 1 ? this.start : 0;
    this.relCoef = 0;
  }
  noteOff(releaseSec) {
    if (this.stage === 5) return;
    const r = Math.max(0.0015, releaseSec ?? this.release);
    this.relCoef = Math.exp(-LN1000 * 1.33 / (r * this.sr)); // ~ -80 dB after `r`
    this.stage = 5;
  }
  next() {
    switch (this.stage) {
      case 0: if (++this.count >= this.delayN) { this.stage = 1; this.count = 0; this.level = this.start; } return 0;
      case 1: this.level = this.start + (1 - this.start) * (++this.count / this.attackN); if (this.count >= this.attackN) { this.level = 1; this.stage = 2; this.count = 0; } return this.level;
      case 2: if (++this.count >= this.holdN) { this.stage = 3; } return 1;
      case 3: this.level = this.sus + (this.level - this.sus) * this.decayCoef; if (Math.abs(this.level - this.sus) < 1e-5) { this.level = this.sus; this.stage = 4; } return this.level;
      case 4: return this.level;
      case 5: this.level *= this.relCoef; return this.level;
      default: return 0;
    }
  }
  get done() { return this.stage === 5 && this.level < 1e-4; }
}

function lfoWave(w, ph) {
  const p = ph - Math.floor(ph);
  switch (w) {
    case 1: return Math.sin(2 * Math.PI * p);
    case 2: return p < 0.75 ? 1 : -1;
    case 3: return p < 0.5 ? 1 : -1;
    case 4: return p < 0.25 ? 1 : -1;
    case 5: return p < 0.125 ? 1 : -1;
    case 6: return 2 * p - 1;
    case 7: return 1 - 2 * p;
    default: return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4; // triangle
  }
}

// ------------------------------------------------------------------ track rendering
/**
 * renderSfzTrack(track, { sampleRate, duration, blockSize }) -> { channels, info }
 * track: { sfz: id|path, notes, cc, bend, bendRange? (default 2), transpose?, keymap?, ccInit?: {cc: 0..127},
 *          sfzOverride?: { opcode: value } (applied to every region, e.g. { loop_mode:'loop_sustain' }), seed? }
 */
export async function renderSfzTrack(track, opts = {}) {
  const sr = opts.sampleRate ?? 48000;
  const total = Math.round(opts.duration * sr);
  const B = opts.blockSize ?? 32;
  const warnings = [];
  const warn = opts.warn ?? ((m) => { warnings.push(m); console.warn('  ! ' + m); });
  const inst = loadSfzInstrument(track.sfz, track.sfzOverride);
  const curve = inst.curve;
  const rand = mulberry32(track.seed ?? 0x51f2);
  if (inst.missing) warnings.push(`${inst.missing} regions skipped (sample files not present)`);

  // CC state (0..1), 128 + extended handled via note context
  const cc = new Float64Array(128);
  cc[7] = 100 / 127; cc[10] = 0.5; cc[11] = 1;
  const profile = SFZ_INSTRUMENTS[track.sfz] ?? Object.values(SFZ_INSTRUMENTS).find((x) => path.join(SFZ_DIR, x.file) === inst.file);
  for (const [k, v] of inst.ccInit) cc[k] = v;
  for (const [k, v] of Object.entries(profile?.cc ?? {})) cc[+k] = v / 127;
  for (const [k, v] of Object.entries(track.ccInit ?? {})) cc[+k] = v / 127;
  let ccVersion = 0;
  const chanVol = !inst.usesCC.has(7), chanExpr = !inst.usesCC.has(11), chanPan = !inst.usesCC.has(10);
  const bendRangeCents = (track.bendRange ?? 2) * 100; // same default as the SF2 path (overrides the SFZ's own bend_up/down)

  // ---- events
  const ev = [];
  const tr = track.transpose ?? 0;
  const keymap = track.keymap ?? null;
  for (const n of track.notes ?? []) {
    if (!(n.d > 0)) continue;
    let p = Math.round(n.p + tr);
    if (keymap && keymap[p] != null) p = keymap[p];
    const s = Math.max(0, Math.round(n.t * sr));
    if (s >= total) continue;
    ev.push({ s, o: 4, k: 'on', p, v: Math.max(1, Math.min(127, Math.round(n.v ?? 90))), id: ev.length });
    const e = Math.max(s + 1, Math.round((n.t + n.d) * sr));
    if (e < total) ev.push({ s: e, o: 3, k: 'off', p });
  }
  const ccs = [...(track.cc ?? [])].sort((a, b) => a.t - b.t);
  const lastCC = new Map();
  for (const c of ccs) {
    const s = Math.max(0, Math.round(c.t * sr)), v = Math.max(0, Math.min(127, c.v));
    const prev = lastCC.get(c.n);
    if (c.ramp && prev && s > prev.s) {
      const step = Math.max(B, Math.round(0.004 * sr));
      for (let x = prev.s + step; x < s; x += step) ev.push({ s: x, o: 1, k: 'cc', n: c.n, v: prev.v + ((x - prev.s) / (s - prev.s)) * (v - prev.v) });
    }
    ev.push({ s, o: 1, k: 'cc', n: c.n, v });
    lastCC.set(c.n, { s, v });
  }
  // pitch bend curve (linear glides), stored per sample block later
  const bends = [...(track.bend ?? [])].sort((a, b) => a.t - b.t);
  let bendIdx = 0;
  const bendAt = (t) => { // t is monotonically non-decreasing across calls
    if (!bends.length || t < bends[0].t) return 0;
    while (bendIdx + 1 < bends.length && bends[bendIdx + 1].t <= t) bendIdx++;
    const a = bends[bendIdx], b = bends[bendIdx + 1];
    if (!b || b.curve === 'step') return a.v;
    return a.v + ((t - a.t) / (b.t - a.t)) * (b.v - a.v);
  };
  let blockBend = 0;
  ev.sort((a, b) => a.s - b.s || a.o - b.o);

  // ---- state
  const outL = new Float32Array(total), outR = new Float32Array(total);
  const voices = [];
  const held = new Map(); // key -> { vel, t0, sustained }
  let sustainDown = false;
  let swState = null;
  for (const r of inst.regions) if (r.swDefault != null) { swState = r.swDefault; break; }
  const swLo = Math.min(...inst.regions.map((r) => r.swLo ?? 128)), swHi = Math.max(...inst.regions.map((r) => r.swHi ?? -1));
  let lastKey = null, alternate = 0, noteOnSerial = 0;
  let maxVoices = 0, notesPlayed = 0, silentNotes = 0;

  const ccVal = (n, ctx) => {
    if (n < 128) return cc[n];
    switch (n) {
      case 131: return ctx.vel / 127;
      case 132: return ctx.relVel ?? 0;
      case 133: return ctx.key / 127;
      case 134: return held.size > 0 ? 1 : 0;
      case 135: return ctx.rUni;
      case 136: return ctx.rBi;
      case 137: return ctx.alt;
      case 140: return ctx.keyDelta / 127;
      case 141: return Math.abs(ctx.keyDelta) / 127;
      default: return 0;
    }
  };
  const modSum = (reg, target, ctx) => {
    const list = reg.mods.get(target);
    if (!list) return 0;
    let s = 0;
    for (const m of list) s += m.amt * curve(m.curve, ccVal(m.cc, ctx));
    return s;
  };
  const ampProduct = (reg, ctx) => {
    const list = reg.mods.get('amplitude');
    if (!list) return 1;
    let g = 1;
    for (const m of list) g *= (m.amt / 100) * curve(m.curve, ccVal(m.cc, ctx));
    return g;
  };
  const xfGain = (reg, ctx) => {
    let g = 1;
    for (const x of reg.xfCC) {
      const v = ccVal(x.cc, ctx) * 127;
      if (x.dir === 'in') { if (v <= x.lo) return 0; if (v < x.hi) g *= Math.sqrt((v - x.lo) / (x.hi - x.lo)); }
      else { if (v >= x.hi) return 0; if (v > x.lo) g *= Math.sqrt(1 - (v - x.lo) / (x.hi - x.lo)); }
    }
    const vel = ctx.vel;
    if (reg.xfinHivel > reg.xfinLovel) { if (vel <= reg.xfinLovel) return 0; if (vel < reg.xfinHivel) g *= Math.sqrt((vel - reg.xfinLovel) / (reg.xfinHivel - reg.xfinLovel)); }
    if (reg.xfoutHivel > reg.xfoutLovel && reg.xfoutLovel < 127) { if (vel >= reg.xfoutHivel) return 0; if (vel > reg.xfoutLovel) g *= Math.sqrt(1 - (vel - reg.xfoutLovel) / (reg.xfoutHivel - reg.xfoutLovel)); }
    return g;
  };
  const velGain = (reg, ctx) => {
    const v = ctx.vel;
    let c;
    if (reg.velcurve) {
      const p = reg.velcurve;
      let k = 0;
      while (k < p.length - 1 && p[k + 1][0] < v) k++;
      const [x0, y0] = p[k], [x1, y1] = p[Math.min(k + 1, p.length - 1)];
      c = x1 === x0 ? y1 : y0 + ((v - x0) / (x1 - x0)) * (y1 - y0);
      return c;
    }
    c = (v / 127) ** 2;
    const vt = (reg.ampVeltrack + modSum(reg, 'amp_veltrack', ctx)) / 100;
    return vt >= 0 ? 1 - vt + vt * c : 1 + vt * c;
  };

  function releaseVoice(v, mode) {
    if (v.released) return;
    v.released = true;
    v.fenv?.noteOff();
    if (mode === 'fast') v.env.noteOff(Math.max(0.004, v.reg.offTime ?? 0.006));
    else if (mode === 'time') v.env.noteOff(v.reg.offTime);
    else v.env.noteOff();
  }

  function startVoice(reg, ctx, at, gainMul = 1) {
    const smp = getSample(reg.sample);
    const kc = reg.keycenter ?? smp.unity ?? 60;
    const bu = bendRangeCents ?? reg.bendUp, bd = bendRangeCents != null ? -bendRangeCents : reg.bendDown;
    const baseCents = (ctx.key - kc) * reg.keytrack + reg.tune + reg.transpose * 100 + reg.pitchRandom * (2 * ctx.r2 - 1) + reg.pitchVeltrack * (ctx.vel / 127);
    let loopMode = reg.loopMode;
    let ls = reg.loopStart, le = reg.loopEnd;
    if (ls == null && smp.loops.length) { ls = smp.loops[0].start; le = smp.loops[0].end; }
    if (le != null) le = Math.min(le, smp.n - 1);
    if (ls != null) ls = Math.max(0, Math.min(ls, (le ?? smp.n - 1) - 1));
    if (!loopMode) loopMode = ls != null && le != null && le > ls ? 'loop_continuous' : 'no_loop';
    if ((loopMode === 'loop_continuous' || loopMode === 'loop_sustain') && !(le > ls)) loopMode = 'no_loop';
    const endIdx = Math.min(smp.n - 1, reg.end != null && reg.end > 0 ? reg.end : smp.n - 1);
    let off = reg.offset + reg.offsetRandom * ctx.r3 + modSum(reg, 'offset', ctx);
    off = Math.max(0, Math.min(endIdx - 1, Math.round(off)));
    const amp = {
      delay: reg.ampeg.delay + modSum(reg, 'ampeg_delay', ctx),
      start: reg.ampeg.start + modSum(reg, 'ampeg_start', ctx),
      attack: reg.ampeg.attack + modSum(reg, 'ampeg_attack', ctx),
      hold: reg.ampeg.hold + modSum(reg, 'ampeg_hold', ctx),
      decay: reg.ampeg.decay + modSum(reg, 'ampeg_decay', ctx),
      sustain: reg.ampeg.sustain + modSum(reg, 'ampeg_sustain', ctx),
      release: reg.ampeg.release + modSum(reg, 'ampeg_release', ctx),
    };
    const fe = reg.fileg;
    const hasFileg = fe.depth !== 0 || reg.mods.has('fileg_depth');
    const v = {
      reg, smp, key: ctx.key, vel: ctx.vel, ctx, serial: ctx.serial,
      pos: off, endIdx, loopMode, ls, le, baseCents, bu, bd,
      env: new Env(amp, sr),
      fenv: hasFileg ? new Env({ delay: fe.delay, start: fe.start, attack: fe.attack, hold: fe.hold, decay: fe.decay, sustain: fe.sustain, release: fe.release }, sr) : null,
      filDepth: fe.depth + modSum(reg, 'fileg_depth', ctx),
      noteGain: gainMul * velGain(reg, ctx) * Math.pow(10, (reg.volume + reg.ampRandom * ctx.r4) / 20) * (reg.amplitude / 100),
      delayN: Math.round((reg.delay + reg.delayRandom * ctx.r5 + modSum(reg, 'delay', ctx)) * sr) + at,
      released: false, done: false, lastGainL: null, lastGainR: null,
      fs: [0, 0, 0, 0], // filter states (2 ch x 2)
      lfoPh: reg.lfos.map((l) => l.phase ?? 0), t: 0,
      ccVer: -1, contGain: 1, contPan: 0, contTune: 0, contCut: 0, contWidth: 0,
    };
    // choke: this voice's group turns off voices whose off_by == group (from earlier note-ons)
    for (const o of voices) if (!o.released && o.reg.offBy != null && o.reg.offBy === reg.group && o.serial !== ctx.serial) releaseVoice(o, o.reg.offMode);
    if (reg.polyphony > 0) {
      const same = voices.filter((o) => !o.released && o.reg.group === reg.group);
      while (same.length && same.length >= reg.polyphony) releaseVoice(same.shift(), 'fast');
    }
    if (reg.notePolyphony > 0) {
      const same = voices.filter((o) => !o.released && o.key === ctx.key && o.reg.group === reg.group && o.serial !== ctx.serial);
      while (same.length && same.length >= reg.notePolyphony) releaseVoice(same.shift(), 'fast');
    }
    voices.push(v);
    return v;
  }

  function noteOn(key, vel) {
    if (key >= swLo && key <= swHi) { swState = key; return; }
    if (held.has(key)) noteOff(key);
    const serial = ++noteOnSerial;
    const r = rand();
    const ctx = { key, vel, serial, rUni: r, rBi: 2 * r - 1, alt: alternate, keyDelta: lastKey == null ? 0 : key - lastKey, r2: rand(), r3: rand(), r4: rand() * 2 - 1, r5: rand() };
    alternate = 1 - alternate;
    const othersHeld = [...held.keys()].some((k) => k !== key);
    let started = 0;
    for (const reg of inst.regions) {
      if (key < reg.lokey || key > reg.hikey || vel < reg.lovel || vel > reg.hivel) continue;
      if (reg.trigger === 'release' || reg.trigger === 'release_key') continue;
      if (reg.trigger === 'first' && othersHeld) continue;
      if (reg.trigger === 'legato' && !othersHeld) continue;
      if (reg.swLast != null && swState !== reg.swLast) continue;
      let ok = true;
      for (const c of reg.ccConds) { const v = ccVal(c.cc, ctx) * 127; if (v < c.lo - 1e-6 || v > c.hi + 1e-6) { ok = false; break; } }
      if (!ok) continue;
      if (r < reg.lorand || r >= reg.hirand) { if (!(reg.hirand >= 1 && r >= reg.lorand)) continue; }
      if (reg.seqLength > 1) { const hit = reg.seqCounter % reg.seqLength === reg.seqPosition - 1; reg.seqCounter++; if (!hit) continue; }
      startVoice(reg, ctx, 0);
      started++;
    }
    if (!started) silentNotes++;
    notesPlayed++;
    held.set(key, { vel, t0: pos, ctx, sustained: false });
    lastKey = key;
  }

  function noteOff(key) {
    const h = held.get(key);
    if (!h) return;
    held.delete(key);
    for (const v of voices) {
      if (v.key !== key || v.released || v.loopMode === 'one_shot') continue;
      if (v.ctx.serial !== h.ctx.serial) continue;
      if (sustainDown) { v.sustained = true; continue; }
      releaseVoice(v, 'normal');
    }
    // release-triggered regions
    const heldSec = (pos - h.t0) / sr;
    for (const reg of inst.regions) {
      if (reg.trigger !== 'release') continue;
      if (key < reg.lokey || key > reg.hikey || h.vel < reg.lovel || h.vel > reg.hivel) continue;
      let ok = true;
      for (const c of reg.ccConds) { const v = ccVal(c.cc, h.ctx) * 127; if (v < c.lo || v > c.hi) { ok = false; break; } }
      if (!ok) continue;
      startVoice(reg, { ...h.ctx, serial: ++noteOnSerial }, 0, Math.pow(10, (-reg.rtDecay * heldSec) / 20));
    }
  }

  function renderVoice(v, start, n) {
    const { reg, smp } = v;
    const ctx = v.ctx;
    // continuous modulation (re-evaluated when CCs change)
    if (v.ccVer !== ccVersion) {
      v.ccVer = ccVersion;
      let g = ampProduct(reg, ctx) * xfGain(reg, ctx) * Math.pow(10, modSum(reg, 'volume', ctx) / 20);
      if (chanVol) g *= cc[7] * cc[7] * 1.6129; // (cc7)^2 normalised so the default 100 = unity
      if (chanExpr) g *= cc[11] * cc[11];
      v.contGain = g;
      v.contPan = reg.pan + modSum(reg, 'pan', ctx) + (chanPan ? (cc[10] - 0.5) * 200 : 0);
      v.contTune = modSum(reg, 'tune', ctx);
      v.contCut = modSum(reg, 'cutoff', ctx);
      v.contWidth = reg.width + modSum(reg, 'width', ctx);
    }
    let i = 0;
    if (v.delayN > 0) {
      const d = Math.min(v.delayN, n);
      v.delayN -= d; i = d;
      if (i >= n) return;
    }
    const tSec = (start + i) / sr;
    // LFOs
    let lfoCents = 0, lfoDb = 0, lfoAmp = 1, lfoCut = 0, lfoPan = 0;
    for (let k = 0; k < reg.lfos.length; k++) {
      const L = reg.lfos[k];
      let freq = L.freq;
      for (const m of L.freqMods) freq += m.amt * curve(m.curve, ccVal(m.cc, ctx));
      let delay = L.delay;
      for (const m of L.delayMods ?? []) delay += m.amt * curve(m.curve, ccVal(m.cc, ctx));
      let fade = L.fade;
      for (const m of L.fadeMods ?? []) fade += m.amt * curve(m.curve, ccVal(m.cc, ctx));
      const age = v.t / sr;
      let depthScale = age < delay ? 0 : fade > 0 ? Math.min(1, (age - delay) / fade) : 1;
      const w = lfoWave(L.wave, v.lfoPh[k]);
      v.lfoPh[k] += (freq * n) / sr;
      if (!depthScale) continue;
      for (const T of L.targets) {
        let amt = T.amt;
        for (const m of T.mods) amt += m.amt * curve(m.curve, ccVal(m.cc, ctx));
        const val = w * amt * depthScale;
        if (T.target === 'pitch') lfoCents += val;
        else if (T.target === 'volume') lfoDb += val;
        else if (T.target === 'amplitude') lfoAmp *= 1 + val / 100;
        else if (T.target === 'cutoff') lfoCut += val;
        else if (T.target === 'pan') lfoPan += val;
      }
    }
    void tSec;
    const b = blockBend;
    const bendCents = b >= 0 ? b * v.bu : -b * v.bd;
    const cents = v.baseCents + v.contTune + bendCents + lfoCents;
    const inc = (smp.sr / sr) * Math.pow(2, cents / 1200);
    // gains
    const pan = Math.max(-100, Math.min(100, v.contPan + lfoPan)) / 100;
    const g = v.noteGain * v.contGain * lfoAmp * Math.pow(10, lfoDb / 20);
    const stereo = smp.ch.length > 1;
    let gl, gr;
    if (stereo) { gl = g * Math.min(1, 1 - pan); gr = g * Math.min(1, 1 + pan); }
    else { const th = ((pan + 1) * Math.PI) / 4; gl = g * Math.cos(th) * Math.SQRT2; gr = g * Math.sin(th) * Math.SQRT2; }
    if (v.lastGainL == null) { v.lastGainL = gl; v.lastGainR = gr; }
    const width = v.contWidth / 100;
    // filter coefficients for this block
    let fType = reg.filType, fa = 0, fk = 0, fg = 0;
    if (fType && reg.cutoff != null) {
      let cutCents = v.contCut + lfoCut + reg.filKeytrack * (v.key - reg.filKeycenter) + reg.filVeltrack * (v.vel / 127);
      if (v.fenv) { let fl = 0; for (let s = 0; s < n; s++) fl = v.fenv.next(); cutCents += v.filDepth * fl; }
      const fc = Math.max(10, Math.min(sr * 0.45, reg.cutoff * Math.pow(2, cutCents / 1200)));
      fg = Math.tan((Math.PI * fc) / sr);
      if (fType.endsWith('_1p')) fa = fg / (1 + fg);
      else { const Q = Math.SQRT1_2 * Math.pow(10, reg.resonance / 20); fk = 1 / Q; fa = 1 / (1 + fg * (fg + fk)); }
    } else fType = null;
    const ch0 = smp.ch[0], ch1 = stereo ? smp.ch[1] : null;
    const looping = v.loopMode === 'loop_continuous' || (v.loopMode === 'loop_sustain' && !v.released);
    const ls = v.ls, le = v.le, loopLen = looping ? le - ls + 1 : 0;
    const dGl = (gl - v.lastGainL) / (n - i), dGr = (gr - v.lastGainR) / (n - i);
    let cgl = v.lastGainL, cgr = v.lastGainR;
    let pos = v.pos;
    const fs = v.fs, endIdx = v.endIdx;
    for (; i < n; i++) {
      const e = v.env.next();
      cgl += dGl; cgr += dGr;
      if (pos > endIdx) { v.done = true; break; }
      const i0 = Math.floor(pos), t = pos - i0;
      let jm1 = i0 - 1, j1 = i0 + 1, j2 = i0 + 2;
      if (jm1 < 0) jm1 = 0;
      if (looping) { if (j1 > le) j1 -= loopLen; if (j2 > le) j2 -= loopLen; }
      else { if (j1 > endIdx) j1 = endIdx; if (j2 > endIdx) j2 = endIdx; }
      let a = hermite4(ch0[jm1], ch0[i0], ch0[j1], ch0[j2], t);
      let c2 = ch1 ? hermite4(ch1[jm1], ch1[i0], ch1[j1], ch1[j2], t) : a;
      if (fType) {
        if (fType.endsWith('_1p')) {
          const va = (a - fs[0]) * fa, ya = va + fs[0]; fs[0] = ya + va;
          const vb = (c2 - fs[2]) * fa, yb = vb + fs[2]; fs[2] = yb + vb;
          if (fType.startsWith('hpf')) { a = a - ya; c2 = c2 - yb; } else { a = ya; c2 = yb; }
        } else {
          // TPT state variable filter (Zavalishin)
          let hp = (a - (fk + fg) * fs[0] - fs[1]) * fa, bp = fg * hp + fs[0]; fs[0] = fg * hp + bp;
          let lp = fg * bp + fs[1]; fs[1] = fg * bp + lp;
          const oa = fType.startsWith('hpf') ? hp : fType.startsWith('bpf') ? bp * fk : lp;
          hp = (c2 - (fk + fg) * fs[2] - fs[3]) * fa; bp = fg * hp + fs[2]; fs[2] = fg * hp + bp;
          lp = fg * bp + fs[3]; fs[3] = fg * bp + lp;
          const ob = fType.startsWith('hpf') ? hp : fType.startsWith('bpf') ? bp * fk : lp;
          a = oa; c2 = ob;
        }
      }
      if (stereo && width !== 1) { const m = 0.5 * (a + c2), s = 0.5 * (a - c2) * width; a = m + s; c2 = m - s; }
      const idx = start + i;
      outL[idx] += a * e * cgl;
      outR[idx] += c2 * e * cgr;
      pos += inc;
      if (looping) while (pos >= le + 1) pos -= loopLen;
    }
    v.pos = pos;
    v.lastGainL = gl; v.lastGainR = gr;
    v.t += n;
    if (v.env.done) v.done = true;
  }

  // ---- main loop
  let pos = 0, ei = 0;
  const t0 = performance.now();
  while (pos < total) {
    while (ei < ev.length && ev[ei].s <= pos) {
      const e = ev[ei++];
      if (e.k === 'on') noteOn(e.p, e.v);
      else if (e.k === 'off') noteOff(e.p);
      else if (e.k === 'cc') {
        if (e.n === 64) {
          const down = e.v >= 64;
          if (sustainDown && !down) for (const v of voices) if (v.sustained && !v.released) releaseVoice(v, 'normal');
          sustainDown = down;
        }
        if (e.n < 128) { cc[e.n] = e.v / 127; ccVersion++; }
      }
    }
    const next = ei < ev.length ? ev[ei].s : total;
    const n = Math.max(1, Math.min(B, next - pos, total - pos));
    blockBend = bendAt(pos / sr);
    for (const v of voices) if (!v.done) renderVoice(v, pos, n);
    if (voices.length > 64 || voices.some((v) => v.done)) {
      for (let k = voices.length - 1; k >= 0; k--) if (voices[k].done) voices.splice(k, 1);
    }
    if (voices.length > maxVoices) maxVoices = voices.length;
    pos += n;
  }
  let peak = 0;
  for (let k = 0; k < total; k++) { const m = Math.max(Math.abs(outL[k]), Math.abs(outR[k])); if (m > peak) peak = m; }
  if (silentNotes) warn(`track ${track.id}: ${silentNotes}/${notesPlayed} notes matched no SFZ region (key out of range?)`);
  return {
    channels: [outL, outR],
    info: {
      sf: `sfz:${path.relative(SFZ_DIR, inst.file).replace(/\\/g, '/')}`, preset: path.basename(inst.file, '.sfz'), presetBank: null, presetProgram: null,
      notes: notesPlayed, maxVoices, renderMs: Math.round(performance.now() - t0), peak, warnings,
      sendAutomation: collectSendAutomation(track),
    },
  };
}

function collectSendAutomation(track) {
  const out = { reverb: [], chorus: [] };
  for (const c of track.cc ?? []) {
    if (c.n === 91) out.reverb.push({ t: c.t, v: c.v / 127, ramp: !!c.ramp });
    if (c.n === 93) out.chorus.push({ t: c.t, v: c.v / 127, ramp: !!c.ramp });
  }
  return out;
}

function hermite4(xm1, x0, x1, x2, t) {
  const c = (x1 - xm1) * 0.5;
  const v = x0 - x1;
  const w = c + v;
  const a = w + v + (x2 - x0) * 0.5;
  const b = w + a;
  return ((a * t - b) * t + c) * t + x0;
}
