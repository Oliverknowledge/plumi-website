import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BankSubjectPage } from "@/components/questionBank/BankPages";
import { bankPath, bankShareImage, bankSubject, bankSubjects, bankTitle } from "@/content/questionBank";
import { pastPaperMetadata } from "@/lib/pastPaperMeta";

type Params = Promise<{ subject: string }>;

export function generateStaticParams() {
  return bankSubjects.map(s => ({ subject: s.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s = bankSubject((await params).subject);
  if (!s) return {};
  return pastPaperMetadata(bankPath(s.slug), {
    title: `${bankTitle(s)} Exam Questions by Topic | Plumi`,
    description: s.scope
      ? `Every ${s.board} (Cambridge International) ${s.level} ${s.subject} question from ${s.scope}, by topic, with its mark scheme and examiner's report. Free, no sign-up.`
      : `Every ${s.board} ${s.level} ${s.subject} question since ${s.firstYear}, by topic, with its mark scheme and examiner's report. Free, no sign-up. Download any set as a PDF.`,
  }, bankShareImage(s));
}

export default async function Page({ params }: { params: Params }) {
  const s = bankSubject((await params).subject);
  if (!s) notFound();
  return <BankSubjectPage subject={s} />;
}
