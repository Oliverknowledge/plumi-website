import Link from "next/link";
import { CtaButton } from "@/components/ui/CtaButton";
import { Wordmark } from "@/components/ui/Wordmark";
export function SiteHeader() {
  return <header className="floating-header"><nav aria-label="Main navigation" className="floating-nav">
    <Link href="/" aria-label="Plumi home" className="brand-link" data-testid="header-home-link"><Wordmark /></Link>
    <div className="nav-links">{[["Product", "product"], ["How it works", "how-it-works"], ["Compare", "compare"], ["Community", "community"]].map(([label, id]) => <Link key={id} href={`/#${id}`} data-testid={`nav-${id}-link`}>{label}</Link>)}</div>
    <CtaButton placement="header" label="Join Discord" size="compact" />
  </nav></header>;
}
