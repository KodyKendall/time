// A pinhole camera for the machine segment's painted 3D cards.
// World: X right, Y up, Z forward (away from the viewer at the start), units "wu".
// Screen: design units (1920x1080), y down. The camera has a yaw of 0, pitch `pitch` (>0 looks
// down), focal length F (design units), principal point (ppx, ppy) and an ortho blend `ortho`
// (0 = perspective, 1 = orthographic with scale F / oref) used to land exactly on the flat die.
export function makeCam({ x = 0, y = 0, z = 0, pitch = 0, roll = 0, F = 1250, ppx = 960, ppy = 540, ortho = 0, oref = 1000 } = {}) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const cam = { x, y, z, pitch, roll, F, ppx, ppy, ortho, oref, cp, sp };
  // world -> camera coords [xc, yc, zc] (zc = depth along the view direction)
  cam.toCam = (X, Y, Z) => {
    const dx = X - x, dy = Y - y, dz = Z - z;
    const yc = dy * cp + dz * sp;
    return [dx * cr - yc * sr, dx * sr + yc * cr, -dy * sp + dz * cp];
  };
  const rot = (v) => { const yc = v[1] * cp + v[2] * sp; return [v[0] * cr - yc * sr, v[0] * sr + yc * cr, -v[1] * sp + v[2] * cp]; };
  // world -> screen [sx, sy, depth]; depth <= 0 means behind the camera
  cam.project = (X, Y, Z) => {
    const c = cam.toCam(X, Y, Z);
    if (ortho <= 0) {
      if (c[2] <= 1e-6) return [NaN, NaN, c[2]];
      return [ppx + (F * c[0]) / c[2], ppy - (F * c[1]) / c[2], c[2]];
    }
    const s = F / oref;
    const w = (1 - ortho) * (c[2] / oref) + ortho;
    return [ppx + (s * c[0]) / w, ppy - (s * c[1]) / w, c[2]];
  };
  // projection scale (design units per wu) at depth zc
  cam.scaleAt = (zc) => {
    if (ortho <= 0) return F / zc;
    const s = F / oref;
    return s / ((1 - ortho) * (zc / oref) + ortho);
  };
  // Homography for the card P(u,v) = P0 + u*Eu + v*Ev, u,v in [0,1]. Row-major 3x3.
  cam.cardH = (P0, Eu, Ev) => {
    const c0 = cam.toCam(P0[0], P0[1], P0[2]);
    const cu = rot(Eu), cv = rot(Ev);
    if (ortho <= 0) {
      return [
        F * cu[0] + ppx * cu[2], F * cv[0] + ppx * cv[2], F * c0[0] + ppx * c0[2],
        -F * cu[1] + ppy * cu[2], -F * cv[1] + ppy * cv[2], -F * c0[1] + ppy * c0[2],
        cu[2], cv[2], c0[2],
      ];
    }
    // blend of perspective (normalised by oref) and orthographic maps: still a homography
    const s = F / oref, a = 1 - ortho;
    const w = [a * cu[2] / oref, a * cv[2] / oref, a * c0[2] / oref + ortho];
    return [
      s * cu[0] + ppx * w[0], s * cv[0] + ppx * w[1], s * c0[0] + ppx * w[2],
      -s * cu[1] + ppy * w[0], -s * cv[1] + ppy * w[1], -s * c0[1] + ppy * w[2],
      w[0], w[1], w[2],
    ];
  };
  // Depth (zc) of the card at (u,v) is linear: returns [z0, zu, zv].
  cam.cardDepth = (P0, Eu, Ev) => {
    const c0 = cam.toCam(P0[0], P0[1], P0[2]);
    return [c0[2], -Eu[1] * sp + Eu[2] * cp, -Ev[1] * sp + Ev[2] * cp];
  };
  return cam;
}

// Clip a (u,v) polygon to depth >= near where depth = d0 + u*du + v*dv (Sutherland-Hodgman).
export function clipNear(poly, d, near) {
  const f = (p) => d[0] + p[0] * d[1] + p[1] * d[2] - near;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// Screen bounds of a card (null if fully behind). Uses the homography directly.
export function cardBounds(H, poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [u, v] of poly) {
    const w = H[6] * u + H[7] * v + H[8];
    if (w <= 1e-9) return null;
    const x = (H[0] * u + H[1] * v + H[2]) / w, y = (H[3] * u + H[4] * v + H[5]) / w;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}
