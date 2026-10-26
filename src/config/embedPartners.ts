/**
 * Who may put Plumi's question bank in an iframe.
 *
 * This file is the whole switch. `/embed/question-bank/...` answers every request
 * with a `Content-Security-Policy: frame-ancestors ...` header built from it
 * (src/proxy.ts), and a browser refuses to draw the page in a frame on any other
 * origin. So:
 *
 *   add a partner     one line below, deploy.
 *   remove a partner  delete its line, deploy. Its iframes go blank at once.
 *   kill every embed  set EMBEDS_DISABLED=true in the Vercel project and redeploy,
 *                     or empty the object below.
 *
 * The key is the `ref` the partner puts on its iframe URL (`?ref=examnoob`). It is
 * also what the outbound links and PostHog events carry as the partner. Lowercase
 * letters, digits and hyphens, at most 32 characters.
 *
 * Values are exact origins: scheme and host (and port, if any), no path and no
 * trailing slash. `www.` and the bare domain are different origins, so list both.
 * Wildcards are deliberately not accepted: a wildcard is how a partner's
 * subdomain takeover becomes ours.
 *
 * Nothing else in the site reads this. The rest of the site stays `X-Frame-Options:
 * DENY` (next.config.ts), and that rule does not apply to /embed/.
 */
export const embedPartners: Readonly<Record<string, readonly string[]>> = {
  examnoob: ["https://examnoob.co.uk", "https://www.examnoob.co.uk"],
};

/** `ref` values that can be looked up at all. Anything else is treated as no ref. */
export const PARTNER_ID = /^[a-z0-9-]{1,32}$/;

/** One origin, exactly: https (or http on localhost, for development), a host, an optional port. */
const ORIGIN = /^(https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?|http:\/\/localhost)(:\d{1,5})?$/;

/** The global off switch. Read on the server only. */
export function embedsDisabled(): boolean {
  return process.env.EMBEDS_DISABLED === "true" || process.env.EMBEDS_DISABLED === "1";
}

/** The origins allowed to frame the embed for this `ref`; empty for an unknown partner or when embeds are off. */
export function allowedOrigins(ref: string | null | undefined): string[] {
  if (embedsDisabled()) return [];
  const id = (ref ?? "").trim().toLowerCase();
  if (!PARTNER_ID.test(id) || !Object.hasOwn(embedPartners, id)) return [];
  // A malformed entry is dropped rather than trusted: this value goes into a header.
  return embedPartners[id].filter(o => ORIGIN.test(o));
}

/** The CSP the embed route sends. An unknown or missing `ref` (or a partner with no valid origin) gets 'none'. */
export function frameAncestors(ref: string | null | undefined): string {
  const origins = allowedOrigins(ref);
  return `frame-ancestors ${origins.length ? origins.join(" ") : "'none'"}`;
}
