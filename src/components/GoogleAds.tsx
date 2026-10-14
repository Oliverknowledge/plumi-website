import Script from "next/script";
import { googleAdsEnabled, googleAdsId } from "@/config/site";
import { CONSENT_KEY } from "@/lib/consent";

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
 * set, and most visitors here are 15 to 18. So the tag runs Consent Mode v2 with
 * every signal `denied` by default: no `_gcl_au` cookie is written, and Google gets
 * only cookieless pings it can model conversions from. A visitor who taps Allow in
 * `ConsentBanner` is granted, and the choice is remembered on their device.
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
gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 });
try { if (localStorage.getItem('${CONSENT_KEY}') === 'granted') gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' }); } catch (e) {}
gtag('js', new Date());
gtag('config', '${googleAdsId}');`}
      </Script>
    </>
  );
}
