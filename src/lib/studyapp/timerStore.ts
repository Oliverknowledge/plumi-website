"use client";

import { useSyncExternalStore } from "react";
import { SEAT_SUBJECTS } from "../social/lobby";
import {
  CEILING, endBreak, extendBreak, finishPage, openRun, pause, resume, sanitiseSession, sanitiseSettings, setSubject, settle, startSession, stop,
  type Step, type TimerEvent, type TimerSession, type TimerSettings, STANDARD,
} from "./timer";
import { addDays, dayOf, startOfDay, weekStartOf } from "./time";

/**
 * The study timer's store: ONE session at a time, kept on this device (localStorage, like the Desk and the
 * flashcards), the settings the student last chose, and a LOG of the work they did (every `worked` stretch the
 * timer produces), the last 90 days of it. Everything about the clock itself is `timer.ts`; this file only keeps it,
 * shares it between tabs and ticks it.
 *
 * ONE RULE FOR TWO TABS. A stretch of work is recorded under the key (session id, start). Every action reads the
 * stored document afresh, applies itself, and writes it back, so a tab that has been asleep acts on what the other
 * tab did, never on a stale copy; and a stretch whose key is already in the log is never added again (the first
 * one written stands). So two tabs that both notice the same boundary, both load the same stored session, or both
 * press Stop, record the work once. Only the tab that wrote a phase change announces it (chime, toast): the other
 * learns from the `storage` event and changes quietly.
 *
 * A session left running while the tab was closed settles when the store starts: work is recorded up to the
 * boundary (or the ceiling), never up to "now" if it passed one.
 *
 * Storage can be missing or full (a private window): the timer then works for the visit and says nothing.
 */
export const KEY = "plumi-study-timer";
export const LOG_DAYS = 90;
const MAX_LOG = 3000;
const SUBJECT_IDS = SEAT_SUBJECTS.map((s) => s.id);

/** One recorded stretch of work. */
export interface Interval { id: string; s: number; e: number; sub: string | null }

export interface TimerDoc {
  v: 1;
  settings: TimerSettings;
  /** What the student last said they are on (a library subject id, or null for Other); absent until they choose. */
  subject?: string | null;
  session: TimerSession | null;
  log: Interval[];
  /** A soft chime at a phase change. */
  chime: boolean;
  /** A system notification at a phase change while the tab is hidden: only after the student asked for it. */
  notify: boolean;
}
export interface TimerState { ready: boolean; persisted: boolean; doc: TimerDoc }

export const EMPTY_DOC: TimerDoc = { v: 1, settings: STANDARD, session: null, log: [], chime: true, notify: false };
const SERVER: TimerState = { ready: false, persisted: false, doc: EMPTY_DOC };

/** What the clock did on its own (not what the student pressed), for the toast, the chime and the title. */
export type Notice = { kind: "break" | "break_over" | "finished"; at: number; session: TimerSession };

/* ── Pure: the log ────────────────────────────────────────────────────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const keyOf = (i: Pick<Interval, "id" | "s">) => `${i.id}:${i.s}`;

/** Adds the work in `events` to the log. The same (session, start) is never added twice: the first one written stands. */
export function record(log: Interval[], subject: string | null, sessionId: string, events: TimerEvent[]): Interval[] {
  let out = log;
  let seen: Set<string> | null = null;
  for (const e of events) {
    if (e.type !== "worked" || e.end - e.start < 1000) continue;
    seen ??= new Set(log.map(keyOf));
    const item: Interval = { id: sessionId, s: e.start, e: e.end, sub: subject };
    if (seen.has(keyOf(item))) continue;
    seen.add(keyOf(item));
    out = [...out, item];
  }
  return out.length > MAX_LOG ? out.slice(out.length - MAX_LOG) : out;
}

/** Drops what is older than 90 London days. */
export function prune(log: Interval[], now: number): Interval[] {
  const cutoff = startOfDay(addDays(dayOf(now), -LOG_DAYS));
  return log.some((i) => i.e <= cutoff) ? log.filter((i) => i.e > cutoff) : log;
}

const within = (log: Interval[], from: number, to: number) => log.reduce((t, i) => t + Math.max(0, Math.min(i.e, to) - Math.max(i.s, from)), 0);

