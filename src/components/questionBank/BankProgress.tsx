"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import { bankTopicPath, paperName, seriesLabel, topicName, topicRef, type BankPart, type BankSubject, type BankTopic } from "@/content/questionBank";
import { dailyCounts, partStatus, ROUGH, standing, STATE_LABEL, STATE_ORDER, streak, subjectTotals, topicAttempts, useBankMarks, type PartRecord, type Standing, type TopicState } from "@/lib/bankProgress";
import { InkScore } from "./SelfMark";
import { BoardLookSwitch, practiseWith, TopicBoard, useBoardLook, type BoardSubject } from "./TopicBoard";

/**
 * "Your marking": what self-marking has added up to. On a desk it is two tabs of the bank's one
 * card (QuestionBank.tsx), `bare`: Your marking (the share of marks you've earned over a pixel
 * bar, every topic in one bar by how it's going, which opens the topic map the app draws, the
 * last fortnight, and where you're dropping marks) and History (every question marked here,
 * newest first, with Redo). Questions missed a few days ago are offered back ("Have another
 * go"), which the bank's list then shows on their own.
 *
 * Before the first mark it is one line and a nudge to the first question. On a phone it is
 * its own card folded to a single row (the score and what needs attention), so the questions
 * are still on the first screen. Nothing renders on the server, because what it shows lives
 * in this browser.
 */

const noop = () => () => {};
const DAYS = 14;
const GLYPH: Record<TopicState, string> = { needs: "!", developing: "", rusty: "~", early: "", strong: "✓" };

/**
 * The share of marks as a number over a pixel bar: ten cells, filled to the nearest tenth,
 * the marks behind it underneath.
 */
function Score({ share, scored, outOf, small }: { share: number; scored?: number; outOf?: number; small?: boolean }) {
  const pct = Math.round(share * 100);
  const on = Math.round(share * 10);
  return (
    <span className={`qb-score${small ? " is-small" : ""}`} role="img" aria-label={`${pct}% of the marks you’ve tried${outOf ? `: ${scored} of ${outOf}` : ""}`}>
      <b aria-hidden="true">{pct}<i>%</i></b>
      <span className="qb-score-bar" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < on ? "is-on" : ""} />)}</span>
      {!small && outOf ? <small aria-hidden="true">{scored} of {outOf} marks</small> : null}
    </span>
  );
}

const BAR_ORDER: TopicState[] = ["strong", "developing", "rusty", "needs", "early"];
const BAR_WORD: Record<TopicState, string> = { strong: "strong", developing: "developing", rusty: "rusty", needs: "need attention", early: "not yet" };

/** The topic map folded to one bar: every topic, by how it's going. Opens the map. */
function StateBar({ tally, tried, total, open, onToggle }: { tally: Record<TopicState, number>; tried: number; total: number; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="qb-statebar" aria-expanded={open} onClick={onToggle}>
      <span className="qb-statebar-head"><span className="qb-label">Your topics</span><span>{tried} of {total} tried</span><span className="qb-statebar-more" aria-hidden="true">{open ? "Hide map" : "Map"}</span></span>
      <span className="qb-statebar-bar" aria-hidden="true">{BAR_ORDER.map(s => tally[s] > 0 && <i key={s} className={`is-${s}`} style={{ flexGrow: tally[s] }} />)}</span>
      <span className="qb-statebar-key">{BAR_ORDER.filter(s => s !== "early" && tally[s]).map(s => <span key={s}><i className={`is-${s}`} aria-hidden="true" />{tally[s]} {BAR_WORD[s]}</span>)}</span>
    </button>
  );
}

