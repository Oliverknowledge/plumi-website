import Script from "next/script";
import { googleAdsEnabled, googleAdsId } from "@/config/site";

/**
 * Google Ads conversion tracking. Renders nothing visible.
 *
 * This is Google's own gtag.js snippet, unchanged, loaded through `next/script`
 * rather than dropped into the document so the framework owns when it runs.
 * `afterInteractive` is the default and the right one here: the tag has to run
 * on every page but nothing on the page waits for it, and `beforeInteractive`
 * would put a third-party request ahead of Plumi's own code for no benefit.
 *
 * The inline block carries an `id`, which `next/script` requires in order to
 * track and de-duplicate it across client-side navigations.
 *
 * ── What this does that the rest of the site does not ───────────────────────
 * It sets an advertising cookie (`_gcl_au`) and shares data with Google for
 * advertising purposes. That is a different category from `lib/analytics.ts`,
 * which profiles nobody and records nothing a student types — and it is why the
 * privacy notice now names advertising cookies instead of denying them.
 *
 * **Consent.** Under UK PECR an advertising cookie needs consent before it is
 * set, and this site has no consent banner yet. The tag is deliberately written
 * as the plain snippet rather than wired to a Consent Mode default, because
 * silently defaulting every consent signal to `denied` would leave conversion
 * reporting looking broken with no visible cause. Adding a banner and Consent
 * Mode v2 is one function call away and is the next thing this file should grow.
 */
export function GoogleAds() {
  if (!googleAdsEnabled()) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-gtag" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAdsId}');`}
      </Script>
    </>
  );
}
