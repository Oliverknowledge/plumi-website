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
  title: "Privacy Notice",
  description: privacy.description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Notice · Plumi",
    description: privacy.description,
    url: "/privacy",
    // Repeated from the root layout deliberately: metadata merges shallowly, so
    // defining `openGraph` here replaces the parent's object entirely.
    siteName: site.name,
    locale: site.locale,
    images: [{ url: "/og-lofi.png", width: 1200, height: 630, alt: "Plumi, the GCSE and A-Level revision app for iPad." }],
  },
};

export default function PrivacyPage() {
  return <LegalDocument doc={privacy} />;
}
