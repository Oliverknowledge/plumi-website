"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether it is safe to animate yet.
 *
 * Two things have to be true: the visitor has not asked their system to reduce
 * motion, and we are past hydration.
 *
 * The second half is the subtle one. A preference read during the first render
 * differs between the server (which has none) and the client (which does), so
 * anything branching on it renders differently on the two sides — React warns
 * about the mismatch and then leaves the disagreeing attribute at the server's
 * value, unpatched. `useSyncExternalStore` is the supported way to express
 * "this value differs between server and client": React uses the server
 * snapshot for the hydrating render and re-renders with the client one.
 *
 * Returns `false` under reduced motion, so callers render the resolved state
 * directly rather than animating toward it. Every scene on this site has one.
 */
export function useMotionReady(): boolean {
  return useSyncExternalStore(subscribe, allowsMotion, () => false);
}

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};

  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function allowsMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return !window.matchMedia(QUERY).matches;
}
