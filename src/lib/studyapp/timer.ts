/**
 * The one study timer, as a value: Stopwatch, Timer (a countdown) and Pomodoro. A faithful port of the iPad's
 * `StudyTimerSession` / `StudyTimerSettings` / `StudyTimerState` (Sources/PlumiKit/Learner/StudyTimerSession.swift
 * and Features/Notebook/StudyTimer.swift). Pure: every function takes `now` (epoch milliseconds) and returns a
 * new value, so every rule is tested without waiting and nothing here touches the DOM, storage or a clock.
 *
 * WALL TIME, NOT TICKS. What is kept is the time banked before the current run plus the run measured from the
 * wall clock, so a hidden tab, a locked phone or a closed browser loses nothing.
 *
 * A PHASE ENDS AT ITS BOUNDARY, NOT WHEN SOMEBODY LOOKS. `settle` walks every boundary passed since the value was
 * last looked at and reports each as an event with the moment it happened. A Pomodoro whose work ended while the
 * tab was asleep records its work up to the boundary, never up to the moment the student came back.
 *
 * WHAT IS NEVER COUNTED WHILE NOBODY IS THERE
 *   - A break that ends waits (`break_over`): the next work phase starts only when the student says so.
 *   - Every session stops at `CEILING` of work, whatever the mode: a stopwatch left on overnight is four hours.
 *   - Break time is never work: only `worked` events are recorded, and only work phases produce them.
 *
 * Where this differs from the iPad (on purpose): there is no activity, spot, app blocking or doodle (the web has no
 * such things), a session has a `subject` from the library's five (`SEAT_SUBJECTS`) and a free `label`, and
 * `setSubject` records the work so far under the old subject when the student changes it mid-run.
 */

/* ── Modes, kinds, settings ───────────────────────────────────────────── */

export type TimerMode = "timer" | "pomodoro";
/** The three keys on the setup card. A stopwatch is `timer` counting up, as on the iPad. */
export type TimerKind = "stopwatch" | "timer" | "pomodoro";
export type TimerPhase = "work" | "break" | "break_over";

export const KINDS: readonly { id: TimerKind; title: string; line: string }[] = [
  { id: "stopwatch", title: "Stopwatch", line: "counts up" },
  { id: "timer", title: "Timer", line: "counts down" },
  { id: "pomodoro", title: "Pomodoro", line: "focus and breaks" },
];

export interface TimerSettings {
  mode: TimerMode;
  workMinutes: number;
  breakMinutes: number;
  /** Timer mode: a countdown of this many minutes, or null to count up. */
  countdownMinutes: number | null;
}

export const WORK_RANGE: readonly [number, number] = [5, 90];
export const BREAK_RANGE: readonly [number, number] = [1, 30];
export const COUNTDOWN_RANGE: readonly [number, number] = [1, 240];

const MIN = 60_000;
const HOUR = 3_600_000;
/** The most work one session can hold. A timer left running is not a night's study. */
export const CEILING = 4 * HOUR;
/** What "+5 min" adds to a break. */
export const BREAK_EXTENSION = 5 * MIN;
/** How much of a page must be done before Finish page counts it. */
export const PAGE_SHARE = 0.8;

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
const whole = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback);

/** Settings with every length held inside its range, whatever was asked for. */
export function makeSettings(mode: TimerMode, workMinutes: number, breakMinutes: number, countdownMinutes: number | null): TimerSettings {
  return {
    mode,
    workMinutes: clamp(workMinutes, WORK_RANGE),
    breakMinutes: clamp(breakMinutes, BREAK_RANGE),
    countdownMinutes: countdownMinutes === null ? null : clamp(countdownMinutes, COUNTDOWN_RANGE),
  };
}

export const STANDARD: TimerSettings = makeSettings("timer", 25, 5, null);

export function kindOf(s: TimerSettings): TimerKind {
  return s.mode === "pomodoro" ? "pomodoro" : s.countdownMinutes === null ? "stopwatch" : "timer";
}

