/**
 * "From my mistakes": every question part the student marked themselves on and lost marks on, ready to become a flashcard. Pure (mistakes.test.ts): it reads
 * only the Questions data, because each set remembers its parts' marks, topics and labels (QPart), so no bank file is fetched to know what went wrong.
 *
 * A MISTAKE is a part that
 *   - the student gave themselves marks on (`got`; self-marked only: the app never marks an answer, so a typed or inked answer nobody marked is not here),
 *   - has marks printed (`m`) and `got < m`,
 *   - and has something to put on the back: a mark scheme picture (`ms`), or for a multiple-choice part its answer letter (`k`).
 * A part is counted once, by its most recent marked answer wherever it was answered (the feed holds every part touched; a set can repeat it): if the latest mark
 * is full marks the part is not a mistake any more. A part already made into a card (a card whose `pic.part` is its id) is left out.
 */
import { blocks, keyOf, nameOf, type QAnswer, type QPart, type QSet, type QuestionsData } from "./model";
import { subjectIn } from "../model";
import type { CardPic, Pic } from "../cardPics";

export interface Mistake {
  /** The bank part id: the card's identity. */
  part: string;
  set: string;
  /** "Q4(b)": the number as printed. */
  label: string;
  /** "June 2024 Paper 2". */
  from: string;
  got: number;
  marks: number;
  /** They typed an answer (shown on the back of the card). */
  typed: boolean;
  at: number;
  topic: { code: string; title: string };
}

export interface TopicGroup { code: string; title: string; mistakes: Mistake[] }
export interface SubjectGroup {
  /** The bank subject's slug. */
  subject: string;
  /** "AQA GCSE Physics". */
  title: string;
  /** "Physics": the deck a card goes to. */
  base: string;
  topics: TopicGroup[];
  count: number;
}
export interface Mistakes { groups: SubjectGroup[]; total: number }

/** "01.4" and "3(b)(i)" both read as a question number: Q01.4, Q3(b)(i). */
export const questionLabel = (l: string) => `Q${l}`;

const fromLine = (set: QSet, p: QPart) => `${nameOf(set.names, p.s) ?? p.s} ${nameOf(set.names, p.p.toUpperCase()) ?? nameOf(set.names, p.p) ?? p.p}`.trim();

/** A part is worth a card if it has a scheme picture or a one-letter answer to put on the back. */
const hasBack = (p: QPart) => !!p.ms || !!p.k;

export function collectMistakes(q: QuestionsData, made: ReadonlySet<string> = new Set()): Mistakes {
  // The latest marked answer for each part id, over every set.
  const latest = new Map<string, { set: QSet; part: QPart; a: QAnswer }>();
  for (const s of q.sets) {
    for (const p of s.parts) {
      const a = q.answers[keyOf(s.id, p.id)];
      if (!a || a.got === undefined) continue;
      const seen = latest.get(p.id);
      if (!seen || a.at > seen.a.at) latest.set(p.id, { set: s, part: p, a });
    }
  }
  const by = new Map<string, SubjectGroup>();
  for (const { set, part, a } of latest.values()) {
    const m = part.m ?? 0;
    if (m <= 0 || a.got === undefined || a.got >= m || !hasBack(part) || made.has(part.id)) continue;
    const code = part.t[0] ?? "";
    const g = by.get(set.subject) ?? { subject: set.subject, title: set.title, base: subjectIn(set.title) ?? "Other", topics: [], count: 0 };
    let t = g.topics.find((x) => x.code === code);
    if (!t) { t = { code, title: set.topics[code] ?? (code || "Other"), mistakes: [] }; g.topics.push(t); }
    t.mistakes.push({ part: part.id, set: set.id, label: questionLabel(part.l), from: fromLine(set, part), got: a.got, marks: m, typed: !!a.text && a.text.trim().length > 0, at: a.at, topic: { code, title: t.title } });
    g.count++;
    by.set(set.subject, g);
  }
  const groups = [...by.values()];
  for (const g of groups) {
    for (const t of g.topics) t.mistakes.sort((x, y) => y.at - x.at);
    // topics: the one with the most recent mistake first
    g.topics.sort((x, y) => y.mistakes[0].at - x.mistakes[0].at);
  }
  // subjects: the one with the most recent mistake first
  groups.sort((x, y) => y.topics[0].mistakes[0].at - x.topics[0].mistakes[0].at);
  return { groups, total: groups.reduce((n, g) => n + g.count, 0) };
}

/** The bank parts already made into cards (any deck). */
export const madeParts = (cards: readonly { pic?: CardPic }[]): Set<string> => new Set(cards.flatMap((c) => (c.pic?.part ? [c.pic.part] : [])));

/** What a mistake becomes: the question (its start, then the part) on the front, the board's scheme and the student's own marks on the back. */
export interface MistakeCard { front: string; back: string; pic: CardPic }

export function mistakeCard(q: QuestionsData, m: Mistake): MistakeCard | null {
  const set = q.sets.find((s) => s.id === m.set);
  const part = set?.parts.find((p) => p.id === m.part);
  if (!set || !part) return null;
  const a = q.answers[keyOf(set.id, part.id)];
  const stem = blocks(set.parts).find((b) => b.parts.some((p) => p.id === part.id))?.stem ?? null;
  const v = set.cv;
  const alt = (what: string) => `${what} for question ${part.l}, ${m.from}`;
  const f: Pic[] = [];
  if (stem) f.push({ id: stem.id, k: "stem", ...(stem.sk ? { sk: stem.sk } : {}), ...(v ? { v } : {}), alt: `The start of question ${part.l}, ${m.from}` });
  else if (part.sk) f.push({ id: part.id, k: "stem", sk: part.sk, ...(v ? { v } : {}), alt: `The start of question ${part.l}, ${m.from}` });
  f.push({ id: part.id, k: "qp", ...(v ? { v } : {}), alt: alt("The question") });
  const b: Pic[] = part.ms ? [{ id: part.id, k: "ms", ...(v ? { v } : {}), alt: alt("The mark scheme") }] : [];
  const lines = [`You gave yourself ${m.got} of ${m.marks}`];
  if (part.k && !part.ms) lines.push(`The answer is ${part.k}`);
  if (a?.text && a.text.trim()) lines.push(`Your answer: ${a.text.replace(/\s+/g, " ").trim().slice(0, 300)}`);
  return { front: `${m.label} · ${m.from}`.slice(0, 120), back: lines.join("\n"), pic: { part: part.id, f, ...(b.length ? { b } : {}) } };
}
