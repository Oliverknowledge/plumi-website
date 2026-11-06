"use client";

import { useLayoutEffect, useRef } from "react";
import { answerLength, isStructured, parseBack, parseFront, type Answer } from "@/lib/studyapp/markscheme";
import { BoldText } from "./BoldText";

/** Whether a back is set out as a mark scheme answer (points and the board's own lines), as the iPad does for any card written in that form. */
export const isMarkSchemeBack = isStructured;
export { parseFront };

/** The size an answer starts at, by how much there is of it (the iPad's `startSize`, 20 to 16, kept as four steps). */
export const answerSize = (a: Answer): "a" | "b" | "c" | "d" => {
  const n = answerLength(a);
  return n < 90 ? "a" : n < 190 ? "b" : n < 320 ? "c" : "d";
};

/** The answer side of a mark scheme card (the iPad's `MarkSchemeAnswerBody`): each marking point on its own line with a dot, the words the board underlines heavy, an "or" between alternatives, and the board's own lines under it in quiet bands. */
export function MarkSchemeBody({ back, fit = true }: { back: string; fit?: boolean }) {
  const a = parseBack(back);
  const ref = useRef<HTMLDivElement>(null);
  // As the iPad's `ViewThatFits`: the largest size at which the answer fits the card, then smaller steps, then a scroll for the rare answer that still does not.
  useLayoutEffect(() => {
    const el = ref.current;
    const box = fit ? el?.closest<HTMLElement>(".dsk-body") : null;
    if (!el || !box) return;
    const run = () => {
      el.style.fontSize = "";
      const base = parseFloat(getComputedStyle(el).fontSize);
      el.classList.remove("tight");
      for (let size = base; size >= Math.max(17, base * 0.62); size -= 1.5) {
        el.style.fontSize = `${size}px`;
        el.classList.toggle("tight", size < base * 0.85);
        if (box.scrollHeight <= box.clientHeight + 1) return;
      }
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(box);
    return () => ro.disconnect();
  }, [back, fit]);
  const bands: { id: string; label: string; lines: string[] }[] = [
    { id: "accept", label: "Also accept", lines: a.accepted },
    { id: "not", label: "Not accepted", lines: a.rejected },
    { id: "ignore", label: "Ignore", lines: a.ignored },
    { id: "note", label: "Mark scheme note", lines: a.notes },
  ].filter((b) => b.lines.length > 0);
  const single = a.rows.length === 1;
  return (
    <div ref={ref} className="ms" data-size={answerSize(a)} data-testid="ms-answer">
      {a.rows.length > 0 && (
        <ul className="ms-rows">
          {a.rows.map((r, i) => r.kind === "either"
            ? <li key={i} className="ms-or" aria-label="or"><span aria-hidden="true">or</span></li>
            : r.kind === "point"
              ? <li key={i} className="ms-point"><i aria-hidden="true" /><span><BoldText text={r.text} /></span></li>
              : <li key={i} className={`ms-lead${single ? " solo" : ""}`}><BoldText text={r.text} /></li>)}
        </ul>
      )}
      {bands.length > 0 && (
        <div className="ms-bands">
          {bands.map((b) => (
            <section key={b.id} className={`ms-band ${b.id}`} data-testid={`ms-${b.id}`} aria-label={b.label}>
              <h4>{b.label}</h4>
              {b.lines.map((l, i) => <p key={i}><BoldText text={l} bold={false} /></p>)}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** The question side: the question, then its marks in a small tag. */
export function MarkSchemeMarks({ marks }: { marks: string }) {
  return <span className="ms-marks" data-testid="ms-marks">{marks}</span>;
}
