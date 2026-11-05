"use client";

import { useEffect, useMemo, useState } from "react";
import type { QPart } from "@/lib/studyapp/questions/model";
import { needsRuler } from "@/lib/studyapp/questions/rulerQuestion";
import { ruler, useRulerState } from "@/lib/studyapp/questions/rulerStore";
import { useBankText } from "./bankData";
import { useSharedFigure } from "./SharedFigure";

/**
 * What a part knows about the ruler: whether its question is one the student measures a picture for (rulerQuestion.ts), whether the ruler is open for it now, and which picture it lies on:
 * the shared figure's when the part has a "See the figure" chip (the figure is the picture the question is about), else the part's own.
 */
export function usePartRuler(part: QPart, siblings: readonly QPart[], subject?: string) {
  const fig = useSharedFigure(part, siblings, subject);
  // The question's full words (the bank's text file, which search reads too) are fetched once the page is idle, one fetch for the subject; until they are here the opening words stand in.
  const idle = useIdle();
  const { text } = useBankText(subject ?? null, idle && !!subject);
  const full = text?.[part.id];
  const offered = useMemo(() => needsRuler(full ?? part.x, part.l), [full, part.x, part.l]);
  const { partId } = useRulerState();
  const open = offered && partId === part.id;
  return { fig, offered, open, onFigure: open && !!fig, onOwn: open && !fig };
}

/** True a moment after the page has settled (so the text file is not fetched in the first seconds, when the pictures are). */
function useIdle(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const h = requestIdleCallback(() => setOn(true), { timeout: 3000 });
      return () => cancelIdleCallback(h);
    }
    const t = setTimeout(() => setOn(true), 1500);
    return () => clearTimeout(t);
  }, []);
  return on;
}

/** Putting a figure that sits above the chip away must not move the chip (and the buttons under it) off the screen: the page scrolls by what the layout moved. */
export function holdChip(chip: HTMLElement | null, change: () => void) {
  const before = chip?.getBoundingClientRect().top;
  change();
  if (!chip || before === undefined) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const d = chip.getBoundingClientRect().top - before;
    if (Math.abs(d) > 1) window.scrollBy({ top: d, behavior: "auto" });
  }));
}

const Glyph = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="8" width="19" height="8" rx="1.5" /><path d="M6 8v3M9.5 8v4.5M13 8v3M16.5 8v4.5M20 8v3" />
  </svg>
);

/** "Ruler": a dashed chip of the same family as "See the figure", only where the question asks the student to measure the picture. */
export function RulerChip({ partId, open, figure }: { partId: string; open: boolean; /** The ruler lies on the shared figure, which opens (or closes) above this chip. */ figure?: boolean }) {
  return (
    <div className="qf-start qs-rulerchip">
      <button type="button" className="qf-startbtn" aria-pressed={open} onClick={(e) => { const chip = e.currentTarget; if (figure && open) holdChip(chip, () => ruler.toggle(partId)); else ruler.toggle(partId); }} data-ruler-chip={partId} data-testid="ruler-chip">
        <Glyph />{open ? "Put the ruler away" : "Ruler"}
      </button>
    </div>
  );
}
