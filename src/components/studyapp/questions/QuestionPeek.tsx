"use client";

import { useEffect, useId, useRef, useState } from "react";
import { partImage, stemImage } from "@/lib/studyapp/questions/cropUrls";
import { cutWords, partAlt, type QPart } from "@/lib/studyapp/questions/model";
import { annotKey } from "./AnnotCrop";
import { Crop } from "./Crop";
import { ChevronIcon } from "./pickerIcons";
import { readGap } from "./usePin";

/**
 * The question, kept in reach on a narrow screen (a phone, an iPad upright) while the student writes under it. A zero-height anchor sits where the picture ends and sticks under the strip once the
 * picture has scrolled out of sight; the bar hangs from it, so nothing in the page ever moves for it. The bar shows a cut of the question and opens it in full over the page (its own scroll, the
 * page does not move). Shown only while the question is out of sight and the card's space to write in is still on the screen.
 */
export function QuestionPeek({ part, cv, label, stemPart, earlier, fig, figLabel, setId }: {
  part: QPart; cv?: number; label: string; stemPart: QPart | null; earlier: readonly QPart[]; fig: QPart | null; figLabel: string; setId: string;
}) {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [soFar, setSoFar] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Out of sight: the picture has gone up under the strip, and the card still has room below the strip.
  useEffect(() => {
    const sheet = anchor.current?.closest(".qf-sheet");
    if (!sheet) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      const gap = readGap();
      const pic = sheet.querySelector(".qf-pic")?.getBoundingClientRect();
      const s = !!pic && pic.bottom < gap + 8 && sheet.getBoundingClientRect().bottom > gap + 140;
      setShow((v) => (v === s ? v : s));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    run();
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  // The question is back in sight (or the card has gone): the panel is put away.
  if (!show && open) setOpen(false);

  // Escape puts the question away from wherever the keyboard is (a dialog or the pen's flyout open on top of it has Escape first).
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("dialog[open]")) { e.preventDefault(); setOpen(false); btn.current?.focus({ preventScroll: true }); } };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  const one = (p: QPart, key?: string) => (
    <Crop key={key} src={partImage(p.id, "qp", cv)} w={p.w} h={p.h} alt={partAlt(p)} words={p.x ? cutWords(p.x, 110).text : undefined} what="this question picture" zoom />
  );
  return (
    <div className="qf-peek" ref={anchor} data-testid="question-peek">
      <div className="qf-peekbar" hidden={!show}>
        <button ref={btn} type="button" className="qf-peekbtn" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((v) => !v)} data-testid="peek-btn">
          <span className="qf-peeklab">Question<span className="qs-sr"> {label}</span></span>
          <span className="qf-peekcut" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={partImage(part.id, "qp", cv)} alt="" loading="lazy" decoding="async" draggable={false} />
          </span>
          {fig && (
            <span className="qf-peekfig" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={partImage(fig.id, "qp", cv)} alt="" loading="lazy" decoding="async" draggable={false} />
            </span>
          )}
          <span className="qf-peekgo">{open ? "Hide" : "Show"}<ChevronIcon /></span>
        </button>
        {open && (
          <div id={id} className="qf-peekpanel" role="region" aria-label={`The question, ${label}`} data-testid="peek-panel">
            {stemPart && <Crop className="qs-stem" src={stemImage(stemPart, cv)} alt="The start of the question" guess={3.2} zoom what="the start of the question" />}
            {!stemPart && fig && !soFar && (
              <Crop src={partImage(fig.id, "qp", cv)} w={fig.w} h={fig.h} alt={`The figure, from part ${figLabel}: ${partAlt(fig)}`} what="the figure" zoom />
            )}
            {earlier.length > 0 && (
              <>
                <button type="button" className="qf-startbtn" aria-expanded={soFar} onClick={() => setSoFar((v) => !v)}>{soFar ? "Hide earlier parts" : "Earlier parts"}<ChevronIcon /></button>
                {soFar && earlier.map((e) => one(e, e.id))}
              </>
            )}
            <Crop src={partImage(part.id, "qp", cv)} w={part.w} h={part.h} alt={partAlt(part)} words={part.x ? cutWords(part.x, 110).text : undefined} what="this question picture" zoom marksKey={annotKey(setId, part.id)} />
          </div>
        )}
      </div>
    </div>
  );
}
