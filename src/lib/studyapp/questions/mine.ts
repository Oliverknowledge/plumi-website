import type { QuestionsData } from "./model";
import { baseSubject, boardLabel, subjectOrder, type CatalogueSubject } from "./subject";

/**
 * The subjects a student does ("My subjects"): bank slugs, which name the level and the exam board as well. Pure.
 * Older data has none (the tab used to remember only the last subject), so what it holds is read as theirs, nothing lost.
 */
export const MAX_DERIVED = 6;

/** Their subjects, in the order they chose them, only those the bank still has. If they never chose, the subject last used and the subjects of their sets, newest first. */
export function effectiveMine(q: Pick<QuestionsData, "mine" | "pick" | "sets">, known: ReadonlySet<string>): string[] {
  const own = q.mine ? q.mine : [q.pick.subject, ...q.sets.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((s) => s.subject)].slice(0, 30);
  const out: string[] = [];
  for (const s of own) if (s && known.has(s) && !out.includes(s)) out.push(s);
  return q.mine ? out : out.slice(0, MAX_DERIVED);
}

/** What a student can tick at one level: a subject, and the exam boards the bank has for it (each board is one catalogue entry). */
export interface SubjectChoice { base: string; boards: { slug: string; label: string; count: number }[] }

export function choicesAt(catalogue: readonly CatalogueSubject[], level: string): SubjectChoice[] {
  const by = new Map<string, SubjectChoice>();
  for (const c of catalogue) {
    if (c.level !== level) continue;
    const base = baseSubject(c.subject);
    const e = by.get(base) ?? { base, boards: [] };
    e.boards.push({ slug: c.slug, label: boardLabel(c), count: c.count });
    by.set(base, e);
  }
  for (const e of by.values()) e.boards.sort((a, b) => a.label.localeCompare(b.label));
  return [...by.values()].sort((a, b) => subjectOrder(a.base) - subjectOrder(b.base) || a.base.localeCompare(b.base));
}

/** The levels in the bank, the usual two first. */
export function levelsOf(catalogue: readonly CatalogueSubject[]): { main: string[]; other: string[] } {
  const has = new Set(catalogue.map((c) => c.level));
  return { main: ["GCSE", "A-Level"].filter((l) => has.has(l)), other: [...has].filter((l) => l !== "GCSE" && l !== "A-Level").sort() };
}

/** A draft is `base key (level + subject)` to the board's slug. */
export const draftKey = (level: string, base: string) => `${level}|${base}`;

/** The chosen slugs of a draft, in the order the student ticked them (a Map keeps insertion order). */
export const draftSlugs = (d: ReadonlyMap<string, string>) => [...d.values()].filter(Boolean);

/**
 * Tick a subject: its board is chosen for them where there is only one, or where the board they chose for another subject
 * at this level has it too (an AQA student ticks Chemistry and it is AQA); otherwise left open for them to choose.
 */
export function tickSubject(d: ReadonlyMap<string, string>, level: string, c: SubjectChoice, catalogue: readonly CatalogueSubject[]): Map<string, string> {
  const n = new Map(d);
  let slug = "";
  if (c.boards.length === 1) slug = c.boards[0].slug;
  else {
    const boards = new Set<string>();
    for (const [k, s] of d) if (k.startsWith(`${level}|`) && s) { const e = catalogue.find((x) => x.slug === s); if (e) boards.add(e.board); }
    if (boards.size === 1) slug = c.boards.find((b) => catalogue.find((x) => x.slug === b.slug)?.board === [...boards][0])?.slug ?? "";
  }
  n.set(draftKey(level, c.base), slug);
  return n;
}

/** Start a draft from their subjects. */
export function draftOf(mine: readonly string[], catalogue: readonly CatalogueSubject[]): Map<string, string> {
  const d = new Map<string, string>();
  for (const slug of mine) { const c = catalogue.find((x) => x.slug === slug); if (c) d.set(draftKey(c.level, baseSubject(c.subject)), slug); }
  return d;
}
