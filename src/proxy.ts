import { NextResponse, type NextRequest } from "next/server";
import { allowedOrigins, frameAncestors } from "@/config/embedPartners";

/**
 * Who may frame the question-bank embed, decided per request from `?ref=`.
 *
 * Only `/embed/*` runs through here (see the matcher); every other page keeps the
 * `X-Frame-Options: DENY` from next.config.ts, which deliberately does not apply
 * to /embed/. The allowlist is src/config/embedPartners.ts.
 *
 *   known partner  Content-Security-Policy: frame-ancestors <its origins>
 *                  (no X-Frame-Options: it would override the CSP in old browsers)
 *   anything else  frame-ancestors 'none' and X-Frame-Options: DENY
 *
 * The page itself is cached; this runs in front of the cache, so the header is
 * right for each request even though the HTML is shared.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const ref = request.nextUrl.searchParams.get("ref");
  response.headers.set("Content-Security-Policy", frameAncestors(ref));
  if (allowedOrigins(ref).length === 0) response.headers.set("X-Frame-Options", "DENY");
  // The page also says noindex; the header covers anything that doesn't read the HTML.
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: ["/embed/:path*"] };
