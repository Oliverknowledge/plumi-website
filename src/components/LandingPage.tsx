import { CosyHome } from "@/components/landing/CosyHome";

/**
 * The homepage: since 19 October 2026 the founder's cosy notebook design, in
 * src/components/landing/CosyHome.tsx with its words in src/content/cosyHome.ts.
 * The /v/ variants render it too. Every other page shares its header, footer and
 * paper (src/components/cosy/Chrome.tsx).
 */
export function LandingPage({ variant }: { variant?: string }) {
  return <CosyHome variant={variant} />;
}
