"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { paperName, partImage, seriesLabel, stemImage, type BankPart, type BankSubject } from "@/content/questionBank";
import { AnswerReadBack } from "./AnswerBox";
import { ChoicePick, SelfMark } from "./SelfMark";
import { usePhotoScan } from "@/lib/photoScan";

/**
 * A question, full screen, to read on a phone: tap any question or mark scheme in the
 * bank and it opens here, fitted to the screen, to pinch, double-tap or drag like a
 * photo (turning the phone sideways makes it bigger still). Question and Mark scheme are
 * two tabs, and under the scheme are the self-marking keys, so a student reads, checks
 * and marks without leaving it. A paper is too wide to read at a phone's width, and
 * swiping it sideways line by line was the bank's worst moment on a phone.
 *
 * One viewer per bank page (QuestionBank renders it); rows open it with `openZoom`.
 */

type Kind = "qp" | "ms";
interface ZoomState { subject: BankSubject; parts: BankPart[]; index: number; kind: Kind }

let state: ZoomState | null = null;
const listeners = new Set<() => void>();
export function openZoom(next: ZoomState) {
  state = next;
  listeners.forEach(l => l());
  track("bank_zoom", { subject: next.subject.slug, part: next.parts[next.index]?.id, kind: next.kind });
}
function closeZoom() { state = null; listeners.forEach(l => l()); }
const useZoom = () => useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => null);

export function ZoomViewer() {
  const z = useZoom();
  const photo = usePhotoScan();
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<Kind>("qp");
  const [index, setIndex] = useState(0);

  // Each opening starts where it was opened: that part, that tab.
  const [opened, setOpened] = useState<ZoomState | null>(null);
  if (z !== opened) {
    setOpened(z);
    if (z) { setKind(z.kind); setIndex(z.index); }
  }

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (z && !d.open) d.showModal();
    if (!z && d.open) d.close();
  }, [z]);

  const part = z?.parts[index];
  const subject = z?.subject;
  const hasScheme = !!part && (!!part.ms || !!part.k);
  const many = (z?.parts.length ?? 0) > 1;

  function show(next: Kind) {
    setKind(next);
    if (next === "ms" && subject && part) track("bank_reveal", { subject: subject.slug, kind: "ms", part: part.id, via: "zoom" });
  }

  return (
    <dialog ref={ref} className="qb-zoom" aria-label="Question, full screen" onClose={closeZoom}>
      {z && subject && part && (
        <>
          <header className="qb-zoom-head">
            <p className="qb-zoom-title">
              <b>Q{part.l}</b> <span>{seriesLabel(subject, part.s)} · {paperName(subject, part.p)}{part.m != null ? ` · ${part.m} ${part.m === 1 ? "mark" : "marks"}` : ""}</span>
            </p>
            <button type="button" className="qb-zoom-x" aria-label="Close" onClick={() => ref.current?.close()}>×</button>
            {many && (
              <div className="qb-zoom-parts" role="tablist" aria-label="Parts">
                {z.parts.map((p, i) => (
                  <button key={p.id} type="button" role="tab" aria-selected={i === index} className={i === index ? "is-on" : ""} onClick={() => setIndex(i)}>{p.l}</button>
                ))}
              </div>
            )}
            {hasScheme && (
              <div className="qb-tabs qb-zoom-tabs" role="tablist" aria-label="Show">
                <button type="button" role="tab" aria-selected={kind === "qp"} className={kind === "qp" ? "is-on" : ""} onClick={() => show("qp")}>Question</button>
                <button type="button" role="tab" aria-selected={kind === "ms"} className={kind === "ms" ? "is-on" : ""} onClick={() => show("ms")}>{part.k ? "Answer" : "Mark scheme"}</button>
              </div>
            )}
          </header>

          {kind === "ms" && part.k ? (
            <div className="qb-zoom-answer"><p>The answer is <strong>{part.k}</strong></p></div>
          ) : (
            <Stage key={`${part.id}-${kind}`}>
              {kind === "qp" && part.st && (
                // eslint-disable-next-line @next/next/no-img-element
                <img {...photo} src={stemImage(part, subject.cropVersion)} alt={`The start of question ${part.l}`} draggable={false} />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...photo} src={partImage(part.id, kind, subject.cropVersion)} alt={kind === "qp" ? `Question ${part.l}: ${part.x}` : `Mark scheme for ${part.l}`} draggable={false} />
            </Stage>
          )}

          <footer className="qb-zoom-foot">
            {kind === "ms" && !part.k && <AnswerReadBack part={part} />}
            {kind === "ms" && !part.k && <SelfMark subject={subject.slug} part={part} />}
            {kind === "qp" && part.k && /^[A-D]( or [A-D])*$/.test(part.k) && <ChoicePick subject={subject.slug} part={part} />}
            {kind === "qp" && !part.k && hasScheme && (
              <button type="button" className="lp-btn qb-zoom-go" onClick={() => show("ms")}>Check the mark scheme</button>
            )}
            <p className="qb-zoom-hint">Pinch or double-tap to zoom · turn your phone sideways to read it bigger</p>
          </footer>
        </>
      )}
    </dialog>
  );
}

