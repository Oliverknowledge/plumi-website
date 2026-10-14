"use client";
import { useEffect } from "react";

/**
 * Every bit of motion on the homepage, driven from one observer pass.
 *
 *   [data-reveal]      fades and rises once, the first time it is a third into view
 *   [data-lit]         a line of the "sound familiar?" passage that lights when it
 *                      crosses the middle of the screen, and dims again after
 *   [data-step]        a step of the pinned story: the one at the middle of the screen
 *                      sets `data-active` on its [data-story] root, which crossfades
 *                      the screen in the pinned iPad
 *   [data-count]       a number that counts from data-from to data-count, once
 *   [data-nav="dark"]  a dark band: while one is under the nav, the nav goes dark too
 *
 * Only opacity and transform are animated (in CSS). Nothing hijacks the scroll, and
 * with prefers-reduced-motion everything is shown at once (the CSS does the rest).
 */
export function HomeMotion() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("motion-ready");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const counts = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    if (reduced) {
      reveals.forEach(el => el.classList.add("is-in"));
      counts.forEach(el => { el.textContent = el.dataset.count ?? el.textContent; });
    }

    const observers: IntersectionObserver[] = [];

    if (!reduced) {
      const reveal = new IntersectionObserver(entries => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); reveal.unobserve(e.target); }
      }, { rootMargin: "0px 0px -4% 0px", threshold: 0.08 });
      reveals.forEach(el => reveal.observe(el));
      observers.push(reveal);

      const counter = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          counter.unobserve(e.target);
          const el = e.target as HTMLElement;
          const from = Number(el.dataset.from ?? 0), to = Number(el.dataset.count ?? 0);
          const start = performance.now(), duration = 900;
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = String(Math.round(from + (to - from) * eased));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      }, { threshold: 0.6 });
      counts.forEach(el => counter.observe(el));
      observers.push(counter);
    }

    const lit = new IntersectionObserver(entries => {
      for (const e of entries) e.target.classList.toggle("is-lit", e.isIntersecting);
    }, { rootMargin: "-38% 0px -38% 0px" });
    document.querySelectorAll("[data-lit]").forEach(el => lit.observe(el));
    observers.push(lit);

    const step = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.closest<HTMLElement>("[data-story]")?.setAttribute("data-active", el.dataset.step ?? "");
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    document.querySelectorAll("[data-step]").forEach(el => step.observe(el));
    observers.push(step);

    // The nav turns dark while a dark band sits under it.
    const nav = document.querySelector<HTMLElement>(".hp-nav");
    if (nav) {
      const under = new Set<Element>();
      const dark = new IntersectionObserver(entries => {
        for (const e of entries) { if (e.isIntersecting) under.add(e.target); else under.delete(e.target); }
        nav.classList.toggle("is-dark", under.size > 0);
      }, { rootMargin: "0px 0px -94% 0px" });
      document.querySelectorAll("[data-nav='dark']").forEach(el => dark.observe(el));
      observers.push(dark);
    }

    return () => observers.forEach(o => o.disconnect());
  }, []);
  return null;
}
