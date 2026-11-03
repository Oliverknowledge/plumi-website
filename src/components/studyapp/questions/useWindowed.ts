"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Draw an item of a long list only while it is near the screen (the "mount window"). Used by the practice sheet's parts and meant for any long
 * list of questions with writing spaces (the question feed): a part with its picture, answer space, mark scheme bar and observers is hundreds of
 * nodes, and 70 of them at once is a two second stall on a phone.
 *
 * - One shared IntersectionObserver for every item, `NEAR_PX` of margin above and below the screen.
 * - Entering: drawn at once. Leaving: waits `LEAVE_MS` (a scroll that bounces back does not redraw), and never leaves while something in the item has
 *   focus (the student is typing or pressing in it) or while it was opened by hand (`pin`, for a screen reader on the placeholder).
 * - A placeholder takes the height the item had when it last left the screen (kept as a multiple of its width, so a rotated or resized screen still
 *   fits), or, for an item never drawn, `expect(width)` plus `overhead`, the extra height measured on the items that have been drawn.
 * Keep the item's own element (id, aria-label) outside the window so links, skip links and "go to" still find it.
 */
export const NEAR_PX = 1600;
export const LEAVE_MS = 1200;

const watchers = new Map<Element, (near: boolean) => void>();
let watcher: IntersectionObserver | null = null;
function watchNear(el: Element, cb: (near: boolean) => void): () => void {
  if (typeof IntersectionObserver === "undefined") { cb(true); return () => undefined; }
  watcher ??= new IntersectionObserver((es) => { for (const e of es) watchers.get(e.target)?.(e.isIntersecting); }, { rootMargin: `${NEAR_PX}px 0px` });
  watchers.set(el, cb);
  watcher.observe(el);
  return () => { watchers.delete(el); watcher?.unobserve(el); };
}

/** The height of an item as a multiple of its width, as last seen. */
const seenRatio = new Map<string, number>();
/** What a drawn item adds to what `expect` says (margins, bars): learned from the items that have been drawn. */
let overhead = 150;

export interface Windowed {
  /** Put on the item's own (always present) wrapper. */
  ref: React.RefObject<HTMLDivElement | null>;
  /** Draw the item's content now. */
  near: boolean;
  /** Draw it and keep it drawn (a screen reader asked for it). */
  pin(): void;
  /** For the placeholder: its height as a multiple of the width if the item has been seen, else null (then use `expect(width)` boxes and `overhead`). */
  ratio: number | null;
  overhead: number;
}

/** `expect(width)` is the height in px the item's known parts will have at that width (a picture's aspect plus an answer space); read when the item leaves. */
export function useWindowed(id: string, startNear: boolean, expect: (width: number) => number): Windowed {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(startNear);
  const pinned = useRef(false);
  const exp = useRef(expect);
  useEffect(() => { exp.current = expect; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = watchNear(el, (on) => {
      clearTimeout(timer);
      if (on) { setNear(true); return; }
      timer = setTimeout(() => {
        if (pinned.current || el.contains(document.activeElement)) return;
        const w = el.offsetWidth, h = el.offsetHeight;
        if (w >= 50 && h >= 20) {
          seenRatio.set(id, h / w);
          const extra = h - exp.current(w);
          if (extra > 20 && extra < 500) overhead = Math.round(overhead * 0.7 + extra * 0.3);
        }
        setNear(false);
      }, LEAVE_MS);
    });
    return () => { clearTimeout(timer); off(); };
  }, [id]);
  return { ref, near, pin: () => { pinned.current = true; setNear(true); }, ratio: seenRatio.get(id) ?? null, overhead };
}
