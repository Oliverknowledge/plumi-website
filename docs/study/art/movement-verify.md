# Movement: independent verification of 694f9a0

Verifier, not builder. Read only: no engine code was changed. Everything below was measured on this machine (4 vCPU Linux VM,
headless Chromium 1243, **software raster, no GPU**, real time rAF), against a dev server of `694f9a0` and, where a before was
needed, a dev server of `a8b5cd4` (the builder's parent, whose `cafeScene.ts` is byte-identical to `origin/claude/fox-character`
76ba617). No paid model calls. iPad Safari was not tested (cannot be). Scripts: `scratchpad/ver/*.js|py` (not committed).

## Verdict in one paragraph

The movement now has the reference's dynamics: the picture changes on every display frame while you move (60.5 updates a second
measured from pixels, not from the engine), the body moves 4 or 5 device pixels a frame in 1 device pixel steps, the six poses
change at about 12 a second (11.9 to 12.4 per run), the sprite does not move on the screen while the camera is free to follow it, start, stop and turn
take at most one frame, and an art pixel stays a uniform 4 px (8 at 2x, 6 at 1.5x) square. The harness is honest about what it
measures (my independent numbers agree with it). What it cannot see, and what I found: the pose clock lands exactly on a display
frame boundary, so 30 percent of pose slots are 4 or 6 frames instead of 5 (uneven cadence); the governor fell back to 30 Hz by
itself on a perfectly capable run (dpr 2, one person, no throttle) and there is no way to override it, which is the main risk on
an iPad; 60 Hz costs 40 percent more main thread at 1x and 75 percent more at 2x with a crowd (software raster); and the sprite
is still 25 percent faster per body height than the reference's, with a less readable gait (art). Side by side with the reference
the founder would, I think, say "the glide and the camera feel like it now"; he may still say "he is rushing" and "the legs do
not read as well". That is a judgement from stills and numbers, not from watching two screens: please look at it live.

## Attribute verdicts

| Attribute | Verdict | Evidence |
|---|---|---|
| 60 Hz glide | **MATCHES** (with a caveat) | Pixel changes on 100 percent of moving display frames, 60.5 per second (rows of the real canvas, `an2.py`), real rAF 60.06 Hz (gaps 16.6 to 16.8 ms). Floor scroll per frame 4 or 5 device px, mean 4.66 (reference 4.5 css px); at 2x 9 or 10 device px. Strips: `cmp-down-ref-vs-ours.png`, `cmp-right-ref-vs-ours.png`, `ours-18-frames-60hz.png`. Caveat: only while something in view moves; a standing room is 30 draws a second as before. |
| 12 Hz poses | **PARTLY** | Mean 11.9 to 12.4 a second per run (matches). But slot lengths in display frames at dpr 1: 4 frames 16 percent, 5 frames 71 percent, 6 frames 14 percent; at dpr 2: 2 to 4 frames 31 percent, 5 frames 51 percent, 6 frames 19 percent (`plots-edge-slots-raf.png`). The reference is all 5 (two 4s from the recorder dropping frames). Cause: `floor(stride * 12)` crosses a boundary exactly every 5.000 frames, so 0.1 ms of rAF jitter flips it. The pose changes unevenly by up to 17 ms. |
| Sub art pixel placement | **MATCHES** | Sprite steps 1 device pixel (1/4 art px at k 4, 1/8 at k 8; reference 1/3). Zoomed 6x at four sub positions every art pixel is a uniform block (`ours-zoom-subpixel.png`); 96 percent of horizontal colour runs inside the sprite are exact multiples of k, the rest are tone steps (likely the lamp overlay, which is sampled on the floor grid, not the sprite grid: not confirmed). Same run histogram at dpr 1.25 (k 5), 1.5 (k 6), 2 (k 8): multiples of k only. Hair block left edge has zero variance across 92 moving frames. No blur. |
| Locked camera | **MATCHES** | Sprite screen position (724, 592) with zero variance over all 568 moving frames of 8 runs, and the label offset to the sprite is constant (32, 20) over 111 frames. At the room edge the camera clamps and the sprite slides off centre at exactly the walking pace, no jitter (`plots-edge-slots-raf.png`, left). Click-walk, phone tap (390x844, dpr 3, k 5) also locked. Difference from the reference by design: it centres the player, we hold the feet 25 percent below centre. |
| Shadow | **MATCHES, blemish** | Constant ellipse 14 x 4 art px under every standing or walking person, none under seated ones (50 people, zoo). The harness reads 0.44 H (reference 0.475) and 0.36 for the fox (floor of the band is 0.35). It is dark purple at 50 percent: clearly visible on the red carpet, faint on dark wood. Blemish: standing behind a table the shadow and feet peek out between the books (`shadow-sliver.png`), as the builder said. |
| Instant start, stop, turn | **MATCHES** | Key down to first changed frame 0.4 to 15.8 ms (inside one frame); key up to the last camera change 6 to 16 ms; the face changes on the first frame; into a wall it turns, stops and holds the idle pose (`b7.js`). |
| Idle stillness | **MATCHES** | A person who has just stopped holds one standing pose for 2 s; the harness measures 0 changes in 1.25 s. What happens after 2 s (breathing) is unknown in the reference. |
| Homepage | **UNCHANGED** | See below. |
| Reduced motion | **UNCHANGED** | Position, direction, camera and a canvas hash after three key presses are identical to the base build; no `data-hz`, no loop. |

