import { inBand, markBands, type MarkBand } from "@/lib/markBands";
import { feedId, isAnswered, isMarked, keyOf, MAX_SET_PARTS, type QAnswer, type QuestionsData } from "./model";
import { matches, seeded, type BankRow } from "./picker";
import { splitSeries } from "./papers";
import type { SubjectMeta } from "./subject";

/**
 * The question feed's rules, pure: which rows the filter bar leaves, in what order, how a year or a mark band is picked, what "Mix them up" does, how a
 * question stands (not started, written, marked), and what the quiet progress line says. The filters are the public question bank's
 * (src/components/questionBank/QuestionBank.tsx): question type (the marks a question is worth), paper, exam, search, calculator, sort and a mix; the
 * topic, mark-scheme and search rules are `matches` in picker.ts, the same ones the picker uses.
 */

export type FeedSort = "new" | "old" | "most" | "least" | "mix";
export const FEED_SORTS: readonly { id: FeedSort; label: string }[] = [
  { id: "new", label: "Newest first" },
  { id: "old", label: "Oldest first" },
  { id: "most", label: "Most marks" },
  { id: "least", label: "Fewest marks" },
  { id: "mix", label: "Mixed up" },
];
/** "": either; "only": calculator allowed (or, where the bank only knows which questions ask for a calculation, those); "none": the rest. */
export type CalcMode = "" | "only" | "none";

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
  /** Words, all of which must appear. */
  q: string;
  /** Leave out the questions already marked (a snapshot taken when this is switched on, so one does not vanish the moment it is marked). */
  hideDone: boolean;
  sort: FeedSort;
  /** The seed of the mix, so a mix can be put back the same after a visit to a paper. */
  seed: string;
}

export const NO_FEED: FeedFilters = { topics: [], papers: [], series: [], types: [], calc: "", scheme: false, q: "", hideDone: false, sort: "new", seed: "" };

/** What a filter needs to know beyond the row. */
export interface FeedContext {
  /** The papers' text, folded, once it has arrived (a search then reads the whole question). */
  text?: Record<string, string> | null;
  /** `bandsFor` of the subject. */
  bands: readonly MarkBand[];
  /** Part ids to leave out when `hideDone` is on. */
  done?: ReadonlySet<string>;
}

/** The kinds of question a subject has, by the marks they are worth (the public bank's "Question type"): none where one value is all there is. */
export function bandsFor(subject: string, rows: readonly BankRow[]): MarkBand[] {
  return markBands({ subject: subject as never }, rows as never);
}

/** The test a row must pass, made once for a filter (so a pass over thousands of rows allocates nothing per row). */
export function feedMatcher(f: FeedFilters, c: FeedContext): (p: BankRow) => boolean {
  // topics, mark scheme and words: the picker's own rules
  const base = { topics: f.topics, paper: null, series: null, band: "any" as const, scheme: f.scheme, q: f.q };
  const papers = f.papers.map((x) => x.toLowerCase());
  const bands = f.types.length ? c.bands.filter((b) => f.types.includes(b.id)) : [];
  return (p) => {
    if (!matches(p, base, c.text)) return false;
    if (papers.length && !papers.includes(p.p.toLowerCase())) return false;
    if (f.series.length && !f.series.includes(p.s)) return false;
    if (f.types.length && !bands.some((b) => inBand(p.m, b))) return false;
    if (f.calc === "only" && !p.calc) return false;
    if (f.calc === "none" && p.calc) return false;
    if (f.hideDone && c.done?.has(p.id)) return false;
    return true;
  };
}
export const feedMatches = (p: BankRow, f: FeedFilters, c: FeedContext): boolean => feedMatcher(f, c)(p);

export const feedFilter = <T extends BankRow>(rows: readonly T[], f: FeedFilters, c: FeedContext): T[] => rows.filter(feedMatcher(f, c));

/** How many filters are doing something (a topic counts one each; the words and the sort are not counted: the search has its own box). */
export const feedActive = (f: FeedFilters): number => f.topics.length + f.papers.length + f.series.length + f.types.length + (f.calc ? 1 : 0) + (f.scheme ? 1 : 0) + (f.hideDone ? 1 : 0);

/**
 * A label as a sort key: "01.2" before "01.10", "3(a)" before "3(b)", the way `compareLabels` reads them, but made once per row so sorting thousands of
 * rows does not run a pattern match on every comparison.
 */
export function labelKey(l: string): string {
  const t = l.match(/\d+|[a-z]+|[^\w\s]/gi) ?? [l];
  return t.map((x) => (/^\d+$/.test(x) ? x.padStart(8, "0") : x)).join("\u0001");
}

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
  let fresh: BankRow[] | undefined, old: BankRow[] | undefined;
  return { get new() { return (fresh ??= by(false)); }, get old() { return (old ??= by(true)); } };
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

/** The rows the filter leaves, in the order asked for. `orders` is `feedOrders` of the subject (the filter keeps the order it is given). */
export function feedList(orders: FeedOrders, f: FeedFilters, c: FeedContext): BankRow[] {
  const base = feedFilter(f.sort === "old" ? orders.old : orders.new, f, c);
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
  return meta.calcPapers ? { label: "Calculator", only: "Allowed", none: "Not allowed" } : { label: "Calculations", only: "Only these", none: "Leave out" };
}
/** Whether a subject has a calculator choice to offer at all (the bank says maths and criminology do not; a subject with no calculation in it has nothing to sort). */
export const hasCalcChoice = (meta: Pick<SubjectMeta, "noCalc">, rows: readonly BankRow[]): boolean => !meta.noCalc && rows.some((r) => r.calc) && rows.some((r) => !r.calc);

/** What the saved choices may keep: an id the subject no longer has (another tier, a re-cut bank) is dropped, so a remembered filter never matches nothing for a reason the student cannot see. */
export function cleanFeedFilters(f: FeedFilters, meta: Pick<SubjectMeta, "topics" | "papers" | "series">, bands: readonly MarkBand[]): FeedFilters {
  const topics = new Set(meta.topics.map((t) => t.code));
  const papers = new Set(meta.papers.map((p) => p.id.toLowerCase()));
  const series = new Set(meta.series.map((s) => s.id));
  const types = new Set(bands.map((b) => b.id));
  return {
    ...f,
    topics: f.topics.filter((t) => topics.has(t)), papers: f.papers.filter((p) => papers.has(p.toLowerCase())),
    series: f.series.filter((s) => series.has(s)), types: f.types.filter((t) => types.has(t)),
  };
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
}

/** "Not started", "Written", "Marked 2 of 3": one honest line for a question. */
export function qStateLine(s: QState): string {
  if (s.state === "new") return "Not started";
  const where = s.from === "set" && s.where ? ` in ${s.where}` : "";
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
    const st: QState = isMarked(a) ? { state: "marked", got: m != null ? Math.min(a.got ?? 0, m) : a.got, of: m, from: "set", where: set.name }
      : isAnswered(a) ? { state: "written", of: m, from: "set", where: set.name } : { state: "new", of: m, from: "set" };
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
