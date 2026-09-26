// audio/lib/synth.mjs — render one score track through spessasynth_core (SF2/SF3/DLS) to a stereo float buffer.
//
// Track fields used here (all times in SECONDS):
//   sf: soundfont id or path ('gm' | 'gu' | 'ms' | 'fluid' | extra ids | path)
//   bank: 0..127 (GS variation bank / MSB), bankLSB: 0..127, program: 0..127, drums: bool (uses MIDI ch 10 kits)
//   notes: [{ t, d, p, v }]           p = MIDI pitch, v = velocity 1..127 (fractions rounded)
//   cc:    [{ t, n, v, ramp? }]        step events; ramp:true glides linearly from the previous value of that CC
//                                      CC91/CC93 are NOT sent to the synth (effects are off) — they become reverb/chorus
//                                      send automation in the mixer (value/127 × 1.0)
//   bend:  [{ t, v, curve? }]          v in -1..1 (× bendRange semitones). Linear glide from the previous point
//                                      unless curve:'step'. First point is a step.
//   bendRange: semitones (default 2, set via RPN 0)
//   programs: [{ t, program, bank? }]   optional mid-track program changes (e.g. sticks -> brushes kit)
//   transpose: semitones added to every note (default 0)
//   keymap: { inputPitch: outputPitch } remap (e.g. GM drum notes -> a kit's own key layout)
//   volume: initial CC7 (default 100), expression: initial CC11 (default 127), modWheel: initial CC1
//   release: extra seconds rendered after the score end? (no — stems are exactly score.duration long)
import { SpessaSynthProcessor, SpessaLog } from 'spessasynth_core';
import { loadSoundBank, presetBank, resolveSoundfontPath } from './soundfonts.mjs';

// keep spessasynth's warnings, but drop the benign voice-allocation chatter
{
  const w = SpessaLog.logFunctions.warn;
  SpessaLog.logFunctions.warn = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('Allocating')) return; w(...a); };
}

const ORDER = { program: 0, cc: 1, bend: 2, off: 3, on: 4 };

function buildEvents(track, sr, total, blockSize) {
  const ev = [];
  const ch = track.drums ? 9 : 0;
  const tr = track.transpose ?? 0;
  // --- notes (resolve same-pitch overlaps: end the older note when the pitch is re-struck)
  const byPitch = new Map();
  for (const n of track.notes ?? []) {
    if (!(n.d > 0) || !Number.isFinite(n.t)) continue;
    let p = Math.round(n.p + (track.drums ? 0 : tr));
    if (track.keymap && track.keymap[p] != null) p = track.keymap[p];
    if (p < 0 || p > 127) continue;
    const s = Math.max(0, Math.round(n.t * sr));
    const e = Math.max(s + 1, Math.round((n.t + n.d) * sr));
    const v = Math.max(1, Math.min(127, Math.round(n.v ?? 90)));
    if (s >= total) continue;
    if (!byPitch.has(p)) byPitch.set(p, []);
    byPitch.get(p).push({ s, e, v, p });
  }
  let noteCount = 0;
  for (const [p, list] of byPitch) {
    list.sort((a, b) => a.s - b.s);
    for (let i = 0; i < list.length; i++) {
      const cur = list[i], nxt = list[i + 1];
      let e = cur.e;
      if (nxt && nxt.s <= e) e = Math.max(cur.s + 1, nxt.s); // off lands just before the next on (ORDER off < on)
      ev.push({ s: cur.s, o: ORDER.on, k: 'on', p, v: cur.v });
      if (e < total) ev.push({ s: e, o: ORDER.off, k: 'off', p });
      noteCount++;
    }
  }
  // --- CCs (91/93 are captured as send automation, not sent to the synth)
  const ccs = [...(track.cc ?? [])].filter((c) => c && Number.isFinite(c.t)).sort((a, b) => a.t - b.t);
  const lastCC = new Map();
  const sendAuto = { reverb: [], chorus: [] };
  const rampStep = Math.max(blockSize, Math.round(0.004 * sr));
  for (const c of ccs) {
    const s = Math.max(0, Math.round(c.t * sr));
    const v = Math.max(0, Math.min(127, Math.round(c.v)));
    if (c.n === 91 || c.n === 93) {
      (c.n === 91 ? sendAuto.reverb : sendAuto.chorus).push({ t: c.t, v: v / 127, ramp: !!c.ramp });
      continue;
    }
    const prev = lastCC.get(c.n);
    if (c.ramp && prev) {
      for (let x = prev.s + rampStep; x < s; x += rampStep) {
        const a = (x - prev.s) / (s - prev.s);
        ev.push({ s: x, o: ORDER.cc, k: 'cc', n: c.n, v: Math.round(prev.v + a * (v - prev.v)) });
      }
    }
    ev.push({ s, o: ORDER.cc, k: 'cc', n: c.n, v });
    lastCC.set(c.n, { s, v });
  }
  // --- pitch bend (linear glides between points by default)
  const bends = [...(track.bend ?? [])].filter((b) => b && Number.isFinite(b.t)).sort((a, b) => a.t - b.t);
  const toWheel = (x) => Math.max(0, Math.min(16383, Math.round(8192 + Math.max(-1, Math.min(1, x)) * (x >= 0 ? 8191 : 8192))));
  let prevB = null;
  for (const b of bends) {
    const s = Math.max(0, Math.round(b.t * sr));
    const w = toWheel(b.v);
    if (prevB && b.curve !== 'step' && s > prevB.s) {
      let lastW = prevB.w;
      for (let x = prevB.s + blockSize; x < s; x += blockSize) {
        const a = (x - prevB.s) / (s - prevB.s);
        const wv = Math.round(prevB.w + a * (w - prevB.w));
        if (wv !== lastW) { ev.push({ s: x, o: ORDER.bend, k: 'bend', w: wv }); lastW = wv; }
      }
    }
    ev.push({ s, o: ORDER.bend, k: 'bend', w });
    prevB = { s, w };
  }
  // --- program changes
  for (const pc of track.programs ?? []) {
    ev.push({ s: Math.max(0, Math.round(pc.t * sr)), o: ORDER.program, k: 'program', program: pc.program, bank: pc.bank ?? track.bank ?? 0 });
  }
  ev.sort((a, b) => a.s - b.s || a.o - b.o);
  return { events: ev, channel: ch, noteCount, sendAuto };
}

