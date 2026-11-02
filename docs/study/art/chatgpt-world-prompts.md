# ChatGPT prompt pack: the Plumi town (trees, houses, benches, water)

Decisions (founder, 1 November 2026): an open-air autumn town in the lofi.town spirit, with the Grand Library as a building
you walk into; web only for now; contents = autumn trees, houses and shops, benches/tables/lamps, water; medium size
(about 4 by 3 screens). Same 3/4 top-down camera, outline, palette discipline and pixel chunkiness as the characters.

**How the pieces will be used.** An agent builds a tile ground (grass, plaza, paths) and places objects on it, sorted by their
base line so characters walk behind and in front of them, with a collision footprint per object and sit spots on benches and
tables. ChatGPT cannot make a seamless tileset or exact pixel grids, so we do not ask it to. We ask for: ground texture swatches
(the agent checks seams and falls back to code), and every other thing as a SEPARATE OBJECT SPRITE on flat magenta, in sheets,
with a typed manifest. I snap the sheets to a real pixel grid, as I did for the fox.

---

## 0. Attach to the FIRST message (all are references only)

1. The fox character sheet (`docs/study/art/source/fox-sheet-01.png`): the SCALE and CAMERA reference. The fox is **F = 25 art pixels
   tall**. Everything below is sized in fox-heights.
2. The two lofi.town autumn screenshots: for camera angle, density and mood ONLY. Do not copy any object, layout, building,
   sign, character or colour scheme.
3. A crop of the Plumi library room (`public/library/bg.png`): our own art, for outline weight and warmth.

---

## 1. THE WORLD BIBLE (paste once, at the top of the single session)

```
You are my pixel-art environment artist for the rest of this chat. We are building an ORIGINAL warm autumn town for a study
app, as separate OBJECT SPRITES on a flat magenta background, in the EXACT camera, outline and chunkiness of the attached fox
character sheet. The fox is the SCALE reference: the fox is "F" = 25 art pixels tall. The lofi.town screenshots are references
for camera angle, density and mood ONLY: do not copy any of their objects, layouts, buildings, signs, characters or colours.

CAMERA: classic 3/4 top-down RPG view (Stardew Valley / Pokemon HeartGold), about 40 degrees above the horizon. You see roofs
sloping toward you from above, the front wall facing the camera with its door and windows, the top surfaces of benches and tables,
the canopies of trees from above with the trunk visible below them. Never a flat front-on elevation, never a straight bird's-eye plan.
Every object in every sheet uses this same camera.

PIXEL ART: true pixel art. Hard stair-step edges, no anti-aliasing, blur, gradients or soft glow. Chunky blocks of identical size.
One art pixel is a square block; draw so that a tree of 112 art pixels is about 448 canvas pixels tall (so 1 art pixel = 4 canvas
pixels on the object sheets, and 8 on the ground swatches). A 1-art-pixel dark warm brown outline (#3B2A2E, never pure black) on
every object, thinner where forms turn away from the light. Three tones per material (base, shadow, highlight). Light from the
top-left. Shadows shift toward plum, highlights toward warm yellow.

NO ground shadows (the engine draws them). NO text, letters or numbers anywhere (signs and plaques are left blank or carry a small
icon). NO characters or animals. NO background scenery. Each object stands alone.

PALETTE (use only these colours and their near tints; this keeps the whole town coherent):
- grass: #DDE595 #C9D67A #AFC060 #8FA64A
- plaza brick: #F3DC93 #E8C874 #D2A95A #B88A47
- dirt path: #C99A5E #A87A45
- gold foliage: #F6C453 #E9A93A #D4852A #B8651F #8E4A1A
- orange and red foliage: #E8873A #D4602E #B5442A #8C3324
- wood and trunks: #8A5A3C #6B4430 #4A2F25
- terracotta roof: #D9633F #BA4A2F #8F3425; slate roof: #7C8FA3 #5C6E84; moss roof: #7B9A5A #5E7B43
- walls: #F4E6C8 #E6D2A6 #CDB383; plum shadow: #7A5C7E #5E4766
- water: #8EC9D8 #62A8BE #3F7F99, foam #E9F6F2
- accents (sparingly): pumpkin #F08A24, teal #4FB3AD, lilac #A98BE0, cream #FFF8E6
Light cheerful warm autumn afternoon; saturated but soft.

SHEET RULES
- Canvas size is stated for each batch. Flat solid magenta #FF00FF background everywhere outside objects.
- Every object is centred in its own cell with at least 16 canvas pixels of empty magenta on every side. Nothing touches or crosses a
  cell edge. The base of each object (where it meets the ground) sits on the same horizontal line within its cell where possible.
- After EVERY image, below it, write a MANIFEST as a plain text table in reading order (left to right, top to bottom):
  index | name | width x height in ART pixels | footprint width x depth in ART pixels (the ground it blocks, at the base) | notes (e.g.
  "door at bottom centre", "sittable").
  Use short snake_case names exactly as listed in the batch.
- Original designs only. Friendly and school-safe. Same warm autumn feel across everything.

HOW WE WORK: one batch per reply, in the order below, starting with batch 1. After each image + manifest, stop and wait. When I say
"next" do the next batch; when I say "redo" redo that batch with my fix. Draw each batch fresh from the written spec and the
attached references, never from the previous image, so errors do not build up. Keep the SCALE TABLE exact.

SCALE TABLE (F = 25 art pixels, the attached fox's height)
large tree 4.0F tall (about 100 to 112 px), medium tree 3.0F, small tree 2.0F, bush 0.8F, cottage 5F wide by 5F tall,
cafe 7F by 5.5F, library building 12F by 8F, bench 2F wide by 0.9F tall, picnic table 3F by 1.5F, lamp post 2.2F tall,
signpost 1.6F, notice board 2F by 2F, fence panel 1F wide by 0.7F tall, pond about 8F by 5F, bridge 4F by 1.5F, fountain 3F,
small decor (pumpkin, mushroom, rock, flowers) 0.2F to 0.8F.
```

