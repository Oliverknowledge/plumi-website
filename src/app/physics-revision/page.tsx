import { SubjectPage } from "@/components/home/SubjectPage";
import { subjectPages } from "@/content/subjects";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/physics-revision");

export default function Page() {
  return <SubjectPage content={subjectPages.physics} />;
}
