import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { privacy } from "@/content/legal";
import { site } from "@/config/site";

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
    // Repeated from the root layout deliberately: metadata merges shallowly, so
    // defining `openGraph` here replaces the parent's object entirely.
    siteName: site.name,
    locale: site.locale,
  },
};

export default function PrivacyPage() {
  return <LegalDocument doc={privacy} />;
}
