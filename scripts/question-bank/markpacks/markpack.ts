/**
 * Mark packs: a machine-readable copy of ONE bank part's official mark scheme, built offline from the part's question and
 * scheme images (see README.md), checked by the deterministic gates below, and only then eligible to be used for AI marking.
 *
 * Why this exists: the bank holds the question and the scheme as pictures. `k` is only a multiple-choice letter and
 * `text.json` is one lossy OCR string with no boundary between question and scheme. An AI marker needs the scheme as data,
 * and a visible question must only ever be marked against the scheme read from ITS OWN crops. So the model reads the crops
 * once, offline, and code decides whether that reading may be trusted.
 *
 * THE MODEL TRANSCRIBES; CODE DECIDES. Nothing the model says about the scheme is used until `gatePack` passes it, and a
 * pack that passes is still only "ready": a person publishes it. This file is build-time only (it is not in the app bundle).
 *
 * Verdicts:
 *   ready     every gate passed; eligible for human review, then publishing.
 *   held      read correctly (or not provably wrongly) but deliberately NOT for the AI marker yet: a figure or table is
 *             needed, the answer is a number or a tick (a deterministic path, later), or the reading flagged its own doubt.
 *   rejected  the reading contradicts the bank or itself, or contains words the page does not: do not use, re-run or fix.
 */

export const PACK_SCHEMA_VERSION = 1;

export interface PackItem { point: number | null; text: string }
export interface PackPoint { n: number; text: string; marks: number }
export type AnswerKind = "points" | "numeric" | "choose_or_tick" | "levels" | "other";

/** What the extraction prompt asks the model for (extraction_prompt.txt). */
export interface ExtractedPack {
  question_label: string;
  scheme_label: string;
  question_text: string;
  marks_printed: number;
  scheme_total: number;
  needs_figure_or_table: boolean;
  answer_kind: AnswerKind;
  points: PackPoint[];
  max_marks: number | null;
  accept: PackItem[];
  reject: PackItem[];
  ignore: PackItem[];
  rules: string[];
  other_guidance: string[];
  issues: string[];
}

/** What the bank says about the part (a row of parts.<hash>.json). */
export interface BankPartRef { id: string; l: string; m: number | null }

export type Verdict =
  | { status: "ready"; pack: ExtractedPack; reasons: [] }
  | { status: "held"; pack: ExtractedPack; reasons: string[] }
  | { status: "rejected"; pack: null; reasons: string[] };

const KINDS: readonly string[] = ["points", "numeric", "choose_or_tick", "levels", "other"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

const MAX_TEXT = 2000;
const MAX_ITEMS = 40;

function str(v: unknown, what: string, errors: string[], max = MAX_TEXT): string {
  if (typeof v !== "string") { errors.push(`${what} is not text`); return ""; }
  if (v.length > max) { errors.push(`${what} is too long`); return v.slice(0, max); }
  return v;
}

function strings(v: unknown, what: string, errors: string[]): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_ITEMS) { errors.push(`${what} is not a short list`); return []; }
  return v.map((s, i) => str(s, `${what}[${i}]`, errors));
}

function items(v: unknown, what: string, errors: string[]): PackItem[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_ITEMS) { errors.push(`${what} is not a short list`); return []; }
  const out: PackItem[] = [];
  v.forEach((it, i) => {
    if (!isObj(it)) { errors.push(`${what}[${i}] is not an item`); return; }
    const point = it["point"];
    if (point !== null && point !== undefined && !isInt(point)) errors.push(`${what}[${i}].point is not a number or null`);
    out.push({ point: isInt(point) ? point : null, text: str(it["text"], `${what}[${i}].text`, errors) });
  });
  return out;
}

/** Reads a model's JSON into an ExtractedPack, or says exactly what was wrong with its shape. Never trusts a field. */
export function parseExtraction(raw: unknown): { pack: ExtractedPack } | { errors: string[] } {
  const errors: string[] = [];
  if (!isObj(raw)) return { errors: ["the reading is not an object"] };
  const kind = raw["answer_kind"];
  if (typeof kind !== "string" || !KINDS.includes(kind)) errors.push("answer_kind is not one of the allowed kinds");
  const pointsRaw = raw["points"];
  const points: PackPoint[] = [];
  if (!Array.isArray(pointsRaw) || pointsRaw.length > MAX_ITEMS) errors.push("points is not a short list");
  else pointsRaw.forEach((p, i) => {
    if (!isObj(p)) { errors.push(`points[${i}] is not a point`); return; }
    if (!isInt(p["n"]) || !isInt(p["marks"]) || (p["marks"] as number) < 0 || (p["marks"] as number) > 20) errors.push(`points[${i}] has a bad number or mark`);
    points.push({ n: isInt(p["n"]) ? p["n"] : -1, text: str(p["text"], `points[${i}].text`, errors), marks: isInt(p["marks"]) ? p["marks"] : -1 });
  });
  for (const k of ["marks_printed", "scheme_total"] as const) if (!isInt(raw[k])) errors.push(`${k} is not a whole number`);
  const maxMarks = raw["max_marks"];
  if (maxMarks !== null && maxMarks !== undefined && !isInt(maxMarks)) errors.push("max_marks is not a number or null");
  if (typeof raw["needs_figure_or_table"] !== "boolean") errors.push("needs_figure_or_table is not true or false");
  const pack: ExtractedPack = {
    question_label: str(raw["question_label"], "question_label", errors, 40),
    scheme_label: str(raw["scheme_label"], "scheme_label", errors, 40),
    question_text: str(raw["question_text"], "question_text", errors),
    marks_printed: isInt(raw["marks_printed"]) ? raw["marks_printed"] : -1,
    scheme_total: isInt(raw["scheme_total"]) ? raw["scheme_total"] : -1,
    needs_figure_or_table: raw["needs_figure_or_table"] === true,
    answer_kind: (KINDS.includes(String(kind)) ? kind : "other") as AnswerKind,
    points,
    max_marks: isInt(maxMarks) ? maxMarks : null,
    accept: items(raw["accept"], "accept", errors),
    reject: items(raw["reject"], "reject", errors),
    ignore: items(raw["ignore"], "ignore", errors),
    rules: strings(raw["rules"], "rules", errors),
    other_guidance: strings(raw["other_guidance"], "other_guidance", errors),
    issues: strings(raw["issues"], "issues", errors),
  };
  return errors.length > 0 ? { errors } : { pack };
}

