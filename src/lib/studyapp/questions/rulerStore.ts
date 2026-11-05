"use client";

import { useSyncExternalStore } from "react";
import type { RulerPose } from "./rulerMath";

/**
 * The virtual ruler's one place on the page: which part it is open for (one at a time) and where it lies, in the picture's own pixels (so the card's picture and the enlarged one
 * show it in the same place). Nothing is saved: it is put away when the page is left, and a new opening starts it level in the picture's lower part.
 */
export interface RulerState { partId: string | null; pose: RulerPose | null }
const NONE: RulerState = { partId: null, pose: null };
let state: RulerState = NONE;
const subs = new Set<() => void>();
const set = (s: RulerState) => { state = s; subs.forEach((f) => f()); };

export const ruler = {
  get: (): RulerState => state,
  /** Open it for a part (any other part's is put away). */
  open(partId: string) { if (state.partId !== partId) set({ partId, pose: null }); },
  close(partId?: string) { if (state.partId !== null && (partId === undefined || state.partId === partId)) set(NONE); },
  toggle(partId: string) { if (state.partId === partId) set(NONE); else set({ partId, pose: null }); },
  /** Only for the part it is open for. */
  move(partId: string, pose: RulerPose) { if (state.partId === partId) set({ partId, pose }); },
  /** Where it lies when it first lies somewhere (never over a place it has already been put). */
  place(partId: string, pose: RulerPose) { if (state.partId === partId && !state.pose) set({ partId, pose }); },
};

const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export function useRulerState(): RulerState {
  return useSyncExternalStore(subscribe, ruler.get, () => NONE);
}
