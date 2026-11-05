"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { isAnswered, isMarked, type QAnswer, type QPart, type QPrefs, type QSet } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { AnswerZone } from "./AnswerZone";
import { foldAnswer, openAnswer, useOpenAnswer, type OpenMode } from "./answerOpen";
import { TypeIcon } from "./icons";
import { useMatch } from "./useMatch";

const Icon = ({ d }: { d: string[] }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{d.map((p) => <path key={p} d={p} />)}</svg>
);
/** A pen nib (drawing); typing has the T of the Type toggle. */
const NIB = ["M12 3l5.5 9.5L12 21l-5.5-8.5z", "M12 3v10", "M12 12.500v2"];

/**
 * What a card offers under its picture instead of an empty space to write on: two small dashed buttons, "Type your answer" and "Draw your answer". A tap opens the answer space in place
 * (the typing box with its symbols and Fraction key, or the pen's space), brings it into view and, for typing, puts the caret there. The buttons then ARE the head of the space (in the
 * place where the Draw | Type toggle goes once there is something in it), so nothing under a pen or a caret moves when the first stroke or key arrives, and nothing moves if the student
 * empties it again: a space the student has emptied stays open. Once there is an answer, a mark, or an answer from another paper to carry over, the space is just the card's, as it always was.
 *
 * A space that was opened and never held anything folds back to the buttons when the same button is pressed again, or on a click away from the card (once the card is off the screen if it is
 * on it, so no click ever moves what the student is looking at); Reset, then Clear, folds it too. Nothing is written to the answers until the first real write (the mode a space is in is
 * kept then). Kept for the tab, so a reload brings back the spaces that were open.
 */
export function FeedAnswer({ set, part, answer, shown, prefs, copy }: { set: QSet; part: QPart; answer: QAnswer | undefined; shown: QAnswer | undefined; prefs: QPrefs; copy: boolean }) {
  const key = `${set.id}/${part.id}`;
  const open = useOpenAnswer(key);
  const phone = useMatch("(max-width: 640px)");
  const root = useRef<HTMLDivElement>(null);
  const has = isAnswered(answer) || isMarked(answer);
  const zone = has || copy || !!open;
  const bare = !!open && !has && !copy;
  // The way the space is, while it is open: as the student opened it or switched it (an answer left behind by an earlier Reset may still say another way); the answer keeps it from the first real write.
  const eff: OpenMode | null = open;
  const zoneAnswer = useMemo<QAnswer | undefined>(() => (eff ? { ...shown, at: shown?.at ?? 0, mode: eff } : shown), [shown, eff]);
  const modeNow: OpenMode = (zoneAnswer?.mode ?? (phone ? "type" : "ink")) as OpenMode;

  // Whether this opening has held something (an emptied space stays open: only a space that never did folds by itself).
  const held = useRef(false);
  const latest = useRef({ has, open });
  useEffect(() => { latest.current = { has, open }; if (has) held.current = true; if (!open) held.current = false; });

  // The first real write keeps the way the space is, in the answer (a tap on a button wrote nothing).
  useEffect(() => { if (has && open && answer?.mode !== open) qa.mode(set.id, part.id, open); }, [has, open, answer?.mode, set.id, part.id]);
  const onMode = useCallback((m: OpenMode) => openAnswer(key, m), [key]);

  // A click somewhere else folds a space that never held anything: not on this card (its topic, the whole paper, the examiner's report are the question's own), not the pen, a dialog,
  // a toast. If the card is on the screen it waits until the card has left it, so folding never moves what the student is looking at. A click, not a press: a finger that starts to
  // scroll the page must not fold it.
  useEffect(() => {
    if (!bare) return;
    let io: IntersectionObserver | null = null;
    const card = root.current?.closest(".qf-card") ?? root.current;
    const away = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || !card || card.contains(t) || held.current) return;
      if (t.closest(".qs-pen, .qf-pen, dialog, [role=dialog], .toast, .qf-top")) return;
      const r = card.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) { foldAnswer(key); return; }
      io?.disconnect();
      io = new IntersectionObserver(([x]) => {
        if (x.isIntersecting) return;
        io?.disconnect(); io = null;
        if (!latest.current.has && latest.current.open && !held.current) foldAnswer(key);
      });
      io.observe(card);
    };
    document.addEventListener("click", away, true);
    return () => { document.removeEventListener("click", away, true); io?.disconnect(); };
  }, [bare, key]);

  // Opened by a tap: the space is brought into view (clear of the sticky bar above and the pen below), and for typing the caret goes into the box once it is drawn.
  const arrived = useRef(false);
  useEffect(() => {
    if (!open || !arrived.current) return;
    let tries = 0;
    const go = (): boolean => {
      const box = root.current?.querySelector<HTMLElement>(".qs-zone");
      const field = open === "type" ? root.current?.querySelector<HTMLElement>("textarea") : box;
      if (!box || !field) return false;
      arrived.current = false;
      if (open === "type") field.focus({ preventScroll: true });
      const top = (document.querySelector(".qf-head")?.getBoundingClientRect().bottom ?? 66) + 8;
      const tray = document.querySelector<HTMLElement>(".qs-pen:not(.is-away)");
      const bottom = (tray ? tray.getBoundingClientRect().top : window.innerHeight) - 12;
      const r = box.getBoundingClientRect();
      const dy = r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : r.top < top ? r.top - top : 0;
      if (Math.abs(dy) > 1) window.scrollBy({ top: dy, behavior: "instant" });   // (at once, never gliding: a pen that goes down the moment the space is there must not have the page move under it)
      return true;
    };
    if (go()) return;
    const t = setInterval(() => { if (go() || ++tries > 20) { arrived.current = false; clearInterval(t); } }, 30);
    return () => clearInterval(t);
  }, [open]);

  // Reset then Clear folds the space on purpose; focus goes back to the button the student had pressed, not to the page.
  const refocus = useRef<OpenMode | null>(null);
  const onReset = useCallback(() => { refocus.current = modeNow; foldAnswer(key); }, [modeNow, key]);
  useEffect(() => {
    if (open || !refocus.current) return;
    const m = refocus.current; refocus.current = null;
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-testid=answer-${m === "type" ? "type" : "draw"}]`)?.focus({ preventScroll: true }));
  }, [open]);

  const press = (m: OpenMode) => {
    if (open === m && !has) { foldAnswer(key); return; }
    arrived.current = true;
    openAnswer(key, m);
  };
  const buttons = (
    <div className="qf-ans-btns" role="group" aria-label="Answer this question">
      <button type="button" className="qf-ans-btn" aria-pressed={bare && modeNow === "type"} aria-label="Type your answer" onClick={() => press("type")} data-testid="answer-type">
        <TypeIcon /><span className="qf-ans-long" aria-hidden="true">Type your answer</span><span className="qf-ans-short" aria-hidden="true">Type</span>
      </button>
      <button type="button" className="qf-ans-btn" aria-pressed={bare && modeNow === "ink"} aria-label="Draw your answer with your pen. To use the keyboard, choose Type your answer" onClick={() => press("ink")} data-testid="answer-draw">
        <Icon d={NIB} /><span className="qf-ans-long" aria-hidden="true">Draw your answer</span><span className="qf-ans-short" aria-hidden="true">Draw</span>
      </button>
    </div>
  );

  return (
    <div className={`qf-ans${zone ? " is-open" : ""}`} ref={root} data-testid="answer-opener">
      {!zone && buttons}
      {zone && <AnswerZone set={set} part={part} answer={zoneAnswer} prefs={prefs} showMark bare={bare} headSlot={buttons} onReset={onReset} onMode={onMode} />}
    </div>
  );
}