/** These settings in another kind, keeping every length the student set. */
export function withKind(s: TimerSettings, kind: TimerKind): TimerSettings {
  switch (kind) {
    case "stopwatch": return { ...s, mode: "timer", countdownMinutes: null };
    case "timer": return { ...s, mode: "timer", countdownMinutes: s.countdownMinutes ?? s.workMinutes };
    case "pomodoro": return { ...s, mode: "pomodoro" };
  }
}

/**
 * One press of + or -: a minute at a time while short, five once it is long, so any length is a few presses
 * away and 25 is never twenty-five of them. Past ten it snaps back onto the grid of fives (12 steps to 15, not 17).
 */
export function step(from: number, up: boolean, range: readonly [number, number]): number {
  const size = up ? (from < 10 ? 1 : 5) : from <= 10 ? 1 : 5;
  let next = up ? from + size : from - size;
  if (size === 5 && next % 5 !== 0) next = up ? Math.floor(next / 5) * 5 : Math.floor((next + 4) / 5) * 5;
  return clamp(next, range);
}

export const adjustWork = (s: TimerSettings, up: boolean): TimerSettings => ({ ...s, workMinutes: step(s.workMinutes, up, WORK_RANGE) });
export const adjustBreak = (s: TimerSettings, up: boolean): TimerSettings => ({ ...s, breakMinutes: step(s.breakMinutes, up, BREAK_RANGE) });
export const adjustCountdown = (s: TimerSettings, up: boolean): TimerSettings => ({ ...s, countdownMinutes: step(s.countdownMinutes ?? 25, up, COUNTDOWN_RANGE) });

/* ── The clock of one phase (StudyTimerState) ─────────────────────────── */

export interface PhaseClock {
  duration: number;
  /** Time banked by previous runs, before the current one started. */
  banked: number;
  /** When the current run began, or null while paused or not yet started. */
  runningSince: number | null;
}

export const elapsedOf = (c: PhaseClock, now: number) => (c.runningSince === null ? c.banked : c.banked + Math.max(0, now - c.runningSince));
export const remainingOf = (c: PhaseClock, now: number) => Math.max(0, c.duration - elapsedOf(c, now));
export const finishedAt = (c: PhaseClock, now: number) => elapsedOf(c, now) >= c.duration;

/* ── The session ──────────────────────────────────────────────────────── */

export interface TimerSession {
  id: string;
  /** One of the library's subjects (`SEAT_SUBJECTS`), or null for "Other". */
  subject: string | null;
  mode: TimerMode;
  workLength: number;
  breakLength: number;
  /** Timer mode: the countdown, or null to count up. */
  countdown: number | null;
  phase: TimerPhase;
  /** Work phases completed. */
  round: number;
  /** The current phase's clock. */
  clock: PhaseClock;
  /** Work finished in earlier phases. */
  workBanked: number;
  startedAt: number;
  /** When the current run of work began; null unless work is running. */
  runStart: number | null;
  /** Set once the session has ended; a finished session only reports. */
  isOver: boolean;
  /** The thing being worked on, in the student's words. */
  label: string | null;
  /** A Timer's block is followed by its break, and the break by "Back to it?". */
  restsAfterBlock: boolean;
}

export type TimerEvent =
  /** A stretch of work to record as study, start to end. */
  | { type: "worked"; start: number; end: number }
  /** The phase changed at this moment. */
  | { type: "phase"; phase: TimerPhase; at: number }
  /** The session is over: a countdown reached zero, or the ceiling was reached. */
  | { type: "finished"; at: number };

/** A new value and what happened on the way to it. */
export interface Step { session: TimerSession; events: TimerEvent[] }

export interface StartOptions {
  subject?: string | null;
  label?: string | null;
  id: string;
  restsAfterBlock?: boolean;
}

