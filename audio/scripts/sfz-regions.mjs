// Write a key/velocity/articulation summary for every registered SFZ instrument (the SFZ analogue of *.presets.txt).
// usage: node audio/scripts/sfz-regions.mjs [id ...]   -> audio/assets/sfz/<id>.regions.txt
import fs from 'node:fs';
import path from 'node:path';
import { SFZ_INSTRUMENTS, SFZ_DIR, loadSfzInstrument } from '../lib/sfz.mjs';

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const nn = (k) => `${NAMES[k % 12]}${Math.floor(k / 12) - 1}`;

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SFZ_INSTRUMENTS);
for (const id of ids) {
  const inst = loadSfzInstrument(id);
  const lines = [];
  lines.push(`# ${id}: ${path.relative(SFZ_DIR, inst.file).replace(/\\/g, '/')}`);
  lines.push(`# usable regions ${inst.regions.length}, skipped (missing samples) ${inst.missing}, samples ${new Set(inst.regions.map((r) => r.sample)).size}`);
  const cc = [...inst.ccInit].map(([k, v]) => `${k}=${Math.round(v * 127)}`).join(' ');
  lines.push(`# default CCs (set_cc): ${cc || '-'}${SFZ_INSTRUMENTS[id]?.cc ? `; registry overrides ${JSON.stringify(SFZ_INSTRUMENTS[id].cc)}` : ''}${SFZ_INSTRUMENTS[id]?.override ? `; region override ${JSON.stringify(SFZ_INSTRUMENTS[id].override)}` : ''}`);
  lines.push(`# CCs referenced by regions: ${[...inst.usesCC].sort((a, b) => a - b).join(' ') || '-'}`);
  lines.push('# key  name   regions  vel-splits  round-robin  triggers  loop  sample(s)');
  for (let k = 0; k < 128; k++) {
    const at = inst.regions.filter((r) => k >= r.lokey && k <= r.hikey);
    if (!at.length) continue;
    const vel = new Set(at.map((r) => `${r.lovel}-${r.hivel}`)).size;
    const rr = Math.max(...at.map((r) => Math.max(r.seqLength, r.hirand < 1 || r.lorand > 0 ? Math.round(1 / Math.max(0.01, r.hirand - r.lorand)) : 1)));
    const trig = [...new Set(at.map((r) => r.trigger))].join('/');
    const loops = [...new Set(at.map((r) => r.loopMode ?? 'file'))].join('/');
    const smp = [...new Set(at.map((r) => path.basename(r.sample)))];
    lines.push(`${String(k).padStart(3)}  ${nn(k).padEnd(5)} ${String(at.length).padStart(7)}  ${String(vel).padStart(10)}  ${String(rr).padStart(11)}  ${trig.padEnd(8)}  ${loops.padEnd(4)}  ${smp.slice(0, 3).join(', ')}${smp.length > 3 ? ` (+${smp.length - 3})` : ''}`);
  }
  const out = path.join(SFZ_DIR, `${id}.regions.txt`);
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(`wrote ${out}`);
}
