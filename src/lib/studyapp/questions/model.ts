/**
 * The Questions tab's data and every change to it, as pure functions: (data, ...) to data. Nothing here touches the
 * browser, so every rule is tested (model.test.ts). The app's store keeps it on the device inside the one JSON
 * document (`AppData.questions`, additive: an older tab ignores it), except ink, which is too big for localStorage
 * and lives in IndexedDB (inkDb.ts); this document only remembers how much ink each answer has.
 */

/** A question part as a set remembers it: the bank's own short keys, so a set can be shown without fetching the subject again. */
export interface QPart {
  id: string;
  p: string;
  s: string;
  /** Label as printed, "01.4", "3(b)(i)". */
  l: string;
  m: number | null;
  t: string[];
  w: number;
  h: number;
  or?: 1;
  st?: 1;
  ms?: 1;
  er?: 1;
  msq?: 1;
  msf?: string;
  k?: string;
  sk?: string;
  /** A listening question's recording (relative to the papers base), and whether it is the whole paper's (the question starts after its number is read out). */
  au?: string;
  auw?: 1;
  /** Reads the paper's booklet (sources, texts, resources, insert): the bank's own flag, or what `needsInsert` found when the set was made. */
  src?: 1;
  /** Has a worked solution in the bank. */
  sol?: 1;
  /** The opening words, for the picture's alt text. */
  x?: string;
}

export interface QSet {
  id: string;
  name: string;
  /** The bank subject's slug. */
  subject: string;
  /** "AQA GCSE Physics". */
  title: string;
  /** The bank's cropVersion for this subject, so a re-cut crop is fetched afresh. */
  cv?: number;
  /** The subject's examiner's reports are keyed by question (Edexcel), not by the question its parts share. */
  rq?: 1;
  /** Bank paper and series names, for the sheet's small print: `{ "84631H": "Paper 1 Higher", "JUN25": "June 2025" }`. */
  names: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  parts: QPart[];
  /** Topic code to its short title, for the summary. */
  topics: Record<string, string>;
  /** The question the student was on (an index into `blocks(set)`). */
  at: number;
  finishedAt?: number;
  redoOf?: string;
  /** Set when this is a whole past paper opened from a shelf: `"JUN25|84631h"` (series, paper code) of the subject, so the shelf can show its progress. */
  paper?: string;
  /** A paper the student picks questions from (a choose-one paper): the questions they leave alone are not "unmarked", they were never chosen. */
  choose?: 1;
  /**
   * The subject's question feed (`feedId(subject)`): one standing set per subject that holds every question the student has touched in the feed, so an answer
   * belongs to its question and not to a set made for it. It has no finish, is never "the set on the desk", and is not one of the 40 sets the cap counts.
   */
  feed?: 1;
}

export type Mode = "ink" | "type";

export interface QAnswer {
  mode?: Mode;
  /** Typed answer. */
  text?: string;
  /** How much ink there is: strokes and bytes (the ink itself is in IndexedDB). */
  ink?: { n: number; b: number };
  /** Marks the student drew ON the printed question (their own ink key, `<set>/<part>:q`): how many strokes and bytes. Annotating changes nothing else about the answer. */
  ann?: { n: number; b: number };
  /** Zone height in logical units, if the student made it bigger. */
  h?: number;
  /** The mark scheme has been opened. */
  chk?: 1;
  /** Self-marked: marks the student gave themselves. Never set by the app. */
  got?: number;
  at: number;
}

export type Bg = "plain" | "ruled" | "dotted" | "graph";
export const BGS: readonly Bg[] = ["plain", "ruled", "dotted", "graph"];
export type Tool = "pen" | "eraser";
export type TypeSize = "normal" | "large";
export const TYPE_REM: Record<TypeSize, number> = { normal: 1, large: 1.375 };

export interface QPrefs {
  /** "Finger scrolls, pen writes": fingers move the page and only a pen draws. Unset means the device's default. */
  fingerScrolls?: boolean;
  /** A pen has been seen on this device: the page starts as a pen page. */
  penSeen?: boolean;
  /** Typed answers in the handwriting font. */
  hand?: boolean;
  /** Single-key shortcuts (N B P E Z) on the sheet: on unless switched off. They only act while focus is on the writing surface or the pen tray; Alt plus the key works anywhere. */
  keys?: boolean;
  /** Every part starts in Type rather than Write (a part the student switched keeps its own choice). */
  alwaysType?: boolean;
  /** Size of typed answers: Normal is 1rem, Large 1.375rem. */
  typeSize?: TypeSize;
  bg: Bg;
  tool: Tool;
  colour: number;
  width: number;
}

export interface QuestionsData {
  sets: QSet[];
  /** `${setId}/${partId}` to the answer. */
  answers: Record<string, QAnswer>;
  /** Parts done lately, newest first, so a mix avoids them. */
  recent: { id: string; at: number }[];
  /** The set on the desk now (restored when the tab is opened again), or none: the picker. */
  open: string | null;
  /** The last subject and topics chosen in the picker. */
  pick: { subject: string | null; topics: string[] };
  /** The subjects the student does, as bank slugs (the slug names the level and the exam board too), in the order chosen. Unset until they have chosen (`mine.ts` derives it for older data). */
  mine?: string[];
  /** The tier the student sits, per subject slug (`["Higher"]`); a subject with none here shows both. Only for subjects that have tiers. */
  tiers?: Record<string, string[]>;
  prefs: QPrefs;
}

export const DEFAULT_PREFS: QPrefs = { bg: "plain", tool: "pen", colour: 0, width: 1 };
export const EMPTY_QUESTIONS: QuestionsData = { sets: [], answers: {}, recent: [], open: null, pick: { subject: null, topics: [] }, prefs: DEFAULT_PREFS };

