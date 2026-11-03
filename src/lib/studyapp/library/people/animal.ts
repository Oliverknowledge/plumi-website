import type { Animal } from "./animals";
import type { Bitmap } from "./png";
import { FRAMES, grade } from "./sheet";

/**
 * An animal: a character the room draws instead of a layered person. Its art is one strip of the engine's 78 frames
 * (public/library/characters/<id>.png), already in the order a person's row has (sheet.ts `POSE`), each `ANIMAL_W` = 34 wide (24 of art
 * and 5 empty columns each side, so a seated animal can sit back in its chair without losing its tail), 32 high, the feet on the
 * bottom row:
 *
 *     idle  0-23   right, back, left, front, 6 each     a breath, a tail swish, a blink (front)
 *     walk 24-47   the same order                       a stride, a bob and the tail against it
 *     sit  48-59   right 6, left 6                      head and torso as drawn, tail tucked, near leg folded, a breath and a nod
 *     phone 60-65, read 66-71                           the sit pose facing the camera
 *     stool 72-77                                       the back view, lowered and cut to rows 0 to 19, as a person's
 *
 * so the engine reads an animal exactly as it reads a person but with a frame width of 34 (`DrawnPerson.frame`). The frames are made
 * by tools/art/animal_sheet.py and tools/art/animal_rig.py from ONE clean standing frame per direction of the ChatGPT sheet (the
 * sheet's own six walk frames wander from frame to frame, so they are not played): the motion is the same for every animal and runs
 * at the cadence the people's does (docs/study/library.md, "Characters"). Nothing is drawn by hand. What differs between animals is
 * the `Animal` entry (animals.ts): the colours of its jumper, which is where the neck is, for a head's crop.
 */

/** The art's width in a frame (what the sheet gave), the empty columns each side, the frame's size and the row's. */
export const ART_W = 24;
export const PAD = 5;
export const ANIMAL_H = 32;
export const ANIMAL_W = ART_W + 2 * PAD;
export const ANIMAL_ROW_W = FRAMES * ANIMAL_W;

export type Frame = Uint8Array;

/** The colours of an animal's jumper as the exact packed 0xRRGGBB values the strip holds (the strip is palette art, so a match is equality). */
export type Jumper = ReadonlySet<number>;
export const jumperOf = (hexes: readonly string[]): Jumper => new Set(hexes.map((h) => parseInt(h.slice(1), 16)));
const isJumper = (j: Jumper, f: Frame, i: number) => f[i + 3] > 0 && j.has((f[i] << 16) | (f[i + 1] << 8) | f[i + 2]);

/** One frame of the strip, copied out (frame `index` of the 78). */
export function stripFrame(strip: Bitmap, index: number): Frame {
  const f = new Uint8Array(ANIMAL_W * ANIMAL_H * 4);
  const x0 = index * ANIMAL_W;
  for (let y = 0; y < ANIMAL_H; y++) f.set(strip.rgba.subarray((y * strip.width + x0) * 4, (y * strip.width + x0 + ANIMAL_W) * 4), y * ANIMAL_W * 4);
  return f;
}

const on = (f: Frame, x: number, y: number) => x >= 0 && y >= 0 && x < ANIMAL_W && y < ANIMAL_H && f[(y * ANIMAL_W + x) * 4 + 3] > 0;

/** The torso's centre column in a frame (the mean of the jumper's columns), or the frame's middle if there is none. */
export function torsoX(f: Frame, j: Jumper): number {
  let sum = 0, n = 0;
  for (let y = 0; y < ANIMAL_H; y++) for (let x = 0; x < ANIMAL_W; x++) if (isJumper(j, f, (y * ANIMAL_W + x) * 4)) { sum += x; n++; }
  return n ? sum / n : ANIMAL_W / 2;
}

