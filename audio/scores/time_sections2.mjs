// TIME score — acts II and III (bars 14–57). Cue times from the segment cue lists (film seconds).
import { comp, COMP, bassSmooth, bassTwo, bassWalk, brushes, smoothKit, swingKit, funkKit, fill, latinPerc, SW, chordAt, spans, bassNote } from './lib/patterns.mjs';
import { DRUMS, PERC, fall, doit, ccRamp } from '../lib/music.mjs';
import { mchord } from './lib/builder.mjs';
import { THEME_CHANGES, THEME_MEL, shiftChanges, shiftMel } from './time_sections.mjs';

const WB = { hi: PERC.woodblockHi, lo: PERC.woodblockLo };

// ================================================================================================
// EARTH (bars 14–20, 35–52.5): planets & molten Earth groove → ocean + Moon → plunge
// ================================================================================================
function earth(S, I) {
  S.feel(12, 21, 's16');
  // bars 12–13 (30–35 s): the dive resolves into the Sun (Fmaj9); the disk forms; the groove wakes up
  const sun = [[12, 0, 'Fmaj9'], [13, 0, 'Bbmaj7#11'], [13, 2, 'C13sus']];
  I.sop.mel([[12, 0, 2.5, 'F5', 92, 's'], [12, 2.5, 0.5, 'E5', 76], [12, 3, 1, 'C5', 80]], { autoVib: true });
  I.sop.cc.push(...ccRamp(11, S.T(12, 0), S.T(12, 3), 112, 88));
  I.kit.n(12, 0, 2, DRUMS.crash, 76);
  ['A5', 'C6', 'E6', 'G5'].forEach((p, i) => I.vibes.n(12, i * 0.08, 3, p, 72, { swing: false }));
  comp(I.rhodes, sun, 12, 13, { cell: COMP.pad, center: 60 });
  comp(I.rhodes, sun, 13, 14, { cell: COMP.smooth, center: 60, vel: -4 });
  bassTwo(I.fretless, sun, 12, 13, { ref: 38, vel: -4 });
  bassSmooth(I.fretless, sun, 13, 14, { ref: 38, vel: -4 });
  I.pad.ch(12, 0, 4, ['F2', 'C3', 'E3', 'G3', 'A3'], 72, { legato: 1 });
  I.pad.ch(13, 0, 2, ['Bb2', 'F3', 'A3', 'D4', 'E4'], 68, { legato: 1 });
  I.pad.ch(13, 2, 2, ['C3', 'Bb3', 'F4', 'A4'], 70, { legato: 1 });
  I.pad.ramp(11, 12, 0, 13, 0, 110, 70);
  smoothKit(I.kit, 13, 14, { vel: -20, ride: false, rim: true, kickPat: [0, 2.5] });
  // 32.5 the disk forms: a harp shimmer spirals up
  ['F4', 'A4', 'C5', 'E5', 'G5', 'A5', 'C6', 'E6'].forEach((p, i) => I.harp.n(13, i * 0.18, 1.5, p, 62 + i * 3, { hum: false }));
  const ch = [[14, 0, 'Dm9'], [15, 0, 'G13'], [16, 0, 'Bbmaj9'], [17, 0, 'A7alt'], [18, 0, 'Bbmaj7#11'], [18, 2, 'Am7'], [19, 0, 'Gm9'], [19, 2, 'C13sus'], [20, 0, 'Dm9']];
  comp(I.rhodes, ch, 14, 18, { cell: COMP.smooth, center: 60 });
  bassSmooth(I.fretless, ch, 14, 18, { ref: 38 });
  smoothKit(I.kit, 14, 18, { vel: -10, ride: false, rim: true, kickPat: [0, 1.75, 2.5] });
  latinPerc(I.perc, 14, 18, { vel: -14, congas: false });
  // Theme B on alto (the Earth groove)
  I.alto.mel([
    [14, 0.5, 0.5, 'A4', 84], [14, 1, 0.5, 'C5', 86], [14, 1.5, 0.5, 'D5', 88], [14, 2, 1, 'E5', 92, 's'], [14, 3, 0.5, 'F5', 88], [14, 3.5, 0.5, 'E5', 84],
    [15, 0, 1.5, 'D5', 90], [15, 1.5, 0.5, 'B4', 82], [15, 2, 1, 'E5', 88], [15, 3, 0.75, 'F5', 86], [15, 3.75, 0.25, 'E5', 80],
    [16, 0, 1, 'D5', 90], [16, 1, 0.5, 'C5', 84], [16, 1.5, 0.5, 'A4', 82], [16, 2, 1.5, 'F5', 94, 'sv'], [16, 3.5, 0.5, 'G5', 88],
    [17, 0, 1, 'A5', 96], [17, 1, 0.5, 'G5', 86], [17, 1.5, 0.5, 'F5', 84], [17, 2, 1, 'Eb5', 88], [17, 3, 1, 'C#5', 86, 'f'],
  ], { autoVib: true });
  I.alto.cc.push({ t: S.T(14, 0), n: 11, v: 108 }, ...ccRamp(11, S.T(16, 2), S.T(17, 0), 104, 124), ...ccRamp(11, S.T(17, 2), S.T(18, 0), 120, 90));
  // 37.5 a planet is born: a bright flash — splash + vibe glint
  I.kit.n(15, 0, 1.5, DRUMS.splash, 84);
  ['E6', 'B5', 'G6'].forEach((p, i) => I.vibes.n(15, i * 0.06, 1.6, p, 76 - i * 6, { swing: false }));
  // meteor strikes (38.75, 39.375) and the big impact (40.0): toms + timpani, the last with a crash
  for (const [b, bt, v] of [[15, 2, 100], [15, 3, 106], [16, 0, 122]]) { I.kit.n(b, bt, 0.3, DRUMS.tomLowFloor, v); I.timp.n(b, bt, 1, 'D2', v - 14); }
  I.kit.n(16, 0, 2.5, DRUMS.crash, 108);
  // lightning over the cooling world (41.875, 42.5, 43.125): low brass stabs on the A7alt storm
  for (const [b, bt] of [[16, 3], [17, 0], [17, 1]]) { I.tbnStac.n(b, bt, 0.35, 'A2', 100); I.tbnStac.n(b, bt, 0.35, 'G3', 96); I.timp.n(b, bt, 0.8, 'A1', 84); }
  // Moon rises (45.0): dreamy flugelhorn over brushes
  comp(I.rhodes, ch, 18, 20, { cell: COMP.pad, center: 62, vel: -6 });
  bassTwo(I.fretless, ch, 18, 20, { ref: 38, vel: -8 });
  brushes(I.brush, 18, 20, { vel: -12 });
  I.flugel.mel([[18, 0, 2, 'D5', 86, 'v'], [18, 2, 1, 'C5', 80], [18, 3, 1, 'E5', 84], [19, 0, 1.5, 'F5', 90, 'v'], [19, 1.5, 0.5, 'E5', 80], [19, 2, 2, 'D5', 84, 'v']]);
  I.pad.ch(18, 0, 2, ['Bb2', 'F3', 'A3', 'D4', 'E4'], 64, { legato: 1 });
  I.pad.ch(18, 2, 2, ['A2', 'E3', 'G3', 'C4'], 62, { legato: 1 });
  I.pad.ch(19, 0, 2, ['G2', 'D3', 'F3', 'Bb3', 'A4'], 64, { legato: 1 });
  I.pad.ch(19, 2, 2, ['C3', 'Bb3', 'F4', 'A4'], 66, { legato: 1 });
  I.pad.ramp(11, 19, 0, 20, 0, 60, 110); // wave crest swell (47.5 → 50)
  for (let i = 0; i < 16; i++) I.kit.n(19, i * 0.25, 0.2, DRUMS.ride, 24 + i * 5, { hum: false });
  // 50.0 plunge: crash, then underwater — vibes, pad, bass drone
  I.kit.n(20, 0, 3, DRUMS.crash, 104);
  I.bass.n(20, 0, 3.9, 'D1', 96);
  ['D5', 'A5', 'E5', 'F5', 'C6', 'A5', 'E5', 'D5'].forEach((p, i) => I.vibes.n(20, i * 0.5, 1.2, p, 66 - (i % 2) * 6));
  I.pad.ch(20, 0, 4, ['D3', 'A3', 'E4', 'F4', 'C5'], 60, { legato: 1 });
  I.pad.ramp(11, 20, 0, 21, 0, 110, 70);
}

