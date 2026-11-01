"use client";

import { useSyncExternalStore } from "react";

/** Whether the library page's room is open now (so the Desk's beacon stands aside: the page publishes more). */
let open = 0;
export const roomIsOpen = () => open > 0;
export function markRoom(on: boolean) { open = Math.max(0, open + (on ? 1 : -1)); }

/**
 * Whether the room is FULL SCREEN now: it covers the top bar, so the top bar's own controls (the timer chip) step
 * aside and the room's toolbar carries them instead. Nothing is then reachable twice, or reachable but covered.
 */
let full = 0;
const listeners = new Set<() => void>();
export function markFull(on: boolean) {
  full = Math.max(0, full + (on ? 1 : -1));
  listeners.forEach((l) => l());
}
export function useRoomFull(): boolean {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => full > 0, () => false);
}
