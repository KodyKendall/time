// Monotone cubic (PCHIP) keyframe interpolation for camera channels: smooth, no overshoot.
// keys: [[t, v], ...] sorted by t. Optional end slopes (default: PCHIP estimates; ease: 0).
export function pchip(keys, { s0 = null, s1 = null } = {}) {
  const n = keys.length;
  const t = keys.map((k) => k[0]), v = keys.map((k) => k[1]);
  const h = [], d = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(t[i + 1] - t[i]);
    d.push((v[i + 1] - v[i]) / h[i]);
  }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  m[0] = s0 ?? (n > 1 ? d[0] : 0);
  m[n - 1] = s1 ?? (n > 1 ? d[n - 2] : 0);
  const f = (x) => {
    if (x <= t[0]) return v[0] + m[0] * (x - t[0]) * 0; // clamp (hold) before the first key
    if (x >= t[n - 1]) return v[n - 1];
    let i = 0;
    while (i < n - 2 && x > t[i + 1]) i++;
    const hh = h[i], u = (x - t[i]) / hh;
    const h00 = (1 + 2 * u) * (1 - u) * (1 - u), h10 = u * (1 - u) * (1 - u), h01 = u * u * (3 - 2 * u), h11 = u * u * (u - 1);
    return h00 * v[i] + h10 * hh * m[i] + h01 * v[i + 1] + h11 * hh * m[i + 1];
  };
  return f;
}
