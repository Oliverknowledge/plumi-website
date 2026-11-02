# The town (the world, web)

An open-air autumn town in the lofi.town spirit: **136 x 72 ground tiles = 4352 x 2304 art px, about 10 x 8.7 screens** at the library's zoom, narrow tan paths
winding between a grand library, a cafe, a bakery, a bookshop, 18 cottages in five neighbourhoods, three groves, five viewpoints and a forest at the edge.
Web only, dev page only: `/study/town/dev` (404 in a production build, as `/study/library/demo` is, unless the build had `NEXT_PUBLIC_TOWN_DEV=1`, see
"Measured"). `src/components/landing/cafeScene.ts` keeps the homepage's deterministic hash (`scratchpad/mv/hero-det2.js`, 4 viewport modes): identical to base.

This replaces the first district (a rectangular path ring with houses beside it; the founder: "I don't like that"). Its engine, movement, sit-spot model and
art are kept; its blueprint, ring and edge-piece autotiler are gone.

```bash
npm run town:build     # tools/town/world.json + art -> public/town/v1/ (refuses to write a map the validator rejects)
npm run town:test      # 34 tests (the place machine included), node:test via tsx, no browser
npm run dev            # then /study/town/dev?bots=4   (?body=fox|capybara|...|person  ?debug=1  ?furniture=0  ?map=0  ?hz=30|60|auto)
python3 tools/town/preview.py out.png 0.3     # a flat picture of the compiled map (material, building boxes, trees, spots) for editing the blueprint
python3 tools/art/landmarks.py                # the grand library, bookshop and bakery cut from docs/study/art/source/*.webp
NEXT_PUBLIC_TOWN_DEV=1 npm run build && npm start     # a production build that serves the dev page (measurement only; never set in a deploy)
```

## What exists

| | |
|---|---|
| `tools/town/world.json` | The authored world: `seed`, size, bounds, landmarks (position, door, plaza), placeholder boxes, neighbourhood streets, groves, viewpoints, free junctions, loop count, bench and lamp spacing, plaza furniture, hubs, wood patches, furniture types. |
| `src/lib/town/plan.ts` | The path planner (A*, cutting, spline, meander, material grid, run-length coding). |
| `src/lib/town/worldgen.ts` | `compileWorld`: the generator. Deterministic from `seed`. |
| `src/lib/town/ground.ts` | The per-pixel ground painter (ragged edges), shared by the engine, the overview and the tests. |
| `src/lib/town/validate.ts` | The validator `town:build` and the tests assert. |
| `src/lib/town/objects.ts` | Trees, bushes and logs live in the JSON as numbers (`scatter`); `allObjects(d)` expands them. |
| `src/lib/town/place.ts` | `Place = town \| interior(id)`, the state machine for doors. |
| `src/lib/town/{types,rng,movement,collision,nav,chunks,world}.ts` | As before (see below), `nav.ts` now has a typed-array A*. |
| `src/components/town/{TownEngine.ts,TownDev.tsx,TownInterior.tsx,Minimap.tsx,town.css}` | The canvas engine, the dev page, the room behind a door (lazy chunk), the map and hubs. |
| `tools/art/landmarks.py` | The three landmark buildings: `docs/study/art/town/town-landmarks.{png,json}`, `landmarks-contact.png`. |
| `tools/town/spot-registry.json` | APPEND-ONLY: every sit spot keeps its numeric id for ever. The district's 50 ids are retired (their furniture is gone); the world's are appended (ids 51 on). |

## The landmark art (founder's pictures, 2 November)

Native pixel (colour run lengths, lossy webp so noisy): library about 5 source px, bookshop and bakery about 4. They are not at one pixel size and the S2 cut
(5.0) would make all three 260 to 270 art px wide, as wide as the cafe, so each has its own `scale` (source px per art px), chosen so the door is about one
person (25 rows) and the library is the landmark:

