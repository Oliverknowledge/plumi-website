"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { angleTo, constrain, lengthPx, middle, moved, pxPerMm, RULER_DEPTH_MM, RULER_MM, snap, startPose, turn, wrap, type RulerPose } from "@/lib/studyapp/questions/rulerMath";
import { ruler, useRulerState } from "@/lib/studyapp/questions/rulerStore";

/** The ticks, in millimetres along the ruler: a short one every millimetre, a medium one every 5, a long one every 10. */
const T1: string[] = [], T5: string[] = [], T10: string[] = [];
for (let i = 0; i <= RULER_MM; i++) (i % 10 === 0 ? T10 : i % 5 === 0 ? T5 : T1).push(`M${i} 0v${i % 10 === 0 ? 8 : i % 5 === 0 ? 5.5 : 3.2}`);
const D1 = T1.join(""), D5 = T5.join(""), D10 = T10.join("");
const PAD = 4;
const NUMS = Array.from({ length: 16 }, (_, i) => i);

/** Puts the focus back on the chip that opened the ruler (the ruler has just gone). */
export const focusRulerChip = (partId: string) => {
  const chip = document.querySelector<HTMLElement>(`[data-ruler-chip="${CSS.escape(partId)}"]`);
  chip?.focus({ preventScroll: true });
};

/**
 * A straight 15 cm ruler laid on a picture of the printed paper, at the paper's own size: the picture is a crop cut at 2.2 times the PDF's points, so a millimetre of paper is
 * `shown width / natural width * 6.236` screen pixels (rulerMath.ts), and the ruler is drawn that big whatever the screen, its width or the zoom. It reads out nothing: the student lays
 * it on the picture and reads it, as on paper. Dragged by its body (pen, finger or mouse), turned by the knob at its end (it snaps softly to 0, 45 and 90 degrees), moved by the arrow keys
 * and turned by [ and ]. It fills the picture's box (its layer ignores the pointer, only the ruler takes it), so it must sit in a positioned parent that is exactly the picture.
 */
