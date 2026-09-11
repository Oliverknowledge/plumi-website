# Quill pass — motion, pacing and the new mascot

Date: September 2026. Builds on the Astra rebuild; nothing was redesigned from scratch.

## 1. Sections changed (page order)

| # | Section | What changed |
|---|---|---|
| — | Header / footer | Wordmark is now the quill (winking) beside "Plumi". |
| 0 | Hero | New headline "Your handwriting. Read, understood, visualised." with a masked line-by-line reveal; quill perched on the iPad (idle drift). Slideshow, controls and countdown untouched. `hero-bottom` strip removed. |
| 1 | Not in another tab | Was a centred text statement with a decorative rule (dead space). Now two columns: copy + the real "Yes. Now try this one." Tutor crop, with the quill flying in from the hero along a faint ink trail (desktop). |
| 2–3 | Plumi builds what it teaches / The understanding | Same problem, same sticky paper, now **two** beats. Diagram is constructed stroke-by-stroke by the quill (see §3). Question is written after the drawing. |
| 4 | Every answer teaches Plumi about you | **New.** Interactive 3-level learner tree with the ink-pot sequence and a weak node that becomes a "Next · 8 min" card. |
| 5 | Your next question starts here | Old beat 3 promoted to its own section: practice card born from the weak node, same system at θ = 40°, worked-step reveal, causality chips. |
| 6 | Focus | **New.** iPadOS-style recreation: Focus session starts → distracting apps grey out with lock badges → tap → "Not yet. Finish your focus session first." with the quill. Real Focus timer strip kept as proof. Labelled *illustrative recreation*. |
| 7 | All your notes | Shorter. Copy: "Everything you need to take notes is free… If you know Goodnotes or Notability, you already know how it works. Stop paying just to write." Gallery narrower. |
| 8 | A fresh page | Spec-awareness chips (Edexcel Maths 9MA0, AQA Chemistry 7405, OCR Physics H556). Tighter. |
| 9 | Comparison | Rebuilt as ✓ / ✕ only, 8 rows, Plumi column highlighted, ✕ cells carry a tooltip note. |
| 10 | Final CTA | The quill dips in ink and hand-writes "Help write the next chapter." in PlumiHand strokes, underlines it, and perches. |

Removed: the bird (`Mascot.tsx`, `public/mascot/*`, `TheHabit.tsx`, `Waitlist.tsx` legacy sections), the old practice-proof section (its crop moved to §1), the standalone focus-timer note (folded into §6). OG image regenerated with the quill.

## 2. Quill animation system

- `src/components/quill/Quill.tsx` — one SVG character. `QuillGlyph` for use inside a scene's SVG (tip at origin), `Quill` for HTML. Moods via `data-mood`: neutral, happy, focused, curious, tired, proud, smug, wink, sleepy (CSS toggles eye/mouth/brow layers). `--ink` (0–1) controls how full the quill looks.
- `src/lib/quill/scene.ts` — `Timeline`: a step list (`enter / move / draw / hold / reveal / cls / ink / call / exit`) run on one rAF loop while the scene is ≥25 % visible. `draw` walks a `<path data-ink>` dash offset to zero while placing the quill tip at `getPointAtLength` — ink comes out of the nib, nothing spawns. Velocity-based tilt gives rotational inertia. `useQuillScene` handles visibility, pause, replay and reduced motion (no timeline → server-rendered SVG is simply finished).
- `src/components/quill/QuillFlight.tsx` — desktop-only SMIL flight along a path with `rotate="auto"` (tip follows body), a faint dashed trail that draws then fades, two tiny feather fragments.
- Idle: `.hero-quill` drifts 3 px / ±1.5° on a 5.3 s period.

## 3. Diagram choreography (Mechanics, θ = 30°)

1. Quill enters bottom-left (focused) → draws the ground line.
2. Draws the incline as one stroke, then the back wall; hatch fades in.
3. Moves above the slope, draws the block **lifted 14 units off the surface**, then the block **snaps down** onto the incline (spring ease); "2 kg" appears; quill smiles.
4. Draws the pulley bracket, then the pulley circle; axle dot.
5. From the block's top edge draws the string up the slope, over the pulley, down — the string follows the tip.
6. Draws the hanging mass; "3 kg".
7. Returns to the base (curious), draws the θ arc; "θ = 30°", "μ = 0.2".
8. Force arrows one by one from the block centre: **R**, **mg**, **T**, **F** — shaft, then arrowhead, then label.
9. Proud pause → the exam question types out beneath → quill exits top-right.

~13 s desktop, ~9 s mobile (speed ×1.45). Pause / Replay transport kept. Scroll rail only advances to "Understand" once the second beat crosses 42 % of the viewport, and is locked during a replay.

## 4. Learner tree behaviour

