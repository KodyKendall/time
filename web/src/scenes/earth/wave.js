// EARTH — the great wave (lt ~15.4 .. 20.2): a swell rises in front of the Moon, crests at 47.5 s,
// its lip curls into a Hokusai spiral of foam, the camera dives into the curl and the water closes
// over us. Geometry is analytic in lt; strokes are painted per frame in screen space (crisp at
// any zoom).
import { C, M, TAU, lerp, clamp, hex, mixHex, smoothstep, smoother, win, strokeBatch, hash, fbm2, noise1, lerpLog } from './common.js';
import { HORIZON } from './descent.js';

export const W8 = { rise0: 15.4, crest: 17.5, dive0: 18.7, crash: 20.0 };
const ZMAX = 7.5;

// wave geometry in "stage" coordinates (screen units before the dive zoom)
export function waveGeom(lt) {
  const g = smoother(W8.rise0, W8.crest, lt);
  const H = lerp(6, 340, Math.pow(g, 0.9)) + 70 * smoother(W8.crest, 19.3, lt);
  const yb = lerp(HORIZON + 90, HORIZON + 260, smoother(W8.rise0, 19.4, lt));
  const xc = lerp(1360, 1180, smoother(W8.rise0, 19.4, lt));
  const curl = smoother(16.8, 18.5, lt) * 1.0 + 0.35 * smoother(18.5, 19.8, lt); // turns
  const S = [xc - 0.34 * H, yb - 0.52 * H];
  const Cr = [xc, yb - H];
  const phS = Math.atan2(Cr[1] - S[1], Cr[0] - S[0]);
  const rho0 = Math.hypot(Cr[0] - S[0], Cr[1] - S[1]);
  return { g, H, yb, xc, curl, S, Cr, phS, rho0, k: 0.22, lip0: 0.2 * H };
}

// point on the spiral at turn fraction f; inner in [0,1] moves from the outer edge inward by the lip width
export function lipPt(G, f, inner = 0) {
  const th = G.phS - f * TAU;
  const rho = G.rho0 * Math.exp(-G.k * f * TAU);
  const w = G.lip0 * Math.exp(-0.5 * f * TAU);
  const rr = Math.max(1, rho - inner * Math.min(w, rho * 0.9));
  return [G.S[0] + Math.cos(th) * rr, G.S[1] + Math.sin(th) * rr];
}

// camera dive into the curl: stage -> screen
export function diveView(lt) {
  const u = smoother(W8.dive0, W8.crash + 0.1, lt);
  const G = waveGeom(Math.min(lt, 19.5));
  const eye = lipPt(G, Math.max(0.6, G.curl * 0.95), 0.2);
  if (u <= 0) return { m: M.id(), z: 1, u, eye };
  const z = lerpLog(1, ZMAX, Math.pow(u, 1.3));
  const tx = lerp(eye[0], 960, smoother(0, 0.75, u)), ty = lerp(eye[1], 540, smoother(0, 0.75, u));
  const rot = -0.35 * u * u;
  // the lurch as the lip lands on us
  const sh = win(lt, 19.35, 19.55, 19.75, 20.1);
  const sx = 14 * sh * noise1(lt * 22, 3), sy = 14 * sh * noise1(lt * 22, 4);
  return { m: M.chain(M.translate(tx + sx, ty + sy), M.rotate(rot), M.scale(z), M.translate(-eye[0], -eye[1])), z, u, eye };
}
const ap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

// back of a swell: smooth hump from the crest (s = 0) to the far trough (s = 1)
const hump = (s) => (1 - s) * (1 - s) * (1 + 2 * s);

// the water body outline (stage coords): back slope, crest, lip over the top and round the spiral,
// then down the face (the hollow of the barrel is water too: the face behind the lip)
function bodyPoly(G, lt) {
  const pts = [];
  const B = 820;
  for (let j = 0; j <= 30; j++) {
    const s = 1 - j / 30;
    const x = G.xc + B * s;
    const und = 7 * Math.sin(x * 0.018 + lt * 1.6) * s;
    pts.push([x, G.yb - G.H * hump(s) + und]);
  }
  const nf = Math.max(2, Math.ceil(G.curl * 48));
  for (let j = 1; j <= nf; j++) pts.push(lipPt(G, (G.curl * j) / nf, 0));
  // from the lip tip down the face to the front base
  const tip = lipPt(G, G.curl, 0.5);
  const fb = [G.xc - 0.66 * G.H - 50, G.yb + 4];
  for (let j = 1; j <= 14; j++) {
    const s = j / 14;
    pts.push([lerp(tip[0], fb[0], s) - 0.08 * G.H * Math.sin(Math.PI * s), lerp(tip[1], fb[1], Math.pow(s, 0.85))]);
  }
  pts.push([fb[0] - 500, G.yb + 70], [G.xc + B + 1200, G.yb + 70]);
  // a following swell on the right
  return pts;
}
function swell2(G, lt) {
  const pts = [];
  const x0 = G.xc + 520, w = 900, h = G.H * 0.38;
  for (let j = 0; j <= 30; j++) {
    const s = j / 30;
    const x = x0 + w * s;
    pts.push([x, G.yb + 10 - h * Math.sin(Math.PI * s) ** 1.6 * (1 - 0.3 * s) + 5 * Math.sin(x * 0.02 + lt * 2)]);
  }
  pts.push([x0 + w, G.yb + 80], [x0, G.yb + 80]);
  return pts;
}

