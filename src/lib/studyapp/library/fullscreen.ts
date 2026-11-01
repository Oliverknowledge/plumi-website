"use client";

/**
 * The browser's own full screen, as a bonus to the page's full-screen layout. A browser lets a page ask only
 * shortly after a tap or click, and not everywhere (iPhone Safari has none), so every call is best effort and a
 * refusal changes nothing: the layout is full screen either way.
 */
export const inBrowserFullscreen = () => typeof document !== "undefined" && document.fullscreenElement !== null;

export function enterBrowserFullscreen(): void {
  try {
    const el = document.documentElement;
    if (!el.requestFullscreen || document.fullscreenElement) return;
    void el.requestFullscreen({ navigationUI: "hide" }).catch(() => { /* not allowed now: fine */ });
  } catch { /* fine */ }
}

/** Only when a tap or click has just happened (the Study tab was pressed); otherwise the browser would refuse anyway. */
export function enterBrowserFullscreenIfJustTapped(): void {
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  if (ua?.isActive) enterBrowserFullscreen();
}

export function exitBrowserFullscreen(): void {
  try { if (document.fullscreenElement) void document.exitFullscreen().catch(() => { /* fine */ }); } catch { /* fine */ }
}
