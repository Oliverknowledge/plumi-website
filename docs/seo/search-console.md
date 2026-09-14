# Search Console, step by step

Everything on this page has to be done by a human with access to the domain
registrar and the Google account. Budget about forty minutes for the first
three sections.

---

## 1. Verify the domain property

Use a **Domain property**, not a URL-prefix property. A domain property covers
`http`, `https`, `www` and every subdomain in one go, which a URL-prefix
property does not — and getting this wrong is how people end up staring at an
empty dashboard while their site ranks fine.

1. Go to <https://search.google.com/search-console> and sign in.
2. **Add property** → left-hand box, **Domain** → enter `tryplumi.app`
   (no `https://`, no `www`).
3. Google shows a TXT record like `google-site-verification=xxxxxxxx`.
4. In your DNS provider for `tryplumi.app`, add a **TXT** record on the root
   (`@`), value exactly as given. TTL default is fine.
5. Wait for propagation, then press **Verify**. If it fails, it is almost
   always propagation — check with:
   ```
   dig +short TXT tryplumi.app
   ```
   and try again once the record appears.

**Do the same for `plumi.study`.** It redirects now, but you want to see its
redirect being followed and to catch anything still indexed under it.

---

## 2. Submit the sitemap

Only on the `tryplumi.app` property.

1. Left sidebar → **Sitemaps**.
2. Under "Add a new sitemap", enter exactly:
   ```
   sitemap.xml
   ```
3. **Submit.** Status should reach "Success" with **10 discovered URLs**. If it
   says "Couldn't fetch", open <https://tryplumi.app/sitemap.xml> in a browser
   first — that is almost always a deploy that has not finished.

Do not submit a sitemap on the `plumi.study` property. It redirects; there is
nothing there to list.

---

## 3. URLs to request indexing for first

Use **URL Inspection** (top search bar) → paste the URL → **Request indexing**.
There is a daily quota of roughly ten, so this order matters. Do these on day
one, in this order:

| # | URL | Why first |
| --- | --- | --- |
| 1 | `https://tryplumi.app/` | The entity. Everything else depends on this being indexed and understood. |
| 2 | `https://tryplumi.app/about` | The plainest statement of what Plumi is. Strongest single support for branded queries. |
| 3 | `https://tryplumi.app/how-it-works` | Highest-value non-branded explainer, and the page most linked-to internally. |
| 4 | `https://tryplumi.app/ai-tutor-for-a-level-maths` | The most commercially valuable query on the list. |
| 5 | `https://tryplumi.app/ai-handwriting-tutor` | Lower volume, least competition — realistically the first non-branded page to rank. |
| 6 | `https://tryplumi.app/ipad-study-app` | Device-led intent, decent volume. |
| 7 | `https://tryplumi.app/goodnotes-alternative-for-students` | Comparison intent converts well and the competition is weak. |
| 8 | `https://tryplumi.app/gcse-maths` | Largest audience, hardest to rank for. Long game. |

While you are in URL Inspection on the homepage, click **Test live URL** →
**View tested page** → **Screenshot**. If the screenshot shows the page as you
expect, rendering is fine. Also check **More info → Page resources** for
anything that failed to load.

---

## After deploy: confirm the redirect

Run this from a terminal once the deploy is live. All three lines should show a
`308` to the `tryplumi.app` equivalent, and the last should show `200`:

```bash
for h in plumi.study www.plumi.study www.tryplumi.app tryplumi.app; do
  printf "%-20s " "$h"
  curl -s -o /dev/null -m 10 -w "%{http_code} -> %{redirect_url}\n" "https://$h/privacy"
done
```

Expected:

```
plumi.study          308 -> https://tryplumi.app/privacy
www.plumi.study      308 -> https://tryplumi.app/privacy
www.tryplumi.app     308 -> https://tryplumi.app/privacy
tryplumi.app         200 ->
```

