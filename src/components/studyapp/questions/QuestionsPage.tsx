"use client";

import Image from "next/image";
import { useQuestions } from "@/lib/studyapp/questions/store";
import type { CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { Picker } from "./Picker";
import { Sheet } from "./Sheet";

/**
 * Questions: pick from the question bank, then write the answers under each part on a sheet (docs/study/questions.md).
 * The set on the desk is remembered, so closing the tab and coming back returns to it.
 */
export function QuestionsPage({ catalogue }: { catalogue: CatalogueSubject[] }) {
  const { ready, q } = useQuestions();
  if (!ready) {
    return (
      <main className="qs-page qs-wait" role="status" aria-label="Opening your questions">
        <Image src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={64} height={64} unoptimized />
      </main>
    );
  }
  const open = q.open ? q.sets.find((s) => s.id === q.open) : undefined;
  return open ? <Sheet key={open.id} set={open} q={q} /> : <Picker catalogue={catalogue} q={q} />;
}