Tree: A-Level Maths → Mechanics → Forces → {Resolving forces, Friction, Connected particles}. Quill enters slow and **tired** (ink 0.3), notices the ink pot (curious), dips (squash, ripple, glow, ink → 1), rises **happy**, a droplet falls back. Then: green tick on Friction (proud), blue rising mark on Connected particles, amber ring around Resolving forces (focused) → node expands and tints → quill taps it → the "NEXT · 8 MIN — Resolving forces on inclined planes" card appears beneath with an arrow into §5, whose card header repeats it. Causality is spelled out in §5's chips: *Your work → Plumi noticed a weakness → This is why you get this question.*

## 5. Focus animation

Stage machine (0.9 s → 1.9 s → 0.8 s → 3.8 s, loops while visible): home screen → Focus ON (banner turns blue, blocked icons desaturate with staggered lock badges; Plumi and Photos stay available) → tap ring on Video → blocked sheet slides up with the quill (smug) "Not yet. Finish your focus session first." Tapping any blocked icon opens the sheet for that app; "Back to Plumi" closes it. Reduced motion shows the sheet open.

## 6. Mobile vs desktop

Desktop (≥1100): sticky two-beat mechanics paper, quill flight between hero and §1, tree card overlays the SVG, full figure in the practice card, side-by-side layouts.
Mobile (≤700): no flights, no sticky, scenes run ×1.45–1.5 faster, hero caption/media description hidden, §1 crop hidden (hero already shows the product), practice figure hidden (card = question), tree card stacks below the SVG, tree drawn 12 % wider, comparison keeps the alternative switcher, 30 px headings and 12 px body, all section paddings 36–48 px.

## 7. Page length before / after (dev build, `scrollHeight`)

| Viewport | Before | After | Δ |
|---|---|---|---|
| 1440 × 900 | 7 901 px | 6 162 px | −22 % |
| 390 × 844 | 6 466 px | 6 355 px | −2 % |

Mobile note: three new scenes (tree, practice, focus) were added; every pre-existing mobile section is 25–45 % shorter, but the net page is only slightly shorter. Dropping the practice or focus scene on mobile would get to −25 %.

## 8. Critic scores (A-Level student lens; 1–5: clarity · wow · truth · relevance · visual · motion · mobile)

| Section | Before | After |
|---|---|---|
| Hero | 4·3·5·4·4·2·4 | 4·4·5·4·4·4·4 |
| Not in another tab | 3·1·5·4·2·1·3 | 4·3·5·5·4·4·4 |
| Mechanics | 4·3·4·5·4·2·3 | 4·5·4·5·4·5·4 |
| Learner model | — | 4·4·4·5·4·4·3 |
| Practice | 3·2·4·4·3·1·3 | 4·3·4·5·4·3·4 |
| Focus | 2·1·5·3·2·1·2 | 4·4·3·5·4·4·4 |
| Free notes | 4·2·5·3·4·1·3 | 4·2·5·4·4·1·4 |
| Comparison | 3·1·4·3·3·1·2 | 5·2·4·4·4·2·4 |
| Final CTA | 3·2·5·3·3·1·3 | 4·5·5·4·5·5·4 |

Kept as-was where the delta was marginal: hero slideshow, notebook gallery mechanics, Home recommendation crop, footer.

## 9. Files changed

New: `src/components/quill/Quill.tsx`, `QuillFlight.tsx`; `src/lib/quill/scene.ts`; `src/components/scenes/LearnerTree.tsx`, `PracticeCard.tsx`, `FocusScene.tsx`, `InkSignature.tsx`; `src/app/quill.css`; `public/quill.svg`; this document.
Modified: `LandingPage.tsx`, `scenes/MechanicsStory.tsx` (rewritten), `scenes/StoryMedia.tsx` (Comparison), `ui/Wordmark.tsx`, `content/story.ts`, `content/copy.ts`, `app/layout.tsx`, `app/story.css` (bird rules removed, h1 sizing), `scripts/build-og-image.ts`, `public/og.png`, `public/og-square.png`, `README.md`.
Deleted: `ui/Mascot.tsx`, `sections/TheHabit.tsx`, `sections/Waitlist.tsx`, `public/mascot/*.webp`.

## 10. Build / test status

`yarn build` ✓ · `tsc --noEmit` ✓ · `eslint src` ✓ · No new dependencies. Browser regression (Playwright, iteration_1): hero, wordmark, nav, tree, next-card, practice reveal, focus cycle + tap-to-block, comparison ✓/✕, ink signature completion, reduced-motion, 390 px no overflow — all pass. Two mechanics issues found (rail auto-advance racing the draw; replay stuck) were fixed afterwards and re-verified: progressive draw at 1 s/6 s, replay restarts, rail locked during replay.

## 11. Remaining manual swaps

- **Replace temporary hero slideshow with Oliver's final Tutor screen recording**: drop the MP4/WebM into `public/product/` and set `tutorMedia.videoMp4 / videoWebm` in `src/content/story.ts`. The container, pause control, poster and quill perch are unchanged.
- Focus scene is an illustrative recreation; if Screen Time blocking ships and is verified, relabel the caption.
- Optional: supply a populated Practice capture to replace the illustrative practice card.
