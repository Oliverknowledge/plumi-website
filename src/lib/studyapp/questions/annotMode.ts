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

/** Writing on the question is OFF until it has passed its last review (two first-pen-stroke bugs on iPad-width screens): the layer, its tools and its cue are not shown. `localStorage["plumi-annot-on"] = "1"` turns it on for testing; `plumi-annot-off = "1"` still forces it off. Marks already kept stay kept. */
export const annotOff = (): boolean => { try { if (typeof localStorage === "undefined") return true; return localStorage.getItem("plumi-annot-off") === "1" || localStorage.getItem("plumi-annot-on") !== "1"; } catch { return true; } };

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
