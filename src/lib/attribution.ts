/**
 * Acquisition context: where a student came from, captured once and kept.
 *
 * First touch wins. A student who arrives from a TikTok ad, leaves, and comes
 * back a week later via Google should still be attributed to TikTok — otherwise
 * the last thing they clicked takes credit for the thing that actually worked.
 * `last` is recorded separately so the difference stays visible.
 *
 * None of this is personal data: no email, no name, no identifiers we invent.
 * It is the query string the student's own click already carried.
 */

const FIRST_TOUCH_KEY = "plumi.attribution.first";
const SESSION_TOUCH_KEY = "plumi.attribution.session";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** Which copy variant the student saw, for landing experiments. */
  landing_variant?: string;
  /** Document referrer, host only — we deliberately drop the path. */
  referrer_host?: string;
  /** ISO timestamp of the touch. */
  touched_at?: string;
  /** Click identifiers some ad platforms append. Useful, non-personal. */
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
}

/** The landing variant in play. Read from ?v= or defaults to "default". */
export const DEFAULT_LANDING_VARIANT = "default";

function safeParse(raw: string | null): Attribution | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Attribution) : null;
  } catch {
    return null;
  }
}

/** Strip a referrer down to its host so we never store a full external URL. */
function referrerHost(): string | undefined {
  if (typeof document === "undefined" || !document.referrer) return undefined;
  try {
    const url = new URL(document.referrer);
    if (url.host === window.location.host) return undefined;
    return url.host;
  } catch {
    return undefined;
  }
}

/** Read the acquisition parameters present on the current URL. */
export function readCurrentTouch(): Attribution {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const touch: Attribution = {
    touched_at: new Date().toISOString(),
  };

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) touch[key] = value.slice(0, 120);
  }

  for (const key of ["gclid", "fbclid", "ttclid"] as const) {
    const value = params.get(key);
    if (value) touch[key] = value.slice(0, 200);
  }

  // The variant normally comes from the path — `/v/mirror` — because the
  // alternate landings are prerendered routes rather than a query string on a
  // dynamic homepage. `?v=` is still honoured so a link written by hand, or an
  // ad platform that appends rather than rewrites, still lands correctly.
  const fromPath = /^\/v\/([a-z0-9-]{1,40})\/?$/i.exec(window.location.pathname)?.[1];
  const fromQuery = params.get("v") ?? params.get("landing_variant");
  touch.landing_variant = (fromPath ?? fromQuery ?? DEFAULT_LANDING_VARIANT).slice(0, 60);

  const host = referrerHost();
  if (host) touch.referrer_host = host;

  return touch;
}

/**
 * Records this visit and returns the first-touch context. Safe to call more
 * than once; only the first call in a browser's history writes the first touch.
 */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};

  const current = readCurrentTouch();

  try {
    window.sessionStorage.setItem(SESSION_TOUCH_KEY, JSON.stringify(current));

    const existing = safeParse(window.localStorage.getItem(FIRST_TOUCH_KEY));
    if (existing) return existing;

    window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(current));
  } catch {
    // Private browsing, or storage disabled. Attribution is nice to have, not
    // load bearing — carry on with whatever this pageview knows.
  }

  return current;
}

/** First touch if we have one, otherwise this visit. Never throws. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    return safeParse(window.localStorage.getItem(FIRST_TOUCH_KEY)) ?? readCurrentTouch();
  } catch {
    return readCurrentTouch();
  }
}

/** This visit's parameters, whether or not they were the first. */
export function getSessionTouch(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    return safeParse(window.sessionStorage.getItem(SESSION_TOUCH_KEY)) ?? readCurrentTouch();
  } catch {
    return readCurrentTouch();
  }
}

export function getLandingVariant(): string {
  return getSessionTouch().landing_variant ?? DEFAULT_LANDING_VARIANT;
}
