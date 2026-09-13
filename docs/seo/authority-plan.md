# Authority and entity plan

Everything in the repository is now done. What decides whether "Plumi" resolves
to Plumi is almost entirely off-site, and none of it can be automated.

**What will not be done here:** paid links, PBNs, directory blasts, guest-post
spam, fake reviews, or fabricated third-party coverage. Beyond being against
Google's guidelines, a link-buying pattern on a two-month-old domain is the
easiest thing in SEO to detect.

---

## Why "Plumi" is harder than it looks

"Plumi" is short, pronounceable and close to existing words and names. Google
will not hand a generic-sounding token to a new domain because that domain asks
nicely in its own schema markup. It needs corroboration: several independent
sources saying the same thing about the same entity, pointing at the same URL.

That is what `sameAs`, consistent profiles and genuine coverage are for. It is
also why milestone 3 in [search-console.md](./search-console.md#milestones-in-order)
is the slow one.

---

## Entity profile checklist

Claim these, in this order. Each needs the **same name, same logo, same
description, same canonical URL** — the consistency is the entire point, and a
profile with a different description is a weaker signal than no profile.

**Use exactly this description** (or the shortest truncation that fits):

> Plumi is an AI-powered study notebook for GCSE and A-Level students. It reads
> your handwritten working on iPad, tutors you directly on the page, and turns
> what your work reveals into personalised practice.

**Use exactly this URL:** `https://tryplumi.app` — never `plumi.study`, never
with a tracking parameter. A `sameAs` pointing at a redirect is a weaker link in
the chain than one pointing at the destination.

| Priority | Profile | Notes |
| --- | --- | --- |
| 1 | **Discord** | Already live and already in `sameAs`. The one that currently exists. |
| 2 | **X / Twitter** | Highest-value `sameAs` for entity resolution. Handle should be `plumi` or the closest available. |
| 3 | **LinkedIn (company page)** | Google leans on these for organisation entities more than their traffic justifies. |
| 4 | **Instagram** | Where the audience actually is. |
| 5 | **TikTok** | Same, more so. Build-in-public content performs well here. |
| 6 | **YouTube** | Even with three videos. A channel with the product in it is strong corroboration. |
| 7 | **App Store** | At launch. This becomes the single strongest entity signal Plumi will ever have — Google trusts App Store listings heavily for software entities. |
| 8 | **Product Hunt** | At launch, not before. A launch with nothing to download wastes the one shot. |

**After claiming each one:** add the real URL to the `sameAs` array in
`src/config/site.ts`. That array currently contains only Discord, and it is the
mechanism by which everything above actually counts. A claimed profile that is
not in `sameAs` is doing a fraction of its job.

Do not add a speculative URL before the profile exists. A `sameAs` pointing at a
404 is a broken corroboration, which is worse than none.

---

## Link opportunities, realistically ranked

Ordered by achievability for a pre-launch student product, not by domain
authority.

### Tier 1 — do these first, they are actually achievable

1. **University entrepreneurship and student-startup coverage.** If Oliver is at
   or recently out of a university, its enterprise team, student paper and
   alumni newsletter all actively want this story and link generously. This is
   the single most winnable high-quality link available, and it expires — it
   gets harder to place every year after graduation.
2. **Hackathon, accelerator and competition profiles.** Any programme Plumi has
   genuinely been part of. Real, relevant, and usually just a form.
3. **Build-in-public writing on an established platform.** A substantive post on
   the technical problem — reading handwritten maths structure, not prose — on a
   platform developers already read. The engineering problem is genuinely
   interesting, which is what makes this work where a product announcement would
   not.
4. **Student and A-Level communities** (The Student Room, subject subreddits).
   **Participate, do not drop links.** Answer maths questions properly for weeks
   before mentioning the product once. Most of these links are nofollow — the
   value is the referral traffic and the early users, and both matter more than
   the link.

### Tier 2 — worth the effort once there is a product to show

5. **Teachers and private tutors.** A tutor who finds Plumi genuinely useful and
   writes about it is worth more than ten directory listings, and A-Level maths
   tutors with blogs and mailing lists are easy to find. Give them free access
   and ask for nothing.
6. **iPad and Apple Pencil productivity publications.** A niche with real
   audiences that reviews new Pencil-first apps as a matter of course. Plumi is
   unusually well-suited: genuinely Pencil-native software is rare.
7. **EdTech directories that vet submissions.** The ones that review before
   listing are worth the form. The ones that list anything are not — if it takes
   thirty seconds and no review, it is worth nothing.
8. **Launch coverage.** Prepare a proper press kit before 25 September 2026:
   logo in SVG and PNG, real screenshots, a 50-word and a 150-word description
   matching the text above, and one paragraph on why it exists.

### Tier 3 — the durable version

9. **Build a resource worth linking to.** This is the one that compounds, and
   the only item here that keeps working while you sleep. Candidates, best
   first:
   - **An A-Level Maths exam board comparison** that is genuinely maintained
     (see [content-plan.md](./content-plan.md) #9). Teachers link to these.
   - **A method-marks explainer** with real marked working. Nothing good exists.
   - **Original data on student weak topics**, once there is enough usage to say
     something true. "The five topics A-Level students get wrong most often,
     from N thousand marked questions" is the kind of thing education
     journalists cite — but only when the N is real. Do not publish this early.
10. **Genuine product reviews at launch.** Ask users who like it. Do not pay for
    them, do not script them, and do not offer anything in exchange.

---

## AI and LLM discoverability

No gimmicks, because there are no working gimmicks. Systems like ChatGPT,
Gemini and Perplexity are made easier by the same things that make Google's job
easier, most of which are now in place:

- A crawlable, explicit, factual product description — done, and identical in
  three places.
- `Organization` and `SoftwareApplication` structured data — done.
- Stable canonical URLs on one domain — done.
- An About page that states plainly what the product is — done.
- Consistent terminology across the site — done.
- **Consistent external profiles** — the checklist above. Not done.
- **High-quality third-party references** — the link plan above. Not done.

The last two are what actually move this, and they are exactly the two that
cannot be done in a repository. An LLM summarising Plumi is drawing on what
several independent sources say, not on what the site claims about itself.

**Set up Bing Webmaster Tools.** ChatGPT's search results are fed by Bing, it
imports directly from Search Console, and it takes about ten minutes.

Do not add "AI-readable" keyword blocks, `llms.txt` keyword dumps, or hidden
text. They do nothing, and the hidden-text version is a cloaking violation.
