import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { footerLinks } from "@/components/SiteFooter";
import { site } from "@/config/site";

/**
 * The pieces the subject pages share: the iPad frame round a real capture, and the
 * footer. They lived in the previous homepage (HomePage.tsx) until the cosy landing
 * replaced it on 19 October 2026; the subject pages keep that design.
 */
export function IPad({ src, alt, priority = false, fit = "cover", className = "", sizes = "(max-width: 760px) 92vw, (max-width: 1200px) 60vw, 760px", width = 2000, height = 1500, children }: { src: string; alt: string; priority?: boolean; fit?: "cover" | "contain"; className?: string; sizes?: string; width?: number; height?: number; children?: ReactNode }) {
  return (
    <div className={`hp-ipad ${className}`}>
      <div className="hp-ipad-screen">
        <Image src={src} alt={alt} width={width} height={height} priority={priority}
          sizes={sizes}
          className={fit === "contain" ? "is-contain" : ""} />
        {children}
      </div>
    </div>
  );
}

/** Apple's footer: fine print first, then the links, then the line. */
export function HomeFooter() {
  return (
    <footer className="hp-footer">
      <div className="hp-wrap">
        <p className="hp-footer-fine">Plumi writes its own exam-style questions and mark schemes. It is not affiliated with or endorsed by AQA, OCR or Pearson Edexcel. iPad and Apple Pencil are trademarks of Apple Inc.</p>
        <div className="hp-footer-row">
          <Link href="/" data-testid="footer-home-link" aria-label="Plumi home" className="hp-footer-brand">
            <Image src="/site/app-icon.webp" alt="" width={22} height={22} /><span>Plumi</span>
          </Link>
          <nav aria-label="Footer navigation" className="hp-footer-links">
            {footerLinks.map(([label, href]) => (
              <Link key={label} href={href} data-testid={`footer-${label.toLowerCase().replaceAll(" ", "-")}-link`}>{label}</Link>
            ))}
          </nav>
        </div>
        <div className="hp-footer-base">
          <span>© 2026 Plumi. Made in the UK.</span>
          <a href={`mailto:${site.contactEmail}`} data-testid="footer-contact-link">{site.contactEmail}</a>
        </div>
      </div>
    </footer>
  );
}
