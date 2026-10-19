import { MarketingPage } from "@/components/MarketingPage";
import { goodnotesAlternative } from "@/content/landing";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/goodnotes-alternative-for-students");

export default function Page() {
  return <MarketingPage content={goodnotesAlternative} />;
}
