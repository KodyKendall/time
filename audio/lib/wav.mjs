// audio/lib/wav.mjs — WAV reader/writer + ffmpeg-backed decoder for any audio format.
//
//   writeWav(path, channels, sampleRate, bitDepth = 24, opts)
//     channels : Float32Array (mono) or array of Float32Array (one per channel), nominal range -1..1
//     bitDepth : 16 | 24 -> integer PCM (TPDF dither on by default for 16, off for 24)
//                32      -> IEEE float32 (default) — pass { float:false } for int32 PCM
//                'float' / 'f32' -> float32
//     opts     : { dither?:boolean, float?:boolean, seed?:number }
//   readWav(path) -> { sampleRate, channels:Float32Array[], bitDepth, float, numFrames, duration }
//   decodeAudioFile(path, { sampleRate=48000, channels=2 }) -> same shape as readWav (uses ffmpeg; any format)
//   loadAudio(path, opts) -> readWav for .wav at the right rate/channels, else decodeAudioFile

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function asChannelArray(channels) {
  if (channels instanceof Float32Array || channels instanceof Float64Array) return [channels];
  if (!Array.isArray(channels) || channels.length === 0) throw new Error('writeWav: channels must be a Float32Array or non-empty array of them');
  return channels;
}

// Small deterministic PRNG for dither.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function encodeWav(channels, sampleRate, bitDepth = 24, opts = {}) {
  const chans = asChannelArray(channels);
  const nCh = chans.length;
  const n = chans.reduce((m, c) => Math.max(m, c.length), 0);
  let isFloat = false;
  let bits = bitDepth;
  if (bitDepth === 'float' || bitDepth === 'f32') { isFloat = true; bits = 32; }
  else if (bitDepth === 32) { isFloat = opts.float !== false; }
  else if (bitDepth !== 16 && bitDepth !== 24) throw new Error(`writeWav: unsupported bitDepth ${bitDepth}`);
  if (opts.float === true) { isFloat = true; bits = 32; }
  const bytesPer = bits / 8;
  const blockAlign = nCh * bytesPer;
  const dataBytes = n * blockAlign;
  const fmtSize = isFloat ? 18 : 16;
  const factBytes = isFloat ? 12 : 0;
  const headerBytes = 12 + (8 + fmtSize) + factBytes + 8;
  const buf = Buffer.alloc(headerBytes + dataBytes + (dataBytes & 1));
  let o = 0;
  buf.write('RIFF', o); o += 4;
  buf.writeUInt32LE(buf.length - 8, o); o += 4;
  buf.write('WAVE', o); o += 4;
  buf.write('fmt ', o); o += 4;
  buf.writeUInt32LE(fmtSize, o); o += 4;
  buf.writeUInt16LE(isFloat ? 3 : 1, o); o += 2;
  buf.writeUInt16LE(nCh, o); o += 2;
  buf.writeUInt32LE(sampleRate, o); o += 4;
  buf.writeUInt32LE(sampleRate * blockAlign, o); o += 4;
  buf.writeUInt16LE(blockAlign, o); o += 2;
  buf.writeUInt16LE(bits, o); o += 2;
  if (isFloat) { buf.writeUInt16LE(0, o); o += 2; }
  if (isFloat) {
    buf.write('fact', o); o += 4;
    buf.writeUInt32LE(4, o); o += 4;
    buf.writeUInt32LE(n, o); o += 4;
  }
  buf.write('data', o); o += 4;
  buf.writeUInt32LE(dataBytes, o); o += 4;

  const dither = opts.dither ?? (bits === 16);
  const rand = mulberry32(opts.seed ?? 0x5eed);
  if (isFloat) {
    const inter = new Float32Array(n * nCh); // interleave, then byte-copy (header is not 4-byte aligned)
    for (let c = 0; c < nCh; c++) {
      const src = chans[c];
      const len = Math.min(src.length, n);
      for (let i = 0; i < len; i++) inter[i * nCh + c] = src[i];
    }
    Buffer.from(inter.buffer).copy(buf, o);
    return buf;
  }
  const maxInt = bits === 16 ? 32767 : 8388607;
  const minInt = -maxInt - 1;
  const lsb = 1 / maxInt;
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      let x = chans[c][i] ?? 0;
      if (!Number.isFinite(x)) x = 0;
      if (dither) x += (rand() - rand()) * lsb; // TPDF, +-1 LSB
      let v = Math.round(x * maxInt);
      if (v > maxInt) { v = maxInt; clipped++; } else if (v < minInt) { v = minInt; clipped++; }
      if (bits === 16) { buf.writeInt16LE(v, o); o += 2; }
      else { buf[o] = v & 0xff; buf[o + 1] = (v >> 8) & 0xff; buf[o + 2] = (v >> 16) & 0xff; o += 3; }
    }
  }
  if (clipped > 0 && !opts.quiet) console.warn(`writeWav: ${clipped} samples clipped while converting to ${bits}-bit`);
  return buf;
}

export function writeWav(filePath, channels, sampleRate, bitDepth = 24, opts = {}) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  const buf = encodeWav(channels, sampleRate, bitDepth, opts);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

