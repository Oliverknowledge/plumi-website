"use client";

import { AppLink } from "@/components/studyapp/AppLink";
import { useNow } from "@/lib/studyapp/clock";
import { actions, useApp } from "@/lib/studyapp/store";
import { FlipCard, useReview, useReviewKeys, waitLine } from "../flashcards/review";

/**
 * The Desk's flashcards: the next card due, turned over with a tap or Space, graded with the four buttons
 * (or 1 to 4), and each button says when the card will come back. Real scheduling (src/lib/studyapp/srs.ts).
 */
export function DeckCard() {
  const { ready, data } = useApp();
  const now = useNow(1000);
  const review = useReview();
  useReviewKeys(review);
  const { card, remaining, done } = review;
  const hasCards = data.cards.length > 0;

  return (
    <section className="card deck" aria-label="Flashcards" data-testid="desk-deck">
      <div className="deck-h">
        <b>Flashcards</b>
        {ready && hasCards && <span className="due-n" data-testid="due-count">{remaining} due</span>}
      </div>
      {!ready ? (
        <div className="deck-empty" aria-hidden="true" />
      ) : card ? (
        <FlipCard review={review} position={`${done + 1} of ${done + remaining}`} />
      ) : hasCards ? (
        <div className="deck-empty" data-testid="deck-caught-up">
          <b>All caught up.</b>
          <span>{done > 0 ? `${done} reviewed this visit. ` : ""}{waitLine(review.waitUntil, now) || "The next card comes back tomorrow."}</span>
          <AppLink className="btn" href="/study/flashcards">Open Flashcards</AppLink>
        </div>
      ) : (
        <div className="deck-empty" data-testid="deck-none">
          <b>No cards yet.</b>
          <span>Start with a ready-made deck, or make your own.</span>
          <button type="button" className="btn gold" onClick={() => actions.addStarters(["chem-carbonyls"])}>Add the Carbonyls deck</button>
          <AppLink className="btn ghost" href="/study/flashcards">Choose decks</AppLink>
        </div>
      )}
    </section>
  );
}
