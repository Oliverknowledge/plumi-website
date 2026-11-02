# Movement gap list: our engine against the reference

Measured on the real engine (`src/components/landing/cafeScene.ts`, library mode) by `tools/movement/measure.mjs` on a 1512 x 949 window at 1x (art scale k = 4, 378 x 237 art px visible, person sprite 25 rows), 60 Hz virtual display, deterministic. Reference numbers: `movement-reference.md`; targets and tolerances: `tools/movement/target.json`. Run: see `tools/movement/README.md`.

## Side by side

| Metric | Reference | Ours (person) | Ours (fox) | Verdict |
|---|---|---|---|---|
| Steady speed, H/s | 2.24 (89.7 art px/s on 40 rows) | 2.80 (70 on 25 rows) | 2.80 | info: 25% faster per body height; in css px a second 280 against 269 |
| Same in all 4 directions | 1.04 | 1.00 | 1.00 | pass |
| Diagonal / straight | 0.94 | 1.00 | 1.00 | pass |
| Start delay, stop excess | under 2 frames, none | +10 ms, +5 ms | same | pass (instant both) |
| **Display updates per second** | **60** | **30** | 30 | FAIL |
| **Smallest sprite step, css px** | **1** (1/3 art px) | **4** (a whole art px) | 4 | FAIL |
| **Visible jump per update, css px** | **4.5** | **9.3** | 9.3 | FAIL |
| **Pose changes a second** | **11.9** | **5.0** | 5.0 | FAIL |
| **Body travel per pose, H** | **0.19** | **0.56** | 0.56 | FAIL (3x) |
| Walk cycle, ms (6 poses) | 750 (9 slots) | 1150 to 1200 | 1150 to 1200 | FAIL |
| Head bob, art px | 1 | 1 | 2 | pass |
| **Ground shadow width, H** | **0.475** | **none** | none | FAIL |
| **Camera lag while walking, css px** | **0 (0.7 sigma)** | **69** (17 art px) | 69 | FAIL |
| **Camera settle after stop** | **same frame** | **733 ms** | 717 ms | FAIL |
| Idle animates in 1.25 s | no | yes (2 changes) | yes | info |
| Face kept through a diagonal, instant turn, face a wall | yes, 1 frame, yes | yes, 33 ms, yes | yes | pass |
| Click-to-walk speed vs keys | (no click in clip) | 1.01 | 1.01 | pass |
| Other walkers vs the player | (none in clip) | speed 1.04, pose 5 Hz | animals 5 Hz, 2.7 to 3.0 H/s | pose FAIL (same code path) |
| Person height on screen | 12.6% of window | 10.5% | | info |
| Where the camera holds the player | centre (feet 0.7% below) | centre in x, **25% below** centre in y | | info (a design choice, below) |

Run time of the harness: 9 to 13 s. Deterministic: two runs give identical numbers.

## What matters to the feel, and what does not

Blunt version: ours already has the part people assume is hard (instant start and stop, constant speed, normalised diagonals, turn on a blocked key, same speed for everyone). What is different is **how often the picture changes and how the camera behaves**. In order of how much each is felt:

1. **30 Hz, whole-art-pixel jumps** (G1). Every other display frame is a repeat, and each jump is 2 to 3 art pixels (8 to 12 css px at k = 4); the reference moves 4.5 css px every frame. On a 60 or 120 Hz screen this is a visible stutter and it makes everything else look slower and cheaper. It also forces the pose clock to land on 33 ms boundaries, so a 12 Hz clock would alternate 67 and 100 ms slots.
2. **A 5 Hz walk cycle** (G2). Each pose lasts 200 ms and the body travels 0.56 H per pose, three times the reference's 0.19 H. The sprite looks dragged along with the feet barely keeping up. The reference skates too (7.5 art px per pose, 1.7 H a cycle), so the goal is not foot lock: it is **pose density**.
3. **A camera that trails by 69 css px and takes 0.7 s to settle** (G3). In a room 960 x 656 art px with a 378 x 237 window, the camera is scrolling most of the time, so the player constantly slides against the frame and then the room drifts on after he stops. The reference locks the camera rigidly on the player.
4. **No ground shadow** (G4). The ellipse is cheap and does a lot of the "grounded, solid" feeling.
5. Minor: speed per body height (G5), idle breathing (G6).

Noise, do not chase: head bob (equal at 1 art px), diagonal speed (equal), facing hysteresis (equal in effect), start/stop (both instant), A* with string pulling (the reference shows no pathfinding; ours is a feature, not a feel problem), the 6 frames per direction (the reference also has 6 distinct poses).

## Constraints that shape the fixes

