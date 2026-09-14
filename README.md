# Plumi — website

The marketing site for Plumi, an iPad notebook for GCSE and A-Level students.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · deployed on Vercel.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build; also typechecks
npm run lint
npm run typecheck
npm run og           # regenerate public/og.png from the current headline
```

---

## The one thing you will want to change

**`src/config/site.ts`** holds the launch switch.

```ts
export const launchMode: LaunchMode = "community";
export const appStoreUrl: string | null = null;
```

On launch day, set `appStoreUrl` and flip `launchMode` to `"appStore"`. That is
the whole change. Every call to action on the site — the hero, the header, the
sticky mobile bar, the closing panel — reads its label, its destination and its
analytics event from this file.

The build fails if `launchMode` is `"appStore"` while `appStoreUrl` is still
null, so the site can never ship with a download button that goes nowhere.

## Where things are

| Path | What |
|---|---|
| `src/content/` | **Every word on the site.** Copy never lives in a component. |
| `src/config/site.ts` | The launch switch, domains, CTA labels |
| `src/app/globals.css` | The design tokens, transcribed from the iPad app |
| `src/components/sections/` | The static chapters: trust, evidence, exam mode, plans, FAQ |
| `src/components/scenes/` | The animated set pieces: the marking pass, the learner tree, the practice card, the diagram build, the hero media, the ink close |
| `src/components/LandingPage.tsx` | The homepage, and the only place the chapter order lives |
| `src/components/product/` | Reusable pieces of the product's own UI |
| `src/components/quill/` | Plumi the quill: the SVG character and its flights |
| `src/lib/quill/` | The scene choreographer that lets the quill draw ink in real time |
| `src/lib/hand/` | Plumi's handwriting, ported from the app (see below) |
| `src/lib/analytics.ts` | The only place the site talks to PostHog |
| `src/lib/waitlist/` | The waitlist storage boundary |
| `supabase/migrations/` | The waitlist table |
| `docs/WAITLIST.md` | How to turn the waitlist on |
| `.context/research/` | The research the site was built from (gitignored) |

## The homepage is five arcs, not fifteen sections

`LandingPage.tsx` is the only place the order lives, and the order is an
argument: every chapter inherits a belief from the one above it and hands one
on.

```
        HERO            Your handwriting. Read, understood, visualised.
ARC 1   01 on-page      Not in another tab.
        02 the-mark     Six marks. You got four. Here are the two.
ARC 2   03 trust        Plumi doesn't guess your mark.
        04 what-counts  Reading your notes proves nothing.
ARC 3   05 learner-model  You don't have to know what you're weak at.
        06 practice     Your next question starts here.
        07 exam-mode    Then it takes it all away.            [dark]
ARC 4   08 notebook     All your notes. Not another subscription.
        09 diagrams     Big ideas. Drawn simply.
        10 your-course  A fresh page. Not a fresh start.
ARC 5   11 compare      A chatbot sees what you paste.
        12 free-and-pro Free is the notebook.
        13 faq          The things people actually ask.
        14 close        Write like you always have. Find out what it proves.
