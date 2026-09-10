/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE LAUNCH SWITCH
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  When Plumi ships on the App Store, change ONE thing:
 *
 *      launchMode: "waitlist"  ->  launchMode: "appStore"
 *
 *  ...and fill in `appStoreUrl` below. Every call to action on the site reads
 *  from this file, so nothing else needs to be touched: the hero button, the
 *  sticky mobile bar, the closing panel, the nav, and the analytics events all
 *  follow automatically.
 *
 *  Everything else in this file is content, not code. Copy can be edited here
 *  without opening a component.
 */

export type LaunchMode = "waitlist" | "appStore";

/** Flip this to "appStore" on launch day. */
export const launchMode: LaunchMode = "waitlist";

/**
 * Set this before flipping `launchMode`. Leaving it null in appStore mode is a
 * build-time error (see `assertLaunchConfig` below), so the site can never ship
 * with a dead download button.
 */
export const appStoreUrl: string | null = null;

export const site = {
  name: "Plumi",
  /** Canonical domain. The other domain 301s to this one at the DNS/host level. */
  domain: "https://tryplumi.app",
  alternateDomain: "https://plumi.study",
  tagline: "The notebook that learns how you learn.",
  description:
    "Plumi is an iPad notebook for GCSE and A-Level students. Write with Apple Pencil, get taught on your own page, and let every piece of work tell Plumi what you should study next.",
  /** Used for mailto: links in the footer and the privacy notice. */
  contactEmail: "hello@tryplumi.app",
  locale: "en_GB",
} as const;

/**
 * Call-to-action labels. `primary` is the button a student sees everywhere;
 * `secondary` appears only where a second action makes sense.
 */
export const cta = {
  waitlist: {
    primary: "Join the waitlist",
    /** Shorter label for the sticky mobile bar and the nav, where space is tight. */
    compact: "Join waitlist",
    supporting: "Built for iPad and Apple Pencil",
    /**
     * Shown under the closing CTA and in the sticky mobile bar. Must agree with
     * `waitlist.reassurance` in src/content/copy.ts — on a phone the two are
     * visible in the same viewport, and a page whose argument is candour cannot
     * afford to promise a different number of emails in two places.
     */
    reassurance: "Two emails, then nothing.",
  },
  appStore: {
    primary: "Download on the App Store",
    compact: "Download",
    supporting: "Free to write in. iPad and Apple Pencil.",
    reassurance: "Requires iPadOS 17 or later.",
  },
} as const;

export const activeCta = cta[launchMode];

export function isWaitlistMode(): boolean {
  return launchMode === "waitlist";
}

/**
 * Fails loudly at import time rather than shipping a download button that goes
 * nowhere. Imported by the root layout so it runs on every build.
 */
export function assertLaunchConfig(): void {
  if (launchMode === "appStore" && !appStoreUrl) {
    throw new Error(
      "[plumi] launchMode is 'appStore' but appStoreUrl is null. " +
        "Set appStoreUrl in src/config/site.ts before flipping the launch switch.",
    );
  }
}

/** Where the primary CTA points. In waitlist mode it scrolls to the form. */
export function primaryCtaHref(): string {
  return launchMode === "appStore" ? (appStoreUrl ?? "#") : "#waitlist";
}
