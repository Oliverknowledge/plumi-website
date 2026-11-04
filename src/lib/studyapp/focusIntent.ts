"use client";

import { useSyncExternalStore } from "react";

/**
 * "Do Plumi questions", from the seat card of the library: two small notes passed to the Questions page, which is a different page.
 *
 * 1. The INTENT: which subject the student is focusing on (a seat card id, or null for a plain "Focus"). It lives in memory only, for a minute, and is looked at
 *    once by the Questions page as it opens: a Questions page opened any other way, or a minute later, is not told anything.
 * 2. The SEAT NOTE: the student left a seat in the library to do questions. It is what lets the Questions page offer "Back to my seat", and only while the focus session is
 *    still running. It is remembered for this tab (a reload keeps it) and forgotten once they sit again, press the link, or stop.
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

export const SEAT_KEY = "plumi-focus-from-seat";
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());
const read = (): boolean => { try { return window.sessionStorage.getItem(SEAT_KEY) === "1"; } catch { return false; } };
export function markFromSeat() { try { window.sessionStorage.setItem(SEAT_KEY, "1"); } catch { /* the link is a convenience */ } tell(); }
export function clearFromSeat() { try { window.sessionStorage.removeItem(SEAT_KEY); } catch { /* nothing to forget */ } tell(); }

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === SEAT_KEY || e.key === null) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
};
/** Whether the student left a seat to do questions (false on the server and until the browser has been asked). */
export const useFromSeat = (): boolean => useSyncExternalStore(subscribe, read, () => false);