If `plumi.study` still returns `200`, Vercel is serving it as a separate
assigned domain ahead of the Next.js redirect. Fix it in the Vercel dashboard:
**Project → Settings → Domains → `plumi.study` → Redirect to `tryplumi.app`**,
with "Redirect status" set to **308**.

Also confirm the basics:

```bash
curl -s https://tryplumi.app/robots.txt
curl -s https://tryplumi.app/sitemap.xml | head -20
curl -s -o /dev/null -w "%{http_code}\n" https://tryplumi.app/favicon.ico   # expect 200
```

---

## If a result says "tryplumi.app" instead of "Plumi"

The line above the URL in a search result is Google's **site name**, and Google
picks it — you cannot set it directly. Every signal it documents is now in
place:

- `WebSite` structured data with `name: "Plumi"`, **standalone and on the
  homepage only**. Google derives one site name per site and reads it from the
  root URL, so it lives in `src/app/page.tsx`, not the root layout.
- `og:site_name` on **every** page. It was previously on the homepage alone:
  Next.js merges metadata shallowly, so any page defining its own `openGraph`
  silently dropped the layout's `siteName`.
- A homepage `<title>` that leads with the brand.

Three things to know:

1. **The homepage has to be indexed.** The site name comes from the homepage. If
   only subpages are indexed, Google has no source and falls back to the domain.
   Check with URL Inspection on `https://tryplumi.app/` before assuming anything
   is broken.
2. **It updates on Google's schedule**, typically days to weeks after a
   re-crawl. There is no way to hurry it and re-requesting indexing does not.
3. If it is still wrong weeks after the homepage is indexed, there is a
   dedicated feedback form:
   <https://search.google.com/search-console/site-name-feedback>

One thing already working: Google appends " - Plumi" to page titles in results
even though our `<title>` tags do not contain it. That means Google has
*already* worked out the brand is Plumi — which is why the site-name row is
worth fixing rather than worrying about.

---

## Validate the structured data

Both take a URL and need no account:

- **Rich Results Test** — <https://search.google.com/test/rich-results>
  On the homepage: `Organization`, `SoftwareApplication` and `WebSite`. On a
  landing page: `Organization`, `SoftwareApplication`, `WebPage`,
  `BreadcrumbList`, plus `FAQPage` where the page shows FAQs. `WebSite` is
  homepage-only by design — see the site name section above.
- **Schema Markup Validator** — <https://validator.schema.org/>

`FAQPage` no longer produces a rich result for most sites, and that is fine —
it is here for entity understanding, not for a SERP decoration.

---

## What to watch, and when

Give it time. A new page taking four to eight weeks to settle is normal, and
re-requesting indexing every day does not speed it up.

**Weekly, in Search Console:**

- **Pages** report — indexed count should reach 10. Anything under "Why pages
  aren't indexed" is worth reading properly; "Crawled - currently not indexed"
  on a new page usually means "wait", not "broken".
- **Performance** → filter **Queries containing `plumi`** — this is branded
  demand. Track impressions and average position.
- **Performance** → the inverse filter — non-branded impressions. This is the
  number that tells you whether the landing pages are working at all.

**In PostHog**, segment by organic landing page and watch:

- Discord CTA clicks by landing page — which page actually converts.
- Scroll depth on the new pages — a page nobody reads past the fold is a page
  with the wrong intent.

### Milestones, in order

| | Milestone | Realistic timing |
| --- | --- | --- |
| 1 | Homepage indexed under the canonical domain | 3–14 days after verification |
| 2 | "Plumi study" returns Plumi prominently | 2–6 weeks |
| 3 | "Plumi" begins associating with the product | 1–3 months, and depends far more on [authority-plan.md](./authority-plan.md) than on anything in the repo |
| 4 | Long-tail non-branded pages take impressions | 4–10 weeks |
| 5 | Organic traffic produces product activations | After launch, realistically |

Milestone 3 is the one that will not move on technical work alone. "Plumi" is a
short, generic-sounding word with existing competition; owning it needs external
corroboration, which is what the authority plan is for.
