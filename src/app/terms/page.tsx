import type { Metadata } from "next";

import { LegalDocument } from "@/components/LegalDocument";
import { terms } from "@/content/legal";
import { site } from "@/config/site";

/** Indexable, for the same reason as the privacy page. */
export const metadata: Metadata = {
  title: "Website Terms",
  description: terms.description,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Website Terms · Plumi",
    description: terms.description,
    url: "/terms",
    // Repeated from the root layout deliberately: metadata merges shallowly, so
    // defining `openGraph` here replaces the parent's object entirely.
    siteName: site.name,
    locale: site.locale,
    images: [{ url: "/og-lofi.png", width: 1200, height: 630, alt: "Plumi, the GCSE and A-Level revision app for iPad." }],
  },
};

export default function TermsPage() {
  return <LegalDocument doc={terms} />;
}
