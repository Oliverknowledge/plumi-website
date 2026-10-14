# Google Ads install tracking for Plumi

14 October 2026. Branch `claude/bold-cerf-mn3193` in both repos. Website commit `f0e5b81` (not pushed). No app code changed.

Labels: **Known** means read in the code or quoted from a vendor doc. **Likely** means inferred from docs or standard behaviour but not verified here. **Unknown** means it needs checking.

Cost: no paid model calls and no generations. About 15 web searches and fetches, plus one local `next build`.

---

## 0. The short answer

- **Known.** Google Ads cannot be told about an App Store download caused by a website campaign. The chain is ad click, then tryplumi.app, then the App Store, then the install, and no Google identifier survives the App Store hop. Plumi's app reads utms only from links it opens itself (`Sources/PlumiKit/Analytics/Attribution.swift:104`). A web campaign therefore gets an install number in only two ways: a proxy conversion (built today), or Google's modelling once the app reports installs to Google.
- **Known.** "Report downloads" in Google Ads requires the app to tell Google about first opens. That means Firebase (Google Analytics for Firebase), a paid App Attribution Partner, or Google's standalone on-device SDK feeding the App Conversion API. The most useful install number would come from an **iOS App campaign**, which sends people straight to the App Store and is credited through SKAdNetwork, on-device measurement and modelling.
- **Known.** All of those routes put a Google SDK, or a Google data flow, into an app whose privacy page says "No advertising, no advertising identifiers" (`Sources/PlumiKit/Features/Paywall/PaywallLegalView.swift:193`). Whether to do that is the founder's call, so this report specifies the change without making it.

---

## 1. Current state

### Website (`/home/user/plumi-website`)

| Item | State | Ref |
|---|---|---|
| Google tag | `AW-18452791039`, gtag.js via `next/script` `lazyOnload`, production only (never on a Vercel preview) | `src/config/site.ts:87`, `:101-105`; `src/components/GoogleAds.tsx:29-46` |
| Consent | Consent Mode v2 with all four signals `denied` by default, granted from `localStorage` or the banner's Allow button | `GoogleAds.tsx:40-41`, `src/components/ConsentBanner.tsx:41-46`, `src/lib/consent.ts:2` |
| Conversion labels | **None existed before this commit.** The only gtag calls were `consent`, `js` and `config`. No `event`, `conversion` or `send_to` call appeared anywhere. | grep over `src/` (Known) |
| "Purchase" conversion | **Not wired to anything.** There is no web purchase, and no code fires one. | Known |
| Badge click (iPad or desktop) | `cta_clicked` (`cta_kind: app_store`) plus `app_store_clicked`, PostHog only | `src/components/ui/CtaButton.tsx:20-25` (pre-commit), `src/components/home/AppStoreBadge.tsx:55,90` (pre-commit) |
| Send to iPad (phone) | `cta_clicked` (`cta_kind: send_to_ipad`) on tap, PostHog only. Whether the share sheet completed was never recorded. | `AppStoreBadge.tsx:22-30` (pre-commit) |
| Email fallback | `cta_clicked` (`cta_kind: email_to_ipad`), PostHog only | `AppStoreBadge.tsx:65` (pre-commit) |
| Older pages | `CtaButton` links straight to the App Store on **every** device, phones included (`sticky_mobile`, subject pages) | `src/components/StickyCta.tsx:60`, `src/components/MarketingPage.tsx:47,85` |
| Smart App Banner | `app-id=6811389052`, no campaign tokens | `src/app/layout.tsx:44` (pre-commit) |
| Attribution | First and session touch, utms plus `gclid`/`fbclid`/`ttclid`. **`gbraid`/`wbraid` are not captured** (iOS Google Ads clicks often carry these instead of gclid). This only affects PostHog. Google's own tag reads the URL itself. | `src/lib/attribution.ts:77-87` |
| `docs/ANALYTICS.md` | Said "It has no consent gate yet", which was stale. Fixed in this commit. | |

