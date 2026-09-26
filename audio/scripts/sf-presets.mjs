// Dump the preset list (bank:program name + sample summary) of soundfonts to audio/assets/sf/<name>.presets.txt
// usage: node audio/scripts/sf-presets.mjs [idOrPath ...]      (default: all registered fonts)
import fs from 'node:fs';
import path from 'node:path';
import { SOUNDFONTS, resolveSoundfontPath, loadSoundBank, listPresets, presetLabel, summarizePreset, SF_DIR } from '../lib/soundfonts.mjs';

const args = process.argv.slice(2);
const targets = args.length ? args : [...new Set(Object.keys(SOUNDFONTS).map((id) => resolveSoundfontPath(id)))];

for (const t of targets) {
  const file = resolveSoundfontPath(t);
  const bank = loadSoundBank(file);
  const info = bank.soundBankInfo || {};
  const base = path.basename(file).replace(/\.(sf2|sf3|dls)$/i, '');
  const outDir = file.startsWith(SF_DIR) ? path.dirname(file) : SF_DIR;
  const out = path.join(outDir, `${base}.presets.txt`);
  const lines = [];
  lines.push(`# ${path.basename(file)}  (${(fs.statSync(file).size / 1048576).toFixed(1)} MB, ${bank.type}, ${bank.presets.length} presets, ${bank.samples.length} samples)`);
  for (const k of ['name', 'engineer', 'copyright', 'product', 'comment']) {
    if (info[k]) lines.push(`# ${k}: ${String(info[k]).replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  lines.push('# bank:program name   | zones, unique samples, velocity layers @C4, looped zones, sample length min/median/max (s), sample rates, key range');
  for (const p of listPresets(bank)) {
    const s = summarizePreset(p);
    lines.push(`${presetLabel(p).padEnd(40)} | z=${s.zones} smp=${s.uniqueSamples} vel@C4=${s.velLayersAtC4} loop=${s.loopedZones}/${s.zones} len=${s.minSeconds.toFixed(2)}/${s.medianSeconds.toFixed(2)}/${s.maxSeconds.toFixed(2)} sr=${s.sampleRates.join(',')} keys=${s.keyRange.join('-')}${s.stereo ? ' stereo' : ''}`);
  }
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(`wrote ${out} (${bank.presets.length} presets)`);
}