/**
 * The zoomable picture: fitted to the width to begin with, then pinch (two fingers),
 * double-tap (or double-click) to zoom in on a spot and back out, drag to move around,
 * ctrl or ⌘ and the wheel on a computer. Kept inside the screen, never lost off an edge.
 */
const MIN = 1;
const MAX = 5;
function Stage({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const t = useRef({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number; mx: number; my: number } | null>(null);
  const tap = useRef({ at: 0, x: 0, y: 0, moved: false });
  const [zoomed, setZoomed] = useState(false);

  const apply = useCallback(() => {
    const b = box.current, c = inner.current;
    if (!b || !c) return;
    const { s } = t.current;
    const W = b.clientWidth, H = b.clientHeight, w = c.offsetWidth * s, h = c.offsetHeight * s;
    // Smaller than the screen: centred. Bigger: its edges never come inside the screen's.
    t.current.x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, t.current.x));
    t.current.y = h <= H ? Math.max(0, (H - h) / 2) : Math.min(0, Math.max(H - h, t.current.y));
    c.style.transform = `translate(${t.current.x}px, ${t.current.y}px) scale(${s})`;
    setZoomed(s > 1.05);
  }, []);

  const zoomAt = useCallback((px: number, py: number, next: number) => {
    const s = Math.min(MAX, Math.max(MIN, next));
    const k = s / t.current.s;
    t.current = { s, x: px - (px - t.current.x) * k, y: py - (py - t.current.y) * k };
    apply();
  }, [apply]);

  // Fitted to the width on opening, and again whenever the screen turns or a picture arrives.
  useLayoutEffect(() => {
    t.current = { s: 1, x: 0, y: 0 };
    apply();
    const ro = new ResizeObserver(() => apply());
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [apply]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e: React.PointerEvent) {
    box.current?.setPointerCapture(e.pointerId);
    const p = local(e);
    pts.current.set(e.pointerId, p);
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: t.current.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
    tap.current.moved = false;
  }
  function move(e: React.PointerEvent) {
    const prev = pts.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pts.current.set(e.pointerId, p);
    if (Math.hypot(p.x - prev.x, p.y - prev.y) > 2) tap.current.moved = true;
    if (pts.current.size >= 2 && pinch.current) {
      const [a, b] = [...pts.current.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      t.current.x += mx - pinch.current.mx;
      t.current.y += my - pinch.current.my;
      pinch.current.mx = mx; pinch.current.my = my;
      zoomAt(mx, my, pinch.current.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d));
    } else {
      t.current.x += p.x - prev.x;
      t.current.y += p.y - prev.y;
      apply();
    }
  }
  function up(e: React.PointerEvent) {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    if (pts.current.size || tap.current.moved) return;
    // Two taps close together: in on that spot, or back out to the whole thing.
    const p = local(e), now = Date.now();
    if (now - tap.current.at < 320 && Math.hypot(p.x - tap.current.x, p.y - tap.current.y) < 30) {
      zoomAt(p.x, p.y, t.current.s > 1.05 ? 1 : 2.5);
      tap.current.at = 0;
    } else tap.current = { at: now, x: p.x, y: p.y, moved: false };
  }
  function wheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      const p = local(e);
      zoomAt(p.x, p.y, t.current.s * Math.exp(-e.deltaY / 300));
    } else {
      t.current.x -= e.deltaX;
      t.current.y -= e.deltaY;
      apply();
    }
  }
  const step = (by: number) => { const b = box.current!; zoomAt(b.clientWidth / 2, b.clientHeight / 3, t.current.s * by); };

  return (
    <div className="qb-zoom-stage">
      <div ref={box} className="qb-zoom-box" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
        <div ref={inner} className="qb-zoom-inner">{children}</div>
      </div>
      <div className="qb-zoom-tools">
        <button type="button" aria-label="Zoom out" onClick={() => step(1 / 1.5)} disabled={!zoomed}>−</button>
        <button type="button" aria-label="Zoom in" onClick={() => step(1.5)}>+</button>
        {zoomed && <button type="button" className="is-fit" onClick={() => zoomAt(0, 0, 1)}>Fit</button>}
      </div>
    </div>
  );
}
