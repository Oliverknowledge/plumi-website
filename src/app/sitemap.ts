import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/config/site";
import { indexableRoutes } from "@/config/routes";

/**
 * Generated from the route registry rather than hand-listed.
 *
 * The failure mode of a hand-written sitemap is not that it breaks, it is that
 * it quietly goes stale — a new landing page ships, nobody edits this file, and
 * the page waits months to be found. Deriving it from `src/config/routes.ts`
 * means adding a route is the only step.
 *
 * Only canonical, indexable, 200-returning URLs belong here. The `/v/*` variant
 * landings are noindex and excluded by construction.
 */
// No lastModified: a date that is always the build time teaches Google to ignore it.
export default function sitemap(): MetadataRoute.Sitemap {
  return indexableRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
