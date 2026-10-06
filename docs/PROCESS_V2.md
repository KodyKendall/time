# Animation process v2: story first, painted plates, code for motion

> Latest user review (2026-10-03): preserve the AI-generated artwork with **very, very slight animation**. Earlier recommendations below are historical and are superseded where they conflict with [the current animation direction](ANIMATION_DIRECTION.md).

How we make a short film now, and how we got here. Written after the first film made this way,
**TETHER** (2:00, 2026-10-03). The next film should be able to follow the checklist at the bottom
without rereading the history.

## v1 → v2 in one table

| | v1 (TIME, MURMURATION, ONE OF MANY, LEO) | v2 (TETHER onwards) |
|---|---|---|
| Starting point | Code. Scenes written straight into `web/src/scenes/` | **Story.** An HTML storyboard with an arc and a moral, approved before any animation |
| Pictures | Everything painted by p5.brush in code | **Static art from an image model** (background plates, character poses); p5.brush paints only what moves |
| Characters | Built from blobs and strokes in code. The weakest part of every film | Generated cut-outs from one locked character description, reused as reference so she stays the same girl |
| Review | Contact sheets, then the finished render | **A gate at every step**: storyboard → painted storyboard → one test frame → review page → all plates → low-fi animation |
| Cost | $0 | **Under $3 per film** for images (TETHER: $1.71). Music, animation and rendering still $0 |

The engine (compositor, post-processing, music toolkit, renderer) is unchanged except for one
addition: `P.image()` in `web/src/engine/engine.js`, which loads a picture file as a layer.

---

## The journey

### 1. Storyboard as an HTML page

The ask: a storyboard for a new two-minute film, like the bird and spreadsheet films, but **as a
storyboard first, so a story we don't like costs minutes, not a render**. The story had to have a
real arc and a real point.

**TETHER**: a red kite envies the wild swifts and fights the string that holds it. The string
snaps, the kite gets its freedom, and it falls, because a kite only flies against the pull of its
string. The girl, Wren, finds it in a thorn tree, patches it with her own scarf, and the next day it
leans into the string and climbs higher than ever.
**Moral:** *"The string isn't what holds you down. It's what holds you up."*

`storyboard-tether.html` has:
- **Logline, moral and meta pills.** Runtime, format, cast, music.
- **An arc graph.** The kite's height is the emotional curve: a false freedom peak, an all-is-lost
  low, and a true ending that climbs higher than the false peak.
- **Character notes.** The kite has no face, so its tail ribbon shows how it feels.
- **A music concept.** One two-note motif, "The Tug", heard whole only when the kite is on its string.
- **Nine beats.** Each has a timecode, a description, and camera, sound and "ends on" notes.
- **Open questions** for the director at the bottom.

The arc template we used (it works for any 2-minute short):

| Beat | Role | TETHER |
|---|---|---|
| 1 | The bond / normal world | First flight |
| 2 | The want | The swifts fly past; the string runs out |
| 3 | Rising tension | Tugging; the string frays (the audience sees it, the girl doesn't) |
| 4 | Turning point | Snap |
| 5 | False victory | Free, above the clouds |
| 6 | The fall | Nothing to push against |
| 7 | All is lost | The thorn tree, night, rain |
| 8 | Reconnection | The mend |
| 9 | Climax and resolution | Leaning in: the lesson shown, not said |

### 2. Painted storyboard ("taking screenshots" of the story)

The first storyboard used SVG sketches. The next step was to **paint each beat as a real frame
with the film engine** and put those stills into the page. A "film" of nine held paintings, one
per second (`web/src/tether_sketch.js` → `web/src/scenes/tether/sketch.js`), rendered with
`tools/cli.mjs still` and exported to `storyboard-tether/beat1-9.jpg`.

Lessons from that pass:
- **Bloom hazes bright skies.** On light skies the bloom made a pale disc over the middle of the
  frame. Keep `bloom` around 0.03 on day scenes and reserve it for night.
- **Concave watercolour fills spray ghost triangles.** Paint ground as convex vertical strips
  (`washPoly`).
- **The code-built girl looked bad.** That raised the next question.

### 3. "How do real animators deal with characters?"

Studios design a character once (model sheet), reuse it everywhere, and spend detail where it
pays. They use limited animation: great held drawings, with the camera, light, weather and
secondary motion doing the moving. We compared that with a second LLM's plan (character brief →
concept generation → model sheet → rig) and agreed on the good parts.

