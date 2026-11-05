import { makeId, SUBJECTS, type AppData, type Card, type Deck } from "../model";
import { newSchedule } from "../srs";
import { SHARE_LIMITS, type SharedDeck } from "./contract";
import { clipChars } from "./payload";

/**
 * "Add to my decks": a friend's deck becomes a normal private deck in this browser's flashcards. New ids all round, a fresh
 * schedule (nothing the sharer reviewed comes with it), the original's title kept. It is the friend's own from then on: changing
 * it never changes the original, and nothing in the deck says where it came from (the code is remembered beside the store, see
 * `addedCodes`, only so the page can say "Already in your decks").
 *
 * Card text keeps the shared length (up to 1,500 characters a side) instead of the 400 and 800 a hand-typed card is cut to:
 * silently shortening a friend's card would change its meaning. A card edited later is cut to the usual limits by the editor.
 */
export function addSharedDeck(data: AppData, shared: SharedDeck, now: number): { data: AppData; deckId: string | null; added: number } {
  const title = clipChars(shared.title.replace(/\s+/g, " ").trim(), SHARE_LIMITS.maxTitleChars);
  const pairs = shared.cards.filter((c) => c.front.trim() && c.back.trim());
  if (!title || pairs.length === 0) return { data, deckId: null, added: 0 };
  // The subject only when it is one the app knows, so the deck lands under a real subject in the list instead of inventing a heading.
  const hint = shared.subjectHint?.trim() ?? "";
  const subject = (SUBJECTS as readonly string[]).find((s) => s.toLowerCase() === hint.toLowerCase()) ?? null;
  const deck: Deck = { id: makeId("d", now), title, subject: subject === "Other" ? null : subject, createdAt: now, starter: null };
  const cards: Card[] = pairs.map((c, i) => ({
    id: makeId("c", now), deckId: deck.id, front: c.front.trim(), back: c.back.trim(),
    // Created a millisecond apart so the deck keeps the sharer's order wherever cards are sorted by when they were made.
    createdAt: now + i, sch: newSchedule(now), lastReviewed: null,
  }));
  return { data: { ...data, decks: [...data.decks, deck], cards: [...data.cards, ...cards] }, deckId: deck.id, added: cards.length };
}

/* ── Codes remembered on this device ─────────────────────────────────── */

type Store = Pick<Storage, "getItem" | "setItem">;
/** code to the id of the deck here: copies this browser added from a link (`plumi-shared-added`), and links this browser made (`plumi-shared-out`). */
export const ADDED_KEY = "plumi-shared-added";
export const OUT_KEY = "plumi-shared-out";

export function readCodes(store: Store | null, key: string): Record<string, string> {
  try {
    const raw = store?.getItem(key);
    const v: unknown = raw ? JSON.parse(raw) : {};
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return {};
  }
}

export function writeCodes(store: Store | null, key: string, codes: Record<string, string>): void {
  try { store?.setItem(key, JSON.stringify(codes)); } catch { /* storage full or blocked: the page works without remembering */ }
}

/** The deck here that was added from this code, if the student still has it. Delete the copy and the same link can be added again. */
export function addedDeckFor(data: Pick<AppData, "decks">, codes: Record<string, string>, code: string): string | null {
  const id = codes[code];
  return id && data.decks.some((d) => d.id === id) ? id : null;
}

/** The deck here a live link was made from, by the code. */
export function codeForDeck(codes: Record<string, string>, deckId: string, live: ReadonlySet<string> | null): string | null {
  for (const [code, id] of Object.entries(codes)) if (id === deckId && (live === null || live.has(code))) return code;
  return null;
}
