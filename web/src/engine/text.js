// Text rendered with Canvas2D into textures (captions, UI, code editor).
import { textureFromCanvas } from './gl.js';

export function textLayer(gl, S, lines, opts = {}) {
  const {
    font = '400 34px Georgia', color = '#f3e7cf', letterSpacing = 0, lineHeight = 1.3,
    align = 'left', pad = 8, shadow = null, maxW = 0,
  } = opts;
  const arr = Array.isArray(lines) ? lines : [lines];
  const scale = S * (opts.scale || 1);
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  if ('letterSpacing' in g) g.letterSpacing = `${letterSpacing}px`;
  const sizePx = parseFloat(font.match(/(\d+(\.\d+)?)px/)[1]);
  let w = 0;
  for (const l of arr) w = Math.max(w, g.measureText(typeof l === 'string' ? l : l.map((s) => s.t).join('')).width);
  w = Math.max(w, maxW);
  const lh = sizePx * lineHeight;
  const Wd = Math.ceil(w + pad * 2), Hd = Math.ceil(lh * arr.length + pad * 2);
  c.width = Math.ceil(Wd * scale);
  c.height = Math.ceil(Hd * scale);
  g.scale(scale, scale);
  g.font = font;
  if ('letterSpacing' in g) g.letterSpacing = `${letterSpacing}px`;
  g.textBaseline = 'middle';
  if (shadow) {
    g.shadowColor = shadow.color;
    g.shadowBlur = shadow.blur * scale;
  }
  arr.forEach((l, i) => {
    const y = pad + lh * (i + 0.5);
    if (typeof l === 'string') {
      g.fillStyle = color;
      g.textAlign = align;
      const x = align === 'center' ? Wd / 2 : align === 'right' ? Wd - pad : pad;
      g.fillText(l, x, y);
    } else {
      // rich line: [{t, c}] segments
      let x = pad;
      g.textAlign = 'left';
      for (const seg of l) {
        g.fillStyle = seg.c || color;
        g.fillText(seg.t, x, y);
        x += g.measureText(seg.t).width;
      }
    }
  });
  const tex = textureFromCanvas(gl, c, { mip: true });
  return { tex, w: Wd, h: Hd, flipY: false, canvas: c, dispose: () => gl.deleteTexture(tex) };
}
