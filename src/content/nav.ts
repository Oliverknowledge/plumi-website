import { discordUrl } from "@/config/site";

/**
 * Navigation, the same on every page (src/components/cosy/Chrome.tsx).
 *
 * The header leads with the question bank and the past papers, then the homepage's sections ("#marking"
 * on the homepage itself and "/#marking" everywhere else, so every page leads back into the
 * same story), then the Discord. Below 980px the links hide and the bar carries the logo
 * and the download button only; on a phone the homepage's hero tickets lead to the bank.
 *
 * The footer holds every indexable page, the community and the legal pair, so every
 * page stays one click from every other page.
 */
// "How it marks" left the bar (founder, 30 October 2026) to make room for the Android waitlist button, and
// "Study with friends" followed it on 31 October. The homepage still has the section; the bar does not link to it.
export const sectionLinks: readonly (readonly [string, string])[] = [];

// The question bank first, then the boards' past papers (founder, 30 October 2026), then a student's
// own revision board across their subjects (31 October 2026). Plumi's own
// practice packs are for Discord members now, so they're in the footer, not the bar.
export const pageLinks: readonly (readonly [string, string])[] = [
  ["Question bank", "/question-bank"],
  ["Past papers", "/past-papers"],
  ["My board", "/my-board"],
];

export const footerLinks: readonly (readonly [string, string])[] = [
  ["A-Level Maths", "/ai-tutor-for-a-level-maths"],
  ["Practice papers", "/practice-papers"],
  ["Past papers", "/past-papers"],
  ["Question bank", "/question-bank"],
  ["vs Goodnotes", "/goodnotes-alternative-for-students"],
  ["Android", "/android"],
  ["About", "/about"],
  ["For parents", "/parents"],
  ["Community", discordUrl],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
];
