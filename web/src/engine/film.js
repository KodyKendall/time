// Film = shots on a timeline + transitions between them.
// A shot plays a scene over [start, end) in global seconds. Local time lt = t - start.
// Each scene draws in its own world space (design units, 1920x1080 frame at its default view).
// Transitions decide the view (world->screen matrix), opacity and mask for the scenes involved.
import { M, clamp, invLerp, ease, lerpView, smoothstep } from './math.js';

export const ID = () => M.id();

export class Film {
  constructor({ fps = 30, duration, shots, transitions = [], overlays = [], post = null }) {
    this.fps = fps;
    this.duration = duration;
    this.shots = shots;
    this.transitions = transitions;
    this.overlays = overlays;
    this.postFn = post;
    this.byId = new Map(shots.map((s) => [s.id, s]));
    for (const tr of transitions) {
      tr.A = this.byId.get(tr.from);
      tr.B = this.byId.get(tr.to);
      if (!tr.A || !tr.B) throw new Error(`transition ${tr.from}->${tr.to}: unknown shot`);
    }
  }

  // Scene's own camera at local time.
  ownView(shot, t) {
    const lt = t - shot.start;
    return shot.view ? shot.view(lt) : shot.scene.view ? shot.scene.view(lt) : M.id();
  }

  // Returns draw list: [{ shot, lt, view, opacity, mask }], back to front.
  at(t) {
    const tr = this.transitions.find((x) => t >= x.start && t < x.end);
    if (tr) return this.transitionAt(tr, t);
    const shot = this.shots.find((s) => t >= s.start && t < s.end) || this.shots[this.shots.length - 1];
    return [{ shot, lt: t - shot.start, view: this.ownView(shot, t), opacity: 1 }];
  }

  transitionAt(tr, t) {
    const u = invLerp(tr.start, tr.end, t);
    const A = tr.A, B = tr.B;
    const la = t - A.start, lb = t - B.start;
    const vA = this.ownView(A, t), vB = this.ownView(B, t);
    const e = tr.ease || ease.inOutSine;
    switch (tr.kind) {
      case 'cut':
        return [{ shot: u < (tr.at ?? 0.5) ? A : B, lt: u < (tr.at ?? 0.5) ? la : lb, view: u < (tr.at ?? 0.5) ? vA : vB, opacity: 1 }];
      case 'fade': {
        const k = e(u);
        return [
          { shot: A, lt: la, view: vA, opacity: 1 },
          { shot: B, lt: lb, view: vB, opacity: k },
        ];
      }
      case 'zoomIn': {
        // B lives inside A: tr.embed maps B-world -> A-world.
        const E = tr.embed;
        const k = e(u);
        const anchor = tr.anchor || M.apply(E, 960, 540);
        const target = M.mul(vB, M.inv(E)); // A-world view that frames B like B's own camera
        const viewA = lerpView(vA, target, anchor, k);
        const viewB = M.mul(viewA, E);
        const [f0, f1] = tr.fade || [0.35, 0.8];
        const op = smoothstep(f0, f1, u);
        const list = [{ shot: A, lt: la, view: viewA, opacity: 1 }];
        list.push({ shot: B, lt: lb, view: viewB, opacity: op, mask: tr.mask ? tr.mask(viewB, u, op) : null });
        if (tr.after) tr.after(list, u);
        return list;
      }
      case 'zoomOut': {
        // A lives inside B: tr.embed maps A-world -> B-world.
        const E = tr.embed;
        const k = e(u);
        const anchor = tr.anchor || M.apply(E, 960, 540);
        const start = M.mul(vA, M.inv(E)); // B-world view that frames A like A's camera
        const viewB = lerpView(start, vB, anchor, k);
        const viewA = M.mul(viewB, E);
        const [f0, f1] = tr.fade || [0.2, 0.65];
        const op = 1 - smoothstep(f0, f1, u);
        const list = [
          { shot: B, lt: lb, view: viewB, opacity: 1 },
          { shot: A, lt: la, view: viewA, opacity: op, mask: tr.mask ? tr.mask(viewA, u, op) : null },
        ];
        if (tr.after) tr.after(list, u);
        return list;
      }
      case 'custom':
        return tr.fn({ t, u, A, B, la, lb, vA, vB });
      default:
        throw new Error('unknown transition ' + tr.kind);
    }
  }

  // Shots needed in [t0, t1] (for painting ahead / releasing).
  shotsIn(t0, t1) {
    const set = new Set();
    for (const s of this.shots) if (s.end > t0 && s.start <= t1) set.add(s);
    for (const tr of this.transitions)
      if (tr.end > t0 && tr.start <= t1) {
        set.add(tr.A);
        set.add(tr.B);
      }
    return [...set];
  }
}

// Soft circular reveal mask that follows a scene's frame on screen.
export function portalMask(view, { r0 = 0.25, r1 = 0.62, cx = 960, cy = 540 } = {}) {
  const [x, y] = M.apply(view, cx, cy);
  const s = M.scaleOf(view);
  return { type: 'radial', x, y, r0: r0 * 1920 * s, r1: r1 * 1920 * s };
}
