import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { privacy } from "@/content/legal";

/**
 * Indexable, deliberately. `robots: { index: false }` on a privacy notice is
 * the wrong instinct — people search for these, and a site collecting email
 * addresses should want its privacy page findable.
 */
export const metadata: Metadata = {
  title: privacy.title,
  description: privacy.description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `${privacy.title} · Plumi`,
    description: privacy.description,
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <LegalDocument doc={privacy} />
      </main>
      <SiteFooter />
    </>
  );
}