function selectProgram(synth, ch, track, bank, program, warn) {
  if (track.drums) {
    synth.programChange(ch, program);
  } else {
    synth.controllerChange(ch, 0, bank ?? 0);
    synth.controllerChange(ch, 32, track.bankLSB ?? 0);
    synth.programChange(ch, program);
  }
  const p = synth.midiChannels[ch].preset;
  const got = p ? { bank: presetBank(p), program: p.program, name: p.name } : null;
  const wantBank = track.drums ? 128 : bank ?? 0;
  if (!got) warn(`track ${track.id}: no preset for bank ${wantBank} program ${program}`);
  else if (got.program !== program || got.bank !== wantBank) {
    warn(`track ${track.id}: requested ${wantBank}:${program}, synth selected ${got.bank}:${got.program} '${got.name}' (fallback)`);
  }
  return got;
}

/**
 * Render a synth track. Returns { channels:[L,R], info }.
 * opts: { sampleRate=48000, duration (s, required), blockSize=32, warn }
 */
export async function renderSynthTrack(track, opts = {}) {
  const sr = opts.sampleRate ?? 48000;
  const total = Math.round(opts.duration * sr);
  const blockSize = opts.blockSize ?? 32;
  const warnings = [];
  const warn = opts.warn ?? ((m) => { warnings.push(m); console.warn('  ! ' + m); });
  const sfId = track.sf ?? 'gm';
  const bank = loadSoundBank(sfId);
  const synth = new SpessaSynthProcessor(sr, { effectsEnabled: false, eventsEnabled: false, maxBufferSize: blockSize });
  synth.soundBankManager.addSoundBank(bank, 'main');
  await synth.processorInitialized;
  synth.setSystemParameter('interpolationType', 2); // hermite
  synth.setSystemParameter('autoAllocateVoices', true);
  synth.setSystemParameter('voiceCap', 512);

  const { events, channel: ch, noteCount, sendAuto } = buildEvents(track, sr, total, blockSize);
  const preset = selectProgram(synth, ch, track, track.bank ?? 0, track.program ?? 0, warn);

  // initial controllers
  synth.controllerChange(ch, 7, Math.round(track.volume ?? 100));
  synth.controllerChange(ch, 11, Math.round(track.expression ?? 127));
  if (track.modWheel != null) synth.controllerChange(ch, 1, Math.round(track.modWheel));
  const range = track.bendRange ?? 2;
  if (range !== 2) {
    synth.controllerChange(ch, 101, 0);
    synth.controllerChange(ch, 100, 0);
    synth.controllerChange(ch, 6, Math.max(0, Math.min(127, Math.round(range))));
    synth.controllerChange(ch, 38, 0);
    synth.controllerChange(ch, 101, 127);
    synth.controllerChange(ch, 100, 127);
  }

  const L = new Float32Array(total), R = new Float32Array(total);
  let pos = 0, ei = 0, maxVoices = 0;
  const t0 = performance.now();
  while (pos < total) {
    while (ei < events.length && events[ei].s <= pos) {
      const e = events[ei++];
      switch (e.k) {
        case 'on': synth.noteOn(ch, e.p, e.v); break;
        case 'off': synth.noteOff(ch, e.p); break;
        case 'cc': synth.controllerChange(ch, e.n, e.v); break;
        case 'bend': synth.pitchWheel(ch, e.w); break;
        case 'program': selectProgram(synth, ch, track, e.bank, e.program, warn); break;
      }
    }
    const next = ei < events.length ? events[ei].s : total;
    const n = Math.max(1, Math.min(blockSize, next - pos, total - pos));
    synth.process(L, R, pos, n);
    pos += n;
    if (synth.voiceCount > maxVoices) maxVoices = synth.voiceCount;
  }
  const ms = performance.now() - t0;
  let peak = 0, bad = 0;
  for (let i = 0; i < total; i++) {
    const a = L[i], b = R[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) { L[i] = 0; R[i] = 0; bad++; continue; }
    const m = Math.max(Math.abs(a), Math.abs(b));
    if (m > peak) peak = m;
  }
  if (bad) warn(`track ${track.id}: ${bad} non-finite samples zeroed`);
  // detach the shared (cached) sound bank first — destroySynthProcessor() would otherwise wipe its presets
  synth.soundBankManager.soundBankList.length = 0;
  synth.destroySynthProcessor();
  return {
    channels: [L, R],
    info: {
      sf: sfId,
      sfFile: resolveSoundfontPath(sfId),
      preset: preset?.name ?? null,
      presetBank: preset?.bank ?? null,
      presetProgram: preset?.program ?? null,
      notes: noteCount,
      maxVoices,
      renderMs: Math.round(ms),
      peak,
      sendAutomation: sendAuto,
      warnings,
    },
  };
}
