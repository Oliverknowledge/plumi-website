"use client";

import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { coverScale, seasonOf, timeOfDay, type Season, type TimeOfDay } from "@/lib/studyapp/library/entry";

/** Small browser hooks for the front door (EntryScreen, Front). None of them sets React state from an effect. */

function media(query: string) {
  return {
    subscribe: (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    get: () => window.matchMedia(query).matches,
  };
}
const REDUCED = typeof window === "undefined" ? null : media("(prefers-reduced-motion: reduce)");

/** The student asked their device for less motion. Server and first paint say no; the browser corrects it. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(REDUCED ? REDUCED.subscribe : () => () => {}, REDUCED ? REDUCED.get : () => false, () => false);
}

/** The student's own hour and month, kept to the minute. Before the browser has answered it is night, the quietest look. */
export function useSky(): { tod: TimeOfDay; season: Season } {
  const key = useSyncExternalStore(
    (cb) => { const t = setInterval(cb, 60_000); return () => clearInterval(t); },
    () => { const d = new Date(); return `${timeOfDay(d.getHours())}|${seasonOf(d.getMonth())}`; },
    () => "night|autumn",
  );
  const [tod, season] = key.split("|") as [TimeOfDay, Season];
  return { tod, season };
}

export function useCoverScale(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => el.style.setProperty("--en-k", String(coverScale(el.clientWidth, el.clientHeight)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}

/**
 * The scene leans a little toward the pointer, the art slowest and the lettering the other way, so the room has
 * depth. Off for reduced motion and for touch (no hover, no fine pointer). Writes `--px` and `--py` (-1 to 1).
 */
export function useParallax(ref: RefObject<HTMLElement | null>, reduced: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const loop = () => {
      raf = 0;
      x += (tx - x) * 0.07; y += (ty - y) * 0.07;
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
      if (Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002) raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); if (raf) cancelAnimationFrame(raf); };
  }, [ref, reduced]);
}

/** The page behind does not scroll while the door is up (the room itself locks `html`; this uses `body`, so the two never undo each other). */
export function useScrollLock() {
  useEffect(() => {
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = was; };
  }, []);
}
