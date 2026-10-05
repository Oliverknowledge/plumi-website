import Link from "next/link";
import { CtaButton } from "@/components/ui/CtaButton";
import { Wordmark } from "@/components/ui/Wordmark";
import { navLinks } from "@/content/nav";
import { activeCta } from "@/config/site";
export function SiteHeader() {
  return <header className="floating-header"><nav aria-label="Main navigation" className="floating-nav">
    <Link href="/" aria-label="Plumi home" className="brand-link" data-testid="header-home-link"><Wordmark /></Link>
    <div className="nav-links">{navLinks.map(link => <Link key={link.href} href={`/${link.href}`} data-testid={`nav-${link.href.slice(1)}-link`}>{link.label}</Link>)}</div>
    <CtaButton placement="header" label={activeCta.compact} size="compact" />
  </nav></header>;
}
