/**
 * Bold on a card: words wrapped in `**` are drawn bold, the way the iPad app does it (Features/Flashcards/CardBold.swift: the markers are
 * stored in the card's own text, so a card nobody bolds is byte for byte what it was). Pure, and tested (boldText.test.ts).
 *
 * The rules, and where this is stricter than the iPad:
 *   - A marker is `**` outside maths. A `$...$`, `$$...$$`, `\(...\)` or `\[...\]` span is one indivisible piece (the iPad's delimiters):
 *     a `**` inside one is just characters.
 *   - Markers pair up left to right. Only a PAIR makes bold. The iPad lets a last unclosed `**` bold to the end of the side; here it stays
 *     literal, so a stray `**` a student typed (or an Anki import) is never silently turned into a wall of bold.
 *   - An empty pair (`****`) stays literal too. Nothing is ever hidden: every character that is not part of a marker pair is shown.
 *   - The text becomes React text and `<strong>` nodes in the component (BoldText.tsx): never HTML.
 */
export interface Run { text: string; bold: boolean }

/** Where a delimited maths span that opens at `start` ends (exclusive), or null: the iPad's `CardBold.mathEnd`, same delimiters in the same order. */
function mathEnd(s: string, start: number): number | null {
  const c = s[start], next = s[start + 1];
  const find = (needle: string, from: number) => { const at = s.indexOf(needle, from); return at < 0 ? null : at; };
  if (c === "$" && next === "$") { const e = find("$$", start + 2); if (e !== null) return e + 2; }
  if (c === "\\" && next === "[") { const e = find("\\]", start + 2); if (e !== null) return e + 2; }
  if (c === "$") { const e = find("$", start + 1); if (e !== null) return e + 1; }
  if (c === "\\" && next === "(") { const e = find("\\)", start + 2); if (e !== null) return e + 2; }
  return null;
}

/** The text as runs of plain and bold. Joined, the runs are the text with its marker pairs taken out. */
export function boldRuns(text: string): Run[] {
  if (!text.includes("**")) return text ? [{ text, bold: false }] : [];
  // Where each `**` outside maths sits.
  const marks: number[] = [];
  for (let i = 0; i < text.length;) {
    if (text[i] === "*" && text[i + 1] === "*") { marks.push(i); i += 2; continue; }
    const end = mathEnd(text, i);
    i = end ?? i + 1;
  }
  const runs: Run[] = [];
  const push = (t: string, bold: boolean) => {
    if (!t) return;
    const last = runs[runs.length - 1];
    if (last && last.bold === bold) last.text += t; else runs.push({ text: t, bold });
  };
  let at = 0;
  for (let m = 0; m + 1 < marks.length; m += 2) {
    const open = marks[m], close = marks[m + 1];
    if (close === open + 2) continue; // `****`: empty, left as typed
    push(text.slice(at, open), false);
    push(text.slice(open + 2, close), true);
    at = close + 2;
  }
  push(text.slice(at), false);
  return runs;
}

/** What the text says without its bold markers: for sizing, and for a screen reader. */
export const plainText = (text: string): string => boldRuns(text).map((r) => r.text).join("");
