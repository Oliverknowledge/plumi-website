# The town (the world, web)

An open-air autumn town in the lofi.town spirit: **136 x 72 ground tiles = 4352 x 2304 art px, about 10 x 8.7 screens** at the library's zoom, narrow tan paths
winding between a grand library, a cafe, a bakery, a bookshop, 18 cottages (five streets, a courtyard with a well, one house tucked in a grove), three groves, five viewpoints and a
forest that thins from the edge. Hedge rows and walls of trees divide it into districts that are joined only at gates, so the way from the library to the bakery is a 79 second walk.
Web only, dev page only: `/study/town/dev` (404 in a production build, as `/study/library/demo` is, unless the build had `NEXT_PUBLIC_TOWN_DEV=1`, see
"Measured"). `src/components/landing/cafeScene.ts` keeps the homepage's deterministic hash (`scratchpad/mv/hero-det2.js`, 4 viewport modes): identical to base (not touched in the polish pass either).

This replaces the first district (a rectangular path ring with houses beside it; the founder: "I don't like that"). Its engine, movement, sit-spot model and
art are kept; its blueprint, ring and edge-piece autotiler are gone. **The polish pass** (this file's "Polish pass" section) answered the founder's review of the first full map:
a soft forest edge, a dressed meadow, small plazas, no blobs, staggered houses, a longer walk, ambient life, a faster raster path, a quicker first load.

```bash
npm run town:build     # tools/town/world.json + art -> public/town/v1/ (refuses to write a map the validator rejects)
npm run town:test      # 49 tests (the place machine and the ambient layer included), node:test via tsx, no browser
npm run dev            # then /study/town/dev?bots=4   (?body=fox|capybara|...|person  ?debug=1  ?furniture=0  ?map=0  ?hz=30|60|auto  ?tod=dawn|day|evening|night  ?backing=0.5..1)
python3 tools/town/preview.py out.png 0.3     # a flat picture of the compiled map (material, building boxes, trees, spots) for editing the blueprint
python3 tools/art/landmarks.py                # the grand library, bookshop and bakery cut from docs/study/art/source/*.webp
NEXT_PUBLIC_TOWN_DEV=1 npm run build && npm start     # a production build that serves the dev page (measurement only; never set in a deploy)
```

## What exists

| | |
|---|---|
| `tools/town/world.json` | The authored world: `seed`, size, bounds, landmarks (position, door, plaza shape), placeholder boxes, neighbourhoods (street + houses with their own `x`, `lead`, `lane`, `garden`), courtyards, single houses, belts (hedge rows and walls of trees, with gates), groves, viewpoints, free junctions, loop count, `directness`, `widthCap`, `forest` numbers, bench and lamp spacing, plaza furniture and dress, hand placed dress, hubs, wood patches, furniture types. |
| `src/lib/town/plan.ts` | The path planner (A*, cutting, spline, meander, material grid, run-length coding), belts as obstacles, plazas with an apron, the distance-field width clamp. |
| `src/lib/town/worldgen.ts` | `compileWorld`: the generator. Deterministic from `seed`. |
| `src/lib/town/ground.ts` | The per-pixel ground painter (ragged edges), shared by the engine, the overview and the tests. |
| `src/lib/town/validate.ts` | The validator `town:build` and the tests assert. |
| `src/lib/town/objects.ts` | Trees, bushes, logs, belts and dressing live in the JSON as numbers (`scatter`, flag 0 wood, 1 treeline, 2 belt, 3 dress); `allObjects(d)` expands them. |
| `src/components/town/ambient.ts` | Falling leaves, chimney smoke, the hour's tint and the lamp glow (code drawn). |
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

1. **Landmarks, placeholders, belts.** Landmarks and placeholder boxes are placed at the blueprint's tile positions; each landmark gets a paved plaza in front of its door (its top edge at the sprite's
   bottom, centred on the door). **Belts** (`belts`: a polyline from one end on the map edge or on another belt to the other, with `gates`) are obstacles for the planner, open only 3.4 tiles round each gate.
2. **Plazas** are a rounded rectangle whose paved edge wanders (a seeded noise, up to `rag` tiles, the top band against the building stays straight) with a **worn dirt apron** `apron` tiles wide
   round it. The library's is 14 x 6 (round 2.6), the cafe's 9 x 5, the bakery's and bookshop's 8 x 4 (it was 24 x 9, 18 x 6 and 12 x 5).
