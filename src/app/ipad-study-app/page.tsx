import { MarketingPage } from "@/components/MarketingPage";
import { ipadStudyApp } from "@/content/landing";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/ipad-study-app");

export default function Page() {
  return <MarketingPage content={ipadStudyApp} />;
}