export function startSession(settings: TimerSettings, now: number, o: StartOptions): TimerSession {
  const s: TimerSession = {
    id: o.id,
    subject: o.subject ?? null,
    mode: settings.mode,
    workLength: settings.workMinutes * MIN,
    breakLength: settings.breakMinutes * MIN,
    countdown: settings.countdownMinutes === null ? null : settings.countdownMinutes * MIN,
    phase: "work",
    round: 0,
    clock: { duration: 0, banked: 0, runningSince: null },
    workBanked: 0,
    startedAt: now,
    runStart: now,
    isOver: false,
    label: o.label ?? null,
    restsAfterBlock: o.restsAfterBlock === true,
  };
  s.clock = { duration: workPhaseLength(s), banked: 0, runningSince: now };
  return s;
}

export const kindOfSession = (s: TimerSession): TimerKind => (s.mode === "pomodoro" ? "pomodoro" : s.countdown === null ? "stopwatch" : "timer");
/** A count-up timer: no end but the ceiling. */
export const countsUp = (s: TimerSession) => s.mode === "timer" && s.countdown === null;
/** A Timer that rests after its block (a counting-up stopwatch never does). */
const timerRests = (s: TimerSession) => s.mode === "timer" && s.restsAfterBlock && s.countdown !== null && s.breakLength > 0;

/** How long a work phase starting now may last. */
function workPhaseLength(s: TimerSession): number {
  const room = Math.max(0, CEILING - s.workBanked);
  return s.mode === "timer" ? Math.min(s.countdown ?? room, room) : Math.min(s.workLength, room);
}

const copy = (s: TimerSession): TimerSession => ({ ...s, clock: { ...s.clock } });

/* ── Settling ─────────────────────────────────────────────────────────── */

/** This value brought up to `now`, without its events: what a view draws. */
export const settled = (s: TimerSession, now: number): TimerSession => settle(s, now).session;

/** Walks every boundary passed by `now`, oldest first. */
export function settle(session: TimerSession, now: number): Step {
  const s = copy(session);
  const events: TimerEvent[] = [];
  // Bounded, so a corrupt value can never spin: a session has at most a few dozen boundaries under the ceiling.
  for (let i = 0; i < 64; i++) {
    if (s.isOver || s.clock.runningSince === null || !finishedAt(s.clock, now)) break;
    const boundary = s.clock.runningSince + Math.max(0, s.clock.duration - s.clock.banked);
    if (s.phase === "work") {
      if (s.runStart !== null && boundary > s.runStart) events.push({ type: "worked", start: s.runStart, end: boundary });
      s.workBanked += s.clock.duration;
      s.round += 1;
      s.runStart = null;
      if ((s.mode === "timer" && !timerRests(s)) || s.workBanked >= CEILING - 500) {
        s.clock = { duration: s.clock.duration, banked: s.clock.duration, runningSince: null };
        s.isOver = true;
        events.push({ type: "finished", at: boundary });
      } else {
        s.phase = "break";
        s.clock = { duration: s.breakLength, banked: 0, runningSince: boundary };
        events.push({ type: "phase", phase: "break", at: boundary });
      }
    } else if (s.phase === "break") {
      s.phase = "break_over";
      s.clock = { duration: s.clock.duration, banked: s.clock.duration, runningSince: null };
      events.push({ type: "phase", phase: "break_over", at: boundary });
    } else break;
  }
  return { session: s, events };
}

/* ── What the student does ────────────────────────────────────────────── */

export function pause(session: TimerSession, now: number): Step {
  const { session: s, events } = settle(session, now);
  if (s.isOver || s.clock.runningSince === null) return { session: s, events };
  if (s.phase === "work" && s.runStart !== null && now > s.runStart) events.push({ type: "worked", start: s.runStart, end: now });
  s.runStart = null;
  s.clock = { ...s.clock, banked: s.clock.banked + Math.max(0, now - s.clock.runningSince), runningSince: null };
  return { session: s, events };
}

export function resume(session: TimerSession, now: number): Step {
  const { session: s, events } = settle(session, now);
  if (s.isOver || s.clock.runningSince !== null || s.phase === "break_over") return { session: s, events };
  if (!finishedAt(s.clock, now)) s.clock = { ...s.clock, runningSince: now };
  if (s.phase === "work") s.runStart = now;
  return { session: s, events };
}