Then **two constraints shaped v2**:
- **"Realistic, high likelihood of success, elegant and simple."** No rigs, turnarounds,
  frame-by-frame animation or lip sync.
- **"Less than $3 per film."** About 13–45 images at 2–5 cents each.

That gives the core rule of v2: **the image model makes the static art, the code makes the motion.**

| Element | Made by | Why |
|---|---|---|
| Background per beat | Image model, 1 plate per beat | The biggest quality jump, and nothing in it moves |
| Character (Wren) | Image model, one held pose per beat she appears in, transparent cut-out | She barely moves; a held pose plus a slight sway reads fine |
| Kite, tail, string, swifts, rain, glows | Engine, redrawn every frame | They are simple shapes, and they are what moves |
| Camera | Engine: one slow push or pull per beat | Cheap, and it makes stills cinematic |
| Grade, paper texture, grain | Engine post-processing | One finish over both kinds of art makes them read as one film |
| A shot where nothing moves (the mend) | Image model paints the **whole shot**, hands and kite included | Cheaper and better than assembling it |

### 4. The image-model pipeline (one test frame first)

`tools/gen.mjs` calls the OpenAI Images API and:
- **Adds the film's style text to every prompt.** `web/assets/<film>/style.txt` for backgrounds
  ("no people"), `style-character.txt` for cut-outs (the locked character description), and
  `style-scene.txt` for whole shots.
- **Sends reference images** with `--ref`, and up to several of them: the storyboard frame for
  composition, the first picked plate for style, the first picked Wren for the character.
- **Refuses any call that would push the film past `--budget`** (default $3).
- **Records every call** in `web/assets/<film>/manifest.json`: prompt, references, model, token
  usage and cost. `node tools/gen.mjs --film tether --spend` prints the total.

We tested on **beat 1 only** first ($0.24), then built `review-tether.html` so the director could
check every input, output, rejected option, prompt and cost before scaling up. Findings:
- **`gpt-image-2` makes the best plates but can't output transparency.** Cut-outs use
  `gpt-image-1.5 --transparent`. That failed call cost $0.
- **Plates come out 3:2** (1536×1024). The film draws them 1920 wide and crops `top` design
  units off to get 16:9.
- **The ground in a plate is a painting, not a curve in our code.** Measure it from the pixels
  (`tools/plate_tools.py edge`) to stand Wren on it.
- **Models draw a stub of kite string in her hands.** `tools/plate_tools.py unstring` erases it
  above-right of the hands, so the engine's string takes over. Cropping instead clipped her head.
- **The model ignores wind direction.** "Scarf streams right" was ignored in all four poses. We
  accepted it: she reads as having the wind in her face.

### 5. All plates and poses

One batch: 8 plates and 3 poses, 2 options each, about 6 minutes, $1.47. I picked each by eye and
wrote down why:

| Beat | Pick | Why |
|---|---|---|
| 1 | bg1 option A | Finer watercolour, better clouds |
| 2 | bg2 option B | Bigger clifftop with room for Wren |
| 3 | bg3 option A | Worn top corner for the string to saw across |
| 4 | bg4 option B | Hill rising right; a quiet corner for Wren lying down; a blown-out sky for the flash |
| 5 | bg5 option A | More defined cloud tops, open sky for loops |
| 6 | bg6 option A | The small thorn tree is a clear target for the fall |
| 7 | bg7 option B | Option A had painted the lantern light in, but it must *appear* late, so the engine adds it |
| 8 | bg8 option B | The lumpy knot is visible in the string coil; the patch reads as cut from the scarf |
| 9 | bg9 option B | Warmer morning horizon, open sky for the climb |
| Wren | pose1 A, cliff A, lying B, lean B | The same girl throughout; picked for clearest silhouette and pose |

Picked files are copied to `web/assets/tether/plates/` under stable names; every option stays in
`web/assets/tether/gen/`.