Remaining differences from the reference, by how much they affect feel: (1) speed per body height 2.80 H/s against 2.24 (25
percent faster; the builder left it on purpose); (2) the walking art itself: the front walk's legs are hidden under the coat and
change by one or two art pixels (`ours-poses-down.png`), the reference lifts a leg visibly, so a 12 Hz clock on this art reads
less; (3) uneven pose slots; (4) the sprite is 10.5 percent of the window height against 12.6 and pixels are 4 css px against 3;
(5) vertical lock point.

## Regressions and risks, ranked

1. **Governor falls back on its own and cannot be steered (medium, the iPad risk).** In my matrix the same configuration (dpr 2,
   1 person, no throttle, 12 s of walking) fell to 30 Hz in one run (`hz` 60 then 30; rAF 57.4 a second, JS work p95 4.9 ms, so the
   lateness test fired, not the work test) and stayed at 60 in a later 110 s run. At 4x CPU throttle it falls within 2 to 3 s, as
   designed, and stays down (the return needs under 5 ms p95 and 30 s, doubling per fall). There is no `?hz=` flag, no storage
   override, no log. Repro: `node ver/perf.js '{"port":3971,"people":1,"dpr":2}'` and read `hzSeen`. Cheap safeguards below.
2. **Uneven pose cadence (medium-low).** See the pose row. Repro: the `slot frames hist` in `an1`-style analysis of any real time
   walk; it is visible in `plots-edge-slots-raf.png`. Fix: add a small phase bias, `Math.floor(p.stride * POSE_HZ + 0.1)`, so
   boundaries fall mid frame; slots become 5, 5, 5.
3. **Energy while moving (medium, by design).** Main thread busy, 12 s walking, software raster: dpr 1, 1 person 22.8 percent
   (before) to 31.9 (after, 60 Hz) against 25.7 forced 30; 50 people 28.8 to 38.7; dpr 2, 50 people 50.6 to **89.7** (the same
   run at 30 Hz: 59.2). JS draw time falls (3.8 to 0.8 ms) only because rasterisation moved out of the callback: use the busy
   figure. 60 Hz is active whenever any person near the view walks or a movement key is down, not only when you move: in a
   populated room it will be on most of the time. A still room: 30 draws a second before and after (not cheaper than before),
   busy 24 to 28 percent both. Not measured with live remote walkers (the demo has none that wander).
