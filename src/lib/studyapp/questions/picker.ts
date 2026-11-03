import { questionKeyOf, type QPart, type SetInput } from "./model";
import type { SubjectMeta } from "./subject";

/**
 * The picker's rules, pure: which parts match the chips, the marks band and the search words; what a "Mix for me"
 * picks; how the list is ordered. The bank's own file lists (`parts.json`, `text.json`) are fetched by the browser
 * code; everything here is given them.
 */

/** A part as `public/question-bank/<subject>/parts.json` lists it. `x` is always there; the rest are optional flags. */
export type BankRow = QPart & { x: string; calc?: 1 };

export type Band = "any" | "1-2" | "3-4" | "5-6" | "7+";
export const BANDS: readonly { id: Band; label: string; min: number; max: number }[] = [
  { id: "any", label: "Any", min: 0, max: Infinity },
  { id: "1-2", label: "1 to 2", min: 1, max: 2 },
  { id: "3-4", label: "3 to 4", min: 3, max: 4 },
  { id: "5-6", label: "5 to 6", min: 5, max: 6 },
  { id: "7+", label: "7 or more", min: 7, max: Infinity },
];

export interface Filters {
  /** Topic codes; none means every topic. */
  topics: readonly string[];
  /** Paper (component code), or any. */
  paper: string | null;
  /** Series, "JUN23", or any. */
  series: string | null;
  band: Band;
  /** Only parts with a mark scheme to check against. */
  scheme: boolean;
  /** Words, all of which must appear. */
  q: string;
}
export const NO_FILTERS: Filters = { topics: [], paper: null, series: null, band: "any", scheme: false, q: "" };

/** Lower case, accents off, so "Résumé" is found by "resume". */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Search words: quoted phrases stay together. */
export const words = (q: string) => fold(q).match(/"[^"]+"|\S+/g)?.map((w) => w.replace(/"/g, "")).filter(Boolean) ?? [];

/** Has something to check an answer against: a cropped scheme, or a multiple-choice key. */
export const hasScheme = (p: Pick<QPart, "ms" | "k">) => !!(p.ms || p.k);

/** `text` is the paper's full text per part id, already folded (`fold`): folding thousands of long strings per keystroke would be slow. */
export function matches(p: BankRow, f: Filters, text?: Record<string, string> | null): boolean {
  if (f.topics.length && !p.t.some((t) => f.topics.includes(t))) return false;
  if (f.paper && p.p.toLowerCase() !== f.paper.toLowerCase()) return false;
  if (f.series && p.s !== f.series) return false;
  if (f.band !== "any") {
    const b = BANDS.find((x) => x.id === f.band)!;
    if (p.m == null || p.m < b.min || p.m > b.max) return false;
  }
  if (f.scheme && !hasScheme(p)) return false;
  const ws = words(f.q);
  if (ws.length) {
    const hay = `${fold(`${p.l} ${p.x}`)} ${text?.[p.id] ?? ""}`;
    if (!ws.every((w) => hay.includes(w))) return false;
  }
  return true;
}

/** Newest series first (the bank lists a subject's series newest first), then paper, then label as a person reads it. */
export function sortRows<T extends BankRow>(rows: readonly T[], seriesOrder: readonly string[], compare: (a: string, b: string) => number): T[] {
  const rank = new Map(seriesOrder.map((s, i) => [s, i]));
  const r = (s: string) => rank.get(s) ?? 1e6;
  return rows.slice().sort((a, b) => r(a.s) - r(b.s) || (a.p < b.p ? -1 : a.p > b.p ? 1 : 0) || compare(a.l, b.l));
}

export function filterRows<T extends BankRow>(rows: readonly T[], f: Filters, text?: Record<string, string> | null): T[] {
  return rows.filter((p) => matches(p, f, text));
}

/** How many parts each question has in the bank, so a row can offer "add all 4 parts". */
export function partsByQuestion<T extends BankRow>(rows: readonly T[]): Map<string, T[]> {
  const by = new Map<string, T[]>();
  for (const p of rows) { const k = questionKeyOf(p); const a = by.get(k); if (a) a.push(p); else by.set(k, [p]); }
  return by;
}

/** A seeded random number generator (mulberry32): the same seed gives the same mix, so a mix can be tested. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * "Mix for me": `n` parts from `pool` (what the filters leave), spread across the chosen topics, not ones done lately
 * while there are others, and from different questions while there are others. Fewer than `n` if the pool is smaller.
 * Parts that print no marks are left out unless nothing else is there (they cannot be marked).
 */
export function mix<T extends BankRow>(pool: readonly T[], n: number, o: { recent: ReadonlySet<string>; rng: () => number; topics?: readonly string[] }): T[] {
  const marked = pool.filter((p) => p.m != null);
  const all = marked.length >= n ? marked : pool;
  const topicOf = (p: T) => (o.topics?.length ? p.t.find((t) => o.topics!.includes(t)) : undefined) ?? p.t[0] ?? "";
  const pickedQ = new Set<string>();
  const chosen: T[] = [];

  const round = (parts: readonly T[]) => {
    const buckets = new Map<string, T[]>();
    for (const p of shuffle(parts, o.rng)) { const t = topicOf(p); const b = buckets.get(t); if (b) b.push(p); else buckets.set(t, [p]); }
    const lists = shuffle([...buckets.values()], o.rng);
    let any = true;
    while (chosen.length < n && any) {
      any = false;
      for (const list of lists) {
        if (chosen.length >= n) break;
        if (!list.length) continue;
        any = true;
        let at = list.findIndex((p) => !pickedQ.has(questionKeyOf(p)));
        if (at < 0) at = 0;
        const [p] = list.splice(at, 1);
        pickedQ.add(questionKeyOf(p));
        chosen.push(p);
      }
    }
  };

  round(all.filter((p) => !o.recent.has(p.id)));
  if (chosen.length < n) {
    const have = new Set(chosen.map((p) => p.id));
    round(all.filter((p) => o.recent.has(p.id) && !have.has(p.id)));
  }
  return chosen;
}

