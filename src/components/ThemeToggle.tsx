"use client";

import { useEffect, useState } from "react";
import { THEME_KEY } from "@/lib/theme";

/**
 * Light or dark, one tap, kept on the device. The first visit follows the device's own setting (the script in layout.tsx sets
 * `data-theme` on <html> before the page paints, so there is no flash); a tap on this switch is the visitor's choice and wins from
 * then on. The palette itself is `html[data-theme="dark"]` in dark.css.
 *
 * A sun slides to a moon along a small pill. Where the browser has View Transitions, the new theme grows as a circle from the
 * switch itself; elsewhere the colours cross-fade. A visitor who asked for reduced motion gets neither.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark"); }, []);

  const flip = (event: React.MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const next = dark ? "light" : "dark";
    const apply = () => {
      root.dataset.theme = next;
      setDark(next === "dark");
      try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: the choice lasts until the tab closes */ }
    };
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const withTransition = (document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } }).startViewTransition;
    if (still) { apply(); return; }
    if (withTransition) {
      const box = event.currentTarget.getBoundingClientRect();
      const x = box.left + box.width / 2, y = box.top + box.height / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const transition = withTransition.call(document, apply);
      transition.ready.then(() => {
        root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 600, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" });
      }).catch(() => {});
      return;
    }
    root.classList.add("lp-theme-fading");
    apply();
    setTimeout(() => root.classList.remove("lp-theme-fading"), 450);
  };

  return (
    <button type="button" role="switch" aria-checked={dark} className="lp-themeswitch" onClick={flip} aria-label="Dark mode" title={dark ? "Switch to light" : "Switch to dark"} data-testid="theme-toggle">
      <span className="lp-ts-stars" aria-hidden="true"><i /><i /><i /></span>
      <span className="lp-ts-thumb" aria-hidden="true">
        <svg className="lp-ts-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" /><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" /></svg>
        <svg className="lp-ts-moon" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a.7.7 0 0 0-1-.8A9.8 9.8 0 1 0 21.3 15.6a.7.7 0 0 0-.8-1Z" /></svg>
      </span>
    </button>
  );
}
