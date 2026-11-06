import { REF_W } from "./ink";
import { zoneHeight, type QAnswer, type QPart } from "./model";

/**
 * Keeping a tall question in sight while the student writes (a student working through a Further Maths question asked to "see the whole question while at the same time being able to write").
 * Pure: these are the rules; FeedCard.tsx and usePin.ts only measure and draw.
 *
 *  - SPLIT, on a wide screen (a laptop, an iPad on its side): the open card is two columns. The question stays in view on the left (sticky, scrolling on its own if taller than the screen)
 *    and the answer is a large working page on the right. Only when the question is taller than about 45% of the screen; a short question that already fits is left alone.
 *  - PEEK, on a narrow screen (a phone, an iPad upright): a slim bar under the strip, once the question has scrolled out of sight, shows a cut of the question and opens it in full over the page.
 *    Only when the question and the answer together do not fit on the screen.
 *
 * Decided from the bank's own picture sizes, never from what the page measures of the split itself, so the answer cannot flip the layout it causes (a question is shorter once it is half the
 * width). Once on, it stays on until the question is clearly short for the screen (hysteresis), so a browser bar sliding in and out cannot make the card jump between layouts.
 */
export type PinMode = "split" | "peek";

/** A screen at least this wide (css px) has room for two columns. */
export const SPLIT_MIN_W = 900;
/** A screen shorter than this (a phone on its side) has no room for a pinned question either way. */
export const PIN_MIN_H = 520;
/** The question is tall when it is more than this share of the screen's height; once pinned it stays pinned down to the second share. */
export const TALL = 0.45;
export const TALL_STAY = 0.3;
/** The feed's own wide layout (viewport width): the meta column and the examiner's column stand beside the sheet. Same numbers as virtual.ts. */
export const THREE_COL_W = 981;
export const SIDE = 188 + 232 + 2 * 24;
export const PAD_X = 38;
/** A question's setup picture, height over width (the median across every bank: virtual.ts). */
export const STEM_RATIO = 0.38;
/** The question column's share of the sheet: the usual, and "Wider question". */
export const COL_NORMAL = 45;
export const COL_WIDE = 60;
/** What the strip at the top of the page holds when it cannot be read (px). */
export const GAP_GUESS = 136;

/** The width the question's picture has when the card is NOT split: the sheet's width in the feed's wide layout (beside the meta column), else the card's. */
export const unsplitWidth = (cardW: number, viewportW: number): number => Math.max(240, (viewportW >= THREE_COL_W ? cardW - SIDE : cardW) - PAD_X);

/**
 * How tall everything the pinned side would hold is at that width: the part's picture, plus its question's setup picture where there is one, plus the figure it shares with an earlier part
 * (sharedFigure.ts) where it takes one. Earlier parts are not counted: they are folded until asked for.
 */
export function questionPx(part: Pick<QPart, "w" | "h">, width: number, more: { stem?: boolean; fig?: Pick<QPart, "w" | "h"> | null } = {}): number {
  const ratio = (p: Pick<QPart, "w" | "h">) => (p.w > 0 && p.h > 0 ? p.h / p.w : 0.28);
  return Math.round(width * (ratio(part) + (more.stem ? STEM_RATIO : 0) + (more.fig ? ratio(more.fig) : 0)));
}

export interface PinIn {
  viewportW: number;
  viewportH: number;
  /** questionPx at the unsplit width. */
  questionPx: number;
  /** The answer space at that width (px), for the narrow rule. */
  zonePx: number;
  /** The mode this card was in a moment ago, for hysteresis. */
  was: PinMode | null;
}
/** Whether pinning would help here at all, and which kind: null where the question is short for the screen (or the screen too short for either). */
export function pinKind(i: PinIn): PinMode | null {
  const { viewportW: vw, viewportH: vh } = i;
  if (vh < PIN_MIN_H) return null;
  if (vw >= SPLIT_MIN_W) return i.questionPx > vh * (i.was === "split" ? TALL_STAY : TALL) ? "split" : null;
  // Narrow: the question and the space under it do not fit between the strip and the foot of the screen (and the question is not a line or two).
  const room = (vh - GAP_GUESS) * (i.was === "peek" ? 0.85 : 1);
  return i.questionPx > vh * 0.25 && i.questionPx + i.zonePx + 160 > room ? "peek" : null;
}

/**
 * The working page's least height (css px): a screen and a half under the strip. A page no taller than the screen would leave the pinned question nothing to stay pinned over (it can only stay
 * while the card goes on past the screen), and "a whole page to do working out" is the point; "More space" makes it longer still.
 */
export const pagePx = (viewportH: number, gap = GAP_GUESS): number => Math.max(560, Math.round((viewportH - gap - 120) * 1.6));

/** The answer space's height at a width, from the marks (px). */
export const zonePx = (part: Pick<QPart, "m"> & { k?: string }, answer: QAnswer | undefined, width: number): number => Math.round((zoneHeight(part, answer) * width) / REF_W);

/**
 * A card's height when it is pinned as two columns and has not been drawn yet: the line of details above, the sheet's padding, the taller of the working page (with the head of the space and the
 * marking line under it) and the question column (never taller than the screen), then the room below. Only a guess for a card nobody has drawn; the measured height replaces it.
 */
export function splitCardEstimate(questionHeight: number, viewportH: number, er: boolean, gap = GAP_GUESS): number {
  const col = Math.min(questionHeight + 52, Math.max(240, viewportH - gap - 14));
  return Math.round(76 + 32 + Math.max(pagePx(viewportH, gap) + 58 + 120, col) + (er ? 56 : 0) + 30);
}

/** The columns as the stylesheet reads them: the question's share of the sheet, in percent. */
export const columnShare = (wide: boolean): number => (wide ? COL_WIDE : COL_NORMAL);
