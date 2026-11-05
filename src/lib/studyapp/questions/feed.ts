import { inType, markBands, type MarkBand } from "@/lib/markBands";
import { feedId, isAnswered, isMarked, keyOf, MAX_SET_PARTS, questionKeyOf, type QAnswer, type QuestionsData } from "./model";
import { matches, seeded, type BankRow } from "./picker";
import { splitSeries } from "./papers";
import type { SubjectMeta } from "./subject";

/**
 * The question feed's rules, pure: which rows the filter bar leaves, in what order, how a year or a mark band is picked, what "Mix them up" does, how a
 * question stands (not started, written, marked), and what the quiet progress line says. The filters are the public question bank's
 * (src/components/questionBank/QuestionBank.tsx): question type (the marks a question is worth), paper, exam, search, calculator, sort and a mix; the
 * topic, mark-scheme and search rules are `matches` in picker.ts, the same ones the picker uses.
 */

export type FeedSort = "new" | "old" | "spec" | "most" | "least" | "mix";
export const FEED_SORTS: readonly { id: FeedSort; label: string }[] = [
  { id: "new", label: "Newest first" },
  { id: "old", label: "Oldest first" },
  { id: "spec", label: "Spec order" },
  { id: "most", label: "Most marks" },
  { id: "least", label: "Fewest marks" },
  { id: "mix", label: "Mixed up" },
];
/** "": either; "only": calculator allowed (or, where the bank only knows which questions ask for a calculation, those); "none": the rest. */
export type CalcMode = "" | "only" | "none";

/** School year (maths-type subjects): "12" the questions that need only first-year content, "13" the ones that need second-year content, "" both. */
export type YearMode = "" | "12" | "13";

export interface FeedFilters {
  /** Topic codes; none is every topic. */
  topics: string[];
  /** Paper codes (several at once); none is every paper. */
  papers: string[];
  /** Exam sittings, "JUN23" (several at once); none is every sitting. A year is all the sittings of that year (`toggleYear`). */
  series: string[];
  /** Question types: the ids of `bandsFor` (the marks a question is worth); none is every kind. */
  types: string[];
  calc: CalcMode;
  /** Only questions with a mark scheme to check against. */
  scheme: boolean;
  /** School year, where the subject has the split (A-Level Maths and Further Maths). */
  yr: YearMode;
  /** One of the subject's `options` (a religion, a programming language...): keeps its papers and topics and the ones everyone sits; "" is all. */
  opt: string;
  /** Practicals (the sciences): "only" these, "none" leaves them out. */
  prac: CalcMode;
  /** A GCSE question printed on both tiers' papers, shown once (as its Higher copy). */
  once: boolean;
  /** Words, all of which must appear. */
  q: string;
  /** Leave out the questions already marked (a snapshot taken when this is switched on, so one does not vanish the moment it is marked). */
  hideDone: boolean;
  sort: FeedSort;
  /** The seed of the mix, so a mix can be put back the same after a visit to a paper. */
  seed: string;
}

export const NO_FEED: FeedFilters = { topics: [], papers: [], series: [], types: [], calc: "", scheme: false, yr: "", opt: "", prac: "", once: false, q: "", hideDone: false, sort: "new", seed: "" };

/**
 * What the public bank loads beside a subject's parts, and the rules that need it (src/components/questionBank/QuestionBank.tsx): the ids of the practicals, of the questions that
 * need second-year content, and the Foundation parts a Higher paper prints too. Each is null where the subject has no such file (its control is then not offered).
 */
export interface FeedExtras {
  practicals: ReadonlySet<string> | null;
  year13: ReadonlySet<string> | null;
  /** A Foundation part's id to its Higher twin's id. */
  twins: ReadonlyMap<string, string> | null;
}
export const NO_EXTRAS: FeedExtras = { practicals: null, year13: null, twins: null };

type Options = NonNullable<SubjectMeta["options"]>;
/** The option ids a pick stands for (AQA Further Maths' "Mechanics and Statistics" is two), the pick itself otherwise. */
export const takesOf = (options: Options | undefined, id: string): string[] => options?.list.find((o) => o.id === id)?.takes ?? [id];
/** A pick that is one of the subject's options; anything else (another subject's, a re-cut bank's) is no option. */
export const validOption = (options: Options | undefined, id: string): string => (options?.list.some((o) => o.id === id) ? id : "");
/** Whether a paper, or a section of the topics, is in view for an option (the ones everyone sits, with none, always are). */
export const forOption = (options: Options | undefined, opt: string, option: string | undefined): boolean => !opt || !option || takesOf(options, opt).includes(option);

