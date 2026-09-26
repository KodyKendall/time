// CITY — detailed facade paintings. Each building front is a unique painting (world units x D),
// built up like a painter would: underpainting wash, warm/cool masses, directional strokes along
// the wall, then windows / shopfronts / roofline / props, shade hatching and ink contours with
// pressure (lost and found edges). The painting's bottom edge is the ground line.
import { lerp, clamp, mixHex } from '../lib/kit.js';
import { rng } from '../../engine/math.js';

export const FD = 4;                 // design units per world unit for facade paintings
export const MX = 3;                 // horizontal margin (wobbly edges)
export const GROUND_H = 40, FLOOR_H = 30;

const CURTAINS = ['#f3e6c8', '#e8a0a0', '#c85a5a', '#8fd0c4', '#f2c46b', '#d9b0e0', '#fff2dc'];
const FLOWERS = ['#e8423a', '#ff7aa0', '#fff4e0', '#f59b3d', '#d83a6a', '#ffd23a'];
const LEAF = ['#3f7d5a', '#5d7a3e', '#2f6a48', '#6aa36b'];
const SIGN = ['#1f4e46', '#6a1f2a', '#16223a', '#2f5a3a', '#4a2a5e'];
export const LITC = ['#ffd98c', '#ffc866', '#ffe3ae', '#f6b04c', '#ffd070'];

export function roofExtra(spec) {
  const W = spec.bays * 28;
  return { cornice: 9, parapet: 17, gable: Math.round(W * 0.32) + 6, dutch: 44, mansard: 34 }[spec.roof] || 9;
}
export function facadeSize(spec) {
  const W = spec.bays * 28, Hb = GROUND_H + FLOOR_H * spec.floors, E = roofExtra(spec);
  return { W, Hb, E, tw: W + 2 * MX, th: Hb + E };
}

function mkPen(c, D) {
  const r = c.r;
  const X = (p) => (p.length > 2 ? [p[0] * D, p[1] * D, p[2]] : [p[0] * D, p[1] * D]);
  const k = D / 4; // brush weights are tuned at D = 4
  const pen = {
    r, D, k,
    wash(pts, col, op = 255) { c.washPoly(pts.map(X), col, op); },
    fill(pts, col, o) { c.fillPoly(pts.map(X), col, o); },
    hatch(pts, o) { c.hatchPoly(pts.map(X), { ...o, dist: o.dist * D, weight: (o.weight ?? 1) * k }); },
    stroke(pts, brush, col, w, curv = 0.5) { c.strokePath(pts.map(X), brush, col, w * k, curv); },
    line(x0, y0, x1, y1, brush, col, w, j = 0.15, n = 3) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, jj = i && i < n ? j : 0;
        pts.push([lerp(x0, x1, t) + r(-jj, jj), lerp(y0, y1, t) + r(-jj, jj)]);
      }
      pen.stroke(pts, brush, col, w);
    },
    rect(x0, y0, x1, y1, j = 0) {
      return [[x0 + r(-j, j), y0 + r(-j, j)], [x1 + r(-j, j), y0 + r(-j, j)], [x1 + r(-j, j), y1 + r(-j, j)], [x0 + r(-j, j), y1 + r(-j, j)]];
    },
    arch(x0, y0, x1, y1, n = 12) {
      const cx = (x0 + x1) / 2, rr = (x1 - x0) / 2, pts = [[x0, y1], [x1, y1], [x1, y0 + rr]];
      for (let i = 1; i < n; i++) { const a = (i / n) * Math.PI; pts.push([cx + Math.cos(a) * rr, y0 + rr - Math.sin(a) * rr]); }
      pts.push([x0, y0 + rr]);
      return pts;
    },
    blob(cx, cy, rx, ry, o = {}) { return c.blob(cx * D, cy * D, rx * D, ry * D, o).map((p) => [p[0] / D, p[1] / D]); },
    // hand-hatched massing of a polygon (painterly fill made of layered strokes)
    mass(pts, brush, col, o = {}) {
      const b = c.brush;
      if (c._lastOp === 'wash') b.flush();
      c._lastOp = 'mass';
      b.noStroke(); b.noFill(); b.noHatch();
      b.mass(brush, col, { precision: o.precision ?? 0.55, strength: o.strength ?? 0.8, gradient: o.gradient ?? 0.25, outline: !!o.outline });
      b.polygon(pts.map(X));
      b.noMass();
    },
    flush() { c.flush(); },
  };
  return pen;
}

