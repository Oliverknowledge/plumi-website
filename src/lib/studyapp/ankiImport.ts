/**
 * Reading a list of cards a student brings in: Anki's "Notes in Plain Text" export, a CSV or TSV from anywhere
 * else, or a few lines pasted by hand. Pure text in, plain text out: nothing here builds HTML, and every card is
 * shown by React as text, so even hostile input can only ever appear as characters.
 *
 * Anki's export begins with header lines ("#separator:tab", "#html:true", "#deck column:3") and then one note a
 * line, fields split by the declared separator, a field in double quotes when it holds the separator, a quote or a
 * line break. A package (.apkg) is a zip of a database and media; it is not text and is not supported.
 */

export const MAX_IMPORT_BYTES = 1_000_000;
export const MAX_IMPORT_CARDS = 5000;
/** What a card holds (model.ts addCard clips to these); an import says how many it will shorten. */
const FRONT_MAX = 400;
const BACK_MAX = 800;

export type ImportProblem = "empty" | "too_big" | "too_many" | "package" | "no_cards";

export interface ImportParse {
  cards: [string, string][];
  /** Notes that had no usable front and back (a missing field, or only a picture). */
  skipped: number;
  /** Cards whose text is longer than a card holds, so it will be cut short. */
  cut: number;
  /** A deck name from the file ("Chemistry::Rates" gives "Rates"), if it says one. */
  deckName: string | null;
  /** True when the file carried Anki's header lines. */
  anki: boolean;
  problem: ImportProblem | null;
}

/** Plain English for each way an import can fail to start. */
export function importProblemText(p: ImportProblem): string {
  switch (p) {
    case "empty": return "There is nothing to read yet.";
    case "too_big": return `That is bigger than ${MAX_IMPORT_BYTES / 1_000_000} MB. Export fewer notes, or split it into two files.`;
    case "too_many": return `That is more than ${MAX_IMPORT_CARDS} cards. Split it into smaller files and add them one at a time.`;
    case "package": return "That looks like an Anki package (.apkg), which Plumi cannot open. In Anki, choose File, then Export, then \"Notes in Plain Text\".";
    case "no_cards": return "No cards found. Each line needs a front and a back, split by a tab, a comma, a semicolon or a |.";
  }
}

const empty = (problem: ImportProblem): ImportParse => ({ cards: [], skipped: 0, cut: 0, deckName: null, anki: false, problem });

/* \u2500\u2500 Cleaning one field \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D", deg: "\u00B0", times: "\u00D7", divide: "\u00F7",
  plusmn: "\u00B1", middot: "\u00B7", minus: "\u2212", sup2: "\u00B2", sup3: "\u00B3", sup1: "\u00B9", frac12: "\u00BD",
  frac14: "\u00BC", frac34: "\u00BE", rarr: "\u2192", larr: "\u2190", harr: "\u2194", micro: "\u00B5", pi: "\u03C0",
  Delta: "\u0394", delta: "\u03B4", alpha: "\u03B1", beta: "\u03B2", gamma: "\u03B3", lambda: "\u03BB", mu: "\u03BC",
  theta: "\u03B8", sigma: "\u03C3", omega: "\u03C9", Omega: "\u03A9", le: "\u2264", ge: "\u2265", ne: "\u2260", asymp: "\u2248", radic: "\u221A", infin: "\u221E",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) || (code < 32 && code !== 10 && code !== 9)) return "";
      return String.fromCodePoint(code);
    }
    return NAMED[body] ?? NAMED[body.toLowerCase()] ?? whole;
  });
}

const SUP: Record<string, string> = { 0: "\u2070", 1: "\u00B9", 2: "\u00B2", 3: "\u00B3", 4: "\u2074", 5: "\u2075", 6: "\u2076", 7: "\u2077", 8: "\u2078", 9: "\u2079", "+": "\u207A", "-": "\u207B", "\u2212": "\u207B", "=": "\u207C", "(": "\u207D", ")": "\u207E", n: "\u207F", i: "\u2071" };
const SUB: Record<string, string> = { 0: "\u2080", 1: "\u2081", 2: "\u2082", 3: "\u2083", 4: "\u2084", 5: "\u2085", 6: "\u2086", 7: "\u2087", 8: "\u2088", 9: "\u2089", "+": "\u208A", "-": "\u208B", "\u2212": "\u208B", "=": "\u208C", "(": "\u208D", ")": "\u208E", a: "\u2090", e: "\u2091", o: "\u2092", x: "\u2093", h: "\u2095", k: "\u2096", l: "\u2097", m: "\u2098", n: "\u2099", p: "\u209A", s: "\u209B", t: "\u209C" };

/** Superscript two and subscript two (in place of "<sup>2</sup>" and "<sub>2</sub>") when every character has one; otherwise "^x" and "_x", so CH3 never loses what its 3 meant. */
function script(inner: string, table: Record<string, string>, fallback: string): string {
  const text = decodeEntities(inner.replace(/<[^<>]*>/g, "")).trim();
  if (!text) return "";
  const out = [...text].map((ch) => table[ch]);
  return out.every(Boolean) ? out.join("") : `${fallback}${text.length > 1 ? `(${text})` : text}`;
}

