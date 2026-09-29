# Handoff: continue the Leo painted short on a Mac (2026-09-29)

Read this first, then `docs/leo/PILOT.md` (shot list, cue sheet, narration, Leo art rules).

## What this is
A 30–50 second painted animation of Leo (the LlamaPress llama) with an original score, both
written in code on the TIME engine (see `README.md`). Story: a spreadsheet → Leo reads it →
Leo builds a web app. Tagline "Spreadsheet → web app."

It was built on the LlamaPress mothership, a Linux box with 2 CPUs, ~2 GB free RAM and no GPU.
Previews there ran on SwiftShader (CPU WebGL) at ~1.15 s/frame at 640–960 wide, under a
1.8 GB memory cap that OOM-killed long renders. This Mac (M4, 48 GB) exists to do what that
box could not: fast previews and the final 1080p/4K render on the real GPU (Metal).

## Where things are
| What | Path |
|---|---|
| Plan, cue sheet, Leo rules | `docs/leo/PILOT.md` |
| 30 s score / 50 s score | `audio/scores/leo_pilot.mjs` / `audio/scores/leo_pilot_50.mjs` |
| Leo film definition + scenes | `web/src/leo.js`, `web/src/scenes/leo_{sheet,lib,forms,app}/` |
| Shared Leo drawing code | `web/src/scenes/leo_lib/leo.js` |
| Headshot generation notes | `docs/leo/leo_headshot_runs.json` |
| Token cost counter | `tools/claude_usage.py <session.jsonl> [--since ISO]` |

The film id is `leo` (`--film leo`).

## Setup (in order)
1. `brew install node ffmpeg` and install Google Chrome in `/Applications`.
2. `git clone -b leo-pilot https://github.com/KodyKendall/time leo-film && cd leo-film`
3. `npm install`
4. `node tools/patch-brush.mjs` (re-vendors patched p5.brush into `web/vendor/`; the committed
   copy should already work, this just makes sure).
5. **Audio assets are NOT in git** (`audio/assets/` is gitignored: sample libraries, licence
   limits). Get `leo-film-audio.tgz` from the mothership at
   `/home/ubuntu/Leonardo/tmp/leo-film-mac/leo-film-audio.tgz` and run
   `tar xzf leo-film-audio.tgz` in the repo root. It holds `audio/assets/sf/GeneralUser-GS.sf2`
   plus the two finished mixes `audio/build/leo_pilot_v1.wav` (30 s) and
   `audio/build/leo_pilot_50.wav` (50 s). Video renders do not need it; music renders do.
6. GPU check: `node tools/gputest.mjs`. The renderer line must name the Apple GPU. If it says
   **SwiftShader**, Chrome is on the CPU and every render will be as slow as the old box — stop
   and fix that first. On macOS, `tools/cli.mjs` and `tools/gputest.mjs` default to
   `ANGLE=metal` and the standard Chrome path; override with `ANGLE=` / `CHROME=` if needed.

## Commands
Do NOT use `tools/preview.sh` here — it is the mothership's memory-capped wrapper
(`systemd-run`, max 960 wide) and exits on macOS. Call the CLI directly:

```bash
# contact sheet (fast look at the whole film)
node tools/cli.mjs sheet --film leo --w 1280 --from 0 --to 50 --n 16 --name leo_look
# a still
node tools/cli.mjs still --film leo --w 1920 --t 12 --name leo12
# seam check at scene hand-offs (edit its FPS/boundaries for the leo film)
python3 tools/seams.py --w 960
# music (about 20 s)
node audio/render.mjs audio/scores/leo_pilot_50.mjs audio/build/leo_pilot_50.wav --workers 4
# final render with sound, parallel + resumable
node tools/render_parallel.mjs --film leo --w 1920 --fps 30 --from 0 --to 50 --workers 4 \
  --audio audio/build/leo_pilot_50.wav --out out/leo_1080.mp4
```

First job on this Mac: render the 50 s cut at 1920 and write down the seconds per frame
(the CLI prints `avg X s/f`). Baseline on the mothership: 1.15 s/f at 960 wide, 17.3 min for
900 frames. Nobody has measured the M4 yet; the guess was 5–15 min for 30 s at 1080p.

## State of the film
- **v1–v3** (Codex wrote the scenes): music and timing were loved (Darren: "the music is
  wonderful, the timing lining up with the animation"); picture went from blurry/abstract (v1)
  to clear but flat (v2) to clear with painted texture (v3).
- **v4** (30 s): LlamaPress purple (`#0B0620`/`#120A33`, violet glows); sheet rows land on the
  marimba notes (`ROW_CUES`, +31..+70 ms); four thinking bubbles 10.6–14.4 s; app in a browser
  window with `jobs.llamapress.ai`, bell, "Jamie JH" avatar.
- **v5** (50 s, current): `leo_pilot_50.mjs`, 6+6+6 bars + 2-bar ending; one sheet row per
  half-bar marimba note; three bubbles; captions "Your spreadsheet." / "Leo reads it." /
  "Leo builds your web app."; tagline. Seams 0.00.

## Open work
1. Final 1080p (then 4K if it earns it) render on this Mac.
2. Painted texture is lighter than TIME's; the sheet-to-Leo swirl may need more brushwork.
   Judge sharpness at 960+ wide, never 640.
3. Narration: 3 lines, one female voice, not recorded. Add each line to the score as a
   `type: 'sample'` track on a `voice` bus and duck `music` under it in the score's `mix`
   block, so the soundtrack is one render.
4. Instruments are basic GeneralUser GS; swap in dedicated samples (see `audio/CREDITS.md`).

## Rules that cost us time
- **Leo's look:** his normal headshot, upright, close to the logo. Neck a bit longer with a
  SOFT end (no hard crop). Never long-necked, never woolly or rounded, no shoulders.
- Rectangles (sheet cells, app cards) must be "a rectangle with a painted rough edge". The
  painter's blob helper turns vague shapes into ovals.
- A spreadsheet reads as Excel through: column letters, row numbers, bold headers,
  right-aligned real numbers, the green selection border. An app reads as an app through: top
  bar, left nav, stat cards, a chart, status pills, a button. Otherwise it looks like a calendar.
- Score note times are SECONDS, not beats. The chord parser knows `13sus`, not `13sus4`.
- Judge the look from stills and contact sheets (seconds) before an animated pass (minutes).
- Scene API: `{ id, bg, paint(P) → assets, draw(R, lt, A) }` — paint once, animate with
  transforms/warps; per-frame brushwork only through `R.dyn`.

## Hand back
The mothership skill is `create_painted_short` (in the Leonardo repo, not here). Push work to
branch `leo-pilot`. When there is a finished render, send the mp4 back to the mothership so
it can be published on the internal CRM share link
https://rails-crm.llamapress.ai/p/B499BVhXXcHQywqPBjKp64pN7dCvgAeY (share link 133, project 64).