// ------------------------------------------------------------------------------------------------
// spec: { bays, floors, style, ground, roof, win, seed, balconies:[floor..], laundry, ivy, dirty }
// returns meta: { windows:[{x0,y0,x1,y1,arch,kind}], lamps:[{x,y}] } in painting world units
// ------------------------------------------------------------------------------------------------
export function paintFacade(c, spec, D = FD) {
  const p = mkPen(c, D);
  const r = p.r;
  const st = spec.style;
  const { W, Hb, E, tw, th } = facadeSize(spec);
  const x0 = MX, x1 = MX + W, yG = th, yB = th - Hb; // ground line, body top
  const meta = { windows: [], lamps: [] };
  const fy = (k) => yG - GROUND_H - FLOOR_H * k; // top of floor k (k>=1); floor k spans [fy(k), fy(k)+30]

  // ---------------------------------------------------------------- 1. underpainting + roofline mass
  const body = [];
  for (let i = 0; i <= 6; i++) body.push([x0 + r(-0.35, 0.35), lerp(yB, yG, i / 6)]);
  for (let i = 6; i >= 0; i--) body.push([x1 + r(-0.35, 0.35), lerp(yB, yG, i / 6)]);
  const roofPoly = rooflinePoly(spec, x0, x1, yB, E, r);
  // light base wash, then a darker watercolour underpainting whose bleed/granulation shows through
  p.wash(body, mixHex(st.wall, st.wallL, 0.35));
  if (roofPoly) p.wash(roofPoly.wall, mixHex(st.wall, st.wallL, 0.35));
  p.fill(body, st.wall, { opacity: 150, bleed: 0.03, texture: 0.85, border: 0.55 });
  if (roofPoly) p.fill(roofPoly.wall, st.wall, { opacity: 140, bleed: 0.03, texture: 0.85, border: 0.5 });
  // ---------------------------------------------------------------- 2. massed tone: hand-hatched layers,
  // cool and darker towards the street, warm and lighter towards the sky
  p.flush();
  const inset = [[x0 + 2.5, yB + 1.5], [x1 - 2.5, yB + 1.5], [x1 - 2.5, yG - 1.5], [x0 + 2.5, yG - 1.5]];
  p.mass(inset, 'city_mass_l', mixHex(st.wall, st.wall2, 0.7), { precision: 0.55, strength: 0.6, gradient: 0.3 });
  p.flush();
  const upper = [[x0 + 2.5, yB + 1.5], [x1 - 2.5, yB + 1.5], [x1 - 2.5, yB + Hb * r(0.35, 0.5)], [x0 + 2.5, yB + Hb * r(0.45, 0.6)]];
  p.mass(upper, 'city_mass_l', mixHex(st.wallL, '#ffe2b0', 0.25), { precision: 0.4, strength: 0.5, gradient: 0.4 });
  const lower = [[x0 + 2.5, yG - Hb * r(0.25, 0.35)], [x1 - 2.5, yG - Hb * r(0.3, 0.4)], [x1 - 2.5, yG - 1], [x0 + 2.5, yG - 1]];
  p.mass(lower, 'city_mass_m', mixHex(st.wall2, '#3a2a4a', 0.12), { precision: 0.55, strength: 0.3, gradient: 0.3 });
  p.flush();
  // ---------------------------------------------------------------- 3. directional strokes along the wall
  if (st.brick) {
    // courses: grainy charcoal / crayon dashes in alternating brick tones, following the rows
    for (let y = yB + 1.15; y < yG; y += 2.3) {
      let x = x0 - r(0, 6);
      while (x < x1) {
        const len = r(6, 20), xe = Math.min(x1 + 1, x + len);
        p.stroke([[x, y + r(-0.15, 0.15)], [(x + xe) / 2, y + r(-0.2, 0.2)], [xe, y + r(-0.15, 0.15)]], r() < 0.5 ? 'charcoal' : 'crayon', r.pick([st.wall2, st.wallL, mixHex(st.wall2, '#2a1010', 0.2), st.wallL]), r(0.55, 0.9), 0.5);
        x = xe + r(1, 7);
      }
    }
    p.flush();
    for (let y = yB + 2.3; y < yG; y += 2.3) {
      if (r() < 0.45) continue;
      const xa = r(x0, x1 - 20);
      p.line(xa, y, Math.min(x1, xa + r(20, 70)), y, 'HB', mixHex(st.mortar, '#e8d8c0', 0.25), 0.8, 0.1, 3);
    }
  } else {
    // plaster: broad grainy strokes following the wall, warm and cool, with weathering streaks
    for (let i = 0; i < W * 0.8; i++) {
      const y = r(yB + 1, yG - 1), x = r(x0 - 8, x1 - 4), len = r(8, 30), a = r(-0.08, 0.08);
      p.stroke([[x, y], [x + len * 0.5, y + len * a * 0.5 + r(-0.4, 0.4)], [x + len, y + len * a]], r.pick(['charcoal', 'pastel', 'crayon']), r.pick([st.wall2, st.wallL, mixHex(st.wallL, '#fff2d8', 0.35), mixHex(st.wall2, '#4a2a4a', 0.2)]), r(0.6, 1.1), 0.5);
    }
    p.flush();
    for (let i = 0; i < W * 0.14; i++) {
      const x = r(x0, x1), y = r(yB, yG - 20);
      p.stroke([[x, y], [x + r(-0.6, 0.6), y + r(8, 26)]], 'charcoal', mixHex(st.wall2, '#2a1a10', 0.3), r(0.4, 0.7), 0.5);
    }
  }
  // weathering stipple
  for (let i = 0; i < 10; i++) {
    const x = r(x0, x1), y = r(yB, yG);
    p.stroke([[x, y], [x + r(-10, 10), y + r(10, 30)]], 'dust', mixHex(st.wall2, '#2a1a10', 0.3), r(0.8, 1.3), 0.5);
  }
  p.flush();
  // ---------------------------------------------------------------- 4. quoins + string courses
  if (spec.quoins) {
    for (let y = yB + 1; y < yG - 4; y += 6) {
      const big = Math.round((y - yB) / 6) % 2 === 0;
      p.wash(p.rect(x0, y, x0 + (big ? 6 : 4), y + 5, 0.15), st.trim, 235);
      p.wash(p.rect(x1 - (big ? 6 : 4), y, x1, y + 5, 0.15), st.trim, 235);
    }
  }
  for (let k = 0; k < spec.floors; k++) {
    const y = yG - GROUND_H - FLOOR_H * k;
    p.wash(p.rect(x0 - 0.5, y - 1.4, x1 + 0.5, y + 0.3, 0.1), st.trim, 240);
    p.hatch(p.rect(x0, y + 0.3, x1, y + 2.6), { dist: 0.9, angle: 0.9, brushName: 'wire', color: mixHex(st.wall2, '#1b1030', 0.5), weight: 0.5, rand: 0.25 });
  }
  p.flush();
  for (let k = 0; k < spec.floors; k++) {
    const y = yG - GROUND_H - FLOOR_H * k;
    p.line(x0, y + 0.4, x1, y + 0.4, 'ink', mixHex(st.wall2, '#1b1020', 0.5), 0.8, 0.12, 5);
    p.line(x0, y - 0.9, x1, y - 0.9, 'crayon', mixHex(st.trim, st.wall2, 0.3), 0.3, 0.1, 5);
    p.line(x0, y - 1.3, x1, y - 1.3, 'HB', '#fffaf0', 0.6, 0.1, 5);
  }

  // ---------------------------------------------------------------- 5. windows (upper floors)
  const bayX = (b) => x0 + b * 28 + 14;
  const winW = spec.win === 'pair' ? 8 : 12.4, winH = 18.5;
  for (let k = 1; k <= spec.floors; k++) {
    const top = fy(k);
    for (let b = 0; b < spec.bays; b++) {
      const xs = spec.win === 'pair' ? [bayX(b) - 5, bayX(b) + 5] : [bayX(b)];
      const balcony = spec.balconies && spec.balconies.includes(k);
      if (spec.sparse && ((b + k) % 2 === 1 || r() < 0.25)) continue;
      for (const xc0 of xs) {
        const xc = xc0 + r(-0.2, 0.2);
        const w0 = xc - winW / 2, w1 = xc + winW / 2, h0 = top + 6.5, h1 = top + 6.5 + winH;
        const arch = spec.win === 'arch';
        paintWindow(p, st, spec, { w0, w1, h0, h1, xc, arch, k, balcony, meta });
      }
      if (balcony) paintBalcony(p, st, bayX(b) - 12, bayX(b) + 12, top + 6.5 + winH + 1.2);
    }
  }
  p.flush();

  // ---------------------------------------------------------------- 6. ground floor
  paintGround(p, st, spec, x0, x1, yG, meta);
  p.flush();

  // ---------------------------------------------------------------- 7. roofline (cornice / parapet / gables / mansard)
  paintRoofline(p, st, spec, x0, x1, yB, E, roofPoly, meta);
  p.flush();

  // ---------------------------------------------------------------- 8. props: drainpipe, laundry, ivy, posters, lamps
  if (spec.pipe !== false) {
    const xp = spec.pipeRight ? x1 - 2 : x0 + 2;
    p.line(xp, yB + 1, xp, yG - 0.5, 'ink', '#3a3036', 1.6, 0.08, 6);
    p.line(xp + 0.6, yB + 1, xp + 0.6, yG - 0.5, 'wire', mixHex(st.trim, '#ffffff', 0.3), 0.6, 0.08, 6);
    for (let y = yB + 8; y < yG - 4; y += 24) p.line(xp - 1.4, y, xp + 1.4, y, 'ink', '#2a2228', 0.9, 0.05, 1);
    p.wash(p.rect(xp - 1.6, yB + 0.5, xp + 1.6, yB + 3.5, 0.1), '#3a3036', 230);
  }
  if (spec.laundry && spec.floors >= 2) {
    const k = r.int(1, Math.min(spec.floors, 3));
    const y = fy(k) + 4, xa = x0 + 6, xb = x1 - 6;
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([lerp(xa, xb, t), y + 3.5 * Math.sin(t * Math.PI)]); }
    p.stroke(pts, 'wire', '#2a2228', 0.9, 0.5);
    let x = xa + 4;
    while (x < xb - 6) {
      const t = (x - xa) / (xb - xa), yy = y + 3.5 * Math.sin(t * Math.PI);
      const wdt = r(2.2, 3.8), ht = r(3, 5.5), col = r.pick(['#f3e6c8', '#e8a0a0', '#8fd0c4', '#fff4e0', '#c85a5a', '#6a8ac8']);
      p.wash([[x, yy], [x + wdt, yy + 0.2], [x + wdt + r(-0.5, 0.5), yy + ht], [x + r(-0.5, 0.5), yy + ht * r(0.85, 1)]], col, 245);
      p.line(x, yy + ht, x + wdt, yy + ht, 'wire', mixHex(col, '#2a1a1a', 0.4), 0.6, 0.05, 1);
      x += wdt + r(2.5, 7);
    }
  }
  if (spec.ivy) {
    const xs = spec.ivyRight ? x1 - 4 : x0 + 4;
    const hIvy = Math.min(Hb - 10, r(45, 90));
    for (let i = 0; i < 7; i++) {
      const pts = [];
      let x = xs + r(-3, 3), y = yG;
      for (let s = 0; s < 8; s++) { pts.push([x, y]); x += r(-3, 3); y -= hIvy / 8; }
      p.stroke(pts, 'wire', '#2a4a2a', 0.8, 0.6);
    }
    for (let i = 0; i < 9; i++) {
      const y = yG - r(0, hIvy), x = xs + r(-7, 7);
      p.stroke([[x, y], [x + r(-4, 4), y + r(-6, 6)]], 'dust', r.pick(LEAF), r(1.2, 1.8), 0.5);
    }
    for (let i = 0; i < 40; i++) {
      const y = yG - Math.pow(r(), 0.7) * hIvy, x = xs + r(-8, 8) * (1 - (yG - y) / hIvy * 0.5);
      p.wash(p.blob(x, y, r(0.9, 1.8), r(0.8, 1.4), { n: 8, wobble: 0.2 }), r.pick(LEAF), 230);
    }
  }
  if (spec.posters && spec.ground === 'plain') {
    for (let i = 0; i < 3; i++) {
      const x = x0 + 28 * r.int(1, spec.bays - 1) - 4 + r(-1, 1), y = yG - r(18, 30);
      const col = r.pick(['#f3e6c8', '#e9c98a', '#f0d0b0']);
      p.wash(p.rect(x, y, x + r(5, 8), y + r(7, 10), 0.4), col, 230);
      for (let q = 0; q < 3; q++) p.line(x + 1, y + 2 + q * 2.2, x + r(3, 6), y + 2 + q * 2.2, 'wire', r.pick(['#a63a2a', '#16223a']), 0.6, 0.1, 1);
    }
  }
  p.flush();

  // ---------------------------------------------------------------- 9. unifying glaze + grain, light & shade
  const all = [[x0 - 1, yB - E], [x1 + 1, yB - E], [x1 + 1, yG], [x0 - 1, yG]];
  p.fill(all, mixHex(st.wall2, '#6a5a7a', 0.3), { opacity: 48, bleed: 0.05, texture: 0.97, border: 0.03 });
  p.flush();
  for (let i = 0; i < 12; i++) {
    const x = r(x0, x1), y = r(yB, yG);
    p.stroke([[x, y], [x + r(-10, 10), y + r(-6, 6)]], 'dust', mixHex(st.wall2, '#1b1020', 0.35), r(0.7, 1.0), 0.5);
  }
  p.fill(p.blob(x0 + W * 0.3, yB + Hb * 0.25, W * 0.45, Hb * 0.3, { wobble: 0.25 }), '#ffd9a0', { opacity: 26, bleed: 0.2, texture: 0.7, border: 0.05 });
  const sh = spec.shadeLeft ? [[x0, yB], [x0 + 9, yB], [x0 + 5, yG], [x0, yG]] : [[x1 - 9, yB], [x1, yB], [x1, yG], [x1 - 5, yG]];
  p.hatch(sh, { dist: 1.3, angle: 1.05, brushName: 'wire', color: '#241a3a', weight: 0.55, rand: 0.2 });
  // grime at the foot
  p.fill(p.rect(x0, yG - 7, x1, yG + 1), mixHex(st.wall2, '#2a1a20', 0.35), { opacity: 40, bleed: 0.1, texture: 0.8, border: 0.05 });
  p.flush();

  // ---------------------------------------------------------------- 10. contours with pressure (lost & found)
  const contour = (x, ya, yb) => {
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) pts.push([x + r(-0.25, 0.25), lerp(ya, yb, i / n), 0.4 + 0.9 * Math.abs(Math.sin(i * 1.3 + r(0, 3)))]);
    // break it into 2-3 pieces
    const cut = r.int(3, 6);
    p.stroke(pts.slice(0, cut + 1), 'ink', '#1e1420', 1.5, 0.4);
    if (r() < 0.8) p.stroke(pts.slice(cut + 1), 'ink', '#1e1420', 1.3, 0.4);
  };
  contour(x0, yB, yG);
  contour(x1, yB, yG);
  if (roofPoly) {
    const top = roofPoly.outline;
    p.stroke(top.map((q, i) => [q[0], q[1], 0.5 + 0.7 * Math.abs(Math.sin(i * 0.9))]), 'ink', '#1e1420', 1.3, 0.3);
  }
  p.line(x0, yG - 0.4, x1, yG - 0.4, 'charcoal', '#2a1a20', 0.5, 0.1, 5);
  p.flush();
  meta.size = { W, Hb, E, tw, th };
  return meta;
}

