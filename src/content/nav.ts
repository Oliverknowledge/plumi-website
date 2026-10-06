/**
 * Navigation.
 *
 * Three links to the three scenes, no hamburger. Below 700px the links hide
 * and the bar carries the wordmark and the download button only. The footer
 * (src/components/SiteFooter.tsx) holds the page links and the legal links.
 */

export interface NavLink {
  label: string;
  href: string;
}

export const navLinks: readonly NavLink[] = [
  { label: "The mark", href: "#the-mark" },
  { label: "What it learns", href: "#learner-model" },
  { label: "Next question", href: "#practice" },
] as const;
