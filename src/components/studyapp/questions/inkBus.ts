"use client";

import { useSyncExternalStore } from "react";

/**
 * Which ink zone the pen tray is working on, and what it can do right now. The zone the student last touched is the
 * active one. Zones register an imperative handle (undo, redo, clear); the tray reads a small snapshot.
 */
export interface InkHandle { undo(): void; redo(): void; clear(): void; focus(): void }
export interface InkCaps { key: string | null; canUndo: boolean; canRedo: boolean; hasInk: boolean; label: string }

const handles = new Map<string, InkHandle>();
const NONE: InkCaps = { key: null, canUndo: false, canRedo: false, hasInk: false, label: "" };
let caps: InkCaps = NONE;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function registerInk(key: string, h: InkHandle) { handles.set(key, h); return () => { handles.delete(key); if (caps.key === key) { caps = NONE; emit(); } }; }

/** A zone says what it can do. Ignored unless it is the active one. */
export function reportInk(next: InkCaps) {
  if (caps.key !== null && next.key !== caps.key) return;
  if (caps.key === next.key && caps.canUndo === next.canUndo && caps.canRedo === next.canRedo && caps.hasInk === next.hasInk && caps.label === next.label) return;
  caps = next; emit();
}
export function activateInk(next: InkCaps) { caps = next; emit(); }

export const inkAct = {
  undo: () => caps.key && handles.get(caps.key)?.undo(),
  redo: () => caps.key && handles.get(caps.key)?.redo(),
  clear: () => caps.key && handles.get(caps.key)?.clear(),
};

export function useInkCaps(): InkCaps {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => caps, () => NONE);
}

/** A pen has touched this page: from then on the writing surfaces leave touch scrolling to the page (see InkCanvas). */
let penSeen = false;
const penSubs = new Set<() => void>();
export function setPenSeen(v: boolean) { if (penSeen !== v) { penSeen = v; penSubs.forEach((s) => s()); } }
export function usePenSeen(): boolean {
  return useSyncExternalStore((cb) => { penSubs.add(cb); return () => { penSubs.delete(cb); }; }, () => penSeen, () => false);
}
export const penSeenNow = () => penSeen;
