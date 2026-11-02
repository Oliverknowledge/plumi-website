import type { Bitmap } from "./png";
import { FRAMES, POSE, grade } from "./sheet";

/**
 * The fox: an animal the room draws instead of a layered person. Its art is one strip of 24 walk frames
 * (public/library/characters/fox.png, written by tools/art/fox_sheet.py from the founder's ChatGPT sheet: documented in
 * fox.json and docs/study/art/), each 24 x 32 (the people are 16 x 32), the feet on the bottom row, the centre of mass on
 * the centre column:
 *
 *     strip frame = direction * 6 + step     direction: 0 down (front), 1 left, 2 up (back), 3 right     step: 0 to 5
 *
 * and this file lays them out as the engine's 78 frames, the same order a person's row has (sheet.ts `POSE`), each
 * `ART_W` wide, so the engine reads a fox exactly as it reads a person but with a frame width of 24 (`DrawnPerson.frame`):
 *
 *     idle  0-23   right, back, left, front, 6 each     (the art has no idle: see `idleFrames`)
 *     walk 24-47   the same order                       (the strip's own frames, used directly)
 *     sit  48-59   right 6, left 6                      (derived from idle: see `sitFrames`)
 *     phone 60-65, read 66-71                           (the sit pose facing the camera; there is no book or phone)
 *     stool 72-77                                       (the back view, lowered and cut to rows 0 to 19, as a person's)
 *
 * Nothing is drawn by hand: the idle and the seated poses are the walk art moved and cropped, which is honest about
 * what they are (see docs/study/library.md, "Characters").
 */

/** The art's frame (what the strip holds). */
export const ART_W = 24;
export const FOX_H = 32;
/** A frame of the row: the art with PAD empty columns each side, so a seated fox can sit back in its chair (away from the desk it faces) without losing its tail. */
export const PAD = 5;
export const FOX_W = ART_W + 2 * PAD;
export const FOX_ROW_W = FRAMES * FOX_W;
export const FOX_URL = "/library/characters/fox.png";
/** The strip's directions, as the sheet draws them. */
export const STRIP_DIRS = ["down", "left", "up", "right"] as const;
/** The engine's direction order inside a block of six (`DIRS` in cafeScene.ts: right, back, left, front), as strip directions. */
const ENGINE_FROM_STRIP = [3, 2, 1, 0] as const;
/** The strip frame count and the walk frames per direction. */
export const STRIP_FRAMES = 24;
const STEPS = 6;

/** How far a seated fox is lowered (in art pixels) and where the animal's legs are cut: the desk and the chair hide them as they hide a person's. */
export const SIT_DROP = 1;
/** How far a seated fox sits back from the desk it faces, in art pixels (the room's desks cover the face of anything that sits against them). */
export const SIT_BACK = 5;
/** The row at which the lower body starts (above it the upper body bobs; the feet stay on the ground). */
const SEAM = 27;
/** The seated fox's seam (the head and chest breathe above it). */
const SIT_SEAM = 24;

const BYTES = ART_W * FOX_H * 4;

export type Frame = Uint8Array;

/** One frame of the strip, copied out. */
export function stripFrame(strip: Bitmap, direction: number, step: number): Frame {
  const f = new Uint8Array(BYTES);
  const x0 = (direction * STEPS + step) * ART_W;
  for (let y = 0; y < FOX_H; y++) f.set(strip.rgba.subarray((y * strip.width + x0) * 4, (y * strip.width + x0 + ART_W) * 4), y * ART_W * 4);
  return f;
}

const on = (f: Frame, x: number, y: number) => x >= 0 && y >= 0 && x < ART_W && y < FOX_H && f[(y * ART_W + x) * 4 + 3] > 0;

/** The extent of the opaque pixels in a row range: [min x, max x] or null. */
function span(f: Frame, y0: number, y1: number): [number, number] | null {
  let lo = ART_W, hi = -1;
  for (let y = y0; y < y1; y++) for (let x = 0; x < ART_W; x++) if (on(f, x, y)) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return hi < 0 ? null : [lo, hi];
}