* **Art**: humans have **6 walk frames per direction**, animals the same in a 78-frame row (`tools/art/animal_rig.py`); the reference also uses 6 distinct poses (a 9-slot cycle that repeats three of them). A 12 Hz clock over our 6 frames gives a 500 ms cycle (the reference 750 ms); that is inside the accepted band (450 to 800 ms). No new art is required. Re-sequencing our frames into a 9-slot ping-pong is an art decision (which of our frames are contact and which are passing), not needed to reach the target numbers.
* **Animation clock**: `layout.json` `fps: 10` drives ambient animation and the idle/sit/read frames. The walk must get **its own clock** (12 Hz time-based or distance-based); the 10 Hz clock can stay for everything else.
* **Sub-pixel placement and crispness**: the reference places a sprite at whole css pixels and draws each art pixel exactly 3 css px square. To do the same in the engine, **draw each item with an integer scale and a device-pixel-rounded destination**: `dest = round((x - camX) * k) + off`, size `w * k` (nearest-neighbour). The art pixel stays exactly `k` px, only its offset moves by 1 device pixel. Do not draw at fractional art-pixel scale and do not blend. The engine today composes everything into an art-resolution canvas (`scene`, drawn by `draw()`) and then blits it whole-pixel (`draw()`, `this.camX`, `ctx.drawImage(this.scene, ...)` near line 1094); sub-art-pixel motion needs the people (and, for no seam against the room, everything) drawn at screen resolution in the final blit, or the whole scene composed at screen resolution for the library mode only.
* **Frame rate**: 60 Hz needs the loop gate `if (now - this.last < 1000 / 32) return;` (line 1182, `start()`) lifted for the library mode, and `dt` from the real frame time (already: `Math.min(.1, ...)`). On 120 Hz screens either run at 120 or keep at 60 with a 16.7 ms fixed cadence; the numbers do not need more than 60.
* **Cost**: doubling the frame rate doubles draw work. The engine comment says a frame must make no garbage; keep the pool. Draw only when something visible moves (a walker, a camera move, an animation tick, a label) and keep the offscreen pause. The library has a pixel budget (`LIBRARY_PIXELS`, 6 million device pixels): at 60 Hz that is the cost to watch. Measure frame time before and after; the harness does not.
* **The homepage and friends modes must stay pixel-identical** (`perffix/hero-det.js`, the deterministic hash): do every change behind `this.W` (library mode) only.
* **Wire**: remote walkers walk the iPad's deterministic path at 70 art px/s (`LIVE_SPEED`, `walk()`); positions and timing on the wire do not change if only the presentation (frame clock, placement, camera) changes. Changing speed does (G5).

## The gaps, ranked

Every gap lists the **function or constant**, the **target**, and a **PASS** criterion that `tools/movement/measure.mjs` already scores (metric names in `target.json`).

### G1. Presentation rate and placement (largest)

* Now: loop gate 31 ms (30 Hz) in `start()` (line 1182); sprites at `Math.round(p.x) - 8`, `Math.round(p.y) - 31` (`spriteX`/`spriteY`, lines 996 to 1000) in art pixels; scene composed at art resolution then blitted.
* Change (library mode only): step and draw on every `requestAnimationFrame` while anything in view moves; place walkers at device-pixel precision with the integer-scale draw above (the item pool already holds `x`, `y` per item: keep floats there and round in `drawItem` only after multiplying by `k`); `follow()` must round with the same grid so camera and sprite move in lockstep (it already rounds the camera to `1/k`).
* Not needed: easing, motion blur, interpolation of the pose.
* **PASS**: `display_update_hz` at least 50 (target 60); `pos_quantum_css` at most 1.5 at 1x (at 2x, one device pixel is 0.5 css px: still pass); `step_css` at most 6. Selftest in the harness shows the reference-like series passes all three.

### G2. Walk cycle clock

* Now: `frame()` (line 1009): `R.walk + d * 6 + (Math.floor(tick / 2) + p.phase) % 6` with `tick = floor(t * 10)`, a global 5 Hz clock with a random per-person phase; the first step after standing starts wherever the global clock is.
* Change: a per-person walk clock that advances only while walking. Time-based `p.stride += dt; frame = floor(p.stride * 12) % 6`, or distance-based (the reference cannot tell them apart): `p.stride += moved / STRIDE_PX; frame = floor(p.stride) % 6`, `STRIDE_PX = 0.19 * spriteRows` (about 4.8 art px for a 25-row person). Reset to 0 when the walk starts so the first pose is the same each time. Applies to the keys, to click-walk and to remote walkers (all go through `walk()`/`keyStep()`; give them one helper). Idle, sit, read, phone keep the 10 Hz clock.
* Value: **12 Hz** (83 ms a pose). At 70 art px/s that is 0.23 H per pose; the distance-based form gives 14.7 Hz and 0.19 H. Either passes.
* Needs G1's 60 Hz presentation, or the slots alternate 67/100 ms.
* **PASS**: `pose_rate_hz` 11 to 15 (target 11.9); `pose_dist_hs` 0.12 to 0.25 (target 0.19); `cycle_ms` 450 to 800; `distinct_poses` 6; `npc_pose_rate_hz` 11 to 15 and `zoo_pose_rate_min`/`max` in the same band for all nine animals (`--zoo`).