export const MAX_SETS = 40;
export const MAX_SET_PARTS = 60;
/** A whole past paper can have more parts than a hand-picked set (the longest in the bank has 73). */
export const MAX_PAPER_PARTS = 120;
/** A subject's feed set holds every question the student has touched (written on, opened the scheme of, marked), not every question in the bank. */
export const MAX_FEED_PARTS = 1200;
export const MAX_MINE = 40;
export const MAX_RECENT = 500;
export const TEXT_PART_CAP = 12_000;
/** All typed answers together, in characters: localStorage holds about five million, and the rest of the app lives there too. */
export const TEXT_TOTAL_CAP = 700_000;
export const ZONE_MIN_H = 140;
export const ZONE_PER_MARK = 90;
export const ZONE_MAX_H = 2400;

export const keyOf = (setId: string, partId: string) => `${setId}/${partId}`;

/** The id of a subject's feed set: the same every time, so two tabs cannot make two. */
export const feedId = (slug: string) => `feed-${slug}`;
/** The sets a student made (and sees): the standing feed sets are not among them. */
export const visibleSets = (q: Pick<QuestionsData, "sets">): QSet[] => q.sets.filter((s) => !s.feed);

let counter = 0;
export function newId(now: number): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 6) : Math.random().toString(36).slice(2, 8);
  return `qs_${now.toString(36)}${(counter++).toString(36)}${rand}`;
}

/* ── questions and their parts ───────────────────────────────────────── */

/** "01" of "01.4", "3" of "3(b)(i)". */
export const questionOf = (label: string) => label.match(/^\d+/)?.[0] ?? label;
export const questionKeyOf = (p: Pick<QPart, "p" | "s" | "l">) => `${p.p}-${p.s}-${questionOf(p.l)}`;

/** Compare labels the way a person reads them: 01.2 before 01.10, 3(a) before 3(b). */
export function compareLabels(a: string, b: string): number {
  const ta = a.match(/\d+|[a-z]+|[^\w\s]/gi) ?? [a], tb = b.match(/\d+|[a-z]+|[^\w\s]/gi) ?? [b];
  for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
    const x = ta[i], y = tb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny) { const d = Number(x) - Number(y); if (d) return d; }
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** One question on the sheet: the parts the student chose from it, in printed order. */
export interface Block {
  key: string;
  /** 1, 2, 3... down the sheet. */
  n: number;
  parts: QPart[];
  /** The part whose setup (the question's stem) is shown above the first part, if any. */
  stem: QPart | null;
  /** Marks printed for the block's parts, counting an "EITHER ... OR" choice once. */
  marks: number | null;
}

/** Marks for a group of parts: "EITHER (d) OR (e)" counts once, as in the bank. null if none are printed. */
export function marksOf(parts: readonly QPart[]): number | null {
  const counted = parts.filter((p) => p.m != null && !(p.or && parts.some((o) => !o.or)));
  return counted.length ? counted.reduce((s, p) => s + (p.m ?? 0), 0) : null;
}

/** Whether a part's own marks count toward the block's total. */
export const counts = (p: QPart, parts: readonly QPart[]) => p.m != null && !(p.or && parts.some((o) => !o.or));

/** Group a set's parts into the questions the sheet shows, in the order each question first appears. */
export function blocks(parts: readonly QPart[]): Block[] {
  const order: string[] = [];
  const by = new Map<string, QPart[]>();
  for (const p of parts) {
    const k = questionKeyOf(p);
    if (!by.has(k)) { by.set(k, []); order.push(k); }
    by.get(k)!.push(p);
  }
  return order.map((key, i) => {
    const ps = by.get(key)!.slice().sort((a, b) => compareLabels(a.l, b.l));
    return { key, n: i + 1, parts: ps, stem: ps.find((p) => p.st) ?? null, marks: marksOf(ps) };
  });
}

/* ── answers ─────────────────────────────────────────────────────────── */

export const hasInk = (a: QAnswer | undefined) => !!a?.ink && a.ink.n > 0;
export const hasText = (a: QAnswer | undefined) => !!a?.text && a.text.trim().length > 0;
/** Something is written on the sheet, in ink or type. */
export const isAnswered = (a: QAnswer | undefined) => hasInk(a) || hasText(a);
export const isMarked = (a: QAnswer | undefined) => a?.got !== undefined;

/** A multiple-choice part (it has an answer letter) is answered with one letter: a short strip, not a page. */
export const ZONE_MCQ_H = 72;

/** Zone height in logical units for a part: about 90 per mark, at least 140 (a one-letter multiple-choice answer, 72), or what the student made it. */
export function zoneHeight(p: Pick<QPart, "m"> & { k?: string }, a?: QAnswer): number {
  const base = p.k ? ZONE_MCQ_H : Math.max(ZONE_MIN_H, (p.m ?? 0) * ZONE_PER_MARK);
  return Math.min(ZONE_MAX_H, Math.max(a?.h ?? 0, base));
}

/**
 * What an empty answer space can say for a part that is not prose: a table to fill in, a graph or diagram to draw. The bank keeps only a
 * part's opening words, so this reads those and says nothing when they do not make it clear.
 */
export function answerHint(p: Pick<QPart, "x" | "k">): string | null {
  if (p.k) return null;
  const x = (p.x ?? "").slice(0, 160);
  if (/\b(complete|fill in|finish)\b[^.?]{0,30}\btable\b/i.test(x)) return "Write the numbers here";
  if (/\b(draw|sketch|plot)\b/i.test(x)) return "Draw it here";
  if (/\blabel\b/i.test(x)) return "Write the labels here";
  return null;
}

/** Marks a student can give themselves: none if the paper prints none. */
export const markable = (p: QPart) => p.m != null && p.m > 0;

