"use client";

import { paperAria, shortMonth, splitSeries, stateLine, type Paper, type PaperState } from "@/lib/studyapp/questions/papers";
import { lookFor, PaperArt } from "./paperArt";
import { PlusIcon, SearchIcon } from "./icons";
import { ShuffleIcon } from "./pickerIcons";

/** What a shelf gives each of its cards so the arrow keys can move among them: its place, whether it is the one tab stop, and where to report. */
export interface Roving { index: number; stop: boolean; attach(index: number, el: HTMLButtonElement | null): void; focused(index: number): void }

/** One past paper on a shelf: the sitting in the hand-lettered label, the paper's name, how big it is, how far you are. */
export function PaperCard({ paper, state, n, tint, onOpen, nav }: { paper: Paper; state: PaperState; n: number; tint: string; onOpen(): void; nav: Roving }) {
  const look = lookFor(n);
  const { month, year, tag } = splitSeries(paper.series);
  const pct = state.kind === "done" ? 100 : state.of > 0 ? Math.round((state.done / state.of) * 100) : 0;
  return (
    <button
      type="button" ref={(el) => nav.attach(nav.index, el)} tabIndex={nav.stop ? 0 : -1} onFocus={() => nav.focused(nav.index)} onClick={onOpen}
      className={`qh-paper is-${state.kind}`} style={{ "--tint": tint, "--tilt": `${look.tilt}deg`, "--i": Math.min(n, 9) } as React.CSSProperties}
      aria-label={paperAria(paper, state)} data-testid="paper-card" data-paper={paper.key}
    >
      <PaperArt look={look} state={state} />
      <span className="qh-label" aria-hidden="true">
        {month && <small>{shortMonth(month)}</small>}
        <b className={year.length > 5 ? "long" : undefined}>{year}</b>
        {tag && <i>{tag}</i>}
      </span>
      <span className="qh-name" aria-hidden="true">{paper.name}</span>
      {paper.title && <span className="qh-sub" aria-hidden="true">{paper.title}</span>}
      <span className="qh-foot" aria-hidden="true">
        <span className="qh-counts">{paper.marks != null && <b>{paper.marks.toLocaleString("en-GB")} {paper.marks === 1 ? "mark" : "marks"}</b>}<span>{paper.questions.toLocaleString("en-GB")} {paper.questions === 1 ? "question" : "questions"}</span></span>
        <span className="qh-bar"><i style={{ width: `${pct}%` }} /></span>
        <span className="qh-state">{stateLine(state)}</span>
      </span>
    </button>
  );
}

/** A paper that is still on its way: the shape of a card, no words. */
export function PaperGhost({ n }: { n: number }) {
  return <span className="qh-paper qh-ghost" aria-hidden="true" style={{ "--tilt": `${lookFor(n).tilt}deg` } as React.CSSProperties} />;
}

type Kind = "mix" | "pick" | "more";
/** The cards at the end of a shelf: mix, pick your own, and (when there are more) more papers. Same size as a paper, a note card not a paper. */
export function ActionCard({ kind, label, sub, tint, onClick, nav, extra }: { kind: Kind; label: string; sub?: string; tint: string; onClick(): void; nav: Roving; extra?: string }) {
  return (
    <button type="button" ref={(el) => nav.attach(nav.index, el)} tabIndex={nav.stop ? 0 : -1} onFocus={() => nav.focused(nav.index)} onClick={onClick} className={`qh-paper qh-act is-${kind}`} style={{ "--tint": tint } as React.CSSProperties} data-testid={`card-${kind}`}>
      <span className="qh-act-ico" aria-hidden="true">{kind === "mix" ? <ShuffleIcon /> : kind === "pick" ? <SearchIcon /> : extra ? <b>{extra}</b> : <PlusIcon />}</span>
      <span className="qh-act-name">{label}</span>
      {sub && <span className="qh-act-sub">{sub}</span>}
    </button>
  );
}
