# Project instructions

This project creates painted short films with generated artwork, a JavaScript compositor, scripted motion, audio tooling and CLI rendering.

## Visual direction

The latest user feedback takes precedence over historical process notes: **AI-generated images are the strongest part. Preserve them with very, very slight animation.**

Prefer beautiful held paintings, slow restrained camera moves, subtle lighting/weather and tiny secondary movement. Let composition, selected poses, timing, transitions and sound carry the story. For a substantially different action, use another carefully chosen coherent generated pose rather than aggressively deforming the artwork.

Articulated cutout rigs, generated frame sequences, procedural pixel painting and vector-contour interpolation did not meet the user's visual expectations. Keep those trials as history; do not make them the default. Technical sophistication, frame rate and passing tests do not establish visual quality. Actual high-quality painted frame-by-frame animation remains unproven; do not describe the vector trial as that technique.

Read [the current animation lesson](docs/ANIMATION_DIRECTION.md) before animation work. Its direction supersedes conflicting recommendations in older process, trial and memory documents.

## Workflow

- Author and render through code/CLI; the user will not operate Maya, Adobe, Procreate or another animation editor's UI.
- Preserve existing film code and experiments unless the task calls for changing them.
- Review ongoing film work in the live studio (`node tools/studio.mjs`). Read all open `studio-notes/<film>.json` notes before work and again before reporting; resolve only notes actually addressed. Render a short video when requested or useful for a specific proof of concept.
- Work from the film's HTML board, not from memory or a re-render: `storyboard-<film>.html` (or its newest `-v2`), `review-<film>.html` for plate picks, character boards like `milo.html`. They hold the arc, frames, video and rationale in one page and are the fastest way to see the film as it stands. Read the board before proposing changes, and update it when the story, plates or film move — new frames, new video, the arc, and why each option was picked — so the board never shows frames the film no longer has. Pinned notes come from the studio (**N**); put the user's decisions and rejections in the board's notes.
- Build storyboards from real generated plates via `node tools/gen.mjs` (gpt-image-2), not from schematic sketches. Run gen calls one at a time — parallel calls race on the manifest and silently drop entries. SVG wireframes, boxes, grey panels or diagram placeholders are not reviewable art, and they hide the exact problems a storyboard exists to catch: composition, scale of figures, geometry, lighting and whether the image model can actually do the shot. Generate the plates, embed them in the board, then ask for approval. Diagrams are only acceptable for the arc graph or when a plate is blocked.
- Check the film's generation manifest and applicable budget before generating assets. Preserve reference consistency and record generation provenance and costs/reservations. Historical costs and budgets in docs are snapshots.
- Consult `docs/PROCESS_V2.md` and `docs/TETHER_HANDOFF.md` for context, applying the latest animation direction first.

## Self-improvement

Treat this file as a living document. When a session produces knowledge worth keeping, write it down in that session rather than leaving it in chat history.

Record a lesson when the user corrects an approach, an attempt fails in a way that is not obvious from reading the code, a project-specific convention or tool gotcha surfaces, or a better way of working is proven. Do not record one-off task details, facts already evident in the code or git history, or anything already covered here.

Write to the narrowest place that fits:

- Root `AGENTS.md`/`CLAUDE.md` — rules, conventions and workflow that apply to most tasks in this repo.
- `docs/` — deep or narrative material that would bloat the root file (direction, process, handoffs), linked from here.
- `skills/<name>/SKILL.md` — a repeatable procedure for a recurring task, with `name` and `description` frontmatter so it can be loaded on demand. Create the directory only when such a procedure actually recurs.

When new guidance conflicts with what is already written, update or delete the old text instead of appending beside it. Never let an inferred lesson override the latest explicit user feedback: the Visual direction section above and [the current animation lesson](docs/ANIMATION_DIRECTION.md) still win, and a direct correction from the user outranks anything recorded here.

Keep entries short, concrete and imperative — a rule or a command, not a story of what happened. Prefer editing an existing line over adding a new one, and do not touch these files when nothing was actually learned; a diff that only rewords existing guidance is churn. Mention any instruction, doc or skill change in the final report so the user can review or revert it.

## Instruction parity

Keep root `AGENTS.md` and `CLAUDE.md` identical whenever either is updated. Update the shared animation lesson and applicable project memories when the user changes the direction; remove or clearly supersede conflicting recommendations.