/** An animal's head, in the front idle frame: where a friends list or a card may crop it from. */
export interface Box { x: number; y: number; w: number; h: number }
export function headBox(front: Frame, j: Jumper): Box {
  let top = -1, neck = ANIMAL_H;
  for (let y = 0; y < ANIMAL_H && neck === ANIMAL_H; y++) {
    for (let x = 0; x < ANIMAL_W; x++) {
      if (on(front, x, y) && top < 0) top = y;
      if (isJumper(j, front, (y * ANIMAL_W + x) * 4)) { neck = y; break; }
    }
  }
  if (top < 0) return { x: 0, y: 0, w: ANIMAL_W, h: ANIMAL_H };
  let lo = ANIMAL_W, hi = -1;
  for (let y = top; y < neck; y++) for (let x = 0; x < ANIMAL_W; x++) if (on(front, x, y)) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return hi < 0 ? { x: PAD, y: top, w: ART_W, h: neck - top } : { x: lo, y: top, w: hi - lo + 1, h: neck - top };
}

/** The strip decoded from <id>.png, read for what it is: 78 frames of 34 x 32. Null when it is not that. */
export function validStrip(strip: Bitmap): boolean {
  return strip.width === ANIMAL_ROW_W && strip.height === ANIMAL_H && strip.rgba.length === strip.width * strip.height * 4;
}

export interface AnimalRow {
  /** The 78 frames, `ANIMAL_ROW_W` x `ANIMAL_H` RGBA, in the engine's order. */
  rgba: Uint8ClampedArray;
  /** Where the head is in the front idle frame (frame `POSE.idle + 18`). */
  head: Box;
}

/** An animal's 78 frames, graded like the room's people (unless `graded` is false: the wardrobe's). Null if the strip is not the one expected. */
export function composeAnimal(strip: Bitmap, animal: Animal, opts: { graded?: boolean } = {}): AnimalRow | null {
  if (!validStrip(strip)) return null;
  const out = new Uint8ClampedArray(ANIMAL_ROW_W * ANIMAL_H * 4);
  for (let n = 0; n < FRAMES; n++) {
    const g = stripFrame(strip, n);
    if (opts.graded !== false) grade(g);
    for (let y = 0; y < ANIMAL_H; y++) out.set(g.subarray(y * ANIMAL_W * 4, (y + 1) * ANIMAL_W * 4), (y * ANIMAL_ROW_W + n * ANIMAL_W) * 4);
  }
  return { rgba: out, head: headBox(stripFrame(strip, 18), jumperOf(animal.jumper)) };
}

/**
 * THE 2x STRIP (public/library/characters/<id>@2x.png, tools/art/animal_sheet.py --hires 2 and animal_sit.py --hires 2): the same 78 frames in the same order, each
 * `HI` times the pixels in both directions (68 x 64), made from the same ChatGPT art at about 4 source px per pixel instead of 8. The engine draws a frame of it over exactly the
 * box a 1x frame covers (so the anchors, feet, z order, occlusion, shadow and labels are the 1x strip's), at k / HI device px per pixel, and only when that is a whole number
 * (an even k): at an odd k it keeps the 1x strip. Nothing else is different: the grade is the same.
 */
export const HI = 2;
export const ANIMAL_HI_ROW_W = ANIMAL_ROW_W * HI;

/** The 2x strip decoded from <id>@2x.png, read for what it is: 78 frames of (34 x 2) x (32 x 2). */
export function validHiStrip(strip: Bitmap): boolean {
  return strip.width === ANIMAL_HI_ROW_W && strip.height === ANIMAL_H * HI && strip.rgba.length === strip.width * strip.height * 4;
}

/** An animal's 78 frames at 2x, graded like the 1x row (the same grade, per pixel), or null if the strip is not the one expected. */
export function composeAnimalHi(strip: Bitmap, opts: { graded?: boolean } = {}): Uint8ClampedArray | null {
  if (!validHiStrip(strip)) return null;
  const out = new Uint8ClampedArray(strip.rgba);
  if (opts.graded !== false) grade(out);
  return out;
}
