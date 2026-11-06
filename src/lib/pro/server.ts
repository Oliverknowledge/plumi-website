/**
 * Who may have the mark scheme cards, decided on the server (route handlers: app/api/pro-status, app/api/premade/markscheme/[spec], and any future Pro route: `requirePro`). Plain functions with
 * their dependencies passed in, so every rule is tested without a network (proServer.test.ts).
 *
 * The cards are Pro-only, so their text is never in the client bundle or any public file: it is read from src/content/proDecks only by the route, and
 * only after this module says the caller holds Pro. How it decides: the caller sends their Supabase access token; the server asks Supabase who that
 * is (`/auth/v1/user`) and then reads THAT user's own row of `account_entitlements` with the caller's own token (row-level security lets a student read only
 * their own row), the same table the iPad's `account_pro` function reads. It does NOT call `account_pro`: that function counts the caller as one of the
 * account's three devices (migration 0127, rule 4), and the website must never take a device slot.
 *
 * The rule (0127, `account_pro_live` and `account_pro`): status "active" grants while expires_at is in the future; status "grace" grants while
 * expires_at is less than two days ago (Apple's billing-grace window); "expired" and "revoked" never grant; no row grants nothing; an anonymous user
 * (JWT is_anonymous) never holds Pro. Left out on purpose: the three-device limit.
 *
 * Nothing here logs a token, a user id or a card. A cache of answers (30 seconds) is keyed by a hash of the token, never the token. Supabase gets 4 seconds to
 * answer, then the answer is "unknown" (503), never "free". Only same-origin calls are served.
 *
 * ONE LAYER: `getProState(req)` says what the account holds; `requirePro(req)` is the line a route handler starts with. See docs/study/pro.md.
 */
import { createHash } from "node:crypto";


export interface EntitlementRow { status: string; expires_at: string }
const GRACE_MS = 2 * 24 * 60 * 60 * 1000;

/** Does this record grant Pro at `nowMs`? (`account_pro_live`.) */
export function isLive(row: EntitlementRow | null | undefined, nowMs: number): boolean {
  if (!row) return false;
  const expires = Date.parse(row.expires_at);
  if (!Number.isFinite(expires)) return false;
  if (row.status === "active") return expires > nowMs;
  if (row.status === "grace") return expires + GRACE_MS > nowMs;
  return false;
}

/** The bearer token of an Authorization header, if it is one and looks like a JWT (three dot-separated URL-safe parts, a sane length). */
export function bearer(header: string | null): string | null {
  const m = /^Bearer ([A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{0,2048})$/.exec(header ?? "");
  return m ? m[1] : null;
}

export interface SupabaseEnv { url: string; key: string }
export interface ProDeps {
  env: SupabaseEnv | null;
  fetch: typeof fetch;
  now: () => number;
  /** How long Supabase has to answer each call (default 4000 ms). */
  timeoutMs?: number;
}

export type ProKind = "pro" | "free" | "unknown";
/** Why: ok (Pro), none (no record), expired, revoked, anonymous, no_token, bad_token (Supabase will not accept it), unavailable (could not be asked in time). */
export type ProReason = "ok" | "none" | "expired" | "revoked" | "anonymous" | "no_token" | "bad_token" | "unavailable";
export interface ProInfo {
  state: ProKind;
  reason: ProReason;
  /** The record's own expires_at, if there is one (a student's Pro "active until" date; it also says when it ended). */
  expiresAt?: string;
  /** The record's own status: active or grace. */
  status?: "active" | "grace";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNKNOWN: ProInfo = { state: "unknown", reason: "unavailable" };

/** What the account behind this token holds. Never throws. An unusable token is `free` with reason bad_token; Supabase down or slow is `unknown`. */
export async function infoFor(token: string, deps: ProDeps): Promise<ProInfo> {
  const { env } = deps;
  if (!env) return UNKNOWN;
  const headers = { apikey: env.key, Authorization: `Bearer ${token}`, Accept: "application/json" };
  const ms = deps.timeoutMs ?? 4000;
  const get = (url: string) => deps.fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(ms) });
  try {
    const who = await get(`${env.url}/auth/v1/user`);
    if (who.status === 401 || who.status === 403) return { state: "free", reason: "bad_token" };
    if (!who.ok) return UNKNOWN;
    const user = (await who.json()) as { id?: unknown; is_anonymous?: unknown } | null;
    const id = typeof user?.id === "string" && UUID.test(user.id) ? user.id : null;
    if (!id) return UNKNOWN;
    if (user?.is_anonymous === true) return { state: "free", reason: "anonymous" };
    const res = await get(`${env.url}/rest/v1/account_entitlements?select=status,expires_at&user_id=eq.${id}&limit=1`);
    if (!res.ok) return UNKNOWN;
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return UNKNOWN;
    const raw = rows[0] as EntitlementRow | undefined;
    const row = raw && typeof raw.status === "string" && typeof raw.expires_at === "string" ? raw : null;
    if (!row) return { state: "free", reason: "none" };
    if (isLive(row, deps.now())) return { state: "pro", reason: "ok", expiresAt: row.expires_at, status: row.status === "grace" ? "grace" : "active" };
    return { state: "free", reason: row.status === "revoked" ? "revoked" : "expired", expiresAt: row.expires_at };
  } catch {
    return UNKNOWN; // a timeout, a network failure, a body that is not JSON
  }
}