// ================================================================================================
// SEA (bars 21–27, 52.5–70): mitosis pops → fish groove → fins to legs → push into the eye
// ================================================================================================
function sea(S, I) {
  S.feel(21, 28, 's16');
  const ch = [[21, 0, 'Dm9'], [22, 0, 'Em7b5'], [22, 2, 'A7b9'], [23, 0, 'Gm9'], [23, 2, 'A7alt'], [24, 0, 'Dm9'], [24, 2, 'G13'], [25, 0, 'Dm9'], [25, 2, 'G13'],
    [26, 0, 'Bbmaj7'], [26, 2, 'A7sus4'], [27, 0, 'Bbmaj7#11'], [27, 2, 'A7sus4']];
  // mitosis: a tick-tock pizzicato motif, divisions pop (55.0, 56.25, 56.875, 57.5)
  comp(I.rhodes, ch, 21, 24, { cell: COMP.halves, center: 60, vel: -8 });
  for (let b = 0; b < 8; b++) I.bass.n(21, b * 0.5, 0.4, b % 2 ? 'A2' : 'D2', 84);
  brushes(I.brush, 21, 23, { vel: -14 });
  [[21, 0, 'D5'], [22, 0, 'F5'], [22, 2, 'A5'], [22, 3, 'C6'], [23, 0, 'D6']].forEach(([b, bt, p], i) => {
    I.vibes.n(b, bt, 1.5, p, 90);
    I.vibes.n(b, bt + 0.25, 1, p.replace(/\d/, (d) => String(+d - 1)), 70);
  });
  // 53.75 the chromosomes split: a plucked pair ; 58.75 the embryo's eye opens: a soft glint
  I.harp.n(21, 2, 1, 'A4', 74, { hum: false }); I.harp.n(21, 2.12, 1, 'D5', 70, { hum: false });
  I.vibes.n(23, 2, 1.8, 'E6', 66, { swing: false }); I.vibes.n(23, 2.08, 1.6, 'A5', 60, { swing: false });
  latinPerc(I.perc, 22, 24, { vel: -10, congas: true });
  for (let b = 0; b < 4; b++) I.bass.n(22, b, 0.9, ['E2', 'G2', 'A1', 'C#2'][b], 90);
  bassSmooth(I.fretless, ch, 23, 24, { ref: 38 });
  // fish (60–65): latin-jazz groove, muted trumpet melody
  comp(I.rhodes, ch, 24, 26, { cell: COMP.funk, center: 62, vel: -4 });
  for (let bar = 24; bar < 26; bar++) {
    // tumbao-ish bass: anticipations on "and of 2" and beat 4
    const r = chordAt(ch, bar, 0) === 'Dm9' ? 'D2' : 'G1';
    I.fretless.n(bar, 0, 1.4, r, 96); I.fretless.n(bar, 1.5, 1, 'A2', 86); I.fretless.n(bar, 3, 0.9, bar % 2 ? 'D2' : 'G1', 90);
  }
  latinPerc(I.perc, 24, 27, { vel: -4 });
  for (let bar = 24; bar < 27; bar++) for (const b of [0, 0.75, 1.5, 2.5, 3, 3.5]) I.timb.n(bar, b, 0.1, b % 1 ? PERC.timbaleHi : PERC.cowbell ?? 56, 60);
  smoothKit(I.kit, 24, 26, { vel: -12, hats: false, ride: true, kickPat: [0, 2.5] });
  I.mute.mel([[24, 0.5, 0.5, 'A4', 86], [24, 1, 0.5, 'D5', 88], [24, 1.5, 1, 'F5', 92, 's'], [24, 2.5, 0.5, 'E5', 84], [24, 3, 1, 'D5', 86],
    [25, 0, 1, 'C5', 86], [25, 1, 0.5, 'B4', 80], [25, 1.5, 0.5, 'A4', 82], [25, 2, 2, 'G4', 86, 'v']]);
  I.alto.mel([[25, 2.5, 0.5, 'B4', 80], [25, 3, 0.5, 'D5', 82], [25, 3.5, 0.5, 'F5', 86]]);
  // fins → legs, crawl (65–70): comic trombone + bari "steps" on the beats
  comp(I.rhodes, ch, 26, 28, { cell: COMP.halves, center: 60, vel: -8 });
  const steps = ['Bb1', 'F2', 'A1', 'E2', 'Bb1', 'F2', 'A1', 'E2'];
  steps.forEach((p, i) => { I.bari.n(26 + Math.floor(i / 4), (i % 4), 0.6, p, 92); });
  I.tbn.mel([[26, 1.5, 1, 'F3', 84, 's'], [26, 3.5, 0.5, 'A3', 80]]);
  I.tbn.bend.push(...fall(S.T(26, 2.1), { depth: -1, dur: 0.3 }));
  for (let bar = 26; bar < 28; bar++) for (const b of [0, 1, 2, 3]) I.kit.n(bar, b, 0.2, DRUMS.kick, 70);
  // push into the eye (68.75–70): suspended chord with a timpani roll crescendo
  I.pad.ch(27, 2, 2.2, ['A2', 'E3', 'D4', 'G4', 'A4'], 70, { legato: 1 });
  I.pad.ramp(11, 27, 1, 28, 0, 50, 120);
  for (let i = 0; i < 8; i++) I.timp.n(27, 2 + i * 0.25, 0.3, 'A1', 40 + i * 9, { hum: false });
  I.vibes.n(27, 2, 2, 'E6', 70);
}