/** The log with the work the session has already done by `now` (a page that ended a moment ago, a run in progress). */
function viewed(doc: Pick<TimerDoc, "log" | "session">, now: number): Interval[] {
  const s = doc.session;
  if (!s || s.isOver) return doc.log;
  const r = settle(s, now);
  const log = record(doc.log, s.subject, s.id, r.events);
  const live = openRun(r.session, now);
  return live ? [...log, { id: `${s.id}:open`, s: live.start, e: live.end, sub: s.subject }] : log;
}

/**
 * Work done in the London day holding `now`, in ms: the log, and the run in progress while work runs (so the
 * figure ticks). Work that ended a moment ago is counted before anything has recorded it, so the figure never dips.
 */
export function workedToday(doc: Pick<TimerDoc, "log" | "session">, now: number): number {
  const day = dayOf(now);
  return within(viewed(doc, now), startOfDay(day), startOfDay(addDays(day, 1)));
}

/** The same for the UK week (Monday to Sunday) holding `now`. */
export function workedThisWeek(doc: Pick<TimerDoc, "log" | "session">, now: number): number {
  const first = weekStartOf(dayOf(now));
  return within(viewed(doc, now), startOfDay(first), startOfDay(addDays(first, 7)));
}

/** A stored document, or the empty one. Anything that is not one is dropped, never trusted. */
export function sanitiseDoc(raw: unknown, now: number): TimerDoc {
  if (!isObj(raw)) return EMPTY_DOC;
  const seen = new Set<string>();
  const log: Interval[] = [];
  if (Array.isArray(raw.log)) {
    for (const r of raw.log) {
      if (!isObj(r) || typeof r.id !== "string" || typeof r.s !== "number" || typeof r.e !== "number") continue;
      if (!Number.isFinite(r.s) || !Number.isFinite(r.e) || r.e - r.s < 1000 || r.e - r.s > CEILING + 1000 || r.e > now + 5 * 60_000) continue;
      const sub = typeof r.sub === "string" && SUBJECT_IDS.includes(r.sub) ? r.sub : null;
      const item: Interval = { id: r.id.slice(0, 80), s: r.s, e: r.e, sub };
      if (seen.has(keyOf(item))) continue;
      seen.add(keyOf(item));
      log.push(item);
    }
  }
  const doc: TimerDoc = {
    v: 1,
    settings: sanitiseSettings(raw.settings),
    session: sanitiseSession(raw.session, SUBJECT_IDS),
    log: prune(log.slice(-MAX_LOG), now),
    chime: raw.chime !== false,
    notify: raw.notify === true,
  };
  if (raw.subject === null || (typeof raw.subject === "string" && SUBJECT_IDS.includes(raw.subject))) doc.subject = raw.subject;
  return doc;
}

/** The document brought up to `now`: boundaries passed are settled and their work recorded. */
export function reconcile(doc: TimerDoc, now: number): { doc: TimerDoc; events: TimerEvent[] } {
  const s = doc.session;
  if (!s || s.isOver) return { doc, events: [] };
  const r = settle(s, now);
  if (r.events.length === 0) return { doc, events: [] };
  return { doc: { ...doc, session: r.session, log: prune(record(doc.log, s.subject, s.id, r.events), now) }, events: r.events };
}

/** The clock's own doing, in the student's terms: the last thing that happened wins. */
export function noticeOf(events: TimerEvent[], session: TimerSession): Notice | null {
  const finished = events.find((e) => e.type === "finished");
  if (finished) return { kind: "finished", at: finished.at, session };
  const over = events.find((e) => e.type === "phase" && e.phase === "break_over");
  if (over && over.type === "phase") return { kind: "break_over", at: over.at, session };
  const rest = events.find((e) => e.type === "phase" && e.phase === "break");
  return rest && rest.type === "phase" ? { kind: "break", at: rest.at, session } : null;
}

/* ── The store ────────────────────────────────────────────────────────── */

export interface StoreDeps {
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  now: () => number;
  id?: () => string;
  /** Calls `fn` every `ms` until the returned function is called. */
  every?: (fn: () => void, ms: number) => () => void;
  /** Tells the store when another tab wrote, or this one woke up. Returns what stops listening. */
  listen?: (onStorage: () => void, onWake: () => void) => () => void;
}

