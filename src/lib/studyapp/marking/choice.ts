import type { MarkReply } from "./api";

/**
 * Multiple choice needs no AI: the bank holds the answer letter (`part.k`), so a student's letter is checked against it here, exactly, in the browser.
 * Nothing is sent anywhere and no mark is spent. The only way to be unsure is not knowing which letter the student meant, and then nothing is marked: it
 * asks for one letter. A misread is never a wrong mark: handwriting is read into a letter first, and the student checks that letter before it is compared.
 */
export type Choice = { kind: "letter"; letter: string } | { kind: "none" } | { kind: "several" };

const OPTION = /^[A-H]$/;
const LEAD_IN = /^(?:THE\s+)?(?:ANSWER|ANS|OPTION|CHOICE)\s*(?:IS|:|=)?\s*/;

/** The one option letter a student wrote, or why it is not clear. "C", "c", "(C)", "C.", "Answer: C" are all C; "B or C" is several; "I think C" is none (a sentence is not an answer). */
export function readChoice(raw: string): Choice {
  const s = raw.normalize("NFKC").toUpperCase().replace(/[“”"'`]/g, " ").trim();
  const t = s.replace(LEAD_IN, "").replace(/[().:;,\s]+/g, " ").trim();
  if (t === "") return { kind: "none" };
  const tokens = t.split(" ");
  if (tokens.length === 1 && OPTION.test(tokens[0])) return { kind: "letter", letter: tokens[0] };
  const letters = new Set(tokens.filter((x) => OPTION.test(x)));
  return letters.size >= 2 ? { kind: "several" } : { kind: "none" };
}

/** The result card's data for a letter marked against the key. Same shape the server sends, so the same card draws it. `marks` is the part's printed marks (1 in every bank) or nothing. */
export function markChoice(key: string, printedMarks: number, letter: string): MarkReply {
  const right = letter.toUpperCase() === key.trim().toUpperCase();
  const outOf = Math.max(1, printedMarks);
  return {
    marks: right ? outOf : 0,
    outOf,
    anyHeld: false,
    rulesVersion: 0,
    packHash: null,
    points: [right
      ? { n: 1, status: "awarded", evidence: letter.toUpperCase(), reason: "That is the answer." }
      : { n: 1, status: "not_awarded", evidence: null, reason: `The answer is ${key.trim().toUpperCase()}.` }],
  };
}

/** What a student reads when the letter is not clear. One short line. */
export const CHOICE_LINE = "Write just the letter you chose, like B.";
