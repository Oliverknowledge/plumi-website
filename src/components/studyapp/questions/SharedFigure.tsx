"use client";

import { useId, useMemo, useState } from "react";
import { partImage } from "@/lib/studyapp/questions/cropUrls";
import { cutWords, partAlt, questionKeyOf, type QPart } from "@/lib/studyapp/questions/model";
import { loadedSubject } from "./bankData";
import { sharedFigure } from "@/lib/studyapp/questions/sharedFigure";
import { Crop } from "./Crop";
import { ChevronIcon } from "./pickerIcons";

/**
 * "See the figure": for a part whose question's diagram, graph or table was cut into an earlier part's picture only (sharedFigure.ts says when). A quiet dashed chip above the part's picture;
 * it opens that earlier picture here, with its own zoom, and says which part it is from. Nothing at all where the question has its stem, the part is the first, or its words need no figure.
 * The same chip in the feed's card and in a set, a paper or a practice.
 */
export function SharedFigureChip({ part, siblings, cv, subject }: { part: QPart; siblings: readonly QPart[]; cv?: number; /** The bank subject (a set's): the question's other parts that the set does not hold are read from it where it has been loaded, so a set of one part still finds its figure. */ subject?: string }) {
  const fig = useMemo(() => {
    const more = subject ? loadedSubject.get(subject)?.rows.filter((r) => questionKeyOf(r) === questionKeyOf(part) && !siblings.some((s) => s.id === r.id)) : undefined;
    return sharedFigure(part, more?.length ? [...siblings, ...more] : siblings);
  }, [part, siblings, subject]);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!fig) return null;
  const from = fig.from;
  return (
    <div className="qf-start qs-fig" data-testid="shared-figure">
      <button type="button" className="qf-startbtn" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((v) => !v)} data-testid="shared-figure-btn">
        {open ? "Hide the figure" : "See the figure"}<span className="qs-fig-from"> from part {fig.label}</span><ChevronIcon />
      </button>
      {open && (
        <div id={id} className="qf-startbody">
          <Crop src={partImage(from.id, "qp", cv)} w={from.w} h={from.h} alt={`The figure, from part ${fig.label}: ${partAlt(from)}`} words={from.x ? cutWords(from.x, 110).text : undefined} what="the figure" zoom />
        </div>
      )}
    </div>
  );
}
