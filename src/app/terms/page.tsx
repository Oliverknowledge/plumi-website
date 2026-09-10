import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { terms } from "@/content/legal";

/** Indexable, for the same reason as the privacy page. */
export const metadata: Metadata = {
  title: terms.title,
  description: terms.description,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: `${terms.title} · Plumi`,
    description: terms.description,
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <LegalDocument doc={terms} />
      </main>
      <SiteFooter />
    </>
  );
}
