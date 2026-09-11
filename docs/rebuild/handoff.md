# Final handoff — Plumi website rebuild

## Product understanding
Plumi is a pre-release iPad notebook with Tutor/AI Pen assistance on the handwritten page. Marked work feeds persistent learner evidence; practice briefs and Home recommendations use that evidence. Notebook functions are unmetered; extra AI is optional. Subject/catalogue coverage varies, so the site does not claim complete GCSE/A-Level coverage. Audited app commit125bddf, website assets throughfdb8c2b. See product-truth.md for precise code citations and verification limits.

## Story
Write naturally -> Tutor nudges on the page -> mechanics problem takes shape -> a correct friction law and a normal-reaction misconception become different evidence -> targeted question on the same system -> free notebook -> real Home next step -> fair comparison -> community.

## Major interactions
- Five genuine Tutor captures with pause, manual stepping, offscreen suspension and reduced-motion final state
- Desktop scroll-linked device settle and sticky, three-beat mechanics paper
- SVG pen trajectory, drawn plane/string/forces, block placement and question-writing reveal
- Same mechanics figure moves from evidence to a40-degree normal-reaction exercise with an optional worked-step reveal
- Real library/subject/tools selector and mobile comparison counterpart selector
- Confirmed launch countdown that safely becomes community updates

## Supplied assets used
- IMG_0684,0686,0687,0688,0689: actual Tutor hero sequence;0689 also cropped to the next question
- IMG_0713: real notebook library
- IMG_0714: real Physics subject folder
- IMG_0705: real notebook tooltray
- IMG_0709: real Electrical circuits Home recommendation and9/30Focus strip
- plumi-welcoming.webp: hero blue bird
- plumi-celebrating.webp: final community blue bird
All public product media are locally optimised WebP crops; original screenshots remain unchanged. DanielPDF, mechanics reference, Alma, Lumi, Apple, Goodnotes and Opal were research inputs, not repurposed as Plumi UI.

## Excluded
Cross-appFocus blocking and exam-mode app blocking, unshipped shared workspaces, blanket course/board coverage, unsupported prices, and any fake proof. No populated Practice/Progress UI was invented. Physics scene is clearly labeled illustrative; no website AI API is mocked.

## Responsive design
Mobile: close, art-directed screenshots, one selected mechanics state, manual story controls, readable selected-counterpart comparison. iPad: broad native surfaces and larger margins, no forced sticky sequence. Desktop: asymmetrical product-scale hero, restrained device movement and sticky continuous mechanics story.

## Main files
src/components/LandingPage.tsx; SiteHeader.tsx; SiteFooter.tsx; AnalyticsProvider.tsx; ui/CtaButton.tsx; scenes/StoryMedia.tsx; scenes/MechanicsStory.tsx; src/app/story.css; layout.tsx; api/waitlist/route.ts; src/content/story.ts; legal.ts; src/config/site.ts; src/lib/countdown.ts; analytics.ts; scripts/build-og-image.ts; public/product/*; public/og*.png; next.config.ts; yarn.lock; docs/rebuild/*; docs/DEPLOY.md; design_guidelines.md; plan.md.

## Preview
https://focus-master-31.preview.emergentagent.com
Existing Next/Vercel architecture preserved. Preview serves an actual production build. No domain deployment or DNS change was performed.

## Manual media swap
Replace the hero still sequence with Oliver's final Tutor MP4/WebM by setting the supplied media config. Optional later: supply current populated Practice/Progress captures to replace the truthful substitutes. No broken core flow depends on either media swap.
