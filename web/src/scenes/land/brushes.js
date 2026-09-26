// LAND custom brushes (names prefixed land_). Sizes are design units.
export function defineLandBrushes(brush) {
  const add = (name, o) => { if (!brush.box().includes(name)) brush.add(name, o); };
  // bristle comb: a row of bristle dots across the stroke -> parallel dry-brush streaks
  add('land_comb', {
    type: 'custom', weight: 12, scatter: 0.3, opacity: 70, spacing: 0.08, pressure: [0.7, 1.1, 0.55],
    rotate: 'natural', markerTip: false, noise: 0.45,
    tip: (m) => {
      m.noStroke();
      const ys = [-40, -31, -24, -15, -9, -1, 6, 13, 21, 28, 37];
      const ds = [4, 6, 5, 7, 4, 8, 5, 7, 4, 6, 3];
      ys.forEach((y, i) => { m.fill(i % 3 === 0 ? 60 : 0); m.ellipse(0, y, 14, ds[i]); });
    },
  });
  // soft comb for glazes (wider, fainter)
  add('land_glaze', {
    type: 'custom', weight: 24, scatter: 0.4, opacity: 34, spacing: 0.1, pressure: [0.6, 1.1, 0.5],
    rotate: 'natural', markerTip: false, noise: 0.5,
    tip: (m) => {
      m.noStroke();
      for (let i = 0; i < 16; i++) { m.fill(i % 2 ? 30 : 0); m.ellipse((i * 7) % 11 - 5, -45 + i * 6, 10, 4 + (i % 3) * 2); }
    },
  });
  // dry broken stroke (grainy)
  add('land_dry', {
    type: 'default', weight: 6, scatter: 1.2, sharpness: 0.5, grain: 0.28, opacity: 140, spacing: 0.3,
    pressure: [0.8, 1.15, 0.6], rotate: 'natural', noise: 0.5,
  });
  // leaf: tapered single-stroke leaf / blade
  add('land_leaf', {
    type: 'default', weight: 6, scatter: 0.2, sharpness: 0.8, grain: 0.9, opacity: 210, spacing: 0.2,
    pressure: [0.2, 1.3, 0.1], rotate: 'natural', noise: 0.25,
  });
  // contour: inky line with pressure swell (lost-and-found edges)
  add('land_contour', {
    type: 'default', weight: 1.6, scatter: 0.3, sharpness: 0.85, grain: 0.7, opacity: 210, spacing: 0.22,
    pressure: [0.35, 1.3, 0.3], rotate: 'none', noise: 0.3,
  });
  // flame tongue: fat at the base, needle tip
  add('land_flame', {
    type: 'default', weight: 6, scatter: 0.15, sharpness: 0.75, grain: 0.85, opacity: 225, spacing: 0.18,
    pressure: (t) => (t < 0.22 ? 0.95 + t : 1.17 * Math.pow(1 - (t - 0.22) / 0.78, 1.25) + 0.03), rotate: 'natural', noise: 0.2,
  });
  // stipple speckle for skin / moss / ash texture
  add('land_speck', {
    type: 'spray', weight: 3, scatter: 12, sharpness: 12, grain: 22, opacity: 150, spacing: 1.2,
    pressure: [1, 1], noise: 0.4,
  });
}
