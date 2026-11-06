"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { columnMax, examsText, formMix, marksText, seriesYear, sortedTopics, stripMax, topicStat, TOPIC_ORDERS, type FormRow, type Insights, type StripCell, type TopicOrder, type TopicStat } from "@/lib/studyapp/questions/insights";
import { FORM_NAMES, type Form } from "@/lib/studyapp/questions/questionForm";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";
import type { InsightsState } from "./useInsights";
import { Radios } from "./FeedBar";
import { AnglesButton, AnglesPanel } from "./AnglesPanel";
import { hasAngles } from "@/lib/studyapp/questions/anglesLoad";
import type { BankRow } from "@/lib/studyapp/questions/picker";
import { topicName } from "./FiltersDialog";
import { BackIcon, CloseIcon, RetryIcon } from "./icons";

const n = (x: number) => x.toLocaleString("en-GB");
const MONTHS: Record<string, string> = { JAN: "Jan", FEB: "Feb", MAR: "Mar", APR: "Apr", MAY: "May", JUN: "Jun", JUL: "Jul", NOV: "Nov", DEC: "Dec" };
/** "JUN25" as it reads: "Jun 2025". */
const seriesName = (id: string, labels: ReadonlyMap<string, string>): string => labels.get(id) ?? `${MONTHS[id.slice(0, 3)] ?? id.slice(0, 3)} 20${seriesYear(id)}`;

/**
 * Topic analysis: for each topic of the subject, how many questions the papers in Plumi have of it, in which exams, and in what form they ask it (recall, explain, calculate...).
 * A sheet over the feed (a native modal dialog: focus stays inside, Escape closes it, and focus goes back to the button that opened it), drawn rather than written: a list of topics
 * with a bar and a row of dots (one per exam), and a page for each topic with the form mix and the exams. Every number is a count of the papers Plumi holds, and the sheet says so.
 * "Practise" hands the topic (and, from a bar, the form) to the feed, which opens filtered to it; the number on the button is the number the feed will show.
 */
export function TopicAnalysis({ meta, rows, insights, onClose, onPractise }: {
  meta: SubjectMeta;
  /** The subject's parts, for the examples in Angles (their labels, marks and pictures). */
  rows: readonly BankRow[];
  insights: InsightsState;
  onClose(): void;
  /** Close the sheet and show the feed filtered to the topic (and the form, if there is one). */
  onPractise(topic: string, form: Form | null): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [topic, setTopic] = useState<string | null>(null);
  const [order, setOrder] = useState<TopicOrder>("most");
  const scroller = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const data = insights.state === "ready" ? insights.data : null;
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    track("topic_analysis_opened", { subject: meta.slug });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the sheet opens
  }, []);
  const close = () => { const d = ref.current; if (d?.open) d.close(); else onClose(); };
  const names = useMemo(() => new Map(meta.topics.map((t) => [t.code, t])), [meta.topics]);
  const codes = useMemo(() => meta.topics.map((t) => t.code), [meta.topics]);
  const labels = useMemo(() => new Map(meta.series.map((s) => [s.id, s.label])), [meta.series]);
  const t = topic && names.get(topic) ? names.get(topic)! : null;
  const open = (code: string) => {
    setTopic(code);
    track("topic_analysis_topic_viewed", { subject: meta.slug, topic: code });
    scroller.current?.scrollTo({ top: 0 });
  };
  const back = () => { setTopic(null); requestAnimationFrame(() => opener.current?.focus({ preventScroll: true })); };
  const practise = (code: string, form: Form | null) => {
    track("topic_analysis_practise_clicked", { subject: meta.slug, topic: code, form: form ?? "all" });
    const d = ref.current;
    if (d?.open) d.close();
    onPractise(code, form);
  };
  const stat = data && topic ? topicStat(data, topic) : null;
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  return (
    <dialog
      ref={ref} className="qs-dialog qa-dlg card" aria-labelledby={titleId} onClose={(e) => { if (e.target === ref.current) onClose(); }}
      onClick={(e) => { if (e.target === ref.current) close(); }} data-testid="topic-analysis"
    >
      <div className="qs-dialog-head qa-head">
        {t && stat ? <button type="button" className="qa-back" onClick={back} data-testid="analysis-back"><BackIcon />All topics</button> : <span />}
        <button type="button" className="btn ghost icon" aria-label="Close" onClick={close} data-testid="analysis-close"><CloseIcon /></button>
      </div>
      <div className="qa-scroll" ref={scroller}>
        {insights.state === "failed" ? (
          <div className="qa-fail" role="status">
            <h2 id={titleId}>Topic analysis</h2>
            <p>It did not load. Check your connection.</p>
            <button type="button" className="btn gold" onClick={insights.retry}><RetryIcon />Try again</button>
          </div>
        ) : !data ? (
          <div role="status" aria-label="Loading the topic analysis">
            <h2 id={titleId}>Topic analysis</h2>
            <div className="qa-ghost" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>
          </div>
        ) : t && stat ? (
          <TopicPage meta={meta} rows={byId} data={data} stat={stat} name={topicName(t)} titleId={titleId} labels={labels} onPractise={practise} />
        ) : (
          <TopicList meta={meta} data={data} codes={codes} order={order} onOrder={setOrder} titleId={titleId} onOpen={open} openRef={opener} last={topic} />
        )}
      </div>
    </dialog>
  );
}

