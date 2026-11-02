# The town (first district, web)

An open-air autumn town in the lofi.town spirit. This is work package 1: the engine and the FIRST DISTRICT (52 x 30 ground tiles =
1664 x 960 art px, about 4 x 3.6 screens at the library's zoom). Web only. Dev page: `/study/town/dev` (404 in a production build, as
`/study/library/demo` is). `src/components/landing/cafeScene.ts` is untouched; the homepage's deterministic hash
(`perffix/hero-det.js`, 4 viewport modes) is identical to the baselines.

```bash
npm run town:build     # blueprint + art -> public/town/v1/ (refuses to write a map the validator rejects)
npm run town:test      # 24 tests, node:test via tsx, no browser
npm run dev            # then /study/town/dev?bots=4   (?body=fox|capybara|...|person  ?debug=1  ?furniture=0)
python3 tools/town/preview.py out.png 0.8 [--debug]   # a flat picture of the compiled map, for editing the blueprint
```

## What exists

| | |
|---|---|
| `tools/town/blueprint.json` | The hand-authored district: ring centre line, plaza, the cafe, six cottages, props, tree clusters, the edge treeline, furniture types and placements. |
| `tools/town/build.ts` | Compiles it (`compileTown`) and validates it (`validateTown`); writes `public/town/v1/town.<hash>.json` + the atlases under content hashes + `src/lib/town/assets.generated.ts`. `next.config.ts` serves `/town/v1/*` immutable for a year. |
| `tools/town/spot-registry.json` | APPEND-ONLY: every sit spot keeps its numeric id for ever (`<object id>#<index>` -> id). Removing a spot leaves its id retired. |
| `tools/town/people_strip.py` | The premade people the town needs before anyone is built from layers: 9 rows of `people.png` -> a 26 KB strip (the whole file is 229 KB). |
| `tools/art/cottages.py` | The founder's houses (`docs/study/art/source/cottages-a-01.png`) cut like the cafe and trees (see "Houses"). |
| `src/lib/town/` | Pure code, tested: `types`, `rng`, `movement` (every feel constant), `autotile`, `collision` (8 px bitset, alloc-free `slide`), `nav` (A* + string pulling), `chunks` (LRU), `compile`, `validate`, `world`, `blueprint`. |
| `src/lib/studyapp/library/walk.ts` | Made parametric: `Grid.m` carries the cell size, row offset and footprint (`Metrics`); defaults are the library's, so its calls and its 382 tests are unchanged. New: `cellIn`, `centreIn`. |
| `src/components/town/TownEngine.ts`, `TownDev.tsx` | The canvas engine and the dev page. `window.__town` is the engine for the browser checks. |

## Scale and zoom

