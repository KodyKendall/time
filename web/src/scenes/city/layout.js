// CITY — deterministic world layout.
// World units: at lt = 0 the camera looks straight down and 1 world unit on the ground = 1 design
// unit on screen, with world (x, y) = pivot-screen (x, y). z is up. Floors are 30 units (~3 m).
// Most of the city is laid out in BAND coordinates (s along the crop bands, o across them), so
// the pivot's field bands become the city's streets and blocks.
import { rng, hash32, lerp, clamp } from '../../engine/math.js';
import { FRONTS } from './catalog.js';

const ANG = -0.35;
// yaw = camera heading that looks along +s (heading vector (sin yaw, -cos yaw) = band direction)
export const BAND = { ox: 960, oy: 540, ax: Math.cos(ANG), ay: Math.sin(ANG), nx: -Math.sin(ANG), ny: Math.cos(ANG), yaw: Math.atan2(Math.cos(ANG), -Math.sin(ANG)) };
export const bw = (s, o, z = 0) => [BAND.ox + s * BAND.ax + o * BAND.nx, BAND.oy + s * BAND.ay + o * BAND.ny, z];
export const wb = (x, y) => {
  const dx = x - BAND.ox, dy = y - BAND.oy;
  return [dx * BAND.ax + dy * BAND.ay, dx * BAND.nx + dy * BAND.ny];
};

// ---- the pivot's bands, replicated exactly (they are the first draws of the pivot layer's rng)
export const BAND_COLS = ['#6aa36b', '#e9c98a', '#3f7d5a', '#c98f3a', '#8a5a3a', '#7a8a3a', '#f2b544', '#5d7a3e', '#a8bf96'];
export const BANDS = (() => {
  const r = rng((hash32('pivot-fields/fields') ^ 0x9e3779b9) >>> 0);
  const out = [];
  let off = -1500;
  let i = 0;
  while (off < 1500) {
    const w = r(150, 320);
    out.push({ off, w, i, col: BAND_COLS[i % 9] });
    off += w;
    i++;
  }
  // extend beyond the pivot's range (only seen from far away)
  const r2 = rng('city-bands-ext');
  let hi = off, k = i;
  while (hi < 6000) { const w = r2(150, 320); out.push({ off: hi, w, i: k, col: BAND_COLS[((k % 9) + 9) % 9], ext: true }); hi += w; k++; }
  let lo = -1500; k = -1;
  while (lo > -6000) { const w = r2(150, 320); lo -= w; out.unshift({ off: lo, w, i: k, col: BAND_COLS[((k % 9) + 9) % 9], ext: true }); k--; }
  return out;
})();
// The pivot's band edges wobble: o = off + 10 sin(k*0.9 + off) at s = -1600 + 200k (piecewise linear).
export function edgeO(off, s) {
  const kf = (s + 1600) / 200, k0 = Math.floor(kf), u = kf - k0;
  return off + 10 * lerp(Math.sin(k0 * 0.9 + off), Math.sin((k0 + 1) * 0.9 + off), u);
}

// ---- main street = the olive band
const olive = BANDS.find((b) => !b.ext && b.col === '#7a8a3a');
export const MAIN = { o0: olive.off, o1: olive.off + olive.w, oc: olive.off + olive.w / 2, w: olive.w };
export const FLOOR = 30, GROUND = 40;

// ---- river: winds across the bands (perpendicular), crossing the frame left of centre
export const RIVER = (() => {
  const pts = [];
  for (let o = -1700; o <= 1700; o += 25) {
    const s = -395 + 95 * Math.sin(o * 0.0042 + 0.4) + 38 * Math.sin(o * 0.0115 + 1.3);
    pts.push(bw(s, o));
  }
  return { pts, w: 46, sAt: (o) => -395 + 95 * Math.sin(o * 0.0042 + 0.4) + 38 * Math.sin(o * 0.0115 + 1.3) };
})();

