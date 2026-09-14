import { LandingPage } from "@/components/LandingPage";
import { HomeStructuredData } from "@/components/StructuredData";

/**
 * The default landing. Statically prerendered.
 *
 * The `WebSite` block lives here rather than in the root layout because Google
 * reads the site name from the homepage only. See HomeStructuredData.
 */
export default function Page() {
  return (
    <>
      <HomeStructuredData />
      <LandingPage />
    </>
  );
}
