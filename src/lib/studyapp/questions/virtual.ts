import type { QPart } from "./model";

/**
 * A long list that draws only what is near the screen, pure: heights (measured where an item has been drawn, a good guess where it has not) add
 * up to offsets, and the offsets say which items a scroll position needs. The question feed is the one user (FeedList.tsx).
 */

/** The top of every item, then the end: `n + 1` numbers. */
export function offsetsOf(heights: ArrayLike<number>): Float64Array {
  const off = new Float64Array(heights.length + 1);
  for (let i = 0; i < heights.length; i++) off[i + 1] = off[i] + heights[i];
  return off;
}

/** The item a position falls in: the last one that starts at or above `y` (0 above the list, the last item below it). Empty list: -1. */
export function indexAt(off: ArrayLike<number>, y: number): number {
  const n = off.length - 1;
  if (n <= 0) return -1;
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (off[mid] <= y) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** The items that touch the span `top` to `bottom` (px down the list): `from` first, `to` one past the last. Empty list or a span past the end gives an empty range. */
export function rangeOf(off: ArrayLike<number>, top: number, bottom: number): { from: number; to: number } {
  const n = off.length - 1;
  if (n <= 0) return { from: 0, to: 0 };
  const from = indexAt(off, Math.max(0, top));
  let to = from;
  while (to < n && off[to] < bottom) to++;
  return { from, to: Math.max(to, Math.min(n, from + 1)) };
}

/** An item that must stay drawn (it has the keyboard) joins the range when it is within `reach` items of it; further off it is let go. */
export function withPinned(r: { from: number; to: number }, pinned: number | null, n: number, reach = 10): { from: number; to: number } {
  if (pinned === null || pinned < 0 || pinned >= n) return r;
  if (pinned >= r.from && pinned < r.to) return r;
  if (pinned < r.from && r.from - pinned <= reach) return { from: pinned, to: r.to };
  if (pinned >= r.to && pinned - r.to < reach) return { from: r.from, to: pinned + 1 };
  return r;
}

/* ── how tall a question card is before it has been drawn ────────────── */

/** The card's two layouts break here, the same width as the stylesheet's media query. */
export const FEED_WIDE = 981;
const SIDE = 188 + 232 + 2 * 24;   // the meta column, the examiner's column and their gaps (wide layout)
const PAD_X = 38;                    // the sheet's padding and edges
const CHROME = 212;                  // what a closed card holds besides its picture: the zoom and Read as text line, the Type and Draw buttons, the Mark scheme button, the sheet's padding, the gap to the next card
const TOGGLE = 54;                   // the "Write on the question" button under the picture (a mouse; a touch screen has none)
const MIN_WIDE = 330;                // the meta column is taller than a one-line question
const META_NARROW = 206;             // the meta folded above the picture on a narrow screen (an iPad upright)
const META_PHONE = 229;              // ... and on a phone, where its lines wrap (a list narrower than PHONE_W)
const PHONE_W = 520;
const LISTEN = 108;                  // the recording's player, its label and note
const START = 48;                    // the button that opens how the question starts (or the question so far)

/**
 * A card's height at the list's width, from the picture's size: a card shows two buttons under its picture, not a space to write on, so the marks do not change it (an answer
 * that has been written makes it taller once it has been drawn, and the measured height then replaces this). Only a guess for a card that has not been drawn; a wrong guess costs a
 * small correction as the card first appears, never a wrong list. (The constants were fitted to the heights measured on AQA GCSE Maths and Physics at 1184, 820 and 390 px: within a
 * few pixels for nine cards in ten.) `mouse`: the pointer is a mouse, which has the "Write on the question" button.
 */
export function cardEstimate(part: Pick<QPart, "w" | "h" | "m" | "k" | "er" | "au" | "auw">, listWidth: number, hasStart = false, mouse = false, startOpen = false): number {
  const wide = listWidth >= FEED_WIDE;
  const sheet = Math.max(240, (wide ? listWidth - SIDE : listWidth) - PAD_X);
  const picture = sheet * (part.h > 0 && part.w > 0 ? part.h / part.w : 0.28);
  // (0.38: the median setup picture's height over its width, across every bank.)
  const h = picture + CHROME + (mouse ? TOGGLE : 0) + (hasStart ? START : 0) + (startOpen ? sheet * 0.38 : 0) + (part.au ? LISTEN : 0);
  if (wide) return Math.round(Math.max(MIN_WIDE, h));
  return Math.round(h + (listWidth < PHONE_W ? META_PHONE : META_NARROW) + (part.er ? 52 : 0));
}