---

## 2. THE BATCHES (paste after the bible, in the same message or as the next one)

```
BATCH LIST (do one per reply, in order; wait for "next")

1. GROUND SWATCHES. Canvas 1536 x 1024. A grid of 12 columns by 8 rows of 128 x 128 cells; each cell is ONE ground tile of 16 x 16
   art pixels (1 art pixel = 8 canvas pixels), a flat top-down texture that tiles seamlessly on all four sides, filling its whole
   cell with no magenta and no outline. Rows: (1) grass A, 12 subtle variants; (2) grass with tiny flowers and tufts, 12 variants;
   (3) grass with fallen golden and orange leaves, 12; (4) herringbone plaza brick, 12 variants of the same pattern with a few
   different bricks; (5) plaza brick worn and mossy, 12; (6) dirt path, 12; (7) plaza-to-grass edge pieces: straight edges in 4
   rotations and inner and outer corners in 4 rotations each, 12 total (grass on the one side, plaza brick on the other, soft
   irregular grass tufts along the line); (8) dirt-to-grass edge pieces, same 12 pieces. Manifest: row, column, name, "seamless: yes".
   names: grass_a_NN, grass_flower_NN, grass_leaves_NN, plaza_NN, plaza_mossy_NN, dirt_NN, plaza_edge_NN, dirt_edge_NN.

2. LARGE AUTUMN TREES. Canvas 1536 x 1024: a grid of 3 columns by 2 rows of 512 x 512 cells (128 x 128 art pixels each).
   Six DIFFERENT large trees about 100 to 112 art pixels tall, seen from the 3/4 top-down camera (canopy top visible, trunk and
   roots below): tree_gold_round, tree_orange_wide, tree_amber_tall, tree_gold_twin (two merged canopies), tree_mixed_leaf
   (gold and red patches), tree_red_maple. Chunky, layered leaf clumps with hard-edged highlights, no fuzzy texture.

3. MEDIUM AND SMALL TREES AND BUSHES. Canvas 1536 x 1024: a grid of 6 columns by 4 rows of 256 x 256 cells (64 x 64 art pixels each).
   24 objects: 6 medium trees (3F), 6 small trees (2F), 6 bushes and hedges (0.8F), 6 stumps, logs and fallen branches.
   names tree_m_NN, tree_s_NN, bush_NN, log_NN.

4. COTTAGES A. Canvas 1536 x 1024: two cells of 768 x 1024 (192 x 256 art pixels). Two houses, about 5F by 5F (125 x 125 art px),
   from the 3/4 camera: front wall with a door (door at the bottom centre, 1.3F tall), two windows with shutters, a chimney, a
   sloping roof seen from above. cottage_terracotta (terracotta roof, cream walls, a window box with flowers) and
   cottage_slate (blue-grey roof, honey-coloured walls, a round attic window).
   COTTAGES B (batch 5): the same format. cottage_moss (moss-green roof, cream walls, ivy on one side) and cottage_mustard
   (terracotta roof, mustard walls, a small porch with a lantern).

6. THE CAFE. Canvas 1536 x 1024 = ONE building, about 7F by 5.5F (175 x 140 art px) centred: a cosy cafe with a big awning, a
   large window with warm lit glass, double doors at the bottom centre, a giant coffee cup on the roof as its sign, steam
   as part of the sprite (no text anywhere). name: cafe.
7. THE BAKERY (same format, 6F by 5F): a smaller shop with a striped awning, bread and pastries in the window, a chimney with a
   little smoke, a sandwich board WITHOUT text. name: bakery. (Batch 8: BOOKSHOP, same format, shelves of books in the window,
   a hanging book-shaped sign without text. name: bookshop.)

9. THE GRAND LIBRARY (hero building). Canvas 1536 x 1024 = ONE building, 12F by 8F (about 300 x 200 art px), centred. A grand
   old library: stone and warm brick, a central clock tower or small dome, a wide arched double door at the bottom centre (2F
   tall, clearly an ENTRANCE), tall arched windows with a warm glow, stone steps up to the door, a banner without text, book
   motif carvings (no letters). Roof seen from above. It must look important and welcoming. name: grand_library.

10. SEATING. Canvas 1536 x 1024: 6 columns by 4 rows of 256 x 256 cells. 24 sittable things, each drawn EMPTY (no characters),
    names and notes in the manifest with a sit-spot (where a character's body would be) as "sit: x,y in art pixels from the
    cell's top-left": bench_down (bench facing the camera), bench_up (back to the camera), bench_left, bench_right, bench_long_down,
    bench_long_up, picnic_table_h (a table with a bench on each long side, horizontal), picnic_table_v (vertical), cafe_table_round
    with two chairs facing each other, cafe_table_square, stool_a, stool_b, log_seat, hay_bale, swing_bench, tree_stump_seat, two
    deckchairs, a park bench with a lamp, and 5 more matching seating pieces of your choice.

11. STREET FURNITURE. Canvas 1536 x 1024: 6 columns by 4 rows of 256 x 256 cells. 24 objects: lamp_post_a, lamp_post_b (a warm
    lantern lamp, glowing glass), lamp_post_double, fence_h, fence_v, fence_corner_a, fence_corner_b, fence_gate, signpost_a,
    signpost_b (blank arrows), notice_board (pinned papers WITHOUT text), mailbox, water_well, bin, planter_flowers, planter_pumpkins,
    bicycle_rack, a small cart of apples, a barrel, a stack of crates, a hanging-lantern string pole, a flagpole, a stone
    wall segment, a stone arch.

12. NATURE DECOR. Canvas 1536 x 1024: 6 columns by 4 rows of 256 x 256 cells. 24 objects: pumpkin_a, pumpkin_b, pumpkin_patch,
    pumpkin_stack, flowers_red, flowers_orange, flowers_purple, flowers_white, flower_bed_long, mushroom_a, mushroom_cluster, rock_a,
    rock_b, rock_cluster, leaf_pile_gold, leaf_pile_red, fern, tall_grass_clump, reeds, a scarecrow (no face of a person: a
    friendly sack-and-straw one), a haystack, a wheelbarrow with leaves, a birdhouse on a post, a tiny fox den entrance.

13. WATER. Canvas 1536 x 1024. Object sheet of 4 cells of 768 x 512 (192 x 128 art px): pond_a (an irregular pond about 8F by 5F with a
    grassy rim, reeds and lily pads, calm blue water with a light shine), pond_b (smaller, rounder), stream_h (a short straight
    stream segment that can repeat horizontally, banks included) and stream_corner. Then batch 14: BRIDGE AND FOUNTAIN, canvas
    1536 x 1024: bridge_wood_h (an arched wooden footbridge), bridge_wood_v, fountain_round (a stone fountain with water spouts),
    stepping_stones, lily_pads, a rowboat, a small wooden dock.

When finished with 14, list anything you think the town still needs for a cosy, believable autumn square (not generated yet).

Start now with BATCH 1.
```

