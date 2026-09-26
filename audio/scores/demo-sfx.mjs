// audio/scores/demo-sfx.mjs — the jazz demo plus SFX (procedural + sampled) with sidechain ducking of the music bus.
// Shows: type:'sfx' tracks (audio/lib/sfx.mjs generators), type:'sample' tracks (files / ids from assets/sfx/index.json),
//        buses.music.duck keyed by the sfx bus, and manual duck events.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import demo from './demo.mjs';

const SFX_INDEX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/sfx/index.json');

export default function demoSfx() {
  const score = demo();
  const beat = 60 / 96;
  const bar = (b) => b * 4 * beat;
  score.tracks.push({
    id: 'fx_proc', type: 'sfx', bus: 'sfx', gain: -6, reverb: 0.15,
    events: [
      { t: bar(4) - 3.2, fx: 'riser', params: { dur: 3.2, from: 300, to: 3000, noise: 0.4, seed: 3 }, gain: -8 },
      { t: bar(4) - 0.9, fx: 'whoosh', params: { dur: 1.1, from: 400, to: 6000, peak: 0.8, seed: 5 }, gain: -3 },
      { t: bar(8) - 0.02, fx: 'impact', params: { dur: 3, subHz: 50, drop: 0.6, noise: 0.6, tail: 1, seed: 9 }, gain: 0 },
      { t: bar(8) + 0.3, fx: 'shimmer', params: { dur: 3.5, root: 1760, sparkle: 0.6, seed: 2 }, gain: -10 },
      { t: 1.0, fx: 'tick', params: { type: 'clock', count: 6, interval: 1.0 }, gain: -12, pan: -0.3 },
    ],
  });
  // sampled SFX from the library, if present (ids from assets/sfx/index.json)
  if (fs.existsSync(SFX_INDEX)) {
    const idx = JSON.parse(fs.readFileSync(SFX_INDEX, 'utf8'));
    const pick = (cat, pred = () => true) => idx.find((e) => e.category === cat && pred(e));
    const waves = pick('ocean', (e) => e.loop) ?? pick('ocean');
    const boom = pick('impact', (e) => /explo|boom/i.test(e.id + e.description));
    const shutter = pick('shutter');
    const events = [];
    if (waves) events.push({ t: 0, src: waves.id, dur: bar(2), loop: true, gain: -14, fadeIn: 1.5, fadeOut: 2 });
    if (shutter) events.push({ t: bar(2) + 0.02, src: shutter.id, gain: -12, pan: 0.4 });
    if (boom) events.push({ t: bar(8), src: boom.id, gain: -10 });
    if (events.length) score.tracks.push({ id: 'fx_samples', type: 'sample', bus: 'sfx', gain: -4, reverb: 0.05, events });
  }
  score.mix = {
    ...score.mix,
    buses: {
      music: { duck: { key: ['sfx'], depth: 5, threshold: -34, range: 14, attack: 0.012, release: 0.45, hold: 0.06 } },
      sfx: { gain: 0 },
    },
  };
  return score;
}
