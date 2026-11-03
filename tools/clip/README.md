# tools/clip: gameplay clips of the town, recorded from the real engine

Makes the founder's demo clips (`plumi-town-1080p.mp4`, `plumi-town-vertical.mp4`, a 720p preview and a looping GIF of each) of the walking
town: a fox on the winding path, bots and animals passing, the library plaza, a person walking up to the cafe door, E, the fade, the cafe
interior, sitting down at the long table, then the Grand Library's room. Silent. No model calls, no Supabase, no network.

## One command (re-run it after the map changes)

```bash
node tools/clip/record.mjs --out ../clips            # starts `next dev` itself on :3978 if nothing answers there, records both shapes, stops the server
node tools/clip/record.mjs --base http://localhost:3977 --aspect landscape --fps 60 --out DIR   # an existing dev server, one shape
```

Needs Playwright (`/opt/node-tools` is found automatically), Chrome or Chromium, and `ffmpeg` (H.264). Options: `--aspect landscape|vertical|both`,
`--fps 60|30` (60 is the engine's own rate; 30 is a quick draft, 3 to 4 minutes a clip), `--crf N` (default 18; 20 for a smaller vertical file), `--only <take>`, `--samples N` (a PNG of every Nth frame
into `OUT/samples/`, to look at), `--no-extras`, `--debug`, `--story file.json`. Running time on this machine, software rendering, 60 fps: about 6 to 9
minutes a shape (the cast is built first, about 10 s).

## How it stays smooth and repeatable

Headless Chromium with a software raster is far too slow to record in real time, so the browser's clock is virtual (`clock.mjs`):
`requestAnimationFrame`, `performance.now`, `Date.now`, `setTimeout`/`setInterval` and CSS transitions (the door fade) all follow a clock that only moves
when the recorder says so, exactly 1/60 s a step. A PNG is taken after every step (60 fps) and piped to ffmpeg (CRF 18, yuv420p, faststart). The engine is
the real town engine (`?hz=60`, so its own 60 Hz path and 12 Hz poses), `Math.random` is seeded (`seed` in the storyboard), and the ambient layer (leaves,
smoke) runs on the engine's own dt, so a take is the same every time.

## Reads the map, not pixel numbers

`world.mjs` loads `public/town/v1/town.<hash>.json` (the file `assets.generated.ts` names) and builds the path network from it. The storyboard
(`storyboard.json`) names things: `{ "door": "cafe" }`, `{ "hub": "plaza" }`, `{ "plaza": "library-plaza", "dx": -190 }`, `{ "zone": "quiet-grove" }`, `{ "path": "...", "at": 0.5 }`.
A **route** is a list of anchors joined along the real paths (Dijkstra on the centre lines), so the walker takes the winding way. A walk shot says where on a
route it starts (`{ "px": 0 }`, `{ "near": anchor, "back": 260 }`, `{ "fromEnd": 350 }`) and how long it plays; bots walk slices of the same routes (`from`, `to`, `side`).
The engine's own planner joins the route's points every 90 px, so a lamp or a corner never stops a walker. If the polished map renames a house or a plaza,
the recorder says which anchor it could not find; edit the name in `storyboard.json`.

Shots: `walk` (follow a body along a route), `pan` (the camera climbs a building, from `rx, ry` fractions of its sprite), `enter` (stand at a door, E, the 0.35 s fade,
the room loads behind the dark and is filled with 30 s of unrecorded time so the students are seated, then it fades in), `room` (walk in, the seat's ring and the E prompt appear, E,
sit, hold; speech bubbles over the nearest seated students), `endcard` (the word Plumi, drawn in the page). The time of day is the page's `?tod=` (the storyboard uses `evening`).

## What it changes in the page (the recording only, no file in the repo)

* The map is loaded WITHOUT its placeholder furniture (labelled boxes, 106 of them) and sit spots: the response is edited in flight, so walkers do not steer round invisible benches.
  `"keepFurniture": true` in the storyboard keeps them.
* The dev chrome is hidden by CSS (`hideCss`): the Next.js dev badge, the record player, the library's top bar, dock, drawer and the Town button. Name labels, speech bubbles and the E prompts stay.
* Animals are drawn by the app's own wardrobe in throwaway pages (`cast`), handed back as PNGs, and set on the bots with `__town.people[i].art` (the town's bots are people only).
* In the room, you are drawn as the body that walked in (`dressYou`), so the player does not change look at the door.
* No engine file is edited: it reads and sets fields that exist at runtime (`people`, `setPath`, `targetX`, `__plumiLibrary`), dev build only.

