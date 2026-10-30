"use client";

import { useEffect, useState } from "react";
import { THEME_KEY as KEY } from "@/lib/theme";

/**
 * Light or dark, one tap, kept on the device. The first visit follows the device's own setting (the script in
 * layout.tsx sets `data-theme` on <html> before the page paints, so there is no flash); a tap on this button is the
 * visitor's choice and wins from then on. The palette itself is `html[data-theme="dark"]` in cosy.css.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark"); }, []);
  const flip = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode: the choice lasts until the tab closes */ }
    setDark(!dark);
  };
  return (
    <button type="button" className="lp-btn lp-themebtn" onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"} data-testid="theme-toggle">
      {dark ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor" /><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" /></svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a.7.7 0 0 0-1-.8A9.8 9.8 0 1 0 21.3 15.6a.7.7 0 0 0-.8-1Z" /></svg>
      )}
    </button>
  );
}
