"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics";

/**
 * Records how far down the page a visitor actually got.
 *
 * Scroll depth is the secondary metric that keeps the primary one honest: a
 * landing variant that converts but is never read past the third section has
 * bought a dead list, and only this event can tell the two apart.
 *
 * One component and one observer for the whole page, rather than a wrapper
 * around each section. Wrapping ten Server Components in a client boundary
 * would push all of their rendered markup into the RSC flight payload as
 * `children` props — which is the same duplication that made the handwriting
 * cost twice what it should. This reaches for the sections by id instead and
 * renders nothing.
 */
export function SectionImpressions() {
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("main section[id]");
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;

    const seen = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (!entry.isIntersecting || seen.has(id)) continue;
          seen.add(id);
          observer.unobserve(entry.target);
          track("story_section_viewed", { section: id });
        }
      },
      // Half a section on screen, so a fast scroll past does not count as a
      // read. This is meant to measure attention, not velocity.
      { threshold: 0.5 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return null;
}
