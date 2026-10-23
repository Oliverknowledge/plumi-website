import { BankHub } from "@/components/questionBank/BankPages";
import { metadataFor } from "@/lib/metadata";

export const metadata = metadataFor("/question-bank");

export default function Page() {
  return <BankHub />;
}
