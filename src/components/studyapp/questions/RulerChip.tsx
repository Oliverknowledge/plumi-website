"use client";

import { useMemo } from "react";
import type { QPart } from "@/lib/studyapp/questions/model";
import { needsRuler } from "@/lib/studyapp/questions/rulerQuestion";
import { ruler, useRulerState } from "@/lib/studyapp/questions/rulerStore";
import { useSharedFigure } from "./SharedFigure";

/**
 * What a part knows about the ruler: whether its question is one the student measures a picture for (rulerQuestion.ts), whether the ruler is open for it now, and which picture it lies on:
 * the shared figure's when the part has a "See the figure" chip (the figure is the picture the question is about), else the part's own.
 */
export function usePartRuler(part: QPart, siblings: readonly QPart[], subject?: string) {
  const fig = useSharedFigure(part, siblings, subject);
  const offered = useMemo(() => needsRuler(part.x), [part.x]);
  const { partId } = useRulerState();
  const open = offered && partId === part.id;
  return { fig, offered, open, onFigure: open && !!fig, onOwn: open && !fig };
}

const Glyph = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="8" width="19" height="8" rx="1.5" /><path d="M6 8v3M9.5 8v4.5M13 8v3M16.5 8v4.5M20 8v3" />
  </svg>
);

/** "Ruler": a dashed chip of the same family as "See the figure", only where the question asks the student to measure the picture. */
export function RulerChip({ partId, open }: { partId: string; open: boolean }) {
  return (
    <div className="qf-start qs-rulerchip">
      <button type="button" className="qf-startbtn" aria-pressed={open} onClick={() => ruler.toggle(partId)} data-ruler-chip={partId} data-testid="ruler-chip">
        <Glyph />{open ? "Put the ruler away" : "Ruler"}
      </button>
    </div>
  );
}
