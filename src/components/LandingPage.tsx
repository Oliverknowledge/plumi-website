import { HomePage } from "@/components/home/HomePage";

/**
 * The homepage. Rebuilt on 14 October 2026 around the ad's story (write, marked, why,
 * better), real captures from the app, and Apple's band rhythm: see
 * src/components/home/HomePage.tsx and src/content/home.ts. The drawn scenes that were
 * here (TheMark, LearnerTree, PracticeCard) rendered nowhere and were deleted. The
 * subject pages use src/components/home/SubjectPage.tsx.
 */
export function LandingPage({ variant }: { variant?: string }) {
  return <HomePage variant={variant} />;
}
