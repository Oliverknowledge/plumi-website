# 30 / 60 / 90 day plan

Written on **13 September 2026**. Launch is **25 September 2026**, twelve days
away, which sits inside day 30 and shapes everything below: the first month is
not really an SEO month, it is a launch month with SEO groundwork in it.

Effort estimates are for one person doing this alongside building the product.

---

## Days 1–30 (to 13 October) — get indexed, then launch

**The goal is boring and non-negotiable: Google has the site, on one domain,
and understands what it is.** Nothing else on this page matters until that is
true.

### Week 1 — before launch

| Priority | Task | Effort | Owner |
| --- | --- | --- | --- |
| **P0** | Deploy this branch | 10 min | — |
| **P0** | Confirm the `plumi.study` → `tryplumi.app` 308 is live ([check](./search-console.md#after-deploy-confirm-the-redirect)) | 5 min | Oliver |
| **P0** | Verify both domain properties in Search Console | 30 min | Oliver |
| **P0** | Submit `sitemap.xml`, confirm 10 URLs discovered | 5 min | Oliver |
| **P0** | Request indexing for the [eight URLs](./search-console.md#urls-to-request-indexing-for-first) | 20 min | Oliver |
| **P1** | Rich Results Test on `/` and one landing page | 10 min | Oliver |
| **P1** | Bing Webmaster Tools — imports from Search Console | 10 min | Oliver |

### Week 2 — launch week (25 September)

SEO takes a back seat. Two things only:

| Priority | Task | Effort |
| --- | --- | --- |
| **P0** | **App Store listing live**, with the exact description from [authority-plan.md](./authority-plan.md#entity-profile-checklist) | — |
| **P0** | Add the App Store URL to `sameAs` in `src/config/site.ts`, redeploy | 10 min |
| **P1** | Product Hunt launch, same description, same canonical URL | 2 hrs |
| **P1** | Claim X and LinkedIn with matching name, logo, description, URL | 1 hr |

The App Store listing is the highest-value entity signal Plumi will ever get.
Getting the description and URL right there is worth more than the rest of this
week combined.

### Weeks 3–4 — consolidate

| Priority | Task | Effort |
| --- | --- | --- |
| **P0** | Check the **Pages** report. Chase anything not indexed | 30 min/wk |
| **P1** | Claim Instagram, TikTok, YouTube; add each to `sameAs` as it goes live | 2 hrs |
| **P1** | Update `/gcse-maths`, `/ai-tutor-for-a-level-maths` and `/about` to present tense now the app exists | 1 hr |
| **P1** | Approach the university enterprise team and student paper — [tier 1](./authority-plan.md#tier-1--do-these-first-they-are-actually-achievable) | 2 hrs |
| **P2** | Write [content #1](./content-plan.md) — method marks | 4 hrs |

**Exit criteria:** 10/10 pages indexed · "Plumi study" returns the site ·
`sameAs` has at least four real entries · one external link exists.

> If pages are still not indexed at day 30, stop and diagnose before writing
> anything new. More content on a site Google will not index is wasted work.

---

## Days 31–60 (to 12 November) — prove the pages work

Now there is data. **Let it pick the priorities rather than this document.**

| Priority | Task | Effort |
| --- | --- | --- |
| **P0** | Weekly: Performance report, split branded vs non-branded (`plumi` query filter) | 30 min/wk |
| **P0** | Publish content **#1, #2, #3** — one per fortnight, not batched | 4 hrs each |
| **P0** | Add each article to `src/config/routes.ts`; `npm run seo:map` | 10 min each |
| **P1** | Rewrite the title and description of the worst-CTR page that gets impressions | 1 hr |
| **P1** | First real usage data → start the weak-topics dataset for [content #4](./content-plan.md) | — |
| **P1** | Tier 1 links: hackathon and accelerator profiles, build-in-public post | 4 hrs |
| **P2** | Reach out to 5–10 A-Level maths tutors with free access, no ask | 3 hrs |
| **P2** | Core Web Vitals check on real field data, now that there is traffic | 1 hr |

**The decision to make at day 60:** which landing pages are getting impressions
at all. A page with zero impressions after a month of being indexed has the
wrong intent or no demand behind it — rewrite its angle or drop it. Do not add
new pages while existing ones are silent.

**Exit criteria:** 3 articles live · non-branded impressions non-zero and
trending up · at least one page in the top 50 for its primary query · 3+
external links.

---

## Days 61–90 (to 12 December) — compound

| Priority | Task | Effort |
| --- | --- | --- |
| **P0** | Publish content **#4, #5, #6** | 4 hrs each |
| **P0** | Build **one linkable resource** — the [exam board comparison](./content-plan.md) is the best candidate | 8 hrs |
| **P1** | Promote it directly to teachers and tutors. A resource nobody is told about earns no links | 3 hrs |
| **P1** | Expand the pages that are working; consider `/a-level-physics` **only if** physics coverage is genuinely deep enough to write honestly | 3 hrs |
| **P1** | Add `/pricing` — by now the Pro price should be real. It was left out precisely because it was not | 2 hrs |
| **P2** | Original data piece, **if and only if** N is large enough to say something true | 6 hrs |
| **P2** | Review internal linking; give orphan-ish pages more contextual inbound links | 1 hr |

**Exit criteria:** 6 articles · one genuinely linkable resource live and
promoted · first ranking in the top 20 for a non-branded query · organic
attributed to at least one App Store click in PostHog.

---

## What success actually looks like at day 90

Calibrate expectations now, because the failure mode here is abandoning a
working plan at week six.

**Realistic:**

- All pages indexed, no technical issues outstanding.
- "Plumi", "Plumi study" and "Plumi AI tutor" reliably return the site first.
- Non-branded impressions in the hundreds per month, mostly from the
  lowest-competition pages — `/ai-handwriting-tutor` and
  `/goodnotes-alternative-for-students` are the likeliest first movers.
- A handful of genuine external links.
- Organic is a small but non-zero share of App Store clicks.

**Not realistic, and worth saying plainly:**

- Ranking on page one for "AI tutor for A-Level Maths" in 90 days. That is a
  contested commercial query and the domain is new. Twelve to eighteen months
  with sustained content and links is the honest timeline.
- Meaningful traffic from the broad GCSE queries. `/gcse-maths` is a long game.
- Being cited by ChatGPT or Gemini. That follows third-party coverage, and there
  is not enough of it yet.

The compounding is real but it starts slowly. The work in days 1–30 is what
makes days 180–360 possible, and most of it is unglamorous.