/** Rows in the window of a long list: the first and last to draw for a scroll position (fixed row height). */
export function windowOf(total: number, rowH: number, scrollTop: number, viewH: number, overscan = 6): { from: number; to: number } {
  const from = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
  const to = Math.min(total, Math.ceil((scrollTop + viewH) / rowH) + overscan);
  return { from, to };
}

/**
 * A row's opening words, as one quiet line: the printed "[2 marks]" and stray symbols left out, cut at a word (never
 * mid-word) with an ellipsis when it is cut.
 */
export function snippet(x: string, max = 110): string {
  const t = x.replace(/\[\s*\d+\s*marks?\s*\]/gi, " ").replace(/[\uE000-\uF8FF]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.5 ? cut.slice(0, at) : t.slice(0, max)).replace(/[\s,;:.\-]+$/, "")}\u2026`;
}

/** Roughly how long a set of this many marks takes: about a minute a mark. */
export const minutesFor = (marks: number) => Math.max(1, Math.round(marks * 1.1));

/** An area of a specification is all, some or none chosen. */
export function areaState(codes: readonly string[], chosen: readonly string[]): "all" | "some" | "none" {
  const n = codes.filter((c) => chosen.includes(c)).length;
  return n === 0 ? "none" : n === codes.length ? "all" : "some";
}

/** Tapping an area: every topic of it, unless they all are chosen already (then none of them). Other areas are untouched. */
export function toggleArea(chosen: readonly string[], codes: readonly string[]): string[] {
  if (areaState(codes, chosen) === "all") return chosen.filter((c) => !codes.includes(c));
  return [...chosen, ...codes.filter((c) => !chosen.includes(c))];
}

/** How many filters are doing something (a topic counts one each; the search words are not counted, they have their own box). */
export const filterCount = (f: Pick<Filters, "paper" | "series" | "band" | "scheme">, topics: readonly string[]) =>
  topics.length + (f.paper ? 1 : 0) + (f.series ? 1 : 0) + (f.band !== "any" ? 1 : 0) + (f.scheme ? 1 : 0);

/** What a set remembers of a bank row. */
export function toQPart(r: BankRow): QPart {
  const p: QPart = { id: r.id, p: r.p, s: r.s, l: r.l, m: r.m, t: r.t, w: r.w, h: r.h, x: r.x.slice(0, 140) };
  if (r.or) p.or = 1;
  if (r.st) p.st = 1;
  if (r.ms) p.ms = 1;
  if (r.er) p.er = 1;
  if (r.msq) p.msq = 1;
  if (r.msf) p.msf = r.msf;
  if (r.k) p.k = r.k;
  if (r.sk) p.sk = r.sk;
  return p;
}

/** A new set from the rows chosen in a subject: the parts, and the names the sheet and summary will need without fetching the subject again. */
export function buildSetInput(meta: SubjectMeta, rows: readonly BankRow[], extra: Pick<SetInput, "name" | "paper"> = {}): SetInput {
  const names: Record<string, string> = {};
  const topics: Record<string, string> = {};
  for (const r of rows) {
    names[r.p] = meta.papers.find((x) => x.id.toLowerCase() === r.p.toLowerCase())?.name ?? r.p;
    names[r.s] = meta.series.find((x) => x.id === r.s)?.label ?? r.s;
    for (const code of r.t) { const t = meta.topics.find((x) => x.code === code); if (t) topics[code] = t.short ?? t.title; }
  }
  return { ...extra, subject: meta.slug, title: meta.title, cv: meta.cv, rq: meta.rq, names, topics, parts: rows.map(toQPart) };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";

/**
 * `parts.json` as the browser got it, made safe to draw: rows without a string id, label, paper or series are
 * dropped, the rest get the fields the list reads (topics, text, size). Throws when it is not a list, or when it is a
 * list whose every row was unusable, so a bad file reads as "did not load" (with a retry) instead of a crash.
 */
export function cleanRows(raw: unknown): BankRow[] {
  if (!Array.isArray(raw)) throw new Error("parts is not a list");
  const out: BankRow[] = [];
  for (const r of raw) {
    if (!isObj(r) || !str(r.id) || !str(r.l) || !str(r.p) || !str(r.s)) continue;
    out.push({
      ...(r as unknown as BankRow),
      m: typeof r.m === "number" && Number.isFinite(r.m) ? r.m : null,
      t: Array.isArray(r.t) ? r.t.filter(str) : [],
      w: typeof r.w === "number" ? r.w : 0,
      h: typeof r.h === "number" ? r.h : 0,
      x: str(r.x) ? r.x : "",
    });
  }
  if (raw.length > 0 && out.length === 0) throw new Error("parts has no usable rows");
  return out;
}

/** `text.json`: part id to its text. Anything else throws (so the search says it is using titles only). */
export function cleanText(raw: unknown): Record<string, string> {
  if (!isObj(raw)) throw new Error("text is not a map");
  const out: Record<string, string> = Object.create(null);
  for (const k of Object.keys(raw)) if (str(raw[k])) out[k] = raw[k];
  return out;
}
