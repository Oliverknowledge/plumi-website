"use client";

import { lostLayout } from "@/lib/studyapp/questions/approx";
import { useCallback, useEffect, useRef, useState } from "react";
import { bankFile, papersBase, partImage, reportKey } from "@/lib/studyapp/questions/cropUrls";
import { hasInk, hasText, markable, nameOf, questionOf, type QAnswer, type QPart, type QSet } from "@/lib/studyapp/questions/model";
import { splitReport } from "@/lib/studyapp/questions/report";
import { qa } from "@/lib/studyapp/questions/store";
import { Crop } from "./Crop";
import { CheckIcon, ReportIcon } from "./icons";
import { MarkKey } from "./MarkKey";
import { SchemeText } from "./ReadAsText";
import { ChevronIcon } from "./pickerIcons";

/** Examiner's reports for a subject, fetched the first time anyone opens one. A failure is not remembered, so trying again works. */
const reports = new Map<string, Promise<Record<string, string>>>();
function reportsFor(slug: string): Promise<Record<string, string>> {
  let p = reports.get(slug);
  if (!p) {
    // 15 s to arrive, and one quiet second go: a stalled request is a failure the student can retry, never "Opening..." for good.
    const once = () => {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 15_000);
      return fetch(bankFile(slug, "reports"), { signal: c.signal }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Record<string, string>>; }).finally(() => clearTimeout(t));
    };
    p = once().catch(() => new Promise<void>((go) => setTimeout(go, 1200)).then(once));
    reports.set(slug, p);
    p.catch(() => reports.delete(slug));
  }
  return p;
}

/**
 * "Mark scheme": the pull-up of the mark scheme under a part (the picture of the scheme, or the answer letter of a multiple-choice
 * part, or the PDF where no crop exists), with "Mark yourself" under it. Nothing is ever marked for the student: the button is
 * named for what it shows, so it never reads as "Plumi will check my answer". It is quiet until something is written, and
 * it is never gold (the sheet's one gold button is Finish set).
 */
/** Mark schemes the student has closed (kept while the page lives, so a card that is drawn again after scrolling away does not reopen what was shut). */
const shutSchemes = new Set<string>();

export function Check({ set, part, answer, reportOutside }: { set: QSet; part: QPart; answer: QAnswer | undefined; /** The examiner's report has a place of its own beside the question (the feed): no button for it in the scheme card. */ reportOutside?: boolean }) {
  const [, redraw] = useState(0);
  const mark = `${set.id}/${part.id}`;
  const open = !!answer?.chk && !shutSchemes.has(mark);
  const toggle = () => {
    if (open) { shutSchemes.add(mark); redraw((n) => n + 1); return; }
    shutSchemes.delete(mark);
    redraw((n) => n + 1);
    qa.check(set.id, part.id);
  };
  const id = `scheme-${part.id}`;
  const ready = hasInk(answer) || hasText(answer);
  return (
    <div className="qs-check">
      <div className="qs-check-bar">
        <button type="button" className={`qs-schemebtn${ready || open ? " is-ready" : ""}${open ? " is-open" : ""}`} aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle} data-testid="check">
          Mark scheme<ChevronIcon />
        </button>
      </div>
      {open && <Scheme id={id} set={set} part={part} answer={answer} reportOutside={reportOutside} />}
    </div>
  );
}

/**
 * The examiner's report for a part, fetched once it is wanted (`wanted`): `report` is null until it arrives, "" when there is none for this question,
 * `failed` when it would not load (and `retry` tries again).
 */
