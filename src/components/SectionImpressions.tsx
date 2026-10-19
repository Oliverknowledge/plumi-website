"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Records how far down the page a visitor actually got.
 *
 * Scroll depth is the metric that keeps conversion honest: a page that converts
 * but is never read past the third chapter has bought a dead list, and only
 * this event can tell the two apart. On a page built as five arcs, the arc a
 * visitor stopped in is the more useful unit than the section, so both go on
 * the event and the arc is the one to group by.
 *
 * One component and one observer for the whole page rather than a wrapper round
 * each section: wrapping ten Server Components in a client boundary would push
 * all of their rendered markup into the RSC flight payload as `children`, which
 * is the duplication that made the handwriting cost twice what it should. This
 * reaches for the sections by id instead and renders nothing.
 */
const ARCS: Record<string, string> = {
  product: "0-hero",
  // The cosy homepage (19 October 2026).
  meet: "1-reads-you",
  marking: "1-reads-you",
  friends: "3-remembers",
  habit: "3-remembers",
  more: "4-replaces-stack",
  subjects: "4-replaces-stack",
  pricing: "5-the-deal",
  "on-page": "1-reads-you",
  "the-mark": "1-reads-you",
  trust: "2-trust-it",
  "what-counts": "2-trust-it",
  "learner-model": "3-remembers",
  practice: "3-remembers",
  "exam-mode": "3-remembers",
  notebook: "4-replaces-stack",
  diagrams: "4-replaces-stack",
  "your-course": "4-replaces-stack",
  compare: "5-the-deal",
  "free-and-pro": "5-the-deal",
  faq: "5-the-deal",
  close: "5-the-deal",
};

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
          track("story_section_viewed", { section: id, arc: ARCS[id] ?? "unmapped" });
        }
      },
      // "Did this section cross the middle of the screen?" rather than "was N%
      // of it visible" — a percentage threshold is unreachable for the tall
      // sticky scenes, which would then never report and read as nobody having
      // got past the mark. The middle band is height-independent and it is also
      // a better definition of read.
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return null;
}
