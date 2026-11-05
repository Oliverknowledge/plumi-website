"use client";

import { useSyncExternalStore } from "react";

/**
 * Which questions of the feed have their answer space opened, and in which way ("type" or "ink"): the two buttons under a question's picture open it, and an opened space that
 * is still empty folds back to the two buttons. Kept for the tab (a reload brings back the spaces that were open; a card scrolled far away and drawn again has its space as it
 * was), not on the device: an empty space left open is not worth remembering for ever. Writing is kept in the answers, not here.
 */
const KEY = "plumi-feed-open";
const CAP = 200;
export type OpenMode = "type" | "ink";
let open = new Map<string, OpenMode>();
let started = false;
const subs = new Set<() => void>();


function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw).slice(0, CAP)) if (v === "type" || v === "ink") open.set(k.slice(0, 100), v);
    }
  } catch { /* nothing remembered */ }
}
function save() {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(open))); } catch { /* the page still knows */ }
}
const emit = () => subs.forEach((s) => s());

export function openAnswer(id: string, mode: OpenMode) {
  start();
  if (open.get(id) === mode) return;
  open = new Map(open).set(id, mode);
  // (the oldest are let go past the cap)
  if (open.size > CAP) open = new Map([...open].slice(open.size - CAP));
  save(); emit();
}
export function foldAnswer(id: string) {
  start();
  if (!open.has(id)) return;
  open = new Map(open); open.delete(id);
  save(); emit();
}
export const openModeOf = (id: string): OpenMode | null => { start(); return open.get(id) ?? null; };

const subscribe = (cb: () => void) => { start(); subs.add(cb); return () => { subs.delete(cb); }; };
/** The way a question's space is open (null: folded to the buttons). */
export function useOpenAnswer(id: string): OpenMode | null {
  return useSyncExternalStore(subscribe, () => { start(); return open.get(id) ?? null; }, () => null);
}
