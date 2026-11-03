"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INK_TOTAL_CAP } from "@/lib/studyapp/questions/ink";
import { partImage, stemImage } from "@/lib/studyapp/questions/cropUrls";
import { blockScore, blocks, inkTotal, keyOf, progress, scoreSet, type Block, type QAnswer, type QPart, type QPrefs, type QSet, type QuestionsData } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { toast } from "../toast";
import { useMatch } from "./useMatch";
import { AnswerZone } from "./AnswerZone";
import { Check } from "./Check";
import { BackIcon, BoltIcon } from "./icons";
import { inkAct, setPenSeen, usePenSeen } from "./inkBus";
import { PagePopover } from "./PagePopover";
import { PenTray } from "./PenTray";
import { SetsSheet } from "./SetsSheet";
import { Summary } from "./Summary";

/**
 * The practice sheet: a cream paper on a wooden desk that scrolls through the set. Each question shows its pictures
 * in order (the setup if there is one, then each part), and directly under each part its answer zone, a Check
 * button, the mark scheme it opens, and the marks the student gives themselves in the margin.
 */
export function Sheet({ set, q }: { set: QSet; q: QuestionsData }) {
  const bs = useMemo(() => blocks(set.parts), [set.parts]);
  const [reviewing, setReviewing] = useState(false);
  const [sets, setSets] = useState(false);
  const penSeen = usePenSeen();
  const phone = useMatch("(max-width: 640px)");
  const prefs = q.prefs;
  const anyInk = set.parts.some((p) => (q.answers[keyOf(set.id, p.id)]?.mode ?? (phone ? "type" : "ink")) === "ink");
  const total = inkTotal(q);
  const prog = progress(set, q.answers);
  const [cur, setCur] = useState(Math.min(set.at, bs.length - 1));
  const refs = useRef<(HTMLElement | null)[]>([]);

  // A pen seen before on this device: the page starts as a pen page. A pen seen now: remember it.
  useEffect(() => { if (prefs.penSeen) setPenSeen(true); }, [prefs.penSeen]);
  useEffect(() => { if (penSeen && !prefs.penSeen) qa.prefs({ penSeen: true }); }, [penSeen, prefs.penSeen]);

  // Which question is at the top of the screen; kept, so closing the tab and coming back returns here.
  useEffect(() => {
    const els = refs.current.filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCur(Number((e.target as HTMLElement).dataset.n) - 1);
    }, { rootMargin: "-30% 0px -60% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [bs.length, set.id, reviewing, set.finishedAt]);
  useEffect(() => {
    if (cur === set.at) return;
    const t = setTimeout(() => qa.at(set.id, cur), 600);
    return () => clearTimeout(t);
  }, [cur, set.at, set.id]);

  // Return to the question that was open.
  useEffect(() => {
    if (set.finishedAt && !reviewing) return;
    const go = () => { if (set.at > 0 && window.scrollY < 40) refs.current[set.at]?.scrollIntoView({ block: "start" }); };
    const ts = [60, 500, 1400].map((ms) => setTimeout(go, ms));
    return () => ts.forEach(clearTimeout);
    // only on opening a set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id, reviewing]);

  const jump = useCallback((to: number) => {
    const n = Math.max(0, Math.min(bs.length - 1, to));
    refs.current[n]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [bs.length]);

  // Keyboard, on a desktop: N next question, B back, E eraser, P pen, Z undo, Shift Z redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector("dialog[open]")) return;
      const k = e.key.toLowerCase();
      if (k === "n") { e.preventDefault(); jump(cur + 1); }
      else if (k === "b") { e.preventDefault(); jump(cur - 1); }
      else if (k === "e") { e.preventDefault(); qa.prefs({ tool: "eraser" }); }
      else if (k === "p") { e.preventDefault(); qa.prefs({ tool: "pen" }); }
      else if (k === "z") { e.preventDefault(); if (e.shiftKey) inkAct.redo(); else inkAct.undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, jump]);

  const review = (partId?: string) => {
    setReviewing(true);
    if (partId) setTimeout(() => document.getElementById(`part-${partId}`)?.scrollIntoView({ block: "center" }), 120);
  };
  if (set.finishedAt && !reviewing) return <Summary set={set} q={q} onReview={review} />;

  const nearlyFull = total > INK_TOTAL_CAP * 0.9;
  const unmarked = scoreSet(set, q.answers).unmarked.filter((p) => p.m != null).length;
  return (
    <main className="qs-page qs-sheet-page" data-testid="sheet-page">
      <div className="qs-bar" role="region" aria-label="Your set">
        <button type="button" className="qs-back" onClick={() => qa.open(null)} data-testid="back-to-picker"><BackIcon /> Questions</button>
        <div className="qs-bar-mid">
          <b className="qs-bar-title">{set.name}</b>
          <div className="qs-prog" role="progressbar" aria-valuemin={0} aria-valuemax={prog.of} aria-valuenow={prog.done} aria-label={`${prog.done} of ${prog.of} parts marked`} data-testid="progress">
            {bs.map((b) => {
              const sc = blockScore(set, b, q.answers);
              const done = b.parts.every((p) => q.answers[keyOf(set.id, p.id)]?.got !== undefined || p.m == null);
              return <button key={b.key} type="button" className={`seg${done ? " done" : ""}${b.n - 1 === cur ? " here" : ""}`} onClick={() => jump(b.n - 1)} aria-label={`Question ${b.n}${sc ? `, ${sc.got} of ${sc.total}` : ""}`} />;
            })}
          </div>
        </div>
        <span className="qs-count" aria-hidden="true">{cur + 1}/{bs.length}</span>
        <PagePopover prefs={prefs} />
        <button type="button" className="btn gold qs-finish-top" onClick={() => { qa.finish(set.id); setReviewing(false); }} data-testid="finish-top">Finish</button>
      </div>

      <div className="qs-desk">
        <span className="qs-plant" aria-hidden="true" />
        <span className="qs-mug" aria-hidden="true" />
        {nearlyFull && (
          <p className="qs-warn" role="status">Your device is nearly full of handwriting. <button type="button" className="qs-link" onClick={() => setSets(true)}>Clear old sets</button></p>
        )}
        <article className="qs-paper" aria-label={set.name}>
          {bs.map((b, i) => (
            <QuestionBlock key={b.key} set={set} block={b} answers={q.answers} prefs={prefs} inkTotal={total} first={i === 0} refCb={(el) => { refs.current[i] = el; }} />
          ))}
          <section className="qs-end">
            <Image src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={56} height={56} unoptimized />
            <div>
              <b>That is the set</b>
              {unmarked > 0 && <p>{unmarked} {unmarked === 1 ? "part" : "parts"} not marked yet.</p>}
            </div>
            <button type="button" className="btn gold" onClick={() => { qa.finish(set.id); setReviewing(false); }} data-testid="finish">Finish set</button>
          </section>
        </article>
      </div>
      {anyInk && <PenTray prefs={prefs} />}
      {sets && <SetsSheet q={q} onClose={() => setSets(false)} />}
    </main>
  );
}

function QuestionBlock({ set, block, answers, prefs, inkTotal: total, first, refCb }: {
  set: QSet; block: Block; answers: Record<string, QAnswer>; prefs: QPrefs; inkTotal: number; first: boolean; refCb(el: HTMLElement | null): void;
}) {
  const sc = blockScore(set, block, answers);
  const p0 = block.parts[0];
  const small = [set.names[p0.s] ?? p0.s, set.names[p0.p] ?? p0.p].filter(Boolean).join(" · ");
  return (
    <section className="qs-q" ref={refCb} data-n={block.n} id={`q-${block.n}`} aria-label={`Question ${block.n}`} data-testid="question-block">
      <header className="qs-qhead">
        <span className="qs-qnum" aria-hidden="true">{block.n}</span>
        <span className="qs-qmeta">{small}</span>
        <span className="grow" />
        {first && <Image className="qs-qmascot" src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={40} height={40} unoptimized />}
        <RemarkButton />
      </header>
      {block.stem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="qs-crop qs-stem" src={stemImage(block.stem, set.cv)} alt={`The start of question ${block.n}`} loading="lazy" decoding="async" />
      )}
      {block.parts.map((p) => <PartBlock key={p.id} set={set} part={p} block={block} answer={answers[keyOf(set.id, p.id)]} prefs={prefs} inkTotal={total} />)}
      <footer className="qs-qfoot">
        {sc && <span className="qs-qscore" data-testid="block-score" aria-label={`You gave yourself ${sc.got} out of ${sc.total} for question ${block.n}`}>{sc.marked > 0 ? `${sc.got}/${sc.total}` : ""}</span>}
        <span className="qs-total">{block.marks == null ? "(No marks are printed for this question)" : `(Total for Question ${block.n} is ${block.marks} ${block.marks === 1 ? "mark" : "marks"})`}</span>
      </footer>
    </section>
  );
}

function PartBlock({ set, part, block, answer, prefs, inkTotal: total }: { set: QSet; part: QPart; block: Block; answer: QAnswer | undefined; prefs: QPrefs; inkTotal: number }) {
  const label = `Question ${part.l}${part.x ? `: ${part.x}` : ""}`;
  const tone = answer?.got === undefined || !part.m ? "" : answer.got >= part.m ? "full" : answer.got > 0 ? "part" : "zero";
  return (
    <div className="qs-part" id={`part-${part.id}`} data-testid="part" data-part={part.id}>
      {part.or && block.parts.some((o) => !o.or) && <p className="qs-or">OR</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="qs-crop" src={partImage(part.id, "qp", set.cv)} width={part.w} height={part.h} style={{ aspectRatio: `${part.w} / ${part.h}` }} alt={label} loading="lazy" decoding="async" />
      <div className="qs-answer">
        <AnswerZone set={set} part={part} answer={answer} prefs={prefs} inkTotal={total} showMark />
        {answer?.got !== undefined && part.m != null && (
          <span className={`qs-margin ${tone}`} data-testid="margin-score" aria-hidden="true">{answer.got}/{part.m}</span>
        )}
      </div>
      <Check set={set} part={part} answer={answer} />
    </div>
  );
}

/** Shown as the sheet shows it, and switched off: AI marking is not built (docs/study/questions.md). */
function RemarkButton() {
  const [tip, setTip] = useState(false);
  return (
    <span className="qs-remark-wrap" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <button type="button" className="qs-remark" aria-disabled="true" aria-describedby="remark-tip" onClick={(e) => { e.preventDefault(); toast("AI marking is coming soon"); }} onFocus={() => setTip(true)} onBlur={() => setTip(false)} title="AI marking is coming soon" data-testid="remark">
        <BoltIcon /> Re-mark
      </button>
      <span id="remark-tip" role="tooltip" className={`qs-tip${tip ? " on" : ""}`}>AI marking is coming soon</span>
    </span>
  );
}
