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
/** The three sizes a head is drawn at, in css pixels. */
export type HeadSize = 32 | 40 | 56;

/** The tile's edge in device pixels. */
export const headPx = (size: number, dpr: number) => Math.max(HEAD.w, Math.round(size * (Number.isFinite(dpr) && dpr > 0 ? dpr : 1)));
/** The whole-number scale the 16 x 16 head is drawn at in a tile of `px` device pixels. */
export const headScale = (px: number) => Math.max(1, Math.floor(px / HEAD.w));

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
export function scaleHead(head: Uint8ClampedArray | Uint8Array, px: number): Uint8ClampedArray {
  const s = headScale(px);
  const out = new Uint8ClampedArray(px * px * 4);
  const ox = Math.floor((px - HEAD.w * s) / 2), oy = Math.floor((px - HEAD.h * s) / 2);
  for (let y = 0; y < HEAD.h * s; y++) {
    const sy = Math.floor(y / s);
    for (let x = 0; x < HEAD.w * s; x++) {
      const si = (sy * HEAD.w + Math.floor(x / s)) * 4, di = ((oy + y) * px + (ox + x)) * 4;
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
