"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { INK_PART_CAP, INK_TOTAL_CAP } from "@/lib/studyapp/questions/ink";
import { inkTotal, keyOf, type QAnswer, type QPart, type QPrefs } from "@/lib/studyapp/questions/model";
import { currentQuestions, qa } from "@/lib/studyapp/questions/store";
import { annotOff, setAnnotCueSeen, setAnnotMouse, useAnnotMouse } from "@/lib/studyapp/questions/annotMode";
import { Crop, type CropProps } from "./Crop";
import { InkCanvas, type InkCanvasHandle } from "./InkCanvas";
import { setZoneVisible, useInkSaving, usePenSeen } from "./inkBus";
import { useMatch } from "./useMatch";

/** The key a part's writing on the question is kept under (IndexedDB), beside its answer's. */
export const annotKey = (setId: string, partId: string) => `${setId}/${partId}:q`;

const Icon = ({ d }: { d: string[] }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.map((p) => <path key={p} d={p} />)}</svg>
);
const PENCIL = ["M4 20l1-4L16 5l3 3L8 19z", "M14 7l3 3"];
const EYE = ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z", "M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"];
const EYE_OFF = ["M3 3l18 18", "M10.6 6.2A9.6 9.6 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.7M6.5 7.6C3.9 9.3 2 12 2 12s4 7 10 7a9 9 0 004.2-1"];
const UNDO = ["M9 7L4 12l5 5", "M4 12h10a6 6 0 010 12"];
const BIN = ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"];

type Props = CropProps & {
  /** What sits right under the picture (Read as text): the row of mark tools comes after it. */
  children?: React.ReactNode;
  setId: string;
  part: Pick<QPart, "id" | "l">;
  answer: QAnswer | undefined;
  prefs: QPrefs;
  /** No writing on this picture now (the feed is full of answers and this question has none: nothing would be kept, so nothing is offered). */
  off?: boolean;
};

/**
 * The question's picture with a layer of the student's own marks ON it (underline, circle, a sum in the margin, a tick): the strokes are kept in the picture's own units (800 across,
 * the same as an answer, so they follow the picture when it resizes or turns), under their own key, and never touch the answer, its status or its marks. A pen always writes on it; a finger scrolls
 * (or writes, with "Draw with my finger"); a mouse writes only once "Write on the question" is on. The canvas is made only where it is needed: for a picture with marks, once a pen is put down
 * on it (the stroke is taken up where it began), while the mouse switch is on, or, on a touch screen where a pen has been seen, for the pictures near the screen. It is shown read-only on the enlarged picture.
 */
