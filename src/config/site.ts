export type LaunchMode = "community" | "waitlist" | "appStore";
export const launchMode: LaunchMode = "community";
export const appStoreUrl: string | null = null;
export const discordUrl = "https://discord.com/invite/mPhTczwfpk";
// Midnight in Britain on the confirmed launch date (BST, UTC+1).
export const launchDate = "2026-09-25T00:00:00+01:00";

/**
 * The canonical domain.
 *
 * Two domains point at this same Vercel project and both answer 200, which is
 * the textbook way to split your own ranking signals in half. One of them has
 * to win outright: it owns the canonical tags, the sitemap, the Open Graph
 * URLs and the robots `Host`, and the other 308s to it (see `next.config.ts`).
 *
 * `tryplumi.app` wins because it already is the canonical in production — the
 * live HTML, the sitemap and hello@tryplumi.app all say so, so choosing it
 * costs nothing, while switching would discard the indexing that exists.
 *
 * `plumi.study` has one real argument in its favour: it exact-matches the
 * branded query "plumi study". That is worth much less than it was a decade
 * ago, and nowhere near the cost of a domain migration. Revisit only before
 * there is meaningful organic traffic to lose — and if you do flip it, this
 * constant and its twin below are the whole change.
 */
export const site = {
  name: "Plumi",
  domain: "https://tryplumi.app",
  alternateDomain: "https://plumi.study",
  tagline: "Your handwriting. Read, understood, visualised.",
  description:
    "Plumi is an AI study notebook for GCSE and A-Level students that reads your handwritten working, tutors you on the page and builds practice around what you actually know.",
  contactEmail: "hello@tryplumi.app",
  locale: "en_GB",
} as const;

/**
 * The one-sentence definition of the entity, in plain language.
 *
 * The hero line is a promise, not a description — "Your handwriting. Read,
 * understood, visualised." tells a person what it feels like and tells a
 * crawler nothing about what category this product is in. This sentence is the
 * literal version, and it appears verbatim in three places that matter: the
 * meta description, the Organization/SoftwareApplication JSON-LD, and visible
 * HTML on the homepage. Consistency across those three is most of what makes
 * an entity legible.
 *
 * Every clause is a feature that exists today. Do not add one that does not.
 */
export const entityDescription =
  "Plumi is an AI-powered study notebook for GCSE and A-Level students. It reads your handwritten working on iPad, tutors you directly on the page, and turns what your work reveals into personalised practice.";

/**
 * Profiles that genuinely belong to Plumi, for `sameAs`.
 *
 * `sameAs` is how a search engine confirms that the Plumi on this domain and
 * the Plumi on that profile are one entity. It only works if every entry is
 * real and actually controlled by us — a speculative handle is a broken
 * corroboration, which is worse than no corroboration. Add to this list as
 * profiles are genuinely claimed (see docs/seo/entity-checklist.md).
 */
export const sameAs: readonly string[] = [discordUrl];

/** An absolute URL on the canonical domain. Schema.org wants absolute; so does OG. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, site.domain).href;
}

export const cta = {
  community: { primary: "Join the Discord community", compact: "Join Discord", supporting: "Made for iPad. Built around you.", reassurance: "Launching 25 September 2026" },
  waitlist: { primary: "Join the Discord community", compact: "Join Discord", supporting: "Made for iPad. Built around you.", reassurance: "Launching 25 September 2026" },
  appStore: { primary: "Download on the App Store", compact: "Download", supporting: "Free to write in. iPad and Apple Pencil.", reassurance: "Requires iPadOS 17 or later." },
} as const;
export const activeCta = cta[launchMode];
export function isWaitlistMode(): boolean { return false; }
export function assertLaunchConfig(): void {
  if (launchMode === "appStore" && (!appStoreUrl || !appStoreUrl.startsWith("https://apps.apple.com/"))) {
    throw new Error("Set a verified App Store URL before switching launchMode to appStore.");
  }
}
export function primaryCtaHref(): string { return launchMode === "appStore" ? appStoreUrl! : discordUrl; }
