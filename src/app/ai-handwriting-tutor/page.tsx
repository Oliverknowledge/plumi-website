import { MarketingPage } from "@/components/MarketingPage";
import { aiHandwritingTutor } from "@/content/landing";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/ai-handwriting-tutor");

export default function Page() {
  return <MarketingPage content={aiHandwritingTutor} />;
}
