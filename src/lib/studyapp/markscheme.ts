/**
 * Mark scheme cards, as the iPad writes and reads them (Features/Flashcards/MarkSchemeCards.swift, `MarkSchemeText`): a card stays an ordinary card
 * with plain text, and the review screen sets it out from fixed leads. Pure, and tested (markscheme.test.ts).
 *
 *   front: the question, a blank line, then "[n mark(s)]"
 *   back:  one line a marking point, led by "• " (a line ending in a colon introduces the points under it and is not a point), then the
 *          board's own lines under it: "Also accept: ", "Not accepted: ", "Ignore: ", "Note: ". `**` wraps the words the board underlines.
 *
 * `back` and `front` write that text (the build uses them); `parseBack` and `parseFront` read it for display, so a card a student has edited still
 * looks right, and a card they wrote themselves in the same form is set out the same way.
 */
export const LEADS = { accept: "Also accept: ", not: "Not accepted: ", ignore: "Ignore: ", note: "Note: ", bullet: "• " } as const;

export interface MarkSchemeCardData { prompt: string; marks: number; answer: string; allow: readonly string[]; not: readonly string[]; ignore: readonly string[]; notes: readonly string[] }

export const writeFront = (prompt: string, marks: number): string => `${prompt}\n\n[${marks} mark${marks === 1 ? "" : "s"}]`;

export function writeBack(c: Pick<MarkSchemeCardData, "answer" | "allow" | "not" | "ignore" | "notes">): string {
  const lines = c.answer.split("\n").filter((l) => l !== "");
  const out = lines.length > 1 ? lines.map((l) => (l.endsWith(":") ? l : LEADS.bullet + l)) : lines;
  return [...out, ...c.allow.map((a) => LEADS.accept + a), ...c.not.map((a) => LEADS.not + a), ...c.ignore.map((a) => LEADS.ignore + a), ...c.notes.map((a) => LEADS.note + a)].join("\n");
}

export type Row = { kind: "lead"; text: string } | { kind: "point"; text: string } | { kind: "either" };
export interface Answer { rows: Row[]; accepted: string[]; rejected: string[]; ignored: string[]; notes: string[] }

/** The board's own "or" / "and" line between alternatives, which is not a marking point of its own. */
const isSeparator = (words: string) => ["or", "and", "either", "either:"].includes(words.replace(/^[* ]+|[* ]+$/g, "").toLowerCase());

/** Whether a back is one of these: a marking point or one of the board's lines in the fixed form. */
export function isStructured(back: string): boolean {
  return back.split("\n").some((l) => l.startsWith(LEADS.bullet) || l.startsWith(LEADS.accept) || l.startsWith(LEADS.not) || l.startsWith(LEADS.ignore) || l.startsWith(LEADS.note));
}

export function parseBack(back: string): Answer {
  const a: Answer = { rows: [], accepted: [], rejected: [], ignored: [], notes: [] };
  for (const line of back.split("\n")) {
    if (line === "") continue;
    if (line.startsWith(LEADS.accept)) a.accepted.push(line.slice(LEADS.accept.length));
    else if (line.startsWith(LEADS.not)) a.rejected.push(line.slice(LEADS.not.length));
    else if (line.startsWith(LEADS.ignore)) a.ignored.push(line.slice(LEADS.ignore.length));
    else if (line.startsWith(LEADS.note)) a.notes.push(line.slice(LEADS.note.length));
    else if (line.startsWith(LEADS.bullet)) { const w = line.slice(LEADS.bullet.length); a.rows.push(isSeparator(w) ? { kind: "either" } : { kind: "point", text: w }); }
    else a.rows.push({ kind: "lead", text: line });
  }
  return a;
}

/** A front split into the question and its marks, if it ends in "[n mark(s)]" (`marks` is "3 marks"). */
export function parseFront(front: string): { question: string; marks: string | null } {
  const t = front.trim();
  const open = t.lastIndexOf("[");
  if (open < 0 || !t.endsWith("]")) return { question: t, marks: null };
  const tag = t.slice(open + 1, -1);
  const parts = tag.split(" ").filter((p) => p !== "");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || (parts[1] !== "mark" && parts[1] !== "marks")) return { question: t, marks: null };
  const question = t.slice(0, open).trim();
  return { question: question === "" ? t : question, marks: tag };
}

/** How much the answer holds, for the size it is set at. */
export function answerLength(a: Answer): number {
  return a.rows.reduce((n, r) => n + (r.kind === "either" ? 0 : r.text.length), 0) + [...a.accepted, ...a.rejected, ...a.ignored, ...a.notes].reduce((n, s) => n + s.length, 0);
}