// ------------------------------------------------------------------------------------------------
function rooflinePoly(spec, x0, x1, yB, E, r) {
  const W = x1 - x0;
  if (spec.roof === 'gable') {
    const h = E - 6, xc = (x0 + x1) / 2;
    const wall = [[x0, yB + 0.5], [x0 + 3, yB], [xc, yB - h], [x1 - 3, yB], [x1, yB + 0.5]];
    return { wall, outline: [[x0 - 1, yB + 1], [xc, yB - h - 2], [x1 + 1, yB + 1]] };
  }
  if (spec.roof === 'dutch') {
    const xc = (x0 + x1) / 2, h = E - 4, ww = Math.min(W * 0.5, 44);
    const out = [[x0, yB], [x0 + W * 0.18, yB], [x0 + W * 0.18, yB - h * 0.3]];
    // S-curves up to the top step
    for (let i = 0; i <= 6; i++) { const t = i / 6; out.push([lerp(x0 + W * 0.18, xc - ww * 0.3, t), yB - h * 0.3 - (h * 0.45) * (0.5 - 0.5 * Math.cos(t * Math.PI))]); }
    out.push([xc - ww * 0.3, yB - h * 0.85], [xc - ww * 0.18, yB - h], [xc + ww * 0.18, yB - h], [xc + ww * 0.3, yB - h * 0.85]);
    for (let i = 0; i <= 6; i++) { const t = i / 6; out.push([lerp(xc + ww * 0.3, x1 - W * 0.18, t), yB - h * 0.75 + (h * 0.45) * (0.5 - 0.5 * Math.cos(t * Math.PI))]); }
    out.push([x1 - W * 0.18, yB - h * 0.3], [x1 - W * 0.18, yB], [x1, yB]);
    return { wall: out.concat([[x1, yB + 0.5], [x0, yB + 0.5]]), outline: out };
  }
  if (spec.roof === 'parapet') {
    const wall = [[x0, yB + 0.5], [x0, yB - 6], [x1, yB - 6], [x1, yB + 0.5]];
    return { wall, outline: [[x0, yB - 6], [x1, yB - 6]] };
  }
  if (spec.roof === 'mansard') {
    // mansard: slate slope; wall part is just the cornice band
    const wall = [[x0, yB + 0.5], [x0, yB - 3], [x1, yB - 3], [x1, yB + 0.5]];
    return { wall, outline: [[x0 - 1, yB - 3], [x0 + 5, yB - E + 2], [x1 - 5, yB - E + 2], [x1 + 1, yB - 3]] };
  }
  const wall = [[x0, yB + 0.5], [x0, yB - 2], [x1, yB - 2], [x1, yB + 0.5]];
  return { wall, outline: [[x0 - 1.5, yB - 8.5], [x1 + 1.5, yB - 8.5]] };
}