// ================================================================================================
// LAND (bars 28–33, 70–85): the dinosaur → IMPACT (77.5) → fire → ash
// ================================================================================================
function land(S, I) {
  S.feel(28, 34, 's8');
  // 70.0 eye pulls back: a big low brass chord (Fm9) with timpani
  for (const [k, ns] of Object.entries({ bari: ['F1', 'C2'], tbn: ['Ab2', 'Eb3'], tenor: ['G3', 'C4'], tpt: ['Eb4'] })) for (const p of ns) I[k].n(28, 0, 3, p, 104);
  I.timp.n(28, 0, 2, 'F1', 120);
  I.kit.n(28, 0, 3, DRUMS.crash, 96);
  I.pad.ch(28, 0, 4, ['F2', 'C3', 'Ab3', 'Eb4', 'G4'], 76, { legato: 1 });
  // 72.5–77.5 the dinosaur walks: stomping blues riff (bari + trombone + bass unison) on footfalls
  const riff = [[0, 'F2', 1.4], [1.5, 'Ab2', 0.4], [2, 'A2', 0.4], [2.5, 'Bb2', 0.9], [3.5, 'C3', 0.4]];
  const riff2 = [[0, 'Eb3', 1.4], [1.5, 'C3', 0.4], [2, 'Bb2', 0.4], [2.5, 'Ab2', 0.9], [3.5, 'G2', 0.4]];
  for (const [bar, rr] of [[29, riff], [30, riff2]]) for (const [b, p, d] of rr) {
    I.bari.n(bar, b, d, p, 100); I.tbn.n(bar, b, d, p, 92); I.bass.n(bar, b, d, p.replace(/\d/, (x) => String(+x - 1)), 100);
  }
  swingKit(I.kit, 29, 31, { vel: 6 });
  for (let bar = 29; bar < 31; bar++) for (const b of [0, 2]) { I.kit.n(bar, b, 0.3, DRUMS.tomLowFloor, 104); I.timp.n(bar, b, 0.6, 'F1', 90); }
  comp(I.rhodes, [[29, 0, 'Fm7'], [30, 0, 'Fm7']], 29, 31, { cell: COMP.swing, center: 58, vel: -4 });
  // 76.25 meteor streak: rising brass rip + cymbal swell
  I.tpt.n(30, 2, 2, 'C5', 96); I.tpt.bend.push({ t: S.T(30, 2), v: -1, curve: 'step' }, { t: S.T(31, 0) - 0.05, v: 0 });
  I.alto.n(30, 2, 2, 'Ab4', 96); I.alto.cc.push(...ccRamp(11, S.T(30, 2), S.T(31, 0), 60, 127));
  for (let i = 0; i < 16; i++) I.kit.n(30, 2 + i * 0.125, 0.2, DRUMS.ride, 30 + i * 5, { hum: false });
  // 77.5 IMPACT: tutti sforzando (Fm with a b9 crunch), then the music is gone
  for (const [k, ns] of Object.entries({ bari: ['F1'], tbn: ['C3', 'Gb3'], tenor: ['Ab3', 'C4'], alto: ['Eb4', 'Gb4'], tpt: ['F5', 'Ab5'] })) for (const p of ns) I[k].n(31, 0, 0.9, p, 124, { hum: false });
  I.piano.ch(31, 0, 1, ['F0', 'F1', 'C2', 'Gb2', 'Ab2'], 120, { roll: 0.002 });
  I.kit.n(31, 0, 4, DRUMS.crash, 124); I.kit.n(31, 0, 4, DRUMS.china, 118); I.kit.n(31, 0, 0.3, DRUMS.kick, 127);
  I.timp.n(31, 0, 3, 'F1', 127);
  // 78.75–82.5: aftermath of the blast: only a low, trembling drone
  I.pad.ch(31, 2, 6, ['F1', 'C2'], 60, { legato: 1 });
  I.pad.ramp(11, 31, 2, 33, 0, 90, 40);
  // 82.5–85: ash begins; muted trumpet remembers the theme (in F minor) over sparse Rhodes
  I.rhodes.ch(33, 0, 2, mchord('Abmaj7', { voicing: 'rootlessA', center: 58 }), 60);
  I.rhodes.ch(33, 2, 2, mchord('Fm9', { voicing: 'rootlessA', center: 58 }), 58);
  I.mute.mel([[33, 0, 1.5, 'C5', 80, 'v'], [33, 1.5, 0.5, 'Bb4', 72], [33, 2, 2, 'Ab4', 76, 'v']]);
}

