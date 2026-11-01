"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNow } from "@/lib/studyapp/clock";
import { dueNow, type Card } from "@/lib/studyapp/model";
import { GRADES, previewLabel, type Grade } from "@/lib/studyapp/srs";
import { actions, useApp } from "@/lib/studyapp/store";

/**
 * Reviewing, as one hook and one card, used by the Desk's small deck and the Flashcards page's big one.
 *
 * The card shown is derived from the store (what is due now), so it is never out of date; but once a student
 * has flipped it, it is PINNED: a learning card elsewhere coming due must not swap the card under their hands.
 * Grading unpins, and the next due card appears. When nothing is due, `waitUntil` says when the next one is.
 */
export interface Review {
  ready: boolean;
  card: Card | null;
  deckTitle: string;
  shown: boolean;
  /** Cards reviewed this visit, and cards still due (including the one on show). */
  done: number;
  remaining: number;
  /** When the next learning card comes due, if nothing is due now. */
  waitUntil: number | null;
  totalCards: number;
  show: () => void;
  grade: (g: Grade) => void;
  /** The "10m" / "3d" under each grade button, for the card on show. */
  previews: string[];
}

export function useReview(deckId?: string): Review {
  const { ready, data } = useApp();
  const now = useNow(1000);
  const [pinned, setPinned] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  const q = useMemo(() => (ready && now ? dueNow(data, now, deckId) : { ids: [] as string[], nextAt: null as number | null }), [ready, data, now, deckId]);
  const cardId = pinned && q.ids.includes(pinned) ? pinned : q.ids[0] ?? null;
  const card = cardId ? data.cards.find((c) => c.id === cardId) ?? null : null;
  const shown = !!card && shownId === card.id;

  const show = useCallback(() => { if (card) { setPinned(card.id); setShownId(card.id); } }, [card]);
  const grade = useCallback((g: Grade) => {
    if (!card || shownId !== card.id) return;
    actions.grade(card.id, g);
    setPinned(null);
    setShownId(null);
    setDone((n) => n + 1);
  }, [card, shownId]);

  const previews = useMemo(() => (card && now ? GRADES.map((g) => previewLabel(card.sch, g.grade, now)) : ["", "", "", ""]), [card, now]);
  return {
    ready, card, deckTitle: card ? data.decks.find((d) => d.id === card.deckId)?.title ?? "" : "", shown, done, remaining: q.ids.length,
    waitUntil: q.nextAt, totalCards: data.cards.filter((c) => !deckId || c.deckId === deckId).length, show, grade, previews,
  };
}

/** "Next card in 7 minutes", "tomorrow", for when nothing is due. */
export function waitLine(waitUntil: number | null, now: number): string {
  if (!waitUntil || !now) return "";
  const mins = Math.max(1, Math.round((waitUntil - now) / 60_000));
  if (mins < 60) return `Next card in ${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `Next card in ${hours} hour${hours === 1 ? "" : "s"}` : "Next card tomorrow";
}

/** Space turns the card over and 1 to 4 grade it, anywhere on the page except while typing. */
export function useReviewKeys(review: Review, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " && review.card && !review.shown) { e.preventDefault(); review.show(); }
      else if (/^[1-4]$/.test(e.key) && review.shown) { e.preventDefault(); review.grade(Number(e.key) as Grade); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [review, enabled]);
}

/** The card itself: a front to tap, a back with the four grades and when each would bring it back. */
export function FlipCard({ review, big = false, position }: { review: Review; big?: boolean; position: string }) {
  const { card, shown, deckTitle } = review;
  if (!card) return null;
  const long = (s: string) => s.length > (big ? 160 : 90);
  return (
    <div className={`fc${shown ? " shown" : ""}${big ? " big" : ""}`} data-testid="flipcard">
      <div className="fc-in">
        <button type="button" className="fc-face" onClick={review.show} aria-label="Show the answer" tabIndex={shown ? -1 : 0} data-testid="card-front">
          <span className="fc-top"><span>{deckTitle}</span><span>{position}</span></span>
          <span className="fc-q" data-long={long(card.front) || undefined}>{card.front}</span>
          <span className="fc-hint">Click or press Space</span>
        </button>
        <div className="fc-face fc-back" inert={!shown} data-testid="card-back">
          <span className="fc-top"><span>{deckTitle}</span><span>{position}</span></span>
          <span className="fc-a" data-long={long(card.back) || undefined}>{card.back}</span>
          <span className="grades">
            {GRADES.map((g, i) => (
              <button key={g.grade} type="button" className={`g${g.grade}`} onClick={() => review.grade(g.grade)} aria-label={`${g.label}, back in ${review.previews[i]}`} data-testid={`grade-${g.label.toLowerCase()}`}>
                {g.label}<small>{review.previews[i]}</small>
              </button>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
