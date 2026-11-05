"use client";

import { memo, useEffect, useId, useMemo, useState } from "react";
import { partImage, stemImage } from "@/lib/studyapp/questions/cropUrls";
import { bestState, otherCopy, qStateLine, stateOf, type QState } from "@/lib/studyapp/questions/feed";
import { cutWords, partAlt, questionOf, type FeedInfo, type QAnswer, type QPrefs, type QSet } from "@/lib/studyapp/questions/model";
import { toQPart, type BankRow } from "@/lib/studyapp/questions/picker";
import { startOpens } from "@/lib/questionStart";
import { qa, registerFeedPart } from "@/lib/studyapp/questions/store";
import { FeedAnswer } from "./FeedAnswer";
import { Check, ReportBody, useReport } from "./Check";
import { Crop } from "./Crop";
import { ChevronIcon } from "./pickerIcons";
import { ListenPlayer } from "./ListenPlayer";
import { PartFiles } from "./PartFiles";
import { specialsFor } from "@/lib/studyapp/questions/specials";
import { OtherCopy } from "./OtherCopy";
import { ReadAsText } from "./ReadAsText";
import { AnnotCrop } from "./AnnotCrop";
import { SharedFigureChip } from "./SharedFigure";
import { RulerChip, usePartRuler } from "./RulerChip";
import { copyFirstOnKey, fingerDraws, marksOnCopy } from "./copyFirst";
import { symbolsFor } from "@/lib/studyapp/questions/symbols";
import { useMatch } from "./useMatch";

/** The names a card needs of a subject, made once: the sitting, the paper (by lower-case code) and the topic. */
export interface FeedLookup { series: Map<string, string>; papers: Map<string, string>; topics: Map<string, string>; trs: Record<string, string>; ins?: Record<string, string>; code?: Record<string, string>; subject: string }

export interface FeedCardProps {
  /** Its place in the list, from 1. */
  n: number;
  part: BankRow;
  /** The subject's feed set as the answer parts read it (stable); the answer is stored under its id. */
  view: QSet;
  info: FeedInfo;
  lookup: FeedLookup;
  answer: QAnswer | undefined;
  /** Where else this question was answered (a paper, a set), when the feed has no answer for it. */
  other: QState | undefined;
  prefs: QPrefs;
  /** The parts of this question in printed order (this one among them). */
  siblings: readonly BankRow[];
  eager: boolean;
  /** The feed is full of answers and this question has none: it says so instead of offering a writing space that would not be kept. */
  full: boolean;
  onTopic(code: string): void;
  onWhole(part: BankRow): void;
  /** Open the paper or set where this question was also answered, at this question. */
  onSee(setId: string, partId: string): void;
}

/**
 * One question of the feed, laid out as on the public question bank: its number and details in the left margin, the picture on a taped sheet with the
 * student's own writing space directly under it and the mark scheme that pulls up from it, and the examiner's report as a note on the right. On a narrow
 * screen the margins fold above and below. An answer belongs to its question: it is kept under the subject's feed set, which a question joins the first time
 * the student writes on it, opens its scheme or marks it.
 */