export function AnnotCrop({ setId, part, answer, prefs, children, off, ...crop }: Props) {
  const key = annotKey(setId, part.id);
  const coarse = useMatch("(pointer: coarse)");
  const mouseAble = useMatch("(hover: hover) and (pointer: fine)");
  const penSeen = usePenSeen();
  const saving = useInkSaving();
  const mouse = useAnnotMouse();
  const fingerScrolls = prefs.fingerScrolls ?? coarse;
  const ink = useRef<InkCanvasHandle>(null);
  const host = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const clearBtn = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const [near, setNear] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [asking, setAsking] = useState(false);
  const [full, setFull] = useState(false);
  // The count the canvas knows now, until the document says something new (a write catching up, another tab, a cleared set).
  const doc = answer?.ann?.n ?? 0;
  const [seen, setSeen] = useState(doc);
  const [live, setCount] = useState<number | null>(null);
  if (seen !== doc) { setSeen(doc); setCount(null); }
  const count = live ?? doc;
  const [said, setSaid] = useState("");
  const saidFor = useRef(count);
  useEffect(() => { if (count > 0) setAnnotCueSeen(); }, [count]);
  // (said once the strokes stop changing)
  useEffect(() => {
    if (count === saidFor.current) return;
    const t = setTimeout(() => { saidFor.current = count; setSaid(count > 0 ? `${count} ${count === 1 ? "stroke" : "strokes"} on this question` : "Writing cleared"); }, 600);
    return () => clearTimeout(t);
  }, [count]);

  // Drawn only while the picture is near the screen (closer on a touch screen, where canvases are dearer): the LAST report is the truth (a batch can hold a gone-then-back pair).
  const margin = coarse ? 250 : 600;
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setNear(r.bottom > -margin && r.top < window.innerHeight + margin);
    // Coming near is at once; going far is only believed after a moment (a late report from before a jump must not take a canvas away from under a pen that has just been put down).
    let far: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1];
      if (!e) return;
      if (e.isIntersecting) { if (far) { clearTimeout(far); far = null; } setNear(true); }
      else if (!far) far = setTimeout(() => { far = null; setNear(false); }, 1500);
    }, { rootMargin: `${margin}px 0px` });
    io.observe(el);
    return () => { io.disconnect(); if (far) clearTimeout(far); };
  }, [margin, off]);
  const canvasUp = !hidden && near && (count > 0 || engaged || (mouseAble && mouse) || (coarse && (penSeen || !fingerScrolls)));
  // The pen tray is shown while the picture is on the screen, so its colours and eraser can be reached to mark it up.
  useEffect(() => {
    if (!near || hidden || off) return;
    setZoneVisible(key, true);
    return () => setZoneVisible(key, false);
  }, [near, hidden, off, key]);

  const onInk = useCallback((n: number, b: number) => { setFull(false); setCount(n); qa.ann(setId, part.id, n, b); }, [setId, part.id]);
  const getCap = useCallback(() => { const q = currentQuestions(); return Math.min(INK_PART_CAP, Math.max(0, INK_TOTAL_CAP - inkTotal(q) + (q.answers[keyOf(setId, part.id)]?.ann?.b ?? 0))); }, [setId, part.id]);
  const noop = useCallback(() => undefined, []);
  const onFull = useCallback(() => setFull(true), []);
  const closeAsk = (clear: boolean) => { refocus.current = true; setAsking(false); if (clear) ink.current?.clear(); };
  // focus goes back to a control after "Clear my writing?" (the Clear button, or what is left of the row), never to the page
  useEffect(() => {
    if (asking || !refocus.current) return;
    refocus.current = false;
    const to = clearBtn.current ?? tools.current?.querySelector<HTMLElement>("button") ?? host.current?.closest(".qf-pic, .qs-part")?.querySelector<HTMLElement>("[data-testid=crop-zoom]");
    to?.focus({ preventScroll: true });
  }, [asking, count]);

  // A pen (or a writing mouse or finger) put down on the layer before its canvas is there. The listener is the host's own (not a React prop, which a re-render can take away between the
  // page seeing a pen and this handler running: that re-render is what lost the first stroke on a wide touch screen): it is always there, buffers what the pointer does until the canvas
  // is mounted, and then hands the canvas the stroke from its first point. The click that follows a stroke (however long) or a drag must never open the picture large: from the pointer
  // going down until it lifts, and a moment after, a click is stopped at the window if the pointer wrote, or moved more than a few pixels.
  const pending = useRef<{ e: PointerEvent; buf: PointerEvent[]; end: PointerEvent | null } | null>(null);
  const wr = useRef({ mouse, fingerScrolls });
  useEffect(() => { wr.current = { mouse, fingerScrolls }; });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let st: { id: number; x: number; y: number; writing: boolean; moved: number } | null = null;
    let grace: ReturnType<typeof setTimeout> | null = null;
    const onMove = (e: PointerEvent) => {
      if (!st || e.pointerId !== st.id) return;
      st.moved = Math.max(st.moved, Math.hypot(e.clientX - st.x, e.clientY - st.y));
      const p = pending.current;
      if (p && p.e.pointerId === e.pointerId) { const co = e.getCoalescedEvents?.() ?? []; p.buf.push(...(co.length ? co : [e])); }
    };
    const onClick = (e: MouseEvent) => { if (st && (st.writing || st.moved > 6)) { e.stopPropagation(); e.preventDefault(); } };
    const stopListening = () => { window.removeEventListener("pointermove", onMove, true); window.removeEventListener("pointerup", onEnd, true); window.removeEventListener("pointercancel", onEnd, true); };
    const finish = () => { stopListening(); window.removeEventListener("click", onClick, true); if (grace) clearTimeout(grace); grace = null; st = null; };
    function onEnd(e: PointerEvent) {
      if (!st || e.pointerId !== st.id) return;
      stopListening();
      const p = pending.current;
      if (p && p.e.pointerId === e.pointerId) p.end = e;
      grace = setTimeout(finish, 350);
    }
    const onDown = (e: PointerEvent) => {
      finish();
      const t = e.pointerType;
      const writing = t === "pen" || (t === "mouse" && wr.current.mouse) || (t === "touch" && !wr.current.fingerScrolls);
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, writing, moved: 0 };
      window.addEventListener("pointermove", onMove, true); window.addEventListener("pointerup", onEnd, true); window.addEventListener("pointercancel", onEnd, true);
      window.addEventListener("click", onClick, true);
      if (!writing || e.target !== el) return;       // (a pointer put down on the canvas itself is the canvas's own)
      e.preventDefault();
      setHidden(false);
      if (ink.current) { ink.current.begin(e); return; }
      pending.current = { e, buf: [], end: null };
      setEngaged(true); setNear(true);
    };
    el.addEventListener("pointerdown", onDown, true);
    return () => { el.removeEventListener("pointerdown", onDown, true); finish(); };
  }, [off]);
  useLayoutEffect(() => {
    const p = pending.current;
    if (canvasUp && p && ink.current) { pending.current = null; ink.current.begin(p.e, p.buf, p.end); }
  });
  const overlay = (
    <div
      ref={host} className={`qs-annot-host${hidden ? " is-hidden" : ""}`} data-testid="annot-host"
    >
      {canvasUp && (
        <InkCanvas
          ref={ink} annot mouseDraws={mouse} inkKey={key} label={`Your writing on part ${part.l}`} units={1} bg="plain" tool={prefs.tool} colour={prefs.colour} width={prefs.width}
          fingerScrolls={fingerScrolls} penSeen={penSeen || !!prefs.penSeen} metaN={answer?.ann?.n ?? 0} getCap={getCap} onInk={onInk} onFull={onFull} onFingerTap={noop} onBottom={noop}
        />
      )}
    </div>
  );

  // (no cue: an invitation to write on the question draws on the printed Answer line, and marks alone are not an answer)
  const cue = false;
  const bare = !mouseAble && count === 0 && !asking && !cue && !full;
  const toolsRow = (
    <div ref={tools} className={`qs-annot-tools${bare ? " is-bare" : ""}`} role="group" aria-label="Your writing on the question" data-testid="annot-tools">
      {mouseAble && (
        <button type="button" className={`qs-annot-btn qs-annot-btn-t${mouse ? " on" : ""}`} aria-pressed={mouse} onClick={() => { const next = !mouse; setAnnotMouse(next); if (next) setHidden(false); }} title="Write on the question with the mouse" data-testid="annot-toggle">
          <Icon d={PENCIL} /><span className="qs-annot-t">Write on the question</span><span className="qs-sr">{mouse ? ", on" : ", off"}</span>
        </button>
      )}
      {cue && <p className="qs-annot-cue" data-testid="annot-cue">write on the question with your pencil</p>}
      {count > 0 && !asking && (
        <>
          <button type="button" className="qs-annot-btn" aria-pressed={!hidden} aria-label="Your writing on the question" title={hidden ? "Show my writing" : "Hide my writing"} onClick={() => setHidden((v) => !v)} data-testid="annot-hide"><Icon d={hidden ? EYE_OFF : EYE} /><span className="qs-annot-t qs-annot-t-d"><span className="qs-annot-long">{hidden ? "Show my writing" : "Hide my writing"}</span><span className="qs-annot-short">{hidden ? "Show" : "Hide"}</span></span></button>
          {!hidden && <button type="button" className="qs-annot-btn" aria-label="Undo last stroke on the question" title="Undo last stroke on the question" onClick={() => ink.current?.dropLast()} data-testid="annot-undo"><Icon d={UNDO} /><span className="qs-annot-t qs-annot-t-d"><span className="qs-annot-long">Undo</span><span className="qs-annot-short">Undo</span></span></button>}
          {!hidden && <button ref={clearBtn} type="button" className="qs-annot-btn" aria-label="Clear my writing" title="Clear my writing" onClick={() => setAsking(true)} data-testid="annot-clear"><Icon d={BIN} /><span className="qs-annot-t qs-annot-t-d"><span className="qs-annot-long">Clear my writing</span><span className="qs-annot-short">Clear</span></span></button>}
          <span className="qs-annot-dot" title="You wrote on this question" aria-hidden="true" /><span className="qs-annot-dot-t">You wrote on this question</span>
        </>
      )}
      {asking && (
        <span className="qs-annot-ask" role="group" aria-label="Clear my writing?" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeAsk(false); } }}>
          <span>Clear my writing?</span>
          <button type="button" className="qs-mini" autoFocus onClick={() => closeAsk(false)} data-testid="annot-keep">Keep</button>
          <button type="button" className="qs-mini danger" onClick={() => closeAsk(true)} data-testid="annot-clear-yes">Clear</button>
        </span>
      )}
      {(full || (!saving && count > 0)) && <p className="qs-annot-note" data-testid="annot-note">{full ? "Your writing here is full. Clear some to add more." : "Not saved on this device. Keep this tab open."}</p>}
      <span className="qs-sr" role="status" aria-live="polite">{!saving && count > 0 ? "Not saved" : said}{full ? ". Your writing here is full" : ""}</span>
    </div>
  );

  if (off || annotOff()) return <><Crop {...crop} />{children}</>;
  return (
    <>
      <Crop {...crop} overlay={overlay} marksKey={count > 0 && !hidden ? key : undefined} />
      {children}
      {toolsRow}
    </>
  );
}
