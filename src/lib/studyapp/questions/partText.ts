/**
 * "Read as text" for a part: the question's own words, for a screen reader, text to speech, or a student who finds the
 * picture hard to read. The bank's `text.json` holds the whole of a part's page (the question and, after it, the mark scheme)
 * as one folded string, with no field that says where the question ends. So the rule is deliberately cautious: the text is
 * cut at the first thing that can only be the end of the question, and if none is found the student is given the opening
 * words the bank keeps (`x`) and told that is all there is. A mark scheme is never shown from here; it is shown when asked for.
 * (The real fix is for the bank build to write the question and the scheme as two strings: see docs/study/questions.md.)
 */
import type { QPart } from "./model";

/** The heading row of a printed mark scheme table, in the wording the boards use. */
const SCHEME_HEAD = /\bquestion\s+(?:number\s+)?answers?\s+(?:mark\s+)?(?:mark scheme\s+)?(?:extra information|additional|guidance|comments|ao\b|marks?\b)/;

export interface PartText {
  text: string;
  /** True when this is the question as far as the paper's text can tell; false when it is only the opening words. */
  whole: boolean;
}

const tidy = (t: string) => {
  const s = t.replace(/\s+/g, " ").trim().replace(/^(?:\d\s){2}(?=\D)/, "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
};

/** The opening words are the whole question when they already end with the printed marks: "Which shop impressed her? [1 mark]". */
const endsWithMarks = (t: string) => /\[\s*\d+\s*marks?\s*\]$/i.test(t);

/** Where the question ends in the page's text, or null if nothing says. */
function questionEnd(raw: string, part: Pick<QPart, "m">): number | null {
  let end = raw.length;
  const head = SCHEME_HEAD.exec(raw);
  if (head) end = Math.min(end, head.index);
  if (part.m && part.m > 0) {
    const m = String(part.m);
    const mark = new RegExp(`\\[\\s*${m}\\s*(?:marks?)?\\s*\\]|\\(\\s*${m}\\s*\\)`, "g");
    for (let hit = mark.exec(raw); hit; hit = mark.exec(raw)) {
      if (hit.index < 12) continue;
      end = Math.min(end, hit.index + hit[0].length);
      break;
    }
  }
  return end === raw.length ? null : end;
}

export function questionText(raw: string | undefined, part: Pick<QPart, "m" | "x">): PartText {
  const opening = tidy(part.x ?? "");
  // A short question: the bank's opening words already reach its marks, so they are all of it (nothing to apologise for).
  const shortWhole = opening.length >= 8 && endsWithMarks(opening);
  if (!raw) return { text: opening, whole: shortWhole };
  const found = questionEnd(raw, part);
  const end = found ?? raw.length;
  const cut = raw.slice(0, end);
  // Nothing found to cut at: this is the whole page, scheme and all. Not for showing.
  if (end === raw.length) return { text: opening, whole: shortWhole };
  const t = tidy(cut);
  return t.length >= 12 ? { text: t, whole: true } : { text: opening, whole: shortWhole };
}

/** The heading row of a mark scheme table, every word the boards put in it, up to the first mark or number of the scheme itself. */
const SCHEME_ROW = /\bquestion\s+(?:(?:number|answers?|key ideas|extra information|additional(?:\s+comments)?(?:\s*\/\s*guidance)?|guidance|comments|mark scheme|marks?|partial marks|accept|reject|ao|spec\.?\s*ref\.?|\/)\s*)+/;

export interface SchemeText {
  /** The scheme's words as the paper's text has them (may read out of order where it was a table); empty if they cannot be told apart from the question. */
  text: string;
}

/**
 * The mark scheme of a part as text, for a student who cannot use the picture. The paper's text is one string for a part's page (the
 * question, then its scheme), so the scheme is what follows the end of the question (`questionEnd`), without the table's heading row.
 * Where the end of the question cannot be found there is no text to give, and it says so; it is never guessed.
 */
export function schemeText(raw: string | undefined, part: Pick<QPart, "m">): SchemeText {
  if (!raw) return { text: "" };
  const end = questionEnd(raw, part);
  if (end === null) return { text: "" };
  let rest = raw.slice(end).replace(/\s+/g, " ").trim();
  // Drop the table's heading row, and anything of the question's own answer lines that sits before it.
  const row = SCHEME_ROW.exec(rest);
  if (row && row.index < 240) rest = rest.slice(row.index + row[0].length).trim();
  rest = rest.replace(/[\uE000-\uF8FF]/g, " ").replace(/\s+/g, " ").trim();
  if (rest.length < 3) return { text: "" };
  const MAX = 1800;
  if (rest.length > MAX) { const cut = rest.slice(0, MAX); rest = `${cut.slice(0, Math.max(MAX * 0.8, cut.lastIndexOf(" "))).trim()}\u2026`; }
  return { text: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

/** text.json per subject, fetched once someone opens "Read as text"; a failure is not remembered, so a retry works. */
const files = new Map<string, Promise<Record<string, string>>>();

function fileFor(slug: string, url: string): Promise<Record<string, string>> {
  let p = files.get(slug);
  if (!p) {
    p = fetch(url, { signal: AbortSignal.timeout?.(15_000) }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Record<string, string>>; });
    files.set(slug, p);
    p.catch(() => files.delete(slug));
  }
  return p;
}

export function partText(slug: string, part: Pick<QPart, "id" | "m" | "x">, url: string): Promise<PartText> {
  return fileFor(slug, url).then((all) => questionText(typeof all?.[part.id] === "string" ? all[part.id] : undefined, part)).catch(() => questionText(undefined, part));
}

/** The mark scheme of a part as text, or null if the file would not load (so the caller can offer to try again). */
export function partSchemeText(slug: string, part: Pick<QPart, "id" | "m">, url: string): Promise<SchemeText | null> {
  return fileFor(slug, url).then((all) => schemeText(typeof all?.[part.id] === "string" ? all[part.id] : undefined, part)).catch(() => null);
}
