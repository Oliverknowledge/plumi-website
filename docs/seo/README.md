# Plumi search foundation

What the site looked like before, what changed in the repository, and what only
Oliver can do. The keyword map lives in [keyword-map.md](./keyword-map.md) and
is generated — run `npm run seo:map` after editing `src/config/routes.ts`.

- [Search Console setup, step by step](./search-console.md)
- [Content plan — ten articles, ranked](./content-plan.md)
- [Authority and entity plan](./authority-plan.md)
- [30 / 60 / 90 day roadmap](./roadmap.md)
- [The past paper library](./past-papers.md)

---

## 1. Audit — before

Measured against production on 13 September 2026, not against the repo.

**Already right, and worth saying so.** This was not a site with an SEO
disaster on it. Rendering is static prerendering via the App Router on Vercel,
so Googlebot receives complete HTML with the copy already in it — no
JS-gated content, no interaction required before meaningful text appears. There
was a valid `robots.txt` and `sitemap.xml`, a correct `metadataBase`, real
canonical tags, Open Graph and Twitter cards, `index, follow`, a genuine 404,
`lang="en-GB"`, one `<h1>` per page, sensible `<h2>` structure, and factual alt
text on the product captures. `/_next/` was never blocked.

**What was actually wrong:**

| # | Finding | Severity |
| --- | --- | --- |
| 1 | `plumi.study` and `tryplumi.app` both returned **200** with byte-identical HTML — two live copies of the site competing for every query. `rel=canonical` pointed at `tryplumi.app` on both, which mitigates but does not resolve it. | **High** |
| 2 | No `Organization`, `WebSite` or `SoftwareApplication` structured data anywhere. The only JSON-LD in the codebase was an `FAQPage` block inside `src/components/sections/Faq.tsx`, a component nothing rendered. | **High** |
| 3 | The `<title>` was `Plumi — Your handwriting. Read, understood, visualised.` It never said tutor, notebook, study, GCSE or A-Level. Nothing in it tells a crawler what category the product is in. | **High** |
| 4 | No page existed for any non-branded intent. Three indexable URLs total: `/`, `/privacy`, `/terms`. Nothing could rank for "AI tutor for A-Level Maths" because there was nothing to rank. | **High** |
| 5 | No visible sentence on the homepage stated plainly what Plumi is. The meaning was carried by a scroll narrative and product imagery. | **Medium** |
| 6 | `og:title` still read `Your notebook. Now your tutor.` — the previous positioning, stale since the quill rebuild. `site.tagline` and `site.description` were stale the same way. | **Medium** |
| 7 | `/favicon.ico` returned **404**. `icon.png` was declared and served, so this was cosmetic, but it is a 404 on the most-requested path on any website. | **Low** |
| 8 | `robots.txt` allowed `/v/*`, the paid-traffic variant landings. They carry `noindex` correctly, so this cost crawl budget rather than rankings. | **Low** |

**Indexing blockers found: none.** No stray `noindex` on a public page, no
robots block on assets, no staging canonical, no redirect loop, no soft 404, no
broken sitemap. Finding 1 is a signal-dilution problem rather than a blocker —
Google can index the site today and, as far as can be determined externally,
has nothing preventing it.

---

## 2. Canonical domain decision

**`https://tryplumi.app` is canonical. `plumi.study` 308s to it, path preserved.**

It already was the canonical in production — the live HTML, the sitemap, the
robots `Host` and `hello@tryplumi.app` all pointed there — so choosing it costs
nothing and switching would discard whatever indexing exists.

The one real argument for `plumi.study` is that it exact-matches the branded
query "plumi study". Exact-match domains carry far less weight than they did a
decade ago, and nowhere near the cost of a migration. **If you disagree, now is
the cheapest moment in the site's life to change your mind** — there is very
little organic traffic to lose today and there will be more every month. The
change is two constants: `site.domain` in `src/config/site.ts` and
`canonicalOrigin`/`nonCanonicalHosts` in `next.config.ts`.

Do not leave both domains live and unredirected again.

---

## 3. Automated changes completed

### Technical

- **`next.config.ts`** — host-based 308 redirects to the canonical origin from
  `plumi.study`, `www.plumi.study` and `www.tryplumi.app`. The path is preserved,
  so `plumi.study/privacy` lands on `tryplumi.app/privacy` rather than dumping
  every inbound link on the homepage.
- **`src/app/robots.ts`** — now disallows `/api/` and `/v/`. `/_next/` remains
  crawlable, deliberately.
- **`src/app/sitemap.ts`** — generated from the route registry instead of
  hand-listed, so a new page cannot be forgotten. Ten canonical, indexable,
  200-returning URLs. No noindex URLs, no redirects, no parameters.
- **`src/app/favicon.ico`** — real multi-size ICO (16/32/48), generated from
  `icon.png`. The 404 is gone.

### Entity clarity

- **Title** — `Plumi — AI Study Notebook for GCSE & A-Level` (44 characters).
  Leads with the brand, because the homepage's first job is to win "Plumi";
  the category follows. "Handwriting" is deliberately left to
  `/ai-handwriting-tutor` rather than repeated here.
- **Meta description** — states the category, the audience and the mechanism in
  150 characters.
- **One definition sentence**, used verbatim in three places: the meta
  description, the `Organization`/`SoftwareApplication` JSON-LD, and visible
  HTML in the footer of every page. Consistency across those three is most of
  what makes an entity legible.
