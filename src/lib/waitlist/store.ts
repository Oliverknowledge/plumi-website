import "server-only";

import type { Attribution } from "@/lib/attribution";

/**
 * Where waitlist signups go.
 *
 * The site never pretends. If Supabase is not configured, `save` returns
 * `unconfigured` and the form shows a real error — a student is never told they
 * are on a list they are not on.
 *
 * Swapping Supabase for something else means writing one more `WaitlistStore`
 * and returning it from `getWaitlistStore()`. Nothing else changes.
 */

export interface WaitlistSignup {
  email: string;
  attribution: Attribution;
  /**
   * What the student says they study. Optional, and allow-listed by the route
   * against `waitlist.subjects` / `waitlist.boards` before it gets here — these
   * are never arbitrary strings from a POST body.
   */
  subject?: string;
  board?: string;
  /** Which app the student is waiting for. Absent is the iPad waitlist, which is what the rows were before. */
  platform?: "android";
  /** Set by the route from request headers, not by the browser. */
  userAgent?: string;
  /** Coarse country from the edge, if the host provides it. Never an IP. */
  country?: string;
}

export type WaitlistResult =
  | { status: "created" }
  /** Already on the list. Treated as success by the UI — re-signing up is not an error a student should have to think about. */
  | { status: "already_joined" }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

export interface WaitlistStore {
  readonly name: string;
  save(signup: WaitlistSignup): Promise<WaitlistResult>;
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
/**
 * The service role key, not the anon key. Inserts happen server-side only, so
 * the table can deny all client access and the key never reaches the browser.
 * It must NOT be prefixed NEXT_PUBLIC_.
 */
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLE = process.env.SUPABASE_WAITLIST_TABLE ?? "waitlist_signups";

/**
 * The project's PUBLIC key. With it the site needs no secret at all: it calls the one function
 * `join_waitlist` (supabase/migrations/0002_join_waitlist.sql), which can add a row and nothing else.
 * Used when there is no service role key.
 */
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Talks to PostgREST directly rather than pulling in @supabase/supabase-js.
 * One insert is not worth 40 kB of client library on a serverless cold start.
 */
class SupabaseWaitlistStore implements WaitlistStore {
  readonly name = "supabase";

  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
  ) {}

  async save(signup: WaitlistSignup): Promise<WaitlistResult> {
    const endpoint = `${this.url.replace(/\/$/, "")}/rest/v1/${TABLE}`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          // Do not echo the row back; we do not need it and it keeps the
          // response small.
          Prefer: "return=minimal",
        },
        body: JSON.stringify([
          {
            email: signup.email,
            utm_source: signup.attribution.utm_source ?? null,
            utm_medium: signup.attribution.utm_medium ?? null,
            utm_campaign: signup.attribution.utm_campaign ?? null,
            utm_content: signup.attribution.utm_content ?? null,
            utm_term: signup.attribution.utm_term ?? null,
            landing_variant: signup.attribution.landing_variant ?? null,
            referrer_host: signup.attribution.referrer_host ?? null,
            gclid: signup.attribution.gclid ?? null,
            fbclid: signup.attribution.fbclid ?? null,
            ttclid: signup.attribution.ttclid ?? null,
            user_agent: signup.userAgent ?? null,
            country: signup.country ?? null,
            subject: signup.subject ?? null,
            board: signup.board ?? null,
            // `android` rows are the Android waitlist; everything else is the website's iPad waitlist.
            source: signup.platform === "android" ? "android" : "website",
          },
        ]),
        cache: "no-store",
      });
    } catch (cause) {
      return {
        status: "error",
        message: cause instanceof Error ? cause.message : "Network error reaching Supabase",
      };
    }

    if (response.ok) return { status: "created" };

    // 23505 is Postgres' unique_violation: this email is already on the list.
    if (response.status === 409) return { status: "already_joined" };

    const body = await response.text().catch(() => "");
    if (body.includes("23505")) return { status: "already_joined" };

    return {
      status: "error",
      message: `Supabase responded ${response.status}: ${body.slice(0, 200)}`,
    };
  }
}

/** Joins through `join_waitlist`, with the public key. Cannot read the list; says whether the email was new. */
class SupabaseRpcWaitlistStore implements WaitlistStore {
  readonly name = "supabase-rpc";

  constructor(
    private readonly url: string,
    private readonly publishableKey: string,
  ) {}

  async save(signup: WaitlistSignup): Promise<WaitlistResult> {
    const endpoint = `${this.url.replace(/\/$/, "")}/rest/v1/rpc/join_waitlist`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.publishableKey },
        body: JSON.stringify({
          p_email: signup.email,
          p_source: signup.platform === "android" ? "android" : "website",
          p_subject: signup.subject ?? null,
          p_board: signup.board ?? null,
          p_utm_source: signup.attribution.utm_source ?? null,
          p_utm_medium: signup.attribution.utm_medium ?? null,
          p_utm_campaign: signup.attribution.utm_campaign ?? null,
          p_utm_content: signup.attribution.utm_content ?? null,
          p_utm_term: signup.attribution.utm_term ?? null,
          p_landing_variant: signup.attribution.landing_variant ?? null,
          p_referrer_host: signup.attribution.referrer_host ?? null,
          p_gclid: signup.attribution.gclid ?? null,
          p_fbclid: signup.attribution.fbclid ?? null,
          p_ttclid: signup.attribution.ttclid ?? null,
          p_user_agent: signup.userAgent ?? null,
          p_country: signup.country ?? null,
        }),
        cache: "no-store",
      });
    } catch (cause) {
      return { status: "error", message: cause instanceof Error ? cause.message : "Network error reaching Supabase" };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { status: "error", message: `Supabase responded ${response.status}: ${body.slice(0, 200)}` };
    }
    const added = (await response.json().catch(() => null)) as unknown;
    return { status: added === false ? "already_joined" : "created" };
  }
}

/** Used when no backend is configured. Refuses rather than silently succeeding. */
class UnconfiguredWaitlistStore implements WaitlistStore {
  readonly name = "unconfigured";

  async save(): Promise<WaitlistResult> {
    return { status: "unconfigured" };
  }
}

let cached: WaitlistStore | null = null;

export function getWaitlistStore(): WaitlistStore {
  if (cached) return cached;

  cached =
    SUPABASE_URL && SUPABASE_SERVICE_KEY
      ? new SupabaseWaitlistStore(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      : SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
        ? new SupabaseRpcWaitlistStore(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
        : new UnconfiguredWaitlistStore();

  return cached;
}

export function isWaitlistConfigured(): boolean {
  return Boolean(SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_PUBLISHABLE_KEY));
}