/** What a filter needs to know beyond the row. */
export interface FeedContext {
  /** The papers' text, folded, once it has arrived (a search then reads the whole question). */
  text?: Record<string, string> | null;
  /** `bandsFor` of the subject. */
  bands: readonly MarkBand[];
  /** Part ids to leave out when `hideDone` is on. */
  done?: ReadonlySet<string>;
  /** The subject's extra files and options, once known (each rule that needs one is left out until it is). */
  extras?: FeedExtras;
  /** The subject, for its options: a paper's `option` is read off `meta.papers`. */
  meta?: Pick<SubjectMeta, "papers" | "options"> & Partial<Pick<SubjectMeta, "topics">>;
  /** Each part's paper (lower case) where it is the Higher twin of a Foundation part: made once by `twinPapers`. */
  twinPaper?: ReadonlyMap<string, string>;
}

/** The paper (lower case) of each Foundation part's Higher twin, read off the twin itself where it is among `rows` (a tier left out has no twin in view, so nothing is hidden for it). */
export function twinPapers(rows: readonly BankRow[], twins: ReadonlyMap<string, string> | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!twins?.size) return out;
  const paper = new Map(rows.map((r) => [r.id, r.p.toLowerCase()]));
  for (const [id, twin] of twins) { const p = paper.get(twin); if (p) out.set(id, p); }
  return out;
}

/** The kinds of question a subject has, by the marks they are worth (the public bank's "Question type"): none where one value is all there is. */
export function bandsFor(subject: string, rows: readonly BankRow[]): MarkBand[] {
  return markBands({ subject: subject as never }, rows as never);
}

/** The filters a count leaves out of its own sum (what each option would give with every other filter kept). */
export type FeedDim = "topics" | "papers" | "series" | "types" | "calc" | "prac" | "yr" | "opt";
const without = (f: FeedFilters, skip: FeedDim | undefined): FeedFilters => {
  switch (skip) {
    case "topics": return { ...f, topics: [] };
    case "papers": return { ...f, papers: [] };
    case "series": return { ...f, series: [] };
    case "types": return { ...f, types: [] };
    case "calc": return { ...f, calc: "" };
    case "prac": return { ...f, prac: "" };
    case "yr": return { ...f, yr: "" };
    case "opt": return { ...f, opt: "" };
    default: return f;
  }
};

/** The test a row must pass, made once for a filter (so a pass over thousands of rows allocates nothing per row). `skip` leaves one filter out (for the counts). */
export function feedMatcher(filters: FeedFilters, c: FeedContext, skip?: FeedDim): (p: BankRow) => boolean {
  const f = without(filters, skip);
  // topics, mark scheme and words: the picker's own rules
  const base = { topics: f.topics, paper: null, series: null, band: "any" as const, scheme: f.scheme, q: f.q };
  const papers = f.papers.map((x) => x.toLowerCase());
  const bands = f.types.length ? c.bands.filter((b) => f.types.includes(b.id)) : [];
  const ex = c.extras;
  const options = c.meta?.options;
  const opt = validOption(options, f.opt);
  const optionOf = new Map((c.meta?.papers ?? []).flatMap((p) => (p.option ? [[p.id.toLowerCase(), p.option] as const] : [])));
  const picked = opt ? takesOf(options, opt) : [];
  const prac = ex?.practicals ?? null, year13 = ex?.year13 ?? null;
  const twins = f.once ? ex?.twins ?? null : null;
  return (p) => {
    if (!matches(p, base, c.text)) return false;
    const pl = p.p.toLowerCase();
    if (papers.length && !papers.includes(pl)) return false;
    if (opt) { const o = optionOf.get(pl); if (o && !picked.includes(o)) return false; }
    if (f.series.length && !f.series.includes(p.s)) return false;
    if (f.types.length && !bands.some((b) => inType(p, b))) return false;
    if (f.calc === "only" && !p.calc) return false;
    if (f.calc === "none" && p.calc) return false;
    if (f.prac && prac && (f.prac === "only") !== prac.has(p.id)) return false;
    if (f.yr && year13 && (f.yr === "13") !== year13.has(p.id)) return false;
    // On both tiers, once: a Foundation part goes when its Higher twin's paper is in view too.
    if (twins?.has(p.id)) { const tp = c.twinPaper?.get(p.id); if (tp && (!papers.length || papers.includes(tp))) return false; }
    if (f.hideDone && c.done?.has(p.id)) return false;
    return true;
  };
}
export const feedMatches = (p: BankRow, f: FeedFilters, c: FeedContext): boolean => feedMatcher(f, c)(p);