---

## 3. If a batch comes out wrong (paste the matching fix)

**Wrong camera (flat front-on):**
```
Redo this batch with the correct camera: 3/4 top-down, about 40 degrees above the horizon. I must see roofs sloping toward me from
above, the tops of benches and tables, tree canopies from above with the trunk below. Not a flat front elevation. Same objects, same
palette, same sheet layout.
```
**Wrong scale:** "The objects must be sized in fox heights (F = 25 art pixels): a large tree 4F, a cottage 5F by 5F, a bench 2F wide.
Redo this batch at exactly these sizes, in the same cells."
**Not pixel art:** "Every art pixel must be an identical 4 by 4 canvas block with hard stair-step edges, no anti-aliasing, no blur, no
gradients. Redo."
**Colour drift:** "Use ONLY the palette in the bible and its near tints. Redo with the same objects."
**Objects touching cell edges:** "Each object must sit centred in its cell with 16 pixels of empty magenta on every side. Redo."
**Text appeared:** "There must be no letters or numbers anywhere. Leave signs blank or use a small icon. Redo."

---

## 4. What the agent does with the sheets (so you know what "usable" means)

1. A tool (`tools/art/world_sheet.py`, built from the fox tool) removes the magenta, cuts each object by its cell, snaps it to the
   art-pixel grid with the shared palette, and writes `public/library/world/<name>.png` plus a manifest JSON from your tables
   (size, footprint, sit spots, door position).
2. The ground is a tile map built from the swatches (seams checked; code-made fallback when a swatch does not tile).
3. The world is a data file: map size about 1600 x 1000 art pixels (medium, about 4 by 3 camera screens), ground layers, objects
   with positions, footprints (collision), sit spots, the library door. Objects are drawn sorted by the y of their base so students
   walk behind and in front of them; walking uses the same movement and collision code as the library.
4. Students share the town the same way as the library (the same lobby and Realtime), over the larger area; walking through the
   library door enters the library room; a door back out returns to the town.
5. Reduced motion, performance (the ground is prerendered once), and the homepage engine staying untouched are kept as rules.

Not in this pack on purpose: animated water, falling leaves, smoke and day or night lighting. Those I add in code on top of the
sprites, and they are what make it feel alive.
