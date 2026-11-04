"use client";

import { useSyncExternalStore } from "react";
import { copyInk, removeInk, removeSetInk } from "./inkDb";
import {
  againInput, checkPart, createSet, feedTouch, setMine, setTiers, deleteSet, EMPTY_QUESTIONS, finishSet, keyOf, markPart, openSet, catchUpInput, redoInput, renameSet, reopenSet, resetPart, setAt, setHeight, setInkMeta, setMode, setPick, setPrefs, setText,
  feedId, hasInk, hasText, type QAnswer, type FeedInfo, type Mode, type QPart, type QPrefs, type QuestionsData, type SetInput,
} from "./model";
import { APP_KEY, chooseRecoveryKey, QUESTIONS_KEY, readIncoming, readQuestions, serialise, setQuestionsDurable } from "./persist";

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

/**
 * Which set is on the desk belongs to the TAB (sessionStorage), not to the device: two tabs on two papers must not keep pulling each
 * other's view over. The stored `open` is still written (the last one is where a tab with no memory of its own, a fresh one, picks up).
 */
const TAB_OPEN_KEY = "plumi-study-questions-open";
let tabOpen: string | null | undefined;
function readTabOpen(): string | null | undefined {
  try { const v = sessionStorage.getItem(TAB_OPEN_KEY); return v === null ? undefined : v === "" ? null : v; } catch { return undefined; }
}
function saveTabOpen(v: string | null) { try { sessionStorage.setItem(TAB_OPEN_KEY, v ?? ""); } catch { /* private window: the tab just follows the stored one */ } }
/** The data with this tab's own open set. */
function withOpen(q: QuestionsData): QuestionsData {
  if (tabOpen === undefined) return q;
  const want = tabOpen !== null && q.sets.some((s) => s.id === tabOpen) ? tabOpen : null;
  return q.open === want ? q : { ...q, open: want };
}

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
      // An unreadable record is kept before anything is written over it, under a key no earlier one holds.
      try { const k = chooseRecoveryKey((x) => localStorage.getItem(x), loaded.keep); if (k) localStorage.setItem(k, loaded.keep); } catch { /* full: nothing more to do */ }
    }
    if (tabOpen === undefined) { const t = readTabOpen(); tabOpen = t === undefined ? (loaded.data.open ?? null) : t; if (t === undefined) saveTabOpen(tabOpen); }
    if (loaded.origin === "own") { lastRaw = own; setQuestionsDurable(true); return { ready: true, persisted: true, q: withOpen(loaded.data) }; }
    if (loaded.origin === "migrated") {
      // Copy, read back, and only then let the app's document let go of its copy.
      const ok = write(loaded.data) && localStorage.getItem(QUESTIONS_KEY) === lastRaw;
      setQuestionsDurable(ok);
      return { ready: true, persisted: ok, q: withOpen(loaded.data) };
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
    state = { ...state, q: withOpen(incoming) };
    emit();
  });
}

/** What storage holds now, if another tab has written since this one last did. */
function fresh(): QuestionsData {
  try {
    const raw = localStorage.getItem(QUESTIONS_KEY);
    if (raw !== null && raw !== lastRaw) {
      const q = readIncoming(raw);
      if (q) { lastRaw = raw; state = { ...state, q: withOpen(q) }; }
    }
  } catch { /* storage unreadable: this tab's copy it is */ }
  return state.q;
}

export function changeQuestions(fn: (q: QuestionsData) => QuestionsData) {
  flushInkMeta();
  apply(fn);
}

