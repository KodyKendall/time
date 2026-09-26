# Instrument mapping (smooth-jazz score)

Use the registry in `audio/lib/instruments.mjs`:

```js
import { inst } from '../lib/instruments.mjs';
{ id: 'sax', ...inst('altoSax'), notes: [...], bend: [...], cc: [...], gain: 0, pan: 0.05, reverb: 0.24 }
```

`inst(name)` spreads either `{ sf, bank, program, drums? }`, which plays a SoundFont through spessasynth_core, or
`{ sfz }`, which plays through the SFZ sampler in `audio/lib/sfz.mjs`. Both accept the same track fields: `notes`,
`cc`, `bend`, `bendRange` (default ±2 st), `transpose` and `keymap`. SFZ tracks also take `ccInit` and `sfzOverride`.
The tables below list the SoundFont and SFZ ids.

## Recommended mapping

"Max note" is the longest note that still sounds at full length. "∞" means the instrument is looped. For unlooped
sources the value is the shortest sample in the playable range; longer notes simply decay or end naturally.

| role | `inst()` name | source (sf id bank:prog / sfz id) | keys | quality notes | max note |
|---|---|---|---|---|---|
| **Rhodes** | `rhodes` | `jrhodes3` 0:0 | 24–103 | 65 samples × 5 velocity layers, 44.1 kHz, natural 1.4–25 s decays. Clearly the best: bark at high velocity, bell tone. | decays (1.4 s top … 25 s low) |
| Rhodes (chorused) | `rhodesChorus` | `jrhodes3c` 0:0 | 24–103 | Looped stereo version with built-in chorus; compressed. | ∞ |
| DX / FM EP | `fmPiano` | `fmep` 0:0 | 27–98 | DX7 "E.Piano 1", 3 layers, 7–25 s. | ≥ 7 s |
| Wurlitzer | `wurlitzer` | sfz `wurlitzer` | 33–96 | 4 layers, looped (the author notes some loop artifacts). | ∞ |
| **Acoustic grand** | `piano` | `salamander` 0:0 | 21–108 | Yamaha C5, 16 layers, 48 kHz stereo, 38 dB velocity range. Loading takes ~1.8 s and ~4 GB RAM per worker. | decays (≥ 2.6 s) |
| grand (light) | `pianoLight` | `ms` 0:0 | 12–108 | "Splendid Grand" (Steinway D), 144 samples, looped, 6 layers. | ∞ |
| upright piano | `uprightPiano` | `uprightkw` 0:0 | 21–108 | Kawai upright, 2 layers. | mixed |
| **Vibraphone** | `vibes` / `vibesHard` / `vibesMotor` | sfz `vcsl-vibes-soft` / `-hard` / `-motor` | 53–89 | Real vibes, 2 layers, 3.6–11 s decays. The samples have no motor; `vibesMotor` adds a simulated motor tremolo (4.8 Hz, ±3 dB amplitude LFO). Every GM vibes preset is a 0.14–0.2 s single-cycle loop. | ≥ 3.6 s |
| clavinet | `clav` | `fluid` 0:7 | 0–108 | No better free clav found; short looped samples. | ∞ |
| **Alto sax** | `altoSax` | sfz `weresax-alto` | 49–80 | CC0. A sample every semitone, soft/loud × 2 round-robins, ~3.4 s crossfaded loops, bright "smooth-jazz" tone (centroid ~2.4 kHz). Velocity mostly switches timbre (~7 dB range), so shape dynamics with CC11. | ∞ |
| alto (alt.) | `altoSaxMTG` | sfz `mtg-alto-looped` | 44–81 | Warmer, 2 dynamics × 17 random takes (26 dB velocity range). The takes are 0.2–5 s long, so the `-looped` variant sustains them with the loops embedded in the FLACs. **CC-BY.** | ∞ |
| **Tenor sax** | `tenorSax` | `fptenor` 0:0 | 43–89 | CC0 (VCSL samples). 46 samples, 2 layers, 4–9 s samples with 5 s loops, seam −64 dB. | ∞ |
| tenor (alt.) | `tenorSaxMTG` | sfz `mtg-tenor-looped` | 39–76 | Same caveats as MTG alto. | ∞ |
| **Soprano sax** | `sopranoSax` | sfz `mtg-soprano-looped` | 51–88 | Only real free soprano found. **CC-BY.** | ∞ |
| bari sax | `bariSax` | sfz `mtg-bari-looped` | 32–69 | **CC-BY.** | ∞ |
| **Trumpet** | `trumpet` | sfz `vsco-trumpet` | 52–84 | Real sustains, 2 layers, 25 dB velocity range, unlooped 5.6–15 s. Slightly classical tone. | 5.6 s |
| trumpet vibrato | `trumpetVib` | sfz `vsco-trumpet-vib` | 52–84 | Lyrical vibrato sustains. | 4.3 s |
| **horn stabs** | `trumpetStac`, `tromboneStac` | sfz `vsco-trumpet-stac`, `vsco-trombone-stac` | 52–84 / 34–70 | Real staccato samples, best for section stabs. Pair them with `altoSax` / `tenorSax`. | 0.75 s |
| harmon mute | `mutedTrumpet` | `fluid` 0:59 | 0–96 | Clean looped harmon sample (seam −47 dB). The alternative sfz `vsco-trumpet-harmon` is brighter and noisier. | ∞ |
| straight mute | `straightMute` | sfz `vsco-trumpet-straight` | 58–84 | | 6.2 s |
| flugelhorn | `flugelhorn` | sfz `vsco-trumpet` + LP 3.8 kHz / +2 dB lows | 52–84 | **No free flugelhorn exists**; this is a darkened trumpet stand-in. Play it soft (v ≤ 80). | 5.6 s |
| **Trombone** | `trombone` | sfz `vsco-trombone` | 34–65 | 31 samples, 28 dB velocity range, 4–9 s. | 4.2 s |
| french horn / section pad | `frenchHorn` / `brass` | `fluid` 0:60 / 0:61 | 0–96 | GM quality. The `brass` loop seam is audible on long notes (−10 dB). | ∞ |
| **Upright bass** | `uprightBass` | sfz `meatbass-pizz` | 12–79 | Real jazz pizzicato, 4 layers × 4 round-robins (1958 Rubner bass). | decays 2–4 s |
| **Fretless bass** | `fretlessBass` | `fluid` 0:35 | 0–84 | No cleanly licensed dedicated fretless exists. 48 kHz, 2 layers, looped. Use `bend` for slides. | ∞ |
| finger bass | `fingerBass` | `ms` 0:33 | 0–84 | | ∞ |
| nylon guitar | `nylonGuitar` | `fluid` 0:24 | 0–127 | Clean, 9 velocity zones. The CC0 `fpguitar` 0:0 is longer (4.7 s) but noisy. | ∞ |
| string pad | `strings` / `stringsFast` | `gm` 0:49 / 0:48 | 0–110 | GeneralUser slow strings have the cleanest loops (seam −45 dB vs −19 dB in Fluid/MS). | ∞ |
| **Jazz kit (sticks)** | `jazzKit` | `avlbop` 0:0 (melodic preset, GM keys) | 35–61 | Real bop kit, 5 velocity layers, 13–35 dB dynamics per piece. | one-shots |
| jazz kit (GM) | `jazzKitGM` | `gm` drums 32 | 24–87 | GeneralUser GS Jazz kit: multi-sampled kick/snare/hat, 22–44 kHz. | |
| **Brushes** | `brushKit` | sfz `swirly-brushes` | 36–64 | Real brush kit with *stirs*, round-robins, CC-driven mixes (close mics). | one-shots (stirs ~2 s) |
| brushes (alt.) | `brushKitRods` / `brushKitGM` | `avlhotrods` 0:0 / `gm` drums 40 | | Hot-rod sticks / GeneralUser Brush kit (38 tap, 39 slap, 40 swirl). | |
| **Latin percussion** | `percussion` | sfz `virtuosity-kit` (mid mic) | 35–96 | GM keys: bongos 60/61, congas 62/63/64, cabasa 69, maracas 70, claves 75, triangle 80/81, shaker 82, jingle 83, bell tree 84, agogo 67/68, tambourine 54, cowbell 56. | one-shots |
| timbales / woodblock | `timbales` | `gm` drums 0 | | Timbales 65/66 and woodblocks 76/77 (missing from Virtuosity). | |
| congas/cajon (alt.) | `latinPerc` | `avlperc` 0:0 + `AVL_PERC_KEYMAP` | | Remaps GM conga, shaker, claves, cowbell and tambourine keys onto the AVL Buskman's Holiday kit. | |