export const feedFilter = <T extends BankRow>(rows: readonly T[], f: FeedFilters, c: FeedContext): T[] => rows.filter(feedMatcher(f, c));

/** How many filters are doing something (a topic counts one each; the words and the sort are not counted: the search has its own box). */
export const feedActive = (f: FeedFilters): number => f.topics.length + f.papers.length + f.series.length + f.types.length + (f.calc ? 1 : 0) + (f.scheme ? 1 : 0) + (f.hideDone ? 1 : 0) + (f.yr ? 1 : 0) + (f.opt ? 1 : 0) + (f.prac ? 1 : 0) + (f.once ? 1 : 0);

/** Every filter off (search, the sort and the mix's seed are the student's own and stay): what "Clear all" does. */
export const CLEARED: Partial<FeedFilters> = { topics: [], papers: [], series: [], types: [], calc: "", scheme: false, yr: "", opt: "", prac: "", once: false, q: "", hideDone: false };

/**
 * A label as a sort key: "01.2" before "01.10", "3(a)" before "3(b)", the way `compareLabels` reads them, but made once per row so sorting thousands of
 * rows does not run a pattern match on every comparison.
 */
export function labelKey(l: string): string {
  const t = l.match(/\d+|[a-z]+|[^\w\s]/gi) ?? [l];
  return t.map((x) => (/^\d+$/.test(x) ? x.padStart(8, "0") : x)).join("\u0001");
}

/**
 * Listening questions whose recording is missing from the data: a part with no `au` whose own question (its other parts) has one. They cannot be done, so in the
 * ordinary orders they come after everything that can (a student must not meet a dead task first). Empty for every subject today; it is the rule for a hole.
 */
export function deadListening(rows: readonly BankRow[]): Set<string> {
  const heard = new Set<string>();
  for (const r of rows) if (r.au) heard.add(questionKeyOf(r));
  const dead = new Set<string>();
  if (!heard.size) return dead;
  for (const r of rows) if (!r.au && heard.has(questionKeyOf(r))) dead.add(r.id);
  return dead;
}

/** The note for a recording that is the whole paper's (AQA publishes no separate tracks for some sittings). */
export const wholeRecordingNote = (label: string): string => `This is the whole paper's recording: question ${label.match(/^\d+/)?.[0] ?? label} starts after its number is read out.`;

/** The subject's two orders, newest and oldest, the sitting first (the order the bank lists them in), then paper, then the question as it is printed. Each is made when first asked for. */
export interface FeedOrders { readonly new: readonly BankRow[]; readonly old: readonly BankRow[] }
export function feedOrders(rows: readonly BankRow[], series: readonly { id: string }[]): FeedOrders {
  const rank = new Map(series.map((s, i) => [s.id, i]));
  const n = series.length;
  const keyed = rows.map((r) => ({ r, s: rank.get(r.s) ?? 1e6, k: labelKey(r.l) }));
  const by = (flip: boolean) => keyed.slice().sort((a, b) => {
    const sa = flip && a.s < 1e6 ? n - 1 - a.s : a.s, sb = flip && b.s < 1e6 ? n - 1 - b.s : b.s;
    return sa - sb || (a.r.p < b.r.p ? -1 : a.r.p > b.r.p ? 1 : 0) || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0);
  }).map((x) => x.r);
  const dead = deadListening(rows);
  const last = (list: BankRow[]) => (dead.size ? [...list.filter((r) => !dead.has(r.id)), ...list.filter((r) => dead.has(r.id))] : list);
  let fresh: BankRow[] | undefined, old: BankRow[] | undefined;
  return { get new() { return (fresh ??= last(by(false))); }, get old() { return (old ??= last(by(true))); } };
}

