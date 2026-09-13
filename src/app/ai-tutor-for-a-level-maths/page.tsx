import { MarketingPage } from "@/components/MarketingPage";
import { aiTutorALevelMaths } from "@/content/landing";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/ai-tutor-for-a-level-maths");

export default function Page() {
  return <MarketingPage content={aiTutorALevelMaths} />;
}