/* ── totals and the summary ──────────────────────────────────────────── */

export interface TopicScore { code: string; title: string; got: number; total: number }
export interface Score {
  /** Marks the student gave themselves, on the parts they marked. */
  got: number;
  /** Marks printed on the parts they marked: a part nobody marked is not a zero, it is simply not in the score. */
  total: number;
  /** Marks printed on every part that counts, marked or not. */
  printed: number;
  /** 0 to 100 over the marked parts, or null when nothing is marked (or no marks were printed on what was). */
  pct: number | null;
  /** Marked parts only, by topic. */
  perTopic: TopicScore[];
  /** Parts with nothing written and no mark given. */
  skipped: QPart[];
  /** Parts self-marked below full marks. */
  dropped: QPart[];
  /** Parts with marks to give that the student has not marked yet. */
  unmarked: QPart[];
  /** Parts marked by the student. */
  marked: number;
  /** Parts that have marks to give (marked or not). */
  markable: number;
  parts: number;
}

export function scoreSet(set: Pick<QSet, "id" | "parts" | "topics"> & { choose?: 1 }, answers: Record<string, QAnswer>): Score {
  let got = 0, total = 0, printed = 0, marked = 0, markableN = 0;
  const topics = new Map<string, TopicScore>();
  const skipped: QPart[] = [], dropped: QPart[] = [], unmarked: QPart[] = [];
  for (const b of blocks(set.parts)) {
    for (const p of b.parts) {
      const a = answers[keyOf(set.id, p.id)];
      const done = isMarked(a);
      // In a paper the student chooses questions from, a part they never touched was not chosen: it is neither skipped nor "to mark".
      const chosen = !set.choose || isAnswered(a) || done;
      if (markable(p) && chosen) { markableN++; if (done) marked++; else unmarked.push(p); }
      if (chosen && !isAnswered(a) && !done) skipped.push(p);
      if (!counts(p, b.parts)) continue;
      printed += p.m ?? 0;
      if (!done) continue;   // not marked: not scored, neither as a mark nor as a zero
      const g = Math.min(a!.got ?? 0, p.m ?? 0);
      got += g; total += p.m ?? 0;
      if (g < (p.m ?? 0)) dropped.push(p);
      const code = p.t[0] ?? "other";
      const t = topics.get(code) ?? { code, title: set.topics[code] ?? "Other", got: 0, total: 0 };
      t.got += g; t.total += p.m ?? 0;
      topics.set(code, t);
    }
  }
  return {
    got, total, printed, pct: total > 0 ? Math.round((got / total) * 100) : null,
    perTopic: [...topics.values()], skipped, dropped, unmarked, marked, markable: markableN, parts: set.parts.length,
  };
}

/** At least this share of the parts to mark must be marked before a score is shown as a result. */
export const SCORE_SHARE = 0.5;
/** ... and this share before the page may celebrate. */
export const CELEBRATE_SHARE = 0.8;

/**
 * How the end of a set reads, from what the student actually did. It leads with coverage ("3 of 25 marked"), shows the score only
 * when at least half of the parts to mark are marked (a score over three parts is not a result), and celebrates only when most
 * parts are marked and went well. Never a verdict on parts nobody marked.
 */
export function summaryView(s: Pick<Score, "marked" | "markable" | "total" | "pct">): {
  share: number; title: string; showScore: boolean; mascot: "plumi-encouraging" | "plumi-lofi-cozy" | "plumi-proud" | "plumi-celebrating"; tone: "" | "full" | "part";
} {
  const share = s.markable > 0 ? s.marked / s.markable : 0;
  const showScore = s.total > 0 && s.pct !== null && share >= SCORE_SHARE;
  const most = share >= CELEBRATE_SHARE;
  const title = s.markable === 0 ? "Set done" : most ? "Set done" : s.marked === 0 ? "Nothing marked yet" : `${s.marked} of ${s.markable} marked`;
  const mascot = s.markable === 0 || s.marked === 0 || share < 0.25 ? (s.markable === 0 ? "plumi-lofi-cozy" : "plumi-encouraging")
    : !showScore ? "plumi-lofi-cozy"
    : most && (s.pct ?? 0) >= 80 ? "plumi-celebrating" : (s.pct ?? 0) >= 50 ? "plumi-proud" : "plumi-encouraging";
  const tone = !showScore ? "" : (s.pct ?? 0) >= 80 ? "full" : "part";
  return { share, title, showScore, mascot, tone };
}

/** One dot per part of a set, in printed order, grouped by question: what was marked, written on, or left blank. */
export interface PartDot { part: QPart; question: number; state: "marked" | "written" | "blank" | "unchosen"; tone: "full" | "part" | "zero" | "" }
export function partDots(set: Pick<QSet, "id" | "parts" | "choose">, answers: Record<string, QAnswer>): PartDot[] {
  const out: PartDot[] = [];
  for (const b of blocks(set.parts)) {
    for (const p of b.parts) {
      const a = answers[keyOf(set.id, p.id)];
      const marked = isMarked(a);
      const state = marked ? "marked" : isAnswered(a) ? "written" : set.choose ? "unchosen" : "blank";
      const tone = !marked || !p.m ? "" : (a!.got ?? 0) >= p.m ? "full" : (a!.got ?? 0) > 0 ? "part" : "zero";
      out.push({ part: p, question: b.n, state, tone });
    }
  }
  return out;
}

/** What a block scored: marks given and the marks printed on the parts marked. null if none are printed; `marked` counts parts marked. */
export function blockScore(set: Pick<QSet, "id">, b: Block, answers: Record<string, QAnswer>): { got: number; total: number; marked: number } | null {
  if (b.marks == null) return null;
  let got = 0, total = 0, marked = 0;
  for (const p of b.parts) {
    const a = answers[keyOf(set.id, p.id)];
    if (!isMarked(a)) continue;
    marked++;
    if (counts(p, b.parts)) { got += Math.min(a!.got ?? 0, p.m ?? 0); total += p.m ?? 0; }
  }
  return { got, total, marked };
}

