import { CosyHome } from "@/components/landing/CosyHome";

/**
 * The homepage: since 19 October 2026 the founder's cosy notebook design, in
 * src/components/landing/CosyHome.tsx with its words in src/content/cosyHome.ts.
 * The /v/ variants render it too. The subject pages keep the previous design
 * (src/components/home/SubjectPage.tsx).
 */
export function LandingPage({ variant }: { variant?: string }) {
  return <CosyHome variant={variant} />;
}
