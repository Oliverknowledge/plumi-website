/**
 * Navigation.
 *
 * Four links to the homepage's sections, no hamburger. Each href is
 * root-relative ("/#how") so it works from every page, not only the homepage.
 * Below 700px the links hide and the bar carries the wordmark and the download
 * button only. The footer (src/components/SiteFooter.tsx) holds the page links
 * and the legal links.
 */

export interface NavLink {
  label: string;
  href: string;
}

export const navLinks: readonly NavLink[] = [
  { label: "How it marks", href: "/#how" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;