/** Ends the session, recording the work in progress. */
export function stop(session: TimerSession, now: number): Step {
  const { session: s, events } = settle(session, now);
  if (s.isOver) return { session: s, events };
  if (s.phase === "work" && s.clock.runningSince !== null && s.runStart !== null && now > s.runStart) events.push({ type: "worked", start: s.runStart, end: now });
  s.runStart = null;
  if (s.clock.runningSince !== null) s.clock = { ...s.clock, banked: s.clock.banked + Math.max(0, now - s.clock.runningSince), runningSince: null };
  s.isOver = true;
  return { session: s, events };
}

/**
 * The student changes what they are on. The work so far is recorded under the old subject and the run carries
 * on under the new one, so the log never says Physics for time spent on Maths.
 */
export function setSubject(session: TimerSession, subject: string | null, now: number): Step {
  const { session: s, events } = settle(session, now);
  if (s.isOver || s.subject === subject) return { session: s, events };
  if (s.phase === "work" && s.runStart !== null && s.clock.runningSince !== null && now > s.runStart) {
    events.push({ type: "worked", start: s.runStart, end: now });
    s.runStart = now;
  }
  s.subject = subject;
  return { session: s, events };
}

export const pageCounts = (elapsed: number, length: number) => length > 0 && elapsed >= length * PAGE_SHARE;

/** Whether "Finish page" is on offer now: a Pomodoro work phase at least 80% done. */
export function canFinishPage(session: TimerSession, now: number): boolean {
  const s = settled(session, now);
  return !s.isOver && s.mode === "pomodoro" && s.phase === "work" && pageCounts(elapsedOf(s.clock, now), s.clock.duration);
}

/**
 * "Finish page": the page in progress is done now, counted as a page, and its break begins. Only the minutes
 * actually worked are banked and recorded, so finishing early never adds time that was not studied.
 */
export function finishPage(session: TimerSession, now: number): Step {
  const { session: s, events } = settle(session, now);
  if (s.isOver || s.mode !== "pomodoro" || s.phase !== "work" || !pageCounts(elapsedOf(s.clock, now), s.clock.duration)) return { session: s, events };
  if (s.clock.runningSince !== null && s.runStart !== null && now > s.runStart) events.push({ type: "worked", start: s.runStart, end: now });
  s.workBanked += Math.min(s.clock.duration, elapsedOf(s.clock, now));
  s.round += 1;
  s.runStart = null;
  if (s.workBanked >= CEILING - 500) {
    s.clock = { duration: s.clock.duration, banked: s.clock.duration, runningSince: null };
    s.isOver = true;
    events.push({ type: "finished", at: now });
  } else {
    s.phase = "break";
    s.clock = { duration: s.breakLength, banked: 0, runningSince: now };
    events.push({ type: "phase", phase: "break", at: now });
  }
  return { session: s, events };
}

/** "End break" or "Continue studying": the next work phase, from now. */
export function endBreak(session: TimerSession, now: number): Step {
  const { session: s, events } = settle(session, now);
  if (s.isOver || s.phase === "work") return { session: s, events };
  const length = workPhaseLength(s);
  if (length <= 0) {
    s.isOver = true;
    events.push({ type: "finished", at: now });
    return { session: s, events };
  }
  s.phase = "work";
  s.clock = { duration: length, banked: 0, runningSince: now };
  s.runStart = now;
  events.push({ type: "phase", phase: "work", at: now });
  return { session: s, events };
}

/** "+5 min": a longer break, on the wall clock. After the break has run out it opens a new five minutes from now. */
export function extendBreak(session: TimerSession, now: number, extra = BREAK_EXTENSION): Step {
  const { session: s, events } = settle(session, now);
  if (s.isOver) return { session: s, events };
  if (s.phase === "break") s.clock = { ...s.clock, duration: s.clock.duration + extra };
  else if (s.phase === "break_over") {
    s.phase = "break";
    s.clock = { duration: extra, banked: 0, runningSince: now };
    events.push({ type: "phase", phase: "break", at: now });
  }
  return { session: s, events };
}

