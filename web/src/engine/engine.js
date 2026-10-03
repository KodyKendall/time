import { Compositor, DW, DH } from './compositor.js';
import { Post } from './post.js';
import { Painter, brush } from './paint.js';
import { textLayer } from './text.js';
import { textureFromCanvas } from './gl.js';
import { M, clamp, hex } from './math.js';

export class Engine {
  constructor(p, W, H, film) {
    this.p = p;
    this.W = W;
    this.H = H;
    this.S = W / DW;
    this.gl = p.drawingContext;
    this.film = film;
    this.comp = new Compositor(p, W, H);
    this.post = new Post(this.gl, W, H);
    this.painter = new Painter(p, this.S);
    this.T = {
      a: this.comp.makeTarget(),
      b: this.comp.makeTarget(),
      c: this.comp.makeTarget(),
      frame: this.comp.makeTarget(),
      accum: this.comp.makeTarget(),
    };
    this.assets = new Map(); // scene id -> { assets, lastUsed }
    this.maxShutterSamples = 12;
    this.shutter = 0.5; // 180 degrees
    this.frameNo = 0;
    this.comp.done();
  }

  // ------------------------------------------------------------------ assets
  ensure(scene) {
    if (scene.deps) for (const d of scene.deps) this.ensure(d);
    let rec = this.assets.get(scene.id);
    if (!rec) {
      const wasActive = this.comp.active, prevTarget = this.comp.cur;
      if (wasActive) this.comp.done();
      const t0 = performance.now();
      const P = this.paintCtx(scene);
      const assets = scene.paint ? scene.paint(P) : {};
      rec = { assets, P, ms: performance.now() - t0, dyn: new Map() };
      this.assets.set(scene.id, rec);
      this.comp.done();
      if (wasActive) this.comp.bind(prevTarget);
    }
    rec.lastUsed = this.frameNo;
    return rec.assets;
  }

  release(keepIds) {
    const addDeps = (sc) => { for (const d of sc.deps || []) { keepIds.add(d.id); addDeps(d); } };
    for (const sh of this.film.shots) if (keepIds.has(sh.scene.id)) addDeps(sh.scene);
    for (const [id, rec] of this.assets) {
      if (keepIds.has(id)) continue;
      for (const L of rec.P._layers) L.dispose();
      for (const D of rec.P._dyn) D.dispose();
      this.assets.delete(id);
    }
  }

  paintCtx(scene) {
    const painter = this.painter, gl = this.gl, S = this.S;
    const P = {
      _layers: [],
      _dyn: [],
      S,
      brush,
      layer: (name, opts, fn) => {
        const L = painter.layer(`${scene.id}/${name}`, opts, fn);
        P._layers.push(L);
        return L;
      },
      dynamic: (name, opts) => {
        const D = painter.dynamic(`${scene.id}/${name}`, opts);
        P._dyn.push(D);
        return D;
      },
      text: (lines, opts) => {
        const L = textLayer(gl, S, lines, opts);
        P._layers.push(L);
        return L;
      },
      // A decoded image (e.g. a generated background plate) as a layer w x h design units.
      image: (img, { w = 1920, h = 1080 } = {}) => {
        const tex = textureFromCanvas(gl, img, { mip: true });
        const L = { tex, w, h, flipY: false, dispose: () => gl.deleteTexture(tex) };
        P._layers.push(L);
        return L;
      },
    };
    return P;
  }

  // ------------------------------------------------------------------ render
  renderCtx(target, view, lt, t, shot, assets, scene = shot && shot.scene, frameT = t, inheritedMasks = []) {
    const comp = this.comp;
    const engine = this;
    const stack = [view];
    const cur = () => stack[stack.length - 1];
    const masks = inheritedMasks.slice();
    const mk = (o) => (o.mask || !masks.length ? o : { ...o, mask: masks[masks.length - 1] });
    const R = {
      t, lt, shot, assets, comp, S: this.S, W: DW, H: DH, engine: this, scene, frameT,
      // nominal-frame key: dynamic paintings keyed on it are shared by all motion-blur sub-samples
      key(fps = 30) { return Math.round(frameT * fps); },
      get view() { return cur(); },
      push(m) { stack.push(M.mul(cur(), m)); },
      pop() { stack.pop(); },
      with(m, fn) { R.push(m); try { fn(); } finally { R.pop(); } },
      toScreen(x, y) { return M.apply(cur(), x, y); },
      scale() { return M.scaleOf(cur()); },
      layer(L, m = M.id(), o = {}) { comp.layer(L, M.mul(cur(), m), mk(o)); },
      glow(x, y, r, color, intensity = 1, o = {}) {
        comp.glow(x, y, r, typeof color === 'string' ? hex(color) : color, intensity, mk({ ...o, m: M.mul(cur(), o.m || M.id()) }));
      },
      rect(x, y, w, h, c, o = {}) {
        comp.rect(x, y, w, h, typeof c === 'string' ? [...hex(c), 1] : c, mk({ ...o, m: M.mul(cur(), o.m || M.id()) }));
      },
      // Apply a screen-space mask (see compositor mask types) to every layer/glow/rect drawn in fn.
      withMask(mask, fn) { masks.push(mask); try { fn(); } finally { masks.pop(); } },
      fill(c, o = {}) { comp.fill(typeof c === 'string' ? [...hex(c), 1] : c, mk(o)); },
      particles(list, o = {}) { comp.particles(list, mk({ ...o, m: M.mul(cur(), o.m || M.id()) })); },
      // Repaint-on-key dynamic layer owned by this scene.
      dyn(name, key, paintFn, opts = {}) {
        const rec = engine.assets.get(scene.id);
        let D = rec.dyn.get(name);
        if (!D) {
          D = rec.P.dynamic(name, { w: 1920, h: 1080, ...opts });
          rec.dyn.set(name, D);
        }
        comp.done();
        const L = D.get(key, paintFn, opts.seed ?? name);
        comp.bind(target); // painting rebinds GL state; restore our target
        return L;
      },
      // Draw another scene's content (for seamless hand-offs) with the current view.
      drawScene(other, olt, view = cur()) {
        const oa = engine.ensure(other);
        const R2 = engine.renderCtx(target, view, olt, t, shot, oa, other, frameT, masks);
        other.draw(R2, olt, oa);
      },
    };
    return R;
  }

