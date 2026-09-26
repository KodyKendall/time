// EARTH — custom p5.brush brushes (names prefixed `earth_`). Sizes are design units (added after the
// global scaleBrushes, like the film's own custom brushes).
export function earthBrushes(brush) {
  const add = (name, p) => {
    if (!brush.box().includes(name)) brush.add(name, p);
  };
  // short loaded dab (granulation, foam lace, sparkle of paint)
  add('earth_dab', { type: 'default', weight: 3.2, scatter: 0.6, sharpness: 0.55, grain: 0.7, opacity: 170, spacing: 0.35, pressure: [1.1, 0.55], rotate: 'none', noise: 0.35 });
  // tapered flame / flare stroke
  add('earth_flame', { type: 'default', weight: 2.4, scatter: 0.35, sharpness: 0.8, grain: 0.85, opacity: 200, spacing: 0.25, pressure: [0.25, 1.25, 0.15], rotate: 'none', noise: 0.3 });
  // body stroke that follows form (loaded brush, soft edges)
  add('earth_body', { type: 'default', weight: 5.5, scatter: 1.0, sharpness: 0.5, grain: 0.8, opacity: 150, spacing: 0.3, pressure: [0.7, 1.15, 0.6], rotate: 'none', noise: 0.4 });
  // thin tapered filament / hairline
  add('earth_hair', { type: 'default', weight: 0.9, scatter: 0.15, sharpness: 0.95, grain: 0.9, opacity: 200, spacing: 0.2, pressure: [0.2, 1.1, 0.2], rotate: 'none', noise: 0.25 });
  // scumble: broken, grainy, wide
  add('earth_scumble', { type: 'default', weight: 7, scatter: 2.6, sharpness: 0.4, grain: 0.3, opacity: 110, spacing: 0.45, pressure: [0.9, 1.1, 0.8], rotate: 'none', noise: 0.5 });
  // fine speckle spray
  add('earth_speck', { type: 'spray', weight: 0.9, scatter: 10, sharpness: 15, grain: 14, opacity: 150, spacing: 1.4, pressure: [1, 1], noise: 0.4 });
  earthBrushes2(brush);
}

// translucent tapered band (dust lanes, haze) with no marker blobs at the ends
export function earthBrushes2(brush) {
  const add = (name, p) => {
    if (!brush.box().includes(name)) brush.add(name, p);
  };
  add('earth_lane', { type: 'marker', weight: 16, scatter: 1.5, opacity: 26, spacing: 0.3, pressure: [0.15, 1.1, 0.15], markerTip: false, noise: 0.35 });
  add('earth_glaze', { type: 'marker', weight: 9, scatter: 0.8, opacity: 60, spacing: 0.3, pressure: [0.2, 1.05, 0.2], markerTip: false, noise: 0.3 });
}
