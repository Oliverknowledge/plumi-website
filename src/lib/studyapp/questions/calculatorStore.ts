import { useSyncExternalStore } from "react";

/**
 * The calculator in the Questions tab: whether the student has asked for it yet (nothing of it is fetched before they do) and whether it is open. It lives outside the feed and the
 * sheet so the same calculator, with the same number on its display, goes with the student from the feed to a sheet and back; it ends when the Questions tab is left.
 */
export interface CalculatorState { started: boolean; open: boolean }
let state: CalculatorState = { started: false, open: false };
const subs = new Set<() => void>();
const set = (next: CalculatorState) => { if (next.started !== state.started || next.open !== state.open) { state = next; subs.forEach((f) => f()); } };

export const calculatorState = () => state;
export const calculatorStore = {
  /** The first tap starts it (and opens it); after that a tap opens or minimises it. */
  toggle: () => set(state.started ? { started: true, open: !state.open } : { started: true, open: true }),
  minimise: () => set({ ...state, open: false }),
  setOpen: (open: boolean) => set({ started: state.started || open, open }),
  /** For tests, and for leaving the tab. */
  reset: () => set({ started: false, open: false }),
};
export function useCalculatorState(): CalculatorState {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => state);
}
