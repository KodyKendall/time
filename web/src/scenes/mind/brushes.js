// MIND custom brushes (prefixed mind_). Sizes are design units.
export function defineMindBrushes(brush) {
  const add = (name, o) => { if (!brush.box().includes(name)) brush.add(name, o); };
  // bristle comb: parallel dry-brush streaks (panels, board surface)
  add('mind_comb', {
    type: 'custom', weight: 12, scatter: 0.3, opacity: 64, spacing: 0.08, pressure: [0.65, 1.1, 0.55],
    rotate: 'natural', markerTip: false, noise: 0.45,
    tip: (m) => {
      m.noStroke();
      const ys = [-42, -33, -26, -18, -11, -3, 4, 11, 19, 26, 34, 41];
      const ds = [4, 6, 5, 7, 4, 8, 5, 7, 4, 6, 5, 3];
      ys.forEach((y, i) => { m.fill(i % 3 === 0 ? 70 : 0); m.ellipse(0, y, 14, ds[i]); });
    },
  });
  // wide faint glaze comb (atmosphere, big planes)
  add('mind_glaze', {
    type: 'custom', weight: 26, scatter: 0.4, opacity: 30, spacing: 0.1, pressure: [0.6, 1.1, 0.5],
    rotate: 'natural', markerTip: false, noise: 0.5,
    tip: (m) => {
      m.noStroke();
      for (let i = 0; i < 16; i++) { m.fill(i % 2 ? 40 : 0); m.ellipse((i * 7) % 11 - 5, -45 + i * 6, 10, 4 + (i % 3) * 2); }
    },
  });
  // grainy broken stroke
  add('mind_dry', {
    type: 'default', weight: 5, scatter: 1.0, sharpness: 0.5, grain: 0.3, opacity: 130, spacing: 0.3,
    pressure: [0.8, 1.15, 0.6], rotate: 'natural', noise: 0.5,
  });
  // ink contour with pressure swell (lost-and-found edges)
  add('mind_contour', {
    type: 'default', weight: 1.5, scatter: 0.25, sharpness: 0.88, grain: 0.75, opacity: 215, spacing: 0.2,
    pressure: [0.35, 1.3, 0.35], rotate: 'none', noise: 0.3,
  });
  // calligraphic stroke that swells and tapers (network edges)
  add('mind_callig', {
    type: 'default', weight: 1.7, scatter: 0.22, sharpness: 0.8, grain: 0.62, opacity: 205, spacing: 0.16,
    pressure: [0.18, 1.45, 0.22], rotate: 'none', noise: 0.3,
  });
  // steadier dash for code-token bars
  add('mind_bar', {
    type: 'default', weight: 1.4, scatter: 0.18, sharpness: 0.82, grain: 0.7, opacity: 215, spacing: 0.16,
    pressure: [0.7, 1.08, 0.8], rotate: 'none', noise: 0.25,
  });
  // soft, broken atmospheric streak (background space)
  add('mind_haze', {
    type: 'default', weight: 9, scatter: 2.2, sharpness: 0.25, grain: 0.22, opacity: 34, spacing: 0.35,
    pressure: [0.35, 1.2, 0.35], rotate: 'natural', noise: 0.5,
  });
  // steady copper trace
  add('mind_trace', {
    type: 'default', weight: 1, scatter: 0.14, sharpness: 0.9, grain: 0.9, opacity: 232, spacing: 0.18,
    pressure: [0.96, 1.04, 0.96], rotate: 'none', noise: 0.15,
  });
  // steady fine ink for UI glyph work
  add('mind_ui', {
    type: 'default', weight: 0.8, scatter: 0.08, sharpness: 0.96, grain: 0.92, opacity: 220, spacing: 0.18,
    pressure: [1, 1], rotate: 'none', noise: 0.1,
  });
  // speckle / stipple
  add('mind_speck', {
    type: 'spray', weight: 3, scatter: 12, sharpness: 12, grain: 22, opacity: 140, spacing: 1.2,
    pressure: [1, 1], noise: 0.4,
  });
}
