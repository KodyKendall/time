// WRENKITE — TETHERED, 18 plates + credits, ~7:30.
//
// One held generated painting per shot (web/assets/wren-kite/plates, made with tools/gen.mjs).
// Beats 5, 6, 7, 8, 9 each play across TWO plates, and beat 10 opens with the carry home before
// the kitchen — voice and score timecodes (T) are untouched; only the pictures cut more often.
// The final wide arrives early (388) so the last lines land on it; then title, moral, and credits
// cards play out over the score's coda.
// Every move is slow, motivated by the narration, and settles: scales stay >= 1.0 and rotation
// within a degree, so paintings are reframed, never deformed or cropped open.
// Narration (audio/build/tts/wk_beat01-12.mp3) and score (audio/scores/wrenkite_lullaby.mjs) share
// the same timecode: beat k runs T[k]..T[k+1], voice enters at T[k]+1.5.
import { M, clamp, lerp, ease, smootherstep, fbm1 } from '../../engine/math.js';
import { viewMatrix } from '../../engine/math.js';

// ---------------------------------------------------------------- timing (locked to narration)
export const T = [0, 22.3, 55.2, 91.3, 142.4, 171.0, 203.6, 253.5, 285.6, 320.0, 351.8, 395.6, 414];
export const DUR = 450;

// ---------------------------------------------------------------- shots: [id, plate, start, end]
const SUBS = [
  ['w0', 'wk1', 0, 22.3],
  ['w1', 'wk2', 22.3, 55.2],
  ['w2', 'wk3', 55.2, 91.3],
  ['w3', 'wk4', 91.3, 142.4],
  ['w4c', 'wk4b', 142.4, 148.2], ['w4a', 'wk5', 148.2, 157], ['w4b', 'wk5b', 157, 171],
  ['w5a', 'wk6', 171, 189], ['w5b', 'wk6b', 189, 203.6],
  ['w6a', 'wk7', 203.6, 240], ['w6b', 'wk7b', 240, 253.5],
  ['w7a', 'wk8', 253.5, 281.5], ['w7b', 'wk8b', 281.5, 285.6],
  ['w8a', 'wk9', 285.6, 306], ['w8b', 'wk9b', 306, 320],
  ['w9a', 'wk9c', 320, 331], ['w9b', 'wk10', 331, 351.8],
  ['w10', 'wk11', 351.8, 388],
  ['w11', 'wk12', 388, 414],
  ['w12', 'card:title', 414, 423],
  ['w13', 'card:moral', 423, 433],
  ['w14', 'card:creditsA', 433, 442],
  ['w15', 'card:creditsB', 442, 450],
];
const LABELS = {
  w0: '1 First memory', w1: '2 She ran', w2: '3 The want', w3: '4 Fighting',
  w4c: '5 Snap · the break', w4a: '5 Snap · flung', w4b: '5 Snap · reaching',
  w5a: '6 Free · soaring', w5b: '6 Free · parting',
  w6a: '7 Fall · tumbling', w6b: '7 Fall · branches',
  w7a: '8 Thorn tree', w7b: '8 The light below',
  w8a: '9 Search · lantern', w8b: '9 Search · hands',
  w9a: '10 Carry home', w9b: '10 The mend', w10: '11 Leaning in', w11: '12 Held',
  w12: 'Credits · title', w13: 'Credits · moral', w14: 'Credits · film by', w15: 'Credits · thanks',
};
export const PLATES = [...new Set(SUBS.map((s) => s[1]).filter((f) => !f.startsWith('card:')))].map((f) => ({ src: `assets/wren-kite/plates/${f}.png`, top: 100, file: f }));

