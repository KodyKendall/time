# Animation direction — latest user feedback, 2026-10-03

The AI-generated images are the strongest part of these films. Preserve their visual quality and add **very, very slight animation**. This supersedes earlier endorsements of articulated painted rigs and procedural character motion.

## Default approach

- Start with a strong, coherent generated painting or held character pose.
- Use restrained, slow camera movement, subtle lighting or weather, and tiny secondary movement where it improves the shot. Stillness is a valid choice.
- Carry the story through composition, pose selection, shot duration, transitions and sound. For substantially different actions, prefer another carefully chosen, consistent generated pose rather than aggressively deforming the existing painting.
- Judge a short moving preview by its visual quality. More motion, more frames, GSAP, elaborate choreography or passing mathematical tests do not establish a better result.
- Keep authoring and rendering accessible through code/CLI. The user does not intend to operate an animation application's UI.

## Storyboards must show real plates

Judge a storyboard on generated artwork, never on a diagram. A schematic stand-in cannot show whether the composition works, whether the figures are the right size in the frame, whether the geometry (mown stripes, rooftops, rigging) survives an image model, or whether the light is any good. All of those are the reason a storyboard exists.

Generate the plates with `node tools/gen.mjs` and embed them in the board before asking for approval. Hold back on the prose if you must to stay inside budget, but never substitute a placeholder for the art. Diagrams stay acceptable for the arc graph and for a single blocked shot.

## What the experiments taught us

The user rejected the visual results of articulated cutout rigs, generated multi-pose frame sequences, procedural pixel painting, and the authored vector-contour study. These are historical experiments, not the default production direction. The promising approach is generated artwork with extremely restrained motion; generating many images alone did not solve consistency.

The vector study used computed contour in-betweens. It was not traditional hand-painted frame-by-frame animation. High-quality painted frame-by-frame production remains unproven here; do not claim it was properly tested or ruled out.

Preserve existing experiments and film code unless a change is requested. This lesson is a direction for future work, not authorization to rewrite the current film or remove assets.
