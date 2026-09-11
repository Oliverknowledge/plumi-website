# Deploying the community-first Plumi website

## Existing production architecture — unchanged
This is the existing Next.js16 / React19 / TypeScript app, intended for Vercel. The rebuild does not introduce FastAPI, MongoDB, a separate backend, an animation framework or a CMS.

- Install: `yarn install --frozen-lockfile`
- Build: `yarn build`
- Serve a standalone Node deployment: `yarn start --hostname 0.0.0.0 --port 3000`
- Vercel: retain the Next.js framework preset and automatic output detection
- Canonical domain remains `https://tryplumi.app`; existing secondary domain is `plumi.study`. No DNS changes were made

## No new credentials required
The current site links to the confirmed Discord invite. It does not accept signups and does not initialise analytics or persist attribution. Supabase and PostHog credentials are not required. The legacy `/api/waitlist` Next route intentionally responds410 with the community destination; there is no UI using it.

## Content controls
- `src/config/site.ts`: exact Discord URL, confirmed launch date and existing domain
- `src/content/story.ts`: actual capture descriptions, gallery, comparison, media URLs
- `src/components/LandingPage.tsx`: scene order and concise copy
- `src/app/story.css`: responsive layout and motion
- `yarn og`: regenerate social images from actual Tutor capture and approved bird

The site remains community-first after the countdown reaches zero. The date is explicit UK time (`2026-09-25T00:00:00+01:00`), never goes negative, and changes to launch updates rather than claiming App Store availability. Do not use an unverified App Store link.

## Final recording swap
Place Oliver's final video in `public/product/` and set `tutorMedia.videoMp4` / `videoWebm` in `src/content/story.ts`. Current media is a sequence of genuine supplied stills, not a recording or live AI. The frame, poster, inline playback, pause and failure fallback are already provided. Dedicated populated Practice/Progress captures were not supplied; the page intentionally uses the actual Tutor next question and actual Home recommendation instead.

## Preview-specific runner
This environment came with an unrelated FARM supervisor template. The actual project is served by a separate `plumi-web` supervisor program in production mode on port3000. Its config is mirrored in `.context/plumi-web.conf`; this does not change Vercel configuration or production build scripts. Template backend/frontend services are unused.

## Validation
See `test_reports/iteration_1.json` (product-source audit), `iteration_2.json` and `iteration_3.json` (browser regression), plus the final focused touch-target check. Tests cover390/768/1024/1440px, real images, navigation, Discord destinations, media and gallery controls, diagram phases, reduced motion and launch boundaries. iOS product code was audited, not executed in Linux.
