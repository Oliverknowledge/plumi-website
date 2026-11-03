"use client";

import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent } from "react";
import type { SubjectChoice } from "@/lib/studyapp/questions/mine";
import { bookLabel } from "@/lib/studyapp/questions/setupBooks";
import { sortTiers, subjectTint } from "@/lib/studyapp/questions/subject";
import { bookArt, SETUP_ART } from "./BookArt";

/**
 * One exercise book of the setup. Ticking picks it up (it lifts, straightens and gets a tick stamp); its exam board is written on the cover's
 * label, and the choices (boards as luggage tags, a tier as a quiet sticker) hang from the cover in a flap while there is something to choose.
 * The cover is fixed in size, so nothing around it moves when it is ticked. What it looks like is all in BookArt.tsx and the EXERCISE BOOK ART
 * block of questions-setup.css.
 */
export function SetupBook({ choice, dataKey, slug, tierOptions, tierChosen, open, onToggle, onBoard, onTier, onOpen, onClose }: {
  choice: SubjectChoice;
  /** The draft key (level and subject): how the page finds this book again. */
  dataKey: string;
  /** undefined: not chosen. "": chosen, no board yet. Otherwise the chosen board's slug. */
  slug: string | undefined;
  /** The tiers of the chosen board's papers (two or more, or none). */
  tierOptions: string[];
  tierChosen: string[];
  /** The flap is out. */
  open: boolean;
  onToggle(): void; onBoard(slug: string): void; onTier(t: string): void; onOpen(): void; onClose(): void;
}) {
  const art = bookArt(choice.base);
  const on = slug !== undefined;
  const board = slug ? choice.boards.find((b) => b.slug === slug)?.label ?? null : null;
  const sel = tierChosen.filter((t) => tierOptions.includes(t));
  const tiersShown = tierOptions.length >= 2 && sel.length < tierOptions.length ? sortTiers(sel) : [];
  const choices = choice.boards.length > 1 || tierOptions.length >= 2;
  const flapId = useId();
  const flap = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLButtonElement>(null);
  const showFlap = on && open;

  // A flap that opens near the foot of the screen scrolls into view (a step, not a glide, when they prefer less motion).
  useEffect(() => {
    if (!showFlap) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    flap.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
  }, [showFlap]);

  const keys = (e: KeyboardEvent) => { if (e.key === "Escape" && showFlap) { e.stopPropagation(); onClose(); cover.current?.focus(); } };
  const { Doodle } = art;
  const style = { "--tint": subjectTint(choice.base), "--tilt": `${art.tilt}deg` } as CSSProperties;
  return (
    <li className={`qk-slot qk-size-${art.size}${on ? " on" : ""}${on && !slug ? " need" : ""}${showFlap ? " out" : ""}`} style={style} data-key={dataKey} onKeyDown={keys}>
      <div className={`qk-book qk-cover--${art.cover} qk-tape--${art.tape} qk-bind--${art.binding}`}>
        <span className="qk-spine" aria-hidden="true" />
        <span className="qk-tape" aria-hidden="true" />
        <span className="qk-plate" aria-hidden="true"><b>{choice.base}</b></span>
        <span className="qk-doodle" aria-hidden="true"><Doodle /></span>
        <span className="qk-stamp" aria-hidden="true"><SETUP_ART.TickStamp /></span>
        <button ref={cover} type="button" className="qk-cover" aria-label={bookLabel(choice.base, on, board, tiersShown)} onClick={onToggle} data-testid={`tick-${choice.base}`} />
        {!on && <span className="qk-label" aria-hidden="true" />}
        {on && (choices ? (
          <button type="button" className="qk-label qk-label-btn" aria-expanded={showFlap} aria-controls={showFlap ? flapId : undefined} onClick={showFlap ? onClose : onOpen}
            aria-label={board ? `${choice.base} exam board ${board}${tierOptions.length >= 2 ? `, ${tiersShown.length ? tiersShown.join(" and ") : "any tier"}` : ""}. Change` : `Pick the exam board for ${choice.base}`} data-testid={`label-${choice.base}`}>
            {board ? <span className="qk-sticker">{board}</span> : <span className="qk-sticker qk-sticker-ask">Pick a board</span>}
            {board && tierOptions.length >= 2 && (tiersShown.length ? tiersShown.map((t) => <span key={t} className="qk-sticker qk-sticker-tier">{t}</span>) : <span className="qk-sticker qk-sticker-tier qk-sticker-any">Any tier</span>)}
          </button>
        ) : (
          <span className="qk-label"><span className="qk-sticker" data-testid="board-fixed">{choice.boards[0].label}</span></span>
        ))}
      </div>
      {showFlap && (
        <div className="qk-flap" id={flapId} ref={flap} onClick={(e) => { if (!(e.target as Element).closest("button")) onClose(); }}>
          <div className="qk-tags" role="group" aria-label={`Exam board for ${choice.base}`}>
            {choice.boards.map((b) => (
              <button key={b.slug} type="button" className={`qk-tag${slug === b.slug ? " on" : ""}`} aria-pressed={slug === b.slug} onClick={() => { onBoard(b.slug); cover.current?.focus({ preventScroll: true }); }} data-testid={`board-${b.slug}`}>
                <span>{b.label}</span>
              </button>
            ))}
          </div>
          {tierOptions.length >= 2 && (
            <div className="qk-tags qk-tags-tier" role="group" aria-label={`Which tier of ${choice.base}. Choose neither to see both.`} data-testid={`tiers-${choice.base}`}>
              {tierOptions.map((t) => (
                <button key={t} type="button" className={`qk-tag qk-tier${sel.includes(t) ? " on" : ""}`} aria-pressed={sel.includes(t)} onClick={() => onTier(t)} data-testid={`tier-${choice.base}-${t}`}>
                  <span>{t}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
