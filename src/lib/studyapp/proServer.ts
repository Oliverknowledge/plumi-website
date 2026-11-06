/**
 * Who may have the mark scheme cards, decided on the server (route handlers: app/api/pro-status, app/api/premade/markscheme/[spec]). Plain functions with
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
 * Nothing here logs a token, a user id or a card.
 */

/** The ten specifications with mark scheme cards, as the URL names them (the lower case of the spec id). */
export const MS_SLUGS = ["aqa-7402", "ocr-h420", "aqa-8461", "aqa-7405", "ocr-h432", "aqa-8462", "aqa-7408", "ocr-h556", "edexcel-9ph0", "aqa-8463"] as const;
export type MsSlug = (typeof MS_SLUGS)[number];
export const isMsSlug = (s: unknown): s is MsSlug => typeof s === "string" && (MS_SLUGS as readonly string[]).includes(s);

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
}

export type Verdict = "pro" | "free" | "unauth" | "error";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pro, free, a token Supabase does not accept (unauth), or "error" when Supabase could not be asked. Never throws. */
export async function verdictFor(token: string, deps: ProDeps): Promise<Verdict> {
  const { env } = deps;
  if (!env) return "error";
  const headers = { apikey: env.key, Authorization: `Bearer ${token}`, Accept: "application/json" };
  try {
    const who = await deps.fetch(`${env.url}/auth/v1/user`, { headers, cache: "no-store" });
    if (who.status === 401 || who.status === 403) return "unauth";
    if (!who.ok) return "error";
    const user = (await who.json()) as { id?: unknown; is_anonymous?: unknown } | null;
    const id = typeof user?.id === "string" && UUID.test(user.id) ? user.id : null;
    if (!id) return "error";
    if (user?.is_anonymous === true) return "free";
    const res = await deps.fetch(`${env.url}/rest/v1/account_entitlements?select=status,expires_at&user_id=eq.${id}&limit=1`, { headers, cache: "no-store" });
    if (!res.ok) return "error";
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return "error";
    const row = rows[0] as EntitlementRow | undefined;
    return isLive(row && typeof row.status === "string" && typeof row.expires_at === "string" ? row : null, deps.now()) ? "pro" : "free";
  } catch {
    return "error";
  }
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
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const tiny = (status: number, code: string) => json(status, { error: code });

/** GET /api/pro-status: `{ pro: true }` (200) or `{ error }` (401 no or unaccepted token, 403 not Pro, 503 Supabase could not be asked). */
export async function handleProStatus(req: Request, deps: ProDeps): Promise<Response> {
  const token = bearer(req.headers.get("authorization"));
  if (!token) return tiny(401, "token");
  if (limited(token, deps.now())) return tiny(429, "slow");
  const v = await verdictFor(token, deps);
  return v === "pro" ? json(200, { pro: true }) : v === "free" ? tiny(403, "pro") : v === "unauth" ? tiny(401, "token") : tiny(503, "later");
}

/** GET /api/premade/markscheme/<spec>: the spec's cards (200) only to a Pro account; 400 an unknown spec, then the same answers as /api/pro-status. */
export async function handleMarkScheme(req: Request, spec: unknown, deps: ProDeps, load: (slug: MsSlug) => Promise<unknown>): Promise<Response> {
  if (!isMsSlug(spec)) return tiny(400, "spec");
  const token = bearer(req.headers.get("authorization"));
  if (!token) return tiny(401, "token");
  if (limited(token, deps.now())) return tiny(429, "slow");
  const v = await verdictFor(token, deps);
  if (v === "unauth") return tiny(401, "token");
  if (v === "error") return tiny(503, "later");
  if (v !== "pro") return tiny(403, "pro");
  try { return json(200, await load(spec)); } catch { return tiny(500, "data"); }
}

/** The project's public URL and key (the same ones the browser client uses; row-level security, not secrecy, is what protects the table). */
export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_URL, key = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
