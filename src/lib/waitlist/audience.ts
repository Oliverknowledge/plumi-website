import "server-only";

/**
 * Keeps the Resend audience "Plumi Android waitlist" in step with the Supabase list, so a broadcast from
 * Resend reaches everyone who joined and no one who left. Supabase is the list; this is a copy for sending.
 *
 * Contacts need a Resend key with full access (a sending-only key is refused), so this reads its own
 * `RESEND_CONTACTS_KEY` rather than the sending key. With either it or `RESEND_AUDIENCE_ID` missing it does
 * nothing: a signup is never held up or failed by this copy.
 */
const KEY = process.env.RESEND_CONTACTS_KEY;
const AUDIENCE = process.env.RESEND_AUDIENCE_ID;
const BASE = process.env.RESEND_API_BASE ?? "https://api.resend.com";

async function call(method: "POST" | "DELETE", path: string, body?: unknown): Promise<boolean> {
  if (!KEY || !AUDIENCE) return false;
  try {
    const response = await fetch(`${BASE}/audiences/${AUDIENCE}/contacts${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) console.error(`[plumi] Resend audience ${method} failed: ${response.status}`);
    return response.ok;
  } catch (cause) {
    console.error("[plumi] Resend audience sync failed:", cause instanceof Error ? cause.message : cause);
    return false;
  }
}

export const addToAudience = (email: string) => call("POST", "", { email, unsubscribed: false });
export const removeFromAudience = (email: string) => call("DELETE", `/${encodeURIComponent(email)}`);
