"use client";

import { useEffect } from "react";

import { initAnalytics, isAnalyticsConfigured } from "@/lib/analytics";
import { captureAttribution } from "@/lib/attribution";

/**
 * Turns the lights on. Renders nothing.
 *
 * ── Why this used to return null ─────────────────────────────────────────────
 * Tracking was switched off pending "an appropriate privacy/consent flow", which
 * was a reasonable thing to do and an unreasonable thing to leave: with no
 * measurement at all there is no way to tell whether any of this page works.
 *
 * ── Why no cookie banner ─────────────────────────────────────────────────────
 * The consent question is about what is collected, not about whether a dialog
 * appeared. What this site collects is: a coarse device class, a referrer class,
 * a section id, and which button was pressed. `lib/analytics.ts` runs a `scrub()`
 * pass that drops anything email-shaped before a payload can leave the module,
 * `person_profiles: "never"` means no profile is ever created, `autocapture` is
 * off so no keystroke or field value is read, session recording is disabled
 * outright, and the host is in the EU. Nothing a student writes, nothing a
 * student is called, and nothing that identifies a device leaves the page.
 *
 * With no `NEXT_PUBLIC_POSTHOG_KEY` configured every call in that module is a
 * no-op and `posthog-js` is never imported, so local development and previews
 * stay silent and the bundle never pays for the script.
 */
export function AnalyticsProvider() {
  useEffect(() => {
    // Attribution is stored whether or not analytics is configured: it is how a
    // launch-day install is joined back to the ad that caused it, and losing it
    // for a week because a key was missing is not recoverable later.
    captureAttribution();
    if (!isAnalyticsConfigured()) return;
    initAnalytics();
  }, []);

  return null;
}
