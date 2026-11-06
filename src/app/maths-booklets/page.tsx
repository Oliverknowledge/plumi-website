import { BookletHub } from "@/components/booklets/BookletPages";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/maths-booklets");

export default function Page() {
  return <BookletHub />;
}
