# Study app design system

The look of **study.tryplumi.app**: the iPad notebook in a browser. This is the app's "lofi" look
(Blue as the main look, Lime as the option, each with a dark mode), not the marketing site's.

Live guide: `/study/design`. Dashboard variations: `/study/dashboards/{desk,focus,map,squad,wardrobe}`.
Both are `noindex` and not in the sitemap.

## Source of truth, and what is not

| | Status |
|---|---|
| `plumi/Sources/PlumiKit/Design/PlumiTheme.swift` (`PlumiColor`, `Lofi`, `PlumiFont`) | **Truth.** The shipped app. |
| `plumi/.context/handoffs/lofi/style-spec.md` | Truth for shape and components. Where it disagrees with the Swift (see below), the Swift wins. |
| `src/app/cosy.css` (marketing) | A sibling (cocoa and cream, Lime-like). Not used here, never imported here. |
| `design_guidelines.md` | **Stale.** An older marketing brief (`/app` paths, a contradictory shadcn note). Do not follow it for the app. |

## How it is built

```
src/components/study/tokens.ts      the one source: palettes, stationery, metrics, paper, pens
scripts/study-tokens.ts             tokens.ts -> src/app/study/tokens.css (generated; --check fails on drift
                                    and on any var(--st-*) that is not defined)
scripts/study-contrast.ts           WCAG check of every palette
src/app/study/components.css        every component; no hex in it
src/components/study/ui/*           React primitives (Button, Card, Chip, Switch, Tile, PixelBlocks, ...)
src/app/study/layout.tsx            the .st root; sets the look before first paint; noindex
```

Commands: `npm run study:tokens`, `npm run study:tokens -- --check`, `npm run study:contrast`.

Everything is scoped under `.st`. The marketing `cosy.css` sets global body styles and Next keeps a
page's stylesheet across navigation, so the two must never share selectors. `SiteOnly` leaves out
the marketing furniture (structured data, ad tag, ad-cookie question) under `/study`.

**Palettes.** `html[data-look="lime"]` and the site's existing `html[data-theme="dark"]` pick the
palette for `.st`. `.st-scope[data-look][data-mode]` is the same palette keyed by its own
attributes, so a guide can draw all four at once; it ignores the page's palette (tested).
Blue light is the default: no attribute means blue.

## The rules

1. **One line colour** draws every border, hard shadow and selected fill (`--st-line`).
2. **Shadows are hard**: `0 3|4|5px 0`, zero blur, y only. Never `blur`.
3. **3px line** on anything 36px or taller, 2px below. Pixel data (squares, switches) has radius 0.
4. **Pixel type is a voice.** Pixelify only at 20px+ for headings and 15px+ for keys. Below that,
   heavy Nunito. Everything read (sentences, labels, rows) is Nunito 600 to 800. Caps labels are
   always Nunito 800, tracked. No ligatures in pixel type (`fi` became an `A`).
5. **Numbers are Nunito, tabular**: marks, grades, timers, scores. Pixel digits sit close to letters
   (5/S, 2/Z, 0/O, 8/B); this is the app's own rule (`PlumiFont.numeral`). The redrawn pixel "5"
   helps, but a mark that can be misread is a wrong mark.
6. **Press moves the key down by its own shadow**, in two steps, no easing. Reduced motion removes it.
7. **44px is the smallest thing you press.** Smaller visuals (36px chips, topic squares, switches)
   get a larger hit area; topic squares grow to 28px on coarse pointers.
8. **Green, amber and red mean marking, and nothing else.** Green on a *key or switch* means "on",
   never "correct". Marking text uses the `-ink` shades (AA); the plain shades are for marks and icons.
9. **Colour is never the only signal.** The five topic states each have a texture as well as a hue:
   hollow (too early to tell), red with `!` (needs attention), hatched (rusty), half (developing),
   solid (strong). "Too early to tell" is deliberately the quietest: an absence of evidence must look
   like an absence, not a low score. One vocabulary, the app's: `TopicState.label`.
10. **The page is not the chrome.** `.st-paper` keeps its own stock (cream, white, dark) in every
    look and mode, and its own tutor and wrong-line ink. Pen colours are the student's and have no
    white pen. Strokes are drawn by the notebook engine; Caveat is for static demonstrations only.
