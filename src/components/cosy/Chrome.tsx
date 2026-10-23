import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeaderDownload } from "@/components/home/AppStoreBadge";
import { entityDescription, site } from "@/config/site";
import { footerLinks, pageLinks, sectionLinks } from "@/content/nav";

/**
 * The cosy notebook's frame, shared by every page on the site (the founder, 19 October
 * 2026: "every page must be in the new style"). One header, one footer, one sheet of ruled
 * paper, so moving from the homepage to a subject page never feels like changing site.
 *
 * The look lives in src/app/cosy.css, scoped under `.lp`. Page-specific pieces are in
 * landing.css (the homepage's sections) and pages.css (subject, intent and legal pages).
 */

/** The header: logo, the homepage's sections, and the download key. */
export function CosyHeader({ home = false }: { home?: boolean }) {
  return (
    <header className="lp-nav">
      <div className="lp-wrap">
        <Link className="lp-logo" href="/" aria-label="Plumi home" data-testid="header-home-link">
          <Image src="/landing/plumi-mood-happy.svg" alt="" width={40} height={40} unoptimized priority />plumi
        </Link>
        <nav aria-label="Sections">
          {sectionLinks.map(([label, id]) => home
            ? <a key={id} href={`#${id}`}>{label}</a>
            : <Link key={id} href={`/#${id}`}>{label}</Link>)}
          {pageLinks.map(([label, href]) => <Link key={href} href={href} className="lp-nav-page" data-testid={`header-${href.slice(1)}-link`}>{label}</Link>)}
        </nav>
        <HeaderDownload download="Get it free" className="lp-btn lp-navbtn" />
      </div>
    </header>
  );
}

/** The footer: every page, the community, the legal pair, and the one-line definition. */
export function CosyFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-row">
          <span className="lp-wordmark">plumi</span>
          <nav aria-label="Footer navigation">
            {footerLinks.map(([label, href]) => (
              <Link key={label} href={href} data-testid={`footer-${label.toLowerCase().replaceAll(" ", "-")}-link`}>{label}</Link>
            ))}
          </nav>
          <a href={`mailto:${site.contactEmail}`} data-testid="footer-contact-link">{site.contactEmail}</a>
        </div>
        <p className="lp-entity">{entityDescription}</p>
        <p className="lp-fineprint">Plumi isn’t affiliated with any exam board. iPad and Apple Pencil are trademarks of Apple Inc. © 2026 Plumi. Made in the UK. Pixel art: <a href="https://limezu.itch.io" rel="noopener" data-testid="footer-limezu-link">LimeZu</a>.</p>
      </div>
    </footer>
  );
}

/** A whole page: the paper, the header, `<main id="main">`, the footer. */
export function CosyPage({ children, home = false, variant, after, style }: { children: ReactNode; home?: boolean; variant?: string; after?: ReactNode; style?: CSSProperties }) {
  return (
    <div className="lp" data-variant={variant} style={style}>
      <CosyHeader home={home} />
      <main id="main">{children}</main>
      <CosyFooter />
      {after}
    </div>
  );
}

/** A section's eyebrow, title (with an optional orange tail) and one short line. */
export function SectionHead({ eyebrow, title, titleEm, lead, id, as: H = "h2" }: { eyebrow?: string; title: ReactNode; titleEm?: string; lead?: ReactNode; id?: string; as?: "h1" | "h2" }) {
  return (
    <div className="lp-sec-head">
      {eyebrow && <span className="lp-eyebrow">{eyebrow}</span>}
      <H id={id}>{title}{titleEm && <> <em>{titleEm}</em></>}</H>
      {lead && <p className="lp-lead">{lead}</p>}
    </div>
  );
}

/** The notebook's wire binding, along the top edge of a card. */
export const Spiral = () => <div className="lp-spiral" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>;

/** A strip of washi tape holding a card to the page. */
export const Tape = () => <div className="lp-tape" aria-hidden="true" />;

/** The little blue "soon" label on anything built but not yet released. */
export const Soon = ({ children = "soon" }: { children?: string }) => <span className="lp-soon">{children}</span>;

/** A pixel window's title bar: three dots and a label. */
export const WindowBar = ({ label }: { label: string }) => (
  <div className="lp-bar" aria-hidden="true"><i style={{ background: "#e0605a" }} /><i style={{ background: "#f2c96b" }} /><i style={{ background: "#8fb35a" }} /><span>{label}</span></div>
);

/** Schema text with ordinary hyphens and spaces, as search engines read it. */
export const plain = (text: string) => text.replace(/‑/g, "-").replace(/ /g, " ");

/** A FAQPage block for the questions on the page. */
export function FaqSchema({ faq }: { faq: readonly { q: string; a: string }[] }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map(f => ({ "@type": "Question", name: plain(f.q), acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })),
    }).replace(/</g, "\\u003c") }} />
  );
}