function apply(fn: (q: QuestionsData) => QuestionsData) {
  start();
  const base = state.ready ? fresh() : load().q;
  const next = fn(base);
  if (next === base) { if (state.q !== base) emit(); return; }
  if (next.open !== base.open) { tabOpen = next.open; saveTabOpen(next.open); }
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

/**
 * The questions the feed has drawn and may be written on: a question joins its subject's feed set at the moment of the first real write on it (typing, a pen or mouse stroke,
 * a mode tab, the scheme opened, a mark), never before, and never on a finger that is only scrolling. The card says what a question is when it appears; the join is done here,
 * inside the same change as the write, so there is no write the document does not know about. Kept in memory only; the newest are kept.
 */
const MAX_DRAWN = 600;
const drawn = new Map<string, { info: FeedInfo; part: QPart; names: Record<string, string>; topics: Record<string, string> }>();
export function registerFeedPart(info: FeedInfo, part: QPart, names: Record<string, string>, topics: Record<string, string>) {
  const k = keyOf(feedId(info.subject), part.id);
  drawn.delete(k);
  drawn.set(k, { info, part, names, topics });
  if (drawn.size > MAX_DRAWN) drawn.delete(drawn.keys().next().value as string);
}
/** The data with the question in its feed set, if the write is on a drawn feed question that is not in it yet. */
function joined(q: QuestionsData, setId: string, partId: string): QuestionsData {
  if (!setId.startsWith("feed-")) return q;
  const d = drawn.get(keyOf(setId, partId));
  if (!d) return q;
  return feedTouch(q, d.info, d.part, d.names, d.topics, now()).q;
}

/** Told when making a new set pushed older ones out (the cap), so the page can say so instead of letting a set vanish unannounced. */
const droppedListeners = new Set<(n: number) => void>();
export function onSetsDropped(fn: (n: number) => void): () => void {
  droppedListeners.add(fn);
  return () => { droppedListeners.delete(fn); };
}

/**
 * The count of strokes an answer has (and its bytes) is only a label for the sheet ("this part has writing"); the ink itself is saved
 * in IndexedDB the moment a stroke ends. So the label is written to the document a little later, one write for a burst of strokes, and
 * at once when the page is hidden or closed, or before any other change.
 */
const inkQueue = new Map<string, { setId: string; partId: string; n: number; b: number }>();
let inkTimer: ReturnType<typeof setTimeout> | null = null;
let inkFirst = 0;
function flushInkMeta() {
  if (inkTimer) { clearTimeout(inkTimer); inkTimer = null; }
  if (!inkQueue.size) return;
  const items = [...inkQueue.values()];
  inkQueue.clear();
  inkFirst = 0;
  apply((q) => items.reduce((acc, i) => setInkMeta(joined(acc, i.setId, i.partId), i.setId, i.partId, i.n, i.b, now()), q));
}
function queueInkMeta(setId: string, partId: string, n: number, bytes: number) {
  inkQueue.set(keyOf(setId, partId), { setId, partId, n, b: bytes });
  const t = Date.now();
  if (!inkTimer) inkFirst = t; else clearTimeout(inkTimer);
  inkTimer = setTimeout(flushInkMeta, Math.max(0, Math.min(350, inkFirst + 1500 - t)));
  hookHide();
}
let hooked = false;
function hookHide() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("pagehide", flushInkMeta);
  document.addEventListener("freeze", flushInkMeta);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushInkMeta(); });
}

/** Ask the browser not to clear this site's data under pressure (once, when there is first something worth keeping). The answer is not needed. */
let persistAsked = false;
function askToKeep() {
  if (persistAsked || typeof navigator === "undefined") return;
  persistAsked = true;
  try { void navigator.storage?.persist?.().catch(() => undefined); } catch { /* not offered here */ }
}

/**
 * "Continue here": the same question's writing and typing from another place (a paper, a set, the feed) copied into this answer, on the student's own tap.
 * The handwriting is copied under this answer's key first, then the document is told, so nothing is ever in one without the other.
 */
async function continueHere(fromSetId: string, toSetId: string, partId: string, a: QAnswer, flip = false): Promise<void> {
  // The copy is neutral about how the student answers: on the first mark or key on the faded copy the input stays what it is (a change would remount the canvas or the box
  // under the pen or the finger and drop the first marks), and both kinds are kept (the Write and Type tabs each show a dot for what they hold). Only the explicit "Continue
  // here" button, which is no gesture in progress, turns to the kind of answer it copied.
  if (hasInk(a)) {
    const r = await copyInk(keyOf(fromSetId, partId), keyOf(toSetId, partId));
    if (r.n > 0) { if (flip && !(hasText(a) && a.text)) qa.mode(toSetId, partId, "ink"); qa.ink(toSetId, partId, r.n, r.bytes); }
  }
  if (hasText(a) && a.text) { qa.text(toSetId, partId, a.text); if (flip && !hasInk(a)) qa.mode(toSetId, partId, "type"); }
}

