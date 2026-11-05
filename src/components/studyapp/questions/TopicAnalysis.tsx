"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { examsText, formMix, marksText, seriesYear, sortedTopics, stripMax, topicStat, TOPIC_ORDERS, type Insights, type StripCell, type TopicOrder, type TopicStat } from "@/lib/studyapp/questions/insights";
import { FORM_NAMES, type Form } from "@/lib/studyapp/questions/questionForm";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";
import type { InsightsState } from "./useInsights";
import { Radios } from "./FeedBar";
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
export function TopicAnalysis({ meta, insights, onClose, onPractise }: {
  meta: SubjectMeta;
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
  return (
    <dialog
      ref={ref} className="qs-dialog qa-dlg card" aria-labelledby={titleId} onClose={onClose}
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
          <TopicPage data={data} stat={stat} name={topicName(t)} titleId={titleId} labels={labels} onPractise={practise} />
        ) : (
          <TopicList meta={meta} data={data} codes={codes} order={order} onOrder={setOrder} titleId={titleId} onOpen={open} openRef={opener} last={topic} />
        )}
      </div>
    </dialog>
  );
}

/** One dot per exam, oldest first: filled where the topic has parts in it, a ring where the papers in Plumi have none, a dash where Plumi holds no paper of the topic's year for that exam. */
function Dots({ strip, labels }: { strip: StripCell[]; labels: ReadonlyMap<string, string> }) {
  return (
    <span className="qa-dots" style={{ "--n": strip.length } as React.CSSProperties} aria-hidden="true">
      {strip.map((c) => <i key={c.id} className={`qa-dot is-${c.state}`} title={`${seriesName(c.id, labels)}: ${c.state === "in" ? `${c.n} ${c.n === 1 ? "question" : "questions"}` : c.state === "gap" ? "not in the papers in Plumi" : "no paper in Plumi"}`} />)}
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
  const exams = data.series.length;
  return (
    <>
      <h2 id={titleId} className="qa-title">Topic analysis</h2>
      <p className="qa-sub" data-testid="analysis-sub">In the {exams} exams in Plumi, {n(data.parts)} questions</p>
      <Radios
        className="qf-seg qa-sort" label="Order the topics" value={order} onPick={(v) => onOrder(v as TopicOrder)} testid="analysis-order"
        options={TOPIC_ORDERS.map((o) => [o.id, o.label] as [string, string])}
      />
      <div className="qa-axis" aria-hidden="true"><span>Questions</span><span className="qa-dots" style={{ "--n": exams } as React.CSSProperties}>{data.series.map((s) => <b key={s}>{seriesYear(s)}</b>)}</span></div>
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
                <Dots strip={r.strip} labels={labels} />
              </button>
            </li>
          );
        })}
      </ul>
      <Key anyNone={rows.some((r) => r.strip.some((c) => c.state === "none"))} />
    </>
  );
}

/** What the dots mean, drawn: the three marks and a few words each. */
function Key({ anyNone }: { anyNone: boolean }) {
  return (
    <p className="qa-key">
      <span><i className="qa-dot is-in" />in the papers in Plumi</span>
      <span><i className="qa-dot is-gap" />not in the papers in Plumi</span>
      {anyNone && <span><i className="qa-dot is-none" />no paper in Plumi</span>}
    </p>
  );
}

function TopicPage({ data, stat, name, titleId, labels, onPractise }: {
  data: Insights; stat: TopicStat; name: string; titleId: string; labels: ReadonlyMap<string, string>; onPractise(code: string, form: Form | null): void;
}) {
  const mix = useMemo(() => formMix(data, stat.code), [data, stat.code]);
  const top = Math.max(1, ...mix.map((m) => m.parts));
  const max = stripMax(stat);
  const noun = (k: number) => (k === 1 ? "question" : "questions");
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
            <li key={m.form}>
              <button type="button" className="qa-mixrow" onClick={() => onPractise(stat.code, m.form)} data-testid="analysis-form" data-form={m.form}
                aria-label={`Practise ${FORM_NAMES[m.form]}: ${n(m.parts)} ${noun(m.parts)}, usually ${marksText(m.avg)} ${m.avg === 1 ? "mark" : "marks"}`}>
                <span className="qa-flab">{FORM_NAMES[m.form]}</span>
                <span className="qa-barwrap"><span className="qa-bar" style={{ width: `${Math.max(4, Math.round((m.parts / top) * 100))}%` }} /></span>
                <span className="qa-fn">{n(m.parts)}</span>
                <span className="qa-fm">{marksText(m.avg)} {m.avg === 1 ? "mark" : "marks"}</span>
              </button>
            </li>
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
