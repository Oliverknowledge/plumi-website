"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INK_TOTAL_CAP } from "@/lib/studyapp/questions/ink";
import { partImage, stemImage } from "@/lib/studyapp/questions/cropUrls";
import {
  blockScore, blocks, cutWords, finishCheck, inkTotal, isAnswered, isMarked, keyOf, markable, nameOf, partAlt, progress,
  type Block, type QAnswer, type QPart, type QPrefs, type QSet, type QuestionsData,
} from "@/lib/studyapp/questions/model";
import { qa, useQuestions } from "@/lib/studyapp/questions/store";
import { useDocumentTitle } from "./useDocumentTitle";
import { useMatch } from "./useMatch";
import { AnswerZone } from "./AnswerZone";
import { Check } from "./Check";
import { Crop } from "./Crop";
import { BackIcon } from "./icons";
import { inkAct, setPenSeen, usePenSeen } from "./inkBus";
import { PagePopover } from "./PagePopover";
import { PenTray } from "./PenTray";
import { ReadAsText } from "./ReadAsText";
import { SetsSheet } from "./SetsSheet";
import { Summary } from "./Summary";
import "../../../app/study/(app)/questions-sheet.css";

/**
 * The practice sheet: a cream paper on a wooden desk that scrolls through the set. Each question shows its pictures
 * in order (the setup if there is one, then each part), and directly under each part its answer zone, a Check
 * button, the mark scheme it opens, and the marks the student gives themselves in the margin.
 *
 * Structure for a screen reader or a keyboard: the set's name is the page's one heading, each question a heading under it,
 * each part a labelled group; two skip links lead to the sheet and to the first part still to answer; progress is a list of
 * buttons (one per question, the current one marked), with a status line for how many parts are marked. Single-key
 * shortcuts only act while focus is on the writing space or the pen tray (or with Alt), and can be switched off in Page.
 */