function paintRoofline(p, st, spec, x0, x1, yB, E, roofPoly, meta) {
  const r = p.r, W = x1 - x0;
  // cornice molding (all types): projecting band with dentils + shadow
  const cor = (y, ext = 1.5) => {
    p.wash(p.rect(x0 - ext, y - 7.5, x1 + ext, y - 4.4, 0.08), st.trim, 250);
    p.wash(p.rect(x0 - ext * 0.6, y - 4.4, x1 + ext * 0.6, y - 2.4, 0.08), mixHex(st.trim, st.wall2, 0.25), 250);
    for (let x = x0; x < x1 - 1; x += 3.2) p.wash(p.rect(x, y - 2.4, x + 1.7, y - 0.8, 0.05), st.trim, 250);
    p.hatch(p.rect(x0, y - 0.8, x1, y + 2.8), { dist: 0.85, angle: 0.95, brushName: 'wire', color: '#1e1430', weight: 0.5, rand: 0.2 });
  };
  if (spec.roof === 'cornice') {
    cor(yB + 0.5);
  } else if (spec.roof === 'parapet') {
    cor(yB + 0.5);
    // balustrade: posts + top rail
    const yt = yB - 6 - 8;
    p.wash(p.rect(x0 - 1, yt, x1 + 1, yt + 2.2, 0.1), st.trim, 250);
    p.wash(p.rect(x0 - 0.5, yB - 7.5, x1 + 0.5, yB - 6.2, 0.1), st.trim, 250);
    for (let x = x0 + 2; x < x1 - 1; x += 3.4) {
      p.wash([[x, yt + 2.2], [x + 1.6, yt + 2.2], [x + 2, yt + 4.2], [x + 1.4, yB - 7.5], [x + 0.2, yB - 7.5], [x - 0.4, yt + 4.2]], mixHex(st.trim, st.wall2, 0.1), 245);
    }
    for (let x = x0 + 2; x < x1 - 1; x += 3.4) p.line(x + 1.9, yt + 2.4, x + 1.5, yB - 7.6, 'wire', mixHex(st.wall2, '#1b1020', 0.4), 0.6, 0.05, 1);
    // urns on the corners
    for (const x of [x0 + 1, x1 - 5]) p.wash(p.blob(x + 2, yt - 2, 2, 2.6, { n: 12, wobble: 0.1 }), st.trim, 250);
  } else if (spec.roof === 'gable') {
    const xc = (x0 + x1) / 2, h = E - 6;
    cor(yB + 0.5, 0.8);
    // raking coping along the gable edges
    p.stroke([[x0 - 1, yB - 1], [xc, yB - h - 1.6], [x1 + 1, yB - 1]], 'gouache', st.trim, 0.35, 0.1);
    // oculus window
    const oy = yB - h * 0.45, orr = Math.min(6, h * 0.22);
    p.wash(p.blob(xc, oy, orr + 1.2, orr + 1.2, { n: 24, wobble: 0.02 }), st.trim, 255);
    p.wash(p.blob(xc, oy, orr, orr, { n: 24, wobble: 0.02 }), st.glass, 255);
    p.line(xc, oy - orr, xc, oy + orr, 'wire', st.trim, 0.8, 0.05, 1);
    p.line(xc - orr, oy, xc + orr, oy, 'wire', st.trim, 0.8, 0.05, 1);
    meta.windows.push({ x0: xc - orr * 0.8, y0: oy - orr * 0.8, x1: xc + orr * 0.8, y1: oy + orr * 0.8, round: true, kind: 'oculus' });
    // finial
    p.wash(p.blob(xc, yB - h - 3, 1.4, 2.4, { n: 10, wobble: 0.1 }), st.trim, 255);
  } else if (spec.roof === 'dutch') {
    // coping following the stepped outline
    p.stroke(roofPoly.outline, 'gouache', st.trim, 0.3, 0.2);
    const xc = (x0 + x1) / 2, h = E - 4;
    const wy = yB - h * 0.55;
    p.wash(p.arch(xc - 4.2, wy - 7, xc + 4.2, wy + 7), st.trim, 255);
    p.wash(p.arch(xc - 3.2, wy - 6, xc + 3.2, wy + 6), st.glass, 255);
    meta.windows.push({ x0: xc - 3, y0: wy - 5.5, x1: xc + 3, y1: wy + 6, arch: true, kind: 'gable' });
    cor(yB + 0.5, 0.6);
  } else if (spec.roof === 'mansard') {
    cor(yB + 0.5);
    // slate slope
    const ys = yB - 3, yt = yB - E + 2;
    const slope = [[x0 - 1, ys], [x0 + 5, yt], [x1 - 5, yt], [x1 + 1, ys]];
    p.wash(slope, '#48547a', 255);
    p.fill(slope, '#3a4566', { opacity: 90, bleed: 0.03, texture: 0.8, border: 0.4 });
    for (let y = yt + 2; y < ys; y += 2.6) p.line(x0 + 1 + (ys - y) * 0.2, y, x1 - 1 - (ys - y) * 0.2, y, 'wire', '#2a3350', 0.7, 0.12, 4);
    p.stroke([[x0 + 5, yt], [x1 - 5, yt]], 'gouache', '#6a7aa0', 0.25, 0.1);
    // dormers
    const n = Math.max(1, Math.floor((x1 - x0) / 36));
    for (let i = 0; i < n; i++) {
      const xc = lerp(x0, x1, (i + 0.5) / n), dw = 7;
      const dy0 = yt + 5, dy1 = ys - 1;
      p.wash([[xc - dw, dy1], [xc - dw, dy0 + 3], [xc, dy0 - 4], [xc + dw, dy0 + 3], [xc + dw, dy1]], st.trim, 255);
      p.wash(p.rect(xc - dw + 2, dy0 + 3, xc + dw - 2, dy1 - 1.5, 0.1), st.glass, 255);
      p.line(xc, dy0 + 3, xc, dy1 - 1.5, 'wire', st.trim, 0.7, 0.05, 1);
      meta.windows.push({ x0: xc - dw + 2, y0: dy0 + 3, x1: xc + dw - 2, y1: dy1 - 1.5, kind: 'dormer' });
      p.stroke([[xc - dw - 1, dy0 + 3.5], [xc, dy0 - 4.6], [xc + dw + 1, dy0 + 3.5]], 'ink', '#1e1420', 1.1, 0.2);
    }
    // chimney stacks
    for (const xc of [x0 + 8, x1 - 12]) {
      p.wash(p.rect(xc, yt - 9, xc + 5, yt + 1, 0.1), '#8a3a2a', 255);
      p.wash(p.rect(xc - 0.8, yt - 10.5, xc + 5.8, yt - 8.8, 0.05), '#c9a07a', 255);
      p.line(xc, yt - 9, xc, yt + 1, 'ink', '#1e1420', 0.9, 0.05, 2);
    }
  }
  // pigeons on the cornice
  if (r() < 0.6) {
    const y = yB - (spec.roof === 'parapet' ? 22.5 : spec.roof === 'cornice' ? 8.2 : 7.8);
    for (let i = 0; i < r.int(1, 3); i++) {
      const x = r(x0 + 8, x1 - 8);
      p.wash(p.blob(x, y - 1.2, 1.6, 1.1, { n: 10, wobble: 0.1 }), '#4a4a5a', 255);
      p.wash(p.blob(x + 1.3, y - 2.3, 0.7, 0.7, { n: 8, wobble: 0.05 }), '#4a4a5a', 255);
    }
  }
}

