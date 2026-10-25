import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/config/site";
import { indexableRoutes } from "@/config/routes";
import { pastPaperPaths, pastPaperSource } from "@/content/pastPapers";
import { practicePacks, packPath } from "@/content/practicePacks";
import { bankPath, bankSubjects, bankTopicPath } from "@/content/questionBank";

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
/**
 * lastmod only where it is a real date, never the build time (a date that always moves teaches Google
 * to ignore it): a page's own `lastModified` in routes.ts, the date the past paper library was
 * generated, and the date the question bank was last built. Bump BANK_BUILT after `npm run bank:build`.
 */
const BANK_BUILT = "2026-10-23";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...indexableRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      ...(route.lastModified ? { lastModified: route.lastModified } : {}),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    // The past paper library's subject and board pages, generated from
    // src/content/pastPapers.json. New papers arrive once a year, after the summer series.
    ...pastPaperPaths().map((path) => ({
      url: absoluteUrl(path),
      lastModified: pastPaperSource.generated,
      changeFrequency: "monthly" as const,
      priority: path.split("/").length > 3 ? 0.7 : 0.8,
    })),
    // Plumi's own practice packs, one page each, dated by their last version.
    ...practicePacks.map((p) => ({ url: absoluteUrl(packPath(p.slug)), lastModified: p.updated, changeFrequency: "monthly" as const, priority: 0.9 })),
    // The question bank: each subject's bank, and a page per topic with questions.
    ...bankSubjects.flatMap((s) => [
      { url: absoluteUrl(bankPath(s.slug)), lastModified: BANK_BUILT, changeFrequency: "monthly" as const, priority: 0.9 },
      ...s.topics.filter((t) => t.count > 0).map((t) => ({ url: absoluteUrl(bankTopicPath(s.slug, t.slug)), lastModified: BANK_BUILT, changeFrequency: "monthly" as const, priority: 0.7 })),
    ]),
  ];
}