export function Sheet({ set, q }: { set: QSet; q: QuestionsData }) {
  const bs = useMemo(() => blocks(set.parts), [set.parts]);
  const [reviewing, setReviewing] = useState(false);
  const [sets, setSets] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [said, setSaid] = useState("");
  const penSeen = usePenSeen();
  const { persisted } = useQuestions();
  const phone = useMatch("(max-width: 640px)");
  const prefs = q.prefs;
  const startMode = prefs.alwaysType || phone ? "type" : "ink";
  const anyInk = set.parts.some((p) => (q.answers[keyOf(set.id, p.id)]?.mode ?? startMode) === "ink");
  const total = inkTotal(q);
  const prog = progress(set, q.answers);
  const [cur, setCur] = useState(Math.min(set.at, bs.length - 1));
  const refs = useRef<(HTMLElement | null)[]>([]);
  const setRef = useCallback((i: number, el: HTMLElement | null) => { refs.current[i] = el; }, []);
  const title = useRef<HTMLHeadingElement>(null);
  const finished = !!set.finishedAt;

  // A pen seen before on this device: the page starts as a pen page. A pen seen now: remember it.
  useEffect(() => { if (prefs.penSeen) setPenSeen(true); }, [prefs.penSeen]);
  useEffect(() => { if (penSeen && !prefs.penSeen) qa.prefs({ penSeen: true }); }, [penSeen, prefs.penSeen]);

  // The tab's title says where the student is; focus goes to the heading when a set is opened or left for the sheet.
  useDocumentTitle(finished && !reviewing ? null : `${set.name} \u00b7 Plumi`);
  useEffect(() => {
    if (!(finished && !reviewing)) title.current?.focus({ preventScroll: true });
  }, [set.id, finished, reviewing]);

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

  // Return to the question that was open. Pictures and the writing spaces above it settle for a second or two after the page opens, and
  // each would move it, so it is put back in place every time its position has drifted (nothing is chased once the student has touched the page).
  useEffect(() => {
    if (set.finishedAt && !reviewing) return;
    let touched = false, aligned: number | null = null;
    const stop = () => { touched = true; };
    const evs = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    evs.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    const go = () => {
      const el = refs.current[set.at];
      if (touched || set.at <= 0 || !el) return;
      const top = el.getBoundingClientRect().top;
      if (aligned !== null && Math.abs(top - aligned) < 6) return;
      el.scrollIntoView({ block: "start" });
      aligned = el.getBoundingClientRect().top;
    };
    const ts = [60, 250, 500, 800, 1100, 1400, 1800, 2300].map((ms) => setTimeout(go, ms));
    return () => { evs.forEach((e) => window.removeEventListener(e, stop)); ts.forEach(clearTimeout); };
    // only on opening a set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id, reviewing]);

  const jump = useCallback((to: number) => {
    const n = Math.max(0, Math.min(bs.length - 1, to));
    refs.current[n]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    setSaid(`Question ${n + 1} of ${bs.length}`);
  }, [bs.length]);

  // A change of tool is said aloud (a key, the tray, anything), not only drawn.
  const tool = useRef(prefs.tool);
  useEffect(() => {
    if (tool.current === prefs.tool) return;
    tool.current = prefs.tool;
    setSaid(prefs.tool === "eraser" ? "Eraser" : "Pen");
  }, [prefs.tool]);

  // Keyboard shortcuts: N next question, B back, E eraser, P pen, Z undo, Shift Z redo. A bare letter only counts while focus is on
  // the writing space or the pen tray, so it never steals a key from a button, a link or a screen reader; Alt plus the key works
  // anywhere. All of it can be switched off in Page (WCAG 2.1.4).
  const keysOn = prefs.keys !== false;
  useEffect(() => {
    if (!keysOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector("dialog[open]")) return;
      const inInk = !!t?.closest?.(".qs-canvas, .qs-tray");
      if (!e.altKey && !inInk) return;
      const k = e.altKey ? (e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : "") : e.key.toLowerCase();
      if (k === "n") { e.preventDefault(); jump(cur + 1); }
      else if (k === "b") { e.preventDefault(); jump(cur - 1); }
      else if (k === "e") { e.preventDefault(); qa.prefs({ tool: "eraser" }); }
      else if (k === "p") { e.preventDefault(); qa.prefs({ tool: "pen" }); }
      else if (k === "z") { e.preventDefault(); if (e.shiftKey) inkAct.redo(); else inkAct.undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, jump, keysOn]);

  const review = (partId?: string) => {
    setReviewing(true);
    if (partId) setTimeout(() => document.getElementById(`part-${partId}`)?.scrollIntoView({ block: "center" }), 120);
  };
  if (finished && !reviewing) return <Summary set={set} q={q} onReview={review} />;

  const check = finishCheck(set, q.answers);
  const nearlyFull = total > INK_TOTAL_CAP * 0.9;
  const finish = () => { setConfirm(false); qa.finish(set.id); setReviewing(false); };
  const askFinish = () => { if (check.unmarked > 0) setConfirm(true); else finish(); };
  const firstOpen = set.parts.find((p) => { const a = q.answers[keyOf(set.id, p.id)]; return !isAnswered(a) && !isMarked(a); });
  const focusAt = (id: string, sel?: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: sel ? "center" : "start" });
    el.focus({ preventScroll: true });
  };

  return (
    <main className="qs-page qs-sheet-page" data-testid="sheet-page">
      <div className="qs-skips">
        <a className="qs-skip" href="#qs-sheet" onClick={(e) => { e.preventDefault(); focusAt("qs-sheet"); }}>Skip to the questions</a>
        {firstOpen && <a className="qs-skip" href={`#part-${firstOpen.id}`} onClick={(e) => { e.preventDefault(); focusAt(`part-${firstOpen.id}`, "part"); }} data-testid="skip-open">Skip to the first part to answer</a>}
      </div>
      <div className="qs-bar" role="region" aria-label="Your set">
        <button type="button" className="qs-back" onClick={() => qa.open(null)} data-testid="back-to-picker"><BackIcon /> Questions</button>
        <div className="qs-bar-mid">
          <h1 className="qs-bar-title" ref={title} tabIndex={-1}>{set.name}</h1>
          <nav className="qs-pn" aria-label="Questions" data-testid="progress">
            <ol>
              {bs.map((b) => {
                const sc = blockScore(set, b, q.answers);
                const any = b.parts.some(markable);
                const done = any && b.parts.every((p) => !markable(p) || isMarked(q.answers[keyOf(set.id, p.id)]));
                const here = b.n - 1 === cur;
                return (
                  <li key={b.key}>
                    <button
                      type="button" className={`qs-pn-b${done ? " done" : ""}${here ? " here" : ""}`} aria-current={here ? "step" : undefined} onClick={() => jump(b.n - 1)}
                      aria-label={`Question ${b.n}${!any ? "" : done && sc ? `, marked ${sc.got} of ${sc.total}` : ", not marked yet"}`}
                    ><i aria-hidden="true" /></button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
        {prog.of > 0 && <span className="qs-count" aria-hidden="true">{prog.done} of {prog.of} marked</span>}
        <PagePopover prefs={prefs} />
        <button type="button" className="btn qs-finish-top" onClick={askFinish} data-testid="finish-top">Finish</button>
      </div>
      <p className="qs-sr" role="status" data-testid="progress-status">{prog.of > 0 ? `${prog.done} of ${prog.of} parts marked` : ""}</p>
      <p className="qs-sr" role="status" aria-live="polite" data-testid="sheet-say">{said}</p>

      <div className="qs-desk">
        {nearlyFull && (
          <p className="qs-warn" role="status">Your device is nearly full of handwriting. <button type="button" className="qs-link" onClick={() => setSets(true)}>Clear old sets</button></p>
        )}
        {!persisted && (
          <p className="qs-warn" role="status" data-testid="not-saved">Your answers are not being saved on this device. Keep this tab open until you finish.</p>
        )}
        <article className="qs-paper" id="qs-sheet" tabIndex={-1} aria-label={set.name}>
          {bs.map((b, i) => (
            <QuestionBlock key={b.key} set={set} block={b} answers={q.answers} prefs={prefs} first={i === 0} setRef={setRef} index={i} />
          ))}
          <section className="qs-end" aria-label="End of the set">
            <Image src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={64} height={64} unoptimized />
            <div>
              <b>That is the set</b>
              {check.unmarked > 0 && <p>{check.unmarked} {check.unmarked === 1 ? "part" : "parts"} not marked yet.</p>}
            </div>
            <button type="button" className="btn gold" onClick={askFinish} data-testid="finish">Finish set</button>
          </section>
        </article>
      </div>
      {anyInk && <PenTray prefs={prefs} />}
      {sets && <SetsSheet q={q} onClose={() => setSets(false)} />}
      {confirm && <FinishConfirm unmarked={check.unmarked} blank={check.blank} onKeep={() => setConfirm(false)} onFinish={finish} />}
    </main>
  );
}

/** "3 parts are not marked yet. Finish anyway?" One line, two buttons; "Keep going" has focus, and Escape is "Keep going". */
function FinishConfirm({ unmarked, blank, onKeep, onFinish }: { unmarked: number; blank: number; onKeep(): void; onFinish(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const done = (fn: () => void) => { const d = ref.current; if (d?.open) d.close(); fn(); };
  const line = `${unmarked} ${unmarked === 1 ? "part is" : "parts are"} not marked yet${blank > 0 ? ` (${blank} blank)` : ""}. Finish anyway?`;
  return (
    <dialog
      ref={ref} className="qs-confirm card" aria-labelledby="qs-confirm-line" data-testid="finish-confirm"
      onCancel={(e) => { e.preventDefault(); done(onKeep); }}
      onClick={(e) => { if (e.target === ref.current) done(onKeep); }}
    >
      <p id="qs-confirm-line" className="qs-confirm-line">{line}</p>
      <div className="qs-confirm-acts">
        <button type="button" className="btn gold" autoFocus onClick={() => done(onKeep)} data-testid="finish-keep">Keep going</button>
        <button type="button" className="btn ghost" onClick={() => done(onFinish)} data-testid="finish-anyway">Finish</button>
      </div>
    </dialog>
  );
}

/** A set's identity for drawing: its updatedAt changes with every edit anywhere, and that is not a reason to redraw a part. */
const sameSet = (a: QSet, b: QSet) =>
  a.id === b.id && a.parts === b.parts && a.names === b.names && a.topics === b.topics && a.cv === b.cv && a.rq === b.rq && a.subject === b.subject;

interface QProps {
  set: QSet; block: Block; answers: Record<string, QAnswer>; prefs: QPrefs; first: boolean;
  setRef(i: number, el: HTMLElement | null): void; index: number;
}

/** Redrawn only when this question's own parts, the preferences, or the set itself change: a stroke or a keystroke in one part redraws that part alone. */
const QuestionBlock = memo(function QuestionBlock({ set, block, answers, prefs, first, setRef, index }: QProps) {
  const sc = blockScore(set, block, answers);
  const p0 = block.parts[0];
  const small = [nameOf(set.names, p0.s) ?? p0.s, nameOf(set.names, p0.p) ?? p0.p].filter(Boolean).join(" · ");
  return (
    <section className="qs-q" ref={(el) => setRef(index, el)} data-n={block.n} id={`q-${block.n}`} data-testid="question-block">
      <header className="qs-qhead">
        <h2 className="qs-qmeta"><span className="qs-sr">Question {block.n}. </span><span aria-hidden="true">Q{block.n}{small ? " \u00b7 " : ""}</span>{small}</h2>
        {first && <Image className="qs-qmascot" src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={56} height={56} unoptimized />}
      </header>
      {block.stem && (
        <Crop className="qs-stem" src={stemImage(block.stem, set.cv)} alt={`The start of question ${block.n}`} eager={block.n <= 2} guess={3.2} />
      )}
      {block.parts.map((p) => <PartBlock key={p.id} set={set} part={p} block={block} answer={answers[keyOf(set.id, p.id)]} prefs={prefs} />)}
      <footer className="qs-qfoot">
        {sc && sc.marked > 0 && (
          <span className="qs-qscore" role="img" aria-label={`You gave yourself ${sc.got} out of ${sc.total} for question ${block.n}`} data-testid="block-score">{sc.got}/{sc.total}</span>
        )}
        <span className="qs-total">{block.marks == null ? "(No marks are printed for this question)" : `(Total for Question ${block.n} is ${block.marks} ${block.marks === 1 ? "mark" : "marks"})`}</span>
      </footer>
    </section>
  );
}, (a, b) => a.index === b.index && a.first === b.first && a.block === b.block && a.prefs === b.prefs && sameSet(a.set, b.set) && a.block.parts.every((p) => {
  const k = keyOf(a.set.id, p.id);
  return a.answers[k] === b.answers[k];
}));

interface PProps { set: QSet; part: QPart; block: Block; answer: QAnswer | undefined; prefs: QPrefs }

const PartBlock = memo(function PartBlock({ set, part, block, answer, prefs }: PProps) {
  // "Always type": a part the student has not switched itself starts in Type. (Its own choice, once made, is stored and wins.)
  const typing = !!prefs.alwaysType;
  const shown = useMemo<QAnswer | undefined>(() => (typing && answer?.mode === undefined ? { ...answer, at: answer?.at ?? 0, mode: "type" } : answer), [typing, answer]);
  const tone = answer?.got === undefined || !part.m ? "" : answer.got >= part.m ? "full" : answer.got > 0 ? "part" : "zero";
  return (
    <div className="qs-part" id={`part-${part.id}`} role="group" aria-label={`Part ${part.l}`} tabIndex={-1} data-testid="part" data-part={part.id}>
      {part.or && block.parts.some((o) => !o.or) && <p className="qs-or">OR</p>}
      <Crop src={partImage(part.id, "qp", set.cv)} w={part.w} h={part.h} alt={partAlt(part)} words={part.x ? cutWords(part.x, 110).text : undefined} what="this question picture" />
      <ReadAsText set={set} part={part} />
      <div className="qs-answer">
        <AnswerZone set={set} part={part} answer={shown} prefs={prefs} showMark />
        {answer?.got !== undefined && part.m != null && (
          <span className={`qs-margin ${tone}`} data-testid="margin-score" aria-hidden="true">{answer.got}/{part.m}</span>
        )}
      </div>
      <Check set={set} part={part} answer={answer} />
      <span className="qs-sr" role="status">{answer?.got !== undefined && part.m != null ? `Part ${part.l}: ${answer.got} of ${part.m} marks` : ""}</span>
    </div>
  );
}, (a, b) => a.part === b.part && a.block === b.block && a.answer === b.answer && a.prefs === b.prefs && sameSet(a.set, b.set));
