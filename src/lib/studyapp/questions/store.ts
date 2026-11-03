"use client";

import { useSyncExternalStore } from "react";
import { removeInk, removeSetInk } from "./inkDb";
import {
  checkPart, createSet, deleteSet, EMPTY_QUESTIONS, finishSet, keyOf, markPart, openSet, catchUpInput, redoInput, renameSet, reopenSet, resetPart, setAt, setHeight, setInkMeta, setMode, setPick, setPrefs, setText,
  type Mode, type QPrefs, type QuestionsData, type SetInput,
} from "./model";
import { APP_KEY, QUESTIONS_KEY, QUESTIONS_RECOVERY_KEY, readIncoming, readQuestions, serialise, setQuestionsDurable } from "./persist";

/**
 * The Questions tab's data on this device: its own localStorage key (persist.ts says why and how it is read), shared between tabs,
 * with one rule above the rest: nothing a student wrote is thrown away.
 *  - Every change is applied to what storage holds right now, not to this tab's memory, so a tab that slept (or a second tab)
 *    never writes an old copy of the whole thing over newer work.
 *  - Storage missing or full: the page works for the visit and says so (`persisted`), the data stays in memory.
 *  - Data that cannot be read is kept under a recovery key before anything is written over it.
 */
interface State { ready: boolean; persisted: boolean; q: QuestionsData }
const SERVER: State = { ready: false, persisted: false, q: EMPTY_QUESTIONS };
let state: State = SERVER;
const listeners = new Set<() => void>();
let started = false;
/** The text this tab last wrote or read, to tell whether another tab has written since. */
let lastRaw: string | null = null;

const emit = () => listeners.forEach((l) => l());

function write(q: QuestionsData): boolean {
  try {
    const raw = serialise(q);
    localStorage.setItem(QUESTIONS_KEY, raw);
    lastRaw = raw;
    return true;
  } catch { return false; }
}

