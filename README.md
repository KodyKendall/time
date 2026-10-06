# TIME

A 145-second animated film about time — from the Big Bang through atoms, galaxies, the young
Earth, life, dinosaurs, our ancestors, cities, machines and AI, and back to the Big Bang (it loops).
Every frame is painted and rendered in JavaScript at 3840×2160, 30 fps; the soundtrack is an
original smooth-jazz score played by real sampled instruments, composed in code against the picture.

## How it's made

- **Painting — p5.js 2 + p5.brush 2** (`web/src/engine/paint.js`). All artwork is painted with
  p5.brush (watercolour fills, gouache/dry/charcoal/pastel strokes, hatching, stipple) into
  transparent layers. p5.brush is patched (`tools/patch-brush.mjs`) so it can paint onto
  transparent framebuffers without mixing against an implicit white paper, and so it never culls
  strokes in scaled / transformed layers as "off canvas".
- **Compositor — raw WebGL2** (`web/src/engine/compositor.js`, `post.js`). Painted layers are
  mipmapped and animated per frame (affine transforms, twirl/noise/bulge warps, masks, glows,
  instanced particles), with automatic motion blur, bloom, grading, a procedural paper texture,
  grain and dithering. Per-frame brushwork (`R.dyn`) is repainted only when its frame key changes.
- **Film** (`web/src/film.js`): nine segments, each a scene that *transforms* into the next through
  shared **pivot** states (`web/src/scenes/pivots.js`: star, cell, eye, ash, night sky, fields,
  gear, chip die, singularity) — no cuts, fades or wipes. A "years ago" counter
  (`web/src/captions.js`) rolls down in log-time from 13.8 billion years to *now*.
- **Rendering** (`tools/cli.mjs`, `tools/render_parallel.mjs`): headless Chrome (GPU) renders each
  frame; raw RGBA frames stream to ffmpeg (x264, High profile, level 5.1 at 4K with VBV so it plays in
  WMP/VLC), in resumable segment-aligned chunks, then lossless concat + audio mux. `tools/seams.py`
  checks every segment hand-off for frame-to-frame jumps.
- **Music** (`audio/scores/time*.mjs`): composed bar by bar at 96 BPM against the cue sheet
  (`docs/music_plan.md`), rendered with spessasynth (SF2) and a JS SFZ sampler from free sample
  libraries (jRhodes3, Salamander Grand, Weresax / MTG saxes, VSCO2 brass, VCSL vibes, Meatbass,
  AVL Blonde Bop jazz kit, Swirly brushes…), mixed and mastered in JS (`audio/lib/mixer.mjs`).
  Credits and licenses: `audio/CREDITS.md`.

## Commands

```bash
npm install
npm run vendor:gsap                                        # copy GSAP core for browser rendering
node tools/patch-brush.mjs                                   # vendor p5 + patched p5.brush into web/vendor
node tools/cli.mjs sheet --film film --w 1280 --from 0 --to 30 --n 16 --name look   # contact sheet
node tools/cli.mjs still --film film --w 3840 --t 26 --name galaxy                   # 4K still
python tools/seams.py --w 960                                   # frame-to-frame jump check at every segment hand-off
node audio/render.mjs audio/scores/time.mjs audio/build/time_final.wav             # soundtrack
node tools/render_parallel.mjs --w 3840 --fps 30 --workers 4 --audio audio/build/time_final.wav --out out/TIME_4K.mp4
#   ^ segment-aligned chunks on a worker pool; resumable (re-run skips finished chunks, --fresh starts over)
```

## Layout

```
web/src/engine/     compositor, post, painter, film/timeline, math
web/src/scenes/     cosmos (0–30 s) + one folder per segment, pivots, shared kit/palette
web/src/captions.js the years-ago counter
audio/              toolchain (synth, SFZ sampler, mixer, SFX), scores/, assets/ (sample libraries)
docs/               shot list, authoring guide, music plan
tools/              render CLI, parallel renderer, p5.brush patcher
```

Current visual direction: preserve AI-generated paintings with very, very slight
animation. See [the animation lesson](docs/ANIMATION_DIRECTION.md). The
[GSAP rig trial](docs/GSAP_RIGS.md) is a historical experiment, not the default.
