import type { AppData, Deck } from "../model";
import { SHARE_LIMITS } from "./contract";

/**
 * Which decks may be shared, and what is sent for one.
 *
 * Shared: a deck the student MADE (typed, or from a pasted list) or IMPORTED (an Anki or CSV file). Not shared: Plumi's own
 * ready-made decks (`starter` is set), which are ours, not the student's to hand out under their link. The web has no deck made
 * from exam-board mark schemes, past papers or the student's mistakes (those buttons are "On iPad" and disabled); if one ever
 * arrives it must carry its own marker on `Deck` and be refused here, and the test that lists a deck's fields will fail first
 * so that decision is made on purpose.
 */
export function canShare(deck: Pick<Deck, "title" | "starter"> | null | undefined): boolean {
  if (!deck) return false;
  if (deck.starter !== null && deck.starter !== undefined) return false;
  return typeof deck.title === "string" && deck.title.trim().length > 0;
}

/** Characters that carry no words and can change how neighbouring text is drawn (direction marks, zero-width, control codes). */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Plain text, as sent: line breaks kept as \n, invisible characters gone, edges trimmed. */
export function cleanText(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/\r\n?/g, "\n").replace(INVISIBLE, "").trim();
}

/** The first `n` characters, counted as the database counts them (code points, not UTF-16 units), never cutting a pair in two. */
export function clipChars(s: string, n: number): string {
  const chars = Array.from(s);
  return chars.length <= n ? s : chars.slice(0, n).join("").trimEnd();
}

export interface SharePayload {
  title: string;
  cards: { front: string; back: string }[];
  /** The deck's subject, or null. A label only. */
  subjectHint: string | null;
  /** Cards that will be shared. */
  count: number;
  /** Cards left out because a side was empty. */
  dropped: number;
  /** Cards left out because the deck is over the limit (the first ones are kept). */
  overLimit: number;
}

/**
 * The words of one deck, as `share_deck` takes them: text only (cards are strings here already; anything that is not a string,
 * such as a picture or a sound a later version might attach, is not sent), trimmed, in the order they were made, without a card
 * that has an empty front or back, each side cut to the database's limit and the deck to its card limit.
 * Nothing about the student's progress (schedule, ease, reviews) is part of it.
 */
export function sharePayload(data: Pick<AppData, "decks" | "cards">, deckId: string): SharePayload | null {
  const deck = data.decks.find((d) => d.id === deckId);
  if (!deck || !canShare(deck)) return null;
  const made = data.cards.filter((c) => c.deckId === deckId).sort((a, b) => a.createdAt - b.createdAt);
  const kept: { front: string; back: string }[] = [];
  let dropped = 0;
  for (const c of made) {
    const front = clipChars(cleanText(c.front), SHARE_LIMITS.maxCardChars);
    const back = clipChars(cleanText(c.back), SHARE_LIMITS.maxCardChars);
    if (!front || !back) dropped++;
    else kept.push({ front, back });
  }
  const cards = kept.slice(0, SHARE_LIMITS.maxCards);
  const subject = cleanText(deck.subject ?? "").replace(/\s+/g, " ");
  return {
    title: clipChars(cleanText(deck.title).replace(/\s+/g, " "), SHARE_LIMITS.maxTitleChars),
    cards,
    subjectHint: subject ? clipChars(subject, SHARE_LIMITS.maxSubjectChars) : null,
    count: cards.length,
    dropped,
    overLimit: kept.length - cards.length,
  };
}