// ================================================================================================
// ANCESTORS (bars 34–38, 85–97.5): solo piano in the ash → life regrows → dusk, fire, sparks
// ================================================================================================
function ancestors(S, I) {
  S.feel(34, 39, 's16');
  // solo piano, Abmaj9 → Fm9 (85–87.5)
  ['Ab2', 'Eb3', 'G3', 'Bb3', 'C4', 'Eb4'].forEach((p, i) => I.piano.n(34, i * 0.33, 3.5 - i * 0.33, p, 62 + i * 2));
  I.piano.cc.push({ t: S.T(34, 0) - 0.01, n: 64, v: 127 }, { t: S.T(35, 0) - 0.02, n: 64, v: 0 }, { t: S.T(35, 0), n: 64, v: 127 }, { t: S.T(36, 0) - 0.02, n: 64, v: 0 });
  I.piano.mel([[34, 2, 1, 'C5', 70], [34, 3, 1, 'Bb4', 66]]);
  // 86.25 the mammal pops out; 87.5 it scurries
  I.vibes.n(34, 2, 0.4, 'G5', 84); I.vibes.n(34, 2.25, 0.4, 'C6', 80);
  ['Ab5', 'Bb5', 'C6', 'Eb6', 'F6', 'Ab6'].forEach((p, i) => I.vibes.n(35, i * 0.125, 0.4, p, 70 + i * 3));
  // regrowth (87.5–92.5): the groove regrows, key brightens
  const ch = [[35, 0, 'Dbmaj9'], [36, 0, 'Eb13sus'], [36, 2, 'Eb13'], [37, 0, 'Fm9'], [37, 2, 'Eb/F'], [38, 0, 'Fm9'], [38, 2, 'Dbmaj7#11']];
  comp(I.rhodes, ch, 35, 37, { cell: COMP.smooth, center: 60, vel: -8 });
  bassSmooth(I.fretless, ch, 35, 37, { ref: 38, vel: -6 });
  latinPerc(I.perc, 35, 37, { vel: -16, congas: false });
  smoothKit(I.kit, 36, 37, { vel: -18, hats: true, rim: true, kickPat: [0, 2.5] });
  I.pad.ch(35, 0, 4, ['Db3', 'Ab3', 'C4', 'Eb4', 'F4'], 64, { legato: 1 });
  I.pad.ch(36, 0, 4, ['Eb3', 'Db4', 'F4', 'Ab4', 'C5'], 66, { legato: 1 });
  I.pad.ramp(11, 35, 0, 37, 0, 50, 104);
  // 88.75–89.7 the first sprouts burst: harp plucks climbing ; 90.0 growth swell, the sun blazes
  [[2, 'Db5'], [2.4, 'Eb5'], [3, 'F5'], [3.5, 'Ab5']].forEach(([bt, p], i) => I.harp.n(35, bt, 1.4, p, 70 + i * 4, { hum: false }));
  for (let i = 0; i < 8; i++) I.kit.n(35, 2 + i * 0.25, 0.2, DRUMS.ride, 26 + i * 6, { hum: false });
  I.kit.n(36, 0, 2.5, DRUMS.crash, 84);
  // 91.9 a butterfly lands: a two-note glint
  I.vibes.n(36, 3.05, 0.8, 'Eb6', 70); I.vibes.n(36, 3.3, 0.8, 'Bb6', 62);
  // 91.25 the primate: a playful horn stab
  for (const [k, p] of [['tptStac', 'C5'], ['alto', 'Ab4'], ['tenor', 'Eb4'], ['tbnStac', 'G3']]) I[k].n(36, 2, 0.4, p, 104);
  // dusk & fire (92.5–97.5): tribal groove — congas/toms + bass ostinato
  const ost = ['F2', 'F2', 'Ab2', 'Bb2', 'C3', 'Bb2', 'Ab2', 'Eb2'];
  for (let bar = 37; bar < 39; bar++) ost.forEach((p, i) => I.bass.n(bar, i * 0.5, 0.42, p, i % 2 ? 84 : 98));
  comp(I.rhodes, ch, 37, 39, { cell: COMP.halves, center: 58, vel: -6 });
  for (let bar = 37; bar < 39; bar++) {
    for (const [b, p, v] of [[0, DRUMS.tomLowFloor, 104], [0.75, DRUMS.tomLow, 84], [1.5, DRUMS.tomLowFloor, 96], [2, DRUMS.tomLowMid, 90], [2.75, DRUMS.tomLow, 86], [3.5, DRUMS.tomLowFloor, 100]])
      I.kit.n(bar, b, 0.25, p, v - (bar === 37 ? 16 : 0));
    latinPerc(I.perc, bar, bar + 1, { vel: bar === 37 ? -12 : 0 });
  }
  // 93.75 stands up: horn swell ; 95.0 fire ignites (bar 38)
  I.tbn.n(37, 2, 2, 'Eb3', 80); I.tenor.n(37, 2, 2, 'Bb3', 80); I.tpt.n(37, 2, 2, 'F4', 80);
  for (const k of ['tbn', 'tenor', 'tpt']) I[k].cc.push(...ccRamp(11, S.T(37, 2), S.T(38, 0), 50, 124));
  I.kit.n(38, 0, 2, DRUMS.crash, 100);
  // 96.25 sparks rise → stars: vibes glitter upward
  ['C5', 'Eb5', 'F5', 'Ab5', 'C6', 'Eb6', 'F6', 'Ab6', 'C7'].forEach((p, i) => I.vibes.n(38, 2 + i * 0.2, 1.5, p, 80 - i * 3));
}

