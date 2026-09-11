# plan.md — Plumi Marketing Site Rebuild (Final)

## 1) Objectives
- Rebuild `/app` (plumi-website) into a **launch-quality, product-led story site** (mobile → iPad → desktop) using **real Plumi UI** and **truthful claims only**.
- Base product truth on the authenticated Plumi iPad app repo persisted at **`/root/plumi-product`** (audited at commit **`125bddf`**) + supplied screenshots in **`/app/Plumi`**.
- Integrate Daniel’s marketing thinking where consistent with product truth. Daniel PDF reviewed: **`/app/Plumi landing page.pdf`**.
- Deliver ambitious but performant motion and a distinct **blue** mascot-led brand (no generic SaaS layout).
- **Primary CTA is Discord only**: https://discord.com/invite/mPhTczwfpk
  - No email waitlist UI exposed on the site.
- **Countdown is mandatory** to **25 September 2026** (UK time). After that date:
  - Must not go negative.
  - Must not claim unverified availability (“Launched”, “Download now”).
  - Resolves to **launch updates in Discord**.
- Preserve existing Next/Vercel architecture; avoid unnecessary new dependencies.

## 2) Implementation Steps

### Phase 1 — Audit & truth validation (COMPLETE)
**Why:** The key risk is misrepresenting the product; the iPad app cannot be executed in this Linux environment, so validation is by code + supplied captures.

**Phase 1 outcomes (delivered + verified)**
1) Product truth table (**LIVE / PARTIAL / FUTURE**) with code citations: **`/app/docs/rebuild/product-truth.md`**
2) Asset truth inventory (real vs reference vs illustrative): **`/app/docs/rebuild/asset-audit.md`**
3) Mobile-first storyboard (scene-by-scene truth constraints): **`/app/docs/rebuild/storyboard.md`**
4) Design system + real-asset rules: **`/app/design_guidelines.md`**
5) Testing verification of audit (source-based): **`/app/test_reports/iteration_1.json`**

**Key truth constraints enforced in implementation**
- **No claims of cross-app blocking** (FamilyControls entitlement not present): excluded.
- **No collaboration/shared workspaces** (explicitly not shipped): excluded.
- **No invented Practice/Progress UI** (no populated captures supplied): avoided.
- Focus shown only as a **timer** (real capture strip), not blocking.

### Phase 2 — V1 Site Development (COMPLETE)
**Goal:** Build the complete product story (not a SaaS template), using real Plumi UI and an explicitly-labelled illustrative mechanics sequence.

**Implemented story (mapped to brief)**
- **Scene 1 (Hero):** Tutor-on-page using the real 5-frame sequence from `IMG_0684` → `IMG_0689`, with pause + step controls.
- **Scenes 2–4 (Mechanics “holy shit”):** Illustrative paper SVG with step-by-step assembly (incline/block/pulley/hanging mass/string/θ/forces) → SAME problem evidence split (friction law correct vs normal reaction misconception) → targeted next question continuing same system (θ=40°, reveal worked step).
- **Practice proof:** Real “Now try this one” crop from `IMG_0689` (no invented Practice session UI).
- **Free notebook:** Real library/folders/tools views with a 3-tab gallery.
- **Compounding:** Real “Your next move” recommendation crop from `IMG_0709` (corrected; `IMG_0708` is blank paper).
- **Focus:** Real timer strip from `IMG_0709` (no app-blocking claim).
- **Compare:** Fair, minimal category comparison (Plumi vs AI web tutor vs private tutor vs note-taking app), mobile counterpart selector.
- **Community:** Final CTA to Discord, plus countdown that safely resolves post-launch.

**Phase 2 testing checkpoint (completed)**
- `yarn build` passed; lint/typecheck executed.
- Full browser regression done on mobile/tablet/desktop.

### Phase 3 — Polish, performance, SEO, and consistency passes (COMPLETE)
**Visual critic + responsive review**
- Reviewed and refined at **390 / 768 / 1024 / 1440** plus a **1920** hero capture.
- Updated crops for mobile legibility and corrected Home asset usage.
- Addressed a reported “mobile comparison” issue and confirmed it was a **false positive** (6 visible cells = 1 header + 5 rows, not 6 columns). Verified per-row behavior.
- Raised small-label and caption sizes on mobile.
- Fixed missing μ symbol in the **illustrative** mechanics equation (explicit stroke path), without altering the real Plumi handwriting system.
- Improved mechanics assembly stroke drawing (traces/string/forces) and question-writing reveal.

**Reduced motion + launch boundary testing (completed with actual automation)**
- Reduced-motion mode verified via Playwright APIs.
- Launch boundary verified before / at / after `2026-09-25T00:00:00+01:00`.
- No hydration/console errors.

**Testing artifacts**
- Phase 2 regression: **`/app/test_reports/iteration_2.json`**
- Phase 3 full regression: **`/app/test_reports/iteration_3.json`**
- Focused touch-target recheck: **`/app/test_reports/iteration_4.json`**

### Phase 4 — Final deliverables + handoff (COMPLETE)
**Handoff deliverables**
- Final handoff doc (items 1–10 consolidated): **`/app/docs/rebuild/handoff.md`**
- Visual review notes: **`/app/docs/rebuild/visual-review.md`**
- Deployment notes updated to reflect the community-first site: **`/app/docs/DEPLOY.md`**

**Preview**
- URL: https://focus-master-31.preview.emergentagent.com
- Preview serves a **production build** via supervisor program `plumi-web` on port 3000.
  - The unrelated template FARM services are not part of this project.

## 3) Next Actions
These are *handoff-ready checks only* (no new feature work; no deployment performed).
1. **Static deployment-readiness scan**:
   - Confirm `yarn install --frozen-lockfile`, `yarn build`, `yarn start`.
   - Confirm sitemap/robots accessibility and OG images present.
   - Confirm no secrets required (Discord-only; analytics inert).
2. Confirm the manual swap instructions are understood:
   - Hero can be replaced with Oliver’s final Tutor recording by setting `tutorMedia.videoMp4/videoWebm` in `src/content/story.ts` and adding files to `public/product/`.
   - No claim that final video playback has been tested (not supplied).
3. Optional (if/when you have them): supply **real populated Practice/Progress captures** to further increase “real UI dominance” without inventing surfaces.

## 4) Success Criteria (met)
- Visitor understands Plumi within ~5 seconds; **Tutor-on-page** is unmistakable.
- Real Plumi visuals dominate; **no invented UI**, no fake proof, no unverified claims.
- Discord is the only primary CTA and is present in hero + persistent nav + final CTA.
- Countdown to 2026-09-25 works; safe post-date messaging (no negatives, no unverified “Launched”).
- Mobile feels intentional; iPad feels calm; desktop feels premium theatre.
- Motion is purposeful and performant with reduced-motion equivalents.
- Build succeeds (`yarn build`), lint/typecheck pass, and Next/Vercel deploy path remains unchanged.
- Final deliverables are written and linked; manual media swaps are specific and limited.