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
export const launchMode: LaunchMode = "waitlist";
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
| `src/components/sections/` | One file per section, in page order |
| `src/components/scenes/` | The three interactive/animated set pieces |
| `src/components/product/` | Reusable pieces of the product's own UI |
| `src/components/quill/` | Plumi the quill: the SVG character and its flights |
| `src/lib/quill/` | The scene choreographer that lets the quill draw ink in real time |
| `src/lib/hand/` | Plumi's handwriting, ported from the app (see below) |
| `src/lib/analytics.ts` | The only place the site talks to PostHog |
| `src/lib/waitlist/` | The waitlist storage boundary |
| `supabase/migrations/` | The waitlist table |
| `docs/WAITLIST.md` | How to turn the waitlist on |
| `.context/research/` | The research the site was built from (gitignored) |

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
   writing copy. In particular: no prices, no streaks, no app blocking, no sync,
   no collaboration, no exam-board endorsement.
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

Without Supabase configured the waitlist form returns an honest error rather
than a false success. See `docs/WAITLIST.md`.

## Performance

Measured on the production build, mobile emulation:

| | |
|---|---|
| Performance | 93 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| CLS | 0 |
| Total blocking time | 0 ms |

Roughly 164 kB of JavaScript, 130 kB of font, 78 kB of document. There is no
animation library: reveals are CSS keyframes, flights are SMIL, and the quill's
drawing scenes run on one `requestAnimationFrame` loop only while on screen
(see `docs/rebuild/quill-pass.md`).
