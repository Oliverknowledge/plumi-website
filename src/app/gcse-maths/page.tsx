import { MarketingPage } from "@/components/MarketingPage";
import { gcseMaths } from "@/content/landing";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/gcse-maths");

export default function Page() {
  return <MarketingPage content={gcseMaths} />;
}
