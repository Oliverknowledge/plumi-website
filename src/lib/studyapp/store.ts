"use client";

import { useSyncExternalStore } from "react";
import {
  addCard, addDeck, addSession, addStarters, addTask, deleteCard, deleteDeck, deleteSession, dueNow, EMPTY, editCard, gradeCard, importCards, importInto,
  removeTask, renameDeck, renameSession, sanitise, setExam, setLast, setPerDay, toggleTask, type AppData, type Exam, type ImportTarget, type Last,
} from "./model";
import type { Grade } from "./srs";

/**
 * The Desk's and the flashcards' data, kept on this device (localStorage) and shared between tabs. Signed out
 * or signed in, it is the same: nothing here is sent anywhere. Syncing to the account is a later step; the
 * data is one JSON document with a version for that reason (model.ts).
 *
 * Storage can be missing or full (a private window, a blocked site): the app then works for the visit and
 * says nothing, because a student must never see an error. `persisted` reports whether it is actually kept.
 */
const KEY = "plumi-study-app";

interface State { ready: boolean; persisted: boolean; data: AppData }
const SERVER: State = { ready: false, persisted: false, data: EMPTY };
let state: State = SERVER;
const listeners = new Set<() => void>();
let started = false;

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return { ready: true, persisted: true, data: raw ? sanitise(JSON.parse(raw)) : EMPTY };
  } catch {
    return { ready: true, persisted: false, data: EMPTY };
  }
}

function emit() { listeners.forEach((l) => l()); }

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  state = load();
  window.addEventListener("storage", (e) => { if (e.key === KEY) { state = load(); emit(); } });
}

function commit(next: AppData) {
  let persisted = state.persisted;
  try { localStorage.setItem(KEY, JSON.stringify(next)); persisted = true; } catch { persisted = false; }
  state = { ready: true, persisted, data: next };
  emit();
}

const subscribe = (cb: () => void) => { start(); listeners.add(cb); if (state !== SERVER) cb(); return () => { listeners.delete(cb); }; };
const snapshot = () => { start(); return state; };

export function useApp(): State { return useSyncExternalStore(subscribe, snapshot, () => SERVER); }

/** Cards due now (and new ones within today's allowance): the Flashcards badge and the Desk card. */
export function useDueCount(now: number): number { const s = useApp(); return s.ready ? dueNow(s.data, now).ids.length : 0; }

const change = (fn: (d: AppData) => AppData) => commit(fn(state.ready ? state.data : load().data));
const now = () => Date.now();

export const actions = {
  addTask: (text: string, due: string, subject?: string | null) => change((d) => addTask(d, text, due, now(), subject)),
  toggleTask: (id: string) => change((d) => toggleTask(d, id, now())),
  removeTask: (id: string) => change((d) => removeTask(d, id)),
  setExam: (exam: Exam | null) => change((d) => setExam(d, exam)),
  addStarters: (ids: string[]) => change((d) => addStarters(d, ids, now())),
  addDeck: (title: string, subject: string | null = null): string | null => {
    let id: string | null = null;
    change((d) => { const r = addDeck(d, title, now(), subject); id = r.deck?.id ?? null; return r.data; });
    return id;
  },
  renameDeck: (id: string, title: string) => change((d) => renameDeck(d, id, title)),
  deleteDeck: (id: string) => change((d) => deleteDeck(d, id)),
  addCard: (deckId: string, front: string, back: string) => change((d) => addCard(d, deckId, front, back, now())),
  editCard: (id: string, front: string, back: string) => change((d) => editCard(d, id, front, back)),
  deleteCard: (id: string) => change((d) => deleteCard(d, id)),
  importCards: (deckId: string, text: string): { added: number; skipped: number } => {
    let out = { added: 0, skipped: 0 };
    change((d) => { const r = importCards(d, deckId, text, now()); out = { added: r.added, skipped: r.skipped }; return r.data; });
    return out;
  },
  addSession: (name: string, deckIds: readonly string[]): string | null => {
    let id: string | null = null;
    change((d) => { const r = addSession(d, name, deckIds, now()); id = r.session?.id ?? null; return r.data; });
    return id;
  },
  renameSession: (id: string, name: string) => change((d) => renameSession(d, id, name)),
  deleteSession: (id: string) => change((d) => deleteSession(d, id)),
  /** Cards read from a file or pasted text, into a deck that exists or a new one. */
  importInto: (target: ImportTarget, pairs: readonly (readonly [string, string])[]): { deckId: string | null; added: number } => {
    let out: { deckId: string | null; added: number } = { deckId: null, added: 0 };
    change((d) => { const r = importInto(d, target, pairs, now()); out = { deckId: r.deckId, added: r.added }; return r.data; });
    return out;
  },
  grade: (cardId: string, grade: Grade) => change((d) => gradeCard(d, cardId, grade, now())),
  setLast: (last: Last) => change((d) => setLast(d, last)),
  setPerDay: (n: number) => change((d) => setPerDay(d, n)),
};
