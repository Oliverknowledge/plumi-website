"use client";

import { useId, useMemo, useState } from "react";
import { partImage } from "@/lib/studyapp/questions/cropUrls";
import { cutWords, partAlt, questionKeyOf, type QPart } from "@/lib/studyapp/questions/model";
import { loadedSubject } from "./bankData";
import { sharedFigure } from "@/lib/studyapp/questions/sharedFigure";
import { ruler } from "@/lib/studyapp/questions/rulerStore";
import { Crop } from "./Crop";
import { ChevronIcon } from "./pickerIcons";

/**
 * "See the figure": for a part whose question's diagram, graph or table was cut into an earlier part's picture only (sharedFigure.ts says when). A quiet dashed chip above the part's picture;
 * it opens that earlier picture here, with its own zoom, and says which part it is from. Nothing at all where the question has its stem, the part is the first, or its words need no figure.
 * The same chip in the feed's card and in a set, a paper or a practice.
 */
/** The figure a part shares (sharedFigure.ts), with the bank subject's other parts read where the set does not hold them. */
export function useSharedFigure(part: QPart, siblings: readonly QPart[], subject?: string) {
  return useMemo(() => {
    const more = subject ? loadedSubject.get(subject)?.rows.filter((r) => questionKeyOf(r) === questionKeyOf(part) && !siblings.some((s) => s.id === r.id)) : undefined;
    return sharedFigure(part, more?.length ? [...siblings, ...more] : siblings);
  }, [part, siblings, subject]);
}

type Fig = NonNullable<ReturnType<typeof sharedFigure>>;

/** `ruler`: the virtual ruler is open for this part and lies on this figure (so the figure is open while it is, and putting the figure away puts the ruler away). */
export function SharedFigureChip({ fig, partId, cv, ruler: rulerOn }: { fig: Fig | null; partId: string; cv?: number; ruler?: boolean }) {
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  if (!!rulerOn !== asked) { setAsked(!!rulerOn); if (rulerOn) setOpen(true); }
  const id = useId();
  if (!fig) return null;
  const from = fig.from;
  return (
    <div className="qf-start qs-fig" data-testid="shared-figure">
      <button type="button" className="qf-startbtn" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { if (open && rulerOn) { ruler.close(partId); } setOpen((v) => !v); }} data-testid="shared-figure-btn">
        {open ? "Hide the figure" : "See the figure"}<span className="qs-fig-from"> from part {fig.label}</span><ChevronIcon />
      </button>
      {open && (
        <div id={id} className="qf-startbody">
          <Crop src={partImage(from.id, "qp", cv)} w={from.w} h={from.h} alt={`The figure, from part ${fig.label}: ${partAlt(from)}`} words={from.x ? cutWords(from.x, 110).text : undefined} what="the figure" zoom ruler={rulerOn ? partId : undefined} />
        </div>
      )}
    </div>
  );
}
