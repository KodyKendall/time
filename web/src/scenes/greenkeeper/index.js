// FORTY YEARS OF STRIPES — the plate film. Eleven beats, 2:58.
//
// Each beat is a generated background plate (web/assets/greenkeeper/plates, made with
// tools/gen.mjs) with the Greenkeeper as a held cut-out where she appears, and the very few
// things that move drawn by the engine every frame. Per docs/ANIMATION_DIRECTION.md the artwork
// is preserved: she is placed, scaled and drifted, never rigged or deformed.
//
// Two mirrored pairs carry the film: 1<->9 and 3<->11 share a camera position.
import { M, clamp, lerp, smoothstep, ease } from '../../engine/math.js';

// ---------------------------------------------------------------- timing
// Beat k runs T[k]..T[k+1] (the storyboard's timecodes).
export const T = [0, 16, 32, 44, 60, 76, 96, 114, 130, 142, 150, 178];
export const DUR = 178;

// ---------------------------------------------------------------- art
// `top` crops a 3:2 plate (drawn 1920 wide = 1280 tall) down to the 1080 frame.
const PL = (n, top = 100) => ({ src: `assets/greenkeeper/plates/bg${n}.png`, top });
export const PLATES = [PL(1, 150), PL(2, 110), PL(3, 100), PL(4, 100), PL(5, 60),
  PL(6, 100), PL(7, 110), PL(8, 100), PL(9, 150), null, PL(11, 100)];   // null = beat 10, the card

// Her, as held cut-outs. `feet` is filled in by the loader from the alpha bounding box, so the
// anchors stay right if a pose is regenerated.
export const SPRITES = {
  gkRef: { src: 'assets/greenkeeper/plates/gk_ref.png' },
  gkPush: { src: 'assets/greenkeeper/plates/gk_push.png' },
  gkSmile: { src: 'assets/greenkeeper/plates/gk_smile.png' },
  gkBank: { src: 'assets/greenkeeper/plates/gk_bank.png' },
  gkHand: { src: 'assets/greenkeeper/plates/gk_hand.png' },
  gkWalk: { src: 'assets/greenkeeper/plates/gk_walk.png' },
  gkBoard: { src: 'assets/greenkeeper/plates/gk_board.png' },
  // the two strangers in the last shot, cut out of the plate later if they need to be bigger
};

// Which layers draw: the studio's toggles (window.FILM_LAYERS) or ?only=plate,gk,code,fx.
const ONLY = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('only') : null;
const show = (name) => {
  const on = typeof window !== 'undefined' && window.FILM_LAYERS ? window.FILM_LAYERS : ONLY ? ONLY.split(',') : null;
  return !on || on.includes(name);
};
let REAL_R = null;
const MUTED = new Proxy({}, { get: (_, k) => (k === 'view' ? M.id() : () => {}) });

// ---------------------------------------------------------------- her
// A held pose: placed, scaled, drifted. The only movement is a walk loop and the faintest
// breathing — enough that she is alive, not enough that we are animating her.
function her(R, A, name, x, y, s, { op = 1, walk = 0, sway = 0, rot = 0, drift = 0, dir = 1 } = {}) {
  R = REAL_R || R;
  if (!show('gk')) return;
  const L = A[name];
  const sp = SPRITES[name];
  if (!L || !sp || !sp.feet) return;
  const w = walk ? Math.sin(walk * 3.1) : 0;      // 3.1 rad/s: a slow stride, not a jog
  const bob = walk ? Math.abs(Math.sin(walk * 3.1)) * s * 6 : Math.sin(R.t * 0.9) * s * 1.2;
  const m = M.chain(
    M.translate(x + (drift ? Math.sin(R.t * 0.31) * drift : 0), y - bob),
    M.rotate(rot + (sway ? sway * Math.sin(R.t * 0.7) : 0) + w * 0.012),
    M.scale(s),
    M.translate(-sp.feet[0], -sp.feet[1]),
  );
  R.layer(L, m, { opacity: op, w: L.w, h: L.h });
}

// ---------------------------------------------------------------- motion layers
// Everything the engine paints that moves. All of it is low-contrast and slow: the art stays.
function paint(P) {
  const A = {};
  PLATES.forEach((pl, k) => { if (pl && pl.img) A['plate' + k] = P.image(pl.img, { w: 1920, h: (1920 * pl.img.height) / pl.img.width }); });
  for (const [name, sp] of Object.entries(SPRITES)) if (sp.img) A[name] = P.image(sp.img, { w: sp.img.width, h: sp.img.height });

  A.title = P.text('FORTY YEARS OF STRIPES', { font: 'italic 400 74px Georgia', color: '#f6f1e6', align: 'center' });
  A.card = P.text('The north bank, where we scattered her ashes.', { font: 'italic 400 46px Georgia', color: '#efe8da', align: 'center' });
  return A;
}