- **Homepage hero subhead** now opens `Plumi is the AI study notebook for GCSE
  and A-Level.` — one added clause, not a keyword list. See §5.
- **`og:title`** fixed. `site.tagline` and `site.description` un-staled.

### Structured data

`src/components/StructuredData.tsx`. All validated as parsing JSON and checked
for fabricated fields.

- `Organization`, `WebSite`, `SoftwareApplication` — one `@graph` in the root
  layout, cross-referenced by `@id`.
- `WebPage` + `BreadcrumbList` — per landing page.
- `FAQPage` — only on pages that visibly render those exact questions and
  answers. The component takes the same array the page renders, so the two
  cannot drift.

**Deliberately absent: `aggregateRating`, `review`, `offers`, `price`,
`award`, `datePublished`.** Plumi has not launched. It has no ratings, no
reviews and no settled price, and inventing them is both a structured-data
violation and very hard to walk back.

### Architecture — seven new pages

All statically prerendered, all with unique titles and descriptions, all in the
sitemap, all reachable from the footer of every page.

| URL | Primary query |
| --- | --- |
| `/how-it-works` | how does Plumi work |
| `/ai-tutor-for-a-level-maths` | AI tutor for A-Level Maths |
| `/ai-handwriting-tutor` | AI handwriting tutor |
| `/gcse-maths` | AI study app for GCSE |
| `/ipad-study-app` | iPad study app for A-Level Maths |
| `/goodnotes-alternative-for-students` | Goodnotes alternative for students |
| `/about` | what is Plumi |

Not built, on purpose: `/a-level-maths` (cannibalises
`/ai-tutor-for-a-level-maths` — merged), `/a-level-physics` (coverage too thin
to write honestly), `/pricing` (the Pro price is not decided; a pricing page
that invents one is worse than no pricing page).

### Internal linking

`src/config/routes.ts` carries a `linksTo` list per page, rendered as a "Keep
reading" block using the destination's own H1 as anchor text. The footer carries
ten real links, so every indexable page is one click from every other page. Ten
is a ceiling, not a starting point — the failure mode here is the
keyword-stuffed mega-footer.

---

## 4. Performance

No regression, and nothing here should cause one.

- All seven new pages are **static prerenders**, same as the homepage.
- They add **no JavaScript** beyond what the shared header and CTA already ship.
  There is no animation, no carousel and no client component on them.
- Product captures use `next/image` with explicit `width`/`height` and a `sizes`
  hint, so they are responsive and cannot shift layout.
- The only CSS added is seven lines in `story.css` for the footer.
- Homepage payload is unchanged apart from the JSON-LD block and the longer
  footer text — together under 2 KB before compression.

Verified at a 414 px mobile viewport via the DevTools protocol:
`documentElement.scrollWidth === 414` on `/`, `/privacy` and `/gcse-maths`. No
horizontal overflow anywhere.

---

## 5. One judgement call worth your attention

`src/content/copy.ts` carries a house rule, written before this work:

> The word "AI" appears in exactly one place on this site — the FAQ answer that
> has to use it. Never in a headline.

That is a good rule for a premium brand surface and an impossible one for a page
whose entire job is to be found by someone who typed "AI tutor for A-Level
Maths" into Google. A page that refuses to use the words its reader used cannot
rank for them.

**What was done:** the hero *headline* keeps its restraint — it still reads
"Your handwriting. Read, understood, visualised." The subhead beneath it now
says "Plumi is the AI study notebook for GCSE and A-Level", and the new landing
pages use "AI" where the searcher did.

This is a deliberate reversal of a documented rule, so it is flagged rather than
buried. If you would rather the homepage hero stay pure, the subhead is one
string in `src/components/LandingPage.tsx` and the landing pages can keep the
keyword work on their own. You would lose some homepage category clarity and
keep nearly all of the ranking upside.

---

## 6. Founder actions still required

None of this can be done from the repository.

1. **Verify the domain property in Search Console** and submit the sitemap.
   Full instructions: [search-console.md](./search-console.md). Nothing else on
   this list matters until this is done.
2. **Confirm the redirect is live** after deploy — see the check in
   [search-console.md](./search-console.md#after-deploy-confirm-the-redirect).
   If Vercel has its own domain-level redirect configured for `plumi.study`,
   make sure it agrees with this one rather than fighting it.
3. **Request indexing** for the eight URLs listed in
   [search-console.md](./search-console.md#urls-to-request-indexing-for-first).
4. **Claim the social profiles** in
   [authority-plan.md](./authority-plan.md#entity-profile-checklist), using the
   same name, logo, description and canonical URL on each. Then add each real
   URL to `sameAs` in `src/config/site.ts` — that array is what lets Google
   confirm those profiles and this site are one entity. It currently contains
   only Discord.
5. **Decide the canonical domain** if you disagree with §2. Cheapest now.
6. **Set up Bing Webmaster Tools** too. It takes ten minutes, it imports
   straight from Search Console, and it is what ChatGPT's search feeds from.

---

## 7. Build and deployment status

`npm run build` succeeds. TypeScript clean, ESLint clean. 21 routes generated,
all seven new pages prerendered as static content. Verified against a production
build served locally: every route 200, `/not-a-real-page` genuinely 404,
`/v/decide` `noindex` with a canonical pointing home, host redirects returning
308 with the path preserved, all JSON-LD parsing, FAQ markup matching visible
page text.

Not yet deployed. Nothing here requires a migration or a data change — it is a
normal Vercel deploy.