// ---- tower / town hall at the east end of the main street
export const TOWER = (() => {
  const s = 690, o = MAIN.oc;
  const half = 62, H = 400, dialZ = 330, dialR = 40;
  // body to H, clock panel around dialZ, belfry H..H+56, spire above
  return { s, o, half, H, dialZ, dialR, front: s - half, belfry: 56, spire: 120 };
})();
export const HALL = { s0: TOWER.s - 40, s1: TOWER.s + 150, o0: MAIN.oc - 260, o1: MAIN.oc + 260, floors: 3 };

// ---- cross streets (along o) at these s positions
export const CROSS = [-1560, -1230, -900, -620, -110, 250, 1030, 1350, 1680];

// ---- streets (paved strips), all in band coords: { kind, s0, s1, o0, o1 } or along-o strips
export const STREETS = (() => {
  const out = [];
  // main avenue
  out.push({ kind: 'main', s0: -2400, s1: HALL.s0 + 6, o0: MAIN.o0 - 16, o1: MAIN.o1 + 16 });
  // band-edge lanes
  for (const b of BANDS) {
    if (b.ext && Math.abs(b.off) > 2400) continue;
    const o = b.off;
    if (Math.abs(o - MAIN.o0) < 1 || Math.abs(o - MAIN.o1) < 1) continue;
    if (o < -1700 || o > 1800) continue;
    out.push({ kind: 'lane', s0: -2400, s1: 2400, o0: o - 22, o1: o + 22, oc: o });
  }
  // cross streets
  for (const s of CROSS) out.push({ kind: 'cross', s0: s - 20, s1: s + 20, o0: -1800, o1: 1800 });
  return out;
})();

