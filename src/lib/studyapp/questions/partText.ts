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

export function questionText(raw: string | undefined, part: Pick<QPart, "m" | "x">): PartText {
  const opening = tidy(part.x ?? "");
  if (!raw) return { text: opening, whole: false };
  let end = raw.length;
  const head = SCHEME_HEAD.exec(raw);
  if (head) end = Math.min(end, head.index);
  if (part.m && part.m > 0) {
    const m = String(part.m);
    const mark = new RegExp(`\\[\\s*${m}\\s*(?:marks?)?\\s*\\]|\\(\\s*${m}\\s*\\)`, "g");
    for (let hit = mark.exec(raw); hit; hit = mark.exec(raw)) {
      if (hit.index < 12) continue;   // a "(2)" in the first words is not the end of a question
      end = Math.min(end, hit.index + hit[0].length);
      break;
    }
  }
  const cut = raw.slice(0, end);
  // Nothing found to cut at: this is the whole page, scheme and all. Not for showing.
  if (end === raw.length) return { text: opening, whole: false };
  const t = tidy(cut);
  return t.length >= 12 ? { text: t, whole: true } : { text: opening, whole: false };
}

/** text.json per subject, fetched once someone opens "Read as text"; a failure is not remembered, so a retry works. */
const files = new Map<string, Promise<Record<string, string>>>();

export function partText(slug: string, part: Pick<QPart, "id" | "m" | "x">, url: string): Promise<PartText> {
  let p = files.get(slug);
  if (!p) {
    p = fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Record<string, string>>; });
    files.set(slug, p);
    p.catch(() => files.delete(slug));
  }
  return p.then((all) => questionText(typeof all?.[part.id] === "string" ? all[part.id] : undefined, part)).catch(() => questionText(undefined, part));
}
