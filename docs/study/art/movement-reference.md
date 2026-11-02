# Movement reference: what the clip measures

Movement dynamics only. Nothing here copies the reference game's art, characters or UI; the numbers describe how a sprite
moves, and the frames in `movement-ref/` are small crops kept as evidence for those numbers (see "Evidence frames").
The ranked list of what to change is `movement-gap.md`; the checks that score a build are `tools/movement/` (target values
in `tools/movement/target.json`, which cites the frame ranges below).

## The clip and how it was measured

| | |
|---|---|
| File | a screen recording, 3024 x 1898 (a retina Mac, so a 1512 x 949 css viewport), H.264, 740 frames in 12.86 s |
| Frame rate | variable; effectively **60 Hz** (676 frame gaps of 16.7 ms, 63 of 25 ms: the recorder dropped a frame, the game did not stutter) |
| What happens | one rabbit in a hoodie walks around a library room for 11.6 s on the keyboard, then stands. Seated rabbits at two long tables, a few seated at the edges. HUD on the top left and right. From about 12 s a browser toolbar slides in (the window left full screen); the player is standing |
| Who is the player | the walking rabbit. The camera is locked to it (section 5), the mouse cursor never moves (so it is keyboard), a chair it walks into gets an "E" key cap (the same sit prompt as ours) |
| NPCs | **no NPC walks in the clip.** Every other rabbit is seated; two do an idle gesture (a stretch, an arm raise). NPC wandering cannot be measured from this clip |

Method (all in `tools/movement/ref_analysis.py`, which prints the headline numbers from the video):

1. Every frame decoded and scaled to the 1512 px css viewport (INTER_AREA). Presentation times from ffprobe (the clip is variable frame rate; all speeds use real frame times).
2. **Camera**: `cv2.phaseCorrelate` (Hanning window) between consecutive frames over the floor region, accumulated; sub-pixel.
3. **Background**: every 6th frame warped into world coordinates (screen minus camera), per-pixel median over time. The walker disappears, the static room stays.
4. **Walker**: per frame, warp to world, subtract the background, keep the walker's head colour; the head blob (size and continuity filtered) gives the position. The purple ground shadow is segmented the same way.
5. **Speed**: displacement over real frame times; held keys found by direction; a linear fit per run. Start and stop read frame by frame.
6. **Pose slots**: sprite patches in world coordinates compared with a +-6 px shift search; a jump in the minimum difference marks a pose change.
7. **Pixel size** (calibration): gradient energy of the walker's edges folded at candidate periods peaks at **6.0 native px = 3.0 css px = 1 art pixel** (the recording's native frame; also checked by the edges sitting at device offsets 1, 3, 5 mod 6).

Units below: **css px** are the 1512-wide viewport, **art px** are the sprite pixels (3 css px each), **H** is the player's height.

## What the sprite is

| | |
|---|---|
| Scale | 1 art px = 3 css px. The 1512 x 949 window shows **504 x 316 art px**. |
| Height | **40 art px** (120 css px) from ear tips to feet, front and back views; side view the same. Width 18 to 19 art px (front), 21 (side). 12.6% of the window height. |
| Directions | **4 faces**: front, back, left, right (right looks like the left mirrored: the eye and hood swap sides). Movement is 8-way (diagonals exist), the face stays 4-way. |
| Walk | **6 drawn poses**, a cycle of 9 slots in the front view (section 2). |
| Idle | one still pose per face: legs together, hands in the hoodie. **Not a pixel changes in 1.25 s** of standing (idx 668-739). |
| Shadow | a purple ellipse (about rgb 121,66,117 over the floor, so roughly 50% opacity) **19 x 6 art px (57 x 18 css px) = 0.475 H wide, 0.15 H tall**, under the feet in every pose, **also when standing**, never changing size with the step. Its centre is 2.3 art px above the lowest sprite row, so it just peeks below the feet. See `08-bob-shadow.png`. |

## 1. Speed, start, stop (`01-speed-vs-time.png`, `03-stop-start.png`)

