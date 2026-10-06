---
name: audio-mix
description: Mix a rendered score with ElevenLabs narration takes into the film's full mix — VO offsets, voice-forward balance, sidechain ducking, loudness target. Use whenever (re)building a full mix for a film.
---

# Full-mix procedure (score + narration)

Inputs: score render (e.g. `audio/build/wrenkite_lullaby.wav`, 48k) + per-beat VO MP3s
(`audio/build/tts/wk_beat01–12.mp3`). Voice enters each beat at `T[k]+1.5s`; offsets in ms for
wrenkite: `1500,23800,56700,92800,143900,172500,205100,255000,287100,321500,353300,397100`.

Chain per voice: `adelay=<off>|<off>,volume=1.6` (+4dB; her peaks are hot, this is intentional —
she must sit ~9dB above the bed). Score: `volume=0.5` (−6dB). Sum voices with
`amix=12:normalize=0`, then duck the score under her with
`sidechaincompress=threshold=0.025:ratio=6:attack=250:release=900:makeup=1` keyed off the VO bus,
sum music+VO with `amix=2:normalize=0`, finish `loudnorm=I=-16:TP=-1.5:LRA=11,atrim=0:<DUR>`.

## Rules that have bitten before

- **A filter output label feeds exactly one input.** The VO bus goes to the sidechain AND the
  final sum — insert `asplit[vo1][vo2]` after the voice `amix` and use each branch once.
  Reusing `[vo]` twice silently drops the voice from the mix (correlation 0.02 instead of ~0.83).
- **Verify the voice is in the file, don't trust levels.** Cross-correlate a known take against
  the mix at 8kHz (`np.correlate` on f32le dumps): want peak >0.5 at the expected lag. Mean/max
  volumes alone can't prove presence (independent loudnorm gains make them misleading).
- **Force every leg to the full duration.** `adelay` does not pad: each voice stream is only
  `offset+length` long, the voice `amix` ends at the last voice's tail, and `sidechaincompress`
  can truncate the music to the sidechain's length — silently cutting the credits coda. After the
  voice `amix`, add `apad=whole_dur=<DUR>` (before the `asplit`), `apad` the ducked music too,
  pass `duration=longest` explicitly to both `amix`es, and finish
  `apad=whole_dur=<DUR>,atrim=0:<DUR>` before `loudnorm`. Verify with `ffprobe` that the mix is
  exactly `<DUR>` and that the coda region has real level.
- **SFX stems render hot** (wind/crackle peak near full-scale pre-fader). Keep sfx track gains
  conservative (`air -16`, `rain` low enough to sit ~8dB under her quietest scene) and re-check
  the rain/thorn-tree region after every render.