export function useReport(set: Pick<QSet, "subject" | "rq">, part: QPart, wanted: boolean) {
  const [report, setReport] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!wanted || report !== null) return;
    let live = true;
    reportsFor(set.subject)
      .then((r) => { if (live) { setFailed(false); setReport(r[reportKey(!!set.rq, part.id)] ?? ""); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [wanted, report, tries, set.subject, set.rq, part.id]);
  return { report, failed, retry: () => { reports.delete(set.subject); setFailed(false); setTries((t) => t + 1); } };
}

/** "Opening...", and after about 8 seconds a way to try again (a request that has stalled must not leave the student waiting for good). */
function Opening({ retry }: { retry(): void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  return <p className="qs-scheme-note">Opening...{slow && <> <button type="button" className="qs-link" onClick={retry}>Try again</button></>}</p>;
}

/** What the examiner's report says about a part: the paragraphs that name it first, then the rest of the question's under a fold. */
export function ReportBody({ part, state, subject }: { part: QPart; state: ReturnType<typeof useReport>; subject: string }) {
  const { report, failed, retry } = state;
  const split = report ? splitReport(report, part.l) : null;
  if (failed) return <p className="qs-scheme-note">Could not open the report. <button type="button" className="qs-link" onClick={retry}>Try again</button></p>;
  if (report === null) return <Opening retry={retry} />;
  if (!report) return <p className="qs-scheme-note">No report for this question.</p>;
  return (
    <div className="qs-er-text">
      {lostLayout(subject, report) && <p className="qs-scheme-note qs-approx" data-testid="report-approx">Fractions and powers in this report can lose their layout here, so a pair of numbers may be a fraction. The paper itself has it exactly.</p>}
      {split && split.mine.length > 0 && <><p className="qs-scheme-label">On {part.l}</p>{split.mine.map((p, i) => <p key={i}>{p}</p>)}</>}
      {split && split.rest.length > 0 && (
        <details open={split.mine.length === 0}>
          <summary className="qs-scheme-label">{split.mine.length ? `The rest of question ${questionOf(part.l)}` : `On question ${questionOf(part.l)}`}</summary>
          {split.rest.map((p, i) => <p key={i}>{p}</p>)}
        </details>
      )}
    </div>
  );
}

function Scheme({ id, set, part, answer, reportOutside }: { id: string; set: QSet; part: QPart; answer: QAnswer | undefined; reportOutside?: boolean }) {
  const [er, setEr] = useState(false);
  const reportState = useReport(set, part, er);
  const [pic, setPic] = useState<"wait" | "ok" | "fail">("wait");
  const [onPaper, setOnPaper] = useState(false);
  // Opened under a question that is near the foot of the screen: it comes into view, not out of sight below.
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => { card.current?.scrollIntoView({ block: "nearest" }); }, []);
  const label = `${nameOf(set.names, part.s) ?? part.s} ${nameOf(set.names, part.p.toUpperCase()) ?? nameOf(set.names, part.p) ?? part.p}, question ${part.l}`;
  const pdf = part.msf ? `${papersBase}/${part.msf}` : undefined;
  // A mark scheme that would not load: marking waits until the student has it some other way, so nobody marks blind by accident.
  const blind = !!part.ms && pic === "fail" && !onPaper;
  return (
    <div className="qs-scheme" id={id} data-testid="scheme" ref={card}>
      <span className="qs-tape" aria-hidden="true" />
      {part.er && !reportOutside && (
        <button type="button" className={`qs-er-btn${er ? " on" : ""}`} aria-expanded={er} aria-controls={er ? `${id}-er` : undefined} aria-label="Examiner's report" title="Examiner's report" onClick={() => setEr((v) => !v)}><ReportIcon /></button>
      )}
      {blind && (
        <button type="button" className="qs-mini" onClick={() => setOnPaper(true)}>I have the mark scheme</button>
      )}
      <div className="qs-schemetable">
        {part.ms ? (
          <>
            <p className="qs-scheme-label">What the examiner wants</p>
            {part.msq && <p className="qs-scheme-note">This is the whole question&apos;s scheme. Look for {part.l}.</p>}
            <CappedScheme open={wholeScheme(set.subject)}><Crop src={partImage(part.id, "ms", set.cv)} alt={`Mark scheme for ${label}`} what="the mark scheme" pdf={pdf} zoom={reportOutside} onState={(s) => setPic(s)} /></CappedScheme>
            <SchemeText set={set} part={part} />
          </>
        ) : part.k ? (
          <p className="qs-key">Answer <b>{part.k}</b></p>
        ) : pdf ? (
          <p className="qs-scheme-note"><a href={pdf} target="_blank" rel="noopener noreferrer">Open the mark scheme (PDF)</a></p>
        ) : (
          <p className="qs-scheme-note">No mark scheme is published for this part.</p>
        )}
      </div>
      {!blind && (
        <div className="qs-selfblock">
          <MarkYourself set={set} part={part} got={answer?.got} />
          <MarkKey set={set} part={part} />
        </div>
      )}
      {part.er && er && !reportOutside && (
        <div className="qs-er" id={`${id}-er`}>
          <ReportBody part={part} state={reportState} subject={set.subject} />
        </div>
      )}
    </div>
  );
}

/**
 * A mark scheme's picture is cut from the paper with a margin the data does not trim (a one-row table can arrive with 300 px of blank under it, ending with a rule and the next
 * question's heading). It is shown to a fixed height with a soft fade and "Show the rest" (nothing is hidden for good); a short scheme shows whole, with no button.
 */
/** English Language and Literature schemes are cut from the paper starting at the question and run long (levels, indicative content): they open whole, not behind a fold. (The bank has no crop heights to trim them by.) */
const wholeScheme = (slug: string) => /(^|-)english-(language|literature)(-|$)/.test(slug);

function CappedScheme({ children, open = false }: { children: React.ReactNode; open?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const [all, setAll] = useState(open);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // (the same height the stylesheet gives a cut picture: min(46vh, 360px))
    const look = () => setMore(el.scrollHeight > Math.min(window.innerHeight * 0.46, 360) + 24);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(look) : null;
    ro?.observe(el.firstElementChild ?? el);
    look();
    return () => ro?.disconnect();
  }, []);
  return (
    <div className="qs-capped">
      <div ref={box} className={`qs-capped-box${all ? " is-all" : more ? " is-cut" : ""}`}>{children}</div>
      {more && <button type="button" className="qs-link qs-capped-btn" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? "Show less" : "Show the rest of the picture"}</button>}
    </div>
  );
}

