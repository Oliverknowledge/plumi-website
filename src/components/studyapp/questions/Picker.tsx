"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compareLabels, MAX_SET_PARTS, marksOf, progress, type QuestionsData } from "@/lib/studyapp/questions/model";
import {
  areaState, BANDS, buildSetInput, filterCount, filterRows, hasScheme, minutesFor, mix, NO_FILTERS, partsByQuestion, seeded, sortRows, toggleArea,
  type BankRow, type Filters,
} from "@/lib/studyapp/questions/picker";
import { type CatalogueSubject, type SubjectMeta } from "@/lib/studyapp/questions/subject";
import { qa } from "@/lib/studyapp/questions/store";
import { toast } from "../toast";
import { useBankText, useSubject } from "./bankData";
import { FiltersDialog, topicName } from "./FiltersDialog";
import { CloseIcon, PlusIcon, SearchIcon } from "./icons";
import { ChevronIcon, FilterIcon, ShuffleIcon } from "./pickerIcons";
import { ResultList } from "./ResultList";
import { SetsSheet } from "./SetsSheet";
import { SubjectChooser } from "./SubjectChooser";

const clock = () => Date.now();
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The picker: choose a subject, then search, filter (one Filters sheet), tick the questions to do (or let "Mix for me"
 * choose), and Start. A set can hold up to 60 parts. The subject and topics are remembered on this device.
 */
export function Picker({ catalogue, q }: { catalogue: CatalogueSubject[]; q: QuestionsData }) {
  const saved = q.pick.subject && catalogue.some((c) => c.slug === q.pick.subject) ? q.pick.subject : null;
  const [choosing, setChoosing] = useState(!saved);
  const [sets, setSets] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const recentSubjects = useMemo(() => [...new Set(q.sets.map((s) => s.subject))].slice(0, 4), [q.sets]);
  const resume = q.sets.filter((s) => !s.finishedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const browsing = !!saved && !choosing;
  const title = catalogue.find((c) => c.slug === saved)?.title ?? saved ?? "";

  return (
    <main className={`qs-page qs-picker${leaving ? " is-leaving" : ""}`} data-testid="picker" id="qs-main">
      <div className="wrap">
        <div className="qs-col">
          <header className="qs-head">
            <div className="qs-head-text">
              <h1>Questions</h1>
              {browsing ? (
                <button type="button" className="qs-subj" onClick={() => setChoosing(true)} data-testid="change-subject" aria-label={`${title}. Change subject`}>
                  <span>{title}</span><ChevronIcon />
                </button>
              ) : (
                <p className="qs-sub">Pick your subject</p>
              )}
            </div>
            {q.sets.length > 0 && (
              <button type="button" className="btn ghost" onClick={() => setSets(true)} data-testid="your-sets">Your sets<span className="k">{q.sets.length}</span></button>
            )}
          </header>

          {resume && !leaving && (() => {
            const p = progress(resume, q.answers);
            return (
              <div className="qs-resume" data-testid="resume">
                <Image src="/study/mascot/plumi-focused.svg" alt="" width={44} height={44} unoptimized />
                <div className="qs-resume-text"><b>{resume.name}</b><span>{p.done} of {p.of} marked</span></div>
                <button type="button" className="btn" onClick={() => qa.open(resume.id)} data-testid="resume-btn">Pick up</button>
              </div>
            );
          })()}

          {!browsing ? (
            <SubjectChooser catalogue={catalogue} recent={[...(saved ? [saved] : []), ...recentSubjects].filter((s, i, a) => a.indexOf(s) === i)} current={saved}
              onPick={(slug) => { qa.pick(slug, slug === saved ? q.pick.topics : []); setChoosing(false); }} />
          ) : (
            <Browse key={saved} slug={saved} q={q} title={title} onChange={() => setChoosing(true)} onLeave={setLeaving} />
          )}
        </div>
      </div>
      {sets && <SetsSheet q={q} onClose={() => setSets(false)} />}
    </main>
  );
}

function Browse({ slug, q, title, onChange, onLeave }: { slug: string; q: QuestionsData; title: string; onChange(): void; onLeave(on: boolean): void }) {
  const [attempt, setAttempt] = useState(0);
  const data = useSubject(slug, attempt);
  const [slow, setSlow] = useState(false);
  const loading = data.state === "loading";
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlow(true), 8000);
    return () => { clearTimeout(t); setSlow(false); };
  }, [loading, attempt]);
  const retry = () => setAttempt((a) => a + 1);
  if (data.state === "error") {
    return (
      <div className="qs-fail" role="status">
        <Image src="/study/mascot/plumi-curious.svg" alt="" width={64} height={64} unoptimized />
        <b>Those questions did not load</b>
        <span>Check your connection, then try again.</span>
        <div className="qs-fail-acts"><button type="button" className="btn gold" onClick={retry}>Try again</button><button type="button" className="btn" onClick={onChange}>Change subject</button></div>
      </div>
    );
  }
  if (data.state === "loading") {
    return (
      <div className="qs-loading" role="status" aria-label={`Loading ${title}`}>
        <div className="qs-skel-tools" aria-hidden="true"><i /><i /></div>
        <div className="qs-skel-rows" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="qs-skel"><i /><b><u /><u /></b></span>)}</div>
        <span className="qs-sr">Loading {title}</span>
        {slow && <div className="qs-slow"><span>Still loading. A slow connection?</span><button type="button" className="qs-link" onClick={retry}>Try again</button></div>}
      </div>
    );
  }
  return <Loaded meta={data.meta} rows={data.rows} q={q} onChange={onChange} onLeave={onLeave} />;
}

