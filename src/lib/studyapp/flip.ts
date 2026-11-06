import type { Grade } from "./srs";

/**
 * Which side of the card on the desk is showing, as pure functions (flip.test.ts). `review.tsx` keeps one of these in React.
 *
 * A card turns over and back as often as the student likes until they grade it; grading moves to the next card, which starts on its
 * question. Turning back changes nothing else: the card stays the one on the desk (pinned), nothing is graded or scheduled.
 */
export interface FlipState {
  /** The card on the desk once the student has touched it: a card coming due elsewhere must not swap it under their hands. */
  pinned: string | null;
  /** The card whose answer is showing, if any. */
  shownId: string | null;
}

export const FRESH: FlipState = { pinned: null, shownId: null };

export const isShown = (s: FlipState, cardId: string | null): boolean => !!cardId && s.shownId === cardId;

/** Show the answer. */
export const show = (s: FlipState, cardId: string): FlipState => (s.shownId === cardId && s.pinned === cardId ? s : { pinned: cardId, shownId: cardId });

/** Back to the question. The card stays on the desk. */
export const turnBack = (s: FlipState, cardId: string): FlipState => (s.shownId === cardId ? { ...s, shownId: null } : s);

/** The one gesture: tap, Space, Enter, the buttons. */
export const toggle = (s: FlipState, cardId: string): FlipState => (isShown(s, cardId) ? turnBack(s, cardId) : show(s, cardId));

/** A grade is only given to an answer that is showing. */
export const canGrade = (s: FlipState, cardId: string | null): boolean => isShown(s, cardId);

/** After a grade the next card comes up on its question. */
export const afterGrade = (): FlipState => FRESH;

export type KeyAction = { kind: "flip" } | { kind: "grade"; grade: Grade } | null;

/**
 * What a key does on the desk. Space and Enter turn the card over, or back (not when held down, and not on a focused button or link, which
 * press themselves); 1 to 4 grade, only while the answer is showing.
 */
export function keyAction(key: string, ctx: { hasCard: boolean; shown: boolean; repeat: boolean; onButton: boolean }): KeyAction {
  if ((key === " " || key === "Enter") && !ctx.onButton) return ctx.hasCard && !ctx.repeat ? { kind: "flip" } : null;
  if (/^[1-4]$/.test(key) && ctx.hasCard && ctx.shown) return { kind: "grade", grade: Number(key) as Grade };
  return null;
}
