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
  /** Every button and text link that asks for something. Carries `placement`. */
  | "cta_clicked"
  /** Fired alongside `cta_clicked` when the destination is Discord, so the
   *  Discord funnel can be read without parsing destinations. */
  | "discord_clicked"
  | "launch_notify_started"
  | "launch_notify_completed"
  | "launch_notify_failed"
  | "product_demo_interacted"
  | "story_section_viewed"
  | "trust_viewed"
  | "comparison_viewed"
  | "pricing_viewed"
  | "faq_opened"
  | "app_store_clicked"
  /** A question paper, mark scheme or examiner report opened from /past-papers.
   *  Carries `page`, `paper`, `kind` and `session`. */
  | "paper_opened"
  /** The question bank: filters settled on (`results`), a mark scheme or report
   *  opened (`kind`), a question added to a set (`size`), a set downloaded. */
  | "bank_filtered"
  | "bank_reveal"
  | "bank_set_added"
  | "bank_pdf_downloaded"
  /** The partner embed (/embed/question-bank): shown (`embed_view`) and a link
   *  out to Plumi pressed (`embed_cta_click`). Both carry `partner`, `subject`, `topic`. */
  | "embed_view"
  | "embed_cta_click"
  /** A Plumi practice pack's questions or mark scheme opened. Carries `pack`,
   *  `file` (questions or mark-scheme) and `placement`. */
  | "pack_downloaded"
  /** How "Send it to my iPad" ended: `outcome` is sent, emailed or dismissed.
   *  The first two are also the Google Ads `sendToIpad` conversion. */
  | "send_to_ipad_result";

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

/**
 * Set by the partner embed. A third-party iframe must not write cookies or
 * storage on the partner's visitors, and has no first-touch attribution to read,
 * so in embed mode PostHog keeps its state in memory, sends no page-leave event,
 * and every event carries these properties (partner, subject, topic) instead of
 * the site's attribution. Never set on the site itself.
 */
let embedContext: EventProperties | null = null;
export function enterEmbedMode(context: EventProperties): void {
  embedContext = context;
}

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
        capture_pageleave: !embedContext,
        autocapture: false,
        // Never record what a student types — the only input on the site is an
        // email field.
        disable_session_recording: true,
        persistence: embedContext ? "memory" : "localStorage+cookie",
      });

      posthog.register({ site: embedContext ? "embed" : "marketing", launch_mode: launchMode });

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
  if (typeof window === "undefined" || !apiKey()) return;

  const payload = scrub(embedContext ? { ...embedContext, ...properties } : { ...attributionProperties(), ...properties });

  if (client) {
    client.capture(event, payload);
    return;
  }

  queue.push({ event, properties: payload });
  void load();
}

/**
 * Called once from the app shell. Records the attribution touch, then the one
 * pageview this site sends.
 *
 * `capture_pageview` is off in `init` because the denominator needs the
 * variant, the launch mode and a device class on it, and PostHog's automatic
 * pageview carries none of them. There is exactly one landing per visit, so
 * there is exactly one of these.
 */
let initialised = false;
export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  // React's StrictMode runs mount effects twice in development, and a double
  // `landing_viewed` halves every conversion rate on the chart that matters.
  // Guarded at the module rather than at the call site so a second mount point
  // added later cannot reintroduce it.
  if (initialised) return;
  initialised = true;
  void load();
  track("landing_viewed", {
    device_class: deviceClass(),
    referrer_class: referrerClass(),
    path: window.location.pathname,
  });
}

/**
 * Which of the three layouts this visitor is actually getting.
 *
 * Bucketed rather than reported as a width, because the only question worth
 * answering is "is the iPad tier converting", and a histogram of pixel widths
 * cannot be read at this traffic volume. The boundaries are the CSS ones.
 */
function deviceClass(): "mobile" | "tablet" | "desktop" {
  const width = window.innerWidth;
  if (width <= 700) return "mobile";
  if (width <= 1180) return "tablet";
  return "desktop";
}

/** Coarse, and deliberately not the referring URL — that is a fingerprint. */
function referrerClass(): "direct" | "search" | "social" | "other" {
  const referrer = document.referrer;
  if (!referrer) return "direct";
  let host = "";
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "other";
  }
  if (host === window.location.hostname) return "direct";
  if (/^(google|bing|duckduckgo|ecosia|yahoo|search\.brave)\./.test(host)) return "search";
  if (/^(t\.co|x\.com|twitter|reddit|youtube|tiktok|instagram|facebook|discord|linkedin)\./.test(host)) {
    return "social";
  }
  return "other";
}

/**
 * Fires an event the first time an element becomes meaningfully visible.
 * Returns a cleanup function. Used for `trust_viewed`, `comparison_viewed` and
 * `pricing_viewed`, which are impressions rather than clicks.
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