### 6. The low-fi animation

`web/src/tether.js` → `web/src/scenes/tether/index.js`:
- **Nine shots on the storyboard's timecodes**, joined by 0.8 s cross-fades (`T = [0, 12, 27, …, 120]`).
- **Each beat is a small function of local time `l`** drawn over its plate:
  - beat 1: the kite bobs
  - beat 2: it jerks taut at 0:15 and the flock streams past
  - beat 3: the string saws, frays and thins
  - beat 4: flash, the kite escapes, the slack string falls
  - beat 5: figure-eight loops inside an orbiting flock, which then leaves
  - beat 6: an accelerating tumble down to the tree
  - beat 7: rain, the torn kite (dimmed for night), the lantern fading in
  - beat 8: push-in, the lantern breathing
  - beat 9: the patched kite climbs, the knot glints, the swifts circle, fade to the title
- **The kite is a sprite** painted once by p5.brush, in normal, patched and torn versions.
  String and tail are rows of soft particles redrawn every frame; the swifts are a textured
  particle flock.
- **`?only=plate|wren|code` renders one layer at a time** (`--only` on the CLI), for review pages.

### 7. Music and final assembly

`audio/scores/tether.mjs` runs at 60 BPM, so **one beat is one second** and the score uses the
film's timecodes directly. "The Tug" (D then A) is whole only while the kite is on its string:
- At the snap: a ping and silence.
- In free flight: the high note alone.
- In the fall: the flute keeps getting cut off.
- At the tree: rain, then the low D alone.
- At the mend: piano that never plays the A.
- At the end: both notes together.

The sound library has no rain, so `crackle` with the roar turned off stands in.

The video renders silent. The music is joined afterward with ffmpeg, which copies the video
stream, so changing the music never needs a re-render.

### 8. Storyboard v2

`storyboard-tether-v2.html` shows:
- the film with music at the top, and the score on its own in the Music card
- for each beat: the new frame, the old code-painted sketch as a thumbnail, and a production
  line saying what's AI and what the code animates

---

### 9. Motion pass: designed cuts and real birds (v1 film)

The director's critique of v0: **"it seems like a picture book, not an animation."** Specifically:
- Scenes changed abruptly, picture to picture.
- The swifts looked and moved like insects: no flapping, swarming in circles, popping into
  existence mid-screen.
- Wren was static.

The diagnosis: v0 was a sequence of separate photographs with things moving on top, not one
world the camera moves through. This pass fixed the first two, with $0 of new images.

**Every cut is designed, and the kite is the thread.** Cameras now live on the shots
(`shot.view`), so the engine's transitions can drive them. Elements that cross a cut live in a
screen-space overlay (`overlay` in `web/src/scenes/tether/index.js`).

| Cut | How it's crossed | Engine feature |
|---|---|---|
| 1→2 | The kite stays on the same pixels while the land dissolves from hill to cliff underneath | One kite path for both beats (`KITE12`); the outgoing camera's end = the incoming camera's start |
| 2→3 | Eight big swifts sweep across the lens, right to left; the cut hides behind them | Overlay |
| 3→4 | The snap: the one hard cut, into the white flash | `cut` |
| 4→5 | The camera tilts up after the kite through a wall of cloud (shadowed undersides, so it reads as volume) and out above the clouds | `custom` + overlay; the cut is hidden where the cloud is opaque |
| 5→6 | Time-lapse: the same kite on the same pixels while the sun goes down | One kite path (`KITE56`) and one shared drawing (`drawFreeKite`) |
| 6→7 | Zoom into the little thorn tree on the horizon until it is the big tree, at night, in rain | `zoomIn` with `embed` (plate 7's trunk mapped onto plate 6's tree) + a soft iris mask |
| 7→8 | The lantern light on the far hill becomes the lantern on the table | `zoomIn` (×33) + iris |
| 8→9 | Push into the flame, centred as it grows; flare to white; open on the dawn | `custom` + overlay |

**The swifts are a real flock** (`makeFlock`):
- **Flocking:** each bird steers apart from, alongside and toward its neighbours, plus a goal
  per bird. For example: past the kite and then away to the horizon; orbit the kite and then
  leave; return and circle.
