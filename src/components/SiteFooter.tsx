import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { discordUrl, entityDescription, site } from "@/config/site";

/**
 * Footer links, and why there are more of them than there used to be.
 *
 * Six anchors to sections of one page meant every landing page was an orphan —
 * reachable only if a crawler guessed the URL. These are nine real links, so
 * every indexable page is one click from every other page, with anchor text
 * that describes the destination instead of saying "learn more".
 *
 * Nine is the ceiling, not a starting point. The failure mode here is the
 * keyword-stuffed mega-footer, which reads as spam to a person and to Google.
 * Pages added after this should earn their place by cross-linking from the
 * pages they relate to — see `linksTo` in src/config/routes.ts.
 */
const footerLinks: readonly (readonly [string, string])[] = [
  ["How it works", "/how-it-works"],
  ["A-Level Maths tutor", "/ai-tutor-for-a-level-maths"],
  ["GCSE Maths", "/gcse-maths"],
  ["AI handwriting tutor", "/ai-handwriting-tutor"],
  ["iPad study app", "/ipad-study-app"],
  ["vs Goodnotes", "/goodnotes-alternative-for-students"],
  ["About", "/about"],
  ["Community", discordUrl],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
];

export function SiteFooter() {
  return <footer className="story-footer"><div className="story-container footer-top">
    <div><Link href="/" data-testid="footer-home-link" aria-label="Plumi home"><Wordmark /></Link>
      {/* The literal definition, on every page. Identical to the string in the
          meta description and the Organization JSON-LD — an entity is easier to
          believe when all three agree word for word. */}
      <p className="footer-blurb">{entityDescription}</p></div>
    <nav aria-label="Footer navigation">{footerLinks.map(([label, href]) => <Link key={label} href={href} data-testid={`footer-${label.toLowerCase().replaceAll(" ", "-")}-link`}>{label}</Link>)}</nav>
  </div><div className="story-container footer-bottom"><span>© 2026 Plumi</span><span>Made in the UK, for GCSE and A-Level.</span><a href={`mailto:${site.contactEmail}`} data-testid="footer-contact-link">Say hello ↗</a></div></footer>;
}
