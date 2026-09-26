// audio/lib/mixer.mjs — mix(stems, busConfig) -> { master:[L,R], sampleRate, report }
//
// stems: array from renderScore() (or your own): { id, file | channels:[L,R], type, bus='music'|'sfx'|...,
//        gain (dB), pan (-1..1, pans the mid), width (0..2, M/S), reverb/chorus/delay (0..1 linear post-fader sends),
//        sends:{ fxName: level }, eq:[bands], comp:{...compress opts}, gainAuto:[{t, db, ramp?}], mute, solo,
//        sendAutomation:{ reverb:[{t,v,ramp}], chorus:[...] } (from CC91/CC93) }
//
// busConfig (all optional):
// {
//   tracks: { [id]: { ...overrides of the stem mix fields } },
//   buses:  { music: { gain, eq, comp, width, duck:{ key:['sfx' | trackId ...], depth:6, threshold:-36, range:12,
//                                                     attack:0.015, release:0.4, hold:0.08, events:[{t,dur,depth}] } },
//             sfx: { ... } },
//   fx: { reverb: { type:'reverb', preset:'hall', decay, predelay, ..., return:'music', gain:0, eq:[] },
//         chorus: { type:'chorus', return:'music' }, delay: { type:'delay', time:0.46875, feedback:0.3 } , plate: {...} },
//   stemLUFS: -24   (default) every stem is first normalised to this integrated loudness (gated, i.e. while playing),
//                   so track `gain` is relative to a common reference regardless of source; null disables.
//   master: { eq:[{type:'hp',freq:22,order:4}], prenormLUFS:-20 (gain-stage before glue),
//             glue:{ threshold:-20, ratio:2, attack:0.02, release:0.2, knee:6, detector:'rms' } | false,
//             targetLUFS:-14, ceiling:-1 (dBTP), limiter:{ lookahead:0.003, release:0.08 }, fadeIn:0, fadeOut:0,
//             saturate:0 (dB drive, optional), normalize:true }
// }
// Signal flow per track: load -> normalise to stemLUFS -> EQ -> comp -> gain (+gainAuto) -> width/pan -> sends (post-fader)
//   -> bus.  FX returns -> their `return` bus.  Buses: EQ -> comp -> duck (keyed by raw bus/track sums) -> gain -> master.
// Master: EQ -> pre-normalise -> glue comp -> fades -> [gain -> true-peak limiter] iterated to hit targetLUFS.
import { readWav } from './wav.mjs';
import { applyEQ, dbToGain, gainToDb, peakAbs } from './dsp.mjs';
import { compress, duck, limit } from './dynamics.mjs';
import { reverb, chorus, delay } from './fx.mjs';
import { measureLoudness, integratedLoudness } from './loudness.mjs';
import { stats as levelStats } from './analyze.mjs';

export const DEFAULT_BUS_CONFIG = {
  buses: {
    music: { gain: 0 },
    sfx: { gain: 0 },
  },
  fx: {
    reverb: { type: 'reverb', preset: 'hall', return: 'music', gain: 0 },
    chorus: { type: 'chorus', return: 'music', gain: 0 },
    delay: { type: 'delay', time: 0.3125, feedback: 0.3, return: 'music', gain: 0 },
  },
  master: {
    eq: [{ type: 'hp', freq: 22, order: 4 }],
    prenormLUFS: -20,
    glue: { threshold: -20, ratio: 2, attack: 0.02, release: 0.2, knee: 6, detector: 'rms', rmsTime: 0.01 },
    targetLUFS: -14,
    ceiling: -1,
    limiter: { lookahead: 0.003, release: 0.08 },
    fadeIn: 0,
    fadeOut: 0,
    normalize: true,
  },
};

function mergeConfig(user = {}) {
  const d = DEFAULT_BUS_CONFIG;
  return {
    tracks: { ...(user.tracks ?? {}) },
    buses: { ...d.buses, ...(user.buses ?? {}) },
    fx: { ...d.fx, ...(user.fx ?? {}) },
    master: { ...d.master, ...(user.master ?? {}), limiter: { ...d.master.limiter, ...(user.master?.limiter ?? {}) },
      glue: user.master?.glue === false ? false : { ...d.master.glue, ...(user.master?.glue ?? {}) } },
    sampleRate: user.sampleRate,
    stemLUFS: user.stemLUFS === undefined ? -24 : user.stemLUFS,
  };
}

