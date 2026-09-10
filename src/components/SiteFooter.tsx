import Link from "next/link";

import { Wordmark } from "@/components/ui/Wordmark";
import { footer, navLinks, type NavLink } from "@/content/nav";

/**
 * The footer, and on a phone the site's only navigation.
 *
 * The header hides its links below `md`, so every entry in `navLinks` has to
 * appear down here or it does not exist on a phone at all. Rather than trusting
 * that to stay true while `nav.ts` is edited, anything missing is appended to
 * the first column below — the guarantee is structural, not a comment.
 *
 * The honesty line gets the top of the footer and a size normally reserved for
 * a section sub-head. It is the single most useful sentence on the page for a
 * sceptical visitor: every well-made pre-launch site is suspected of being
 * concept art, and this one says outright that it isn't and can be checked.
 */

function FooterLink({ link }: { link: NavLink }) {
  const className =
    "inline-block py-1.5 text-[0.9375rem] text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]";

  // A bare "#the-page" is dead on /privacy and /terms, where the footer also
  // appears and where there is no such section. Anchored to "/" it works from
  // anywhere, and still behaves as a scroll rather than a load on the home page.
  const href = link.href.startsWith("#") ? `/${link.href}` : link.href;

  return href.startsWith("/") ? (
    <Link href={href} className={className}>
      {link.label}
    </Link>
  ) : (
    <a href={href} className={className}>
      {link.label}
    </a>
  );
}

export function SiteFooter() {
  const listed = new Set<string>(
    footer.columns.flatMap((column) => column.links.map((link) => link.href)),
  );
  const missing = navLinks.filter((link) => !listed.has(link.href));

  const columns = footer.columns.map((column, index) =>
    index === 0 ? { ...column, links: [...column.links, ...missing] } : column,
  );

  return (
    <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-surface)]">
      <div className="container-plumi py-16 sm:py-20">
        <p className="measure-wide border-l-2 border-[var(--color-blue-600)] pl-5 text-lead text-[var(--color-ink)] text-pretty">
          {footer.honesty}
        </p>

        <div className="mt-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
          <div>
            <Link href="/" aria-label="Plumi, home" className="inline-flex">
              <Wordmark />
            </Link>
            <p className="mt-4 measure text-[0.9375rem] text-[var(--color-ink-secondary)]">
              {footer.blurb}
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="eyebrow !text-[var(--color-ink-tertiary)]">{column.title}</h2>
                <ul className="mt-4">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.href}`}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="mt-14 border-t border-[var(--color-hairline)] pt-8 text-sm text-[var(--color-ink-tertiary)]">
          {footer.copyright}
        </p>
      </div>
    </footer>
  );
}
