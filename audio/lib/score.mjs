// audio/lib/score.mjs — renderScore(score, outDir, opts): render every track of a score to its own stereo stem.
//
// Score (all times in SECONDS):
// {
//   sampleRate: 48000, duration: 150, tempo: [{ t:0, bpm:96 }] (informational; see music.mjs for beat helpers),
//   tracks: [
//     // synth track (default type) — rendered with spessasynth_core from a soundfont, synth reverb/chorus OFF
//     { id:'sax', sf:'fluid', bank:0, program:65, drums:false, gain:-3 (dB), pan:-0.2, reverb:0.25, chorus:0, delay:0,
//       notes:[{t, d, p, v}], cc:[{t, n, v, ramp?}], bend:[{t, v}], bendRange:2, programs:[{t, program, bank}],
//       bus:'music', eq:[...], comp:{...}, width:1, gainAuto:[{t, db, ramp?}] },
//     // sample track — one-shots / beds from audio files (any format ffmpeg reads; ids from assets/sfx/index.json work)
//     { id:'boom', type:'sample', bus:'sfx', events:[{ t, src, gain:0, pan:0, rate:1, offset:0, dur, fadeIn, fadeOut, loop, reverse }] },
//     // procedural sfx track — generators from audio/lib/sfx.mjs
//     { id:'whooshes', type:'sfx', bus:'sfx', events:[{ t, fx:'whoosh', params:{ dur:1.2 }, gain:0, pan:0 }] },
//   ],
//   mix: { ...busConfig for mixer.mix() (optional) }
// }
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { resolveSoundfontPath } from './soundfonts.mjs';
import { resolveSfzPath } from './sfz.mjs';
import { writeWav, readWav, loadAudio } from './wav.mjs';
import { resampleHermite, dbToGain } from './dsp.mjs';
import { stats as stemStats } from './analyze.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const AUDIO_ROOT = path.resolve(HERE, '..');
export const SFX_DIR = path.join(AUDIO_ROOT, 'assets', 'sfx');
const RENDER_VERSION = 3;

// ------------------------------------------------------------------ validation
export function validateScore(score) {
  const errs = [];
  if (!score || typeof score !== 'object') throw new Error('score must be an object');
  if (!Array.isArray(score.tracks) || !score.tracks.length) errs.push('score.tracks must be a non-empty array');
  const ids = new Set();
  for (const [i, t] of (score.tracks ?? []).entries()) {
    const where = `track[${i}]${t?.id ? ` '${t.id}'` : ''}`;
    if (!t || typeof t !== 'object') { errs.push(`${where}: not an object`); continue; }
    if (!t.id || typeof t.id !== 'string') errs.push(`${where}: missing string id`);
    else if (!/^[\w.-]+$/.test(t.id)) errs.push(`${where}: id may only contain letters, digits, _ . -`);
    if (ids.has(t.id)) errs.push(`${where}: duplicate id`);
    ids.add(t.id);
    const type = t.type ?? 'synth';
    if (type === 'synth') {
      if (t.program != null && !(t.program >= 0 && t.program <= 127)) errs.push(`${where}: program out of range`);
      for (const n of t.notes ?? []) {
        if (!Number.isFinite(n.t) || !Number.isFinite(n.d) || !Number.isFinite(n.p)) { errs.push(`${where}: note needs numeric t, d, p (got ${JSON.stringify(n)})`); break; }
      }
      try { if (t.sfz) resolveSfzPath(t.sfz); else resolveSoundfontPath(t.sf ?? 'gm'); } catch (e) { errs.push(`${where}: ${e.message}`); }
    } else if (type === 'sample' || type === 'sfx') {
      if (!Array.isArray(t.events)) errs.push(`${where}: ${type} track needs events[]`);
    } else errs.push(`${where}: unknown type '${type}'`);
  }
  if (errs.length) throw new Error('Invalid score:\n  ' + errs.join('\n  '));
}

