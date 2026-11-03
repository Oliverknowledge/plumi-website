# The cafe interior (a room for the autumn town)

A ChatGPT-drawn top-down cafe-library (coffee bar and bakery, reading nook with two booths, bay-window sunroom, fireplace lounge,
two round tables and a long dining table, double doors) made into a room people walk into and sit down in, exactly as in the Grand
Library: the same engine (`src/components/landing/cafeScene.ts`, library mode), the same walking, seat rings, E to sit, camera that
follows you, lamplight, and the same nine animals. It is **web only and not multiplayer**; it is the interior of a building in the
future town (the town engine does not exist yet). Dev demo: `/study/cafe/demo` (404 in production).

| | |
|---|---|
| `docs/study/art/source/cafe-interior-01.webp` | The founder's picture, 1536 x 1024, untouched. |
| `tools/art/room_from_image.py` | The generic tool: one picture + one config -> the room's four files, with checks. |
| `tools/art/rooms/cafe.json` | The cafe's config (floor, footprints, pieces, lights, door, patches). |
| `tools/art/rooms/cafe.seats.json` | The seat registry (append only). |
| `public/rooms/cafe/{bg,pieces,anims}.png`, `layout.json` | What the tool writes (the same format as `public/library`; 566 KB). The cafe shares the library's `people.png`. |
| `src/lib/studyapp/library/rooms.ts` | `RoomDef`, `LIBRARY_ROOM` (the default), `CAFE_ROOM`, `cafeSeats`. |
| `src/lib/studyapp/library/cafeDemo.ts`, `components/studyapp/library/DemoCafe.tsx`, `app/study/(app)/cafe/demo/page.tsx` | The scripted cafe. |
| `src/lib/studyapp/library/cafe.test.ts` | 13 tests (layout, pockets, seats, ids, routes, the tool's own check). |
| `docs/study/art/cafe/` | The pictures this page talks about. |

## The scale decision (decided before building, by looking)

**The brief guessed the room was too small for the characters. It is the other way round: the picture is drawn too big.** Measured:

- *The picture's own pixel.* Dark outlines (the 1 art pixel strokes) have a half-height width of 2 source px (mode; 3 in the tail) on
  three regions of the room; a staircase edge (the coffee cup) steps by about 3. No grid is consistent (it is AI art, softened), so
  the estimate is **2 to 3 source px per art pixel, about 2.4**: the picture is a roughly 640 x 427 pixel-art room drawn at 2.4x
  and blurred. (The animal sheets and the town props are about 5, `docs/study/library.md`.)
- *The furniture.* A dining chair is 38 source px wide, a round table 80, the long table 245 x 75. The library's chairs are 13 x 21
  art px, a person is 16 wide, 24 tall. A person's body is about as wide as a chair here and a chair is 38 px, so **one art pixel is
  about 2.4 to 2.9 source px**. The two measurements agree.
- *Composites* (`docs/study/art/cafe/scale-test-long-table-1.6-2.4-2.9.png`: a person and a fox from the real strips at the chairs
  of the long table, at 1.6, 2.4 and 2.9 source px per art pixel). At **1.6** (a 960 x 640 room, the library's size) people are
  smaller than the chairs, and a seated person is lost behind a table nearly three of them long. At **2.9** people are wider than a
  chair. At **2.4** a person fills a chair as the library's do, fits a place at the table (30 px between chairs), and a fox's
  24 px frame is chair-sized.

So what was weighed (all by looking):

| Option | Verdict |
|---|---|
| (a) Integer nearest-neighbour **up**scale of the room | Wrong direction: it would make people 1/3 the size of the chairs. |
| Integer nearest-neighbour **down**scale by 2 or 3 | 2 gives 768 x 512, chairs 19 wide (people look small, aliased edges); 3 gives 512 x 341, chairs 13 (people overflow them), aliased. Not chosen. |
| (b) **Smooth downscale by 2.4 (Lanczos) + a light sharpen, kept in full colour** | **Chosen.** 640 x 432 art px (a multiple of the 16 px tile, the picture padded with its own background at the foot). The room's pixels come out the characters' size, so people and room share one pixel. Edges stay crisp (`resample-methods.png`: nearest, box, Lanczos, Lanczos + sharpen, then a 64 and a 48 colour quantise). |
| Palette quantising to 48 to 128 colours | Tried (k-means in Lab): it throws away the minority colours (the blue vase, the lamp glow) and makes greens muddy. Not used; the bg is full colour, 478 KB (the library's is 189 KB at 256 colours). |
| (c) Resize the characters for this room only | Not needed, and would be wrong: the people are drawn once (`people.png`, the animal strips) and shared with the library; a second size means a second set of sit frames and a hit-test per size. |
| (d) A ChatGPT redraw | Not needed for scale. A redraw would help for the things listed under "Known issues"; the prompt is `docs/study/art/chatgpt-cafe-interior-prompts.md`. |

Cost of the choice: detail below 2.4 source px is gone (the picture has little: cup rims, rug fringes, the pastries are a few
pixels each). The room is smaller than the library (640 x 432 against 960 x 656): at 1280 x 800 the window shows 427 x 267 of it, as
the library does, and the camera follows you.

## What the tool makes, and the config

`python3 tools/art/room_from_image.py tools/art/rooms/cafe.json` (needs `numpy` and `pillow`; `--check` writes nothing;
`--preview x.png` overlays the walkable tiles, pieces, seats and lights; `--seated x.png` draws a person in every seat in the
engine's draw order; `--grid x0,y0,x1,y1 --zoom 5 --out x.png` writes a labelled crop of the final room for reading coordinates).
**Every coordinate in the config is in final art pixels** (the `bg.png` you get). The docstring of the tool is the format; in short:

- `patches`: clone or fill rectangles of the resampled picture. The cafe has one: **a doorway into the sunroom** (see below).
- `floor`: shapes where feet may stand (a union); `blocked`: footprints of what stands on it (a table's top, a pot's base, a
  chair's lowest 8 px: not the whole picture of the thing, or the room has no room to walk). A tile (16 px) is open when the
  engine's 8 x 6 footprint, centred where the engine centres it, is all floor.
- `pieces`: what must draw OVER a person standing behind it (the engine sorts people against each piece's `z`, the y it stands on):
  the tables (so a seated lap is under the table), plants, the two lantern pillars, the pastry case (the barista stands behind it).
  `trim` removes floor-coloured pixels touching the shape's edge so a plant is its leaves.
- `seats`: the registry file. `lights`, `staff`, `door`.
- The checks (exit 1): door on the floor; **no sealed pocket** (every open tile reachable from the door by the engine's own
  8-way rule); every seat's standing tile open, reachable, near the chair; ids unique; sprite boxes inside the room.

### How to add a room

1. Put the picture in `docs/study/art/source/`. 2. Copy `cafe.json`; set `source`, `scale` (measure: outline stroke width and chair
width against 16 px and 24 rows), `size`, `out`. 3. `--grid` crops to read coordinates; write `floor`, `blocked`, `door`,
`pieces`, `lights`. 4. `--preview` until there is no pink (sealed) tile; write the seat registry; `--seated` until nobody sits on a
table. 5. Add a `RoomDef` to `rooms.ts` (art folder and seat mapper). Mount: `mountLibrary(canvas, overlay, { art: room.art, live: { seats: room.seats, ... } })`;
the library's own `LibraryRoom` takes `room={...}`.

## The engine seam (additive; the Grand Library is the default and unchanged)

`cafeScene.ts`: `RoomArt` and `CafeOptions.art` (library mode only; `loadAssets(versioned, art)` caches per room id; the homepage
and the library call it as before), and one new seat pose `"chairback"` (a person sitting in a chair with their back to us, drawn from
the stool frames 72 to 77, which the engine had never drawn: the library's `"stool"` seats are the back view standing, unchanged).
`RoomCanvas` and `LibraryRoom` take an optional `room`. Homepage check: `scratchpad/perffix/hero-det.js` (a virtual clock and a seeded
`Math.random`, both canvases hashed over 300 frames, four viewport/motion modes, input): identical before and after on two runs; **one
extra run under load differed** (the script's real-time timers), so it was repeated twice more, idle: identical both times.

## Seats (47)

Ids are an append-only registry (`cafe.seats.json`; `cafe.test.ts` holds the published list). A seat's number is its place in it
(what a future multiplayer cafe would send as `ls`). `at` is the chair's centre where the ring is drawn; the sprite is at `at - (8, 20)`.

| Table | Seats (ids) | Pose |
|---|---|---|
| Long dining table | `long-n1..3` (north side) | **front** (the `read` frame) |
| | `long-s1..3` (south side) | **back to camera** (`chairback`) |
| | `long-w`, `long-e` (the ends) | sit right / left |
| Two round tables | `rl-w`, `rl-e`, `rr-w`, `rr-e` | sit right / left |
| | `rl-s`, `rr-s` | **back** |
| Reading nook | booths `nb1-*`, `nb2-*`: `-n` front, `-w` sit right, `-e` sit left; round table `nr-w`, `nr-e` | |
| Sunroom | sofa `sun-sofa1..3`; square tables `st1-*`, `st2-*` (`-w`, `-e`, `-s` back); round `sr-w`, `sr-e` | sofa **front** |
| Lounge | sofas `lounge-l1..3` (sit right), `lounge-r1..3` (sit left); armchairs `arm-l`, `arm-r` | |
| Booths below the lounge | `bA-*`, `bB-*` (`-n` front, `-w`, `-e`) | |

**Front and back seats (17).** The fox, capybara, axolotl and badger have SEATED art drawn for it (`docs/study/library.md` "Characters",
`tools/art/animal_sit.py`): at a front seat (`long-n*`, `nb*-n`, `sun-sofa*`, `bA-n`, `bB-n`) the head is tipped down over the table and the
neck is on row 16 (the table's edge cuts at about row 22), so the face and the shoulders show and the paws and the pen are under the table; at a back seat (`long-s*`, `rl-s`, `rr-s`, `st*-s`) the whole figure
sits on the chair with its back to us; at the side seats (`-w`, `-e`, the ends of the long table) the profile leans toward the table (the face is at the table's edge, the tail hangs out
over the chair back by 3 to 6 px: accepted). The red panda, raccoon, hedgehog, triceratops and dragon still use the stand-in seated poses (the `read` frames are the standing front view
cut at the hip, the stool strip the back view), which are the weak point of the art, `library.md` "Limits". Every seat was sat in by a script in the browser (47 of 47, `shots/cafe/seat-NN.png`).
**Not seats:** the armchairs are drawn angled; they are given left/right sit, which reads fine; the bar has no stools in the picture;
the bay window's built-in bench is the sofa.

## How it plays (checked in Chromium, 1280 x 800 and 390 x 844)

W A S D and arrows walk (continuous, 70 px/s, sliding on furniture), tap to walk, free chairs show a ring, E / Enter / Space or a
tap sits, E stands. The camera follows. The HUD, chat, People, timer and "sit down" card are the library's (the demo reuses
`LibraryRoom`, `FakeLibraryWorld` and `FakeBot`; the script is `cafeDemo.ts`): 9 students (`?bots=6..12`), half already at their tables,
the rest walk in through the door, sit for 40 to 150 s, stand up, leave, and come back; a third are animals. `?me=<animal>` makes you
one, `?zoo=1` makes everyone one, `?alone=1` is the empty room, `?seed=N` repeats a script. Tests drive it through
`window.__plumiLibrary` (dev only). Lamplight is the library's: a static pass (warm lantern, lamp and fire lights; the fires flicker
their glow). **There is no day and night pass in the room** (the library has none either: its day and night are the entry door's);
the lights are always on. The fireplace and window are static art.

## Known issues (say so)

- **The picture has no doorway into the sunroom.** Its partition is one unbroken wall and post. A 16 x 28 px piece of floor is
  cloned over the wall (`patches`); it reads seamlessly (`walkable-preview.png`). A redraw with a drawn opening is better.
- The **lounge** is reached by an 18 px gap between the lantern pillar and the half wall; **the bar and back kitchen are not
  walkable** (the counter's ends leave 6 px gaps); the barista is a fixed figure behind the pastry case.
- Tile resolution (16 px) means tight furniture groups leave a person standing a few pixels off a chair or on a plant's edge; a
  person walking just behind a plant is hidden by it, as designed. The sunroom is the tightest room: its chairs are walk-through
  (their footprints are not blocked) and its round table is reached by one 14 px lane.
- Seated people at the ends of tables (`long-w`, `st1-w`, the booths' sides) are half behind the table: that is the table piece
  doing its job, but a person is wider than the little end chairs.
- Chairs are drawn once in the picture, so a seated person is drawn over the chair (the chair shows only around them); the south
  chairs' backrests are not cut as pieces, so nobody is in front of a backrest.
- No student has used it; scale and layout are judged by looking, not by use (CLAUDE.md evidence levels 1 and 2 are empty).
- Side find, not mine: `next.config.ts` `libraryArtVersion()` reads every entry of `public/library` as a file, and `characters/` is a
  folder, so it throws and returns "" (art is served uncached, without `?v=`). It predates this branch.

## What the town integration needs

- **Door and entry.** `layout.json` `door: { x, y, tile }` (feet, 312 x 410, tile 19, 24). People appear and fade in there and leave
  out through it; the town should start the cafe's player at `door` (the engine does this) and hand over when they cross a
  doorway trigger outside the vestibule (the floor ends at y 414).
- **A transition.** The library has the "front door" entry scene (`entry.ts`, `Front.tsx`: blurred art, ENTER key); a cafe door
  scene needs a still of `bg.png`, no engine work. Nothing here does it.
- **The seat wire.** The cafe's seat numbers are stable ids; `LiveRemote.seat` and `LiveYou.seat` already carry the index. Multiplayer
  needs the session's `LIBRARY_TILE` and clamps (`room.ts`) made per room: today they are the Grand Library's (the demo stays inside
  them because the cafe is smaller).
- **A real cafe building** would add its own colliders to the town's grid; the room is 640 x 432 art px, 40 x 27 tiles.

Credit and licence: the picture is the founder's ChatGPT render; the people are LimeZu's (library.md).
