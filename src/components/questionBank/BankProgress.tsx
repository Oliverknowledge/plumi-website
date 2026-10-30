"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import { bankTopicPath, paperName, seriesLabel, topicName, topicRef, type BankPart, type BankSubject, type BankTopic } from "@/content/questionBank";
import { dailyCounts, partStatus, ROUGH, standing, STATE_LABEL, STATE_ORDER, streak, subjectTotals, topicAttempts, useBankMarks, type PartRecord, type Standing, type TopicState } from "@/lib/bankProgress";
import { InkScore } from "./SelfMark";

/**
 * "Your marking": what self-marking has added up to, above the bank. A ring for the
 * share of marks you've earned, where you're dropping marks (the topics to practise
 * next), the last fortnight in this subject, and the topic map the app draws: one
 * square a topic, coloured by how it's going.
 *
 * Two tabs once there's something to show: Overview, and History, every question marked in
 * this subject, newest first, with Redo. Questions missed a few days ago are offered back
 * ("Have another go"), which the bank's list then shows on their own.
 *
 * Before the first mark it is one line and a nudge to the first question. On a phone
 * the whole panel folds to a single row (a small ring and what needs attention), so
 * the questions are still on the first screen. Nothing renders on the server, because
 * what it shows lives in this browser.
 */

const noop = () => () => {};
const DAYS = 14;
const GLYPH: Record<TopicState, string> = { needs: "!", developing: "", rusty: "~", early: "", strong: "✓" };