| | Measured | Frames |
|---|---|---|
| **Steady speed** | **269 css px/s = 89.7 art px/s = 2.24 H/s** (median of 15 runs, scatter 255 to 287, the high one a vertical run with head-bob noise) | idx 7-664 |
| Left / right / up / down | 255-271 / 270-272 / 270-287 / 262-267 css px/s. **Same speed in all four directions** (max/min 1.04). No vertical foreshortening | runs listed in `tools/movement/target.json` |
| Constant or eased? | **Constant.** One value per run, no ramp | |
| Acceleration | none visible: from standing to full speed in **2 frames at most (33 ms)**: -1.6, -3, -5 px (idx 29-32) and -2.9, -5.0 (idx 55-57). One frame is 4.5 px at full speed | idx 29-32, 55-58, 7-9 |
| Deceleration | **none**: -5.1, -3.1, 0 px (idx 49-52), -4, -3, 0 (idx 664-666). The last partial step is a frame cut short by the key release. **No overshoot, no settle, no coast.** The pose goes to the still pose on the same frame (idx 664 to 665) | |
| Frame rate of motion | the sprite moves on **every one of the 60 frames** (1 css px granularity: steps of 4, 5, 4, 5 px = 4.5 average) | idx 32-51 |
| Placement | **whole css pixels, not whole art pixels**: edge positions mod 6 device px take the values 1, 3, 5. The art pixel stays exactly 3 css px wide; only its offset moves, by 1/3 art px | native frames 32-51 |
| Diagonal | 3 px per axis per frame = **254 css px/s = 0.94 of straight**. So normalised (a raw sum of both axes would be 1.41x). Only 5 frames of evidence (idx 66-70) | |
| Short taps | keys are tapped many times (the stair steps at t = 0.4, 0.9, 5.2...). The shortest full stop-start gap is 4 frames (idx 52-55) | |

## 2. Step cadence (`02-walk-cycle-front.png`, `08-bob-shadow.png`)

| | Measured |
|---|---|
| **Pose rate** | one pose change every **84.0 ms (11.9 Hz)** (13 slots measured, 75 to 92 ms, which is 5 recorded frames each (84.0 ms mean; `ref_analysis.py` reproduces 11.91 Hz); two slots are 4 frames because the recorder dropped one). A fixed-rate animation clock at 12 Hz, not tied to anything else that was visible |
| Poses and cycle | front view: **6 distinct poses, 9 slots**, repeating `B A C D E F E D A` (0.75 s). Two full cycles are in the clip (idx 95-183 contains B at 95 and 139). The back view shows 5-frame slots too; the side-view sequence could not be separated reliably (side poses differ by little) |
| **Distance per pose** | 269 css px/s x 84.0 ms = **22.6 css px = 7.5 art px = 0.19 H per pose**; **67 art px = 1.7 H per cycle**. For comparison a real walking human is about 0.8 H a stride pair: **the reference skates too** (about 2x). Its feel does not come from foot-locking |
| How phase ties to distance | **it does not**. It is a time clock: slots stay 5 frames at 60 Hz when the player was moving in all four directions and after taps. (If it were distance-locked the slots would be identical anyway at constant speed; the clip cannot tell the two apart, see "not determined") |
| Idle pose | the still pose, one per face; **the walk stops on the same frame as the sprite changes to it**; no step is finished |
| Start pose | not determined: the first walking frame after two different stops (idx 31 and 56) differ by 5.9 where adjacent walking frames differ by 4.0 and unlike poses by up to 7, so they may or may not be the same pose |
| Head bob | **1 art px (3 css px)**: the head is 1 art px higher in poses C and D than in A and E (head top minus the ground shadow: -120.5, -123.5, -123.5, -120.5 css px). No squash, no stretch, no body lean |
| Shadow while stepping | constant ellipse; its pixel count varies only where the lifted foot covers it |

## 3. Direction handling (`04-turn-diagonal.png`, `06-blocked-turn-prompt.png`)

* **Keyboard, 8-way movement, 4-way face.** No click-to-walk in the clip (cursor stationary the whole time, no path with a corner that a keyboard could not make).
* Paths in the clip are axis-aligned runs with 90-degree corners; one short diagonal (idx 62-70, 0.15 s) while two keys overlapped.
* **A turn is instant and unsmoothed.** The face changes on the frame the key set changes. Moving left, pressing down: during the diagonal the **face stays left** (idx 62-70), and the front face appears on the very frame the left motion ends (idx 71). The path has no smoothing and no curve.
* **A blocked key still turns the sprite**: walking left past a chair, the player turned to the front face and stopped, 8 frames (idx 21-29), with the chair darkened and an "E" key cap over it, then walked on left (idx 30).
* Sliding along obstacles: not seen. Collision with the chair is a stop.

## 4. Body motion extras

* No footstep dust, no ripples, no particles, no head turns, no emotes during the clip.
* One interaction cue: a key cap "E" and a darkened chair when facing a chair (idx 21-29 and about idx 535). No pause or ceremony when arriving.

## 5. Camera (`05-camera-follow.png`)

