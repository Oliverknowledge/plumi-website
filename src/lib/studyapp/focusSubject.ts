import { choicesAt, levelsOf } from "./questions/mine";
import { baseSubject, type CatalogueSubject } from "./questions/subject";

/**
 * From a focus session to the Plumi questions: which of the student's own books (their "My subjects" in Questions) the session's subject means.
 *
 * The seat card's subjects are Maths, Physics, Chemistry, Biology and Other. A book matches when its subject is that one, whatever the board and level ("Physics"
 * at AQA GCSE, at OCR A-Level). Where the student has no book of that subject but does Combined Science, that is theirs for Physics, Chemistry and Biology, and a
 * Maths student who does only Further Maths gets that. Nothing else is guessed: "Other" or no subject means "no preference" (they go to the questions as they left them).
 * Pure.
 */
export type FocusRoute =
  /** Open this book's feed (one match, or the one they used last of several). */
  | { kind: "feed"; slug: string }
  /** They have no such book: the setup, at the book for this subject (nothing is ticked for them). */
  | { kind: "setup"; base: string }
  /** No preference: the questions as they were. */
  | { kind: "none" };

/** The subjects of the bank that a seat subject means, best first. */
const MEANS: Record<string, readonly string[]> = {
  maths: ["Maths", "Further Maths"],
  physics: ["Physics", "Combined Science"],
  chemistry: ["Chemistry", "Combined Science"],
  biology: ["Biology", "Combined Science"],
};

/** The word for a seat subject in the setup ("Physics"): the first thing it means. */
export const wantedBase = (subjectId: string | null | undefined): string | null => (subjectId ? MEANS[subjectId]?.[0] ?? null : null);

/**
 * `mine`: their books (bank slugs), in the order they chose them. `lastUsed`: the subject the feed was last on, and `usedOrder` the feed's own memory of which they
 * used lately (newest first), used to choose between several boards or levels of one subject.
 */
export function routeFor(subjectId: string | null | undefined, mine: readonly string[], catalogue: readonly CatalogueSubject[], lastUsed: string | null = null, usedOrder: readonly string[] = []): FocusRoute {
  const means = subjectId ? MEANS[subjectId] : undefined;
  if (!means) return { kind: "none" };
  const bySlug = new Map(catalogue.map((c) => [c.slug, c]));
  for (const base of means) {
    const have = mine.filter((slug) => baseSubject(bySlug.get(slug)?.subject ?? "") === base);
    if (have.length === 1) return { kind: "feed", slug: have[0] };
    if (have.length > 1) {
      const rank = (slug: string) => { if (slug === lastUsed) return -1; const i = usedOrder.indexOf(slug); return i < 0 ? 1000 + mine.indexOf(slug) : i; };
      return { kind: "feed", slug: [...have].sort((a, b) => rank(a) - rank(b))[0] };
    }
  }
  const want = means[0];
  return catalogue.some((c) => baseSubject(c.subject) === want) ? { kind: "setup", base: want } : { kind: "none" };
}

/**
 * The level the setup should be showing so that the book for `base` is on screen: the one it is already on if that level has the book, else the first level (the usual two
 * first) that does, else where it was.
 */
export function levelFor(base: string, catalogue: readonly CatalogueSubject[], current: string): string {
  const has = (level: string) => choicesAt(catalogue, level).some((c) => c.base === base);
  if (has(current)) return current;
  const { main, other } = levelsOf(catalogue);
  return [...main, ...other].find(has) ?? current;
}
