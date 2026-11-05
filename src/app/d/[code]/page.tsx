import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotShared } from "@/components/studyapp/share/NotShared";
import { SharedDeckView } from "@/components/studyapp/share/SharedDeckView";
import { isShareCode } from "@/lib/studyapp/sharing";
import { loadSharedDeck } from "@/lib/studyapp/sharing/server";

/**
 * Read for every visit, from the database, so a deck that was stopped is gone the moment it is stopped: never prerendered, never
 * kept by the site's cache. The cards are in the HTML (view-source shows them), so the first card paints without waiting for script.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  if (!isShareCode(code)) return { title: "Shared deck" };
  const r = await loadSharedDeck(code);
  return { title: r.kind === "deck" ? `${r.deck.title} · Plumi` : "Shared deck · Plumi" };
}

export default async function SharedDeckPage({ params }: Props) {
  const { code } = await params;
  if (!isShareCode(code)) notFound();
  const r = await loadSharedDeck(code);
  if (r.kind === "gone") notFound();
  if (r.kind === "busy") return <NotShared busy />;
  return <SharedDeckView code={code} deck={r.deck} />;
}
