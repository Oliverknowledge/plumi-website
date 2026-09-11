# Visual critique and final decisions

## Source-backed story vs Alma
Alma's strongest quality is immediate positioning, not a template to imitate. The rebuilt Plumi hero makes the notebook/Tutor identity explicit in five words, then shows the real missing-factor integral and Tutor handwriting. The continuous mechanics example explains the distinguishing mechanism: work -> differentiated evidence -> a targeted next problem. The later real Home recommendation closes that loop. No testimonials, feature-card grid, inflated stats, pricing claims or borrowed visual identity.

## Mobile / iPad / desktop review
Reviewed browser captures at390,768,1024,1440 and a main-agent1920hero screenshot. Mobile comparison screenshot confirmed one selected alternative alongside Plumi; the first test's 'six columns' appears to count six cells (header+five rows), so final testing must verify each row rather than blindly change correct CSS.

Refinements from screenshots:
- Raised tiny annotations/captions and increased heading contrast
- Enlarged mobile dot hit areas and playback controls
- Kept real notebook tooltray within mobile crop, rather than showing blank paper
- Home source corrected to0709;0708 is blank paper. Actual Electrical circuits recommendation now rendered with dedicated mobile crop
- Fixed missing μ glyph in the illustrative formula; Plumi's ported stroke font does not include it, so an explicit math stroke is used only in the labeled editorial illustration
- Added pen-synchronised stroke drawing, block placement and written-question reveal instead of indiscriminate fade-ups
- Desktop device gently settles with scroll where supported; fallback remains legible
- After confirmed date, both countdown and final-CTA date resolve to launch updates, never unverified availability
- Privacy/terms updated for community-first site; no form, no attribution initialisation, no analytics requests. Legacy signup endpoint deliberately returns410 rather than attempting unconfigured storage

## Known media limits, not broken flows
- Hero is a paced sequence of actual captures, not a final screen recording
- Dedicated populated Practice/Progress capture not supplied: no substitute fake UI. Real Tutor next problem + real Home recommendation used
- Native iOS app was source-audited, not run in Linux
- Focus timer demonstrated; app-blocking and collaboration excluded

## Media replacement
Set `tutorMedia.videoMp4` and/or `videoWebm` in `src/content/story.ts`, put final files in `public/product/`. Keep `poster` as the real capture. Video uses same framed area, muted inline playback, pause and reduced-motion policy; missing/failed video falls back to real captures.