// Paint the wave's body silhouette (mask) in screen space
export function paintWaveMask(c, lt) {
  const G = waveGeom(lt);
  const V = diveView(lt).m;
  const full = smoother(19.72, 20.02, lt);
  if (full >= 0.999) {
    c.washPoly([[-50, -50], [1970, -50], [1970, 1130], [-50, 1130]], '#ffffff', 255);
    return;
  }
  c.washPoly(bodyPoly(G, lt).map((p) => ap(V, p)), '#ffffff', 255);
  if (G.H > 40) c.washPoly(swell2(G, lt).map((p) => ap(V, p)), '#fffff0', 255);
  // soften the foot: erase in steps so the wave rises out of the sea rather than sitting on it
  const u = diveView(lt).u;
  if (u < 0.3) {
    c.flush();
    c.native((p) => {
      p.push();
      p.noStroke();
      for (let k = 0; k < 8; k++) {
        const y0 = ap(V, [0, G.yb - 30 + k * 9])[1];
        p.erase(40, 0);
        p.rect(-100, y0, 2200, 1400);
        p.noErase();
      }
      p.pop();
    });
  }
  if (full > 0) {
    // the water closes over the camera from the frame edges
    const rr = lerp(1.0, 0.0, full);
    const ring = [];
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU; ring.push([960 + Math.cos(a) * 2400, 540 + Math.sin(a) * 2400]); }
    for (let i = 64; i >= 0; i--) { const a = (i / 64) * TAU; ring.push([960 + Math.cos(a) * 1150 * rr, 540 + Math.sin(a) * 700 * rr]); }
    c.washPoly(ring, '#ffffff', 255);
  }
}

