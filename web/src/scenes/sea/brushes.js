// SEA custom brushes (names prefixed sea_). Sizes are design units.
export function defineSeaBrushes(brush) {
  const add = (name, o) => { if (!brush.box().includes(name)) brush.add(name, o); };
  // bristle comb: parallel dry-brush streaks that follow the stroke
  add('sea_comb', {
    type: 'custom', weight: 12, scatter: 0.3, opacity: 72, spacing: 0.08, pressure: [0.7, 1.1, 0.55],
    rotate: 'natural', markerTip: false, noise: 0.45,
    tip: (m) => {
      m.noStroke();
      const ys = [-40, -31, -23, -15, -8, -1, 6, 14, 22, 29, 38];
      const ds = [4, 6, 5, 7, 4, 8, 5, 7, 4, 6, 3];
      ys.forEach((y, i) => { m.fill(i % 3 === 0 ? 60 : 0); m.ellipse(0, y, 14, ds[i]); });
    },
  });
  // soft wide glaze (translucent colour shifts)
  add('sea_glaze', {
    type: 'custom', weight: 24, scatter: 0.4, opacity: 30, spacing: 0.1, pressure: [0.6, 1.1, 0.5],
    rotate: 'natural', markerTip: false, noise: 0.5,
    tip: (m) => {
      m.noStroke();
      for (let i = 0; i < 16; i++) { m.fill(i % 2 ? 30 : 0); m.ellipse((i * 7) % 11 - 5, -45 + i * 6, 10, 4 + (i % 3) * 2); }
    },
  });
  // dry broken stroke
  add('sea_dry', {
    type: 'default', weight: 6, scatter: 1.2, sharpness: 0.5, grain: 0.28, opacity: 140, spacing: 0.3,
    pressure: [0.8, 1.15, 0.6], rotate: 'natural', noise: 0.5,
  });
  // tapered blade / fin ray / leaf
  add('sea_leaf', {
    type: 'default', weight: 6, scatter: 0.2, sharpness: 0.8, grain: 0.9, opacity: 210, spacing: 0.2,
    pressure: [0.2, 1.3, 0.1], rotate: 'natural', noise: 0.25,
  });
  // ink contour with pressure swell (lost-and-found edges)
  add('sea_contour', {
    type: 'default', weight: 1.6, scatter: 0.3, sharpness: 0.85, grain: 0.7, opacity: 215, spacing: 0.22,
    pressure: [0.35, 1.3, 0.3], rotate: 'none', noise: 0.3,
  });
  // stipple speckle
  add('sea_speck', {
    type: 'spray', weight: 3, scatter: 12, sharpness: 12, grain: 22, opacity: 150, spacing: 1.2,
    pressure: [1, 1], noise: 0.4,
  });
  // soft round dab (for blobs / highlights)
  add('sea_dab', {
    type: 'default', weight: 8, scatter: 0.6, sharpness: 0.35, grain: 0.6, opacity: 120, spacing: 0.25,
    pressure: [0.9, 1.1, 0.9], rotate: 'none', noise: 0.4,
  });
}
