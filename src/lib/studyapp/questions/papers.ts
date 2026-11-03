import { blocks, compareLabels, isAnswered, isMarked, progress, scoreSet, type QAnswer, type QSet } from "./model";
import { buildSetInput, hasScheme, type BankRow } from "./picker";
import type { SetInput } from "./model";
import { tierOf, type SubjectMeta } from "./subject";

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
  /** Marks printed over the paper (an "either, or" counts once); null if none are printed, and for a paper the student chooses questions from (its total would be every option added together). */
  marks: number | null;
  /** Parts with a mark scheme to check against. */
  schemes: number;
  /** "Higher", "Foundation", "Core" or "Extended" where the paper has one. */
  tier: string | null;
  /** A paper the student picks questions from (a set-text essay paper, a religion option): its printed total is every option added up, so no total is shown and unchosen questions are never "unmarked". */
  choose: boolean;
  /** The bank has only part of this paper: its marks are well short of what that paper usually carries, or many parts print no marks. */
  partial: boolean;
  /** The one small honesty line for the card, or null: "Part of this paper", "Choose from 16 questions". */
  note: string | null;
}

/** A paper whose printed marks add up to more than any sitting could (250+), or that is mostly either-or and over 200, is one the student chooses questions from. */
export function isChoosePaper(marks: number, questions: number, orBlocks: number): boolean {
  return marks >= 250 || (marks >= 200 && questions >= 3 && orBlocks / questions >= 0.5);
}

