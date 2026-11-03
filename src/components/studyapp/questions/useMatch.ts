"use client";

import { useSyncExternalStore } from "react";

/** A media query as a boolean (false on the server and until the browser answers). */
export function useMatch(query: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
