"use client";

import { useSyncExternalStore } from "react";

/**
 * "Write on the question" for the MOUSE: off, the picture behaves as it always did (a click opens it large); on, the mouse draws on it. A pen always draws and a finger scrolls
 * (or draws with "Draw with my finger"), so this is only a choice for a mouse. One switch for the whole page, kept on this device.
 */
const KEY = "plumi-annot-mouse";
let on = false;
try { on = typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1"; } catch { on = false; }
const subs = new Set<() => void>();
export function setAnnotMouse(v: boolean) {
  if (v === on) return;
  on = v;
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* kept for this visit only */ }
  subs.forEach((s) => s());
}
export const annotMouseNow = () => on;
export function useAnnotMouse(): boolean {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => on, () => false);
}

// Opening the page with ?annot=0 turns it off for this device, ?annot=1 turns it back on.
try {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("annot");
    if (q === "0") localStorage.setItem("plumi-annot-off", "1");
    else if (q === "1") localStorage.removeItem("plumi-annot-off");
  }
} catch { /* storage blocked: stays as it is */ }

/** Writing on the question is ON for everyone. `localStorage["plumi-annot-off"] = "1"` (or opening the page with ?annot=0) turns it off for one device. Marks already kept stay kept. */
export const annotOff = (): boolean => { try { return typeof localStorage !== "undefined" && localStorage.getItem("plumi-annot-off") === "1"; } catch { return false; } };

/** The one-line cue for pen users ("write on the question with your pencil") is shown until the first mark is made on any question; remembered on this device. */
const CUE = "plumi-annot-cue";
let cueSeen = false;
try { cueSeen = typeof localStorage !== "undefined" && localStorage.getItem(CUE) === "1"; } catch { cueSeen = false; }
const cueSubs = new Set<() => void>();
export function setAnnotCueSeen() {
  if (cueSeen) return;
  cueSeen = true;
  try { localStorage.setItem(CUE, "1"); } catch { /* shown again next visit */ }
  cueSubs.forEach((s) => s());
}
export function useAnnotCueSeen(): boolean {
  return useSyncExternalStore((cb) => { cueSubs.add(cb); return () => { cueSubs.delete(cb); }; }, () => cueSeen, () => true);
}