/* A cache of answers for 30 seconds, so a page with several Pro checks costs one read. Keyed by a hash of the token, never the token. Only a real answer
   (pro or free) is kept: "unknown" is asked again. `fresh` skips it (the Settings "Check again" right after a purchase). */
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; info: ProInfo }>();
const keyOf = (token: string) => createHash("sha256").update(token).digest("hex");
export const clearProCache = () => cache.clear();
/** The cache's keys (for the test that proves they are hashes). */
export const cacheKeys = (): string[] => [...cache.keys()];

/** What the account holds, from the cache if it is under 30 seconds old. */
export async function proInfoFor(token: string, deps: ProDeps, fresh = false): Promise<ProInfo> {
  const key = keyOf(token), now = deps.now();
  const hit = cache.get(key);
  if (!fresh && hit && now - hit.at < CACHE_MS) return hit.info;
  const info = await infoFor(token, deps);
  if (info.state !== "unknown" && info.reason !== "bad_token") {
    cache.set(key, { at: now, info });
    if (cache.size > 2000) for (const [k, v] of cache) if (now - v.at >= CACHE_MS) cache.delete(k);
  }
  return info;
}

/* A light per-token limit: enough to stop a loop in a page, not a defence. Keyed by the token's tail, never stored with anything else. */
const hits = new Map<string, { n: number; reset: number }>();
export function limited(token: string, nowMs: number, max = 60, windowMs = 60_000): boolean {
  const key = token.slice(-24);
  const e = hits.get(key);
  if (!e || nowMs > e.reset) {
    hits.set(key, { n: 1, reset: nowMs + windowMs });
    if (hits.size > 2000) for (const [k, v] of hits) if (nowMs > v.reset) hits.delete(k);
    return false;
  }
  e.n += 1;
  return e.n > max;
}

const HEADERS = { "Cache-Control": "private, no-store", "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" };
export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const tiny = (status: number, code: string) => json(status, { error: code });

/** Same-origin calls only: a request that names another origin (or says it is cross-site) is refused, and no CORS header is ever sent. */
export function sameOrigin(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

/**
 * What the caller holds. `getProState(req)` reads `Authorization: Bearer <Supabase access token>` and answers {state, reason, expiresAt?}: pro, free (with why) or
 * unknown (no config, Supabase slow or down). A missing or malformed token is `free` with reason no_token. Add `?fresh=1` to skip the 30 second cache.
 */
export async function getProState(req: Request, deps: ProDeps = realDeps()): Promise<ProInfo> {
  const token = bearer(req.headers.get("authorization"));
  if (!token) return { state: "free", reason: "no_token" };
  return proInfoFor(token, deps, new URL(req.url).searchParams.get("fresh") === "1");
}

export type ProGuard = { ok: true; info: ProInfo } | { ok: false; response: Response };

/** The decision behind `requirePro` and `/api/pro-status`: an HTTP status, and what the account holds if it was asked. */
async function decide(req: Request, deps: ProDeps): Promise<{ status: number; code: string; info?: ProInfo }> {
  if (!sameOrigin(req)) return { status: 403, code: "origin" };
  const token = bearer(req.headers.get("authorization"));
  if (!token) return { status: 401, code: "token" };
  if (limited(token, deps.now())) return { status: 429, code: "slow" };
  const info = await proInfoFor(token, deps, new URL(req.url).searchParams.get("fresh") === "1");
  if (info.state === "pro") return { status: 200, code: "ok", info };
  if (info.state === "unknown") return { status: 503, code: "later", info };
  if (info.reason === "bad_token") return { status: 401, code: "token", info };
  return { status: 403, code: "pro", info };
}

/**
 * The first lines of a route handler that serves Pro content or costs money:
 *
 *     const guard = await requirePro(req);
 *     if (!guard.ok) return guard.response;
 *
 * Answers 403 not Pro, 401 no or unaccepted token, 429 too many, 503 Supabase could not be asked in time (never "free": try again), 403 another origin.
 */
export async function requirePro(req: Request, deps: ProDeps = realDeps()): Promise<ProGuard> {
  const d = await decide(req, deps);
  return d.status === 200 && d.info ? { ok: true, info: d.info } : { ok: false, response: tiny(d.status, d.code) };
}

/**
 * GET /api/pro-status: 200 `{ pro: true, expiresAt, status }` for Pro; 403 `{ error: "pro", reason, expiresAt? }` for a free account (reason: none, expired, revoked,
 * anonymous); 401 no or unaccepted token; 429; 503 not told. The client reads the plan from this.
 */
export async function handleProStatus(req: Request, deps: ProDeps = realDeps()): Promise<Response> {
  const d = await decide(req, deps);
  if (d.status === 200 && d.info) return json(200, { pro: true, expiresAt: d.info.expiresAt, status: d.info.status });
  if (d.status === 403 && d.code === "pro" && d.info) return json(403, { error: "pro", reason: d.info.reason, ...(d.info.expiresAt ? { expiresAt: d.info.expiresAt } : {}) });
  return tiny(d.status, d.code);
}

/** The project's public URL and key (the same ones the browser client uses; row-level security, not secrecy, is what protects the table). */
export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_URL, key = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

/** The real dependencies: the project's variables, `fetch`, the clock. */
export function realDeps(): ProDeps {
  return { env: supabaseEnv(), fetch, now: Date.now };
}