const BLOCK = "div|p|li|tr|h[1-6]|ul|ol|table|blockquote";

/** Anki's HTML field to plain text: line breaks kept, tags dropped, entities decoded, never any markup out. */
function htmlToText(s: string): string {
  let t = s.replace(/\[sound:[^\]]*\]/gi, "");
  t = t.replace(/<sup(?:\s[^<>]*)?>([\s\S]*?)<\/sup\s*>/gi, (_m, inner: string) => script(inner, SUP, "^"));
  t = t.replace(/<sub(?:\s[^<>]*)?>([\s\S]*?)<\/sub\s*>/gi, (_m, inner: string) => script(inner, SUB, "_"));
  t = t.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  t = t.replace(new RegExp(`<\\s*/\\s*(?:${BLOCK})\\s*>`, "gi"), "\n");
  t = t.replace(new RegExp(`<\\s*(?:${BLOCK})(?:\\s[^<>]*)?>`, "gi"), "\n");
  // Strip what is left, over and over: "<scr<b>ipt>" must not turn back into a tag once the inner one goes.
  for (let i = 0; i < 6; i++) { const next = t.replace(/<[^<>]*>/g, ""); if (next === t) break; t = next; }
  return decodeEntities(t);
}

/** Control characters, and the invisible marks that can make text read in a different order than it is written. */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function tidy(s: string): string {
  const lines = s.replace(INVISIBLE, "").replace(/\u00A0/g, " ").split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim());
  const out: string[] = [];
  for (const l of lines) { if (l === "" && (out.length === 0 || out[out.length - 1] === "")) continue; out.push(l); }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

