"use client";

import { useId, useMemo, useState } from "react";
import { partImage } from "@/lib/studyapp/questions/cropUrls";
import { cutWords, partAlt, type QPart } from "@/lib/studyapp/questions/model";
import { sharedFigure } from "@/lib/studyapp/questions/sharedFigure";
import { Crop } from "./Crop";
import { ChevronIcon } from "./pickerIcons";

/**
 * "See the figure": for a part whose question's diagram, graph or table was cut into an earlier part's picture only (sharedFigure.ts says when). A quiet dashed chip above the part's picture;
 * it opens that earlier picture here, with its own zoom, and says which part it is from. Nothing at all where the question has its stem, the part is the first, or its words need no figure.
 * The same chip in the feed's card and in a set, a paper or a practice.
 */
export function SharedFigureChip({ part, siblings, cv }: { part: QPart; siblings: readonly QPart[]; cv?: number }) {
  const fig = useMemo(() => sharedFigure(part, siblings), [part, siblings]);
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
