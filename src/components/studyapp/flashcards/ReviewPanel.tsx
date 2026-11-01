"use client";

import Image from "next/image";
import { useNow } from "@/lib/studyapp/clock";
import { reviewStreak } from "@/lib/studyapp/model";
import { useApp } from "@/lib/studyapp/store";
import { dayOf } from "@/lib/studyapp/time";
import { FlipCard, useReview, useReviewKeys, waitLine } from "./review";
import { StarterPicker } from "./StarterPicker";

/** Review: the big card, how far through you are, and a proper ending. One deck, or everything that is due. */
export function ReviewPanel({ deckId, onAll, onDecks }: { deckId?: string; onAll: () => void; onDecks: () => void }) {
  const { ready, data } = useApp();
  const now = useNow(1000);
  const review = useReview(deckId);
  useReviewKeys(review);
  const { card, done, remaining } = review;
  const deck = deckId ? data.decks.find((d) => d.id === deckId) : null;
  const today = now ? dayOf(now) : "";
  const log = today ? data.log[today] : undefined;

  if (!ready) return <div className="fcp-card" aria-hidden="true" style={{ minHeight: 360 }} />;

  if (data.cards.length === 0) {
    return (
      <div className="fcp-card fcp-empty" data-testid="review-empty">
        <Image className="quill" src="/study/mascot/plumi-curious.svg" alt="" width={72} height={72} unoptimized />
        <h2>Start with a deck</h2>
        <p>Pick a ready-made deck, or make your own from the Decks tab.</p>
        <StarterPicker />
      </div>
    );
  }

  return (
    <div className="fcp-review">
      {deck && (
        <div className="fcp-scope">
          <span className="chip">Reviewing: {deck.title}</span>
          <button type="button" className="btn ghost" onClick={onAll}>Review everything due</button>
        </div>
      )}
      {card ? (
        <>
          <div className="fcp-prog" role="progressbar" aria-label="Cards reviewed this visit" aria-valuemin={0} aria-valuemax={done + remaining} aria-valuenow={done}>
            <i style={{ width: `${(done / (done + remaining)) * 100}%` }} />
          </div>
          <FlipCard review={review} big position={`${done + 1} of ${done + remaining}`} />
          <p className="fcp-keys"><kbd>Space</kbd> turn over <span>&middot;</span> <kbd>1</kbd> Again <kbd>2</kbd> Hard <kbd>3</kbd> Good <kbd>4</kbd> Easy</p>
        </>
      ) : (
        <div className="fcp-card fcp-empty" data-testid="review-done">
          <Image className="quill" src="/study/mascot/plumi-celebrating.svg" alt="" width={84} height={84} unoptimized />
          <h2>{done > 0 ? "Nice work." : "All caught up."}</h2>
          <p>
            {done > 0 ? `${done} card${done === 1 ? "" : "s"} reviewed this visit. ` : ""}
            {log && log.n > 0 ? `Today: ${log.n} reviewed, ${log.right} remembered. ` : ""}
            {waitLine(review.waitUntil, now) || "The next cards come back tomorrow."}
          </p>
          {(() => { const s = today ? reviewStreak(data, today) : 0; return s > 1 ? <p className="fcp-streak">{s} days of reviewing in a row</p> : null; })()}
          <div className="fcp-acts">
            <button type="button" className="btn gold" onClick={onDecks}>See your decks</button>
          </div>
        </div>
      )}
    </div>
  );
}