export function scoreDuration(score) {
  if (Number.isFinite(score.duration) && score.duration > 0) return score.duration;
  let end = 0;
  for (const t of score.tracks) {
    for (const n of t.notes ?? []) end = Math.max(end, n.t + n.d);
    for (const e of t.events ?? []) end = Math.max(end, e.t + (e.dur ?? 2));
  }
  console.warn(`score.duration missing — using last event + 3 s = ${(end + 3).toFixed(2)} s`);
  return end + 3;
}

// ------------------------------------------------------------------ sample tracks
let sfxIndex = null;
function sfxLookup(id) {
  if (!sfxIndex) {
    const p = path.join(SFX_DIR, 'index.json');
    sfxIndex = new Map();
    if (fs.existsSync(p)) {
      try { for (const e of JSON.parse(fs.readFileSync(p, 'utf8'))) sfxIndex.set(e.id, path.join(SFX_DIR, e.file)); } catch { /* ignore */ }
    }
  }
  return sfxIndex.get(id);
}
export function resolveSampleSrc(src) {
  const byId = sfxLookup(src);
  if (byId) return byId;
  for (const p of [src, path.join(SFX_DIR, src), path.join(AUDIO_ROOT, src)]) if (fs.existsSync(p)) return path.resolve(p);
  throw new Error(`sample src not found: ${src} (not an sfx id, nor a path relative to cwd, audio/assets/sfx or audio/)`);
}
const audioCache = new Map();
function getSource(src, sr) {
  const file = resolveSampleSrc(src);
  const key = `${file}@${sr}`;
  if (!audioCache.has(key)) audioCache.set(key, loadAudio(file, { sampleRate: sr, channels: 2 }).channels);
  return audioCache.get(key);
}

function panGains(pan) {
  const th = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(th) * Math.SQRT2, Math.sin(th) * Math.SQRT2];
}

// Mix an event buffer into dst with gain/pan/fades at a sample offset.
function place(dst, src, at, { gain = 0, pan = 0, fadeIn = 0.002, fadeOut = 0.01, sr }) {
  const g = dbToGain(gain);
  const [pl, pr] = panGains(pan);
  const n = src[0].length;
  const fi = Math.max(1, Math.round(fadeIn * sr)), fo = Math.max(1, Math.round(fadeOut * sr));
  for (let i = 0; i < n; i++) {
    const j = at + i;
    if (j < 0) continue;
    if (j >= dst[0].length) break;
    let e = g;
    if (i < fi) e *= i / fi;
    if (i > n - fo) e *= (n - i) / fo;
    const m = 0.5 * (src[0][i] + src[1][i]), s = 0.5 * (src[0][i] - src[1][i]);
    dst[0][j] += (m * pl + s) * e;
    dst[1][j] += (m * pr - s) * e;
  }
}

function renderSampleTrack(track, sr, total) {
  const out = [new Float32Array(total), new Float32Array(total)];
  for (const ev of track.events) {
    let src = getSource(ev.src, sr);
    const off = Math.round((ev.offset ?? 0) * sr);
    if (off > 0) src = src.map((c) => c.subarray(off));
    if (ev.reverse) src = src.map((c) => Float32Array.from(c).reverse());
    if (ev.rate && ev.rate !== 1) src = src.map((c) => resampleHermite(c, ev.rate));
    if (ev.dur != null) {
      const want = Math.round(ev.dur * sr);
      if (ev.loop && want > src[0].length) {
        // loop with 60 ms equal-power crossfades
        const xf = Math.min(Math.round(0.06 * sr), Math.floor(src[0].length / 4));
        const res = [new Float32Array(want), new Float32Array(want)];
        const L = src[0].length, step = L - xf;
        for (let start = 0; start < want; start += step) {
          for (let c = 0; c < 2; c++) {
            for (let i = 0; i < L && start + i < want; i++) {
              let g = 1;
              if (start > 0 && i < xf) g = Math.sin((Math.PI / 2) * (i / xf));
              if (i >= L - xf && start + step < want) g *= Math.cos((Math.PI / 2) * ((i - (L - xf)) / xf));
              res[c][start + i] += src[c][i] * g;
            }
          }
        }
        src = res;
      } else src = src.map((c) => c.subarray(0, Math.min(c.length, want)));
    }
    place(out, src, Math.round(ev.t * sr), { gain: ev.gain ?? 0, pan: ev.pan ?? 0, fadeIn: ev.fadeIn ?? 0.002, fadeOut: ev.fadeOut ?? 0.01, sr });
  }
  return out;
}