## Drum-key cheat sheet (`music.mjs` exports `DRUMS`, `BRUSH`, `PERC`)

- **`jazzKit` (AVL Blonde Bop):** 36 kick · 37 side-stick · 38 snare · 40 snare edge · 41/43 floor tom (centre/edge) · 45/47 tom · 42 closed hat · 44 pedal hat · 46 semi-open hat · 48 swish hat · 49 crash (50 = crash **choke**, avoid) · 51 ride tip · 52 ride choke · 53 ride bell · 59 ride shank · 55 splash · 57 crash 2.
- **`brushKit` (Swirly):** 36 kick · 38 brush tap (main) · 40 edge · 39 dig · **60 slow stir, 64 fast stir, 62 muted stir, 61/63 flutters.** Stirs are ~2 s swishes with a soft attack; retrigger them on 1 and 3, or on every beat. A new stir cuts the previous one. 42 tight hat · 44 foot · 46 hat, where CC4 sets openness (0–26 closed … 103–127 open; send e.g. `{t, n:4, v:120}` before an open hit) · 49 crash · 51 ride · 41/45/47 toms.
- **`percussion` (Virtuosity, mid mic):** GM percussion keys as listed above. Key 42 is a closed hat because the default CC4 is 127. Send CC4 values below 96 for open hats.
- **GM kits (`jazzKitGM`, `brushKitGM`, `timbales`):** standard GS map. The brush kit uses 38 tap, 39 slap, 40 swirl.