type Mixed = { rows: BankRow[]; n: number };

function Loaded({ meta, rows, q, onChange, onLeave }: { meta: SubjectMeta; rows: BankRow[]; q: QuestionsData; onChange(): void; onLeave(on: boolean): void }) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<Map<string, BankRow>>(new Map());
  const [live, setLive] = useState("");
  const [fopen, setFopen] = useState(false);
  const [mixed, setMixed] = useState<Mixed | null>(null);
  const [starting, setStarting] = useState(false);
  const topics = useMemo(() => q.pick.topics.filter((t) => meta.topics.some((x) => x.code === t)), [q.pick.topics, meta.topics]);
  const bank = useBankText(meta.slug, search.trim().length > 0);
  const text = bank.text;

  useEffect(() => { const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 160); return () => clearTimeout(t); }, [search]);

  const sorted = useMemo(() => sortRows(rows, meta.series.map((s) => s.id), compareLabels), [rows, meta.series]);
  const groups = useMemo(() => partsByQuestion(sorted), [sorted]);
  const filtered = useMemo(() => filterRows(sorted, { ...filters, topics }, text), [sorted, filters, topics, text]);
  const recent = useMemo(() => new Set(q.recent.map((r) => r.id)), [q.recent]);
  const showScheme = useMemo(() => rows.some(hasScheme) && rows.some((r) => !hasScheme(r)), [rows]);

  const toggle = useCallback((r: BankRow) => {
    setSel((m) => {
      const n = new Map(m);
      if (n.has(r.id)) n.delete(r.id);
      else if (n.size < MAX_SET_PARTS) n.set(r.id, r);
      else toast(`A set holds up to ${MAX_SET_PARTS} questions`);
      setLive(`${plural(n.size, "question", "questions")} picked`);
      return n;
    });
  }, []);
  const addQuestion = useCallback((rs: BankRow[]) => {
    setSel((m) => {
      const n = new Map(m);
      let added = 0;
      for (const r of rs) if (n.size < MAX_SET_PARTS) { n.set(r.id, r); added++; }
      setLive(`Added ${plural(added, "part", "parts")}. ${plural(n.size, "question", "questions")} picked`);
      return n;
    });
  }, []);

  const setTopics = (next: string[]) => { setMixed(null); qa.pick(meta.slug, next); };
  const toggleTopic = (code: string) => setTopics(topics.includes(code) ? topics.filter((c) => c !== code) : [...topics, code]);
  const patch = (next: Partial<Filters>) => { setMixed(null); setFilters((f) => ({ ...f, ...next })); };
  const seed = useRef(0);
  const doMix = (n: number) => {
    if (!filtered.length) { toast("Nothing matches to mix"); return; }
    seed.current = ((seed.current || clock()) * 1664525 + 1013904223) >>> 0;
    const picked = mix(filtered, n, { recent, rng: seeded(seed.current), topics });
    setSel(new Map(picked.map((r) => [r.id, r])));
    setMixed({ rows: picked, n });
    setLive(`Mixed ${plural(picked.length, "question", "questions")}`);
  };
  const chosen = [...sel.values()];
  const marks = marksOf(chosen);
  const start = () => {
    if (!chosen.length || starting) return;
    const go = () => qa.start(buildSetInput(meta, chosen));
    if (reduced()) { go(); return; }
    setStarting(true); onLeave(true);
    setTimeout(go, 150);
  };
  const nFilters = filterCount(filters, topics);
  const anyFilter = nFilters > 0 || !!search;
  const clearFilters = () => { setSearch(""); setFilters(NO_FILTERS); setTopics([]); };

  // the rail: the topics (or, in a long specification, its areas) as quick chips, then the other filters that are on, each removable
  const long = meta.topics.length > 14;
  const bySection = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of meta.topics) { const a = m.get(t.section); if (a) a.push(t.code); else m.set(t.section, [t.code]); }
    return m;
  }, [meta.topics]);
  const areas = meta.sections.filter((s) => bySection.has(s.code));
  const railAreas = long && areas.length > 1;
  const nameOf = (list: { id: string; name?: string; label?: string }[], id: string) => { const x = list.find((e) => e.id === id); return x?.name ?? x?.label ?? id; };
  const band = BANDS.find((b) => b.id === filters.band);
  const others: { key: string; label: string; off(): void }[] = [];
  if (filters.paper) others.push({ key: "paper", label: nameOf(meta.papers, filters.paper), off: () => patch({ paper: null }) });
  if (filters.series) others.push({ key: "series", label: nameOf(meta.series, filters.series), off: () => patch({ series: null }) });
  if (band && band.id !== "any") others.push({ key: "band", label: `${band.label} marks`, off: () => patch({ band: "any" }) });
  if (filters.scheme) others.push({ key: "scheme", label: "Mark scheme", off: () => patch({ scheme: false }) });
  const hasRail = meta.topics.length > 0 || others.length > 0;

  const inMix = !!mixed;
  const listRows = mixed ? mixed.rows : filtered;
  const label = inMix ? `${plural(listRows.length, "question", "questions")} in your mix` : `${plural(listRows.length, "question", "questions")}`;

  return (
    <div className={`qs-browse${starting ? " is-starting" : ""}`}>
      <a className="qs-skip" href="#qs-results-list" onClick={(e) => { e.preventDefault(); document.getElementById("qs-results-list")?.focus(); }}>Skip to the questions</a>
      <div className="qs-tools">
        <div className="qs-tools-row">
          <label className="qs-search">
            <SearchIcon /><span className="qs-sr">Search the questions</span>
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setMixed(null); }} placeholder="Search the questions" autoComplete="off" enterKeyHint="search" data-testid="search" />
          </label>
          <button type="button" className={`qs-tbtn${nFilters > 0 ? " on" : ""}`} aria-haspopup="dialog" onClick={() => setFopen(true)} data-testid="filters-toggle">
            <FilterIcon /><span>Filters</span>{nFilters > 0 && <span className="qs-badge" aria-label={`${nFilters} on`}>{nFilters}</span>}
          </button>
          <button type="button" className="qs-tbtn qs-mixbtn" onClick={() => doMix(mixed?.n ?? 10)} data-testid="mix"><ShuffleIcon /><span>Mix for me</span></button>
        </div>
        {hasRail && !inMix && (
          <div className="qs-rail" role="group" aria-label="Topics and filters">
            {railAreas
              ? areas.map((s) => {
                const codes = bySection.get(s.code)!;
                const st = areaState(codes, topics);
                return <button key={s.code} type="button" className={`qs-chip${st !== "none" ? " on" : ""}${st === "some" ? " part" : ""}`} aria-pressed={st === "all" ? true : st === "some" ? "mixed" : false} onClick={() => setTopics(toggleArea(topics, codes))}>{s.title}</button>;
              })
              : meta.topics.map((t) => <button key={t.code} type="button" className={`qs-chip${topics.includes(t.code) ? " on" : ""}`} aria-pressed={topics.includes(t.code)} onClick={() => toggleTopic(t.code)}>{topicName(t)}</button>)}
            {others.map((o) => <button key={o.key} type="button" className="qs-chip on qs-chip-x" onClick={o.off} aria-label={`Remove filter: ${o.label}`}>{o.label}<CloseIcon /></button>)}
          </div>
        )}
      </div>

      <section className="qs-results" aria-label="Questions">
        {inMix ? (
          <div className="qs-res-head qs-mixhead">
            <p className="qs-nres"><b data-testid="count">{listRows.length}</b> in your mix</p>
            <span className="qs-mixacts">
              <span className="qs-sizes" role="group" aria-label="How many">
                {[5, 10, 15].map((n) => <button key={n} type="button" className={`qs-size${mixed!.n === n ? " on" : ""}`} aria-pressed={mixed!.n === n} onClick={() => doMix(n)} data-testid={`mix-${n}`}>{n}</button>)}
              </span>
              <button type="button" className="qs-tbtn" onClick={() => doMix(mixed!.n)}><ShuffleIcon /><span>Shuffle</span></button>
              <button type="button" className="qs-link" onClick={() => setMixed(null)}>Browse all</button>
            </span>
          </div>
        ) : (
          <div className="qs-res-head">
            <p className="qs-nres" role="status" aria-live="polite">
              <b data-testid="count">{filtered.length.toLocaleString("en-GB")}</b> {filtered.length === 1 ? "question" : "questions"}
              {search.trim() && !text && !bank.failed ? <span className="qs-count-note"> · looking through the papers</span> : null}
              {search.trim() && bank.failed ? <span className="qs-count-note"> · searching titles only <button type="button" className="qs-link" onClick={bank.retry}>Try again</button></span> : null}
            </p>
            {anyFilter ? <button type="button" className="qs-link" onClick={clearFilters}>Clear filters</button> : null}
          </div>
        )}
        {rows.length === 0 ? (
          <div className="qs-empty"><Image src="/study/mascot/plumi-curious.svg" alt="" width={72} height={72} unoptimized /><b>No questions here yet</b><button type="button" className="btn" onClick={onChange}>Change subject</button></div>
        ) : listRows.length === 0 ? (
          <div className="qs-empty"><Image src="/study/mascot/plumi-curious.svg" alt="" width={72} height={72} unoptimized /><b>Nothing matches</b><button type="button" className="btn" onClick={clearFilters}>Clear filters</button></div>
        ) : (
          <ResultList key={inMix ? "mix" : "all"} rows={listRows} meta={meta} selected={sel} done={recent} groups={groups} onToggle={toggle} onAddQuestion={addQuestion} full={sel.size >= MAX_SET_PARTS} label={label} />
        )}
      </section>

      <p className="qs-sr" role="status" aria-live="polite">{live}</p>
      {chosen.length > 0 && (
        <div className="qs-selbar" role="region" aria-label="Your set">
          <p className="qs-sel-count">
            <b data-testid="sel-count">{chosen.length}</b> picked
            {marks != null ? <span className="qs-sel-more"> · {marks} {marks === 1 ? "mark" : "marks"}<span className="qs-sel-min"> · about {minutesFor(marks)} min</span></span> : null}
          </p>
          <button type="button" className="qs-clear" onClick={() => { setSel(new Map()); setLive("Cleared"); }} aria-label="Clear the picked questions"><CloseIcon /></button>
          <button type="button" className="btn gold qs-start" onClick={start} data-testid="start"><PlusIcon /> Start</button>
        </div>
      )}

      {fopen && (
        <FiltersDialog meta={meta} topics={topics} filters={filters} onFilters={patch} onTopics={setTopics} showScheme={showScheme} count={filtered.length} onClose={() => setFopen(false)} />
      )}
    </div>
  );
}
