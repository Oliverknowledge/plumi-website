"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { INK_PART_CAP, INK_TOTAL_CAP, REF_W } from "@/lib/studyapp/questions/ink";
import { hasInk, hasText, inkTotal, ZONE_MAX_H, zoneHeight, type QAnswer, type QPart, type QPrefs, type QSet } from "@/lib/studyapp/questions/model";
import { currentQuestions, qa } from "@/lib/studyapp/questions/store";
import { InkCanvas, type InkCanvasHandle } from "./InkCanvas";
import { setZoneVisible, useIsActiveInk, usePenSeen } from "./inkBus";
import { CloseIcon, ExpandIcon, PenSmallIcon, TypeIcon } from "./icons";
import { TypePad } from "./TypePad";
import { useMatch } from "./useMatch";

/** How close to the screen (css px) a zone gets its canvas; further away it is a plain placeholder and holds no pixels. */
const NEAR = 700;
/** The ink's lowest edge plus this is the least height a zone can be given, so shrinking it never hides writing. */
const INK_ROOM = 24;

/**
 * The space for a student's answer, directly under a part: write on it (ink) or type into it, switchable per part
 * and remembered. Sized to the marks (about 90 units a mark, at least 140), taller with "More space" or by dragging
 * the grip, never shorter than what is written in it. Both can hold something at once; the tabs show which does.
 *
 * Memoised on what it draws (set, part, answer, prefs): a stroke or a keystroke in another part does not draw this
 * one again. The device-wide ink room is read when a stroke ends, not passed down (so it is not a prop that changes on every stroke).
 */
export const AnswerZone = memo(AnswerZoneView, (a, b) => a.set === b.set && a.part === b.part && a.answer === b.answer && a.prefs === b.prefs && a.showMark === b.showMark && a.bare === b.bare && a.headSlot === b.headSlot && a.onReset === b.onReset && a.onMode === b.onMode);