S2: the town art at 5.0 source px per art px, characters unchanged (24 rows). A ground tile is the 32 px atlas tile, **32 art px** (not 16);
a collision cell is 8 px (4 x 4 a tile), a navigation cell 16 px (2 x 2 collision cells), a baked chunk 16 x 16 tiles = 512 px.
The zoom is the library's own rule (`resize()` in cafeScene.ts) with integer scale only: a view of 400 art px across (240 under 560 css px wide),
`k = round(device width / want)`, so a person is the SAME size on screen as in the library at the same viewport. The view is therefore the same
427 x 267 art px at 1280 x 800 (k = 3); the town art is bigger on screen than the library's because it is drawn finer. Phones: 390 css px at 1x
is k = 2 (195 art px across); at 3x (1170 device px) k = 5 (234 across); 844 x 390 landscape is k = 2 (422 x 195). iPad 1024 x 768 is k = 3 (341 x 256).
The same 6 million device pixel budget as the library lowers k on huge screens. (The plan said the town would be "1.5 to 2x tighter in art px":
that cannot hold if a person is to stay the same size, so the choice was made for the person; the camera view is as wide as the library's.)

## Rendering

Everything is drawn straight to the screen canvas at integer scale `k` with smoothing off; the camera and every sprite are placed at whole
DEVICE pixels (the art pixel is always exactly k x k, only its offset moves by one device pixel), as the movement critic measured the reference
game to do. Ground: chunks baked on demand into pooled canvases (`ChunkCache`, capacity 9, evicted ones are repainted for the next chunk), blitted
scaled. Objects are sorted once by `sortY` (the ground line of the base); walkers sort by their feet y; `items` are pooled and insertion-sorted in place
(nearly sorted already), so a walker is covered by a canopy, a roof or a wall whose base is below him, and covers anything whose base is above him.
Labels (door and sit prompts, bot names, placeholder names, the debug HUD) are on one overlay canvas. Frame loop: 60 Hz, falling back to 30 when the
p95 draw time is over 8 ms (and back under 5), not judged in the first 240 frames.

## Movement (adopted from the movement critic, commit a8b5cd4)

All in `src/lib/town/movement.ts`: walk speed 70 art px/s (the library's, kept for parity; the reference is 2.24 H/s, ours 2.8), instant start, stop and turn,
diagonals normalised, a blocked key still turns the sprite, a per-walker pose clock of 12 Hz restarted at each walk (6 frames, a 500 ms cycle), idle
frame 0 for the first 3 s and the breath after, a camera rigidly LOCKED to the walker while he walks (eased with tau 0.12 s for taps, sitting, standing,
teleports, and while more than 3 art px behind), a soft purple ellipse shadow under everyone standing or walking (12 x 4 art px = 0.475 H wide, 50%),
hard clamp to the map bounds (cells outside are blocked). Click and tap use the same speed. Bots walk at the same speed and pose rate.
Not adopted: head bob in the engine (it is drawn into the frames), the camera lift (0 here: centred, as the reference).

## Data format

`public/town/v1/town.<hash>.json` (`TownData`, `src/lib/town/types.ts`):

* `ground` one number per tile, row major: atlas index (`row * 12 + col` in `town-ground-32.png`) | 128 flipX | 256 flipY | 512 transpose (grass only). `kind`: 0 grass, 1 path fill, 2 plaza fill, 3 edge piece.
* `objects[]` `{id, kind, sprite, x, y, sortY, sx, sy, block, foot, zone?, door?, type?, ph?}`: `x,y` is the anchor (the ground line, the sprite's bottom edge is at `y`); `block` the rect that stops walking; `foot` the base; `sx,sy` the sprite's top left. `door` `{kind: cafe|cottage, rect, entry, trigger}`. Treeline objects (`zone: "treeline"`) are decoration along the edge: they do not block (the bounds do).
* `sprites{}` the used sprites with atlas rects, `anchorX/Y`, `foot`, `block`, `trunk`/`canopy`/`roof` rects, `door`, `step`, `entry`.
* `spots[]` `{id, key, object, at, stand, face, pose, depth, zone}`: `at` the seated body's FEET anchor (the frame's top left is `(at.x - fw/2, at.y - 32)`); `stand` the open navigation cell to walk to first; `face` left|right|front|back; `pose` sit (left/right), read (front), stool (back); `depth` behind|between|front relative to the owning object.
* `ring[]` the ring's centre line as feet points (bot and validator nodes), `plaza[]` standing places, `premade`, `atlases`, `zones`, `spawn`, `placeholders` (art that does not exist yet), `stats`.

The blueprint is tile units (a tile's middle is `i + .5`); an object's `at` is its anchor. The ring is a closed centre line with a half width (1.6 tiles gives 3
fill tiles + one edge tile each side, about 4 tiles of visible dirt); the mask is "tiles whose middle is within the half width", cleaned (`cleanMask` closes
one tile notches and removes spurs) so every tile outside it has an edge piece.

## Ground autotiling

The sheet's edge pieces sit on the grass tiles AROUND a fill region (`autotile.ts` header): one 4-neighbour in the fill -> `edge_X`; two adjacent -> `inner_<opposite corner>`;
a lone diagonal -> `outer_C`. No T junction or end cap exists in the sheet, so there are none: the ring is a loop, and the plaza REPLACES a stretch of the ring
(the path butts the plaza's straight edge). Where a dirt edge tile meets a plaza fill, the piece is taken from the plaza set; the brick phase mismatch the art README
measured (8 to 16 dE) is visible as a slight step only at the plaza's four outer corners. Grass: `grass_a` mostly, flowers in drifts where value noise is high, leaves
near trees, each tile flipped or transposed by a hash, so it does not read as tiled. **The plaza uses ONE fill tile (`plaza_01`).** Mixing the 12 repaired plaza tiles
made visible 96 px stripes (neighbours of different tiles do not continue each other); one tile gives a clean mirrored herringbone with a 32 px repeat. It reads as a
paved square, not as a diagonal herringbone (the art README's caveat); `plazaFill: "mixed"` is still in the blueprint if the art is redone.

## Houses (the founder's cottages, 1 November)

Ingested like the trees and cafe: `tools/art/cottages.py` -> `docs/study/art/town/town-cottages{,-door}.png/.json` + contact sheets. Native pixel of the sheet measured by
colour run lengths (4, 5, 6 src px commonest, long runs 10 and 20 = multiples of 5): **about 5.0**, so the S2 cut IS the native cut (no separate `-native` file).

| Cut | Cottage | Door panel | Persons (25 rows) |
|---|---|---|---|
| 5.0 | 143 x 143 art px | 19 x 29 | 5.7 wide, 5.7 tall; door 1.16 persons |
| **5.8 (`-door`, used)** | **123 x 123** | **16 x 25** | **4.9 wide, 4.9 tall; door 1.0 person, as the cafe's** |

Against the cafe (283 x 144, 11.3 persons wide): a cottage is 43% of its width and 85% of its height; they read as a cafe plus houses, not as the cafe's equals; the 5.8 cut
is a little under the asked "5 to 6 persons wide" (4.9) because the door rule won. `COTTAGE_SET` in `tools/town/build.ts` picks the cut: `"-door"` (used) or `""` for 5.0. Anchor = the bottom
centre of the front wall (the lowest row of the corner posts), the stone step is below it in the sprite; `footprint` = the walls' width by 12 rows (not the overhang);
`blockRect` = the walls' width, 78 rows up from the base (walkers pass behind the house above that line, hidden by the roof, and never enter it); `roofRect`, `doorRect`, `step`,
`entry`, `doorTrigger`. Not flipped: the light is from the top left and the chimney is on the right, a flip would put both wrong. Derived variants (`derived: true`):
`cottage_terracotta_moss` (roof hue +80, saturation x0.62, value x0.78: a believable moss green) and `cottage_slate_plum` (+70: a dusty purple); both look good. Wall re-tints (mustard,
sage) were tried and DROPPED: the cream has six shades and a hue-based tint leaves blotches. Six houses: three north of the top path (outside the ring) and three inside the ring north of the
bottom path, each with a 76 px (2.4 tile) front yard and 119 px (3.7 tiles) between them. Doors only face south (the art is front on only), so houses can only sit north of an east-west path stretch.
The door is scenery: stepping into the trigger shows "Knock knock." (and a "E Knock" prompt).

## Sit spots (placeholders until the art arrives)

28 furniture objects, **50 spots, 3.6 a screen** (14 screens): benches every 9 tiles along the ring (alternating sides, facing the path) and one beside each of the 10 lamp posts, 4 around the plaza,
4 groves with a bench, 3 picnic tables (plaza, park, quiet corner: 4 seats each), a 6 seat study desk and 2 cafe tables (4 stools each) on the terrace. By facing: 21 front, 19 back, 6 right, 4 left.
Furniture types live in the blueprint (`furnitureTypes`: placeholder box `w x h`, `cut` row = where the front half begins, `base` = the blocking base, `spots` relative to the anchor, `sprite: null`).
**Replacing a placeholder with art = set that type's `sprite` to a sprite name (and add the sprite to the atlases) and set `cut`**; the seated walker is drawn between the object's back half (z - 0.02) and front half
(z + 0.02) for `depth: between`, before both for `behind`, after both for `front`. Placeholders draw by default on the dev page (`?furniture=0` hides them) and are labelled in `?debug=1`.
`E` sits in the nearest spot within 30 px (stand point or seat), `E` or any movement key stands (back at the stand point); a tap on a ring (spots within 6 tiles, in view) walks there and sits.

**Animals and front/back seats.** Animals have right and left sit frames; for front and back the engine uses the strip's front sit (`read`, frames 66 to 71) and the lowered back view (`stool`, 72 to 77), both of which
exist in every animal's 78 frames. Checked for the fox at all four facings (screenshots: `fox-sit-all.png`). They are the walk art moved, not drawn (library.md "Limits"): 40 of the 50 spots are front or back,
so **an animal sits at its weakest on 80% of the town's seats**. Dragon, badger, triceratops and capybara need the seated sheets (`chatgpt-animal-sit-prompts.md`) before those spots look right.

## Validator (what `town:build` and the tests assert on the real map)

Spawn free; every door's entry reachable and something can stand in its trigger (7 doors); no sealed pockets (0 of 4945 open navigation cells); the ring is one connected piece (282 tiles), every consecutive pair of ring nodes
is joined over ring tiles only, all 15 legs, so it is walkable end to end; no footprint on the ring (0); trees and bushes leave at least 24 px between footprints (2 nav cells less the cell rounding); cottages 2 tiles from the path and 3 tiles apart;
every sit spot has a stand point that fits, is reachable and within 64 px of the seat, and its seat is not on another object's footprint; ids and keys unique; ids in the registry.
The validator can fail (a test seals the cafe door in and expects failures).

## Measured (headless Chromium 1280 x 800, dev server, 4 bots, walking the ring by keys; software rendering, so these are CPU-side draw times, not GPU)

| | 1x CPU | 4x CPU slowdown | 6x |
|---|---|---|---|
| frames a second | 60 | 60 | 55 |
| draw ms p50 / p95 / max | 0.2 / 0.3 / 1.9 | 0.8 / 3.2 / 4.2 (390 x 844: 0.6 / 1.5 / 4.1) | 1.2 / 2.5 / 7.7 |

Idle with the HUD on: 60 fps, p95 0.5 ms. Heap after a forced GC: 25.69 MB at start, 26.14 MB after 60 s of walking (+0.45 MB; the town's chunk canvases are 3 of the district's 8 and are not JS heap).
Allocation in `frame()`: no arrays, objects or closures are made (items pooled, insertion sort in place, `slide` writes into a Float64Array, label widths cached, pills drawn with rects); heap sampling
(`HeapProfiler.startSampling`, 256 B interval, collected objects included) still shows about 2.6 KB per frame attributed to `draw`, `followPath`, `drawLabels` in the DEV build: those are boxed doubles
(HeapNumbers), not objects (it was 7 KB a frame before `Math.hypot` was removed from the hot paths). A production build would be the proper test; the page cannot be built for production (it is 404 there by design).
Bytes: the town's own files are 120 KB over the wire (json 14.6 KB gzipped of 89 KB, ground 29, nature 10, cafe 11, cottages 13, props 17, premade people 26); the human layers (0.6 MB) load only after the first frame and only for `?body=person`.
Fast 3G (1.6 Mbit/s, 562 ms latency, cache off): the town's files arrive in 1.9 s (json first: 0.66 s). Before the 9 row strip replaced `people.png` it was 5.1 s and 337 KB. JS is the dev bundle (not meaningful); a first
walkable frame needs json, then atlases, in two round trips.
Time to first frame in dev from navigation: about 6 s (dev compile); not a product number.

## Known issues, honest

* The ring is wide and flat (about 4 tiles of one brown) and reads a little like a racetrack; the soft curves are one tile steps that look jagged in places on the left and bottom. A narrower ring (half width 1.1) or two materials would help.
* The houses are two silhouettes in four colours: a row of them reads as a village built from one catalogue, not as a lived-in street. More art is the fix (other roof shapes, a barn, a shop).
* The interior is sparse, and the only furniture is boxes until the art comes. There are no fences or gardens (no art).
* Trees overlap benches and each other's canopies at the edges; a canopy can hide a seated walker on a back facing bench (the sort is correct, the placement is not curated).
* No see-through for a walker hidden behind a roof or canopy: he disappears (the cafe and cottages hide him completely when he is behind them; a head peeks over the cafe ridge). A ghost outline would be cheap.
* Plaza: a single mirrored herringbone tile (see above); the plaza edge pieces do not continue the bricks (art README).
* Bots only walk; they do not sit. Seated state is not sent anywhere (no multiplayer yet).
* `performance.memory` and draw ms are measured in headless software rendering. Not run on a device. Not run in Safari/WebKit (iPad). The 60 Hz target is unproven on an iPad.

## Art still missing

Park benches (4 directions), long bench, tree-ring bench, picnic tables (long side, end on), round cafe table with stools, long study desk, umbrella desks, school-desk bench (all placeholders now);
path T junction and path end cap; path-meets-plaza piece; fences and gardens for the houses (the props atlas has fence pieces at the fine scale but they were not used: the brief said only if the art exists in the town's scale; they exist, so this is a choice to revisit);
more house shapes; a bin and a lamp beside every table (the props exist, they are not placed in the picnic clusters); a proper herringbone plaza; seated animal sheets (four animals).

## What the next work packages need

* **Sit spots with art**: swap `furnitureTypes[...].sprite` and `cut`; keep `spots` offsets (they are relative to the anchor); re-run `town:build`. Spot ids are stable.
* **Multiplayer interest management**: spot `id`s are the wire names for seats (the registry); positions should be sent on the ring, plaza and groves in cells (the chunk grid is a natural unit, 512 px); the engine already treats every walker as `Person` with a path, feet and facing.
* **Minimap**: `data.kind` (ground classes) and `objects` are enough to draw it; the whole map is 1664 x 960.
* **Library door transition**: add a door of `kind: "library"` to a building's `door` and an `onEvent` handler; the cafe's `enter` event already fires on `E`.
* **Interiors**: the `enter` event is the hook; the cafe's `door.entry` is the spawn point on the way out.
* **Growing the map**: `cols`/`rows` and the blueprint are parametric; the chunk cache holds 9 of `ceil(cols/16) * ceil(rows/16)` (8 here); raise `capacity` or leave it, eviction is tested.
* **The movement target**: the critic's `tools/movement/target.json` is adopted by editing `movement.ts` only.
