import "../story.css";
import "../quill.css";
import { MarketingPage } from "@/components/MarketingPage";
import { about } from "@/content/landing";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/about");

export default function Page() {
  return <MarketingPage content={about} />;
}
