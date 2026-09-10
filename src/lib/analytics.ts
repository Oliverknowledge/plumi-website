/**
 * The single place the website talks to analytics.
 *
 * Two rules, enforced here rather than remembered at each call site:
 *
 *   1. No email address, ever. `track()` strips anything that looks like one
 *      before the payload leaves this module, so a careless call site cannot
 *      leak a student's address into PostHog.
 *   2. Every event carries the acquisition context, so the website's funnel and
 *      the app's funnel describe one journey rather than two.
 *
 * PostHog is loaded lazily and only if a key is configured. With no key the
 * whole module degrades to no-ops — local development stays quiet and the
 * production bundle never blocks on a third-party script.
 */

import { getAttribution, getSessionTouch, type Attribution } from "./attribution";
import { launchMode } from "@/config/site";

/** Every event the website can emit. Adding one here is the only way to send it. */
export type PlumiEvent =
  | "landing_viewed"
  | "hero_waitlist_clicked"
  | "waitlist_started"
  | "waitlist_completed"
  | "waitlist_failed"
  | "product_demo_interacted"
  | "comparison_viewed"
  | "free_pro_viewed"
  | "story_section_viewed"
  | "faq_opened"
  | "app_store_clicked";

export type EventProperties = Record<string, string | number | boolean | null | undefined>;

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Keys we refuse to forward regardless of their value. */
const FORBIDDEN_KEYS = new Set(["email", "e_mail", "emailaddress", "email_address", "address", "name", "full_name"]);

/**
 * Removes anything that could carry personal data. Runs on every event, so the
 * guarantee holds even for events added later by someone who has not read this
 * comment.
 */
function scrub(properties: EventProperties): EventProperties {
  const clean: EventProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === "string" && EMAIL_PATTERN.test(value)) continue;
    if (value === undefined) continue;
    clean[key] = value;
  }

  return clean;
}

type PostHogLike = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  register: (properties: Record<string, unknown>) => void;
};

let client: PostHogLike | null = null;
let loading: Promise<PostHogLike | null> | null = null;
/** Events fired before PostHog finished loading, replayed once it does. */
const queue: Array<{ event: PlumiEvent; properties: EventProperties }> = [];

function apiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY || undefined;
}

function apiHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(apiKey());
}

/** Attribution flattened into event properties, prefixed to stay legible. */
function attributionProperties(): EventProperties {
  const first: Attribution = getAttribution();
  const session: Attribution = getSessionTouch();

  const props: EventProperties = {
    landing_variant: session.landing_variant ?? first.landing_variant,
    launch_mode: launchMode,
  };

  for (const [key, value] of Object.entries(session)) {
    if (key === "touched_at" || key === "landing_variant") continue;
    if (typeof value === "string") props[key] = value;
  }

  // First touch kept under its own prefix so a returning student's original
  // source is not overwritten by whatever brought them back.
  for (const [key, value] of Object.entries(first)) {
    if (key === "touched_at" || key === "landing_variant") continue;
    if (typeof value === "string") props[`first_${key}`] = value;
  }

  if (first.touched_at) props.first_touched_at = first.touched_at;

  return props;
}

async function load(): Promise<PostHogLike | null> {
  if (client) return client;
  if (loading) return loading;

  const key = apiKey();
  if (!key || typeof window === "undefined") return null;

  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: apiHost(),
        // The website has no accounts. Identifying visitors would create a
        // person profile we have no use for and no consent for.
        person_profiles: "never",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        // Never record what a student types — the only input on the site is an
        // email field.
        disable_session_recording: true,
        persistence: "localStorage+cookie",
      });

      posthog.register({ site: "marketing", launch_mode: launchMode });

      client = posthog as unknown as PostHogLike;

      for (const queued of queue.splice(0)) {
        client.capture(queued.event, queued.properties);
      }

      return client;
    })
    .catch(() => {
      // An ad blocker, or the script failed. Analytics is not worth an error.
      return null;
    });

  return loading;
}

/**
 * Record something a student did. Fire and forget — never awaited by UI code,
 * never able to throw into a click handler.
 */
export function track(event: PlumiEvent, properties: EventProperties = {}): void {
  if (typeof window === "undefined") return;

  const payload = scrub({ ...attributionProperties(), ...properties });

  if (client) {
    client.capture(event, payload);
    return;
  }

  queue.push({ event, properties: payload });
  void load();
}

/** Called once from the app shell. Captures attribution, then the pageview. */
export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  void load();
}

/**
 * Fires an event the first time an element becomes meaningfully visible.
 * Returns a cleanup function. Used for `comparison_viewed`, `free_pro_viewed`
 * and the story sections, which are impressions rather than clicks.
 */
export function trackOnceWhenVisible(
  element: Element | null,
  event: PlumiEvent,
  properties: EventProperties = {},
): () => void {
  if (!element || typeof IntersectionObserver === "undefined") return () => {};

  let fired = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || fired) continue;
        fired = true;
        track(event, properties);
        observer.disconnect();
      }
    },
    { threshold: 0.4 },
  );

  observer.observe(element);
  return () => observer.disconnect();
}
