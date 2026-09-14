"use client";

import { useEffect, useState } from "react";
import { CtaButton } from "@/components/ui/CtaButton";
import { activeCta } from "@/config/site";

/**
 * The phone-only bottom bar.
 *
 * Visible in exactly one band of the page: after the hero's own button has
 * scrolled away, and before the section it points at arrives. Covering the
 * capture form with a button that says "get notified" is the standard mistake
 * in this pattern — on a 390px screen the bar hides a third of the form,
 * including the field being typed in.
 *
 * One IntersectionObserver watches both edges. A scroll listener would do the
 * same job by running arithmetic on every frame of every scroll on the least
 * powerful device we support, which is exactly the device this bar exists for.
 */
export function StickyCta({
  heroSelector = "#product",
  endSelector = "#close",
}: {
  heroSelector?: string;
  endSelector?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.querySelector(heroSelector);
    const end = document.querySelector(endSelector);
    if (!hero && !end) return;

    // A missing element counts as off-screen, so a page without a close section
    // still gets a bar rather than no call to action at all.
    let heroOnScreen = false;
    let endOnScreen = false;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === hero) heroOnScreen = entry.isIntersecting;
          if (entry.target === end) endOnScreen = entry.isIntersecting;
        }
        setVisible(!heroOnScreen && !endOnScreen);
      },
      { threshold: 0 },
    );

    if (hero) observer.observe(hero);
    if (end) observer.observe(end);
    return () => observer.disconnect();
  }, [heroSelector, endSelector]);

  return (
    // Fixed, so showing and hiding it can never reflow the page underneath, and
    // `inert` while hidden so nothing inside can be tabbed to or read out.
    <div className="sticky-cta" data-visible={visible} inert={!visible} data-testid="sticky-cta">
      <p>{activeCta.reassurance}</p>
      <CtaButton placement="sticky_mobile" size="compact" label={activeCta.compact} />
    </div>
  );
}