## Files

| | |
|---|---|
| `record.mjs` | the recorder: server, cast, one browser per shape, the shot interpreter, ffmpeg, extras |
| `storyboard.json` | the script: routes, takes, shots, bots, end card text |
| `world.mjs` | the map data and routes |
| `clock.mjs`, `inpage.mjs` | the virtual clock; the in-page helpers |

## The social cut (6 seconds, animals only): `social.mjs` + `grade.py` + `social.json`

The founder's second brief: 6.0 s, 60 fps, silent, no humans. Two animals walk side by side to the cafe door (a speech bubble each), a warm dissolve, the cafe full of
animals studying (all nine species), the two walk in and sit at the ends of the long table, a held wide shot, a soft fade out. Captions in the app's pixel font
(Pixelify Sans) and a small "Plumi" wordmark. A 1080p master and a 1080x1920 vertical.

```bash
node tools/clip/social.mjs --aspect both --out DIR                                   # raw 60 fps frames of both scenes (about 1.5 minutes a shape)
python3 tools/clip/grade.py --frames DIR/landscape --out plumi-social-1080p.mp4      # grade, captions, dissolve, fade, encode (CRF 16; about 90 s)
python3 tools/clip/grade.py --frames DIR/vertical --out plumi-social-vertical.mp4
```

* **Outdoors** is the real town engine (`?tod=day`, placeholder furniture stripped as above). The two foreground animals and the three in the background are the engine's bots
  with the app's animal art (`R.bots`); their name tags and speech bubbles are DOM elements in the room's own `.lb-nm` / `.lb-bub` styles (`installTownUi`), because the town engine draws
  monospace pills and has no bubbles. The camera is a scripted ease (`social.json` `camera` keyframes, smoothstep between them), the player's own body is parked far away.
* **The cafe** is the real room (`/study/cafe/demo?alone=1`, nobody scripted) and everyone in it is put there through the room's own `setRemotes` (`installRoomHelpers`): which animal, which
  chair (by the registry id in `tools/art/rooms/cafe.seats.json`), what name tag and subject, who is walking in and when they sit (the room snaps them into the chair), who speaks. The app's own
  calls to `setRemotes` are switched off for the recording. The room's greeting pop-up, HUD and your own "You" label are hidden by CSS.
* **The grade** (`grade.py`, numpy, per pixel and per hue; no filter touches the art): grass is lifted and softened toward a pale fresh yellow green, gold canopies and orange roofs desaturated a notch, shadows lifted
  toward cream, highlights warmed, a soft vignette. The parameters in `social.json` `grade.outdoor` were fitted to the mean colour of each class of pixel (grass, gold canopy, roof, path) in the lofi.town reference
  frame (full strength); `strength` blends it back toward the raw frame (0.6 in the clip, so the dark outlines keep the art crisp). The cafe interior has its own, milder grade.
* All timing, names, seats, species, captions, fades and the grade are in `social.json`. Vertical overrides (`outdoor.vertical`, `indoor.vertical`) re-frame the same story for 216 x 384 art px.

## v3 of the social cut: `social3.mjs` + `social3.json` (use these; `social.*` is v2)

```bash
node tools/clip/social3.mjs --aspect both --out DIR                                                  # raw frames (about 4 minutes both shapes)
python3 tools/clip/grade.py --config tools/clip/social3.json --frames DIR/landscape --out plumi-social-1080p.mp4
python3 tools/clip/grade.py --config tools/clip/social3.json --frames DIR/vertical   --out plumi-social-vertical.mp4
```

What is new: shot structure (a medium outdoor shot, a warm-white flash at the door, a close shot of two animals sitting down, a wide cafe shot held, a soft fade); `k` per shot in the config
(`R.forceKTown` / `R.forceKRoom` replace the engine's `resize` on the instance, so any whole zoom works at the real pixel density; the founder chose to stay near the product's k = 5, so the close
shot is k 5 and the wide cafe shot k 4, a cut between whole k values, never a smooth zoom); only side-facing seats are used (`rl-*`, `rr-*`, `long-w/e`, `lounge-*`, `bA-*`); each frame is captured three times
(the canvas alone, then the name tags and bubbles alone over black and over white, so `grade.py` recovers their colour and alpha), which lets the picture be anti-aliased (`smooth` in the config: a light gaussian
then an unsharp mask) while the labels stay crisp; chunky captions (4 px outline, soft shadow, a dark gradient scrim); the grade at strength 0.75.
