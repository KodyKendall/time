// audio/lib/sfz-parse.mjs — SFZ file parser (#include, #define, <control>/<global>/<master>/<group>/<region>/<curve>).
// parseSfz(file) -> { file, dir, regions:[{ ...opcodes, _sample (abs path) }], control:{...}, ccInit:Map<cc, 0..1>, curves:{}, warnings:[] }
import fs from 'node:fs';
import path from 'node:path';

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n\r]*/g, '');
}

// Expand #include and #define recursively. Includes resolve against the root file dir, then the including file's dir.
function preprocess(file, rootDir, defines, depth = 0, warnings = []) {
  if (depth > 20) throw new Error('sfz: include depth exceeded');
  let text;
  try { text = fs.readFileSync(file, 'latin1'); } catch (e) { warnings.push(`cannot read ${file}: ${e.message}`); return ''; }
  text = stripComments(text);
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine;
    const inc = /^\s*#include\s+"([^"]+)"/.exec(line);
    if (inc) {
      const rel = applyDefines(inc[1], defines).replace(/\\/g, '/');
      let p = path.resolve(rootDir, rel);
      if (!fs.existsSync(p)) p = path.resolve(path.dirname(file), rel);
      out.push(preprocess(p, rootDir, defines, depth + 1, warnings));
      continue;
    }
    const def = /^\s*#define\s+(\$[A-Za-z0-9_]+)\s+(.*?)\s*$/.exec(line);
    if (def) { defines.set(def[1], applyDefines(def[2], defines)); continue; }
    out.push(applyDefines(line, defines));
  }
  return out.join('\n');
}

function applyDefines(s, defines) {
  if (!s.includes('$')) return s;
  // longest names first so $FOO_BAR wins over $FOO
  const names = [...defines.keys()].sort((a, b) => b.length - a.length);
  for (const n of names) if (s.includes(n)) s = s.split(n).join(defines.get(n));
  return s;
}

// opcodes whose value may contain spaces (paths, labels)
const WHOLE_VALUE = /^(sample|default_path|.*label.*|image|author|name)$/;

// Split preprocessed text into [{header, opcodes:{}}] preserving order.
function tokenize(text) {
  const blocks = [];
  const re = /<(\w+)>/g;
  let m, last = null, lastIdx = 0;
  const pushBody = (body) => {
    if (!last) return;
    const ops = {};
    const opRe = /([A-Za-z0-9_]+)=/g;
    const found = [];
    let om;
    while ((om = opRe.exec(body))) found.push({ key: om[1], start: om.index, valStart: opRe.lastIndex });
    for (let i = 0; i < found.length; i++) {
      const end = i + 1 < found.length ? found[i + 1].start : body.length;
      let v = body.slice(found[i].valStart, end).trim();
      if (!WHOLE_VALUE.test(found[i].key)) v = v.split(/\s+/)[0] ?? '';
      else v = v.replace(/\s+$/, '');
      ops[found[i].key] = v;
    }
    last.opcodes = ops;
    blocks.push(last);
  };
  while ((m = re.exec(text))) {
    pushBody(text.slice(lastIdx, m.index));
    last = { header: m[1].toLowerCase(), opcodes: {} };
    lastIdx = re.lastIndex;
  }
  pushBody(text.slice(lastIdx));
  return blocks;
}

const NOTE_RE = /^([a-gA-G])([#b]?)(-?\d+)$/;
export function sfzNote(v, noteOffset = 0) {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (Number.isFinite(n)) return n + noteOffset;
  const m = NOTE_RE.exec(String(v).trim());
  if (!m) return undefined;
  const pc = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return pc + 12 * (parseInt(m[3], 10) + 1) + noteOffset; // C4 = 60
}

const KEY_OPS = new Set(['lokey', 'hikey', 'key', 'pitch_keycenter', 'sw_lokey', 'sw_hikey', 'sw_last', 'sw_default', 'sw_down', 'sw_up', 'sw_previous', 'fil_keycenter', 'amp_keycenter']);

export function parseSfz(file) {
  const abs = path.resolve(file);
  const rootDir = path.dirname(abs);
  const warnings = [];
  const text = preprocess(abs, rootDir, new Map(), 0, warnings);
  const blocks = tokenize(text);
  const control = { default_path: '', note_offset: 0, octave_offset: 0 };
  const ccInit = new Map();
  const curves = {};
  let global = {}, master = {}, group = {};
  const regions = [];
  let groupIndex = 0;
  for (const b of blocks) {
    const o = b.opcodes;
    switch (b.header) {
      case 'control':
        if (o.default_path != null) control.default_path = o.default_path.replace(/\\/g, '/');
        if (o.note_offset != null) control.note_offset = +o.note_offset;
        if (o.octave_offset != null) control.octave_offset = +o.octave_offset;
        for (const [k, v] of Object.entries(o)) {
          let m;
          if ((m = /^set_cc(\d+)$/.exec(k))) ccInit.set(+m[1], Math.max(0, Math.min(1, +v / 127)));
          else if ((m = /^set_hdcc(\d+)$/.exec(k))) ccInit.set(+m[1], Math.max(0, Math.min(1, +v)));
        }
        break;
      case 'global': global = { ...o }; master = {}; group = {}; break;
      case 'master': master = { ...o }; group = {}; break;
      case 'group': group = { ...o }; groupIndex++; break;
      case 'curve': {
        const idx = +(o.curve_index ?? Object.keys(curves).length);
        const pts = [];
        for (const [k, v] of Object.entries(o)) { const m = /^v(\d+)$/.exec(k); if (m) pts.push([+m[1], +v]); }
        curves[idx] = pts.sort((a, b) => a[0] - b[0]);
        break;
      }
      case 'region': {
        const r = { ...global, ...master, ...group, ...o, _group: groupIndex };
        const noteOff = control.note_offset + 12 * control.octave_offset;
        for (const k of Object.keys(r)) if (KEY_OPS.has(k)) r[k] = sfzNote(r[k], noteOff);
        if (r.key != null) { r.lokey ??= r.key; r.hikey ??= r.key; r.pitch_keycenter ??= r.key; }
        if (r.sample) {
          if (r.sample.startsWith('*')) r._generator = r.sample;
          else {
            const rel = (control.default_path + r.sample).replace(/\\/g, '/');
            r._sample = path.resolve(rootDir, rel);
          }
        }
        regions.push(r);
        break;
      }
      default: break; // <effect>, <midi>, <sample> etc. ignored
    }
  }
  return { file: abs, dir: rootDir, control, ccInit, curves, regions, warnings };
}

// Opcode usage survey (for tooling)
export function opcodeHistogram(parsed) {
  const h = new Map();
  for (const r of parsed.regions) for (const k of Object.keys(r)) if (!k.startsWith('_')) h.set(k, (h.get(k) ?? 0) + 1);
  return [...h.entries()].sort((a, b) => b[1] - a[1]);
}
