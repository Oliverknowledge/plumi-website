import { MarketingPage } from "@/components/MarketingPage";
import { howItWorks } from "@/content/landing";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/how-it-works");

export default function Page() {
  return <MarketingPage content={howItWorks} />;
}