- **Simulated ahead of time** at 60 Hz and stored at 30 Hz, so any frame renders on its own, in
  any order (parallel renders and stills still work).
- **Spawn off-screen, dropped once they leave it.**
- **Six painted wing frames** (glide plus a wingbeat that foreshortens as the wings rise), with
  swift-like bursts of flapping between glides.
- **Depth:** size and haze by depth, and smaller toward the horizon.

Gotchas from this pass:
- **Bloom on bright plates makes a glowing disc with rings.** Bloom is now 0.015 for the whole film.
- **A camera that slides a plate further than its spare rows shows black.** Limit slides to the
  crop margin, or cover them (the cloud wall).
- **Zooming into an embedded shot shows its rectangle.** Reveal it through a radial mask that
  opens to cover the frame (`iris`).
- **Two beats drawing "the same" kite with slightly different tail or string code shows double
  during a dissolve.** Share one drawing function.

Still open: **Wren is static.** Next is a cut-out with moving arms, scarf and hair, plus 3–4
drawings for her fall at the snap, about $0.90.

### 10. The studio: review live, not by MP4

The second critique was about process: **"it's taking way too long, we re-render the entire film
before I can give feedback."** A 14-minute render per round of notes defeats the point of a
storyboard. The engine already draws every frame in Chrome, so we built a studio around it:

```bash
node tools/studio.mjs --film tether        # opens http://127.0.0.1:8777/web/studio.html?film=tether&...
```

- **The real film, drawn live** by the same engine as the final render (motion blur off), with
  the music in sync.
- **Navigation:** a timeline with the beats labelled and the cuts shaded. Click or drag to scrub;
  Space plays; ←/→ step a frame; [ / ] jump between shots and cuts; **L loops** the shot or cut
  under the playhead; ½× and ¼× speed.
- **Layer toggles:** plate / character / code / fx (`window.FILM_LAYERS`, or `?only=` on the CLI).
- **Live reload:** saving anything under `web/` or `audio/build/` reloads the page at the same
  time, loop and speed.
- **Notes:** press **N** to pin a timecoded note to the timeline. Notes are stored in
  `studio-notes/<film>.json` with the time, shot, cut and any hidden layers. To resolve one, set
  `"status": "resolved"` and a `"resolution"` in that file; open pages update live (green pin,
  reply in the drawer).

The loop is now: **watch in the studio → pin notes → Claude reads `studio-notes/<film>.json` and
changes the code → the studio reloads at the same spot.** Render the MP4 only to share or export.

Bug found by the studio: **p5.brush fills come out with whole panels missing on 2× (Retina)
screens**, because it sizes its fill masks from `devicePixelRatio`. `render.html` and
`studio.html` pin `devicePixelRatio` to 1 before p5 loads. Headless renders were never affected.

### 11. What makes it look animated (lessons from the studio notes)

Two rounds of studio notes (21 notes, all resolved) taught us what works. These are now the
defaults:

