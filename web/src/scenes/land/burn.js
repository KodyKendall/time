// LAND — impact geometry, blast-wave timing and the burn "looks" (heat -> fire -> char -> ash).
import { lerp, clamp, smoothstep, ease, T, noise2, rng, h01 } from './util.js';
import { groundV } from './forest.js';

// Impact point: on the ground plane behind the dinosaur.
export const IMP = { u: 620, d: 1.3 };
IMP.v = groundV(IMP.d);
const ZS = 2060;                       // lateral units per unit of depth
const RA = 1320, RP = 0.6;             // blast radius  rho = RA * x^RP  (x = seconds after impact)

export function impactDist(u, d) {
  const xw = (u - 960) * d, xi = (IMP.u - 960) * IMP.d;
  return Math.hypot(xw - xi, (d - IMP.d) * ZS);
}
export function blastR(lt) {
  const x = lt - T.impact;
  return x <= 0 ? 0 : RA * Math.pow(x, RP);
}
export function hitTime(dist) {
  return T.impact + Math.pow(Math.max(0, dist) / RA, 1 / RP);
}
// Ground-plane point on the blast ring (angle a) projected to final coords of plane d.
export function ringPoint(rho, a) {
  const xi = (IMP.u - 960) * IMP.d;
  const xw = xi + Math.cos(a) * rho, d = IMP.d + (Math.sin(a) * rho) / ZS;
  if (d <= 0.05) return null;
  return { u: 960 + xw / d, v: groundV(d), d };
}

// Fire reaches an element some time after the blast: spreads outward from the impact over ~1.3 s.
export function burnTime(tHit) {
  return T.impact + 1.35 + 1.3 * clamp((tHit - T.impact) / 2.2);
}
// Burn state of an element (blast arrives at tHit, fire at tBurn) at local time lt.
export function burnState(lt, tHit, tBurn = burnTime(tHit)) {
  const tau = lt - tHit, tb = lt - tBurn;
  const late = smoothstep(T.ash0 - 0.4, T.end - 1.4, lt);    // everything is ash before the tilt ends
  const roar = 1 + 0.45 * Math.exp(-((lt - T.roar) ** 2) / 0.35);
  return {
    tau, tb,
    push: tau > 0 ? Math.exp(-tau * 2.2) * smoothstep(0, 0.08, tau) : 0,
    heat: Math.max(smoothstep(0, 0.35, tau), late),
    fire: tb > -0.4 ? Math.min(1.3, smoothstep(-0.4, 0.5, tb) * (1 - smoothstep(3.0, 5.0, tb)) * (1 - late * 0.8) * roar) : 0,
    char: Math.max(smoothstep(0.1, 2.0, tb), late),
    ash: Math.max(smoothstep(2.4, 4.6, tb), smoothstep(T.ash0, T.end - 0.9, lt)),
    burn: Math.max(smoothstep(-0.3, 1.6, tb), late),
  };
}

// Global light phases
export function flashK(lt) {                  // blinding flash at the impact (a few frames)
  const x = lt - T.impact;
  if (x < -0.05) return 0;
  if (x < 0) return ease.inQuad((x + 0.05) / 0.05);
  return Math.exp(-x * 16);
}
export function backlit(lt) {                 // silhouette factor (bright explosion behind)
  const x = lt - T.impact;
  if (x < -0.05) return 0;
  if (x < 0) return (x + 0.05) / 0.05;
  return 1 - smoothstep(0.9, 2.0, x);
}
export function fireGlow(lt) {                // overall fire light in the scene
  return smoothstep(T.impact + 0.8, T.roar, lt) * (1 - smoothstep(T.ash0 - 0.3, T.end - 0.8, lt));
}

// Layer options for a painted element with burn state b (and scene fire light g).
export function burnLook(b, g = 0, base = null) {
  const h = b.heat, ch = b.char, as = b.ash;
  // heat: warm and bright; char: dark desaturated; ash: grey
  const sat = lerp(lerp(1, 1.15, h), 0.12, ch) * lerp(1, 0.4, as);
  const bri = lerp(lerp(1, 1.0, h), 0.3, ch) * lerp(1, 1.6, as);
  const con = lerp(1, 1.18, ch) * lerp(1, 0.75, as);
  const tint = [lerp(1, 1.22, h * (1 - ch)) * lerp(1, 1.05, ch), lerp(1, 0.7, h * (1 - ch)) * lerp(1, 0.9, ch), lerp(1, 0.48, h * (1 - ch)) * lerp(1, 0.86, ch)];
  const o = { grade: [sat, bri, con], tint: [tint[0] * (1 + 0.12 * g), tint[1] * (1 - 0.04 * g), tint[2] * (1 - 0.12 * g)] };
  if (as > 0.001) o.color = [0.44, 0.42, 0.46, 0.78 * as];
  if (base) {
    o.grade = [o.grade[0] * base.grade[0], o.grade[1] * base.grade[1], o.grade[2] * base.grade[2]];
  }
  return o;
}

// ------------------------------------------------------------------------------------------------
// procedural mask textures (value in alpha), created lazily on the compositor's GL context
// ------------------------------------------------------------------------------------------------
const _tex = new Map();
function makeTex(gl, key, W, H, fn) {
  if (_tex.has(key)) {
    const t = _tex.get(key);
    if (t.gl === gl) return t;
  }
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = clamp(fn(x / W, y / H));
    const i = (y * W + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(v * 255);
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const t = { tex, w: W, h: H, flipY: false, gl };
  _tex.set(key, t);
  return t;
}
function fbm(x, y, s) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < 5; i++) { v += a * noise2(x * f, y * f, s + i * 13); n += a; a *= 0.5; f *= 2.1; }
  return v / n; // ~[-1,1]
}
// Burn noise: blotchy, well spread over [0,1]. (size in "units" = mask layer w/h)
export function burnNoiseAt(u, v) {           // CPU value of burnNoise at mask uv (0..1)
  return clamp(0.5 + 0.9 * fbm(u * 7, v * 7, 3));
}
export function burnNoise(gl) {
  return makeTex(gl, 'noise', 384, 384, (x, y) => 0.5 + 0.9 * fbm(x * 7, y * 7, 3));
}
// Burn-down mask for wide rows of trees: the cut height varies quickly along x (tree to tree).
export function burnDownWide(gl) {
  return makeTex(gl, 'downW', 1024, 256, (x, y) => 0.12 + 0.8 * y + 0.2 * fbm(x * 60, 0.5, 21) + 0.03 * fbm(x * 90, y * 8, 5));
}
// Vertical burn-down mask: high at the bottom (burns last), jagged noise.
export function burnDown(gl) {
  return makeTex(gl, 'down', 128, 512, (x, y) => 0.12 + 0.8 * y + 0.2 * fbm(x * 9, y * 2.5, 9) + 0.06 * fbm(x * 30, y * 6, 4));
}
// Mask object for R.layer: texture T stretched over a w x h box whose local->screen matrix is m.
export function texMask(Tx, m, w, h, threshold, softness = 0.04, invert = false) {
  const L = { tex: Tx.tex, w: Tx.w, h: Tx.h, flipY: false };
  const sc = [w / Tx.w, 0, 0, h / Tx.h, 0, 0];
  const mm = [m[0] * sc[0], m[1] * sc[0], m[2] * sc[3], m[3] * sc[3], m[4], m[5]];
  return { type: 'texture', layer: L, m: mm, threshold, softness, invert };
}
