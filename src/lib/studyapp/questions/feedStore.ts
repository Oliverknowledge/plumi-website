"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_FEED_PREFS, FEED_KEY, mergePrefs, parseFeedPrefs, type FeedPos, type FeedPrefs } from "./feedView";

/**
 * The feed's own remembered choices (feedView.ts says what) on this device. Reads and writes are guarded: a private window, a full disk or a blocked
 * store just means the page starts fresh each visit. The scroll position is kept in memory and written a moment later without telling anyone (it changes
 * every few pixels; nothing draws from it), everything else is a normal store change.
 */
let prefs: FeedPrefs = EMPTY_FEED_PREFS;
let started = false;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
/** What this tab has changed since it last wrote: only these are written over what another tab has stored (two tabs on two subjects must not undo each other). */
const dirty = { last: false, view: new Set<string>(), filters: new Set<string>(), pos: new Set<string>(), folded: new Set<string>() };

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  try { prefs = parseFeedPrefs(localStorage.getItem(FEED_KEY)); } catch { /* nothing remembered */ }
  window.addEventListener("pagehide", flush);
  // Another tab wrote: take what it says, keeping this tab's own unsaved changes over it.
  window.addEventListener("storage", (e) => {
    if (e.key !== FEED_KEY) return;
    prefs = mergePrefs(parseFeedPrefs(e.newValue), prefs, dirty);
    listeners.forEach((l) => l());
  });
}
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    // Read what is stored now (another tab may have written since this one last did) and put only this tab's changes over it.
    const merged = mergePrefs(parseFeedPrefs(localStorage.getItem(FEED_KEY)), prefs, dirty);
    localStorage.setItem(FEED_KEY, JSON.stringify(merged));
    dirty.last = false;
    for (const k of ["view", "filters", "pos", "folded"] as const) dirty[k].clear();
    prefs = merged;
  } catch { /* full or blocked: the choices last for the visit */ }
}
function later() { if (!timer) timer = setTimeout(flush, 400); }

/** Mark what differs between two records as this tab's own change. */
function markDirty(a: FeedPrefs, b: FeedPrefs) {
  if (a.last !== b.last) dirty.last = true;
  for (const k of ["view", "filters", "pos", "folded"] as const) {
    const x = a[k] as Record<string, unknown>, y = b[k] as Record<string, unknown>;
    for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) if (x[key] !== y[key]) dirty[k].add(key);
  }
}

export function updateFeedPrefs(fn: (p: FeedPrefs) => FeedPrefs) {
  start();
  const next = fn(prefs);
  if (next === prefs) return;
  markDirty(prefs, next);
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
  dirty.pos.add(slug);
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