/**
 * One small column per exam, oldest first, as tall as the number of questions the topic has in that exam (all rows on one scale, so a tall column is a heavy exam in any row).
 * A dashed stub is an exam whose papers in Plumi have none of the topic; a hatched stub is an exam with no paper of the topic's year in Plumi.
 */
function Columns({ strip, labels, max }: { strip: StripCell[]; labels: ReadonlyMap<string, string>; max: number }) {
  return (
    <span className="qa-cols" style={{ "--n": strip.length } as React.CSSProperties} aria-hidden="true">
      {strip.map((c) => <i key={c.id} className={`qa-c is-${c.state}`} style={c.state === "in" ? { height: `${Math.max(12, Math.round((c.n / max) * 100))}%` } : undefined} title={`${seriesName(c.id, labels)}: ${c.state === "in" ? `${c.n} ${c.n === 1 ? "question" : "questions"}` : c.state === "gap" ? "not in the papers in Plumi" : "no paper in Plumi"}`} />)}
    </span>
  );
}

function TopicList({ meta, data, codes, order, onOrder, titleId, onOpen, openRef, last }: {
  meta: SubjectMeta; data: Insights; codes: string[]; order: TopicOrder; onOrder(o: TopicOrder): void; titleId: string; onOpen(code: string): void;
  openRef: React.RefObject<HTMLButtonElement | null>; last: string | null;
}) {
  const rows = useMemo(() => sortedTopics(data, order, codes), [data, order, codes]);
  const labels = useMemo(() => new Map(meta.series.map((s) => [s.id, s.label])), [meta.series]);
  const names = useMemo(() => new Map(meta.topics.map((t) => [t.code, t])), [meta.topics]);
  const max = Math.max(1, ...rows.map((r) => r.parts));
  const colMax = useMemo(() => columnMax(rows), [rows]);
  const exams = data.series.length;
  return (
    <>
      <h2 id={titleId} className="qa-title">Topic analysis</h2>
      <p className="qa-sub" data-testid="analysis-sub">In the {exams} exams in Plumi, {n(data.parts)} questions</p>
      <Radios
        className="qf-seg qa-sort" label="Order the topics" value={order} onPick={(v) => onOrder(v as TopicOrder)} testid="analysis-order"
        options={TOPIC_ORDERS.map((o) => [o.id, o.label] as [string, string])}
      />
      <div className="qa-axis" aria-hidden="true"><span>Questions in each exam</span><span className="qa-cols" style={{ "--n": exams } as React.CSSProperties}>{data.series.map((s) => <b key={s}>{seriesYear(s)}</b>)}</span></div>
      <ul className="qa-list" data-testid="analysis-list">
        {rows.map((r) => {
          const t = names.get(r.code)!;
          return (
            <li key={r.code}>
              <button type="button" className="qa-row" ref={r.code === last ? openRef : undefined} onClick={() => onOpen(r.code)} data-testid="analysis-topic" data-code={r.code}
                aria-label={`${r.code} ${topicName(t)}: ${n(r.parts)} questions, in ${examsText(r)}`}>
                <span className="qa-code">{r.code}</span>
                <span className="qa-name">{topicName(t)}</span>
                <span className="qa-n">{n(r.parts)}</span>
                <span className="qa-barwrap"><span className="qa-bar" style={{ width: `${Math.max(3, Math.round((r.parts / max) * 100))}%` }} /></span>
                <Columns strip={r.strip} labels={labels} max={colMax} />
              </button>
            </li>
          );
        })}
      </ul>
      <Key anyNone={rows.some((r) => r.strip.some((c) => c.state === "none"))} />
    </>
  );
}

/** What the columns mean, drawn: the three marks and a few words each. */
function Key({ anyNone }: { anyNone: boolean }) {
  return (
    <p className="qa-key">
      <span><i className="qa-sw is-in" />questions in that exam</span>
      <span><i className="qa-sw is-gap" />not in the papers in Plumi</span>
      {anyNone && <span><i className="qa-sw is-none" />no paper in Plumi</span>}
    </p>
  );
}

