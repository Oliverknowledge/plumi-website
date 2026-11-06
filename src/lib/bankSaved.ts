"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Saved questions in the question bank: a bookmark ("I want this again") and a note to
 * self ("what I want to remember next time"), per part. Unlike a set, which is the basket
 * for today's PDF, these stay until the student takes them off. Unlike "Have another go",
 * the student chooses them.
 *
 * The browser is the place every view reads from and no account is needed. A signed-in
 * student's are copied to their account (lib/bankSync), which matters more here than for
 * a draft: Safari deletes a site's storage after seven days without a visit, and a
 * bookmark is made in November to be found in May.
 *
 * An entry stays after it's emptied (no bookmark, no note), with the time it was emptied:
 * without that, merging with another device would bring back what was taken off.
 */

const KEY = "plumi-bank-saved:v1";
/** The longest note: a note to self, not an essay (the answer box is for those). */
export const NOTE_MAX = 2_000;

export type SavedEntry = { /** the bank */ s: string; /** bookmarked */ b: boolean; /** the note, "" for none */ n: string; /** last changed, ms */ at: number };
export type SavedItems = Record<string, SavedEntry>;
/** `owner`: the account this browser's copy was last synced with, if any. */
type Doc = { owner: string | null; items: SavedItems };
const EMPTY: Doc = { owner: null, items: {} };

/* ── The rules, with no storage in them ──────────────────────────────────── */

/** Bookmark on or off. The note, if there is one, stays: it's still on the question. */
export function withBookmark(entry: SavedEntry | undefined, subject: string, on: boolean, at: number): SavedEntry {
  return { s: subject, b: on, n: entry?.n ?? "", at };
}

/** A new note bookmarks its question, so it can be found again. Changing or clearing one leaves the bookmark as it is. */
export function withNote(entry: SavedEntry | undefined, subject: string, text: string, at: number): SavedEntry {
  const n = text.trim() ? text.slice(0, NOTE_MAX) : "";
  const first = !entry?.n && !!n;
  return { s: subject, b: first || !!entry?.b, n, at };
}

/** Two devices' copies of a part: the later change wins, whole. */
export const newer = (a: SavedEntry | undefined, b: SavedEntry): SavedEntry => (a && a.at >= b.at ? a : b);

/** Add what came from the account to what's here. The same object back when nothing changed. */
export function mergeItems(items: SavedItems, incoming: { part: string; entry: SavedEntry }[]): SavedItems {
  let next = items;
  for (const { part, entry } of incoming) {
    if (newer(next[part], entry) === next[part]) continue;
    if (next === items) next = { ...items };
    next[part] = entry;
  }
  return next;
}

/** What the account should be sent: everything here it doesn't have, or has an older copy of. */
export function toSend(items: SavedItems, remote: { part: string; at: number }[]): string[] {
  const have = new Map(remote.map(r => [r.part, r.at]));
  return Object.keys(items).filter(part => items[part].at > (have.get(part) ?? -1));
}

/** The bookmarked parts of a bank. */
export function bookmarkedIn(items: SavedItems, subject: string): Set<string> {
  const ids = new Set<string>();
  for (const part in items) if (items[part].s === subject && items[part].b) ids.add(part);
  return ids;
}

/* ── The store: localStorage, or memory where there's none (private windows) ─ */

let memory: string | null = null;
const listeners = new Set<() => void>();
function readRaw() {
  try { return localStorage.getItem(KEY) ?? memory ?? ""; } catch { return memory ?? ""; }
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}
let parsed: { raw: string; doc: Doc } = { raw: "", doc: EMPTY };
function parse(raw: string): Doc {
  if (raw === parsed.raw) return parsed.doc;
  let doc = EMPTY;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.items === "object" && v.items) doc = { owner: typeof v.owner === "string" ? v.owner : null, items: v.items };
  } catch { /* unreadable: start again */ }
  parsed = { raw, doc };
  return doc;
}
function write(doc: Doc) {
  const raw = JSON.stringify(doc);
  memory = raw;
  try { localStorage.setItem(KEY, raw); } catch { /* storage unavailable or full: memory only */ }
  listeners.forEach(l => l());
}

/** What changed, for the account sync. */
const changeListeners = new Set<(parts: string[]) => void>();
export function onSavedChange(cb: (parts: string[]) => void) {
  changeListeners.add(cb);
  return () => { changeListeners.delete(cb); };
}

function change(parts: { part: string; entry: SavedEntry }[]) {
  if (!parts.length) return;
  const doc = parse(readRaw());
  write({ owner: doc.owner, items: { ...doc.items, ...Object.fromEntries(parts.map(p => [p.part, p.entry])) } });
  changeListeners.forEach(l => l(parts.map(p => p.part)));
}

/* ── For the page ────────────────────────────────────────────────────────── */

/** Everything saved in this browser, read live (another tab's changes show here too). */
export function useSavedItems(): SavedItems {
  return parse(useSyncExternalStore(subscribe, readRaw, () => "")).items;
}

/** The bookmarked parts of one bank. */
export function useBookmarks(subject: string) {
  const items = useSavedItems();
  return useMemo(() => bookmarkedIn(items, subject), [items, subject]);
}

/** Bookmark parts, or take the bookmark off them. */
export function setBookmarks(subject: string, parts: string[], on: boolean) {
  const { items } = parse(readRaw());
  const at = Date.now();
  change(parts.filter(p => !!items[p]?.b !== on).map(part => ({ part, entry: withBookmark(items[part], subject, on, at) })));
}

/** Save a part's note; an empty one removes it. Does nothing when the text hasn't changed. */
export function saveNote(subject: string, part: string, text: string) {
  const entry = parse(readRaw()).items[part];
  const next = withNote(entry, subject, text, Date.now());
  if (next.n === (entry?.n ?? "")) return;
  change([{ part, entry: next }]);
}

/* ── For the account sync (lib/bankSync) ─────────────────────────────────── */

export const savedItems = () => parse(readRaw()).items;
export const savedOwner = () => parse(readRaw()).owner;
export function mergeSaved(incoming: { part: string; entry: SavedEntry }[]) {
  const doc = parse(readRaw());
  const items = mergeItems(doc.items, incoming);
  if (items !== doc.items) write({ owner: doc.owner, items });
}
export function setSavedOwner(owner: string) {
  const doc = parse(readRaw());
  if (doc.owner !== owner) write({ owner, items: doc.items });
}
/** Take a synced student's copy off this browser. It's in their account; it shouldn't be left for whoever uses this computer next. */
export function clearSaved() {
  write(EMPTY);
}
