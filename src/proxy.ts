import { NextResponse, type NextRequest } from "next/server";
import { allowedOrigins, frameAncestors } from "@/config/embedPartners";
import { routeFor } from "@/lib/studyapp/routing";

/**
 * Who may frame the question-bank embed, decided per request from `?ref=`.
 *
 * Only `/embed/*` gets these headers; every other page keeps the `X-Frame-Options: DENY` from
 * next.config.ts, which deliberately does not apply to /embed/. Every other request is only
 * routed by host (`byHost`, below). The allowlist is src/config/embedPartners.ts.
 *
 *   known partner  Content-Security-Policy: frame-ancestors <its origins>
 *                  (no X-Frame-Options: it would override the CSP in old browsers)
 *   anything else  frame-ancestors 'none' and X-Frame-Options: DENY
 *
 * The page itself is cached; this runs in front of the cache, so the header is
 * right for each request even though the HTML is shared.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!pathname.startsWith("/embed/")) return byHost(request, pathname, search);
  const response = NextResponse.next();
  const ref = request.nextUrl.searchParams.get("ref");
  response.headers.set("Content-Security-Policy", frameAncestors(ref));
  if (allowedOrigins(ref).length === 0) response.headers.set("X-Frame-Options", "DENY");
  // The page also says noindex; the header covers anything that doesn't read the HTML.
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

/**
 * One deployment, two sites: study.tryplumi.app is the web app and tryplumi.app is the marketing site
 * (decisions in src/lib/studyapp/routing.ts). Nothing here reads a cookie; the app's sign-in gate runs in the
 * browser (components/studyapp/AuthGate), because the session lives in the browser.
 */
function byHost(request: NextRequest, pathname: string, search: string) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const route = routeFor(host, pathname, search);
  switch (route.kind) {
    case "rewrite": return NextResponse.rewrite(new URL(route.to, request.url));
    // A path stays on the host that was asked for (the one in the request, not the server's own address).
    case "redirect": return NextResponse.redirect(new URL(route.to, `${request.nextUrl.protocol}//${host}`), 307);
    // The app is not for search engines (its pages also say noindex), and the marketing sitemap is not its sitemap.
    case "robots": return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
    default: return NextResponse.next();
  }
}

// Every page, plus /robots.txt; never Next's own files or anything with a file extension (images, fonts, scripts).
export const config = { matcher: ["/robots.txt", "/((?!_next/|api/|.*\\.).*)"] };
