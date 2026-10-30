import "server-only";

import { createHmac } from "node:crypto";

import { site } from "@/config/site";

/**
 * The link in the welcome email that takes a student off the Android waitlist. Its token is an HMAC of their email
 * made with WAITLIST_UNSUBSCRIBE_SECRET, the same secret the database holds (supabase/migrations/0003_leave_waitlist.sql),
 * so a link only ever removes the address it was made for.
 */
const SECRET = process.env.WAITLIST_UNSUBSCRIBE_SECRET;

const b64url = (text: string) => Buffer.from(text, "utf8").toString("base64url");

export function unsubscribeToken(email: string): string | null {
  return SECRET ? createHmac("sha256", SECRET).update(email.toLowerCase()).digest("hex") : null;
}

/** `page` is the confirm page a student reads; `api` is the address a mail app's one-click "Unsubscribe" posts to. */
export function unsubscribeLinks(email: string): { page: string; api: string } | null {
  const token = unsubscribeToken(email);
  if (!token) return null;
  const query = `e=${b64url(email.toLowerCase())}&t=${token}`;
  return { page: `${site.domain}/unsubscribe?${query}`, api: `${site.domain}/api/unsubscribe?${query}` };
}

export function emailFromParam(value: string | null): string | null {
  if (!value) return null;
  try {
    const email = Buffer.from(value, "base64url").toString("utf8");
    return email.length > 0 && email.length <= 254 && email.includes("@") ? email : null;
  } catch {
    return null;
  }
}
