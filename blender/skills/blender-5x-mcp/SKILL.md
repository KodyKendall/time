---
name: blender-5x-mcp
description: Drive the live Blender 5.x scene through the MCP-for-Blender socket (build, patch, render, verify). Use whenever creating or changing anything in the user's open Blender via its MCP server.
---

# Blender 5.x via MCP socket

Blender runs with the MCP-for-Blender addon (auto-starts server on port 9876).
Talk to it over raw TCP: send `{"type": "<cmd>", "params": {...}}` as one JSON
blob, read chunks until they parse as complete JSON. Helper: `/tmp/mcp_send.py`
takes a JSON payload file. Key commands: `execute_code` (`{"code": ...}`,
returns captured stdout), `get_scene_info`, `get_viewport_screenshot`
(`{"filepath","max_size"}` — offscreen, works headless-style).

## Rules that have bitten before (5.x API moves)

- **No `scene.eevee.use_bloom`.** EEVEE-Next glow lives in the compositor, and
  the 5.x compositor API is in flux: tree is `scene.compositing_node_group`
  (not `scene.node_tree`, often `None` until assigned), Glare has no
  `glare_type` (Type/Quality are MENU input sockets — leave defaults, set
  Threshold), `CompositorNodeComposite` does not exist (sinks are Viewer /
  File Output, whose API also changed). Skip the compositor; emission reads
  fine in a raw EEVEE still.
- **Layered actions.** `obj.animation_data.action.fcurves` is gone; walk
  `action.layers → strips → channelbags → fcurves` with a legacy fallback.
- **Operator renames.** `primitive_circle_add` takes no `fill`; use a flat
  cylinder for discs. Orient featureless cylinders with
  `direction.to_track_quat('Z','Y').to_euler()` — a Z rotation alone leaves the
  axis vertical.
- **Solid-mode colors.** Viewport Solid shading ignores node materials; set
  `mat.diffuse_color` to match every emission or the user sees grey clay.
  Switching shading via API fails from timer context (`window_manager.windows`
  is empty) — tell the user: Numpad 0 for camera view, Z → Material Preview,
  Space to play.

## Verify-as-you-go loop

Build with `execute_code` printing a one-line summary (`print(...)` comes back
in the response). Then `bpy.ops.render.render(write_still=True)` to
`/tmp/<name>.png` at 50% and read it back with `read_file` before declaring
done. `execute_code` cannot start the socket server (`blender -b`
unsupported) — full checks need the GUI open.

## World, assets, persistence

- **Find shader nodes by connections, not names.** Duplicate node names
  (`Background`, `Background.001`) caused a mis-wire; locate the HDRI
  background via its incoming `TEX_ENVIRONMENT` link.
- **EEVEE 5.2: skip the LightPath camera-ray world split** (hide-HDRI-from-
  camera trick renders wrong/unreliable). Dim the HDRI `Background` strength
  (~0.12) instead — dark void, keeps reflections.
- **PolyHaven downloads go to system temp and vanish** (cleaned mid-session).
  Persist from inside Blender: `img.filepath_raw/file_format` + `img.save()`
  into the repo, then `bpy.ops.wm.save_as_mainfile`. Never trust temp paths
  past the current hour.
- **After `read_homefile`, the exec context is degraded**: `active_object`
  is missing and `select_all/delete` silently keeps startup junk (a stray
  2m Cube photobombed a render). Delete by datablock
  (`bpy.data.objects.remove`) and resolve new objects by set-diff, never by
  `active_object`.
- **Preetham sky in 5.2**: `atmosphere_turbidity` is gone — set each sky attr
  in its own try/except and always wire the links.