// ---------------------------------------------------------------------------------------
// The cross-check: every word of the reading must be on the page's own OCR text
// ---------------------------------------------------------------------------------------

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ");
const words = (s: string) => fold(s).split(/\s+/).filter((t) => t.length > 2);
const label = (s: string) => s.toLowerCase().replace(/[^0-9a-z]/g, "");

/** The share of a phrase's words (3 letters or more) found in the OCR word set. 1 when it has none to check. */
export function coverage(phrase: string, ocr: Set<string>): number {
  const w = words(phrase);
  return w.length === 0 ? 1 : w.filter((t) => ocr.has(t)).length / w.length;
}

/** A point's wording may differ a little from the OCR (brackets, line breaks), so it needs most words; a list item is a quote. */
export const POINT_COVERAGE_FLOOR = 0.6;

// ---------------------------------------------------------------------------------------
// The gates
// ---------------------------------------------------------------------------------------

export function gatePack(raw: unknown, part: BankPartRef, ocrText: string | undefined): Verdict {
  const parsed = parseExtraction(raw);
  if ("errors" in parsed) return { status: "rejected", pack: null, reasons: parsed.errors };
  const pack = parsed.pack;
  const rejected: string[] = [];

  // Identity: the reading must be of THIS part (QuestionIdentity / MarkingRefusal's job on the iPad).
  if (part.m === null || part.m <= 0) rejected.push("the bank gives this part no marks");
  if (label(pack.question_label) !== label(part.l)) rejected.push(`the question image says ${pack.question_label}, the bank says ${part.l}`);
  if (label(pack.scheme_label) !== label(part.l)) rejected.push(`the scheme image says ${pack.scheme_label}, the bank says ${part.l}`);
  if (pack.marks_printed !== part.m) rejected.push(`marks printed ${pack.marks_printed} but the bank says ${part.m}`);
  if (pack.scheme_total !== part.m) rejected.push(`scheme total ${pack.scheme_total} but the bank says ${part.m}`);

  // Internal consistency.
  if (pack.points.length === 0) rejected.push("no mark points");
  if (new Set(pack.points.map((p) => p.n)).size !== pack.points.length) rejected.push("two mark points share a number");
  if (pack.points.some((p) => p.text.trim().length === 0)) rejected.push("a mark point has no words");
  const sum = pack.points.reduce((a, p) => a + p.marks, 0);
  const alternatives = pack.max_marks !== null;
  if (alternatives && pack.max_marks !== part.m) rejected.push(`max marks ${pack.max_marks} but the bank says ${part.m}`);
  // The marks of separate points only have to add up for a scheme of separate points; a numeric or tick scheme
  // (graded answers, "or" alternatives) is not that shape and is held below instead.
  if (pack.answer_kind === "points" && pack.points.length > 0 && !alternatives && sum !== part.m) {
    rejected.push(`point marks add up to ${sum}, not ${part.m}`);
  }

  // Nothing invented: every word must be on the page's own OCR.
  if (ocrText !== undefined && ocrText.length > 0) {
    const ocr = new Set(words(ocrText));
    for (const p of pack.points) {
      if (coverage(p.text, ocr) < POINT_COVERAGE_FLOOR) rejected.push(`point ${p.n} has words the page does not`);
    }
    for (const [name, list] of [["accept", pack.accept], ["reject", pack.reject], ["ignore", pack.ignore]] as const) {
      for (const it of list) {
        if (coverage(it.text, ocr) < 1) rejected.push(`${name} item "${it.text.slice(0, 40)}" has words the page does not`);
        if (it.point !== null && !pack.points.some((p) => p.n === it.point)) rejected.push(`${name} item names point ${it.point}, which does not exist`);
      }
    }
  }

  // Held: deliberately not for the AI marker (yet), whatever the reading's quality.
  const held: string[] = [];
  if (pack.needs_figure_or_table) held.push("needs a figure or table");
  if (pack.answer_kind !== "points") held.push(`answer kind is ${pack.answer_kind}`);
  if (pack.issues.length > 0) held.push("the reading flagged its own doubt");

  if (rejected.length > 0) return { status: "rejected", pack: null, reasons: rejected };
  if (held.length > 0) return { status: "held", pack, reasons: held };
  return { status: "ready", pack, reasons: [] };
}

// ---------------------------------------------------------------------------------------
// Identity of a pack: a hash over what it says and the pictures it was read from
// ---------------------------------------------------------------------------------------

export interface PackSources {
  partId: string;
  /** SHA-256 of the exact question and scheme image bytes that were read, and the bank's crop version then. */
  qpSha256: string;
  msSha256: string;
  cropVersion: number;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObj(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Changes if the reading changes OR if either picture (or the bank's crop version) does: a re-cut invalidates the pack. */
export async function packHash(pack: ExtractedPack, sources: PackSources): Promise<string> {
  const bytes = new TextEncoder().encode(canonical({ v: PACK_SCHEMA_VERSION, pack, sources }));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