11. **No em dashes** in anything a student reads (founder rule). Copy is short, first person for
    Plumi, `·` as separator, sentence case.
12. **Show, do not paragraph.** A title, at most one short line, the rest drawn.

## Where this deliberately differs from the app, and why

| Difference | Why |
|---|---|
| Dark mode **selected** state is inverted (light fill, dark text), not a dark chip with light text | A 3px line light enough to see on a dark card (3:1) is too light to carry white text (4:1 at best). Inverting is clearer and matches the marketing site's dark. |
| Dark ground `#111419`, not the app's desk `#0D0E11` | A black hard shadow needs a ground slightly above black to be seen at all. |
| `tutor-bg` is `#EAF7F8`, the app's is `#E0F3F4` | Tutor ink on the app's tint measures 4.31:1, under AA. |
| Marking text shades (`correct-ink`, `partial-ink`, `incorrect-ink`) | The app's marking colours are for icons and fills; as small text on a card they fail AA. |
| Text inputs are Nunito, not pixel | The artifact sets input text in Pixelify; a student's own words (and any maths) must read correctly. Pixel is kept for short codes. |
| Mastery uses textures as well as hues | The artifact's scale is hue only and fails 3:1 between neighbours. |
| Correct work is green on marks, not blue | The artifact says "no green success"; the shipped Swift keeps `PlumiColor.correct` green. Swift wins. |
| Search icon redrawn | The artifact's own magnifier reads as a "Q" at 16px. |

## Measured, not assumed

`npm run study:contrast`: text pairs at 4.5:1, lines, focus rings and marks at 3:1, in all four
palettes, plus each paper stock on its own. All pass. Mastery fills are reported, not failed: a
square is told from its neighbour by its texture and its 2px line.

Checked in a browser (Chromium): every section in all four palettes at 1280px, the dashboards at 390,
768 and 1280px with no horizontal overflow, look and mode switching and persistence, the nesting of
`.st-scope`, switch, segmented, tab and topic-square behaviour, 3px keyboard focus ring, no pressable
under 44px tall, and no transitions under `prefers-reduced-motion`.

## Known gaps and open questions

- **Not checked on a real device.** No iPad, no touch, no Apple Pencil. The system makes no claim yet
  about pointer-event handling for the page.
- **The 12 icons I drew** (everything except flame and remove) need an eye from whoever owns the app's
  icon set. The wardrobe's item art is placeholder pixel icons.
- **The sample student, subjects, friends and wardrobe items are placeholders** for layout. Wardrobe,
  Multiplayer and Insights are navigation the founder asked for; this system does not assert they exist
  in the app today.
- **Dark mode and the mascot.** The sprites have cocoa outlines baked in; they read on the dark
  grounds because the body is white, but they were not designed for it.
- **Theme choice is per host.** `localStorage` is not shared between `tryplumi.app` and
  `study.tryplumi.app`, so a student who chose dark on the marketing site chooses once more here.
- **Phone navigation** scrolls sideways (five places do not fit one row at 390px). A bottom tab bar is
  the likelier answer for the real app; it is a product decision, so it is not made here.
- **Body background overscroll.** Tokens live on `.st`, so the body behind it (cream or dark brown from
  the marketing CSS) can show in iOS rubber-banding. Fixing it means moving the palette to `html`.
- **Pixelify and Dynamic Type.** Web has no Dynamic Type; the app caps pixel scaling. Browser zoom works
  because sizes are px with `clamp` on titles; text-only zoom is untested.

## Hosting (not done, deliberately)

`study.tryplumi.app` is already attached to this Vercel project, and `next.config.ts` redirects
`plumi.study` and `www.tryplumi.app` to the canonical host but **not** `study.tryplumi.app`, so it very
probably serves a duplicate of the marketing site today (unverified from here). Two options:

1. Host-based rewrite in `next.config.ts`: `has: [{ type: "host", value: "study.tryplumi.app" }]`,
   `/:path*` to `/study/:path*`. One deploy, shared auth with the existing Supabase sign-in.
2. A second Vercel project from the same repo.

Option 1 is the lighter path, but do not ship it until `/study` has a real landing: the subdomain would
otherwise swap a duplicate site for a design page.
