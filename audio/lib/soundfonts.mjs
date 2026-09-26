// audio/lib/soundfonts.mjs — soundfont registry, cached loading and inspection helpers.
//
// Soundfont ids used in scores (track.sf):
//   'gm' / 'gu'  GeneralUser GS 2.0.3 (GS-style banks: bank 128 kits incl. Jazz=32, Brush=40)
//   'ms'         MuseScore_General 0.2 (MIT)  — FluidR3-derived + newer instruments, variations on banks 20+
//   'fluid'      FluidR3 GM2-2 (MIT)           — the classic Fluid R3, 30 drum kits
//   ...plus any extra fonts registered in audio/assets/sf/extra (see registerSoundfont / EXTRA_FONTS)
// A track may also give a path to any .sf2/.sf3/.dls file directly as `sf`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SoundBankLoader, GeneratorTypes } from 'spessasynth_core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const AUDIO_ROOT = path.resolve(HERE, '..');
export const SF_DIR = path.join(AUDIO_ROOT, 'assets', 'sf');

export const SOUNDFONTS = {
  gm: 'GeneralUser-GS.sf2',
  gu: 'GeneralUser-GS.sf2',
  ms: 'MuseScore_General.sf2',
  fluid: 'FluidR3_GM2-2.sf2',
};

// Extra dedicated fonts (filled in after evaluation; see INSTRUMENTS.md). Paths relative to SF_DIR.
const EXTRA_JSON = path.join(SF_DIR, 'extra', 'registry.json');
if (fs.existsSync(EXTRA_JSON)) {
  try {
    const extra = JSON.parse(fs.readFileSync(EXTRA_JSON, 'utf8'));
    for (const [id, rel] of Object.entries(extra)) if (!(id in SOUNDFONTS)) SOUNDFONTS[id] = rel;
  } catch (e) {
    console.warn('soundfonts: could not read extra/registry.json:', e.message);
  }
}

export function registerSoundfont(id, filePath) {
  SOUNDFONTS[id] = filePath;
}

export function resolveSoundfontPath(idOrPath) {
  if (SOUNDFONTS[idOrPath]) {
    const p = SOUNDFONTS[idOrPath];
    return path.isAbsolute(p) ? p : path.join(SF_DIR, p);
  }
  if (fs.existsSync(idOrPath)) return path.resolve(idOrPath);
  const inDir = path.join(SF_DIR, idOrPath);
  if (fs.existsSync(inDir)) return inDir;
  throw new Error(`Unknown soundfont '${idOrPath}'. Known ids: ${Object.keys(SOUNDFONTS).join(', ')}`);
}

const cache = new Map();
export function loadSoundBank(idOrPath) {
  const file = resolveSoundfontPath(idOrPath);
  if (cache.has(file)) return cache.get(file);
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const bank = SoundBankLoader.fromArrayBuffer(ab);
  cache.set(file, bank);
  return bank;
}

export function presetBank(p) {
  return p.isGMGSDrum ? 128 : p.bankMSB;
}

export function presetLabel(p) {
  const bank = presetBank(p);
  const lsb = p.bankLSB ? `.${p.bankLSB}` : '';
  return `${String(bank).padStart(3, '0')}${lsb}:${String(p.program).padStart(3, '0')} ${p.name}${p.isDrum ? '  [drum]' : ''}`;
}

export function listPresets(bank) {
  return [...bank.presets].sort((a, b) => presetBank(a) - presetBank(b) || a.bankLSB - b.bankLSB || a.program - b.program);
}

export function findPreset(bank, { bank: b = 0, program = 0, bankLSB = 0 } = {}) {
  const want = b ?? 0;
  return bank.presets.find((p) => presetBank(p) === want && p.program === program && (p.bankLSB || 0) === (bankLSB || 0)) || null;
}

export function findPresetsByName(bank, re) {
  const rx = re instanceof RegExp ? re : new RegExp(re, 'i');
  return listPresets(bank).filter((p) => rx.test(p.name));
}