let sfxModule = null;
async function renderSfxTrack(track, sr, total) {
  if (!sfxModule) sfxModule = await import('./sfx.mjs');
  const table = sfxModule.SFX ?? sfxModule;
  const out = [new Float32Array(total), new Float32Array(total)];
  for (const ev of track.events) {
    const fn = table[ev.fx];
    if (typeof fn !== 'function') throw new Error(`track ${track.id}: unknown sfx generator '${ev.fx}'`);
    const buf = fn({ ...(ev.params ?? {}), sampleRate: sr });
    place(out, buf, Math.round(ev.t * sr), { gain: ev.gain ?? 0, pan: ev.pan ?? 0, fadeIn: 0.0005, fadeOut: 0.002, sr });
  }
  return out;
}

// ------------------------------------------------------------------ worker pool for synth tracks
function runPool(jobs, size, onDone) {
  return new Promise((resolve, reject) => {
    if (!jobs.length) return resolve([]);
    const results = [];
    let next = 0, active = 0, failed = null;
    const workers = [];
    const nW = Math.max(1, Math.min(size, jobs.length));
    const launch = (w) => {
      if (failed) return;
      if (next >= jobs.length) {
        w.terminate();
        if (active === 0 && results.length === jobs.length) resolve(results);
        return;
      }
      const job = jobs[next++];
      active++;
      w.once('message', (msg) => {
        active--;
        if (!msg.ok) { failed = new Error(`synth render failed for track '${msg.id}':\n${msg.error}`); workers.forEach((x) => x.terminate()); return reject(failed); }
        results.push(msg);
        onDone?.(msg);
        if (results.length === jobs.length) { workers.forEach((x) => x.terminate()); resolve(results); }
        else launch(w);
      });
      w.postMessage(job);
    };
    for (let i = 0; i < nW; i++) {
      const w = new Worker(new URL('./synth-worker.mjs', import.meta.url));
      w.on('error', (e) => { failed = e; reject(e); });
      workers.push(w);
      launch(w);
    }
  });
}

// ------------------------------------------------------------------ caching helpers
const MIX_KEYS = ['gain', 'pan', 'width', 'reverb', 'chorus', 'delay', 'sends', 'eq', 'comp', 'bus', 'gainAuto', 'mute', 'solo', 'polarity', 'normalize'];

function stripFns(x) { return JSON.parse(JSON.stringify(x)); }
function trackHash(track, sr, duration) {
  const h = crypto.createHash('sha1');
  const renderOnly = stripFns(track);
  for (const k of MIX_KEYS) delete renderOnly[k]; // mix-time parameters don't affect the rendered stem
  h.update(JSON.stringify({ v: RENDER_VERSION, sr, duration, track: renderOnly }));
  const type = track.type ?? 'synth';
  if (type === 'synth') {
    const f = track.sfz ? resolveSfzPath(track.sfz) : resolveSoundfontPath(track.sf ?? 'gm');
    const st = fs.statSync(f);
    h.update(`${f}:${st.size}:${st.mtimeMs}`);
    if (track.sfz) { const e = path.join(HERE, 'sfz.mjs'); h.update(String(fs.statSync(e).mtimeMs)); }
  } else if (type === 'sample') {
    for (const ev of track.events) { try { const f = resolveSampleSrc(ev.src); const st = fs.statSync(f); h.update(`${f}:${st.size}:${st.mtimeMs}`); } catch { h.update(String(ev.src)); } }
  } else if (type === 'sfx') {
    const f = path.join(HERE, 'sfx.mjs');
    if (fs.existsSync(f)) h.update(String(fs.statSync(f).mtimeMs));
  }
  return h.digest('hex').slice(0, 16);
}