/** The frame of a direction whose feet are together: the narrowest bottom eight rows (the passing pose of the walk). The first wins a tie. */
export function standingStep(frames: readonly Frame[]): number {
  let best = 0, bw = Infinity;
  frames.forEach((f, i) => {
    const s = span(f, FOX_H - 8, FOX_H);
    const w = s ? s[1] - s[0] : Infinity;
    if (w < bw) { bw = w; best = i; }
  });
  return best;
}

/** The sweater's pixels (a maroon: green low, red above it): the torso, whose centre is where the feet are. */
const sweater = (f: Frame, i: number) => f[i + 3] > 0 && f[i + 1] < 100 && f[i] > f[i + 1] + 40 && f[i] < 200;

/** The torso's centre column (the mean of the sweater's columns), or the frame's middle if there is none. */
export function torsoX(f: Frame): number {
  let sum = 0, n = 0;
  for (let y = 0; y < FOX_H; y++) for (let x = 0; x < ART_W; x++) if (sweater(f, (y * ART_W + x) * 4)) { sum += x; n++; }
  return n ? sum / n : ART_W / 2;
}

/** A copy with the rows above `seam` moved up by `up` (0 or 1) and the row at the seam repeated, so the body breathes while the feet stay. */
export function breathe(f: Frame, up: number, seam: number): Frame {
  if (!up) return new Uint8Array(f);
  const out = new Uint8Array(BYTES);
  for (let y = 0; y < FOX_H; y++) {
    const from = y < seam ? y + up : y;
    if (from < FOX_H) out.set(f.subarray(from * ART_W * 4, (from + 1) * ART_W * 4), y * ART_W * 4);
  }
  return out;
}

/** A copy with the columns from `x0` to `x1` (inclusive) moved by `dy` rows (positive is down); what is uncovered is clear. The tail's swish. */
export function shiftColumns(f: Frame, x0: number, x1: number, dy: number): Frame {
  if (!dy) return new Uint8Array(f);
  const out = new Uint8Array(f);
  for (let x = Math.max(0, x0); x <= Math.min(ART_W - 1, x1); x++) {
    for (let y = 0; y < FOX_H; y++) out.fill(0, (y * ART_W + x) * 4, (y * ART_W + x) * 4 + 4);
    for (let y = 0; y < FOX_H; y++) {
      const to = y + dy;
      if (to >= 0 && to < FOX_H) out.set(f.subarray((y * ART_W + x) * 4, (y * ART_W + x) * 4 + 4), (to * ART_W + x) * 4);
    }
  }
  return out;
}

/**
 * A gentle six-frame idle from one standing frame: the body rises a pixel and settles (the upper rows move up, the
 * feet stay), and the tail swishes a pixel the other way, out of step with the breath. The tail is the part of the
 * fox beyond the torso on the side away from its face: to the right when it faces left or the camera, to the left when
 * it faces right; from behind it is in the middle of the body and does not move.
 */
export function idleFrames(stand: Frame, direction: number): Frame[] {
  const BOB = [0, 0, 1, 1, 0, 0], SWISH = [0, 1, 1, 0, -1, -1];
  const cx = torsoX(stand);
  const frames: Frame[] = [];
  for (let i = 0; i < STEPS; i++) {
    let f = breathe(stand, BOB[i], SEAM);
    if (direction === 1 || direction === 0) f = shiftColumns(f, Math.round(cx + (direction === 1 ? 5 : 6)), ART_W - 1, SWISH[i]);
    else if (direction === 3) f = shiftColumns(f, 0, Math.round(cx - 5), SWISH[i]);
    frames.push(f);
  }
  return frames;
}

/** A frame moved down by `drop` rows: whatever falls off the bottom is the legs and feet, which the desk and chair cover. */
export function lowered(f: Frame, drop: number): Frame {
  const out = new Uint8Array(BYTES);
  for (let y = drop; y < FOX_H; y++) out.set(f.subarray((y - drop) * ART_W * 4, (y - drop + 1) * ART_W * 4), y * ART_W * 4);
  return out;
}

/** Six seated frames from a standing one: lowered (the legs fall away), the chest breathing slowly; the tail stays still. */
export function sitFrames(stand: Frame): Frame[] {
  const seat = lowered(stand, SIT_DROP);
  const BOB = [0, 0, 0, 1, 1, 0];
  return BOB.map((b) => breathe(seat, b, SIT_SEAM));
}

