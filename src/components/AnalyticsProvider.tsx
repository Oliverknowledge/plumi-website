"use client";

import { useEffect } from "react";

import { captureAttribution } from "@/lib/attribution";
import { initAnalytics, track } from "@/lib/analytics";

/**
 * Runs once, at the top of the tree.
 *
 * Order matters: attribution is captured before the first event is sent, so
 * `landing_viewed` already carries the utm parameters that brought the student
 * here rather than arriving blank and being corrected later.
 *
 * Renders nothing.
 */
export function AnalyticsProvider() {
  useEffect(() => {
    captureAttribution();
    initAnalytics();
    track("landing_viewed");
  }, []);

  return null;
}