## Expression tips

- **Pitch bend:** values run −1…1 × `bendRange` (default 2 st, also on SFZ). `music.mjs` has `scoop`, `fall`, `doit` and `vibrato`. Bends are rendered as smooth glides with 0.67 ms steps.
- **Dynamics:** SF2 tracks respond to CC7/CC11 in the synth. SFZ tracks apply CC7/CC11/CC10 at the channel level when the instrument doesn't map them itself. Use `ccRamp(11, t0, t1, from, to)` for swells.
- **Weresax native vibrato:** CC111 sets depth and CC112 sets rate. You can also use the `vibrato()` bend helper.
- **Reverb/chorus sends:** CC91/CC93 in a track become mixer send automation (value/127).

## Evaluation (how the choices were made)

`node audio/scripts/compare-fonts.mjs [instrument]` renders the same test phrase through every candidate. The
phrase is a 3.2 s long note, a velocity ladder at v30/60/90/120, a 16th-note run over an octave, the octave range
and a 5-note chord. The script inspects sample data and measures the render. Results:
`audio/build/compare/report.md|json`. Loudness-matched A/B files: `audio/build/compare/<instrument>_AB.wav` (+ `.png`
spectrogram).

Highlights for the key instruments. "vel dB" is the level difference between v120 and v30. "flutter" is the
envelope variation during the sustain; low means a steady loop. "seam" is the loop-point mismatch.

