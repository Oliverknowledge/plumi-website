import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { LandingPage } from "@/components/LandingPage";
import { HERO_VARIANTS, heroFor, type HeroVariant } from "@/content/copy";

/**
 * The alternate landings.
 *
 * A path rather than a query string, because `?v=` on the homepage would make
 * the homepage dynamic — every visitor would then wait for a server render of a
 * page that has no data to fetch and never changes. As routes, all three
 * variants are prerendered at build time and served from the edge as static
 * HTML, which is the whole performance argument of this site.
 *
 * Paid social points at `/v/decide`; organic and referral at `/v/mirror`.
 * `landing_variant` is read from the path by `src/lib/attribution.ts`, so it
 * still travels with every analytics event and onto the waitlist row.
 */
export function generateStaticParams(): Array<{ variant: string }> {
  return HERO_VARIANTS.map((variant) => ({ variant }));
}

/** Anything that is not a known variant is a 404, not a silent fallback. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ variant: string }>;
}): Promise<Metadata> {
  const { variant } = await params;
  const copy = heroFor(variant);

  return {
    title: `Plumi: ${copy.headline.replace(/\.$/, "")}`,
    description: copy.subhead,
    // The variants are the same page with a different pitch. Pointing the
    // canonical at the homepage stops them competing with it in search, which
    // is the usual way an A/B test quietly costs you your own ranking.
    alternates: { canonical: "/" },
    robots: { index: false, follow: true },
  };
}

export default async function VariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!(HERO_VARIANTS as readonly string[]).includes(variant)) notFound();

  return <LandingPage variant={variant as HeroVariant} />;
}
