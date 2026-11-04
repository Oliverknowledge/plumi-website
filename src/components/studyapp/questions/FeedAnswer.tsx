"use client";

import { useEffect, useRef } from "react";
import { isAnswered, isMarked, type QAnswer, type QPart, type QPrefs, type QSet } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { AnswerZone } from "./AnswerZone";
import { foldAnswer, openAnswer, useOpenAnswer, type OpenMode } from "./answerOpen";
import { useMatch } from "./useMatch";

const Icon = ({ d }: { d: string[] }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{d.map((p) => <path key={p} d={p} />)}</svg>
);
/** A pencil (typing) and a pen nib (drawing). */
const PENCIL = ["M4 20l1-4L16 5l3 3L8 19z", "M14 7l3 3"];
const NIB = ["M12 3l5.5 9.5L12 21l-5.5-8.5z", "M12 3v10", "M12 12.500v2"];

/**
 * What a card offers under its picture instead of an empty space to write on: two small dashed buttons, "Type your answer" and "Draw your answer". A tap opens the answer space in place
 * (the typing box with its symbols and Fraction key, or the pen's space) and puts the caret there. Once there is an answer, or a mark, or an answer from another paper to carry over, the space
 * is just the card's, as it always was. A space that was opened and is still empty folds back to the buttons when the same button is pressed again, or when the student taps somewhere else
 * (not on the picture, the mark scheme or the pen: those are part of answering). It is kept for the tab, so a reload brings back the spaces that were open.
 */
export function FeedAnswer({ set, part, answer, shown, prefs, copy }: { set: QSet; part: QPart; answer: QAnswer | undefined; shown: QAnswer | undefined; prefs: QPrefs; copy: boolean }) {
  const key = `${set.id}/${part.id}`;
  const open = useOpenAnswer(key);
  const phone = useMatch("(max-width: 640px)");
  const root = useRef<HTMLDivElement>(null);
  const has = isAnswered(answer) || isMarked(answer);
  const bare = !!open && !has && !copy;
  const zone = has || copy || !!open;
  const modeNow: OpenMode = (shown?.mode ?? (phone ? "type" : "ink")) as OpenMode;

  // The writing is gone (Reset): back to the buttons.
  const had = useRef(has);
  useEffect(() => { if (had.current && !has) foldAnswer(key); had.current = has; }, [has, key]);

  // A tap somewhere else folds an empty space. A click, not a press: a finger that starts scrolling the page must not fold it under itself.
  useEffect(() => {
    if (!bare) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || !root.current || root.current.contains(t)) return;
      if (t.closest(".qf-sheet") === root.current.closest(".qf-sheet") || t.closest(".qs-pen, .qf-pen, dialog, [role=dialog], .toast")) return;
      foldAnswer(key);
    };
    document.addEventListener("click", away, true);
    return () => document.removeEventListener("click", away, true);
  }, [bare, key]);

  // Opened by a tap: the caret goes into the typing box (or the pen's space has the keyboard) once it is drawn.
  const focusNext = useRef(false);
  useEffect(() => {
    if (!open || !focusNext.current) return;
    let tries = 0;
    const t = setInterval(() => {
      const el = root.current?.querySelector<HTMLElement>(open === "type" ? "textarea" : "canvas");
      if (el) { el.focus({ preventScroll: true }); focusNext.current = false; clearInterval(t); } else if (++tries > 20) { focusNext.current = false; clearInterval(t); }
    }, 30);
    return () => clearInterval(t);
  }, [open]);

  const press = (m: OpenMode) => {
    if (open === m && modeNow === m && !has) { foldAnswer(key); return; }
    focusNext.current = true;
    if (modeNow !== m || answer?.mode === undefined) qa.mode(set.id, part.id, m);
    openAnswer(key, m);
  };

  return (
    <div className={`qf-ans${zone ? " is-open" : ""}`} ref={root} data-testid="answer-opener">
      {!has && !copy && (
        <div className="qf-ans-btns" role="group" aria-label="Answer this question">
          <button type="button" className="qf-ans-btn" aria-pressed={bare && modeNow === "type"} aria-label="Type your answer" onClick={() => press("type")} data-testid="answer-type">
            <Icon d={PENCIL} /><span className="qf-ans-long" aria-hidden="true">Type your answer</span><span className="qf-ans-short" aria-hidden="true">Type</span>
          </button>
          <button type="button" className="qf-ans-btn" aria-pressed={bare && modeNow === "ink"} aria-label="Draw your answer" onClick={() => press("ink")} data-testid="answer-draw">
            <Icon d={NIB} /><span className="qf-ans-long" aria-hidden="true">Draw your answer</span><span className="qf-ans-short" aria-hidden="true">Draw</span>
          </button>
        </div>
      )}
      {zone && <AnswerZone set={set} part={part} answer={shown} prefs={prefs} showMark bare={bare} />}
    </div>
  );
}