/** A string as a number, so a seed typed or remembered as text makes the same mix every time. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const newSeed = (): string => Math.random().toString(36).slice(2, 8);

function shuffled<T>(xs: readonly T[], rng: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * "Mix them up": rounds of one question from each topic, the topics in a new order each round, so the first few questions cover every
 * topic and the rest keep the spread. Every row comes out exactly once. A subject with one topic spreads over its sittings instead.
 */
export function mixRows<T extends BankRow>(rows: readonly T[], seed: string, topics: readonly string[] = []): T[] {
  const rng = seeded(hashSeed(seed || "plumi"));
  const topicOf = (p: T) => (topics.length ? p.t.find((t) => topics.includes(t)) : undefined) ?? p.t[0] ?? "";
  const pile = (keyOf: (p: T) => string) => {
    const m = new Map<string, T[]>();
    for (const p of rows) { const k = keyOf(p); const a = m.get(k); if (a) a.push(p); else m.set(k, [p]); }
    return m;
  };
  let by = pile(topicOf);
  if (by.size === 1) by = pile((p) => p.s);
  const piles = [...by.values()].map((a) => shuffled(a, rng));
  const out: T[] = [];
  for (let round = 0; out.length < rows.length; round++) {
    for (const a of shuffled(piles, rng)) if (a[round]) out.push(a[round]);
  }
  return out;
}

/** A topic code as a string key, "3.1.2" before "3.1.10": only for a subject whose topic list is not to hand (the lists are in the specification's order, which codes as text are not: GCSE Maths' "A1" sorts before its "N1", Edexcel's "M.7" before "P.1"). */
export const specRank = (code: string): string => code.split(".").map((n) => n.padStart(3, "0")).join(".");
/**
 * "Spec order": by the first topic of each part where the specification lists it (`topics` is the subject's topic list, which comes in the specification's own order), a part with no topic
 * last, the order given kept within a topic (stable, so newest first stays newest first).
 */
export function specSorted<T extends BankRow>(rows: readonly T[], topics?: readonly { code: string }[]): T[] {
  const place = new Map<string, number>((topics ?? []).map((t, i) => [t.code, i]));
  const key = new Map<string, number | string>();
  for (const r of rows) { const t = r.t[0]; key.set(r.id, !t ? Infinity : place.has(t) ? place.get(t)! : topics ? 1e6 : specRank(t) as never); }
  if (topics) return rows.slice().sort((a, b) => (key.get(a.id) as number) - (key.get(b.id) as number) || 0);
  return rows.slice().sort((a, b) => { const x = key.get(a.id)!, y = key.get(b.id)!; const xs = x === Infinity ? "\uffff" : String(x), ys = y === Infinity ? "\uffff" : String(y); return xs < ys ? -1 : xs > ys ? 1 : 0; });
}

/** The rows the filter leaves, in the order asked for. `orders` is `feedOrders` of the subject (the filter keeps the order it is given). */
export function feedList(orders: FeedOrders, f: FeedFilters, c: FeedContext): BankRow[] {
  const base = feedFilter(f.sort === "old" ? orders.old : orders.new, f, c);
  if (f.sort === "spec") return specSorted(base, c.meta?.topics);
  if (f.sort === "most") return base.slice().sort((a, b) => (b.m ?? -1) - (a.m ?? -1));
  if (f.sort === "least") return base.slice().sort((a, b) => (a.m == null ? 1e6 : a.m) - (b.m == null ? 1e6 : b.m));
  if (f.sort === "mix") return mixRows(base, f.seed, f.topics);
  return base;
}

/** The part ids marked now (what "leave out the ones I have marked" takes a snapshot of). */
export function markedIds(q: Pick<QuestionsData, "answers" | "sets">, slug: string): Set<string> {
  const out = new Set<string>();
  const sets = new Map(q.sets.filter((s) => s.subject === slug).map((s) => [s.id, s] as const));
  for (const [k, a] of Object.entries(q.answers)) {
    if (!isMarked(a)) continue;
    const at = k.indexOf("/");
    if (at > 0 && sets.has(k.slice(0, at))) out.add(k.slice(at + 1));
  }
  return out;
}

/* ── the sittings and their years ────────────────────────────────────── */