| | cut | size (art px) | persons wide x tall | door | note |
|---|---|---|---|---|---|
| Grand Library | 4.2 | 311 x 234 | 12.4 x 9.4 | 26 x 30 (arched, 1.2 persons) | the largest; solid from 40 rows below its top |
| Cafe (existing) | 5.0 | 283 x 144 | 11.3 x 5.8 | 21 x 25 (1.0) | |
| Bookshop | 5.8 | 231 x 162 | 9.2 x 6.5 | 19 x 27 (1.1) | double door at the right, sign on the right |
| Bakery | 6.6 | 200 x 149 | 8.0 x 6.0 | 16 x 27 (1.1) | the drawn door is tall for the shop; a one person door would make it 169 wide |
| Cottage (existing) | 5.8 | 123 x 123 | 4.9 x 4.9 | 16 x 25 (1.0) | |

Order of size: library, cafe, bookshop, bakery, cottage: the relative sizes read right on the overview. Per sprite: `anchor` = bottom centre of the front wall at ground
level (the steps and planters are below it, inside the sprite), `footprint` = the wall base (12 rows), `blockRect` = solid from 40 rows under the sprite's top to
the base (nothing can stand behind a landmark and be lost), `roofRect`, `doorRect`, `step`, `entry` (the ground point under the sprite in the door's column),
`doorTrigger`. The library's door leads into the Grand Library room, the cafe's into the cafe room; bakery, bookshop and cottages say "Closed for now".

## Scale and zoom (unchanged, S2)

Town art at 5.0 source px per art px, characters 24 rows (a person is 25), ground tile 32 art px, collision cell 8, navigation cell 16, chunk 16 x 16 tiles = 512 px.
Integer scale `k = round(device width / want)`, `want` 400 art px (240 under 560 css px): 427 x 267 art px at 1280 x 800 (k = 3).

## The generator (`worldgen.ts`, `plan.ts`)

1. **Landmarks and placeholders** are placed at the blueprint's tile positions; each landmark gets a paved plaza in front of its door (its top edge at the sprite's bottom,
   centred on the door, rounded corners). Buildings and placeholder boxes are obstacles.