  drawShotInto(target, item, t, frameT = t) {
    const { shot, lt, view } = item;
    const scene = shot.scene;
    try {
      const assets = this.ensure(scene);
      const bg = scene.bg ? (typeof scene.bg === 'string' ? hex(scene.bg) : scene.bg) : [0, 0, 0];
      this.comp.bind(target, [bg[0], bg[1], bg[2], 1]);
      const R = this.renderCtx(target, view, lt, t, shot, assets, scene, frameT);
      scene.draw(R, lt, assets);
    } catch (e) {
      // a broken segment must not take the whole film down while it is being edited
      if (this.strict) throw e;
      console.error(`scene '${scene.id}' failed at t=${t.toFixed(2)}: ${e.message}`);
      this.comp.done();
      this.comp.bind(target, [0.35, 0.02, 0.05, 1]);
    }
    this.comp.done();
  }

  // Render the composited (pre-post) frame at time t into target `out`.
  composite(t, out, frameT = t) {
    const list = this.film.at(t);
    if (list.length === 1 && !list[0].mask && list[0].opacity >= 1) {
      this.drawShotInto(out, list[0], t, frameT);
    } else {
      // draw each scene into its own buffer, then stack them
      const bufs = [this.T.a, this.T.b, this.T.c];
      list.forEach((item, i) => this.drawShotInto(bufs[i], item, t, frameT));
      this.comp.bind(out, [0, 0, 0, 1]);
      list.forEach((item, i) => {
        this.comp.target(bufs[i], { opacity: item.opacity, mask: item.mask || null });
      });
      this.comp.done();
    }
    // overlays (captions etc.) in screen space
    this.comp.bind(out);
    for (const ov of this.film.overlays) {
      if (t >= ov.start && t < ov.end) {
        const R = this.renderCtx(out, M.id(), t - ov.start, t, null, ov.assets || (ov.assets = ov.paint ? ov.paint(this.paintCtx(ov)) : {}), null, frameT);
        ov.draw(R, t - ov.start, ov.assets);
      }
    }
    this.comp.done();
    return list;
  }

  motionSamples(t) {
    const dt = this.shutter / this.film.fps;
    const a = this.film.at(t - dt / 2), b = this.film.at(t + dt / 2);
    let maxPx = 0;
    const pts = [[160, 90], [960, 540], [1760, 90], [160, 990], [1760, 990]];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i].shot !== b[i].shot) continue;
      if ((a[i].opacity + b[i].opacity) < 0.1) continue;
      for (const [x, y] of pts) {
        // point that is at screen (x,y) under view A: where does the same world point go under view B?
        const w = M.apply(M.inv(a[i].view), x, y);
        const s = M.apply(b[i].view, w[0], w[1]);
        maxPx = Math.max(maxPx, Math.hypot(s[0] - x, s[1] - y) * this.S);
      }
    }
    let n = Math.ceil(maxPx / 5);
    for (const it of this.film.at(t)) {
      const sc = it.shot.scene;
      if (sc.blur) n = Math.max(n, sc.blur(it.lt));
    }
    return clamp(n, 1, this.maxShutterSamples);
  }

  renderFrame(t, { toCanvas = false, samples = null } = {}) {
    this.frameNo++;
    const N = samples ?? this.motionSamples(t);
    let final;
    let list;
    if (N <= 1) {
      list = this.composite(t, this.T.frame, t);
      final = this.T.frame;
    } else {
      const dt = this.shutter / this.film.fps;
      this.comp.bind(this.T.accum, [0, 0, 0, 0]);
      this.comp.done();
      for (let k = 0; k < N; k++) {
        const ts = t + ((k + 0.5) / N - 0.5) * dt;
        list = this.composite(ts, this.T.frame, t);
        this.comp.bind(this.T.accum);
        this.comp.target(this.T.frame, { opacity: 1 / N, blend: 'add' });
        this.comp.done();
      }
      final = this.T.accum;
    }
    // post settings: film-level + top-most scene
    let settings = {};
    for (const it of list) {
      const sc = it.shot.scene;
      if (sc.post) {
        const s = sc.post(it.lt);
        for (const k in s) {
          const v = s[k];
          if (typeof v === 'number' && typeof settings[k] === 'number') settings[k] = settings[k] + (v - settings[k]) * it.opacity;
          else if (Array.isArray(v) && Array.isArray(settings[k])) settings[k] = settings[k].map((x, j) => x + (v[j] - x) * it.opacity);
          else settings[k] = v;
        }
      }
    }
    if (this.film.postFn) Object.assign(settings, this.film.postFn(t, settings));
    const grainSeed = Math.floor(t * 12) % 997; // grain animates at 12 fps
    this.post.run(final, { toCanvas, grainSeed, settings });
    this.comp.done();
    // keep only what is needed soon
    const keep = new Set(this.film.shotsIn(t - 0.5, t + 1.0).map((s) => s.scene.id));
    if (this.autoRelease) this.release(keep);
    return { samples: N, scenes: list.map((x) => x.shot.id) };
  }
}
