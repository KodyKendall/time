// A small "years ago" counter that runs through the whole film, rolling down in log-time between
// era keyframes. Typed on at the Big Bang, typed off as the film loops. Screen-space overlay.
import { textureFromCanvas } from './engine/gl.js';
import { clamp, lerp, invLerp, ease, hex } from './engine/math.js';
import { M } from './engine/math.js';

// [film time (s), years ago]
const KEYS = [
  [2.5, 13.8e9], [10.0, 13.8e9], [13.75, 13.6e9], [17.5, 13.5e9], [27.5, 13.2e9], [30.0, 4.6e9],
  [37.0, 4.55e9], [44.0, 4.4e9], [49.0, 4.0e9], [52.5, 3.8e9], [57.0, 6.0e8], [60.0, 5.3e8], [64.0, 4.5e8],
  [67.5, 3.75e8], [72.5, 1.5e8], [77.5, 6.6e7], [85.0, 6.6e7], [88.5, 6.0e7], [92.5, 7.0e6], [95.0, 1.0e6],
  [99.0, 5.0e4], [103.75, 1.2e4], [107.5, 1.1e4], [111.25, 5.0e3], [114.0, 1.0e3], [117.5, 265],
  [122.5, 70], [128.0, 30], [134.0, 5], [137.5, 0.5],
];
const TYPE_ON = [2.55, 3.6], TYPE_OFF = [143.2, 144.2];

export function yearsAgo(t) {
  if (t <= KEYS[0][0]) return KEYS[0][1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [t0, v0] = KEYS[i], [t1, v1] = KEYS[i + 1];
    if (t >= t0 && t <= t1) {
      const u = ease.inOutSine(invLerp(t0, t1, t));
      return Math.exp(lerp(Math.log(v0), Math.log(v1), u));
    }
  }
  return KEYS[KEYS.length - 1][1];
}

function sig(v, d) {
  // round to d significant digits
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - d + 1);
  return Math.round(v / p) * p;
}
export function formatYears(v) {
  if (v < 1) return 'now';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} billion years ago`;
  if (v >= 1e7) return `${Math.round(v / 1e6)} million years ago`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')} million years ago`;
  if (v >= 1000) return `${sig(v, 2).toLocaleString('en-US')} years ago`;
  if (v >= 2) return `${Math.round(v)} years ago`;
  return 'a year ago';
}

export function captions() {
  let canvas = null, g = null, tex = null, last = '';
  const W = 900, H = 90; // design units
  return [{
    id: 'counter',
    start: 0,
    end: 145,
    paint() { return {}; },
    draw(R, lt) {
      const t = R.t;
      let text = formatYears(yearsAgo(t));
      // type on / off
      let n = text.length;
      if (t < TYPE_ON[0]) n = 0;
      else if (t < TYPE_ON[1]) n = Math.floor(text.length * invLerp(TYPE_ON[0], TYPE_ON[1], t));
      else if (t > TYPE_OFF[0]) n = Math.ceil(text.length * (1 - invLerp(TYPE_OFF[0], TYPE_OFF[1], t)));
      text = text.slice(0, Math.max(0, n));
      if (!text) return;
      const S = R.S;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = Math.ceil(W * S);
        canvas.height = Math.ceil(H * S);
        g = canvas.getContext('2d');
      }
      if (text !== last) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.scale(S, S);
        g.textBaseline = 'alphabetic';
        g.shadowColor = 'rgba(0,0,0,0.55)';
        g.shadowBlur = 6 * S;
        g.fillStyle = 'rgba(243,231,207,0.86)';
        // tabular layout for digits so the number doesn't jitter while rolling
        let x = 8;
        const y = 58;
        for (const ch of text) {
          const digit = /[0-9]/.test(ch);
          g.font = digit ? 'italic 400 34px Georgia' : 'italic 400 30px Georgia';
          if ('letterSpacing' in g) g.letterSpacing = '1px';
          const w = digit ? 19 : g.measureText(ch).width + 1;
          g.fillText(ch, x + (digit ? (19 - g.measureText(ch).width) / 2 : 0), y);
          x += w;
        }
        tex = textureFromCanvas(R.engine.gl, canvas, { mip: true, existing: tex });
        last = text;
      }
      R.layer({ tex, w: W, h: H, flipY: false }, M.translate(70, 960));
    },
  }];
}
