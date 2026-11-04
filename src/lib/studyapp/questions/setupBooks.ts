import { baseSubject, boardLabel, type CatalogueSubject } from "./subject";

/**
 * The pure parts of the setup's exercise books: what a screen reader is told about a book, what sits in the pile on the bar,
 * and what the bar says. (The drawing is in components/studyapp/questions/BookArt.tsx; nothing here is about looks.)
 */

/** "Combined Science" is `combined-science`: the key of a book's art (BOOK_ART) and of its fallback tilt. */
export const artSlug = (base: string) => base.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * What a screen reader hears on a book: "Maths, not chosen", "Maths, AQA, chosen", "Maths, AQA, Higher, chosen".
 * A chosen book with no board yet says so ("Maths, chosen, pick a board"), and a tiered one with no tier yet says "pick a tier", so a missing step is never silent.
 */
export function bookLabel(base: string, chosen: boolean, board: string | null, tiers: readonly string[] = [], askTier = false): string {
  if (!chosen) return `${base}, not chosen`;
  if (!board) return `${base}, chosen, pick a board`;
  return [base, board, ...tiers, ...(askTier ? ["pick a tier"] : []), "chosen"].join(", ");
}

/** A small crooked angle for a book with no entry of its own: the same every time for the same subject, never flat, never more than 2.6 degrees. */
export function fallbackTilt(slug: string): number {
  let h = 7;
  for (const ch of slug) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const mag = 0.8 + (h % 19) / 10; // 0.8 to 2.6
  return (h >> 5) % 2 ? mag : -mag;
}

/** One book in the pile on the bar. */
export interface PileBook { key: string; level: string; base: string; board: string | null; tint: string }

/** The ticked books, in the order the student ticked them (a Map keeps insertion order), with the board each has so far. */
export function pileOf(draft: ReadonlyMap<string, string>, catalogue: readonly CatalogueSubject[]): PileBook[] {
  const out: PileBook[] = [];
  for (const [key, slug] of draft) {
    const [level, base] = [key.slice(0, key.indexOf("|")), key.slice(key.indexOf("|") + 1)];
    const c = slug ? catalogue.find((x) => x.slug === slug) : undefined;
    out.push({ key, level, base, board: c ? boardLabel(c) : null, tint: coverColour(base) });
  }
  return out;
}

/** The first ticked book still without a board (the one the bar asks about), read from the level they are looking at first so the answer is in front of them. */
export function firstMissing(draft: ReadonlyMap<string, string>, level: string): { level: string; base: string } | null {
  const open = [...draft].filter(([, s]) => !s).map(([k]) => ({ level: k.slice(0, k.indexOf("|")), base: k.slice(k.indexOf("|") + 1) }));
  return open.find((m) => m.level === level) ?? open[0] ?? null;
}

/**
 * The line on the bar: what is missing ("Pick a board for Maths", with the level only when it is not the one on screen), or the books they have.
 * `kind` says which, so the bar can be a button that takes them to the missing book.
 */
export function barLine(draft: ReadonlyMap<string, string>, level: string): { kind: "missing" | "ready" | "none"; text: string } {
  if (draft.size === 0) return { kind: "none", text: "" };
  const m = firstMissing(draft, level);
  if (m) return { kind: "missing", text: `Pick a board for ${m.level === level ? "" : `${m.level} `}${m.base}` };
  const names = [...draft.keys()].map((k) => baseSubject(k.slice(k.indexOf("|") + 1)));
  return { kind: "ready", text: names.length <= 3 ? names.join(", ") : `${names[0]} and ${names.length - 1} more` };
}

/** How many books are ticked at one level (the little stamp on that level's tab). */
export const countAt = (draft: ReadonlyMap<string, string>, level: string) => [...draft.keys()].filter((k) => k.startsWith(`${level}|`)).length;

/** Does a book at this level have anything to choose once ticked: more than one board, or (its board known) a tier? */
export const hasChoices = (boards: number, tiers: number) => boards > 1 || tiers >= 2;

/** More is raised, with its levels under it, only while one of those levels is on screen; a main level collapses it. */
export const isMoreOpen = (level: string, main: readonly string[], other: readonly string[]) => other.length > 0 && !main.includes(level);

/** The tier a kept subject starts the setup with: what they chose, or every tier ("any tier", an answer) so coming back never asks again. */
export const keptTier = (saved: readonly string[] | undefined, all: readonly string[] | undefined): string[] | null =>
  !all || all.length < 2 ? null : saved && saved.length ? [...saved] : [...all];

/** One word to tell the other levels apart (a student must know which is theirs): who sets the exam, or what kind of course it is. */
const LEVEL_HINTS: Record<string, string> = { IGCSE: "Cambridge", "International GCSE": "Edexcel", "Level 1/2": "vocational", "Level 2": "Further Maths", "Level 3": "vocational" };
export const levelHint = (level: string): string | null => LEVEL_HINTS[level] ?? null;

/** The quiet line under a book left at any tier. */
export const TIER_HINT = "Pick a tier to start on the right questions";

/**
 * A book's own cover colour (the feed's subject tabs use the same one, `tabColour`): a real colour (not a CSS variable, so it draws in the pile on the feed too, where the tab's tint variables do not
 * exist), a different one for each subject the bank has (no two closer than 10 in CIELAB, tested), and for any other subject one picked from its name, the same every time.
 */
const COVER: Record<string, string> = {
  maths: "#a1cef7", "further-maths": "#998eeb", biology: "#8eebd2", chemistry: "#c4f0a8", physics: "#facabd", "combined-science": "#98e1a5",
  geography: "#e0eb8e", history: "#f5f1db", "english-language": "#f7a1a7", "english-literature": "#f0a8d2", french: "#bdc6fa", spanish: "#f5bd84",
  bengali: "#d8e8b0", psychology: "#ed84f5", "computer-science": "#a1f7f4", business: "#e3d5fc", economics: "#84f5bb", law: "#8ed4eb",
  philosophy: "#c38eeb", politics: "#f4c2d3", sociology: "#e198d7", "religious-studies": "#a5f7a1",
};
const SPARE = ["#d9e6ff", "#ffe0e6", "#e6f0c8", "#e0d5c5", "#d2ecf7", "#f3e0f9", "#fbe7c6", "#cfe9dd"];
export function coverColour(base: string): string {
  const slug = artSlug(base);
  if (COVER[slug]) return COVER[slug];
  let h = 11;
  for (const ch of slug) h = (h * 37 + ch.charCodeAt(0)) >>> 0;
  return SPARE[h % SPARE.length];
}
/** The colour of a subject's tab on the feed: the same as its book's cover in the setup, so a student reads one colour for one subject. */
export const tabColour = coverColour;

/** The board a student most likely sits when they do not know theirs: the one with the most papers in the bank (the first by name on a tie). */
export function commonBoard<T extends { count: number }>(boards: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const b of boards) if (!best || b.count > best.count) best = b;
  return best;
}
