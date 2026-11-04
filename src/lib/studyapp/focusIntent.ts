"use client";

import { useSyncExternalStore } from "react";

/**
 * "Do Plumi questions", from the seat card of the library: two small notes passed to the Questions page, which is a different page.
 *
 * 1. The INTENT: which subject the student is focusing on (a seat card id, or null for a plain "Focus"). It lives in memory only, for a minute, and is looked at
 *    once by the Questions page as it opens: a Questions page opened any other way, or a minute later, is not told anything.
 * 2. The SEAT NOTE: the student left a seat in the library to do questions. It is what lets the Questions page offer "Back to the library" (the library lets go of the seat when it is left, so the way back is to the library, where the student sits again), and only while the focus session is
 *    still running. It is remembered for this tab (a reload keeps it) and forgotten once they sit again, press the link, or the session stops or is replaced.
 */
export interface FocusIntent { subject: string | null; at: number }
export const INTENT_MS = 60_000;

/** An intent is fresh for a minute after it was made, and never from the future. */
export const isFresh = (i: FocusIntent | null, now: number): i is FocusIntent => !!i && now >= i.at && now - i.at <= INTENT_MS;

let intent: FocusIntent | null = null;
export const setFocusIntent = (subject: string | null, now = Date.now()) => { intent = { subject, at: now }; };
/** Looked at, not taken: a page that builds twice (development) still finds it. It is cleared by `clearFocusIntent` once it has been used. */
export const peekFocusIntent = (now = Date.now()): FocusIntent | null => (isFresh(intent, now) ? intent : null);
export const clearFocusIntent = () => { intent = null; };

/* ── The seat note ───────────────────────────────────────────────────── */

/**
 * The note holds the id of the focus session the student left the library with. It is good only for that session: once the session is stopped or finished, or another one
 * is running (started from the Desk chip, say), the note is not true any more and is forgotten (`tidySeatNote`, run by TimerEffects on every page).
 */
export const SEAT_KEY = "plumi-focus-from-seat";
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());
const read = (): string | null => { try { return window.sessionStorage.getItem(SEAT_KEY) || null; } catch { return null; } };
export function markFromSeat(sessionId: string) { try { window.sessionStorage.setItem(SEAT_KEY, sessionId); } catch { /* the link is a convenience */ } tell(); }
export function clearFromSeat() { try { window.sessionStorage.removeItem(SEAT_KEY); } catch { /* nothing to forget */ } tell(); }

/** Whether a note still stands: there is a session, it is not over, and it is the one the note was made for. Pure. */
export const seatNoteStands = (note: string | null, session: { id: string; isOver: boolean } | null): boolean => note !== null && !!session && !session.isOver && session.id === note;
/** Forget the note if it no longer stands for this session (none, stopped, finished, or another one). */
export function tidySeatNote(session: { id: string; isOver: boolean } | null) {
  const note = read();
  if (note !== null && !seatNoteStands(note, session)) clearFromSeat();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === SEAT_KEY || e.key === null) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
};
/** Whether the student left a seat to do questions in THIS session (false on the server and until the browser has been asked). */
export const useFromSeat = (sessionId: string | null): boolean => useSyncExternalStore(subscribe, () => sessionId !== null && read() === sessionId, () => false);
