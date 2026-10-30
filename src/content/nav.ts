import { discordUrl } from "@/config/site";

/**
 * Navigation, the same on every page (src/components/cosy/Chrome.tsx).
 *
 * The header leads with the free practice pages, then the homepage's sections ("#marking"
 * on the homepage itself and "/#marking" everywhere else, so every page leads back into the
 * same story), then the Discord. Below 980px the links hide and the bar carries the logo
 * and the download button only; on a phone the homepage's hero tickets lead to the bank.
 *
 * The footer holds every indexable page, the community and the legal pair, so every
 * page stays one click from every other page.
 */
// "How it marks" left the bar (founder, 30 October 2026) to make room for the Android waitlist button.
export const sectionLinks: readonly (readonly [string, string])[] = [
  ["Study with friends", "friends"],
];

// Past papers sit inside Practice papers (founder, 25 October 2026): Plumi's own packs first,
// then the board's papers at the foot of that page. Their addresses stay /past-papers/..., which
// search engines already know, and the footer still links them directly.
export const pageLinks: readonly (readonly [string, string])[] = [
  ["Practice papers", "/practice-papers"],
  ["Question bank", "/question-bank"],
];

export const footerLinks: readonly (readonly [string, string])[] = [
  ["Physics revision", "/physics-revision"],
  ["Chemistry revision", "/chemistry-revision"],
  ["Biology revision", "/biology-revision"],
  ["A-Level Maths", "/ai-tutor-for-a-level-maths"],
  ["GCSE Maths", "/gcse-maths"],
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