| instrument | candidate | sample len @ key | loop len / seam | layers @ key | rate | vel dB | verdict |
|---|---|---|---|---|---|---|---|
| alto sax | GeneralUser 0:65 | 0.41 s | 5 ms single-cycle / −35 dB | 1 | 44.1k | 20 | synthetic, static partials |
| | Fluid 0:65 (= MuseScore) | 0.66 s | 216 ms / −36 dB | 1 (9 vel zones, stereo) | 32k | 24 | OK GM sax, dull above 10 kHz |
| | **Weresax (sfz)** | ~3–6 s | 3.4 s crossfade loops | 8 (2 dyn × 2 RR × 2 mics) | 44.1k | 7 | **chosen**: real, bright, smooth sustain (flutter 0.043) |
| | MTG alto (sfz) | 0.2–5 s takes | embedded loops (no_loop as shipped) | 17 random takes × 2 dyn | 48k | 26 | real, warm; use the `-looped` variant |
| tenor sax | Fluid 0:66 | 2.35 s | 257 ms / −26 dB | 1 | 32k | 24 | OK |
| | **FreePats tenor** | 6.75 s | 5.1 s / −64 dB | 2 | 48k | 20 | **chosen** |
| trumpet | GeneralUser 0:56 / 1:56 | 0.23 s | 2 ms / −21 dB | 1 | 31k | 18–24 | synthetic |
| | Fluid 0:56 (= MuseScore) | 0.38 s | 199 ms / −22 dB | 1 | 44.1k | 25 | weak (its author: "trumpets suck") |
| | **VSCO2 sus (sfz)** | 5.6–15 s | unlooped | 2 | 44.1k | 25 | **chosen**: real sustains, 0 dB droop over 3 s |
| Rhodes | GeneralUser 0:4 | 0.16 s | 5 ms / −46 dB | 3 | 44.1k | 22 | synthetic tine loop |
| | Fluid 0:4 "Rhodes EP" (= MuseScore) | 1.45 s | 23 ms / −33 dB | 2 | **22 kHz** | 24 | dull, nothing above 11 kHz |
| | **jRhodes3** | 14.8 s | unlooped | 5 | 44.1k | 26 | **chosen** |
| jazz drums | GeneralUser Jazz (128:32) | 0.15–4.3 s | — | 3 (snare/kick/hat multi-sampled) | 22–44k | 20–25 | good GM kit |
| | Fluid/MuseScore Jazz | 0.35 s snare | — | 1 (filter-velocity) | 44.1k stereo | 15–23 | single-sample dynamics |
| | **AVL Blonde Bop** | 0.5–12 s | — | 5 | 44.1k | 13–35 | **chosen** |
| brushes | GeneralUser Brush (128:40) | 0.34 s | — | 3 | 44.1k | 19–24 | OK, short swirl loop |
| | Fluid Brush | 0.6 s | — | 1 | 44.1k | 20–25 | single sample |
| | **Swirly (sfz)** | 0.6–3 s | — | round-robins | 44.1k | 10–28 | **chosen**: real stirs |
| piano | GeneralUser 0:0 | 2.0 s | 1 s / −18 dB | 1 | 31k | 18 | |
| | MuseScore 0:0 (Splendid Grand) | 7.3 s | 1.8 s / −28 dB | 2 | 44.1k | 18 | good light option |
| | **Salamander** | 16 s | unlooped | 16 | 48k | 38 | **chosen** |
| vibes | GM (all three) | 0.14–0.2 s | 3–23 ms | 1 | — | 20–24 | synthetic, loop decays |
| | **VCSL soft/hard (sfz)** | 3.6–11 s | unlooped | 2 | 44.1k | 15–18 | **chosen** |

## Caveats

- **Loop quality:** the MTG `-looped` variants and the Wurlitzer have not been checked by ear. Short embedded loops (~80 ms) may sound static on very long notes; prefer Weresax / FreePats tenor for long holds.
- **VSCO brass is unlooped:** notes longer than ~5.6 s (trumpet) or ~4.2 s (trombone) fade out naturally. The harmon-mute SFZ has audible noise; the GM harmon is cleaner.
- **Fretless bass and clavinet are GM quality only.** No cleanly licensed dedicated versions exist.
- **Weresax's velocity range is small (~7 dB).** Use CC11 (expression) for dynamics; velocity ≥ 64 switches to the forte samples.
- **Salamander uses ~4 GB RAM per render worker.** With 8 workers and several piano tracks, pass `--workers 4`, or use `pianoLight`.
- **Mic rumble:** some SFZ saxes (Weresax dynamic mic) carry low-frequency rumble. Keep a high-pass (≥ 120 Hz) in the track `eq`.
