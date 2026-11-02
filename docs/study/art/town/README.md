# Town art (ground, trees, cafe) and the world scale comparison

Everything here is made by scripts from the three ChatGPT sheets in `docs/study/art/source/` (`ground-swatches.png`,
`trees-sheet-01.png`, `cafe-01.png`). No model calls. Re-run: `python3 tools/art/ground_tiles.py`, `tools/art/world_objects.py`,
`tools/art/scale_compare.py` (props: `tools/art/props_sheet.py [--fine]`).

## Files

| File | What |
|---|---|
| `town-ground.png` + `town-ground.json` | Ground atlas, 16 x 16 art px tiles, 12 columns x 9 rows (rows 1 to 8 are the sheet's own cells, row 9 the two derived corners per set). Indexed PNG, 35 colours. |
| `town-ground-32.png` | The same tiles at the sheet's native 32 x 32 (one native pixel per art pixel). Better detail, see below. |
| `ground-contact.png`, `ground-contact-32.png` | A 12 x 8 tile patch: grass field, plaza, dirt path, autotiled from the manifest. |
| `ground-seams.png` | One tile per fill kind, 3 x 3, as drawn beside repaired, with the numbers. |
| `town-nature.png` + `.json` (5.0), `-native` (6.1), `-char` (8.1) | 24 objects: `tree_l_*` (6), `tree_m_*` (6), `bush_*` (6), `stump_small`, `stump_big`, `log`, `branch_fallen`, `branch_forked`, `log_hollow`. `nature-contact*.png` shows anchor (red), footprint (blue), canopy (white). |
| `town-cafe.png` + `.json` (5.0), `-native`, `-char` | The cafe (sign kept). `cafe-contact*.png` shows footprint, roofRect, door and entry. |
| `scale-compare.png`, `-detail.png`, `-crisp.png`, `.json`, `.html` | The world scale comparison (below). |
| `town-atlas*.png/json`, `props/` | The earlier props sheet (24 street props), unchanged. |

## Ground

**What was drawn.** The brief asked for 16 x 16 art px per cell at 8 canvas px. The swatches are **32 x 32 native pixels at exactly 4.0
canvas px** (edge energy folds on a period of 4.0, phase 0, both axes), i.e. twice as fine. Each cell also carries a soft 2 px grid line
on its boundary and a darker/lighter outer ring (vignette), so the outer native pixel on every side is wrong.

**Method** (`tools/art/ground_tiles.py` header has the detail). Native pixel = mean of the inner 2 x 2 of each 4 x 4 block; one 35 colour
palette (k-means, close colours merged); seam test = the wrapped line against the busiest inside line, both axes (a line is only 32
pairs, so the mean of the tile is the wrong yardstick); repair: ring replaced by its neighbour pixels where the tile already tiles
(`method: ring`, all 36 grass tiles), otherwise rolled by half and the old border rebuilt as a mirror band joined by a minimum cost cut
(`method: heal`, all 24 plaza and 12 dirt tiles). Only whole palette pixels are copied. The 16 tile is the 2 x 2 vote of the native tile.

**Result.** Fill rows 1 to 6 (72 tiles): as drawn the seam test passes for 41 (all 36 grass, 4 mossy plaza, 1 dirt; but the ring is
visible as faint grid lines until it is replaced); plaza 0/12 pass, dirt 1/12 (blobs and bricks are cut at the border). After repair
**71 of 72 pass** (`dirt_09` fails by a hair); at 16 px 70 of 72. Quality caveats: the repaired plaza is a mirrored herringbone (diamond
and chevron symmetry about a 32 px cross, visible as a repeating weave: it reads as a decorative plaza, not as the clean diagonal
herringbone ChatGPT drew); the 16 px reduction turns grass tufts into single dashes and the plaza into noise, **use the 32 px atlas**
where the world scale allows; dirt is the cleanest.

**Edge pieces (24).** They are drawn in an arbitrary order. `classify()` marks each native pixel grass or other (green dominant, 3 x 3
majority), each side pure grass / pure other / mixed, and names the piece:
`edge_X` = other material on side X (a straight edge); `outer_C` = other material is a minor piece in corner C (convex plaza corner);
`inner_C` = grass is the minor piece in corner C (concave). Per set (plaza, dirt) the sheet drew **10 of the 12 classes**: all four
straight edges (W twice), outer NE, NW, SW, inner NE, NW (twice), SW. **outer_SE and inner_SE were not drawn**; they are the 180 degree
rotation of outer_NW and inner_NW (flat ground, so lighting is not an issue) and are added as `*_edge_d01..d04` with `derived: true`.
Duplicates are listed as `alternates`; an autotiler should pick the alternate that matches its neighbours (the contact does).
Joins: the pure grass sides meet grass fills at 0 to 3 dE (good); the dirt sides meet dirt fills at 2 to 3 dE (good); the **plaza sides
meet plaza fills at 8 to 16 dE** because the edge pieces' bricks are not the fill's herringbone phase: a visible change of brick pattern
at every plaza border (3 of 12 plaza pieces are over the limit: `plaza_edge_03`, `_04`, `_11`). There is **no path end cap, T junction
or path-meets-plaza piece**: the contact patch shows the path butting a plaza edge.

Manifest (`town-ground.json`): `tiles[]` (id as the bible names it: `grass_a_NN`, `grass_flower_NN`, `grass_leaves_NN`, `plaza_NN`,
`plaza_mossy_NN`, `dirt_NN`, `plaza_edge_NN`, `dirt_edge_NN`; `col`,`row` in the atlas in tiles; `usable`; both seam measures; for edge
pieces `shape`, `name`, `sides`, `state`, `joins`), `fillFamilies` (usable ids per kind), `edgeSets.plaza|dirt.<class>` -> `{id,
derived, joinsOK, alternates}`. Grass tiles may also be flipped and rotated freely for variety.

**Loading.** Fetch `town-ground.json` and the PNG, draw tile `(col, row)` with `drawImage(img, col*T, row*T, T, T, x, y, T, T)`,
`T = json.tile` (16) or `json.tile32` (32) with `town-ground-32.png`; prerender the ground once to an offscreen canvas.

## Trees, bushes, logs

Cut like the props (`props_sheet.py`'s `one()`): 24 components, one 28 colour palette, grid phase per sprite, 1 px outline drawn. Indexed
PNG atlas 512 wide, binary alpha. Per object: `x,y,w,h` in the atlas, `anchorX,anchorY` = trunk base centre / last row (sort by the y of
that point), `footprint {x,y,w,h}` (trunk base: a guess, 3 to 4 rows deep, do not use the canopy), `footprintTiles`, `sourceBox`. Trees
also: `trunkRect` (wood pixels connected to the base, found by colour), `canopyRect` (the rest). The split is clean on all 12 trees: the
trunk is 8 to 10 rows visible, the canopy hem overlaps its top by about 5. Characters behind the anchor are hidden by the whole sprite; the
canopyRect is for fading it to see through. Bushes and logs have no canopyRect (the base is the whole object). Footprints of bushes and
logs are their whole width: tighten in the engine if you want them walkable around the ends.

## Cafe

`town-cafe*.json` `building`: `anchor` bottom centre, `door` (the green panel, found by colour: at 5.0 it is 21 x 25 art px), `doorCentreX`,
`entry` (the ground point just under the sprite in the door's column, `entryTileOffset` in tiles of `tile`), `footprint` = the wall base
(12 rows at 5.0, 8 at 8.1, full width: the door stands in it, the entry tile is just below it, so the engine must keep that tile
walkable and make the door tile the library-style trigger), `roofRect` (above the main eaves; the left bay's roof is lower and is not
in the rect). The cafe is drawn nearly front on with the roof seen from above; the door is a flat panel with a step. It has the word
CAFE on its sign (kept; text is part of the art). Not changed: roof, windows, lit glass.

## Scale comparison (the decision)

What ChatGPT drew (source px; `scale-compare.json`): large tree 254 x 237, medium tree 176 x 179, bush 110 x 198, cafe 1416 x 718,
cafe door panel 125 x 105. The sheets' native pixel (edge-energy period, median over 30 to 80 patches): **ground 4.0, trees 6.1 (IQR
6.0 to 6.15), cafe about 6.5 (5.6 to 7.6), props sheet about 6.0, fox sheet 3.75 (3.5 to 4.0)**. So the town sheets are not all "5": the
ground is finer than the trees, and the animal sheets are finer than 8.1: the animals were shrunk about 2x to 24 rows. A person is 25 rows
(bounding box of the idle frame; the fox is 25).

| In art px (persons = 25 rows) | at 5.0 | at 6.1 (native) | at 8.1 |
|---|---|---|---|
| large tree h | 51 (2.0 persons) | 42 (1.7) | 31 (1.25) |
| medium tree h | 35 (1.4) | 29 (1.2) | 22 (0.9) |
| bush h x w | 22 x 40 | 18 x 32 | 14 x 24 |
| cafe w x h | 283 x 144 (11.3 persons wide) | 232 x 118 | 175 x 89 |
| cafe door h | 25 (1.0 person) | 20 (0.8) | 15 (0.6) |

The world bible wanted a large tree of about 100 px (4 foxes) and a cafe 175 x 140: ChatGPT drew trees at about **half** the asked size
(2.0 persons at 5.0) and a cafe that is 175 wide only at 8.1 (where it is just 89 tall, not 140).

`scale-compare.png` (x2; detail x4 in `scale-compare-detail.png`, crispness in `scale-compare-crisp.png`):
* **S1 character scale (8.1)**: one pixel size everywhere, but the door is 15 rows against a 25 row person (people are taller than doors),
  a large tree is 1.25 persons, a medium tree is shorter than a person: the town reads as a toy set, the trees as shrubs. Ground at 16 px
  is mushy (see above). Cheapest in engine terms (same `LIBRARY_TILE`), most wrong in proportion.
* **S2 town native (5.0, characters 1:1)**: proportions read as a real place: door equals one person, large tree two persons, cafe 11 persons
  wide. Pixel sizes agree within 25 percent (ground 4 to 5 src, trees 5 src). Cost: people and animals are small in the picture (24 of
  250 rows), so the engine zoom must be about 1.5 to 2x the library's (the world is 440 art px for this scene alone), and the map of
  about 4 x 3 screens needs about 1600 x 1000 art px.
* **S3 town 5.0, characters x2**: pixels stay perfectly crisp (integer) but each character pixel is 2 x 2 world pixels, twice as coarse as
  everything else; a 50 row person is twice the door and as tall as a large tree; animals loom over the cafe. x1.5 (38 rows) is uneven
  (every second pixel is doubled, see the crisp strip) and x1.62 (40 rows) gets rows of mixed width. Rejected.

Recommendation: see the report; in short S2, and treat the 24 row human avatars as the unit.

`scale-compare.html` shows the three PNGs with pixelated zoom.

## Quality, honestly

Ground: grass good, dirt good, plaza only fair (mirror weave) and its edge pieces do not continue the plaza bricks; 16 px reduction is poor.
Trees and bushes: clean cut, outline redrawn, canopies lose a little of the leaf-clump highlights at 8.1 (muddier) but fine at 5.0 and 6.1.
Cafe: good at 5.0 and 6.1; at 8.1 the sign text becomes a few pixels. The ground tile in the scenes at 5.0 is the native tile shown 1:1, 25
percent larger than ChatGPT drew it relative to the 5.0 objects. No paid model calls were made.
