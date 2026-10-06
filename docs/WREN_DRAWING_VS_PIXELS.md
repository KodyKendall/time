# Complete drawings versus procedural pixel painting

> Latest user review (2026-10-03): preserve the AI-generated artwork with **very, very slight animation**. Earlier recommendations below are historical and are superseded where they conflict with [the current animation direction](ANIMATION_DIRECTION.md).

Two separate implementations, sharing Wren's colors, a kite-pulling action,
background, two-second cycle length, 12 character drawings per second and camera.
The six-second videos repeat the cycle three times. Container frame rate is 24 fps;
there is no claim that the generated character is redrawn 24 times per second.

## A: complete character drawings

One low-quality GPT Image 2 reference edit produced a sheet of 24 full-body poses.
It is keyed, separated by connected components and registered at the boots. Each
frame is a complete drawing: no independent arm/leg layers, mesh deformation or
cross-fading. Registration translates the whole drawing; it does not stabilize
proportions or change pose contours. Some thin model-drawn cord remnants were
removed above/right of the face. Grip positions are measured from skin pixels.

The generator did not precisely follow the choreography, grid or loop closure.
The sheet has richer painted detail but changes proportions, foot separation and
hand height across frames. In particular the start and end do not match: the loop
has a visible reset. Foot registration reduces whole-image drift but cannot fix
these changes. This is a test of generated complete drawings, not a professional
animator's cleaned-up frame-by-frame sequence.

Original image: `output/imagegen/wren-drawn-cycle-sheet.png`.
Exact prompt: `output/imagegen/wren-drawn-cycle-prompt.txt`.
Used the imagegen skill bundled CLI, `gpt-image-2`, `quality=low`, `1536x1024`.
Assets and registration: `web/assets/tether/drawn-cycle/`.
Preparation: `.venv-imagegen/bin/python tools/prepare-drawn-cycle.py` after splitting
the keyed sheet with `plate_tools.py parts` using `--min 800`.

## B: literal procedural pixel painting

`web/src/characters/wren/pixel-cycle.js` evaluates continuous anatomical contours,
coat outline/folds, face, hair and scarf, then writes each covered RGBA pixel in a
320×400 buffer. Shape distance, light and stable pigment variation determine the
pixel color. There are no imported character images, rotating image parts, Canvas
path drawing or per-frame image-model calls. Joint mathematics provides reference
points only. The complete painting is regenerated for each of the 24 poses and
cached for playback. Raising animation sample rate would require additional
procedural drawings, not interpolating raster images.

Its pose values and pigment pattern are deterministic. Feet stay fixed and the
first and last pixel paintings match exactly. It has a simpler illustration style
than A. Its smoothness and consistency therefore do not establish that it can
match A's painterly detail with the same amount of effort. Pose and drawing style
are not perfectly matched between the implementations.

## Results and limits

A succeeds at the existing painted appearance with relatively little code, but
this model-generated sequence has temporal inconsistency. B succeeds at exact
control, reproducibility and loop closure, but needs more illustration work to
reach the desired appearance. For an unattended, code-only pipeline, B is the more
predictable foundation. For richer acting and painted detail, cleaned-up complete
key drawings remain worth exploring; independent AI output frames should not be
assumed to form a finished animation sequence.

The tests verify buffer coverage, changes during the pull, fixed foot targets,
exact procedural loop closure and reverse-seeking determinism. Both were visually
inspected as contact sheets. The sheet call is recorded with a conservative $0.10
budget reservation; actual billing is unavailable from the bundled CLI. Recorded
spend plus reservations remains $3.451 against the inherited $3.50 cap.

```sh
node tools/cli.mjs render --film wrencompare --w 1280 --fps 24 --blur 1 --to 6 --out out/wren_drawing_vs_pixels.mp4
node tools/cli.mjs render --film wrendrawn --w 1280 --fps 24 --blur 1 --to 6 --out out/wren_complete_drawings.mp4
node tools/cli.mjs render --film wrenpixels --w 1280 --fps 24 --blur 1 --to 6 --out out/wren_pixel_painted.mp4
npm run test:animation
```