// Story-driven camera: per-shot chapters, [localSeconds, scale, focusX, focusY, rotDeg].
// Chapter marks land on story moments; log-zoom between keys so speed feels even.
const MOVES = {
  w0: [[0, 1.00, 960, 540, 0], [11, 1.05, 800, 555, 0], [22.3, 1.10, 690, 575, 0]],
  w1: [[0, 1.05, 720, 610, 0], [12, 1.08, 880, 470, 0], [24, 1.12, 1080, 390, 0], [32.9, 1.04, 960, 515, 0]],
  w2: [[0, 1.08, 960, 460, 0], [14, 1.10, 1140, 420, 0], [26, 1.06, 720, 640, 0], [36.1, 1.12, 1040, 450, 0]],
  w3: [[0, 1.02, 900, 540, 0], [17, 1.07, 940, 540, 0.3], [34, 1.12, 960, 550, 0.5], [51.1, 1.16, 1000, 560, 0.8]],
  w4c: [[0, 1.14, 960, 540, 0], [5.8, 1.16, 980, 550, 0]],
  w4a: [[0, 1.12, 700, 620, 0], [8.8, 1.08, 760, 560, 0]],
  w4b: [[0, 1.08, 700, 600, 0], [14, 1.13, 680, 610, 0]],
  w5a: [[0, 1.04, 800, 500, 0], [18, 1.09, 960, 450, -0.5]],
  w5b: [[0, 1.06, 960, 500, 0], [14.6, 1.12, 980, 390, 0]],
  w6a: [[0, 1.06, 960, 470, 0], [18, 1.08, 940, 540, 1.0], [36.4, 1.10, 960, 590, -1.0]],
  w6b: [[0, 1.10, 960, 500, 0], [13.5, 1.15, 960, 560, 0]],
  w7a: [[0, 1.02, 960, 540, 0], [28, 1.05, 980, 550, 0]],
  w7b: [[0, 1.06, 1000, 560, 0], [4.1, 1.09, 960, 540, 0]],
  w8a: [[0, 1.03, 900, 560, 0], [20.4, 1.09, 880, 540, 0]],
  w8b: [[0, 1.10, 960, 560, 0], [14, 1.15, 960, 540, 0]],
  w9a: [[0, 1.08, 900, 560, 0], [11, 1.12, 880, 540, 0]],
  w9b: [[0, 1.06, 800, 560, 0], [10, 1.11, 940, 545, 0], [20.8, 1.16, 1000, 550, 0]],
  w10: [[0, 1.08, 700, 620, 0], [13, 1.10, 900, 480, 0], [25, 1.06, 1000, 400, 0], [36.2, 1.10, 1050, 430, 0]],
  w11: [[0, 1.0, 960, 540, 0], [26, 1.0, 960, 540, 0]],
  w12: [[0, 1, 960, 540, 0], [1, 1, 960, 540, 0]],
  w13: [[0, 1, 960, 540, 0], [1, 1, 960, 540, 0]],
  w14: [[0, 1, 960, 540, 0], [1, 1, 960, 540, 0]],
  w15: [[0, 1, 960, 540, 0], [1, 1, 960, 540, 0]],
};
// Motivated tremble: [shot, localStart, localEnd, maxPx].
const SHAKES = [['w3', 28, 51.1, 2.5], ['w4c', 0, 2.5, 6], ['w6a', 0, 36.4, 2]];

function camView(id, l, g0) {
  const keys = MOVES[id];
  let i = 0;
  while (i < keys.length - 2 && l >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1];
  const u = smootherstep(a[0], b[0], l);
  const s = Math.exp(lerp(Math.log(a[1]), Math.log(b[1]), u));
  let fx = lerp(a[2], b[2], u), fy = lerp(a[3], b[3], u);
  const r = (lerp(a[4], b[4], u) * Math.PI) / 180;
  // one living stillness under everything: slow breathing so no frame ever freezes
  const t = g0 + l;
  const seed = SUBS.findIndex((x) => x[0] === id);
  fx += 4 * fbm1(t * 0.06, seed * 7 + 1);
  fy += 3 * fbm1(t * 0.06, seed * 7 + 2);
  for (const [bk, s0, s1, amp] of SHAKES) {
    if (bk !== id || l < s0 || l > s1) continue;
    const env = clamp((l - s0) / 1.5) * clamp((s1 - l) / 2.5);
    fx += env * amp * Math.sin(l * 44.0);
    fy += env * amp * 0.7 * Math.sin(l * 37.0 + 1.3);
  }
  return M.chain(M.translate(fx, fy), M.rotate(r), M.scale(s), M.translate(-fx, -fy));
}

// ---------------------------------------------------------------- scene
function paint(P) {
  const A = {};
  PLATES.forEach((pl) => { if (pl.img) A[pl.file] = P.image(pl.img, { w: 1920, h: (1920 * pl.img.height) / pl.img.width }); });
  const ink = '#f3ecdf';
  A.title = P.text('T E T H E R E D', { font: '400 96px Georgia', color: ink, align: 'center' });
  A.moral1 = P.text('\u201cThe string isn\u2019t what holds me down.', { font: 'italic 400 46px Georgia', color: ink, align: 'center' });
  A.moral2 = P.text('It\u2019s what holds me up.\u201d', { font: 'italic 400 46px Georgia', color: ink, align: 'center' });
  A.credit1 = P.text('a film by', { font: '400 32px Georgia', color: '#b9b2a4', align: 'center' });
  A.credit2 = P.text('Kody Kendall and Ashley Adolphson', { font: '400 44px Georgia', color: ink, align: 'center' });
  A.credit3 = P.text('Told by the Kite · paintings, music, voice', { font: 'italic 400 32px Georgia', color: '#b9b2a4', align: 'center' });
  A.credit4 = P.text('storytelling principles · Stephen King', { font: '400 32px Georgia', color: ink, align: 'center' });
  A.credit5 = P.text('inspiration · Hayao Miyazaki', { font: '400 32px Georgia', color: ink, align: 'center' });
  A.credit6 = P.text('made with the time repo · github.com/KodyKendall/time', { font: '400 28px Georgia', color: '#b9b2a4', align: 'center' });
  A.credit7 = P.text('Thank you for watching', { font: 'italic 400 32px Georgia', color: ink, align: 'center' });
  return A;
}

