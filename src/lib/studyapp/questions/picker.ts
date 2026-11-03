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
export function buildSetInput(meta: SubjectMeta, rows: readonly BankRow[]): SetInput {
  const names: Record<string, string> = {};
  const topics: Record<string, string> = {};
  for (const r of rows) {
    names[r.p] = meta.papers.find((x) => x.id.toLowerCase() === r.p.toLowerCase())?.name ?? r.p;
    names[r.s] = meta.series.find((x) => x.id === r.s)?.label ?? r.s;
    for (const code of r.t) { const t = meta.topics.find((x) => x.code === code); if (t) topics[code] = t.short ?? t.title; }
  }
  return { subject: meta.slug, title: meta.title, cv: meta.cv, rq: meta.rq, names, topics, parts: rows.map(toQPart) };
}
