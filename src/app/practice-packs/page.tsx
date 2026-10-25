import { PackHub } from "@/components/practicePacks/PackPages";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/practice-packs");

export default function Page() {
  return <PackHub />;
}