function paintWindow(p, st, spec, o) {
  const r = p.r;
  const { w0, w1, h0, h1, xc, arch, k, meta } = o;
  const shape = (a, b, c2, d) => (arch ? p.arch(a, b, c2, d) : p.rect(a, b, c2, d, 0.12));
  // recess shadow + frame + glass
  p.wash(shape(w0 - 1.8, h0 - 1.6, w1 + 1.8, h1 + 0.6), mixHex(st.wall2, '#1b1020', 0.35), 210);
  p.wash(shape(w0 - 1.1, h0 - 1.1, w1 + 1.1, h1 + 0.4), st.frame, 255);
  p.wash(shape(w0, h0, w1, h1), st.glass, 255);
  p.mass(shape(w0 + 1, h0 + 1, w1 - 1, h1 - 1), 'city_mass_s', mixHex(st.glass, '#5a9aa6', 0.3), { precision: 0.95, strength: 0.4, gradient: 0.3 });
  // glass: vertical grainy strokes of sky reflection, darker depth at the bottom
  for (let i = 0; i < 2; i++) {
    const x = r(w0 + 1.5, w1 - 1.5);
    p.stroke([[x, h0 + (arch ? 3 : 0.8)], [x + r(-0.3, 0.3), h1 - r(1, 6)]], 'pastel', mixHex(st.glass, '#9ccbd0', r(0.25, 0.45)), r(0.5, 0.8), 0.5);
  }
  p.wash(p.rect(w0 + 0.3, h1 - 4, w1 - 0.3, h1 - 0.2, 0.1), mixHex(st.glass, '#000000', 0.35), 120);
  // frame texture: a lighter crayon pass along the top/left
  p.stroke(arch ? p.arch(w0 - 0.5, h0 - 0.5, w1 + 0.5, h1, 10).slice(2) : [[w0 - 0.5, h1], [w0 - 0.5, h0 - 0.5], [w1 + 0.5, h0 - 0.5]], 'crayon', mixHex(st.frame, '#ffffff', 0.35), 0.25, 0.4);
  // curtains
  const cur = r() < 0.65;
  let ccol = null;
  if (cur) {
    ccol = r.pick(CURTAINS);
    const yt = h0 + (arch ? 3.5 : 0.6);
    const tie = h0 + (h1 - h0) * r(0.55, 0.75);
    p.wash([[w0 + 0.4, yt], [w0 + r(3, 4.2), yt], [w0 + 1.3, tie], [w0 + 1.8, h1 - 0.3], [w0 + 0.4, h1 - 0.3]], ccol, 235);
    p.wash([[w1 - 0.4, yt], [w1 - r(3, 4.2), yt], [w1 - 1.3, tie], [w1 - 1.8, h1 - 0.3], [w1 - 0.4, h1 - 0.3]], ccol, 235);
    if (r() < 0.4) p.wash(p.rect(w0 + 0.4, yt, w1 - 0.4, yt + 2.2, 0.05), mixHex(ccol, '#ffffff', 0.2), 235);
    p.stroke([[w0 + 0.9, yt + 0.5], [w0 + 1.5, tie], [w0 + 1.3, h1 - 0.6]], 'crayon', mixHex(ccol, '#3a1a2a', 0.35), 0.35, 0.5);
    p.stroke([[w1 - 0.9, yt + 0.5], [w1 - 1.5, tie], [w1 - 1.3, h1 - 0.6]], 'crayon', mixHex(ccol, '#3a1a2a', 0.35), 0.35, 0.5);
  }
  meta.windows.push({ x0: w0, y0: h0, x1: w1, y1: h1, arch, kind: 'win', floor: k, curtain: ccol });
  // glazing bars
  p.line(xc, h0 + (arch ? 2 : 0), xc, h1, 'wire', st.frame, 0.9, 0.04, 1);
  p.line(w0, h0 + 7.8, w1, h0 + 7.8, 'wire', st.frame, 0.9, 0.04, 1);
  // glint
  if (r() < 0.55) {
    const a = w0 + r(0.8, 3);
    p.stroke([[a, h1 - 1.2], [a + 4.5, h0 + 1.8]], 'dry', '#dff4ee', 0.3, 0.3);
  }
  // shutters
  if (st.shutters && !arch) {
    for (const [a, b] of [[w0 - 5.8, w0 - 1.4], [w1 + 1.4, w1 + 5.8]]) {
      p.wash(p.rect(a, h0 - 0.8, b, h1 + 0.3, 0.1), st.shutters, 245);
      p.mass(p.rect(a + 0.8, h0, b - 0.8, h1 - 0.6), 'city_mass_s', mixHex(st.shutters, '#0a2020', 0.3), { precision: 0.95, strength: 0.3 });
      for (let y = h0 + 1; y < h1; y += 1.6) p.line(a + 0.4, y, b - 0.4, y, 'wire', mixHex(st.shutters, '#0a1a1a', 0.45), 0.5, 0.02, 1);
    }
  }
  // sill + lintel / pediment / keystone
  p.wash(p.rect(w0 - 2.4, h1 + 0.4, w1 + 2.4, h1 + 2.1, 0.08), st.trim, 250);
  p.line(w0 - 2.4, h1 + 2.2, w1 + 2.4, h1 + 2.2, 'ink', '#24161a', 0.8, 0.06, 2);
  if (arch) {
    p.wash([[xc - 1.5, h0 - 2.8], [xc + 1.5, h0 - 2.8], [xc + 1, h0 + 0.2], [xc - 1, h0 + 0.2]], st.trim, 255);
  } else if (spec.pediment && k % 2 === 1) {
    p.wash([[w0 - 2.6, h0 - 1.6], [xc, h0 - 6.2], [w1 + 2.6, h0 - 1.6]], st.trim, 250);
    p.stroke([[w0 - 2.8, h0 - 1.4], [xc, h0 - 6.4], [w1 + 2.8, h0 - 1.4]], 'ink', '#24161a', 0.8, 0.1);
  } else {
    p.wash(p.rect(w0 - 1.8, h0 - 3.2, w1 + 1.8, h0 - 1.2, 0.08), st.trim, 240);
  }
  // rain streaks under the sill
  if (r() < 0.5) p.line(xc + r(-4, 4), h1 + 2.4, xc + r(-4, 4), h1 + r(5, 9), 'dry', mixHex(st.wall2, '#2a1a1a', 0.2), 0.35, 0.2, 2);
  // flower box
  if (!o.balcony && k <= 3 && r() < (spec.flowers ?? 0.35)) {
    const bx0 = w0 - 1.6, bx1 = w1 + 1.6, by = h1 + 2.1;
    p.wash(p.rect(bx0, by, bx1, by + 3.2, 0.1), r.pick(['#6a3a22', '#2f5a3a', '#a63a2a']), 250);
    for (let i = 0; i < 10; i++) p.wash(p.blob(r(bx0 + 0.5, bx1 - 0.5), by - r(0, 1.6), r(0.8, 1.4), r(0.7, 1.1), { n: 8, wobble: 0.2 }), r.pick(LEAF), 240);
    for (let i = 0; i < 9; i++) p.wash(p.blob(r(bx0 + 0.5, bx1 - 0.5), by - r(0.5, 2.6), r(0.5, 0.95), r(0.5, 0.9), { n: 8, wobble: 0.15 }), r.pick(FLOWERS), 250);
    for (let i = 0; i < 2; i++) { const x = r(bx0, bx1); p.stroke([[x, by + 1], [x + r(-1, 1), by + r(4, 7)]], 'wire', '#3f7d5a', 0.7, 0.6); }
  }
  // lost-and-found ink on the frame
  if (r() < 0.8) p.line(w0 - 1.2, h0 - 0.8, w0 - 1.2, h1 + 0.4, 'ink', '#24161a', 0.75, 0.08, 2);
  if (r() < 0.5) p.line(w1 + 1.2, h0 + r(2, 8), w1 + 1.2, h1 + 0.4, 'ink', '#24161a', 0.6, 0.08, 2);
}