3. **Houses.** A neighbourhood is a meandering `street` and houses NORTH of it (the art's doors face south), each with its own `x`, `lead` (the front yard, the spur's length, 0.4 to 3.2 tiles), an optional
   `lane` (the spur bends sideways) and `garden` (a fence along the front with a gap where the spur comes through, hedges at the sides, a mailbox at the gate). The house stands clear of the street's top edge
   along its whole width (the street wanders). **Courtyards** (`courtyards`): two houses flank a lane, one stands behind it, a well beside the middle one's spur; every door faces south onto the lane, and
   the cluster is joined to the network by the lane's node. **Single houses** (`singles`) are placed first and their spur is routed to the nearest path afterwards. Doors face south only, so every house stands north of a path;
   the layout copes by giving each a different spur (a yard on the street, a set back house, a lane, a courtyard, a house up a side path) and by never putting a house south of what it opens onto. Colours never repeat in sequence.
4. **The network.** Nodes: plaza centres, street ends, groves, placeholder fronts, belt gates, courtyards, free junctions (`hubs`). A minimum spanning tree (Kruskal, edge weight = distance with a seeded
   wobble, streets pre-joined; a pair a belt closes is skipped and another pair joins the pieces), then `loops` more edges (the pairs whose network distance is longest relative to the crow flies), then a
   **directness pass**: for the hub pairs (library, cafe, bakery, bookshop, park) that no belt separates, a pair whose path is more than `directness` (1.35) times the crow flies gets a path of its own
   (A* with the existing network dear, so it does not hug the winding one). Each edge is routed by **A\* on the 1 tile grid** (8 neighbours; cost 1 + 1.6 x a seeded smooth noise, 0.45 on existing path;
   obstacles dilated by 2.2 tiles, eased to 1.5 then 1.0 in a tight corner; the map edge by 6). A route along the existing network is **cut** (only the off-network stretches become edges, a clean T; no route
   joins a spur within 2 tiles of its ends, so a trunk never ends under a door). The stretch is decimated, run through Catmull-Rom, then a **sine meander** across the line (amplitude 1.0 to 2.2 tiles,
   wavelength 12 to 20). Then **dead-end footpaths** to the viewpoints.