// ================================================================================================
// HUNT (bars 39–42, 97.5–107.5): the hunt drives → the spear → dawn → bossa as the fields grow
// ================================================================================================
function hunt(S, I) {
  S.feel(39, 41, 'straight');
  S.feel(41, 43, 's16');
  const ch = [[39, 0, 'Dm7'], [39, 2, 'Dm7'], [40, 0, 'Bbmaj7'], [40, 2, 'A7alt'], [41, 0, 'Fmaj9'], [42, 0, 'Gm9'], [42, 2, 'C13']];
  // 97.5 the tilt down from the stars: trumpet call over a low pedal and a tom rumble;
  // 98.75 the hunters' footfalls (one per eighth) start the drive; it stops dead on the THROW (101.25)
  I.bass.n(39, 0, 1.95, 'D2', 92);
  for (let i = 0; i < 8; i++) I.kit.n(39, i * 0.25, 0.2, DRUMS.tomLowFloor, 44 + i * 6, { hum: false });
  for (let i = 0; i < 8; i++) I.kit.n(39, i * 0.25, 0.2, DRUMS.ride, 30 + i * 5, { hum: false });
  I.vibes.n(39, 0.35, 1.5, 'A6', 70, { swing: false }); // shooting star (97.72)
  const drive = (bar, e) => (bar === 39 && e >= 4) || (bar === 40 && e < 4);
  for (let bar = 39; bar < 41; bar++) for (let e = 0; e < 8; e++) {
    if (!drive(bar, e)) continue;
    const sym = chordAt(ch, bar, e / 2);
    const r = bassNote(sym, 38);
    I.bass.n(bar, e / 2, 0.4, e % 4 === 3 ? r + 7 : r, e % 2 ? 84 : 100);
  }
  for (let bar = 39; bar < 41; bar++) {
    for (let e = 0; e < 8; e++) if (drive(bar, e)) I.kit.n(bar, e / 2, 0.3, DRUMS.ride, e % 2 ? 60 : 84);
    for (const b of [0, 1.5, 2, 3.5]) if (drive(bar, b * 2)) I.kit.n(bar, b, 0.2, DRUMS.tomLowFloor, 96);
    for (const b of [1, 3]) if (drive(bar, b * 2)) I.kit.n(bar, b, 0.2, DRUMS.snare, 100);
  }
  I.kit.n(40, 1.5, 0.3, DRUMS.kick, 112); // the planted step (100.94)
  // THROW: crash, then the spear flies over a suspended A7alt (strings + ride swell) into the dawn
  I.kit.n(40, 2, 3, DRUMS.crash, 110);
  I.timp.n(40, 2, 1.5, 'A1', 100);
  I.pad.ch(40, 2, 2, ['A2', 'G3', 'C#4', 'F4', 'Bb4'], 74, { legato: 1 });
  I.pad.ramp(11, 40, 2, 41, 0, 70, 104);
  for (let i = 0; i < 8; i++) I.kit.n(40, 2 + i * 0.25, 0.2, DRUMS.ride, 34 + i * 6, { hum: false });
  I.tpt.mel([[39, 0, 1, 'D5', 100], [39, 1, 0.5, 'G5', 100], [39, 1.5, 1.5, 'A5', 104, 's'], [39, 3, 1, 'F5', 96], [40, 0, 0.5, 'D5', 98], [40, 0.5, 0.5, 'F5', 98], [40, 1, 1, 'Bb5', 106, 'd']]);
  comp(I.rhodes, ch, 39, 41, { cell: COMP.halves, center: 60, vel: -2 });
  // 101.25 spear throw: rip ; 102.5 dawn: flugelhorn states the theme's opening over Fmaj9
  I.alto.n(40, 2, 1.8, 'F5', 96); I.alto.bend.push(...doit(S.T(40, 3.3), { depth: 1, dur: 0.25 }));
  I.flugel.mel(shiftMel(THEME_MEL.slice(0, 5), 41).map((n) => { const [b, bt, d, p, v, f] = n; return [b, bt, d, p.replace(/\d/, (x) => String(+x - 1 + 1)), v - 4, f]; }), { autoVib: true });
  I.pad.ch(41, 0, 4, ['F3', 'C4', 'E4', 'G4', 'A4'], 70, { legato: 1 });
  // 103.75 the spear lands (thud on the kick) → bossa: nylon guitar, rim clave, shaker
  I.kit.n(41, 2, 0.4, DRUMS.kick, 120);
  I.timp.n(41, 2, 1, 'F1', 96);
  const bossaGtr = (bar, beats) => {
    const sym = chordAt(ch, bar, beats[0]);
    const v = mchord(sym, { voicing: 'drop2', center: 58 });
    for (const [b, d] of [[0, 0.4], [1.5, 0.4], [2, 0.4], [3, 0.4], [3.5, 0.4]]) if (b >= beats[0] && b < beats[1]) I.guitar.ch(bar, b, d, v, 66);
    I.guitar.n(bar, 0, 0.9, bassNote(sym, 40), 72);
    I.guitar.n(bar, 2, 0.9, bassNote(sym, 40) + 7, 66);
  };
  bossaGtr(41, [2, 4]);
  bossaGtr(42, [0, 4]);
  for (let bar = 41; bar < 43; bar++) for (const b of [0, 0.75, 1.5, 2.5, 3.25]) if (bar > 41 || b >= 2) I.kit.n(bar, b, 0.15, DRUMS.sideStick, 74);
  latinPerc(I.perc, 41, 43, { vel: -10, congas: false });
  bassTwo(I.fretless, ch, 42, 43, { ref: 38, vel: -4 });
  // 105.0 furrows multiply: vibes plinks, one per row (105.0 … 106.25, on the eighths)
  ['C6', 'A5', 'F5', 'D6', 'Bb5'].forEach((p, i) => I.vibes.n(42, i * 0.5, 0.6, p, 70));
}