/** One tap per mark. Tap the circle for the marks you earned; 0 if none. A part with no printed marks has nothing to tick. */
export function MarkYourself({ set, part, got }: { set: QSet; part: QPart; got: number | undefined }) {
  if (!markable(part)) return <p className="qs-scheme-note">This part prints no marks, so there is nothing to tick.</p>;
  return <Marking set={set} part={part} got={got} />;
}

/**
 * Marks for a long question (more than 12): a tap per mark is a chore, so + and - repeat while they are held, +5 and -5 step in fives, and the number is a field a student can
 * type into (Enter or leaving it sets it, clamped to 0 to the total, Escape puts it back). Every control has a name, and the value is read out as it changes.
 */
/** A button that acts at once, repeats while it is held (after a short wait), and acts once for a key. */
function RepeatButton({ onStep, label, children }: { onStep(): void; label: string; children: React.ReactNode }) {
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rep = useRef<ReturnType<typeof setInterval> | null>(null);
  const act = useRef(onStep);
  useEffect(() => { act.current = onStep; });
  const stop = useCallback(() => { if (wait.current) clearTimeout(wait.current); if (rep.current) clearInterval(rep.current); wait.current = null; rep.current = null; }, []);
  useEffect(() => stop, [stop]);
  return (
    <button
      type="button" className="qs-mini" aria-label={label}
      onPointerDown={(e) => {
        if (e.button > 0) return;
        stop();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not an active pointer */ }
        act.current();
        wait.current = setTimeout(() => { rep.current = setInterval(() => act.current(), 90); }, 420);
      }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => { if (e.detail === 0) act.current(); }}
    >{children}</button>
  );
}