5. **Material.** Every sample stamps a disc (half width 1.05 to 1.35 tiles: 2.1 to 2.7 wide) into an 8 px grid (0 grass, 1 path, 2 plaza). **Belts are carved** (any path cell on a belt tile but not at a gate goes), then
   **the distance-field clamp** (`clampWidths`, cap 1.65 tiles): the inscribed radius of every path cell is found (exact distance transform); a cell under a disc of radius T (the biggest inscribed disc that covers it, found from the
   local maxima of the distance, the medial axis) is kept only if it is at least T minus the cap deep, so a junction blob is trimmed to a band 3.3 wide round its spine, a neck that joins a thin path to the blob stays, and
   everything thinner than the cap is untouched; specks of fewer than 14 cells go. 14 blobs over 3.2 tiles in the first map, 5 now; the widest anywhere is 3.75 (the validator's cap is 3.8).
6. **Belt visuals and what blocks.** A belt is drawn as bushes every 17 to 31 px (closer along a vertical run, the bushes are wide and shallow) with trees over them (a wall of trees every 30 to 60 px, a hedge row one in 70 to 100),
   its colour family changing every 14 tiles (gold, amber, mixed, a stretch of red), open where a path crosses. **What blocks is a continuous strip of 16 px squares every 8 px under it** (`walls` in the data, 630 of them):
   the drawn bushes are shallow, a vertical row of them would leave gaps a walker slips through. A strip square is left out where a path or a plaza is. A gate with a vertical path gets a stone arch
   (two slim pillars of collision), one with a horizontal path a signpost.
7. **Furniture and incidents.** Plaza sets and edges (benches facing in, lamps at the bottom corners, a bin; the way in at a path's mouth is kept clear, `lanePts`), plaza dress from the blueprint (`plazaDress`: relative to
   the door's entry), benches along every path (one in 6.6 tiles, a bin or a lamp beside 5 in 10), a lamp with a bench every 15 tiles. **Incidents** (all existing sprites): gardens' fences, hedges and mailboxes,
   a mailbox at every cottage, a planter, a lamp, a bench, a log pile or a barrel by each door, wells at the courtyard and the Quiet Grove, the apple cart at the orchard, stone wall runs along level path stretches
   (the art is front on: a wall only runs left to right; vertical runs would need art), hedge rows along others, a low wall along the library's and cafe's plaza, flags at the library, string lights, bike racks,
   barrels, crates, planters by the shop doors, **noticeboards and signposts at the 4 most separated junctions** (routes that end on another path). Props go on the grass, never on dirt; where one does not fit it moves to the nearest free
   spot within a few tiles or is dropped (4 of the plaza's are, counted in `notes.dressMissed`).
8. **Worn ground** (`worn`: x, y, radius, 95 of them): dirt showing through the grass at every cottage door, at most benches and at the noticeboards, wells and the cart.
9. **Trees.** A density that is dense in a belt of 4.5 tiles at the very edge (the walkable edge; the decoration treeline is outside it), falls smoothly to nothing by 12 tiles, with clumps and
   clearings in the gradient (value noise) and inland clumps. A tree is dropped unless its canopy ellipse (twice as wide as tall, scaled by the sizes) is clear of the others (dense 1.06 times their radii apart, down to
   0.86, so canopies touch but are not a carpet) as well as the trunks being 24 px apart; size follows density (large where it is thick, medium and bushes at the fringe). **Colour**: a low frequency noise
   makes groves of one family (gold 40 percent, amber 26, mixed 16, gold again), a high one a few red maple groves, with 10 to 14 percent contrast trees. The decoration treeline outside the bounds is three staggered
   rows 0.9, 2.4 and 3.9 tiles out (it does not block; the bounds do). Blocking trees keep 24 px between footprints, 74 px from a building's foot, off doors, paths and plazas.
10. **Healing** removes the tree that closes a sealed pocket (never a belt: that is a build error; 0 in the committed map).
11. **Output.** Hubs, bot routes, the material grid run-length coded, the walls, the worn discs, sit spots with registry ids.

`seed` (20260925, kept: the layout is better by design than by seed) and the blueprint are committed, and so is the generated output (`public/town/v1/town.<hash>.json`); a test rebuilds from the seed and compares bytes
(another seed gives other paths). To change the town: edit `tools/town/world.json`, `npm run town:build`, `python3 tools/town/preview.py`, look.

## Ground rendering (`ground.ts`)

The authored edge pieces only fit straight runs (no T, no end cap, no curve), so paths are cut in code. Per pixel: the material grid's coverage blurred 3 x 3, sampled
bilinearly, plus a seeded noise (a hash at 1 px and a value noise at 5 px), thresholded at 0.5: **soft tufty edges that wander about 5 px each side of the 8 px cell
outline**. **The paving's edge is ragged too** (a second coverage, the plaza's alone, thresholded with the same noise: paving against dirt apron wanders, it is no longer a straight cut). Fill: grass from the atlas's grass tiles (flowers in drifts where
a value noise is high, leaves within 3 tiles of a tree, a flip or transpose by hash), path from the atlas's dirt tiles **lifted 55% toward the reference's pale tan** (238, 214, 150), plaza from the one clean herringbone tile
(`plaza_01`) **lifted 62% toward (244, 228, 184) in the middle of the paving and 86% at its edge** (a distance transform of the paving fades it toward the dirt), with **a stone coloured border pixel** round it. A rim: the path's outermost pixel in the dirt's own darker tone, grass tufts
(a dark green) on the grass side of the edge and the odd one two pixels out. **Worn ground**: discs from the data (`worn`), each a dithered mix of grass toward a dirt tone (more toward the middle, noise in the edge), per tile lists so a pixel
tests two or three discs at most. Blocks of 8 x 8 px whose neighbourhood is all grass or all one solid material skip the per pixel test. A chunk takes about 30 ms to paint (node), so the engine paints the chunks the camera is about to need
**one 64 row slab a frame** (about 3 ms; the cache holds 12), and only an unpainted chunk in view is painted at once (after a teleport, behind the fade). Chunks are still
blitted scaled, no per frame cost.

## Navigation and A*

The whole map is 272 x 144 navigation cells (39k). `nav.ts` has its own typed-array A* (octile heuristic, buffers reused, a diagonal needs both orthogonals open) and string-pulls the
result over the 8 px cells as before. A direct walk across the map expands about 200 to 1.3k nodes (0.3 to 1 ms); **a walk the belts force the long way round (library plaza to bakery plaza: 17k of the 39k cells, cafe to bakery 22k) takes 18 to 32 ms warm in node**, a one-off hitch at a click (two dropped frames): the next step, if it is felt on a device, is a hierarchical A* over the districts (the gates), not a weight (weighted A* was measured and does not help here: 66k expansions with re-expansion for cafe to bakery). A walk is up to 400 points (`PATH_CAP`). **Walking time** library plaza to the bakery's: **79 s following the paths** (was 47) and 65 s by the shortest way the belts leave (was 28 s straight across the meadows), through the north gate, along Orchard Row, down the far west gate and east
along the second terrace to its gate and back west to the bakery. The brief's "shortcuts at least 1.5 times slower than the path or blocked" cannot hold as a ratio of times (a route over grass is never longer than the paths it may leave, so the
shortcut is never slower than the path); what is measured is the other way round: **the path takes at most 1.39 times the shortest walk for every one of the 15 hub pairs (mean 1.17)**, and for the pairs a belt separates 1.18 to 1.25
(the walk is the path, the belts leave no shortcut); validator rule `ROUTE_RATIO_MAX` 1.5.

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

