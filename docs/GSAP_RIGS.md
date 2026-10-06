# Scripted GSAP rigs

> Latest user review (2026-10-03): preserve the AI-generated artwork with **very, very slight animation**. Earlier recommendations below are historical and are superseded where they conflict with [the current animation direction](ANIMATION_DIRECTION.md).

TETHER beat 1 is the first trial. The other performances keep their existing motion.
No new artwork or editor is required. Wren’s body, arms and scarf are loaded once
and reused; the string uses the grip returned by the rig on every frame.

- `web/src/animation/clip.js`: paused GSAP timeline over flat numeric pose channels.
- `web/src/characters/wren/rig.js`: painted parts, pivots, aiming and grip output.
- `web/src/characters/wren/motion.js`: first-flight performance, independent of placement.

A clip starts with a complete base pose. Keys use increasing `at` times in seconds,
partial `pose` values, and an optional GSAP `ease` (default `sine.inOut`). Missing
channels hold their previous value. Angles are radians; bob is in film design units.

```js
const clip = createClip({ lean: 0, tug: 0 }, [
  { at: 1, pose: { lean: -0.06 } },
  { at: 1.3, pose: { tug: 0.12 }, ease: 'power2.out' },
  { at: 2, pose: { lean: 0, tug: 0 } },
]);
const pose = clip.sample(localSeconds);
```

Create one clip per performance, sample it for each frame, and dispose it when it
is no longer needed. Sampling returns a copy; caller modifications do not affect
the timeline. Times outside the clip hold the endpoint. Explicit from/to values,
a rewind before sampling, and disabled lazy updates support backward seeking,
independent render workers and motion-blur subframes. Avoid live playback,
callbacks, random values and DOM targets in film clips.

The Wren rig preserves the existing painted-part geometry. Both arms are still
one piece; GSAP does not add elbows, new views or missing artwork. The scarf keeps
its existing procedural flutter. Future rigs can consume the same clip interface.

```sh
npm run vendor:gsap       # after installing/upgrading GSAP
npm run test:animation
node tools/cli.mjs render --film tether --w 640 --fps 12 --blur 1 --from 0 --to 12 --out out/tether_gsap_wren.mp4
```

GSAP core is vendored locally with its upstream license header. No CDN or CSS
plugin is involved. Upgrade the npm dependency and regenerate the vendored core
together, then rerun the animation checks.

The first-flight trial now uses a clearer pull/recoil/settle performance with
asymmetric timing. To compare with the original sine-driven motion, add
`--rigmotion original` to the render CLI. This affects only beat 1.


## Articulated pull study

`web/src/wrenpull.js` is an eight-second performance study, separate from the full
film. It uses nine painted assets in `web/assets/tether/rig-v2/`, reusing limb art
for the far side. `characters/wren/articulated.js` owns anchors, draw order and
hand/foot targets; `pull-motion.js` owns choreography; `animation/ik.js` solves
fixed-length two-bone chains. Boots stay level and fixed while hips move.

The sequence is: look up, anticipate, lower the hips, pull, overshoot slightly,
recover, repeat with different timing, settle. The head reacts after the torso;
the scarf adds a delayed follow-through. The kite and cord use the same pose cues.
It is still a side-view cutout rig; turns and facial performances need additional
artwork. This study has not replaced other performances in the full film.

```sh
node tools/cli.mjs render --film wrenpull --w 1920 --fps 30 --blur 3 --from 0 --to 8 --out out/wren_articulated_pull_final.mp4
```

Generated with the imagegen skill's bundled CLI, `gpt-image-2`, `quality=low`:

- `output/imagegen/wren-articulated-sheet.png`: nine-part sheet using Wren's existing
  painting as a reference.
- `output/imagegen/wren-torso.png`: targeted correction removing the torso's painted sleeve.
- Exact prompts: `output/imagegen/wren-articulated-prompt.txt` and
  `output/imagegen/wren-torso-prompt.txt`.

Magenta was keyed with `plate_tools.py`, then disconnected regions were cropped
with its `parts` command. Paintings were not replaced with generated animation
frames. The image manifest records both calls and conservative $0.10 reservations
per call because the bundled CLI does not expose usage. The generator's budget
check includes these reservations; actual billing for the two calls is unverified.