// ================================================================================================
// CITY (bars 43–46, 107.5–117.5): bossa village → the city swings → the clock accelerates
// ================================================================================================
function city(S, I) {
  S.feel(43, 44, 's16');
  S.feel(44, 47, 's8');
  const ch = [[43, 0, 'Fmaj9'], [43, 2, 'D7b9'], [44, 0, 'Gm9'], [44, 2, 'C13'], [45, 0, 'Fmaj7'], [45, 2, 'D7alt'], [46, 0, 'Gm7'], [46, 2, 'C7alt']];
  // 107.75 the river draws itself across the fields: a flowing harp figure
  ['C5', 'A4', 'F4', 'G4', 'A4', 'C5', 'E5', 'D5', 'C5', 'A4'].forEach((p, i) => I.harp.n(43, 0.4 + i * 0.16, 0.9, p, 58 + (i % 3) * 4, { hum: false }));
  // houses pop up (108.75…): pizz-like vibe plinks on beats
  ['F5', 'A5', 'C6', 'E6'].forEach((p, i) => I.vibes.n(43, 2 + i * 0.5, 0.4, p, 78));
  comp(I.rhodes, ch, 43, 44, { cell: COMP.bossa, center: 60, vel: -4 });
  bassTwo(I.fretless, ch, 43, 44, { ref: 38 });
  for (const b of [0, 0.75, 1.5, 2.5, 3.25]) I.kit.n(43, b, 0.15, DRUMS.sideStick, 72);
  // 110.0 buildings rise: brass crescendo into the swing (111.25)
  for (const [k, p] of [['tbn', 'Bb2'], ['tenor', 'F3'], ['alto', 'D4'], ['tpt', 'A4']]) { I[k].n(44, 0, 1.9, p, 84); I[k].cc.push(...ccRamp(11, S.T(44, 0), S.T(44, 2), 50, 124)); }
  // 111.25 → big-band swing: walking bass, ride, horn riff
  bassWalk(I.bass, ch, 44, 47, { ref: 38, seed: 7 });
  swingKit(I.kit, 44, 47, { vel: 4 });
  comp(I.rhodes, ch, 44, 47, { cell: COMP.swing, center: 60 });
  const shout = [[44, 2, 0.5, 'G5'], [44, 2.5, 0.5, 'A5'], [44, 3, 1, 'Bb5'], [45, 0.5, 0.5, 'A5'], [45, 1, 0.5, 'F5'], [45, 1.5, 1, 'D5'], [45, 2.5, 1.5, 'C#5', 'f']];
  for (const [b, bt, d, p, f] of shout) {
    const sym = chordAt(ch, b, bt);
    const lead = p;
    const voices = mchord(sym, { voicing: 'drop2', center: 64 }).filter((x) => x < 70).slice(-3);
    I.tpt.n(b, bt, d, lead, 108);
    ['alto', 'tenor', 'tbn'].forEach((k, i) => voices[2 - i] && I[k].n(b, bt, d, voices[2 - i] - (k === 'tbn' ? 12 : 0), 100));
    if (f) I.tpt.bend.push(...fall(S.T(b, bt + d) - 0.3, { depth: -1, dur: 0.3 }));
  }
  // 111.875 street lamps light in pairs: a glittering vibes run
  ['C6', 'E6', 'G6', 'A6', 'C7', 'E7'].forEach((p, i) => I.vibes.n(44, 3 + i * 0.25, 0.5, p, 58 + i * 2, { swing: false }));
  // the clock: ticks on beats (112.5 …), 8ths (115.0 …), a whirl (116.016 …), the midnight clunk (116.25),
  // then the escapement ticks on 16ths while the dial slides open (116.41 …)
  for (let b = 0; b < 4; b++) I.timb.n(45, b, 0.1, b % 2 ? WB.lo : WB.hi, 96);
  for (let e = 0; e < 4; e++) I.timb.n(46, e * 0.5, 0.08, e % 2 ? WB.lo : WB.hi, 92, { swing: false });
  for (let w = 0; w < 3; w++) I.timb.n(46, 1.625 + w * 0.125, 0.05, w % 2 ? WB.lo : WB.hi, 92 + w * 8, { swing: false });
  for (let s = 0; s < 7; s++) I.timb.n(46, 2.25 + s * 0.25, 0.06, s % 2 ? WB.lo : WB.hi, 80 + s * 3, { swing: false });
  // rising horn line with the accelerating clock, dial opens (116.25): stab + choke
  ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'B4'].forEach((p, i) => I.tenor.n(46, i * 0.25, 0.22, p, 90 + i * 2));
  for (const [k, p] of [['tptStac', 'Bb5'], ['alto', 'E5'], ['tenor', 'C5'], ['tbnStac', 'G3']]) I[k].n(46, 2, 0.35, p, 116);
  I.kit.n(46, 2, 0.3, DRUMS.crash, 110);
}