function Stepper({ id, m, got, choose }: { id: string; m: number; got: number | undefined; choose(n: number): void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const cur = useRef(got ?? 0);
  useEffect(() => { cur.current = got ?? 0; }, [got]);
  const step = useCallback((d: number) => { const n = Math.max(0, Math.min(m, cur.current + d)); if (n !== cur.current) { cur.current = n; choose(n); } }, [m, choose]);
  const commit = () => {
    setEditing(false);
    const n = parseInt(draft.replace(/\D/g, ""), 10);
    if (Number.isFinite(n)) { const c = Math.max(0, Math.min(m, n)); cur.current = c; choose(c); }
  };
  return (
    <div className="qs-step" role="group" aria-labelledby={`self-${id}`}>
      <button type="button" className="qs-mini qs-step5" onClick={() => step(-5)} aria-label="Five marks fewer">-5</button>
      <RepeatButton onStep={() => step(-1)} label="One mark fewer">-</RepeatButton>
      {editing ? (
        <input
          className="qs-step-in" inputMode="numeric" autoFocus value={draft} aria-label={`Marks out of ${m}`} onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditing(false); } }}
        />
      ) : (
        <button type="button" className="qs-step-n" onClick={() => { setDraft(String(got ?? 0)); setEditing(true); }} aria-label={`${got ?? 0} out of ${m} marks. Type a number`} data-testid="step-n"><b>{got ?? 0}</b> / {m}</button>
      )}
      <RepeatButton onStep={() => step(1)} label="One mark more">+</RepeatButton>
      <button type="button" className="qs-mini qs-step5" onClick={() => step(5)} aria-label="Five marks more">+5</button>
      <span className="qs-sr" role="status" aria-live="polite">{got ?? 0} out of {m}</span>
    </div>
  );
}

function Marking({ set, part, got }: { set: QSet; part: QPart; got: number | undefined }) {
  const m = part.m ?? 0;
  const many = m > 12;
  const choose = (n: number) => qa.mark(set.id, part.id, n);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  // Radios: one stop in the Tab order (the one chosen, or the first), the arrow keys move and choose, Home and End go to the ends.
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? Math.min(m, i + 1) : e.key === "ArrowLeft" || e.key === "ArrowUp" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : e.key === "End" ? m : -1;
    if (to < 0) return;
    e.preventDefault();
    choose(to);
    radios.current[to]?.focus();
  };
  const stop = got ?? 0;
  return (
    <div className="qs-self">
      <p className="qs-self-label" id={`self-${part.id}`}>Mark yourself</p>
      {many ? (
        <Stepper id={part.id} m={m} got={got} choose={choose} />
      ) : (
        <div className="qs-ticks" role="radiogroup" aria-labelledby={`self-${part.id}`}>
          <button ref={(el) => { radios.current[0] = el; }} type="button" role="radio" aria-checked={got === 0} tabIndex={stop === 0 ? 0 : -1} className={`qs-zero${got === 0 ? " on" : ""}`} onClick={() => choose(0)} onKeyDown={(e) => onKey(e, 0)} aria-label="0 marks">0</button>
          {Array.from({ length: m }, (_, i) => {
            const n = i + 1;
            const on = got !== undefined && n <= got;
            return (
              <button
                key={n} ref={(el) => { radios.current[n] = el; }} type="button" role="radio" aria-checked={got === n} tabIndex={stop === n ? 0 : -1}
                className={`qs-tick${on ? " on" : ""}`} onClick={() => choose(n)} onKeyDown={(e) => onKey(e, n)} aria-label={`${n} ${n === 1 ? "mark" : "marks"}`} data-testid={`tick-${n}`}
              >
                {on ? <CheckIcon /> : <span className="qs-num" aria-hidden="true">{n}</span>}
              </button>
            );
          })}
          <span className="qs-of" aria-hidden="true">{got === undefined ? `out of ${m}` : `${got} out of ${m}`}</span>
        </div>
      )}
    </div>
  );
}
