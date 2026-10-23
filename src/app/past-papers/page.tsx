import { PastPapersHub } from "@/components/pastPapers/PastPapersHub";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/past-papers");

export default function Page() {
  return <PastPapersHub />;
}