// ================================================================================================
// MACHINE (bars 47–51, 117.5–130): industrial funk → the data corridor (fusion) → tilt to the die
// ================================================================================================
function machine(S, I) {
  S.feel(47, 52, 's16');
  const ch = [[47, 0, 'Em9'], [47, 2, 'A13'], [48, 0, 'Em9'], [48, 2, 'A13'], [49, 0, 'Cmaj9'], [49, 2, 'Bm7'], [50, 0, 'Am9'], [50, 2, 'D13'], [51, 0, 'Gmaj9#11'], [51, 2, 'F#7alt']];
  funkKit(I.kit, 47, 49, { vel: -2 });
  // clav riff (16ths) + finger-bass riff
  const clavRiff = [[0, 'E4'], [0.5, 'G4'], [0.75, 'E4'], [1.5, 'B4'], [2.25, 'A4'], [2.75, 'G4'], [3.5, 'E4']];
  for (let bar = 47; bar < 49; bar++) for (const [b, p] of clavRiff) I.clav.n(bar, b, 0.2, p, 96);
  const bassRiff = [[0, 'E1', 0.4], [0.75, 'E2', 0.2], [1, 'D2', 0.2], [1.5, 'B1', 0.4], [2, 'A1', 0.4], [2.75, 'A1', 0.2], [3, 'G1', 0.2], [3.5, 'B1', 0.4]];
  for (let bar = 47; bar < 49; bar++) for (const [b, p, d] of bassRiff) I.fretless.n(bar, b, d, p, 104);
  // horn stabs on the ratchet clicks (118.75, 119.375), the plating spin-up (120.0) and the tilt (121.25)
  for (const [bar, b, v] of [[47, 2, 110], [47, 3, 104], [48, 0, 112], [48, 2, 108]]) for (const [k, p] of [['tptStac', 'B5'], ['alto', 'F#5'], ['tenor', 'D5'], ['tbnStac', 'A3']]) I[k].n(bar, b, 0.3, p, v);
  // accelerating ticks into the spin-up (119.6875, 119.8125, 119.875, 119.9375)
  [3.5, 3.7, 3.8, 3.9].forEach((b, i) => I.timb.n(47, b, 0.05, i % 2 ? WB.lo : WB.hi, 88 + i * 6, { swing: false }));
  // 121.875 the rack LEDs cascade on: a quick vibes glitter
  ['E7', 'B6', 'G6', 'E6', 'B5', 'G5'].forEach((p, i) => I.vibes.n(48, 3 + i * 0.125, 0.4, p, 64 + i * 2, { swing: false }));
  // 122.5 corridor: fusion — Rhodes, fretless, tenor sax licks
  comp(I.rhodes, ch, 49, 52, { cell: COMP.smooth, center: 62 });
  bassSmooth(I.fretless, ch, 49, 52, { ref: 38 });
  smoothKit(I.kit, 49, 52, { vel: -6, ride: true, rim: false, kickPat: [0, 1.75, 2.5] });
  I.alto.mel([[49, 0.5, 0.5, 'G4', 88], [49, 1, 0.5, 'B4', 90], [49, 1.5, 0.5, 'D5', 92], [49, 2, 1, 'F#5', 96, 's'], [49, 3, 0.5, 'E5', 88], [49, 3.5, 0.5, 'D5', 86],
    [50, 0, 1, 'E5', 92], [50, 1, 0.5, 'C5', 86], [50, 1.5, 0.5, 'A4', 84], [50, 2, 1.5, 'F#5', 94, 'v']], { autoVib: true });
  I.alto.cc.push({ t: S.T(49, 0), n: 11, v: 112 });
  // 125.0 data surge: a crash on the flash, vibes arpeggio run
  ['A4', 'C5', 'E5', 'G5', 'B5', 'D6', 'F#6', 'A6'].forEach((p, i) => I.vibes.n(50, i * 0.25, 0.5, p, 76 + i * 2));
  I.kit.n(50, 0, 2.5, DRUMS.crash, 96);
  // 127.5 tilt/rise: riser chord → 130
  I.pad.ch(51, 0, 4, ['G2', 'D3', 'F#3', 'A3', 'C#4'], 70, { legato: 1 });
  I.pad.ramp(11, 51, 0, 52, 0, 60, 120);
  fill(I.kit, 51, 2.5, { vel: -2 });
  // 128.75 the aisle slams shut: a full-band hit (kick, crash, low brass, timpani), the riser carries on to the die
  I.kit.n(51, 2, 0.3, DRUMS.kick, 124); I.kit.n(51, 2, 2, DRUMS.crash, 112);
  I.timp.n(51, 2, 1.2, 'F#1', 110);
  for (const [k, p] of [['bari', 'F#1'], ['tbnStac', 'C#3'], ['tenor', 'E4'], ['tptStac', 'A#4']]) I[k].n(51, 2, 0.35, p, 116);
}

