"use client";

import { useSyncExternalStore } from "react";

/** One list per query for the whole page: reading it is a property, where a fresh `matchMedia` call on every render of every writing space is not. */
const lists = new Map<string, MediaQueryList>();
const list = (query: string): MediaQueryList => {
  let m = lists.get(query);
  if (!m) { m = window.matchMedia(query); lists.set(query, m); }
  return m;
};

/** A media query as a boolean (false on the server and until the browser answers). */
export function useMatch(query: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = list(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => list(query).matches,
    () => false,
  );
}