/** The total a paper code usually carries: the biggest total that two or more of its sittings share (a lone odd one is not "usual"). */
function usualMarks(totals: readonly number[]): number | null {
  if (totals.length < 3) return null;
  const n = new Map<number, number>();
  for (const t of totals) n.set(t, (n.get(t) ?? 0) + 1);
  let best: number | null = null;
  for (const [t, c] of n) if (c >= 2 && (best === null || t > best)) best = t;
  return best;
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
  const totals = new Map<string, number[]>();   // per paper code: the totals of its sittings that are not choose papers
  for (const [key, list] of by) {
    const sorted = list.slice().sort((a, b) => compareLabels(a.l, b.l));
    const first = sorted[0];
    const bs = blocks(sorted);
    const marked = bs.filter((b) => b.marks != null);
    const total = marked.length ? marked.reduce((n, b) => n + (b.marks ?? 0), 0) : null;
    const choose = total != null && isChoosePaper(total, bs.length, bs.filter((b) => b.parts.some((p) => p.or)).length);
    const series = meta.series.find((x) => x.id === first.s)?.label ?? first.s;
    const info = meta.papers.find((x) => x.id.toLowerCase() === first.p.toLowerCase());
    const noMarks = sorted.filter((r) => r.m == null).length;
    if (total != null && !choose) { const code = first.p.toLowerCase(); totals.set(code, [...(totals.get(code) ?? []), total]); }
    out.push({
      key, s: first.s, p: first.p, series, name: info?.name ?? first.p, ...(info?.title ? { title: info.title } : {}),
      year: splitSeries(series).year, rows: sorted, questions: bs.length,
      marks: choose ? null : total,
      schemes: sorted.filter(hasScheme).length,
      tier: info ? tierOf(info) : null,
      choose,
      partial: !choose && noMarks > 0 && noMarks / sorted.length >= 0.1,
      note: null,
    });
  }
  const usual = new Map([...totals].map(([code, t]) => [code, usualMarks(t)] as const));
  for (const p of out) {
    const u = usual.get(p.p.toLowerCase());
    if (!p.choose && p.marks != null && u != null && p.marks < u * 0.8) p.partial = true;
    p.note = p.choose ? `Choose from ${p.questions.toLocaleString("en-GB")} ${p.questions === 1 ? "question" : "questions"}` : p.partial ? "Part of this paper" : null;
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

/** At least this share of a paper's answers marked, and it is "done"; below it the student has only started (or ended early). */
export const DONE_SHARE = 0.8;

/** How a paper is going, from the sets made from it (the newest is the attempt a card opens). */
export interface PaperState {
  /** The old four-way state; the card is drawn from `phase`. */
  kind: "new" | "started" | "marking" | "done";
  /** new: nothing written. started: the latest attempt is open. partial: finished with under 80% of its answers marked. done: finished (or all marked) with 80% or more marked. */
  phase: "new" | "started" | "partial" | "done";
  /** Answers marked over answers to mark (0 to 1): the width of the bar. */
  fraction: number;
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
  /** The card's line, and what a screen reader says. */
  line: string;
  /** The latest attempt's number (1 for the first) and how many attempts there are. */
  attempt: number;
  attempts: number;
  /** The best finished attempt with at least 80% marked, only while the latest attempt is not itself done (a retry is open): so a finished paper stays on the shelf. */
  best: { got: number; total: number; pct: number; done: number; of: number } | null;
}

const NEW_STATE: PaperState = { kind: "new", phase: "new", fraction: 0, done: 0, of: 0, got: 0, total: 0, pct: null, partial: false, line: "Not started", attempt: 0, attempts: 0, best: null };

interface Attempt { set: QSet; done: number; of: number; got: number; total: number; pct: number | null; fraction: number; touched: boolean; finished: boolean; phase: PaperState["phase"] }

function attemptOf(set: QSet, answers: Record<string, QAnswer>): Attempt {
  const p = progress(set, answers);
  const sc = scoreSet(set, answers);
  const touched = set.parts.some((x) => { const a = answers[`${set.id}/${x.id}`]; return isAnswered(a) || isMarked(a); });
  const fraction = p.of > 0 ? p.done / p.of : 0;
  const finished = !!set.finishedAt;
  const enough = p.of === 0 ? finished : fraction >= DONE_SHARE && (finished || p.done === p.of);
  const phase: PaperState["phase"] = enough ? "done" : finished ? "partial" : touched ? "started" : "new";
  return { set, done: p.done, of: p.of, got: sc.got, total: sc.total, pct: sc.pct, fraction, touched, finished, phase };
}

function lineOf(a: Attempt): string {
  switch (a.phase) {
    case "new": return "Not started";
    case "started": return a.done > 0 ? `Started, ${a.done} of ${a.of}` : "Started";
    case "partial": return a.done > 0 ? `Finished, ${a.done} of ${a.of}` : "Finished";
    case "done": return a.pct == null ? "Done" : `Done, ${a.got} of ${a.total} marks`;
  }
}

export function paperState(slug: string, key: string, sets: readonly QSet[], answers: Record<string, QAnswer>): PaperState {
  const mine = sets.filter((s) => s.subject === slug && s.paper === key).sort((a, b) => a.createdAt - b.createdAt);
  if (!mine.length) return NEW_STATE;
  const all = mine.map((s) => attemptOf(s, answers));
  const last = all[all.length - 1];
  let best: PaperState["best"] = null;
  if (last.phase !== "done") {
    for (const a of all) {
      if (a.phase !== "done" || !a.finished || a.pct == null) continue;
      if (!best || a.pct > best.pct) best = { got: a.got, total: a.total, pct: a.pct, done: a.done, of: a.of };
    }
  }
  const kind = last.finished ? "done" : last.done > 0 ? "marking" : last.touched ? "started" : "new";
  return {
    kind, phase: last.phase, fraction: last.phase === "done" ? 1 : last.fraction, set: last.set, done: last.done, of: last.of, got: last.got, total: last.total, pct: last.pct,
    partial: last.of > 0 && last.done * 2 < last.of, line: lineOf(last), attempt: all.length, attempts: all.length, best,
  };
}

/** The line on a card, and what a screen reader says. */
export const stateLine = (s: PaperState): string => s.line;

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
export const countsLine = (p: Pick<Paper, "questions" | "marks"> & Partial<Pick<Paper, "choose">>) =>
  p.choose ? `choose from ${plural(p.questions, "question", "questions")}` : `${plural(p.questions, "question", "questions")}${p.marks != null ? `, ${plural(p.marks, "mark", "marks")}` : ""}`;

/** "June 2025 Paper 1 Foundation, 24 questions, 80 marks, not started": a card's name. */
export function paperAria(p: Paper, s: PaperState): string {
  const more = [
    p.partial ? "part of this paper" : "",
    s.attempt >= 2 ? `attempt ${s.attempt}` : "",
    s.best ? `best attempt ${s.best.got} of ${s.best.total} marks` : "",
  ].filter(Boolean);
  return [`${p.series} ${p.name}`, countsLine(p), ...more, stateLine(s).toLowerCase()].join(", ");
}

/** The set a paper opens as: all its parts, in order, named for the subject and the sitting. */
export function paperSetInput(meta: SubjectMeta, p: Paper): SetInput {
  return buildSetInput(meta, p.rows, { name: `${p.series} ${p.name}, ${meta.title}`.slice(0, 80), paper: p.key, ...(p.choose ? { choose: 1 as const } : {}) });
}