// ================================================================================================
// MIND (bars 52–57, 130–145): the theme a key higher (Ab) as the network thinks → the code writes
// itself (breakdown) → play → the cursor collapses → Fmaj9 decays into the A+E singularity tone.
// ================================================================================================
function mind(S, I) {
  S.feel(52, 58, 's16');
  const tr = 3; // F → Ab
  const ch = shiftChanges(THEME_CHANGES.slice(0, 7), 52, tr); // bars 52–55 (Abmaj9 | Gm7b5 C7b9 | Fm9 | Ebm9 Ab13)
  I.kit.n(52, 0, 3, DRUMS.crash, 116);
  smoothKit(I.kit, 52, 55, { vel: 6, ride: true, rim: false, kickPat: [0, 1.75, 2.5] });
  comp(I.rhodes, ch, 52, 55, { cell: COMP.smooth, center: 62, vel: 6 });
  bassSmooth(I.fretless, ch, 52, 55, { ref: 40, vel: 6 });
  latinPerc(I.perc, 52, 55, { vel: -6, congas: false });
  // full section theme: tenor + alto (octave) + trumpet
  const mel = shiftMel(THEME_MEL.filter(([b]) => b < 3), 52, tr);
  const down = (p) => p.replace(/\d/, (x) => String(+x - 1));
  I.tpt.mel(mel, { autoVib: true });
  I.alto.mel(mel.map(([b, bt, d, p, v, f]) => [b, bt, d, down(p), v, f]), { autoVib: true });
  I.alto.cc.push({ t: S.T(52, 0) - 0.05, n: 11, v: 124 });
  I.tenor.mel(mel.map(([b, bt, d, p, v, f]) => [b, bt, d, down(p), v - 4, f]), { autoVib: true });
  // signal waves (135.0, 136.25, 137.5): section swells
  for (const [bar, b, sym] of [[54, 0, 'Fm9'], [54, 2, 'Fm9'], [55, 0, 'Ebm9']]) {
    const v = mchord(sym, { voicing: 'drop2', center: 60 });
    ['tbn', 'tenor', 'alto', 'tpt'].forEach((k, i) => { I[k].n(bar, b, 1.2, v[i] - (k === 'tbn' ? 12 : 0), 96); I[k].cc.push(...ccRamp(11, S.T(bar, b), S.T(bar, b + 1), 70, 124)); });
  }
  I.pad.ch(54, 0, 4, ['F2', 'C3', 'Ab3', 'Eb4', 'G4'], 76, { legato: 1 });
  I.pad.ch(55, 0, 2, ['Eb2', 'Bb2', 'Gb3', 'Db4', 'F4'], 74, { legato: 1 });
  // 138.75 code typing: breakdown — hats + rim, Rhodes alone, the theme softly on soprano
  const bd = [[55, 2, 'Ab13'], [56, 0, 'Gm9'], [56, 2, 'C13sus']];
  smoothKit(I.kit, 55, 56, { vel: -24, hats: true, rim: true, kickPat: [] });
  comp(I.rhodes, bd, 55, 57, { cell: COMP.halves, center: 60, vel: -10 });
  I.fretless.n(55, 2, 1.9, 'Ab1', 80); I.fretless.n(56, 0, 1.9, 'G1', 80);
  I.sop.mel([[55, 3, 0.5, 'C5', 74], [56, 0, 1.5, 'F5', 80, 's'], [56, 1.5, 0.5, 'E5', 70]]);
  // 141.25 play is pressed: one beat of silence … then the dive: reverse swell into the final chord
  I.pad.ch(56, 3, 1, ['C3', 'G3', 'Bb3', 'F4'], 60, { legato: 1 });
  I.pad.ramp(11, 56, 3, 57, 0, 30, 110);
  // 142.5 the cursor collapses: Fmaj9 rings and decays into the A+E singularity tone (loops to 0 s)
  I.rhodes.ch(57, 0, 3.8, ['F2', 'C3', 'E3', 'G3', 'A3'], 70, { roll: 0.02 });
  I.vibes.n(57, 0, 3.5, 'E6', 60); I.vibes.n(57, 0.1, 3.4, 'A5', 56);
  I.pad.n(57, 0, 4, 'A4', 70, { legato: 1, hum: false });
  I.pad.n(57, 0, 4, 'E5', 66, { legato: 1, hum: false });
  I.pad.ramp(11, 57, 0.5, 58, 0, 90, 8);
  // 143.75 the caret collapses into a point: the same E6 twinkle that greets the first point of light (0.7 s)
  I.vibes.n(57, 2, 2, 'E6', 62, { swing: false }); I.vibes.n(57, 2.9, 1.1, 'A5', 44, { swing: false });
}

export function sections2(S, I) {
  earth(S, I);
  sea(S, I);
  land(S, I);
  ancestors(S, I);
  hunt(S, I);
  city(S, I);
  machine(S, I);
  mind(S, I);
}
