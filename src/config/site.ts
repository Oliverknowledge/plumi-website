export type LaunchMode = "community" | "waitlist" | "appStore";
/**
 * The App Store listing, `https://apps.apple.com/gb/app/plumi/id<number>`.
 *
 * Setting this is the whole switch: every call to action on the site (header,
 * hero, sticky bar, close) points here and the Discord and launch-email
 * wording drops away. While it is null the site falls back to the Discord
 * community, so a build can never ship a download button with nowhere to go.
 */
export const appStoreUrl: string | null = "https://apps.apple.com/gb/app/plumi/id6811389052";
export const launchMode: LaunchMode = appStoreUrl ? "appStore" : "community";
export const discordUrl = "https://discord.gg/Rk2mB2qxtM";
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
    "Plumi is an AI study notebook for STEM at A-Level and GCSE (Maths, Physics, Chemistry and Biology) that reads your handwritten working, marks it and tutors you on the page.",
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
  "Plumi is a GCSE and A-Level revision app for iPad: Maths, Physics, Chemistry and Biology, for AQA, OCR and Edexcel. It writes exam-style questions, marks your handwritten answers line by line against each question's own mark scheme, tutors you directly on the page, and colours a map of your specification's topics from your marked answers.";

/**
 * Profiles that genuinely belong to Plumi, for `sameAs`.
 *
 * `sameAs` is how a search engine confirms that the Plumi on this domain and
 * the Plumi on that profile are one entity. It only works if every entry is
 * real and actually controlled by us — a speculative handle is a broken
 * corroboration, which is worse than no corroboration. Add to this list as
 * profiles are genuinely claimed (see docs/seo/entity-checklist.md).
 */
export const sameAs: readonly string[] = appStoreUrl ? [discordUrl, appStoreUrl] : [discordUrl];

/**
 * The Google Ads conversion tag.
 *
 * Not a secret — it is readable in the page source of every site that runs one,
 * which is why it sits here beside `discordUrl` rather than in an env var.
 *
 * ── Why it is the second measurement service and not the first ──────────────
 * `lib/analytics.ts` is Plumi's own measurement: a closed event union, no
 * profiles, no autocapture, no session recording, EU host, and a `scrub()` pass
 * that drops anything email-shaped. This tag is a different thing with a
 * different purpose — it exists to tell Google Ads which advert produced a
 * conversion, and it sets an advertising cookie to do it. Keeping the two
 * separate is deliberate: one can be switched off without the other, and the
 * privacy notice can describe them honestly because they are not the same claim.
 */
export const googleAdsId = "AW-18452791039";

/**
 * The Google Ads conversion labels for the site's two download signals.
 *
 * PLACEHOLDERS. Both are null until the founder creates the conversion actions
 * in Google Ads (Goals > Conversions > New conversion action > Website > set up
 * manually) and pastes each label, the part after the slash in
 * `send_to: 'AW-18452791039/xxxxxxxx'`, into the Vercel environment variable
 * named below, then redeploys. While a label is unset, `lib/adsConversion.ts`
 * sends nothing for it.
 *
 *   appStoreClick  someone who can install (not on a phone) pressed a download
 *                  button and left for the App Store.
 *   sendToIpad     someone on a phone sent the App Store link on to their iPad
 *                  (the share sheet completed, or a mail draft to themselves opened).
 *
 * Neither is a download. They are the last thing the website can see before the
 * App Store takes over, which is why both belong in Google Ads as conversions
 * now, and why the install itself has to come from the app (see the
 * measurement plan in the founder's report).
 */
export const googleAdsConversionLabels = {
  appStoreClick: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_APP_STORE_CLICK || null,
  sendToIpad: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_SEND_TO_IPAD || null,
} as const;
export type AdsConversion = keyof typeof googleAdsConversionLabels;

/**
 * The App Store Connect provider token (`pt=`), for Apple's own install-source
 * reporting (App Analytics > Campaigns).
 *
 * PLACEHOLDER. Null until the founder generates one campaign link in App Store
 * Connect (App Analytics > Acquisition > Campaigns > Generate Campaign Link) and
 * copies the `pt=` number from it into `NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN`.
 * Apple says the token cannot be made up by hand. While it is unset every link
 * below is the plain `appStoreUrl`, exactly as before.
 */
export const appStoreProviderToken: string | null = process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN || null;

/**
 * The campaign token (`ct=`) a link carries, by where on the site it was pressed.
 *
 * Deliberately coarse. Apple hides a campaign until it has five first-time
 * downloads, so one token per placement (there are more than a dozen) would
 * leave every row empty at launch volumes. Five buckets answer the questions
 * worth asking: does the hero convert, does the phone handoff produce installs
 * on the iPad, and does Safari's own banner do anything. At most 30 characters.
 */
export function appStoreCampaignToken(placement: string, via: "link" | "send" = "link"): string {
  if (via === "send") return "web-send-to-ipad";
  if (placement === "smart-banner") return "web-smart-banner";
  if (placement === "embed") return "web-embed";
  if (placement === "header" || placement === "sticky_mobile") return "web-header";
  if (placement === "hero" || placement.endsWith("-hero")) return "web-hero";
  return "web-page";
}