// Piecewise automation curve evaluated per sample. points: [{t, v, ramp?}] — step unless ramp:true (linear from previous).
export function automationCurve(points, n, sr, initial, map = (x) => x) {
  const out = new Float32Array(n).fill(map(initial));
  if (!points || !points.length) return out;
  const pts = [...points].sort((a, b) => a.t - b.t);
  let prevV = initial, prevS = 0;
  for (let k = 0; k < pts.length; k++) {
    const s = Math.max(0, Math.min(n, Math.round(pts[k].t * sr)));
    const v = pts[k].v;
    if (pts[k].ramp && s > prevS) {
      for (let i = prevS; i < s; i++) out[i] = map(prevV + ((i - prevS) / (s - prevS)) * (v - prevV));
    }
    const nextS = k + 1 < pts.length ? Math.max(0, Math.min(n, Math.round(pts[k + 1].t * sr))) : n;
    const mv = map(v);
    for (let i = s; i < nextS; i++) out[i] = mv;
    prevV = v; prevS = s;
  }
  return out;
}

function loadStem(stem) {
  if (stem.channels) return stem.channels.length >= 2 ? stem.channels : [stem.channels[0], Float32Array.from(stem.channels[0])];
  const w = readWav(stem.file);
  return w.channels.length >= 2 ? w.channels : [w.channels[0], Float32Array.from(w.channels[0])];
}

function applyWidthPan(ch, width = 1, pan = 0) {
  if (width === 1 && pan === 0) return ch;
  const [L, R] = ch;
  const th = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  const gl = Math.cos(th) * Math.SQRT2, gr = Math.sin(th) * Math.SQRT2;
  for (let i = 0; i < L.length; i++) {
    const m = 0.5 * (L[i] + R[i]), s = 0.5 * (L[i] - R[i]) * width;
    L[i] = m * gl + s;
    R[i] = m * gr - s;
  }
  return ch;
}

function addScaled(dst, src, g, curve) {
  for (let c = 0; c < 2; c++) {
    const d = dst[c], s = src[c];
    if (curve) for (let i = 0; i < d.length; i++) d[i] += s[i] * curve[i] * g;
    else if (g !== 0) for (let i = 0; i < d.length; i++) d[i] += s[i] * g;
  }
}

/**
 * Mix stems into a mastered stereo buffer.
 * Returns { master:[L,R], sampleRate, report:{ tracks:{}, buses:{}, fx:{}, master:{ lufs, truePeak, samplePeak, lra, glueGR, limiterGR, gainApplied } } }
 */
