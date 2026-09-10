"use client";

import { useEffect, useState } from "react";

import { CtaButton } from "@/components/ui/CtaButton";
import { activeCta } from "@/config/site";

/**
 * The phone-only bottom bar.
 *
 * It is visible in exactly one band of the page: after the hero's own button
 * has scrolled away, and before the form it points at comes into view. Covering
 * the waitlist with a button that says "join the waitlist" is the single most
 * common mistake in this pattern — on a 390px screen the bar hides a third of
 * the form, including the field the student is typing in.
 *
 * One IntersectionObserver watches both edges. A scroll listener would do the
 * same job by running arithmetic on every frame of every scroll on the least
 * powerful device we support.
 */

interface StickyCtaProps {
  /** The element whose leaving the viewport reveals the bar. */
  heroSelector?: string;
  /** The element whose arriving hides it again. */
  waitlistSelector?: string;
}

export function StickyCta({
  heroSelector = "#main section",
  waitlistSelector = "#waitlist",
}: StickyCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.querySelector(heroSelector);
    const waitlist = document.querySelector(waitlistSelector);
    if (!hero && !waitlist) return;

    // A missing element counts as off-screen, so a page without a waitlist
    // section still gets a bar rather than no call to action at all.
    let heroOnScreen = false;
    let waitlistOnScreen = false;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === hero) heroOnScreen = entry.isIntersecting;
          if (entry.target === waitlist) waitlistOnScreen = entry.isIntersecting;
        }
        setVisible(!heroOnScreen && !waitlistOnScreen);
      },
      { threshold: 0 },
    );

    if (hero) observer.observe(hero);
    if (waitlist) observer.observe(waitlist);

    return () => observer.disconnect();
  }, [heroSelector, waitlistSelector]);

  return (
    <div
      // Fixed, so showing and hiding it can never reflow the page underneath.
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-hairline)] bg-[color-mix(in_srgb,var(--color-paper)_92%,transparent)] backdrop-blur-md transition-transform duration-300 ease-[var(--ease-out-soft)] sm:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      // Off-screen but still in the layer, so nothing inside it may be tabbed
      // to or read out while it is hidden.
      inert={!visible}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="container-plumi flex items-center gap-4 pt-3">
        <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-[var(--color-ink-secondary)] text-pretty">
          {activeCta.reassurance}
        </p>
        <CtaButton placement="sticky_mobile" size="compact" label={activeCta.compact} />
      </div>
    </div>
  );
}
