// MIND (130 – 145 s): die -> chip on its board -> the lit cells lift off into a neural network ->
// it thinks in waves -> its lattice straightens into lines of code in an editor that assembles
// around them -> play -> the camera dives into the caret -> the caret collapses into a point of
// light that shrinks into the void (the film loops to the point of light at 0 s).
import { C } from '../lib/palette.js';
import { PIVOT } from '../pivots.js';
import { M, lerp, clamp, smoothstep, hex } from '../lib/kit.js';
import { ease, invLerp } from '../../engine/math.js';
import { T, SEG0, DUR, NODES, boardView, netView } from './layout.js';
import { defineMindBrushes } from './brushes.js';
import { paintBoard, drawBoard } from './board.js';
import { paintNetwork, drawWeb, mainLayer, drawMain, drawSignals, drawNodes, drawMotes, nodeState } from './network.js';
import { paintEditor, drawEditor, drawCode, drawCaret, diveView, diveZoom } from './editor.js';

const DEF = { exposure: 1, bloom: 0.9, threshold: 1.0, vignette: 0.32, sat: 1, contrast: 1 };
const LOOK = { exposure: 1.0, bloom: 1.12, threshold: 0.93, vignette: 0.42, sat: 1.06, contrast: 1.04 };

// ambient light of the network / screen space (atmosphere) — goes out with the editor
function ambient(lt) { return 1 - smoothstep(12.2, 13.6, lt); }

// background planes: parallax against the net camera, drift down a little as the board sinks
function bgView(lt, k, dy) {
  const nv = netView(lt);
  const z = 1 + (M.scaleOf(nv) - 1) * k;
  const sink = ease.inOutCubic(invLerp(T.sink0, T.sink1 + 0.6, lt));
  const dive = lt > T.dive0 ? Math.pow(diveZoom(lt), 0.12 * k) : 1;
  return M.chain(M.translate(960, 540 - dy * (1 - sink)), M.scale(z * dive), M.translate(-960, -540));
}

export const scene = {
  id: 'mind',
  bg: C.void,
  deps: [PIVOT.die, PIVOT.singularity, PIVOT.star, PIVOT.cell, PIVOT.eye, PIVOT.fields, PIVOT.gear],

  paint(P) {
    defineMindBrushes(P.brush);
    const board = paintBoard(P);
    const net = paintNetwork(P);
    const ed = paintEditor(P);
    return { ...board, net, ed };
  },

  post(lt) {
    const w = smoothstep(0.6, 2.4, lt) * (1 - smoothstep(12.6, 14.3, lt));
    if (w <= 0) return {};
    const o = {};
    for (const k in DEF) o[k] = lerp(DEF[k], LOOK[k], w);
    return o;
  },

  // motion-blur samples from our own cameras / fastest movers (the engine only sees view())
  blur(lt) {
    const dt = 0.5 / 30;
    let px = 0;
    const pts = [[160, 90], [960, 540], [1760, 90], [160, 990], [1760, 990]];
    const camMove = (fa, k = 1) => {
      const A = fa(lt - dt / 2), B = fa(lt + dt / 2);
      for (const [x, y] of pts) {
        const w = M.apply(M.inv(A), x, y);
        const s = M.apply(B, w[0], w[1]);
        px = Math.max(px, Math.hypot(s[0] - x, s[1] - y) * k);
      }
    };
    if (lt < 3.4) camMove(boardView, 0.7);
    if (lt > T.dive0) camMove(diveView, 1.3);
    if ((lt > 1.2 && lt < 3.4) || (lt > T.node0 && lt < 9.6)) {
      for (const n of NODES) {
        const a = nodeState(n, lt - dt / 2), b = nodeState(n, lt + dt / 2);
        if (a && b) px = Math.max(px, Math.hypot(b.x - a.x, b.y - a.y));
      }
    }
    return clamp(Math.ceil((px * 2) / 5), 1, lt > T.dive0 ? 12 : 8);
  },

  draw(R, lt, A) {
    // exact pivots at both boundaries
    if (lt <= 0) { R.drawScene(PIVOT.die, 0); return; }
    if (lt >= DUR) { R.drawScene(PIVOT.singularity, 0); return; }
    const ltF = R.frameT - SEG0;
    const nv = netView(lt);
    const amb = ambient(lt);

    // ---- painted space of the network (behind everything; revealed as the board sinks)
    if (amb > 0) {
      R.layer(A.net.bgFar, M.mul(bgView(lt, 0.3, 90), M.translate(-340, -210)), { grade: [1, lerp(0.15, 1, amb), 1] });
      R.layer(A.net.bgMid, M.mul(bgView(lt, 0.6, 200), M.translate(-340, -210)), { opacity: amb });
      drawMotes(R, lt, amb * smoothstep(1.5, 3.5, lt));
      // the network lights its space (cool), warmer when a thought passes through
      const netLight = smoothstep(2.0, 3.6, lt) * amb;
      if (netLight > 0) {
        const wave = T.waves.reduce((m, w) => Math.max(m, Math.exp(-Math.pow((lt - w - 0.45) / 0.35, 2))), 0);
        R.glow(960, 540, 700, [0.2, 0.26, 0.6], 0.26 * netLight, { ext: 2.2, shape: [1, 0.3, 1] });
        R.glow(960, 540, 520, [1, 0.55, 0.25], 0.12 * wave * netLight, { ext: 2.2, shape: [1, 0.3, 1] });
      }
    }
    // ---- the chip on its board
    if (lt < T.sink1 + 0.05) {
      const DA = R.engine.ensure(PIVOT.die);
      R.with(boardView(lt), () => drawBoard(R, lt, A, DA));
    }
    // ---- editor (behind the lattice)
    const E = {};
    drawEditor(R, lt, A, E);
    // ---- lattice + calligraphic noodles
    R.with(nv, () => drawWeb(R, lt, A));
    const L = mainLayer(R, lt, ltF);
    if (L) drawMain(R, lt, L);
    // ---- code glyphs, signals, nodes, caret
    drawCode(R, lt, A, E);
    drawSignals(R, lt, A);
    drawNodes(R, lt, A, (n) => !(lt >= n.t1 && (n.tg.kind === 'dot' || n.tg.kind === 'knob')));
    // ---- near plane: out-of-focus nodes drift in from the edges as we rise off the board, and
    //      stream out past the camera as it leans in to the code
    {
      const s = 1 + 1.7 * (1 - ease.outCubic(invLerp(1.7, 3.7, lt))) + 1.1 * ease.inCubic(invLerp(7.7, 9.2, lt));
      if (s < 2.6) R.layer(A.net.near, M.chain(nv, M.translate(960, 540), M.scale(s * 1.03), M.translate(-960, -540), M.translate(-140, -110)), { blend: 'add', opacity: 0.85 });
    }
    drawCaret(R, lt);
  },
};