* **Locked to the player, no lag.** While the camera scrolled (167 frames) the player's screen x was **756.7 css px, sigma 0.7** (the window centre is 756). The camera moved on the same frame as the player began (idx 225, 293, 328, 346, 364, 379: within one frame) and stopped on the frame the player stopped (idx 243, 312, 341, 357, 374, 391). Its velocity equals the player's, step for step.
* **No easing** and no ramp apart from the player's own.
* **Hard edge clamp.** The room is only just bigger than the window: the camera range in the whole clip is **x 0 to -122.8 css px, y 0 to -60.5 css px** (41 x 20 art px more than the window). At an edge the player walks free of the centre; leaving the edge the camera engages at once at the centre.
* Vertical lock point: while the camera scrolled in y the head sat at 399 css px (sigma 4.5), the ground point about 481 of 949: 0.7% below the centre.
* Camera positions are whole css pixels (integer frame deltas), the same grid as the sprite. **No zoom** (the art stays 3 css px per art px throughout).

## 6. NPC behaviour

Not measurable from this clip (no NPC walks). What is visible (`07-npc-seated-idle.png`): seated rabbits hold still and do **occasional idle gestures** about a second long (a leg stretch at 1.7 to 3.3 s at the right table; an arm raise at about 5.9 to 7.1 s at the left table), then return to the held pose.

## What makes it feel good (plain language)

1. **Instant**: the body is at full speed on the frame the key goes down and stops on the frame it comes up. No sluggish ramp, no skid, nothing to wait for.
2. **Every frame moves**: 60 distinct positions a second, at 1/3 art-pixel steps, so the sprite glides while every art pixel stays square and sharp.
3. **Quick feet**: the legs change twelve times a second, a pose every 7.5 art px of travel. Even though the feet slide, the eye reads busy, light steps rather than a sprite being dragged. (Ours changes pose five times a second.)
4. **The world moves with you**: the camera is rigid on the player, so the player never wobbles against the room; the sprite, shadow and camera share one grid and one clock.
5. **A shadow that grounds him**: the ellipse is the same in every pose, so the figure never floats.
6. **Honest turns**: the face follows the key, even into a wall; no smoothing of the path.
7. What it does **not** do: no easing curves, no squash and stretch, no foot lock, no dust, no idle breathing. Do not add those to chase the feel.

## What the clip cannot tell us (and the clip that would)

| Unknown | Why | Clip that settles it |
|---|---|---|
| Whether the pose clock is time-based or distance-based, and whether it resets at the start of a walk | constant speed makes both look the same; start poses too similar to compare | walk, then **tap for 50, 100, 150 ms** many times; a time clock shows slots of 83 ms regardless, a distance clock shows pose changes per px |
| NPC wandering: idle time, pause length, where they go, how they sit | no NPC walks here | **60 s of nothing but watching**, with no input, in a room with a few standing people |
| Click or tap to walk, pathfinding, sliding around obstacles | keyboard only | click the floor across a table; walk diagonally into a wall corner |
| Diagonal feel from rest | 5 frames of evidence | hold two keys from standing for 2 s, release one |
| Side and back cycles | only the front view was walked far enough | 3 s each direction without a tap |
| Whether idle animates after long standing | 1.25 s of idle only | stand 10 s |
| Frame rate above 60 Hz | the recording is 60 Hz | capture at 120 Hz (a ProMotion screen) |
| Sitting and standing transitions (E) | not done | press E at a chair and E again |

## Evidence frames (`movement-ref/`)

Small crops (each under 110 KB) kept as the evidence behind the numbers. They show the movement of one sprite; they are not an asset and must not be shipped or imitated in art.

| File | What |
|---|---|
| `01-speed-vs-time.png` | reference speed over the whole clip, a zoom on a stop and restart, and ours on the same axes |
| `02-walk-cycle-front.png` | 15 pose slots, A to F, the 9-slot cycle |
| `03-stop-start.png` | frames 48-59: the stop at idx 51-52 and the restart at 56 with per-frame dx |
| `04-turn-diagonal.png` | frames 60-77: left to down through a diagonal |
| `05-camera-follow.png` | camera position and the player's screen position over time |
| `06-blocked-turn-prompt.png` | turn against a chair, the E cap, resume |
| `07-npc-seated-idle.png` | a seated NPC's stretch |
| `08-bob-shadow.png` | the shadow ellipse and the head height in four poses |
| `09-position-staircase.png` | sprite position per display frame: reference against ours |
| `10-ours-walk-frames-person.png`, `-fox.png` | our six walk frames per direction and the idle frame (for the builders; ours, not the reference) |
