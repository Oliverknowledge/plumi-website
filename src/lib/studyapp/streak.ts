import { addDays, dayOf, daysBetween } from "./time";
import { hasInk, hasText, isMarked, type QAnswer, type QuestionsData } from "./questions/model";

/**
 * The student's day streak on the web, defined as the iPad defines it (PlumiKit `StreakEngine`, `streak_day`): a day counts when REAL WORK happened on it, never because the
 * app was opened, and focus time alone never earns a day (founder decision of 27 September: "timer time never does"). On the web the real work is a question the
 * student marked themselves, or one they wrote an answer to (typed words, or a few strokes). The iPad's other kinds (a paper, an improved answer, the goal met by tracked
 * time) are not seen here. A day is a London day, the app's own (`time.ts`). The streak is the run of such days ending today, or ending yesterday while today has not
 * been earned yet (the day is not over). The iPad's automatic freezes are not applied.
 *
 * Where the server carries the student's own streak (`social_summary.streak`, which the iPad publishes) `streakNow` takes the larger of the two, so the web never shows
 * less than the iPad has told the server; until the iPad has published, or for a student with no iPad, the web's own days stand.
 * Pure: nothing here reads a clock.
 */

/** An answer worth a day: marked, or written in earnest (a few words, a few strokes). */
export const earnsDay = (a: QAnswer | undefined): boolean => isMarked(a) || (hasText(a) && (a!.text!.trim().length >= 8)) || (hasInk(a) && (a!.ink!.n >= 3));

/** The London days on which the questions store shows real work (the day an answer was last changed, and the days of the marks it recorded as "done lately"). */
export function questionDays(q: Pick<QuestionsData, "answers" | "recent">): string[] {
  const days = new Set<string>();
  for (const a of Object.values(q.answers)) if (earnsDay(a) && a.at > 0) days.add(dayOf(a.at));
  for (const r of q.recent) if (r.at > 0) days.add(dayOf(r.at));
  return [...days].sort();
}

/**
 * The days a change to the data touches: for every answer that is not the same object as before, the day it showed real work BEFORE (an edit moves an answer's own time to
 * the day of the edit, so the day it was first earned is lost unless it is taken now) and the day it shows now; and the days of the marks noted as done lately when those were
 * written. Only what changed is looked at, so a keystroke costs a few comparisons, not a pass over every answer.
 */
export function dayChanges(base: Pick<QuestionsData, "answers" | "recent">, next: Pick<QuestionsData, "answers" | "recent">): string[] {
  const days = new Set<string>();
  const note = (a: QAnswer | undefined) => { if (earnsDay(a) && a!.at > 0) days.add(dayOf(a!.at)); };
  if (next.answers !== base.answers) {
    for (const k of Object.keys(next.answers)) {
      const was = base.answers[k];
      if (next.answers[k] === was) continue;
      note(was); note(next.answers[k]);
    }
  }
  if (next.recent !== base.recent) for (const r of next.recent) if (r.at > 0) days.add(dayOf(r.at));
  return [...days].sort();
}

export const MAX_DAYS = 400;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The days kept (sorted, no repeats, none in the future, the newest 400): what was kept before, and what is found now. */
export function mergeDays(kept: readonly unknown[], found: readonly string[], today: string): string[] {
  const out = new Set<string>();
  for (const d of [...kept, ...found]) if (typeof d === "string" && ISO.test(d) && d <= today) out.add(d);
  return [...out].sort().slice(-MAX_DAYS);
}

/** The run of days ending today, or yesterday while today has not been earned (a streak that is still alive); 0 once a whole day has been missed. */
export function streakOf(days: readonly string[] | ReadonlySet<string>, today: string): number {
  const set = days instanceof Set ? days : new Set(days);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** What the server says of the student's own streak (`streak`, counted on `streakDay`): alive while that day is today or yesterday. */
export function serverStreak(row: { streak: number; streakDay: string | null } | null, today: string): number {
  if (!row || !row.streakDay || row.streak <= 0) return 0;
  const gap = daysBetween(row.streakDay, today);
  return gap === 0 || gap === 1 ? row.streak : 0;
}

/**
 * The number shown. The server's figure, carried forward by one when the web has earned today and the server counted up to yesterday only; the larger of that and the web's own run.
 */
export function streakNow(days: readonly string[], server: { streak: number; streakDay: string | null } | null, today: string): number {
  const own = streakOf(days, today);
  const s = serverStreak(server, today);
  const earnedToday = days.includes(today);
  const carried = s > 0 && server?.streakDay !== today && earnedToday ? s + 1 : s;
  return Math.max(own, carried);
}

/** Questions the student wrote or marked today: parts answered (or marked) on this London day. */
export function questionsToday(q: Pick<QuestionsData, "answers" | "recent">, today: string): number {
  let n = 0;
  for (const a of Object.values(q.answers)) if (earnsDay(a) && a.at > 0 && dayOf(a.at) === today) n++;
  return n;
}

/** "Today: 24 min, 8 questions", or null while there is nothing true to say. A focus minute is a whole minute; under one it is not mentioned. */
export function todayLine(workedMs: number, questions: number): string | null {
  const min = Math.floor(workedMs / 60_000);
  const parts: string[] = [];
  if (min >= 1) parts.push(min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`);
  if (questions >= 1) parts.push(`${questions} ${questions === 1 ? "question" : "questions"}`);
  return parts.length ? `Today: ${parts.join(", ")}` : null;
}
