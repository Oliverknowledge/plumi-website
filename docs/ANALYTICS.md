# Analytics

The website sends events to the same PostHog project as the iPad app, so
acquisition and product are one journey rather than two disconnected funnels.

Everything goes through `src/lib/analytics.ts`. Nothing else in the codebase
imports `posthog-js`.

## There is a second tag, and it is not this one

`src/components/GoogleAds.tsx` loads Google Ads conversion tracking
(`AW-18452791039`) on production only, never on a Vercel preview. It is
deliberately *not* routed through `lib/analytics.ts`: it exists to tell Google
which advert produced a conversion, it sets an advertising cookie to do it, and
it is the only thing on this website that shares data with a third party for
advertising. Keeping the two apart means either can be switched off without the
other, and the privacy notice can describe them separately because they are not
the same claim.

**Consent.** The tag runs Consent Mode v2 with every signal `denied` by default,
and `ConsentBanner` grants them on Allow (see the comment in `GoogleAds.tsx`).

**Conversions.** `src/lib/adsConversion.ts` sends two Google Ads conversions,
each only once its label is set (see the table below):

| Conversion | Fires when | Never fires |
|---|---|---|
| `appStoreClick` | an App Store button is pressed on an iPad or a computer | on a phone, which cannot install an iPad app |
| `sendToIpad` | "Send it to my iPad" completes the share sheet, or opens the email draft | when the share sheet is dismissed |

PostHog records the same moments as `app_store_clicked` and
`send_to_ipad_result` (`outcome`: sent, emailed, dismissed), so the two can be
reconciled. Neither is a download: the install happens in the App Store, out of
the website's sight, and has to be reported by the app.

**App Store campaign tokens.** Once `NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN` is
set, every App Store link, the shared send-on link and the Smart App Banner
carry `pt=`, `ct=` and `mt=8`, so App Store Connect > App Analytics > Campaigns
shows installs by website surface (`web-hero`, `web-header`, `web-page`,
`web-send-to-ipad`, `web-smart-banner`). See `appStoreCampaignToken` in
`src/config/site.ts`.

## Turning it on

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Without it the module is inert: no script is loaded, no request is made |
| `NEXT_PUBLIC_POSTHOG_HOST` | Defaults to `https://eu.i.posthog.com` |
| `NEXT_PUBLIC_GOOGLE_ADS_LABEL_APP_STORE_CLICK` | Label of the Google Ads action "App Store click (web)". Unset: nothing is sent |
| `NEXT_PUBLIC_GOOGLE_ADS_LABEL_SEND_TO_IPAD` | Label of the Google Ads action "Send to iPad (web)". Unset: nothing is sent |
| `NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN` | The `pt=` number from an App Store Connect campaign link. Unset: links stay plain |

PostHog is imported dynamically and only after a key is found, so a visitor with
no key configured — or with an ad blocker — never pays for it and never sees an
error.

## The privacy guarantee

**No email address, ever.** `track()` scrubs its payload before anything leaves
the module: any property whose key is in a forbidden list (`email`, `name`,
`address`, …) is dropped, and so is any *value* that matches an email pattern,
whatever it is called. That is a belt-and-braces measure — no call site passes
one in the first place — but it means a future call site cannot leak one by
accident.

Beyond that, the client is configured to collect as little as possible:

| Setting | Value | Why |
|---|---|---|
| `person_profiles` | `never` | The site has no accounts. A person profile would be data we have no use for and no consent for. |
| `disable_session_recording` | `true` | The only input on the site is an email field. Recording it would be recording that. |
| `autocapture` | `false` | Every event on this site is deliberate and named. |
| `capture_pageview` | `false` | Replaced by `landing_viewed`, which carries the acquisition context. |

## Events

Adding an event means adding it to the `PlumiEvent` union. There is no way to
send an unlisted one.

| Event | Fired when | Properties |
|---|---|---|
| `landing_viewed` | Once, on load, after attribution is captured | `device_class` (`mobile` / `tablet` / `desktop`), `referrer_class` (`direct` / `search` / `social` / `other`), `path` |
| `cta_clicked` | Every primary CTA and every in-page call to action | `placement` (`hero`, `header`, `close`, `sticky_mobile`), `cta_kind` (`discord` / `app_store` / `launch_notify` / `scroll`), `label`, `destination` — **the host only, never a full URL** |
| `discord_clicked` | Alongside `cta_clicked` when the destination is Discord | `placement` |
| `app_store_clicked` | Alongside `cta_clicked` when the destination is the App Store | `placement` |
| `launch_notify_started` | First interaction with the launch-day email field | `placement` |
| `launch_notify_completed` | A signup succeeded | `placement`, `has_course` — whether they told us subject/board. **Never the email, never the subject itself.** |
| `launch_notify_failed` | A signup did not succeed | `placement`, `code` (`invalid_email`, `unconfigured`, `rate_limited`, `server_error`, `network`) |
| `product_demo_interacted` | The hero media stepper and pause control | `placement`, `action`, `step` |
| `story_section_viewed` | Each section crosses the middle of the viewport | `section` (the section id), `arc` (which of the five arcs it belongs to) |
| `trust_viewed` | The trust chapter scrolls into view | — |
| `comparison_viewed` | The comparison table scrolls into view | — |
| `pricing_viewed` | The Free/Pro chapter scrolls into view | — |
| `faq_opened` | A question is expanded | `question` |

**Why `story_section_viewed` uses a middle band rather than a percentage.**
A threshold of "50% of the section is visible" is unreachable for the tall
sticky scenes, which would then never report and read as nobody having got past
the mark. The observer uses `rootMargin: -40% 0px -40%` instead, so the question
is "did this section cross the middle of the screen", which is
height-independent and a better definition of read.

**Group by `arc`, not by `section`.** The page is five arcs; where somebody
stopped is an arc-level fact, and fifteen section ids is a chart nobody reads.

`story_section_viewed` is the one that keeps the primary metric honest. A
landing variant that converts but is never read past the third section has
bought a dead list, and scroll depth is the only thing that tells the two apart.

## Acquisition context

Every event carries it, from `src/lib/attribution.ts`.

**First touch wins.** A student who arrives from a TikTok ad, leaves, and comes
back a week later from Google is still attributed to TikTok — otherwise the last
thing they clicked takes credit for the thing that actually worked. This visit's
parameters are sent unprefixed; the original touch is sent under `first_`, so
the difference stays visible.

Captured: the five `utm_*` parameters, `landing_variant`, `gclid` / `fbclid` /
`ttclid`, and the referrer's **host only** — never the full external URL.

None of this is personal data. It is the query string the student's own click
already carried.

## Landing variants

`?v=notebook` (default), `?v=decide`, `?v=mirror` select a hero. The variant is
stored with the attribution, sent on every event as `landing_variant`, and
written to the waitlist row — so a variant can be judged on signups, not just on
clicks.

Copy for all three is in `src/content/copy.ts` under `heroVariants`.

## What is not instrumented, deliberately

Scroll percentage, mouse movement, rage clicks, form field timings. They would
each need a listener on a page whose whole performance argument is that it has
almost none, and none of them would change a decision.