// ---------------------------------------------------------------- the beats
// cam: [[scale, cx, cy] at the start, [scale, cx, cy] at the end]. Every camera move in this film
// is a drift of a few percent. Nothing cuts quickly and nothing pushes hard.
const BEATS = [
  { // 1. Dawn. She is already at the far end; we join her mid-task.
    cam: [[1.0, 960, 540], [1.035, 960, 540]],
    draw(R, A, l) {
      her(R, A, 'gkPush', 1706, 786, 0.055, { walk: l * 0.55, dir: -1 });
    } },
  { // 2. Pushing. Backlit. Clippings lift off the blade and hang in the light.
    cam: [[1.02, 960, 540], [1.05, 1010, 540]],
    draw(R, A, l) {
      her(R, A, 'gkPush', 1210, 900, 0.3, { walk: l * 1.1 });
    } },
  { // 3. Stripes. Empty. The camera rises, the way you would look up.
    cam: [[1.0, 960, 600], [1.03, 960, 540]],
    draw() { } },
  { // 4. The north bank. Cool, shaded, out of the stripes. Her hands open once.
    cam: [[1.0, 960, 540], [1.03, 960, 540]],
    draw(R, A, l) {
      // long grass breathing across the whole frame
      her(R, A, 'gkBank', 1180, 1010, 0.44);
    } },
  { // 5. Sunday. The warmest and fullest the film gets. The dog comes over; she smiles. Once.
    cam: [[1.0, 960, 540], [1.05, 1120, 540]],
    draw(R, A, l) {
      her(R, A, 'gkSmile', 1250, 982, 0.3, { op: 1, sway: 0.006 });
    } },
  { // 6. The board. She has stopped. Nothing in the frame moves but the grass.
    cam: [[1.0, 960, 540], [1.012, 960, 540]],
    draw(R, A) {
      her(R, A, 'gkBoard', 1136, 918, 0.26, { op: 1 });
    } },
  { // 7. The hoarding. She mows through the gap. She is trespassing to do it properly.
    cam: [[1.0, 960, 540], [1.035, 900, 540]],
    draw(R, A, l) {
      her(R, A, 'gkHand', 828, 884, 0.3, { walk: l * 0.85 });
    } },
  { // 8. The choice. Ragged stripes left, straight stripes right. She mows her own line.
    //     The stripes do not move: they are the argument.
    cam: [[1.0, 960, 540], [1.02, 1010, 540]],
    draw(R, A, l) {
      her(R, A, 'gkHand', 1086, 1012, 0.33, { walk: l * 0.5 });
    } },
  { // 9. The leaving. The exact camera of beat 1. She walks out and we do not follow her.
    cam: [[1.035, 960, 540], [1.035, 960, 540]],
    draw(R, A, l) {
      // out of frame right over the 12 seconds, and gone for the last three
      const u = clamp((l - 1.0) / 9.0);
      her(R, A, 'gkWalk', lerp(1560, 2260, u), 800, 0.15, { walk: (l - 1.0) * 1.05, op: u > 0.985 ? 0 : 1 });
    } },
  { // 10. The card. Black. One line. The only hard cut in the film, and it is deliberate.
    cam: [[1, 960, 540], [1, 960, 540]],
    draw(R, A, l, d) {
      R.fill([0, 0, 0, 1]);
      const op = smoothstep(0.5, 2.2, l) * (1 - smoothstep(d - 2.4, d - 0.4, l));
      if (A.card) R.layer(A.card, M.translate(960 - A.card.w / 2, 540 - A.card.h / 2), { opacity: op });
    } },
  { // 11. The strangers. The exact camera of beat 3. Long grass, two people lying down in it.
    cam: [[1.0, 960, 540], [1.02, 960, 540]],
    draw(R, A, l, d) {
      // the slowest drift in the film: 2% across the whole 28 seconds
    } },
];

function camView(k, l) {
  const [[s0, x0, y0], [s1, x1, y1]] = BEATS[k].cam;
  const u = ease.inOutSine(clamp(l / (T[k + 1] - T[k])));
  const s = lerp(s0, s1, u), fx = lerp(x0, x1, u), fy = lerp(y0, y1, u);
  return M.chain(M.translate(fx, fy), M.scale(s), M.translate(-fx, -fy));
}

