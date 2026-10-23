import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BoardPapersPage } from "@/components/pastPapers/BoardPapersPage";
import { boardPapers, pastPaperSubjects, subjectHub } from "@/content/pastPapers";
import { boardMetadata } from "@/lib/pastPaperMeta";

type Params = Promise<{ subject: string; board: string }>;

/** /past-papers/a-level-chemistry/aqa and friends: every board of every subject, prerendered. */
export function generateStaticParams(): Array<{ subject: string; board: string }> {
  return pastPaperSubjects.flatMap(s => s.boards.map(board => ({ subject: s.slug, board })));
}

export const dynamicParams = false;

async function resolve(params: Params) {
  const { subject, board } = await params;
  const hub = subjectHub(subject);
  const papers = hub && boardPapers(subject, board);
  return hub && papers ? { hub, papers } : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await resolve(params);
  return found ? boardMetadata(found.hub, found.papers) : {};
}

export default async function Page({ params }: { params: Params }) {
  const found = await resolve(params);
  if (!found) notFound();
  return <BoardPapersPage hub={found.hub} board={found.papers} />;
}