export async function mix(stems, busConfig = {}, opts = {}) {
  const cfg = mergeConfig(busConfig);
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);
  const sr = cfg.sampleRate ?? opts.sampleRate ?? 48000;
  const report = { tracks: {}, buses: {}, fx: {}, master: {} };
  const anySolo = stems.some((s) => (cfg.tracks[s.id]?.solo ?? s.solo));

  // length = longest stem
  let n = 0;
  const loaded = [];
  for (const stem0 of stems) {
    const stem = { ...stem0, ...(cfg.tracks[stem0.id] ?? {}) };
    if (stem.mute || (anySolo && !stem.solo)) { report.tracks[stem.id] = { muted: true }; continue; }
    loaded.push(stem);
  }
  const busSums = new Map();
  const fxInputs = new Map();
  const trackPost = new Map(); // post-fader signals kept only if some duck key references a track id
  const keyIds = new Set();
  for (const b of Object.values(cfg.buses)) for (const k of [].concat(b?.duck?.key ?? [])) keyIds.add(k);

  for (const stem of loaded) {
    const ch = loadStem(stem).map((c) => Float32Array.from(c));
    if (!n) n = ch[0].length;
    if (ch[0].length !== n) {
      // pad / trim to the first stem's length
      for (let c = 0; c < 2; c++) { const a = new Float32Array(n); a.set(ch[c].subarray(0, n)); ch[c] = a; }
    }
    if (stem.polarity === -1) for (const c of ch) for (let i = 0; i < n; i++) c[i] = -c[i];
    // loudness normalisation of the raw stem (so `gain` is relative to cfg.stemLUFS)
    let normDb = 0;
    if (cfg.stemLUFS != null && stem.normalize !== false) {
      let l = stem.stats?.lufs;
      if (!Number.isFinite(l)) l = integratedLoudness(ch, sr);
      if (Number.isFinite(l)) normDb = Math.max(-40, Math.min(40, cfg.stemLUFS - l));
      if (normDb !== 0) { const k = dbToGain(normDb); for (const c of ch) for (let i = 0; i < n; i++) c[i] *= k; }
    }
    if (stem.eq?.length) applyEQ(ch, stem.eq, sr);
    let compGR = 0;
    if (stem.comp) { const r = compress(ch, sr, { ...stem.comp, inPlace: true }); compGR = r.maxGR; }
    const g = dbToGain(stem.gain ?? 0);
    const gCurve = stem.gainAuto?.length ? automationCurve(stem.gainAuto.map((p) => ({ t: p.t, v: p.db, ramp: p.ramp })), n, sr, 0, dbToGain) : null;
    for (const c of ch) {
      if (gCurve) for (let i = 0; i < n; i++) c[i] *= g * gCurve[i];
      else if (g !== 1) for (let i = 0; i < n; i++) c[i] *= g;
    }
    applyWidthPan(ch, stem.width ?? 1, stem.pan ?? 0);
    // sends (post-fader)
    const sends = { ...(stem.sends ?? {}) };
    if (stem.reverb != null && sends.reverb == null) sends.reverb = stem.reverb;
    if (stem.chorus != null && sends.chorus == null) sends.chorus = stem.chorus;
    if (stem.delay != null && sends.delay == null) sends.delay = stem.delay;
    for (const [fxName, level] of Object.entries(sends)) {
      const auto = stem.sendAutomation?.[fxName];
      if (!(level > 0) && !(auto && auto.length)) continue;
      if (!cfg.fx[fxName]) { console.warn(`  ! track ${stem.id}: send to unknown fx '${fxName}'`); continue; }
      if (!fxInputs.has(fxName)) fxInputs.set(fxName, [new Float32Array(n), new Float32Array(n)]);
      const curve = auto?.length ? automationCurve(auto, n, sr, level ?? 0) : null;
      addScaled(fxInputs.get(fxName), ch, curve ? 1 : level, curve);
    }
    const bus = stem.bus ?? 'music';
    if (!busSums.has(bus)) busSums.set(bus, [new Float32Array(n), new Float32Array(n)]);
    addScaled(busSums.get(bus), ch, 1);
    if (keyIds.has(stem.id)) trackPost.set(stem.id, ch);
    const st = levelStats(ch, sr, { loudness: false, bands: false });
    report.tracks[stem.id] = { bus, normDb: +normDb.toFixed(2), gain: stem.gain ?? 0, peakDb: st.peakDb, rmsDb: st.rmsDb, activeRmsDb: st.activeRmsDb, compGR: +compGR.toFixed(2) };
  }
  if (!n) throw new Error('mix: no audible stems');

  // FX returns
  for (const [fxName, input] of fxInputs) {
    const fx = cfg.fx[fxName];
    const type = fx.type ?? fxName;
    let wet;
    const t0 = performance.now();
    if (type === 'reverb') wet = reverb(input, sr, fx);
    else if (type === 'chorus') wet = chorus(input, sr, fx);
    else if (type === 'delay') wet = delay(input, sr, fx);
    else throw new Error(`unknown fx type '${type}'`);
    if (fx.eq?.length && type !== 'reverb') applyEQ(wet, fx.eq, sr);
    const ret = fx.return ?? 'music';
    if (!busSums.has(ret)) busSums.set(ret, [new Float32Array(n), new Float32Array(n)]);
    addScaled(busSums.get(ret), wet, dbToGain(fx.gain ?? 0));
    report.fx[fxName] = { type, return: ret, ms: Math.round(performance.now() - t0), peakDb: +gainToDb(peakAbs(wet)).toFixed(2) };
  }

  // Buses (keys for ducking use the raw bus sums / track post-fader signals, captured before bus processing)
  const rawSums = new Map([...busSums].map(([k, v]) => [k, v.map((c) => Float32Array.from(c))]));
  const master = [new Float32Array(n), new Float32Array(n)];
  for (const [name, ch] of busSums) {
    const b = cfg.buses[name] ?? {};
    const r = { };
    if (b.eq?.length) applyEQ(ch, b.eq, sr);
    if (b.comp) r.compGR = +compress(ch, sr, { ...b.comp, inPlace: true }).maxGR.toFixed(2);
    if (b.duck) {
      const keys = [].concat(b.duck.key ?? []);
      let key = null;
      for (const k of keys) {
        const src = rawSums.get(k) ?? trackPost.get(k);
        if (!src) { console.warn(`  ! bus ${name}: duck key '${k}' not found`); continue; }
        if (!key) key = [new Float32Array(n), new Float32Array(n)];
        addScaled(key, src, 1);
      }
      if (key || b.duck.events?.length) r.duckGR = +duck(ch, sr, { ...b.duck, key, inPlace: true }).maxGR.toFixed(2);
    }
    if (b.width != null && b.width !== 1) applyWidthPan(ch, b.width, 0);
    const g = dbToGain(b.gain ?? 0);
    addScaled(master, ch, g);
    const st = levelStats(ch, sr, { loudness: false, bands: false });
    report.buses[name] = { ...r, peakDb: st.peakDb, rmsDb: st.rmsDb };
  }

  // Master chain
  const m = cfg.master;
  if (m.eq?.length) applyEQ(master, m.eq, sr);
  const preLufs = integratedLoudness(master, sr);
  report.master.preLUFS = +preLufs.toFixed(2);
  let gainApplied = 0;
  if (m.normalize !== false && Number.isFinite(preLufs)) {
    const pre = (m.prenormLUFS ?? -20) - preLufs;
    for (const c of master) for (let i = 0; i < n; i++) c[i] *= dbToGain(pre);
    gainApplied += pre;
  }
  if (m.glue) {
    const r = compress(master, sr, { ...m.glue, inPlace: true });
    report.master.glueGR = +r.maxGR.toFixed(2);
    report.master.glueAvgGR = +r.avgGR.toFixed(2);
  }
  if (m.saturate) {
    const { saturate } = await import('./dynamics.mjs');
    saturate(master, m.saturate);
  }
  // fades
  const fi = Math.round((m.fadeIn ?? 0) * sr), fo = Math.round((m.fadeOut ?? 0) * sr);
  for (const c of master) {
    for (let i = 0; i < fi && i < n; i++) c[i] *= i / fi;
    for (let i = 0; i < fo && i < n; i++) c[n - 1 - i] *= Math.pow(i / fo, 1.5);
  }
  // loudness target + true-peak limiting, iterated so the limiter's loudness loss is compensated
  let out = master;
  if (m.normalize !== false && m.targetLUFS != null) {
    const base = master.map((c) => Float32Array.from(c));
    let g = m.targetLUFS - integratedLoudness(base, sr);
    let lim;
    for (let iter = 0; iter < 4; iter++) {
      const x = base.map((c) => { const a = new Float32Array(n); const k = dbToGain(g); for (let i = 0; i < n; i++) a[i] = c[i] * k; return a; });
      lim = limit(x, sr, { ceiling: m.ceiling ?? -1, ...m.limiter });
      const l = integratedLoudness(lim.channels, sr);
      const err = m.targetLUFS - l;
      out = lim.channels;
      if (Math.abs(err) < 0.05) break;
      g += err;
    }
    gainApplied += g;
    report.master.limiterGR = +lim.maxGR.toFixed(2);
    let sum = 0, cnt = 0;
    for (let i = 0; i < n; i++) if (lim.gain[i] < 0.999) { sum += 20 * Math.log10(lim.gain[i]); cnt++; }
    report.master.limiterActivePct = +((100 * cnt) / n).toFixed(2);
    report.master.limiterAvgGRWhenActive = cnt ? +(sum / cnt).toFixed(2) : 0;
    // limiter gain-reduction timeline: max GR (dB) per 0.25 s window, for mix balancing
    const win = Math.round(sr * 0.25), tl = [];
    for (let i0 = 0; i0 < n; i0 += win) {
      let mn = 1;
      for (let i = i0; i < Math.min(n, i0 + win); i++) if (lim.gain[i] < mn) mn = lim.gain[i];
      tl.push(+(20 * Math.log10(mn)).toFixed(2));
    }
    report.master.limiterTimeline = { step: 0.25, grDb: tl };
  } else if (m.ceiling != null) {
    const lim = limit(master, sr, { ceiling: m.ceiling, ...m.limiter });
    out = lim.channels;
    report.master.limiterGR = +lim.maxGR.toFixed(2);
  }
  report.master.gainApplied = +gainApplied.toFixed(2);
  const L = measureLoudness(out, sr);
  Object.assign(report.master, {
    lufs: +L.integrated.toFixed(2),
    truePeak: +L.truePeak.toFixed(2),
    samplePeak: +L.samplePeak.toFixed(2),
    lra: +L.lra.toFixed(2),
    shortTermMax: +L.shortTermMax.toFixed(2),
    momentaryMax: +L.momentaryMax.toFixed(2),
    duration: +(n / sr).toFixed(3),
  });
  report.master.bands = levelStats(out, sr, { loudness: false }).bands;
  log(`  master: ${report.master.lufs} LUFS, TP ${report.master.truePeak} dBTP, LRA ${report.master.lra} LU, limiter max GR ${report.master.limiterGR} dB`);
  return { master: out, sampleRate: sr, report };
}
