/**
 * Leaving the library as the student who is in it, however the page ends.
 *
 * Two things go wrong with a plain `lobby_leave` from the page's own client:
 *   - the page is closing, and a request made then is dropped unless it is sent as a `keepalive` one;
 *   - another tab signed in as someone else, so the shared client now speaks as THAT student, and the old
 *     student would stay standing in the room while the new one is taken out of it.
 * So each visit keeps the identity it began with: the token last issued to that student (kept up to date by
 * account.ts as the session refreshes) and the request is signed with it. A token that has expired in the
 * meantime just means the server turns the leave away; the row then goes stale in 30 seconds on its own
 * (`lobby_fresh`), as it always did.
 */

const tokens = new Map<string, string>();

/** account.ts hands every session it learns of here. */
export function rememberToken(userId: string, accessToken: string): void {
  tokens.set(userId.toLowerCase(), accessToken);
}
export function forgetTokens(): void { tokens.clear(); }

const URL_ = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_KEY;

export interface FarewellEnv {
  fetch?: typeof fetch;
  url?: string;
  key?: string;
}

/**
 * The goodbye for `userId`: sends `lobby_leave` as that student and says whether a request could be made at all (false: no
 * token for them, or no way to send), in which case the caller falls back to the ordinary call.
 */
export function farewellFor(userId: string, env: FarewellEnv = {}): () => boolean {
  const who = userId.toLowerCase();
  const url = env.url ?? URL_, key = env.key ?? KEY;
  return () => {
    const token = tokens.get(who);
    const send = env.fetch ?? (typeof fetch === "function" ? fetch : null);
    if (!token || !url || !key || !send) return false;
    try {
      void Promise.resolve(send(`${url}/rest/v1/rpc/lobby_leave`, {
        method: "POST",
        keepalive: true,
        headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      })).catch(() => {});
      return true;
    } catch {
      return false;
    }
  };
}