function load(): State {
  try {
    const own = localStorage.getItem(QUESTIONS_KEY);
    const loaded = readQuestions(own, localStorage.getItem(APP_KEY));
    if (loaded.keep !== null) {
      try { if (localStorage.getItem(QUESTIONS_RECOVERY_KEY) === null) localStorage.setItem(QUESTIONS_RECOVERY_KEY, loaded.keep); } catch { /* full: nothing more to do */ }
    }
    if (loaded.origin === "own") { lastRaw = own; setQuestionsDurable(true); return { ready: true, persisted: true, q: loaded.data }; }
    if (loaded.origin === "migrated") {
      // Copy, read back, and only then let the app's document let go of its copy.
      const ok = write(loaded.data) && localStorage.getItem(QUESTIONS_KEY) === lastRaw;
      setQuestionsDurable(ok);
      return { ready: true, persisted: ok, q: loaded.data };
    }
    // A new student (or an unreadable record kept above). Writing starts with their first change.
    return { ready: true, persisted: true, q: EMPTY_QUESTIONS };
  } catch {
    return { ready: true, persisted: false, q: EMPTY_QUESTIONS };
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  state = load();
  window.addEventListener("storage", (e) => {
    if (e.key !== QUESTIONS_KEY) return;
    const incoming = readIncoming(e.newValue);
    if (!incoming) return;   // cleared or unreadable elsewhere: keep what this tab has, it is written back by the next change
    lastRaw = e.newValue;
    state = { ...state, q: incoming };
    emit();
  });
}

/** What storage holds now, if another tab has written since this one last did. */
function fresh(): QuestionsData {
  try {
    const raw = localStorage.getItem(QUESTIONS_KEY);
    if (raw !== null && raw !== lastRaw) {
      const q = readIncoming(raw);
      if (q) { lastRaw = raw; state = { ...state, q }; }
    }
  } catch { /* storage unreadable: this tab's copy it is */ }
  return state.q;
}

export function changeQuestions(fn: (q: QuestionsData) => QuestionsData) {
  start();
  const base = state.ready ? fresh() : load().q;
  const next = fn(base);
  if (next === base) { if (state.q !== base) emit(); return; }
  const ok = write(next);
  if (ok) setQuestionsDurable(true);
  state = { ready: true, persisted: ok, q: next };
  emit();
}

/** The latest Questions data right now (not a render's snapshot), for a handler that must read what it just wrote. */
export function currentQuestions(): QuestionsData { start(); return state.ready ? fresh() : load().q; }

const subscribe = (cb: () => void) => { start(); listeners.add(cb); if (state !== SERVER) cb(); return () => { listeners.delete(cb); }; };
const snapshot = () => { start(); return state; };

function useStore(): State { return useSyncExternalStore(subscribe, snapshot, () => SERVER); }

/** The Questions tab's data from this device, and whether it is actually being kept. */
export function useQuestions(): { ready: boolean; persisted: boolean; q: QuestionsData } {
  const s = useStore();
  return { ready: s.ready, persisted: s.persisted, q: s.q };
}

/** One value out of the data, so a component that reads only a preference is not drawn again by every stroke and keystroke. */
export function useQuestionsValue<T>(pick: (q: QuestionsData) => T): T {
  return useSyncExternalStore(subscribe, () => pick(snapshot().q), () => pick(EMPTY_QUESTIONS));
}

const now = () => Date.now();

export const qa = {
  /** Make a set from chosen parts and put it on the desk. Ink of any set pushed out by the cap is deleted. */
  start(input: SetInput): string {
    let id = "";
    let dropped: string[] = [];
    changeQuestions((q) => { const r = createSet(q, input, now()); id = r.id; dropped = r.dropped; return r.q; });
    for (const d of dropped) void removeSetInk(d);
    return id;
  },
  open: (id: string | null) => changeQuestions((q) => openSet(q, id)),
  remove(id: string) { changeQuestions((q) => deleteSet(q, id)); void removeSetInk(id); },
  rename: (id: string, name: string) => changeQuestions((q) => renameSet(q, id, name)),
  at: (id: string, at: number) => changeQuestions((q) => setAt(q, id, at)),
  /** Typed answer. False if it did not all fit (the part's or the device's cap). */
  text(setId: string, partId: string, text: string): boolean {
    let ok = true;
    changeQuestions((q) => { const r = setText(q, setId, partId, text, now()); ok = r.ok; return r.q; });
    return ok;
  },
  mode: (setId: string, partId: string, mode: Mode) => changeQuestions((q) => setMode(q, setId, partId, mode, now())),
  height: (setId: string, partId: string, h: number) => changeQuestions((q) => setHeight(q, setId, partId, h, now())),
  ink: (setId: string, partId: string, n: number, bytes: number) => changeQuestions((q) => setInkMeta(q, setId, partId, n, bytes, now())),
  check: (setId: string, partId: string) => changeQuestions((q) => (q.answers[keyOf(setId, partId)]?.chk ? q : checkPart(q, setId, partId, now()))),
  mark: (setId: string, partId: string, got: number | null) => changeQuestions((q) => markPart(q, setId, partId, got, now())),
  /** Clear a part's answer. (Its ink is cleared by its zone, which also keeps the undo.) */
  reset(setId: string, partId: string) { changeQuestions((q) => resetPart(q, setId, partId, now())); },
  finish: (id: string) => changeQuestions((q) => finishSet(q, id, now())),
  reopen: (id: string) => changeQuestions((q) => reopenSet(q, id)),
  pick: (subject: string | null, topics: readonly string[]) => changeQuestions((q) => setPick(q, subject, topics)),
  prefs: (p: Partial<QPrefs>) => changeQuestions((q) => setPrefs(q, p)),
  /** A redo set of the parts that lost marks, or null if none did. */
  redo(setId: string): string | null {
    const q = currentQuestions();
    const set = q.sets.find((s) => s.id === setId);
    const input = set ? redoInput(set, q.answers) : null;
    return input ? qa.start(input) : null;
  },
  /** A new set of the parts that were skipped, or null if none were. */
  catchUp(setId: string): string | null {
    const q = currentQuestions();
    const set = q.sets.find((s) => s.id === setId);
    const input = set ? catchUpInput(set, q.answers) : null;
    return input ? qa.start(input) : null;
  },
  /** Ink of one answer, deleted from the device (when a part is reset from outside its zone). */
  dropInk: (setId: string, partId: string) => removeInk([keyOf(setId, partId)]),
};
