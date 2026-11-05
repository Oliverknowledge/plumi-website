import { FORMS, isForm, type Form } from "./questionForm";

/**
 * Topic analysis, pure: what a subject's committed insights file (src/content/questionBankInsights/<slug>.json, written by scripts/question-bank/build-insights.ts) says,
 * read safely, and the sums the view draws from it. Everything here counts the papers the bank holds, and says so: a gap is "not in the papers in Plumi", never "never asked".
 *
 * The unit is the PART: one lettered part of an exam question, which is what the feed lists and counts. The view says "questions" for it, because that is the word the feed
 * uses for the same thing, so "Practise these" opens a list of exactly the number shown. The file also holds how many numbered exam questions those parts come from (`questions`).
 */

export interface InsightsTopic {
  /** Course year the specification puts the topic in (1 or 2); 0 if the bank has no such split. */
  y: number;
  /** Parts, marks and numbered questions of the topic. */
  p: number; m: number; q: number;
  /** `c[series][form]`: the parts in each form, by series in `Insights.series` order and form in `Insights.forms` order. */
  c: number[][];
  /** The marks the parts of each form carry, by form. */
  fm: number[];
}

export interface Insights {
  v: 1;
  slug: string;
  /** The hashes of the bank data files the numbers were built from. */
  built: Record<string, string>;
  forms: Form[];
  /** Series ids, oldest first. */
  series: string[];
  /** By course year, a "1" for each series that has any part of that year, "0" for one that has none. */
  cover: Record<string, string>;
  parts: number;
  questions: number;
  topics: Record<string, InsightsTopic>;
  /** Part id to form index, grouped by the part id up to its second dash. */
  map: Record<string, Record<string, number>>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nat = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1e7;
const natList = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && v.every(nat);

/** The file, checked on arrival: anything that is not what it should be is null (the view then does not offer itself), never a crash. */
export function cleanInsights(raw: unknown): Insights | null {
  if (!isObj(raw) || raw.v !== 1 || typeof raw.slug !== "string") return null;
  const forms = raw.forms, series = raw.series;
  if (!Array.isArray(forms) || !forms.length || !forms.every(isForm) || new Set(forms).size !== forms.length) return null;
  if (!Array.isArray(series) || !series.length || !series.every((s) => typeof s === "string")) return null;
  const cover = isObj(raw.cover) ? raw.cover : {};
  const cov: Record<string, string> = {};
  for (const [y, c] of Object.entries(cover)) if (typeof c === "string" && c.length === series.length && /^[01]+$/.test(c)) cov[y] = c;
  if (!isObj(raw.topics) || !isObj(raw.map) || !nat(raw.parts) || !nat(raw.questions)) return null;
  const topics: Record<string, InsightsTopic> = {};
  for (const [code, t] of Object.entries(raw.topics)) {
    if (!isObj(t) || !nat(t.y) || !nat(t.p) || !nat(t.m) || !nat(t.q) || !Array.isArray(t.c) || t.c.length !== series.length || !natList(t.fm, forms.length)) return null;
    if (!t.c.every((row) => natList(row, forms.length))) return null;
    topics[code] = { y: t.y, p: t.p, m: t.m, q: t.q, c: t.c as number[][], fm: t.fm };
  }
  const map: Record<string, Record<string, number>> = {};
  for (const [g, ids] of Object.entries(raw.map)) {
    if (!isObj(ids)) return null;
    const out: Record<string, number> = {};
    for (const [k, i] of Object.entries(ids)) { if (!nat(i) || i >= forms.length) return null; out[k] = i; }
    map[g] = out;
  }
  const built: Record<string, string> = {};
  if (isObj(raw.built)) for (const [k, v] of Object.entries(raw.built)) if (typeof v === "string") built[k] = v;
  return { v: 1, slug: raw.slug, built, forms: forms as Form[], series: series as string[], cover: cov, parts: raw.parts, questions: raw.questions, topics, map };
}

/** Every part's form, by part id (the feed's form filter reads this). */
export function formMap(ins: Insights): Map<string, Form> {
  const out = new Map<string, Form>();
  for (const [group, ids] of Object.entries(ins.map)) for (const [rest, i] of Object.entries(ids)) out.set(rest ? `${group}-${rest}` : group, ins.forms[i]);
  return out;
}

/** One exam in a topic's strip: `in` the topic has parts in it; `gap` it has none in the papers the bank holds; `none` the bank holds no paper of the topic's course year for that exam. */
export interface StripCell { id: string; n: number; state: "in" | "gap" | "none" }

export interface TopicStat {
  code: string;
  parts: number;
  marks: number;
  questions: number;
  /** The exams the topic has parts in, of the exams that could have it (`open`). */
  seriesIn: number;
  open: number;
  strip: StripCell[];
}

export function topicStat(ins: Insights, code: string): TopicStat | null {
  const t = ins.topics[code];
  if (!t) return null;
  const cov = ins.cover[String(t.y)];
  const strip = ins.series.map((id, i): StripCell => {
    const n = t.c[i].reduce((a, b) => a + b, 0);
    return { id, n, state: n > 0 ? "in" : cov && cov[i] === "0" ? "none" : "gap" };
  });
  return { code, parts: t.p, marks: t.m, questions: t.q, seriesIn: strip.filter((c) => c.state === "in").length, open: strip.filter((c) => c.state !== "none").length, strip };
}

export type TopicOrder = "most" | "least" | "spec";
export const TOPIC_ORDERS: readonly { id: TopicOrder; label: string }[] = [
  { id: "most", label: "Most asked" },
  { id: "least", label: "Least asked" },
  { id: "spec", label: "Spec order" },
];

/** A spec code as a sort key: "2.1.2" before "2.1.10". */
const specKey = (code: string) => code.split(".").map((n) => n.padStart(4, "0")).join(".");

/** The topics (those the subject lists, in its spec order, that the file has) in the order asked for; ties go by spec order. */
export function sortedTopics(ins: Insights, order: TopicOrder, codes: readonly string[]): TopicStat[] {
  const stats = [...codes].sort((a, b) => (specKey(a) < specKey(b) ? -1 : 1)).map((c) => topicStat(ins, c)).filter((s): s is TopicStat => !!s);
  if (order === "spec") return stats;
  return stats.map((s, i) => ({ s, i })).sort((a, b) => (order === "most" ? b.s.parts - a.s.parts : a.s.parts - b.s.parts) || a.i - b.i).map((x) => x.s);
}

export interface FormRow {
  form: Form;
  parts: number;
  marks: number;
  /** Marks per part, one decimal ("typical marks"). */
  avg: number;
}

/** How a topic is asked: each form that has any parts, the most first, "other" last. */
export function formMix(ins: Insights, code: string): FormRow[] {
  const t = ins.topics[code];
  if (!t) return [];
  const rows = ins.forms.map((form, fi): FormRow => {
    const parts = t.c.reduce((a, row) => a + row[fi], 0);
    const marks = t.fm[fi];
    return { form, parts, marks, avg: parts ? Math.round((marks / parts) * 10) / 10 : 0 };
  }).filter((r) => r.parts > 0);
  const rank = (f: Form) => FORMS.indexOf(f);
  return rows.sort((a, b) => (a.form === "other" ? 1 : b.form === "other" ? -1 : 0) || b.parts - a.parts || rank(a.form) - rank(b.form));
}

/** The most parts any one exam has of any of the topics: what the list's small columns are all drawn against, so a column means the same height in every row. */
export const columnMax = (stats: readonly TopicStat[]): number => Math.max(1, ...stats.flatMap((s) => s.strip.map((c) => c.n)));

/** The most parts any one exam has of the topic: what the strip's bars are drawn against. */
export const stripMax = (s: TopicStat): number => Math.max(1, ...s.strip.map((c) => c.n));

/** "2.1" (a 1-decimal number) as a student reads it: whole numbers without a decimal point. */
export const marksText = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** How many exams a topic is in, as a short phrase for a screen reader and the tile: "9 of 10 exams". */
export const examsText = (s: TopicStat): string => `${s.seriesIn} of ${s.open} ${s.open === 1 ? "exam" : "exams"}`;

/** The exams' two-digit year for the strip's axis ("JUN25" and "NOV21" are 25 and 21). */
export const seriesYear = (id: string): string => id.slice(-2);