/**
 * Parts that have marks to give, and how many the student has marked, for the progress line. In a paper the student chooses
 * questions from (`choose`), only the parts they have written on or marked count: the alternatives they left are not to mark.
 */
export function progress(set: Pick<QSet, "id" | "parts"> & { choose?: 1 }, answers: Record<string, QAnswer>): { done: number; of: number } {
  let done = 0, of = 0;
  for (const p of set.parts) {
    if (!markable(p)) continue;
    const a = answers[keyOf(set.id, p.id)];
    const m = isMarked(a);
    if (set.choose && !m && !isAnswered(a)) continue;
    of++;
    if (m) done++;
  }
  return { done, of };
}

/** Before finishing: how many parts with marks to give are not marked, and how many of those are blank. */
export function finishCheck(set: Pick<QSet, "id" | "parts"> & { choose?: 1 }, answers: Record<string, QAnswer>): { unmarked: number; blank: number } {
  let unmarked = 0, blank = 0;
  for (const p of set.parts) {
    if (!markable(p)) continue;
    const a = answers[keyOf(set.id, p.id)];
    if (isMarked(a)) continue;
    if (set.choose && !isAnswered(a)) continue;   // a question they did not choose is not left unmarked
    unmarked++;
    if (!isAnswered(a)) blank++;
  }
  return { unmarked, blank };
}

/** A name from a set's table of names, only if the set really has it (never something inherited by an object). */
export function nameOf(names: Record<string, string>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(names, key) ? names[key] : undefined;
}

