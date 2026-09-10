# Analytics

The website sends events to the same PostHog project as the iPad app, so
acquisition and product are one journey rather than two disconnected funnels.

Everything goes through `src/lib/analytics.ts`. Nothing else in the codebase
imports `posthog-js`.

## Turning it on

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Without it the module is inert: no script is loaded, no request is made |
| `NEXT_PUBLIC_POSTHOG_HOST` | Defaults to `https://eu.i.posthog.com` |

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
| `landing_viewed` | Once, on load, after attribution is captured | — |
| `hero_waitlist_clicked` | Any primary CTA, in waitlist mode | `placement` (`hero`, `header`, `sticky`, …) |
| `app_store_clicked` | Any primary CTA, in App Store mode | `placement` |
| `waitlist_started` | First interaction with the email field | — |
| `waitlist_completed` | A signup succeeded | `has_course` — whether they told us subject/board. **Never the email, never the subject itself.** |
| `waitlist_failed` | A signup did not succeed | `code` (`invalid_email`, `unconfigured`, `rate_limited`, `server_error`, `network`, `empty`) |
| `product_demo_interacted` | The AI Pen demo, the comparison switcher, the secondary CTA | `placement`, `action` |
| `comparison_viewed` | The head-to-head scrolls into view | `placement`, `alternatives` |
| `free_pro_viewed` | The Free/Pro block scrolls into view | — |
| `story_section_viewed` | Each section reaches 50% visibility | `section` (the section's id) |
| `faq_opened` | A question is expanded | `question` |

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