function draw(R) {
  const k = +R.shot.id.slice(1), A = R.assets;
  const l = R.t - T[k], d = T[k + 1] - T[k];
  // beat 11 is a genuinely dark evening plate; lift it so the ending reads, and keep the
  // rest of the film exactly as painted.
  const TINT = [null, null, null, null, null, null, null, null, null, null, [1.5, 1.55, 1.62]];
  if (PLATES[k] && A['plate' + k] && show('plate')) R.layer(A['plate' + k], M.translate(0, -PLATES[k].top), TINT[k] ? { tint: TINT[k] } : {});
  else if (k !== 9) R.fill('#8a8f96');   // beat 9 is the card: it draws its own black
  REAL_R = R;
  BEATS[k].draw(show('code') ? R : MUTED, A, l, d, R.t);
  REAL_R = null;
}

function post() {
  return { bloom: 0.012, threshold: 0.93, exposure: 1.02, sat: 1.03, contrast: 1.03, vignette: 0.32, paper: 0.3, grain: 0.05 };
}

export const scene = { id: 'greenkeeper', bg: '#000000', paint, draw, blur: () => 2, post };

// ---------------------------------------------------------------- overlay: title, card, the end
function paintFx(P) {
  const A = {};
  A.title = P.text('FORTY YEARS OF STRIPES', { font: 'italic 400 74px Georgia', color: '#f6f1e6', align: 'center' });
  return A;
}

function drawFx(R, t) {
  if (!show('fx')) return;
  const A = R.assets;
  // the title sits inside beat 1, from 0:04 to 0:11. We are already inside her morning.
  if (t > 3.4 && t < 11.6 && A.title) {
    const op = smoothstep(3.6, 5.2, t) * (1 - smoothstep(9.8, 11.4, t));
    R.layer(A.title, M.translate(960 - A.title.w / 2, 540 - A.title.h / 2), { opacity: op });
  }
  // 9 -> 10: the one hard cut. A beat of black before the card.
  if (t > 141.4 && t < 142.4) R.fill([0, 0, 0, 1], { opacity: smoothstep(141.4, 141.9, t) });
  // the end: fade to black under the long hold
  const out = smoothstep(177.0, 178, t);
  if (out > 0) R.fill([0, 0, 0, 1], { opacity: out });
}

export const overlay = { id: 'greenkeeper_fx', start: 0, end: DUR, paint: paintFx, draw: drawFx };

// ---------------------------------------------------------------- the cuts
// Long dissolves, per the note that long transitions read best. 1.5-3 s, and one hard cut.
const TRANS = [
  { start: 14.5, end: 16.0, kind: 'fade', ease: ease.inOutSine },     // 1->2
  { start: 30.5, end: 32.0, kind: 'fade', ease: ease.inOutSine },     // 2->3
  { start: 42.0, end: 44.0, kind: 'fade', ease: ease.inOutSine },     // 3->4
  { start: 57.5, end: 60.0, kind: 'fade', ease: ease.inOutSine },     // 4->5
  { start: 73.5, end: 76.0, kind: 'fade', ease: ease.inOutSine },     // 5->6
  { start: 93.5, end: 96.0, kind: 'fade', ease: ease.inOutSine },     // 6->7
  { start: 111.5, end: 114.0, kind: 'fade', ease: ease.inOutSine },   // 7->8
  { start: 127.5, end: 130.0, kind: 'fade', ease: ease.inOutSine },   // 8->9
  { start: 139.99, end: 140.01, kind: 'cut' },                        // 9->10 the hard cut
  { start: 148.0, end: 150.0, kind: 'fade', ease: ease.inOutSine },   // 10->11 the longest in the film
];

const NAMES = ['1 Dawn', '2 Pushing', '3 Stripes', '4 The north bank', '5 Sunday',
  '6 The board', '7 The hoarding', '8 The choice', '9 The leaving', '10 The card', '11 The strangers'];

export function shots() {
  return BEATS.map((_, k) => ({
    id: 'b' + k, label: NAMES[k], scene,
    start: k === 0 ? 0 : TRANS[k - 1].start,
    end: k === BEATS.length - 1 ? DUR : TRANS[k].end,
    view(lt) { return camView(k, lt + this.start - T[k]); },
  }));
}

export function transitions() {
  return TRANS.map((tr, i) => ({ from: 'b' + i, to: 'b' + (i + 1), ...tr }));
}
