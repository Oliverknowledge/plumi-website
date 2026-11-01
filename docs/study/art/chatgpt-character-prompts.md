# ChatGPT prompt pack: Plumi library animal characters

Goal: sprite sheets for the web Grand Library that I (Claude) can drop into the app: the same camera angle as lofi.town
(3/4 top-down, never front-on), real chunky pixels on a fixed grid, identical frames, a warm autumn palette.

**Be honest with yourself about what ChatGPT can do.** It is good at design, mood and pose. It is bad at exact pixel grids,
identical proportions across frames and a locked camera angle. So the plan is: ChatGPT draws big (every art pixel is an
8 by 8 block, so errors are visible and recoverable), then I snap it to a true 32 by 48 grid with a script, fix the palette
and line up the feet. Expect to regenerate a few times. Pick the best sheet, not the first.

What to send me afterwards: the PNG files themselves (not screenshots), one per sheet.

---

## 0. Before you start (2 minutes)

1. Use ChatGPT's image generation (GPT-4o / "Create image"), one image per message. Start a NEW chat for each character.
2. Attach two reference images to the FIRST message of each chat:
   - **A crop of lofi.town** showing characters walking (like the autumn screenshot): for the camera angle and pixel density ONLY.
   - **A crop of the Plumi library room** (our own art): for the angle the characters must fit into.
   Tell it plainly (the prompts below do) that the references are for angle and scale, and that it must not copy their characters.