function draw(R) {
  const A = R.assets, f = R.shot.plate;
  if (f === 'card:title') { R.fill('#000'); if (A.title) R.layer(A.title, M.translate(960 - A.title.w / 2, 440)); return; }
  if (f === 'card:moral') {
    R.fill('#000');
    if (A.moral1) R.layer(A.moral1, M.translate(960 - A.moral1.w / 2, 430));
    if (A.moral2) R.layer(A.moral2, M.translate(960 - A.moral2.w / 2, 500));
    return;
  }
  if (f === 'card:creditsA') {
    R.fill('#000');
    if (A.credit1) R.layer(A.credit1, M.translate(960 - A.credit1.w / 2, 390));
    if (A.credit2) R.layer(A.credit2, M.translate(960 - A.credit2.w / 2, 445));
    if (A.credit3) R.layer(A.credit3, M.translate(960 - A.credit3.w / 2, 530));
    return;
  }
  if (f === 'card:creditsB') {
    R.fill('#000');
    if (A.credit4) R.layer(A.credit4, M.translate(960 - A.credit4.w / 2, 360));
    if (A.credit5) R.layer(A.credit5, M.translate(960 - A.credit5.w / 2, 415));
    if (A.credit6) R.layer(A.credit6, M.translate(960 - A.credit6.w / 2, 470));
    if (A.credit7) R.layer(A.credit7, M.translate(960 - A.credit7.w / 2, 540));
    return;
  }
  if (A[f]) R.layer(A[f], M.translate(0, -100));
  else R.fill('#8a8f96');
}

function post() {
  return { bloom: 0.015, threshold: 0.92, exposure: 1.02, sat: 1.04, contrast: 1.04, vignette: 0.3, paper: 0.3, grain: 0.05 };
}

export const scene = { id: 'wrenkite', bg: '#000000', paint, draw, blur: () => 2, post };

// ---------------------------------------------------------------- overlay: snap flash + title
function paintFx() { return {}; }
function drawFx(R, t) {
  const A = R.assets;
  // the snap: one overexposed white frame at the cut
  if (t > 142.35 && t < 143.6) {
    const w = t < 142.45 ? (t - 142.35) / 0.1 : 1 - (t - 142.45) / 1.15;
    R.fill([1, 0.98, 0.94, 1], { opacity: clamp(w, 0, 1) });
  }
  // the end: fade to black under the title — released before the title card so the
  // credits (separate shots from 414 on) are never painted under an opaque fill
  const out = t < 414 ? ease.inOutSine(clamp((t - 408.5) / 3.5)) : 0;
  if (out > 0) {
    R.fill([0, 0, 0, 1], { opacity: out });
    if (t < 414 && A.title) R.layer(A.title, M.translate(960 - A.title.w / 2, 540 - A.title.h / 2), { opacity: ease.inOutSine(clamp((t - 409.5) / 2.5)) });
  }
  // the very end: fade to black under the credits
  const fin = ease.inOutSine(clamp((t - 447) / 3));
  if (fin > 0) R.fill([0, 0, 0, 1], { opacity: fin });
}
export const overlay = { id: 'wrenkite_fx', start: 0, end: DUR, paint: paintFx, draw: drawFx };

// ---------------------------------------------------------------- shots + cuts
// Dissolves centred on every boundary (0.8s inside a beat, 1.2s between beats);
// the snap is the one hard cut; the fall lingers into the thorn dark; the final wide opens slowly.
const HALF = { 148.2: 0.4, 157: 0.4, 189: 0.4, 240: 0.4, 281.5: 0.4, 306: 0.4, 331: 0.4, 253.5: 1.0, 388: 1.4, 414: 1.0, 423: 0.8, 433: 0.8, 442: 0.8 };
const BOUNDS = SUBS.slice(1).map((s) => s[2]);
const TRANS = BOUNDS.map((b) => (b === 142.4
  ? { start: b - 0.01, end: b + 0.01, kind: 'cut' }
  : { start: b - (HALF[b] ?? 0.6), end: b + (HALF[b] ?? 0.6), kind: 'fade', ease: ease.inOutSine }));

export function shots() {
  return SUBS.map(([id, plate, start, end], i) => ({
    id, label: LABELS[id], scene, plate,
    start: i === 0 ? 0 : TRANS[i - 1].start,
    end: i === SUBS.length - 1 ? DUR : TRANS[i].end,
    view(lt) { return camView(id, lt + this.start - start, start); },
  }));
}
export function transitions() {
  return TRANS.map((tr, i) => ({ from: SUBS[i][0], to: SUBS[i + 1][0], ...tr }));
}
