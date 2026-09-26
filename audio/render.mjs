#!/usr/bin/env node
// audio/render.mjs — render a score module to a mixed/mastered WAV.
//
//   node audio/render.mjs <score.mjs> <out.wav> [options]
//
// The score module's default export is a score object, or a (possibly async) function returning one.
// Stems (float32 WAV) go to audio/build/stems/<score-name>/ and are cached by content hash.
//
// Options:
//   --stems <dir>       stem directory (default audio/build/stems/<score-name>)
//   --no-cache          re-render every stem
//   --workers <n>       parallel synth workers (default min(cpus-2, 8))
//   --only a,b          render+mix only these track ids          --mute a,b / --solo a,b   mix-time mute/solo
//   --target <lufs>     loudness target (default -14)             --ceiling <dBTP>          limiter ceiling (default -1)
//   --bits 16|24|32     output bit depth (default 24; 32 = float)
//   --no-png            skip spectrogram/waveform PNGs            --quiet
// Writes: <out.wav>, <out>.spectrogram.png, <out>.waveform.png, <out>.report.json
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { renderScore } from './lib/score.mjs';
import { mix } from './lib/mixer.mjs';
import { writeWav } from './lib/wav.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const pos = [], o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const k = a.slice(2);
    if (['no-cache', 'no-png', 'quiet'].includes(k)) o[k] = true;
    else o[k] = argv[++i];
  }
  return { pos, o };
}

export async function loadScore(file) {
  const mod = await import(pathToFileURL(path.resolve(file)).href + `?t=${Date.now()}`);
  let s = mod.default ?? mod.score;
  if (typeof s === 'function') s = await s();
  if (!s) throw new Error(`${file}: default export must be a score object or a function returning one`);
  return s;
}

export function renderPngs(wavPath, { quiet = false } = {}) {
  const base = wavPath.replace(/\.wav$/i, '');
  const spec = `${base}.spectrogram.png`, wave = `${base}.waveform.png`;
  const r1 = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', wavPath, '-lavfi',
    'showspectrumpic=s=1600x800:mode=combined:color=intensity:scale=log:fscale=log:legend=1:drange=100', spec], { windowsHide: true });
  const r2 = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', wavPath, '-lavfi',
    'showwavespic=s=1600x500:split_channels=1:colors=0x4a90d9|0xd9904a:filter=peak', '-frames:v', '1', wave], { windowsHide: true });
  if (!quiet) {
    if (r1.status === 0) console.log(`  spectrogram: ${spec}`); else console.warn('  ! spectrogram failed: ' + r1.stderr);
    if (r2.status === 0) console.log(`  waveform:    ${wave}`); else console.warn('  ! waveform failed: ' + r2.stderr);
  }
  return { spectrogram: spec, waveform: wave };
}

function fmt(x, w = 7) { return (x == null ? '-' : String(x)).padStart(w); }

export function printStemTable(stems, mixReport) {
  console.log('\n  stem            type   source                        notes  peak dBFS  actRMS  LUFS   active s   post-fader peak');
  let problems = 0;
  for (const s of stems) {
    const st = s.stats ?? {};
    const isSfz = String(s.info?.sf ?? '').startsWith('sfz:');
    const kind = isSfz ? 'sfz' : s.type;
    const src = s.type !== 'synth' ? `${s.info?.events ?? '?'} events` : isSfz ? `${s.info?.preset ?? '?'}` : `${s.info?.preset ?? '?'} [${s.info?.sf} ${s.info?.presetBank}:${s.info?.presetProgram}]`;
    const post = mixReport?.tracks?.[s.id];
    let flag = '';
    if (st.peakDb == null || st.peakDb < -60) { flag = '  <-- SILENT'; problems++; }
    else if ((s.info?.notes ?? 1) > 0 && st.activeSeconds < 0.3) { flag = '  <-- nearly silent'; problems++; }
    if (post && post.peakDb > 0) flag += '  (post-fader > 0 dBFS before master gain — fine in float)';
    console.log(`  ${s.id.padEnd(15)} ${kind.padEnd(6)} ${src.slice(0, 29).padEnd(29)} ${fmt(s.info?.notes ?? '', 5)} ${fmt(st.peakDb, 9)} ${fmt(st.activeRmsDb, 7)} ${fmt(st.lufs, 6)} ${fmt(st.activeSeconds, 8)} ${fmt(post?.peakDb, 10)}${flag}`);
  }
  return problems;
}

