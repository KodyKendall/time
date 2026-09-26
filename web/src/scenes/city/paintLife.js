// CITY — painted sprites for the town's life: walkers (front and side, 4-frame cycles), birds,
// lamp posts, street trees (side card + top canopy), a horse tram, carts, boats.
import { TAU, lerp, mixHex, circlePts } from '../lib/kit.js';
import { massPoly } from './paintCity.js';

const rectP = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const closed = (p) => p.concat([p[0]]);

// ------------------------------------------------------------------------------------------------
// walkers atlas: cells 40 x 64 du (figure ~17 world units tall -> 56 du), feet at y = 62
// row r: variant; columns 0..3 front-view walk, 4..7 side-view walk
// ------------------------------------------------------------------------------------------------
export const WALK = { cw: 40, ch: 64, cols: 8, feet: 62, height: 17, variants: 7 };
const PEOPLE = [
  { coat: '#2f4a6a', legs: '#1b1a22', skin: '#e8b890', hat: 'bowler', hatc: '#1b1a22', kind: 'man' },
  { coat: '#8a2e2e', legs: '#2a1a1a', skin: '#d9a07a', hat: 'bonnet', hatc: '#f3e6c8', kind: 'woman', dress: '#6a2a3a' },
  { coat: '#5a6a3a', legs: '#2a2a2a', skin: '#e8c0a0', hat: 'cap', hatc: '#4a3a2a', kind: 'man' },
  { coat: '#e2a63c', legs: '#3a2a4a', skin: '#c89070', hat: 'none', hatc: '#2a1a14', kind: 'woman', dress: '#2f7f78' },
  { coat: '#3a2a4a', legs: '#1a1a1a', skin: '#f0c8a0', hat: 'top', hatc: '#111118', kind: 'man' },
  { coat: '#c86a4a', legs: '#2a2a3a', skin: '#e0a880', hat: 'none', hatc: '#6a3a1a', kind: 'kid' },
  { coat: '#d9b0e0', legs: '#2a1a2a', skin: '#f0c8a0', hat: 'bonnet', hatc: '#c85a5a', kind: 'woman', dress: '#7d3b6a' },
];
export function paintWalkers(P) {
  const { cw, ch, cols } = WALK;
  return P.layer('walkers', { w: cw * cols, h: ch * PEOPLE.length, scale: 3.2 }, (c) => {
    const r = c.r;
    PEOPLE.forEach((pp, row) => {
      for (let f = 0; f < 8; f++) {
        const side = f >= 4, ph = (f % 4) / 4 * TAU;
        const x0 = f * cw, y0 = row * ch;
        const cx = x0 + cw / 2, feet = y0 + 62;
        const kid = pp.kind === 'kid';
        const H = kid ? 38 : 54, s = H / 54;
        const bob = Math.abs(Math.sin(ph)) * 1.2 * s;
        const hip = feet - 24 * s - bob;
        const shoulder = feet - 42 * s - bob;
        const headY = feet - 48 * s - bob;
        const ink = '#1b1420';
        // legs
        if (pp.kind !== 'woman') {
          if (side) {
            const sw = Math.sin(ph) * 7 * s;
            for (const [k, col] of [[-1, mixHex(pp.legs, '#000000', 0.3)], [1, pp.legs]]) {
              const fx = cx + k * sw;
              c.washPoly([[cx - 2.2 * s, hip], [cx + 2.2 * s, hip], [fx + 1.8 * s, feet - 1], [fx - 1.8 * s, feet - 1]], col, 255);
              c.washPoly(rectP(fx - 2 * s, feet - 2.4, fx + 3.6 * s, feet), '#1a1210', 255);
            }
          } else {
            const lift = Math.sin(ph) * 2.6 * s;
            for (const [k, l] of [[-1, Math.max(0, lift)], [1, Math.max(0, -lift)]]) {
              const lx = cx + k * 2.6 * s;
              c.washPoly([[lx - 2.1 * s, hip], [lx + 2.1 * s, hip], [lx + 1.8 * s, feet - l - 1], [lx - 1.8 * s, feet - l - 1]], pp.legs, 255);
              c.washPoly(rectP(lx - 2.2 * s, feet - l - 2.4, lx + 2.2 * s, feet - l), '#1a1210', 255);
            }
          }
        }
        // body: coat / dress
        if (pp.kind === 'woman') {
          const sway = Math.sin(ph) * 1.4;
          const dress = [[cx - 5 * s, shoulder + 3], [cx + 5 * s, shoulder + 3], [cx + 10 * s + sway, feet - 1], [cx - 10 * s + sway, feet - 1]];
          c.washPoly(dress, pp.dress, 255);
          massPoly(c, dress, 'city_mass_s', mixHex(pp.dress, '#000000', 0.3), { precision: 0.8, strength: 0.4 });
          c.flush();
          c.washPoly(rectP(cx - 5.5 * s, shoulder, cx + 5.5 * s, shoulder + 10 * s), pp.coat, 255);
          c.washPoly(rectP(cx - 10 * s + sway, feet - 3, cx + 10 * s + sway, feet - 1), mixHex(pp.dress, '#000000', 0.35), 255);
        } else {
          const coat = [[cx - 5.5 * s, shoulder], [cx + 5.5 * s, shoulder], [cx + 6.5 * s, hip + 4 * s], [cx - 6.5 * s, hip + 4 * s]];
          c.washPoly(coat, pp.coat, 255);
          massPoly(c, coat, 'city_mass_s', mixHex(pp.coat, '#000000', 0.3), { precision: 0.8, strength: 0.4 });
          c.flush();
        }
        // arms swinging
        const aw = Math.sin(ph + Math.PI) * (side ? 5 : 1.2) * s;
        for (const k of side ? [1] : [-1, 1]) {
          const ax = cx + (side ? 0 : k * 6.2 * s);
          c.strokePath([[ax, shoulder + 1], [ax + aw * (side ? 1 : 0.4), shoulder + 14 * s]], 'ink', mixHex(pp.coat, '#000000', 0.2), 2.2 * s, 0.3);
          c.washPoly(circlePts(ax + aw * (side ? 1 : 0.4), shoulder + 15 * s, 1.5 * s, 8), pp.skin, 255);
        }
        // head + hat
        c.washPoly(circlePts(cx, headY, 3.6 * s, 14), pp.skin, 255);
        if (pp.hat === 'bowler') { c.washPoly(circlePts(cx, headY - 2.6 * s, 3.8 * s, 12).filter((q) => q[1] <= headY - 2.4 * s), pp.hatc, 255); c.washPoly(rectP(cx - 5 * s, headY - 2.8 * s, cx + 5 * s, headY - 1.8 * s), pp.hatc, 255); }
        if (pp.hat === 'top') { c.washPoly(rectP(cx - 3.2 * s, headY - 9 * s, cx + 3.2 * s, headY - 2.2 * s), pp.hatc, 255); c.washPoly(rectP(cx - 5 * s, headY - 2.8 * s, cx + 5 * s, headY - 1.8 * s), pp.hatc, 255); }
        if (pp.hat === 'cap') c.washPoly([[cx - 4 * s, headY - 1.5 * s], [cx + 5.5 * s, headY - 1.5 * s], [cx + 3 * s, headY - 4.5 * s], [cx - 3.5 * s, headY - 4.2 * s]], pp.hatc, 255);
        if (pp.hat === 'bonnet') c.washPoly(circlePts(cx, headY - 0.8 * s, 4.6 * s, 14).filter((q) => q[1] <= headY + 1 * s), pp.hatc, 255);
        if (pp.hat === 'none') c.washPoly(circlePts(cx, headY - 1.4 * s, 3.8 * s, 12).filter((q) => q[1] <= headY - 0.5 * s), pp.hatc, 255);
        // contour
        c.strokePath([[cx - 5.5 * s, shoulder], [cx - 6.5 * s, hip + 4 * s]], 'ink', ink, 0.6, 0.3);
        if (r() < 0.5) c.strokePath([[cx + 5.5 * s, shoulder], [cx + 6.5 * s, hip + 4 * s]], 'ink', ink, 0.6, 0.3);
      }
    });
  });
}

