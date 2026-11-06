"use client";

import { useId, useMemo, useState } from "react";
import { ProGate, useProLock } from "@/components/pro/ProGate";
import { ProTag } from "@/components/pro/ProTag";
import { exampleId, phraseText, type Angles } from "@/lib/studyapp/questions/angles";
import { partImage } from "@/lib/studyapp/questions/cropUrls";
import { formExams, marksText, type FormRow, type Insights } from "@/lib/studyapp/questions/insights";
import { FORM_NAMES, type Form } from "@/lib/studyapp/questions/questionForm";
import type { BankRow } from "@/lib/studyapp/questions/picker";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";
import { Crop } from "./Crop";
import { RetryIcon } from "./icons";
import { ChevronIcon } from "./pickerIcons";
import { useAngles } from "./useAngles";

const n = (x: number) => x.toLocaleString("en-GB");

/** The button beside a form's bar that opens its Angles: for a Pro student a toggle, for anyone else the lock (Pro tag, and the shared panel on a tap). */
export function AnglesButton({ open, onToggle, controls, form }: { open: boolean; onToggle(): void; controls: string; form: string }) {
  const lock = useProLock("angles");
  return (
    <ProGate
      feature="angles"
      pending={<span className="qa-angbtn is-pending" aria-hidden="true" />}
      fallback={
        <>
          <button type="button" className="qa-angbtn is-locked" onClick={lock.tap} aria-label={`Angles for ${form}, part of Plumi Pro`} data-testid="angles-locked">Angles<ProTag className="sm" /></button>
          {lock.panel}
        </>
      }
    >
      <button type="button" className={`qa-angbtn${open ? " on" : ""}`} aria-expanded={open} aria-controls={controls} onClick={onToggle} aria-label={`Angles for ${form}`} data-testid="angles-toggle">Angles<ChevronIcon /></button>
    </ProGate>
  );
}

/**
 * One form's Angles, drawn from the real papers in the bank: a one-line fact, how the board words it (its most common opening phrases, each backed by at least two real questions),
 * and a few real examples that open to the board's own question and mark scheme pictures. Nothing here is written or reworded by Plumi: the phrases are the papers' words and the
 * mark scheme is the board's picture. Pro only (the screen decides; the data is built from the public bank, see docs/study/pro.md).
 */
export function AnglesPanel({ id, meta, ins, code, row, rows, onPractise }: {
  id: string; meta: SubjectMeta; ins: Insights; code: string; row: FormRow; rows: ReadonlyMap<string, BankRow>; onPractise(topic: string, form: Form | null): void;
}) {
  const angles = useAngles(meta.slug, true);
  const exams = formExams(ins, code, row.form);
  const noun = row.parts === 1 ? "question" : "questions";
  return (
    <div className="qa-ang" id={id} role="region" aria-label={`Angles: ${FORM_NAMES[row.form]}`} data-testid="angles-panel">
      <p className="qa-fact" data-testid="angles-fact">
        <b>{FORM_NAMES[row.form]}</b>: {n(row.parts)} {noun}, usually {marksText(row.avg)} {row.avg === 1 ? "mark" : "marks"}, in {exams.inn} of {exams.open} {exams.open === 1 ? "exam" : "exams"} in Plumi
      </p>
      {angles.state === "failed" ? (
        <p className="qa-angfail" role="status">It did not load. <button type="button" className="qs-mini" onClick={angles.retry}><RetryIcon />Try again</button></p>
      ) : angles.state !== "ready" ? (
        <div className="qa-ghost qa-angghost" role="status" aria-label="Loading Angles" aria-live="polite"><i /><i /></div>
      ) : (
        <Body angles={angles.data} meta={meta} code={code} row={row} rows={rows} />
      )}
      <button type="button" className="btn qa-angpractise" onClick={() => onPractise(code, row.form)} data-testid="angles-practise">Practise these {n(row.parts)}</button>
    </div>
  );
}

function Body({ angles, meta, code, row, rows }: { angles: Angles; meta: SubjectMeta; code: string; row: FormRow; rows: ReadonlyMap<string, BankRow> }) {
  const a = angles.topics[code]?.[row.form];
  const phrases = a?.p ?? [];
  const top = Math.max(1, ...phrases.map(([, c]) => c));
  const examples = useMemo(() => (a?.e ?? []).flatMap((e) => { const pid = exampleId(angles, e); const r = pid ? rows.get(pid) : undefined; return r ? [r] : []; }), [a, angles, rows]);
  const labels = useMemo(() => new Map(meta.series.map((s) => [s.id, s.label])), [meta.series]);
  return (
    <>
      {phrases.length > 0 && (
        <section aria-label="How the board words it">
          <h4 className="qa-angh">How the board words it</h4>
          <ul className="qa-phr" data-testid="angles-phrases">
            {phrases.map(([p, c]) => (
              <li key={p}>
                <span className="qa-phrase">{phraseText(p)} <i aria-hidden="true">{"…"}</i></span>
                <span className="qa-barwrap" aria-hidden="true"><span className="qa-bar" style={{ width: `${Math.max(8, Math.round((c / top) * 100))}%` }} /></span>
                <span className="qa-fn"><span className="qs-sr">{c} questions, </span><span aria-hidden="true">{"×"}{c}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {examples.length > 0 && (
        <section aria-label="See how it was asked and marked">
          <h4 className="qa-angh">See how it was asked and marked</h4>
          <ul className="qa-exs" data-testid="angles-examples">
            {examples.map((r) => <Example key={r.id} meta={meta} row={r} label={labels.get(r.s) ?? r.s} />)}
          </ul>
        </section>
      )}
      {!phrases.length && !examples.length && <p className="qa-angnone">Too few of these to show a pattern.</p>}
    </>
  );
}

function Example({ meta, row, label }: { meta: SubjectMeta; row: BankRow; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const marks = row.m == null ? "" : ` · ${row.m} ${row.m === 1 ? "mark" : "marks"}`;
  return (
    <li className="qa-ex">
      <button
        type="button" className="qa-exrow" aria-expanded={open} aria-controls={id} data-testid="angles-example"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Q{row.l} {"·"} {label}{marks}</span><ChevronIcon />
      </button>
      {open && (
        <div className="qa-pair" id={id} data-testid="angles-pair">
          <figure>
            <figcaption>The question</figcaption>
            <Crop src={partImage(row.id, "qp", meta.cv)} alt={`The question ${row.l}, ${label}`} w={row.w} h={row.h} what="the question" zoom eager />
          </figure>
          <figure>
            <figcaption>The board&apos;s mark scheme</figcaption>
            <Crop src={partImage(row.id, "ms", meta.cv)} alt={`The mark scheme for question ${row.l}, ${label}`} what="the mark scheme" zoom eager />
          </figure>
        </div>
      )}
    </li>
  );
}