function AnswerZoneView({ set, part, answer, prefs, showMark, bare = false, headSlot, onReset, onMode }: {
  set: QSet; part: QPart; answer: QAnswer | undefined; prefs: QPrefs; showMark: boolean; inkTotal?: number;
  /** The feed's card opened this space from its Type or Draw button and it holds nothing: the head is those two buttons (`headSlot`) in the place where the Draw | Type toggle and Reset go once there is something, so nothing moves when the first mark or key arrives. */
  bare?: boolean; headSlot?: React.ReactNode;
  /** Told when the student has cleared the answer on purpose (Reset, then Clear). */
  onReset?: () => void;
  /** Told when the student switches the way (Draw | Type) so the card's own record of it follows. */
  onMode?: (m: "ink" | "type") => void;
}) {
  const phone = useMatch("(max-width: 640px)");
  const coarse = useMatch("(pointer: coarse)");
  const penSeen = usePenSeen();
  const key = `${set.id}/${part.id}`;
  const active = useIsActiveInk(key);
  const base = zoneHeight(part, answer);
  const [drag, setDrag] = useState<number | null>(null);
  const [low, setLow] = useState(0);
  const floor = Math.max(zoneHeight({ m: null }), Math.ceil(low + INK_ROOM));
  const units = Math.max(floor, drag ?? base);
  const mode = answer?.mode ?? (phone ? "type" : "ink");
  const ink = useRef<InkCanvasHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [asking, setAsking] = useState(false);
  const [hint, setHint] = useState(false);
  const [full, setFull] = useState(false);
  const [almost, setAlmost] = useState(false);
  const fingerScrolls = prefs.fingerScrolls ?? coarse;
  const label = `Answer for part ${part.l}`;
  const written = hasInk(answer), typed = hasText(answer);
  const has = written || typed || answer?.got !== undefined;

  // "Clear this answer?": the safe answer (Keep) has focus, Escape is Keep, and focus goes back to where it was (Reset after Keep, the tab after Clear).
  const resetBtn = useRef<HTMLButtonElement>(null);
  const keepBtn = useRef<HTMLButtonElement>(null);
  const modeBtn = useRef<HTMLButtonElement>(null);
  const back = useRef<"reset" | "tab" | null>(null);
  useEffect(() => {
    if (asking) { keepBtn.current?.focus(); return; }
    const to = back.current;
    back.current = null;
    if (to) (to === "reset" ? resetBtn.current : modeBtn.current)?.focus();
  }, [asking]);

  // A canvas only while the zone is near the screen: measured before the first paint (so writing on screen is there at once), then watched.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setNear(r.bottom > -NEAR && r.top < window.innerHeight + NEAR);
    // (A batch can hold two reports for the zone, gone then back: the LAST one is the truth. Reading the first left a visible zone without its canvas.)
    const io = new IntersectionObserver((es) => { const e = es[es.length - 1]; if (e) setNear(e.isIntersecting); }, { rootMargin: `${NEAR}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // The pen tray is shown while any writing zone is on the screen.
  useEffect(() => {
    const el = box.current;
    if (!el || mode !== "ink") return;
    const io = new IntersectionObserver((es) => { const e = es[es.length - 1]; if (e) setZoneVisible(key, e.isIntersecting); });
    io.observe(el);
    return () => { io.disconnect(); setZoneVisible(key, false); };
  }, [key, mode]);

  /** What this answer may still hold: its own cap, or less if the device is nearly full. Read when a stroke ends. */
  const getCap = useCallback(() => {
    const q = currentQuestions();
    return Math.min(INK_PART_CAP, Math.max(0, INK_TOTAL_CAP - inkTotal(q) + (q.answers[key]?.ink?.b ?? 0)));
  }, [key]);
  const lowRef = useRef(low);
  useEffect(() => { lowRef.current = low; });

  const setMode = (m: "ink" | "type") => { onMode?.(m); if (answer?.mode !== m) qa.mode(set.id, part.id, m); };
  const more = () => qa.height(set.id, part.id, Math.min(ZONE_MAX_H, base + 120));
  const keep = () => { back.current = "reset"; setAsking(false); };
  const reset = () => {
    back.current = "tab";
    setAsking(false);
    ink.current?.clear();
    qa.reset(set.id, part.id);
    if (mode === "type") qa.dropInk(set.id, part.id);
    onReset?.();
  };

  const startGrip = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;   // a finger on the strip is scrolling the page; the zone is made taller with its button or the keys
    const w = box.current?.getBoundingClientRect().width ?? REF_W;
    const k = REF_W / w;
    const y0 = e.clientY, h0 = units;
    const least = () => Math.max(zoneHeight({ m: null }), Math.ceil(lowRef.current + INK_ROOM));
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    const move = (ev: PointerEvent) => setDrag(Math.min(ZONE_MAX_H, Math.max(least(), h0 + (ev.clientY - y0) * k)));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      const h = Math.min(ZONE_MAX_H, Math.max(least(), h0 + (ev.clientY - y0) * k));
      setDrag(null);
      if (Math.abs(h - h0) > 4) qa.height(set.id, part.id, h);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  const m = part.m;
  const tone = answer?.got === undefined || !showMark || !m ? "" : answer.got >= m ? " is-full" : answer.got > 0 ? " is-part" : " is-zero";
  const showFinger = mode === "ink" && fingerScrolls && coarse && !penSeen;

  return (
    <div className={`qs-zone${tone}${active && mode === "ink" ? " is-active" : ""}${has ? " is-has" : ""}`} ref={box} data-testid="answer-zone" data-part={part.id} data-mode={mode}>
      <div className="qs-zone-body">
        {bare ? (headSlot ? <div className="qs-zone-head qs-zone-head-bare">{headSlot}</div> : null) : <div className="qs-zone-head">
          <div className="qs-mode" role="group" aria-label="How to answer">
            <button ref={mode === "ink" ? modeBtn : undefined} type="button" aria-pressed={mode === "ink"} onClick={() => setMode("ink")} aria-label={`Draw by hand${written ? ", has drawing" : ""}`}>
              <PenSmallIcon /> Draw{written && <i aria-hidden="true" />}
            </button>
            <button ref={mode === "type" ? modeBtn : undefined} type="button" aria-pressed={mode === "type"} onClick={() => setMode("type")} aria-label={`Type${typed ? ", has typing" : ""}`}>
              <TypeIcon /> Type{typed && <i aria-hidden="true" />}
            </button>
          </div>
          <span className="grow" />
          {asking ? (
            <span
              className="qs-ask" role="group" aria-label="Clear this answer?"
              onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); keep(); } }}
            >
              <span>Clear this answer?</span>
              <button ref={keepBtn} type="button" className="qs-mini" onClick={keep} data-testid="clear-keep">Keep</button>
              <button type="button" className="qs-mini danger" onClick={reset} data-testid="clear-yes">Clear</button>
            </span>
          ) : (
            <span className="qs-zone-tools">
              <button type="button" className="qs-mini qs-icon" onClick={more} disabled={base >= ZONE_MAX_H} title="More space" aria-label="More space"><ExpandIcon /></button>
              {has && <button ref={resetBtn} type="button" className="qs-mini qs-reset" onClick={() => setAsking(true)} data-testid="zone-reset">Reset</button>}
            </span>
          )}
        </div>}
        {mode === "ink" ? (
          near ? (
            <InkCanvas
              ref={ink} inkKey={key} label={label} units={units} bg={prefs.bg} tool={prefs.tool} colour={prefs.colour} width={prefs.width}
              fingerScrolls={fingerScrolls} penSeen={penSeen || !!prefs.penSeen} metaN={answer?.ink?.n ?? 0} getCap={getCap}
              onInk={(n, b) => { setFull(false); setAlmost(b > getCap() * 0.85); qa.ink(set.id, part.id, n, b); }}
              onFull={() => setFull(true)}
              onFingerTap={() => { if (!penSeen) setHint(true); }}
              onBottom={setLow}
            />
          ) : <div className={`qs-ink bg-${prefs.bg}`} style={{ aspectRatio: `${REF_W} / ${units}` }} aria-hidden="true" onPointerDown={() => setNear(true)} />
        ) : (
          <TypePad
            subject={set.subject} text={answer?.text ?? ""} units={units} hand={prefs.hand !== false} label={label} full={full}
            onText={(t) => { const ok = qa.text(set.id, part.id, t); setFull(!ok); return ok; }}
          />
        )}
        {mode === "ink" && (full || almost) && <p className="qs-note" role="status">{full ? "This answer space is full. Clear some ink, or switch to Type." : "This answer space is nearly full. Type the rest if you need more room."}</p>}
        {hint && showFinger && (
          <div className="qs-hint" role="status">
            <span>Fingers scroll the page. Draw with a pen.</span>
            <button type="button" className="qs-mini" onClick={() => { qa.prefs({ fingerScrolls: false }); setHint(false); }}>Draw with my finger</button>
            <button type="button" className="qs-mini qs-hint-x" onClick={() => setHint(false)} aria-label="Dismiss"><CloseIcon /></button>
          </div>
        )}
      </div>
      <div
        className="qs-grip" role="separator" aria-orientation="horizontal" aria-label="Drag to make the answer space taller or shorter" aria-valuenow={Math.round(units)} aria-valuemin={floor} aria-valuemax={ZONE_MAX_H} tabIndex={0}
        onPointerDown={startGrip}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); qa.height(set.id, part.id, units + 40); }
          if (e.key === "ArrowUp") { e.preventDefault(); qa.height(set.id, part.id, Math.max(floor, units - 40)); }
        }}
      ><span aria-hidden="true" /></div>
    </div>
  );
}