function rangeOf(z, key) {
  const r = z[key];
  return r && r.min >= 0 ? [r.min, r.max] : [0, 127];
}
function intersect(a, b) {
  return [Math.max(a[0], b[0]), Math.min(a[1], b[1])];
}

// Flatten a preset into its sounding layers with sample properties.
export function describePreset(preset) {
  const layers = [];
  for (const pz of preset.zones) {
    const inst = pz.instrument;
    const pk = rangeOf(pz, 'keyRange');
    const pv = rangeOf(pz, 'velRange');
    for (const iz of inst.zones) {
      const k = intersect(pk, rangeOf(iz, 'keyRange'));
      const v = intersect(pv, rangeOf(iz, 'velRange'));
      if (k[0] > k[1] || v[0] > v[1]) continue;
      const s = iz.sample;
      let len = 0;
      try { len = s.getAudioData().length; } catch { len = 0; }
      const mode = iz.getGenerator(GeneratorTypes.sampleModes, inst.globalZone.getGenerator(GeneratorTypes.sampleModes, 0));
      const loopStart = s.loopStart + iz.getGenerator(GeneratorTypes.startloopAddrsOffset, 0) + 32768 * iz.getGenerator(GeneratorTypes.startloopAddrsCoarseOffset, 0);
      const loopEnd = s.loopEnd + iz.getGenerator(GeneratorTypes.endloopAddrsOffset, 0) + 32768 * iz.getGenerator(GeneratorTypes.endloopAddrsCoarseOffset, 0);
      const rootKey = iz.getGenerator(GeneratorTypes.overridingRootKey, -1) >= 0 ? iz.getGenerator(GeneratorTypes.overridingRootKey, -1) : s.originalKey;
      layers.push({
        instrument: inst.name,
        sample: s.name,
        keyRange: k,
        velRange: v,
        rootKey,
        sampleRate: s.sampleRate,
        length: len,
        seconds: len / s.sampleRate,
        loopMode: mode, // 0 none, 1 loop, 3 loop until release
        loopStart,
        loopEnd,
        loopSeconds: (loopEnd - loopStart) / s.sampleRate,
        stereo: s.sampleType !== 1 && !!s.linkedSample,
        compressed: s.isCompressed,
        attenuation: iz.getGenerator(GeneratorTypes.initialAttenuation, 0),
      });
    }
  }
  return layers;
}

export function summarizePreset(preset) {
  const layers = describePreset(preset);
  const samples = new Set(layers.map((l) => l.sample));
  const velSplits = new Set();
  for (const l of layers) velSplits.add(`${l.velRange[0]}-${l.velRange[1]}`);
  // count velocity layers at the middle key (C4) as the most representative
  const at = (key) => layers.filter((l) => key >= l.keyRange[0] && key <= l.keyRange[1]);
  const velLayersAt = (key) => new Set(at(key).map((l) => `${l.velRange[0]}-${l.velRange[1]}`)).size;
  const looped = layers.filter((l) => l.loopMode === 1 || l.loopMode === 3).length;
  const secs = layers.map((l) => l.seconds).sort((a, b) => a - b);
  const rates = [...new Set(layers.map((l) => l.sampleRate))];
  const keys = layers.length ? [Math.min(...layers.map((l) => l.keyRange[0])), Math.max(...layers.map((l) => l.keyRange[1]))] : [0, 0];
  return {
    name: preset.name,
    bank: presetBank(preset),
    program: preset.program,
    zones: layers.length,
    uniqueSamples: samples.size,
    velLayersAtC4: velLayersAt(60),
    velLayersAtC3: velLayersAt(48),
    velLayersAtC5: velLayersAt(72),
    distinctVelRanges: velSplits.size,
    loopedZones: looped,
    minSeconds: secs[0] ?? 0,
    medianSeconds: secs[Math.floor(secs.length / 2)] ?? 0,
    maxSeconds: secs[secs.length - 1] ?? 0,
    sampleRates: rates,
    stereo: layers.some((l) => l.stereo),
    keyRange: keys,
    samplesPerOctave: +(samples.size / Math.max(1, (keys[1] - keys[0] + 1) / 12)).toFixed(2),
  };
}
