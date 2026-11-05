/**
 * The coast after a finger flick, for the writing spaces that scroll the page by hand once a pen has been seen (InkCanvas). A student's iPad sent the
 * page from question 1 to question 6 on one small gesture (4 November 2026). The speed was worked out from when the handler ran, so moves the browser
 * delivered together, a millisecond apart, read as enormous speeds; a finger that had stopped still flung the page at its old speed; and nothing capped it.
 * So here: the speed is read from when the finger really moved, over the last moments of the drag; a finger that has stopped doesn't coast; and the coast
 * is by the clock, not by the frame, so a 120 Hz screen doesn't go twice as far.
 */
export interface FlingSample { y: number; t: number }

const WINDOW = 100;    // ms: the end of the drag that the speed is read from
const STOPPED = 70;    // ms: this long without a move before lifting is a finger that had stopped
const MIN_SPAN = 16;   // ms: moves delivered together are at least a frame's worth of movement
const MAX_SPEED = 4;   // px/ms: the hardest flick travels about a screen
const FADE = 230;      // ms: how fast the coast dies away (the same feel as before, at 60 Hz)
const MAX_STEP = 50;   // ms: a long frame doesn't jump the page
export const FLING_MIN = 0.05;

/** The drag so far, keeping only what the speed can need. */
export function addSample(samples: FlingSample[], y: number, t: number): void {
  samples.push({ y, t });
  while (samples.length > 2 && t - samples[0].t > WINDOW) samples.shift();
}

/** Page pixels a millisecond at the moment of lifting, at time `upT`; positive scrolls down the page. */
export function flingSpeed(samples: readonly FlingSample[], upT: number): number {
  const last = samples[samples.length - 1];
  if (!last || upT - last.t > STOPPED) return 0;
  const recent = samples.filter((s) => last.t - s.t <= WINDOW);
  const first = recent[0];
  if (recent.length < 2) return 0;
  const speed = (first.y - last.y) / Math.max(MIN_SPAN, last.t - first.t);
  return Math.max(-MAX_SPEED, Math.min(MAX_SPEED, speed));
}

/** One frame of the coast: how far to move, and the speed left. */
export function coastStep(speed: number, dt: number): { move: number; speed: number } {
  const step = Math.min(MAX_STEP, Math.max(0, dt));
  const left = speed * Math.exp(-step / FADE);
  return { move: (speed - left) * FADE, speed: left };
}