3. Ask for a flat magenta background (#FF00FF). ChatGPT's "transparent" backgrounds often come out as a fake checkerboard
   picture. Magenta is trivial for me to remove.

---

## 1. Style bible (paste this at the top of EVERY message)

```
STYLE BIBLE (follow exactly, every time)

CAMERA: classic 3/4 top-down RPG view, like Stardew Valley or Pokemon HeartGold. The virtual camera is about 40 degrees
above the horizon, looking down at the character. That means: you can see the TOP of the head, the tops of the ears,
and the base of the tail; the body is slightly foreshortened vertically; the feet are planted on the ground below the
body. It is NOT a flat front-on or side-on cartoon (no platformer look, no mascot-poster look) and NOT a full
bird's-eye view from straight above. The four facing directions are: DOWN (facing the camera), UP (facing away),
LEFT and RIGHT (profile, seen from slightly above).

PIXEL ART RULES:
- True pixel art on a grid. Every art pixel is a perfect square block of exactly 8 by 8 canvas pixels.
- Native character frame: 32 art pixels wide by 48 art pixels tall (so each frame cell is 256 by 384 canvas pixels).
- NO anti-aliasing, NO blur, NO gradients, NO soft edges, NO sub-pixel details, NO half-size pixels, NO smooth curves
  rendered as vector. Edges are hard stair-steps.
- Outline: a clean 1 art-pixel dark outline in a dark warm brown (#3B2A2E), never pure black. The outline is
  darker, not coloured, on the inside shadows (selective outline): the outline is thinner or merges with shading
  where the form turns away from light.
- Palette: at most 16 colours per character. Three tones per material (base, shadow, highlight). Light comes from
  the top-left. Shadows are shifted toward plum/purple, highlights toward warm yellow. Warm autumn feel: cream,
  honey, burnt orange, plum, moss green, dusty blue.
- Proportions: cute chibi animal, about 2 heads tall. Head (without ears) is about 40 percent of the height. Big
  ears add 8 to 10 art pixels. Short legs, round body, chunky readable hands and feet.
- Do NOT draw a ground shadow (I add one in code). Do NOT draw any background, floor, grid lines or labels.
- Background: perfectly flat solid magenta #FF00FF in every cell, nothing else.

CONSISTENCY RULES (most important):
- The SAME character in every frame: same colours, same proportions, same size, same outline weight.
- The character's feet touch the same baseline in every cell (the bottom of the feet is the 44th row of 48). The
  character is centred on the vertical centre line of the cell. Nothing is cropped by a cell edge.
- Frames in one row differ only in the limbs, tail and ears moving. The head stays in the same place (it may bob
  by exactly 1 art pixel).

ORIGINALITY: the reference images are for camera angle and pixel density ONLY. Do not reproduce any character,
species, outfit, colour scheme or object from them. Design an original character from the description below.
```

---

## 2. Message 1: lock the character (one design, not a sheet yet)

Fill the square brackets, paste the style bible above, then this:

```
[PASTE THE STYLE BIBLE HERE]

TASK: design ONE original character and show it in a TURNAROUND, in the 3/4 top-down camera from the style bible.
Canvas 1024 wide by 384 tall, four cells side by side, each 256 by 384 (32 by 48 art pixels at 8x).
Cells left to right: DOWN (facing the camera), LEFT (profile), UP (back), RIGHT (profile). Standing still, neutral
pose, arms relaxed.

CHARACTER: [a small round cream-furred fox kit with pale blue inner ears and a big fluffy tail,
wearing a plum knitted sweater and brown trousers, black dot eyes and tiny pink cheeks].

Remember: top of the head and ears visible from above, body foreshortened, no flat front-on look, hard pixel
stair-steps, 8x8 blocks, magenta background, 16 colours max.
Return one PNG, no text.
```

**Check before moving on (reject and re-roll if any fail):**
- Can you see the top of the head and the tops of the ears in the DOWN view, as if looking down at it?
- Is the LEFT view a true profile, not a 3/4 turn toward the camera?
- Do all four have the same height, the same feet line and the same colours?
- Is it blocky pixel art when you zoom in, with no blur?

If the camera is wrong, use the **fix-it prompts** at the bottom.

---

## 3. Message 2: the walk sheet (same chat, so it keeps the design)

```
Using EXACTLY this character from your last image, draw a WALK SHEET. Same style bible: 3/4 top-down camera,
8x8-pixel blocks, magenta background.

Canvas 1024 wide by 1536 tall, a 4 by 4 grid of equal cells, each 256 by 384 (32 by 48 art pixels at 8x).

ROW 1 (top): DOWN walk cycle, 4 frames left to right:
  frame 1 = right foot forward (contact), frame 2 = passing (feet together, body 1 art pixel higher),
  frame 3 = left foot forward (contact), frame 4 = passing (body 1 art pixel higher).
ROW 2: LEFT walk cycle, same 4 phases, profile view facing left.
ROW 3: UP walk cycle (character walking away from the camera), same 4 phases.
ROW 4: IDLE frames: DOWN idle, DOWN idle with eyes closed (a blink), LEFT idle, UP idle.

Rules for the cycle: arms swing opposite to the legs by 2 to 3 art pixels, the tail sways 1 to 2 art pixels,
the head stays level, the body bobs by exactly 1 art pixel on the passing frames. The character is the same size
in all 16 cells, the feet always touch the same baseline (row 44 of 48), centred in the cell, nothing cropped.
No labels, no grid lines, no shadow. Return one PNG.
```

Why LEFT only: I mirror it to make RIGHT in code, which keeps the character identical on both sides.

---

## 4. Message 3: sitting at a desk (same chat)

```
Same character. Now the SITTING poses for a library desk, same style bible and cell size.
Canvas 1024 wide by 1152 tall, a 4 by 3 grid of 256 by 384 cells.
ROW 1: SITTING FACING DOWN (toward the camera, behind a desk edge, hands on the desk reading a book): 4 frames:
  still, page turn, still, small head nod.
ROW 2: SITTING FACING LEFT (profile, seated on a small stool, hands holding a book): same 4 beats.
ROW 3: SITTING FACING UP (back to the camera, leaning slightly forward, writing): same 4 beats.
Seated characters are the same width and style; legs mostly hidden by the desk. Keep the head in the same
place on all four frames of a row. Magenta background, no desk, no stool, no shadow: the character only.
Return one PNG.
```

---

## 5. Fix-it prompts (paste the one that matches the problem)

**Camera too flat / front-on:**
```
The camera angle is wrong. Redraw it from higher up: the camera is about 40 degrees above the horizon, looking
DOWN at the character. I must see the top of the head and the tops of the ears, the body is slightly
squashed vertically, and the feet sit lower than the body. It must look like a Stardew Valley or Pokemon
HeartGold overworld sprite, not a flat front-facing sticker. Keep the same character and design.
```

**Not real pixels (smooth, blurry, mixed pixel sizes):**
```
This is not true pixel art. Redraw it so that every art pixel is an identical 8 by 8 square block, with hard
stair-step edges, no anti-aliasing, no gradients, no blur, no half-size pixels, at most 16 flat colours. A cell
is 32 by 48 art pixels. Do not smooth or soften anything.
```

**Frames don't match (size, position, proportions):**
```
The frames are inconsistent. Redraw the sheet so the character has IDENTICAL size and proportions in every cell:
same head size, same body size, same outline weight, feet on the same baseline (row 44 of 48), centred on the
cell's vertical centre line. Only limbs, tail and ears move between frames; the head moves at most 1 art pixel.
```

**Colours or style drift:**
```
Keep the exact same colour palette as the first image: [LIST 6 OR 8 HEX COLOURS FROM IT]. Warm autumn,
plum-tinted shadows, honey highlights. Do not introduce new colours or change the outfit.
```

**Left view is a 3/4 turn:**
```
The LEFT row must be a true side profile: the face pointing straight left, one eye visible, both ears seen from
the side, the body also in profile. Not turned toward the camera.
```

---

## 6. How to get many characters cheaply

Do NOT generate every character from scratch. Make 3 to 4 good base animals (fox, rabbit, cat, bear), then I
produce the rest by **recolouring in code**: swap the fur and sweater palette to make 10 to 20 variants
(a rabbit in a green hoodie, a fox in a blue scarf, and so on). Hats and glasses can be one extra layer that
I place on the head frame by frame, because the head moves so little. That is how the "wardrobe" survives with
animals: pick a species and a colourway, instead of mixing body parts.

## 7. What I do with your files

1. Remove the magenta, find the real pixel grid (even if ChatGPT's blocks drifted), and snap every cell to 32 by 48.
2. Reduce each character to one clean palette and repair the outline.
3. Align the feet and centre line across all frames so nothing jitters, and mirror LEFT to make RIGHT.
4. Pack it into one sheet and load it in the library (replacing the current people art), with a test that checks
   every frame is the same size and the feet never move.

If a sheet cannot be rescued (angle wrong, frames wildly different), I will say so rather than ship it.

## 8. Ownership and style notes

- The prompts ask ChatGPT for original designs and use lofi.town only as an angle and density reference. Do not
  ask it to "copy lofi.town": copying its characters or look would be a legal and reputational problem for Plumi.
- AI-generated images may not be protected by copyright in many places, and the rules are unsettled. If owning
  the characters matters (merchandising, exclusivity), have a pixel artist redraw the final designs on top of the
  best AI sheets. That is a cheap job compared with drawing from nothing.
- If you hit a wall after a few rounds on camera angle and frame consistency, that is the point at which paying a
  pixel artist for one character set (walk, idle, sit, four directions) is the better use of time.