/* ── Reading ──────────────────────────────────────────────────────────── */

/** Counting right now: work or a break, not paused, not waiting, not over. */
export function isRunning(session: TimerSession, now: number): boolean {
  const s = settled(session, now);
  return !s.isOver && s.phase !== "break_over" && s.clock.runningSince !== null;
}

export function isPaused(session: TimerSession, now: number): boolean {
  const s = settled(session, now);
  return !s.isOver && s.phase !== "break_over" && s.clock.runningSince === null;
}

/** Work done in this session so far, in ms. */
export function workMs(session: TimerSession, now: number): number {
  const s = settled(session, now);
  return s.workBanked + (s.phase === "work" && !s.isOver ? elapsedOf(s.clock, now) : 0);
}

export const phaseRemaining = (session: TimerSession, now: number) => remainingOf(settled(session, now).clock, now);
export function phaseElapsed(session: TimerSession, now: number): number {
  const s = settled(session, now);
  return Math.min(s.clock.duration, elapsedOf(s.clock, now));
}

/** When the current phase will end, if it is running: the next moment anything changes on its own. */
export function phaseEndsAt(session: TimerSession, now: number): number | null {
  const s = settled(session, now);
  if (s.isOver || s.phase === "break_over" || s.clock.runningSince === null) return null;
  return s.clock.runningSince + Math.max(0, s.clock.duration - s.clock.banked);
}

/**
 * What the Grand Library publishes: focusing since the moment the work phase's count began as if it had never
 * paused, while work is running; nothing while paused, on a break, waiting or over. Constant while the work runs,
 * so the library is told once, not every second.
 */
export function libraryFocus(session: TimerSession | null, now: number): { subject: string | null; since: number } | null {
  if (!session) return null;
  const s = settled(session, now);
  if (s.isOver || s.phase !== "work" || s.clock.runningSince === null) return null;
  return { subject: s.subject, since: s.clock.runningSince - s.clock.banked };
}

/** The work run in progress, not yet recorded: counted in "today" while it runs, so the figure ticks. */
export function openRun(session: TimerSession | null, now: number): { start: number; end: number } | null {
  if (!session) return null;
  const s = settled(session, now);
  if (s.isOver || s.phase !== "work" || s.runStart === null || s.clock.runningSince === null || now <= s.runStart) return null;
  return { start: s.runStart, end: now };
}

/* ── Saying a time ────────────────────────────────────────────────────── */

const two = (n: number) => String(n).padStart(2, "0");

/** "0:00:00" style: always hours. */
export function faceHms(seconds: number): string {
  const t = Math.max(0, Math.trunc(seconds));
  return `${Math.floor(t / 3600)}:${two(Math.floor((t % 3600) / 60))}:${two(t % 60)}`;
}
/** "4:05" under an hour, "1:04:05" over. */
export function faceLong(seconds: number): string {
  const t = Math.max(0, Math.trunc(seconds));
  return t >= 3600 ? faceHms(seconds) : `${Math.floor(t / 60)}:${two(t % 60)}`;
}
/** At most five characters, for the chip: "24:59", then "1h05". */
export function faceCompact(seconds: number): string {
  const t = Math.max(0, Math.trunc(seconds));
  return t < 3600 ? `${Math.floor(t / 60)}:${two(t % 60)}` : `${Math.floor(t / 3600)}h${two(Math.floor((t % 3600) / 60))}`;
}

function seconds(session: TimerSession, now: number): number {
  const s = settled(session, now);
  return countsUp(s) && s.phase === "work" ? elapsedOf(s.clock, now) / 1000 : Math.ceil(remainingOf(s.clock, now) / 1000);
}
/** The big face: a count-up shows time done, everything else time left (rounded up, so it reads 25:00 at the start). */
export const face = (session: TimerSession, now: number) => faceLong(seconds(session, now));
/** The same, small enough for the chip. */
export const compactFace = (session: TimerSession, now: number) => faceCompact(seconds(session, now));

