"use client";

import { useSyncExternalStore } from "react";

/**
 * The time, for components that show it, as a store: the server renders 0 (no time) and the browser reads
 * the real one, so nothing differs between the two and nothing sets state in an effect. The value moves in
 * steps (`step` ms), so a component re-renders once a step, not every tick.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) { clearInterval(timer); timer = null; }
  };
}

export function useNow(step = 30_000): number {
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / step) * step, () => 0);
}