/** The fox's head, in the front idle frame: where a friends list or a card may crop it from. */
export interface Box { x: number; y: number; w: number; h: number }
export function headBox(front: Frame): Box {
  let top = -1, neck = FOX_H;
  for (let y = 0; y < FOX_H && neck === FOX_H; y++) {
    for (let x = 0; x < ART_W; x++) {
      if (on(front, x, y) && top < 0) top = y;
      if (sweater(front, (y * ART_W + x) * 4)) { neck = y; break; }
    }
  }
  if (top < 0) return { x: 0, y: 0, w: ART_W, h: FOX_H };
  const s = span(front, top, neck) ?? [0, ART_W - 1];
  return { x: s[0], y: top, w: s[1] - s[0] + 1, h: neck - top };
}

/** The strip decoded from fox.png, read for what it is: 24 frames of 24 x 32. Null when it is not that. */
export function validStrip(strip: Bitmap): boolean {
  return strip.width === STRIP_FRAMES * ART_W && strip.height === FOX_H && strip.rgba.length === strip.width * strip.height * 4;
}

export interface FoxRow {
  /** The 78 frames, `FOX_ROW_W` x `FOX_H` RGBA, in the engine's order. */
  rgba: Uint8ClampedArray;
  /** The standing frame (strip step) chosen per strip direction. */
  stand: number[];
  /** Where the head is in the front idle frame (frame `POSE.idle + 18`). */
  head: Box;
}

/** The fox's 78 frames. Null if the strip is not the one expected. */
export function composeFox(strip: Bitmap, opts: { graded?: boolean } = {}): FoxRow | null {
  if (!validStrip(strip)) return null;
  const walk: Frame[][] = STRIP_DIRS.map((_, d) => Array.from({ length: STEPS }, (_, s) => stripFrame(strip, d, s)));
  const stand = walk.map((w) => standingStep(w));
  const idle = walk.map((w, d) => idleFrames(w[stand[d]], d));
  const sit = walk.map((w, d) => sitFrames(w[stand[d]]));
  const out = new Uint8ClampedArray(FOX_ROW_W * FOX_H * 4);
  /** Frame `index` of the row: the art in the middle of its frame, moved `dx` columns (a seated fox sits back from its desk). */
  const put = (index: number, f: Frame, dx = 0) => {
    const g = new Uint8Array(f);
    if (opts.graded !== false) grade(g);
    for (let y = 0; y < FOX_H; y++) {
      for (let x = 0; x < ART_W; x++) {
        const to = x + PAD + dx;
        if (to >= 0 && to < FOX_W) out.set(g.subarray((y * ART_W + x) * 4, (y * ART_W + x + 1) * 4), (y * FOX_ROW_W + index * FOX_W + to) * 4);
      }
    }
  };
  let n: number = POSE.idle;
  for (const d of ENGINE_FROM_STRIP) for (let i = 0; i < STEPS; i++) put(n++, idle[d][i]);
  n = POSE.walk;
  for (const d of ENGINE_FROM_STRIP) for (let i = 0; i < STEPS; i++) put(n++, walk[d][i]);
  n = POSE.sit;
  for (const d of [3, 1]) for (let i = 0; i < STEPS; i++) put(n++, sit[d][i], d === 3 ? -SIT_BACK : SIT_BACK);   // right, then left: away from the desk
  for (const pose of [POSE.phone, POSE.read]) { n = pose; for (let i = 0; i < STEPS; i++) put(n++, sit[0][i]); }
  n = POSE.stool;
  for (let i = 0; i < STEPS; i++) {
    const back = lowered(idle[2][i], SIT_DROP);
    const f = new Uint8Array(BYTES);
    f.set(back.subarray(4 * ART_W * 4, 24 * ART_W * 4));                              // rows 4 to 23 become rows 0 to 19, as a person's stool frames
    put(n++, f);
  }
  const head = headBox(idle[0][0]);
  return { rgba: out, stand, head: { ...head, x: head.x + PAD } };
}