## Data format (`public/town/v1/town.<hash>.json`, `TownData` in `types.ts`, version 3)

* `mat {cols, rows, rle}` the material on an 8 px grid, run-length coded `[value, run, ...]`, row major (0 grass, 1 path, 2 plaza); `tiles` the atlas indices the painter uses; `groundCols`.
* `objects[]` `{id, kind, sprite, x, y, sortY, sx, sy, block, foot, zone?, door?, type?, ph?}` for buildings, furniture, props and placeholders. `door {kind: library|cafe|bakery|bookshop|cottage, rect, entry, trigger, label}`.
  `scatter {names, v}`: trees, bushes, logs, belt pieces and dressing (lamps, fences, mailboxes, walls...) as `[name, x, y, flag]` numbers (`allObjects` expands them; flag 0 wood, 1 decoration treeline which does not block, 2 belt, 3 dress); sprites with `solids` (the arch, the string lights) block with those rects, not one lump. `walls` flat `[x, y, w, h, ...]` the strip under every belt, `worn` flat `[x, y, r, ...]`.
* `sprites{}` the used sprites with atlas rects, anchors, `foot`, `block`, `roof`, `door`, `step`, `entry`, `trigger`; atlases `ground|nature|cafe|cottage|landmark|props`.
* `spots[]` `{id, key, object, at, stand, face, pose, depth, zone}` as before; `paths[]` the centre lines (px) with kind (trunk, street, spur, foot) and mean half width (tiles); `plazas[]`; `hubs[]`;
  `botNodes`/`botLinks`; `zones`; `placeholders`; `spawn`; `stats`.

Size: the JSON is 164 KB (gzip 43 KB; 1994 objects, 1276 of them trees: trees, bushes and props are numbers; it was 188 KB and 45 KB). Atlases over the wire (gzip): ground 29 KB, landmark 44, cottage 13, cafe 11, nature 10, props 17, premade people 24: the town's own files total about 190 KB.

## Validator (`validate.ts`; `town:build` refuses a map it rejects; the tests assert on the real map)

