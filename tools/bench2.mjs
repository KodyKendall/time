import { spawnSync } from 'node:child_process';
const [w = '3840', kind = 'hatch', n = '8'] = process.argv.slice(2);
const js = `(async () => {
  window.BENCH_KIND = '${kind}';
  for (let i = 0; i < ${n}; i++) await TIME.frame(1 + i / 30);
  const same = []; for (let i = 0; i < 3; i++) { await TIME.frame(1); }
  return JSON.stringify(window.BENCH['${kind}'].map(x => +x.toFixed(0)));
})()`;
const r = spawnSync('node', ['tools/cli.mjs', 'eval', '--film', 'benchfilm', '--w', w, '--js', js], { encoding: 'utf8', timeout: 600000 });
console.log(r.stdout.split('\n').filter(l => !l.includes('favicon') && !l.includes('404')).join('\n'), r.stderr);
