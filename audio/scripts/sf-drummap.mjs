// Print key -> sample map for a drum kit preset: node audio/scripts/sf-drummap.mjs <sf> <program> [keyFrom keyTo]
import { loadSoundBank, findPreset, describePreset } from '../lib/soundfonts.mjs';
const [sfId, prog, k0 = 24, k1 = 90] = process.argv.slice(2);
const bank = loadSoundBank(sfId);
const p = findPreset(bank, { bank: 128, program: +prog });
if (!p) { console.log('no preset'); process.exit(1); }
const layers = describePreset(p);
console.log(`${sfId} 128:${prog} ${p.name}`);
for (let k = +k0; k <= +k1; k++) {
  const ls = layers.filter((l) => k >= l.keyRange[0] && k <= l.keyRange[1]);
  if (!ls.length) continue;
  const names = [...new Set(ls.map((l) => `${l.sample}${l.velRange[0] > 0 || l.velRange[1] < 127 ? `(v${l.velRange[0]}-${l.velRange[1]})` : ''}`))];
  const secs = Math.max(...ls.map((l) => l.seconds)).toFixed(2);
  console.log(String(k).padStart(3), `${secs}s`.padStart(7), names.slice(0, 8).join(', '));
}
