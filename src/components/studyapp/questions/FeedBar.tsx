"use client";

import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import type { MarkBand } from "@/lib/markBands";
import { calcWords, FEED_SORTS, toggleIn, toggleYear, yearGroups, yearState, type CalcMode, type FeedFilters, type FeedSort } from "@/lib/studyapp/questions/feed";
import { areaState, toggleArea } from "@/lib/studyapp/questions/picker";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";
import { topicName } from "./FiltersDialog";
import { CloseIcon, SearchIcon } from "./icons";
import { ChevronIcon, FilterIcon, ShuffleIcon } from "./pickerIcons";

const n = (x: number) => x.toLocaleString("en-GB");

/**
 * The strip at the top of the feed, which sticks under the app's own bar: the search, how many questions there are (and, quietly, how many the student has
 * marked), "Mix them up" and "Practise these", and the button that opens the filters (always on a phone, where they start folded).
 */
export const FeedHead = forwardRef<HTMLDivElement, {
  search: string; onSearch(v: string): void; searchNote: React.ReactNode;
  count: number; progress: string | null; active: number; open: boolean; onToggle(): void;
  tier: string | null; phone: boolean;
  /** The question under the reading line ("Q12 \u00b7 3 marks"), so a student always knows where they are. */
  here: string | null;
  /** "Mix them up" and "Practise these": in the strip on a desk, inside the Filters card on a phone (the strip there is one slim row). */
  acts: React.ReactNode;
}>(function FeedHead({ search, onSearch, searchNote, count, progress, active, open, onToggle, tier, phone, here, acts }, ref) {
  return (
    <div className="qf-head" ref={ref} role="search" aria-label="Find questions">
      <label className="qs-search qf-search">
        <SearchIcon /><span className="qs-sr">Search the questions</span>
        <input type="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder={phone ? "Search" : "Search the questions"} autoComplete="off" enterKeyHint="search" data-testid="feed-search" />
      </label>
      <button type="button" className={`qs-tbtn qf-fbtn${active > 0 ? " on" : ""}`} aria-expanded={open} aria-controls="qf-body" onClick={onToggle} data-testid="feed-filters-toggle">
        <FilterIcon /><span>Filters</span>{active > 0 && <span className="qs-badge" aria-label={`${active} on`}>{active}</span>}
      </button>
      <div className="qf-count">
        <p className="qf-nres" role="status" aria-live="polite"><b data-testid="feed-count">{n(count)}</b> {count === 1 ? "question" : "questions"}{tier ? ` \u00b7 ${tier}` : ""}{searchNote}</p>
        {(progress || here) && (
          <p className="qf-prog">
            {progress && <span className="qf-prog-n" data-testid="feed-progress">{progress}</span>}
            {here && <span className="qf-here" data-testid="feed-here" aria-hidden="true">{here}</span>}
          </p>
        )}
      </div>
      {!phone && <div className="qf-acts">{acts}</div>}
    </div>
  );
});

/** "Mix them up" and "Practise these" (or "Practise the first 60" when the list is longer). */
export function FeedActs({ mixed, onMix, onPractise, count, practiseLabel, practiseNote }: { mixed: boolean; onMix(): void; onPractise(): void; count: number; practiseLabel: string; practiseNote: string }) {
  return (
    <>
      <button type="button" className="qs-tbtn qf-mixbtn" onClick={onMix} data-testid="feed-mix" title="A question from each topic in turn, in a random order"><ShuffleIcon /><span>{mixed ? "Mix again" : "Mix them up"}</span></button>
      <button type="button" className="qs-tbtn qf-practise" onClick={onPractise} disabled={count === 0} title={practiseNote} data-testid="feed-practise"><span>{practiseLabel}</span></button>
    </>
  );
}

