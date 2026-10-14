import "../story.css";
import "../quill.css";
import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { terms } from "@/content/legal";
import { site } from "@/config/site";

/** Indexable, for the same reason as the privacy page. */
export const metadata: Metadata = {
  title: terms.title,
  description: terms.description,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: `${terms.title} · Plumi`,
    description: terms.description,
    url: "/terms",
    // Repeated from the root layout deliberately: metadata merges shallowly, so
    // defining `openGraph` here replaces the parent's object entirely.
    siteName: site.name,
    locale: site.locale,
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
