/**
 * The test seam: a way for the founder (or a test) to see the website as Pro, or as free, without a real purchase.
 *
 *   - ONLY in a build that is not production (`NODE_ENV !== "production"`: `next dev`, tests). In a production build `readProOverride` returns null whatever the
 *     URL or storage say, and the hook never reads them, so it cannot be switched on by anyone.
 *   - It changes what the screen shows, nothing more. It does NOT touch the server: the routes still check the student's real entitlement, so a "Pro" screen with a
 *     free account gets a locked panel when it asks for content (the server says 403).
 *
 * `?pro=on` or `?pro=off` in the URL, or the localStorage key `plumi-pro-override` set to "on" or "off". `?pro=clear` removes the key.
 */
export const OVERRIDE_KEY = "plumi-pro-override";
export type ProOverride = "on" | "off";

interface Env { nodeEnv: string | undefined; search: string; stored: string | null }

export function readProOverride(env: Env): ProOverride | null {
  if (env.nodeEnv === "production") return null;
  const q = new URLSearchParams(env.search).get("pro");
  const v = q ?? env.stored;
  return v === "on" || v === "off" ? v : null;
}

/** The storage side of `?pro=`: remember it (or forget it for `clear`). Returns the stored value. Not in production. */
export function applyOverrideQuery(nodeEnv: string | undefined, search: string, storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null): string | null {
  if (nodeEnv === "production" || !storage) return null;
  try {
    const q = new URLSearchParams(search).get("pro");
    if (q === "on" || q === "off") storage.setItem(OVERRIDE_KEY, q);
    else if (q === "clear") storage.removeItem(OVERRIDE_KEY);
    return storage.getItem(OVERRIDE_KEY);
  } catch { return null; }
}
