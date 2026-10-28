import type { Metadata } from "next";

import { intentFor } from "@/config/routes";
import { site } from "@/config/site";

/**
 * Page metadata, derived from the route registry.
 *
 * Every indexable page needs a unique title, a unique description and an
 * intentional canonical, and the reliable way to get all three is to generate
 * them from the one place the intent is already written down. Hand-writing them
 * per page is how you end up with two pages sharing a description and Search
 * Console telling you about it six weeks later.
 *
 * The canonical is explicit rather than inherited. `metadataBase` resolves it
 * against the canonical domain, so the copy of this page served from any other
 * host still points home.
 */
/** The share card every page uses: the cosy homepage, made by scripts/build-og-lofi.ts. */
const shareImage = { url: "/og-lofi.png", width: 1200, height: 630, alt: "The cosy notebook that marks your work. Plumi, the GCSE and A-Level revision app for iPad." };

export function metadataFor(path: string): Metadata {
  const intent = intentFor(path);
  const image = shareImage;

  return {
    // `absolute` opts out of the root layout's " · Plumi" template. These
    // titles are written as complete search results and already carry the brand
    // where it helps, so the template would only spend characters repeating it —
    // "How Plumi Works — Write, Get Tutored, Practise · Plumi" says Plumi twice
    // and truncates. The legal pages still use the template, which is right for
    // them: "Privacy" alone would be a poor result.
    title: { absolute: intent.title },
    description: intent.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title: intent.title,
      description: intent.description,
      // `siteName` and `locale` are repeated from the root layout on purpose.
      // Metadata objects are merged *shallowly*, so a page that defines its own
      // `openGraph` replaces the parent's whole object rather than extending it —
      // omit these and every page but the homepage silently ships with no
      // `og:site_name` at all. That tag is one of the signals Google uses to
      // decide whether a result is labelled "Plumi" or "tryplumi.app".
      siteName: site.name,
      locale: site.locale,
      // Repeated per page for the same shallow-merge reason: without it a shared
      // link to any page but the homepage shows no picture at all.
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: intent.title,
      description: intent.description,
      images: [image.url],
    },
  };
}