2. **Neighbourhoods.** Each has a `street` (control points, west to east) that the planner makes meander, and a list of houses. Houses stand NORTH of the street
   (the art's doors face south), `gap` tiles apart, 2.1 tiles back from the street's edge, each with a spur (a 1.6 tile path) from its door to the street.
   Only a house north of an east-west stretch can have its door on a path, so a street should run roughly east-west.
3. **The network.** Nodes: plaza centres, street ends, groves, placeholder fronts, free junctions (`hubs`). A minimum spanning tree (Kruskal, edge weight = distance with a seeded
   wobble, streets pre-joined), then `loops` more edges: the pairs whose network distance is longest relative to the crow flies (ratio over 1.4). Each edge is routed by
   **A\* on the 1 tile grid** (8 neighbours; cost 1 + 1.6 x a seeded smooth noise, so it wanders; 0.45 on existing path, so it merges; obstacles dilated by 2.2 tiles, the
   map edge by 6). A route that runs along the existing network is **cut**: only the off-network stretches become edges, each starting and ending on the network (a clean T).
   The stretch is decimated, run through Catmull-Rom, then a **sine meander** across the line (amplitude 0.8 to 1.8 tiles, wavelength 12 to 20, tapered 4 tiles at each
   end, switched off where it would reach an obstacle): gentle S-curves, no long straight run. Then **dead-end footpaths** to the viewpoints (a bench with a view).
4. **Material.** Every sample stamps a disc (half width 1.1 to 1.6 tiles, varying slowly: 2.2 to 3.2 tiles wide) into an 8 px grid (0 grass, 1 path, 2 plaza), plazas last.
5. **Furniture.** Plaza sets from the blueprint; plaza edges (benches facing in, a lamp at each corner, a bin); along every path a bench every 8.5 tiles on alternating sides
   facing the path, and every 15 tiles on trunks and streets a lamp with a bench beside it; a bench, a planter and a lamp at every cottage; two benches at each viewpoint.
6. **Trees.** Path-side trees first (sparse, golden, 1.6 to 4 tiles back), then the forest: a density that is full at the map border (13 tiles), clumps inland from a
   seeded noise, and nine `woodPatches` that close the meadows between paths. Bushes behind houses, logs and bushes 36 to 150 px from the paths. A decoration treeline
   outside the walkable bounds (it does not block; the bounds do). Blocking trees keep 24 px between footprints, 74 px from a building's foot, off doors, paths and plazas.
7. **Healing.** Sealed pockets of walkable cells are removed by deleting the tree that closes them (0 needed in the committed map).
8. **Output.** Hubs (Library, Cafe, Bakery, Bookshop, Plaza, Park: a walk-to point and a ring of five teleport points), bot routes (nodes every 6 tiles along every path),
   the material grid run-length coded, sit spots with registry ids.

`seed` (20260925) and the blueprint are committed, and so is the generated output (`public/town/v1/town.<hash>.json`); a test rebuilds from the seed and compares bytes
(another seed gives other paths). To change the town: edit `tools/town/world.json`, `npm run town:build`, `python3 tools/town/preview.py`, look.

## Ground rendering (`ground.ts`)

The authored edge pieces only fit straight runs (no T, no end cap, no curve), so paths are cut in code. Per pixel: the material grid's coverage blurred 3 x 3, sampled
bilinearly, plus a seeded noise (a hash at 1 px and a value noise at 5 px), thresholded at 0.5: **soft tufty edges that wander about 5 px each side of the 8 px cell
outline**. Fill: grass from the atlas's grass tiles (flowers in drifts where a value noise is high, leaves within 3 tiles of a tree, a flip or transpose by hash), path from the atlas's
dirt tiles **lifted 55% toward the reference's pale tan** (238, 214, 150), plaza from the one clean herringbone tile (`plaza_01`) lifted 50% toward (244, 228, 184), straight cut. A rim:
the path's outermost pixel in the dirt's own darker tone, grass tufts (a dark green) on the grass side of the edge and the odd one two pixels out. Blocks of 8 x 8 px
whose neighbourhood is all grass or all one solid material skip the per pixel test. A chunk takes about 30 ms to paint (node), so the engine paints the chunks the camera is about to need
**one 64 row slab a frame** (about 3 ms; the cache holds 12), and only an unpainted chunk in view is painted at once (after a teleport, behind the fade). Chunks are still
blitted scaled, no per frame cost.

## Navigation and A*

The whole map is 272 x 144 navigation cells (39k). `nav.ts` has its own typed-array A* (octile heuristic, buffers reused, a diagonal needs both orthogonals open) and string-pulls the
result over the 8 px cells as before. A walk across the map expands about 1.1k to 1.3k nodes (a unit test counts them; random bot-node pairs: at most a few thousand); warm it
takes 0.3 to 0.5 ms and the whole `plan` (A* + pulling) 3 to 5 ms; no hierarchical step is needed. A walk is up to 400 points (`PATH_CAP`). **Walking time** library plaza to the bakery's: 28 s straight
across the meadows and woods (1960 px), **47 s following the paths** (3270 px): the founder asked for 60 to 90; with grass walkable the shortcut is real. Making it longer means
denser woods between districts (`woodPatches`) or a farther bakery; a click-walk takes the straight way.

## Doors and interiors (`place.ts`, `TownDev.tsx`, `TownInterior.tsx`)

`Place = { kind: "town" } | { kind: "interior", id: "library" | "cafe" }`; `placeKey(place)` is `"town"` or `"in:library"` / `"in:cafe"`, the string `lobby_set_position` can carry when the
town is multiplayer (the same ids the library's room list uses; `parsePlaceKey` reads it back). The machine: a door event (E at the door, or a tap on it: the engine walks to the
entry and opens it on arrival) while idle in the town goes `fadeOut` (0.35 s, the library's entry fade; none under reduced motion); on `fade-done` the place becomes the interior and
`fadeIn` runs; exit (Escape, the Town button, "Leave the library") fades back and **the town engine is built again at the door's entry point**, same body (`?body=`). Doors with no interior
answer with the toast "Closed for now" and no transition. A door or exit during a fade is ignored. **The town engine is disposed while you are inside** (its loop, listeners,
chunk canvases and caches go); the interior is the real `LibraryRoom` on the demo fake world (`demoDriver` / `cafeDemoDriver`, as `/study/library/demo` and `/study/cafe/demo`), loaded
as a separate chunk (preloaded when the browser is idle). Escape leaves unless the library's own drawer, menu or Leave question is open (those answer it first). No server work: the fakes.

## Minimap and hubs (`Minimap.tsx`)

A corner panel on desktop (collapsible, remembered in `localStorage`), a Map button and a bottom sheet under 560 css px. The baked layer is the material grid at one pixel per 8 px cell, trees as dots,
landmarks and cottages as little houses (544 x 288). The live layer, 10 Hz, read from the engine: you as a gold arrow facing the way you face, bots as dots, the camera's rectangle,
the place you asked to go to (a ring that fades). Click or tap = walk there (`engine.walkTo`); hover shows the building's or grove's name with "walk here". Six hubs, each a **Walk**
button and a **Teleport** button (a fade of 0.18 s, then you stand on one of the hub's five spawn points in turn; **8 s cooldown** shared by all hubs, shown on the buttons). 44 px targets,
aria labels, the canvas has a name and the hub buttons are the keyboard's way in. Library HUD styles (`.btn`, ink outlines, gold) from `library.css`.

## Movement and the frame loop

Everything in `src/lib/town/movement.ts` as before (70 art px/s, instant start/stop/turn, a 12 Hz pose clock restarted at each walk, camera locked while walking, a soft shadow).
Changes from the independent verifier (`docs/study/art/movement-verify.md`): the pose slot is `floor(stride * 12 + 0.1)` (`poseSlot` in `walk.ts`, used by `cafeScene.ts` and the town:
at 60 Hz 100% of slots are exactly 5 frames clean and still 90%+ through 3 ms of jitter; a test also shows the old clock fails); `?hz=30|60|auto` (or `localStorage plumi-hz`) read once,
`data-hz-why` on the canvas, one `console.info` when it falls, no judging for 3 s after a visibility change or a resize; the library's 60 to 30 switch waits until you walk (the town places
every sprite the same way in both modes, so it cannot pop); the library's full-room layers are drawn with an integer source offset and a clipped destination offset instead of a fractional source
rectangle (WebKit risk), checked **pixel identical in Chromium over 360 random cases (k 2 to 8)**. The shadow sliver behind furniture was **left as is** (the ankle shadow is the shadow's
point and a mask costs a second pass per person). `tools/movement/measure.mjs`: 0 scored failures for the library, the cafe (`--room cafe`), `--dpr 2` and `--me fox`.
You are drawn again, see-through at 42%, on top of whatever covers you (a roof, a wall, a canopy), so you are never lost behind a house or a tree.

## Data format (`public/town/v1/town.<hash>.json`, `TownData` in `types.ts`, version 2)

* `mat {cols, rows, rle}` the material on an 8 px grid, run-length coded `[value, run, ...]`, row major (0 grass, 1 path, 2 plaza); `tiles` the atlas indices the painter uses; `groundCols`.
* `objects[]` `{id, kind, sprite, x, y, sortY, sx, sy, block, foot, zone?, door?, type?, ph?}` for buildings, furniture, props and placeholders. `door {kind: library|cafe|bakery|bookshop|cottage, rect, entry, trigger, label}`.
  `scatter {names, v}`: trees, bushes and logs as `[name, x, y, treelineFlag]` numbers (`allObjects` expands them; the flag marks the decoration treeline, which does not block).
* `sprites{}` the used sprites with atlas rects, anchors, `foot`, `block`, `roof`, `door`, `step`, `entry`, `trigger`; atlases `ground|nature|cafe|cottage|landmark|props`.
* `spots[]` `{id, key, object, at, stand, face, pose, depth, zone}` as before; `paths[]` the centre lines (px) with kind (trunk, street, spur, foot) and mean half width (tiles); `plazas[]`; `hubs[]`;
  `botNodes`/`botLinks`; `zones`; `placeholders`; `spawn`; `stats`.

Size: the JSON is 188 KB (gzip 45 KB; 2500 objects: trees are numbers). Atlases over the wire (gzip): ground 29 KB, landmark 44, cottage 13, cafe 11, nature 10, props 17, premade people 24: the town's own files total about 190 KB.

## Validator (`validate.ts`; `town:build` refuses a map it rejects; the tests assert on the real map)

Spawn free; every door's entry reachable from the spawn and standable (22 doors); **the path network (path and plaza cells) is one connected piece**; no sealed pocket of more than 4 open
navigation cells (0); no footprint on a path or plaza cell (trees, bushes, logs, buildings: 0); **every path 2 to 3.5 tiles wide** at every sample that is not within 3.6 tiles of another path,
a plaza or an end (the sampled range in the committed map is 2.0 to 3.5); **no 12 tile stretch within 0.4 tiles of its chord** (the least is 0.57) and no turn over 100 degrees within 3 tiles (the sharpest is 57);
every door has path at its entry; blocking objects keep 24 px apart; cottages 3 tiles apart; every sit spot has a stand point that fits, is reachable and within 64 px of the seat; **at least 120 spots at 1.5 to 2.5 a screen**
(191 spots, 2.17 a screen); ids and keys unique. It can fail (tests seal a door in and cut the network with a ditch).

## Measured

Headless Chromium 1280 x 800, **production build** with `NEXT_PUBLIC_TOWN_DEV=1` (`next build`, then `next start`), 4 bots, software rendering (so CPU side draw times, not GPU). | | measured |
|---|---|
| Draw ms, 60 s of walking across the whole map by minimap clicks (1x CPU) | **p50 0.20, p95 0.40, max 1.1**; 59 to 60 fps; 22 chunks painted (slab by slab). Before the slabs the max was 51.8 ms (a whole chunk in one frame). |
| 4x CPU slowdown | draw p50 1.10, p95 2.10, max 5.9; first frame 1.7 s; the display delivered 30 to 60 fps (30 most of the time): the JS side is far under the 8 ms bar, so the governor stays at 60 and the 30 is the software raster under throttle, as the library's was. |
| JS heap after a forced GC, start / after 60 s of walking | 5.60 / 6.64 MB (+1.0 MB; the chunk canvases and atlases are not JS heap). |
| Time to first walkable frame, 1x | 490 to 900 ms after navigation start (578 in the final run), local server, production build. |
| Fast 3G (CDP: 1.6 Mbit/s down, 562 ms latency, cache off) | **first walkable frame at 6.8 s**; 758 KB over the wire by then in 46 requests, of which the town's own files are about 190 KB gzip (json 45, landmark 44, ground 29, premade 24, props 17, cottage 13, cafe 11, nature 10); the rest is the study app's shell (CSS, fonts, JS chunks). The page is 33 KB; the whole load at 1x is 1.1 MB in 51 requests (it also prefetches the study app's other routes). |
| Click-walk | A* across the map 0.3 to 0.5 ms, expansions 750 to 1350 for hub to hub (worst of 60 random bot-node pairs: under 12k of 39k cells), `plan` including string pulling 3 to 5 ms warm (first call 20 to 25 ms cold). |
| Painting a chunk | 25 to 40 ms (node, warm), 8 slabs of about 4 ms; the cache holds 12. |
| 10 enter and exit cycles (library, cafe alternating, production build) | live DOM nodes 136 constant, **detached nodes 441 constant, event listeners 374 constant**, canvases 4 constant; JS heap after GC creeps about 0.1 MB a cycle (7.9 to 8.7 MB library, 7.2 to 7.9 cafe) with no DOM, listener or canvas growth: small caches in the library room's modules, not the engine (the engine's chunk canvases are the live engine's own, checked in a heap snapshot). An earlier measurement showed 100 detached nodes a cycle: that was Playwright's `waitForSelector` handle, not the page. |
| Tests | `town:test` 34 pass (validator, determinism, planner, ground painter, A*, collision, chunks, movement, pose cadence, and the 6 of the place machine); `library:test` 398 (0 failed); `app:test` 180; `tsc --noEmit` clean; `eslint` on every changed file clean; `next build` with `NEXT_PUBLIC_TOWN_DEV=1` passes (the unflagged build only differs in that the page is a 404). |
| Movement harness | `tools/movement/measure.mjs`: 0 scored failures for the library, `--room cafe`, `--dpr 2`, `--me fox`. Homepage hero hashes (`hero-det2.js`, 4 modes): identical to base, two base runs identical to each other. |


## What is weak (honest)

* **It is a designed place, but a young one.** The paths wind and branch and the landmarks sit at junctions, so the overview reads as lofi.town's winding paths across a big map; the
  weakest part is the **meadows between paths**: big, flat and green with a few trees, where lofi.town has more small incident (fences, flowers, a bench in the grass). Nothing is wrong there; nothing happens.
* **The plazas are big and the herringbone is loud.** The library plaza is 24 x 9 tiles of one mirrored weave tile (lifted toward pale, but still the busiest ground on the map), and its furniture is boxes.
* **Every furniture piece is a labelled box** (placeholders until the founder's art): 140 of them, so a plaza looks like a warehouse. Seats work, art does not exist.
* **Junctions can bulge.** Where two routes meet at a shallow angle the discs merge into a 4 to 5 tile wide blob (the validator exempts junctions); a few look like a field, not a fork.
* **Walking time is 47 s along the paths, not 60 to 90** (28 s straight across), see above.
* **The five neighbourhoods are 18 houses of two silhouettes in four colours**, in straight rows (the art's doors face south). They read as a village from one catalogue.
* **Nothing is tuned for iPad or Safari**: no device run, no WebKit. The slab baking, 60 Hz and the integer source offsets are the guesses made for it.
* The sit spots are 76 front, 67 back, 25 left, 23 right: an animal sits at its weakest on three quarters of them (`chatgpt-animal-sit-prompts.md`).
* Bots only walk (no sitting), and nothing is sent anywhere (no multiplayer).
* Ground per frame is a blit; the baking slabs cost about 3 ms in the frame that does them. The cottage `blockRect` leaves a band north of each house where you walk behind the roof (the see-through copy handles it).

## Art still missing

Benches (4 directions), long bench, tree-ring bench, picnic tables, cafe table with stools, study desk, umbrella desks, school-desk bench, fountain (all placeholders now);
**interior art for the bakery, bookshop and cottages** (`docs/study/art/chatgpt-interior-prompts.md`, which also asks for the next buildings); **more building types**: post office, florist,
market stalls, pavilion, pond and bridge (water tiles with a shore edge), fountain (the map reserves the space and a footpath for each, labelled in `?debug=1`); more house shapes
(a barn, a row of terraces) and fences and gardens (the props atlas has fence pieces at the fine scale); seated animal sheets (four animals). The path-meets-plaza piece the district needed is no longer needed (the painter has no pieces).

## How to add a building, a street, a grove

* **A building**: ingest the picture like `tools/art/landmarks.py` (add a `SPECS` entry: file, scale, door box, step box, wall base and x range), run it, add the sprite name to `kindOfObject` in
  `worldgen.ts` (it is `building` if listed), add a `landmarks` entry (`at` = the anchor in tiles, `door` kind, `plaza` size), `npm run town:build`. A door kind with no interior says "Closed for now";
  to give it one, add it to `interiorFor` in `place.ts` and a room to `TownInterior.tsx`.
* **A placeholder becomes a building**: replace its `placeholders` entry with a `landmarks` entry at the same place (its footpath node is dropped with it; the plaza brings its own).
* **A neighbourhood**: a `neighbourhoods` entry with 3 or more street control points running roughly east-west and the cottage sprites in order; keep houses 3 tiles apart and clear of other landmarks.
* **A grove**: a `groves` entry (centre, clearing size) and a `plazaFurniture` set under its id. **A viewpoint**: a point in `viewpoints`. **A junction** that shapes the network: a point in `hubs`.
* **Swap a placeholder for furniture art**: set that type's `sprite` in `furnitureTypes` (and add the sprite to the atlases) and its `cut`; spot offsets stay; ids are stable.
* **Zones**: `zones` come from the plazas, groves and neighbourhoods; `zone` on a sit spot is the nearest.

## What the next work packages need

* **Multiplayer interest management**: spot `id`s are the wire names for seats (the registry); positions on the paths, plazas and groves in cells (the chunk grid, 512 px, is a natural unit; the map is 9 x 5 chunks);
  `placeKey` is the place field. The engine already treats every walker as `Person` with a path, feet and facing.
* **Interiors**: `onEvent {kind: "enter", door}` is the hook; the page's `send({t: "door", ...})` is the one place a new interior is wired.
* **Growing the map**: `cols`/`rows` and the blueprint are parametric; chunk cache capacity is 12; keep the 6 tile margin for paths.
