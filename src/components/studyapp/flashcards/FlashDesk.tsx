"use client";

import { useEffect, useRef } from "react";
import { useNow } from "@/lib/studyapp/clock";
import { reviewStreak } from "@/lib/studyapp/model";
import { GRADES } from "@/lib/studyapp/srs";
import { canShare } from "@/lib/studyapp/sharing";
import { useSharing } from "@/lib/studyapp/sharing/client";
import { useApp } from "@/lib/studyapp/store";
import { dayOf } from "@/lib/studyapp/time";
import { plainText } from "@/lib/studyapp/boldText";
import type { Pic } from "@/lib/studyapp/cardPics";
import { BoldText } from "./BoldText";
import { CardPics } from "./CardPics";
import { isMarkSchemeBack, MarkSchemeBody, MarkSchemeMarks, parseFront } from "./MarkSchemeFace";
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
  label, deckIds, expanded, hidden, keysOn, onToggleExpand, onAddCard, onShare, onStarters, onBackToToday,
}: {
  label: string; deckIds: string[] | undefined; expanded: boolean; hidden: boolean; keysOn: boolean;
  onToggleExpand: () => void; onAddCard: (currentDeckId: string | null) => void; onShare?: (deckId: string) => void; onStarters: () => void; onBackToToday?: () => void;
}) {
  const { ready, data } = useApp();
  const now = useNow(1000);
  const review = useReview(deckIds);
  const sharing = useSharing();
  // Share is offered when exactly one deck is on the desk (a mix of decks has no single deck to share).
  const oneDeck = deckIds?.length === 1 ? data.decks.find((d) => d.id === deckIds[0]) : undefined;
  const shareDeck = onShare && sharing.available && oneDeck && canShare(oneDeck) ? oneDeck : null;
  useReviewKeys(review, keysOn && !hidden);
  const { card, shown, touched, done, remaining, counts, previews } = review;
  const cardRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // The button that was pressed is gone once the card turns or the next one arrives; keep the keyboard on the card.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const a = document.activeElement;
    if (!a || a === document.body) cardRef.current?.focus({ preventScroll: true });
  }, [card?.id, shown]);

  // A tap turns the card over, or back; a drag that selects words (to copy them) does not.
  const onCardClick = () => { if (window.getSelection()?.toString()) return; review.flip(); };

  const today = now ? dayOf(now) : "";
  const log = today ? data.log[today] : undefined;
  const streak = today ? reviewStreak(data, today) : 0;
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
        <div className="dsk-right">
        {shareDeck && (
          <button type="button" className="dsk-btn dsk-share" onClick={() => onShare?.(shareDeck.id)} aria-label={sharing.codeFor(shareDeck.id) ? `Share ${shareDeck.title}: manage its link` : `Share ${shareDeck.title}`} data-testid="desk-share">
            <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M8 10V1.5M4.5 5L8 1.5 11.5 5M2.5 8.5v6h11v-6" /></svg>
            <span>Share</span>
          </button>
        )}
        <button type="button" className="dsk-btn icon" onClick={onToggleExpand} aria-pressed={expanded} aria-label={expanded ? "Leave full screen" : "Fill the screen"} data-testid="expand">
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            {expanded
              ? <path d="M6 1v5H1M10 15v-5h5M15 6h-5V1M1 10h5v5" />
              : <path d="M10 1h5v5M6 15H1v-5M15 1l-5 5M1 15l5-5" />}
          </svg>
        </button>
        </div>
      </div>

      <div className="dsk-stage">
        {card ? (
          // One card, two faces in the same box, turned about its middle. The flip is keyed to the card: the next card is a new element,
          // already on its question, so its answer is never seen turning away.
          <div ref={cardRef} className="dsk-card" tabIndex={-1} data-shown={shown || undefined} data-testid="flipcard" onClick={onCardClick} aria-label={`Card ${position}`} role="group">
            <div key={card.id} className="dsk-flip" data-flipped={shown || undefined}>
              <Face side="front" text={card.front} pics={card.pic?.f} deck={review.deckTitle} position={position} hidden={shown} />
              <Face side="back" text={card.back} pics={card.pic?.b} deck={review.deckTitle} position={position} hidden={!shown} />
            </div>
            <p className="sr" role="status" aria-live="polite">{touched ? (shown ? `Answer. ${plainText(card.back)}` : `Question. ${plainText(card.front)}`) : ""}</p>
          </div>
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
        <p className="dsk-keys"><kbd>Space</kbd> or <kbd>Enter</kbd> turn over or back <span aria-hidden="true">&middot;</span> <kbd>1</kbd> Again <kbd>2</kbd> Hard <kbd>3</kbd> Good <kbd>4</kbd> Easy</p>
      </div>
    </section>
  );
}

/** One side of the card. The side that is not showing is hidden from screen readers and the keyboard, as well as from the eye. */
function Face({ side, text, pics, deck, position, hidden }: { side: "front" | "back"; text: string; pics?: readonly Pic[]; deck: string; position: string; hidden: boolean }) {
  // A mark scheme card is an ordinary card with plain text leads, set out from them (lib/studyapp/markscheme.ts): the question with its marks, and the answer as points and bands.
  const front = side === "front" ? parseFront(text) : null;
  const ms = side === "back" && isMarkSchemeBack(text);
  const shownText = front ? front.question : text;
  return (
    <div className={`dsk-face ${side}`} aria-hidden={hidden || undefined} inert={hidden}>
      <header className="dsk-card-h"><span>{deck}</span><span>{position}</span></header>
      <div className="dsk-body" tabIndex={hidden ? -1 : 0} role="region" aria-label={side === "back" ? "The answer" : "The question"} data-testid={side === "back" ? "card-back" : "card-front"}>
        <span className="dsk-side">{side === "back" ? "Answer" : "Question"}</span>
        {pics?.length ? (
          // A picture side (a mistake made into a card): the pictures, with the card's own words (the label, or their marks and answer) above or below.
          <div className={`dsk-center dsk-pics ${side}`} data-testid="pic-side">
            {side === "front" && <p className="dsk-cap">{text}</p>}
            <CardPics pics={pics} />
            {side === "back" && <p className="dsk-note"><BoldText text={text} /></p>}
          </div>
        ) : ms ? <div className="dsk-center ms-wrap"><MarkSchemeBody back={text} /></div> : (
          <div className="dsk-center">
            <p className="dsk-text" data-size={sizeFor(plainText(shownText))} data-testid="card-text"><BoldText text={shownText} /></p>
            {front?.marks && <MarkSchemeMarks marks={front.marks} />}
          </div>
        )}
      </div>
      <p className="dsk-hint" aria-hidden="true">{side === "back" ? "Tap to turn back" : "Tap to turn over"}</p>
    </div>
  );
}
