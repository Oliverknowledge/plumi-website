/**
 * A part's question as text, cut out of the bank's `text.json` (used by the Topic analysis build, scripts/question-bank/build-insights.ts, to say how a part is asked; there is no
 * "Read as text" in the app). The bank's `text.json` holds the whole of a part's page (the question and, after it, the mark scheme)
 * as one folded string, with no field that says where the question ends. So the rule is deliberately cautious: the text is
 * cut at the first thing that can only be the end of the question, and if none is found the student is given the opening
 * words the bank keeps (`x`) and told that is all there is. The mark scheme is never part of it.
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
