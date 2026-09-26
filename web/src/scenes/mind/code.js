// The code typed in the editor: this film's own SEGMENTS table (web/src/film.js, trimmed).
// Tokenised into syntax classes so each token can be born from one straightened network edge.

export const CODE = [
  "// film.js · one shot per segment, 96 BPM",
  "import { Film } from './engine/film.js';",
  "",
  "export const SEGMENTS = [",
  "  { id: 'cosmos',    start: 0,     end: 30    },",
  "  { id: 'earth',     start: 30,    end: 52.5  },",
  "  { id: 'sea',       start: 52.5,  end: 70    },",
  "  { id: 'land',      start: 70,    end: 85    },",
  "  { id: 'ancestors', start: 85,    end: 97.5  },",
  "  { id: 'hunt',      start: 97.5,  end: 107.5 },",
  "  { id: 'city',      start: 107.5, end: 117.5 },",
  "  { id: 'machine',   start: 117.5, end: 130   },",
  "  { id: 'mind',      start: 130,   end: 145   },",
  "];",
  "",
  "export async function buildFilm() {",
  "  return new Film({",
  "    fps: 30, duration: 145,",
  "    shots: SEGMENTS,",
  "  });",
  "}",
];
// The line the caret rests on at the end (the current segment).
export const CARET_LINE = 12;

// Syntax colours (film palette, tuned for a dark editor).
export const SYN = {
  kw: '#e27a92',     // keywords
  fn: '#f2b544',     // function / class names
  key: '#7fd8cf',    // object keys
  str: '#f59b3d',    // strings
  num: '#c6b3f0',    // numbers
  pun: '#8d95ad',    // punctuation
  com: '#5f8a90',    // comments
  id: '#f3e6c8',     // identifiers
};
const KW = new Set(['import', 'from', 'export', 'const', 'async', 'function', 'return', 'new']);
const FN = new Set(['Film', 'buildFilm', 'SEGMENTS']);

// Tokenise one line -> [{ t, cls, c0, c1 }] (whitespace skipped; c0/c1 = char columns).
export function tokenize(line) {
  const out = [];
  let i = 0;
  const n = line.length;
  const push = (c0, c1, cls) => out.push({ t: line.slice(c0, c1), cls, c0, c1 });
  while (i < n) {
    const ch = line[i];
    if (ch === ' ') { i++; continue; }
    if (ch === '/' && line[i + 1] === '/') { push(i, n, 'com'); break; }
    if (ch === "'") {
      let j = i + 1;
      while (j < n && line[j] !== "'") j++;
      push(i, Math.min(n, j + 1), 'str');
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9.]/.test(line[j])) j++;
      push(i, j, 'num');
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(line[j])) j++;
      const w = line.slice(i, j);
      let cls = KW.has(w) ? 'kw' : FN.has(w) ? 'fn' : 'id';
      if (cls === 'id' && line[j] === ':') cls = 'key';
      push(i, j, cls);
      i = j;
      continue;
    }
    // punctuation run
    let j = i;
    while (j < n && /[^A-Za-z0-9_$' ]/.test(line[j]) && !(line[j] === '/' && line[j + 1] === '/')) j++;
    if (j === i) j = i + 1;
    push(i, j, 'pun');
    i = j;
  }
  return out;
}

// Rich-text segments for P.text: [{t, c}] covering the full line (spaces included).
export function richLine(line) {
  const toks = tokenize(line);
  const segs = [];
  let col = 0;
  for (const tk of toks) {
    if (tk.c0 > col) segs.push({ t: line.slice(col, tk.c0), c: SYN.id });
    segs.push({ t: tk.t, c: SYN[tk.cls] });
    col = tk.c1;
  }
  if (col < line.length) segs.push({ t: line.slice(col), c: SYN.id });
  return segs.length ? segs : [{ t: ' ', c: SYN.id }];
}