export const qa = {
  continueHere,
  /** Make a set from chosen parts and put it on the desk. Ink of any set pushed out by the cap is deleted. */
  start(input: SetInput): string {
    let id = "";
    let dropped: string[] = [];
    changeQuestions((q) => { const r = createSet(q, input, now()); id = r.id; dropped = r.dropped; return r.q; });
    for (const d of dropped) void removeSetInk(d);
    if (dropped.length) droppedListeners.forEach((f) => f(dropped.length));
    return id;
  },
  /**
   * Put a question into its subject's feed set (made on the first), so the answer the student is about to write has a set to hang on.
   * Idempotent and quiet when the question is already there. False if the feed set is full (`MAX_FEED_PARTS`).
   */
  feedTouch(info: FeedInfo, part: QPart, names: Record<string, string>, topics: Record<string, string>): boolean {
    let ok = true;
    changeQuestions((q) => { const r = feedTouch(q, info, part, names, topics, now()); ok = r.ok; return r.q; });
    return ok;
  },
  open: (id: string | null) => changeQuestions((q) => openSet(q, id)),
  remove(id: string) { changeQuestions((q) => deleteSet(q, id)); void removeSetInk(id); },
  rename: (id: string, name: string) => changeQuestions((q) => renameSet(q, id, name)),
  at: (id: string, at: number) => changeQuestions((q) => setAt(q, id, at)),
  /** Typed answer. False if it did not all fit (the part's or the device's cap). */
  text(setId: string, partId: string, text: string): boolean {
    let ok = true;
    changeQuestions((q) => { const r = setText(joined(q, setId, partId), setId, partId, text, now()); ok = r.ok; return r.q; });
    if (text) askToKeep();
    return ok;
  },
  mode: (setId: string, partId: string, mode: Mode) => changeQuestions((q) => setMode(joined(q, setId, partId), setId, partId, mode, now())),
  height: (setId: string, partId: string, h: number) => changeQuestions((q) => setHeight(joined(q, setId, partId), setId, partId, h, now())),
  ink(setId: string, partId: string, n: number, bytes: number) { queueInkMeta(setId, partId, n, bytes); if (n > 0) askToKeep(); },
  check: (setId: string, partId: string) => changeQuestions((q) => (q.answers[keyOf(setId, partId)]?.chk ? q : checkPart(joined(q, setId, partId), setId, partId, now()))),
  mark: (setId: string, partId: string, got: number | null) => changeQuestions((q) => markPart(joined(q, setId, partId), setId, partId, got, now())),
  /** Clear a part's answer. (Its ink is cleared by its zone, which also keeps the undo.) */
  reset(setId: string, partId: string) { changeQuestions((q) => resetPart(joined(q, setId, partId), setId, partId, now())); },
  finish: (id: string) => changeQuestions((q) => finishSet(q, id, now())),
  reopen: (id: string) => changeQuestions((q) => reopenSet(q, id)),
  pick: (subject: string | null, topics: readonly string[]) => changeQuestions((q) => setPick(q, subject, topics)),
  /** The subjects the student does (slugs, in the order chosen). */
  mine: (slugs: readonly string[]) => changeQuestions((q) => setMine(q, slugs)),
  /** The tier the student sits in a subject (`[]` or every tier: both). `all` is the subject's tiers, so choosing them all is stored as nothing. */
  tiers: (slug: string, tiers: readonly string[], all: readonly string[] = []) => changeQuestions((q) => setTiers(q, slug, tiers, all)),
  prefs: (p: Partial<QPrefs>) => changeQuestions((q) => setPrefs(q, p)),
  /** A redo set of the parts that lost marks, or null if none did. */
  redo(setId: string): string | null {
    const q = currentQuestions();
    const set = q.sets.find((s) => s.id === setId);
    const input = set ? redoInput(set, q.answers) : null;
    return input ? qa.start(input) : null;
  },
  /** A whole paper again from the start (a fresh set, no answers carried over), or null if the set was not a whole paper. */
  again(setId: string): string | null {
    const set = currentQuestions().sets.find((s) => s.id === setId);
    const input = set ? againInput(set) : null;
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