async function main() {
  const { pos, o } = parseArgs(process.argv.slice(2));
  if (pos.length < 2) {
    console.log('usage: node audio/render.mjs <score.mjs> <out.wav> [--no-cache] [--workers n] [--only a,b] [--mute a,b] [--solo a,b] [--target -14] [--ceiling -1] [--bits 24] [--no-png]');
    process.exit(1);
  }
  const [scoreFile, outWav] = pos;
  const t0 = performance.now();
  const score = await loadScore(scoreFile);
  const name = path.basename(scoreFile).replace(/\.m?js$/, '');
  const stemsDir = o.stems ?? path.join(HERE, 'build', 'stems', name);
  const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : null);
  console.log(`rendering ${scoreFile} (${score.tracks.length} tracks, ${score.duration ?? '?'} s) -> ${outWav}`);
  const stems = await renderScore(score, stemsDir, {
    cache: !o['no-cache'], workers: o.workers ? +o.workers : undefined, only: list(o.only), quiet: !!o.quiet,
  });
  const busConfig = structuredClone(score.mix ?? {});
  busConfig.tracks = busConfig.tracks ?? {};
  for (const id of list(o.mute) ?? []) busConfig.tracks[id] = { ...(busConfig.tracks[id] ?? {}), mute: true };
  for (const id of list(o.solo) ?? []) busConfig.tracks[id] = { ...(busConfig.tracks[id] ?? {}), solo: true };
  busConfig.master = busConfig.master ?? {};
  if (o.target != null) busConfig.master.targetLUFS = +o.target;
  if (o.ceiling != null) busConfig.master.ceiling = +o.ceiling;
  const { master, sampleRate, report } = await mix(stems, busConfig, { quiet: !!o.quiet, sampleRate: score.sampleRate ?? 48000 });
  const bits = o.bits === '32' || o.bits === 'float' ? 32 : o.bits ? +o.bits : 24;
  writeWav(outWav, master, sampleRate, bits);
  const problems = printStemTable(stems, report);
  const m = report.master;
  console.log(`\n  MASTER  integrated ${m.lufs} LUFS | true peak ${m.truePeak} dBTP | sample peak ${m.samplePeak} dBFS | LRA ${m.lra} LU | max short-term ${m.shortTermMax} LUFS`);
  console.log(`          glue GR max ${m.glueGR ?? '-'} dB (avg ${m.glueAvgGR ?? '-'}) | limiter GR max ${m.limiterGR} dB, active ${m.limiterActivePct ?? '-'}% of samples | total gain ${m.gainApplied} dB`);
  if (m.bands) console.log(`          tonal balance (energy re total): sub<60 ${m.bands.sub} dB | 60-250 ${m.bands.low} | 250-2k ${m.bands.mid} | 2k-8k ${m.bands.high} | >8k ${m.bands.air}`);
  for (const [b, r] of Object.entries(report.buses)) console.log(`          bus ${b.padEnd(8)} peak ${r.peakDb} dBFS, rms ${r.rmsDb} dBFS${r.duckGR != null ? `, duck max ${r.duckGR} dB` : ''}${r.compGR != null ? `, comp max ${r.compGR} dB` : ''}`);
  const reportPath = outWav.replace(/\.wav$/i, '') + '.report.json';
  fs.writeFileSync(reportPath, JSON.stringify({ score: scoreFile, out: outWav, stems: stems.map(({ id, type, file, info, stats, bus }) => ({ id, type, file, bus, info, stats })), mix: report }, null, 1));
  if (!o['no-png']) renderPngs(outWav);
  console.log(`  report: ${reportPath}`);
  if (problems) console.warn(`\n  ! ${problems} stem(s) look silent — check program/bank/notes`);
  console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e?.stack || e); process.exit(1); });
}