| Rule | Why (the note) | How |
|---|---|---|
| **Rig painted parts; don't swap pictures** | Four swapped swift drawings looked "janky"; code-drawn birds looked "like insects" | Generate the parts as one sheet (`swift_parts.png`: body, near wing, far wing), split them by grid, and hinge them in code: `drawSwift` projects each wing's 3D direction to the screen, with eased timing, a faster downstroke, a body bob and glides. Smooth at any frame. |
| **Side views for motion** | Seen from below, a wingbeat only reads as the wings "pulsating" | Pick the view where the motion is visible: wings sweeping up and down, not foreshortening |
| **Painted, not drawn** | The white string and red-dot tail "don't look painted" | `cord()`: a darker edge under a lighter core, with per-dot opacity grain. Bows painted once with p5.brush (`A.bow`) and rotated along the ribbon. |
| **Everything in the scene's light** | Code elements didn't match the plate's colours | `LIGHT[beat]` tints the kite, tail and string: warm day, gold sunset, violet dusk, blue night, lamplight |
| **Long transitions** | "The ones with a longer transition are way better" | 4→5 tilt is 6.8 s; 2→3 dissolve is 1 s under the swifts; cuts carried by an element |
| **Show the in-between** | "Straight from the post to her on the ground"; "she looks like she died" | Snap: punch-in, the strand parts, flash; Wren falls (new pose), lands, sits up reaching (new pose) |
| **Keep a scene in one place** | The post shot had no sea, so the cut jumped location | Regenerate a plate with the previous shot as a reference |
| **Characters act** | The lantern was "subtle"; the mend "just looks like a picture" | Wren walks in with the lantern, reaches up, the kite drops into her hand; her hand sews (plate split into table plus hand) |
| **Rig the character too** | Wren was "stiff", "doing the same thing always" | One generated sheet of parts (body without arms, both arms, scarf ends), split with `tools/plate_tools.py parts`. `drawWren`: the body pivots at the feet (lean, bounce, breathing), the arms hinge at the shoulder and aim along the real string with a tug, the scarf hangs from the collar with a noise-warp flutter. Each beat sets its own behaviour: playful on the hill, braced and yanked on the cliff, a steady lean at the end. |
| **Nothing uniform** | The tail moved "too fast... too uniform"; "the string should be doing different things" | Tail waves are two waves of different length plus a slow gust, and each scene sets its own character: lazy curls, streaming after the birds, thrashing at the post, limp in the tree, calm at the end |
| **Tails trail real motion** | The tail and string looked "silly" | A fixed-length ribbon sampled from where the kite was (`trailPts`) |

**Image spend for these fixes:** 9 calls, about $1.16. Film total so far: $2.87.

## The process, as a checklist

Each step ends with a **gate**: the director looks before the next step spends anything.

| # | Step | Output | Cost | Time |
|---|---|---|---|---|
| 1 | **Story.** Pick a story with a real arc and a stated moral. Write the storyboard page: logline, moral, arc graph, characters, music concept, 8–10 beats with timecodes and camera/sound/ends-on notes, open questions | `storyboard-<film>.html` | $0 | ~15 min |
| 2 | **Painted storyboard.** Code-paint one rough frame per beat with the engine; render stills into the page | `web/src/<film>_sketch.js`, `storyboard-<film>/beat*.jpg` | $0 | ~30 min |
| 3 | **Style + one test frame.** Write `style.txt` and `style-character.txt`. Generate beat 1's plate and the character's first pose (2 options each); composite in code | 1 finished frame | ~$0.25 | ~15 min |
| 4 | **Review page.** Inputs, every output (rejects too), exact prompts, costs, layer breakdown (`--only`), open questions | `review-<film>.html` | $0 | ~10 min |
| 5 | **All plates + poses.** One batch script, 2 options each, references = storyboard frame + picked plate (+ picked character for poses). Pick by eye; copy to `plates/`; `edge` to measure ground, `unstring` to clean hands | `web/assets/<film>/plates/` | ~$1.50 | ~10 min generate + picking |
| 6 | **Animation, reviewed in the studio.** One function per beat over its plate; `node tools/studio.mjs --film <film>`; you pin notes, Claude resolves them, the page reloads. Render an MP4 only to share | `web/src/scenes/<film>/`, `studio-notes/<film>.json` | $0 | seconds per change |
| 7 | **Score.** 60 BPM so beats are seconds; one motif that carries the moral; render, then join with ffmpeg | `audio/scores/<film>.mjs`, `out/<film>_v0_music.mp4` | $0 | ~20 s render |
| 8 | **Storyboard v2.** Video at top, new frames, sketch thumbnails, AI/code production line per beat | `storyboard-<film>-v2.html` | $0 | ~5 min |

### Commands

