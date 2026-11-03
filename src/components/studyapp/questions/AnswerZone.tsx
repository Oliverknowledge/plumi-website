"use client";

import { useEffect, useRef, useState } from "react";
import { INK_PART_CAP, INK_TOTAL_CAP, REF_W } from "@/lib/studyapp/questions/ink";
import { hasInk, hasText, ZONE_MAX_H, zoneHeight, type QAnswer, type QPart, type QPrefs, type QSet } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { InkCanvas, type InkCanvasHandle } from "./InkCanvas";
import { useInkCaps, usePenSeen } from "./inkBus";
import { PenSmallIcon, PlusIcon, TypeIcon } from "./icons";
import { TypePad } from "./TypePad";
import { useMatch } from "./useMatch";

/**
 * The space for a student's answer, directly under a part: write on it (ink) or type into it, switchable per part
 * and remembered. Sized to the marks (about 90 units a mark, at least 140), taller with "More space" or by dragging
 * the grip. Both can hold something at once; the tabs show which does.
 */
export function AnswerZone({ set, part, answer, prefs, inkTotal, showMark }: { set: QSet; part: QPart; answer: QAnswer | undefined; prefs: QPrefs; inkTotal: number; showMark: boolean }) {
  const phone = useMatch("(max-width: 640px)");
  const coarse = useMatch("(pointer: coarse)");
  const penSeen = usePenSeen();
  const caps = useInkCaps();
  const key = `${set.id}/${part.id}`;
  const base = zoneHeight(part, answer);
  const [drag, setDrag] = useState<number | null>(null);
  const units = drag ?? base;
  const mode = answer?.mode ?? (phone ? "type" : "ink");
  const ink = useRef<InkCanvasHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [asking, setAsking] = useState(false);
  const [hint, setHint] = useState(false);
  const [full, setFull] = useState(false);
  const fingerScrolls = prefs.fingerScrolls ?? coarse;
  const label = `Answer for part ${part.l}`;
  const written = hasInk(answer), typed = hasText(answer);
  const active = caps.key === key;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (!hint) return; const t = setTimeout(() => setHint(false), 5000); return () => clearTimeout(t); }, [hint]);

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
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    const move = (ev: PointerEvent) => setDrag(Math.min(ZONE_MAX_H, Math.max(zoneHeight({ m: null }), h0 + (ev.clientY - y0) * k)));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      const h = Math.min(ZONE_MAX_H, Math.max(zoneHeight({ m: null }), h0 + (ev.clientY - y0) * k));
      setDrag(null);
      if (Math.abs(h - h0) > 4) qa.height(set.id, part.id, h);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  const m = part.m;
  const tone = answer?.got === undefined || !showMark || !m ? "" : answer.got >= m ? " is-full" : answer.got > 0 ? " is-part" : " is-zero";
  const room = Math.max(0, INK_TOTAL_CAP - inkTotal + (answer?.ink?.b ?? 0));

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
          near || written ? (
            <InkCanvas
              ref={ink} inkKey={key} label={label} units={units} bg={prefs.bg} tool={prefs.tool} colour={prefs.colour} width={prefs.width}
              fingerScrolls={fingerScrolls} penSeen={penSeen || !!prefs.penSeen} cap={Math.min(INK_PART_CAP, room)}
              onInk={(n, b) => { setFull(false); qa.ink(set.id, part.id, n, b); }}
              onFull={() => setFull(true)}
              onFingerTap={() => { if (!penSeen) setHint(true); }}
            />
          ) : <div className={`qs-ink bg-${prefs.bg}`} style={{ aspectRatio: `${REF_W} / ${units}` }} aria-hidden="true" />
        ) : (
          <TypePad
            text={answer?.text ?? ""} units={units} hand={!!prefs.hand} label={label} full={full}
            onText={(t) => { const ok = qa.text(set.id, part.id, t); setFull(!ok); return ok; }}
          />
        )}
        {full && mode === "ink" && <p className="qs-note" role="status">This answer space is full. Clear some ink, or switch to Type.</p>}
        {hint && mode === "ink" && fingerScrolls && (
          <div className="qs-hint" role="status">
            <span>Fingers scroll the page. Write with a pen.</span>
            <button type="button" className="qs-mini" onClick={() => { qa.prefs({ fingerScrolls: false }); setHint(false); }}>Draw with my finger</button>
          </div>
        )}
      </div>
      <div
        className="qs-grip" role="separator" aria-orientation="horizontal" aria-label="Drag to make the answer space taller or shorter" aria-valuenow={Math.round(units)} aria-valuemin={140} aria-valuemax={ZONE_MAX_H} tabIndex={0}
        onPointerDown={startGrip}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); qa.height(set.id, part.id, units + 40); }
          if (e.key === "ArrowUp") { e.preventDefault(); qa.height(set.id, part.id, units - 40); }
        }}
      ><span aria-hidden="true" /></div>
    </div>
  );
}