const CLOZE = /\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g;
const hasCloze = (s: string) => /\{\{c\d+::/.test(s);

/* \u2500\u2500 Splitting a file into records and fields \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/**
 * Delimited text to records of fields. A field that begins with a double quote runs to its closing quote
 * (a doubled quote inside is one quote) and may hold the separator and line breaks. A quote that never closes
 * is an ordinary character, so a stray one cannot swallow the rest of the file.
 */
export function splitRecords(body: string, sep: string): string[][] {
  const records: string[][] = [];
  const n = body.length;
  if (n === 0) return records;
  let row: string[] = [];
  let i = 0;
  let quotesUsable = true;
  for (;;) {
    let field: string;
    if (body[i] === "\"" && quotesUsable) {
      // The closing quote is one followed by the separator, a line end or the end of the text.
      let j = i + 1, text = "", closed = false;
      while (j < n) {
        if (body[j] === "\"") {
          if (body[j + 1] === "\"") { text += "\""; j += 2; continue; }
          const after = body[j + 1];
          if (after === undefined || after === sep || after === "\n") { closed = true; break; }
        }
        text += body[j]; j++;
      }
      // Never closed: from here on a quote is just a character (and the scan is not repeated for every later one).
      if (!closed) { quotesUsable = false; continue; }
      field = text; i = j + 1;
    } else {
      let j = i;
      while (j < n && body[j] !== sep && body[j] !== "\n") j++;
      field = body.slice(i, j); i = j;
    }
    row.push(field);
    if (i >= n) { records.push(row); break; }
    if (body[i] === "\n") { records.push(row); row = []; i++; if (i >= n) break; continue; }
    i++; // past the separator: another field follows, even if it is empty
    if (i >= n) { row.push(""); records.push(row); break; }
  }
  return records;
}

const NAMES: Record<string, string> = { tab: "\t", comma: ",", semicolon: ";", pipe: "|", space: " ", colon: ":" };

/** The separator the file most plausibly uses, from its first lines: a tab if most have one, else ; or |, else a comma only when the field counts agree. */
function detectSeparator(body: string): { sep: string; mode: number } | null {
  const sample = body.slice(0, 20_000);
  const lines = sample.split("\n").filter((l) => l.trim()).length;
  if (lines === 0) return null;
  for (const sep of ["\t", ";", "|", ","]) {
    const recs = splitRecords(sample, sep).filter((r) => r.some((f) => f.trim()));
    const multi = recs.filter((r) => r.length >= 2);
    if (multi.length < Math.ceil(recs.length * 0.6) || multi.length === 0) continue;
    const counts = new Map<number, number>();
    for (const r of multi) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
    const [mode, same] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    if (sep === "," && same < Math.ceil(recs.length * 0.8)) continue;
    return { sep, mode };
  }
  return null;
}

/**
 * No one separator runs through the text (a hand-typed list, some lines split by a tab and some by a semicolon):
 * each line is split at the first tab, semicolon or " | " it has, and lines with none are skipped and counted.
 */
function parseLoose(text: string, html: boolean, anki: boolean): ImportParse {
  const cards: [string, string][] = [];
  let skipped = 0, cut = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const m = /^(.*?)(?:\t|;| \| )(.+)$/.exec(line);
    const front = m ? tidy(html ? htmlToText(m[1]) : m[1]) : "";
    const back = m ? tidy(html ? htmlToText(m[2]) : m[2]) : "";
    if (!front || !back) { skipped++; continue; }
    if (front.length > FRONT_MAX || back.length > BACK_MAX) cut++;
    cards.push([front, back]);
    if (cards.length > MAX_IMPORT_CARDS) return { cards: [], skipped, cut, deckName: null, anki, problem: "too_many" };
  }
  return { cards, skipped, cut, deckName: null, anki, problem: cards.length ? null : "no_cards" };
}

/* \u2500\u2500 The whole file \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

export function parseImport(input: string, fileName?: string): ImportParse {
  if (fileName && /\.(apkg|colpkg)$/i.test(fileName)) return empty("package");
  if (input.length > MAX_IMPORT_BYTES) return empty("too_big");
  if (input.startsWith("PK\u0003\u0004") || input.slice(0, 2000).includes("\u0000")) return empty("package");
  let text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return empty("empty");

  // Header lines: "#key:value", only at the very top.
  const headers = new Map<string, string>();
  let anki = false;
  for (;;) {
    if (!text.startsWith("#")) break;
    const end = text.indexOf("\n");
    const line = end < 0 ? text : text.slice(0, end);
    const m = /^#\s*([^:]+?)\s*:\s*(.*?)\s*$/.exec(line);
    if (m) { headers.set(m[1].toLowerCase(), m[2]); anki = true; }
    text = end < 0 ? "" : text.slice(end + 1);
  }
  if (!text.trim()) return { ...empty("no_cards"), anki };

  const declared = headers.get("separator");
  let sep: string | null = null;
  let mode = 0;
  const wanted = declared === undefined ? undefined : NAMES[declared.toLowerCase()] ?? (declared.length === 1 ? declared : undefined);
  if (wanted !== undefined) sep = wanted;
  else { const found = detectSeparator(text); if (found) { sep = found.sep; mode = found.mode; } }
  const html = (headers.get("html") ?? "").toLowerCase() === "true";
  if (sep === null) return parseLoose(text, html, anki);

  const meta = new Set<number>();
  for (const key of ["guid column", "notetype column", "deck column", "tags column"]) {
    const v = Number(headers.get(key));
    if (Number.isInteger(v) && v >= 1) meta.add(v - 1);
  }
  const deckCol = Number(headers.get("deck column"));

  const cards: [string, string][] = [];
  let skipped = 0, cut = 0;
  let deckName: string | null = null;
  const field = (raw: string) => tidy(html ? htmlToText(raw) : raw);

  for (const rec of splitRecords(text, sep)) {
    if (!rec.some((f) => f.trim())) continue;
    if (deckName === null && Number.isInteger(deckCol) && deckCol >= 1 && rec[deckCol - 1]) {
      const d = tidy(html ? htmlToText(rec[deckCol - 1]) : rec[deckCol - 1]).split("::").pop()?.trim();
      if (d) deckName = d.slice(0, 50);
    }
    const fields = rec.filter((_, idx) => !meta.has(idx));
    let front = field(fields[0] ?? "");
    let back: string;
    if (hasCloze(fields[0] ?? "") && front) {
      // A cloze note: the card asks for the blanks and answers with the whole sentence.
      const whole = front;
      back = tidy(whole.replace(CLOZE, "$1") + (fields[1] && field(fields[1]) ? `\n${field(fields[1])}` : ""));
      front = tidy(whole.replace(CLOZE, "[...]"));
    } else if (fields.length > 2 && wanted === undefined && sep !== "\t" && mode === 2) {
      // Prose that merely contains the separator: everything after the first one is the answer.
      back = field(fields.slice(1).join(sep));
    } else {
      back = field(fields[1] ?? "");
    }
    if (!front || !back) { skipped++; continue; }
    if (front.length > FRONT_MAX || back.length > BACK_MAX) cut++;
    cards.push([front, back]);
    if (cards.length > MAX_IMPORT_CARDS) return { cards: [], skipped, cut, deckName, anki, problem: "too_many" };
  }
  if (cards.length === 0) return { cards, skipped, cut, deckName, anki, problem: "no_cards" };
  return { cards, skipped, cut, deckName, anki, problem: null };
}

/** A deck name from a file name: "Chemistry Rates.txt" gives "Chemistry Rates"; Anki's own default names give nothing. */
export function deckNameFromFile(fileName: string): string | null {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 50);
  return !base || /^(notes in plain text|default|untitled)$/i.test(base) ? null : base;
}
