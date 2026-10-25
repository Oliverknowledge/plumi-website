import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PackPage, packPageMeta } from "@/components/practicePacks/PackPages";
import { packPath, packShareImage, practicePack, practicePacks } from "@/content/practicePacks";
import { pastPaperMetadata } from "@/lib/pastPaperMeta";

/** /practice-packs/a-level-physics-ocr and friends: one per pack, prerendered. */
export function generateStaticParams(): Array<{ pack: string }> {
  return practicePacks.map(p => ({ pack: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ pack: string }> }): Promise<Metadata> {
  const pack = practicePack((await params).pack);
  return pack ? pastPaperMetadata(packPath(pack.slug), packPageMeta(pack), packShareImage(pack)) : {};
}

export default async function Page({ params }: { params: Promise<{ pack: string }> }) {
  const pack = practicePack((await params).pack);
  if (!pack) notFound();
  return <PackPage pack={pack} />;
}
