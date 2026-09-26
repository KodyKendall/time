// Custom brushes (design units; added after scaleBrushes so their sizes are absolute).
export function defineBrushes(brush) {
  // Fine ink line for contours and fine line textures.
  brush.add('ink', {
    type: 'default', weight: 1.1, scatter: 0.25, sharpness: 0.9, grain: 0.8, opacity: 190, spacing: 0.25,
    pressure: [1.15, 0.85], rotate: 'none', noise: 0.25,
  });
  // Thin wiry line for engraving-like texture lines.
  brush.add('wire', {
    type: 'default', weight: 0.6, scatter: 0.12, sharpness: 0.95, grain: 0.9, opacity: 170, spacing: 0.2,
    pressure: [1, 0.9], rotate: 'none', noise: 0.2,
  });
  // Soft gouache-like body stroke.
  brush.add('gouache', {
    type: 'default', weight: 6, scatter: 1.2, sharpness: 0.55, grain: 0.9, opacity: 120, spacing: 0.35,
    pressure: [0.8, 1.2, 0.8], rotate: 'natural', noise: 0.35,
  });
  // Dry brush: broken, grainy strokes.
  brush.add('dry', {
    type: 'default', weight: 4, scatter: 2.2, sharpness: 0.7, grain: 0.35, opacity: 140, spacing: 0.5,
    pressure: [1.1, 0.7], rotate: 'natural', noise: 0.5,
  });
  // Stipple / dust.
  brush.add('dust', {
    type: 'spray', weight: 1.4, scatter: 22, sharpness: 15, grain: 30, opacity: 110, spacing: 1.6,
    pressure: [1, 1], noise: 0.4,
  });
  // Big soft wash stroke (for skies, glows painted into layers).
  brush.add('wash', {
    type: 'marker', weight: 26, scatter: 2, opacity: 18, spacing: 0.25,
    pressure: [0.8, 1.1, 0.8], markerTip: true, noise: 0.3,
  });
}