function paintBalcony(p, st, a, b, y) {
  // slab with a shadow underneath, wrought-iron railing with scrolls
  p.wash(p.rect(a - 0.6, y - 0.8, b + 0.6, y + 1.8, 0.08), st.trim, 252);
  p.stroke([[a - 0.6, y + 1.8], [b + 0.6, y + 1.8]], 'ink', '#24161a', 0.9, 0.3);
  p.hatch(p.rect(a, y + 1.8, b, y + 4.4), { dist: 0.8, angle: 0.95, brushName: 'wire', color: '#1e1430', weight: 0.55, rand: 0.2 });
  const top = y - 8;
  const iron = '#1a1418';
  p.line(a, top, b, top, 'ink', iron, 1.3, 0.06, 3);
  p.line(a, top + 1.3, b, top + 1.3, 'wire', iron, 0.8, 0.06, 3);
  p.line(a, y - 1.2, b, y - 1.2, 'wire', iron, 0.8, 0.06, 3);
  for (let x = a + 0.4; x <= b; x += 2.1) p.line(x, top, x, y - 0.8, 'ink', iron, 0.55, 0.03, 1);
  // scroll motifs
  for (const xc of [a + (b - a) * 0.28, a + (b - a) * 0.72]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = (i / 14) * Math.PI * 2.2; const rr = 2.4 * (1 - i / 18); pts.push([xc + Math.cos(t) * rr, top + 4 + Math.sin(t) * rr * 0.8]); }
    p.stroke(pts, 'ink', iron, 0.7, 0.5);
  }
  // a pot of red geraniums
  if (p.r() < 0.6) {
    const x = p.r(a + 2, b - 4);
    p.wash(p.rect(x, y - 3.6, x + 3, y - 0.8, 0.1), '#a8502e', 255);
    for (let i = 0; i < 6; i++) p.wash(p.blob(x + p.r(0, 3), y - 3.8 - p.r(0, 2.2), p.r(0.5, 1), p.r(0.5, 0.9), { n: 8 }), p.r() < 0.5 ? '#e8423a' : '#3f7d5a', 250);
  }
}

