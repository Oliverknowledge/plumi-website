"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compareLabels, MAX_SET_PARTS, marksOf, progress, type QuestionsData } from "@/lib/studyapp/questions/model";
import { BANDS, buildSetInput, filterRows, mix, NO_FILTERS, partsByQuestion, seeded, sortRows, type Band, type BankRow, type Filters } from "@/lib/studyapp/questions/picker";
import { topicLabel, type CatalogueSubject, type SubjectMeta } from "@/lib/studyapp/questions/subject";
import { qa } from "@/lib/studyapp/questions/store";
import { toast } from "../toast";
import { useBankText, useSubject } from "./bankData";
import { PlusIcon, SearchIcon } from "./icons";
import { ResultList } from "./ResultList";
import { SetsSheet } from "./SetsSheet";
import { SubjectChooser } from "./SubjectChooser";

const clock = () => Date.now();

/**
 * The picker: choose a subject, its topics and a few filters, tick the parts to do (or let "Mix for me" choose), and
 * Start. A set can hold up to 60 parts. The subject and topics are remembered on this device.
 */
export function Picker({ catalogue, q }: { catalogue: CatalogueSubject[]; q: QuestionsData }) {
  const saved = q.pick.subject && catalogue.some((c) => c.slug === q.pick.subject) ? q.pick.subject : null;
  const [choosing, setChoosing] = useState(!saved);
  const [sets, setSets] = useState(false);
  const recentSubjects = useMemo(() => [...new Set(q.sets.map((s) => s.subject))].slice(0, 4), [q.sets]);
  const resume = q.sets.filter((s) => !s.finishedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return (
    <main className="qs-page qs-picker" data-testid="picker">
      <div className="wrap">
        <div className="ph qs-ph-head">
          <div>
            <h1>Questions</h1>
            <p className="qs-sub">Tick some, then write under each part.</p>
          </div>
          <button type="button" className="btn" onClick={() => setSets(true)} data-testid="your-sets">Your sets{q.sets.length > 0 && <span className="k">{q.sets.length}</span>}</button>
        </div>

        {resume && (() => {
          const p = progress(resume, q.answers);
          return (
            <div className="qs-resume card" data-testid="resume">
              <Image src="/study/mascot/plumi-focused.svg" alt="" width={48} height={48} unoptimized />
              <div className="qs-resume-text"><b>{resume.name}</b><span>{p.done} of {p.of} marked</span></div>
              <button type="button" className="btn gold" onClick={() => qa.open(resume.id)} data-testid="resume-btn">Pick up</button>
            </div>
          );
        })()}

        {choosing || !saved ? (
          <SubjectChooser catalogue={catalogue} recent={[...(saved ? [saved] : []), ...recentSubjects].filter((s, i, a) => a.indexOf(s) === i)} current={saved}
            onPick={(slug) => { qa.pick(slug, slug === saved ? q.pick.topics : []); setChoosing(false); }} />
        ) : (
          <Browse key={saved} slug={saved} q={q} title={catalogue.find((c) => c.slug === saved)?.title ?? saved} onChange={() => setChoosing(true)} />
        )}
      </div>
      {sets && <SetsSheet q={q} onClose={() => setSets(false)} />}
    </main>
  );
}

function Browse({ slug, q, title, onChange }: { slug: string; q: QuestionsData; title: string; onChange(): void }) {
  const [attempt, setAttempt] = useState(0);
  const data = useSubject(slug, attempt);
  if (data.state === "error") {
    return (
      <div className="qs-fail card" role="status">
        <b>Those questions did not load</b>
        <p>Check your connection, then try again.</p>
        <div className="qs-fail-acts"><button type="button" className="btn gold" onClick={() => setAttempt((a) => a + 1)}>Try again</button><button type="button" className="btn" onClick={onChange}>Change subject</button></div>
      </div>
    );
  }
  if (data.state === "loading") {
    return <div className="qs-loading" role="status" aria-label={`Loading ${title}`}><span className="qs-rows-ghost" aria-hidden="true" /><span className="qs-sr">Loading {title}</span></div>;
  }
  return <Loaded meta={data.meta} rows={data.rows} q={q} onChange={onChange} />;
}

function Loaded({ meta, rows, q, onChange }: { meta: SubjectMeta; rows: BankRow[]; q: QuestionsData; onChange(): void }) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<Map<string, BankRow>>(new Map());
  const [live, setLive] = useState("");
  const [fopen, setFopen] = useState(false);   // on a phone the filters fold away so the questions are in reach
  const topics = useMemo(() => q.pick.topics.filter((t) => meta.topics.some((x) => x.code === t)), [q.pick.topics, meta.topics]);
  const text = useBankText(meta.slug, search.trim().length > 0);

  useEffect(() => { const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 160); return () => clearTimeout(t); }, [search]);

  const sorted = useMemo(() => sortRows(rows, meta.series.map((s) => s.id), compareLabels), [rows, meta.series]);
  const groups = useMemo(() => partsByQuestion(sorted), [sorted]);
  const filtered = useMemo(() => filterRows(sorted, { ...filters, topics }, text), [sorted, filters, topics, text]);
  const recent = useMemo(() => new Set(q.recent.map((r) => r.id)), [q.recent]);

  const toggle = useCallback((r: BankRow) => {
    setSel((m) => {
      const n = new Map(m);
      if (n.has(r.id)) n.delete(r.id);
      else if (n.size < MAX_SET_PARTS) n.set(r.id, r);
      else toast(`A set holds up to ${MAX_SET_PARTS} parts`);
      setLive(`${n.size} selected`);
      return n;
    });
  }, []);
  const addQuestion = useCallback((rs: BankRow[]) => {
    setSel((m) => {
      const n = new Map(m);
      for (const r of rs) if (n.size < MAX_SET_PARTS) n.set(r.id, r);
      setLive(`${n.size} selected`);
      return n;
    });
  }, []);

  const setTopics = (next: string[]) => qa.pick(meta.slug, next);
  const toggleTopic = (code: string) => setTopics(topics.includes(code) ? topics.filter((c) => c !== code) : [...topics, code]);
  const seed = useRef(0);
  const doMix = (n: number) => {
    if (!filtered.length) { toast("Nothing matches to mix"); return; }
    seed.current = ((seed.current || clock()) * 1664525 + 1013904223) >>> 0;
    const picked = mix(filtered, n, { recent, rng: seeded(seed.current), topics });
    setSel(new Map(picked.map((r) => [r.id, r])));
    setLive(`Mixed ${picked.length} parts`);
    toast(`Mixed ${picked.length} ${picked.length === 1 ? "part" : "parts"}`);
  };
  const chosen = [...sel.values()];
  const marks = marksOf(chosen);
  const start = () => { if (chosen.length) qa.start(buildSetInput(meta, chosen)); };
  const anyFilter = filters.paper || filters.series || filters.band !== "any" || filters.scheme || search || topics.length;
  const nFilters = topics.length + (filters.paper ? 1 : 0) + (filters.series ? 1 : 0) + (filters.band !== "any" ? 1 : 0) + (filters.scheme ? 1 : 0) + (search ? 1 : 0);
  const clearFilters = () => { setSearch(""); setFilters(NO_FILTERS); setTopics([]); };

  return (
    <div className="qs-pick-grid">
      <aside className="qs-filters card" aria-label="Filters">
        <div className="qs-subject">
          <div><span className="lbl">Subject</span><b>{meta.title}</b></div>
          <button type="button" className="btn ghost" onClick={onChange} data-testid="change-subject">Change</button>
        </div>
          <label className="qs-search">
            <SearchIcon /><span className="qs-sr">Search the questions</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the words" autoComplete="off" data-testid="search" />
          </label>
        <button type="button" className="btn qs-ftoggle" aria-expanded={fopen} onClick={() => setFopen((o) => !o)} data-testid="filters-toggle">
          {fopen ? "Hide filters" : "Filters"}{!fopen && nFilters > 0 && <span className="k">{nFilters}</span>}
        </button>
        <div className="qs-fbody" data-open={fopen}>

        <TopicChips meta={meta} chosen={topics} onToggle={toggleTopic} onClear={() => setTopics([])} />

        <div className="qs-fgroup">
          <div className="qs-selects">
            <label><span className="lbl">Paper</span>
              <select value={filters.paper ?? ""} onChange={(e) => setFilters((f) => ({ ...f, paper: e.target.value || null }))}>
                <option value="">Any paper</option>
                {meta.papers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label><span className="lbl">Series</span>
              <select value={filters.series ?? ""} onChange={(e) => setFilters((f) => ({ ...f, series: e.target.value || null }))}>
                <option value="">Any series</option>
                {meta.series.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>
          <div role="group" aria-label="Marks"><span className="lbl">Marks</span>
            <div className="qs-pills">
              {BANDS.map((b) => <button key={b.id} type="button" className={`qs-pill${filters.band === b.id ? " on" : ""}`} aria-pressed={filters.band === b.id} onClick={() => setFilters((f) => ({ ...f, band: b.id as Band }))}>{b.label}</button>)}
            </div>
          </div>
          <label className="qs-check-row"><input type="checkbox" checked={filters.scheme} onChange={(e) => setFilters((f) => ({ ...f, scheme: e.target.checked }))} /><span className="qs-box" aria-hidden="true" /> Has a mark scheme</label>
        </div>

        <div className="qs-mix" role="group" aria-label="Mix for me">
          <span className="lbl">Mix for me</span>
          <div className="qs-mix-btns">
            {[5, 10, 15].map((n) => <button key={n} type="button" className="btn" onClick={() => doMix(n)} data-testid={`mix-${n}`}>{n}</button>)}
          </div>
        </div>
        </div>
      </aside>

      <section className="qs-results" aria-label="Questions">
        <div className="qs-res-head">
          <p><b data-testid="count">{filtered.length.toLocaleString("en-GB")}</b> {filtered.length === 1 ? "part" : "parts"}{!text && search ? " (still reading the papers)" : ""}</p>
          {anyFilter ? <button type="button" className="qs-link" onClick={clearFilters}>Clear filters</button> : null}
        </div>
        {filtered.length === 0 ? (
          <div className="qs-empty card"><Image src="/study/mascot/plumi-curious.svg" alt="" width={64} height={64} unoptimized /><b>Nothing matches</b><button type="button" className="btn" onClick={clearFilters}>Clear filters</button></div>
        ) : (
          <ResultList rows={filtered} meta={meta} selected={sel} done={recent} groups={groups} onToggle={toggle} onAddQuestion={addQuestion} full={sel.size >= MAX_SET_PARTS} />
        )}
      </section>

      <div className="qs-selbar" role="region" aria-label="Your set">
        <p className="qs-live qs-sr" role="status" aria-live="polite">{live}</p>
        <p className="qs-sel-count"><b data-testid="sel-count">{chosen.length}</b> picked{marks != null ? <> · {marks} {marks === 1 ? "mark" : "marks"}</> : null}</p>
        <button type="button" className="btn ghost" onClick={() => { setSel(new Map()); setLive("Cleared"); }} disabled={!chosen.length}>Clear</button>
        <button type="button" className="btn gold" onClick={start} disabled={!chosen.length} data-testid="start"><PlusIcon /> Start</button>
      </div>
    </div>
  );
}

/** Topic chips under their areas. A long specification keeps the areas shut until one is opened (or has a topic ticked). */
function TopicChips({ meta, chosen, onToggle, onClear }: { meta: SubjectMeta; chosen: string[]; onToggle(code: string): void; onClear(): void }) {
  const by = useMemo(() => {
    const m = new Map<string, typeof meta.topics>();
    for (const t of meta.topics) { const a = m.get(t.section); if (a) a.push(t); else m.set(t.section, [t]); }
    return m;
  }, [meta]);
  const short = meta.topics.length <= 14;
  const areas = meta.sections.filter((s) => by.has(s.code));
  const loose = meta.topics.filter((t) => !meta.sections.some((s) => s.code === t.section));
  const chip = (t: SubjectMeta["topics"][number]) => (
    <button key={t.code} type="button" className={`qs-pill${chosen.includes(t.code) ? " on" : ""}`} aria-pressed={chosen.includes(t.code)} onClick={() => onToggle(t.code)} data-testid="topic-chip">
      {topicLabel(t)}
    </button>
  );
  return (
    <div className="qs-topics-pick" role="group" aria-label="Topics">
      <div className="qs-fhead"><span className="lbl">Topics</span>{chosen.length > 0 && <button type="button" className="qs-link" onClick={onClear}>All topics</button>}</div>
      {short || areas.length === 0 ? (
        <div className="qs-pills">{meta.topics.map(chip)}</div>
      ) : (
        areas.map((s) => (
          <details key={s.code} className="qs-area" open={by.get(s.code)!.some((t) => chosen.includes(t.code)) || undefined}>
            <summary>{s.title}</summary>
            <div className="qs-pills">{by.get(s.code)!.map(chip)}</div>
          </details>
        ))
      )}
      {loose.length > 0 && areas.length > 0 && !short && <div className="qs-pills">{loose.map(chip)}</div>}
    </div>
  );
}
