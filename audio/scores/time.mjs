// TIME — original score (smooth jazz, real sampled instruments), composed against the picture.
// 96 BPM, 4/4 (bar = 2.5 s), 58 bars = 145 s. See docs/music_plan.md for the cue sheet.
// Key centre F major / D minor; the ending decays into the same A+E "singularity" tone that opens
// the film, so the soundtrack loops with the picture.
import { makeScore, BEAT } from './lib/builder.mjs';
import { comp, COMP, bassSmooth, bassTwo, bassWalk, brushes, smoothKit, swingKit, funkKit, fill, latinPerc, SW, chordAt } from './lib/patterns.mjs';
import { DRUMS, PERC, ccRamp, fall } from '../lib/music.mjs';
import { sections } from './time_sections.mjs';
import { sections2 } from './time_sections2.mjs';
import { sfxTracks } from './time_sfx.mjs';

export default function score() {
  const S = makeScore();
  const { T, feel, track } = S;

  // ------------------------------------------------------------------ instruments
  const I = {
    pad: track('pad', 'strings', { gain: -9, pan: 0, width: 1, reverb: 0.35, eq: [{ type: 'hp', freq: 120 }] }),
    rhodes: track('rhodes', 'rhodes', { gain: -4, pan: -0.18, width: 0.9, reverb: 0.2, chorus: 0.25, eq: [{ type: 'hp', freq: 90 }, { type: 'peak', freq: 350, gain: -2, q: 1 }] }),
    piano: track('piano', 'piano', { gain: -6, pan: -0.1, reverb: 0.26, eq: [{ type: 'hp', freq: 50 }] }),
    vibes: track('vibes', 'vibesMotor', { gain: -6, pan: 0.32, reverb: 0.34, eq: [{ type: 'hp', freq: 200 }] }),
    harp: track('harp', { sf: 'gm', bank: 0, program: 46 }, { gain: -9, pan: -0.3, reverb: 0.4 }),
    bass: track('bass', 'uprightBass', { gain: -2, pan: 0, reverb: 0.05, eq: [{ type: 'hp', freq: 32, order: 4 }], comp: { threshold: -20, ratio: 3, attack: 0.008, release: 0.12 } }),
    fretless: track('fretless', 'fretlessBass', { gain: -3, pan: 0, reverb: 0.06, eq: [{ type: 'hp', freq: 32, order: 4 }] }),
    sop: track('sop', 'sopranoSax', { gain: 0, pan: 0.05, reverb: 0.28, delay: 0.08, eq: [{ type: 'hp', freq: 180 }, { type: 'peak', freq: 3000, gain: 1, q: 0.9 }] }),
    alto: track('alto', 'altoSax', { gain: 0.5, pan: 0.05, reverb: 0.24, delay: 0.06, eq: [{ type: 'hp', freq: 140 }, { type: 'peak', freq: 2800, gain: 1.5, q: 0.9 }] }),
    tenor: track('tenor', 'tenorSax', { gain: -3, pan: 0.14, reverb: 0.24, eq: [{ type: 'hp', freq: 100 }] }),
    bari: track('bari', 'bariSax', { gain: -5, pan: -0.08, reverb: 0.18, eq: [{ type: 'hp', freq: 50 }] }),
    tpt: track('tpt', 'trumpet', { gain: -4, pan: 0.26, reverb: 0.24, eq: [{ type: 'hp', freq: 180 }] }),
    tptStac: track('tptStac', 'trumpetStac', { gain: -5, pan: 0.22, reverb: 0.2, eq: [{ type: 'hp', freq: 180 }] }),
    mute: track('mute', 'mutedTrumpet', { gain: -4, pan: 0.18, reverb: 0.3, eq: [{ type: 'hp', freq: 200 }] }),
    flugel: track('flugel', 'flugelhorn', { gain: -3, pan: 0.1, reverb: 0.3 }),
    tbn: track('tbn', 'trombone', { gain: -5, pan: -0.26, reverb: 0.22, eq: [{ type: 'hp', freq: 70 }] }),
    tbnStac: track('tbnStac', 'tromboneStac', { gain: -6, pan: -0.24, reverb: 0.2, eq: [{ type: 'hp', freq: 70 }] }),
    guitar: track('guitar', 'nylonGuitar', { gain: -7, pan: -0.35, reverb: 0.2 }),
    clav: track('clav', 'clav', { gain: -8, pan: 0.3, reverb: 0.1 }),
    timp: track('timp', { sf: 'gm', bank: 0, program: 47 }, { gain: -6, pan: 0, reverb: 0.3 }),
    kit: track('kit', 'jazzKit', { gain: -4, reverb: 0.1, eq: [{ type: 'hp', freq: 30 }], latency: { 36: 12, 44: 18 } }),
    brush: track('brush', 'brushKit', { gain: -5, reverb: 0.12, eq: [{ type: 'hp', freq: 30 }], latency: { 64: 40 } }),
    // measured sample latencies (onset→peak) — see audio/scores/perc_latency_test.mjs
    perc: track('perc', 'percussion', { gain: -10, pan: 0.3, width: 0.8, reverb: 0.15, latency: { 82: 88, 70: 135, 69: 50, 54: 58, 64: 12, 62: 10, 63: 10 } }),
    timb: track('timb', 'timbales', { gain: -10, pan: -0.3, reverb: 0.12 }),
  };

  sections(S, I);
  sections2(S, I);

  // Macro dynamics: a fader ride applied to every music track, shaped to the story (film seconds, dB).
  const DYN = [
    [0, -22], [2.3, -9], [2.5, 0], [4.2, -3], [6.0, -7], [8.6, -6], [9.6, -3], [10, -1], [12.5, -4], [15, -3],
    [19.8, -3], [22.5, -3.5], [27.3, -3], [29.8, -1], [30.6, -5], [35, -4], [43.5, -3], [44.5, -8], [47.3, -8], [49.9, -2], [50.2, -2], [51, -9],
    [52.5, -8], [57.3, -7], [60, -4], [65, -5], [68.6, -6], [69.9, -2], [70.2, 0], [72.5, -3], [77.3, -2], [77.6, 1], [78.6, -12],
    [82.3, -13], [83, -10], [85, -12], [87.5, -9], [92.3, -5], [95, -2], [97.3, -3], [98, -2], [102.3, -3], [103.2, -6], [104, -4.5], [107.5, -5],
    [111, -3], [112, -1], [117.4, 0], [122.3, -2], [123, -4], [127.5, -3], [129.9, 0], [130.2, 1], [135, 0], [138.5, -1], [139, -8],
    [141.2, -8], [142.4, -9], [145, -22],
  ];
  const gainAuto = DYN.map(([t, db], i) => ({ t, db, ramp: i > 0 }));
  // safety net: fold any note outside the instrument's playable range by octaves
  const RANGE = { vibes: [53, 89], bass: [28, 60], bari: [36, 69], tbn: [40, 72], tbnStac: [40, 72], tenor: [44, 76], alto: [49, 81], sop: [56, 87], tpt: [52, 84], tptStac: [52, 84], mute: [52, 82], flugel: [52, 82] };
  for (const [id, [lo, hi]] of Object.entries(RANGE)) {
    const tr = I[id];
    if (!tr) continue;
    for (const n of tr.notes) {
      const p0 = n.p;
      while (n.p < lo) n.p += 12;
      while (n.p > hi) n.p -= 12;
      if (n.p !== p0 && process.env.RANGE_LOG) console.log(`range fold ${id}: ${p0} -> ${n.p} at ${n.t.toFixed(2)}`);
    }
  }
  const music = S.build({ duration: 145 }).tracks.map((t) => ({ ...t, gainAuto }));
  const tracks = [...music, ...sfxTracks(S)];
  return {
    sampleRate: 48000,
    duration: 145,
    tempo: [{ t: 0, bpm: 96 }],
    tracks,
    mix: {
      fx: {
        reverb: { type: 'reverb', preset: 'hall', decay: 2.4, predelay: 0.026, return: 'music' },
        delay: { type: 'delay', time: BEAT * 0.75, feedback: 0.26, lp: 4200, hp: 400 },
      },
      buses: { music: { duck: { key: ['sfxBig'], depth: 5, threshold: -30, range: 8, attack: 0.01, release: 0.7 } }, sfx: { gain: -3 }, sfxBig: { gain: -2 } },
      master: {
        targetLUFS: -15, ceiling: -1,
        eq: [{ type: 'hp', freq: 26, order: 4 }, { type: 'peak', freq: 230, gain: -1.5, q: 0.8 }, { type: 'highshelf', freq: 5500, gain: 2.5 }],
        glue: { threshold: -16, ratio: 1.5, attack: 0.03, release: 0.25, knee: 6, detector: 'rms' },
      },
    },
  };
}