function paintGround(p, st, spec, x0, x1, yG, meta) {
  const r = p.r;
  const g0 = yG - GROUND_H;
  const bayX = (b) => x0 + b * 28 + 14;
  if (spec.ground === 'shop' || spec.ground === 'cafe') {
    // shop fronts: fascia sign across the building, glazed bays, doors
    const signCol = r.pick(SIGN);
    p.wash(p.rect(x0 + 1, g0 + 2.2, x1 - 1, g0 + 9.5, 0.12), signCol, 255);
    for (let q = 0; q < 4; q++) p.line(x0 + 2, g0 + 3.4 + q * 1.7, x1 - 2, g0 + 3.4 + q * 1.7, 'crayon', mixHex(signCol, '#000000', 0.25), 0.35, 0.1, 4);
    p.line(x0 + 1, g0 + 2.2, x1 - 1, g0 + 2.2, 'wire', '#f2b544', 0.8, 0.05, 3);
    p.line(x0 + 1, g0 + 9.5, x1 - 1, g0 + 9.5, 'wire', '#f2b544', 0.8, 0.05, 3);
    // "lettering": scribbled glyph strokes
    let x = x0 + 6 + r(0, 6);
    const xe = x1 - 6;
    const lc = r.pick(['#f3e6c8', '#f2b544', '#fff4e0']);
    while (x < xe) {
      const n = r.int(3, 6);
      for (let i = 0; i < n && x < xe; i++) {
        const kind = r.int(0, 3), yy = g0 + 3.9, hh = 3.8;
        if (kind === 0) p.line(x, yy, x, yy + hh, 'ink', lc, 0.7, 0.05, 1);
        else if (kind === 1) p.stroke([[x, yy + hh], [x + 0.9, yy], [x + 1.8, yy + hh]], 'ink', lc, 0.65, 0.3);
        else if (kind === 2) p.stroke([[x + 1.6, yy + 0.4], [x, yy + 1.2], [x + 0.2, yy + hh - 0.6], [x + 1.7, yy + hh]], 'ink', lc, 0.65, 0.5);
        else p.stroke([[x, yy + hh], [x, yy], [x + 1.5, yy + 1.2], [x, yy + 2]], 'ink', lc, 0.65, 0.5);
        x += r(2.2, 2.9);
      }
      x += r(3.5, 6);
    }
    for (let b = 0; b < spec.bays; b++) {
      const xc = bayX(b), a = xc - 11.5, c2 = xc + 11.5, top = g0 + 12, bot = yG - 1.5;
      // pilasters
      p.wash(p.rect(xc - 14, g0 + 9.5, xc - 12, yG, 0.1), st.trim, 250);
      const door = spec.bays > 2 && b % 3 === 1;
      if (door) {
        p.wash(p.rect(xc - 5, top, xc + 5, yG, 0.1), mixHex(st.frame, '#2a1a10', 0.4), 255);
        p.wash(p.rect(xc - 3.8, top + 1.4, xc + 3.8, top + 13, 0.1), st.glass, 255);
        p.line(xc + 3, top + 16, xc + 3, top + 18, 'ink', '#f2b544', 1.2, 0.02, 1);
        meta.windows.push({ x0: xc - 3.8, y0: top + 1.4, x1: xc + 3.8, y1: top + 13, kind: 'door' });
        // side windows
        for (const [u0, u1] of [[a, xc - 6.5], [xc + 6.5, c2]]) {
          p.wash(p.rect(u0, top + 1, u1, bot - 5, 0.1), st.glass, 255);
          meta.windows.push({ x0: u0, y0: top + 1, x1: u1, y1: bot - 5, kind: 'shop' });
        }
      } else {
        p.wash(p.rect(a - 0.8, top - 0.8, c2 + 0.8, bot + 0.3, 0.1), st.frame, 255);
        p.wash(p.rect(a, top, c2, bot - 5, 0.1), st.glass, 255);
        meta.windows.push({ x0: a, y0: top, x1: c2, y1: bot - 5, kind: 'shop' });
        // stall-riser
        p.wash(p.rect(a, bot - 5, c2, bot, 0.1), mixHex(st.frame, st.wall2, 0.4), 255);
        // displayed goods: shelves of coloured dabs
        for (const sy of [top + 7, top + 14]) {
          p.line(a + 1, sy, c2 - 1, sy, 'wire', '#5a3a22', 0.7, 0.03, 1);
          for (let i = 0; i < 7; i++) p.wash(p.blob(r(a + 1.5, c2 - 1.5), sy - r(0.8, 1.8), r(0.6, 1.2), r(0.7, 1.4), { n: 8, wobble: 0.15 }), r.pick(['#e8622c', '#f2b544', '#d8452f', '#7fd8cf', '#f3e6c8', '#6aa36b', '#a33f6f']), 245);
        }
        p.line(xc, top, xc, bot - 5, 'wire', st.frame, 0.8, 0.03, 1);
        // glass glint
        p.wash([[a + 2, bot - 6], [a + 4, bot - 6], [a + 10, top + 1], [a + 8, top + 1]], '#dff4ee', 60);
      }
    }
    // awnings (striped, scalloped), on alternate bays or across the cafe
    const awn = st.awn || ['#d8452f', '#f3e6c8'];
    const drawAwning = (a, c2, ya) => {
      const yb = ya + 8, n = Math.max(4, Math.round((c2 - a) / 3.4));
      for (let i = 0; i < n; i++) {
        const u0 = lerp(a, c2, i / n), u1 = lerp(a, c2, (i + 1) / n);
        p.wash([[u0 + 0.5, ya], [u1 + 0.5, ya], [u1 + 1.2, yb], [(u0 + u1) / 2 + 0.85, yb + 1.8], [u0 + 1.2, yb]], awn[i % 2], 252);
      }
      p.hatch([[a + 1.2, yb - 3], [c2 + 1.2, yb - 3], [c2 + 1.2, yb + 1.5], [a + 1.2, yb + 1.5]], { dist: 0.9, angle: 1.1, brushName: 'wire', color: '#2a1420', weight: 0.45, rand: 0.2 });
      p.line(a, ya, c2 + 0.8, ya, 'ink', '#2a1616', 0.9, 0.05, 2);
      p.line(a + 1.2, yb, c2 + 1.2, yb, 'wire', '#2a1616', 0.6, 0.05, 2);
      p.fill([[a + 0.5, yb + 2], [c2 + 1.2, yb + 2], [c2 + 3, yb + 7], [a + 2, yb + 7]], '#1e1430', { opacity: 45, bleed: 0.1, texture: 0.6, border: 0.05 });
    };
    if (spec.ground === 'cafe') drawAwning(x0 + 1, x1 - 2, g0 + 10);
    else for (let b = 0; b < spec.bays; b++) if ((b + (spec.seed | 0)) % 2 === 0) drawAwning(bayX(b) - 12.5, bayX(b) + 12, g0 + 10.2);
    // wall lamp by the door
    const lx = x0 + 3.5;
    p.line(lx, g0 + 16, lx + 3, g0 + 16, 'ink', '#1a1418', 0.8, 0.02, 1);
    p.wash([[lx + 2, g0 + 16.5], [lx + 4.4, g0 + 16.5], [lx + 4.8, g0 + 21], [lx + 1.6, g0 + 21]], '#2a2226', 255);
    p.wash(p.rect(lx + 2.4, g0 + 17.4, lx + 4, g0 + 20.2, 0.02), '#ffd98c', 255);
    meta.lamps.push({ x: lx + 3.2, y: g0 + 18.8 });
  } else if (spec.ground === 'arcade') {
    for (let b = 0; b < spec.bays; b++) {
      const xc = bayX(b), a = xc - 10.5, c2 = xc + 10.5, y0 = g0 + 6;
      p.wash(p.arch(a - 1.6, y0 - 1.6, c2 + 1.6, yG, 16), st.trim, 252);
      p.wash(p.arch(a, y0, c2, yG + 1, 16), '#1d1826', 255);
      // warm interior glimpsed: shop window at the back of the arcade
      p.wash(p.rect(a + 3, y0 + 12, c2 - 3, yG - 3, 0.1), mixHex('#1d1826', '#6a4a3a', 0.35), 255);
      meta.windows.push({ x0: a + 3, y0: y0 + 12, x1: c2 - 3, y1: yG - 3, kind: 'shop' });
      p.wash([[xc - 1.7, y0 - 1.9], [xc + 1.7, y0 - 1.9], [xc + 1.2, y0 + 1.6], [xc - 1.2, y0 + 1.6]], st.trim, 255);
      p.stroke(p.arch(a - 1.6, y0 - 1.6, c2 + 1.6, yG, 16).slice(2).map((q) => [q[0], q[1]]), 'ink', '#1e1420', 0.9, 0.4);
      // column shading
      p.hatch(p.rect(c2 + 1.6, y0, c2 + 5.4, yG), { dist: 1.1, angle: 1.2, brushName: 'wire', color: '#241a3a', weight: 0.45, rand: 0.2 });
    }
    // hanging lanterns in some arches
    for (let b = 0; b < spec.bays; b += 2) {
      const xc = bayX(b);
      p.line(xc, g0 + 6, xc, g0 + 12, 'wire', '#1a1418', 0.6, 0.02, 1);
      p.wash(p.rect(xc - 1.6, g0 + 12, xc + 1.6, g0 + 16, 0.05), '#ffd98c', 255);
      meta.lamps.push({ x: xc, y: g0 + 14 });
    }
  } else {
    // plain: doors with steps, windows with flower boxes, a bench
    for (let b = 0; b < spec.bays; b++) {
      const xc = bayX(b);
      if (b % 3 === 1 || spec.bays === 2 && b === 0) {
        p.wash(p.arch(xc - 6.2, g0 + 8, xc + 6.2, yG, 14), st.trim, 250);
        p.wash(p.arch(xc - 4.8, g0 + 9.4, xc + 4.8, yG + 1, 14), r.pick(['#5a2e1c', '#2f4a3a', '#3a2a4a']), 255);
        for (let q = 0; q < 2; q++) p.wash(p.rect(xc - 4, g0 + 17 + q * 9, xc + 4, g0 + 23 + q * 9, 0.1), '#00000033', 60);
        p.line(xc, g0 + 16, xc, yG, 'wire', '#1e1210', 0.7, 0.03, 1);
        p.wash(p.blob(xc + 2.6, g0 + 26, 0.6, 0.6, { n: 8 }), '#f2b544', 255);
        p.wash(p.rect(xc - 7.5, yG - 1.5, xc + 7.5, yG, 0.05), '#c9b99a', 255);
        meta.windows.push({ x0: xc - 3.6, y0: g0 + 10.4, x1: xc + 3.6, y1: g0 + 15, arch: true, kind: 'fan' });
        // lamp beside the door
        p.wash(p.rect(xc + 7.5, g0 + 12, xc + 9.8, g0 + 16, 0.05), '#ffd98c', 255);
        p.line(xc + 7.3, g0 + 11.5, xc + 10, g0 + 11.5, 'ink', '#1a1418', 0.8, 0.02, 1);
        meta.lamps.push({ x: xc + 8.6, y: g0 + 14 });
      } else {
        const a = xc - 6, c2 = xc + 6, t = g0 + 11, bt = g0 + 29;
        paintWindow(p, st, { ...spec, flowers: 0.8 }, { w0: a, w1: c2, h0: t, h1: bt, xc, arch: false, k: 0, meta });
      }
    }
  }
  // doorstep grime + street-level wash
  p.fill(p.rect(x0, yG - 3, x1, yG + 0.5), mixHex(st.wall2, '#2a1a20', 0.45), { opacity: 55, bleed: 0.06, texture: 0.8, border: 0.05 });
}