Spawn free; every door's entry reachable from the spawn and standable (22 doors); **the path network (path and plaza cells) is one connected piece**; no sealed pocket of more than 4 open
navigation cells (0); no footprint on a path (dirt) cell, and none of a tree, bush, log or building on paving (0; an arch straddles its path on purpose); **every path at least 1.9 tiles wide** (the march along the normal, away from other paths
and plazas) **and, new, at most 3.8 tiles wide ANYWHERE, junctions and bends included** (the inscribed diameter from an exact distance transform, everywhere but within 3.2 tiles of a plaza; the committed map's widest is 3.75);
**no 12 tile stretch within 0.25 tiles of its chord** (the least is 0.29; it was 0.4 until the direct paths, which are meant to be direct) and no turn over 100 degrees within 3 tiles (the sharpest is 79);
every door has path at its entry and **a clear apron** (nothing within 12 px either side and 10 to 24 px in front of its entry); blocking objects keep 24 px apart (belt pieces are exempt: they are continuous on purpose; dressing is exempt);
cottages 3 tiles apart (a courtyard's 1.5); every sit spot has a stand point that fits, is reachable and within 64 px of the seat; **at least 120 spots at 1.5 to 2.5 a screen** (139 spots, 1.58 a screen).
**New, the route rules**: for every one of the 15 pairs of the six hubs the shortest walkable route (`Nav`) and the route along the paths only (a second `Nav` with the grass closed, same string pulling) must both exist, **the path may be at most
1.5 times the shortest walk** (the metric `worstRouteRatio`; 1.39 now, it was 1.68 for library to bakery), and **library plaza to bakery plaza must take 60 to 90 s along the paths** (79 s; 70 art px a second). **New, the incident rules**: every prop a person
should walk up to (noticeboard, mailbox, well, cart, signpost, planter, barrel, crates, bike rack, bin: 56 of them) has a standable, reachable cell within 40 px (`access`, 0 without). Ids and keys unique. It can fail:
the tests seal a door in, cut the network with a ditch, take the belts away (the walk is short again and the ratio fails), swell a path into a blob, wall a noticeboard in and put a prop on a path.

## Measured

Headless Chromium 1280 x 800, **production build** with `NEXT_PUBLIC_TOWN_DEV=1` (`next build`, then `next start`), 4 bots, software rendering (so CPU side draw times, not GPU). Scripts: `scratchpad/polish/{perf,heap,net3g,shots}.js`. | | measured |
|---|---|
| Draw ms, walking hub to hub (1x CPU, dpr 1) | **p50 0.20, p95 0.60, max 2.7**; 59.9 fps. Ambient life (22 leaves, 3 puffs: 25 `fillRect`s) costs 3 microseconds a frame (node), no allocation (a test counts the heap over 2000 frames). |
| 4x CPU slowdown, dpr 1 | draw p50 0.8, p95 1.7; 58 fps. |
| **4x CPU slowdown, dpr 2 (a 2560 x 1600 canvas, k 6: raster bound)** | **the first map's engine: 14 to 15 fps** (draw p95 13 ms, two full size layers: the screen canvas and the label canvas cleared and composited every frame, a full screen fill under the ground); **this engine, pinned at 60 Hz: 22 to 30 fps** (labels drawn on the one canvas, the label canvas no longer sized, the full fill skipped, same JS draw time: it was the compositor); **with the governor: it steps the backing scale to 0.75 then 0.56 (k 5, then 4; the canvas is stretched, `pixelated`) and delivers 41 to 45 fps**; pinned at 0.75 by hand, 56 fps (dev build). The night tint (a multiply fill) costs a quarter more at dpr 2 and nothing visible at dpr 1 (58 fps). |
| The governor, honest | JS draw p95 over 8 ms drops 60 to 30 Hz (as before). **New**: frames arriving at under 62 percent of the rate asked for, three seconds running, with the draw p95 under 8 ms, is a raster bound device: the backing scale goes down by a quarter (to half at most), k follows, a `console.info` says so, `data-backing` on the canvas. Not judged for 3 s after a resize, never when `?hz=` pins the rate. It does not come back up by itself (a resize resets it). |
| JS heap after a forced GC | 14.7 MB at the start; 12 library cycles: 18.1 to 19.6, no trend. |
| Time to first walkable frame, 1x | 588 ms after navigation start, local server, production build. |
| Fast 3G (CDP: 1.6 Mbit/s down, 562 ms latency, cache off) | **first walkable frame at 6.2 s (6.8 s)**, 674 to 688 KB over the wire by then in 34 to 35 requests (758 KB in 46), of which the town's own files are 179 KB (the json 43, landmark 45, ground 30, premade 26, props 17, nature 10; the cottage atlas 14 and the cafe's 11 are no longer waited for). What dominates is not the town: the study app's fonts (75 + 40 + 23 KB) and its shell's JS chunks (about 200 KB) are two thirds of the bytes. Done: the atlases are asked for at the same time as the map (their urls are in `assets.generated.ts`, so there is no wait for the json), the cottage and cafe atlases load behind the first frame (a sprite whose image has not arrived is not drawn yet), the minimap is baked when the browser is idle. The json as binary would save about 8 KB gzip of 43: not done. |
| Click-walk | A* for a direct walk 0.3 to 1 ms (177 expansions library to cafe); **library to bakery 17.4k expansions, 18 to 22 ms warm; cafe to bakery 22k, about 32 ms** (the belts force the long way round). A one-off hitch at a click; see Navigation. |
| Painting a chunk | 25 to 40 ms (node, warm), 8 slabs of about 4 ms; the cache holds 12. |
| 12 enter and exit cycles each, library and cafe (production build) | heap after GC: library 18.1 to 19.0 MB (0.08 MB a cycle with noise of 0.5), cafe 17.9 to 18.7 (0.074 a cycle, steady). **Found**: a heap snapshot diff between cycle 2 and cycle 14 shows the growth is V8's own compiled code (0.5 MB, warm-up) and 8 detached SVG icon subtrees a cycle (Blink objects with SMIL animation) that nothing in JS holds (the retainer path ends in Blink's own SVGAnimatedPath), not a cache in the room modules, not the engine (3 engines were alive in one early run: that was Playwright's `waitForFunction` returning `window.__town` as a handle, the same artefact the last round found with `waitForSelector`; the scripts return a boolean now). Left as is. |
| Tests | `town:test` 49 pass (the validator and its new rules and how they fail, determinism, planner, the clamp, plazas, the ground painter with worn ground and the paving's edge, A*, collision, chunks, movement, pose cadence, the place machine, the ambient layer); `library:test` 398 (0 failed); `app:test` 180; `tsc --noEmit` clean; `eslint` on every changed file clean; `next build` with `NEXT_PUBLIC_TOWN_DEV=1` passes. |
| Homepage | `src/components/landing/cafeScene.ts` is not touched by this branch (`git diff` empty), so the hero hashes (`hero-det2.js`) are the base's by construction. |

## Polish pass (the founder's review of the first full map, 2 November)

`docs/study/art/town/world-overview.png` is the map now, `world-overview-before.png` the first one. Per item, measured:

| | before | after |
|---|---|---|
| 1 Forest | 2138 trees (1099 walkable + 1039 decoration), full density 13 tiles deep, salt and pepper colours | **1276 trees (933 + 343): 40 percent fewer**; a 4.5 tile belt at the edge, a gradient to nothing at 12 tiles with clumps and clearings, mixed sizes, canopies touching not overlapping; colour groves (gold, amber, a red maple grove, 10 to 14 percent contrast); hedge/tree belts as districts' borders. 426 bushes (105 before: the belts are bushes). |
| 2 Meadows | 67 props, no fences or walls | 136 props plus 307 belt pieces: 4 fenced gardens, a mailbox at every cottage, planters, barrels, crates, 5 noticeboards and signposts at junctions, 2 wells, the cart, 4 arches, flags, string lights, bike racks, stone wall runs, hedge rows, log piles and stumps, bins and lamps by benches; 95 worn patches. Validator: 56 props with access (0 without), doors keep a clear apron, nothing on a path. |
| 3 Plazas | library 24 x 9 (216 tiles) of loud herringbone; cafe 18 x 6; bookshop and bakery 12 x 5 | **library 14 x 6 (84), cafe 9 x 5, bookshop and bakery 8 x 4**, rounded with a wandering paved edge, a worn dirt apron, a stone border pixel, the herringbone lifted 62 to 86 percent toward pale (it was 50), flags, planters, a lamp cluster at the centre. |
| 4 Junctions | 14 fat cores (inscribed diameter over 3.2 tiles), mean half width 1.14 | **5 fat cores**, mean half width 1.07; the widest anywhere 3.75 (3.75 by the same measure in the first map, whose blobs were measured along the normal at 4 to 5; the validator now asserts 3.8 for every cell but a plaza's connections). |
| 5 Cottages | 4 straight rows, 2 colours of roof in sequence, spurs 1.6 tiles | 5 streets with spacings 6.5 to 10.5 tiles, spurs 0.4 to 3.2 tiles, 3 lane houses, 4 gardens, a courtyard of 3 with a well, a single house in a grove; colours never repeat in sequence. |
| 6 Walking | library plaza to bakery plaza 47 s by path, 28 s straight | **79 s by path, 65 s by the shortest way left**; every hub pair's path at most 1.39 times its shortest walk (mean 1.17); belts close every meadow between districts. |
| 7 Ambient | none | leaves (8 to 30), smoke from 19 chimneys, tint and lamp glow by the student's hour; see `ambient.ts`. |
| 8 Performance | 4x CPU at dpr 2: 14 to 15 fps | 22 to 30 pinned, 41 to 45 with the governor; heap creep found and explained, see above. |
| 9 Load | Fast 3G 6.8 s, 758 KB, 46 requests; json 188 KB | 6.2 s, 674 to 688 KB, 35 requests; json 164 KB. |

## Ambient life (`ambient.ts`)

Code drawn, in the town's palette, allocation free, off under `prefers-reduced-motion` (leaves and smoke; the tint and the glow are not motion and stay). **Leaves**: a pool of 30, 8 to 30 in view (one to 5200 art px squared), 2 x 2 or 3 x 1 art px squares in five autumn colours, falling 13 to 23 px a second with a sway, recycled
at the bottom. **Smoke**: three puffs a chimney (cottages and the bakery, 19), a 3.6 s cycle, stepped (size 3, 4, 5 and opacity 0.95, 0.8, 0.58, 0.34 in whole steps, rising 24 px), only the chimneys in view. **The hour**:
the library's `timeOfDay` of the local clock (dawn 05 to 08, day, evening 17 to 20, night 20 to 05), re-read every 30 s; `?tod=` pins it for checks. A multiply tint (peach, amber, blue; none by day) over the scene, then **lamp glow**
(three concentric steps, additive, 40 lamps, only those in view) on top so the lamps stay bright in the dark; the glow strength is 0.3, 0.65 and 1 at dawn, evening and night.

## What is weak (honest)

* **Compared with lofi.town** (`images/32.png`): the map has its winding lanes, soft groves and a place at every junction, but lofi.town's meadows are denser in small things (every few tiles a fence, a flower bed, a bench in the grass,
  a table under a tree) and its paths are narrower and more broken. Ours are a dressed village now, not a lived in one: the incidents are placed by rules (a mailbox at every gate, a barrel by a shop), which reads as design, not as accident.
* **Vertical fences and walls do not exist** (the art is front on): garden sides are hedges, stone walls only run left to right, so a wall never turns a corner. The belts are hedge rows and walls of trees; they cannot be fences or stone.
  A student cannot tell a gate in a hedge from the rest of it except by the path going through (arches only where the path runs vertically). The collision under a belt is a hidden strip: a gap between two drawn bushes still blocks.
* **The 79 s walk to the bakery has a cost**: it is the long way round three terraces. A hub teleport (8 s cooldown) and the minimap's click-walk are the answer; a student who walks it sees a lot of path and a few houses, and
  the click-walk that far costs 18 to 32 ms once (see Navigation).
* **The shortest walk is still 65 s of the 79**: the belts are the barrier, not a slow ground. The brief's "1.5 times slower" cannot be a time ratio (see Navigation); there is no slow grass.
* **The forest edge** reads as woods softly thinning, but the player can only walk the outer 4.5 tiles in its clearings; the belt there is dense by design. The decoration treeline outside is 343 trees in three rows: it is a hedge of canopy, not a forest.
* **Placeholders everywhere furniture would be**: benches, picnic tables, cafe tables, the post office, florist, market, pavilion and pond are still labelled boxes (the fountain is gone from the plaza: its place is a lamp cluster). Seats work, art does not exist.
* **Houses of two silhouettes in four colours**: the layout is staggered and clustered, the shapes are not (a barn, terraces and a long house are art that does not exist). Doors face south only, so every house stands north of the path it opens onto.
* **Night looks muddy**: a multiply tint over the whole scene dims the ground and the sprites alike; windows do not glow (the sprites are drawn lit already). A tint per layer or lit window sprites would be better.
* **Nothing is tuned for iPad or Safari**: no device run, no WebKit. The slab baking, 60 Hz, the integer source offsets, the backing governor and `multiply` / `lighter` blends are guesses made for it. A real iPad may deliver the full rate at dpr 2 where this software raster does not.
* The sit spots are 43 front, 54 back, 27 left, 15 right (139): an animal sits at its weakest on three quarters of them (`chatgpt-animal-sit-prompts.md`).
* Bots only walk (no sitting), and nothing is sent anywhere (no multiplayer).
* Ground per frame is a blit; the baking slabs cost about 3 ms in the frame that does them. The cottage `blockRect` leaves a band north of each house where you walk behind the roof (the see-through copy handles it).
* Not done: the json as binary (about 8 KB gzip of 43), a hierarchical A*, the 60 to 30 Hz judgement of a throttled raster by its own signal rather than by the draw time.

## Art still missing

Benches (4 directions), long bench, tree-ring bench, picnic tables, cafe table with stools, study desk, umbrella desks, school-desk bench, fountain (all placeholders now);
**interior art for the bakery, bookshop and cottages** (`docs/study/art/chatgpt-interior-prompts.md`, which also asks for the next buildings); **more building types**: post office, florist,
market stalls, pavilion, pond and bridge (water tiles with a shore edge), fountain (the map reserves the space for each, labelled in `?debug=1`); more house shapes (a barn, a row of terraces);
**vertical and corner fence pieces, a stone wall that turns, a hedge with a gap, an open gate** (the props atlas has fences and a wall at the fine scale, front on only); **lit window sprites** for the night; a **chimney smoke** sheet if the
stepped squares are not enough, falling **leaf** sprites; seated animal sheets (four animals).

## How to add a building, a street, a grove

* **A building**: ingest the picture like `tools/art/landmarks.py` (add a `SPECS` entry: file, scale, door box, step box, wall base and x range), run it, add the sprite name to `kindOfObject` in
  `worldgen.ts` (it is `building` if listed), add a `landmarks` entry (`at` = the anchor in tiles, `door` kind, `plaza` size), `npm run town:build`. A door kind with no interior says "Closed for now";
  to give it one, add it to `interiorFor` in `place.ts` and a room to `TownInterior.tsx`.
* **A placeholder becomes a building**: replace its `placeholders` entry with a `landmarks` entry at the same place (its footpath node is dropped with it; the plaza brings its own).
* **A neighbourhood**: a `neighbourhoods` entry with 3 or more street control points running roughly east-west and its houses (`{s, x, lead, lane, garden}`); keep houses 3 tiles apart and clear of other landmarks. **A courtyard** or **a single house**: a `courtyards` or `singles` entry. **A belt**: a polyline from the map edge (or another belt) to the map edge with its `gates` (a point where a path will cross, 7+ tiles from houses and placeholders; keep nodes and hubs out of the belt: it is an obstacle); run `town:build` and read the validator's route lines (every hub pair's path and shortcut in seconds) and `python3 tools/town/preview.py` (belts dark green, dressing blue). **Dressing**: `dress` (hand placed), `plazaDress` (relative to a door's entry or a clearing's middle).
* **A grove**: a `groves` entry (centre, clearing size) and a `plazaFurniture` set under its id. **A viewpoint**: a point in `viewpoints`. **A junction** that shapes the network: a point in `hubs`.
* **Swap a placeholder for furniture art**: set that type's `sprite` in `furnitureTypes` (and add the sprite to the atlases) and its `cut`; spot offsets stay; ids are stable.
* **Zones**: `zones` come from the plazas, groves and neighbourhoods; `zone` on a sit spot is the nearest.

## What the next work packages need

* **Multiplayer interest management**: spot `id`s are the wire names for seats (the registry); positions on the paths, plazas and groves in cells (the chunk grid, 512 px, is a natural unit; the map is 9 x 5 chunks);
  `placeKey` is the place field. The engine already treats every walker as `Person` with a path, feet and facing.
* **Interiors**: `onEvent {kind: "enter", door}` is the hook; the page's `send({t: "door", ...})` is the one place a new interior is wired.
* **Growing the map**: `cols`/`rows` and the blueprint are parametric; chunk cache capacity is 12; keep the 6 tile margin for paths.
