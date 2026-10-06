# Wren: eight-second pull study

> Latest user review (2026-10-03): preserve the AI-generated artwork with **very, very slight animation**. Earlier recommendations below are historical and are superseded where they conflict with [the current animation direction](ANIMATION_DIRECTION.md).

Purpose: establish the quality benefit of articulated artwork and planned acting
before applying this rig across TETHER. Scripted in GSAP, rendered by the existing
WebGL/ffmpeg pipeline. The performance is a separate `wrenpull` film.

| Time | Acting beat | Mechanics |
| --- | --- | --- |
| 0–0.8 s | Notice the kite's tension | Head looks up; shoulders mostly hold |
| 0.8–1.35 s | Prepare to pull | Weight travels forward slightly; knees soften; grip advances |
| 1.35–1.75 s | Pull | Hips shift back first, elbows fold, torso follows quickly |
| 1.75–2 s | Catch the load | Slight overshoot; head and scarf follow the recoil |
| 2–3.5 s | Recover | Unequal easing and a longer recovery prevent mechanical repetition |
| 3.5–4.5 s | Prepare again | Smaller forward shift; hands ease outward |
| 4.5–5.2 s | Second pull | Slightly deeper crouch; stronger lean and delayed head response |
| 5.2–6.8 s | Release effort | Elbows extend gradually while hips rise |
| 6.8–8 s | Settle | Return to the initial pose without a hard reset |

Both soles keep fixed coordinates. Two-bone IK solves knees and elbows from the
hip/shoulder and ankle/wrist targets; each bone maintains its length. The string
starts at a landmark in the painted hand. Far limbs reuse the same artwork with
a darker tint. Head and torso use separate rotations. The scarf adds a restrained
procedural ripple on top of its authored follow-through.

The source art is one low-quality GPT Image 2 sheet plus one low-quality torso
correction. Nine named cutouts live in `web/assets/tether/rig-v2/`. Exact prompts
and original outputs live in `output/imagegen/`; generation provenance and budget
reservations are in the TETHER manifest. No per-frame image generation is used.

This remains a side-view limited-animation rig. Acting with facial expressions,
turning toward camera, finger articulation and cloth deformation are future work.
The generated parts are adequate for this study; a final hero close-up may need
hand-tuned seams or higher-quality replacement parts.

Validation: 241 samples across the complete performance preserve limb lengths,
foot and hand targets, and reverse seeking. The final preview uses 1920×1080,
30 fps, and three motion-blur samples per frame.