/** The filters that are on, each one a chip to take off, and Clear all. */
export function FeedPills({ meta, bands, f, onChange, onClear }: { meta: SubjectMeta; bands: readonly MarkBand[]; f: FeedFilters; onChange(p: Partial<FeedFilters>): void; onClear(): void }) {
  const calc = calcWords(meta);
  const pills: { key: string; label: string; off(): void }[] = [
    ...f.topics.map((c) => { const t = meta.topics.find((x) => x.code === c); return { key: `t-${c}`, label: t ? topicName(t) : c, off: () => onChange({ topics: f.topics.filter((x) => x !== c) }) }; }),
    ...f.types.map((id) => ({ key: `ty-${id}`, label: bands.find((b) => b.id === id)?.label ?? id, off: () => onChange({ types: f.types.filter((x) => x !== id) }) })),
    ...(f.papers.length > 2 ? [{ key: "papers", label: `${f.papers.length} papers`, off: () => onChange({ papers: [] }) }]
      : f.papers.map((id) => ({ key: `p-${id}`, label: meta.papers.find((p) => p.id.toLowerCase() === id.toLowerCase())?.name ?? id, off: () => onChange({ papers: f.papers.filter((x) => x !== id) }) }))),
    ...(f.series.length > 2 ? [{ key: "series", label: `${f.series.length} exams`, off: () => onChange({ series: [] }) }]
      : f.series.map((id) => ({ key: `s-${id}`, label: meta.series.find((s) => s.id === id)?.label ?? id, off: () => onChange({ series: f.series.filter((x) => x !== id) }) }))),
    ...(f.calc ? [{ key: "calc", label: f.calc === "only" ? (calc.label === "Calculator" ? "Calculator allowed" : "Calculation questions only") : (calc.label === "Calculator" ? "No calculator" : "No calculation questions"), off: () => onChange({ calc: "" }) }] : []),
    ...(f.scheme ? [{ key: "scheme", label: "Has a mark scheme", off: () => onChange({ scheme: false }) }] : []),
    ...(f.hideDone ? [{ key: "done", label: "Marked ones hidden", off: () => onChange({ hideDone: false }) }] : []),
  ];
  if (!pills.length) return null;
  return (
    <ul className="qf-pills" aria-label="Filters on">
      {pills.map((p) => <li key={p.key}><button type="button" className="qs-chip on qs-chip-x" onClick={p.off} aria-label={`Remove filter: ${p.label}`}>{p.label}<CloseIcon /></button></li>)}
      {pills.length > 1 && <li><button type="button" className="qf-clear" onClick={onClear}>Clear all</button></li>}
    </ul>
  );
}

/**
 * A radio group made of buttons: one tab stop (the chosen one), the arrow keys move and choose, Home and End go to the ends.
 */
export function Radios({ className, label, value, options, onPick, testid, lab }: { className: string; label: string; value: string; options: [string, string][]; onPick(v: string): void; testid?: string; lab?: React.ReactNode }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = Math.max(0, options.findIndex(([v]) => v === value));
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % options.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + options.length) % options.length : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onPick(options[to][0]);
    refs.current[to]?.focus();
  };
  return (
    <div className={className} role="radiogroup" aria-label={label}>
      {lab}
      {options.map(([v, text], i) => (
        <button key={v} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={value === v} tabIndex={i === at ? 0 : -1} className={value === v ? "is-on" : ""} onClick={() => onPick(v)} onKeyDown={(e) => onKey(e, i)} data-testid={testid ? `${testid}-${v || "both"}` : undefined}>{text}</button>
      ))}
    </div>
  );
}

/** A dropdown of ticks that stays open while you tick (a native details, closed by a press outside it or Escape). */
function Multi({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const away = (e: Event) => { if (el.open && !el.contains(e.target as Node)) el.open = false; };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && el.open) { el.open = false; el.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, []);
  return (
    <details className="qf-multi" ref={ref}>
      <summary aria-labelledby={`${id}-l ${id}-s`}><span className="qf-lab" id={`${id}-l`}>{label}</span><span className="qf-sum" id={`${id}-s`}>{summary}</span><ChevronIcon /></summary>
      <div className="qf-multi-list" role="group" aria-label={label}>
        <div className="qf-multi-head"><b>{label}</b><button type="button" className="qs-tbtn" onClick={() => { const d = ref.current; if (d) { d.open = false; d.querySelector("summary")?.focus(); } }}>Done</button></div>
        {children}
      </div>
    </details>
  );
}

