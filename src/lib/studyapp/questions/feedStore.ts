"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_FEED_PREFS, FEED_KEY, parseFeedPrefs, type FeedPos, type FeedPrefs } from "./feedView";

/**
 * The feed's own remembered choices (feedView.ts says what) on this device. Reads and writes are guarded: a private window, a full disk or a blocked
 * store just means the page starts fresh each visit. The scroll position is kept in memory and written a moment later without telling anyone (it changes
 * every few pixels; nothing draws from it), everything else is a normal store change.
 */
let prefs: FeedPrefs = EMPTY_FEED_PREFS;
let started = false;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  try { prefs = parseFeedPrefs(localStorage.getItem(FEED_KEY)); } catch { /* nothing remembered */ }
  window.addEventListener("pagehide", flush);
}
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  try { localStorage.setItem(FEED_KEY, JSON.stringify(prefs)); } catch { /* full or blocked: the choices last for the visit */ }
}
function later() { if (!timer) timer = setTimeout(flush, 400); }

export function updateFeedPrefs(fn: (p: FeedPrefs) => FeedPrefs) {
  start();
  const next = fn(prefs);
  if (next === prefs) return;
  prefs = next;
  later();
  listeners.forEach((l) => l());
}

/** Where the student got to in a subject's list, remembered without drawing anything. */
export function rememberPos(slug: string, pos: FeedPos) {
  start();
  const had = prefs.pos[slug];
  if (had && had.id === pos.id && had.off === pos.off) return;
  prefs = { ...prefs, pos: { ...prefs.pos, [slug]: pos } };
  later();
}
export const savedPos = (slug: string): FeedPos | null => { start(); return prefs.pos[slug] ?? null; };
export const currentFeedPrefs = (): FeedPrefs => { start(); return prefs; };

const subscribe = (cb: () => void) => { start(); listeners.add(cb); return () => { listeners.delete(cb); }; };
export function useFeedPrefs(): FeedPrefs {
  return useSyncExternalStore(subscribe, () => { start(); return prefs; }, () => EMPTY_FEED_PREFS);
}

/**
 * The page goes back to its top whenever a screen changes (QuestionsPage), but a feed that is opening where it was left must not be taken
 * away from there: it says so as it mounts, and the page, which looks in the same moment, takes that once. A word said long ago is not a word
 * (a feed that mounted on its own, long before the next screen change, must not keep the next one from its top).
 */
const HOLD_MS = 300;
let heldAt = -Infinity;
export const holdScroll = () => { heldAt = performance.now(); };
export const takeHeldScroll = (): boolean => { const held = performance.now() - heldAt < HOLD_MS; heldAt = -Infinity; return held; };
