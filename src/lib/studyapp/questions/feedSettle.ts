/**
 * When a list the student is looking at may be replaced. The rule is one: the list on screen never changes or jumps under the student unless THEY changed a filter or the search.
 * Anything late (the papers' full text arriving, the school-year or practicals file, a tier choice synced from elsewhere) is applied silently only while the student is still at the top
 * of the page (within 60 px); further down it is held and offered ("More results found. Show them"). A search the student has just typed waits for the full text, but never longer than `TEXT_WAIT_MS`, unless the list from the titles alone is empty (then it waits for the text, never showing a false "nothing matches"). A card with the keyboard in it is never taken away: the change is held.
 */
export const TEXT_WAIT_MS = 2500;
/** The page counts as at its top within this many pixels. */
export const TOP_PX = 60;

export type Settle =
  /** Nothing visible changes (the same questions in the same order): take the new rows quietly. */
  | "same"
  /** Show the new list now. */
  | "apply"
  /** The student's search is waiting for the papers' text: keep the old list (dimmed) a little longer. */
  | "wait"
  /** A late change, and the student is reading further down: keep the list, offer the new one. */
  | "offer";

export interface SettleIn {
  shownIds: readonly string[];
  nextIds: readonly string[];
  /** The student changed a filter or the search since the list on screen was made. */
  intentChanged: boolean;
  /** A search is typed and the papers' text has not arrived (and has not failed). */
  waitingForText: boolean;
  /** How long this change has been waiting for the text. */
  waitedMs: number;
  scrollY: number;
  viewportH: number;
  /** The keyboard is in a card of the list on screen (a student typing an answer): the list is not taken from under them. */
  focusInside?: boolean;
}

export const sameIds = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

export function settle(i: SettleIn): Settle {
  if (sameIds(i.shownIds, i.nextIds)) return "same";
  if (i.intentChanged) {
    // Never a "nothing matches" (or any final count) while the full text is still on its way: a list from the titles alone that is EMPTY keeps waiting, however long, until the text arrives or fails.
    if (i.waitingForText && (i.waitedMs < TEXT_WAIT_MS || i.nextIds.length === 0)) return "wait";
    return i.focusInside ? "offer" : "apply";
  }
  // late: only while the page is at its very top (nothing has been scrolled, so nothing is being read); a student who has moved down the page is never shown a different list
  return i.scrollY <= TOP_PX && !i.focusInside ? "apply" : "offer";
}

/** The words of the chip that offers a held list (more results, or the same questions changed). */
export const offerLabel = (shown: number, next: number): string => (next > shown ? "More results found. Show them" : "The list has changed. Show it");

/** A held list is taken quietly once the student is back at the top of the page (and not typing in a card): the chip then goes. */
export const heldClears = (scrollY: number, focusInside: boolean): boolean => scrollY <= TOP_PX && !focusInside;
