import type { Metadata } from "next";
import { NotShared } from "@/components/studyapp/share/NotShared";
import { SharedDeckView } from "@/components/studyapp/share/SharedDeckView";
import { isShareCode, normaliseCode } from "@/lib/studyapp/sharing";
import { loadSharedDeck } from "@/lib/studyapp/sharing/server";

/**
 * Read for every visit, from the database, so a deck that was stopped is gone the moment it is stopped: never prerendered, never
 * kept by the site's cache. A deck that is not there is drawn by `NotShared` (with a 200: nothing indexes this page, and a status code is
 * not something the student sees). The cards are in the HTML (view-source shows them), so the first card paints without waiting for script.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = normaliseCode((await params).code);
  if (!isShareCode(code)) return { title: "Shared deck" };
  const r = await loadSharedDeck(code);
  return { title: r.kind === "deck" ? `${r.deck.title} · Plumi` : "Shared deck · Plumi" };
}

export default async function SharedDeckPage({ params }: Props) {
  const code = normaliseCode((await params).code);   // the database ignores case and spaces; so does the page
  if (!isShareCode(code)) return <NotShared />;
  const r = await loadSharedDeck(code);
  if (r.kind !== "deck") return <NotShared variant={r.kind} />;
  return <SharedDeckView code={code} deck={r.deck} />;
}