// Face shading, striations, foam, claws, spray (screen space, per frame; texture boils at 12 fps)
export function paintWaveFoam(c, lt, key) {
  const G = waveGeom(lt);
  const dv = diveView(lt);
  const V = dv.m, Z = dv.z;
  const vis = 1 - smoother(19.72, 20.04, lt);
  if (vis <= 0 || G.H < 10) return;
  const tr = (p) => ap(V, p);
  const grown = smoothstep(12, 170, G.H); // young swells get fine marks only
  const zw = (w, cap = 4) => Math.min(cap, w * Math.pow(Z, 0.6)) * vis * lerp(0.25, 1, grown);
  const boil = Math.floor(lt * 12);
  const list = [];
  // painted body: form-following strokes, deep navy low on the wave, moonlit teal under the crest
  const B = 820;
  const bodyCols = ['#07111e', '#0b1a2c', '#12304a', '#1a4458', '#1f5a66', '#2a6a78', '#3a8a92', '#5aaab0'];
  for (let i = 0; i < 46; i++) {
    const tf = hash(i, 51); // height fraction on the hump
    const s0 = hash(i, 52) * 0.8, s1 = Math.min(1, s0 + 0.18 + 0.4 * hash(i, 53));
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const s = lerp(s0, s1, j / 10);
      const x = G.xc - 0.22 * G.H * (1 - s) ** 3 * tf + B * s;
      const y = G.yb - G.H * hump(s) * tf + 5 * Math.sin(x * 0.02 + i);
      pts.push(tr([x, y]).concat([0.3 + 0.8 * Math.sin((Math.PI * j) / 10)]));
    }
    const ci = Math.min(bodyCols.length - 1, Math.floor(tf * tf * bodyCols.length + hash(i, 54) * 1.2));
    list.push({ pts, brush: i % 3 === 0 ? 'dry' : i % 3 === 1 ? 'earth_body' : 'pastel', color: bodyCols[ci], w: zw(lerp(1.2, 2.6, hash(i, 55)), 5), curv: 0.5, seed: 'bd' + i + '_' + boil });
  }
  // the barrel: dark strokes winding into the curl, an air pocket at the eye
  if (G.curl > 0.25) {
    const eyeDark = 1 - smoother(19.3, 19.8, lt);
    for (let i = 0; i < 12; i++) {
      const inner = 0.55 + 0.45 * hash(i, 56);
      const f0 = G.curl * (0.35 + 0.4 * hash(i, 57)), f1 = Math.min(G.curl, f0 + 0.35);
      const pts = [];
      for (let j = 0; j <= 10; j++) pts.push(tr(lipPt(G, lerp(f0, f1, j / 10), inner)).concat([0.4 + 0.6 * Math.sin((Math.PI * j) / 10)]));
      list.push({ pts, brush: i % 2 ? 'earth_body' : 'dry', color: i % 3 ? '#050b16' : '#0b1a2c', w: zw(1.8, 5) * eyeDark, curv: 0.5, seed: 'br' + i + '_' + boil });
    }
  }
  // striations along the back of the wave (Hokusai lines) - only once the swell has body
  const lineK = smoothstep(60, 190, G.H);
  for (let i = 0; i < 18 && lineK > 0.02; i++) {
    const off = 0.06 + i * 0.05;
    const pts = [];
    for (let j = 0; j <= 20; j++) {
      const s = 1 - j / 20;
      const x = G.xc + B * s * (1 - off * 0.2) + 20 * off;
      const y = G.yb - G.H * hump(s) * (1 - off) + 6 * Math.sin(x * 0.012 + i + lt) * s;
      pts.push(tr([x, y]).concat([0.3 + 0.7 * Math.sin(Math.PI * (j / 20))]));
    }
    list.push({ pts, brush: i % 3 ? 'wire' : 'earth_hair', color: i % 2 ? '#6fa8bc' : '#a8d8e0', w: zw(0.8 + 0.3 * (i % 3)) * lineK, curv: 0.5, seed: `st${i}_${boil}` });
  }
  // lines that wind into the curl
  for (let i = 0; i < 10; i++) {
    const inner = 0.12 + i * 0.085;
    const pts = [];
    const nf = Math.max(3, Math.ceil(G.curl * 34));
    for (let j = 0; j <= nf; j++) pts.push(tr(lipPt(G, (G.curl * j) / nf, inner)).concat([0.35 + 0.65 * Math.sin((Math.PI * j) / nf)]));
    if (pts.length > 2 && G.curl > 0.05) list.push({ pts, brush: 'wire', color: i % 2 ? '#8fc8d0' : '#d8f0ee', w: zw(0.8), curv: 0.5, seed: `cs${i}_${boil}` });
  }
  // the foam ribbon: along the crest and round the spiral (cream), thinning to the tip
  const nf = Math.max(4, Math.ceil(G.curl * 56) + 6);
  const crest = [];
  for (let j = 12; j >= 1; j--) {
    const s = (j / 12) * 0.22;
    crest.push(tr([G.xc + B * s, G.yb - G.H * hump(s) + 3]).concat([0.25 + 0.75 * (1 - j / 12)]));
  }
  for (let j = 0; j <= nf; j++) {
    const f = (G.curl * j) / nf;
    crest.push(tr(lipPt(G, f, 0.06)).concat([lerp(1.15, 0.2, j / nf)]));
  }
  const fw = 0.028 * G.H;
  list.push({ pts: crest, brush: 'earth_body', color: '#efe6cf', w: zw(fw / 5.5 * 1.4, 5), curv: 0.5, seed: `fr0_${boil}` });
  list.push({ pts: crest.map((p) => [p[0], p[1] - 1.5, p[2] * 0.55]), brush: 'gouache', color: '#fffaf0', w: zw(fw / 8 * 0.6, 3.5), curv: 0.5, seed: `fr1_${boil}` });
  // inner spiral foam line
  if (G.curl > 0.2) {
    const pts = [];
    for (let j = 0; j <= nf; j++) pts.push(tr(lipPt(G, (G.curl * j) / nf, 0.8)).concat([lerp(0.8, 0.15, j / nf)]));
    list.push({ pts, brush: 'earth_hair', color: '#f3ecd8', w: zw(1.4), curv: 0.5, seed: `fr2_${boil}` });
  }
  // Hokusai claws: tapered fingers off the leading edge of the lip, curling back towards the wave
  const nClaw = 9;
  for (let i = 0; i < nClaw; i++) {
    const f = G.curl * lerp(0.1, 0.42, i / (nClaw - 1)) + 0.015 * hash(i, 48);
    if (f > G.curl || G.curl < 0.08) continue;
    const p0 = lipPt(G, f, 0);
    const th = G.phS - f * TAU;
    const out = [Math.cos(th), Math.sin(th)];
    const back = [-Math.sin(th), Math.cos(th)];
    const L = G.H * lerp(0.2, 0.1, i / nClaw) * (0.7 + 0.6 * hash(i, 41)) * smoother(0, 0.4, G.curl) * (1 - 0.8 * smoother(1.4, 3.5, Z));
    const pts = [];
    for (let j = 0; j <= 6; j++) {
      const s = j / 6;
      const x = p0[0] + out[0] * L * s + back[0] * L * 0.55 * s * s;
      const y = p0[1] + out[1] * L * s + back[1] * L * 0.55 * s * s;
      pts.push(tr([x, y]).concat([1.1 - s * 0.9]));
    }
    list.push({ pts, brush: 'earth_body', color: i % 3 ? '#efe6cf' : '#fffaf0', w: zw(fw / 5.5 * 0.85, 6), curv: 0.6, seed: `cw${i}_${boil}` });
    // secondary finger
    const pts2 = pts.slice(2).map((p, j) => [p[0] + back[0] * L * 0.18 * j / 4, p[1] + back[1] * L * 0.18 * j / 4, p[2] * 0.7]);
    if (i % 2 === 0) list.push({ pts: pts2, brush: 'earth_body', color: '#f3ecd8', w: zw(fw / 5.5 * 0.45, 4), curv: 0.6, seed: `cx${i}_${boil}` });
    const tp = pts[pts.length - 1];
    list.push({ pts: [[tp[0], tp[1]], [tp[0] + 3, tp[1] + 2]], brush: 'earth_dab', color: '#fffaf0', w: zw(0.35, 3), curv: 0, seed: `ct${i}_${boil}` });
  }
  // foam streaks on the face
  for (let i = 0; i < 12; i++) {
    const s0 = hash(i, 42) * 0.7 + 0.15;
    const tip = lipPt(G, G.curl, 0.5);
    const fb = [G.xc - 0.66 * G.H - 50, G.yb];
    const a = [lerp(tip[0], fb[0], s0) + 20, lerp(tip[1], fb[1], s0)];
    const b = [a[0] + 60 + 40 * hash(i, 43), a[1] + 16 * hash(i, 44)];
    list.push({ pts: [tr(a), tr([(a[0] + b[0]) / 2, a[1] + 4]), tr(b)], brush: i % 2 ? 'dry' : 'earth_hair', color: '#dfe8e4', w: zw(i % 2 ? 0.45 : 1.0), curv: 0.5, seed: `fs${i}_${boil}` });
  }
  // spray thrown off the lip
  const sprayN = Math.round(80 * smoother(W8.crest - 0.7, W8.crest + 0.3, lt));
  for (let i = 0; i < sprayN; i++) {
    const f = hash(i, 45) * G.curl * 0.6;
    const p0 = lipPt(G, f, 0);
    const th = G.phS - f * TAU;
    const age = ((lt * 1.2 + hash(i, 46)) % 1);
    const d = G.H * (0.03 + 0.28 * age);
    const x = p0[0] + Math.cos(th - 0.5) * d, y = p0[1] + Math.sin(th - 0.5) * d + 70 * age * age;
    const q = tr([x, y]);
    const s = (2 + 5 * hash(i + boil, 47)) * (1 - age) * Math.min(3, Math.sqrt(Z));
    list.push({ pts: [q, [q[0] + s, q[1] + s * 0.4]], brush: 'earth_dab', color: '#f6f2e6', w: zw(0.3 * (1 - age), 2.5), curv: 0, seed: `sp${i}_${boil}` });
  }
  // foam at the foot of the wave
  for (let i = 0; i < 12; i++) {
    const x0 = G.xc - 0.66 * G.H - 260 + i * 55 + 20 * Math.sin(lt * 2 + i);
    list.push({ pts: [tr([x0, G.yb + 4]), tr([x0 + 60, G.yb + 2 + 3 * Math.sin(i)]), tr([x0 + 120, G.yb + 5])], brush: 'dry', color: '#dfe8e4', w: zw(0.55), curv: 0.5, seed: `bf${i}_${boil}` });
  }
  strokeBatch(c, list);
}

// moonlight through the lip - additive, masked by the wave body
export function waveLight(R, lt, mask) {
  const G = waveGeom(lt);
  const dv = diveView(lt);
  const p = ap(dv.m, [G.xc - 0.05 * G.H, G.yb - 0.82 * G.H]);
  const g = smoother(W8.rise0 + 0.8, W8.crest, lt) * (1 - smoother(19.4, 19.9, lt));
  if (g > 0) R.glow(p[0], p[1], G.H * 0.55 * dv.z, [0.35, 0.8, 0.82], 0.22 * g, { shape: [0.9, 0.5, 2], sx: 1.7, sy: 0.7, ext: 2, mask });
}