**Why "Purchase" is Unverified (Known, from Google's own definitions).** Google shows Unverified when it has never seen the tag fire for that action. Nothing on the site fires a purchase event, and nothing could, because there is no web checkout. **Likely**: the action was auto-created by the Google Ads setup flow, which defaults to a "Purchase" goal. If it is Primary and the campaign bids on conversions, the bidder has been optimising against zero events. **Action:** remove it, or at least set it to Secondary. It can never become true on the web.

### App (`/home/user/plumi`)

| Item | State | Ref |
|---|---|---|
| Firebase / GA4 | **Absent** (no package, no `GoogleService-Info.plist`) | `project.yml:48-57` packages are Superwall, PostHog and RevenueCat only |
| Google Mobile Ads / on-device conversion SDK | Absent | Known |
| AdServices / AdAttributionKit / SKAdNetwork | Absent (no import, no call) | Known |
| `NSUserTrackingUsageDescription` (ATT) | Absent | `Sources/Plumi/Info.plist` (whole file), `project.yml:152-226` |
| `SKAdNetworkItems` | Absent | same |
| Privacy manifest | `NSPrivacyTracking false`, no tracking domains, every data type `Tracking: false` | `Sources/Plumi/PrivacyInfo.xcprivacy:33-36` |
| Privacy claim | "No advertising, no advertising identifiers, no selling of your work, and no training of any AI model on what you write." | `Sources/PlumiKit/Features/Paywall/PaywallLegalView.swift:193` |
| PostHog init | `PostHogSDK.shared.setup(config)`, called from `AppState.boot` via `state.startAnalytics()` | `Sources/PlumiKit/Analytics/PostHogSink.swift:29,83`; `Sources/PlumiKit/Core/AppState.swift:665` |
| Superwall init | Observe-only (`shouldObservePurchases = true`). **Never presents a paywall.** The paywall is Plumi's own StoreKit view. | `Sources/PlumiKit/Core/SuperwallObserver.swift:73-89` (configure at `:81`); `AppState.swift:668` |
| RevenueCat | **Present in the project** as a package and a target dependency, with `Purchases.configure` in one file. It is not used when Superwall is configured (`AppState.swift:347-349`). Noted only as a fact. Not proposed. | `project.yml:55-57,259`; `Sources/PlumiKit/Core/RevenueCatSubscriptions.swift:42` |
| First open | `app_installed` (once, on first ever launch, with `acquisition_source`), then `app_opened` with `days_since_install` | `Sources/PlumiKit/Analytics/PlumiAnalytics.swift:71-80`; event names `Sources/PlumiKit/Analytics/AnalyticsEvent.swift:25-26` |
| Purchase | `trial_started` and `purchase_completed` (idempotent per subscription period), `subscription_active`, `subscription_renewed` | `Sources/PlumiKit/Features/Paywall/PaywallFlow.swift:117,123`; `Sources/PlumiKit/Core/Subscriptions.swift:273`; `AnalyticsEvent.swift:208-221` |
| Self-reported source | Survey answers include "An ad" and "YouTube" | `Attribution.swift:55-72` |

---

## 2. Options, researched

### (a) Firebase (GA4) for iOS linked to Google Ads

- **Known.** Google recommends the GA4 for Firebase SDK as the iOS conversion source. It captures `first_open` automatically, and "Firebase SDK automatically integrates with SKAdNetwork" ([About mobile app conversion tracking](https://support.google.com/google-ads/answer/6100665)).
- **Known.** On-device conversion measurement (ODM) is part of `FirebaseAnalytics` from v11.14.0. It comes in two flavours:
  - **Event data:** no PII. It can be disabled with `GOOGLE_ADS_ON_DEVICE_CONVERSION_EVENT_DATA_ENABLED = NO`.
  - **First-party data:** needs a *consented* user email or phone, and is "never sent off the device in a way that can identify the user".
  - Google describes ODM for **iOS App campaigns** ([Firebase tutorial](https://firebase.google.com/docs/tutorials/ads-ios-on-device-measurement); [Google Ads 12119136](https://support.google.com/google-ads/answer/12119136)). Google's Apps guide cites Firebase 12.12.1 as the minimum for ODM ([The Apps Four](https://business.google.com/us/accelerate/resources/articles/the-apps-four/)). **Known**: Firebase 13.0.0 shipped on 7 October 2026 and is Swift Package Manager only.
- **What works without ATT (Likely):** `first_open` counts, SKAdNetwork postbacks, ODM event data and Google's modelled iOS conversions. Without ATT there is no IDFA-based deterministic match. Google's pages do not say ATT is required for ODM.
- **Unknown:** whether the current Firebase product links `AdSupport`/IDFA by default. Verify after integrating by confirming the binary does not link `AdSupport.framework`.
- **Consent (Likely):** UK and EEA users need `ad_user_data` consent for Google to use their data for ads measurement. Consent Mode for apps uses `Analytics.setConsent` plus Info.plist defaults.

### (b) SKAdNetwork / AdAttributionKit

- **Known.** Google's SKAdNetwork ID is `cstr6suwn9.skadnetwork`. It goes in `SKAdNetworkItems` ([Google privacy strategies](https://developers.google.com/ad-manager/mobile-ads-sdk/ios/ios14)).
- **Known.** Google Ads reads only **fine** conversion values (0 to 63), and the schema is set via GA4, an App Attribution Partner or the Google Ads API ([Set up your SKAdNetwork conversion value schema](https://support.google.com/google-ads/answer/13286653)).
- **Known.** SKAN and AdAttributionKit credit **ads that lead to the App Store**: App campaign ads, or web ads in Safari (iOS 16.1+), by networks that sign them ([SKAdNetwork for Web Ads](https://developer.apple.com/documentation/skadnetworkforwebads); [AdAttributionKit](https://developer.apple.com/app-store/ad-attribution/)).
- **Likely.** They do **not** credit a Search ad that lands on tryplumi.app. The site's own badge is not a signed ad.
- **Known.** No data leaves the device to Google. Apple sends the postback. This is the most privacy-safe piece, and Apple does not treat it as tracking.
- **Unknown:** whether Google lets you create an iOS App campaign with only SKAN (no Firebase or partner) and a schema set through the Ads API. In practice, assume Firebase.

### (c) App campaigns versus the current web campaigns

- **Known.** App campaigns are the Google Ads type built to count and bid on installs (target CPI/CPA, "optimized to count app downloads") ([6100665](https://support.google.com/google-ads/answer/6100665)).
- **Likely.** A Search or PMax campaign that sends people to tryplumi.app cannot be deterministically credited with an iOS install. With Firebase linked, Google *may* model some cross-property credit, but do not plan on seeing it.
- **Known.** "Web to App Connect" (Search, Shopping, PMax, YouTube and Demand Gen since September 2025) is about **deep-linking people who already have the app** and measuring in-app actions. It does not attribute installs ([ppc.land summary](https://ppc.land/google-expands-web-to-app-connect-across-multiple-campaign-types/)).
- **Known.** Google notes that Search conversion tracking for app engagement needs a GCLID ([9260620](https://support.google.com/google-ads/answer/9260620)).
- **Unknown.** Most ad traffic lands on phones, and a phone cannot install Plumi. Before spending on an iOS App campaign, check whether Google limits it to devices that can install an iPad-only app (`TARGETED_DEVICE_FAMILY = 2`), or whether it also serves on iPhones.

### (d) App Store Connect campaign links (pt / ct)

- **Known** ([Apple: Manage campaigns](https://developer.apple.com/help/app-store-connect/view-app-analytics/manage-campaigns)):
  - `pt` (provider token, generated once in App Store Connect, cannot be made up), `ct` (≤ 30 characters) and `mt=8`.
  - A first-time download counts if it happens within **24 hours** of using the link, and the latest link wins.
  - A campaign appears only after **24 hours** and **5 first-time downloads**. Small rows are withheld.
  - Tokens can also go into the Smart App Banner.
- **Likely.** The `affiliate-data=pt=…&ct=…&mt=8` banner syntax is confirmed by forum examples, not by the page text, which could not be fetched.
- **Limits:**
  - **Unknown:** whether App Analytics counts only users who opted in to share with developers. Historically it did. Apple's 2025 analytics changes may differ.
  - **Likely:** a link sent from a phone and tapped on the iPad still carries `ct`, so the 24-hour window starts when the iPad opens it.
  - **Known:** none of this ever reaches Google Ads. It is Apple-side reporting only.
- **Likely.** App Analytics also shows a "Web Referrer" source with referring domains for free, so tryplumi.app should already appear there.

### (e) Website micro-conversions (implemented, see section 4)

- **Known.** A gtag `conversion` event with `send_to: 'AW-…/label'` respects Consent Mode. With consent denied Google gets a cookieless ping and can model. With consent granted it gets the full conversion.
- **Likely.** The modelling has volume thresholds.
- These are proxies: bidding will look for button pressers, not installers. They are still far better than optimising toward an action that never fires.

### (f) Forwarding purchases server-side

- **Known.** Superwall's Google Ads integration is listed as "coming soon". Its Firebase integration forwards `purchase`, `trial_start` and similar events through the GA4 Measurement Protocol, but **requires `firebaseAppInstanceId` from the Firebase SDK in the app** ([Superwall: Firebase](https://superwall.com/docs/integrations/firebase.md); [integrations list](https://superwall.com/docs/integrations/mmp.md)).
- **Likely.** App Store Server Notifications V2 sent to a Supabase function and then on to Google faces the same need: Google Ads offline import needs a gclid, gbraid or wbraid, or a hashed email captured with the click. GA4 Measurement Protocol needs `app_instance_id`. Neither exists for a website, App Store, app journey.
- **Conclusion (Likely):** every purchase route to Google Ads goes through Firebase in the app. With Firebase in, Superwall's Firebase integration is the cheapest way to send trial and purchase events, because it uses server-side truth and handles refunds.

### (g) The "Purchase" conversion

Covered in section 1. **Remove it, or set it to Secondary.** Do not try to make it fire.

---

## 3. Recommended plan, ranked by signal value per effort

| # | What | Signal | Effort | Privacy change | Status |
|---|---|---|---|---|---|
| 1 | Demote or remove "Purchase". Create two web conversions and make them Primary. | Bidding gets a real signal today | 15 min of clicks | None beyond the existing tag | Code **done**. Founder must click. |
| 2 | App Store Connect campaign link, then put `pt` in Vercel | Installs by site surface, including send-to-iPad installs, in App Analytics (not Google) | 10 min | None (Apple-only) | Code **done**. Founder must click. |
| 3 | Founder decision: Firebase Analytics in the app, linked to Google Ads, `first_open` plus trial and purchase imported, SKAN ID in Info.plist | Real install and trial counts in Google Ads. Unlocks an iOS App campaign, SKAN and ODM. | 1 to 2 days of app work plus App Review | **Yes**: App Privacy label, in-app privacy copy, likely an in-app consent question. Children's Code exposure. | Spec below. **Not done.** |
| 4 | If #3: Superwall to Firebase integration for server-truth trial and purchase | Revenue-grade conversions, refunds handled | 30 min dashboard | Covered by #3 | Not done |
| 5 | If #3: test an iOS App campaign alongside the web campaign | Install-optimised bidding | Budget decision | — | Not done |
| — | SKAN-only (Info.plist plus on-device conversion values, no Google SDK) | Only credits App campaigns, and Google still needs a schema source | Low code | Minimal | Only worth it if #3 is refused **and** an App campaign can run without Firebase (Unknown) |

### What Google Ads will and won't see

- **After #1 (Known):** App Store button presses on iPad and desktop, and completed "send to iPad" actions, as conversions on the web campaign (modelled where consent is denied). It will **not** see installs.
- **After #3 (Likely):** for App campaigns, it sees installs (`first_open`), trials and purchases, through SKAN postbacks, ODM and modelling. For web campaigns, still no deterministic install credit. Some modelled credit is possible but should not be relied on.
- **Never:** which individual student installed. That is a feature, not a gap.

### Founder click-by-click

**A. Google Ads: the two web conversions (do now)**

1. Google Ads → **Goals → Conversions → Summary → + Create conversion action → Website**. Enter `tryplumi.app` → scan.
2. Choose **"+ Add a conversion action manually"**.
   - **Category:** *Outbound click*.
   - **Name:** `App Store click (web)`.
   - **Value:** "Don't use a value", for now.
   - **Count:** **One**.
   - **Click-through window:** 30 days. **Engaged-view:** 3 days.
   - **Attribution:** Data-driven.
   - Save.
3. Repeat with **Category:** *Other* (or *Contact*), **Name:** `Send to iPad (web)`, the same settings.
4. For each action: **Tag setup → Use Google tag → "Install the tag yourself"**. The event snippet shows `send_to: 'AW-18452791039/XXXXXXXX'`. Copy the part **after the slash**.
5. Vercel → plumi-website project → **Settings → Environment Variables** (Production only):
   - `NEXT_PUBLIC_GOOGLE_ADS_LABEL_APP_STORE_CLICK` = first label
   - `NEXT_PUBLIC_GOOGLE_ADS_LABEL_SEND_TO_IPAD` = second label
6. **Redeploy** Production. `NEXT_PUBLIC_` values are baked in at build time.
7. **Goals → Conversions → Summary:**
   - In the goal that contains **Purchase**, open it and either **remove** the action or set the goal to **Secondary** ("Edit goal" → uncheck "Use as account-default goal").
   - Make the two new actions' goals **Primary / account-default**.
   - In each web campaign → **Settings → Goals**, confirm it uses account-default goals.
8. Verify: Google Ads → the action → **Troubleshoot → Tag Assistant**. Open tryplumi.app on an iPad or desktop, tap **Allow** on the banner, then tap the badge. On a phone, use "Send it to my iPad" and complete a share. The status changes from Unverified within a few hours.
9. Bidding: with low volume, use **Maximize conversions** with no tCPA until there are about 30 or more conversions in 30 days.

**B. App Store Connect: the campaign token (do now)**

1. App Store Connect → **Apps → Plumi → Analytics** (App Analytics) → **Acquisition → Campaigns** → **Generate Campaign Link**. The UI moves, so this step is Likely rather than Known.
2. Campaign name `web-hero`, then generate. From the generated URL, copy the number after `pt=`.
3. Vercel: `NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN` = that number, then redeploy. The site then sends `ct` = `web-hero`, `web-header`, `web-page`, `web-send-to-ipad` or `web-smart-banner` by itself. No other campaign needs creating, because Apple shows any `ct` it sees.
4. Read results after five or more downloads per bucket: **Analytics → Metrics → Add Filter → Campaign**. Also look at **Sources → Web Referrer**.

**C. Firebase plus Google Ads app conversions (only if decision #1 below is yes)**

1. console.firebase.google.com → **Add project** "Plumi". Enable Google Analytics, choose or create a GA4 property, and set the data region to UK/EU.
2. **Add app → iOS**:
   - Bundle ID `dev.plumi.app`.
   - App Store ID `6811389052`.
   - Download `GoogleService-Info.plist` (hand it to the developer; it is not committed, see the app spec).
3. GA4 Admin → **Data display → Events**: once events arrive, mark `first_open`, `start_trial` and `purchase` as **Key events**.
4. GA4 Admin → **Data collection → Google signals: off**. Turn **ads personalisation off** for all regions (Data collection → Data collection for ads personalisation → disable).
5. GA4 Admin → **Product links → Google Ads links → Link** → choose the AW account → enable auto-tagging.
6. GA4 Admin → **Data streams → iOS stream → SKAdNetwork conversion value schema**. Let GA4 manage it, mapping first_open, first mark, trial and purchase.
7. Google Ads → **Goals → Conversions → + → App → Google Analytics 4 properties (Firebase) → iOS**. Import `first_open`, `start_trial` and `purchase`. Make `start_trial` Primary for an App campaign. Use `first_open` as Primary only if trials are too sparse.
8. Google Ads → **Linked accounts → Google Analytics (GA4) & Firebase**: confirm the link.
9. Superwall dashboard → **Integrations → Firebase**:
   - Firebase App ID plus Measurement Protocol API secret (GA4 Admin → Data streams → iOS → Measurement Protocol API secrets → Create).
   - `anonymous_user_behavior: send`.
10. Optional test: **Campaigns → + → App promotion → App installs → iOS → Plumi**, a small budget, UK, bidding on `start_trial`.

### Code changes per repo

- **Website (done, `f0e5b81`).** See section 4.
- **App (not done; exact change set):**
  1. **`project.yml` packages:** add
     `Firebase: { url: https://github.com/firebase/firebase-ios-sdk, from: 12.x.y }`. Pin a minor version per the file's own rule (`project.yml:46-47`). Pick the latest 12.x of at least 12.12.1, or 13.0.x once it has had two or more weeks of fixes.
     Then add to the `Plumi` target dependencies:
     `- package: Firebase / product: FirebaseAnalytics`. Do not add `GoogleAppMeasurementIdentitySupport` or `AdSupport`.
  2. **`project.yml` `info.properties`** (these write `Sources/Plumi/Info.plist`):
     ```yaml
     SKAdNetworkItems:
       - SKAdNetworkIdentifier: cstr6suwn9.skadnetwork
     GOOGLE_ANALYTICS_ADID_COLLECTION_ENABLED: false
     GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_PERSONALIZATION_SIGNALS: false
     GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_USER_DATA: false      # consent mode default, granted in-app
     GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_STORAGE: false
     GOOGLE_ANALYTICS_DEFAULT_ALLOW_ANALYTICS_STORAGE: true
     GOOGLE_ADS_ON_DEVICE_CONVERSION_EVENT_DATA_ENABLED: true # set false to refuse ODM event data
     FIREBASE_ANALYTICS_COLLECTION_ENABLED: true
     ```
     Optionally add `NSAdvertisingAttributionReportEndpoint` only if Plumi wants its own copy of postbacks. Not needed.
     No `NSUserTrackingUsageDescription`: do not ask ATT.
  3. **`GoogleService-Info.plist`:** inject it like the other keys. Values from `PLUMI_FIREBASE_*` build settings via `tools/secrets-xcconfig.sh`, or a copy-phase script, so it is not committed. `FirebaseApp.configure()` fails loudly without it, so guard it the same way `AnalyticsConfiguration.secret` ignores unsubstituted `$` values.
  4. **New `Sources/PlumiKit/Analytics/FirebaseAdsSink.swift`.**
     - It is the only file that imports `FirebaseCore`/`FirebaseAnalytics`, all behind `#if canImport(FirebaseAnalytics)`. Add a grep to `tools/regress.sh` as for PostHog.
     - `configure()` calls `FirebaseApp.configure()`, then `Analytics.setConsent([.adUserData: granted ? .granted : .denied, .adStorage: .denied, .adPersonalization: .denied, .analyticsStorage: .granted])`.
     - It forwards a **whitelist only**:
       - `trial_started` → `Analytics.logEvent("start_trial", parameters: [AnalyticsParameterValue: price, AnalyticsParameterCurrency: "GBP"])`
       - `purchase_completed` → `AnalyticsEventPurchase` with value and currency, plus `transaction_id`, the existing once-key
       - `first_question_completed` → `"first_mark"`, the activation signal and a good SKAN value
     - No other properties, no account id, no `setUserID`. `first_open` is automatic.
  5. **Init location:** `AppState.boot` directly after `state.startAnalytics()` (`Sources/PlumiKit/Core/AppState.swift:665`) and **before** `state.superwall.configure()` (`:668`). Fan out from `PlumiAnalytics.track` (`Sources/PlumiKit/Analytics/PlumiAnalytics.swift`) to the second sink, whitelist-filtered.
  6. **Superwall bridge** (if using the Superwall to Firebase integration): in `SuperwallObserver.updateAttributes`, set `firebaseAppInstanceId = Analytics.appInstanceID()` as early as possible (`SuperwallObserver.swift:81-87`). Superwall's rule: before any purchase. Then the app-side `purchase` log in step 4 should be dropped to avoid double counting. **Pick one source.**
  7. **Consent UI:** one question asked once (matching the "consent asked once" promise): "Can Plumi tell Google when an advert brought you here? Nothing you write is included." Default **no**. Store the answer and call `Analytics.setConsent` on change. With "no", Google still gets `first_open` for analytics plus SKAN postbacks (Apple), but no ad user data.
  8. **Privacy manifest (`Sources/Plumi/PrivacyInfo.xcprivacy`):** add the `NSPrivacyCollectedDataTypePurposeDeveloperAdvertising` purpose to Product Interaction (`:76-87`), Purchase History (`:136+`) and Device ID (new entry: the Firebase app instance id). **Unknown** whether `NSPrivacyTracking` must become true. Google positions Firebase without IDFA plus ODM as not requiring ATT, but Apple defines tracking as linking app data with other companies' data for ad measurement. Get a decision before submission.
  9. **Copy:** `PaywallLegalView.swift:193` must change. For example: "No ads in Plumi, no advertising identifiers, no selling of your work, and no training of any AI model on what you write. If you allow it, Plumi tells Google when one of its adverts led to your download." Also update the website `src/content/legal.ts` section "The app is separate" if the app privacy text changes. No em dashes.

### App Store privacy label and ATT implications

- **Today (Known):** the label says no tracking, and the data types are analytics and app functionality.
- **With Firebase (Likely):** the label needs "Product Interaction", "Purchases" and "Identifiers: Device ID" marked as used for **Developer's Advertising or Marketing** and **Analytics**, and shared with Google (a third-party partner).
- **"Used to track you": Unknown.** If yes, ATT and `NSUserTrackingUsageDescription` are required, and the prompt itself would contradict the brand promise.
- **Children's Code (Likely):** most users are 14 to 18. The UK Age Appropriate Design Code expects high-privacy defaults and profiling off by default, which is why the consent question above defaults to **no**.
- **SKAN entry alone (Known):** not tracking, and no label change.

---

## 4. What was committed (website, `f0e5b81`, not pushed)

| File | Change |
|---|---|
| `src/lib/adsConversion.ts` (new) | `reportAdsConversion("appStoreClick" \| "sendToIpad")`. It sends `gtag('event','conversion',{send_to:'AW-18452791039/<label>'})` **only** when all of these hold: production (`googleAdsEnabled`), the label is set, `window.gtag` already exists (so the Consent Mode default has been pushed; nothing is queued ahead of it), at most once per page view, and, for `appStoreClick`, **not on a phone** (the same `(pointer: coarse) and (max-width: 640px)` test as the CSS, plus the iPhone/Android-mobile user agent). |
| `src/config/site.ts:109-160` | `googleAdsConversionLabels` read from `NEXT_PUBLIC_GOOGLE_ADS_LABEL_APP_STORE_CLICK` / `_SEND_TO_IPAD` (**placeholders, null**). `appStoreProviderToken` read from `NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN` (**placeholder, null**). `appStoreCampaignToken(placement, via)` makes five coarse `ct` buckets. `appStoreLink(placement, via)` adds `pt/ct/mt=8` only when the token is set, and is otherwise the plain `appStoreUrl`. `primaryCtaHref(placement)`. |
| `src/components/ui/CtaButton.tsx:20-29` | `noteCtaClick` with `kind === "app_store"` also reports `appStoreClick`. The `CtaButton` href is per placement. |
| `src/components/home/AppStoreBadge.tsx:20-42,77` | Per-placement hrefs. The shared or emailed link uses the `web-send-to-ipad` token, so an install on the iPad can be counted by Apple. New `noteSendResult` records PostHog `send_to_ipad_result` (sent, emailed or dismissed) and reports `sendToIpad` for sent or emailed only. |
| `src/lib/analytics.ts` | New event `send_to_ipad_result` in the closed union. |
| `src/app/layout.tsx:43-49` | The Smart App Banner gains `affiliate-data=pt=…&ct=web-smart-banner&mt=8` only when the token is set. Verified unchanged in the built HTML while unset. |
| `src/content/legal.ts:25` | The privacy notice now says the Ads tag also learns "whether they then went to the App Store or sent the link to their iPad". |
| `docs/ANALYTICS.md` | Stale "no consent gate" note replaced. Conversions, campaign tokens and the three new env vars documented. |

Checks:
- `npx tsc --noEmit`: clean.
- `npx eslint src`: clean.
- `next build`: succeeds.
- No em or en dashes added (checked over the diff).
- The link builder was exercised with and without a token. Without one, every URL equals `appStoreUrl` exactly.

Known limitations:
- **Known.** The tag loads `lazyOnload`, so a click in the first second or two, before the page is idle, sends no conversion. Moving `GoogleAds.tsx` to `afterInteractive` would fix this at some performance cost. Left as is.
- **Known.** PostHog's `destination` on `send_to_ipad` now includes the tokens, which is harmless (no personal data).
- **Known.** `gbraid`/`wbraid` are still not captured in `attribution.ts`. This only affects PostHog.

---

## 5. Decisions for the founder

1. **Put a Google SDK (Firebase Analytics) in the app?** This is the only route to downloads in Google Ads. The cost is an App Privacy label change, rewritten in-app privacy copy, a consent question, and a possible "tracking" classification (Unknown). Recommended: yes, but ad-user-data consent default **off**, no IDFA, no ATT, whitelisted events only. Alternatively, no, and accept proxy conversions plus App Store Connect campaign data.
2. **Run an iOS App campaign** next to the web campaign? Only meaningful after decision 1.
3. **Which event the App campaign bids on:** `start_trial` (recommended, closer to revenue) or `first_open` (more volume).
4. **Values on the web micro-conversions:** none, recommended until there is volume. Alternatively, equal values.
5. **Superwall to Firebase versus the app logging the purchase itself:** pick one, never both.
6. **Remove "Purchase" or keep it as Secondary:** recommended remove.
7. Whether to move the Google tag to `afterInteractive` so early clicks count.

## Sources

- [About mobile app conversion tracking (Google Ads)](https://support.google.com/google-ads/answer/6100665)
- [On-device conversion measurement tutorial (Firebase)](https://firebase.google.com/docs/tutorials/ads-ios-on-device-measurement)
- [Standalone on-device conversion SDK (Google Ads)](https://support.google.com/google-ads/answer/16384720)
- [On-device conversion measurement for iOS App campaigns](https://support.google.com/google-ads/answer/12119136)
- [The Apps Four (Google)](https://business.google.com/us/accelerate/resources/articles/the-apps-four/)
- [SKAdNetwork conversion value schema (Google Ads)](https://support.google.com/google-ads/answer/13286653)
- [Prepare privacy strategies / SKAdNetwork IDs (Google)](https://developers.google.com/ad-manager/mobile-ads-sdk/ios/ios14)
- [Set up conversions for App campaigns for engagement (GCLID note)](https://support.google.com/google-ads/answer/9260620)
- [FAQs about iOS 14 changes (Google Ads)](https://support.google.com/google-ads/answer/10625151)
- [Unverified / inactive conversion actions (Google Ads)](https://support.google.com/google-ads/answer/10989978)
- [Web to App Connect expansion (ppc.land)](https://ppc.land/google-expands-web-to-app-connect-across-multiple-campaign-types/)
- [Manage campaigns, App Analytics (Apple)](https://developer.apple.com/help/app-store-connect/view-app-analytics/manage-campaigns)
- [Smart App Banner and campaign link (Apple forums)](https://developer.apple.com/forums/thread/803466)
- [AdAttributionKit (Apple)](https://developer.apple.com/app-store/ad-attribution/)
- [SKAdNetwork for Web Ads (Apple)](https://developer.apple.com/documentation/skadnetworkforwebads)
- [Superwall Firebase integration](https://superwall.com/docs/integrations/firebase.md)
- [Superwall integrations](https://superwall.com/docs/integrations/mmp.md)
