# Wren articulated rig: generation prompts

Generated using the imagegen skill bundled CLI, model `gpt-image-2`, quality `low`.
Backgrounds were chroma-keyed locally; cropped parts live in `web/assets/tether/rig-v2/`.

## Nine-part sheet

Reference: `web/assets/tether/plates/wren_rig_sheet.png`. Size: `1536x1024`. Output: `wren-articulated-sheet.png`.

```text
Image 1 is a reference for the established character Wren and painted style. Create a NEW clean animation-parts sheet matching that same girl: eight years old, brown ponytail, blue wool coat, brown tights and dark brown boots, mustard scarf. Gentle storybook gouache, daylight, flat 2D side view FACING RIGHT. Keep identity, proportions and colors.
Layout: EXACTLY a 3 by 3 regular grid on a 1536x1024 canvas, with one completely disconnected painted part centered inside each cell and generous magenta margin. No labels, no grid lines, no shadows, no scenery. Never join parts. Background uniform pure #FF00FF; absolutely no magenta in the artwork.
TOP ROW, LEFT TO RIGHT: (1) torso only: knee-length blue coat with shoulder caps, pocket and mustard scarf collar, NO head, NO arms, NO legs, upright; (2) head only: same girl's head in right-facing profile, dark brown ponytail attached, small neck stump at bottom, looking slightly upward; (3) upper arm only: blue coat sleeve, shoulder round cap at TOP and elbow round cap at BOTTOM, oriented straight down, no forearm or hand.
MIDDLE ROW: (4) forearm only: blue sleeve, elbow rounded cap at LEFT and cuff at RIGHT, oriented horizontally, NO hand; (5) right hand only: wrist on LEFT and closed gentle fist on RIGHT, side view gripping an invisible thin kite cord, NO cord drawn, NO sleeve; (6) thigh only: brown tights upper leg, rounded hip cap at TOP and rounded knee cap at BOTTOM, oriented vertically, no coat, no calf, no foot.
BOTTOM ROW: (7) lower leg only: brown tights calf, rounded knee cap at TOP and ankle at BOTTOM, vertical, NO boot; (8) boot only: dark brown small child's boot, ankle opening at TOP LEFT and toe pointing RIGHT, entire flat sole visible; (9) loose mustard scarf tails only, root on LEFT and two ends trailing RIGHT, no neck collar.
These are reusable puppet parts, not nine poses of a complete character. Smooth rounded ends with generous painted overlap at shoulder, elbow, hip and knee. All parts fully within their individual grid cells. Keep simple soft brushwork, no black outlines, consistent light from upper left.
```

## Torso correction

Reference: `web/assets/tether/rig-v2/piece_0.png`. Size: `1024x1024`. Output: `wren-torso.png`.

```text
Image 1 is the edit target: a torso cutout for Wren's reusable animation rig. Keep the same blue wool coat, scarf collar, pocket, brushwork and proportions. Remove the entire dangling sleeve on the LEFT of the image: replace it with a clean continuous blue coat side seam, so this is a sleeveless coat torso ONLY, with small shoulder caps, NO arms, NO head, NO legs. Do not change the coat hem or pocket. Center the entire torso upright, fully visible, on perfectly flat uniform pure #FF00FF magenta. No shadows, no labels, no other objects. This is the body painting onto which independently animated sleeves will be attached.
```

