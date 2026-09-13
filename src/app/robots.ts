import type { MetadataRoute } from "next";

import { absoluteUrl, site } from "@/config/site";

/**
 * Open, with two deliberate exceptions.
 *
 * `/api/` is a POST endpoint no crawler can usefully reach, and `/v/` holds the
 * paid-traffic variant landings — near-duplicates of the homepage that already
 * carry `noindex` and a canonical pointing home. Disallowing them here saves
 * the crawl budget as well.
 *
 * Note what is NOT blocked: nothing under `/_next/`. Blocking the JS and CSS a
 * page needs to render is the classic own-goal — Googlebot renders the page and
 * sees a blank one. `Host` and `Sitemap` both name the canonical domain, so the
 * copy of this file served from plumi.study still points home.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/v/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.domain,
  };
}
