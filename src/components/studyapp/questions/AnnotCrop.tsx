"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { INK_PART_CAP, INK_TOTAL_CAP } from "@/lib/studyapp/questions/ink";
import { inkTotal, keyOf, type QAnswer, type QPart, type QPrefs } from "@/lib/studyapp/questions/model";
import { currentQuestions, qa } from "@/lib/studyapp/questions/store";
import { annotOff, setAnnotCueSeen, setAnnotMouse, useAnnotCueSeen, useAnnotMouse } from "@/lib/studyapp/questions/annotMode";
import { Crop, type CropProps } from "./Crop";
import { InkCanvas, type InkCanvasHandle } from "./InkCanvas";
import { setZoneVisible, usePenSeen } from "./inkBus";
import { useMatch } from "./useMatch";

/** The key a part's marks on the question are kept under (IndexedDB), beside its answer's. */
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
  /** No marks on this picture now (the feed is full of answers and this question has none: nothing would be kept, so nothing is offered). */
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
  const phone = useMatch("(max-width: 640px)");
  const mouseAble = useMatch("(hover: hover) and (pointer: fine)");
  const penSeen = usePenSeen();
  const mouse = useAnnotMouse();
  const cueSeen = useAnnotCueSeen();
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
    const t = setTimeout(() => { saidFor.current = count; setSaid(count > 0 ? `${count} ${count === 1 ? "mark" : "marks"} on this question` : "Marks cleared"); }, 600);
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
  // focus goes back to a control after "Clear my marks?" (the Clear button, or what is left of the row), never to the page
  useEffect(() => {
    if (asking || !refocus.current) return;
    refocus.current = false;
    const to = clearBtn.current ?? tools.current?.querySelector<HTMLElement>("button") ?? host.current?.closest(".qf-pic, .qs-part")?.querySelector<HTMLElement>("[data-testid=crop-zoom]");
    to?.focus({ preventScroll: true });
  }, [asking, count]);

  // A pen (or a writing mouse or finger) put down on the layer before its canvas is there: the canvas is made, and takes the stroke up where it began. The click that follows
  // must not open the picture large.
  const pending = useRef<PointerEvent | null>(null);
  const stop = useRef(false);
  const writes = (t: string) => t === "pen" || (t === "mouse" && mouse) || (t === "touch" && !fingerScrolls);
  useLayoutEffect(() => {
    const e = pending.current;
    if (canvasUp && e && ink.current) { pending.current = null; ink.current.begin(e); }
  });
  const overlay = (
    <div
      ref={host} className={`qs-annot-host${hidden ? " is-hidden" : ""}`} data-testid="annot-host"
      onPointerDown={canvasUp ? undefined : (e) => {
        if (!writes(e.pointerType)) return;
        pending.current = e.nativeEvent; stop.current = true; setTimeout(() => { stop.current = false; }, 900);
        setHidden(false); setEngaged(true); setNear(true);
      }}
      onClick={(e) => { if (stop.current) { e.stopPropagation(); e.preventDefault(); } }}
    >
      {canvasUp && (
        <InkCanvas
          ref={ink} annot mouseDraws={mouse} inkKey={key} label={`Marks on part ${part.l}`} units={1} bg="plain" tool={prefs.tool} colour={prefs.colour} width={prefs.width}
          fingerScrolls={fingerScrolls} penSeen={penSeen || !!prefs.penSeen} metaN={answer?.ann?.n ?? 0} getCap={getCap} onInk={onInk} onFull={onFull} onFingerTap={noop} onBottom={noop}
        />
      )}
    </div>
  );

  const cue = count === 0 && !cueSeen && !asking && (penSeen || (coarse && !phone));
  const bare = !mouseAble && count === 0 && !asking && !cue;
  const toolsRow = (
    <div ref={tools} className={`qs-annot-tools${bare ? " is-bare" : ""}`} role="group" aria-label="Marks on the question" data-testid="annot-tools">
      {mouseAble && (
        <button type="button" className={`qs-annot-btn qs-annot-btn-t${mouse ? " on" : ""}`} aria-pressed={mouse} onClick={() => { const next = !mouse; setAnnotMouse(next); if (next) setHidden(false); }} title="Write on the question with the mouse" data-testid="annot-toggle">
          <Icon d={PENCIL} /><span className="qs-annot-t">Write on the question</span><span className="qs-sr">{mouse ? ", on" : ", off"}</span>
        </button>
      )}
      {cue && <p className="qs-annot-cue" data-testid="annot-cue">write on the question with your pencil</p>}
      {count > 0 && !asking && (
        <>
          <button type="button" className="qs-annot-btn" aria-pressed={!hidden} aria-label="My marks on the question" title={hidden ? "Show my marks" : "Hide my marks"} onClick={() => setHidden((v) => !v)} data-testid="annot-hide"><Icon d={hidden ? EYE_OFF : EYE} /><span className="qs-annot-t qs-annot-t-d">{hidden ? "Show" : "Hide"}</span></button>
          {!hidden && <button type="button" className="qs-annot-btn" aria-label="Undo mark on the question" title="Undo mark on the question" onClick={() => ink.current?.dropLast()} data-testid="annot-undo"><Icon d={UNDO} /><span className="qs-annot-t qs-annot-t-d">Undo mark</span></button>}
          {!hidden && <button ref={clearBtn} type="button" className="qs-annot-btn" aria-label="Clear my marks" title="Clear my marks" onClick={() => setAsking(true)} data-testid="annot-clear"><Icon d={BIN} /></button>}
          <span className="qs-annot-dot" title="You marked up this question" aria-hidden="true" /><span className="qs-annot-dot-t">You marked up this question</span>
        </>
      )}
      {asking && (
        <span className="qs-annot-ask" role="group" aria-label="Clear my marks?" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeAsk(false); } }}>
          <span>Clear my marks?</span>
          <button type="button" className="qs-mini" autoFocus onClick={() => closeAsk(false)} data-testid="annot-keep">Keep</button>
          <button type="button" className="qs-mini danger" onClick={() => closeAsk(true)} data-testid="annot-clear-yes">Clear</button>
        </span>
      )}
      <span className="qs-sr" role="status" aria-live="polite">{said}{full ? ". These marks are full" : ""}</span>
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
