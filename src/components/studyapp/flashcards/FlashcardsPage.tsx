"use client";

import Link from "next/link";
import { useState } from "react";
import { dueNow } from "@/lib/studyapp/model";
import { useNow } from "@/lib/studyapp/clock";
import { useApp } from "@/lib/studyapp/store";
import { DeckEditor } from "./DeckEditor";
import { DecksPanel } from "./DecksPanel";
import { ReviewPanel } from "./ReviewPanel";

/**
 * Flashcards: Review (the card, big) and Decks (everything you have, and how to change it). Spaced repetition
 * is real: each grade schedules the card (src/lib/studyapp/srs.ts) and every button says when it will return.
 * Saved on this device.
 */
type Tab = "review" | "decks";

export function FlashcardsPage() {
  const { ready, data } = useApp();
  const now = useNow(1000);
  const [tab, setTab] = useState<Tab>("review");
  const [scope, setScope] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const due = ready && now ? dueNow(data, now).ids.length : 0;

  const reviewDeck = (id?: string) => { setScope(id); setOpen(null); setTab("review"); };

  return (
    <main className="wrap fcp">
      <div className="ph">
        <div>
          <div className="crumb"><Link href="/study">Desk</Link> <span>&rsaquo;</span> Flashcards</div>
          <h1>Flashcards<em>{!ready || !now ? " " : due === 0 ? "Nothing due right now" : `${due} due today`}</em></h1>
        </div>
        <div className="seg" role="tablist" aria-label="Flashcards">
          <button type="button" role="tab" aria-selected={tab === "review"} className={tab === "review" ? "on" : undefined} onClick={() => { setTab("review"); setOpen(null); }} data-testid="tab-review">Review{due > 0 && <small>{due}</small>}</button>
          <button type="button" role="tab" aria-selected={tab === "decks"} className={tab === "decks" ? "on" : undefined} onClick={() => { setTab("decks"); setScope(undefined); }} data-testid="tab-decks">Decks{ready && data.decks.length > 0 && <small>{data.decks.length}</small>}</button>
        </div>
      </div>
      {tab === "review" ? (
        <ReviewPanel deckId={scope} onAll={() => setScope(undefined)} onDecks={() => setTab("decks")} />
      ) : open ? (
        <DeckEditor deckId={open} onBack={() => setOpen(null)} onReview={reviewDeck} />
      ) : (
        <DecksPanel onOpen={setOpen} onReview={reviewDeck} onReviewAll={() => reviewDeck()} />
      )}
    </main>
  );
}
