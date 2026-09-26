// Summarise every entry of lib/instruments.mjs: key range, sample count, looping, sample lengths (max safe note length).
// usage: node audio/scripts/instrument-facts.mjs [--json]
import fs from 'node:fs';
import { INSTRUMENTS } from '../lib/instruments.mjs';
import { loadSoundBank, findPreset, describePreset } from '../lib/soundfonts.mjs';
import { loadSfzInstrument } from '../lib/sfz.mjs';
import { readFlacSmpl, parseSmplChunk } from '../lib/wav.mjs';
import { spawnSync } from 'node:child_process';

function wavInfo(file) {
  // header-only parse: frames, rate, loops
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(Math.min(fs.fstatSync(fd).size, 1 << 20));
  fs.readSync(fd, head, 0, head.length, 0);
  let size = fs.fstatSync(fd).size;
  let o = 12, sr = 0, block = 1, frames = 0, loops = [];
  while (o + 8 <= head.length) {
    const id = head.toString('ascii', o, o + 4), sz = head.readUInt32LE(o + 4);
    if (id === 'fmt ') { sr = head.readUInt32LE(o + 12); block = head.readUInt16LE(o + 20); }
    if (id === 'data') { frames = Math.floor(Math.min(sz, size - o - 8) / block); }
    if (id === 'smpl') loops = parseSmplChunk(head, o + 8, sz).loops;
    o += 8 + sz + (sz & 1);
    if (id === 'data' && o > head.length) {
      // smpl after data: read tail
      const tail = Buffer.alloc(Math.min(4096, size - o));
      if (tail.length > 8) { fs.readSync(fd, tail, 0, tail.length, o); const i = tail.indexOf('smpl'); if (i >= 0) loops = parseSmplChunk(tail, i + 8, tail.readUInt32LE(i + 4)).loops; }
      break;
    }
  }
  fs.closeSync(fd);
  return { sr, frames, loops };
}
function flacInfo(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,duration_ts', '-of', 'csv=p=0', file]);
  const [sr, ts] = r.stdout.toString().trim().split(',').map(Number);
  return { sr, frames: ts, loops: readFlacSmpl(file)?.loops ?? [] };
}

const out = {};
for (const [name, e] of Object.entries(INSTRUMENTS)) {
  let lens = [], looped = 0, total = 0, lo = 127, hi = 0, samples = new Set();
  if (e.sfz) {
    const inst = loadSfzInstrument(e.sfz);
    for (const r of inst.regions) {
      if (r.trigger === 'release') continue;
      lo = Math.min(lo, r.lokey); hi = Math.max(hi, r.hikey);
      if (samples.has(r.sample)) continue;
      samples.add(r.sample);
      const info = /\.wav$/i.test(r.sample) ? wavInfo(r.sample) : flacInfo(r.sample);
      const isLoop = (r.loopMode ?? (info.loops.length ? 'loop_continuous' : 'no_loop')).startsWith('loop');
      total++; if (isLoop) looped++; else lens.push(info.frames / info.sr);
    }
  } else {
    const bank = loadSoundBank(e.sf);
    const p = findPreset(bank, { bank: e.drums ? 128 : e.bank ?? 0, program: e.program ?? 0 });
    if (!p) { out[name] = { error: 'preset missing' }; continue; }
    for (const l of describePreset(p)) {
      lo = Math.min(lo, l.keyRange[0]); hi = Math.max(hi, l.keyRange[1]);
      if (samples.has(l.sample)) continue;
      samples.add(l.sample);
      total++; if (l.loopMode === 1 || l.loopMode === 3) looped++; else lens.push(l.seconds);
    }
  }
  lens.sort((a, b) => a - b);
  out[name] = { source: e.sfz ? `sfz:${e.sfz}` : `${e.sf} ${e.drums ? 128 : e.bank ?? 0}:${e.program ?? 0}`, keys: `${lo}-${hi}`, samples: total, looped,
    unloopedMinSec: lens.length ? +lens[0].toFixed(2) : null, unloopedMedianSec: lens.length ? +lens[Math.floor(lens.length / 2)].toFixed(2) : null };
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else for (const [k, v] of Object.entries(out)) console.log(k.padEnd(14), JSON.stringify(v));
