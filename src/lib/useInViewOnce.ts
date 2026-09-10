"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True once the element has been meaningfully on screen, and true forever
 * after. A section that re-animates every time it scrolls past is a section
 * that is showing off.
 *
 * Returns `false` on the server and through hydration so that server and client
 * agree, then flips on the first intersection. Where a visitor has asked for
 * reduced motion the caller should not use this at all — it should render the
 * resolved state directly.
 *
 * This exists so the site does not carry an animation library for three
 * effects. Everything it triggers is a CSS transition or a CSS keyframe, which
 * runs on the compositor and costs nothing on the main thread.
 */
export function useInViewOnce<T extends Element>(
  ref: RefObject<T | null>,
  { amount = 0.35, rootMargin = "0px 0px -10% 0px" }: { amount?: number; rootMargin?: string } = {},
): boolean {
  const [seen, setSeen] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || done.current) return;

    // No IntersectionObserver means a browser old enough that it should simply
    // be given the content, rather than an empty box waiting for an event that
    // will never fire. Scheduled rather than set inline: a state update in the
    // body of an effect is a second render before paint, and React 19's
    // compiler is right to object to it.
    if (typeof IntersectionObserver === "undefined") {
      done.current = true;
      const frame = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          done.current = true;
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: amount, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, amount, rootMargin]);

  return seen;
}