export function Ruler({ partId, naturalW }: { partId: string; naturalW: number }) {
  const st = useRulerState();
  const layer = useRef<HTMLDivElement>(null);
  const hid = useId();
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = layer.current;
    if (!el) return;
    const read = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ppm = pxPerMm(size.w, naturalW);
  const k = ppm > 0 ? size.w / naturalW : 0;
  const box = useMemo(() => ({ w: naturalW, h: k ? size.h / k : 0 }), [naturalW, k, size.h]);
  const own = st.partId === partId ? st.pose : null;
  const bodyH = Math.max(RULER_DEPTH_MM * ppm, 58);
  /** Turning keeps the knob (a 44 px target at the body's far corner) wholly on the picture, so a finger can always follow it (moving the ruler may take it off: drag the ruler back). */
  const reach = k ? 24 / k : 0;
  const knob = useMemo(() => ({ along: k ? lengthPx() + (4 * ppm - 19) / k : 0, across: k ? (bodyH - 19) / k : 0 }), [k, bodyH, ppm]);
  const pose = useMemo(() => (k && box.h > 0 ? constrain(own ?? startPose(box), box) : null), [own, k, box]);
  useLayoutEffect(() => { if (pose && !own) ruler.place(partId, pose); }, [pose, own, partId]);

  const drag = useRef<{ id: number; sx: number; sy: number; p: RulerPose; off: number; knob: boolean } | null>(null);
  const live = useRef({ pose, box, size, naturalW, reach, knob });
  useLayoutEffect(() => { live.current = { pose, box, size, naturalW, reach, knob }; });

  const begin = (e: React.PointerEvent<HTMLElement>, knob: boolean) => {
    const L = live.current;
    if (!L.pose || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    let off = 0;
    if (knob) {
      const at = toPicture(e.clientX, e.clientY);
      const a = at && angleTo(middle(L.pose), at);
      off = a === null || a === undefined ? 0 : wrap(a - L.pose.angle);
    }
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, p: L.pose, off, knob };
    if (!knob) layer.current?.querySelector<HTMLElement>(".qs-ruler-body")?.focus({ preventScroll: true });
  };
  /** A point of the screen as a point of the picture, in the picture's own pixels (read from where the layer is, so a transform or a zoom does not matter). */
  const toPicture = (cx: number, cy: number) => {
    const el = layer.current;
    const L = live.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: ((cx - r.left) / r.width) * L.naturalW, y: ((cy - r.top) / r.height) * L.box.h };
  };
  const track = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const L = live.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.knob) {
      const at = toPicture(e.clientX, e.clientY);
      // (the angle is the pointer's from where the middle was when the knob was taken, so a ruler that has to slide to keep its knob on the picture does not chase the pointer)
      const a = at && angleTo(middle(d.p), at);
      if (a === null || a === undefined) return;
      ruler.move(partId, constrain(turn(d.p, snap(a - d.off)), L.box, 60, L.reach, L.knob));
      return;
    }
    const r = layer.current?.getBoundingClientRect();
    const f = r && r.width ? L.size.w / r.width : 1;
    ruler.move(partId, constrain(moved(d.p, (e.clientX - d.sx) * f, (e.clientY - d.sy) * f, L.size.w, L.naturalW), L.box));
  };
  const end = (e: React.PointerEvent<HTMLElement>) => { if (drag.current?.id === e.pointerId) drag.current = null; };

  const away = () => { ruler.close(partId); focusRulerChip(partId); };
  const onKey = (e: React.KeyboardEvent<HTMLElement>) => {
    const L = live.current;
    if (!L.pose || e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); away(); return; }
    const step = e.shiftKey ? 20 : 5;
    const arrow: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const a = arrow[e.key];
    if (a) { e.preventDefault(); ruler.move(partId, constrain(moved(L.pose, a[0], a[1], L.size.w, L.naturalW), L.box)); return; }
    if (e.code === "BracketLeft" || e.code === "BracketRight") {
      e.preventDefault();
      ruler.move(partId, constrain(turn(L.pose, L.pose.angle + (e.code === "BracketRight" ? 1 : -1) * (e.shiftKey ? 5 : 1)), L.box, 60, L.reach, L.knob));
    }
  };

  const bodyW = (RULER_MM + 2 * PAD) * ppm;
  const fs = 13 / (ppm || 1);
  const showPrinted = ppm >= 1.8;
  return (
    <div ref={layer} className="qs-ruler-layer" onClick={(e) => e.stopPropagation()} data-testid="ruler-layer">
      {pose && ppm > 0 && (
        <div className="qs-ruler" style={{ transform: `translate(${pose.x * k}px, ${pose.y * k}px) rotate(${pose.angle}deg)` }} data-angle={pose.angle}>
          <div
            className="qs-ruler-body" role="group" tabIndex={0} aria-label="Ruler, 15 centimetres, at the size of the printed paper" aria-describedby={hid} data-testid="ruler" data-ppm={ppm}
            style={{ left: -PAD * ppm, width: bodyW, height: bodyH }} onPointerDown={(e) => begin(e, false)} onPointerMove={track} onPointerUp={end} onPointerCancel={end} onKeyDown={onKey}
          >
            <svg width={bodyW} height={bodyH} viewBox={`${-PAD} 0 ${RULER_MM + 2 * PAD} ${bodyH / ppm}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path className="qs-ruler-t1" d={D1} />
              <path className="qs-ruler-t5" d={D5} />
              <path className="qs-ruler-t10" d={D10} />
              {NUMS.map((n) => <text key={n} className="qs-ruler-n" x={n * 10} y={9.2 + fs * 0.8} fontSize={fs} textAnchor="middle">{n}</text>)}
              {showPrinted && <text className="qs-ruler-pr" x={RULER_MM} y={9.2 + fs * 0.8 + 11.5 / ppm} fontSize={9.5 / ppm} textAnchor="end">at printed size</text>}
            </svg>
            <button type="button" className="qs-ruler-x" data-ctl aria-label="Close the ruler" onClick={away} onPointerDown={(e) => e.stopPropagation()} data-testid="ruler-close">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true" style={{ transform: `rotate(${-pose.angle}deg)` }}><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div className="qs-ruler-knob" data-ctl aria-hidden="true" data-testid="ruler-knob" onPointerDown={(e) => begin(e, true)} onPointerMove={track} onPointerUp={end} onPointerCancel={end}><span /></div>
          </div>
        </div>
      )}
      <span id={hid} className="qs-sr">Arrow keys move it, shift for bigger steps. The square brackets turn it. Escape puts it away.</span>
    </div>
  );
}
