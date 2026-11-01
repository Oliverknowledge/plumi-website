/**
 * The Desk's and the flashcards' data, and every change to it, as pure functions: (data, ...) to data.
 * Nothing here touches the browser, so every rule is tested (model.test.ts). `store.ts` keeps it on the
 * device and tells React.
 */
import { newSchedule, schedule, queue, NEW_PER_DAY, type Grade, type Schedule } from "./srs";
import { STARTER_DECKS } from "./starterDecks";
import { addDays, dayOf, daysBetween } from "./time";

export interface Task {
  id: string;
  text: string;
  /** "Chemistry", "Maths", ... or null. A label, not a link: the app has no subject list yet. */
  subject: string | null;
  /** The London day it is due. */
  due: string;
  done: boolean;
  createdAt: number;
  doneAt: number | null;
}

export interface Exam { name: string; date: string }

export interface Deck { id: string; title: string; subject: string | null; createdAt: number; starter: string | null }
export interface Card { id: string; deckId: string; front: string; back: string; createdAt: number; sch: Schedule; lastReviewed: number | null }

/** Per London day: how many cards were reviewed, how many were not Again, and how many new ones were started. */
export interface DayLog { n: number; right: number; fresh: number }

export interface Last { kind: "cards" | "library" | "task"; label: string; href: string; at: number }

export interface AppData {
  v: 1;
  tasks: Task[];
  exam: Exam | null;
  decks: Deck[];
  cards: Card[];
  log: Record<string, DayLog>;
  last: Last | null;
  /** New cards a day. */
  perDay: number;
}

export const EMPTY: AppData = { v: 1, tasks: [], exam: null, decks: [], cards: [], log: {}, last: null, perDay: NEW_PER_DAY };