export function createTimerStore(deps: StoreDeps) {
  let state: TimerState = SERVER;
  let started = false;
  let stopListening: (() => void) | null = null;
  let stopTicker: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const notices = new Set<(n: Notice) => void>();

  const read = (): TimerDoc | null => {
    try {
      const raw = deps.storage?.getItem(KEY);
      return raw ? sanitiseDoc(JSON.parse(raw), deps.now()) : deps.storage ? EMPTY_DOC : null;
    } catch { return null; }
  };
  /** What is stored now, or what this tab last held when storage will not answer. */
  const fresh = (): TimerDoc => read() ?? (state.ready ? state.doc : EMPTY_DOC);

  const wantsTicks = () => {
    const s = state.doc.session;
    return !!s && !s.isOver && s.clock.runningSince !== null && s.phase !== "break_over";
  };
  function syncTicker() {
    const want = listeners.size > 0 && wantsTicks();
    if (want && !stopTicker && deps.every) stopTicker = deps.every(tick, 1000);
    if (!want && stopTicker) { stopTicker(); stopTicker = null; }
  }
  function emit() { listeners.forEach((l) => l()); syncTicker(); }

  function commit(doc: TimerDoc) {
    let persisted = state.persisted;
    try { if (deps.storage) { deps.storage.setItem(KEY, JSON.stringify(doc)); persisted = true; } } catch { persisted = false; }
    state = { ready: true, persisted, doc };
    emit();
  }

  /** Reads what is stored, settles what passed while nobody was looking, and writes it back only if that changed anything. */
  function load() {
    const stored = read();
    const now = deps.now();
    const r = reconcile(stored ?? (state.ready ? state.doc : EMPTY_DOC), now);
    if (r.events.length) commit(r.doc);
    else { state = { ready: true, persisted: stored !== null, doc: r.doc }; emit(); }
  }

  function begin() {
    if (started) return;
    started = true;
    load();
    stopListening = deps.listen?.(() => load(), () => tick()) ?? null;
  }

  /** The clock moved: settle any boundary passed, record its work, tell the listeners what happened. */
  function tick() {
    const now = deps.now();
    const held = state.doc.session;
    // The common case is nothing: no storage read, no write.
    if (!held || held.isOver || settle(held, now).events.length === 0) return;
    const r = reconcile(fresh(), now);       // what the other tab may already have settled is settled, and not announced again
    if (r.events.length === 0) { load(); return; }
    commit(r.doc);
    const n = r.doc.session ? noticeOf(r.events, r.doc.session) : null;
    if (n) notices.forEach((cb) => cb(n));
  }

  /** An action by the student: applied to the stored document, not to a possibly stale copy. */
  function act(fn: (doc: TimerDoc, now: number) => TimerDoc | null) {
    begin();
    const now = deps.now();
    const caught = reconcile(fresh(), now);
    const next = fn(caught.doc, now);
    if (next) commit({ ...next, log: prune(next.log, now) });
    else if (caught.events.length) commit(caught.doc);       // a boundary passed before the press: it still counts
  }
  /** A session change that may record work. */
  const apply = (doc: TimerDoc, run: (s: TimerSession, now: number) => Step, now: number): TimerDoc | null => {
    const s = doc.session;
    if (!s || s.isOver) return null;
    const r = run(s, now);
    return { ...doc, session: r.session, log: record(doc.log, s.subject, s.id, r.events) };
  };

  return {
    subscribe(cb: () => void) {
      begin();
      listeners.add(cb);
      syncTicker();
      return () => { listeners.delete(cb); syncTicker(); };
    },
    snapshot: (): TimerState => { begin(); return state; },
    /** The clock's own phase changes (a break began, a break ran out, the session finished), in this tab only. */
    onNotice(cb: (n: Notice) => void) { notices.add(cb); return () => { notices.delete(cb); }; },
    tick,
    /** Another tab wrote, or the tab woke up: read what is stored. */
    refresh: load,

    start(o: { subject?: string | null; label?: string | null } = {}) {
      act((d, now) => {
        if (d.session && !d.session.isOver) return null;                          // one session at a time
        const subject = o.subject !== undefined ? o.subject : d.subject ?? null;
        const id = deps.id?.() ?? `t_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        // Only a subject the student chose is remembered: starting with none chosen does not make "Other" their choice.
        const kept = o.subject !== undefined ? { subject: o.subject } : {};
        return { ...d, ...kept, session: startSession(d.settings, now, { id, subject, label: o.label ?? null, restsAfterBlock: true }) };
      });
    },
    pause: () => act((d, now) => apply(d, pause, now)),
    resume: () => act((d, now) => apply(d, resume, now)),
    stop: () => act((d, now) => apply(d, stop, now)),
    finishPage: () => act((d, now) => apply(d, finishPage, now)),
    endBreak: () => act((d, now) => apply(d, endBreak, now)),
    extendBreak: () => act((d, now) => apply(d, (s, t) => extendBreak(s, t), now)),
    /** What the student is on. Remembered, and applied to the session if there is one. */
    setSubject: (subject: string | null) => act((d, now) => {
      const next = { ...d, subject };
      return apply(next, (s, t) => setSubject(s, subject, t), now) ?? next;
    }),
    setSettings: (settings: TimerSettings) => act((d) => ({ ...d, settings: sanitiseSettings(settings) })),
    setChime: (chime: boolean) => act((d) => ({ ...d, chime })),
    setNotify: (notify: boolean) => act((d) => ({ ...d, notify })),
    /** Puts a finished session away. */
    dismiss: () => act((d) => (d.session?.isOver ? { ...d, session: null } : null)),

    workedToday: (now: number) => workedToday(state.doc, now),
    workedThisWeek: (now: number) => workedThisWeek(state.doc, now),
    /** For tests and teardown. */
    destroy() { stopListening?.(); stopListening = null; stopTicker?.(); stopTicker = null; listeners.clear(); notices.clear(); started = false; },
  };
}

export type TimerStore = ReturnType<typeof createTimerStore>;

/* ── The browser's store ──────────────────────────────────────────────── */

let instance: TimerStore | null = null;
function browserStore(): TimerStore {
  return (instance ??= createTimerStore({
    storage: (() => { try { return window.localStorage; } catch { return null; } })(),
    now: () => Date.now(),
    every: (fn, ms) => { const t = setInterval(fn, ms); return () => clearInterval(t); },
    listen: (onStorage, onWake) => {
      const storage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) onStorage(); };
      const wake = () => { if (document.visibilityState !== "hidden") onWake(); };
      window.addEventListener("storage", storage);
      document.addEventListener("visibilitychange", wake);
      window.addEventListener("pageshow", wake);
      window.addEventListener("focus", wake);
      return () => {
        window.removeEventListener("storage", storage);
        document.removeEventListener("visibilitychange", wake);
        window.removeEventListener("pageshow", wake);
        window.removeEventListener("focus", wake);
      };
    },
  }));
}

/** The actions, usable from anywhere in the browser (an event handler, the library's seat card). */
export const timer = {
  start: (o?: { subject?: string | null; label?: string | null }) => browserStore().start(o),
  pause: () => browserStore().pause(),
  resume: () => browserStore().resume(),
  stop: () => browserStore().stop(),
  finishPage: () => browserStore().finishPage(),
  endBreak: () => browserStore().endBreak(),
  extendBreak: () => browserStore().extendBreak(),
  setSubject: (s: string | null) => browserStore().setSubject(s),
  setSettings: (s: TimerSettings) => browserStore().setSettings(s),
  setChime: (b: boolean) => browserStore().setChime(b),
  setNotify: (b: boolean) => browserStore().setNotify(b),
  dismiss: () => browserStore().dismiss(),
  tick: () => browserStore().tick(),
  onNotice: (cb: (n: Notice) => void) => browserStore().onNotice(cb),
  /** The state now, and a way to hear it change (for the library, which is not a React store). */
  snapshot: () => browserStore().snapshot(),
  subscribe: (cb: () => void) => browserStore().subscribe(cb),
};

// Stable functions: an inline `subscribe` would be a new function every render, and React would drop and re-add the
// subscription on each one (every second, with the clock) which would stop and restart the store's ticker.
const subscribeBrowser = (cb: () => void) => browserStore().subscribe(cb);
const snapshotBrowser = () => browserStore().snapshot();
const snapshotServer = () => SERVER;

export function useTimer(): TimerState {
  return useSyncExternalStore(subscribeBrowser, snapshotBrowser, snapshotServer);
}