4. **Mode switch pops (low).** Changing from 60 to 30 Hz re-places a standing sprite from the device pixel to the whole art pixel:
   measured 2 css px (sprite, shadow, "You" label) at 1x, at the instant of the switch. The rest of the screen is pixel identical
   between the two modes (static scene, dpr 1 and 2: 1944 and 7386 differing pixels, all in the player's sprite box). While
   walking in 30 mode the sprite stays locked.
5. **Look at someone, then walk (low).** The camera catches up at 200 art px/s: the sprite starts 180 css px off centre and
   slides home in about 1 s (up to 22 css px a frame). Smooth, no pop, but it is a visible slide.
6. **Shadow sliver behind furniture (low), known.** `shadow-sliver.png`.
7. **Fox shadow at 0.36 H, floor 0.35 (info).** Any art change to animal rows will fail it.
8. Not regressions: standing up from a chair jumps the sprite 12 css px to the feet tile (same logic as before); pops and
   emotes stay where they were made (world anchored, as before); a 2x2 check of sit, stand, E prompt, ring, lookAt and click-walk
   gave no page errors.

## Homepage

`hero-det2.js` (virtual clock, seeded random, 300 frames, four modes). Result: **three of four modes are byte identical** between
the branch and `a8b5cd4`; in the fourth (`normal-1280x800@1`) the base itself is not deterministic: five runs on the base gave two
different hashes (A three times, B twice), nine runs on the branch gave A every time. So the branch equals one of the base's two
valid outcomes in all 9 runs, which is as strong a statement as the script allows; it is not the "byte-identical" the harness
suggests, because the script leaks real time (it waits 2.5 s of real time before it hooks `setTimeout`). A 10 s real time watch of
the hero (hash changes a second, both canvases, `homereal2.js`) with a seeded `Math.random`: 17.8 vs 18.0, 22.1 vs 22.1, 20.1 vs 20.3
(base vs branch). Unseeded runs differ by chance (base 19.1 to 23.4, branch 22.8 to 28.3); that is the room's own randomness.
Diff review: every library-only path is behind `this.smooth` (`live && !reduced`), which is false for `hero` and `friends`.

## Performance table (12 s of walking, real time, software raster)

| config | before busy | after busy | after forced 30 | draws/s before, after | GC (minor+major) before, after | falls |
|---|---|---|---|---|---|---|
| dpr1, 1 person, 1x | 22.8 | 31.9 | 25.7 | 30, 57 | 36+3, 52+4 | no |
| dpr1, 50 people, 1x | 28.8 | 38.7 | 28.3 | 30, 57 | 32+4, 50+4 | no |
| dpr1, 1 person, 4x | 95.5 | 95.6 | | 29, 28 | 30+2, 30+2 | yes, 2 s |
| dpr1, 50 people, 4x | 93.5 | 96.5 | | 28, 29 | 28+3, 30+3 | yes |
| dpr2, 1 person, 1x | 51.4 | 57.1 | 54.7 | 30, 31 | 50+3, 44+3 | yes, mid run |
| dpr2, 50 people, 1x | 50.6 | 89.7 | 59.2 | 30, 53 | 32+3, 46+4 | no |
| dpr2, 4x (1 and 50 people) | 101 | 100 to 101 | | 12, 12 | | yes |

Busy is the CDP `TaskDuration` share of wall time; the base at 4x is already saturated here, so 4x says little about the
fallback's own cost (before and after are within noise). Heap, 2 minutes, 50 people, walking in turns, after a forced GC at each
point: 32.31, 32.61, 32.80, 32.91, 32.99 MB, DOM nodes 217 to 209: a small bounded rise (0.7 MB, flattening), no per frame
allocation sign. Hidden tab (visibility faked, headless cannot hide a tab): the loop is cancelled (`raf` 0), held keys cleared,
room time frozen, and it resumes on show: no stuck 60 Hz loop. Resizing while walking (1200x800, 900x700, 700x700, 1100x900,
1512x949 through CDP): k 3, 2, 2, 3, 4, sprite exactly at the window centre each time, no errors. Window 600x800 at dpr 1
(fractional k 1.5) renders as the base does.

## Harness against my numbers

`measure.mjs` on `694f9a0`: person, `--zoo`, `--dpr 2`, `--me fox` all print `PASS: 0 scored metric(s) outside tolerance`, page
errors 0. Independent measures from my own real time recordings (not from `spriteAt`, `frame` or `camX` except where marked):

| metric | harness | mine | from |
|---|---|---|---|
| display updates a second | 60 | 60.5 (dpr 1), 58 to 62 (dpr 2) | canvas rows changing between rAF frames |
| step per update, css px | 4.67 | 4.66 mean (4 and 5) | cross correlation of the floor row between frames |
| pose changes a second | 12 | 11.9 to 12.4 (dpr 1), 11.7 to 12.7 (dpr 2) | white leg pixel mask changing |
| slot length frames | not reported | 5 for 71 percent (dpr 1), 4 to 6 otherwise | same |
| start / stop latency | -1 / 0 ms | 0.4 to 15.8 / 6 to 16 ms | window `keydown` timestamp against the first changed frame |
| sprite screen position | locked (0 css px lag) | exactly 724, 592 | engine position, confirmed by hair pixels at constant x |

No number differs beyond what the virtual clock hides. What the harness cannot see: real timing jitter (pose slots), the real
governor (it pins it to 60), raster cost, occlusion, labels, anything on the homepage.

## iPad Safari: what could break and what to add

Could break: (1) rAF cadence: ProMotion at 120 Hz (the 14.2 ms gate holds it to 60), Low Power Mode caps rAF at 30 (every frame
looks late, so it falls; correct, but it counts as a fall and doubles the hold); (2) `drawImage` with a **fractional source
rectangle** (`camX` is a multiple of 1/k) and smoothing off was verified pixel identical to the old path only in Chromium; WebKit
may snap or sample it differently and show seams or uneven floor pixels. A robust form is an integer source offset plus a
destination offset; (3) two full-screen blits a frame (room, then the merged lamp layer) at up to 5.6 million pixels on the iPad
Pro, and an unknown canvas backing (CPU or GPU); (4) `performance.now()` is coarse in Safari, so the 8 ms work test is coarse;
(5) the lateness test fired spuriously once here, and it is the only protection.

Cheap safeguards, none present today (`grep` finds no `hz` option): a `?hz=30|60|auto` parameter and a `localStorage` key read
once in the `Cafe` constructor (30 forces `hz60=false` and `govAt=Infinity`); `console.info` and a `data-hz-why` attribute on a
fall (work or lateness); do not count lateness in the first 3 s after a visibility change or resize; a feature check that keeps
30 Hz when `matchMedia("(update: slow)")` or when the first 60 frames average over 20 ms; the integer source rectangle above.

## Files

`movement-verify/`: `cmp-down-ref-vs-ours.png` and `cmp-right-ref-vs-ours.png` (reference top, ours bottom, 30 fps frames, 1 css px
= 1 px, shown 2x), `ours-18-frames-60hz.png` (18 consecutive real time rAF frames), `ours-zoom-subpixel.png`, `ours-poses-down.png`,
`behind-table.png` (player teleported behind a table at sub pixel steps; hidden exactly), `shadow-sliver.png`,
`plots-edge-slots-raf.png`. Recording: real rAF callbacks, `getImageData` crop of the engine canvas after each draw (1512x949 at dpr 1
and 2, `rAF` 60.06 Hz achieved, 1100 frames a run, capture cost under 1 ms a frame). The reference strips are from the earlier frame
extract at 30 fps, so every strip pairs 33 ms steps.
