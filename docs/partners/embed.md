# Embedding the question bank

A partner site can show Plumi's question list for any topic in an iframe. The questions, mark schemes and examiner's reports stay on Plumi's domain; the partner only holds a frame. Plumi can switch any partner, or all of them, off.

## For a partner (examnoob)

Take a topic page's address, `https://tryplumi.app/question-bank/<subject>/<topic>`, change `question-bank` to `embed/question-bank`, and add `?ref=<your id>`.

```html
<iframe
  src="https://tryplumi.app/embed/question-bank/aqa-a-level-chemistry/amount-of-substance?ref=examnoob"
  title="Practice questions from Plumi"
  width="100%" height="800" style="border:0" loading="lazy"></iframe>
```

Optional: this makes the frame grow and shrink to fit the questions, so it never scrolls inside itself. Put it once on the page, anywhere.

```html
<script src="https://tryplumi.app/embed.js" async></script>
```

Without the script, the frame keeps the `height` you gave it and scrolls inside. Nothing else breaks.

Notes for the partner:

- The frame only loads on the sites Plumi has approved for your id. On any other site it stays blank.
- The `ref=` must be on the iframe address. Without it, or with an id Plumi doesn't know, the frame stays blank.
- The frame follows the visitor's light or dark setting. It sets no cookies and writes nothing to the visitor's storage.
- Every question has a link to Plumi. On an iPhone or iPad it opens the App Store listing; anywhere else it opens the same topic on tryplumi.app. Both open in a new tab.

## For Plumi: the allowlist

One file: `src/config/embedPartners.ts`. It maps a partner id to the exact origins allowed to frame the embed.

```ts
export const embedPartners = {
  examnoob: ["https://examnoob.co.uk", "https://www.examnoob.co.uk"],
};
```

| To | Do |
| --- | --- |
| Add a partner | Add a line. The id is lowercase letters, digits and hyphens (32 at most). List each origin exactly: scheme and host, no path, no trailing slash, no wildcard. `www.` and the bare domain are separate origins; list both. Deploy. |
| Add an origin (a staging site, say) | Add it to that partner's array. Deploy. |
| Remove a partner | Delete its line. Deploy. Its frames stop loading, because the page now answers `frame-ancestors 'none'` for that id. |
| Kill every embed now | Set `EMBEDS_DISABLED=true` in the Vercel project and redeploy. Or empty the object. Either way every id gets `frame-ancestors 'none'`. |

Removing a partner does not delete or unpublish anything: the embed URLs still exist, and anyone can open one in their own tab. They just can't be drawn inside another site.

## How it enforces this

- `src/proxy.ts` runs in front of every `/embed/*` request, reads `?ref=`, and sets `Content-Security-Policy: frame-ancestors <that partner's origins>`. An unknown or missing `ref` gets `frame-ancestors 'none'` and `X-Frame-Options: DENY`. It also sets `X-Robots-Tag: noindex, nofollow`.
- `next.config.ts` keeps `X-Frame-Options: DENY` on every path except `/embed/`. Nothing else is loosened. `/embed.js` and the whole of `/question-bank` are still unframeable.
- The page itself is `noindex, nofollow` and its canonical is the normal topic page, so any search credit goes to Plumi's own URL.
- The root layout's nav, footer, structured data, ad tag, cookie question and Vercel analytics are switched off under `/embed/` (`src/components/SiteOnly.tsx`).

## Auto-height

The embedded page posts one message to its parent: `{ plumiEmbedHeight: <number> }`, sent to the parent's origin when the browser reveals it. `public/embed.js` accepts a message only when `event.origin` is the origin it was loaded from (Plumi's) and `event.source` is the window of one of the page's own iframes. It then sets that iframe's `style.height`. It sends nothing back.

## Tracking

Every link out of the embed (each question's link, and "Powered by Plumi") carries:

| Parameter | Value |
| --- | --- |
| `ref` | the partner id from the iframe address (`direct` if it was opened without one) |
| `topic` | the topic's slug, e.g. `amount-of-substance` |
| `utm_source` | the partner id |
| `utm_medium` | `embed` |

`utm_source` and `utm_medium` are what the site's existing attribution (`src/lib/attribution.ts`) already reads, so a visitor from a partner is credited on arrival. The App Store link carries the same parameters, and its Apple campaign token is `web-embed` once `NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN` is set.

PostHog (only when `NEXT_PUBLIC_POSTHOG_KEY` is set, as everywhere on the site):

| Event | When | Properties |
| --- | --- | --- |
| `embed_view` | the embed loads | `partner`, `subject`, `topic` |
| `embed_cta_click` | a link to Plumi is pressed | `partner`, `subject`, `topic`, `placement` (`question` or `footer`), `destination` (`app_store` or `topic_page`), `part` |
| `bank_reveal` | a mark scheme or examiner's report is opened | `partner`, `subject`, `topic`, plus the bank's own `kind` and `part` |

In the embed, PostHog keeps its state in memory only: no cookies, no local storage, no page-leave event, and every event has `site: embed`.

## Checking a change

```bash
npm run build && npm start
curl -sI 'http://localhost:3000/embed/question-bank/aqa-a-level-chemistry/amount-of-substance?ref=examnoob' | grep -i -E 'content-security|x-frame|x-robots'
curl -sI 'http://localhost:3000/embed/question-bank/aqa-a-level-chemistry/amount-of-substance?ref=nobody'   | grep -i -E 'content-security|x-frame|x-robots'
curl -sI 'http://localhost:3000/question-bank/aqa-a-level-chemistry' | grep -i x-frame
```

The first should show `frame-ancestors https://examnoob.co.uk https://www.examnoob.co.uk` and no `X-Frame-Options`; the second `frame-ancestors 'none'` and `X-Frame-Options: DENY`; the third `X-Frame-Options: DENY`.
