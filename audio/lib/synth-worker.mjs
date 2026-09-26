// Worker thread: renders one synth track per message and writes it as a float32 WAV stem.
import { parentPort } from 'node:worker_threads';
import { renderSynthTrack } from './synth.mjs';
import { renderSfzTrack } from './sfz.mjs';
import { writeWav } from './wav.mjs';

parentPort.on('message', async (msg) => {
  const warnings = [];
  try {
    const { track, sampleRate, duration, file, blockSize } = msg;
    const render = track.sfz ? renderSfzTrack : renderSynthTrack;
    const r = await render(track, { sampleRate, duration, blockSize, warn: (m) => warnings.push(m) });
    writeWav(file, r.channels, sampleRate, 32);
    parentPort.postMessage({ ok: true, id: track.id, info: { ...r.info, warnings } });
  } catch (e) {
    parentPort.postMessage({ ok: false, id: msg.track?.id, error: String(e?.stack || e), warnings });
  }
});
