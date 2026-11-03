"use client";

import { useEffect, useRef, useState } from "react";
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
export function Check({ set, part, answer, reportOutside }: { set: QSet; part: QPart; answer: QAnswer | undefined; /** The examiner's report has a place of its own beside the question (the feed): no button for it in the scheme card. */ reportOutside?: boolean }) {
  const [shut, setShut] = useState(false);
  const open = !!answer?.chk && !shut;
  const toggle = () => {
    if (open) { setShut(true); return; }
    setShut(false);
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
  return { report, failed, retry: () => { setFailed(false); setTries((t) => t + 1); } };
}

/** What the examiner's report says about a part: the paragraphs that name it first, then the rest of the question's under a fold. */
export function ReportBody({ part, state }: { part: QPart; state: ReturnType<typeof useReport> }) {
  const { report, failed, retry } = state;
  const split = report ? splitReport(report, part.l) : null;
  if (failed) return <p className="qs-scheme-note">Could not open the report. <button type="button" className="qs-link" onClick={retry}>Try again</button></p>;
  if (report === null) return <p className="qs-scheme-note">Opening...</p>;
  if (!report) return <p className="qs-scheme-note">No report for this question.</p>;
  return (
    <div className="qs-er-text">
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
            <Crop src={partImage(part.id, "ms", set.cv)} alt={`Mark scheme for ${label}`} what="the mark scheme" pdf={pdf} zoom={reportOutside} onState={(s) => setPic(s)} />
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
          <ReportBody part={part} state={reportState} />
        </div>
      )}
    </div>
  );
}

/** One tap per mark. Tap the circle for the marks you earned; 0 if none. A part with no printed marks has nothing to tick. */
export function MarkYourself({ set, part, got }: { set: QSet; part: QPart; got: number | undefined }) {
  if (!markable(part)) return <p className="qs-scheme-note">This part prints no marks, so there is nothing to tick.</p>;
  return <Marking set={set} part={part} got={got} />;
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
        <div className="qs-step" role="group" aria-labelledby={`self-${part.id}`}>
          <button type="button" className="qs-mini" onClick={() => choose(Math.max(0, (got ?? 0) - 1))} aria-label="One mark fewer">-</button>
          <b aria-live="polite">{got ?? 0} / {m}</b>
          <button type="button" className="qs-mini" onClick={() => choose(Math.min(m, (got ?? 0) + 1))} aria-label="One mark more">+</button>
        </div>
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
