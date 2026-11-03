"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { INK_PART_CAP, INK_TOTAL_CAP, REF_W } from "@/lib/studyapp/questions/ink";
import { hasInk, hasText, inkTotal, ZONE_MAX_H, zoneHeight, type QAnswer, type QPart, type QPrefs, type QSet } from "@/lib/studyapp/questions/model";
import { currentQuestions, qa } from "@/lib/studyapp/questions/store";
import { InkCanvas, type InkCanvasHandle } from "./InkCanvas";
import { setZoneVisible, useIsActiveInk, usePenSeen } from "./inkBus";
import { CloseIcon, PenSmallIcon, PlusIcon, TypeIcon } from "./icons";
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
export const AnswerZone = memo(AnswerZoneView, (a, b) => a.set === b.set && a.part === b.part && a.answer === b.answer && a.prefs === b.prefs && a.showMark === b.showMark);

function AnswerZoneView({ set, part, answer, prefs, showMark }: { set: QSet; part: QPart; answer: QAnswer | undefined; prefs: QPrefs; showMark: boolean; inkTotal?: number }) {
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

  // A canvas only while the zone is near the screen: measured before the first paint (so writing on screen is there at once), then watched.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setNear(r.bottom > -NEAR && r.top < window.innerHeight + NEAR);
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: `${NEAR}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // The pen tray is shown while any writing zone is on the screen.
  useEffect(() => {
    const el = box.current;
    if (!el || mode !== "ink") return;
    const io = new IntersectionObserver(([e]) => setZoneVisible(key, e.isIntersecting));
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

  const setMode = (m: "ink" | "type") => { if (answer?.mode !== m) qa.mode(set.id, part.id, m); };
  const more = () => qa.height(set.id, part.id, Math.min(ZONE_MAX_H, base + 120));
  const reset = () => {
    setAsking(false);
    ink.current?.clear();
    qa.reset(set.id, part.id);
    if (mode === "type") qa.dropInk(set.id, part.id);
  };

  const startGrip = (e: React.PointerEvent<HTMLDivElement>) => {
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
    <div className={`qs-zone${tone}${active && mode === "ink" ? " is-active" : ""}`} ref={box} data-testid="answer-zone" data-part={part.id} data-mode={mode}>
      <div className="qs-zone-head">
        <div className="qs-mode">
          <button type="button" aria-pressed={mode === "ink"} onClick={() => setMode("ink")} aria-label={`Write by hand${written ? ", has writing" : ""}`}>
            <PenSmallIcon /> Write{written && <i aria-hidden="true" />}
          </button>
          <button type="button" aria-pressed={mode === "type"} onClick={() => setMode("type")} aria-label={`Type${typed ? ", has typing" : ""}`}>
            <TypeIcon /> Type{typed && <i aria-hidden="true" />}
          </button>
        </div>
        <span className="grow" />
        {showFinger && !asking && <button type="button" className="qs-mini qs-fingerbtn" onClick={() => { qa.prefs({ fingerScrolls: false }); setHint(false); }} title="Fingers scroll the page. Tap to write with a finger instead.">Draw with my finger</button>}
        {asking ? (
          <span className="qs-ask" role="alertdialog" aria-label="Clear this answer?">
            <span>Clear this answer?</span>
            <button type="button" className="qs-mini danger" onClick={reset} autoFocus>Clear</button>
            <button type="button" className="qs-mini" onClick={() => setAsking(false)}>Keep</button>
          </span>
        ) : (
          <>
            <button type="button" className="qs-mini" onClick={more} disabled={base >= ZONE_MAX_H} title="Make the answer space taller"><PlusIcon /> <span className="qs-more">More</span><span className="qs-more-w"> space</span></button>
            <button type="button" className="qs-mini" onClick={() => setAsking(true)} disabled={!written && !typed && answer?.got === undefined}>Reset</button>
          </>
        )}
      </div>
      <div className="qs-zone-body">
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
          ) : <div className={`qs-ink bg-${prefs.bg}`} style={{ aspectRatio: `${REF_W} / ${units}` }} aria-hidden="true" />
        ) : (
          <TypePad
            text={answer?.text ?? ""} units={units} hand={!!prefs.hand} label={label} full={full}
            onText={(t) => { const ok = qa.text(set.id, part.id, t); setFull(!ok); return ok; }}
          />
        )}
        {mode === "ink" && (full || almost) && <p className="qs-note" role="status">{full ? "This answer space is full. Clear some ink, or switch to Type." : "This answer space is nearly full. Type the rest if you need more room."}</p>}
        {hint && showFinger && (
          <div className="qs-hint" role="status">
            <span>Fingers scroll the page. Write with a pen.</span>
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
