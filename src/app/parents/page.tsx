import { MarketingPage } from "@/components/MarketingPage";
import { parents } from "@/content/landing";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/parents");

export default function Page() {
  return <MarketingPage content={parents} />;
}