/**
 * Render all tracks to float32 stereo WAV stems in outDir. Returns an array of stem descriptors for mix():
 *   [{ id, type, file, bus, gain, pan, width, reverb, chorus, delay, sends, eq, comp, gainAuto, sendAutomation, info, stats }]
 * opts: { workers (default: min(cpus-2, 8)), cache (default true), only: [ids], quiet, stats (default true) }
 */
export async function renderScore(score, outDir, opts = {}) {
  validateScore(score);
  const sr = score.sampleRate ?? 48000;
  const duration = scoreDuration(score);
  const total = Math.round(duration * sr);
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);
  fs.mkdirSync(outDir, { recursive: true });
  const manifestPath = path.join(outDir, 'stems.json');
  let old = {};
  if (opts.cache !== false && fs.existsSync(manifestPath)) {
    try { old = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).tracks ?? {}; } catch { old = {}; }
  }
  const only = opts.only ? new Set(opts.only) : null;
  const tracks = score.tracks.filter((t) => !only || only.has(t.id));
  const results = new Map();
  const synthJobs = [];
  const t0 = performance.now();
  for (const track of tracks) {
    const type = track.type ?? 'synth';
    const file = path.join(outDir, `${track.id}.wav`);
    const hash = trackHash(track, sr, duration);
    if (opts.cache !== false && old[track.id]?.hash === hash && fs.existsSync(file)) {
      results.set(track.id, { ...old[track.id], cached: true });
      continue;
    }
    if (type === 'synth') {
      synthJobs.push({ track: stripFns(track), sampleRate: sr, duration, file, blockSize: opts.blockSize ?? 32, hash });
    } else {
      const ch = type === 'sample' ? renderSampleTrack(track, sr, total) : await renderSfxTrack(track, sr, total);
      writeWav(file, ch, sr, 32);
      results.set(track.id, { hash, file, info: { type, events: track.events.length } });
      log(`  rendered ${type.padEnd(6)} ${track.id}`);
    }
  }
  const nWorkers = opts.workers ?? Math.max(1, Math.min(8, os.cpus().length - 2));
  if (synthJobs.length) {
    log(`  rendering ${synthJobs.length} synth track(s) on ${Math.min(nWorkers, synthJobs.length)} worker(s)...`);
    await runPool(synthJobs, nWorkers, (msg) => {
      const job = synthJobs.find((j) => j.track.id === msg.id);
      results.set(msg.id, { hash: job.hash, file: job.file, info: msg.info });
      const isSfz = String(msg.info.sf).startsWith('sfz:');
      log(`  rendered ${isSfz ? 'sfz   ' : 'synth '} ${msg.id.padEnd(14)} ${String(msg.info.preset ?? '?').padEnd(26)} ${isSfz ? '' : `[${msg.info.sf} ${msg.info.presetBank}:${msg.info.presetProgram}] `}notes=${msg.info.notes} maxVoices=${msg.info.maxVoices} ${msg.info.renderMs} ms`);
      for (const w of msg.info.warnings ?? []) console.warn('  ! ' + w);
    });
  }
  // stats + manifest
  const manifest = { version: RENDER_VERSION, sampleRate: sr, duration, tracks: { ...old } };
  const stems = [];
  for (const track of tracks) {
    const r = results.get(track.id);
    if (!r) continue;
    if (opts.stats !== false && (!r.stats || !r.cached)) {
      const w = readWav(r.file);
      r.stats = stemStats(w.channels, sr);
    }
    manifest.tracks[track.id] = { hash: r.hash, file: r.file, info: r.info, stats: r.stats };
    const type = track.type ?? 'synth';
    const stem = { id: track.id, type, file: r.file, info: r.info, stats: r.stats, cached: !!r.cached };
    for (const k of MIX_KEYS) if (track[k] !== undefined) stem[k] = track[k];
    if (stem.bus === undefined) stem.bus = type === 'synth' ? 'music' : 'sfx';
    if (r.info?.sendAutomation) stem.sendAutomation = r.info.sendAutomation;
    stems.push(stem);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  log(`  stems ready in ${((performance.now() - t0) / 1000).toFixed(1)} s (${stems.filter((s) => s.cached).length} cached)`);
  return stems;
}
