# Audio credits & licenses

Everything the audio toolchain uses. Every item has been checked against its license text, and every license allows
use in a published (including commercial) video. **Attribution required** marks the items that must be credited
(the film's end credits or description). The rest are listed as a courtesy.

## Suggested end-credit block

> Sampled instruments: Salamander Grand Piano by Alexander Holm (CC BY 3.0) · YDP Grand Piano, FreePats project (CC BY 3.0) ·
> MTG Solo Saxophones by the Music Technology Group, Universitat Pompeu Fabra, mapped by kinwie (CC BY 4.0) ·
> E-Pianos by Greg Sullivan (CC BY 3.0) · jRhodes3 by Jeff Learman · Karoryfer Samples (Weresax, Meatbass, Swirly Drums, Virtuosity Drums) ·
> Versilian Studios (VSCO 2 CE, VCSL) · AVL Drumkits by Glen MacArthur · FreePats · GeneralUser GS by S. Christian Collins ·
> FluidR3 by Frank Wen / MuseScore_General by S. Christian Collins et al. Synthesis: spessasynth_core by spessasus.

Drop any line whose instrument does not end up in the final score. Only the CC-BY items are legally required. The
sampled SFX (see the last section) add their own lines if any CC-BY file is used.

## Software (npm)

| package | version | license | use |
|---|---|---|---|
| spessasynth_core | 4.3.22 | Apache-2.0 | SF2/SF3/DLS synthesizer used by `audio/lib/synth.mjs` |

Everything else in `audio/lib` is original code written for this project. That covers the SFZ sampler, mixer,
convolution reverb and generated impulse responses, dynamics, loudness meter and procedural SFX. None of it needs
third-party credit.

## SoundFonts — General MIDI banks (`audio/assets/sf/`)

| id | file | size | source | author | license | attribution |
|---|---|---|---|---|---|---|
| `gm` / `gu` | GeneralUser-GS.sf2 (v2.0.3) | 30.8 MB | https://github.com/mrbumpy409/GeneralUser-GS (raw file from `main`) | S. Christian Collins | GeneralUser GS License v2.0: "You may use GeneralUser GS without restriction for your own music creation, private or commercial." | no |
| `ms` | MuseScore_General.sf2 (v0.2) | 205.6 MB | https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/ | Frank Wen, Michael Cowgill, S. Christian Collins (+ Ethan Winer, Michael Schorsch) | MIT (the notice must stay with the *soundfont* if redistributed; not needed for music made with it) | no |
| `fluid` | FluidR3_GM2-2.sf2 (Fluid R3 GM2-2) | 141.5 MB | https://ftp.osuosl.org/pub/musescore/soundfont/fluid-soundfont.zip | Frank Wen (+ contributors); GM2-2 edit for MuseScore | MIT (Fluid R3 re-released under MIT in 2008). The original readme also says commercial music is allowed. | no |

License texts and readmes are in `audio/assets/sf/docs/`.

## Dedicated instruments — SF2 (`audio/assets/sf/extra/`, details in `extra/SOURCES.json`, license texts in `extra/licenses/`)

| id | file | instrument | author | license | attribution |
|---|---|---|---|---|---|
| `jrhodes3` | jrhodes3.sf2 (79 MB) | Rhodes Mk I, 5 layers, unlooped | Jeff Learman | Author's license: "License for musicians using this to make music: CC0". **Do not redistribute the samples** (CC BY-NC 4.0 for redistribution). | no (courtesy) |
| `jrhodes3c` | jrhodes3c-stereo.sf2 (33 MB) | same, looped, stereo chorus | Jeff Learman | same as above | no |
| `fmep` | freepats-fm-epiano1.sf2 (44 MB) | DX7-style FM e-piano | FreePats (Roberto) | CC0-1.0 | no |
| `fptenor` | freepats-tenor-sax.sf2 (28 MB) | tenor sax (samples: Versilian VCSL) | Versilian Studios / FreePats | CC0-1.0 | no |
| `salamander` | salamander-grand-v3.sf2 (1.27 GB) | Yamaha C5 grand, 16 layers | Alexander Holm (samples), FreePats (SF2) | **CC-BY-3.0** | **yes** |
| `ydp` | ydp-grand.sf2 (118 MB) | Yamaha Disklavier grand | Zenph Studios / OLPC; FreePats | **CC-BY-3.0** | **yes** (if used) |
| `uprightkw` | upright-piano-kw.sf2 (57 MB) | Kawai upright | FreePats (Gonzalo, Roberto) | CC0-1.0 | no |
| `fpguitar` | spanish-classical-guitar.sf2 (20 MB) | nylon guitar | FreePats | CC0-1.0 | no |
| `fpperc` | freepats-world-percussion.sf2 (9 MB) | cajon, bongos, shaker, claves, conga… | FreePats / VCSL | CC0-1.0 | no |
| `avlbop` | avl-blonde-bop.sf2 (31 MB) | bop jazz kit (sticks) | Glen MacArthur (AVL Drumkits) | CC-BY-SA-3.0 **with explicit exception**: "You are free to distribute or sell any music you create with these kits without attribution" | no |
| `avlhotrods` | avl-blonde-bop-hotrods.sf2 (30 MB) | same kit, hot-rod sticks | Glen MacArthur | same | no |
| `avlperc` | avl-buskmans-holiday.sf2 (45 MB) | congas, shakers, cajon, claves… | Glen MacArthur | same | no |

Source pages: jRhodes3, https://musical-artifacts.com/artifacts/1489. FreePats, https://freepats.zenvoid.org/.
AVL Drumkits, https://www.bandshed.net/avldrumkits/.

## Dedicated instruments — SFZ (`audio/assets/sfz/`, played by `audio/lib/sfz.mjs`)

| sfz id(s) | pack | author | license | attribution |
|---|---|---|---|---|
| `weresax-alto` | Karoryfer Weresax (alto) | Karoryfer Lecolds | CC0-1.0 ("royalty-free for all commercial and non-commercial use") | no |
| `mtg-alto/tenor/soprano/bari` (+`-looped`) | MTG Solo Saxophones, https://github.com/sfzinstruments/MTG.SoloSax | Music Technology Group, Universitat Pompeu Fabra (good-sounds.org); mapping by kinwie | **CC-BY-4.0** (source samples CC-BY-3.0) | **yes** |
| `vsco-trumpet*`, `vsco-trombone*` | VSCO 2 Community Edition, https://github.com/sgossner/VSCO-2-CE | Versilian Studios | CC0-1.0 ("use these samples for ANY purpose") | no |
| `vcsl-vibes-soft/hard` | VCSL Vibraphone, https://github.com/sgossner/VCSL | Versilian Studios | CC0-1.0 | no |
| `meatbass-pizz` | Karoryfer Meatbass, pizzicato only | Karoryfer Lecolds | CC0-1.0 | no |
| `swirly-brushes` | Karoryfer Swirly Drums (brushes), close mics | Karoryfer Lecolds | CC0-1.0 | no |
| `virtuosity-kit` | Virtuosity Drums (mid mic + aux percussion) | Versilian Studios & Karoryfer | CC0-1.0 | no |
| `wurlitzer`, `cp80`, `pianet` | Greg Sullivan E-Pianos, https://github.com/sfzinstruments/GregSullivan.E-Pianos | Greg Sullivan; mapping kinwie | **CC-BY-3.0** | **yes** (if used) |

**Rejected during research, not downloaded:** Arachno and SGM (built from ripped commercial sounds). Timbres of
Heaven (no clear license). Musyng Kite (sample provenance can't be checked). "Stereo Legato Saxophones" (sampled
from Soundtrap). Lithalean's saxes (license unclear). Carlos Vaquero's bass (original samples are non-commercial).
Items behind a login or bot check: Freesound MTG trumpet, Pianobook flugelhorn, and musical-artifacts under a
Cloudflare challenge.

## Reverb impulse responses

These are generated procedurally by `audio/lib/fx.mjs` (Gaussian noise, per-band exponential decay, synthetic
early reflections). They are original, no license applies.

## Sound effects (`audio/assets/sfx/`)

There are 134 processed files: 48 kHz / 24-bit stereo, peak-normalised one-shots and loudness-normalised
seamless loop beds. 129 are **CC0 1.0** and 5 are **U.S. government public domain** (National Park Service).
**No attribution is required for any file.** Providers: BigSoundBank / LaSonotheque (Joseph Sardin et al.), 94
files. Kenney.nl, 13. OpenGameArt.org CC0 entries, 21. NPS, 5. Wikimedia Commons (Felix Blume, CC0), 1. The
per-file source page, direct URL, author and license-verification notes are in `audio/assets/sfx/CREDITS.sfx.md`
and `audio/assets/sfx/index.json`. Processing can be reproduced with `node audio/assets/sfx/build-sfx.mjs`.

Optional courtesy line:

> Sound effects: BigSoundBank / LaSonotheque.org, Kenney.nl, OpenGameArt.org contributors, U.S. National Park Service, Felix Blume (CC0 / public domain).

The procedural generators in `audio/lib/sfx.mjs` are original code.
