// Runs the brush benchmark film at a given width and prints per-operation timings.
import { spawnSync } from 'node:child_process';
const w = process.argv[2] || '3840';
const js = `(async () => {
  const out = {};
  // base: composite + post + readback, no dynamic layer
  window.BENCH_KIND = null;
  await TIME.frame(0.0); const b0 = performance.now();
  for (let i = 1; i <= 5; i++) await TIME.frame(i / 30);
  out.base_frame_ms = ((performance.now() - b0) / 5).toFixed(1);
  const rb0 = performance.now(); for (let i = 0; i < 5; i++) TIME.engine.post.read(TIME._buf || (TIME._buf = new Uint8Array(TIME.W * TIME.H * 4))); out.readback_ms = ((performance.now() - rb0) / 5).toFixed(1);
  for (const k of ['strokes40','lines200','fills6','bigfill','wash12','hatch']) {
    window.BENCH_KIND = k;
    for (let i = 0; i < 6; i++) await TIME.frame(1 + i / 30);
    const arr = window.BENCH[k].slice(1);
    out[k] = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) + ' ms (first ' + window.BENCH[k][0].toFixed(0) + ')';
  }
  return JSON.stringify(out, null, 1);
})()`;
const r = spawnSync('node', ['tools/cli.mjs', 'eval', '--film', 'benchfilm', '--w', w, '--js', js], { encoding: 'utf8', timeout: 600000 });
console.log(r.stdout, r.stderr);
