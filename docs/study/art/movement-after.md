# Movement: before and after

The changes G1 to G4 of `movement-gap.md`, scored by `tools/movement/measure.mjs` (1512 x 949, art scale k = 4, 60 Hz virtual
display, deterministic). Raw harness output: `movement-after/before-person.json`, `after-person.json`, `before-zoo.json`,
`after-zoo.json`. Columns: the target, our engine before (person, 1x), after (person, 1x), after at 2x (k = 8), after as the fox,
after with `--zoo` (all nine animals walk an open run). "info" rows are printed and never fail.

Scored failures: **10 before, 0 after** in all four runs (person, `--dpr 2`, `--me fox`, `--zoo`). The 12 consecutive display frames at
60 Hz of the player walking right are `movement-after/strip-12-frames-60hz.png`: the player stays put in the window, the floor
slides by 3.5 to 4.7 css px a frame, the pose changes every fifth frame (12 Hz), every art pixel is a 3 px square.

| metric | target | before | after | after 2x | after fox | after zoo |
|---|---|---|---|---|---|---|
| speed_hs_axis | 2.24 ±0.269 H/s | 2.803 (info) | 2.8 (info) | 2.8 (info) | 2.8 (info) | 2.8 (info) |
| speed_hs_spread | ..1.08 ratio | 1.001 (PASS) | 1 (PASS) | 1 (PASS) | 1 (PASS) | 1 (PASS) |
| speed_diag_ratio | 0.94 ±0.1 ratio | 0.999 (PASS) | 1 (PASS) | 1 (PASS) | 1 (PASS) | 1 (PASS) |
| start_delay_ms | -40..50 ms | 10 (PASS) | -1 (PASS) | -1 (PASS) | -1 (PASS) | -1 (PASS) |
| stop_excess_ms | -40..40 ms | 5 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) |
| stop_settle_ms | ..50 ms | 0 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) |
| display_update_hz | 50.. Hz | 30.3 (FAIL) | 60 (PASS) | 60 (PASS) | 60 (PASS) | 60 (PASS) |
| pos_quantum_css | ..1.5 css px | 4 (FAIL) | 1 (PASS) | 0.5 (PASS) | 1 (PASS) | 1 (PASS) |
| step_css | ..6 css px | 9.33 (FAIL) | 4.67 (PASS) | 4.67 (PASS) | 4.67 (PASS) | 4.67 (PASS) |
| pose_rate_hz | 11..15 Hz | 5 (FAIL) | 12 (PASS) | 12 (PASS) | 12 (PASS) | 12 (PASS) |
| pose_dist_hs | 0.187 ±0.065 H | 0.561 (FAIL) | 0.233 (PASS) | 0.233 (PASS) | 0.233 (PASS) | 0.233 (PASS) |
| cycle_ms | 450..800 ms | 1200 (FAIL) | 500 (PASS) | 500 (PASS) | 500 (PASS) | 500 (PASS) |
| distinct_poses | 6.. poses | 6 (PASS) | 6 (PASS) | 6 (PASS) | 6 (PASS) | 6 (PASS) |
| head_bob_rows | 1..2 art px | 1 (PASS) | 1 (PASS) | 1 (PASS) | 2 (PASS) | 1 (PASS) |
| ground_shadow_w_hs | 0.35..0.6 H | 0 (FAIL) | 0.44 (PASS) | 0.44 (PASS) | 0.36 (PASS) | 0.44 (PASS) |
| idle_changes_1250ms | ..0 changes | 2 (info) | 0 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) |
| cam_lag_steady_css | ..3 css px | 69 (FAIL) | 0 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) |
| cam_settle_ms | ..100 ms | 733 (FAIL) | 0 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) |
| lock_off_x_pct | -3..3 % width | 0 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) |
| lock_off_y_pct | -3..8 % height | 25.4 (info) | 25.4 (info) | 25.5 (info) | 25.4 (info) | 25.4 (info) |
| diag_keeps_face | 1..1 bool | 1 (PASS) | 1 (PASS) | 1 (PASS) | 1 (PASS) | 1 (PASS) |
| turn_latency_ms | ..40 ms | 33 (PASS) | 17 (PASS) | 17 (PASS) | 17 (PASS) | 17 (PASS) |
| wall_turns_and_stays | 1..1 bool | 1 (PASS) | 1 (PASS) | 1 (PASS) | 1 (PASS) | 1 (PASS) |
| click_speed_ratio | 1 ±0.1 ratio | 1.01 (PASS) | 1.003 (PASS) | 1 (PASS) | 1.003 (PASS) | 1.003 (PASS) |
| npc_speed_ratio | 1 ±0.1 ratio | 1.04 (PASS) | 1.042 (PASS) | 1.042 (PASS) | 1.042 (PASS) | - (n/a) |
| npc_pose_rate_hz | 11..15 Hz | 5 (FAIL) | 12 (PASS) | 12 (PASS) | 12 (PASS) | - (n/a) |
| zoo_pose_rate_min | 11.. Hz | - (n/a) | - (n/a) | - (n/a) | - (n/a) | 12 (PASS) |
| zoo_pose_rate_max | ..15 Hz | - (n/a) | - (n/a) | - (n/a) | - (n/a) | 12 (PASS) |
| zoo_speed_hs_max | ..2.9 H/s | - (n/a) | - (n/a) | - (n/a) | - (n/a) | 3.044 (info) |
| sprite_vh_pct | 9..15 % height | 10.5 (PASS) | 10.5 (PASS) | 10.5 (PASS) | 10.5 (PASS) | 10.5 (PASS) |

Animals before: all nine at 5 poses a second (`zoo_pose_rate_min` 5, FAIL). After: all nine at 12, 6 distinct poses each.
Animals walk at 2.7 to 3.0 sprite heights a second because they are 23 to 26 rows tall and the walk speed is the iPad's 70 art px/s
(info, not a defect: see G5 in `movement-gap.md`).

## What was measured by the harness, and what it cannot see

* Placement quantum 1 css px at 1x (1/4 art pixel) and 0.5 css px at 2x: the reference's was 1 css px (1/3 art pixel).
* Step per display frame 4.67 css px (reference 4.5).
* The camera never trails (0 css px) and stops the frame you do (0 ms).
* `idle_changes_1250ms` 0: a person who has stopped holds one standing pose for 2 s, then the idle frames run. Seated and read/phone poses are untouched.
* The harness runs on a virtual clock, so it says nothing about the real cost of 60 Hz; see `library.md` ("Movement feel") for the frame
  times, the governor and the limits (an iPad has not been measured).
* Changed in the harness for this work (`inpage.mjs`, `measure.mjs`): `shadow()` reads the screen canvas when the engine composes at
  device resolution (it used the art sized `scene`), `camTarget()` rounds like the engine, and the governor is pinned to 60 Hz after the
  virtual clock is frozen (real boot frames can be late on a slow machine; the governor would then, correctly, present at 30 Hz and the
  run would measure that).