/**
 * The filters, as the public question bank has them: question type, paper, exam and year, sort, calculator, a mark scheme, and the topics. They are
 * a card of the notebook below the strip; on a phone they are folded away until "Filters" is pressed.
 */
export function FeedFilterBody({ meta, bands, f, onChange, hasCalc, hasScheme, hasDone, sort, onSort, hidden, acts, tiers, tierNow, onTier }: {
  meta: SubjectMeta; bands: readonly MarkBand[]; f: FeedFilters; onChange(p: Partial<FeedFilters>): void; hasCalc: boolean; hasScheme: boolean; hasDone: boolean;
  sort: FeedSort; onSort(s: FeedSort): void; hidden: boolean;
  /** On a phone: Mix them up and Practise these, at the top of the card. */
  acts?: React.ReactNode;
  /** The tiers the subject has (two or more, or none), the one the student sits (null: both), and the way to change it in one tap. */
  tiers: readonly string[]; tierNow: string | null; onTier(next: string | null): void;
}) {
  const calc = calcWords(meta);
  const years = useMemo(() => yearGroups(meta.series), [meta.series]);
  const bySection = useMemo(() => {
    const m = new Map<string, SubjectMeta["topics"]>();
    for (const t of meta.topics) { const a = m.get(t.section); if (a) a.push(t); else m.set(t.section, [t]); }
    return m;
  }, [meta.topics]);
  const areas = meta.sections.filter((s) => bySection.has(s.code));
  const loose = meta.topics.filter((t) => !meta.sections.some((s) => s.code === t.section));
  const grouped = meta.topics.length > 14 && areas.length > 1;
  const [openArea, setOpenArea] = useState<string | null>(null);
  const chip = (t: SubjectMeta["topics"][number]) => {
    const on = f.topics.includes(t.code);
    return <button key={t.code} type="button" className={`qs-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onChange({ topics: toggleIn(f.topics, t.code) })}>{topicName(t)}</button>;
  };
  const sums = (ids: string[], list: { id: string; name?: string; label?: string }[], none: string, word: string) => {
    if (!ids.length) return none;
    if (ids.length === 1) { const x = list.find((e) => e.id.toLowerCase() === ids[0].toLowerCase()); return x?.name ?? x?.label ?? ids[0]; }
    return `${ids.length} ${word}`;
  };
  return (
    <div className="qf-body" id="qf-body" hidden={hidden} data-testid="feed-filters">
      {acts && <div className="qf-row qf-actsrow">{acts}</div>}
      {tiers.length > 1 && (
        <div className="qf-row" role="group" aria-labelledby="qf-tier">
          <span className="qf-rowlab" id="qf-tier">Tier</span>
          <div className="qf-chips">
            {tiers.map((t) => <button key={t} type="button" className={`qs-chip${tierNow === t ? " on" : ""}`} aria-pressed={tierNow === t} onClick={() => onTier(t)} data-testid="feed-tier">{t}</button>)}
            <button type="button" className={`qs-chip${tierNow === null ? " on" : ""}`} aria-pressed={tierNow === null} onClick={() => onTier(null)} data-testid="feed-tier">Both</button>
          </div>
        </div>
      )}
      {bands.length > 0 && (
        <div className="qf-row" role="group" aria-labelledby="qf-types">
          <span className="qf-rowlab" id="qf-types">Question type<span className="qf-hint"> by the marks it is worth</span></span>
          <div className="qf-chips">
            {bands.map((b) => <button key={b.id} type="button" className={`qs-chip${f.types.includes(b.id) ? " on" : ""}`} aria-pressed={f.types.includes(b.id)} onClick={() => onChange({ types: toggleIn(f.types, b.id) })} data-testid="feed-type">{b.label}</button>)}
          </div>
        </div>
      )}
      <div className="qf-row qf-controls">
        {meta.papers.length > 1 && (
          <Multi label="Which paper" summary={sums(f.papers, meta.papers, "All papers", "papers")}>
            <button type="button" className="qs-link" onClick={() => onChange({ papers: [] })}>All papers</button>
            {meta.papers.map((p) => (
              <label key={p.id}><input type="checkbox" checked={f.papers.some((x) => x.toLowerCase() === p.id.toLowerCase())} onChange={() => onChange({ papers: f.papers.some((x) => x.toLowerCase() === p.id.toLowerCase()) ? f.papers.filter((x) => x.toLowerCase() !== p.id.toLowerCase()) : [...f.papers, p.id] })} />{p.name}{p.title ? ` · ${p.title}` : ""}</label>
            ))}
          </Multi>
        )}
        {meta.series.length > 1 && (
          <Multi label="Which exam" summary={sums(f.series, meta.series, "All exams", "exams")}>
            <button type="button" className="qs-link" onClick={() => onChange({ series: [] })}>All exams</button>
            {meta.series.map((s) => (
              <label key={s.id}><input type="checkbox" checked={f.series.includes(s.id)} onChange={() => onChange({ series: toggleIn(f.series, s.id) })} />{s.label}</label>
            ))}
          </Multi>
        )}
        <label className="qf-sort">
          <span className="qf-lab">Sort</span>
          <select value={sort} onChange={(e) => onSort(e.target.value as FeedSort)} data-testid="feed-sort">
            {FEED_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        {hasCalc && (
          <Radios className="qf-seg" label={calc.label} value={f.calc} options={[["", "Any"], ["only", calc.only], ["none", calc.none]]} onPick={(v) => onChange({ calc: v as CalcMode })} testid="feed-calc" lab={<span className="qf-lab">{calc.label}</span>} />
        )}
        {hasScheme && <button type="button" className={`qs-chip${f.scheme ? " on" : ""}`} aria-pressed={f.scheme} onClick={() => onChange({ scheme: !f.scheme })} data-testid="feed-scheme">Has a mark scheme</button>}
        {hasDone && <button type="button" className={`qs-chip${f.hideDone ? " on" : ""}`} aria-pressed={f.hideDone} onClick={() => onChange({ hideDone: !f.hideDone })} data-testid="feed-hidedone">Hide the ones I have marked</button>}
      </div>
      {years.length > 1 && (
        <div className="qf-row" role="group" aria-labelledby="qf-years">
          <span className="qf-rowlab" id="qf-years">Year</span>
          <div className="qf-chips qf-years">
            {years.map((y) => {
              const st = yearState(f.series, y.ids);
              return <button key={y.year} type="button" className={`qs-chip${st !== "none" ? " on" : ""}${st === "some" ? " part" : ""}`} aria-pressed={st === "all" ? true : st === "some" ? "mixed" : false} onClick={() => onChange({ series: toggleYear(f.series, y.ids) })} data-testid="feed-year">{y.year}</button>;
            })}
          </div>
        </div>
      )}
      {meta.topics.length > 0 && (
        <div className="qf-row" role="group" aria-labelledby="qf-topics">
          <span className="qf-rowlab" id="qf-topics">Topics</span>
          {grouped ? (
            <>
              <div className="qf-chips">
                {areas.map((s) => {
                  const ts = bySection.get(s.code)!;
                  const codes = ts.map((t) => t.code);
                  const st = areaState(codes, f.topics);
                  const open = openArea === s.code;
                  return (
                    <span key={s.code} className={`qf-area${open ? " is-open" : ""}`}>
                      <button type="button" className={`qs-chip${st !== "none" ? " on" : ""}${st === "some" ? " part" : ""}`} aria-pressed={st === "all" ? true : st === "some" ? "mixed" : false} onClick={() => onChange({ topics: toggleArea(f.topics, codes) })}>{s.title}</button>
                      <button type="button" className="qf-open" aria-expanded={open} aria-label={`Topics in ${s.title}`} onClick={() => setOpenArea(open ? null : s.code)}><ChevronIcon /></button>
                    </span>
                  );
                })}
                {loose.map(chip)}
              </div>
              {openArea && bySection.get(openArea) && <div className="qf-chips qf-subs">{bySection.get(openArea)!.map(chip)}</div>}
            </>
          ) : <div className="qf-chips">{meta.topics.map(chip)}</div>}
        </div>
      )}
    </div>
  );
}