/** The years the subject's sittings fall in (newest first, as the bank lists them) with the sittings of each. A sitting with no year ("Specimen") is its own. */
export function yearGroups(series: readonly { id: string; label: string }[]): { year: string; ids: string[] }[] {
  const by = new Map<string, string[]>();
  for (const s of series) { const y = splitSeries(s.label).year; const a = by.get(y); if (a) a.push(s.id); else by.set(y, [s.id]); }
  return [...by].map(([year, ids]) => ({ year, ids }));
}
export function yearState(chosen: readonly string[], ids: readonly string[]): "all" | "some" | "none" {
  const n = ids.filter((i) => chosen.includes(i)).length;
  return n === 0 ? "none" : n === ids.length ? "all" : "some";
}
/** A tap on a year: all its sittings, unless they are all chosen already (then none of them). Other years are untouched. */
export function toggleYear(chosen: readonly string[], ids: readonly string[]): string[] {
  return yearState(chosen, ids) === "all" ? chosen.filter((c) => !ids.includes(c)) : [...chosen, ...ids.filter((i) => !chosen.includes(i))];
}
export const toggleIn = (list: readonly string[], v: string): string[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** The wording of the calculator choice: a bank that sorts calculator papers from the rest (GCSE Maths) says so; the others only know which questions ask for a calculation. */
export function calcWords(meta: Pick<SubjectMeta, "calcPapers">): { label: string; only: string; none: string } {
  return meta.calcPapers ? { label: "Calculator", only: "Allowed", none: "Not allowed" } : { label: "Calculation questions", only: "Only", none: "Skip" };
}
/** Whether the student has really answered something in any subject's feed (written, typed or marked: a peek at a scheme or a drag on the grip is not an answer): the cue for where to write goes once they have. */
export function hasFeedAnswer(answers: Record<string, QAnswer>): boolean {
  for (const k in answers) if (k.startsWith("feed-") && (isAnswered(answers[k]) || isMarked(answers[k]))) return true;
  return false;
}

/** Whether a subject has a calculator choice to offer at all (the bank says maths and criminology do not; a subject with no calculation in it has nothing to sort). */
export const hasCalcChoice = (meta: Pick<SubjectMeta, "noCalc">, rows: readonly BankRow[]): boolean => !meta.noCalc && rows.some((r) => r.calc) && rows.some((r) => !r.calc);

/**
 * What the saved choices may keep: an id the subject no longer has (another tier, a re-cut bank) is dropped, so a remembered filter never matches nothing for a reason the student cannot see.
 * A filter whose data the subject has not got (the school year of a subject with no split, practicals of an arts subject, an option it has not) is dropped as well; `extras`, once
 * the files have been asked for, says which really arrived.
 */
export function cleanFeedFilters(f: FeedFilters, meta: Pick<SubjectMeta, "topics" | "papers" | "series" | "options" | "data">, bands: readonly MarkBand[], extras?: FeedExtras): FeedFilters {
  const topics = new Set(meta.topics.map((t) => t.code));
  const papers = new Set(meta.papers.map((p) => p.id.toLowerCase()));
  const series = new Set(meta.series.map((s) => s.id));
  const types = new Set(bands.map((b) => b.id));
  const has = (file: "year13" | "practicals" | "tiers") => (extras ? !!extras[file === "tiers" ? "twins" : file] : !!meta.data?.[file]);
  const opt = validOption(meta.options, f.opt);
  return {
    ...f,
    topics: f.topics.filter((t) => topics.has(t)), papers: f.papers.filter((p) => papers.has(p.toLowerCase())),
    series: f.series.filter((s) => series.has(s)), types: f.types.filter((t) => types.has(t)),
    yr: has("year13") ? f.yr : "", prac: has("practicals") ? f.prac : "", once: has("tiers") ? f.once : false, opt,
  };
}

/* ── counts and pills ────────────────────────────────────────────────── */

/** How many questions each option would give with every other filter kept (the public bank's `n(dim, id)`): made in one pass per filter, off the drawing of the list. */
export interface FeedCounts {
  topics: Map<string, number>;
  /** By paper id, lower case. */
  papers: Map<string, number>;
  series: Map<string, number>;
  types: Map<string, number>;
  calc: { only: number; none: number };
  prac: { only: number; none: number };
  yr: { "12": number; "13": number };
  /** By the option a part's paper is for; "" is the papers everyone sits. */
  opt: Map<string, number>;
  /** The rows that pass everything but the topics: what an area of topics counts over. */
  topicRows: readonly BankRow[];
}

export function feedCounts(rows: readonly BankRow[], f: FeedFilters, c: FeedContext, bands: readonly MarkBand[]): FeedCounts {
  const out: FeedCounts = { topics: new Map(), papers: new Map(), series: new Map(), types: new Map(), calc: { only: 0, none: 0 }, prac: { only: 0, none: 0 }, yr: { "12": 0, "13": 0 }, opt: new Map(), topicRows: [] };
  const bump = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
  const ex = c.extras;
  const optionOf = new Map((c.meta?.papers ?? []).flatMap((p) => (p.option ? [[p.id.toLowerCase(), p.option] as const] : [])));
  const topicRows: BankRow[] = [];
  const pass = (dim: FeedDim, each: (p: BankRow) => void) => { const ok = feedMatcher(f, c, dim); for (const p of rows) if (ok(p)) each(p); };
  pass("topics", (p) => { topicRows.push(p); for (const t of new Set(p.t)) bump(out.topics, t); });
  out.topicRows = topicRows;
  pass("papers", (p) => bump(out.papers, p.p.toLowerCase()));
  pass("series", (p) => bump(out.series, p.s));
  pass("types", (p) => { for (const b of bands) if (inType(p, b)) bump(out.types, b.id); });
  pass("calc", (p) => { if (p.calc) out.calc.only++; else out.calc.none++; });
  if (ex?.practicals) pass("prac", (p) => { if (ex.practicals!.has(p.id)) out.prac.only++; else out.prac.none++; });
  if (ex?.year13) pass("yr", (p) => { out.yr[ex.year13!.has(p.id) ? "13" : "12"]++; });
  if (c.meta?.options) pass("opt", (p) => bump(out.opt, optionOf.get(p.p.toLowerCase()) ?? ""));
  return out;
}

/** What an option reads with its count in the select: "Islam (214)", the papers everyone sits counted in each. */
export function optionCount(counts: FeedCounts | null, options: Options, id: string): number | null {
  if (!counts) return null;
  return takesOf(options, id).reduce((sum, k) => sum + (counts.opt.get(k) ?? 0), 0) + (counts.opt.get("") ?? 0);
}

/** A filter that is on, as a pill: what it says, and what taking it off changes. */
export interface FeedPill { key: string; label: string; off: Partial<FeedFilters> }

/** The filters that are on, as pills (a topic, a type, a paper, a sitting each; many papers or sittings read as one). */
export function feedPills(meta: Pick<SubjectMeta, "topics" | "papers" | "series" | "options" | "calcPapers">, bands: readonly MarkBand[], f: FeedFilters, label: (code: string) => string = (c) => c): FeedPill[] {
  const calc = calcWords(meta);
  const optName = meta.options?.list.find((o) => o.id === f.opt)?.name;
  return [
    ...(f.opt && optName ? [{ key: "opt", label: optName, off: { opt: "" } }] : []),
    ...f.topics.map((c) => ({ key: `t-${c}`, label: label(c), off: { topics: f.topics.filter((x) => x !== c) } })),
    ...f.types.map((id) => ({ key: `ty-${id}`, label: bands.find((b) => b.id === id)?.label ?? id, off: { types: f.types.filter((x) => x !== id) } })),
    ...(f.papers.length > 2 ? [{ key: "papers", label: `${f.papers.length} papers`, off: { papers: [] } }]
      : f.papers.map((id) => ({ key: `p-${id}`, label: meta.papers.find((p) => p.id.toLowerCase() === id.toLowerCase())?.name ?? id, off: { papers: f.papers.filter((x) => x !== id) } }))),
    ...(f.series.length > 2 ? [{ key: "series", label: `${f.series.length} exams`, off: { series: [] } }]
      : f.series.map((id) => ({ key: `s-${id}`, label: meta.series.find((s) => s.id === id)?.label ?? id, off: { series: f.series.filter((x) => x !== id) } }))),
    ...(f.yr ? [{ key: "yr", label: f.yr === "12" ? "Year 12 content" : "Year 13 content", off: { yr: "" as YearMode } }] : []),
    ...(f.calc ? [{ key: "calc", label: f.calc === "only" ? (calc.label === "Calculator" ? "Calculator allowed" : "Calculation questions only") : (calc.label === "Calculator" ? "No calculator" : "No calculation questions"), off: { calc: "" as CalcMode } }] : []),
    ...(f.prac ? [{ key: "prac", label: f.prac === "only" ? "Only practicals" : "No practicals", off: { prac: "" as CalcMode } }] : []),
    ...(f.once ? [{ key: "once", label: "Both-tier questions once", off: { once: false } }] : []),
    ...(f.scheme ? [{ key: "scheme", label: "Has a mark scheme", off: { scheme: false } }] : []),
    ...(f.hideDone ? [{ key: "done", label: "Marked ones hidden", off: { hideDone: false } }] : []),
  ];
}

/** The papers of a tier ("Higher only"), among the papers shown. */
export const tierPaperIds = (papers: readonly { id: string; name: string }[], tier: "Higher" | "Foundation"): string[] => papers.filter((p) => new RegExp(`\\b${tier}\\b`).test(p.name)).map((p) => p.id);

/** The sittings left once the newest two are left out (the sittings are listed newest first): "Leave out the latest two". Empty means every sitting. */
export const leaveOutLatestTwo = (series: readonly { id: string }[]): string[] => (series.length > 2 ? series.slice(2).map((x) => x.id) : []);

/** A pick of an option: its papers stay, and the papers picked that belong to another option go. */
export function pickOption(meta: Pick<SubjectMeta, "papers" | "options">, f: FeedFilters, id: string): Partial<FeedFilters> {
  const opt = validOption(meta.options, id);
  const optionOf = new Map(meta.papers.flatMap((p) => (p.option ? [[p.id.toLowerCase(), p.option] as const] : [])));
  return { opt, papers: f.papers.filter((p) => forOption(meta.options, opt, optionOf.get(p.toLowerCase()))) };
}

/* ── how a question stands ───────────────────────────────────────────── */

export interface QState {
  state: "new" | "written" | "marked";
  /** Marks the student gave themselves, and the marks the question prints (null when it prints none). */
  got?: number;
  of: number | null;
  /** Where the answer lives: the feed, or a paper or set the question is also in (then `where` is its name). */
  from: "feed" | "set";
  where?: string;
  /** For work done elsewhere: the set it is in, so the card can open it at this question, what kind of set it is, and the answer itself (to show it, read only). */
  setId?: string;
  kind?: "paper" | "set";
  answer?: QAnswer;
}

/** "Not started", "Written", "Marked 2 of 3": one honest line for a question. */
export function qStateLine(s: QState): string {
  if (s.state === "new") return "Not started";
  const where = s.from === "set" ? (s.kind === "paper" ? " in a paper" : " in a set") : "";
  if (s.state === "written") return `Written${where}`;
  return s.of != null && s.got !== undefined ? `Marked ${s.got} of ${s.of}${where}` : `Marked${where}`;
}

/** How a part stands from its own answer in the feed. */
export function stateOf(a: QAnswer | undefined, m: number | null): QState {
  if (isMarked(a)) return { state: "marked", got: m != null ? Math.min(a!.got ?? 0, m) : a!.got, of: m, from: "feed" };
  if (isAnswered(a)) return { state: "written", of: m, from: "feed" };
  return { state: "new", of: m, from: "feed" };
}

/**
 * How a question stands overall: the better of the feed's own answer and work done elsewhere (a paper, a set), marked over written over nothing, the feed's own
 * on a tie. The card and the subject's progress line then agree.
 */
export function bestState(own: QState, other: QState | undefined): QState {
  const rank = (s: QState) => (s.state === "marked" ? 2 : s.state === "written" ? 1 : 0);
  return other && rank(other) > rank(own) ? other : own;
}

/** Work done elsewhere that the box can show (read only) and "Continue here" can copy in: there is writing or typing in it, and none yet in this box. */
export function otherCopy(own: QAnswer | undefined, other: QState | undefined): QState | null {
  if (!other?.answer || !other.setId || hasContent(own)) return null;
  return hasContent(other.answer) ? other : null;
}
const hasContent = (a: QAnswer | undefined): boolean => !!a && ((!!a.ink && a.ink.n > 0) || !!a.text?.trim());

/**
 * Where else this subject's questions have been answered: in a paper or a set the student made, which keeps its own answers (an answer belongs to the set
 * it was written in; the feed's questions are the feed's). The feed shows it as a quiet line on a question it has no answer for, and counts it in the
 * subject's progress, so work done in a paper is not "not started" in the feed. Best of the sets wins (marked over written).
 */
export function elsewhere(q: Pick<QuestionsData, "sets" | "answers">, slug: string): Map<string, QState> {
  const out = new Map<string, QState>();
  const sets = new Map(q.sets.filter((s) => s.subject === slug && !s.feed).map((s) => [s.id, s] as const));
  if (!sets.size) return out;
  const marks = new Map<string, number | null>();
  for (const s of sets.values()) for (const p of s.parts) marks.set(`${s.id}/${p.id}`, p.m);
  for (const [k, a] of Object.entries(q.answers)) {
    const at = k.indexOf("/");
    const set = at > 0 ? sets.get(k.slice(0, at)) : undefined;
    if (!set) continue;
    const m = marks.get(k) ?? null;
    const st: QState = isMarked(a) ? { state: "marked", got: m != null ? Math.min(a.got ?? 0, m) : a.got, of: m, from: "set", where: set.name, setId: set.id, kind: set.paper ? "paper" : "set", answer: a }
      : isAnswered(a) ? { state: "written", of: m, from: "set", where: set.name, setId: set.id, kind: set.paper ? "paper" : "set", answer: a } : { state: "new", of: m, from: "set" };
    if (st.state === "new") continue;
    const id = k.slice(at + 1);
    const have = out.get(id);
    if (!have || (have.state === "written" && st.state === "marked")) out.set(id, st);
  }
  return out;
}

export interface FeedProgress {
  /** Questions of the subject that count (the ones the tier the student sits has). */
  total: number;
  /** Marked, in the feed or in a paper or set. */
  marked: number;
  /** Written on but not marked yet. */
  written: number;
}

/**
 * "128 of 2,666 marked": from the feed's answers and the other sets' (`elsewhere`); a question counted once. Honest: written is not marked, and nothing here
 * is a score. `ids` is the ids of the subject's questions (made once), so this is a pass over the student's answers, not over the bank.
 */
export function feedProgress(q: Pick<QuestionsData, "sets" | "answers">, slug: string, ids: ReadonlySet<string>, other?: ReadonlyMap<string, QState>): FeedProgress {
  const set = q.sets.find((s) => s.id === feedId(slug));
  const rank = (x: string | undefined) => (x === "marked" ? 2 : x === "written" ? 1 : 0);
  const best = new Map<string, number>();
  const put = (id: string, r: number) => { if (r > (best.get(id) ?? 0)) best.set(id, r); };
  if (set) for (const p of set.parts) {
    if (!ids.has(p.id)) continue;
    const a = q.answers[keyOf(set.id, p.id)];
    put(p.id, isMarked(a) ? 2 : isAnswered(a) ? 1 : 0);
  }
  if (other) for (const [id, st] of other) if (ids.has(id)) put(id, rank(st.state));
  let marked = 0, written = 0;
  for (const r of best.values()) { if (r === 2) marked++; else if (r === 1) written++; }
  return { total: ids.size, marked, written };
}

/** "128 of 2,666 marked" with, if any are written but not marked, "5 written". Null when nothing has been done (the line is only there once there is something true to say). */
export function progressLine(p: FeedProgress): string | null {
  if (p.marked === 0 && p.written === 0) return null;
  const n = (x: number) => x.toLocaleString("en-GB");
  const head = p.marked > 0 ? `${n(p.marked)} of ${n(p.total)} marked` : `${n(p.written)} written`;
  return p.marked > 0 && p.written > 0 ? `${head} · ${n(p.written)} written` : head;
}

/* ── practising what the filter left ─────────────────────────────────── */

/** "Practise these": the first `n` rows of the list in the order shown (a set holds up to 60 parts), and how many were left out. */
export function practiseRows<T>(list: readonly T[], n: number = MAX_SET_PARTS): { rows: T[]; left: number } {
  return { rows: list.slice(0, n), left: Math.max(0, list.length - n) };
}
