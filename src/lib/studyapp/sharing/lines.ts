import { ERROR_CODES, SHARE_LIMITS, type ShareErrorCode } from "./contract";

/**
 * Why sharing did not happen, as a value (never thrown at a view): the database's own words, or what the connection did.
 * `unavailable` is a project that has not had the sharing migration yet, or has no project at all.
 */
export type ShareReason = ShareErrorCode | "unavailable" | "offline" | "busy" | "other";

export const isErrorCode = (s: string): s is ShareErrorCode => (ERROR_CODES as readonly string[]).includes(s);

/** The database raises its word as the exception message ("not_found"); find it whatever wraps it ("shared:not_found", "ERROR: ..."). */
export function codeIn(message: string): ShareErrorCode | null {
  const lower = message.toLowerCase();
  let best: { code: ShareErrorCode; at: number } | null = null;
  for (const code of ERROR_CODES) {
    const m = new RegExp(`(^|[^a-z_])${code}($|[^a-z_])`).exec(lower);
    if (m && (!best || m.index < best.at)) best = { code, at: m.index };
  }
  return best?.code ?? null;
}

/**
 * One short line a student can read for each reason. No em dashes, no codes, no pipeline words, and never the word "error".
 * (The strings in this file are held to that by sharing.test.ts.)
 */
export function reasonLine(reason: ShareReason): string {
  switch (reason) {
    case "not_signed_in": return "Sign in to share a deck.";
    case "empty_deck": return "Add a card before you share this deck.";
    case "too_many_cards": return `A shared deck holds up to ${SHARE_LIMITS.maxCards} cards.`;
    case "card_too_long": return "One of your cards is too long to share. Shorten it and try again.";
    case "title_too_long": return "The deck name is too long to share. Shorten it and try again.";
    case "too_many_decks": return `You have ${SHARE_LIMITS.liveDecksPerStudent} shared decks. Stop sharing one to share another.`;
    case "too_many_today": return "That is enough sharing for today. Try again tomorrow.";
    case "not_found": return "This deck is not shared any more.";
    case "rate_limited": return "Too many tries just now. Wait a minute and try again.";
    case "bad_request": return "That did not work. Try again in a moment.";
    case "unavailable": return "Sharing is not available right now.";
    case "offline": return "You look offline. Check your connection and try again.";
    case "busy": return "Plumi is busy. Try again in a moment.";
    case "other": return "That did not work. Try again in a moment.";
  }
}

/** Reasons where trying the same thing again can work, so the screen offers a retry. */
export const canRetry = (reason: ShareReason): boolean => reason === "offline" || reason === "busy" || reason === "rate_limited" || reason === "bad_request" || reason === "other";
