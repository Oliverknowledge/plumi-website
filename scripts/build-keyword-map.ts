/**
 * Regenerates docs/seo/keyword-map.md from the route registry.
 *
 * The map is a document people read and a config the site actually uses, and
 * those two drift apart the moment they are maintained separately. Generating
 * it means the registry is the only thing to edit: `npm run seo:map`.
 */
import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { routeIntents } from "../src/config/routes";
import { site } from "../src/config/site";

const OUT = "docs/seo/keyword-map.md";

const lines: string[] = [
  "# Keyword and search-intent map",
  "",
  "<!-- GENERATED FILE — do not edit by hand.",
  "     Source: src/config/routes.ts · Regenerate: npm run seo:map -->",
  "",
  `Canonical domain: \`${site.domain}\`. Every URL below is indexable, in the`,
  "sitemap, and reachable from the footer of every page.",
  "",
  "One page per primary query, deliberately. Where two candidate pages would",
  "have chased the same intent they were merged instead of both being written —",
  "see the note at the top of `src/config/routes.ts`.",
  "",
];

for (const route of routeIntents) {
  lines.push(
    `## \`${route.path}\``,
    "",
    `| | |`,
    `| --- | --- |`,
    `| **Primary query** | ${route.primaryQuery} |`,
    `| **Secondary** | ${route.secondaryQueries.length ? route.secondaryQueries.join(" · ") : "—"} |`,
    `| **User intent** | ${route.intent} |`,
    `| **Page objective** | ${route.objective} |`,
    `| **Title** (${route.title.length} chars) | ${route.title} |`,
    `| **H1** | ${route.h1} |`,
    `| **Description** (${route.description.length} chars) | ${route.description} |`,
    `| **Links to** | ${route.linksTo.length ? route.linksTo.map((p) => `\`${p}\``).join(" · ") : "—"} |`,
    `| **Sitemap priority** | ${route.priority} (${route.changeFrequency}) |`,
    "",
  );
}

// A page nobody links to is a page Google reaches slowly and trusts less.
lines.push("## Internal link graph", "", "Inbound links, counted from `linksTo` plus the site-wide footer:", "");
const inbound = new Map<string, string[]>(routeIntents.map((r) => [r.path, []]));
for (const route of routeIntents) {
  for (const target of route.linksTo) inbound.get(target)?.push(route.path);
}
for (const [path, sources] of inbound) {
  lines.push(`- \`${path}\` — ${sources.length} contextual inbound ${sources.length === 1 ? "link" : "links"}${sources.length ? `: ${sources.map((s) => `\`${s}\``).join(", ")}` : " (footer only)"}`);
}
lines.push("");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.log(`Wrote ${OUT} — ${routeIntents.length} routes.`);
