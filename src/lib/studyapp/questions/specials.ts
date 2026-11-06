import { papersBase } from "./cropUrls";

/**
 * The files a paper carries apart from its question, mark scheme and report, and which questions need them open (the audit is in
 * the round 7 notes: `scratchpad/qfix/r7-fix/SPECIAL-FIELDS.md`). The public bank page shows them on the question row; the feed card and the sheet use the
 * same rule, so a History source question is never left with no way to read its sources.
 *
 * - `ins`: the booklet a question is read against (sources, interpretations, extracts, poetry, reading texts, the resource booklet, an insert).
 * - `code`: the code files (a zip) a paper sat on screen opens.
 * - `tr`: the transcript of a listening paper's recording.
 */
export interface PaperFiles { ins?: Record<string, string>; code?: Record<string, string>; trs?: Record<string, string> }

/** The words of a question that say it reads the paper's sources, extracts or texts (the public bank page's rule). */
const READS_SOURCES = /\bsources?\b|\bextracts?\b|\blines? \d|\btext [A-D12]\b|\btwo texts\b|\bthe writers?\b/i;
/** A History question on an interpretation reads it in the booklet; so does a science or maths one on the insert, the article or the advance notice. */
const READS_INTERPRETATION = /\binterpretations?\b/i;
const READS_INSERT = /\binserts?\b|\barticle\b|\badvance notice\b|\bpre-?release\b|\bpassage\b|\bresources?\b|\bbooklet\b/i;
const READS_FIGURE = /\bfig(?:ure)?s?\b\.?\s*\d|\bresources?\b|\bbooklet\b/i;

/** What a booklet is called to the student, by subject. */
export function insertKind(subject: string): { noun: string; what: string } {
  const s = subject.replace(/ [AB]$/, "");
  if (s === "French" || s === "Spanish") return { noun: "reading texts", what: "the reading texts" };
  if (s === "Geography") return { noun: "resource booklet", what: "the resource booklet" };
  if (s === "History" || s === "English Language" || s === "English Literature") return { noun: "source booklet", what: "the source booklet" };
  return { noun: "insert", what: "the insert" };
}

/** Every question of these subjects' papers with a booklet is read against it (the paper is built on it). */
const ALWAYS = new Set(["English Language", "English Literature", "Geography"]);
/** An English Language writing task ("Write a description...", "Write an article...") is self-contained: it needs no source. */
const WRITING_TASK = /\bwrite (?:a|an|the|about|what|your|opinion|out)\b|\bwrite\b.{0,40}\b(?:article|speech|talk|letter|story|description|guide|review)\b|^\s*a\) write|you are asked to give a talk|(?:magazine|newspaper|website) (?:has|have) asked/i;
/** ... and every question of these papers: OCR's Scientific literacy papers are built on the advance notice. */
const ALWAYS_SUBJECTS = new Set(["Chemistry B", "Physics B"]);

/** Does this question need the paper's booklet open? (`x` is the question's opening words; `src` the bank's own flag for a reading question whose words do not say so.) */
export function needsInsert(subject: string, part: { x?: string; src?: 1; m?: number | null }): boolean {
  const s = subject.replace(/ [AB]$/, "");
  if (part.src) return true;
  const x = part.x ?? "";
  // (the bank keeps only the first words of a question, so a long writing task is known by its 40 marks as well as by its words)
  if (s === "English Language" && !READS_SOURCES.test(x) && (WRITING_TASK.test(x) || (part.m ?? 0) >= 40)) return false;
  if (ALWAYS.has(s) || ALWAYS_SUBJECTS.has(subject)) return true;
  if (READS_SOURCES.test(x)) return true;
  if (s === "History") return READS_INTERPRETATION.test(x);
  // Languages: a reading text is named by the bank's flag or the words above.
  if (s === "French" || s === "Spanish") return false;
  return READS_INSERT.test(x) || (s === "Geography" && READS_FIGURE.test(x));
}

export interface Special { kind: "ins" | "code" | "tr"; href: string; label: string; download?: true }

const safe = (v: string | undefined) => (v && /^[\w./-]{3,200}$/.test(v) && !v.includes("..") ? v : undefined);
const find = (m: Record<string, string> | undefined, p: string, s: string) => safe(m?.[`${p}-${s}`] ?? m?.[`${p.toLowerCase()}-${s}`] ?? m?.[`${p.toUpperCase()}-${s}`]);

/** The transcript of a paper's recording, relative to the papers base, if the bank has one. */
export const transcriptOf = (trs: Record<string, string> | undefined, p: string, s: string) => find(trs, p, s) ?? null;

/** The booklet, code files and transcript this question of this paper offers, in that order. `listening` is whether the question has a recording (a transcript is for those). */
export function specialsFor(meta: PaperFiles & { subject: string }, part: { p: string; s: string; x?: string; src?: 1; au?: string; m?: number | null }): Special[] {
  const out: Special[] = [];
  const ins = find(meta.ins, part.p, part.s);
  if (ins && needsInsert(meta.subject, part)) {
    const k = insertKind(meta.subject);
    out.push({ kind: "ins", href: `${papersBase}/${ins}`, label: `Open ${k.what} (PDF)` });
  }
  const code = find(meta.code, part.p, part.s);
  if (code) out.push({ kind: "code", href: `${papersBase}/${code}`, label: "Download the code files (zip)", download: true });
  const tr = find(meta.trs, part.p, part.s);
  if (tr && part.au) out.push({ kind: "tr", href: `${papersBase}/${tr}`, label: "Transcript (PDF)" });
  return out;
}

/** The files of a whole paper (the sheet's header): the booklet and the code files, for the paper `p` of sitting `s`. */
export function paperSpecials(meta: PaperFiles & { subject: string }, p: string, s: string): Special[] {
  const out: Special[] = [];
  const ins = find(meta.ins, p, s);
  if (ins) out.push({ kind: "ins", href: `${papersBase}/${ins}`, label: `Open ${insertKind(meta.subject).what} (PDF)` });
  const code = find(meta.code, p, s);
  if (code) out.push({ kind: "code", href: `${papersBase}/${code}`, label: "Download the code files (zip)", download: true });
  const tr = find(meta.trs, p, s);
  if (tr) out.push({ kind: "tr", href: `${papersBase}/${tr}`, label: "Transcript (PDF)" });
  return out;
}

/** The whole question paper, mark scheme and examiner's report of paper `p` of sitting `s`, as links (the Papers view's keys), where the bank hosts them. */
export interface WholeFiles { qp?: string; ms?: string; er?: string }
export function wholeFiles(meta: { qps?: Record<string, string>; mss?: Record<string, string>; ers?: Record<string, string> }, p: string, s: string): WholeFiles {
  const url = (v: string | undefined) => (v ? `${papersBase}/${v.split("/").map(encodeURIComponent).join("/")}` : undefined);
  const qp = url(find(meta.qps, p, s)), ms = url(find(meta.mss, p, s)), er = url(find(meta.ers, p, s));
  return { ...(qp ? { qp } : {}), ...(ms ? { ms } : {}), ...(er ? { er } : {}) };
}
