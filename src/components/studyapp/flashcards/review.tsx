"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { plainText } from "@/lib/studyapp/boldText";
import { useNow } from "@/lib/studyapp/clock";
import { BoldText } from "./BoldText";
import { CardPics } from "./CardPics";
import { isMarkSchemeBack, MarkSchemeBody, MarkSchemeMarks, parseFront } from "./MarkSchemeFace";
import { afterGrade, canGrade, FRESH, isShown, keyAction, toggle, show as showAnswer, turnBack, type FlipState } from "@/lib/studyapp/flip";
import { dueNow, type Card, type Scope } from "@/lib/studyapp/model";
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
  /** The student has turned this card over at least once (it stays so after turning back): what a screen reader is told about the side. */
  touched: boolean;
  /** Cards reviewed this visit, and cards still due (including the one on show). */
  done: number;
  /** How many times each grade (Again, Hard, Good, Easy) was given this visit. */
  counts: readonly [number, number, number, number];
  remaining: number;
  /** When the next learning card comes due, if nothing is due now. */
  waitUntil: number | null;
  totalCards: number;
  /** Show the answer (no-op if it is already showing). */
  show: () => void;
  /** Back to the question. */
  hide: () => void;
  /** Over, or back: tap, Space, Enter. */
  flip: () => void;
  grade: (g: Grade) => void;
  /** The "10m" / "3d" under each grade button, for the card on show. */
  previews: string[];
}

/** `scope`: undefined for everything due, a deck id, or several deck ids (a mix or a session). */
export function useReview(scope?: Scope): Review {
  const { ready, data } = useApp();
  const now = useNow(1000);
  const [fs, setFs] = useState<FlipState>(FRESH);
  const { pinned } = fs;
  const [counts, setCounts] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const done = counts[0] + counts[1] + counts[2] + counts[3];
  // Deck ids never hold a comma, so a list can travel as one string and keep the memo below from re-running on every render.
  const scopeKey = scope === undefined ? "*" : typeof scope === "string" ? scope : scope.join(",");
  const deckScope = useMemo(() => (scopeKey === "*" ? undefined : scopeKey.split(",")), [scopeKey]);

  const q = useMemo(() => (ready && now ? dueNow(data, now, deckScope) : { ids: [] as string[], nextAt: null as number | null }), [ready, data, now, deckScope]);
  const cardId = pinned && q.ids.includes(pinned) ? pinned : q.ids[0] ?? null;
  const card = cardId ? data.cards.find((c) => c.id === cardId) ?? null : null;
  const shown = !!card && isShown(fs, card.id);

  const show = useCallback(() => { if (card) setFs((s) => showAnswer(s, card.id)); }, [card]);
  const hide = useCallback(() => { if (card) setFs((s) => turnBack(s, card.id)); }, [card]);
  const flip = useCallback(() => { if (card) setFs((s) => toggle(s, card.id)); }, [card]);
  const grade = useCallback((g: Grade) => {
    if (!card || !canGrade(fs, card.id)) return;
    actions.grade(card.id, g);
    setFs(afterGrade());
    setCounts((c) => { const next: [number, number, number, number] = [c[0], c[1], c[2], c[3]]; next[g - 1]++; return next; });
  }, [card, fs]);

  const previews = useMemo(() => (card && now ? GRADES.map((g) => previewLabel(card.sch, g.grade, now)) : ["", "", "", ""]), [card, now]);
  return {
    ready, card, touched: !!card && fs.pinned === card.id, deckTitle: card ? data.decks.find((d) => d.id === card.deckId)?.title ?? "" : "", shown, done, counts, remaining: q.ids.length,
    waitUntil: q.nextAt, totalCards: deckScope ? data.cards.filter((c) => deckScope.includes(c.deckId)).length : data.cards.length, show, hide, flip, grade, previews,
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

/** Space or Enter turns the card over, and back, and 1 to 4 grade it, anywhere on the page except while typing. */
export function useReviewKeys(review: Review, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A focused button or link keeps its own Space and Enter (it presses it); only elsewhere do they turn the card.
      const act = keyAction(e.key, { hasCard: !!review.card, shown: review.shown, repeat: e.repeat, onButton: /^(BUTTON|A|SUMMARY)$/.test(t?.tagName ?? "") });
      if (!act) return;
      e.preventDefault();
      if (act.kind === "flip") review.flip(); else review.grade(act.grade);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [review, enabled]);
}

/** The card itself: a front to tap, a back with the four grades and when each would bring it back. Tap the back (or press Space) to turn it over again. */
export function FlipCard({ review, big = false, position }: { review: Review; big?: boolean; position: string }) {
  const { card, shown, deckTitle } = review;
  if (!card) return null;
  const long = (s: string) => plainText(s).length > (big ? 160 : 90);
  // Keyed to the card: the next card is a new element, already on its question, so its answer is never seen turning away.
  return (
    <div key={card.id} className={`fc${shown ? " shown" : ""}${big ? " big" : ""}`} data-testid="flipcard">
      <div className="fc-in">
        <button type="button" className="fc-face" onClick={review.flip} aria-label="Show the answer" tabIndex={shown ? -1 : 0} data-testid="card-front">
          <span className="fc-top"><span>{deckTitle}</span><span>{position}</span></span>
          {card.pic?.f?.length ? <div className="fc-q fc-pics"><p className="fc-cap">{card.front}</p><CardPics pics={card.pic.f} /></div> : <>
            <span className="fc-q" data-long={long(parseFront(card.front).question) || undefined}><BoldText text={parseFront(card.front).question} /></span>
            {parseFront(card.front).marks && <MarkSchemeMarks marks={parseFront(card.front).marks!} />}</>}
          <span className="fc-hint">Click, or press Space or Enter</span>
        </button>
        <div className="fc-face fc-back" inert={!shown} aria-hidden={!shown || undefined} data-testid="card-back" onClick={(e) => { if (!(e.target as HTMLElement).closest("button") && !window.getSelection()?.toString()) review.hide(); }}>
          <span className="fc-top"><span>{deckTitle}</span><span>{position}</span></span>
          {card.pic?.b?.length
            ? <div className="fc-a fc-pics"><CardPics pics={card.pic.b} /><p className="fc-cap"><BoldText text={card.back} /></p></div>
            : isMarkSchemeBack(card.back)
            ? <div className="fc-a fc-ms"><MarkSchemeBody back={card.back} fit={false} /></div>
            : <span className="fc-a" data-long={long(card.back) || undefined}><BoldText text={card.back} /></span>}
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