/**
 * The App Store link for one placement: `appStoreUrl` plus Apple's campaign
 * tokens once a provider token is configured, or `appStoreUrl` untouched while
 * it is not. Deterministic from the placement, so the server and the browser
 * render the same `href`.
 */
export function appStoreLink(placement: string, via: "link" | "send" = "link"): string | null {
  if (!appStoreUrl) return null;
  if (!appStoreProviderToken) return appStoreUrl;
  const url = new URL(appStoreUrl);
  url.searchParams.set("pt", appStoreProviderToken);
  url.searchParams.set("ct", appStoreCampaignToken(placement, via));
  url.searchParams.set("mt", "8");
  return url.toString();
}

/**
 * Where the tag is allowed to load.
 *
 * Production only, and never on a Vercel preview. A preview deployment firing
 * conversions into a live ad account is how a campaign learns from traffic that
 * was a developer refreshing a page, and the damage is invisible until the
 * optimiser has already spent money on it.
 *
 * Set `NEXT_PUBLIC_GOOGLE_ADS_FORCE=true` to load it locally when you need to
 * confirm the tag fires — with Google's Tag Assistant, for instance — and unset
 * it afterwards.
 */
export function googleAdsEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_GOOGLE_ADS_FORCE === "true") return true;
  if (process.env.NODE_ENV !== "production") return false;
  return process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview";
}

/** An absolute URL on the canonical domain. Schema.org wants absolute; so does OG. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, site.domain).href;
}

/**
 * Every CTA on the site reads its label, its destination and its event from
 * here, so flipping `launchMode` on launch day is a one-constant change rather
 * than a search for every button.
 *
 * `secondary` is the launch-day email capture. It is a *secondary* CTA on
 * purpose: Discord stays primary pre-launch because the point of the next
 * eleven days is a small number of real students we can actually watch use the
 * product, and an email address does not give us that. Post-launch the pair
 * inverts — the App Store becomes primary and the email becomes the handoff for
 * anyone who is not currently holding an iPad.
 */
export const cta = {
  community: {
    primary: "Join the Discord community",
    compact: "Join Discord",
    secondary: "Get notified on launch day",
    supporting: "Made for iPad. Built around you.",
    reassurance: "Launching 25 September 2026",
  },
  waitlist: {
    primary: "Get notified on launch day",
    compact: "Get notified",
    secondary: "Join the Discord community",
    supporting: "Made for iPad. Built around you.",
    reassurance: "Launching 25 September 2026",
  },
  appStore: {
    primary: "Download on the App Store",
    compact: "Download",
    secondary: "See how it works",
    supporting: "Free to write in. iPad and Apple Pencil.",
    reassurance: "Free on the App Store. Requires iPadOS 17 or later.",
  },
} as const;
export const activeCta = cta[launchMode];
export function isWaitlistMode(): boolean { return false; }
/** True once the App Store link is set: the app is out and nothing is "coming soon". */
export const appIsLive: boolean = launchMode === "appStore";

/**
 * What the primary CTA actually is, for analytics and for the markup.
 *
 * `cta_clicked` needs a stable machine name that survives a copy change —
 * counting clicks on a label is how a funnel silently resets itself the day
 * somebody rewrites a button.
 */
export type CtaKind = "discord" | "launch_notify" | "app_store";
export function primaryCtaKind(): CtaKind {
  return launchMode === "appStore" ? "app_store" : "discord";
}
/**
 * LAUNCH DAY, in order. Everything here is a content change; none of it is a
 * rebuild, which is the point of the switch above.
 *
 *   1. Set `appStoreUrl`, flip `launchMode` to `"appStore"`. The build fails if
 *      you do the second without the first, which is what `assertLaunchConfig`
 *      is for.
 *   2. Add the Smart App Banner — `<meta name="apple-itunes-app">` in the root
 *      layout. It is the highest-value single line on the day: iPadOS Safari
 *      turns it into an install button above the page.
 *   3. Rewrite the close's email capture. `LaunchNotify` currently says "one
 *      email on launch day", which stops being true at 00:01. Post-launch it
 *      becomes the desktop → iPad handoff ("send yourself the link"), and
 *      `cta.appStore.secondary` already carries that label.
 *   4. Add the App Store URL to `sameAs`, and drop `availabilityStarts` from the
 *      JSON-LD offers — the prices are already published in the Free & Pro
 *      chapter and in the graph, dated to open on launch day.
 *      **Check them against App Store Connect before the store goes live.**
 *      The local `Plumi.storekit` test configuration is not App Store Connect,
 *      and at the time of writing it disagrees with the published figures.
 *   5. Revisit `footer.honesty`. "Every screen here is drawn rather than
 *      photographed" is true today and stops being the whole truth the moment
 *      a real capture replaces a drawing.
 *   6. The countdown needs no attention. `LaunchCountdown` already handles
 *      `time.ended`.
 */
export function assertLaunchConfig(): void {
  if (launchMode === "appStore" && (!appStoreUrl || !appStoreUrl.startsWith("https://apps.apple.com/"))) {
    throw new Error("Set a verified App Store URL before switching launchMode to appStore.");
  }
}
export function primaryCtaHref(placement = "page"): string { return launchMode === "appStore" ? appStoreLink(placement)! : discordUrl; }