/** For the bank card's header: the score and the streak, small. */
export function MarkingBadge({ subject }: { subject: BankSubject }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const store = useBankMarks();
  const t = useMemo(() => subjectTotals(store.subjects[subject.slug]), [store, subject.slug]);
  const run = useMemo(() => streak(store), [store]);
  // Only "Got it / Partly / Missed" marks: no share to show, but the streak still counts.
  if (!mounted || (t.share === null && run < 2)) return null;
  return (
    <span className="qb-badge">
      {t.share !== null && <Score share={t.share} small />}
      {run > 1 && <span className="qb-prog-streak" title="Days in a row you’ve marked at least one question">{run}-day streak</span>}
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

export function BankProgress({ subject, onTopic, onTopics, board, lockedTopic, compact, parts, onAgain, onRedo, bare }: {
  subject: BankSubject; onTopic?: (code: string) => void; lockedTopic?: string; compact?: boolean;
  /** Just a tab's contents, for the bank card that holds the tabs: "overview" or "history". */
  bare?: "overview" | "history";
  /** The bank's parts, for naming the questions in History (null while they load). */
  parts?: BankPart[] | null;
  /** Show only the questions due to have another go at. */
  onAgain?: () => void;
  /** Show just this one question again, from History. */
  onRedo?: (id: string) => void;
  /** Practise several topics at once (a note on the board). */
  onTopics?: (codes: string[]) => void;
  /** What the revision board needs of the subject: its topics, colour and past papers. */
  board?: BoardSubject;
}) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const look = useBoardLook();
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
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
  // The Your marking tab opens onto the map; the phone's folded card keeps it folded.
  const mapOpen = userOpen ?? !compact;
  if (!mounted) return null;

  const empty = view.questions === 0;
  const fortnight = days.reduce((n, d) => n + d.n, 0);
  const activeDays = days.filter(d => d.n).length;
  const level = (n: number) => (n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : 3);
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

  // The revision board stands in for the marking summary, on a desk's tab and in a phone's folded row.
  const boardOn = look !== "now" && !!board && (bare === "overview" || (!bare && compact));
  if (empty && !boardOn) {
    const nudge = (
      <>
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
      </>
    );
    return bare
      ? <div className="qb-prog is-bare is-empty">{nudge}</div>
      : <section className="lp-card qb-prog is-empty" aria-labelledby="qb-prog-title">{nudge}</section>;
  }

  const fortnightStrip = (
    <figure className="qb-fortnight">
      <figcaption>
        <span className="qb-label">Last 2 weeks</span>
        <span>{fortnight} {fortnight === 1 ? "answer" : "answers"} on {activeDays} {activeDays === 1 ? "day" : "days"}</span>
      </figcaption>
      <ol className="qb-fortnight-days">
        {days.map((d, i) => (
          <li key={d.day} className={`is-l${level(d.n)}${i === days.length - 1 ? " is-today" : ""}`}
            title={`${new Date(d.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: ${d.n} ${d.n === 1 ? "answer" : "answers"} marked`}>
            <i aria-hidden="true" />
            <span aria-hidden="true">{new Date(d.at).toLocaleDateString("en-GB", { weekday: "narrow" })}</span>
          </li>
        ))}
      </ol>
    </figure>
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
    <details className="qb-prog-more" open={mapOpen} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o !== mapOpen) setUserOpen(o); }}>
      <summary className="qb-prog-sum">
        <span>Your topic map</span>
        <span className="qb-prog-sum-hint">{view.tried} of {view.total} topics tried{view.tally.early === view.total ? " · two answers on a topic colour its square in" : ""}</span>
      </summary>
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

  const glance = (
    <div className={`qb-glance${view.share === null ? " is-unscored" : ""}`}>
      {view.share !== null && <Score share={view.share} scored={view.scored} outOf={view.outOf} />}
      <StateBar tally={view.tally} tried={view.tried} total={view.total} open={mapOpen} onToggle={() => setUserOpen(!mapOpen)} />
      {fortnightStrip}
    </div>
  );

  const topicBoard = boardOn && (
    <TopicBoard look={look as Exclude<typeof look, "now">} subjects={[board!]} practise={practiseWith(onTopics && { slug: subject.slug, go: onTopics })} lockedTopic={lockedTopic} />
  );
  if (bare === "overview" && boardOn) return <div className="qb-prog is-bare">{again}{topicBoard}{foot}</div>;
  if (boardOn) {
    // A phone: the row folds the board away, so the questions are still on the first screen.
    return (
      <details className="lp-card qb-prog is-compact has-board">
        <summary className="qb-prog-row">
          {view.share !== null && <Score share={view.share} small />}
          <span className="qb-prog-row-text">
            <strong>My topics</strong>
            <span>{empty ? "Plan what to revise next" : <>{view.questions} marked{view.tally.needs ? <> · <b>{view.tally.needs} need attention</b></> : null}</>}</span>
          </span>
        </summary>
        <div className="qb-prog-body">
          {again}
          {topicBoard}
          {!empty && (
            <details className="qb-prog-more">
              <summary className="qb-prog-sum"><span>Your history</span><span className="qb-prog-sum-hint">{view.questions} {view.questions === 1 ? "question" : "questions"}</span></summary>
              {history}
            </details>
          )}
          {foot}
        </div>
      </details>
    );
  }
  if (bare) return <div className="qb-prog is-bare">{bare === "overview" && <BoardLookSwitch />}{bare === "history" ? <>{again}{history}{foot}</> : <>{glance}{again}{weak}{map}{foot}</>}</div>;

  return (
    <details className="lp-card qb-prog is-compact">
      <summary className="qb-prog-row">
        {view.share !== null && <Score share={view.share} small />}
        <span className="qb-prog-row-text">
          <strong>My topics</strong>
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
