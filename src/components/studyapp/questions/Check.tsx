"use client";

import { useEffect, useState } from "react";
import { bankFile, papersBase, partImage, reportKey } from "@/lib/studyapp/questions/cropUrls";
import { markable, questionOf, type QAnswer, type QPart, type QSet } from "@/lib/studyapp/questions/model";
import { splitReport } from "@/lib/studyapp/questions/report";
import { qa } from "@/lib/studyapp/questions/store";
import { CheckIcon } from "./icons";

/** Examiner's reports for a subject, fetched once the first time anyone opens one. */
const reports: Record<string, Promise<Record<string, string>>> = {};
const reportsFor = (slug: string) => (reports[slug] ??= fetch(bankFile(slug, "reports")).then((r) => r.json()).catch(() => ({})));

/** The "Check" button under a part, the mark scheme it opens, and "Mark yourself". Nothing is ever marked for the student. */
export function Check({ set, part, answer }: { set: QSet; part: QPart; answer: QAnswer | undefined }) {
  const [shut, setShut] = useState(false);
  const open = !!answer?.chk && !shut;
  const toggle = () => {
    if (open) { setShut(true); return; }
    setShut(false);
    qa.check(set.id, part.id);
  };
  return (
    <div className="qs-check">
      <div className="qs-check-bar">
        <button type="button" className={`btn${open ? "" : " gold"} qs-check-btn`} aria-expanded={open} onClick={toggle} data-testid="check">
          {open ? "Hide the scheme" : "Check"}
        </button>
      </div>
      {open && <Scheme set={set} part={part} answer={answer} />}
    </div>
  );
}

function Scheme({ set, part, answer }: { set: QSet; part: QPart; answer: QAnswer | undefined }) {
  const [er, setEr] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  useEffect(() => {
    if (!er || report !== null) return;
    let live = true;
    void reportsFor(set.subject).then((r) => { if (live) setReport(r[reportKey(!!set.rq, part.id)] ?? ""); });
    return () => { live = false; };
  }, [er, report, set.subject, set.rq, part.id]);
  const label = `${set.names[part.s] ?? part.s} ${set.names[part.p.toUpperCase()] ?? set.names[part.p] ?? part.p}, question ${part.l}`;
  const split = report ? splitReport(report, part.l) : null;
  return (
    <div className="qs-scheme" data-testid="scheme">
      <span className="qs-tape" aria-hidden="true" />
      <p className="qs-scheme-label">Mark scheme</p>
      {part.ms ? (
        <>
          {part.msq && <p className="qs-scheme-note">This is the whole question&apos;s scheme. Look for {part.l}.</p>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qs-crop" src={partImage(part.id, "ms", set.cv)} alt={`Mark scheme for ${label}`} loading="lazy" decoding="async" />
        </>
      ) : part.k ? (
        <p className="qs-key">Answer <b>{part.k}</b></p>
      ) : part.msf ? (
        <p className="qs-scheme-note"><a href={`${papersBase}/${part.msf}`} target="_blank" rel="noopener">Open the mark scheme (PDF)</a></p>
      ) : (
        <p className="qs-scheme-note">No mark scheme is published for this part.</p>
      )}
      <MarkYourself set={set} part={part} got={answer?.got} />
      {part.er && (
        <div className="qs-er">
          <button type="button" className="qs-mini" aria-expanded={er} onClick={() => setEr((v) => !v)}>Examiner&apos;s report</button>
          {er && (report === null ? <p className="qs-scheme-note">Opening...</p> : !report ? <p className="qs-scheme-note">No report for this question.</p> : (
            <div className="qs-er-text">
              {split && split.mine.length > 0 && <><p className="qs-scheme-label">On {part.l}</p>{split.mine.map((p, i) => <p key={i}>{p}</p>)}</>}
              {split && split.rest.length > 0 && (
                <details open={split.mine.length === 0}>
                  <summary className="qs-scheme-label">{split.mine.length ? `The rest of question ${questionOf(part.l)}` : `On question ${questionOf(part.l)}`}</summary>
                  {split.rest.map((p, i) => <p key={i}>{p}</p>)}
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** One tap per mark. Tap the circle for the marks you earned; 0 if none. A part with no printed marks has nothing to tick. */
export function MarkYourself({ set, part, got }: { set: QSet; part: QPart; got: number | undefined }) {
  if (!markable(part)) return <p className="qs-scheme-note">This part prints no marks, so there is nothing to tick.</p>;
  const m = part.m ?? 0;
  const many = m > 12;
  const choose = (n: number) => qa.mark(set.id, part.id, n);
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
          <button type="button" role="radio" aria-checked={got === 0} className={`qs-zero${got === 0 ? " on" : ""}`} onClick={() => choose(0)} aria-label="0 marks">0</button>
          {Array.from({ length: m }, (_, i) => {
            const n = i + 1;
            const on = got !== undefined && n <= got;
            return (
              <button key={n} type="button" role="radio" aria-checked={got === n} className={`qs-tick${on ? " on" : ""}`} onClick={() => choose(n)} aria-label={`${n} ${n === 1 ? "mark" : "marks"}`} data-testid={`tick-${n}`}>
                {on && <CheckIcon />}
              </button>
            );
          })}
          <span className="qs-of">{got === undefined ? `out of ${m}` : `${got} out of ${m}`}</span>
        </div>
      )}
    </div>
  );
}
