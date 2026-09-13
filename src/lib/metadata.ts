import type { Metadata } from "next";

import { intentFor } from "@/config/routes";

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
export function metadataFor(path: string): Metadata {
  const intent = intentFor(path);

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
    },
    twitter: {
      card: "summary_large_image",
      title: intent.title,
      description: intent.description,
    },
  };
}
