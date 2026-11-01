"use client";

import { useEffect, useRef } from "react";
import { useNow } from "@/lib/studyapp/clock";
import { reviewStreak } from "@/lib/studyapp/model";
import { GRADES } from "@/lib/studyapp/srs";
import { useApp } from "@/lib/studyapp/store";
import { dayOf } from "@/lib/studyapp/time";
import { useReview, useReviewKeys, waitLine } from "./review";

/** How big the words on a card are, from how much there is: a short question is big, a paragraph still fits. */
function sizeFor(text: string): "xl" | "l" | "m" | "s" | "xs" {
  const lines = text.split("\n").length;
  const n = text.length + (lines - 1) * 28;
  return n <= 40 ? "xl" : n <= 110 ? "l" : n <= 240 ? "m" : n <= 460 ? "s" : "xs";
}

const COUNTER_COLOURS = ["c1", "c2", "c3", "c4"] as const;

/**
 * The wooden desk: "+ Card", what is being reviewed and how much is due, a button to fill the screen, the card
 * on the desk, the four grades BELOW it (never over its words), and how this session has gone. Space turns the
 * card over; 1 to 4 grade it. Mounted afresh whenever what is being reviewed changes, so its counters start at zero.
 */
export function FlashDesk({
  label, deckIds, expanded, hidden, keysOn, onToggleExpand, onAddCard, onStarters, onBackToToday,
}: {
  label: string; deckIds: string[] | undefined; expanded: boolean; hidden: boolean; keysOn: boolean;
  onToggleExpand: () => void; onAddCard: (currentDeckId: string | null) => void; onStarters: () => void; onBackToToday?: () => void;
}) {
  const { ready, data } = useApp();
  const now = useNow(1000);
  const review = useReview(deckIds);
  useReviewKeys(review, keysOn && !hidden);
  const { card, shown, done, remaining, counts, previews } = review;
  const cardRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  // The button that was pressed is gone once the card turns or the next one arrives; keep the keyboard on the card.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const a = document.activeElement;
    if (!a || a === document.body) cardRef.current?.focus({ preventScroll: true });
  }, [card?.id, shown]);

  const today = now ? dayOf(now) : "";
  const log = today ? data.log[today] : undefined;
  const streak = today ? reviewStreak(data, today) : 0;
  const text = card ? (shown ? card.back : card.front) : "";
  const position = `${done + 1} of ${done + remaining}`;

  let empty: React.ReactNode = null;
  if (!card) {
    if (!ready || !now) empty = <div className="dsk-empty" aria-hidden="true" />;
    else if (data.cards.length === 0) {
      empty = (
        <div className="dsk-empty" data-testid="review-empty">
          <h2>No cards yet</h2>
          <p>Add a ready-made deck, or bring your own.</p>
          <button type="button" className="btn gold" onClick={onStarters} data-testid="empty-starters">Ready-made decks</button>
        </div>
      );
    } else if (review.totalCards === 0) {
      empty = (
        <div className="dsk-empty" data-testid="review-empty-deck">
          <h2>Nothing in here yet</h2>
          <p>Add the first card.</p>
          <button type="button" className="btn gold" onClick={() => onAddCard(null)}>+ Card</button>
        </div>
      );
    } else {
      const wait = waitLine(review.waitUntil, now);
      empty = (
        <div className="dsk-empty" data-testid="review-done">
          <h2>All caught up</h2>
          <p>{done > 0 ? `${done} card${done === 1 ? "" : "s"} done this session.` : "Nothing is due here today."}</p>
          {(wait || (done > 0 && log && log.n > 0)) && <p className="dsk-sub">{wait || `${log?.right ?? 0} of ${log?.n ?? 0} remembered today`}</p>}
          {streak > 1 && <p className="dsk-sub">{streak} days of reviewing in a row</p>}
          {onBackToToday && <button type="button" className="btn gold" onClick={onBackToToday} data-testid="back-to-today">Back to today&rsquo;s cards</button>}
        </div>
      );
    }
  }

  return (
    <section id="fc-desk" className={`fcl-desk${expanded ? " expanded" : ""}`} aria-label="Flashcard desk" hidden={hidden} tabIndex={-1} data-testid="desk">
      <div className="dsk-top">
        <button type="button" className="dsk-btn" onClick={() => onAddCard(card?.deckId ?? null)} data-testid="add-card-open"><span aria-hidden="true">+</span> Card</button>
        <div className="dsk-pill" role="status" data-testid="desk-pill">
          <b>{label}</b>
          <span>{remaining > 0 ? `${remaining} due` : "Done"}</span>
        </div>
        <button type="button" className="dsk-btn icon" onClick={onToggleExpand} aria-pressed={expanded} aria-label={expanded ? "Leave full screen" : "Fill the screen"} data-testid="expand">
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            {expanded
              ? <path d="M6 1v5H1M10 15v-5h5M15 6h-5V1M1 10h5v5" />
              : <path d="M10 1h5v5M6 15H1v-5M15 1l-5 5M1 15l5-5" />}
          </svg>
        </button>
      </div>

      <div className="dsk-stage">
        {card ? (
          <article ref={cardRef} className="dsk-card" tabIndex={-1} data-shown={shown || undefined} data-testid="flipcard" onClick={() => { if (!shown) review.show(); }} aria-label={`Card ${position}`} role="group">
            <header className="dsk-card-h"><span>{review.deckTitle}</span><span>{position}</span></header>
            <div className="dsk-body" tabIndex={0} role="region" aria-label={shown ? "The answer" : "The question"} aria-live="polite" data-testid={shown ? "card-back" : "card-front"}>
              <span className="dsk-side">{shown ? "Answer" : "Question"}</span>
              <p className="dsk-text" data-size={sizeFor(text)} data-testid="card-text">{text}</p>
            </div>
          </article>
        ) : empty}
      </div>

      <div className="dsk-actions">
        {card && (shown ? (
          <div className="dsk-grades" role="group" aria-label="How well did you know it?">
            {GRADES.map((g, i) => (
              <button key={g.grade} type="button" className={`dk-g${g.grade}`} onClick={() => review.grade(g.grade)} aria-label={`${g.label}, back in ${previews[i]}`} data-testid={`grade-${g.label.toLowerCase()}`}>
                <span>{g.label}</span><small>{previews[i]}</small>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="btn gold dsk-turn" onClick={review.show} data-testid="turn-over">Turn over</button>
        ))}
      </div>

      <div className="dsk-foot">
        <div className="dsk-counts" role="group" aria-label="Given this session" data-testid="counters">
          {GRADES.map((g, i) => (
            <span key={g.grade} className={`ct ${COUNTER_COLOURS[i]}`} title={g.label} data-testid={`count-${g.label.toLowerCase()}`}>
              <i aria-hidden="true" /><span className="sr">{g.label} </span><b>{counts[i]}</b>
            </span>
          ))}
        </div>
        <p className="dsk-keys"><kbd>Space</kbd> turn over <span aria-hidden="true">&middot;</span> <kbd>1</kbd> Again <kbd>2</kbd> Hard <kbd>3</kbd> Good <kbd>4</kbd> Easy</p>
      </div>
    </section>
  );
}
