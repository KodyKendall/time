// audio/lib/instruments.mjs — recommended instrument -> source mapping (evaluation in audio/INSTRUMENTS.md).
// Usage in a score:  { id:'sax', ...inst('altoSax'), notes:[...] }
// Entries spread either { sf, bank, program, drums? } (SoundFont via spessasynth) or { sfz } (SFZ sampler),
// plus optional keymap / ccInit. All drum-type entries accept GM drum key numbers (see music.mjs DRUMS/BRUSH/PERC).

// GM percussion keys -> AVL "Buskman's Holiday" (avlperc) keys
export const AVL_PERC_KEYMAP = {
  35: 36, 36: 36, 37: 35, 38: 38, 39: 39, 40: 40, // cajon thump / stick click / cajon slaps / claps
  62: 45, 63: 47, 64: 41, 60: 45, 61: 43, // congas (small L/R, large L/R) — bongos fall back to congas
  82: 42, 70: 42, 69: 44, 54: 46, 75: 48, 56: 51, 49: 49, 53: 50, 84: 54,
};

export const INSTRUMENTS = {
  // ---------------- keys
  rhodes:        { sf: 'jrhodes3', bank: 0, program: 0 },          // jRhodes3: 65 unlooped samples x 5 vel layers
  rhodesChorus:  { sf: 'jrhodes3c', bank: 0, program: 0 },         // looped stereo version with built-in chorus
  fmPiano:       { sf: 'fmep', bank: 0, program: 0 },              // DX7-style "E.Piano 1"
  wurlitzer:     { sfz: 'wurlitzer' },
  piano:         { sf: 'salamander', bank: 0, program: 0 },        // Salamander Grand V3, 16 layers (1.3 GB, ~2 s load)
  pianoLight:    { sf: 'ms', bank: 0, program: 0 },                // Splendid Grand (MuseScore_General), much lighter
  uprightPiano:  { sf: 'uprightkw', bank: 0, program: 0 },
  vibes:         { sfz: 'vcsl-vibes-soft' },                       // VCSL vibraphone, soft mallets (no motor)
  vibesHard:     { sfz: 'vcsl-vibes-hard' },
  vibesMotor:    { sfz: 'vcsl-vibes-motor' },                      // soft mallets + simulated motor tremolo
  clav:          { sf: 'fluid', bank: 0, program: 7 },
  // ---------------- saxes / horns
  altoSax:       { sfz: 'weresax-alto' },                          // Karoryfer Weresax (CC0), looped, soft/loud x RR
  altoSaxMTG:    { sfz: 'mtg-alto-looped' },                       // MTG solo sax (CC-BY 4.0) — warmer, 17 random takes
  tenorSax:      { sf: 'fptenor', bank: 0, program: 0 },           // FreePats tenor (CC0), 4-9 s samples, clean loops
  tenorSaxMTG:   { sfz: 'mtg-tenor-looped' },
  sopranoSax:    { sfz: 'mtg-soprano-looped' },                    // MTG (CC-BY 4.0), embedded loops enabled
  bariSax:       { sfz: 'mtg-bari-looped' },
  trumpet:       { sfz: 'vsco-trumpet' },                          // VSCO2 CE (CC0), long unlooped sustains
  trumpetVib:    { sfz: 'vsco-trumpet-vib' },
  trumpetStac:   { sfz: 'vsco-trumpet-stac' },                     // best for horn-section stabs
  mutedTrumpet:  { sf: 'fluid', bank: 0, program: 59 },            // harmon mute (clean loop); alt: sfz vsco-trumpet-harmon
  straightMute:  { sfz: 'vsco-trumpet-straight' },
  flugelhorn:    { sfz: 'vsco-trumpet', eq: [{ type: 'lp', freq: 3800, order: 4 }, { type: 'lowshelf', freq: 400, gain: 2 }] }, // stand-in (no free flugelhorn)
  trombone:      { sfz: 'vsco-trombone' },
  tromboneStac:  { sfz: 'vsco-trombone-stac' },
  frenchHorn:    { sf: 'fluid', bank: 0, program: 60 },
  brass:         { sf: 'fluid', bank: 0, program: 61 },
  // ---------------- bass / guitar / strings
  uprightBass:   { sfz: 'meatbass-pizz' },                         // Karoryfer Meatbass pizz (CC0), 4 layers x 4 RR
  fretlessBass:  { sf: 'fluid', bank: 0, program: 35 },
  fingerBass:    { sf: 'ms', bank: 0, program: 33 },
  nylonGuitar:   { sf: 'fluid', bank: 0, program: 24 },
  jazzGuitar:    { sf: 'fluid', bank: 0, program: 26 },
  strings:       { sf: 'gm', bank: 0, program: 49 },               // GeneralUser slow strings (clean loops) for pads
  stringsFast:   { sf: 'gm', bank: 0, program: 48 },
  // ---------------- drums & percussion (GM key numbers)
  jazzKit:       { sf: 'avlbop', bank: 0, program: 0 },            // AVL Blonde Bop (real bop kit, 5 layers), GM-compatible keys
  jazzKitGM:     { sf: 'gm', program: 32, drums: true },           // GeneralUser GS Jazz kit
  brushKit:      { sfz: 'swirly-brushes' },                        // Karoryfer Swirly Drums: 38 tap, 40 edge, 39 dig, 60/64 stirs
  brushKitRods:  { sf: 'avlhotrods', bank: 0, program: 0 },        // AVL Blonde Bop played with hot rods
  brushKitGM:    { sf: 'gm', program: 40, drums: true },           // GeneralUser GS Brush kit (38 tap, 39 slap, 40 swirl)
  percussion:    { sfz: 'virtuosity-kit' },                        // bongos, congas, cabasa, shaker, claves, triangle... (GM keys)
  timbales:      { sf: 'gm', program: 0, drums: true },            // GM kit for timbales 65/66 & woodblocks 76/77
  latinPerc:     { sf: 'avlperc', bank: 0, program: 0, keymap: AVL_PERC_KEYMAP }, // AVL congas/shakers/cajon
  standardKit:   { sf: 'gm', program: 0, drums: true },
};

export function inst(name, extra = {}) {
  const i = INSTRUMENTS[name];
  if (!i) throw new Error(`inst(): unknown instrument '${name}'. Known: ${Object.keys(INSTRUMENTS).join(', ')}`);
  return { ...i, ...extra };
}