export function decodeWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    if (buf.toString('ascii', 0, 4) === 'RF64') throw new Error('readWav: RF64 not supported');
    throw new Error('readWav: not a RIFF/WAVE file');
  }
  let o = 12;
  let fmt = null;
  let dataOff = -1, dataLen = 0;
  let smpl = null;
  while (o + 8 <= buf.length) {
    const id = buf.toString('ascii', o, o + 4);
    let size = buf.readUInt32LE(o + 4);
    const body = o + 8;
    if (id === 'fmt ') {
      let format = buf.readUInt16LE(body);
      const nCh = buf.readUInt16LE(body + 2);
      const sampleRate = buf.readUInt32LE(body + 4);
      const blockAlign = buf.readUInt16LE(body + 12);
      const bits = buf.readUInt16LE(body + 14);
      if (format === 0xfffe && size >= 40) format = buf.readUInt16LE(body + 24); // EXTENSIBLE subformat
      fmt = { format, nCh, sampleRate, blockAlign, bits };
    } else if (id === 'data') {
      dataOff = body;
      if (size === 0xffffffff || body + size > buf.length) size = buf.length - body;
      dataLen = size;
    } else if (id === 'smpl' && body + 36 <= buf.length) {
      smpl = parseSmplChunk(buf, body, size);
    }
    o = body + size + (size & 1);
  }
  if (!fmt) throw new Error('readWav: missing fmt chunk');
  if (dataOff < 0) throw new Error('readWav: missing data chunk');
  const { format, nCh, sampleRate, bits } = fmt;
  const bytesPer = bits / 8;
  const blockAlign = fmt.blockAlign || nCh * bytesPer;
  const n = Math.floor(dataLen / blockAlign);
  const channels = Array.from({ length: nCh }, () => new Float32Array(n));
  const isFloat = format === 3;
  if (format !== 1 && format !== 3) throw new Error(`readWav: unsupported format tag ${format}`);
  for (let i = 0; i < n; i++) {
    let p = dataOff + i * blockAlign;
    for (let c = 0; c < nCh; c++) {
      let v;
      if (isFloat) v = bits === 64 ? buf.readDoubleLE(p) : buf.readFloatLE(p);
      else if (bits === 8) v = (buf[p] - 128) / 128;
      else if (bits === 16) v = buf.readInt16LE(p) / 32768;
      else if (bits === 24) v = ((buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16)) << 8 >> 8) / 8388608;
      else if (bits === 32) v = buf.readInt32LE(p) / 2147483648;
      else throw new Error(`readWav: unsupported bit depth ${bits}`);
      channels[c][i] = v;
      p += bytesPer;
    }
  }
  const res = { sampleRate, channels, bitDepth: bits, float: isFloat, numFrames: n, duration: n / sampleRate };
  if (smpl) { res.loops = smpl.loops; res.unityNote = smpl.unityNote; }
  return res;
}

// RIFF 'smpl' chunk: loops (start/end inclusive, in frames) and MIDI unity note
export function parseSmplChunk(buf, body, size) {
  const unityNote = buf.readUInt32LE(body + 12);
  const n = buf.readUInt32LE(body + 28);
  const loops = [];
  for (let i = 0; i < n; i++) {
    const p = body + 36 + i * 24;
    if (p + 24 > body + size || p + 24 > buf.length) break;
    loops.push({ type: buf.readUInt32LE(p + 4), start: buf.readUInt32LE(p + 8), end: buf.readUInt32LE(p + 12) });
  }
  return { unityNote, loops };
}

// FLAC: loop metadata stored by sfz tools as APPLICATION 'riff' blocks carrying a RIFF 'smpl' chunk
export function readFlacSmpl(filePath) {
  const b = fs.readFileSync(filePath);
  if (b.toString('ascii', 0, 4) !== 'fLaC') return null;
  let o = 4;
  while (o + 4 <= b.length) {
    const h = b[o], last = h & 0x80, type = h & 0x7f, len = b.readUIntBE(o + 1, 3);
    const body = o + 4;
    if (type === 2 && b.toString('ascii', body, body + 4) === 'riff' && b.toString('ascii', body + 4, body + 8) === 'smpl') {
      const sz = b.readUInt32LE(body + 8);
      return parseSmplChunk(b, body + 12, sz);
    }
    o = body + len;
    if (last) break;
  }
  return null;
}

export function readWav(filePath) {
  return decodeWav(fs.readFileSync(filePath));
}

// Decode any audio file ffmpeg understands into float channels at the requested rate.
// sampleRate / channels = 0 (or null) keep the file's native values.
export function decodeAudioFile(filePath, { sampleRate = 48000, channels = 2 } = {}) {
  const args = ['-v', 'error', '-i', filePath, '-map_metadata', '-1', '-f', 'wav', '-acodec', 'pcm_f32le'];
  if (channels) args.push('-ac', String(channels));
  if (sampleRate) args.push('-af', `aresample=${sampleRate}:resampler=soxr:precision=28`);
  args.push('pipe:1');
  const r = spawnSync('ffmpeg', args, { maxBuffer: 1 << 31 >>> 0, windowsHide: true });
  if (r.status !== 0) throw new Error(`ffmpeg decode failed for ${filePath}: ${r.stderr?.toString()}`);
  return decodeWav(r.stdout);
}

// Load any file as `channels` channels at `sampleRate`. WAVs at the right rate are read natively.
export function loadAudio(filePath, { sampleRate = 48000, channels = 2 } = {}) {
  if (/\.wav$/i.test(filePath)) {
    try {
      const w = readWav(filePath);
      if (w.sampleRate === sampleRate) {
        if (w.channels.length === channels) return w;
        if (w.channels.length === 1 && channels === 2) return { ...w, channels: [w.channels[0], Float32Array.from(w.channels[0])] };
        if (w.channels.length === 2 && channels === 1) {
          const m = new Float32Array(w.numFrames);
          for (let i = 0; i < m.length; i++) m[i] = 0.5 * (w.channels[0][i] + w.channels[1][i]);
          return { ...w, channels: [m] };
        }
      }
    } catch { /* fall through to ffmpeg */ }
  }
  return decodeAudioFile(filePath, { sampleRate, channels });
}
