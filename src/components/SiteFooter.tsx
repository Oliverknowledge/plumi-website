import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { discordUrl, site } from "@/config/site";

/**
 * Footer links: the pages that exist, the community, and the legal pair.
 * Every indexable page stays one click from every other page.
 */
export const footerLinks: readonly (readonly [string, string])[] = [
  ["A-Level Maths", "/ai-tutor-for-a-level-maths"],
  ["GCSE Maths", "/gcse-maths"],
  ["vs Goodnotes", "/goodnotes-alternative-for-students"],
  ["About", "/about"],
  ["Community", discordUrl],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
];

export function SiteFooter() {
  return <footer className="story-footer"><div className="story-container footer-top">
    <div><Link href="/" data-testid="footer-home-link" aria-label="Plumi home"><Wordmark /></Link>
      <p className="footer-blurb">AI study notebook for STEM at A-Level and GCSE.</p></div>
    <nav aria-label="Footer navigation">{footerLinks.map(([label, href]) => <Link key={label} href={href} data-testid={`footer-${label.toLowerCase().replaceAll(" ", "-")}-link`}>{label}</Link>)}</nav>
  </div><div className="story-container footer-bottom"><span>© 2026 Plumi</span><span>Made in the UK.</span><a href={`mailto:${site.contactEmail}`} data-testid="footer-contact-link">Say hello ↗</a></div></footer>;
}
