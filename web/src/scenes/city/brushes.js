// CITY — custom p5.brush brushes (design units, prefixed 'city_').
// Massing brushes: brush.mass() spaces its hatch gestures by the brush's scatter, so these
// charcoal-like brushes give hand-hatched fills at different scales (s: windows, l: walls, xl: sky).
export function cityBrushes(brush) {
  if (brush.box().includes('city_mass_s')) return;
  const charcoal = (weight, scatter, opacity) => ({
    type: 'default', weight, scatter, sharpness: 0.62, grain: 1.8, opacity: Math.min(255, opacity * 1.25), spacing: 0.1,
    pressure: { mode: 'gaussian', curve: [0.15, 0.4], min_max: [1.1, 0.95] }, rotate: 'none', noise: 0.35,
  });
  brush.add('city_mass_s', charcoal(0.9, 3, 130));
  brush.add('city_mass_m', charcoal(1.4, 5, 120));
  brush.add('city_mass_l', charcoal(2.2, 8.5, 110));
  brush.add('city_mass_xl', charcoal(4, 16, 90));
  // bristle brush: a flat tip made of separate bristles -> streaky, directional paint marks
  brush.add('city_bristle', {
    type: 'custom', weight: 6, scatter: 0.4, opacity: 90, spacing: 0.08, pressure: [0.8, 1.1, 0.7],
    rotate: 'natural', markerTip: false, noise: 0.4,
    tip: (m) => {
      m.noStroke();
      m.fill(0);
      for (let i = -8; i <= 8; i++) {
        const h = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1);
        if (h < 0.25) continue;
        m.circle(Math.sin(i * 7.1) * 3, i * 5.5, 3.2 + 1.5 * Math.abs(Math.sin(i * 3.7)));
      }
    },
  });
}
