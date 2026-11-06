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
export function mathEnd(s: string, start: number): number | null {
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

/**
 * Superscripts and subscripts. A maths span (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`) is read for `^` and `_`: `10^{8}`, `m s^{-1}`, `SO_4^{2-}`, `cm^3`,
 * `x_i`. After the mark comes `{...}` (to the next `}`), or a signed or plain run of digits, or one character. Nothing else in a span is changed, and
 * nothing outside a span is ever read: a student's `snake_case` or `2^3` typed in plain text stays exactly as typed. The delimiters are not shown.
 * A `^` or `_` with nothing after it, and a span that is not closed, stay literal. Rendered as <sup> and <sub> nodes (RichText.tsx), never HTML.
 */
export interface RichRun { text: string; bold: boolean; script?: "sup" | "sub" }

const DELIMS: [string, string][] = [["$$", "$$"], ["\\[", "\\]"], ["$", "$"], ["\\(", "\\)"]];

/** A maths span's content split into plain and script runs. */
export function scriptRuns(content: string): { text: string; script?: "sup" | "sub" }[] {
  const out: { text: string; script?: "sup" | "sub" }[] = [];
  let plain = "";
  const flush = () => { if (plain) { out.push({ text: plain }); plain = ""; } };
  for (let i = 0; i < content.length;) {
    const c = content[i];
    if (c === "^" || c === "_") {
      let j = i + 1, arg = "";
      if (content[j] === "{") {
        const close = content.indexOf("}", j + 1);
        if (close > j) { arg = content.slice(j + 1, close); j = close + 1; }
      } else {
        const m = /^[+\-\u2212]?\d+/.exec(content.slice(j));
        if (m) { arg = m[0]; j += m[0].length; } else if (j < content.length) { arg = content[j]; j += 1; }
      }
      if (arg) { flush(); out.push({ text: arg, script: c === "^" ? "sup" : "sub" }); i = j; continue; }
    }
    plain += c; i += 1;
  }
  flush();
  return out;
}

/** The text as runs of plain, bold, sup and sub. `bold: false` drops the `**` markers (the iPad's bands show the board's lines without them). */
export function richRuns(text: string, opts: { bold?: boolean } = {}): RichRun[] {
  const out: RichRun[] = [];
  for (const run of boldRuns(text)) {
    const bold = run.bold && opts.bold !== false;
    const t = run.text;
    let at = 0, plainFrom = 0;
    const push = (x: string, script?: "sup" | "sub") => { if (x) out.push({ text: x, bold, ...(script ? { script } : {}) }); };
    while (at < t.length) {
      const end = mathEnd(t, at);
      if (end === null) { at += 1; continue; }
      const d = DELIMS.find(([o]) => t.startsWith(o, at))!;
      push(t.slice(plainFrom, at));
      for (const r of scriptRuns(t.slice(at + d[0].length, end - d[1].length))) push(r.text, r.script);
      at = end; plainFrom = end;
    }
    push(t.slice(plainFrom));
  }
  return out;
}

/** What the text says without its markers (bold, maths delimiters, script marks): for sizing, and for a screen reader. */
export const plainText = (text: string): string => richRuns(text).map((r) => r.text).join("");
