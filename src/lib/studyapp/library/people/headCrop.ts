import { FRAME_W, ROW_W } from "./sheet";

/**
 * A person's HEAD, for the lists and cards: the front-facing idle frame cropped to the head and shoulders.
 *
 * The frame is 16 x 32 art pixels and the figure is a chibi: a big head (rows 8 to 21, hair to chin) on a short body.
 * Nearly every hairstyle starts at row 8 (a few at 7 and 6, and hairstyle 11's two thin tufts at row 4). So the crop is the
 * whole frame width and 16 rows from row 7: a square of 16 x 16 art pixels holding the whole head, the neck and the top
 * of the shoulders, the same eye line for everyone. The tips of the two tallest styles (03 and 26, one row; the tufts of
 * 11, three rows) are what is left out. The front idle is frames 18 to 23 of the 78 (people/sheet.ts: idle is right, back,
 * left, front, six frames each); the first of them is the still.
 *
 * Pixel art stays crisp only at a whole-number scale, so the picture is made at the DEVICE's resolution: the largest
 * whole scale that fits (2 at 32 css px on a 1x screen, 5 at 40 on 2x, 7 on 3x...), centred in the tile. The tile is
 * then shown at exactly that many device pixels, so the browser never has to stretch it.
 */

export const HEAD = { frame: 18, x: 0, y: 7, w: FRAME_W, h: 16 } as const;

/**
 * AN ANIMAL'S HEAD. An animal's frame is wider (34, with the art 24 of it in the middle) and its head is not where a person's is, so the
 * crop is found from the art: `DrawnPerson.head` is the box from the top of the ears down to the jumper's neck line (store.ts, the
 * front idle frame). The crop is a square of whole art pixels (so it stays crisp at a whole scale, as a person's does), as wide as the
 * head and a little deeper than it (the top of the jumper), at least a person's 16, at most the art's 24; centred on the head's middle and
 * kept inside the frame. A person's frame (16 wide) is the old crop, to the pixel.
 */
export interface HeadSquare { x: number; y: number; side: number }
export function headSquare(frame: { w: number; h: number }, head: { x: number; y: number; w: number; h: number }): HeadSquare {
  if (frame.w <= FRAME_W) return { x: HEAD.x, y: HEAD.y, side: HEAD.w };
  const side = Math.min(24, Math.min(frame.h, frame.w), Math.max(HEAD.w, head.w + 1, head.h + 2));
  const x = Math.min(Math.max(Math.round(head.x + head.w / 2 - side / 2), 0), frame.w - side);
  const y = Math.min(Math.max(head.y, 0), frame.h - side);
  return { x, y, side };
}
/** The three sizes a head is drawn at, in css pixels. */
export type HeadSize = 32 | 40 | 56;

/** The tile's edge in device pixels. */
export const headPx = (size: number, dpr: number) => Math.max(HEAD.w, Math.round(size * (Number.isFinite(dpr) && dpr > 0 ? dpr : 1)));
/** The whole-number scale the 16 x 16 head is drawn at in a tile of `px` device pixels. */
export const headScale = (px: number, side: number = HEAD.w) => Math.max(1, Math.floor(px / side));

/** The 16 x 16 head and shoulders (RGBA) out of a person's 1248 x 32 row of frames, as `composeRow` makes it. */
export function cropHead(row: Uint8ClampedArray | Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(HEAD.w * HEAD.h * 4);
  for (let y = 0; y < HEAD.h; y++) {
    const si = ((HEAD.y + y) * ROW_W + HEAD.frame * FRAME_W + HEAD.x) * 4;
    out.set(row.subarray(si, si + HEAD.w * 4), y * HEAD.w * 4);
  }
  return out;
}

/**
 * A cropped head (16 x 16 RGBA), nearest-neighbour at a whole scale, centred in a `px` x `px` transparent square.
 * The browser draws exactly this (Head.tsx); it is pure so a test can hold it.
 */
export function scaleHead(head: Uint8ClampedArray | Uint8Array, px: number, side: number = HEAD.w): Uint8ClampedArray {
  const s = headScale(px, side);
  const out = new Uint8ClampedArray(px * px * 4);
  const ox = Math.max(0, Math.floor((px - side * s) / 2)), oy = Math.max(0, Math.floor((px - side * s) / 2));
  for (let y = 0; y < side * s && oy + y < px; y++) {
    const sy = Math.floor(y / s);
    for (let x = 0; x < side * s && ox + x < px; x++) {
      const si = (sy * side + Math.floor(x / s)) * 4, di = ((oy + y) * px + (ox + x)) * 4;
      out[di] = head[si]; out[di + 1] = head[si + 1]; out[di + 2] = head[si + 2]; out[di + 3] = head[si + 3];
    }
  }
  return out;
}

/** How much of a painted head is opaque (0 to 1): a blank head is a bug. */
export function inkOf(rgba: Uint8ClampedArray | Uint8Array): number {
  let n = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 0) n++;
  return n / (rgba.length / 4);
}