// ---- buildings
// Each: s0,s1 (along), o0,o1 (across), face (+1: front faces +o, -1: front faces -o), floors, variant,
// roof, birth (lt appears), grow (lt start of full growth), dur, house (village cottage first).
export const VILLAGE = { s: -250, o: MAIN.oc - 30 };
function riverClear(s0, s1, o0, o1) {
  for (let o = o0; o <= o1 + 0.1; o += (o1 - o0) / 4) {
    const sr = RIVER.sAt(o);
    if (s1 > sr - RIVER.w / 2 - 40 && s0 < sr + RIVER.w / 2 + 40) return false;
  }
  return true;
}
export const BUILDINGS = (() => {
  const r = rng('city-buildings');
  const out = [];
  // rows: every band edge is a street; each band holds two back-to-back rows facing its edges
  const rows = [];
  for (const b of BANDS) {
    if (Math.abs(b.off + b.w / 2) > 1500) continue;
    if (b === olive) continue;
    const e0 = b.off, e1 = b.off + b.w;
    const mainTop = Math.abs(e0 - MAIN.o1) < 1; // the band's top edge is the main avenue
    const mainBot = Math.abs(e1 - MAIN.o0) < 1;
    const top = mainTop ? MAIN.o1 + 16 : e0 + 22; // front line near e0 (faces -o)
    const bot = mainBot ? MAIN.o0 - 16 : e1 - 22; // front line near e1 (faces +o)
    const avail = bot - top;
    if (mainTop || mainBot) {
      const d = Math.min(128, avail - 60 - 14);
      const d2 = Math.min(100, avail - d - 14);
      if (mainTop) {
        rows.push({ oFront: top, oBack: top + d, face: -1, main: true });
        rows.push({ oFront: bot, oBack: bot - d2, face: +1 });
      } else {
        rows.push({ oFront: bot, oBack: bot - d, face: +1, main: true });
        rows.push({ oFront: top, oBack: top + d2, face: -1 });
      }
    } else {
      const d = Math.min(118, (avail - 14) / 2);
      rows.push({ oFront: top, oBack: top + d, face: -1 });
      rows.push({ oFront: bot, oBack: bot - d, face: +1 });
    }
  }
  const bayW = 28;
  const mainIdx = FRONTS.map((f, i) => (f.main ? i : -1)).filter((i) => i >= 0);
  const villIdx = FRONTS.map((f, i) => (f.village ? i : -1)).filter((i) => i >= 0);
  const allIdx = FRONTS.map((f, i) => i);
  for (const row of rows) {
    const o0 = Math.min(row.oFront, row.oBack), o1 = Math.max(row.oFront, row.oBack);
    const oMid = (o0 + o1) / 2;
    // walk along s between cross streets
    const edges = [-2000, ...CROSS, 2000];
    let last = -1;
    for (let k = 0; k < edges.length - 1; k++) {
      let s = edges[k] + 24, sEnd = edges[k + 1] - 24;
      while (s < sEnd - 56) {
        const scTry = s + 60;
        const dvTry = Math.hypot((scTry - VILLAGE.s) * 0.8, oMid - VILLAGE.o);
        const pool = dvTry < 330 ? villIdx : row.main ? mainIdx : allIdx;
        let spec = r.pick(pool);
        if (spec === last) spec = r.pick(pool);
        let w = FRONTS[spec].bays * bayW;
        if (s + w > sEnd) {
          // try a narrower painting that fits
          const fit = pool.filter((i) => FRONTS[i].bays * bayW <= sEnd - s);
          if (!fit.length) break;
          spec = r.pick(fit);
          w = FRONTS[spec].bays * bayW;
        }
        const s0 = s, s1 = s + w;
        s = s1 + (r() < 0.2 ? r(4, 12) : 0.4);
        // skip the town hall site and the river
        if (s1 > HALL.s0 - 30 && o1 > HALL.o0 - 40 && o0 < HALL.o1 + 40) continue;
        if (!riverClear(s0, s1, o0, o1)) continue;
        if (s0 < -1750 || s1 > 1600 || o1 < -1300 || o0 > 1200) continue;
        last = spec;
        const sc = (s0 + s1) / 2;
        const dv = Math.hypot((sc - VILLAGE.s) * 0.8, oMid - VILLAGE.o);
        out.push({
          s0, s1, o0, o1, face: row.face, spec, floors: FRONTS[spec].floors, main: !!row.main,
          roof: r.pick([0, 0, 1, 3, 0, 2, 1]), dv, lit: r(0, 1), chimneys: r.int(0, 2), seed: r(0, 1000),
        });
      }
    }
  }
  // timing: the village (closest buildings to VILLAGE) first as cottages, then growth spreads out
  const byDist = out.slice().sort((a, b) => a.dv - b.dv);
  const beats = [1.25, 1.5625, 1.875, 1.875, 2.1875, 2.1875, 2.5, 2.5, 2.5];
  const village = [];
  for (const b of byDist) {
    if (village.length >= 9) break;
    // keep cottages spread out a little
    if (village.some((v) => Math.hypot((v.s0 + v.s1) / 2 - (b.s0 + b.s1) / 2, (v.o0 + v.o1) / 2 - (b.o0 + b.o1) / 2) < 70)) continue;
    village.push(b);
  }
  village.forEach((b, i) => {
    b.house = true;
    b.birth = beats[i];
    b.chimneys = Math.max(1, b.chimneys); // every cottage has a smoking chimney
  });
  for (const b of out) {
    const rr = rng('bt' + Math.round(b.s0 * 7 + b.o0 * 13));
    if (b.house) {
      b.grow = 2.55 + b.dv / 2600 + rr(0, 0.25);
      b.dur = rr(0.9, 1.3);
    } else {
      b.birth = 2.35 + b.dv / 1500 + rr(0, 0.3);
      b.grow = b.birth;
      b.dur = rr(0.55, 0.9);
    }
  }
  return out;
})();

// ---- street furniture along the main avenue
export const LAMPS = (() => {
  const out = [];
  for (let s = -300; s < HALL.s0 - 20; s += 110) {
    out.push({ s, o: MAIN.o0 + 12, side: -1 });
    out.push({ s: s + 55, o: MAIN.o1 - 12, side: 1 });
  }
  return out;
})();
