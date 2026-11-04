"use client";

import Image from "next/image";
import { memo } from "react";
import { paperAria, shortMonth, splitSeries, stateLine, type Paper, type PaperState } from "@/lib/studyapp/questions/papers";
import { lookFor, Mid, PaperArt } from "./paperArt";
import { RetryIcon } from "./icons";
import { ShuffleIcon } from "./pickerIcons";

/** What a shelf gives each of its cards so the arrow keys can move among them: whether it is the one tab stop, and where to report. */
export interface Roving { stop: boolean; attach(index: number, el: HTMLButtonElement | null): void; focused(index: number): void }

/**
 * One past paper on a shelf: the sitting in the hand-lettered label, the paper's name, how big it is, how far you are.
 * Memoised: it is drawn again only when its paper, its state or its place in the row changes (a year of 57 papers opens at once).
 */
export const PaperCard = memo(function PaperCard({ paper, state, n, tint, stop, attach, focused, onOpen }: {
  paper: Paper; state: PaperState; n: number; tint: string; stop: boolean; attach: Roving["attach"]; focused: Roving["focused"]; onOpen(p: Paper): void;
}) {
  const look = lookFor(n);
  const { month, year, tag } = splitSeries(paper.series);
  const pct = state.phase === "done" ? 100 : Math.round(state.fraction * 100);
  const attempt = state.attempt > 1 ? state.attempt : 0;
  return (
    <button
      type="button" ref={(el) => attach(n, el)} tabIndex={stop ? 0 : -1} onFocus={() => focused(n)} onClick={() => onOpen(paper)}
      className={`qh-paper is-${state.phase}`} style={{ "--tint": tint, "--tilt": `${look.tilt}deg`, "--i": Math.min(n, 9) } as React.CSSProperties}
      aria-label={paperAria(paper, state)} data-testid="paper-card" data-paper={paper.key}
    >
      <PaperArt look={look} />
      <span className="qh-label" aria-hidden="true">
        {month && <small>{shortMonth(month)}</small>}
        <b className={year.length > 5 ? "long" : undefined}>{year}</b>
        {tag && <i>{tag}</i>}
      </span>
      <span className="qh-name" aria-hidden="true">{paper.name}</span>
      {paper.title && <span className="qh-sub" aria-hidden="true">{paper.title}</span>}
      {(attempt > 0 || (paper.note && !paper.choose)) && (
        <span className="qh-notes" aria-hidden="true">
          {attempt > 0 && <span className="qh-attempt">Attempt {attempt}</span>}
          {paper.note && !paper.choose && <span className="qh-attempt part">{paper.note}</span>}
        </span>
      )}
      <Mid look={look} state={state} />
      <span className="qh-foot" aria-hidden="true">
        {paper.choose && paper.note ? (
          <span className="qh-counts"><b className="qh-choose">{paper.note}</b></span>
        ) : (
          <span className="qh-counts">
            {paper.marks != null && <b>{paper.marks.toLocaleString("en-GB")} {paper.marks === 1 ? "mark" : "marks"}</b>}
            <span>{paper.questions.toLocaleString("en-GB")} {paper.questions === 1 ? "question" : "questions"}</span>
          </span>
        )}
        {pct > 0 && <span className="qh-bar"><i style={{ width: `${pct}%` }} /></span>}
        <span className="qh-state">{stateLine(state)}</span>
      </span>
    </button>
  );
});

/** A paper that is still on its way: the shape of a paper (cream, ruled, taped), nothing written on it. */
export function PaperGhost({ n }: { n: number }) {
  const look = lookFor(n);
  return (
    <span className="qh-paper qh-ghost" aria-hidden="true" style={{ "--tilt": `${look.tilt}deg`, "--i": Math.min(n, 5) } as React.CSSProperties}>
      <PaperArt look={look} />
      <span className="qh-g-label" /><span className="qh-g-line" /><span className="qh-g-line short" /><span className="qh-g-dot" /><span className="qh-g-line wide" /><span className="qh-g-line foot" />
    </span>
  );
}

/** The shelf could not be drawn: one paper-shaped card, a gentle mascot, and a way to try again. No sentence on it (the button says it to a screen reader). */
export function PaperRetry({ onRetry, name }: { onRetry(): void; name: string }) {
  return (
    <button type="button" className="qh-paper qh-retry" onClick={onRetry} aria-label={`${name} papers did not load. Try again`} data-testid="shelf-retry">
      <PaperArt look={lookFor(2)} />
      <Image src="/study/mascot/plumi-curious.svg" alt="" width={64} height={64} unoptimized />
      <span className="qh-retry-go" aria-hidden="true"><RetryIcon /></span>
    </button>
  );
}

/** The card at the end of a shelf, when there are more papers: a little stack of them. */
export function MoreCard({ more, onClick, tint, n, stop, attach, focused }: { more: number; onClick(): void; tint: string; n: number } & Roving) {
  return (
    <button type="button" ref={(el) => attach(n, el)} tabIndex={stop ? 0 : -1} onFocus={() => focused(n)} onClick={onClick} className="qh-paper qh-more" style={{ "--tint": tint, "--i": Math.min(n, 9) } as React.CSSProperties} data-testid="card-more">
      <span className="qh-stack" aria-hidden="true"><i /><i /><i /><b>+{more}</b></span>
      <span className="qh-act-name">More papers</span>
      <span className="qh-act-sub">{more} earlier</span>
    </button>
  );
}

/** "Mix them up" and "Choose questions": two small pills in a shelf's header, always there (they need no list to be drawn). */
export function ShelfPills({ onMix, name }: { onMix(): void; name: string }) {
  return (
    <span className="qh-pills" role="group" aria-label={`${name} questions`}>
      <button type="button" className="qh-pill mix" onClick={onMix} data-testid="card-mix"><span className="qh-pill-ico" aria-hidden="true"><ShuffleIcon /></span>Mix them up</button>
    </span>
  );
}