export const FeedCard = memo(function FeedCard({ n, part, view, info, lookup, answer, other, prefs, siblings, eager, full, onTopic, onWhole, onSee }: FeedCardProps) {
  const series = lookup.series.get(part.s) ?? part.s;
  const paper = lookup.papers.get(part.p.toLowerCase()) ?? part.p;
  const q = questionOf(part.l);
  const at = siblings.findIndex((s) => s.id === part.id);
  const stemPart = useMemo(() => siblings.find((s) => s.st) ?? null, [siblings]);
  const [stem, setStem] = useState(() => !!stemPart && startOpens(at, part));
  const [soFar, setSoFar] = useState(false);
  const earlier = at > 0 ? siblings.slice(0, at) : [];
  /** The setup can be open on its own; the button is about what is still folded (a later part's earlier parts). */
  const startOpen = earlier.length > 0 ? soFar : stem;
  const hasStart = !!stemPart || earlier.length > 0;
  const st = bestState(stateOf(answer, part.m), other);
  const copy = otherCopy(answer, other);
  const typing = !!prefs.alwaysType;
  const shown = useMemo<QAnswer | undefined>(() => (typing && answer?.mode === undefined ? { ...answer, at: answer?.at ?? 0, mode: "type" } : answer), [typing, answer]);
  const tone = answer?.got === undefined || !part.m ? "" : answer.got >= part.m ? "full" : answer.got > 0 ? "part" : "zero";
  const startId = useId();
  const rl = usePartRuler(part, siblings, info.subject);
  // The paper's booklet or code files, where this question needs them (the transcript has its place under the player).
  const files = useMemo(() => specialsFor(lookup, part).filter((f) => f.kind !== "tr"), [lookup, part]);
  // The card tells the store what this question is; the question joins the feed set at the first real write on it (see `registerFeedPart`), never on a touch or a look.
  useEffect(() => {
    const names: Record<string, string> = { [part.s]: series, [part.p]: paper };
    const topics: Record<string, string> = {};
    for (const c of part.t) { const t = lookup.topics.get(c); if (t) topics[c] = t; }
    // (What the feed set keeps of a question is what it needs to find its answer: not the opening words, which the card reads from the bank.)
    const kept = toQPart(part);
    delete kept.x;
    registerFeedPart(info, kept, names, topics);
  }, [part, series, paper, lookup, info]);

  /** A pen, mouse or drawing finger put down on the faded copy, or a key typed into it, is "Continue here" first, so the old answer never seems to vanish under the new writing. */
  const coarse = useMatch("(pointer: coarse)");
  const takeCopy = (e: React.PointerEvent) => {
    if (!copy || !marksOnCopy(e, fingerDraws(prefs.fingerScrolls, coarse))) return;
    void qa.continueHere(copy.setId!, view.id, part.id, copy.answer!);
  };
  const takeCopyKey = (e: React.KeyboardEvent) => {
    if (!copy) return;
    copyFirstOnKey(e, copy.answer!.text, () => qa.continueHere(copy.setId!, view.id, part.id, copy.answer!));
  };

  const label = `${series} ${paper}, question ${part.l}`;
  return (
    <article
      className={`qf-card${st.state === "marked" ? " is-marked" : st.state === "written" ? " is-written" : ""}`} aria-label={label} tabIndex={-1} data-testid="feed-card" data-part={part.id}
    >
      <div className="qf-left">
        <span className="qf-num" aria-hidden="true">{n}</span>
        <h3 className="qf-q"><span className="qs-sr">Question </span>Q{part.l}</h3>
        <p className="qf-meta">{series}<span aria-hidden="true"> {"·"} </span><span className="qs-sr">, </span>{paper}</p>
        <div className="qf-tags">
          <p className={`qf-state is-${st.state}${st.from === "set" ? " is-set" : ""}`} data-testid="feed-state">{qStateLine(st)}</p>
          {part.m != null && part.m > 0 && <span className="qf-marks">{part.m} {part.m === 1 ? "mark" : "marks"}</span>}
          {part.t.slice(0, 2).map((c, i) => {
            const name = lookup.topics.get(c);
            return name ? <button key={c} type="button" className={`qf-topic t${i}`} onClick={() => onTopic(c)} title={`Only ${name}`}>{name}</button> : null;
          })}
          <button type="button" className="qf-whole" onClick={() => onWhole(part)} data-testid="feed-whole">The whole paper<ChevronIcon /></button>
        </div>
      </div>

      <div className="qf-sheet">
        <span className="qf-tape" aria-hidden="true" />
        {hasStart && (
          <div className="qf-start">
            <button type="button" className="qf-startbtn" aria-expanded={startOpen} aria-controls={stem || soFar ? startId : undefined} onClick={() => { setStem(!startOpen); setSoFar(!startOpen); }} data-testid="feed-start">
              {startOpen ? "Hide" : earlier.length ? `Question ${q} so far` : `How question ${q} starts`}<ChevronIcon />
            </button>
            {(stem || soFar) && (
              <div id={startId} className="qf-startbody">
                {stem && stemPart && <Crop className="qs-stem" src={stemImage(stemPart, view.cv)} alt={`The start of question ${q}`} guess={3.2} zoom what="the start of the question" />}
                {soFar && earlier.map((e) => (
                  <Crop key={e.id} src={partImage(e.id, "qp", view.cv)} w={e.w} h={e.h} alt={partAlt(e)} words={e.x ? cutWords(e.x, 110).text : undefined} what="this question picture" zoom />
                ))}
              </div>
            )}
          </div>
        )}
        <SharedFigureChip fig={rl.fig} partId={part.id} cv={view.cv} ruler={rl.onFigure} />
        {rl.offered && <RulerChip partId={part.id} open={rl.open} figure={!!rl.fig} />}
        <div className="qf-pic">
          <AnnotCrop off={full && answer === undefined} setId={view.id} part={part} answer={answer} prefs={prefs} src={partImage(part.id, "qp", view.cv)} w={part.w} h={part.h} alt={partAlt(part)} words={part.x ? cutWords(part.x, 110).text : undefined} what="this question picture" eager={eager} zoom ruler={rl.onOwn ? part.id : undefined}>
            <ReadAsText set={view} part={part} />
          </AnnotCrop>
        </div>
        <PartFiles files={files} />
        {part.au && <ListenPlayer part={part} transcript={lookup.trs[`${part.p}-${part.s}`] ?? null} checked={!!answer?.chk || answer?.got !== undefined} onWhole={() => onWhole(part)} />}
        {full && answer === undefined ? (
          <p className="qf-full" role="status">Your feed already holds 1,200 questions with answers. Your sets can clear the whole feed to make room, or practise these questions in a set instead.</p>
        ) : (
          <>
            <div className="qs-answer qf-answer" onPointerDownCapture={copy ? takeCopy : undefined} onKeyDownCapture={copy ? takeCopyKey : undefined}>
              <FeedAnswer set={view} part={part} answer={answer} shown={shown} prefs={prefs} copy={!!copy} />
              {copy && (
                <OtherCopy
                  code={symbolsFor(view.subject).code} partId={part.id} setId={copy.setId!} answer={copy.answer!} label={`From ${copy.kind === "paper" ? "a paper" : "a set"}`}
                  onSee={() => onSee(copy.setId!, part.id)} onContinue={() => { void qa.continueHere(copy.setId!, view.id, part.id, copy.answer!, true); }}
                />
              )}
              {answer?.got !== undefined && part.m != null && <span className={`qs-margin ${tone}`} data-testid="margin-score" aria-hidden="true">{answer.got}/{part.m}</span>}
            </div>
            <Check set={view} part={part} answer={answer} reportOutside />
          </>
        )}
        <span className="qs-sr" role="status">{answer?.got !== undefined && part.m != null ? `Part ${part.l}: ${answer.got} of ${part.m} marks` : ""}</span>
      </div>

      <div className="qf-right">{part.er && <ExaminerNote view={view} part={part} />}</div>
    </article>
  );
}, (a, b) =>
  a.n === b.n && a.part === b.part && a.view === b.view && a.info === b.info && a.lookup === b.lookup && a.answer === b.answer && a.prefs === b.prefs && a.siblings === b.siblings
  && a.eager === b.eager && a.full === b.full && a.onTopic === b.onTopic && a.onWhole === b.onWhole && a.onSee === b.onSee
  && a.other?.state === b.other?.state && a.other?.got === b.other?.got && a.other?.where === b.other?.where && a.other?.setId === b.other?.setId && a.other?.answer === b.other?.answer);

/** The examiner's report, a taped note in the right margin (below the card on a narrow screen): opened by the student, fetched when it is. */
function ExaminerNote({ view, part }: { view: QSet; part: BankRow }) {
  const [open, setOpen] = useState(false);
  const state = useReport(view, part, open);
  const id = useId();
  return (
    <section className={`qf-note${open ? " is-open" : ""}`} aria-label="Examiner's report">
      <span className="qf-notetape" aria-hidden="true" />
      <button type="button" className="qf-notebtn" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((v) => !v)} data-testid="feed-report">
        Examiner&apos;s report<ChevronIcon />
      </button>
      {open && <div id={id} className="qf-notebody qs-er"><ReportBody part={part} state={state} subject={view.subject} /></div>}
    </section>
  );
}