/** "25m", "1h 25m", "2h", "0m": whole minutes studied, for the totals lines. */
export function formatStudied(ms: number): string {
  const m = Math.max(0, Math.floor(ms / MIN));
  const h = Math.floor(m / 60);
  return h === 0 ? `${m}m` : m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
}

/* ── The break screen ─────────────────────────────────────────────────── */

export type BreakStage = { stage: "none" } | { stage: "onBreak"; remaining: number } | { stage: "over" };

/** What the break screen shows, decided here so the view only lays it out. */
export function breakStage(session: TimerSession | null, now: number): BreakStage {
  if (!session) return { stage: "none" };
  const s = settled(session, now);
  if (s.isOver) return { stage: "none" };
  if (s.phase === "break") return { stage: "onBreak", remaining: remainingOf(s.clock, now) };
  return s.phase === "break_over" ? { stage: "over" } : { stage: "none" };
}

export const BREAK_SUGGESTIONS = [
  "Stretch your arms and shoulders",
  "Drink some water",
  "Look out of a window",
  "Walk around for a minute",
  "Rest your eyes",
] as const;
export const SUGGESTION_SECONDS = 20;

/** One at a time, a new one every `SUGGESTION_SECONDS`. */
export function breakSuggestion(elapsedSeconds: number): string {
  return BREAK_SUGGESTIONS[Math.max(0, Math.trunc(elapsedSeconds / SUGGESTION_SECONDS)) % BREAK_SUGGESTIONS.length];
}

/* ── Reading a stored value ───────────────────────────────────────────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function sanitiseSettings(v: unknown): TimerSettings {
  if (!isObj(v)) return STANDARD;
  return makeSettings(
    v.mode === "pomodoro" ? "pomodoro" : "timer",
    whole(v.workMinutes, STANDARD.workMinutes),
    whole(v.breakMinutes, STANDARD.breakMinutes),
    v.countdownMinutes === null || v.countdownMinutes === undefined ? null : whole(v.countdownMinutes, 25),
  );
}

/** A session read back from storage, or null when it is not one (a stale or hand-edited value is dropped, never trusted). */
export function sanitiseSession(v: unknown, subjects: readonly (string | null)[]): TimerSession | null {
  if (!isObj(v) || !isObj(v.clock)) return null;
  const phase = v.phase;
  if (phase !== "work" && phase !== "break" && phase !== "break_over") return null;
  const duration = num(v.clock.duration), banked = num(v.clock.banked);
  const runningSince = v.clock.runningSince === null ? null : num(v.clock.runningSince);
  const workLength = num(v.workLength), breakLength = num(v.breakLength), workBanked = num(v.workBanked), startedAt = num(v.startedAt), round = num(v.round);
  if (typeof v.id !== "string" || !v.id || v.id.length > 80) return null;
  if (duration === null || banked === null || duration < 0 || banked < 0 || duration > 24 * HOUR) return null;
  if (v.clock.runningSince !== null && runningSince === null) return null;
  if (workLength === null || breakLength === null || workBanked === null || startedAt === null || round === null) return null;
  const runStart = v.runStart === null || v.runStart === undefined ? null : num(v.runStart);
  if (v.runStart !== null && v.runStart !== undefined && runStart === null) return null;
  const countdown = v.countdown === null || v.countdown === undefined ? null : num(v.countdown);
  if (v.countdown !== null && v.countdown !== undefined && countdown === null) return null;
  const subject = typeof v.subject === "string" && subjects.includes(v.subject) ? v.subject : null;
  return {
    id: v.id, subject, mode: v.mode === "pomodoro" ? "pomodoro" : "timer",
    workLength: Math.max(MIN, workLength), breakLength: Math.max(0, breakLength), countdown: countdown === null ? null : Math.max(MIN, countdown),
    phase, round: Math.max(0, Math.trunc(round)), clock: { duration, banked, runningSince },
    workBanked: Math.max(0, Math.min(CEILING, workBanked)), startedAt, runStart,
    isOver: v.isOver === true, label: typeof v.label === "string" ? v.label.slice(0, 60) : null, restsAfterBlock: v.restsAfterBlock === true,
  };
}
