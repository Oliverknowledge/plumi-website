import { NextResponse } from "next/server";

import { getWaitlistStore, type WaitlistSignup } from "@/lib/waitlist/store";
import type { Attribution } from "@/lib/attribution";
import { waitlist } from "@/content/copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deliberately permissive. The job here is to reject obvious typos and junk,
 * not to adjudicate RFC 5322 — an over-strict pattern turning away a real
 * student's address costs far more than an invalid row costs us.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const MAX_EMAIL_LENGTH = 254;

/**
 * In-memory rate limit. Enough to stop a bored student holding down Enter;
 * not a defence against a determined attacker, which is what Supabase's unique
 * constraint and the host's own DDoS protection are for. Serverless instances
 * do not share this map, and that is fine for the threat it addresses.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic sweep so the map cannot grow without bound on a long-lived
    // instance.
    if (attempts.size > 2000) {
      for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

/** Only the acquisition fields we expect, each length-capped. */
function sanitiseAttribution(input: unknown): Attribution {
  if (typeof input !== "object" || input === null) return {};
  const raw = input as Record<string, unknown>;
  const out: Attribution = {};

  const allowed = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "landing_variant",
    "referrer_host",
    "gclid",
    "fbclid",
    "ttclid",
  ] as const;

  for (const key of allowed) {
    const value = raw[key];
    if (typeof value === "string" && value.length > 0) {
      out[key] = value.slice(0, 200);
    }
  }

  return out;
}

/**
 * Subject and board are a closed vocabulary — the pills the form actually
 * offers. Anything else is dropped silently rather than rejected: a bot posting
 * junk gets no signal about what would have worked, and a student on an old
 * cached bundle still gets their email onto the list.
 *
 * Comparison is case-insensitive and the *canonical* spelling is returned, so
 * the column stays groupable.
 */
function fromAllowList(input: unknown, allowed: readonly string[]): string | undefined {
  if (typeof input !== "string") return undefined;
  const candidate = input.trim().toLowerCase();
  return allowed.find((option) => option.toLowerCase() === candidate);
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  if (rateLimited(clientKey(request))) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", message: "Too many attempts. Give it a minute." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  const payload = body as {
    email?: unknown;
    attribution?: unknown;
    honeypot?: unknown;
    subject?: unknown;
    board?: unknown;
  };

  // A hidden field no human fills in. Bots that fill it get a 200 and go away
  // happy, having written nothing.
  if (typeof payload.honeypot === "string" && payload.honeypot.length > 0) {
    return NextResponse.json({ ok: true, code: "created" });
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) {
    return NextResponse.json(
      { ok: false, code: "invalid_email", message: "That email doesn't look right." },
      { status: 400 },
    );
  }

  const signup: WaitlistSignup = {
    email,
    attribution: sanitiseAttribution(payload.attribution),
    subject: fromAllowList(payload.subject, waitlist.subjects),
    board: fromAllowList(payload.board, waitlist.boards),
    userAgent: request.headers.get("user-agent")?.slice(0, 400) ?? undefined,
    // Vercel and Cloudflare both set this. Country only — never the IP, which
    // we use transiently for rate limiting and never store.
    country:
      request.headers.get("x-vercel-ip-country") ??
      request.headers.get("cf-ipcountry") ??
      undefined,
  };

  const result = await getWaitlistStore().save(signup);

  switch (result.status) {
    case "created":
      return NextResponse.json({ ok: true, code: "created" });

    case "already_joined":
      // Not an error worth showing. They are on the list either way, and
      // telling them otherwise would leak who has signed up.
      return NextResponse.json({ ok: true, code: "already_joined" });

    case "unconfigured":
      console.error(
        "[plumi] Waitlist signup rejected: no backend configured. " +
          "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. See docs/WAITLIST.md.",
      );
      return NextResponse.json(
        {
          ok: false,
          code: "unconfigured",
          message: "The waitlist isn't accepting signups right now.",
        },
        { status: 503 },
      );

    case "error":
      console.error("[plumi] Waitlist signup failed:", result.message);
      return NextResponse.json(
        { ok: false, code: "server_error", message: "Something went wrong. Try again in a moment." },
        { status: 502 },
      );
  }
}
