import { NO_FEED, FEED_SORTS, type CalcMode, type FeedFilters, type FeedSort } from "./feed";

/**
 * What the feed remembers per subject on this device, apart from the answers (those are in the Questions data): which of the two views
 * the student last used for a subject ("Questions" or "Papers"), the subject they were last in, the filters they had on, and where they had got to
 * in the list (the question at the top of the screen and how far into it). Its own small localStorage key: losing it costs a student a filter, never an answer.
 */
export const FEED_KEY = "plumi-study-feed";
export type FeedViewKind = "questions" | "papers";
export interface FeedPos { id: string; off: number }
export interface FeedPrefs {
  last: string | null;
  view: Record<string, FeedViewKind>;
  filters: Record<string, FeedFilters>;
  pos: Record<string, FeedPos>;
  /** The subject bar of the filters is folded (a phone starts folded). */
  folded: Record<string, boolean>;
}
export const EMPTY_FEED_PREFS: FeedPrefs = { last: null, view: {}, filters: {}, pos: {}, folded: {} };

const MAX_SUBJECTS = 60;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strs = (v: unknown, max = 80): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 60))].slice(0, max) : []);

export function cleanFilters(raw: unknown): FeedFilters {
  if (!isObj(raw)) return NO_FEED;
  const sort = FEED_SORTS.some((s) => s.id === raw.sort) ? (raw.sort as FeedSort) : "new";
  const calc: CalcMode = raw.calc === "only" || raw.calc === "none" ? raw.calc : "";
  return {
    topics: strs(raw.topics), papers: strs(raw.papers), series: strs(raw.series), types: strs(raw.types, 12), calc,
    scheme: raw.scheme === true, yr: raw.yr === "12" || raw.yr === "13" ? raw.yr : "", opt: typeof raw.opt === "string" ? raw.opt.slice(0, 60) : "",
    prac: raw.prac === "only" || raw.prac === "none" ? raw.prac : "", once: raw.once === true, q: typeof raw.q === "string" ? raw.q.slice(0, 120) : "", hideDone: raw.hideDone === true, sort,
    seed: typeof raw.seed === "string" ? raw.seed.slice(0, 12) : "",
  };
}

/** The saved record, read safely: anything that is not what it should be reads as nothing remembered. */
export function parseFeedPrefs(raw: string | null): FeedPrefs {
  if (!raw) return EMPTY_FEED_PREFS;
  let j: unknown;
  try { j = JSON.parse(raw); } catch { return EMPTY_FEED_PREFS; }
  if (!isObj(j)) return EMPTY_FEED_PREFS;
  const out: FeedPrefs = { last: typeof j.last === "string" && j.last.length <= 80 ? j.last : null, view: {}, filters: {}, pos: {}, folded: {} };
  if (isObj(j.view)) for (const [k, v] of Object.entries(j.view).slice(0, MAX_SUBJECTS)) if (v === "questions" || v === "papers") out.view[k.slice(0, 80)] = v;
  if (isObj(j.filters)) for (const [k, v] of Object.entries(j.filters).slice(0, MAX_SUBJECTS)) out.filters[k.slice(0, 80)] = cleanFilters(v);
  if (isObj(j.pos)) for (const [k, v] of Object.entries(j.pos).slice(0, MAX_SUBJECTS)) {
    if (isObj(v) && typeof v.id === "string" && v.id.length <= 100 && typeof v.off === "number" && Number.isFinite(v.off)) out.pos[k.slice(0, 80)] = { id: v.id, off: Math.max(0, Math.min(5000, Math.round(v.off))) };
  }
  if (isObj(j.folded)) for (const [k, v] of Object.entries(j.folded).slice(0, MAX_SUBJECTS)) if (typeof v === "boolean") out.folded[k.slice(0, 80)] = v;
  return out;
}

/** A filter set the student has not changed from nothing. */
export const isPlain = (f: FeedFilters): boolean => JSON.stringify({ ...f, seed: "" }) === JSON.stringify({ ...NO_FEED });

/** The view a subject opens on: the one used last, else Questions. */
export const viewFor = (p: FeedPrefs, slug: string): FeedViewKind => p.view[slug] ?? "questions";

/** The subject to open on: the one used last if it is still one of theirs, else the first. */
export function subjectFor(p: FeedPrefs, mine: readonly string[]): string | null {
  return p.last && mine.includes(p.last) ? p.last : mine[0] ?? null;
}

/** `stored` with this tab's own changes over it. */
export function mergePrefs(stored: FeedPrefs, mine: FeedPrefs, d: { last: boolean; view: ReadonlySet<string>; filters: ReadonlySet<string>; pos: ReadonlySet<string>; folded: ReadonlySet<string> }): FeedPrefs {
  const over = <T,>(from: Record<string, T>, own: Record<string, T>, keys: ReadonlySet<string>) => {
    const out = { ...from };
    for (const k of keys) if (k in own) out[k] = own[k];
    return out;
  };
  return {
    last: d.last ? mine.last : stored.last,
    view: over(stored.view, mine.view, d.view), filters: over(stored.filters, mine.filters, d.filters),
    pos: over(stored.pos, mine.pos, d.pos), folded: over(stored.folded, mine.folded, d.folded),
  };
}

