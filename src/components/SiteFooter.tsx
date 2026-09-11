import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { discordUrl, site } from "@/config/site";
export function SiteFooter() {
  return <footer className="story-footer"><div className="story-container footer-top">
    <div><Link href="/" data-testid="footer-home-link" aria-label="Plumi home"><Wordmark /></Link><p>A little more understanding. Every page.</p></div>
    <nav aria-label="Footer navigation">{[["Product", "/#product"], ["How it works", "/#how-it-works"], ["Compare", "/#compare"], ["Community", discordUrl], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => <Link key={label} href={href} data-testid={`footer-${label.toLowerCase().replaceAll(" ", "-")}-link`}>{label}</Link>)}</nav>
  </div><div className="story-container footer-bottom"><span>© 2026 Plumi</span><span>Made for curious minds.</span><a href={`mailto:${site.contactEmail}`} data-testid="footer-contact-link">Say hello ↗</a></div></footer>;
}
