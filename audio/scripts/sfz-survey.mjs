// Survey opcodes used by SFZ programs: node audio/scripts/sfz-survey.mjs file.sfz [...]
import fs from 'node:fs';
import { parseSfz, opcodeHistogram } from '../lib/sfz-parse.mjs';
const all = new Map();
for (const f of process.argv.slice(2)) {
  const p = parseSfz(f);
  const missing = p.regions.filter((r) => r._sample && !fs.existsSync(r._sample)).length;
  const keys = p.regions.map((r) => [r.lokey, r.hikey]).filter(([a]) => a != null);
  console.log(`\n${f}: ${p.regions.length} regions, missing samples ${missing}, ccInit ${[...p.ccInit].map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ')} warnings ${p.warnings.length}`);
  console.log('  keys', Math.min(...keys.map((k) => k[0])), '-', Math.max(...keys.map((k) => k[1])));
  console.log('  ' + opcodeHistogram(p).map(([k, n]) => `${k}:${n}`).join(' '));
  for (const [k, n] of opcodeHistogram(p)) all.set(k, (all.get(k) ?? 0) + n);
}
console.log('\nALL:', [...all.keys()].sort().join(' '));