/** The words of `text` up to `max` characters, cut at a word and marked with an ellipsis when something was left out. */
export function cutWords(text: string, max: number): { text: string; cut: boolean } {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return { text: t, cut: false };
  const head = t.slice(0, max + 1);
  const at = head.lastIndexOf(" ");
  const keep = (at > max * 0.5 ? head.slice(0, at) : head.slice(0, max)).replace(/[\s,;:.\-([{]+$/, "");
  return { text: `${keep}\u2026`, cut: true };
}

/**
 * The text a screen reader gets for a part's picture. The picture holds the question, and the bank keeps only its opening
 * words (`x`), so this says what it has and where the rest is: a cut is never passed off as the whole question.
 */
export function partAlt(p: Pick<QPart, "l" | "m" | "x">): string {
  const marks = p.m != null && p.m > 0 ? ` (${p.m} ${p.m === 1 ? "mark" : "marks"})` : "";
  const head = `Question ${p.l}${marks}`;
  const x = (p.x ?? "").replace(/\s+/g, " ").trim();
  if (!x) return `${head}. A picture of the question. Open Read as text under it.`;
  const c = cutWords(x, 110);
  const whole = !c.cut && /\[\d+ marks?\]$/.test(x);
  return whole ? `${head}: ${x}` : `${head}. It starts: ${c.text}${c.cut ? "" : "."} That is only the start. Open Read as text under the picture for more.`;
}

/* ── changes ─────────────────────────────────────────────────────────── */

export interface SetInput {
  name?: string;
  subject: string;
  title: string;
  cv?: number;
  rq?: 1;
  names: Record<string, string>;
  topics: Record<string, string>;
  parts: readonly QPart[];
  redoOf?: string;
  /** A whole paper from a shelf (see `QSet.paper`). */
  paper?: string;
  /** A paper the student picks questions from (see `QSet.choose`). */
  choose?: 1;
}

const clampStr = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

/** Parts in the order a set will show them: questions in the order chosen, parts within a question in printed order. */
export function orderParts(parts: readonly QPart[]): QPart[] {
  return blocks(parts).flatMap((b) => b.parts);
}

export function createSet(q: QuestionsData, input: SetInput, now: number): { q: QuestionsData; id: string; dropped: string[] } {
  const seen = new Set<string>();
  const unique = input.parts.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, input.paper || input.redoOf ? MAX_PAPER_PARTS : MAX_SET_PARTS);
  const parts = orderParts(unique);
  const id = newId(now);
  const qs = blocks(parts).length;
  const name = clampStr(input.name?.trim() || `${input.title}, ${qs} question${qs === 1 ? "" : "s"}`, 80);
  const set: QSet = { id, name, subject: input.subject, title: input.title, cv: input.cv, rq: input.rq, names: input.names, createdAt: now, updatedAt: now, parts, topics: input.topics, at: 0, redoOf: input.redoOf };
  if (input.paper) set.paper = input.paper;
  if (input.choose) set.choose = 1;
  let sets = [set, ...q.sets];
  const dropped: string[] = [];
  // (a subject's feed set is not one of the sets the cap counts, and is never the one that makes room)
  while (sets.filter((s) => !s.feed).length > MAX_SETS) {
    // oldest finished set first; else the oldest of all (never the one just made)
    const rest = sets.slice(1).filter((s) => !s.feed);
    const victim = [...rest].reverse().find((s) => s.finishedAt) ?? rest[rest.length - 1];
    dropped.push(victim.id);
    sets = sets.filter((s) => s.id !== victim.id);
  }
  const next = { ...q, sets, open: id };
  return { q: dropped.length ? removeAnswers(next, new Set(dropped)) : next, id, dropped };
}

/** The one calm line for when a new set made room by removing older ones (never silent: a finished set goes first, then the oldest). */
export const droppedLine = (n: number): string => (n === 1 ? "An old set was removed to make room." : `${n} old sets were removed to make room.`);

function removeAnswers(q: QuestionsData, ids: ReadonlySet<string>): QuestionsData {
  const answers: Record<string, QAnswer> = {};
  for (const [k, v] of Object.entries(q.answers)) if (!ids.has(k.split("/")[0])) answers[k] = v;
  return { ...q, answers };
}

export function deleteSet(q: QuestionsData, id: string): QuestionsData {
  const next = removeAnswers({ ...q, sets: q.sets.filter((s) => s.id !== id) }, new Set([id]));
  return next.open === id ? { ...next, open: null } : next;
}

export const openSet = (q: QuestionsData, id: string | null): QuestionsData => ({ ...q, open: id === null || q.sets.some((s) => s.id === id && !s.feed) ? id : q.open });

export const setAt = (q: QuestionsData, id: string, at: number): QuestionsData =>
  q.sets.some((s) => s.id === id && s.at !== at) ? { ...q, sets: q.sets.map((s) => (s.id === id ? { ...s, at } : s)) } : q;

/** What a subject's feed set is made of (the same fields a set made from a shelf takes, without the parts). */
export type FeedInfo = Pick<SetInput, "subject" | "title" | "cv" | "rq">;

/** The most parts a set may hold: a feed set holds what the student touched, a whole paper has up to 120, a hand-picked set 60. */
export const partCap = (s: Pick<QSet, "feed" | "paper" | "redoOf">) => (s.feed ? MAX_FEED_PARTS : s.paper || s.redoOf ? MAX_PAPER_PARTS : MAX_SET_PARTS);

/**
 * Add parts to a set that is already there (a part the set has is skipped; past the set's cap, the rest are left out and `added` says how many went in).
 * `names` and `topics` are the words the mark scheme's label and the summary need for the new parts. Existing answers are untouched.
 */
export function addParts(q: QuestionsData, setId: string, parts: readonly QPart[], extra: { names?: Record<string, string>; topics?: Record<string, string> }, now: number): { q: QuestionsData; added: number } {
  const set = q.sets.find((s) => s.id === setId);
  if (!set) return { q, added: 0 };
  const have = new Set(set.parts.map((p) => p.id));
  const fresh: QPart[] = [];
  for (const p of parts) if (!have.has(p.id) && set.parts.length + fresh.length < partCap(set)) { have.add(p.id); fresh.push(p); }
  if (!fresh.length) return { q, added: 0 };
  const next: QSet = { ...set, parts: [...set.parts, ...fresh], names: { ...set.names, ...extra.names }, topics: { ...set.topics, ...extra.topics }, updatedAt: now };
  return { q: { ...q, sets: q.sets.map((s) => (s.id === setId ? next : s)) }, added: fresh.length };
}

/**
 * Put a question into its subject's feed set (made on the first one), so an answer written on it has a set to hang on. Idempotent: a question that is
 * already there changes nothing. The feed set never goes on the desk (`open` is untouched). `ok` is false for a question past the cap (`MAX_FEED_PARTS`).
 */
export function feedTouch(q: QuestionsData, info: FeedInfo, part: QPart, names: Record<string, string>, topics: Record<string, string>, now: number): { q: QuestionsData; ok: boolean } {
  const id = feedId(info.subject);
  let base = q;
  if (!q.sets.some((s) => s.id === id)) {
    const set: QSet = { id, name: clampStr(`Feed: ${info.title}`, 80), subject: info.subject, title: info.title, cv: info.cv, rq: info.rq, names: {}, createdAt: now, updatedAt: now, parts: [], topics: {}, at: 0, feed: 1 };
    base = { ...q, sets: [...q.sets, set] };
  } else {
    const have = base.sets.find((s) => s.id === id)!;
    if (have.parts.some((p) => p.id === part.id)) return { q, ok: true };
    // Full: questions that were touched but hold nothing (no writing, no mark, no scheme opened) make room first.
    if (have.parts.length >= MAX_FEED_PARTS) base = { ...base, sets: base.sets.map((s) => (s.id === id ? { ...s, parts: s.parts.filter((p) => feedHolds(base.answers[keyOf(id, p.id)])) } : s)) };
  }
  const r = addParts(base, id, [part], { names, topics }, now);
  const has = r.q.sets.find((s) => s.id === id)?.parts.some((p) => p.id === part.id) ?? false;
  return { q: has ? r.q : q, ok: has };
}

/** An answer worth keeping a place for: something written, marked, or its scheme opened. */
export const feedHolds = (a: QAnswer | undefined): boolean => !!a && (isAnswered(a) || isMarked(a) || !!a.chk || hasAnn(a));

/**
 * Whether the feed can take this question now (it is in the set, there is room, or an empty touched question can make way): asked BEFORE the student writes, so a
 * full feed says so up front and never accepts writing the document would not know about.
 */
export function feedHasRoom(q: Pick<QuestionsData, "sets" | "answers">, slug: string, partId: string): boolean {
  const set = q.sets.find((s) => s.id === feedId(slug));
  if (!set || set.parts.length < MAX_FEED_PARTS || set.parts.some((p) => p.id === partId)) return true;
  return set.parts.some((p) => !feedHolds(q.answers[keyOf(set.id, p.id)]));
}

/** Questions the feed holds for a subject, and how many of them are written on and marked (what the quiet "x marked" line says). */
export function feedCounts(q: Pick<QuestionsData, "sets" | "answers">, slug: string): { touched: number; written: number; marked: number; got: number; total: number } {
  const set = q.sets.find((s) => s.id === feedId(slug));
  const out = { touched: 0, written: 0, marked: 0, got: 0, total: 0 };
  if (!set) return out;
  for (const p of set.parts) {
    const a = q.answers[keyOf(set.id, p.id)];
    if (isMarked(a)) { out.marked++; if (p.m) { out.got += Math.min(a!.got ?? 0, p.m); out.total += p.m; } }
    else if (isAnswered(a)) out.written++;
    if (a) out.touched++;
  }
  return out;
}

export const renameSet = (q: QuestionsData, id: string, name: string): QuestionsData => {
  const n = name.trim().slice(0, 80);
  return n ? { ...q, sets: q.sets.map((s) => (s.id === id ? { ...s, name: n } : s)) } : q;
};

function edit(q: QuestionsData, setId: string, partId: string, now: number, fn: (a: QAnswer) => QAnswer | null): QuestionsData {
  const set = q.sets.find((s) => s.id === setId);
  if (!set || !set.parts.some((p) => p.id === partId)) return q;
  const k = keyOf(setId, partId);
  const out = fn(q.answers[k] ?? { at: now });
  const answers = { ...q.answers };
  if (out === null) delete answers[k]; else answers[k] = { ...out, at: now };
  return { ...q, answers, sets: q.sets.map((s) => (s.id === setId ? { ...s, updatedAt: now } : s)) };
}

/** Total typed characters, to hold the device-wide cap. */
export const textChars = (q: QuestionsData) => Object.values(q.answers).reduce((n, a) => n + (a.text?.length ?? 0), 0);

export function setText(q: QuestionsData, setId: string, partId: string, text: string, now: number): { q: QuestionsData; ok: boolean } {
  const cut = text.slice(0, TEXT_PART_CAP);
  const prev = q.answers[keyOf(setId, partId)]?.text?.length ?? 0;
  if (textChars(q) - prev + cut.length > TEXT_TOTAL_CAP && cut.length > prev) return { q, ok: false };
  return { q: edit(q, setId, partId, now, (a) => ({ ...a, text: cut || undefined })), ok: cut.length === text.length };
}

export const setMode = (q: QuestionsData, setId: string, partId: string, mode: Mode, now: number) => edit(q, setId, partId, now, (a) => ({ ...a, mode }));
export const setHeight = (q: QuestionsData, setId: string, partId: string, h: number, now: number) =>
  edit(q, setId, partId, now, (a) => ({ ...a, h: Math.min(ZONE_MAX_H, Math.max(ZONE_MIN_H, Math.round(h))) }));
export const setInkMeta = (q: QuestionsData, setId: string, partId: string, n: number, b: number, now: number) =>
  edit(q, setId, partId, now, (a) => ({ ...a, ink: n > 0 ? { n, b } : undefined }));
/** How many strokes of marks on the question picture (the strokes themselves are in IndexedDB under `<set>/<part>:q`). */
export const setAnnMeta = (q: QuestionsData, setId: string, partId: string, n: number, b: number, now: number) =>
  edit(q, setId, partId, now, (a) => ({ ...a, ann: n > 0 ? { n, b } : undefined }));
export const hasAnn = (a: QAnswer | undefined) => !!a?.ann && a.ann.n > 0;
export const checkPart = (q: QuestionsData, setId: string, partId: string, now: number) => edit(q, setId, partId, now, (a) => ({ ...a, chk: 1 }));

/** Give the marks, and note the part as done lately. `got` is the student's own; null takes the mark back. */
export function markPart(q: QuestionsData, setId: string, partId: string, got: number | null, now: number): QuestionsData {
  const set = q.sets.find((s) => s.id === setId);
  const part = set?.parts.find((p) => p.id === partId);
  if (!part || !markable(part)) return q;
  const g = got === null ? undefined : Math.min(part.m ?? 0, Math.max(0, Math.round(got)));
  const next = edit(q, setId, partId, now, (a) => ({ ...a, got: g }));
  return g === undefined ? next : touchRecent(next, [partId], now);
}

/** Clear a part's answer: its ink, its typing, and the mark that went with them. The zone keeps its size and mode. */
export function resetPart(q: QuestionsData, setId: string, partId: string, now: number): QuestionsData {
  return edit(q, setId, partId, now, (a) => ({ at: a.at, mode: a.mode, h: a.h, ann: a.ann }));
}

export function touchRecent(q: QuestionsData, ids: readonly string[], now: number): QuestionsData {
  const mine = new Set(ids);
  const rest = q.recent.filter((r) => !mine.has(r.id));
  return { ...q, recent: [...ids.map((id) => ({ id, at: now })), ...rest].slice(0, MAX_RECENT) };
}

export function finishSet(q: QuestionsData, id: string, now: number): QuestionsData {
  const set = q.sets.find((s) => s.id === id);
  if (!set || set.finishedAt) return q;   // finishing twice (a double tap) changes nothing
  const done = set.parts.filter((p) => isAnswered(q.answers[keyOf(id, p.id)]) || isMarked(q.answers[keyOf(id, p.id)])).map((p) => p.id);
  return touchRecent({ ...q, sets: q.sets.map((s) => (s.id === id ? { ...s, finishedAt: now, updatedAt: now } : s)) }, done, now);
}

export const reopenSet = (q: QuestionsData, id: string): QuestionsData => ({ ...q, sets: q.sets.map((s) => (s.id === id ? { ...s, finishedAt: undefined } : s)) });

export const setPick = (q: QuestionsData, subject: string | null, topics: readonly string[]): QuestionsData => ({ ...q, pick: { subject, topics: topics.slice(0, 80) } });
/** The subjects the student does. Unknown or repeated slugs are dropped; the order is the order given. */
export const setMine = (q: QuestionsData, slugs: readonly string[]): QuestionsData => ({ ...q, mine: [...new Set(slugs)].slice(0, MAX_MINE) });
/** The tier the student sits in a subject (`null` or every tier: both, which is the same as nothing chosen). */
export function setTiers(q: QuestionsData, slug: string, tiers: readonly string[] | null, all: readonly string[] = []): QuestionsData {
  const next = { ...(q.tiers ?? {}) };
  const t = tiers ? [...new Set(tiers.filter((x) => x.length > 0).map((x) => x.slice(0, 20)))].slice(0, 4) : [];
  if (!t.length || (all.length > 0 && all.every((a) => t.includes(a)))) delete next[slug]; else next[slug] = t;
  const same = JSON.stringify(next) === JSON.stringify(q.tiers ?? {});
  if (same) return q;
  if (!Object.keys(next).length) { const { tiers: _gone, ...rest } = q; void _gone; return rest; }
  return { ...q, tiers: next };
}
export const setPrefs = (q: QuestionsData, p: Partial<QPrefs>): QuestionsData => ({ ...q, prefs: { ...q.prefs, ...p } });

/** A fresh set of the parts a student dropped marks on, with no answers carried over. */
export function redoInput(set: QSet, answers: Record<string, QAnswer>): SetInput | null {
  const { dropped } = scoreSet(set, answers);
  if (!dropped.length) return null;
  return { name: `Redo: ${set.name}`.slice(0, 80), subject: set.subject, title: set.title, cv: set.cv, rq: set.rq, names: set.names, topics: set.topics, parts: dropped, redoOf: set.id };
}

/** A fresh set of the parts that were skipped (nothing written, nothing marked), with no answers carried over. */
export function catchUpInput(set: QSet, answers: Record<string, QAnswer>): SetInput | null {
  const { skipped } = scoreSet(set, answers);
  if (!skipped.length) return null;
  return { name: `Skipped: ${set.name}`.slice(0, 80), subject: set.subject, title: set.title, cv: set.cv, rq: set.rq, names: set.names, topics: set.topics, parts: skipped, redoOf: set.id };
}

/** A whole paper again from the start (same parts, no answers carried over), or null if the set was not a whole paper. */
export function againInput(set: QSet): SetInput | null {
  if (!set.paper) return null;
  return { name: set.name, subject: set.subject, title: set.title, cv: set.cv, rq: set.rq, names: set.names, topics: set.topics, parts: set.parts, paper: set.paper, ...(set.choose ? { choose: 1 as const } : {}) };
}

/** Bytes of ink the answers say they hold, in total. */
/** Bytes of handwriting an answer holds: its answer ink and the marks drawn on its question (both are in IndexedDB and count towards the device's room). */
export const inkBytesOf = (a: QAnswer) => (a.ink?.b ?? 0) + (a.ann?.b ?? 0);
export const inkTotal = (q: QuestionsData) => Object.values(q.answers).reduce((n, a) => n + inkBytesOf(a), 0);
export const inkOfSet = (q: QuestionsData, setId: string) => Object.entries(q.answers).reduce((n, [k, a]) => (k.startsWith(`${setId}/`) ? n + inkBytesOf(a) : n), 0);

/* ── reading storage ─────────────────────────────────────────────────── */

const int = (n: unknown, lo: number, hi: number, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback);

function cleanPart(raw: unknown): QPart | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<QPart>;
  if (typeof r.id !== "string" || !r.id || typeof r.l !== "string" || typeof r.p !== "string" || typeof r.s !== "string") return null;
  const part: QPart = {
    id: r.id.slice(0, 80), p: r.p.slice(0, 40), s: r.s.slice(0, 20), l: r.l.slice(0, 30),
    m: typeof r.m === "number" && Number.isFinite(r.m) && r.m >= 0 ? Math.min(200, Math.round(r.m)) : null,
    t: Array.isArray(r.t) ? r.t.filter((t): t is string => typeof t === "string").slice(0, 6).map((t) => t.slice(0, 40)) : [],
    w: int(r.w, 1, 6000, 1000), h: int(r.h, 1, 20000, 400),
  };
  if (r.or) part.or = 1;
  if (r.st) part.st = 1;
  if (r.ms) part.ms = 1;
  if (r.er) part.er = 1;
  if (r.msq) part.msq = 1;
  if (typeof r.msf === "string") part.msf = r.msf.slice(0, 200);
  if (typeof r.k === "string") part.k = r.k.slice(0, 20);
  if (typeof r.sk === "string") part.sk = r.sk.slice(0, 80);
  if (typeof r.au === "string" && /^[\w./-]{3,160}$/.test(r.au) && !r.au.includes("..")) part.au = r.au;
  if (r.auw) part.auw = 1;
  if (r.src) part.src = 1;
  if (r.sol) part.sol = 1;
  if (typeof r.x === "string") part.x = r.x.slice(0, 140);
  return part;
}

function cleanRecord(raw: unknown, max: number, len: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && Object.keys(out).length < max) out[k.slice(0, 60)] = v.slice(0, len);
  }
  return out;
}

