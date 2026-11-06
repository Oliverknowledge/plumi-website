import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BookletGroupPage, groupPageMeta } from "@/components/booklets/BookletPages";
import { bookletGroup, bookletGroupPath, bookletGroups } from "@/content/booklets";
import { pastPaperMetadata } from "@/lib/pastPaperMeta";

/** /maths-booklets/standard and friends: one per group of MadAsMaths booklets, prerendered. */
export function generateStaticParams(): Array<{ group: string }> {
  return bookletGroups.map(g => ({ group: g.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }): Promise<Metadata> {
  const group = bookletGroup((await params).group);
  return group ? pastPaperMetadata(bookletGroupPath(group.slug), groupPageMeta(group)) : {};
}

export default async function Page({ params }: { params: Promise<{ group: string }> }) {
  const group = bookletGroup((await params).group);
  if (!group) notFound();
  return <BookletGroupPage group={group} />;
}
