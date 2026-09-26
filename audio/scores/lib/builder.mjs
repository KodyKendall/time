// Score-building DSL for the TIME soundtrack.
// Times: bar (0-based) + beat (0..4) at 96 BPM; everything is converted to seconds for renderScore.
import { midi as N, chord as mchord, tempoMap, swing, humanizer, scoop, fall, doit, vibrato, ccRamp } from '../../lib/music.mjs';
import { inst } from '../../lib/instruments.mjs';

export const BPM = 96;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
const tm = tempoMap([{ beat: 0, bpm: BPM }]);

export function makeScore() {
  const tracks = new Map();
  let humSeed = 100;

  // swing feel per bar range: 'straight' | 's16' (light 16th swing) | 's8' (8th swing)
  const feelMap = [];
  const feel = (bar0, bar1, kind) => feelMap.push({ bar0, bar1, kind });
  const feelAt = (bar) => {
    for (let i = feelMap.length - 1; i >= 0; i--) if (bar >= feelMap[i].bar0 && bar < feelMap[i].bar1) return feelMap[i].kind;
    return 's16';
  };
  // time of (bar, beat) in seconds, with the bar's swing feel applied
  const T = (bar, beat = 0, sw = true) => {
    const b = Math.floor(beat / 4);
    bar += b;
    beat -= b * 4;
    const k = sw ? feelAt(bar) : 'straight';
    const bb = k === 's16' ? swing(beat, 0.56, 0.25) : k === 's8' ? swing(beat, 0.64, 0.5) : beat;
    return tm.beat(bar * 4 + bb);
  };

  function track(id, instName, opts = {}) {
    const hum = humanizer(humSeed++, { time: opts.humTime ?? 0.006, vel: opts.humVel ?? 6 });
    const t = {
      id, notes: [], cc: [], bend: [], programs: [], ...(typeof instName === 'string' ? inst(instName) : instName), ...opts,
      hum,
      // note at bar/beat, duration in beats
      n(bar, beat, dur, p, v = 90, o = {}) {
        const t0 = T(bar, beat, o.swing !== false);
        const t1 = T(bar, beat + dur, o.swing !== false);
        const midiP = N(p);
        // per-key sample latency compensation (ms): shaker/maracas samples hit ~50–130 ms after their start
        const lat = (this.latency && this.latency[midiP]) ? this.latency[midiP] / 1000 : 0;
        let note = { t: t0 + (o.offset ?? 0) - lat, d: Math.max(0.02, (t1 - t0) * (o.legato ?? 0.95)), p: midiP, v };
        if (o.hum !== false) note = hum(note);
        this.notes.push(note);
        return note;
      },
      // note at absolute seconds
      ns(t0, d, p, v = 90) {
        this.notes.push({ t: t0, d, p: N(p), v });
      },
      // chord hit (array of pitches or symbol)
      ch(bar, beat, dur, pitches, v = 80, o = {}) {
        const ps = Array.isArray(pitches) ? pitches.map(N) : mchord(pitches, { voicing: o.voicing ?? 'rootlessA', center: o.center ?? 62 });
        ps.forEach((p, i) => this.n(bar, beat, dur, p, v - (o.topAccent && i === ps.length - 1 ? -6 : 0), { ...o, offset: (o.roll ?? 0.006) * i }));
        return ps;
      },
      // melody from a list [[bar, beat, durBeats, note, vel, flags]] ; flags: 's' scoop, 'f' fall, 'v' vibrato, 'd' doit
      mel(list, o = {}) {
        for (const [bar, beat, dur, p, v = 90, fl = ''] of list) {
          if (p === null || p === 'r') continue;
          const note = this.n(bar, beat, dur, p, v, { legato: o.legato ?? 0.97, hum: o.hum });
          const t0 = note.t, d = note.d;
          if (fl.includes('s')) this.bend.push(...scoop(t0 - 0.004, { depth: o.scoopDepth ?? -0.45, dur: 0.1 }));
          if (fl.includes('v') || (o.autoVib && dur >= 1.5)) this.bend.push(...vibrato(t0 + 0.1, t0 + d - 0.04, { depth: o.vibDepth ?? 0.07, rate: 5.2, delay: 0.28 }), { t: t0 + d, v: 0, curve: 'step' });
          if (fl.includes('f')) this.bend.push(...fall(t0 + d - Math.min(0.32, d * 0.5), { depth: -1, dur: Math.min(0.3, d * 0.45) }));
          if (fl.includes('d')) this.bend.push(...doit(t0 + d - 0.2, { depth: 1, dur: 0.18 }));
        }
      },
      cc1(n, bar, beat, v) { this.cc.push({ t: T(bar, beat, false), n, v }); },
      ramp(n, bar0, beat0, bar1, beat1, v0, v1) { this.cc.push(...ccRamp(n, T(bar0, beat0, false), T(bar1, beat1, false), v0, v1)); },
      rampS(n, t0, t1, v0, v1) { this.cc.push(...ccRamp(n, t0, t1, v0, v1)); },
    };
    tracks.set(id, t);
    return t;
  }

  function build({ duration, mix }) {
    const out = [];
    for (const t of tracks.values()) {
      const { hum, n, ns, ch, mel, cc1, ramp, rampS, latency, ...plain } = t;
      if (!plain.notes.length && plain.type !== 'sfx' && plain.type !== 'sample') continue;
      plain.notes.sort((a, b) => a.t - b.t);
      plain.cc.sort((a, b) => a.t - b.t);
      plain.bend.sort((a, b) => a.t - b.t);
      if (!plain.programs.length) delete plain.programs;
      out.push(plain);
    }
    return { sampleRate: 48000, duration, tempo: tm.scoreTempo(), tracks: out, mix };
  }

  return { T, feel, track, tracks, build, N, mchord, BEAT, BAR };
}

export { N, mchord };