/** One form: its bar (a tap practises it), and where the subject has Angles, the button that opens them under it (a lock for anyone who is not Pro). */
function FormLine({ meta, rows, data, code, row, top, angles, onPractise }: {
  meta: SubjectMeta; rows: ReadonlyMap<string, BankRow>; data: Insights; code: string; row: FormRow; top: number; angles: boolean; onPractise(code: string, form: Form | null): void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const noun = row.parts === 1 ? "question" : "questions";
  return (
    <li className="qa-formli">
      <div className="qa-formline">
        <button type="button" className="qa-mixrow" onClick={() => onPractise(code, row.form)} data-testid="analysis-form" data-form={row.form}
          aria-label={`Practise ${FORM_NAMES[row.form]}: ${n(row.parts)} ${noun}, usually ${marksText(row.avg)} ${row.avg === 1 ? "mark" : "marks"}`}>
          <span className="qa-flab">{FORM_NAMES[row.form]}</span>
          <span className="qa-barwrap"><span className="qa-bar" style={{ width: `${Math.max(4, Math.round((row.parts / top) * 100))}%` }} /></span>
          <span className="qa-fn">{n(row.parts)}</span>
          <span className="qa-fm">{marksText(row.avg)} {row.avg === 1 ? "mark" : "marks"}</span>
        </button>
        {angles && <AnglesButton open={open} onToggle={() => { if (!open) track("topic_angles_opened", { subject: meta.slug, topic: code, form: row.form }); setOpen((v) => !v); }} controls={id} form={FORM_NAMES[row.form]} />}
      </div>
      {angles && open && <AnglesPanel id={id} meta={meta} ins={data} code={code} row={row} rows={rows} onPractise={onPractise} />}
    </li>
  );
}

function TopicPage({ meta, rows, data, stat, name, titleId, labels, onPractise }: {
  meta: SubjectMeta; rows: ReadonlyMap<string, BankRow>; data: Insights; stat: TopicStat; name: string; titleId: string; labels: ReadonlyMap<string, string>; onPractise(code: string, form: Form | null): void;
}) {
  const mix = useMemo(() => formMix(data, stat.code), [data, stat.code]);
  const top = Math.max(1, ...mix.map((m) => m.parts));
  const max = stripMax(stat);
  const noun = (k: number) => (k === 1 ? "question" : "questions");
  const angles = hasAngles(meta.slug, meta.data?.parts);
  return (
    <>
      <h2 id={titleId} className="qa-title qa-ttitle" data-testid="analysis-topic-title"><span className="qa-code">{stat.code}</span>{name}</h2>
      <ul className="qa-tiles" aria-label="Size">
        <li><b data-testid="analysis-parts">{n(stat.parts)}</b><span>{noun(stat.parts)}</span></li>
        <li><b>{n(stat.marks)}</b><span>marks</span></li>
        <li><b>{stat.seriesIn}<small> of {stat.open}</small></b><span>{stat.open === 1 ? "exam" : "exams"}</span></li>
      </ul>
      <section aria-labelledby={`${titleId}-how`}>
        <h3 id={`${titleId}-how`} className="qa-h">How it is asked <small>tap a bar to practise it</small></h3>
        <ul className="qa-mix" data-testid="analysis-mix">
          {mix.map((m) => (
            <FormLine key={m.form} meta={meta} rows={rows} data={data} code={stat.code} row={m} top={top} angles={angles && m.form !== "other"} onPractise={onPractise} />
          ))}
        </ul>
      </section>
      <section aria-labelledby={`${titleId}-years`}>
        <h3 id={`${titleId}-years`} className="qa-h">Over the years <small>in the {stat.open} {stat.open === 1 ? "exam" : "exams"} in Plumi</small></h3>
        <ol className="qa-strip" style={{ "--n": stat.strip.length } as React.CSSProperties} data-testid="analysis-strip">
          {stat.strip.map((c) => (
            <li key={c.id} className={`qa-col is-${c.state}`} aria-label={`${seriesName(c.id, labels)}: ${c.state === "in" ? `${c.n} ${noun(c.n)}` : c.state === "gap" ? "not in the papers in Plumi" : "no paper in Plumi"}`}>
              <span className="qa-cn" aria-hidden="true">{c.state === "none" ? "" : c.n}</span>
              <span className="qa-col-bar" aria-hidden="true"><i style={{ height: c.state === "in" ? `${Math.max(8, Math.round((c.n / max) * 100))}%` : undefined }} /></span>
              <span className="qa-cl" aria-hidden="true"><b>{MONTHS[c.id.slice(0, 3)] ?? ""}</b>{seriesYear(c.id)}</span>
            </li>
          ))}
        </ol>
        <Key anyNone={stat.strip.some((c) => c.state === "none")} />
      </section>
      <div className="qa-go">
        <button type="button" className="btn gold" onClick={() => onPractise(stat.code, null)} data-testid="analysis-practise">Practise these {n(stat.parts)}</button>
      </div>
    </>
  );
}
