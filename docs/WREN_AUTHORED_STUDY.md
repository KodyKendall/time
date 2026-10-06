# Authored drawing study

> Latest user review (2026-10-03): preserve the AI-generated artwork with **very, very slight animation**. Earlier recommendations below are historical and are superseded where they conflict with [the current animation direction](ANIMATION_DIRECTION.md).

A five-second isolated kite-pull study: notice, anticipate, pull, catch, release,
settle, then hold. Eight explicit key drawings define matching Bézier contours.
The in-betweens interpolate those corresponding contours with deliberate timing.
Face, eyelids, ponytail, coat flare/folds, sleeve contour and hands change together.
Boot contours stay fixed. There is no IK, limb-angle solver, imported character
raster, rotating image part or image-model frame generation in this study.

This is **authored vector animation with computer-assisted in-betweens**, not a
claim of traditional hand-painted frame-by-frame production. The complete vector
frames are rasterized for playback. It tests designed drawings and contour
changes rather than either the previous pixel-distance painter or independently
generated AI poses. Its clean illustrated style differs from TETHER's generated
gouache artwork and is not a production-quality match for the established Wren.

Authoring source: `web/src/characters/wren/authored-drawings.js`.
Film: `web/src/wrenauthored.js`.
Exported key drawings and 49 complete vector frames: `output/authored-study/`.
Exact timings: `output/authored-study/timing.json`.

The film uses 12 distinct drawings per second in a 24 fps MP4. At 4 seconds the
initial drawing is restored, followed by a one-second hold. Motion blur is disabled
for judging the actual drawing sequence. Background and kite reuse existing art.
No new image-model calls or image spend were needed.

```sh
node tools/export-authored-drawings.mjs
npm run test:authored
node tools/cli.mjs render --film wrenauthored --w 1920 --fps 24 --blur 1 --to 5 --out out/wren_authored_drawings.mp4
```

Checks cover complete vector-only frames, path correspondence across the sequence,
finite contours, stable boot drawings, expression changes, deterministic seeking,
and an exact return to the initial drawing. Visual review covers key poses and
neck/collar, sleeve/cuff and skirt/leg overlap. The standalone film has not replaced
any performances in TETHER.

## Review outcome

User rejected the visual quality of this study. The vector illustration remains
too far from the desired painted character. This is not a successful demonstration
of high-quality painted frame-by-frame animation and does not establish that a
pipeline based on carefully painted key drawings would fail or succeed. Keep it
as a record of the attempted vector-contour approach, not as a production asset.

Finished clips:

- `out/wren_authored_drawings.mp4`: five seconds, 1920×1080, 24 fps.
- `out/wren_authored_closeup.mp4`: five-second character crop, 1024×1024, 24 fps.

Both decode successfully. No performances in TETHER were replaced.