### G3. Camera follow

* Now: `follow()` (line 1158): `this.camX += (tx - this.camX) * .12` per rendered step (about 0.26 s time constant at 30 Hz); target `cy = y + 18 - viewH * .2` (feet 25% of the view below the centre).
* Change: while the player walks (`you.moving` or `you.path.length`), **lock**: `camX = tx`, `camY = ty` every frame (clamped as now), computed from the *drawn* player position. Keep the ease for `lookAt()`, sitting, standing, entry and resizes (a lock there would jump). Frame rate independent: use `1 - exp(-dt / tau)` with `tau` about 0.12 s for those cases.
* Open decision (founder): the vertical lock point. The reference centres the player (feet 0.7% below centre). Ours lifts the view by 20% so the entrance at the bottom shows the library opening above; that is a product choice, reported as info (`lock_off_y_pct`), not a movement-feel failure. If it is kept, nothing else changes.
* **PASS**: `cam_lag_steady_css` at most 3 (1 art px at k = 3), `cam_settle_ms` at most 100, `lock_off_x_pct` within 3.

### G4. Ground shadow

* Now: none in the sheet art (no semi-transparent pixels) and none drawn (`ground_shadow_px` 0).
* Change: draw an ellipse under every standing or walking person in `draw()`, in the depth sort just below the person (z minus .02, so tables and chairs still cover it), skipping seated people. Size from the sprite: **0.475 H wide, 0.15 H tall** (12 x 4 art px for a 25-row person; animals scale with their rows), centre about 1 art px above the lowest sprite row (the reference: 2.3 art px on 40 rows). Colour: a dark purple at about 50% over the floor (reference rgb 121,66,117 over a 170,90,80 floor); a stepped pixel ellipse, no antialiasing. Constant in every pose.
* **PASS**: `ground_shadow_w_hs` 0.35 to 0.6 (the probe renders the scene with and without the person and measures the darkened patch outside the sprite).

### G5. Walk speed per body height (decision, not a defect)

* Ours 2.80 H/s, reference 2.24 H/s: 25% faster for the body. In css px a second the two are the same on a laptop (280 and 269). `LIVE_SPEED = 70` is the iPad's speed (140 points a second over two), shared with every remote walker.
* Recommendation: **leave it**; fix G1 to G3 first and re-judge by eye. If you change it, change the wire's speed assumption in the same commit (`LIVE_SPEED`, the `ahead` call in `cafeScene.ts`, and the "Walking" section of `library.md`, which says everyone walks the same deterministic walk at 70 art px/s).
* **PASS** (info): `speed_hs_axis` 2.0 to 2.5.

### G6. Idle breathing

* Ours cycles six idle frames every 0.6 s (`R.idle + d * 6 + (tick / 6 + phase) % 6`); the reference stands perfectly still for the 1.25 s it shows. Whether it animates later is unknown.
* Recommendation: leave until an idle clip exists (see "what the clip cannot tell us"). If a still idle is wanted, use idle frame 0 for people in the room's free floor and keep the animation for seated poses.
* **PASS** (info): `idle_changes_1250ms` 0.

### G7. Already at parity, keep (regression guards)

`speed_hs_spread`, `speed_diag_ratio`, `start_delay_ms`, `stop_excess_ms`, `stop_settle_ms`, `diag_keeps_face`, `turn_latency_ms`, `wall_turns_and_stays`, `click_speed_ratio`, `head_bob_rows`: these pass today and must keep passing. Easing on start, stop or turns would **fail** the first four.

## Combined acceptance

`node tools/movement/measure.mjs` prints `PASS: 0 scored metric(s) outside tolerance` for the person, for `--me fox` and for `--zoo`, and `tools/movement/measure.mjs --selftest` passes. Before the commit also: the hero deterministic hash (`perffix/hero-det.js`, four viewport modes) identical; frame time in the library not worse than now at 60 Hz on a mid laptop (not measured by the harness).

## Current harness result (person, 1512 x 949 at 1x)

10 scored failures: `display_update_hz`, `pos_quantum_css`, `step_css`, `pose_rate_hz`, `pose_dist_hs`, `cycle_ms`, `ground_shadow_w_hs`, `cam_lag_steady_css`, `cam_settle_ms`, `npc_pose_rate_hz`. That list is the work.