```

You cannot ask somebody to trust a mark they have not seen, so 02 precedes 03.
The learner model reads as generic AI personalisation unless the rule about what
counts as evidence has been stated first, so 04 precedes 05. The arcs are never
labelled in type; they are felt through pacing, and the two dark sections close
arcs 3 and 5.

## The handwriting is real

`src/lib/hand/` is a faithful TypeScript port of `PlumiHand` from the iPad app —
103 glyphs as polyline strokes, the same seeded PRNG for per-character drift,
the same metrics. It is not a font.

That matters for two reasons. A font can only fade in; these strokes can be
*written*, which is what the hero and the social image do. And the handwriting a
visitor reads on the website is drawn from the same coordinates as the note
Plumi writes in the margin of a real page.

Four characters are missing from the ported table and must not be used in ink:
`÷`, `λ`, `Σ`, and `≠` (which currently draws as `≈`). They are missing upstream
too; fixing them means adding them to `PlumiHand.swift` first, so the app and
the site stay one hand.

## Ground rules

These are not style preferences. Breaking them makes the site wrong.

1. **No claim the product cannot support.** `.context/research/product.md` §11 is
   the do-not-claim list and §11.8 is the verified allowlist. Read them before
   writing copy. In particular: no streaks, no app blocking, no sync, no
   collaboration, no exam-board endorsement.
   **Prices are the sharpest case of this rule, not an exception to it.** The
   site publishes £19.99 a month and £79.99 a year with seven days free on the
   annual plan only. Those three facts appear in `src/content/plans.ts`, in the
   FAQ, in two deeper pages, in the comparison table and in the JSON-LD graph —
   and every one of them has to match App Store Connect. "A price the App Store
   has not confirmed is a price Plumi cannot charge" is the app's own comment
   and it is still the rule.
2. **No fake proof.** No testimonials, user counts, ratings, press logos or
   outcome statistics. None exist, so none are rendered. The product has to do
   the convincing.
3. **No raw hex in a component.** Every colour is a token in `globals.css`.
4. **Green, amber and red are rationed** — marking and mastery only, never
   decoration. When a student sees red here it means one thing.
5. **No user-visible string in a component.** It goes in `src/content/`.
6. **Never send an email address to analytics.** `src/lib/analytics.ts` strips
   anything that looks like one, but do not rely on that — just never pass it.
7. **Never fake a successful waitlist signup.** If the backend is unconfigured
   the form says so.

## Environment

Nothing is required to run the site locally. Everything degrades to a no-op.

| Variable | Needed for | Notes |
|---|---|---|
| `SUPABASE_URL` | Waitlist | Server-side only |
| `SUPABASE_SERVICE_ROLE_KEY` | Waitlist | **Never** prefix with `NEXT_PUBLIC_` |
| `SUPABASE_WAITLIST_TABLE` | Waitlist | Optional; defaults to `waitlist_signups` |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics | Without it, analytics is inert |
| `NEXT_PUBLIC_POSTHOG_HOST` | Analytics | Defaults to the EU cloud |
| `NEXT_PUBLIC_FOCUS_BLOCKING` | The Focus chapter | `"true"` restores the app-blocking wording and the blocked-app artwork. **Leave it unset** until Apple's Family Controls *distribution* entitlement is granted and blocking is verified on a shipping build on a real device. Until then Focus is described as what it is on a shipping build: a study timer. |

Without Supabase configured the waitlist form returns an honest error rather
than a false success. See `docs/WAITLIST.md`.

## Performance

Measured on the production build with Lighthouse 12, after the five-arc rebuild.
Both columns are the same commit; the desktop preset and the mobile preset
disagree about LCP because they disagree about the network.

| | Mobile | Desktop |
|---|---|---|
| Performance | 92–93 | 100 |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| LCP | 3.2–3.4 s | 0.7 s |
| CLS | 0 | 0 |
| Total blocking time | 0–20 ms | 0 ms |

Against the previous generation of the homepage, measured the same way: mobile
performance 94 → 92, accessibility 92 → 100, best practices 96 → 100; desktop
accessibility 88 → 100. Three new chapters cost one to two points of mobile
performance and bought back twelve points of accessibility.

**LCP is the one number to watch, and it is an asset problem rather than a code
problem.** The largest paint is the hero's fifth still — the frame the server
renders — and it now carries `fetchpriority="high"`, which is the whole of the
cheap win. The rest is the hero film: when `tutorMedia.videoMp4` is set, the
`<picture>` becomes the poster underneath it and that is where the next second
comes from.

Roughly 173 kB of JavaScript, 130 kB of font, 96 kB of document. There is no
animation library: reveals are CSS keyframes, flights are SMIL, and the quill's
drawing scenes run on one `requestAnimationFrame` loop only while on screen
(see `docs/rebuild/quill-pass.md`).
