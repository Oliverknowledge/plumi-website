/**
 * Spaced repetition for the flashcards: when a card comes back, from how it was graded.
 *
 * Pure functions with no clock of their own (`now` is always passed), so every rule is tested.
 * It is the familiar SM-2 family with learning steps, written out plainly rather than borrowed:
 *
 *   A new card is LEARNED in short steps (1 minute, then 10 minutes). Good moves it up a step; on the
 *   last step it graduates to a 1 day interval. Easy graduates it at once, to 4 days. Again goes back to
 *   the first step. Hard repeats the step (a little longer on the first).
 *
 *   A graduated (REVIEW) card has an interval in days and an ease (how fast the interval grows, 2.5 to
 *   start, never under 1.3):
 *     Hard   interval x 1.2 (at least a day more), ease down 0.15
 *     Good   interval x ease (at least a day more)
 *     Easy   interval x ease x 1.3 (at least two days more), ease up 0.15
 *     Again  a lapse: ease down 0.2, the card is relearned (10 minutes), and when it graduates again its
 *            interval restarts at half what it was (at least a day)
 *
 * No random fuzz: the same grades always give the same schedule, which is what makes it testable and
 * what lets a student see "Good: 3 days" on the button and have it be true.
 */

export type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export const GRADES: readonly { grade: Grade; label: "Again" | "Hard" | "Good" | "Easy" }[] = [
  { grade: 1, label: "Again" }, { grade: 2, label: "Hard" }, { grade: 3, label: "Good" }, { grade: 4, label: "Easy" },
];

export type CardState = "new" | "learning" | "review";

export interface Schedule {
  state: CardState;
  /** When it is next due (ms since the epoch). A new card is due now. */
  due: number;
  /** Days, for a review card; 0 while learning. */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  /** Which learning step it is on (0 or 1). */
  step: number;
  /** For a lapsed card: the interval it will restart from once it is relearned (days). */
  relearnTo: number | null;
}

const MIN = 60_000;
const DAY = 86_400_000;
export const LEARNING_STEPS = [1 * MIN, 10 * MIN] as const;
export const GRADUATING_DAYS = 1;
export const EASY_DAYS = 4;
export const START_EASE = 2.5;
export const MIN_EASE = 1.3;

export const newSchedule = (now: number): Schedule => ({
  state: "new", due: now, interval: 0, ease: START_EASE, reps: 0, lapses: 0, step: 0, relearnTo: null,
});

const round1 = (n: number) => Math.round(n * 100) / 100;

/** The card's schedule after being graded at `now`. Never mutates. */
export function schedule(s: Schedule, grade: Grade, now: number): Schedule {
  if (s.state === "review") {
    if (grade === 1) {
      return {
        ...s, state: "learning", step: 1, due: now + LEARNING_STEPS[1], interval: 0, lapses: s.lapses + 1,
        ease: round1(Math.max(MIN_EASE, s.ease - 0.2)), relearnTo: Math.max(1, Math.floor(s.interval / 2)),
      };
    }
    let interval: number, ease = s.ease;
    if (grade === 2) { interval = Math.max(s.interval + 1, Math.round(s.interval * 1.2)); ease = Math.max(MIN_EASE, ease - 0.15); }
    else if (grade === 3) { interval = Math.max(s.interval + 1, Math.round(s.interval * ease)); }
    else { interval = Math.max(s.interval + 2, Math.round(s.interval * ease * 1.3)); ease += 0.15; }
    return { ...s, interval, ease: round1(ease), reps: s.reps + 1, due: now + interval * DAY, relearnTo: null };
  }

  // new or learning
  const graduate = (days: number): Schedule => ({
    ...s, state: "review", interval: days, due: now + days * DAY, reps: s.reps + 1, step: 0, relearnTo: null,
  });
  const relearning = s.relearnTo !== null;
  if (grade === 4) return graduate(relearning ? s.relearnTo! : EASY_DAYS);
  if (grade === 1) return { ...s, state: "learning", step: 0, due: now + LEARNING_STEPS[0] };
  if (grade === 2) {
    // Repeat the step; the first step waits a little longer than a minute.
    const wait = s.step === 0 ? 6 * MIN : LEARNING_STEPS[s.step];
    return { ...s, state: "learning", due: now + wait };
  }
  // Good
  if (s.step + 1 < LEARNING_STEPS.length) return { ...s, state: "learning", step: s.step + 1, due: now + LEARNING_STEPS[s.step + 1] };
  return graduate(relearning ? s.relearnTo! : GRADUATING_DAYS);
}

/** How long until the card is due after `grade`, for the button ("<1m", "10m", "3d"). */
export function previewLabel(s: Schedule, grade: Grade, now: number): string {
  const ms = schedule(s, grade, now).due - now;
  if (ms < MIN) return "<1m";
  if (ms < 60 * MIN) return `${Math.round(ms / MIN)}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round((days / 30.4) * 10) / 10}mo`.replace(".0mo", "mo");
  return `${Math.round((days / 365) * 10) / 10}y`.replace(".0y", "y");
}

/* ── The queue ───────────────────────────────────────────────────────── */

export interface Queueable { id: string; deckId: string; sch: Schedule; createdAt: number }

/** New cards introduced a day. A student can change it; this is the default. */
export const NEW_PER_DAY = 10;

export interface Queue {
  /** In the order to show: due learning and review cards (oldest due first), then new cards up to the day's cap. */
  ids: string[];
  due: number;
  fresh: number;
  /** When the next not-yet-due learning card comes due, if nothing is due now. */
  nextAt: number | null;
}

/**
 * What to show now. `newDoneToday` is how many new cards have already been started today (they count
 * against the cap even though they are no longer new). `deckId` limits it to one deck.
 */
export function queue(cards: readonly Queueable[], now: number, newDoneToday: number, perDay = NEW_PER_DAY, deckId?: string): Queue {
  const pool = deckId ? cards.filter((c) => c.deckId === deckId) : cards;
  const due = pool.filter((c) => c.sch.state !== "new" && c.sch.due <= now).sort((a, b) => a.sch.due - b.sch.due || a.createdAt - b.createdAt);
  const room = Math.max(0, perDay - newDoneToday);
  const fresh = pool.filter((c) => c.sch.state === "new").sort((a, b) => a.createdAt - b.createdAt).slice(0, room);
  const waiting = pool.filter((c) => c.sch.state !== "new" && c.sch.due > now).map((c) => c.sch.due);
  return {
    ids: [...due, ...fresh].map((c) => c.id),
    due: due.length, fresh: fresh.length,
    nextAt: due.length + fresh.length === 0 && waiting.length ? Math.min(...waiting) : null,
  };
}
