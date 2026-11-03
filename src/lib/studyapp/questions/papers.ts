import { blocks, compareLabels, isAnswered, isMarked, progress, scoreSet, type QAnswer, type QSet } from "./model";
import { buildSetInput, hasScheme, type BankRow } from "./picker";
import type { SetInput } from "./model";
import type { SubjectMeta } from "./subject";

/**
 * Whole past papers, made from a subject's rows (`parts.json`): the shelf's cards. Pure. A paper is every row of one
 * series and one paper code, in printed order; its question count and marks come from those rows and nothing else, so a
 * paper with questions missing from the bank is simply a shorter paper (it still opens).
 */
export interface Paper {
  /** `"JUN25|84631h"`: series id and paper code (lower case). Stored on the set made from it. */
  key: string;
  s: string;
  p: string;
  /** "June 2025", as the bank names the sitting. */
  series: string;
  /** "Paper 1 Foundation". */
  name: string;
  /** What the paper is about, where the bank says ("The crusades, c1095-1204"). */
  title?: string;
  /** "2025", or the sitting's own word where it has no year ("Specimen"). */
  year: string;
  /** In printed order. */
  rows: BankRow[];
  questions: number;
  /** Marks printed over the paper (an "either, or" counts once); null if none are printed. */
  marks: number | null;
  /** Parts with a mark scheme to check against. */
  schemes: number;
}

/** A month as it is lettered on a card: long names are shortened ("Nov"), so the year always fits. */
export const shortMonth = (m: string) => (m.length > 5 ? m.slice(0, 3) : m);

export const paperKey = (s: string, p: string) => `${s}|${p.toLowerCase()}`;

/** "June 2025 (R)" is month "June", year "2025", tag "(R)"; a sitting with no year ("Specimen") is all year. */
export function splitSeries(label: string): { month: string; year: string; tag: string } {
  const m = label.match(/^(.*?)\s*\b((?:19|20)\d\d)\b\s*(.*)$/);
  return m ? { month: m[1].trim(), year: m[2], tag: m[3].trim() } : { month: "", year: label.trim(), tag: "" };
}

/** Group a subject's rows into its papers, newest sitting first (the bank lists series that way), then paper in the bank's order. */
export function groupPapers(rows: readonly BankRow[], meta: Pick<SubjectMeta, "series" | "papers">): Paper[] {
  const seriesRank = new Map(meta.series.map((x, i) => [x.id, i]));
  const paperRank = new Map(meta.papers.map((x, i) => [x.id.toLowerCase(), i]));
  const by = new Map<string, BankRow[]>();
  for (const r of rows) {
    const k = paperKey(r.s, r.p);
    const a = by.get(k);
    if (a) a.push(r); else by.set(k, [r]);
  }
  const out: Paper[] = [];
  for (const [key, list] of by) {
    const sorted = list.slice().sort((a, b) => compareLabels(a.l, b.l));
    const first = sorted[0];
    const bs = blocks(sorted);
    const marked = bs.filter((b) => b.marks != null);
    const series = meta.series.find((x) => x.id === first.s)?.label ?? first.s;
    const info = meta.papers.find((x) => x.id.toLowerCase() === first.p.toLowerCase());
    out.push({
      key, s: first.s, p: first.p, series, name: info?.name ?? first.p, ...(info?.title ? { title: info.title } : {}),
      year: splitSeries(series).year, rows: sorted, questions: bs.length,
      marks: marked.length ? marked.reduce((n, b) => n + (b.marks ?? 0), 0) : null,
      schemes: sorted.filter(hasScheme).length,
    });
  }
  return out.sort((a, b) =>
    (seriesRank.get(a.s) ?? 1e6) - (seriesRank.get(b.s) ?? 1e6) || a.s.localeCompare(b.s)
    || (paperRank.get(a.p.toLowerCase()) ?? 1e6) - (paperRank.get(b.p.toLowerCase()) ?? 1e6) || (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
}

/** The shelf holds the latest few; the rest are "More papers". */
export const SHELF_PAPERS = 10;
export function shelfOf<T>(papers: readonly T[], n = SHELF_PAPERS): { shown: T[]; more: number } {
  return { shown: papers.slice(0, n), more: Math.max(0, papers.length - n) };
}

/** The years of a list of papers, in the order they first appear (newest first), with how many papers each holds. */
export function yearsOf(papers: readonly Pick<Paper, "year">[]): { year: string; n: number }[] {
  const by = new Map<string, number>();
  for (const p of papers) by.set(p.year, (by.get(p.year) ?? 0) + 1);
  return [...by].map(([year, n]) => ({ year, n }));
}

/** How a paper is going, from the set made from it (the newest, if the student has begun it more than once). */
export interface PaperState {
  kind: "new" | "started" | "marking" | "done";
  set?: QSet;
  /** Parts marked, and parts there are to mark. */
  done: number;
  of: number;
  /** The student's own marks over the parts they marked, and their percent (null if nothing is marked). */
  got: number;
  total: number;
  pct: number | null;
  /** Finished with less than half of the parts marked: the score is of a few parts, so it is not shown as a verdict. */
  partial: boolean;
}

export function paperState(slug: string, key: string, sets: readonly QSet[], answers: Record<string, QAnswer>): PaperState {
  let set: QSet | undefined;
  for (const s of sets) if (s.subject === slug && s.paper === key && (!set || s.createdAt > set.createdAt)) set = s;
  if (!set) return { kind: "new", done: 0, of: 0, got: 0, total: 0, pct: null, partial: false };
  const p = progress(set, answers);
  const sc = scoreSet(set, answers);
  const touched = set.parts.some((x) => { const a = answers[`${set!.id}/${x.id}`]; return isAnswered(a) || isMarked(a); });
  const kind = set.finishedAt ? "done" : p.done > 0 ? "marking" : touched ? "started" : "new";
  return { kind, set, done: p.done, of: p.of, got: sc.got, total: sc.total, pct: sc.pct, partial: p.of > 0 && p.done * 2 < p.of };
}

/** The line on a card, and what a screen reader says. */
export function stateLine(s: PaperState): string {
  switch (s.kind) {
    case "new": return "Not started";
    case "started": return "Started";
    case "marking": return `${s.done} of ${s.of} marked`;
    case "done": return s.pct == null ? "Done" : s.partial ? `Done, ${s.done} of ${s.of} marked` : `Done, ${s.got} of ${s.total} marks`;
  }
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
export const countsLine = (p: Pick<Paper, "questions" | "marks">) => `${plural(p.questions, "question", "questions")}${p.marks != null ? `, ${plural(p.marks, "mark", "marks")}` : ""}`;

/** "June 2025 Paper 1 Foundation, 24 questions, 80 marks, not started": a card's name. */
export function paperAria(p: Paper, s: PaperState): string {
  return `${p.series} ${p.name}, ${countsLine(p)}, ${stateLine(s).toLowerCase()}`;
}

/** The set a paper opens as: all its parts, in order, named for the subject and the sitting. */
export function paperSetInput(meta: SubjectMeta, p: Paper): SetInput {
  return buildSetInput(meta, p.rows, { name: `${p.series} ${p.name}, ${meta.title}`.slice(0, 80), paper: p.key });
}