let counter = 0;
export function makeId(prefix: string, now: number): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${now.toString(36)}_${(counter++).toString(36)}${rand}`;
}

/* ── Subjects (a label on a task: colour and name) ───────────────────── */

export const SUBJECTS = ["Chemistry", "Physics", "Biology", "Maths", "Further Maths", "English", "History", "Geography", "Computer Science", "Languages", "Other"] as const;
const WORDS: [string, RegExp][] = [
  ["Further Maths", /\bfurther\s+maths?\b/i], ["Chemistry", /\bchem(istry)?\b/i], ["Physics", /\bphysics\b/i], ["Biology", /\bbio(logy)?\b/i],
  ["Maths", /\bmaths?\b|\bmathematics\b|\bcalculus\b|\balgebra\b/i], ["English", /\benglish\b/i], ["History", /\bhistory\b/i],
  ["Geography", /\bgeog(raphy)?\b/i], ["Computer Science", /\bcomputer\s+science\b|\bcs\b/i],
];
/** A subject named in the task's own words ("Chemistry homework Q4-7"), or null. */
export function subjectIn(text: string): string | null {
  for (const [name, re] of WORDS) if (re.test(text)) return name;
  return null;
}
/** The sticker colour variable for a subject (the design's --t-* set; others fall back to a quiet fill). */
export function subjectColour(subject: string | null): string {
  switch (subject) {
    case "Chemistry": return "var(--t-chem)";
    case "Further Maths": return "var(--t-fm)";
    case "Biology": return "var(--t-bio)";
    case "Maths": return "var(--t-maths)";
    case "English": return "var(--t-eng)";
    case "Physics": return "var(--dev)";
    default: return "var(--card2)";
  }
}

/* ── To do ───────────────────────────────────────────────────────────── */

export type TodoTab = "today" | "week" | "done";

/**
 * Tasks for a tab. Today holds what is due today or late, and what was ticked off today stays under it (struck
 * through) so a student sees their day's progress; This week holds the six days after; Done holds the last
 * thirty finished, newest first.
 */
export function tasksFor(data: AppData, tab: TodoTab, today: string): Task[] {
  const by = (a: Task, b: Task) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.createdAt - b.createdAt);
  if (tab === "done") return data.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 30);
  if (tab === "today") {
    const open = data.tasks.filter((t) => !t.done && daysBetween(today, t.due) <= 0).sort(by);
    const finished = data.tasks.filter((t) => t.done && t.doneAt !== null && dayOf(t.doneAt) === today && daysBetween(today, t.due) <= 0).sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0));
    return [...open, ...finished];
  }
  return data.tasks.filter((t) => !t.done && daysBetween(today, t.due) >= 1).sort(by);
}

/** Tasks still to do today: the ticked ones do not count. */
export const leftToday = (data: AppData, today: string) => tasksFor(data, "today", today).filter((t) => !t.done).length;

export function addTask(data: AppData, text: string, due: string, now: number, subject?: string | null): AppData {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 140);
  if (!clean) return data;
  const task: Task = { id: makeId("t", now), text: clean, subject: subject ?? subjectIn(clean), due, done: false, createdAt: now, doneAt: null };
  return { ...data, tasks: [...data.tasks, task] };
}

export function toggleTask(data: AppData, id: string, now: number): AppData {
  return { ...data, tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : now } : t)) };
}

export const removeTask = (data: AppData, id: string): AppData => ({ ...data, tasks: data.tasks.filter((t) => t.id !== id) });

/** The next six days, for the "this week" picker: [iso, label]. */
export function weekChoices(today: string, label: (iso: string) => string): [string, string][] {
  return [1, 2, 3, 4, 5, 6].map((n) => { const iso = addDays(today, n); return [iso, n === 1 ? "Tomorrow" : label(iso)]; });
}

/* ── The exam countdown ──────────────────────────────────────────────── */

export function setExam(data: AppData, exam: Exam | null): AppData {
  if (!exam) return { ...data, exam: null };
  const name = exam.name.replace(/\s+/g, " ").trim().slice(0, 40);
  return /^\d{4}-\d{2}-\d{2}$/.test(exam.date) && name ? { ...data, exam: { name, date: exam.date } } : data;
}
/** Days until the exam, or null when there is none or it has passed. */
export function examDays(data: AppData, today: string): number | null {
  if (!data.exam) return null;
  const d = daysBetween(today, data.exam.date);
  return d >= 0 ? d : null;
}

/* ── Decks and cards ─────────────────────────────────────────────────── */

const clip = (s: string, n: number) => s.replace(/\r/g, "").trim().slice(0, n);

export function addDeck(data: AppData, title: string, now: number, subject: string | null = null, starter: string | null = null): { data: AppData; deck: Deck | null } {
  const t = title.replace(/\s+/g, " ").trim().slice(0, 50);
  if (!t) return { data, deck: null };
  const deck: Deck = { id: makeId("d", now), title: t, subject, createdAt: now, starter };
  return { data: { ...data, decks: [...data.decks, deck] }, deck };
}

export function renameDeck(data: AppData, id: string, title: string): AppData {
  const t = title.replace(/\s+/g, " ").trim().slice(0, 50);
  return t ? { ...data, decks: data.decks.map((d) => (d.id === id ? { ...d, title: t } : d)) } : data;
}

export function deleteDeck(data: AppData, id: string): AppData {
  return { ...data, decks: data.decks.filter((d) => d.id !== id), cards: data.cards.filter((c) => c.deckId !== id) };
}

export function addCard(data: AppData, deckId: string, front: string, back: string, now: number): AppData {
  const f = clip(front, 400), b = clip(back, 800);
  if (!f || !b || !data.decks.some((d) => d.id === deckId)) return data;
  const card: Card = { id: makeId("c", now), deckId, front: f, back: b, createdAt: now, sch: newSchedule(now), lastReviewed: null };
  return { ...data, cards: [...data.cards, card] };
}

/** Edit the words of a card; its schedule is kept (fixing a typo does not reset what a student has learned). */
export function editCard(data: AppData, id: string, front: string, back: string): AppData {
  const f = clip(front, 400), b = clip(back, 800);
  return f && b ? { ...data, cards: data.cards.map((c) => (c.id === id ? { ...c, front: f, back: b } : c)) } : data;
}

export const deleteCard = (data: AppData, id: string): AppData => ({ ...data, cards: data.cards.filter((c) => c.id !== id) });

/** Add the starter decks the student chose. A deck already added is not added twice. */
export function addStarters(data: AppData, ids: readonly string[], now: number): AppData {
  let next = data;
  for (const id of ids) {
    const starter = STARTER_DECKS.find((s) => s.id === id);
    if (!starter || next.decks.some((d) => d.starter === id)) continue;
    const made = addDeck(next, `${starter.subject} · ${starter.title}`, now, starter.subject, id);
    if (!made.deck) continue;
    next = made.data;
    for (const [front, back] of starter.cards) next = addCard(next, made.deck.id, front, back, now);
  }
  return next;
}

/**
 * Cards pasted as text, one per line: front and back split by a tab, or a semicolon, or " | ". Lines without a
 * separator are skipped (and counted), so a half-pasted list never invents a card.
 */
export function parseCards(text: string): { cards: [string, string][]; skipped: number } {
  const cards: [string, string][] = [];
  let skipped = 0;
  for (const line of text.split(/\n/)) {
    if (!line.trim()) continue;
    const m = /^(.*?)(?:\t|;| \| )(.+)$/.exec(line);
    if (m && m[1].trim() && m[2].trim()) cards.push([m[1].trim(), m[2].trim()]); else skipped++;
  }
  return { cards, skipped };
}

export function importCards(data: AppData, deckId: string, text: string, now: number): { data: AppData; added: number; skipped: number } {
  const { cards, skipped } = parseCards(text);
  let next = data;
  for (const [f, b] of cards) next = addCard(next, deckId, f, b, now);
  return { data: next, added: next.cards.length - data.cards.length, skipped };
}

/* ── Reviewing ───────────────────────────────────────────────────────── */

const dayLog = (data: AppData, day: string): DayLog => data.log[day] ?? { n: 0, right: 0, fresh: 0 };

/** Grade a card at `now`: its new schedule, today's counts, and where the student last was. */
export function gradeCard(data: AppData, cardId: string, grade: Grade, now: number): AppData {
  const card = data.cards.find((c) => c.id === cardId);
  if (!card) return data;
  const day = dayOf(now);
  const log = dayLog(data, day);
  const wasNew = card.sch.state === "new";
  const deck = data.decks.find((d) => d.id === card.deckId);
  return {
    ...data,
    cards: data.cards.map((c) => (c.id === cardId ? { ...c, sch: schedule(c.sch, grade, now), lastReviewed: now } : c)),
    log: { ...data.log, [day]: { n: log.n + 1, right: log.right + (grade > 1 ? 1 : 0), fresh: log.fresh + (wasNew ? 1 : 0) } },
    last: { kind: "cards", label: deck?.title ?? "Flashcards", href: "/study/flashcards", at: now },
  };
}

/** What is due now, optionally for one deck. */
export function dueNow(data: AppData, now: number, deckId?: string) {
  return queue(data.cards.map((c) => ({ id: c.id, deckId: c.deckId, sch: c.sch, createdAt: c.createdAt })), now, dayLog(data, dayOf(now)).fresh, data.perDay, deckId);
}

/** Per-deck counts for the Decks page. */
export function deckStats(data: AppData, deckId: string, now: number) {
  const cards = data.cards.filter((c) => c.deckId === deckId);
  const q = dueNow(data, now, deckId);
  return {
    total: cards.length,
    due: q.due + q.fresh,
    fresh: cards.filter((c) => c.sch.state === "new").length,
    learning: cards.filter((c) => c.sch.state === "learning").length,
    mature: cards.filter((c) => c.sch.state === "review" && c.sch.interval >= 21).length,
  };
}

export function setLast(data: AppData, last: Last): AppData { return { ...data, last }; }

/** New cards a day: 0 to 100 (0 pauses new cards; reviews still come). */
export function setPerDay(data: AppData, n: number): AppData {
  return Number.isFinite(n) ? { ...data, perDay: Math.min(100, Math.max(0, Math.round(n))) } : data;
}

/** Consecutive days with at least one review, ending today, or yesterday if today has none yet (so the day is not lost before it is over). */
export function reviewStreak(data: AppData, today: string): number {
  let day = (data.log[today]?.n ?? 0) > 0 ? today : addDays(today, -1);
  let n = 0;
  while ((data.log[day]?.n ?? 0) > 0) { n++; day = addDays(day, -1); }
  return n;
}

/** A deck as text: one card a line, front and back split by a tab (what the import reads back). Tabs and line breaks inside a card become spaces. */
export function exportDeck(data: AppData, deckId: string): string {
  const flat = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();
  return data.cards.filter((c) => c.deckId === deckId).map((c) => `${flat(c.front)}\t${flat(c.back)}`).join("\n");
}

/** What "Continue" on the Desk offers: where the student last was, else the most useful next thing. */
export function continueTarget(data: AppData, now: number): { label: string; href: string } {
  const due = dueNow(data, now);
  if (data.last && now - data.last.at < 14 * 86_400_000 && !(data.last.kind === "cards" && due.ids.length === 0)) return { label: `Continue · ${data.last.label}`, href: data.last.href };
  if (due.ids.length > 0) return { label: `Start · ${due.ids.length} flashcard${due.ids.length === 1 ? "" : "s"}`, href: "/study/flashcards" };
  return { label: "Enter the Grand Library", href: "/study/library" };
}

/** A tidy copy of whatever was in storage; anything unreadable becomes empty rather than breaking the page. */
export function sanitise(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") return EMPTY;
  const r = raw as Partial<AppData>;
  if (r.v !== 1) return EMPTY;
  const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  const decks = arr<Deck>(r.decks).filter((d) => d && typeof d.id === "string" && typeof d.title === "string");
  const ids = new Set(decks.map((d) => d.id));
  return {
    v: 1,
    tasks: arr<Task>(r.tasks).filter((t) => t && typeof t.id === "string" && typeof t.text === "string" && typeof t.due === "string"),
    exam: r.exam && typeof r.exam.name === "string" && typeof r.exam.date === "string" ? r.exam : null,
    decks,
    cards: arr<Card>(r.cards).filter((c) => c && typeof c.id === "string" && ids.has(c.deckId) && c.sch && typeof c.sch.due === "number"),
    log: r.log && typeof r.log === "object" ? r.log : {},
    last: r.last && typeof r.last.label === "string" && typeof r.last.href === "string" ? r.last : null,
    perDay: typeof r.perDay === "number" && r.perDay >= 0 && r.perDay <= 200 ? r.perDay : NEW_PER_DAY,
  };
}