function cleanSet(raw: unknown): QSet | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<QSet>;
  if (typeof r.id !== "string" || !r.id || typeof r.subject !== "string") return null;
  const seen = new Set<string>();
  const parts: QPart[] = [];
  for (const p of Array.isArray(r.parts) ? r.parts : []) {
    const c = cleanPart(p);
    if (c && !seen.has(c.id)) { seen.add(c.id); parts.push(c); }
    if (parts.length >= (r.feed ? MAX_FEED_PARTS : typeof r.paper === "string" || typeof r.redoOf === "string" ? MAX_PAPER_PARTS : MAX_SET_PARTS)) break;
  }
  if (!parts.length) return null;
  const set: QSet = {
    id: r.id.slice(0, 60), name: clampStr(r.name, 80) || "Practice set", subject: r.subject.slice(0, 80), title: clampStr(r.title, 80),
    names: cleanRecord(r.names, 80, 80), createdAt: int(r.createdAt, 0, 9e15, 0), updatedAt: int(r.updatedAt, 0, 9e15, 0),
    parts, topics: cleanRecord(r.topics, 80, 100), at: 0,
  };
  set.at = int(r.at, 0, Math.max(0, blocks(parts).length - 1), 0);
  if (typeof r.cv === "number" && Number.isFinite(r.cv)) set.cv = Math.round(r.cv);
  if (r.rq) set.rq = 1;
  if (typeof r.finishedAt === "number" && Number.isFinite(r.finishedAt)) set.finishedAt = Math.round(r.finishedAt);
  if (typeof r.redoOf === "string") set.redoOf = r.redoOf.slice(0, 60);
  if (typeof r.paper === "string" && r.paper) set.paper = r.paper.slice(0, 80);
  if (r.choose) set.choose = 1;
  if (r.feed && set.id === feedId(set.subject)) set.feed = 1;
  return set;
}

