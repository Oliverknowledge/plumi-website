import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SubjectPapersPage } from "@/components/pastPapers/SubjectPapersPage";
import { pastPaperSubjects, subjectHub } from "@/content/pastPapers";
import { subjectMetadata } from "@/lib/pastPaperMeta";

/** /past-papers/a-level-chemistry and friends: one per subject and level, prerendered. */
export function generateStaticParams(): Array<{ subject: string }> {
  return pastPaperSubjects.map(s => ({ subject: s.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }): Promise<Metadata> {
  const hub = subjectHub((await params).subject);
  return hub ? subjectMetadata(hub) : {};
}

export default async function Page({ params }: { params: Promise<{ subject: string }> }) {
  const hub = subjectHub((await params).subject);
  if (!hub) notFound();
  return <SubjectPapersPage hub={hub} />;
}
