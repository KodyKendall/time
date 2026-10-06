---
name: elevenlabs-voice-narration
description: Generate film narration with ElevenLabs Eleven v4 and the Lauren voice — audio-tag emotion direction, voice settings, CLI usage, budgets and manifests. Use whenever generating, re-voicing, or directing spoken narration, dialogue, or voiceover for a film.
---

# ElevenLabs Voice Narration

Project defaults: model `eleven_v4`, voice **Lauren** (`DODLEQrClDo8wCz460ld` — Friendly, Comforting and Soft). Generate through `tools/tts.mjs` so every call is logged to `audio/build/tts/manifest.json` and checked against `--budget` before sending. Auth comes from `ELEVENLABS_API_KEY` (env or local `.env`; never commit the key).

Plan requirement: the ElevenLabs API needs a **paid plan** for library voices (Lauren) and cloned voices — on a free plan every generation returns 402/401. Upgrade at elevenlabs.io/app/settings/billing before generating.

Key rules:

- **Emotions go in audio tags, not adverbs.** v4 ignores the `style` voice setting — delivery direction comes from bracketed tags in the text, which are *not* spoken. Narrative emotion prose ("she said sadly") *is* spoken aloud, so never use it as direction; use a tag instead.
- **Match tags to Lauren's character.** Warm, soft, comforting. She takes gentle tags well (`[softly, with wonder]`, `[warm, intimate narration]`); don't force shouting or sarcasm on her.
- **Lauren is narration-first.** For a substantially different character voice, pick another voice with `--voice` rather than pushing her somewhere she doesn't fit.

## Commands

```bash
node tools/tts.mjs --text "The first move is what sets everything in motion." --id line01
node tools/tts.mjs --file narration.txt --id scene02 --emotion "quiet, reflective narration"
node tools/tts.mjs --voices     # list voices
node tools/tts.mjs --spend      # spend so far
```

Options: `--voice <id>` (override, or set `ELEVENLABS_VOICE_ID`), `--model eleven_v4` (default) or `--turbo` (faster, slightly lower quality), `--emotion "<tag>"` (prepended as `[<tag>]`), `--stability 0-1`, `--similarity 0-1`, `--speed 0.7-1.2`, `--seed <int>` (deterministic retries), `--prev/--next "<text>"` (continuity across split generations), `--play`, `--out`, `--budget`, `--format`.

Output: MP3 to `audio/build/tts/<id>.mp3` (gitignored generated audio). Keep the `--id` stable per line so re-takes overwrite cleanly and the manifest stays readable. `--play` alone previews without saving; with `--out`/`--id` it saves and then plays.

## Directing emotion on v4

Place tags immediately before (or after) the line they modify. Combine tags for complex delivery. Prefer a few well-chosen tags over peppering every sentence.

Voice/emotion tags:

- `[whispers]`, `[sighs]`, `[exhales]`, `[laughs]`, `[chuckles]`, `[giggles]`
- `[sarcastic]`, `[curious]`, `[excited]`, `[crying]`, `[mischievously]`, `[sympathetic]`, `[reassuring]`
- Descriptive direction: `[Low, steady voice, restrained urgency]`, `[Warm, intimate narration]`, `[Building tension, measured pace]`, `[Softly, with wonder]`, `[Gentle pause, then quiet realization]`
- Adverb tags for dialogue: `[excitedly]`, `[warmly]`, `[nervously]`, `[deadpan]`

Pauses and emphasis (v4 does **not** support SSML `<break>` tags):

- `[short pause]` / `[long pause]` / `[Brief pause]`
- Ellipses `...` for hesitant weight, em-dash `—` for cuts, CAPS for emphasis on single words

Pronunciation: v4 understands IPA wrapped in slashes (`"/ˌsænfrənˈsɪskoʊ/"`); otherwise respell phonetically. Expand numbers/abbreviations into speakable words ("forty-two dollars", "Doctor", "January first").

Example narration passage:

```text
The rain had stopped before dawn, leaving the old road silver beneath the moon.

[Quiet, reflective narration] She had promised herself she would not return. Yet there she was, standing before the gate with mud on her boots and the key cold against her palm.

[Softly, with wonder] On the table in the entryway sat a single lantern, already lit.
```

## Workflow

1. Write the narration script first, with tags inline. One file per scene (`--file`) beats many `--text` calls.
2. Generate a short test line before a full scene; listen, adjust tags/settings, then render the scene.
3. For long scenes, split at natural breaks and chain with `--prev/--next` for continuity; keep the same `--seed` family and settings across the chain.
4. Record cost: `audio/build/tts/manifest.json` holds every call (chars, voice, model). Check `--spend` against the film's budget before large batches (~10k chars/request max on v4).

## What NOT to do

- Don't write direction as speakable prose ("he said, his voice trembling") — it will be read aloud.
- Don't use SSML `<break>` tags or the `style` setting on v4 — both are ignored.
- Don't stack contradictory tags (`[shouting]` + `[whispers]`) or tags that fight Lauren's soft register.
- Don't confuse tags with sound effects: `[gunshot]`, `[applause]` render as *sounds*, not delivery.
- Don't generate large batches without checking `--spend` first.