// ------------------------------------------------------------------------------------------------
// birds: 4 flap frames in a row (cells 32 x 20 du), dark silhouettes
// ------------------------------------------------------------------------------------------------
export const BIRD = { cw: 32, ch: 20, n: 4 };
export function paintBirds(P) {
  return P.layer('birds', { w: BIRD.cw * BIRD.n, h: BIRD.ch, scale: 3 }, (c) => {
    for (let f = 0; f < 4; f++) {
      const cx = f * 32 + 16, cy = 10;
      const lift = [-6, -2, 4, -2][f];
      const wing = (k) => [[cx, cy], [cx + k * 6, cy + lift * 0.6 - 1.2], [cx + k * 13, cy + lift], [cx + k * 7, cy + lift * 0.5 + 1.4], [cx, cy + 1.6]];
      c.washPoly(wing(-1), '#1b1a2a', 255);
      c.washPoly(wing(1), '#1b1a2a', 255);
      c.washPoly(circlePts(cx, cy + 0.8, 2.2, 10), '#1b1a2a', 255);
      c.washPoly([[cx + 1.4, cy], [cx + 4, cy + 0.6], [cx + 1.4, cy + 1.6]], '#1b1a2a', 255);
    }
  });
}

// ------------------------------------------------------------------------------------------------
// street furniture and vehicles (single painted cards; D design units per world unit)
// ------------------------------------------------------------------------------------------------
export const LAMP = { w: 12, h: 46, D: 5 };
export function paintLamp(P) {
  const { w, h, D } = LAMP;
  return P.layer('lamp', { w: w * D, h: h * D, scale: 2.4 }, (c) => {
    const X = (v) => v * D;
    const cx = X(w / 2), iron = '#1c1a26';
    c.washPoly(rectP(cx - X(2.4), X(h - 5), cx + X(2.4), X(h)), iron, 255);
    c.washPoly([[cx - X(1.3), X(h - 5)], [cx + X(1.3), X(h - 5)], [cx + X(0.7), X(9)], [cx - X(0.7), X(9)]], iron, 255);
    for (const y of [h - 8, h - 22, 12]) c.washPoly(rectP(cx - X(1.6), X(y), cx + X(1.6), X(y + 1)), iron, 255);
    // lantern
    c.washPoly([[cx - X(3.6), X(2.2)], [cx + X(3.6), X(2.2)], [cx + X(2.6), X(0)], [cx - X(2.6), X(0)]], iron, 255);
    c.washPoly([[cx - X(3.2), X(2.6)], [cx + X(3.2), X(2.6)], [cx + X(2.4), X(8.6)], [cx - X(2.4), X(8.6)]], '#ffd98c', 255);
    c.washPoly(circlePts(cx, X(5.2), X(1.4), 12), '#fff4d0', 255);
    c.strokePath([[cx, X(2.6)], [cx, X(8.6)]], 'wire', iron, 1.2, 0.2);
    c.washPoly(rectP(cx - X(3), X(8.6), cx + X(3), X(9.6)), iron, 255);
    c.strokePath([[cx - X(1.2), X(h - 22)], [cx - X(0.9), X(12)]], 'HB', '#6a7090', 0.8, 0.3);
  });
}
export const TREE = { w: 44, h: 64, D: 4 };
export function paintTree(P) {
  const { w, h, D } = TREE;
  const side = P.layer('treeSide', { w: w * D, h: h * D, scale: 2 }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    const cx = X(w / 2);
    c.washPoly([[cx - X(1.6), X(h)], [cx + X(1.6), X(h)], [cx + X(1.1), X(h - 26)], [cx - X(1.1), X(h - 26)]], '#4a3424', 255);
    c.strokePath([[cx, X(h - 22)], [cx - X(7), X(h - 34)]], 'ink', '#4a3424', 2.4, 0.4);
    c.strokePath([[cx, X(h - 24)], [cx + X(8), X(h - 36)]], 'ink', '#4a3424', 2.4, 0.4);
    const blobs = [];
    for (let i = 0; i < 9; i++) blobs.push([cx + X(r(-13, 13)), X(r(10, 32)), X(r(8, 13))]);
    for (const [x, y, rr] of blobs) c.washPoly(c.blob(x, y, rr, rr * 0.9, { n: 18, wobble: 0.2 }), r.pick(['#2f5a3a', '#3f6e45', '#28503a']), 255);
    c.flush();
    for (const [x, y, rr] of blobs) massPoly(c, c.blob(x - rr * 0.2, y - rr * 0.2, rr * 0.7, rr * 0.6), 'city_mass_s', r.pick(['#6aa36b', '#5d8a4e', '#8ab86a']), { precision: 0.6, strength: 0.5 });
    c.flush();
    for (let i = 0; i < 40; i++) {
      const [x, y, rr] = r.pick(blobs);
      const a = r(0, TAU), d = r(0, rr);
      c.washPoly(c.blob(x + Math.cos(a) * d, y + Math.sin(a) * d, X(r(0.8, 1.6)), X(r(0.6, 1.2)), { n: 8 }), r.pick(['#1f4030', '#8ab86a', '#a8c880', '#2a5040']), 230);
    }
  });
  const top = P.layer('treeTop', { w: w * D, h: w * D, scale: 1.2 }, (c) => {
    const r = c.r;
    const cx = (w * D) / 2;
    c.washPoly(c.blob(cx + 6, cx + 8, cx * 0.8, cx * 0.8, { n: 24, wobble: 0.15 }), '#1a2a22', 90);
    for (let i = 0; i < 8; i++) c.washPoly(c.blob(cx + r(-30, 30), cx + r(-30, 30), r(30, 55), r(28, 50), { n: 18, wobble: 0.2 }), r.pick(['#2f5a3a', '#3f6e45', '#28503a']), 255);
    c.flush();
    massPoly(c, c.blob(cx - 12, cx - 12, 50, 44), 'city_mass_m', '#7ab06a', { precision: 0.5, strength: 0.5 });
    c.flush();
    for (let i = 0; i < 30; i++) c.washPoly(c.blob(cx + r(-60, 60), cx + r(-60, 60), r(3, 7), r(3, 6), { n: 8 }), r.pick(['#1f4030', '#8ab86a', '#a8c880']), 220);
  });
  return { side, top };
}
// horse tram seen from behind (it rolls away up the avenue towards the tower)
export const TRAM = { w: 30, h: 38, D: 6 };
export function paintTram(P) {
  const { w, h, D } = TRAM;
  return P.layer('tram', { w: w * D, h: h * D, scale: 1.1 }, (c) => {
    const r = c.r;
    const X = (v) => v * D;
    const R = (x0, y0, x1, y1) => rectP(X(x0), X(y0), X(x1), X(y1));
    const body = '#a8322a', dark = '#6e1e1a', cream = '#efdcb4', gold = '#e8b85a', roof = '#2f6f68';
    // clerestory roof
    const rf = [[X(1), X(7.5)], [X(w - 1), X(7.5)], [X(w - 3), X(4)], [X(w - 9), X(3.4)], [X(w - 10), X(0.6)], [X(10), X(0.6)], [X(9), X(3.4)], [X(3), X(4)]];
    c.washPoly(rf, roof, 255);
    massPoly(c, rf, 'city_mass_s', '#1f4e4a', { precision: 0.8, strength: 0.5 });
    c.flush();
    c.washPoly(R(0.5, 7, w - 0.5, 9), cream, 255);
    // car body with windows and passengers against the lamplight
    c.washPoly(R(2, 9, w - 2, h - 9), body, 255);
    massPoly(c, R(2.5, 9.5, w - 2.5, h - 9.5), 'city_mass_s', dark, { precision: 0.7, strength: 0.55 });
    c.flush();
    for (const [x0, x1] of [[4, 11], [12.5, 17.5], [19, 26]]) {
      c.washPoly(R(x0, 11, x1, 19.5), '#ffcf6a', 255);
      c.washPoly(R(x0, 11, x1, 13), '#fff0c0', 200);
      // passengers
      const n = x1 - x0 > 6 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const px = x0 + (x1 - x0) * (k + 0.5) / n + r(-0.6, 0.6);
        c.washPoly(c.blob(X(px), X(15.2), X(1.3), X(1.5), { n: 12 }), '#6a3a22', 235);
        c.washPoly([[X(px - 2.2), X(19.5)], [X(px + 2.2), X(19.5)], [X(px + 1.5), X(16.6)], [X(px - 1.5), X(16.6)]], '#6a3a22', 235);
        if (r() < 0.5) c.washPoly(R(px - 1.6, 13, px + 1.6, 14.1), '#3a2218', 235);
      }
      c.strokePath([[X(x0), X(11)], [X(x1), X(11)], [X(x1), X(19.5)], [X(x0), X(19.5)], [X(x0), X(11)]], 'ink', '#3a1410', 0.9, 0.1);
    }
    // gold lining and a destination board
    c.strokePath([[X(3), X(21.2)], [X(w - 3), X(21.2)]], 'ink', gold, 1.3, 0.2);
    c.strokePath([[X(3), X(h - 10.5)], [X(w - 3), X(h - 10.5)]], 'ink', gold, 1.0, 0.2);
    c.washPoly(R(9.5, 22.5, w - 9.5, 25.8), cream, 255);
    for (let x = 11; x < w - 11; x += 1.6) c.strokePath([[X(x), X(23.3)], [X(x + r(0, 0.4)), X(25)]], 'ink', '#2a1a14', 0.6, 0.2);
    // rear platform: railing, step, the conductor
    c.washPoly(R(1, h - 9, w - 1, h - 7.2), '#4a2a1e', 255);
    for (let x = 2; x <= w - 2; x += 2.2) c.strokePath([[X(x), X(h - 15)], [X(x), X(h - 9)]], 'ink', '#2a1a14', 0.8, 0.1);
    c.strokePath([[X(1.5), X(h - 15)], [X(w - 1.5), X(h - 15)]], 'ink', gold, 1.2, 0.1);
    const cx = X(w * 0.68);
    c.washPoly([[cx - X(2.3), X(h - 9)], [cx + X(2.3), X(h - 9)], [cx + X(1.9), X(h - 17)], [cx - X(1.9), X(h - 17)]], '#23304a', 255);
    c.washPoly(c.blob(cx, X(h - 18.6), X(1.4), X(1.6), { n: 12 }), '#e0b090', 255);
    c.washPoly(R(w * 0.68 - 1.7, h - 21, w * 0.68 + 1.7, h - 19.6), '#1a1a22', 255);
    c.washPoly(R(1.5, h - 7.2, w - 1.5, h - 6), '#3a2a1e', 255);
    // wheels and the running gear
    c.washPoly(R(3, h - 6, w - 3, h - 4.4), '#1a1418', 255);
    for (const x of [6, w - 6]) {
      c.washPoly(c.blob(X(x), X(h - 3), X(3), X(3), { n: 18, wobble: 0.02 }), '#1a1418', 255);
      c.washPoly(c.blob(X(x), X(h - 3), X(1), X(1), { n: 10 }), '#6a6070', 255);
    }
    // corner lanterns (lit)
    for (const x of [1.4, w - 3.2]) {
      c.washPoly(R(x, 10, x + 1.8, 13.4), '#1a1418', 255);
      c.washPoly(R(x + 0.3, 10.6, x + 1.5, 13), '#ffe7a0', 255);
    }
    c.strokePath([[X(2), X(9)], [X(2), X(h - 9)]], 'ink', '#2a1418', 1.3, 0.3);
    c.strokePath([[X(w - 2), X(9)], [X(w - 2), X(h - 9)]], 'ink', '#2a1418', 1.3, 0.3);
  });
}
// top-view sprites (lying on the ground): horse cart, rowing boat
export function paintTopSprites(P) {
  const cart = P.layer('cartTop', { w: 160, h: 60, scale: 1 }, (c) => {
    c.washPoly(c.blob(52, 30, 50, 22, { n: 20, wobble: 0.05 }), '#1a1a22', 70);
    c.washPoly(rectP(20, 12, 90, 48), '#8a5a3a', 255);
    massPoly(c, rectP(22, 14, 88, 46), 'city_mass_s', '#5a3a22', { precision: 0.8, strength: 0.5 });
    c.flush();
    c.washPoly(rectP(26, 16, 84, 44), '#e9d6ae', 200);
    for (const y of [22, 30, 38]) c.strokePath([[26, y], [84, y]], 'wire', '#8a6a3a', 1, 0.3);
    c.washPoly([[92, 26], [120, 26], [120, 34], [92, 34]], '#4a3424', 255);
    c.washPoly(c.blob(128, 30, 14, 6, { n: 14 }), '#6a4a2a', 255);
    c.washPoly(c.blob(142, 30, 5, 4, { n: 10 }), '#5a3a22', 255);
  });
  const boat = P.layer('boatTop', { w: 90, h: 40, scale: 1.2 }, (c) => {
    const hull = [[6, 20], [20, 8], [70, 8], [86, 20], [70, 32], [20, 32]];
    c.washPoly(hull, '#7a4a2a', 255);
    c.washPoly([[12, 20], [23, 12], [67, 12], [79, 20], [67, 28], [23, 28]], '#b88a5a', 255);
    for (const x of [34, 50]) c.washPoly(rectP(x, 12, x + 4, 28), '#6a3a1a', 255);
    c.washPoly(c.blob(44, 20, 6, 6, { n: 12 }), '#c85a3a', 255);
    c.strokePath([[40, 20], [30, 2]], 'ink', '#3a2414', 1.4, 0.3);
    c.strokePath([[48, 20], [58, 38]], 'ink', '#3a2414', 1.4, 0.3);
    c.strokePath(closed(hull), 'ink', '#2a1a10', 1.2, 0.2);
  });
  return { cart, boat };
}

// painted smoke puff (white; alpha carries the brushy shape) for textured particles
export function paintPuff(P) {
  return P.layer('puff', { w: 128, h: 128, scale: 1 }, (c) => {
    const r = c.r;
    for (let i = 0; i < 7; i++) {
      const a = r(0, TAU), d = r(0, 22);
      c.fillPoly(c.blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r(18, 30), r(15, 26), { n: 24, wobble: 0.25 }), '#ffffff', { opacity: 70, bleed: 0.12, texture: 0.6, border: 0.3 });
    }
    c.flush();
    for (let i = 0; i < 10; i++) {
      const a = r(0, TAU), d = r(10, 40);
      c.strokePath([[64 + Math.cos(a) * d, 64 + Math.sin(a) * d], [64 + Math.cos(a + 0.6) * d, 64 + Math.sin(a + 0.6) * d], [64 + Math.cos(a + 1.1) * (d - 6), 64 + Math.sin(a + 1.1) * (d - 6)]], r() < 0.5 ? 'pastel' : 'crayon', '#ffffff', r(0.8, 1.4), 0.5);
    }
  });
}
