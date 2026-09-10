"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CtaButton } from "@/components/ui/CtaButton";
import { Wordmark } from "@/components/ui/Wordmark";
import { activeCta } from "@/config/site";
import { navLinks } from "@/content/nav";

/**
 * Four links and a button. No hamburger: a landing page with a hidden menu
 * charges a tap to discover there was nothing worth finding. Below the `md`
 * breakpoint the links move to the footer and the bar carries the wordmark and
 * the call to action only, which is all a phone has room for anyway.
 *
 * The bar is transparent over the hero and takes on a surface once the page has
 * scrolled, so the hero's paper runs to the very top of the window.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 h-[var(--header-height)] transition-colors duration-300 ${
        scrolled
          ? "border-b border-[var(--color-hairline)] bg-[color-mix(in_srgb,var(--color-paper)_88%,transparent)] backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <nav className="container-plumi flex h-full items-center justify-between gap-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Plumi, home">
          <Wordmark />
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[0.9375rem] text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <CtaButton placement="header" size="compact" label={activeCta.compact} />
      </nav>
    </header>
  );
}
