# Interior prop kit: ingest, scale and verdict

The founder had ChatGPT draw a modular interior prop kit (six sheets, eight props each, magenta background, 1536 x 1024) so the cafe, library and home
interiors can be BUILT from sprites (placed, depth sorted, with collision and sit spots, as lofi.town does) instead of one baked picture
(`docs/study/cafe.md`). This folder is the ingest and the judgement. No model calls were made (the tools are deterministic).

    python3 tools/art/interior_props.py          # the two atlases, per-prop PNGs, contact sheets   (about 3 minutes: the palette work is slow)
    python3 tools/art/interior_scale_check.py    # the scale check composite (k = 4; --unscaled for the contrast)
    npm run town:test                            # includes src/lib/town/interior-atlas.test.ts (the manifests' schema)

## Files

| File | What |
|---|---|
| `interior-atlas.png` + `.json` | THE ATLAS: 48 props, each cut straight from its source at its own recommended scale (`scale` = source px per art px, as `landmarks.py`). 512 x 133, 236 colours, binary alpha. |
| `interior-atlas-unscaled.png` + `.json` | The same 48 cut at the town's S2 5.0 (what the sheets give if nobody rescales), same schema, geometry recomputed at that size. 512 x 304. |
| `props/<id>.png` | One PNG per prop at the recommended scale. |
| `interior-contact.png`, `interior-contact-unscaled.png` | Every prop, 3x, with its name, size, `c`, pixel ratio and the geometry drawn over it (red anchor, blue footprint, green top surface, yellow seat, magenta frontCut line, cyan backCut line, orange light, white animation rect). |
| `interior-scale-check.png` (+ `-unscaled`) | The composite: a code drawn room furnished from the atlas with the town's animals at 1:1. |
| `../source/interior-{library,cafe,kitchen,decor,seating,tables}.webp` | The six founder sheets, lossless (the zip's PNGs: they are cleaner than the three earlier lossy webps). |

ids are the founder's sprite names from the zip (`interior-components/sprites/`); the first-pass names are kept as `alias` in the JSON. Mapping of the
zip, found by pixel matching the sprites to the sheets: its `sprites/` are naive 384 x 512 grid cuts (not used; six of them are the whole sheet:
`cafe-stool` = seating, `chimney-hood` = the kitchen sheet, `circulation-counter` = the library sheet, `coffee-table` = tables, `framed-picture` = decor,
`pastry-case` = cafe). **The sheet called `cottages.png` is not new houses: it is the KITCHEN sheet** (sink, worktop, stove, fridge, hood, fireplace,
sideboard, wall shelf: the same eight props as the earlier chat image). There are no new cottage designs in this zip, so nothing was added to the
cottage pipeline and the two silhouettes (terracotta, slate) are still the only houses. Every sprite in `sprites/` has a prop in the sheets; the sheets' props
that the zip names differently: `circulation-counter` is the library's desk with lamp, chair back and books (`desk_lamp`), `display-island` is the console
table with a shelf, `reading-desk` is the kneehole desk with drawers, `chair-right` is the chair whose SITTER FACES RIGHT (backrest at the left of the
sprite: what the first pass called "chair left side view"), `chair-left` faces left, `chair-up` is the back view (sitter faces away), `chair-down` the front view.

## The cut

`world_objects.cut_sheet` / `cut_one` as for the cottages: magenta key, connected components (exactly 8 a sheet, found on the first try on all six),
ONE 40 colour palette a sheet, a grid phase per sprite chosen for the fewest half covered cells, a vote of palette indices in each cell, and the 1 px
outline redrawn in the darkest colour (so the halo of the source is not copied: **0 pinkish pixels in 34,212**). The sheets are lossless PNG, so there is no
compression fringe. The cut is clean at every scale; what changes with scale is how much of the drawing survives (below).

## Scale: what the sheets draw against what a person needs

A town character is 25 rows (the fox's idle frame); the engine's zoom for interiors is k = 4 to 5. `nativePx` is the sheet's own pixel measured per prop
(edge energy folded on a period, both axes; good to about 0.7 px). It is **not one value**: library 6.6 (6.0 to 7.4), cafe 5.1 (4.0 to 5.8), kitchen 6.0
(5.4 to 7.0), decor 5.9, seating 7.0 (6.0 to 7.7), **tables 4.4 (3.8 to 4.8)**. The tables are drawn about 1.6 times finer than the chairs.

The founder's rules (a chair seat 0.45 to 0.5 person high, a counter 0.6 to 0.7, a fridge 1.5, a tall bookcase 1.8 to 2, a sofa 3 persons wide, a door 1)
cannot all hold at once on these drawings. The pictures have the chair 2 times too big (as if a person were 50 rows), the sofa about right, the counters in
between. Choices made: the seat height rule wins for chairs and stools; counters and tables 0.65 person; the tall bookcase 1.87; **the sofa is 2.1 persons
wide, not 3** (3 persons wide would put its seat at 0.78 person, higher than the table: a person on it would look like a child on a throne; the armchair
the same: seat 0.54). Tabletop things (espresso machine, grinder, small plant, book stack) are sized to stand on a counter or table, not on the floor
(`altScale` gives the floor size for the stack and the plant).

`scale` (the `c` column) is source px per art px; `scaleVsS2` = 5.0 / `c` is the factor against the unscaled atlas (below 1 = shrunk: **47 of 48 are
shrunk, only the rug is 1.0**). `pixelRatio = nativePx / c`: 1.0 means one drawn pixel is one art pixel; under 0.5 the prop lost more than half its
linear detail. Distribution: **12 props at 0.75 or more, 24 between 0.5 and 0.75, 12 under 0.5** (book-stack, espresso-machine, coffee-grinder, service-counter,
pastry-case, baguette-basket, prep-cabinet, stove, chimney-hood, hanging-shelf, small-plant, wall-sconce). In those the interior drawing (cupcakes in the
case, the gauge on the machine, the grain on the counter, spines on the stack) turns into a few pixels. Still readable at k = 4 as the composite shows, and
the outline stays a clean 1 px because it is redrawn. The library props (bookcases, window, rug, sofas, floor lamp) are the ones that come out at about
one pixel per art pixel and look best. **Within one room the pixel density therefore varies 3 times** (0.37 to 1.16): a bookcase pixel is nearly one art
pixel, the case's is a third of one. At k = 4 this is visible on close inspection (the tables' grain and the counters' fittings are finer than the
bookcases'), not at first glance. The fix is not in code: it is the prompts below (draw every prop at the same pixel size, to the sizes in the person table).

### The size table (the final table; all scales applied, atlas `interior-atlas.json`)

| id (first name) | sheet | view | native px (src) | source px | S2 5.0: art px, persons | scale `c` | x vs S2 | final art px | final persons | pixel ratio |
|---|---|---|---|---|---|---|---|---|---|---|
| `single-bookcase` (`bookcase_tall`) | library | front | 7.1 | 152 x 352 | 31 x 71, 1.2 x 2.8 | 7.5 | 0.67 | 20 x 47 | 0.80 x 1.88 | 0.95 |
| `double-bookcase` (`bookcase_wide`) | library | front | 6.4 | 288 x 352 | 58 x 71, 2.3 x 2.8 | 7.5 | 0.67 | 38 x 47 | 1.52 x 1.88 | 0.86 |
| `low-bookcase` (`bookcase_low`) | library | front | 6.3 | 248 x 181 | 50 x 36, 2.0 x 1.4 | 7.5 | 0.67 | 33 x 24 | 1.32 x 0.96 | 0.85 |
| `book-display` (`book_rack`) | library | front | 7.1 | 260 x 255 | 52 x 51, 2.1 x 2.0 | 8.5 | 0.59 | 31 x 30 | 1.24 x 1.20 | 0.83 |
| `circulation-counter` (`desk_lamp`) | library | front | 7.4 | 315 x 234 | 63 x 47, 2.5 x 1.9 | 8.2 | 0.61 | 39 x 29 | 1.56 x 1.16 | 0.90 |
| `arched-window` (`window_arched`) | library | front | 6.0 | 238 x 309 | 48 x 62, 1.9 x 2.5 | 7.5 | 0.67 | 32 x 41 | 1.28 x 1.64 | 0.80 |
| `wall-clock` (`wall_clock`) | library | front | 6.2 | 161 x 269 | 32 x 54, 1.3 x 2.2 | 8.5 | 0.59 | 19 x 32 | 0.76 x 1.28 | 0.74 |
| `book-stack` (`book_stack`) | library | front | 6.5 | 151 x 140 | 30 x 28, 1.2 x 1.1 | 16 | 0.31 | 9 x 9 | 0.36 x 0.36 | 0.40 |
| `espresso-machine` (`espresso_machine`) | cafe | front | 5.0 | 251 x 281 | 50 x 56, 2.0 x 2.2 | 13 | 0.39 | 19 x 22 | 0.76 x 0.88 | 0.39 |
| `coffee-grinder` (`grinder`) | cafe | front | 5.5 | 128 x 290 | 26 x 58, 1.0 x 2.3 | 15 | 0.33 | 8 x 19 | 0.32 x 0.76 | 0.37 |
| `service-counter` (`counter_service`) | cafe | front | 4.1 | 341 x 237 | 68 x 48, 2.7 x 1.9 | 8.5 | 0.59 | 40 x 28 | 1.60 x 1.12 | 0.49 |
| `corner-counter` (`counter_corner`) | cafe | front | 4.9 | 290 x 264 | 59 x 53, 2.4 x 2.1 | 8.5 | 0.59 | 34 x 31 | 1.36 x 1.24 | 0.57 |
| `pastry-case` (`display_case`) | cafe | front | 4.0 | 328 x 272 | 65 x 55, 2.6 x 2.2 | 11 | 0.46 | 30 x 25 | 1.20 x 1.00 | 0.37 |
| `baguette-basket` (`baguette_basket`) | cafe | front | 5.7 | 194 x 279 | 39 x 56, 1.6 x 2.2 | 13 | 0.39 | 15 x 22 | 0.60 x 0.88 | 0.44 |
| `bread-rack` (`bread_rack`) | cafe | front | 5.5 | 240 x 320 | 48 x 64, 1.9 x 2.6 | 10.5 | 0.48 | 23 x 30 | 0.92 x 1.20 | 0.53 |
| `bakery-oven` (`brick_oven`) | cafe | front | 5.8 | 271 x 343 | 55 x 69, 2.2 x 2.8 | 9 | 0.56 | 30 x 38 | 1.20 x 1.52 | 0.64 |
| `sink-cabinet` (`kitchen_sink`) | kitchen | front | 6.3 | 266 x 301 | 53 x 60, 2.1 x 2.4 | 12.5 | 0.40 | 21 x 24 | 0.84 x 0.96 | 0.50 |
| `prep-cabinet` (`kitchen_worktop`) | kitchen | front | 5.4 | 258 x 334 | 52 x 67, 2.1 x 2.7 | 12.5 | 0.40 | 21 x 27 | 0.84 x 1.08 | 0.43 |
| `stove` (`stove`) | kitchen | front | 6.0 | 228 x 290 | 46 x 58, 1.8 x 2.3 | 12.5 | 0.40 | 18 x 23 | 0.72 x 0.92 | 0.48 |
| `refrigerator` (`fridge`) | kitchen | front | 5.8 | 200 x 395 | 40 x 79, 1.6 x 3.2 | 10.5 | 0.48 | 19 x 38 | 0.76 x 1.52 | 0.55 |
| `chimney-hood` (`hood_pans`) | kitchen | front | 6.1 | 248 x 320 | 50 x 64, 2.0 x 2.6 | 12.5 | 0.40 | 20 x 26 | 0.80 x 1.04 | 0.49 |
| `fireplace` (`fireplace`) | kitchen | front | 6.1 | 313 x 310 | 63 x 62, 2.5 x 2.5 | 9.7 | 0.52 | 33 x 32 | 1.32 x 1.28 | 0.63 |
| `sideboard` (`sideboard`) | kitchen | front | 7.0 | 310 x 322 | 62 x 65, 2.5 x 2.6 | 12.5 | 0.40 | 25 x 26 | 1.00 x 1.04 | 0.56 |
| `hanging-shelf` (`wall_shelf_mugs`) | kitchen | front | 5.5 | 314 x 208 | 63 x 42, 2.5 x 1.7 | 12.5 | 0.40 | 25 x 17 | 1.00 x 0.68 | 0.44 |
| `tall-plant` (`plant_large`) | decor | front | 6.5 | 192 x 330 | 39 x 66, 1.6 x 2.6 | 9.5 | 0.53 | 20 x 35 | 0.80 x 1.40 | 0.69 |
| `small-plant` (`plant_small`) | decor | front | 5.6 | 128 x 133 | 26 x 27, 1.0 x 1.1 | 14 | 0.36 | 9 x 10 | 0.36 x 0.40 | 0.40 |
| `floor-lamp` (`floor_lamp`) | decor | front | 6.3 | 136 x 300 | 28 x 60, 1.1 x 2.4 | 7 | 0.71 | 19 x 43 | 0.76 x 1.72 | 0.90 |
| `wall-sconce` (`wall_sconce`) | decor | front | 5.9 | 139 x 147 | 28 x 29, 1.1 x 1.2 | 13 | 0.39 | 11 x 11 | 0.44 x 0.44 | 0.46 |
| `framed-picture` (`picture_frame`) | decor | front | 5.7 | 205 x 201 | 41 x 40, 1.6 x 1.6 | 10 | 0.50 | 21 x 20 | 0.84 x 0.80 | 0.57 |
| `cottage-window` (`window_curtains`) | decor | front | 5.5 | 229 x 219 | 46 x 44, 1.8 x 1.8 | 7.3 | 0.69 | 32 x 30 | 1.28 x 1.20 | 0.75 |
| `terracotta-rug` (`rug_red`) | decor | top | 5.8 | 256 x 159 | 51 x 32, 2.0 x 1.3 | 5 | 1.00 | 51 x 32 | 2.04 x 1.28 | 1.16 |
| `sage-mat` (`doormat_green`) | decor | top | 6.1 | 209 x 133 | 42 x 27, 1.7 x 1.1 | 9 | 0.56 | 23 x 15 | 0.92 x 0.60 | 0.67 |
| `chair-down` (`chair_front`) | seating | front | 7.0 | 146 x 260 | 29 x 52, 1.2 x 2.1 | 12 | 0.42 | 13 x 22 | 0.52 x 0.88 | 0.59 |
| `chair-up` (`chair_back`) | seating | front | 7.7 | 150 x 252 | 30 x 51, 1.2 x 2.0 | 12 | 0.42 | 13 x 21 | 0.52 x 0.84 | 0.64 |
| `chair-right` (`chair_left`) | seating | front | 6.0 | 155 x 259 | 31 x 52, 1.2 x 2.1 | 12 | 0.42 | 13 x 22 | 0.52 x 0.88 | 0.50 |
| `chair-left` (`chair_right`) | seating | front | 6.4 | 156 x 260 | 31 x 52, 1.2 x 2.1 | 12 | 0.42 | 13 x 22 | 0.52 x 0.88 | 0.54 |
| `cafe-stool` (`stool_round`) | seating | front | 7.5 | 150 x 180 | 30 x 36, 1.2 x 1.4 | 13 | 0.39 | 11 x 14 | 0.44 x 0.56 | 0.58 |
| `terracotta-sofa` (`sofa_red`) | seating | front | 6.8 | 322 x 207 | 64 x 42, 2.6 x 1.7 | 6.2 | 0.81 | 52 x 33 | 2.08 x 1.32 | 1.10 |
| `moss-sofa` (`sofa_green`) | seating | front | 6.8 | 321 x 208 | 64 x 42, 2.6 x 1.7 | 6.2 | 0.81 | 52 x 33 | 2.08 x 1.32 | 1.10 |
| `reading-armchair` (`armchair_green`) | seating | front | 7.3 | 220 x 244 | 44 x 49, 1.8 x 2.0 | 6.4 | 0.78 | 34 x 38 | 1.36 x 1.52 | 1.15 |
| `square-table` (`table_square`) | tables | 3q | 4.2 | 285 x 307 | 57 x 62, 2.3 x 2.5 | 6.5 | 0.77 | 44 x 47 | 1.76 x 1.88 | 0.65 |
| `round-table` (`table_round`) | tables | 3q | 4.5 | 295 x 336 | 59 x 67, 2.4 x 2.7 | 9 | 0.56 | 33 x 37 | 1.32 x 1.48 | 0.50 |
| `communal-table-horizontal` (`table_wide`) | tables | 3q | 4.2 | 366 x 277 | 74 x 56, 3.0 x 2.2 | 6.5 | 0.77 | 57 x 43 | 2.28 x 1.72 | 0.65 |
| `communal-table-vertical` (`table_long`) | tables | 3q | 4.3 | 254 x 413 | 51 x 83, 2.0 x 3.3 | 6 | 0.83 | 42 x 69 | 1.68 x 2.76 | 0.72 |
| `coffee-table` (`table_low`) | tables | 3q | 3.8 | 331 x 195 | 66 x 39, 2.6 x 1.6 | 7.5 | 0.67 | 45 x 26 | 1.80 x 1.04 | 0.51 |
| `reading-desk` (`desk_kneehole`) | tables | 3q | 4.8 | 359 x 265 | 72 x 53, 2.9 x 2.1 | 8.2 | 0.61 | 44 x 32 | 1.76 x 1.28 | 0.58 |
| `side-table` (`table_side`) | tables | 3q | 4.5 | 236 x 275 | 48 x 55, 1.9 x 2.2 | 9 | 0.56 | 27 x 31 | 1.08 x 1.24 | 0.51 |
| `display-island` (`console_shelf`) | tables | 3q | 4.8 | 350 x 254 | 71 x 51, 2.8 x 2.0 | 8.5 | 0.59 | 41 x 30 | 1.64 x 1.20 | 0.56 |

Reference lengths at the final scale (`refHeightPersons` in the JSON): counter tops 0.64 to 0.69 person (service counter 0.66, sink 0.65, sideboard 0.64);
chair seats 0.45 to 0.52 (the back view's seat is hidden, 0.45); sofas and armchair seats 0.54; fridge 1.52; tall bookcase 1.88
. A door is drawn in code at 25 rows.

## The scale check

`interior-scale-check.png` (k = 4, 340 x 178 art px room): a plain code drawn wood floor and cream wall with a chair rail, skirting and stripes, in
colours taken from the props (nearest palette entries). Cafe corner: the one person door with the sage doormat, wall clock, arched window, a
service counter with the espresso machine, grinder and a small plant on top, the pastry case, the brick oven, a sconce, the cottage window, a floor lamp, a
round table with a stool (a hedgehog), a square table with two chairs (a fox in the right-facing chair, a badger in the left-facing one), a book stack
and a plant on the table. Study corner: three bookcases, a plant on the low one, a wide table with two book stacks, a chair behind and a chair in front,
a rug, the red sofa with two animals, the armchair, a plant. Standing: a red panda by the door, a raccoon at the counter, a capybara, a fox. The red/white
bar at the left is one person (25 rows). `interior-scale-check-unscaled.png` is the same scene from the 5.0 atlas: everything is 1.5 to 2.5 times too
large (the espresso machine towers over the counter, the book stack is as big as an animal, the tables reach the animals' heads).

How the scales were found: from ONE reference length per prop (the `ref` line in `tools/art/interior_props.py`: a counter top, a seat top, the whole height of a bookcase), measured on the source, so they were computed, not tuned by eye. The composite was then looked at: the first render moved nothing in the scales (the door was hidden by the panda and the stool by the round table, so they were re-placed, and the far side chair slot of a table went 3 rows further back). The contrast is the unscaled composite: the same scene from the 5.0 atlas does not work. What reads right at the end: a person fits the chair (feet on the floor, the
seat at the knee, the lap behind the table's front edge), reaches the counter top at the chest, walks through a door of their own height, and stands
under the sconce and the clock. Weak: the far side seat of a table (a sitter behind the 3/4 top plane shows only the head: `seatSlots` puts the chair
6 rows behind the footprint; a real table needs the plane lower or the sitter drawn above it); the red sofa's seated frame is the front facing "read" pose
(the animals have no front sit with legs, so the lap is hidden by `frontCut`); the oven and hood are still too small to be a feature wall.

## Geometry per prop (what the room builder reads)

All art px from the sprite's top left, at the sprite's own scale, in `interior-atlas.json`:

* `anchorX/anchorY`, `sortY`: bottom centre of the base (the lowest 3 rows' span). Sort by the y of the anchor.
* `footprint`: the floor it blocks, the base span (or the full width for counters, cases, sofas, tables) by `depth` rows ending at `anchorY`. Depth is not in
  the pictures (they are front elevations): it is set in persons: bookcases 6 to 8, counters and kitchen 9 to 12, fridge 9, sofas 10, chairs 7, plants 4 to
  5, lamp 4; tables: 0.85 of the drawn top plane (14 to 45 rows). Flat props (`flat: true`: rug, doormat) are drawn under everything and block nothing.
* `wall: true`, `mountHeight` (floor to the sprite's bottom edge, art px): window 21 to 22, clock 32, sconce 40, picture 34, hood 25, wall shelf 30. No footprint.
* `topRect`, `topY`, `topHeight`: where a small thing may stand: for counters, sideboard, sink, fireplace mantel, low bookcase and the wall shelf the band of
  rows the item's bottom may take (3 to 4 rows in elevation); for the 3/4 tables the whole top plane. `topY` the surface height above the floor, art px
  (counters 15 to 17, tables 16 to 41 depending on the view).
* `seats` (chairs, stool, sofas, armchair): `at.x/y` = the column the seated frame's anchor (col 17 of 34) goes on and the row its lowest opaque row rests on (the
  cushion's top); `face` the way the sitter looks; `pose` (`sit` for side views, `read`/`phone` front, `stool` back); `depth`; `stand` (feet point to walk to, 8 rows
  in front). Sofas have two seats (x 0.34 and 0.66 of the width), the others one.
* `frontCut`: rows from here down are drawn OVER the sitter (the seat front covers the lap): chairs seen from the side 9, sofas 20, armchair 25; none for the front
  chair and the stool (the sitter sits in front). `backCut`: rows above this are drawn over the sitter: the back view chair's `backCut` = its height (the whole
  chair is between camera and sitter; the sitter's head and shoulders show above it).
* `seatSlots` (tables): `side` (back/front/left/right), `face` of the sitter, `chair` (a prop id), `dx/dy` of the CHAIR's anchor from the table's anchor, `sitter`
  (behind / beside / front of the table for sorting). Square and round table 4 slots (one a side), wide table 6 (3 behind, 3 in front), long table 8 (3 each end,
  one each side), kneehole desk 1 (behind), low and side tables and the console none.
* `animated` (hints only, no art invented): `fireplace` and `bakery-oven` fire (3 frame code drawn flicker in the sprite's own oranges inside `rect`),
  `wall-clock` pendulum (2 frames), `espresso-machine` steam (3 frames, above the wand), the fireplace's candles (2 frames).
* `light`: `bakery-oven` (r 52, #ff9a3c, flicker), `fireplace` (r 64, same), `floor-lamp` (r 56, #ffd88a), `wall-sconce` (r 36), the circulation desk lamp (r 30),
  windows (`type: "window"`: a pale daylight patch on the floor below, drawn by the engine).

## Verdict against lofi.town

**Use it as a first set; it is not yet lofi.town.** 48 props from six sheets are enough to furnish a cafe corner, a library reading room and a one room cottage
convincingly (the composite is the evidence), but a lofi.town room reads as lived in because of the 100 to 200 distinct things it draws; we have about 35
useful designs (a chair is 4 views of one chair, the two sofas are nearly one design, the bookcases are 3 widths of one).

**Style consistency (good).** One warm palette (ochre wood, sage green, cream, terracotta, brick red), a 1 px dark brown outline of one weight on every sheet,
flat cel shading with 3 to 4 tones per material, rounded cushion corners, a gold highlight line on wood. The kit looks like one hand, and it matches the town's
outside art (the green and cream of the cafe, the wood of the shutters). Light is from ABOVE: the top third is brighter than the bottom third in 38 of 46 props
(mean +19 of 255); left against right is not consistent (31 of 46 are brighter on the left, mean difference 1), so there is no real top left light: shadows are not
baked, which is right (the engine draws them).

**Perspective (the big inconsistency).** Everything is a FRONT ELEVATION (straight on, only a line of top visible) except: the six TABLES, which are drawn from above at
about 45 to 55 degrees (a deep top plane, 40 to 77 percent of the sprite's height, with short legs under it), the `corner-counter` (an isometric style L with diagonal edges), the round
table (steeper than the square one) and the rug and mat (flat plan views). Chairs are pure elevations (the seat is a thin slab, the sitter sits in front of it). The
mix is workable if the room is a front elevation stage with floor tiles in plan view (as the composite is) and the tables are treated as the only 3/4 pieces, but a
chair beside a table looks as if two cameras were used: the table top is a floor you could lay a rug on and the chair's seat has no depth. The corner counter cannot
join the straight counters (diagonal edges) and has no use unless a whole L is drawn. One camera angle is the first thing to fix in the next sheets.

**Where it is good.** Bookcases, windows (arched and curtained), clock, floor lamp, plants, sofas and armchair, the oven and fireplace, the rug: crisp, readable at one
pixel per art pixel (pixel ratio 0.75 to 1.16), strong silhouettes, no halos. The fireplace, oven, stove, fridge and bread rack are attractive and have clear
animation or light sites. The tables' wood grain is rich, and recolouring them (palette swap per colour, as the cottages' roofs) is a cheap way to 5 or 6 woods.

**Where it is inconsistent or unusable.**
* `corner-counter` (isometric corner): unusable with the other counters.
* `chimney-hood` has the pans hanging from it: the sprite's bottom edge is the pans', not the hood's, so `mountHeight` is where the pans end; usable only above the stove.
* `circulation-counter` (library desk with lamp, chair back and books baked on it): the baked chair back and books cannot be moved; `reading-desk` (kneehole) is the better desk.
* Baked-on items on `service-counter` (chalkboard, flowers, cups), `sink-cabinet`, `prep-cabinet`, `sideboard` (plant, jug, books), `fireplace` (candles, plant, jug), `fridge` (plant on top),
  `hanging-shelf` (jars, plant): they cannot be removed, so two sideboards look like twins. The next sheets need the empty furniture and the items apart.
* The chairs are one design in four views (no stool variety, no bench), the back view chair's slats are 1 px wide at 13 x 21; the stool looks like a small round table.
* `espresso-machine`, `coffee-grinder`, `pastry-case`, `baguette-basket`, `book-stack`, `small-plant`, `wall-sconce`: pixel ratio 0.37 to 0.46: at their right size the
  detail is gone (the cupcakes, gauge, crumbs, spines). They are drawn for a 2.5 times larger person; redraw small things small (prompts 3, 4).
* Pixel size varies by sheet (4.4 tables, 5.1 cafe, 6.6 library, 7.0 seating) so the tables' grain is 1.6 times finer than the chairs'.

**Pixel grid and cleanliness.** All sheets are lossless, edges are hard, no anti-aliasing, no magenta fringe; the pixel grid is not exact (ChatGPT does not draw on a perfect
grid: edge periods wander by a fraction of a pixel across a sprite), which the vote cut absorbs (grid phase chosen per sprite, ring outline redrawn). After the cut every sprite
is a clean palette sprite with a 1 px outline; none were visible in the contact sheets or the composite at k = 4. The palette is one 40 colour set a sheet, 236 in the atlas.

## What is missing for a lofi.town level interior, and how many

| Need | Have | Need (roughly) | Why |
|---|---|---|---|
| Tables WITH things on them (laid, study, bakery), cloths | 6 empty tables | 10 | tables are the most looked at object; they must carry plates, mugs, laptops, books |
| Small desk and table items (mug, plate, cake, teapot, open book, laptop, notebook, pencil pot, phone, candle, vase, bread) | 1 book stack | 30 | the loop "student sits and studies" needs things to study with |
| Floor swatches (3 wood tones, checker, stone flags, carpet, tile) and wall swatches (plaster, wallpaper stripe, wainscot, brick, kitchen tile) | none: the composite floor and wall are code drawn | 6 floors, 6 walls (32 x 32 tiles) | floors and walls are 70 percent of the picture |
| Trim: skirting, chair rail, crown, window and door frames, arch, wall corners | none | 8 | the wall reads flat without them |
| Doors (front, interior open and closed, arched, glass shop door), stairs (straight, with railing), gallery railing | none (the door in the composite is a code box) | 10 | the exit and the second floor |
| Seating variety: benches (2 views), booth, bar stool, armchair colours, window seat cushion, ottoman, 2 more chair designs | 4 views of 1 chair, 1 stool, 2 sofas, 1 armchair | 14 | sit spots drive the town's sim |
| Modular counters (straight, end cap, till, glass top, bar with bottle shelf, coffee station) and cabinets, empty | 3 counters with items baked on | 8 | a cafe is built from a counter line |
| Shelves WITH items (books, jars, plants, mugs, bread), ladders, magazine racks | 3 bookcases + 1 wall shelf | 12 | |
| Lights: pendant, string lights, candles, desk lamp, chandelier | floor lamp, sconce | 6 | evening lighting is a lofi.town signature |
| Plants: hanging, cactus, fern, herbs, flowers in vase, tree in pot | 2 | 8 | |
| Windows (plain, bay, round, shop front), curtains | 2 | 5 | |
| Wall decor: posters, chalkboard menu, mirror, bunting, noticeboard, a second frame | 1 picture, 1 clock | 8 | |
| Pets: a cat asleep, sitting, on a cushion; a dog | 0 | 5 | the single biggest "alive" cue |
| Animation frames: fire (3), oven (3), steam, candle, pendulum (2), curtains | 0 (hints only) | 12 frames | |
| Beds and bedroom (bed, wardrobe, dresser), desk with lamp and chair | 0 | 6 | the cottage |
| **Total** | **48 (about 35 designs)** | **about 160** | lofi.town uses roughly 100 to 200 distinct props |

## Next steps (in the order they unblock the room builder)

1. The room builder can start NOW on these 48 (the atlas JSON has everything): cafe and library rooms from the composite's pattern; engine use of `seats`, `frontCut`,
   `backCut`, `footprint`, `topRect` is what is untested (no engine code was touched).
2. Send prompts 1 to 4 below (tables with items, floor and wall swatches, doors stairs trim, small items). They fix the missing counts and the pixel size.
3. Decide the camera once (below) before asking for more.

## ChatGPT prompts for the missing sets

Attach `interior-atlas`'s `interior-contact.png` (or two of the founder's sheets: `interior-library.webp`, `interior-seating.webp`) to every request and say "same palette,
outline weight and cel shading as these". **Paste the STYLE block under every prompt.** The block fixes the three things that made the first six sheets inconsistent:
the pixel size (the sheets vary from 4.4 to 7.0 source px), the person scale (a chair was drawn twice too big) and the camera (tables from above, everything else
straight on).

### STYLE block (paste under every prompt)

> **Canvas 1536 x 1024, flat magenta #FF00FF background, nothing on it but the props, no shadows, no text, no people, no animals.** Props in 2 rows of 4 (or the grid
> the prompt says), each fully separated by at least 60 pixels of magenta, none touching the edge.
>
> **Pixel size: every art pixel is exactly a 5 x 5 block of canvas pixels, on a perfect grid, on EVERY prop.** Hard edges, no anti-aliasing, no blur, no gradients,
> no dithering, flat 3 to 4 tone shading per material, a **1 art pixel dark brown outline (#3a1d12)** on every prop, warm palette of ochre wood, sage green, cream,
> terracotta and brick red, light from above.
>
> **SCALE: a character is 120 canvas pixels tall (24 art pixels). Draw every prop to that person.** A door is 125 pixels tall. A chair: seat 60 pixels above the floor, whole
> chair 105 pixels tall, 65 wide. A bar stool seat 90 pixels. A counter or table top (its front edge) is 80 pixels above the floor. A sofa seat 70 pixels, sofa 270
> wide. A tall bookcase 235 tall, 120 wide. A fridge 190 tall. A mug is 25 pixels tall, a plate 45 wide, a laptop 60 wide, a book 30 x 40. If a prop would not fit at
> this size without losing its detail, simplify the detail; never enlarge the prop.
>
> **CAMERA: one camera for everything. Looking straight at the front of the prop from a very slightly raised eye (about 20 degrees above): the front face is drawn
> flat and square-on and the top surface (of a table, counter, seat, shelf) shows as a shallow strip no deeper than one third of the prop's front height. No
> isometric, no 3/4, no diagonal edges, no perspective convergence, even for tables and round things (a round table is an oval strip on top of a straight pedestal).**
> Each prop stands on an invisible floor line: its feet or base are on the lowest row of the sprite, level with the others in its row.

### 1. Tables and counters, empty and set (2 sheets)

> Two sheets in the style above. **Sheet A: eight EMPTY wooden tables**: a small square table (seats 2), a round cafe table on a pedestal, a rectangular table (seats 4)
> seen from its long side, a long communal table (seats 6), a low coffee table, a kneehole desk with 3 drawers each side, a small side table with one drawer, a
> console table with a shelf. Sizes in canvas pixels: top front edge 80 pixels above the floor on all except the coffee table (40) and the side table (75); widths 150,
> 130, 220, 400, 180, 200, 110 and 190. **Sheet B: the same eight, SET**: square with two plates, two mugs and a small vase of flowers; round with a cake stand and one
> mug; rectangular with a bread basket, a teapot and four cups; long with four open laptops, open books and a lamp; coffee table with a stack of magazines and a
> candle; kneehole desk with a laptop, a desk lamp and a pen pot; side table with a table lamp; console with a plant and a clock. Every item on a table is part of
> that sprite; each table is its own sprite.
> (Paste the STYLE block here.)

### 2. Floor and wall swatches (tiles that repeat)

> A sheet of **seamless tiles**, each 160 x 160 canvas pixels (32 x 32 art pixels), 8 columns x 5 rows on a 192 pixel pitch (32 pixel magenta gutter between tiles). **Every
> tile must repeat perfectly with copies of itself left, right, up and down: no border, no grid line, no vignette, no lighter or darker edge, nothing cut at the sides.** Row 1
> floors: wood planks (3 tones: honey, walnut, pale oak), herringbone parquet, black and cream checker, stone flags, terracotta tiles, green carpet. Row 2 floors again: 2
> more wood tones, blue and cream tiles, cobbles, doormat weave, rug fringe edge, slate, plain boards with worn path. Row 3 walls: cream plaster, plaster with a faint
> stripe, pale green wallpaper with a small leaf, red brick, white kitchen tile with grey grout, dark wood panelling, blue plaster, whitewashed stone. Row 4 horizontal strips
> that repeat left and right (160 wide, 32 pixel tall): skirting board, chair rail, crown moulding, picture rail, a stone floor border, a tiled kitchen splashback top
> edge, a wainscot top, a plain beam. Row 5 corners: wall inside corner, outside corner column, doorway side post, window sill, 4 floor to wall transition strips.
> (Paste the STYLE block here, but ignore the "no props touching" line: tiles are in a grid.)

### 3. Doors, stairs and openings

> Eight props: a cottage front door in wood with a small round window and a step (125 pixels tall, 70 wide); an interior door closed; the same door open (seen
> from the front, swung inward, showing the dark room behind); a pair of tall arched library double doors (150 wide, 190 tall); a cafe glass door with a bell and
> an OPEN sign (85 wide, 125 tall); a straight staircase up to the right with a handrail, 8 steps (190 wide, 190 tall, drawn as a front elevation: you see the side
> of the stairs); a staircase with a landing; a gallery balustrade segment (160 wide, 60 tall, repeatable). Second sheet: eight archways and window frames: a plain
> arch opening between rooms (110 wide, 150 tall), a square doorway with no door, a plain window frame (100 x 100), a bay window (210 x 120), a round window, a shop
> front window with a sill and planter, a fanlight above a door, a half door.
> (Paste the STYLE block here.)

### 4. Small things for tables, desks and shelves (one sheet of 24 in 6 x 4)

> A grid of 24 small props, each at the size the STYLE block gives (mug 25 pixels tall, plate 45 wide, laptop 60 wide, book 30 x 40). Cream and terracotta mug,
> green mug, a plate with a croissant, a plate with a slice of cake, a teapot with 2 cups, an open book, a closed book, a stack of 3 books, a laptop open, a laptop
> closed, a notebook with a pencil, a pen pot, a phone, a candle, a small vase with daisies, a bread loaf, a jam jar, a glass of water, a plant in a tiny pot, a small
> lamp, a bowl of fruit, a cupcake, an hourglass, an apple. Each is its own sprite, front view, 1 art pixel outline.
> (Paste the STYLE block here.)

### 5. Seating, pets and plants (the next three sheets, shorter)

> **Seating**: the cafe chair in all 4 views again plus 2 more designs (a bentwood chair, a stool with a back), a bar stool (seat 90 pixels), a bench seen from the front
> (240 wide, seat 60) and from the side, a window seat cushion, an ottoman, a booth seat, a two seat sofa in blue. **Pets**: 8 sprites each 40 to 60 pixels: a cat asleep on
> a cushion, a cat sitting facing front, a cat sitting facing left, a cat on a windowsill, a cat walking left, a small dog asleep, a dog sitting, a bird in a cage on a stand.
> **Plants**: a hanging plant, a cactus, a fern, a herb pot (3 herbs), flowers in a vase, a small tree in a pot (150 tall), a plant on a stand, a window box.
> (Paste the STYLE block under each.)

### 6. Counters, cabinets and shelves, EMPTY (so the items can be placed)

> Eight modular cafe counter pieces, all with their top front edge 80 pixels above the floor: a straight counter section (160 wide), an end cap, a till counter with a
> register, a glass pastry top section, a bar with a shelf of bottles behind (the shelf is part of the sprite, 230 tall), a coffee station with a sink, a pass through counter,
> a bakery work table with a flour board. And a second sheet of eight EMPTY storage pieces: a kitchen cabinet, a sideboard, a wardrobe, a dresser, a wall shelf (empty),
> a wall shelf with books, a wall shelf with jars, a rolling library ladder.
> (Paste the STYLE block under each.)

### 7. Animation frames (code can flicker, but the artist's frames are better)

> A strip of frames for each, drawn on the same prop and aligned pixel for pixel: the brick oven fire (3 frames), the fireplace fire (3), a candle (2), a coffee machine's steam (3),
> a pendulum clock's pendulum at left, centre and right (3), curtains moving (2). Each frame is the WHOLE prop so the engine can swap it.
> (Paste the STYLE block.)

## The camera decision, for the next sheet

Choose one and write it into the STYLE block. Recommended: **front elevation from about 20 degrees above for every prop** (what the library, cafe, kitchen and decor sheets already are). The
tables sheet (3/4 from above) is then the exception to redraw (prompt 1). Why: the engine's characters are front/side/back sprites in the same elevation; a counter, a bookcase and a window
can share a back wall; sort order by the base line works for every prop; and the rug and doormat are the only plan views, which belong under everything.
