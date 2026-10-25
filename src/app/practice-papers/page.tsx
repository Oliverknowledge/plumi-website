import { PackHub } from "@/components/practicePacks/PackPages";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/practice-papers");

export default function Page() {
  return <PackHub />;
}
