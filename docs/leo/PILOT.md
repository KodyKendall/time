# LEO — painted short, pilot (30 s)

A 30-second painted animation with an original score and a short narration. It tests one new
video type for LlamaPress: **the painted short**. The engine is the TIME engine in this repo
(p5.brush painting + WebGL compositor + JS music toolkit), unchanged.

Status: v1 rendered and reviewed (https://rails-crm.llamapress.ai/p/B499BVhXXcHQywqPBjKp64pN7dCvgAeY). v2 = new picture, same music and timing.

## Format

| | |
|---|---|
| Length | 30 s = 12 bars at 96 BPM, 4/4 (1 bar = 2.5 s) |
| Picture | 1920×1080 design units, 30 fps. Final render 1920 wide (4K later if it earns it) |
| Film file | `web/src/leo.js` (`--film leo`) |
| Scenes | `web/src/scenes/leo_sheet/`, `leo_forms/`, `leo_app/`, shared `web/src/scenes/leo_lib/` |
| Score | `audio/scores/leo_pilot.mjs` (GeneralUser GS only for now) |
| Rule | **No cuts, fades, wipes or dissolves.** Every hand-off is a transformation of a shared element (same rule as TIME, `docs/shotlist.md`). The last frame loops into the first. |

## Art direction (v2, after Darren's review of v1, 2026-09-28)

Darren on v1: loved the storyline, the music and the timing. Problems: blurry, Leo too blocky and
"cut off at the neck", the spreadsheet "looks like a calendar", and the whole thing too abstract.
v2 fixes the PICTURE only. Keep the storyline, the timing and the cue sheet.

- **Must read instantly, in order: "that is a spreadsheet" → "that is Leo" → "that is an app".**
  Painted, but concrete. A viewer who pauses on any frame can name what they see.
- **Crisp, not blurry.** Clean ink outlines on top of the washes. Wash bleed small. The paper
  and every card have clean straight edges (a light hand-painted wobble is fine; no jagged or
  sawtooth edges, no clouds bleeding past the edge).
- **The spreadsheet looks like EXCEL, not a calendar.** Excel green (`#217346`, darker
  `#185c37`) carries it:
  - A green title/ribbon band across the top of the sheet window, with a small white grid icon
    and the file name `jobs.xlsx`.
  - A formula bar under it: a `fx` label and `=SUM(E2:E9)`.
  - Column letters `A B C D E F` in a light grey header row, and row numbers `1`–`10` down the left.
  - Thin grey gridlines on WHITE cells (`#ffffff` / `#fbfbf8`). Not cream clouds, not a wash
    over the whole sheet.
  - Row 1 = real bold headers: `Job`, `Client`, `Status`, `Date`, `Total`. Rows 2–9 = real,
    short, readable values (e.g. `Roof repair`, `Hansen`, `Done`, `9/12`, `$4,200`). Numbers
    right-aligned. A total row with `$38,450`.
  - A selected cell with the thick Excel-green border and the little square handle in its corner.
  - Text via `P.text` (real fonts), so it is legible. Many narrow cells with small text, so it
    never reads as a calendar (a calendar is 7 big square boxes).
- **The app looks like an APP.** A clean app window: a top bar (logo dot + app name `Jobs`),
  a left nav with 4 items, a row of 3 stat cards (`Open jobs 12`, `This month $38,450`,
  `Done 31`), a small bar chart, a list with check marks and status pills, and a green
  `+ New job` button. The SAME data as the sheet, so the viewer sees the sheet became the app.
  Mostly white/light grey UI with Excel green and one gold accent.
- **Background:** keep the night navy `#101a2e` so the white sheet, white Leo and the app pop.
- **Leo stays close to the logo** (Darren: "I like him pretty close to how he is now"). Same flat
  shapes, same ear, same blue eye `#4592e9` (the only saturated blue). NOT woolly, NOT fuzzy,
  NOT rounded into a new character, NO shoulders or body. Painted as clean white shapes with a
  crisp edge and a very light brush texture.
  - **The one change: the neck.** v1 ended the neck in a hard horizontal crop. Make the neck a
    bit LONGER (about 25–35% longer than the logo's neck) and let its bottom end SOFTLY: a
    brush-stroke taper or a gentle fade into the background over the last ~15% of its length.
    No hard horizontal cut. Do not overdo it; he must not read as a long-necked llama.
  - Upright, facing right, max 4° tilt. Moves by gliding, a small bob, blinks, an ear twitch.
- **Leo's geometry:** measured from `rails/app/assets/images/leo-llamapress-ai-mascot.png`
  (499×500) into `docs/leo/leo_headshot_runs.json` (white runs every 10 px + the eye:
  `cx 271.4, cy 234.1, r 30.5`). Parts in that 500-px space: back-of-head/neck arch x 97–222
  with a rounded top at y≈20; left neck band x 97–135 separated from the head by a thin dark
  C-shaped gap (~6 px); ear = narrow leaf, tip ≈(306, 25), base x 228–308 at y 150; head =
  rounded wedge x 165–449, y 160–345, snout right; body base x 97–311 from y≈380 down (this is
  the part to lengthen and soften). Keep these in `leo_lib/leo.js`.

## Shot list

| # | Segment | Bars | Time (s) | Picture | Hand-off to next (transformation) |
|---|---|---|---|---|---|
| 1 | **The sheet** (`leo_sheet`) | 0–4 | 0–10 | An Excel-style sheet window (see Art direction) floats in the night. The gridlines ink in (left to right, bar 0), then the headers and values type into cells one by one on the marimba notes (sparse in bars 0–1, denser in 2–3), each typed cell briefly showing the green selection border. At bar 2 a blue dot appears in one cell and **blinks** twice (the celesta "Le-O!" calls at 5.0 s and 6.6 s). Slow push-in toward that cell. | The grid lines **bend and flow** toward the blue dot (twirl/flow warp around it). The cell rules become the strokes of Leo's outline. |
| 2 | **Leo forms** (`leo_forms`) | 4–8 | 10–20 | On the bar-4 downbeat (10.0 s, flute motif + whoosh) the bent strokes **snap into Leo's headshot**: neck arch, ear, head, with the blue dot now his eye. Leo is painted: white wash fill, soft dry edge. He blinks (bar 5), bobs gently on the brush-kit beat, glides a little left and right looking at leftover floating spreadsheet cells, and his ear twitches on the vibes answer (bar 6). Strings swell through bar 7. | Leo glides to the left third of the frame. The floating cells he looks at **drift toward the right side and lock together** into app cards. |
| 3 | **The app** (`leo_app`) | 8–12 | 20–30 | Leo, left third, watching. On each glockenspiel note (20.0, 21.25, 22.5, 23.75, 25.0, 26.25 s) one piece of the app **unfolds** from a cell: top bar, left nav, the 3 stat cards, the bar chart, the job list with status pills, the green `+ New job` button. Bar 10: they settle into ONE clean app window (see Art direction) holding the same data the sheet had. Bar 11 (27.5 s): Leo blinks (celesta tag), a small cream caption paints in under him: `Leo · llamapress.ai`. | The app layout **folds back into a single cell**, and the cell's lines unroll into the empty sheet of frame 0 (loop). |

## Cue sheet (music ↔ picture)

The score is `audio/scores/leo_pilot.mjs`. Leo's motif is a leap up a major sixth then a falling
answer: **C5 → A5 | G5 E5 D5 C5** ("Le-O!").

| Bar | Time (s) | Picture event | Music |
|---|---|---|---|
| 0 | 0.0 | ledger rules ink in | pizzicato "ledger ticking" 8ths; sparse marimba (one cell per note) on Cmaj7 |
| 2 | 5.0, 6.6 | blue dot appears, blinks twice | celesta "Le-O!" call ×2 |
| 3 | 7.5–10 | lines bend toward the dot | G7sus4, marimba fills in |
| 4 | 9.1 → 10.0 | strokes snap into Leo | whoosh into the downbeat; **flute plays the full motif**; strings, bass, brushes enter |
| 5 | 12.5 | Leo blinks | Em7 → Am7 |
| 6 | 15.0 | ear twitch, looks at cells | **vibes answer the motif** an octave down |
| 7 | 17.5–20 | cells drift right | strings swell (expression ramp) into G13sus |
| 8 | 20.0 | first app card unfolds | flute + vibes motif together on Cmaj9; marimba full 8ths |
| 8–10 | 20.0–26.25 | one card per glock note | glockenspiel rising E6 G6 A6 C7 D7 E7 |
| 11 | 27.5–30 | Leo blinks, caption paints in; fold back to one cell | celesta "Le-O!" tag on Cmaj9, ends on the sixth, unresolved, so it loops |

## Narration (one female voice, `--voice female`)

Three short lines. The music leaves room for each one.

| Starts at | Line |
|---|---|
| 2.5 s | "Every business begins on a spreadsheet." |
| 11.5 s | "Leo reads what yours is trying to become." |
| 21.0 s | "Then builds it into an app your whole team can use." |

Make the voice with `bin/local/tts-narrate.py` in the Leonardo repo, then add each line to the
score as a `type: 'sample'` track on a `voice` bus. In the `mix` block, duck the `music` bus
under `voice` (`buses: { music: { duck: { key: ['voice'], depth: 6 } } }`, same shape as the
`sfx` duck in `audio/scores/mini.mjs`). So the music composes AROUND the narration and the whole
soundtrack stays one render.

## How to build it (for a coding agent)

1. Read `web/src/testfilm.js` (the smallest complete film), then `web/src/engine/paint.js`
   (the painter: `P.layer(name, {w,h}, (c) => …)`, `c.fillPoly`, `c.washPoly`, `c.hatchPoly`,
   `c.blob`, `brush.set/line`) and `web/src/engine/engine.js` (what `R` offers in `draw`:
   `R.layer`, `R.glow`, `R.particles`, transforms in `M`). Copy patterns from
   `web/src/scenes/cosmos.js` for warps and from `web/src/scenes/lib/kit.js` for geometry.
2. A scene is `{ id, bg, paint(P) → assets, draw(R, lt, A) }`. `paint` runs ONCE; `draw` runs
   every frame at local time `lt`. Paint layers once, animate them with transforms and warps.
   Per-frame repainting is expensive; avoid it unless the stroke itself must grow (use
   `R.dyn` / `P.dynamic` then, keyed on a coarse frame key).
3. Put Leo's polygons, his paint function and the ledger grid geometry in
   `web/src/scenes/leo_lib/`. Every scene imports them, so hand-off frames match exactly.
4. Hand-offs: the LAST frame of each segment and the FIRST frame of the next must look the
   same. Check with `python tools/seams.py --w 640 --b 10,20` (edit its FPS/boundaries if needed).
5. Previews on the mothership (no GPU, small RAM). Always wrap in the memory cap:
   ```bash
   export CHROME=$(ls -d ~/.cache/puppeteer/chrome/linux-151*/chrome-linux64/chrome) JS_HEAP_MB=900
   systemd-run --user --scope -q -p MemoryMax=1800M -p MemorySwapMax=0 nice -n 19 \
     node tools/cli.mjs sheet --film leo --w 640 --from 0 --to 30 --n 12 --name leo_look
   ```
   Contact sheets land in `out/`. Look at them after every change. Never run renders in
   parallel on this box, never raise the cap, never render above 960 wide here.
6. Done = a 12-frame contact sheet that reads as the shot list above, clean seams at 10 s and
   20 s, and Leo obeying the Leo rules on every frame.

## Open questions

- Final render needs a GPU machine (Kody's Windows box, which built TIME, or a RunPod pod).
  The mothership only does 640-wide previews.
- Better instruments: jRhodes3, VCSL vibes and Meatbass would lift the sound a lot; together
  they are about 150 MB. The Salamander piano (1.3 GB, about 4 GB RAM to load) must never be
  loaded on the mothership.

## v4 changes (Darren's review of v3, 2026-09-28)

Darren on v3: "I like this one a lot." Keep everything in v3. Change only these four things.

### 1. Background: LlamaPress dark purple
Use the llamapress.ai site palette (`rails/app/assets/stylesheets/lpd_theme.css`): base ink
`#0B0620`, mid `#120A33`, lift `#1A1046`; a vertical gradient `#0B0620 → #120A33 → #0B0620`, with
one or two soft violet glows (`#6D4AFF` / `#8B6BFF` at low opacity) and a faint star field.
Keep the painted brush texture. The blue eye `#4592e9` stays the only saturated BLUE; violet is fine.

### 2. The opening sheet types in ON the music (exact note times from the score)
The marimba plays exactly these notes before 10 s (seconds):
`0.000 1.245 2.497 3.752 4.997 5.624 6.256 6.876 7.502 8.130 8.747 9.380`.
The celesta "Le-O!" calls land at `5.000 → 5.625` and `6.563 → 7.188`.
The pizzicato ticks every 0.3125 s from 0.000.

| Note (s) | Sheet event (the event STARTS on the note; finish within 0.2 s) |
|---|---|
| 0.000 | title band, formula bar, column letters and row numbers ink in (quick sweep over bar 0) |
| 1.245 | header row 1 (`Job Client Status Date Total`) |
| 2.497 | row 2 |
| 3.752 | row 3 |
| 4.997 | row 4 — and the blue dot appears inside its cell (celesta C5) |
| 5.624 | row 5 — blue dot blinks (celesta A5) |
| 6.256 | row 6 |
| 6.876 | row 7 |
| 7.502 | row 8 (blue dot blinks again at 7.188, the second A5) |
| 8.130 | row 9 |
| 8.747 | total row `$38,450`, its cell selected with the green border |
| 9.380 | the swirl into Leo begins |

The green selection border hops one cell to the right on every pizzicato tick (every 0.3125 s)
while rows are typing, so the ticking is visible.

### 3. Leo thinks out loud (10–20 s), like the spreadsheet upload modal
Copy the look of the real upload modal (`rails/app/javascript/lpd/leo_spreadsheet_modal.js`,
`rails/app/views/leads/_leo_spreadsheet_modal.html.erb`): AI message bubbles on a dark panel
(`#0d0d1a`-ish, rounded, thin violet border `rgba(139,92,246,0.3)`), text in Georgia serif, soft
white (~70%), each bubble fading and sliding up ~10 px as it appears. One small round Leo avatar
with a violet ring next to the first bubble. Place the stack beside Leo, not over his face, and
leave room for the floating cells.

| Appears (s) | Bubble text (exact) |
|---|---|
| 11.25 | Hmm.. this is an interesting spreadsheet. |
| 13.75 | Jobs, clients, status, totals. |
| 16.25 | 8 jobs. $38,450 this month. |
| 18.75 | Your team needs an app for this. |

These land on beat 2 of bars 4–7. Keep all four on screen until the 20 s hand-off, then let
them fade as the app unfolds (the one fade allowed: text, not a scene cut).

### 4. The app is obviously a WEB app
Put the app inside a browser window: a top strip with three small window dots, back/forward
arrows, and an address bar reading `jobs.llamapress.ai` with a small lock. Inside the app's top
bar, on the right: a bell icon and a round user avatar with initials `JH` plus the name `Jamie`.
The app content stays as in v3.
