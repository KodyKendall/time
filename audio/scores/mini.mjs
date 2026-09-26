// audio/scores/mini.mjs — minimal score example (see audio/render.mjs for the CLI)
import { midi, chord } from '../lib/music.mjs';
import { inst } from '../lib/instruments.mjs';

export default {
  sampleRate: 48000, duration: 6, tempo: [{ t: 0, bpm: 96 }],
  tracks: [
    { id: 'keys', ...inst('rhodes'), notes: chord('Dbmaj9', { voicing: 'rootlessA' }).map((p) => ({ t: 0, d: 4, p, v: 80 })), reverb: 0.2 },
    { id: 'sax', ...inst('altoSax'), notes: [{ t: 0.5, d: 2, p: midi('F5'), v: 96 }],
      bend: [{ t: 0.5, v: -0.4 }, { t: 0.62, v: 0 }], cc: [{ t: 0.5, n: 11, v: 90 }, { t: 1.5, n: 11, v: 127, ramp: true }], gain: 2, reverb: 0.25 },
    { id: 'hit', type: 'sfx', events: [{ t: 0, fx: 'impact', params: { dur: 3 } }], gain: -6 },
  ],
  mix: {
    fx: { reverb: { type: 'reverb', preset: 'hall', decay: 2.2, return: 'music' } },
    buses: { music: { duck: { key: ['sfx'], depth: 5 } } },
    master: { targetLUFS: -14, ceiling: -1 },
  },
};
