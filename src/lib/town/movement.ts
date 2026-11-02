import { POSE_BIAS } from "../studyapp/library/walk";

/**
 * HOW THE TOWN MOVES. Every number that decides how walking feels is here, so a measured target drops in without touching the engine.
 * Sources: the Grand Library's own (cafeScene.ts `LIVE_SPEED`, walk.ts `facing`) and the movement critic's measurement of the reference game
 * (movewt docs/study/art/movement-reference.md, movement-gap.md, tools/movement/target.json, commit a8b5cd4), adopted from the start:
 *   60 Hz presentation; sprites placed at whole DEVICE pixels (the art pixel stays exactly k device px square); a per-walker pose clock of 12 Hz
 *   restarted at each walk; a camera rigidly locked to the walker; a soft purple ground shadow under everyone; idle still for the first moments;
 *   instant start, stop and turns; diagonals at the same speed; a blocked key still turns the sprite.
 * Units: art px, seconds.
 */
export const MOVE = {
  /** Walking speed, art px a second. The library's 70 (the iPad's 140 points; the wire assumes it). The reference is 89.7 on a 40 row sprite = 2.24 H/s; ours is 2.8 H/s: kept for parity. */
  walkSpeed: 70,
  /** px/s^2 to reach walk speed from rest and to stop; Infinity = at once (the reference: no ramp, no coast). */
  accel: Infinity,
  decel: Infinity,
  /** Walk pose changes a second (reference 11.9 Hz). The walk has 6 frames a direction, so a cycle is 500 ms (accepted band 450 to 800). */
  walkPoseHz: 12,
  /** Walk frames in a cycle (people and animals: 6 a direction). */
  walkFrames: 6,
  /** Standing: frame 0 for this long (reference: not one pixel changes), then the 6 idle frames at `idleHz` (the library breathes at 10/6 Hz). */
  idleStillSecs: 3,
  idleHz: 10 / 6,
  /** Seated poses: the library's one frame per 8 ticks of 10 a second. */
  sitHz: 10 / 8,
  /** Camera: locked to the walker while he walks (a gap over `lockGap` art px is still easing in). Eased (1 - exp(-dt / tau)) for pans, sitting and standing. */
  cameraLock: true,
  lockGap: 3,
  cameraTau: 0.12,
  /** Where the camera holds the walker: this fraction of the view height ABOVE the centre is where the feet stand (0 = centred, the reference). */
  cameraLift: 0,
  /** A diagonal keeps its face until the other axis wins by this factor (walk.ts `facing`: 1.35); the reference keeps it too. */
  turnHysteresis: 1.35,
  /** Two keys are a diagonal at the same speed (`heading` normalises; reference ratio 0.94). */
  normaliseDiagonal: true,
  /** Sliding along walls: px a corner may nudge a straight push sideways to find the way on (walk.ts ASSIST). */
  assist: 5,
  /** Walking to a point: within this many px counts as arrived. */
  arrive: 1,
  /** Cap on a frame's step so a slow frame does not tunnel. */
  maxDt: 0.1,
  /** Presentation: 60 Hz, falling back to 30 when the p95 draw time is over `fallbackMs`, and back up when it is under `recoverMs`. */
  fps: 60, fallbackFps: 30, fallbackMs: 8, recoverMs: 5,
  /** Ground shadow (reference: a purple ellipse 0.475 H wide, 0.15 H tall, about 50% over the floor, also standing). H = 25 art px. */
  shadow: { w: 12, h: 4, lift: 1, r: 121, g: 66, b: 117, a: 0.5 },
} as const;

/** The camera's share of the gap to close in `dt` seconds when it eases. */
export function cameraShare(dt: number): number { return 1 - Math.exp(-dt / MOVE.cameraTau); }

/** Speed after `dt` seconds of wanting `target`, from `v`, under the accel / decel limits. */
export function approach(v: number, target: number, dt: number): number {
  const a = target > v ? MOVE.accel : MOVE.decel;
  if (!Number.isFinite(a)) return target;
  const d = a * dt;
  return target > v ? Math.min(target, v + d) : Math.max(target, v - d);
}

/** The walk frame (0 to 5) after `stride` seconds of walking: the clock restarts at 0 whenever a walk starts. */
export const walkFrame = (stride: number): number => Math.floor(stride * MOVE.walkPoseHz + POSE_BIAS) % MOVE.walkFrames;
/** The idle frame after `t` seconds standing: still at first, then the breath. */
export const idleFrame = (t: number): number => (t < MOVE.idleStillSecs ? 0 : Math.floor((t - MOVE.idleStillSecs) * MOVE.idleHz) % 6);