function Ring({ share, small }: { share: number; small?: boolean }) {
  const pct = Math.round(share * 100);
  return (
    <span className={`qb-ring${small ? " is-small" : ""}`} role="img" aria-label={`${pct}% of the marks you’ve tried`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="qb-ring-track" cx="60" cy="60" r="50" />
        <circle className="qb-ring-fill" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${pct} 100`} />
      </svg>
      <span className="qb-ring-n" aria-hidden="true">{pct}<i>%</i></span>
      {!small && <span className="qb-ring-of" aria-hidden="true">of your marks</span>}
    </span>
  );
}

const dayLabel = (ms: number) => {
  const d = new Date(ms), now = new Date();
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** Every question marked in this subject, newest first: when, which, the mark, and Redo. */
function History({ subject, bank, parts, onRedo }: { subject: BankSubject; bank: Record<string, PartRecord>; parts?: BankPart[] | null; onRedo?: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const byId = useMemo(() => new Map((parts ?? []).map(p => [p.id, p])), [parts]);
  const rows = Object.entries(bank)
    .map(([id, rec]) => ({ id, rec, last: rec.h[rec.h.length - 1] }))
    .filter(r => r.last)
    .sort((a, b) => b.last[2] - a.last[2]);
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <div className="qb-hist">
      <ol>
        {shown.map(({ id, rec, last }) => {
          const p = byId.get(id);
          const topic = subject.topics.find(t => rec.t.includes(t.code));
          const { status, dueAt } = partStatus(rec);
          return (
            <li key={id} className={status === "again" ? "is-again" : ""}>
              <span className="qb-hist-when">{dayLabel(last[2])}</span>
              <span className="qb-hist-q">
                {p ? <>{seriesLabel(subject, p.s)} · {paperName(subject, p.p)} · <b>Q{p.l}</b></> : "A question"}
                {topic && <small>{topic.short ?? topic.title}</small>}
              </span>
              <InkScore s={last[0]} of={last[1]} rough={last[3] === ROUGH} size="note" />
              <span className="qb-hist-state">
                {status === "again" ? <b>Have another go</b>
                  : status === "waiting" && dueAt ? <>Back {new Date(dueAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</>
                    : rec.h.length > 1 ? <>{rec.h.length} tries</> : null}
              </span>
              {onRedo && (
                <button type="button" className="qb-key" onClick={() => { track("bank_redo", { subject: subject.slug, part: id, last: last[1] ? Math.round((last[0] / last[1]) * 100) / 100 : 0 }); onRedo(id); }}>Redo</button>
              )}
            </li>
          );
        })}
      </ol>
      {rows.length > shown.length && <button type="button" className="qb-link" onClick={() => setAll(true)}>Show all {rows.length}</button>}
    </div>
  );
}

export function BankProgress({ subject, onTopic, lockedTopic, compact, parts, onAgain, onRedo }: {
  subject: BankSubject; onTopic?: (code: string) => void; lockedTopic?: string; compact?: boolean;
  /** The bank's parts, for naming the questions in History (null while they load). */
  parts?: BankPart[] | null;
  /** Show only the questions due to have another go at. */
  onAgain?: () => void;
  /** Show just this one question again, from History. */
  onRedo?: (id: string) => void;
}) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"overview" | "history">("overview");
  const store = useBankMarks();
  const bank = store.subjects[subject.slug];

  const view = useMemo(() => {
    const topics = subject.topics.filter(t => t.count > 0);
    const byTopic = new Map<string, Standing>(topics.map(t => [t.code, standing(topicAttempts(bank, [t.code]))]));
    const sections = subject.sections
      .map(sec => ({ ...sec, topics: topics.filter(t => t.section === sec.code) }))
      .filter(sec => sec.topics.length);
    // Topics in no listed section still get their squares.
    const loose = topics.filter(t => !subject.sections.some(s => s.code === t.section));
    if (loose.length) sections.push({ code: "_", title: "Other topics", topics: loose });
    const tally = Object.fromEntries(STATE_ORDER.map(s => [s, 0])) as Record<TopicState, number>;
    let tried = 0;
    for (const st of byTopic.values()) { tally[st.state]++; if (st.attempts) tried++; }
    const weakest = topics
      .map(t => ({ t, st: byTopic.get(t.code)! }))
      .filter(x => x.st.state === "needs" || x.st.state === "developing" || x.st.state === "rusty")
      .sort((a, b) => (a.st.state === "rusty" ? 1 : 0) - (b.st.state === "rusty" ? 1 : 0) || (a.st.estimate ?? 1) - (b.st.estimate ?? 1))
      .slice(0, 3);
    const again = Object.values(bank ?? {}).filter(r => partStatus(r).status === "again").length;
    return { sections, byTopic, tally, tried, total: topics.length, weakest, again, ...subjectTotals(bank) };
  }, [subject, bank]);

  const days = useMemo(() => dailyCounts(store, DAYS, subject.slug), [store, subject.slug]);
  const run = useMemo(() => streak(store), [store]);
  if (!mounted) return null;

  const empty = view.questions === 0;
  const most = Math.max(1, ...days.map(d => d.n));
  const fortnight = days.reduce((n, d) => n + d.n, 0);
  const go = (code: string, slug: string) => onTopic
    ? { as: "button" as const, onClick: () => onTopic(code) }
    : { as: "link" as const, href: bankTopicPath(subject.slug, slug) };

  const square = (t: BankTopic) => {
    const st = view.byTopic.get(t.code)!;
    const label = `${topicName(t)}: ${STATE_LABEL[st.state]}${st.tried ? ", tried once" : ""}${st.outOf ? `, ${st.scored} of ${st.outOf} marks` : ""}`;
    const cls = `qb-sq is-${st.state}${st.tried ? " is-tried" : ""}${lockedTopic === t.code ? " is-here" : ""}`;
    const g = go(t.code, t.slug);
    return g.as === "button"
      ? <button key={t.code} type="button" className={cls} title={label} aria-label={label} onClick={g.onClick}>{GLYPH[st.state]}</button>
      : <Link key={t.code} className={cls} title={label} aria-label={label} href={g.href}>{GLYPH[st.state]}</Link>;
  };

  if (empty) {
    return (
      <section className="lp-card qb-prog is-empty" aria-labelledby="qb-prog-title">
        <div className="qb-prog-empty">
          <div>
            <h2 id="qb-prog-title">Mark yourself and watch your map fill in</h2>
            <p>Open a mark scheme, tap the marks you got, and each topic colours in.</p>
          </div>
          <button type="button" className="lp-btn qb-prog-try" onClick={() => document.querySelector(".qb-rows .qb-row")?.scrollIntoView({ block: "start" })}>Try the first question</button>
        </div>
        {!compact && (
          <div className="qb-map is-preview" aria-hidden="true">
            {view.sections.map(sec => (
              <div key={sec.code} className="qb-map-sec">
                <p className="qb-map-title">{sec.title}</p>
                <div className="qb-map-squares">{sec.topics.map(t => <span key={t.code} className="qb-sq is-early" />)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const stats = (
    <dl className="qb-stats">
      <div><dt>Questions marked</dt><dd>{view.questions.toLocaleString("en-GB")}</dd></div>
      <div><dt>Topics tried</dt><dd>{view.tried}<small> / {view.total}</small></dd></div>
      <div><dt>Need attention</dt><dd className={view.tally.needs ? "is-needs" : ""}>{view.tally.needs}</dd></div>
    </dl>
  );

  const again = view.again > 0 && onAgain && (
    <p className="qb-again">
      <span className="qb-again-n">{view.again}</span>
      <span>{view.again === 1 ? "question you missed is" : "questions you missed are"} ready to have another go at.</span>
      <button type="button" className="lp-btn qb-again-go" onClick={onAgain}>Show me</button>
    </p>
  );
  const history = <History subject={subject} bank={bank ?? {}} parts={parts} onRedo={onRedo} />;

  const weak = view.weakest.length > 0 && (
    <div className="qb-weak">
      <p className="qb-label">Where you’re dropping marks</p>
      <ul>
        {view.weakest.map(({ t, st }) => {
          const g = go(t.code, t.slug);
          return (
            <li key={t.code}>
              <span className={`qb-sq is-${st.state}`} aria-hidden="true">{GLYPH[st.state]}</span>
              <span className="qb-weak-name">{topicRef(t) && <span className="qb-code">{topicRef(t)} </span>}{t.short ?? t.title}<small>{st.outOf ? `${st.scored} of ${st.outOf} marks` : STATE_LABEL[st.state]}</small></span>
              {g.as === "button"
                ? <button type="button" className="qb-key" onClick={g.onClick}>Practise</button>
                : <Link className="qb-key" href={g.href}>Practise</Link>}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const map = (
    <details className="qb-prog-more" open={userOpen ?? !compact} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o !== (userOpen ?? !compact)) setUserOpen(o); }}>
      <summary className="qb-prog-sum"><span>Your topic map</span><span className="qb-prog-sum-hint">{view.tried} of {view.total} topics tried</span></summary>
      <div className="qb-map">
        {view.sections.map(sec => (
          <div key={sec.code} className="qb-map-sec">
            <p className="qb-map-title">{sec.title}</p>
            <div className="qb-map-squares">{sec.topics.map(square)}</div>
          </div>
        ))}
      </div>
      <ul className="qb-legend" aria-label="What the colours mean">
        {STATE_ORDER.map(s => (
          <li key={s}><span className={`qb-sq is-${s}`} aria-hidden="true">{GLYPH[s]}</span>{STATE_LABEL[s]}<b>{view.tally[s]}</b></li>
        ))}
      </ul>
    </details>
  );

  const foot = (
    <p className="qb-prog-foot">
      Saved in this browser only, for now. On iPad, <Link href="/">Plumi</Link> marks your handwriting and draws the same kind of map.
    </p>
  );

  if (compact) {
    return (
      <details className="lp-card qb-prog is-compact">
        <summary className="qb-prog-row">
          {view.share !== null && <Ring share={view.share} small />}
          <span className="qb-prog-row-text">
            <strong>Your marking</strong>
            <span>{view.questions} marked{view.tally.needs ? <> · <b>{view.tally.needs} need attention</b></> : null}</span>
          </span>
        </summary>
        {/* The row already says how many and what needs attention: open straight onto what to practise. */}
        <div className="qb-prog-body">
          {again}
          {weak}
          <details className="qb-prog-more">
            <summary className="qb-prog-sum"><span>Your history</span><span className="qb-prog-sum-hint">{view.questions} {view.questions === 1 ? "question" : "questions"}</span></summary>
            {history}
          </details>
          {map}
          {foot}
        </div>
      </details>
    );
  }

  return (
    <section className="lp-card qb-prog" aria-labelledby="qb-prog-title">
      <header className="qb-prog-head">
        <h2 id="qb-prog-title">Your marking</h2>
        <div className="qb-seg qb-prog-tabs" role="tablist" aria-label="Your marking">
          <button type="button" role="tab" aria-selected={tab === "overview"} className={tab === "overview" ? "is-on" : ""} onClick={() => setTab("overview")}>Overview</button>
          <button type="button" role="tab" aria-selected={tab === "history"} className={tab === "history" ? "is-on" : ""} onClick={() => setTab("history")}>History <span className="qb-n">{view.questions}</span></button>
        </div>
        {run > 1 && <span className="qb-prog-streak" title="Days in a row you’ve marked at least one question">{run}-day streak</span>}
      </header>
      {tab === "history" ? <>{again}{history}{foot}</> : <>
      <div className="qb-prog-top">
        {view.share !== null && <Ring share={view.share} />}
        {stats}
        <figure className="qb-days">
          <div className="qb-days-bars" aria-hidden="true">
            {days.map((d, i) => (
              <span key={d.day} className={`qb-day${i === days.length - 1 ? " is-today" : ""}${d.n ? "" : " is-none"}`}
                style={{ height: `${d.n ? 12 + (d.n / most) * 88 : 6}%` }}
                title={`${new Date(d.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: ${d.n} ${d.n === 1 ? "answer" : "answers"} marked`} />
            ))}
          </div>
          <div className="qb-days-labels" aria-hidden="true">
            {days.map((d, i) => <span key={d.day} className={i === days.length - 1 ? "is-today" : ""}>{new Date(d.at).toLocaleDateString("en-GB", { weekday: "narrow" })}</span>)}
          </div>
          <figcaption>{fortnight} {fortnight === 1 ? "answer" : "answers"} marked in {subject.subject}, last {DAYS} days</figcaption>
        </figure>
      </div>
      {again}
      {weak}
      {map}
      {foot}
      </>}
    </section>
  );
}