/** A tidy copy of whatever was in storage, within every cap; anything unreadable becomes empty rather than breaking the page. */
export function sanitiseQuestions(raw: unknown): QuestionsData {
  if (!raw || typeof raw !== "object") return EMPTY_QUESTIONS;
  const r = raw as Partial<QuestionsData>;
  const seen = new Set<string>();
  const sets: QSet[] = [];
  for (const s of Array.isArray(r.sets) ? r.sets : []) {
    const c = cleanSet(s);
    if (c && !seen.has(c.id)) { seen.add(c.id); sets.push(c); }
    if (sets.filter((x) => !x.feed).length >= MAX_SETS) break;
  }
  const answers: Record<string, QAnswer> = {};
  let chars = 0;
  const entries = r.answers && typeof r.answers === "object" ? Object.entries(r.answers as Record<string, unknown>) : [];
  for (const [k, v] of entries) {
    const [setId, partId] = k.split("/");
    const part = sets.find((s) => s.id === setId)?.parts.find((p) => p.id === partId);
    if (!part || !v || typeof v !== "object") continue;
    const a = v as Partial<QAnswer>;
    const out: QAnswer = { at: int(a.at, 0, 9e15, 0) };
    if (a.mode === "ink" || a.mode === "type") out.mode = a.mode;
    if (typeof a.text === "string" && a.text) {
      const t = a.text.slice(0, TEXT_PART_CAP);
      if (chars + t.length <= TEXT_TOTAL_CAP) { out.text = t; chars += t.length; }
    }
    if (a.ink && typeof a.ink === "object" && typeof a.ink.n === "number" && a.ink.n > 0) out.ink = { n: int(a.ink.n, 1, 100_000, 1), b: int(a.ink.b, 0, 4_000_000, 0) };
    if (a.ann && typeof a.ann === "object" && typeof a.ann.n === "number" && a.ann.n > 0) out.ann = { n: int(a.ann.n, 1, 100_000, 1), b: int(a.ann.b, 0, 4_000_000, 0) };
    if (typeof a.h === "number") out.h = int(a.h, ZONE_MIN_H, ZONE_MAX_H, ZONE_MIN_H);
    if (a.chk) out.chk = 1;
    if (typeof a.got === "number" && markable(part)) out.got = int(a.got, 0, part.m ?? 0, 0);
    answers[k] = out;
  }
  const prefs: QPrefs = { ...DEFAULT_PREFS };
  const p = (r.prefs ?? {}) as Partial<QPrefs>;
  if (typeof p.fingerScrolls === "boolean") prefs.fingerScrolls = p.fingerScrolls;
  if (typeof p.penSeen === "boolean") prefs.penSeen = p.penSeen;
  if (typeof p.hand === "boolean") prefs.hand = p.hand;
  if (typeof p.keys === "boolean") prefs.keys = p.keys;
  if (typeof p.alwaysType === "boolean") prefs.alwaysType = p.alwaysType;
  if (p.typeSize === "normal" || p.typeSize === "large") prefs.typeSize = p.typeSize;
  if (p.bg && BGS.includes(p.bg)) prefs.bg = p.bg;
  if (p.tool === "pen" || p.tool === "eraser") prefs.tool = p.tool;
  prefs.colour = int(p.colour, 0, 2, 0);
  prefs.width = int(p.width, 0, 2, 1);
  const recent = (Array.isArray(r.recent) ? r.recent : [])
    .filter((x): x is { id: string; at: number } => !!x && typeof x.id === "string" && typeof x.at === "number" && Number.isFinite(x.at))
    .slice(0, MAX_RECENT).map((x) => ({ id: x.id.slice(0, 80), at: x.at }));
  const pk = (r.pick ?? {}) as Partial<QuestionsData["pick"]>;
  const mine = Array.isArray(r.mine) ? [...new Set(r.mine.filter((x): x is string => typeof x === "string" && x.length > 0).map((x) => x.slice(0, 80)))].slice(0, MAX_MINE) : undefined;
  const tiers: Record<string, string[]> = {};
  if (r.tiers && typeof r.tiers === "object" && !Array.isArray(r.tiers)) {
    for (const [k, v] of Object.entries(r.tiers as Record<string, unknown>).slice(0, MAX_MINE)) {
      if (!Array.isArray(v)) continue;
      const t = [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0).map((x) => x.slice(0, 20)))].slice(0, 4);
      if (t.length) tiers[k.slice(0, 80)] = t;
    }
  }
  return {
    sets, answers, recent, prefs, ...(mine ? { mine } : {}), ...(Object.keys(tiers).length ? { tiers } : {}),
    open: typeof r.open === "string" && sets.some((s) => s.id === r.open && !s.feed) ? r.open : null,
    pick: { subject: typeof pk.subject === "string" ? pk.subject.slice(0, 80) : null, topics: Array.isArray(pk.topics) ? pk.topics.filter((t): t is string => typeof t === "string").slice(0, 80).map((t) => t.slice(0, 40)) : [] },
  };
}