```bash
# images (key comes from OPENAI_API_KEY, exported in ~/.zshrc)
node tools/gen.mjs --film tether --id bg2 --n 2 --quality medium --ref storyboard-tether/beat2.jpg --ref web/assets/tether/plates/bg1.png --prompt "..."
node tools/gen.mjs --film tether --id wren_cliff --n 2 --model gpt-image-1.5 --style character --transparent --size 1024x1536 --ref web/assets/tether/plates/wren_pose1.png --prompt "..."
node tools/gen.mjs --film tether --spend

# measuring and cleaning
python3 tools/plate_tools.py edge web/assets/tether/plates/bg2.png --from 500
python3 tools/plate_tools.py unstring in.png web/assets/tether/plates/wren_cliff.png 710 492

# picture
node tools/cli.mjs sheet --film tether --w 1280 --t 6 --t 20 --t 34 --cols 3 --tw 640 --name check
node tools/cli.mjs still --film tether --w 1920 --t 0.5 --only plate,wren --name layers
node tools/cli.mjs render --film tether --w 1280 --fps 24 --blur 1 --out out/tether_v0.mp4

# sound, then join (no video re-render)
node audio/render.mjs audio/scores/tether.mjs audio/build/tether.wav
ffmpeg -i out/tether_v0.mp4 -i audio/build/tether.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/tether_v0_music.mp4
```

### Quality and transparency (updated)

- **Default quality is `low`** (about $0.02 per image). Low is good enough for animation pieces
  (poses, rig parts, birds) and makes exploring cheap. Ask for `--quality medium` only if a
  full-frame background looks too soft.
- **Transparency without `gpt-image-1.5`:** `gpt-image-2` can't return a transparent background,
  so `--transparent` asks it to paint on flat **magenta** (a "green screen" colour that isn't in
  the palette). `tools/plate_tools.py key` then removes it with a soft edge and cleans up magenta
  bleed. Output is saved as `*_keyed.png` next to the raw file. Tested on a Wren rig sheet at low:
  clean edges on the hair, hands and scarf, and only a faint pink tint on the thinnest scarf-fringe
  tips. $0.019, against about $0.07 per image for `gpt-image-1.5` at medium.

### Gotchas

- **zsh doesn't split `$args`.** Pass `--t` values to the CLI explicitly.
- **Two or three reference images raise the cost** from about $0.10 to $0.13–0.15 per call (2 options).
- **Prompt for empty space.** Ask each plate for "leave the hill crest empty" and "leave the upper
  right sky open"; the model mostly complies.
- **Leave out anything that has to appear on cue.** The model will paint lights and objects you
  asked it to leave out, so pick the option without them.
- **The `gpt-image-1.5` cost in the manifest is approximate.** It's logged with gpt-image-2 rates.
- **The final render is about 300 MB** at the renderer's quality settings. Compress a copy for sharing.

## TETHER by the numbers

| | |
|---|---|
| Image calls | 13 paid (+1 rejected, free) · 26 images · 13 used |
| Image spend | **$1.71** of $3 |
| Plates / poses | 9 / 4 |
| Render | 2,880 frames, 720p 24 fps, about 13 min on the Mac (v0); v1 adds the motion pass at the same cost |
| Score | 12 instruments plus wind, rain and impact effects; about 17 s to render |

## Known limits of v0 (what the next pass is for)

- **Wren never moves** beyond a slight sway. The cheapest next step is 2–3 poses per beat she's in,
  cross-faded (~$0.15 each), not a rig.
- **There's no shot of her falling at the snap.** It goes straight from the flash to her lying down.
- **The kite and swifts are simple shapes** next to the painted plates.
- **Nobody has reviewed the score by ear yet**, and the rain is a stand-in.

## Files

| Path | What |
|---|---|
| `storyboard-tether.html`, `storyboard-tether/` | v1 storyboard (code-painted frames) |
| `review-tether.html`, `review-tether/` | Review of the first plate test |
| `storyboard-tether-v2.html`, `storyboard-tether/v2/` | v2 storyboard with film and score |
| `tools/gen.mjs` | Image generation, budget guard, manifest |
| `tools/plate_tools.py` | `edge` (measure ground) and `unstring` (clean hands) |
| `web/assets/tether/` | Style text, manifest, `gen/` (every output), `plates/` (picks) |
| `web/src/tether.js`, `web/src/scenes/tether/index.js` | The plate film |
| `web/src/tether_sketch.js`, `web/src/scenes/tether/sketch.js` | The code-painted storyboard film |
| `web/src/engine/engine.js` | Adds `P.image()` |
| `audio/scores/tether.mjs` | The score |
