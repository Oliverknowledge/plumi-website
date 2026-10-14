/**
 * Google Ads conversions for the two things the website can see a student do
 * on the way to a download: leave for the App Store, or send the link on to
 * their iPad. The install itself happens in the App Store, out of the site's
 * sight; this is the strongest signal Google's bidding can have from here.
 *
 * Kept apart from `lib/analytics.ts` for the reason `GoogleAds.tsx` gives: this
 * is the advertising tag, that is Plumi's own measurement.
 *
 * Three rules, enforced here so no call site has to remember them:
 *
 *   1. **Nothing until the founder creates the action.** A conversion whose
 *      label is unset (`googleAdsConversionLabels` in `config/site.ts`) sends
 *      nothing.
 *   2. **Consent is gtag's job, and gtag must already exist.** `window.gtag` is
 *      defined by the inline block in `GoogleAds.tsx` in the same breath as the
 *      Consent Mode default of `denied`. If it is not there yet (the tag loads
 *      lazily, and never on a preview), the event is dropped rather than queued,
 *      because a `dataLayer` entry pushed ahead of that default would be read
 *      before any consent state exists. With consent denied Google receives a
 *      cookieless ping and no `_gcl_au` cookie is written; with it granted, the
 *      ordinary conversion.
 *   3. **A phone pressing the App Store button is not a conversion.** Plumi is
 *      iPad only, so that click cannot become an install. The phone's own
 *      conversion is sending the link on.
 *
 * Each conversion fires at most once per page view. Set the action's "Count" to
 * "One" in Google Ads as well, so one ad click is one conversion however many
 * buttons were pressed.
 */

import { googleAdsConversionLabels, googleAdsEnabled, googleAdsId, type AdsConversion } from "@/config/site";

type Gtag = (...args: unknown[]) => void;

const sent = new Set<AdsConversion>();

/** The same test the CSS uses to swap the badge for "Send it to my iPad", plus the phone user agents. */
function isPhone(): boolean {
  try {
    if (window.matchMedia("(pointer: coarse) and (max-width: 640px)").matches) return true;
  } catch {
    // No matchMedia: fall through to the user agent.
  }
  return /iPhone|iPod|Android.+Mobile/.test(navigator.userAgent);
}

export function reportAdsConversion(kind: AdsConversion): void {
  if (typeof window === "undefined" || !googleAdsEnabled()) return;
  const label = googleAdsConversionLabels[kind];
  if (!label || sent.has(kind)) return;
  if (kind === "appStoreClick" && isPhone()) return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  sent.add(kind);
  try {
    gtag("event", "conversion", { send_to: `${googleAdsId}/${label}` });
  } catch {
    // An advertising tag is never worth an error in a click handler.
  }
}
