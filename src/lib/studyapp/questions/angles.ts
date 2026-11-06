/**
 * Angles, pure: the ways a topic is asked, per form, read off the papers in the bank. Two things come out of the real question text and nothing is written by hand or by a model:
 *   - the opening phrases ("Explain why", "Explain how", "Explain the effect") with how many questions open that way, and
 *   - a few real examples (part ids) of the form on that topic, which the app shows as the board's own question and mark scheme pictures.
 * The build (scripts/question-bank/build-insights.ts) runs these and writes `<slug>.angles.json`; the app reads that file only for Pro students, when they open an Angles panel.
 */
import { isForm, type Form } from "./questionForm";

/** Words an opening phrase may not end on ("explain the" says nothing; "explain the effect" does). */
const FUNCTION_WORDS = new Set(["the", "a", "an", "of", "in", "to", "for", "and", "or", "that", "this", "these", "those", "is", "are", "was", "were", "be", "by", "on", "with", "from", "at", "as", "its", "their", "it", "which", "whose", "when", "than", "into", "between", "your", "each", "any", "some", "one", "two", "three"]);
const MAX_WORDS = 5;
const WORD = /^[a-z][a-z'’-]*$/;

/**
 * The opening phrases for a set of asks (each the words of one question's ask, from `askWords`): a phrase is shown only if at least `min` real questions open with exactly those words
 * (never invented, never paraphrased), it does not end on a joining word, and a longer phrase takes the place of a shorter one it makes up most of. Most common first.
 */
export function openingPhrases(asks: readonly (readonly string[])[], max = 4, min = 2): [string, number][] {
  const counts = new Map<string, number>();
  for (const words of asks) {
    for (let k = 2; k <= Math.min(MAX_WORDS, words.length); k++) {
      const head = words.slice(0, k);
      if (!head.every((w) => WORD.test(w)) || FUNCTION_WORDS.has(head[k - 1])) continue;
      const key = head.join(" ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const cands = [...counts].filter(([, n]) => n >= min);
  const covered = (a: string, n: number) => cands.some(([b, m]) => b.length > a.length && b.startsWith(`${a} `) && m >= 0.6 * n);
  const kept: [string, number][] = [];
  for (const [phrase, n] of [...cands].sort((x, y) => x[0].split(" ").length - y[0].split(" ").length || (x[0] < y[0] ? -1 : 1))) {
    if (covered(phrase, n)) continue;
    if (kept.some(([a]) => phrase.startsWith(`${a} `))) continue;
    kept.push([phrase, n]);
  }
  return kept.sort((x, y) => y[1] - x[1] || y[0].split(" ").length - x[0].split(" ").length || (x[0] < y[0] ? -1 : 1)).slice(0, max);
}

/** A phrase as a student reads it: capital first letter. (The ellipsis is drawn by the screen.) */
export const phraseText = (p: string): string => p.charAt(0).toUpperCase() + p.slice(1);

/** FNV-1a: a steady hash of an id, so "random" examples are the same on every build. */
export function hashId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export interface ExampleCandidate { id: string; series: string; marks: number | null }

/**
 * Up to `n` examples, spread across exams and across marks: each pick is the candidate that adds the most that is new (a new exam counts most, then a new mark value), ties broken by
 * a steady hash of the id. The same candidates always give the same examples.
 */
export function pickExamples(cands: readonly ExampleCandidate[], n = 4): string[] {
  const left = [...cands].sort((a, b) => hashId(a.id) - hashId(b.id) || (a.id < b.id ? -1 : 1));
  const seenS = new Set<string>(), seenM = new Set<number | null>();
  const out: string[] = [];
  while (out.length < n && left.length) {
    let best = 0, bestScore = -1;
    left.forEach((c, i) => { const score = (seenS.has(c.series) ? 0 : 2) + (seenM.has(c.marks) ? 0 : 1); if (score > bestScore) { best = i; bestScore = score; } });
    const [c] = left.splice(best, 1);
    seenS.add(c.series); seenM.add(c.marks);
    out.push(c.id);
  }
  return out;
}

/** One form on one topic: its opening phrases with counts, and example part ids (grouped-id form, see `Angles.g`). */
export interface FormAngles { p: [string, number][]; e: string[] }
export interface Angles {
  v: 1;
  slug: string;
  built: Record<string, string>;
  /** Part-id groups ("h42001-jun25"); an example is "<group index>:<rest of the id>". */
  g: string[];
  /** By topic code, by form id. */
  topics: Record<string, Partial<Record<Form, FormAngles>>>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The file, checked on arrival: anything that is not what it should be is null. */
export function cleanAngles(raw: unknown): Angles | null {
  if (!isObj(raw) || raw.v !== 1 || typeof raw.slug !== "string" || !Array.isArray(raw.g) || !raw.g.every((x) => typeof x === "string") || !isObj(raw.topics)) return null;
  const built: Record<string, string> = {};
  if (isObj(raw.built)) for (const [k, v] of Object.entries(raw.built)) if (typeof v === "string") built[k] = v;
  const topics: Angles["topics"] = {};
  for (const [code, forms] of Object.entries(raw.topics)) {
    if (!isObj(forms)) return null;
    const out: Partial<Record<Form, FormAngles>> = {};
    for (const [f, a] of Object.entries(forms)) {
      if (!isForm(f) || !isObj(a) || !Array.isArray(a.p) || !Array.isArray(a.e)) return null;
      const p = a.p.map((x) => (Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "number" && Number.isInteger(x[1]) && x[1] >= 0 ? ([x[0], x[1]] as [string, number]) : null));
      if (p.some((x) => x === null) || !a.e.every((x) => typeof x === "string" && /^\d+:/.test(x))) return null;
      out[f] = { p: p as [string, number][], e: a.e as string[] };
    }
    topics[code] = out;
  }
  return { v: 1, slug: raw.slug, built, g: raw.g as string[], topics };
}

/** An example "3:16-bii" back to the part id "h42001-jun25-16-bii" ("" rest: the group is the whole id). Null if it does not point into `g`. */
export function exampleId(a: Pick<Angles, "g">, e: string): string | null {
  const i = e.indexOf(":");
  const group = a.g[Number(e.slice(0, i))];
  if (i < 0 || group === undefined) return null;
  const rest = e.slice(i + 1);
  return rest ? `${group}-${rest}` : group;
}
