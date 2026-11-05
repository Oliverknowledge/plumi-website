import type { ApiError } from "@/lib/social/failure";
import type { ShareApi } from "./service";

/**
 * The same five calls over plain `fetch`, for the places that have no signed-in student and should not carry the whole Supabase
 * client: the public page (server side, to read a deck; browser side, to report one). It speaks PostgREST directly:
 * `POST <project>/rest/v1/rpc/<name>` with the project's public key. The key is the publishable one the iPad app ships; what it can
 * touch is decided by the database, not by hiding it.
 */
export interface RestConfig { url: string; key: string }

/** The project the site is configured for (the same two variables accounts use), or null when there is none. */
export function restConfig(env: Record<string, string | undefined> = process.env): RestConfig | null {
  const url = env.NEXT_PUBLIC_PLUMI_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = env.NEXT_PUBLIC_PLUMI_SUPABASE_KEY?.trim();
  return url && key && /^https?:\/\//.test(url) ? { url, key } : null;
}

export interface RestOptions { fetch?: typeof fetch; timeoutMs?: number; token?: string | null }

/** An Api whose rpc is a fetch. `userId()` is null: nothing here knows a student. */
export function restApi(config: RestConfig | null, options: RestOptions = {}): ShareApi {
  const doFetch = options.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  return {
    configured: config !== null,
    userId: () => null,
    async rpc(name, args) {
      if (!config) return { data: null, error: { message: "not configured" } };
      // A publishable key (sb_publishable_...) is not a token and is sent as the apikey only; a legacy anon key is a JWT and is also the bearer.
      const bearer = options.token ?? (config.key.split(".").length === 3 ? config.key : null);
      const headers: Record<string, string> = { apikey: config.key, "content-type": "application/json", accept: "application/json" };
      if (bearer) headers.authorization = `Bearer ${bearer}`;
      try {
        const res = await doFetch(`${config.url}/rest/v1/rpc/${encodeURIComponent(name)}`, {
          method: "POST", headers, body: JSON.stringify(args ?? {}), cache: "no-store", signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
        });
        const text = await res.text();
        let body: unknown = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = text; }
        if (res.ok) return { data: body, error: null };
        const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
        const error: ApiError = {
          message: typeof o.message === "string" ? o.message : typeof body === "string" && body ? body : `status ${res.status}`,
          code: typeof o.code === "string" ? o.code : undefined,
          status: res.status,
        };
        return { data: null, error };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? `${e.name}: ${e.message}` : String(e) } };
      }
    },
  };
}
